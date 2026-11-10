import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  byjcApi,
  fallbackApis,
  splitOneLiner,
  normalizeJoke,
  shuffle,
  fetchJokeFrom,
  fetchJoke,
  FETCH_TIMEOUT_MS,
  TOTAL_TIMEOUT_MS
} from "../../jokes.js";

const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const api = (name) => [byjcApi, ...fallbackApis].find((a) => a.name === name);

// Answers each joke source by host; a value of Error rejects, a function is called with (url, init).
function routeFetch(routes) {
  return vi.fn(async (url, init) => {
    const host = new URL(url).host;
    const route = routes[host];
    if (route === undefined) throw new TypeError(`unexpected fetch ${url}`);
    if (route instanceof Error) throw route;
    if (typeof route === "function") return route(url, init);
    return route;
  });
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("response parsing per API shape", () => {
  it("byjc and Official Joke API use setup/punchline", () => {
    expect(byjcApi.parseJoke({ setup: "S", punchline: "P" })).toEqual({ setup: "S", punchline: "P" });
    expect(api("Official Joke API").parseJoke({ setup: "S", punchline: "P", id: 1 })).toEqual({ setup: "S", punchline: "P" });
  });

  it("JokeAPI uses setup/delivery", () => {
    expect(api("JokeAPI").parseJoke({ setup: "S", delivery: "D" })).toEqual({ setup: "S", punchline: "D" });
  });

  it("icanhazdadjoke splits a one-liner and asks for JSON", () => {
    const dad = api("icanhazdadjoke");
    expect(dad.headers).toEqual({ Accept: "application/json" });
    expect(dad.parseJoke({ joke: "Why so blue? Because it is cold out." })).toEqual({
      setup: "Why so blue?",
      punchline: "Because it is cold out."
    });
  });
});

describe("splitOneLiner", () => {
  it("returns null for non-strings", () => {
    expect(splitOneLiner(undefined)).toBeNull();
    expect(splitOneLiner(42)).toBeNull();
  });

  it.each([
    ["I tried - but it was too much effort.", "I tried", "but it was too much effort."],
    ["What is red? A tomato blushing.", "What is red?", "A tomato blushing."],
    ["Stop! Hammer time, everyone.", "Stop!", "Hammer time, everyone."]
  ])("splits %j at the first natural break", (joke, setup, punchline) => {
    expect(splitOneLiner(joke)).toEqual({ setup, punchline });
  });

  it("keeps the joke whole when the break is at the start or too close to the end", () => {
    expect(splitOneLiner("? starts with a break")).toEqual({ setup: "? starts with a break", punchline: null });
    expect(splitOneLiner("Really long setup? Ok.")).toEqual({ setup: "Really long setup? Ok.", punchline: null });
    expect(splitOneLiner("No break here at all")).toEqual({ setup: "No break here at all", punchline: null });
  });
});

describe("normalizeJoke (cache and response shape validation)", () => {
  it.each([null, undefined, "string", {}, { setup: 5 }, { setup: "   " }, { punchline: "p" }])(
    "rejects %j",
    (value) => {
      expect(normalizeJoke(value)).toBeNull();
    }
  );

  it("trims text and marks a joke with a punchline as two-part", () => {
    expect(normalizeJoke({ setup: "  S ", punchline: " P  " })).toEqual({ setup: "S", punchline: "P", isOneLiner: false });
  });

  it.each([undefined, null, 7, "   "])("treats punchline %j as a one-liner", (punchline) => {
    expect(normalizeJoke({ setup: "S", punchline })).toEqual({ setup: "S", punchline: null, isOneLiner: true });
  });

  it("ignores extra fields from storage", () => {
    expect(normalizeJoke({ setup: "S", punchline: "P", isOneLiner: true, evil: "<img>" })).toEqual({
      setup: "S",
      punchline: "P",
      isOneLiner: false
    });
  });
});

describe("shuffle", () => {
  it("returns a permutation without mutating the input", () => {
    const list = [1, 2, 3, 4];
    const out = shuffle(list);
    expect(out).not.toBe(list);
    expect([...out].sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4]);
  });

  it("uses the supplied random source (Fisher-Yates)", () => {
    expect(shuffle(["a", "b", "c"], () => 0)).toEqual(["b", "c", "a"]);
    expect(shuffle(["a", "b", "c"], () => 0.999)).toEqual(["a", "b", "c"]);
  });
});

describe("fetchJokeFrom", () => {
  it("requests with the source headers, no-store and a timeout signal", async () => {
    const fetchMock = vi.fn(async () => json({ joke: "Plain one liner here" }));
    vi.stubGlobal("fetch", fetchMock);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const joke = await fetchJokeFrom(api("icanhazdadjoke"));
    expect(joke).toEqual({ setup: "Plain one liner here", punchline: null, isOneLiner: true });
    expect(timeout).toHaveBeenCalledWith(FETCH_TIMEOUT_MS);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://icanhazdadjoke.com/");
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws on an HTTP error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)));
    await expect(fetchJokeFrom(byjcApi)).rejects.toThrow("byjc API returned HTTP 503");
  });

  it("throws on an unusable joke", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ setup: "" })));
    await expect(fetchJokeFrom(byjcApi)).rejects.toThrow("byjc API returned an invalid joke");
  });

  it("aborts a hung request after the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url, { signal }) =>
          new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason));
          })
      )
    );
    await expect(fetchJokeFrom(byjcApi, { timeoutMs: 20 })).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("also aborts when the caller's signal fires first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))))
    );
    const controller = new AbortController();
    const pending = fetchJokeFrom(byjcApi, { timeoutMs: 60_000, signal: controller.signal });
    controller.abort(new DOMException("deadline", "TimeoutError"));
    await expect(pending).rejects.toMatchObject({ name: "TimeoutError", message: "deadline" });
  });
});

