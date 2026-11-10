import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createChrome } from "./chrome-mock.js";
import { matchMediaState } from "./setup.js";

// popup.js is a classic script with no exports. Each test renders popup.html, imports a
// fresh copy of the script and drives it through the DOM, the way a user would.

const POPUP_HTML = readFileSync(resolve("popup.html"), "utf8");
const BYJC_URL = "https://www.byjc.dev/api/jokes/random";
const OFFICIAL_URL = "https://official-joke-api.appspot.com/random_joke";
const JOKEAPI_URL = "https://v2.jokeapi.dev/joke/Pun,Misc?type=twopart&safe-mode";
const DADJOKE_URL = "https://icanhazdadjoke.com/";
const THINKING = "Thinking of a good one...";
const OOPS = "Oops! Could not fetch a joke.";

// Math.random() values that pick each fallback from the three-entry list.
const PICK = { official: 0, jokeapi: 0.4, dadjoke: 0.9 };

let docListeners;
let chrome;

function render() {
  const doc = new DOMParser().parseFromString(POPUP_HTML, "text/html");
  doc.querySelectorAll("script").forEach((s) => s.remove());
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
}

async function load({ store = {} } = {}) {
  render();
  chrome = createChrome({ store });
  vi.stubGlobal("chrome", chrome);
  const add = vi.spyOn(document, "addEventListener");
  vi.resetModules();
  await import("../../popup.js");
  docListeners = add.mock.calls.map(([type, fn]) => [type, fn]);
  document.dispatchEvent(new Event("DOMContentLoaded"));
  await vi.advanceTimersByTimeAsync(0);
}

const response = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => body });

/** fetch mock: `routes[url]` is a body, an Error (rejects), a number (HTTP status) or "hang". */
function mockFetch(routes) {
  const fetch = vi.fn((url) => {
    const route = routes[url];
    if (route === undefined || route instanceof Error) return Promise.reject(route || new TypeError("Failed to fetch"));
    if (route === "hang") return new Promise(() => {});
    if (typeof route === "number") return Promise.resolve(response({}, { ok: false, status: route }));
    return Promise.resolve(response(route));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const $ = (sel) => document.querySelector(sel);
const jokeText = () => $("#joke").textContent;
const buttonIds = () => [...document.querySelectorAll(".button-container button")].map((b) => b.id);
const avatarSrc = () => $(".avatar").getAttribute("src");
const click = (id) => document.getElementById(id).click();
const settle = () => vi.runAllTimersAsync();

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const [type, fn] of docListeners || []) document.removeEventListener(type, fn);
  docListeners = [];
  vi.useRealTimers();
});

