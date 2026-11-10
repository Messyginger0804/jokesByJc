import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createChrome } from "./chrome-mock.js";
import { matchMediaState } from "./setup.js";

vi.mock("../../motion.js", () => ({ playState: vi.fn(), buttonIn: vi.fn() }));
vi.mock("../../jokes.js", async (importOriginal) => ({ ...(await importOriginal()), fetchJoke: vi.fn() }));

// Vitest runs from the repository root.
const HTML = readFileSync(resolve("popup.html"), "utf8");
const TWO_PART = { setup: "Why did the dev go broke?", punchline: "He used up all his cache.", isOneLiner: false };
const ONE_LINER = { setup: "I only know 25 letters of the alphabet.", punchline: null, isOneLiner: true };

let chrome;
let motion;
let jokes;
let popup;

function mountDom() {
  const doc = new DOMParser().parseFromString(HTML, "text/html");
  document.documentElement.className = doc.documentElement.className;
  document.body.innerHTML = doc.body.innerHTML;
  document.body.querySelectorAll("script").forEach((s) => s.remove());
}

function setImageState(img, { complete, naturalWidth }) {
  Object.defineProperty(img, "complete", { configurable: true, get: () => complete });
  Object.defineProperty(img, "naturalWidth", { configurable: true, get: () => naturalWidth });
}

async function load({ store, reduced = false, logo = { complete: false, naturalWidth: 0 }, beforeImport } = {}) {
  vi.resetModules();
  mountDom();
  matchMediaState.reduced = reduced;
  setImageState(document.querySelector(".ad-logo"), logo);
  chrome = createChrome({ store });
  vi.stubGlobal("chrome", chrome);
  vi.stubGlobal("close", vi.fn());
  motion = await import("../../motion.js");
  jokes = await import("../../jokes.js");
  if (beforeImport) beforeImport();
  popup = await import("../../popup.js");
  await settle();
}

// Lets storage callbacks (microtasks) and pending promise chains run.
const settle = () => vi.advanceTimersByTimeAsync(0);
const text = () => document.getElementById("joke").textContent;
const buttons = () => [...document.querySelectorAll(".button-container button")];
const button = (id) => document.getElementById(id);
const states = () => motion.playState.mock.calls.map(([name]) => name);
const busy = () => document.getElementById("joke-container").getAttribute("aria-busy");

// Runs a request through the 2 s thinking delay and the typewriter.
async function runToEnd() {
  await vi.advanceTimersByTimeAsync(10_000);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  delete document.readyState;
});

describe("popup start-up", () => {
  it("plays the intro and wires Yes, No and the close button", async () => {
    await load();
    expect(states()).toEqual(["intro"]);
    expect(text()).toBe("Hey, wanna hear a joke?");
    button("no-button").click();
    button("close-popup").click();
    expect(window.close).toHaveBeenCalledTimes(2);
  });

  it("waits for DOMContentLoaded when the document is still loading", async () => {
    await load({
      beforeImport: () => Object.defineProperty(document, "readyState", { configurable: true, get: () => "loading" })
    });
    expect(motion.playState).not.toHaveBeenCalled();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(states()).toEqual(["intro"]);
  });
});

describe("DFWSC logo fallback", () => {
  const lockup = () => document.querySelector(".ad-lockup");
  const fallback = () => document.querySelector(".ad-logo-tile .ad-fallback");

  it("keeps the logo when it loads", async () => {
    await load({ logo: { complete: true, naturalWidth: 695 } });
    expect(lockup().hidden).toBe(false);
    expect(fallback().hidden).toBe(true);
  });

  it("shows the text fallback when the logo fails after start-up", async () => {
    await load();
    document.querySelector(".ad-logo").dispatchEvent(new Event("error"));
    expect(lockup().hidden).toBe(true);
    expect(fallback().hidden).toBe(false);
  });

  it("shows the text fallback when the logo already failed before the script ran", async () => {
    await load({ logo: { complete: true, naturalWidth: 0 } });
    expect(lockup().hidden).toBe(true);
    expect(fallback().hidden).toBe(false);
  });

  it("tolerates a footer without the lockup or fallback markup", async () => {
    await load({
      beforeImport: () => {
        const logo = document.querySelector(".ad-logo");
        document.querySelector(".ad-logo-tile").replaceChildren(logo);
      }
    });
    expect(() => document.querySelector(".ad-logo").dispatchEvent(new Event("error"))).not.toThrow();
  });

  it("does nothing when the footer has no logo", async () => {
    await load({ beforeImport: () => document.querySelector(".ad-logo").remove() });
    expect(states()).toEqual(["intro"]);
  });
});

