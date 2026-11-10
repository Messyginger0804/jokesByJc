// Manual smoke test against the live joke sources (not run in CI: it depends on third-party uptime).
// Usage: npm run check:apis   (Node 22.12+, the same as package.json engines)
// Uses the same source list and parsers as the popup (jokes.js), so they cannot drift.
import { byjcApi, fallbackApis, fetchJokeFrom } from "../jokes.js";

let passed = 0;
const apis = [byjcApi, ...fallbackApis];

for (const api of apis) {
  try {
    const joke = await fetchJokeFrom(api);
    passed++;
    console.log(`PASS ${api.name}\n  ${joke.setup}\n  ${joke.punchline || "(one-liner)"}`);
  } catch (error) {
    console.log(`FAIL ${api.name}: ${error.message}`);
  }
}

console.log(`\n${passed}/${apis.length} sources returned a usable joke`);
// The popup needs only one working source, but report any failure.
if (passed < apis.length) process.exitCode = 1;
