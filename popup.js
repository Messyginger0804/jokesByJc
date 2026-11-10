import { playState, buttonIn } from "./motion.js";

const BYJC_API = "https://www.byjc.dev/api/jokes/random";
const FETCH_TIMEOUT_MS = 5000;
const MIN_THINKING_MS = 2000;
const TYPE_SPEED_MS = 50;

let currentJoke = null;
// Incremented on every new joke request; async work from an older request is ignored.
let requestId = 0;
// Handle of the active typewriter timer, so a new animation cancels the old one.
let typingTimer = null;

// Fallback joke APIs, tried in random order if the byjc API fails.
const fallbackApis = [
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

const byjcApi = {
  name: "byjc API",
  url: BYJC_API,
  headers: {},
  parseJoke: (data) => ({ setup: data.setup, punchline: data.punchline, isOneLiner: data.isOneLiner })
};

/**
 * Splits a single-line joke into setup/punchline at a natural break, or marks it as a one-liner.
 */
function splitOneLiner(joke) {
  if (typeof joke !== "string") return null;
  const splitPatterns = [" - ", "? ", "! "];
  for (const pattern of splitPatterns) {
    const index = joke.indexOf(pattern);
    if (index > 0 && index < joke.length - 5) {
      return {
        setup: joke.substring(0, index + pattern.trim().length),
        punchline: joke.substring(index + pattern.length)
      };
    }
  }
  return { setup: joke, punchline: null, isOneLiner: true };
}

/**
 * Validates and normalizes a parsed joke. Returns null if it is unusable.
 */
function normalizeJoke(joke) {
  if (!joke || typeof joke.setup !== "string" || !joke.setup.trim()) return null;
  const punchline = typeof joke.punchline === "string" && joke.punchline.trim() ? joke.punchline.trim() : null;
  return {
    setup: joke.setup.trim(),
    punchline,
    isOneLiner: !punchline
  };
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchJokeFrom(api) {
  const response = await fetch(api.url, {
    headers: api.headers,
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`${api.name} returned HTTP ${response.status}`);
  const joke = normalizeJoke(api.parseJoke(await response.json()));
  if (!joke) throw new Error(`${api.name} returned an invalid joke`);
  return joke;
}

/**
 * Tries the byjc API first, then every fallback API in random order.
 * Resolves with a joke, or null if every source failed.
 */
async function fetchJoke(previousSetup) {
  for (const api of [byjcApi, ...shuffle(fallbackApis)]) {
    try {
      const joke = await fetchJokeFrom(api);
      // "Get another joke" should not repeat the joke that is already on screen.
      if (previousSetup && joke.setup === previousSetup) {
        console.warn(`Joke source repeated the current joke (${api.name})`);
        continue;
      }
      console.log(`Joke fetched from ${api.name}`);
      return joke;
    } catch (error) {
      console.warn(`Joke source failed (${api.name}):`, error.message);
    }
  }
  return null;
}

function storageGet(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          console.error("Storage read failed:", chrome.runtime.lastError.message);
          resolve({});
        } else {
          resolve(result || {});
        }
      });
    } catch (error) {
      console.error("Storage read failed:", error);
      resolve({});
    }
  });
}

function storageSet(items) {
  try {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        console.error("Storage write failed:", chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.error("Storage write failed:", error);
  }
}

/**
 * Saves the joke so it can be shown instantly when the popup is reopened.
 */
function cacheJoke(joke, punchlineShown = false) {
  if (!joke || !joke.setup) return;
  storageSet({
    lastJoke: {
      setup: joke.setup,
      punchline: joke.punchline || null,
      isOneLiner: !!joke.isOneLiner,
      punchlineShown,
      timestamp: Date.now()
    }
  });
}

/**
 * Restores the cached joke on popup open, unless the user has already asked for a new one.
 */
async function loadCachedJoke() {
  const startedAt = requestId;
  const { lastJoke } = await storageGet("lastJoke");
  if (startedAt !== requestId) return;
  const joke = normalizeJoke(lastJoke);
  if (!joke) return;

  currentJoke = joke;
  setJokeText(joke.setup);
  // Undefined punchlineShown (older cache format) is treated as already shown.
  if (!joke.isOneLiner && lastJoke.punchlineShown === false) {
    playState("restore", { pose: "pointing" });
    showPunchlineButton({ focus: false });
  } else {
    playState("restore", { pose: "coolguy" });
    showAnotherJokeButton({ focus: false });
  }
}

function cancelTyping() {
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }
}

function setJokeText(text) {
  cancelTyping();
  const element = document.getElementById("joke");
  const container = document.getElementById("joke-container");
  if (element) element.textContent = text;
  if (container) container.setAttribute("aria-busy", "false");
}

// Cache media query result to avoid creating new MediaQueryList on each call
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Types text into the joke element. Starting a new animation cancels any running one.
 * Respects prefers-reduced-motion and sets aria-busy so screen readers announce only the final text.
 * @param {string} text - The text to type out.
 * @param {function} [callback] - Called once typing finishes (not called if cancelled).
 */
