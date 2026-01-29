/**
 * Test script for joke APIs
 * Run with: node test-apis.js
 */

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
      return { setup: joke, punchline: "😄" };
    }
  }
];

async function testApi(api) {
  console.log(`\n Testing: ${api.name}`);
  console.log(`URL: ${api.url}`);

  try {
    const response = await fetch(api.url, { headers: api.headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const joke = api.parseJoke(data);

    // Validate joke structure
    if (!joke.setup || !joke.punchline) {
      throw new Error("Missing setup or punchline");
    }

    console.log(`Status: PASS`);
    console.log(`Setup: ${joke.setup}`);
    console.log(`Punchline: ${joke.punchline}`);
    return { api: api.name, success: true };

  } catch (error) {
    console.log(`Status: FAIL`);
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
    const result = await testApi(api);
    results.push(result);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(r => {
    const status = r.success ? "PASS" : "FAIL";
    console.log(`${status} - ${r.api}`);
  });

  console.log(`\nTotal: ${passed}/${results.length} passed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
