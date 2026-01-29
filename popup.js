document.addEventListener("DOMContentLoaded", initializePopup);

let currentJoke = {};

/**
 * Attaches an onerror handler to the avatar element to gracefully handle image load failures.
 * Hides the avatar if the image fails to load to prevent broken image icons.
 * Uses a flag to prevent multiple handler attachments and memory leaks.
 * @param {HTMLImageElement} avatarEl - The avatar image element.
 */
function handleAvatarError(avatarEl) {
  if (!avatarEl) return;

  // Clear any existing handler first to prevent orphaned closures
  avatarEl.onerror = null;

  // Reset visibility in case it was hidden from a previous error
  avatarEl.style.visibility = 'visible';

  avatarEl.onerror = function() {
    console.error('Avatar failed to load:', this.src);
    this.style.visibility = 'hidden';
    this.onerror = null; // prevent infinite loops if fallback also fails
  };
}

// Multiple joke APIs to randomly pick from
const jokeApis = [
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
    headers: { "Accept": "application/json" },
    parseJoke: (data) => {
      // Single-line joke - split at common patterns or show as one-liner
      const joke = data.joke;
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
      // If no split found, treat as one-liner (skip punchline step)
      return { setup: joke, punchline: null, isOneLiner: true };
    }
  }
];

function getRandomApi() {
  return jokeApis[Math.floor(Math.random() * jokeApis.length)];
}

// Cache media query result to avoid creating new MediaQueryList on each call
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Creates a typewriter effect for the given text.
 * Respects prefers-reduced-motion preference for accessibility.
 * Uses aria-busy to prevent screen readers from announcing during animation.
 * @param {string} elementId - The ID of the element where the text will be displayed.
 * @param {string} text - The text to type out.
 * @param {number} speed - Speed of typing in milliseconds.
 * @param {function} [callback] - Optional callback to execute after typing finishes.
 */
function typeWriterEffect(elementId, text, speed, callback) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const container = document.getElementById("joke-container");
  const prefersReducedMotion = reducedMotionQuery.matches;

  // If user prefers reduced motion, show text instantly for accessibility
  if (prefersReducedMotion) {
    element.textContent = text;
    if (container) {
      container.setAttribute("aria-busy", "false");
    }
    if (callback) {
      callback();
    }
    return;
  }

  // Set aria-busy to prevent screen readers from announcing character-by-character
  if (container) {
    container.setAttribute("aria-busy", "true");
  }

  element.textContent = "";
  let i = 0;

  function typeWriter() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(typeWriter, speed);
    } else {
      // Animation complete - allow screen reader to announce
      if (container) {
        container.setAttribute("aria-busy", "false");
      }
      if (callback) {
        callback();
      }
    }
  }

  typeWriter();
}

function initializePopup() {
  document.getElementById("yes-button").addEventListener("click", initializeJoke);
  document.getElementById("no-button").addEventListener("click", closePopup);
  document.getElementById("close-popup").addEventListener("click", closePopup);
}

function initializeJoke() {
  // Set the avatar to the "thinking" image while loading
  const avatar = document.querySelector(".avatar");
  const jokeElement = document.getElementById("joke");

  if (avatar) {
    avatar.src = "./images/thinking.png";
    avatar.className = "avatar";
    handleAvatarError(avatar);
  }

  // Set "thinking" text
  if (jokeElement) {
    typeWriterEffect("joke", "Thinking of a good one...", 50);
  }

  // Wait for 2 seconds before trying to get a joke
  setTimeout(() => {
    // Pick a random API
    const api = getRandomApi();

    fetch(api.url, { headers: api.headers })
      .then(response => {
        if (!response.ok) {
          throw new Error("API not available");
        }
        return response.json();
      })
      .then(data => {
        currentJoke = api.parseJoke(data);
        console.log(`Joke fetched from ${api.name}`);

        if (avatar) {
          avatar.src = "./images/intro.png";
          handleAvatarError(avatar);
        }
        typeWriterEffect("joke", currentJoke.setup, 50, showPunchlineButton);
      })
      .catch(apiError => {
        console.error("API error:", apiError);
        // Fallback to local jokes if API fails
        fetch("./jokes.json")
          .then(response => response.json())
          .then(data => {
            if (data.jokes && Array.isArray(data.jokes) && data.jokes.length > 0) {
              const randomIndex = Math.floor(Math.random() * data.jokes.length);
              currentJoke = data.jokes[randomIndex];

              console.log("Joke fetched from local JSON (fallback).");

              if (avatar) {
                avatar.src = "./images/intro.png";
                handleAvatarError(avatar);
              }
              typeWriterEffect("joke", currentJoke.setup, 50, showPunchlineButton);
            } else {
              throw new Error("No jokes found");
            }
          })
          .catch(localError => {
            console.error("Local joke error:", localError);
            typeWriterEffect("joke", "Oops! Could not fetch a joke.", 50);
            if (avatar) {
              avatar.src = "./images/intro.png";
              handleAvatarError(avatar);
            }
          });
      });
  }, 2000);
}

function showPunchlineButton() {
  const buttonContainer = document.querySelector(".button-container");

  if (!buttonContainer) {
    console.error("Error: Button container not found.");
    return;
  }

  // For one-liners, skip punchline step and go directly to "Get another joke"
  if (currentJoke.isOneLiner) {
    const avatar = document.querySelector(".avatar");
    if (avatar) {
      avatar.src = "./images/lol.png";
      handleAvatarError(avatar);
    }

    buttonContainer.innerHTML = `
      <button id="joke-again-button" class="button button-blue" aria-label="Get another joke">Get another joke!</button>
    `;

    const jokeAgainButton = document.getElementById("joke-again-button");
    if (jokeAgainButton) {
      jokeAgainButton.addEventListener("click", initializeJoke);
    }
    return;
  }

  // Replace Yes/No buttons with the "See the punchline" button
  buttonContainer.innerHTML = `
    <button id="joke-button" class="button button-green" aria-label="See the punchline of the joke">See the punchline!</button>
  `;

  // Add event listener to display the punchline
  const jokeButton = document.getElementById("joke-button");
  if (jokeButton) {
    jokeButton.addEventListener("click", revealPunchline);
  }
}

function revealPunchline() {
  if (currentJoke.punchline) {
    // Use typewriter effect for punchline
    typeWriterEffect("joke", currentJoke.punchline, 50, () => {
      // Update the avatar to the laughing image
      const avatar = document.querySelector(".avatar");
      if (avatar) {
        avatar.src = "./images/lol.png";
        handleAvatarError(avatar);
      }

      // Change button to "Hear the joke again"
      const buttonContainer = document.querySelector(".button-container");
      if (!buttonContainer) {
        console.error("Error: Button container not found.");
        return;
      }

      buttonContainer.innerHTML = `
        <button id="joke-again-button" class="button button-blue" aria-label="Get another joke">Get another joke!</button>
      `;

      // Add event listener for the "Get another joke" button
      const jokeAgainButton = document.getElementById("joke-again-button");
      if (jokeAgainButton) {
        jokeAgainButton.addEventListener("click", initializeJoke);
      }
    });
  }
}

function closePopup() {
  window.close();
}