function typeWriterEffect(text, callback) {
  cancelTyping();
  const element = document.getElementById("joke");
  const container = document.getElementById("joke-container");
  if (!element) return;

  if (reducedMotionQuery.matches) {
    setJokeText(text);
    if (callback) callback();
    return;
  }

  if (container) container.setAttribute("aria-busy", "true");
  element.textContent = "";
  let i = 0;

  function typeNext() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      typingTimer = setTimeout(typeNext, TYPE_SPEED_MS);
    } else {
      typingTimer = null;
      if (container) container.setAttribute("aria-busy", "false");
      if (callback) callback();
    }
  }

  typeNext();
}

/**
 * Replaces the action buttons with a single button. Builds elements directly (no innerHTML).
 */
function renderButton({ id, label, ariaLabel, className, onClick, focus = true }) {
  const buttonContainer = document.querySelector(".button-container");
  if (!buttonContainer) {
    console.error("Error: Button container not found.");
    return;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.id = id;
  button.className = `button ${className}`;
  button.textContent = label;
  if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onClick);
  buttonContainer.replaceChildren(button);
  buttonIn(button);
  // Keep keyboard focus on the action area after the buttons are swapped.
  if (focus) button.focus();
}

function setActionButtonsDisabled(disabled) {
  document.querySelectorAll(".button-container button").forEach((button) => {
    if (button.id !== "no-button") button.disabled = disabled;
  });
}

function showPunchlineButton({ focus = true } = {}) {
  renderButton({
    id: "joke-button",
    label: "See the punchline!",
    ariaLabel: "See the punchline of the joke",
    className: "button-green",
    onClick: revealPunchline,
    focus
  });
}

function showAnotherJokeButton({ focus = true } = {}) {
  renderButton({
    id: "joke-again-button",
    label: "Get another joke!",
    ariaLabel: "Get another joke",
    className: "button-blue",
    onClick: initializeJoke,
    focus
  });
}

function showRetryButton() {
  renderButton({
    id: "retry-button",
    label: "Try again",
    ariaLabel: "Try fetching a joke again",
    className: "button-blue",
    onClick: initializeJoke
  });
}

function initializePopup() {
  // Avatar image error handling lives in motion.js with the avatar poses.
  playState("intro");

  // Ad logo fallback (inline onerror handlers are blocked by the extension CSP).
  const adLogo = document.querySelector(".ad-logo");
  if (adLogo) {
    const showAdFallback = () => {
      const lockup = adLogo.closest(".ad-lockup");
      if (lockup) lockup.hidden = true;
      const fallback = document.querySelector(".ad-logo-tile .ad-fallback");
      if (fallback) fallback.hidden = false;
    };
    adLogo.addEventListener("error", showAdFallback);
    // The error may already have fired before this script ran.
    if (adLogo.complete && adLogo.naturalWidth === 0) showAdFallback();
  }

  document.getElementById("yes-button").addEventListener("click", initializeJoke);
  document.getElementById("no-button").addEventListener("click", closePopup);
  document.getElementById("close-popup").addEventListener("click", closePopup);

  loadCachedJoke();
}

async function initializeJoke() {
  const myRequest = ++requestId;
  setActionButtonsDisabled(true);
  playState(currentJoke ? "again" : "thinking");
  typeWriterEffect("Thinking of a good one...");

  const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_THINKING_MS));
  let joke = await fetchJoke(currentJoke && currentJoke.setup);
  await minDelay;
  if (myRequest !== requestId) return;

  if (joke) {
    cacheJoke(joke);
  } else {
    // Every source failed: fall back to the last cached joke, if any.
    const { lastJoke } = await storageGet("lastJoke");
    if (myRequest !== requestId) return;
    joke = normalizeJoke(lastJoke);
    if (joke) console.log("Using cached joke as final fallback.");
  }

  if (!joke) {
    currentJoke = null;
    playState("error");
    typeWriterEffect("Oops! Could not fetch a joke.", () => {
      if (myRequest === requestId) showRetryButton();
    });
    return;
  }

  currentJoke = joke;
  playState("setup");
  typeWriterEffect(joke.setup, () => {
    if (myRequest !== requestId) return;
    if (joke.isOneLiner) {
      playState("punch");
      showAnotherJokeButton();
    } else {
      playState("cue");
      showPunchlineButton();
    }
  });
}

function revealPunchline() {
  const joke = currentJoke;
  const myRequest = requestId;
  setActionButtonsDisabled(true);

  if (!joke || !joke.punchline) {
    playState("error");
    typeWriterEffect("Oops, the punchline got lost! Try another one.", () => {
      if (myRequest === requestId) showAnotherJokeButton();
    });
    return;
  }

  cacheJoke(joke, true);
  playState("setup");
  typeWriterEffect(joke.punchline, () => {
    if (myRequest !== requestId) return;
    playState("punch");
    showAnotherJokeButton();
  });
}

function closePopup() {
  window.close();
}

// Module scripts run after parsing; start here, once every binding above is initialized.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePopup);
} else {
  initializePopup();
}