describe("opening the popup", () => {
  it("shows the intro, Yes and No, and makes no request", async () => {
    const fetch = mockFetch({});
    await load();
    expect(jokeText()).toBe("Hey, wanna hear a joke?");
    expect(buttonIds()).toEqual(["yes-button", "no-button"]);
    expect(avatarSrc()).toBe("images/intro.png");
    await settle();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("No and the close button close the window", async () => {
    await load();
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    click("no-button");
    click("close-popup");
    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe("joke flow", () => {
  const joke = { setup: "Why did the tab close?", punchline: "It was tired." };

  it("shows the thinking line and avatar, then fetches from the byjc API after 2 s", async () => {
    const fetch = mockFetch({ [BYJC_URL]: joke });
    await load();
    click("yes-button");
    expect(avatarSrc()).toBe("./images/thinking.png");
    expect($("#joke-container").getAttribute("aria-busy")).toBe("true");
    await vi.advanceTimersByTimeAsync(300);
    expect(jokeText().length).toBeGreaterThan(0);
    expect(jokeText().length).toBeLessThan(THINKING.length);
    await vi.advanceTimersByTimeAsync(1600);
    expect(jokeText()).toBe(THINKING);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(BYJC_URL);
  });

  it("types the setup, then offers the punchline", async () => {
    mockFetch({ [BYJC_URL]: joke });
    await load();
    click("yes-button");
    await settle();
    expect(jokeText()).toBe(joke.setup);
    expect(avatarSrc()).toBe("./images/intro.png");
    expect(buttonIds()).toEqual(["joke-button"]);
    expect($("#joke-container").getAttribute("aria-busy")).toBe("false");
  });

  it("caches the fetched joke as not yet revealed", async () => {
    mockFetch({ [BYJC_URL]: joke });
    await load();
    vi.setSystemTime(1_000_000);
    click("yes-button");
    await settle();
    expect(chrome.storage.local.data.lastJoke).toEqual({
      setup: joke.setup,
      punchline: joke.punchline,
      isOneLiner: false,
      punchlineShown: false,
      timestamp: expect.any(Number)
    });
  });

  it("reveals the punchline, laughs, marks it shown and offers another joke", async () => {
    mockFetch({ [BYJC_URL]: joke });
    await load();
    click("yes-button");
    await settle();
    click("joke-button");
    expect(chrome.storage.local.data.lastJoke.punchlineShown).toBe(true);
    await settle();
    expect(jokeText()).toBe(joke.punchline);
    expect(avatarSrc()).toBe("./images/lol.png");
    expect(buttonIds()).toEqual(["joke-again-button"]);
  });

  it("Get another joke fetches a new one", async () => {
    const fetch = mockFetch({ [BYJC_URL]: joke });
    await load();
    click("yes-button");
    await settle();
    click("joke-button");
    await settle();
    fetch.mockImplementation(() => Promise.resolve(response({ setup: "Second setup?", punchline: "Second." })));
    click("joke-again-button");
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jokeText()).toBe("Second setup?");
    expect(buttonIds()).toEqual(["joke-button"]);
  });

  it("a second click during the 2 s wait cancels the first pending fetch", async () => {
    const fetch = mockFetch({ [BYJC_URL]: joke });
    await load();
    click("yes-button");
    await vi.advanceTimersByTimeAsync(1500);
    click("yes-button");
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // Known bug: two typewriters run at once and interleave their characters.
  // Fixed in PR #4 (each typewriter run cancels the previous one).
  it.fails("a second click restarts the thinking line cleanly", async () => {
    mockFetch({ [BYJC_URL]: "hang" });
    await load();
    click("yes-button");
    await vi.advanceTimersByTimeAsync(400);
    click("yes-button");
    await vi.advanceTimersByTimeAsync(1900);
    expect(jokeText()).toBe(THINKING);
  });

  it("says the punchline got lost when the byjc joke has none", async () => {
    mockFetch({ [BYJC_URL]: { setup: "Setup only" } });
    await load();
    click("yes-button");
    await settle();
    click("joke-button");
    await settle();
    expect(jokeText()).toBe("Oops, the punchline got lost! Try another one.");
    expect(avatarSrc()).toBe("./images/intro.png");
    expect(buttonIds()).toEqual(["joke-again-button"]);
  });

  it("still reveals the punchline when the cache write fails", async () => {
    mockFetch({ [BYJC_URL]: joke });
    await load();
    click("yes-button");
    await settle();
    chrome.storage.local.set.mockImplementation(() => {
      throw new Error("quota");
    });
    click("joke-button");
    await settle();
    expect(jokeText()).toBe(joke.punchline);
    expect(console.error).toHaveBeenCalledWith("Failed to update punchlineShown in cache:", expect.any(Error));
  });

  it("still shows the joke when caching it fails", async () => {
    mockFetch({ [BYJC_URL]: joke });
    await load();
    chrome.storage.local.set.mockImplementation(() => {
      throw new Error("quota");
    });
    click("yes-button");
    await settle();
    expect(jokeText()).toBe(joke.setup);
    expect(console.error).toHaveBeenCalledWith("Failed to cache joke:", expect.any(Error));
  });

  it("logs instead of throwing when the button container is gone", async () => {
    mockFetch({ [BYJC_URL]: joke });
    await load();
    click("yes-button");
    await vi.advanceTimersByTimeAsync(100);
    $(".button-container").remove();
    await settle();
    expect(jokeText()).toBe(joke.setup);
    expect(console.error).toHaveBeenCalledWith("Error: Button container not found.");
  });
});

describe("fallback sources", () => {
  it("uses the Official Joke API when byjc returns an error status", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.official);
    const fetch = mockFetch({ [BYJC_URL]: 500, [OFFICIAL_URL]: { setup: "Official?", punchline: "Yes." } });
    await load();
    click("yes-button");
    await settle();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([BYJC_URL, OFFICIAL_URL]);
    expect(jokeText()).toBe("Official?");
    click("joke-button");
    await settle();
    expect(jokeText()).toBe("Yes.");
  });

  it("uses JokeAPI (setup + delivery) when byjc is unreachable", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.jokeapi);
    mockFetch({ [JOKEAPI_URL]: { type: "twopart", setup: "JokeAPI?", delivery: "Delivered." } });
    await load();
    click("yes-button");
    await settle();
    expect(jokeText()).toBe("JokeAPI?");
    expect(chrome.storage.local.data.lastJoke.punchline).toBe("Delivered.");
  });

  it("treats a byjc response without a setup as a failure", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.official);
    const fetch = mockFetch({ [BYJC_URL]: { joke: "wrong shape" }, [OFFICIAL_URL]: { setup: "Official?", punchline: "Yes." } });
    await load();
    click("yes-button");
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jokeText()).toBe("Official?");
  });

  it("asks icanhazdadjoke for JSON and splits the joke at '? '", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.dadjoke);
    const fetch = mockFetch({ [DADJOKE_URL]: { joke: "Why are dads tested? Because they are reliable." } });
    await load();
    click("yes-button");
    await settle();
    expect(fetch).toHaveBeenLastCalledWith(DADJOKE_URL, { headers: { Accept: "application/json" } });
    expect(jokeText()).toBe("Why are dads tested?");
    expect(chrome.storage.local.data.lastJoke).toMatchObject({ punchline: "Because they are reliable.", isOneLiner: false });
  });

  // Only the split point is pinned: main leaves a trailing space on the setup, which PR #4 trims.
  it("splits a dad joke at ' - ' before '? '", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.dadjoke);
    mockFetch({ [DADJOKE_URL]: { joke: "I used to hate facial hair - but then it grew on me. Right?" } });
    await load();
    click("yes-button");
    await settle();
    expect(jokeText().trim()).toBe("I used to hate facial hair");
    expect(chrome.storage.local.data.lastJoke.punchline).toBe("but then it grew on me. Right?");
  });

  it("shows an unsplittable dad joke as a one-liner and skips the punchline step", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.dadjoke);
    mockFetch({ [DADJOKE_URL]: { joke: "I only know 25 letters of the alphabet. I don't know y." } });
    await load();
    click("yes-button");
    await settle();
    expect(jokeText()).toBe("I only know 25 letters of the alphabet. I don't know y.");
    expect(avatarSrc()).toBe("./images/lol.png");
    expect(buttonIds()).toEqual(["joke-again-button"]);
    expect(chrome.storage.local.data.lastJoke).toMatchObject({ punchline: null, isOneLiner: true });
  });

  it("does not split when the break is too close to the end", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.dadjoke);
    mockFetch({ [DADJOKE_URL]: { joke: "Is it? Yes" } });
    await load();
    click("yes-button");
    await settle();
    expect(chrome.storage.local.data.lastJoke).toMatchObject({ setup: "Is it? Yes", isOneLiner: true });
  });

  it("falls back to the most recently cached joke when the sources fail", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.official);
    mockFetch({ [OFFICIAL_URL]: 503 });
    await load();
    // Cached by another popup window after this one opened.
    chrome.storage.local.data.lastJoke = { setup: "Cached setup?", punchline: "Cached.", punchlineShown: false };
    click("yes-button");
    await settle();
    expect(jokeText()).toBe("Cached setup?");
    expect(avatarSrc()).toBe("./images/intro.png");
    expect(buttonIds()).toEqual(["joke-button"]);
  });

  it("shows an error when the sources fail and nothing is cached", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.jokeapi);
    mockFetch({});
    await load();
    click("yes-button");
    await settle();
    expect(jokeText()).toBe(OOPS);
    expect(avatarSrc()).toBe("./images/intro.png");
  });

  it("shows an error when reading the cache throws", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.jokeapi);
    mockFetch({});
    await load();
    chrome.storage.local.get.mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    click("yes-button");
    await settle();
    expect(jokeText()).toBe(OOPS);
    expect(avatarSrc()).toBe("./images/intro.png");
  });

  // Known bug: only one random fallback is tried before giving up.
  // Fixed in PR #4 (every fallback is tried, in random order).
  it.fails("tries the other fallbacks before giving up", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.official);
    const fetch = mockFetch({ [JOKEAPI_URL]: { setup: "JokeAPI?", delivery: "Delivered." } });
    await load();
    click("yes-button");
    await settle();
    expect(fetch.mock.calls.length).toBeGreaterThan(2);
    expect(jokeText()).toBe("JokeAPI?");
  });

  // Known bug: fetches have no timeout, so a hung source leaves "Thinking" up forever.
  // Fixed in PR #4 (5 s timeout per source).
  it.fails("moves on when the byjc API hangs", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.official);
    const fetch = mockFetch({ [BYJC_URL]: "hang", [OFFICIAL_URL]: { setup: "Official?", punchline: "Yes." } });
    await load();
    click("yes-button");
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // Known bug: offline, "Get another joke" brings back the joke already on screen.
  // Fixed in PR #4.
  it.fails("does not repeat the joke on screen when every source fails", async () => {
    vi.spyOn(Math, "random").mockReturnValue(PICK.official);
    mockFetch({});
    await load({ store: { lastJoke: { setup: "Seen it?", punchline: "Yes.", punchlineShown: true } } });
    click("joke-again-button");
    await settle();
    expect(jokeText()).not.toBe("Seen it?");
  });
});

