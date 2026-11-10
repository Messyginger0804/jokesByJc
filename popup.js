import { playState, buttonIn } from "./motion.js";
import { fetchJoke, normalizeJoke } from "./jokes.js";

const MIN_THINKING_MS = 2000;
const TYPE_SPEED_MS = 50;

let currentJoke = null;
// Incremented on every new joke request; async work from an older request is ignored.
let requestId = 0;
// Handle of the active typewriter timer, so a new animation cancels the old one.
let typingTimer = null;

export function storageGet(key) {
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

export function storageSet(items) {
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
export function cacheJoke(joke, punchlineShown = false) {
  storageSet({
    lastJoke: {
      setup: joke.setup,
      punchline: joke.punchline,
      isOneLiner: joke.isOneLiner,
      punchlineShown,
      timestamp: Date.now()
    }
  });
}

/**
 * Restores the cached joke on popup open, unless the user has already asked for a new one.
 */
export async function loadCachedJoke() {
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
 * @param {function} [callback] - Called once typing finishes. Not called if the animation is
 *   cancelled, which is how a newer request supersedes an older one's follow-up step.
 */
export function typeWriterEffect(text, callback) {
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
  button.setAttribute("aria-label", ariaLabel);
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
    ariaLabel: "Try again to fetch a joke",
    className: "button-blue",
    onClick: initializeJoke
  });
}

export function initializePopup() {
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

export async function initializeJoke() {
  const myRequest = ++requestId;
  setActionButtonsDisabled(true);
  playState(currentJoke ? "again" : "thinking");
  typeWriterEffect("Thinking of a good one...");

  const previousSetup = currentJoke && currentJoke.setup;
  const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_THINKING_MS));
  let joke = await fetchJoke(previousSetup);
  await minDelay;
  if (myRequest !== requestId) return;

  if (joke) {
    cacheJoke(joke);
  } else {
    // Every source failed: fall back to the last cached joke, unless it is the one on screen.
    const { lastJoke } = await storageGet("lastJoke");
    if (myRequest !== requestId) return;
    joke = normalizeJoke(lastJoke);
    if (joke && joke.setup === previousSetup) joke = null;
  }

  if (!joke) {
    currentJoke = null;
    playState("error");
    typeWriterEffect("Oops! Could not fetch a joke.", showRetryButton);
    return;
  }

  currentJoke = joke;
  playState("setup");
  typeWriterEffect(joke.setup, () => {
    if (joke.isOneLiner) {
      playState("punch");
      showAnotherJokeButton();
    } else {
      playState("cue");
      showPunchlineButton();
    }
  });
}

export function revealPunchline() {
  const joke = currentJoke;
  setActionButtonsDisabled(true);

  if (!joke || !joke.punchline) {
    playState("error");
    typeWriterEffect("Oops, the punchline got lost! Try another one.", showAnotherJokeButton);
    return;
  }

  cacheJoke(joke, true);
  playState("setup");
  typeWriterEffect(joke.punchline, () => {
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
