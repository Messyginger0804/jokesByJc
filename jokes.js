// Joke sources and parsing. No DOM or chrome.* access, so this module is shared by
// popup.js and scripts/check-apis.mjs (Node).

export const FETCH_TIMEOUT_MS = 5000;

export const byjcApi = {
  name: "byjc API",
  url: "https://www.byjc.dev/api/jokes/random",
  headers: {},
  parseJoke: (data) => ({ setup: data.setup, punchline: data.punchline })
};

// Fallback joke APIs, tried in random order if the byjc API fails.
export const fallbackApis = [
  {
    name: "Official Joke API",
    url: "https://official-joke-api.appspot.com/random_joke",
    headers: {},
    parseJoke: (data) => ({ setup: data.setup, punchline: data.punchline })
  },
  {
    name: "JokeAPI",
    url: "https://v2.jokeapi.dev/joke/Pun,Misc?type=twopart&safe-mode",
    headers: {},
    parseJoke: (data) => ({ setup: data.setup, punchline: data.delivery })
  },
  {
    name: "icanhazdadjoke",
    url: "https://icanhazdadjoke.com/",
    headers: { Accept: "application/json" },
    parseJoke: (data) => splitOneLiner(data.joke)
  }
];

/**
 * Splits a single-line joke into setup/punchline at a natural break.
 * Returns the whole joke as the setup (no punchline) when there is no break.
 */
export function splitOneLiner(joke) {
  if (typeof joke !== "string") return null;
  // "?" and "!" stay on the setup; a " - " separator is dropped.
  for (const [pattern, keep] of [[" - ", ""], ["? ", "?"], ["! ", "!"]]) {
    const index = joke.indexOf(pattern);
    if (index > 0 && index < joke.length - 5) {
      return {
        setup: joke.substring(0, index) + keep,
        punchline: joke.substring(index + pattern.length)
      };
    }
  }
  return { setup: joke, punchline: null };
}

/**
 * Validates and normalizes a parsed or cached joke. Returns null if it is unusable.
 * Anything read from storage or the network goes through here before it is shown.
 */
export function normalizeJoke(joke) {
  if (!joke || typeof joke.setup !== "string" || !joke.setup.trim()) return null;
  const punchline = typeof joke.punchline === "string" && joke.punchline.trim() ? joke.punchline.trim() : null;
  return {
    setup: joke.setup.trim(),
    punchline,
    isOneLiner: !punchline
  };
}

export function shuffle(list, random = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function fetchJokeFrom(api, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const response = await fetch(api.url, {
    headers: api.headers,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`${api.name} returned HTTP ${response.status}`);
  const joke = normalizeJoke(api.parseJoke(await response.json()));
  if (!joke) throw new Error(`${api.name} returned an invalid joke`);
  return joke;
}

/**
 * Tries the byjc API first, then every fallback API in random order.
 * Skips a joke whose setup matches previousSetup so "another joke" never repeats.
 * Resolves with a joke, or null if every source failed.
 */
export async function fetchJoke(previousSetup, { random = Math.random, timeoutMs } = {}) {
  for (const api of [byjcApi, ...shuffle(fallbackApis, random)]) {
    try {
      const joke = await fetchJokeFrom(api, { timeoutMs });
      if (previousSetup && joke.setup === previousSetup) {
        console.warn(`Joke source repeated the current joke (${api.name})`);
        continue;
      }
      return joke;
    } catch (error) {
      console.warn(`Joke source failed (${api.name}):`, error.message);
    }
  }
  return null;
}