describe("restoring the cached joke", () => {
  it("shows an unrevealed two-part joke's setup with the punchline button", async () => {
    await load({ store: { lastJoke: { setup: "Restored?", punchline: "Restored.", isOneLiner: false, punchlineShown: false } } });
    expect(jokeText()).toBe("Restored?");
    expect(buttonIds()).toEqual(["joke-button"]);
    click("joke-button");
    await settle();
    expect(jokeText()).toBe("Restored.");
    expect(buttonIds()).toEqual(["joke-again-button"]);
  });

  it("offers another joke for a revealed joke", async () => {
    mockFetch({ [BYJC_URL]: { setup: "Fresh?", punchline: "Fresh." } });
    await load({ store: { lastJoke: { setup: "Old?", punchline: "Old.", punchlineShown: true } } });
    expect(buttonIds()).toEqual(["joke-again-button"]);
    click("joke-again-button");
    await settle();
    expect(jokeText()).toBe("Fresh?");
  });

  // Known bug: a revealed joke comes back as its setup only and the punchline can't be reached.
  // Fixed in PR #4 (restore shows setup and punchline).
  it.fails("shows the punchline of a joke whose punchline was already revealed", async () => {
    await load({ store: { lastJoke: { setup: "Old?", punchline: "Old.", punchlineShown: true } } });
    expect(jokeText()).toContain("Old.");
  });

  it("treats a cache entry without punchlineShown (older versions) as revealed", async () => {
    await load({ store: { lastJoke: { setup: "Legacy?", punchline: "Legacy." } } });
    expect(buttonIds()).toEqual(["joke-again-button"]);
  });

  it("offers another joke for a cached one-liner", async () => {
    await load({ store: { lastJoke: { setup: "One-liner.", punchline: null, isOneLiner: true, punchlineShown: false } } });
    expect(jokeText()).toBe("One-liner.");
    expect(buttonIds()).toEqual(["joke-again-button"]);
  });

  it("keeps the intro when the cache has no setup", async () => {
    await load({ store: { lastJoke: { punchline: "orphan" } } });
    expect(jokeText()).toBe("Hey, wanna hear a joke?");
    expect(buttonIds()).toEqual(["yes-button", "no-button"]);
  });

  it("keeps the intro and logs when reading the cache throws", async () => {
    render();
    chrome = createChrome();
    chrome.storage.local.get.mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    vi.stubGlobal("chrome", chrome);
    const add = vi.spyOn(document, "addEventListener");
    vi.resetModules();
    await import("../../popup.js");
    docListeners = add.mock.calls.map(([type, fn]) => [type, fn]);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(jokeText()).toBe("Hey, wanna hear a joke?");
    expect(console.error).toHaveBeenCalledWith("Failed to load cached joke:", expect.any(Error));
  });
});