describe("cached joke on open", () => {
  it("restores a two-part joke whose punchline was not shown yet", async () => {
    await load({ store: { lastJoke: { ...TWO_PART, punchlineShown: false } } });
    expect(text()).toBe(TWO_PART.setup);
    expect(motion.playState).toHaveBeenLastCalledWith("restore", { pose: "pointing" });
    expect(buttons().map((b) => b.id)).toEqual(["joke-button"]);
    expect(document.activeElement).not.toBe(button("joke-button"));
  });

  it("restores a revealed joke with its setup and punchline and the cool pose", async () => {
    await load({ store: { lastJoke: { ...TWO_PART, punchlineShown: true } } });
    expect(text()).toBe(`${TWO_PART.setup} ${TWO_PART.punchline}`);
    expect(motion.playState).toHaveBeenLastCalledWith("restore", { pose: "coolguy" });
    expect(buttons().map((b) => b.id)).toEqual(["joke-again-button"]);
  });

  it("treats the older cache format (no punchlineShown) as already shown", async () => {
    await load({ store: { lastJoke: { setup: "Old", punchline: "Format" } } });
    expect(text()).toBe("Old Format");
    expect(buttons().map((b) => b.id)).toEqual(["joke-again-button"]);
  });

  it("restores a one-liner as just its text", async () => {
    await load({ store: { lastJoke: { ...ONE_LINER, punchlineShown: true } } });
    expect(text()).toBe(ONE_LINER.setup);
  });

  it("restores a one-liner with the another-joke button", async () => {
    await load({ store: { lastJoke: { ...ONE_LINER, punchlineShown: false } } });
    expect(buttons().map((b) => b.id)).toEqual(["joke-again-button"]);
  });

  it.each([{ setup: "" }, { setup: 42 }, "garbage", null])("ignores an invalid cache entry %j", async (lastJoke) => {
    await load({ store: { lastJoke } });
    expect(text()).toBe("Hey, wanna hear a joke?");
    expect(buttons().map((b) => b.id)).toEqual(["yes-button", "no-button"]);
  });

  it("does not overwrite a request the user already started", async () => {
    let releaseRead;
    await load({
      store: { lastJoke: TWO_PART },
      beforeImport: () => {
        const realGet = chrome.storage.local.get;
        chrome.storage.local.get = vi.fn((key, callback) => {
          releaseRead = () => realGet(key, callback);
        });
      }
    });
    jokes.fetchJoke.mockResolvedValue({ setup: "Fresh", punchline: "Joke", isOneLiner: false });
    // Yes is clicked before the cache read resolves.
    button("yes-button").click();
    releaseRead();
    await settle();
    expect(text()).not.toBe(TWO_PART.setup);
    expect(motion.playState).not.toHaveBeenCalledWith("restore", expect.anything());
    await runToEnd();
    expect(text()).toBe("Fresh");
  });
});

