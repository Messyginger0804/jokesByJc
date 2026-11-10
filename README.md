# Jokes By JC

A fun Chrome extension that delivers jokes with an animated character avatar.

## Features

- **Interactive joke delivery** - Click "Yes" to hear a joke, with setup and punchline revealed separately
- **Typewriter effect** - Text is displayed with a typing animation
- **Animated avatar** - Character changes expressions (thinking, laughing) based on the joke state
- **Daily reminders** - Automatically pops up once per day to brighten your day
- **Blog of the month** - Displays featured content from [byjc.dev](https://byjc.dev)

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select this folder
5. The extension icon will appear in your toolbar

## How It Works

- Jokes are loaded from a local `jokes.json` file
- Falls back to the [Official Joke API](https://official-joke-api.appspot.com) if local jokes aren't available
- Uses Chrome's `alarms` and `storage` APIs for the daily popup feature

## Development

The extension itself has no build step. Node 22.12+ is only needed for the dev tooling
(lint and tests); nothing in `node_modules/` ships.

```sh
npm install         # dev dependencies, including Chrome for Testing for the E2E suite
npm run lint        # ESLint
npm test            # unit tests (Vitest + jsdom, in-memory chrome.* mock)
npm run coverage    # unit tests with coverage thresholds; HTML report in coverage/
npm run e2e         # loads the unpacked extension in headless Chrome, joke APIs mocked
npm run check:apis  # manual: calls the live fallback joke APIs once (not run in CI)
```

- `tests/unit/` drives `popup.js` and `background.js` as-is through the DOM and `chrome.*`
  events. Known bugs are recorded as `it.fails` / `it.todo` tests rather than asserted as
  correct, so each one turns into a failing "expected fail" once it is fixed.
- `tests/e2e/` launches a fresh browser profile per test and seeds `chrome.storage` explicitly,
  so tests can run alone or in any order.
- CI (`.github/workflows/ci.yml`) runs lint, unit tests with coverage thresholds, and the E2E
  suite on pull requests and on pushes to `main`.

## Tech Stack

- Manifest V3 Chrome Extension
- Vanilla JavaScript
- CSS3

## Version

2.3