describe("avatar and accessibility", () => {
  it("hides the avatar when its image fails to load, and shows it again on the next state", async () => {
    mockFetch({ [BYJC_URL]: { setup: "S?", punchline: "P." } });
    await load();
    click("yes-button");
    const avatar = $(".avatar");
    avatar.dispatchEvent(new Event("error"));
    expect(avatar.style.visibility).toBe("hidden");
    expect(console.error).toHaveBeenCalledWith("Avatar failed to load:", expect.any(String));
    expect(avatar.onerror).toBeNull();
    await settle();
    expect(avatar.style.visibility).toBe("visible");
  });

  it("shows text instantly with reduced motion", async () => {
    matchMediaState.reduced = true;
    mockFetch({ [BYJC_URL]: { setup: "Instant?", punchline: "Instant." } });
    await load();
    click("yes-button");
    expect(jokeText()).toBe(THINKING);
    expect($("#joke-container").getAttribute("aria-busy")).toBe("false");
    await vi.advanceTimersByTimeAsync(2000);
    expect(jokeText()).toBe("Instant?");
    expect(buttonIds()).toEqual(["joke-button"]);
    click("joke-button");
    expect(jokeText()).toBe("Instant.");
    expect(buttonIds()).toEqual(["joke-again-button"]);
  });
});