describe("storage errors", () => {
  it("treats a failed read (lastError) as an empty cache", async () => {
    await load({
      beforeImport: () => {
        chrome.storage.local.get = vi.fn((key, callback) => {
          chrome.runtime.lastError = { message: "read broke" };
          callback(undefined);
          chrome.runtime.lastError = undefined;
        });
      }
    });
    expect(console.error).toHaveBeenCalledWith("Storage read failed:", "read broke");
    expect(buttons().map((b) => b.id)).toEqual(["yes-button", "no-button"]);
  });

  it("treats an undefined result as an empty cache", async () => {
    await load({ beforeImport: () => (chrome.storage.local.get = vi.fn((key, callback) => callback(undefined))) });
    expect(await popup.storageGet("lastJoke")).toEqual({});
  });

  it("treats a throwing storage API as an empty cache", async () => {
    await load({
      beforeImport: () => {
        chrome.storage.local.get = vi.fn(() => {
          throw new Error("context invalidated");
        });
      }
    });
    expect(console.error).toHaveBeenCalledWith("Storage read failed:", expect.any(Error));
  });

  it("logs failed writes without throwing", async () => {
    await load();
    chrome.storage.local.set = vi.fn((items, callback) => {
      chrome.runtime.lastError = { message: "quota" };
      callback();
      chrome.runtime.lastError = undefined;
    });
    popup.storageSet({ a: 1 });
    expect(console.error).toHaveBeenCalledWith("Storage write failed:", "quota");

    chrome.storage.local.set = vi.fn(() => {
      throw new Error("gone");
    });
    expect(() => popup.storageSet({ a: 1 })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith("Storage write failed:", expect.any(Error));
  });
});

describe("joke flow", () => {
  it("thinks, types the setup, cues the punchline, then punches", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValue(TWO_PART);
    button("yes-button").click();
    expect(button("yes-button").disabled).toBe(true);
    expect(button("no-button").disabled).toBe(false);
    expect(states()).toEqual(["intro", "thinking"]);
    expect(jokes.fetchJoke).toHaveBeenCalledWith(null);

    // The thinking line is typed out while the joke loads.
    await vi.advanceTimersByTimeAsync(1500);
    expect(text()).toBe("Thinking of a good one...");

    await runToEnd();
    expect(text()).toBe(TWO_PART.setup);
    expect(states()).toEqual(["intro", "thinking", "setup", "cue"]);
    expect(chrome.storage.local.data.lastJoke).toMatchObject({ ...TWO_PART, punchlineShown: false });
    expect(document.activeElement).toBe(button("joke-button"));
    expect(motion.buttonIn).toHaveBeenCalledWith(button("joke-button"));

    button("joke-button").click();
    await runToEnd();
    expect(text()).toBe(TWO_PART.punchline);
    expect(states().slice(-2)).toEqual(["setup", "punch"]);
    expect(chrome.storage.local.data.lastJoke.punchlineShown).toBe(true);
    expect(document.activeElement).toBe(button("joke-again-button"));
  });

  it("keeps the thinking state for at least two seconds", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValue(TWO_PART);
    button("yes-button").click();
    await vi.advanceTimersByTimeAsync(1999);
    expect(states()).not.toContain("setup");
    await vi.advanceTimersByTimeAsync(1);
    expect(states()).toContain("setup");
  });

  it("goes straight to the punch for a one-liner", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValue(ONE_LINER);
    button("yes-button").click();
    await runToEnd();
    expect(states().slice(-2)).toEqual(["setup", "punch"]);
    expect(buttons().map((b) => b.id)).toEqual(["joke-again-button"]);
  });

  it("asks for a different joke than the one on screen", async () => {
    await load({ store: { lastJoke: { ...TWO_PART, punchlineShown: true } } });
    jokes.fetchJoke.mockResolvedValue(ONE_LINER);
    button("joke-again-button").click();
    expect(states().at(-1)).toBe("again");
    expect(jokes.fetchJoke).toHaveBeenCalledWith(TWO_PART.setup);
  });

  it("uses the cached joke when every source fails and nothing is on screen", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValue(null);
    button("yes-button").click();
    // Cache written by another popup window after this one opened.
    chrome.storage.local.data.lastJoke = TWO_PART;
    await runToEnd();
    expect(text()).toBe(TWO_PART.setup);
    expect(states().at(-1)).toBe("cue");
  });

  it("shows the error and a retry button when every source fails and there is no cache", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValue(null);
    button("yes-button").click();
    await runToEnd();
    expect(text()).toBe("Oops! Could not fetch a joke.");
    expect(states().at(-1)).toBe("error");
    expect(buttons().map((b) => b.id)).toEqual(["retry-button"]);
    expect(document.activeElement).toBe(button("retry-button"));

    jokes.fetchJoke.mockResolvedValue(TWO_PART);
    button("retry-button").click();
    // currentJoke was cleared, so retrying plays the first-time state.
    expect(states().at(-1)).toBe("thinking");
    await runToEnd();
    expect(text()).toBe(TWO_PART.setup);
  });

  it("does not re-show the joke on screen as 'another' joke when offline", async () => {
    await load({ store: { lastJoke: { ...TWO_PART, punchlineShown: true } } });
    jokes.fetchJoke.mockResolvedValue(null);
    button("joke-again-button").click();
    await runToEnd();
    expect(text()).toBe("Oops! Could not fetch a joke.");
    expect(buttons().map((b) => b.id)).toEqual(["retry-button"]);
  });

  it("ignores a superseded request that resolves late", async () => {
    await load();
    let resolveFirst;
    jokes.fetchJoke.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)));
    button("yes-button").click();
    await vi.advanceTimersByTimeAsync(2500);

    jokes.fetchJoke.mockResolvedValueOnce({ setup: "Second", punchline: "Wins", isOneLiner: false });
    popup.initializeJoke();
    resolveFirst({ setup: "First", punchline: "Loses", isOneLiner: false });
    await runToEnd();
    expect(text()).toBe("Second");
    expect(chrome.storage.local.data.lastJoke.setup).toBe("Second");
  });

  it("clears the superseded request's thinking timer and lets it finish", async () => {
    await load({ reduced: true });
    jokes.fetchJoke.mockResolvedValue(TWO_PART);
    const first = popup.initializeJoke();
    await settle();
    expect(vi.getTimerCount()).toBe(1);
    const second = popup.initializeJoke();
    await settle();
    // Only the newer request's 2 s timer is left, and the older request has returned.
    expect(vi.getTimerCount()).toBe(1);
    await expect(first).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(2000);
    await second;
    expect(text()).toBe(TWO_PART.setup);
  });

  it("ignores a superseded request whose cache read resolves late", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValueOnce(null);
    let releaseRead;
    const realGet = chrome.storage.local.get;
    chrome.storage.local.get = vi.fn((key, callback) => {
      releaseRead = () => realGet(key, callback);
    });
    button("yes-button").click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(releaseRead).toBeTypeOf("function");

    chrome.storage.local.get = realGet;
    jokes.fetchJoke.mockResolvedValueOnce(ONE_LINER);
    popup.initializeJoke();
    releaseRead();
    await runToEnd();
    expect(text()).toBe(ONE_LINER.setup);
    expect(states().filter((s) => s === "error")).toEqual([]);
  });

  it("shows a recoverable error when the punchline is missing", async () => {
    await load();
    popup.revealPunchline();
    await runToEnd();
    expect(text()).toBe("Oops, the punchline got lost! Try another one.");
    expect(states().at(-1)).toBe("error");
    expect(buttons().map((b) => b.id)).toEqual(["joke-again-button"]);
  });
});

