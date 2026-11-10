/**
 * Smoke test for the joke sources used by popup.js.
 * Run with: node test-apis.js
 *
 * Keep the source list and parsers in sync with popup.js.
 */

const FETCH_TIMEOUT_MS = 5000;

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

const jokeApis = [
  {
    name: "byjc API (primary)",
    url: "https://www.byjc.dev/api/jokes/random",
    headers: {},
    parseJoke: (data) => ({ setup: data.setup, punchline: data.punchline, isOneLiner: data.isOneLiner })
  },
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

async function testApi(api) {
  console.log(`\nTesting: ${api.name}`);
  console.log(`URL: ${api.url}`);

  try {
    const response = await fetch(api.url, {
      headers: api.headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const joke = api.parseJoke(data);

    if (!joke || !joke.setup) {
      throw new Error("Missing setup");
    }
    if (!joke.punchline && !joke.isOneLiner) {
      throw new Error("Missing punchline");
    }

    console.log("Status: PASS");
    console.log(`Setup: ${joke.setup}`);
    console.log(`Punchline: ${joke.punchline || "(one-liner)"}`);
    return { api: api.name, success: true };
  } catch (error) {
    console.log("Status: FAIL");
    console.log(`Error: ${error.message}`);
    return { api: api.name, success: false, error: error.message };
  }
}

async function runTests() {
  console.log("=".repeat(50));
  console.log("JOKE API TESTS");
  console.log("=".repeat(50));

  const results = [];
  for (const api of jokeApis) {
    results.push(await testApi(api));
  }

  console.log("\n" + "=".repeat(50));
  console.log("SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.success).length;
  results.forEach((r) => {
    console.log(`${r.success ? "PASS" : "FAIL"} - ${r.api}`);
  });
  console.log(`\nTotal: ${passed}/${results.length} passed`);

  // The popup only needs one working source, but report any failure.
  if (passed < results.length) {
    process.exit(1);
  }
}

runTests();
