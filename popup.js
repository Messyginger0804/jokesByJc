document.addEventListener("DOMContentLoaded", initializePopup);

let currentJoke = {};

/**
 * Creates a typewriter effect for the given text.
 * @param {string} elementId - The ID of the element where the text will be displayed.
 * @param {string} text - The text to type out.
 * @param {number} speed - Speed of typing in milliseconds.
 * @param {function} [callback] - Optional callback to execute after typing finishes.
 */
function typeWriterEffect(elementId, text, speed, callback) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = "";
  let i = 0;

  function typeWriter() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(typeWriter, speed);
    } else if (callback) {
      callback();
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
    avatar.src = "./images/thinking.png"; // Replace with the path to your "thinking" image
    avatar.className = "avatar";
  }

  // Set "thinking" text
  if (jokeElement) {
    typeWriterEffect("joke", "Thinking of a good one...", 50);
  }

  // Wait for 2 seconds before fetching the joke
  setTimeout(() => {
    fetch("https://official-joke-api.appspot.com/random_joke")
      .then((response) => response.json())
      .then((data) => {
        currentJoke = {
          setup: data.setup,
          punchline: data.punchline,
        };

        // Change the avatar to the intro image once the data is retrieved
        if (avatar) {
          avatar.src = "./images/intro.png";
        }

        // Use typewriter effect for setup text
        typeWriterEffect("joke", currentJoke.setup, 50, showPunchlineButton);
      })
      .catch((error) => {
        console.error("Error fetching joke:", error);

        // Set the text to an error message if fetching fails
        typeWriterEffect("joke", "Oops! Could not fetch a joke.", 50);

        // Change the avatar to the intro image even on error
        if (avatar) {
          avatar.src = "./images/intro.png";
        }
      });
  }, 2000);
}

function showPunchlineButton() {
  const buttonContainer = document.querySelector(".button-container");

  if (!buttonContainer) {
    console.error("Error: Button container not found.");
    return;
  }

  // Replace Yes/No buttons with the "See the punchline" button
  buttonContainer.innerHTML = `
    <button id="joke-button" class="button button-green">See the punchline!</button>
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
      }

      // Change button to "Hear the joke again"
      const buttonContainer = document.querySelector(".button-container");
      if (!buttonContainer) {
        console.error("Error: Button container not found.");
        return;
      }

      buttonContainer.innerHTML = `
        <button id="joke-again-button" class="button button-blue">Hear the joke again!</button>
      `;

      // Add event listener for the "Hear the joke again" button
      const jokeAgainButton = document.getElementById("joke-again-button");
      if (jokeAgainButton) {
        jokeAgainButton.addEventListener("click", hearJokeAgain);
      }
    });
  }
}

function hearJokeAgain() {
  // Re-display the setup using the typewriter effect
  typeWriterEffect("joke", currentJoke.setup, 50, showPunchlineButton);

  // Update the avatar to the intro image
  const avatar = document.querySelector(".avatar");
  if (avatar) {
    avatar.src = "./images/intro.png";
  }
}

function closePopup() {
  window.close();
}