describe("typewriter", () => {
  it("types one character per tick and marks the bubble busy until done", async () => {
    await load();
    const done = vi.fn();
    popup.typeWriterEffect("abc", done);
    expect(text()).toBe("a");
    expect(busy()).toBe("true");
    await vi.advanceTimersByTimeAsync(50);
    expect(text()).toBe("ab");
    await vi.advanceTimersByTimeAsync(100);
    expect(text()).toBe("abc");
    expect(busy()).toBe("false");
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("cancels the running animation (and its callback) when a new one starts", async () => {
    await load();
    const first = vi.fn();
    popup.typeWriterEffect("first text", first);
    await vi.advanceTimersByTimeAsync(100);
    popup.typeWriterEffect("second");
    await runToEnd();
    expect(text()).toBe("second");
    expect(first).not.toHaveBeenCalled();
  });

  it("works without a callback", async () => {
    await load();
    popup.typeWriterEffect("x");
    await runToEnd();
    expect(text()).toBe("x");
  });

  it("shows text instantly under reduced motion", async () => {
    await load({ reduced: true });
    const done = vi.fn();
    popup.typeWriterEffect("instant text", done);
    expect(text()).toBe("instant text");
    expect(busy()).toBe("false");
    expect(done).toHaveBeenCalledTimes(1);
    popup.typeWriterEffect("no callback");
    expect(text()).toBe("no callback");
  });

  it("follows a live switch to reduced motion", async () => {
    await load();
    matchMediaState.reduced = true;
    popup.typeWriterEffect("now instant");
    expect(text()).toBe("now instant");
  });

  it("does nothing when the joke element is missing", async () => {
    await load();
    document.getElementById("joke").remove();
    const done = vi.fn();
    popup.typeWriterEffect("x", done);
    expect(done).not.toHaveBeenCalled();
  });

  it("still types when the bubble container is missing", async () => {
    await load();
    const joke = document.getElementById("joke");
    document.getElementById("joke-container").replaceWith(joke);
    popup.typeWriterEffect("ok");
    await runToEnd();
    expect(text()).toBe("ok");
    matchMediaState.reduced = true;
    popup.typeWriterEffect("instant");
    expect(text()).toBe("instant");
  });

  it("restoring a cached joke stops an in-progress animation", async () => {
    await load();
    chrome.storage.local.data.lastJoke = ONE_LINER;
    popup.typeWriterEffect("long text being typed");
    await popup.loadCachedJoke();
    await runToEnd();
    expect(text()).toBe(ONE_LINER.setup);
  });

  it("restoring a cached joke tolerates a missing joke element", async () => {
    await load();
    chrome.storage.local.data.lastJoke = ONE_LINER;
    document.getElementById("joke").remove();
    await expect(popup.loadCachedJoke()).resolves.toBeUndefined();
  });
});

describe("buttons", () => {
  it("logs and skips rendering when the button container is missing", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValue(ONE_LINER);
    button("yes-button").click();
    document.querySelector(".button-container").remove();
    await runToEnd();
    expect(console.error).toHaveBeenCalledWith("Error: Button container not found.");
  });

  it("builds controls with textContent (joke text is never parsed as HTML)", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValue({ setup: "<img src=x onerror=alert(1)>", punchline: "<b>p</b>", isOneLiner: false });
    button("yes-button").click();
    await runToEnd();
    expect(document.querySelector("#joke img")).toBeNull();
    expect(text()).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("accessibility: label in name (WCAG 2.5.3)", () => {
  // Visible text, skipping [hidden] subtrees and treating <br> as a space.
  function visibleText(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE || node.hidden) return "";
    if (node.tagName === "BR") return " ";
    return [...node.childNodes].map(visibleText).join("");
  }
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();

  function expectLabelContainsVisibleText(el) {
    const label = el.getAttribute("aria-label");
    const visible = visibleText(el);
    if (!label || !norm(visible)) return;
    expect(norm(label), `${el.id || el.className}: "${label}" vs "${visible}"`).toContain(norm(visible));
  }

  it("holds for every static button and link", async () => {
    await load();
    document.querySelectorAll("button, a").forEach(expectLabelContainsVisibleText);
  });

  it("holds for every dynamically rendered button", async () => {
    await load();
    jokes.fetchJoke.mockResolvedValue(null);
    button("yes-button").click();
    await runToEnd();
    expectLabelContainsVisibleText(button("retry-button"));

    jokes.fetchJoke.mockResolvedValue(TWO_PART);
    button("retry-button").click();
    await runToEnd();
    expectLabelContainsVisibleText(button("joke-button"));
    button("joke-button").click();
    await runToEnd();
    expectLabelContainsVisibleText(button("joke-again-button"));
  });
});