describe("fetchJoke chain", () => {
  const ALL_FAIL = {
    "www.byjc.dev": new TypeError("Failed to fetch"),
    "official-joke-api.appspot.com": new TypeError("Failed to fetch"),
    "v2.jokeapi.dev": new TypeError("Failed to fetch"),
    "icanhazdadjoke.com": new TypeError("Failed to fetch")
  };
  const hosts = (fetchMock) => fetchMock.mock.calls.map(([url]) => new URL(url).host);
  // random() => 0.999 keeps the fallback order as declared.
  const inOrder = { random: () => 0.999 };

  it("uses byjc first and stops there when it works", async () => {
    const fetchMock = routeFetch({ "www.byjc.dev": json({ setup: "S", punchline: "P" }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchJoke(null, inOrder)).toEqual({ setup: "S", punchline: "P", isOneLiner: false });
    expect(hosts(fetchMock)).toEqual(["www.byjc.dev"]);
  });

  it("falls back through the other sources in shuffled order", async () => {
    const fetchMock = routeFetch({
      ...ALL_FAIL,
      "icanhazdadjoke.com": json({ joke: "Why not? Because it is late." })
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchJoke(null, inOrder)).toEqual({ setup: "Why not?", punchline: "Because it is late.", isOneLiner: false });
    expect(hosts(fetchMock)).toEqual(["www.byjc.dev", "official-joke-api.appspot.com", "v2.jokeapi.dev", "icanhazdadjoke.com"]);
    expect(console.warn).toHaveBeenCalledWith("Joke source failed (byjc API):", "Failed to fetch");
  });

  it("moves on when a source times out", async () => {
    const fetchMock = routeFetch({
      ...ALL_FAIL,
      "www.byjc.dev": (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
      "official-joke-api.appspot.com": json({ setup: "S2", punchline: "P2" })
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchJoke(null, { ...inOrder, timeoutMs: 20 })).toMatchObject({ setup: "S2" });
  });

  it("gives up at the overall deadline instead of waiting out every source", async () => {
    const hang = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    const fetchMock = routeFetch({
      "www.byjc.dev": hang,
      "official-joke-api.appspot.com": hang,
      "v2.jokeapi.dev": hang,
      "icanhazdadjoke.com": hang
    });
    vi.stubGlobal("fetch", fetchMock);
    const started = performance.now();
    // Per source 60 ms, whole chain 100 ms: byjc times out, the next source is cut off by the
    // deadline, and the last two are never tried.
    expect(await fetchJoke(null, { ...inOrder, timeoutMs: 60, totalTimeoutMs: 100 })).toBeNull();
    const elapsed = performance.now() - started;
    expect(hosts(fetchMock)).toEqual(["www.byjc.dev", "official-joke-api.appspot.com"]);
    expect(elapsed).toBeGreaterThanOrEqual(95);
    expect(elapsed).toBeLessThan(400);
    expect(console.warn).toHaveBeenCalledWith("Joke sources gave up after the overall deadline");
  });

  it("uses an overall deadline shorter than four source timeouts by default", async () => {
    expect(TOTAL_TIMEOUT_MS).toBe(8000);
    expect(TOTAL_TIMEOUT_MS).toBeLessThan(4 * FETCH_TIMEOUT_MS);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", routeFetch({ "www.byjc.dev": json({ setup: "S", punchline: "P" }) }));
    await fetchJoke(null, inOrder);
    expect(timeout).toHaveBeenCalledWith(TOTAL_TIMEOUT_MS);
    expect(timeout).toHaveBeenCalledWith(FETCH_TIMEOUT_MS);
  });

  it("resolves null when every source fails", async () => {
    vi.stubGlobal("fetch", routeFetch(ALL_FAIL));
    expect(await fetchJoke(null, inOrder)).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(4);
  });

  it("skips a source that repeats the joke on screen", async () => {
    const fetchMock = routeFetch({
      ...ALL_FAIL,
      "www.byjc.dev": json({ setup: "Same", punchline: "P" }),
      "official-joke-api.appspot.com": json({ setup: "New", punchline: "P" })
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchJoke("Same", inOrder)).toMatchObject({ setup: "New" });
    expect(console.warn).toHaveBeenCalledWith("Joke source repeated the current joke (byjc API)");
  });

  it("returns null when every working source repeats the current joke", async () => {
    vi.stubGlobal("fetch", routeFetch({ ...ALL_FAIL, "www.byjc.dev": json({ setup: "Same", punchline: "P" }) }));
    expect(await fetchJoke("Same", inOrder)).toBeNull();
  });

  it("defaults to Math.random for the fallback order", async () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("fetch", routeFetch({ "www.byjc.dev": json({ setup: "S", punchline: "P" }) }));
    await fetchJoke();
    expect(random).toHaveBeenCalled();
  });
});
