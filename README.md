# Jokes By JC

A Chrome extension (Manifest V3) where an animated character tells you a joke.

## Features

- **Interactive joke delivery** - Click "Yes" to hear a joke; the setup and punchline are revealed separately
- **Typewriter effect** - Text is typed out (shown instantly if you prefer reduced motion)
- **Animated avatar** - JC springs in, hops when you say yes, points at the punchline button,
  laughs (with a confetti burst) at the punchline and settles into a cool pose; the card tilts
  slightly toward the pointer
- **Reduced motion** - With "reduce motion" turned on in the OS, every animation becomes a short
  fade or an instant change, and confetti and tilt are off (changes apply live)
- **Daily joke** - A joke window opens automatically once per day
- **Remembers your last joke** - Reopening the popup shows the last joke right away: the setup with
  the punchline button if you had not revealed it yet, otherwise the setup and punchline together
- **Links** - Footer links to [dfwsc.com](https://dfwsc.com) and [www.byjc.dev](https://www.byjc.dev)

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select this folder
5. The extension icon will appear in your toolbar

No build step is needed. The two libraries in `vendor/` are committed pre-built;
see `vendor/README.md` for versions and the command used to rebuild them.

## How It Works

- Jokes come from the byjc API: `https://www.byjc.dev/api/jokes/random`
- If that fails or takes longer than 5 seconds, the popup tries these fallbacks in random order:
  [Official Joke API](https://official-joke-api.appspot.com/random_joke),
  [JokeAPI](https://v2.jokeapi.dev) and [icanhazdadjoke](https://icanhazdadjoke.com)
- The whole search stops after 8 seconds, so "Thinking..." never waits out every timeout in turn
- If every source fails, the last cached joke is shown (unless it is the one already on screen); otherwise a "Try again" button appears
- The last joke is stored in `chrome.storage.local`
- `background.js` runs an hourly `chrome.alarms` check (plus one shortly after the browser starts)
  and opens `popup.html` in its own window if today's joke hasn't been shown yet

## Permissions

- `alarms` - schedule the daily joke check
- `storage` - remember the last joke and the date of the last daily popup
- `https://www.byjc.dev/*` - fetch jokes from the byjc API

The fallback APIs send `Access-Control-Allow-Origin: *`, so they don't need host permissions.

## Development

The extension itself has no build step. Node 22.12+ is only needed for the dev tooling
(lint, tests, packaging); nothing in `node_modules/` ships.

```sh
npm install            # dev dependencies, including Chrome for Testing for the E2E suite
npm run lint           # ESLint
npm test               # unit tests (Vitest + jsdom)
npm run coverage       # unit tests with the 100% coverage gate; HTML report in coverage/
npm run e2e            # loads the unpacked extension in headless Chrome, joke APIs mocked
npm run check:package  # runs build.sh and checks the zip contents and version
npm run check:apis     # manual: calls every live joke source once (not run in CI)
```

`EXT_DIR=dist/unpacked npm run e2e` runs the E2E suite against the packaged build that
`check:package` unpacks.

CI (`.github/workflows/ci.yml`) runs lint, unit tests with coverage, the package check and
the E2E suite (source and packaged build) on pull requests and on pushes to `main`.

`package.json` overrides `minimatch` to 11.0.6 because eslint 10 still asks for `^10.2.x`, which
is affected by GHSA-g3hv-75wg-m249 (dev-only; nothing ships). Drop the override once eslint's own
range allows a patched version. Don't use `npm audit fix --force`, which downgrades eslint to 9.

## Packaging and releases

CI uploads `jokesByJc-extension` (the zip) and the coverage report as artifacts on every run.
To build locally, run `./build.sh` (or `npm run check:package`). The zip is not committed; `*.zip` is ignored.

## Releasing

1. Bump `version` in `manifest.json` and under "Version" below (the package check enforces that they match) in a PR, and merge it.
2. Tag the merge commit and push the tag:

   ```sh
   git tag -a vX.Y -m 'vX.Y' && git push origin vX.Y
   ```

3. `.github/workflows/release.yml` runs the full CI checks, fails if the tag doesn't match the
   manifest version, then publishes a GitHub release with `jokesByJc-vX.Y.zip` and its `.sha256`.
4. Download that zip and upload it to the Chrome Web Store developer dashboard (this step is manual).

## Code layout

- `background.js` - service worker (ES module): hourly `chrome.alarms` check that opens the daily popup window
- `popup.js` - caching, the typewriter and the button flow; calls named animation states
- `jokes.js` - joke sources, response parsing, validation and the fetch chain (shared with `scripts/check-apis.mjs`)
- `motion.js` - all popup animation (`playState("intro" | "thinking" | "again" | "setup" | "cue" | "punch" | "error")`)
- `vendor/motion-mini.js` - [Motion](https://motion.dev) `animate` (mini), `spring`, `stagger`
- `vendor/confetti.js` - [canvas-confetti](https://github.com/catdad/canvas-confetti), loaded only when the punchline lands
- `tests/unit/` - Vitest unit tests with an in-memory `chrome.*` mock; `tests/e2e/` - Puppeteer tests

## Tech Stack

- Manifest V3 Chrome Extension
- Vanilla JavaScript (ES modules)
- CSS3
- Motion (mini) and canvas-confetti, vendored

## Version

4.2

- 4.2: animated popup (Motion mini + canvas-confetti, honours reduced motion), reliability fixes, and a new transparent SVG DFWSC logo (replaces the 240 KB JPG).
