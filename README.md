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
- **Remembers your last joke** - Reopening the popup shows the last joke right away
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
- If every source fails, the last cached joke is shown; otherwise a "Try again" button appears
- The last joke is stored in `chrome.storage.local`
- `background.js` runs an hourly `chrome.alarms` check (plus one shortly after the browser starts)
  and opens `popup.html` in its own window if today's joke hasn't been shown yet

## Permissions

- `alarms` - schedule the daily joke check
- `storage` - remember the last joke and the date of the last daily popup
- `https://www.byjc.dev/*` - fetch jokes from the byjc API

The fallback APIs send `Access-Control-Allow-Origin: *`, so they don't need host permissions.

## Testing the joke sources

```sh
node test-apis.js
```

Calls every joke source once and reports which ones respond with a usable joke (Node 18+).

## Packaging

```sh
./build.sh
```

Creates `jokesByJc-extension.zip` with only the files the extension needs, ready to upload to the Chrome Web Store.

## Code layout

- `popup.js` - joke fetching, caching and the button flow; calls named animation states
- `motion.js` - all popup animation (`playState("intro" | "thinking" | "again" | "setup" | "cue" | "punch" | "error")`)
- `vendor/motion-mini.js` - [Motion](https://motion.dev) `animate` (mini), `spring`, `stagger`
- `vendor/confetti.js` - [canvas-confetti](https://github.com/catdad/canvas-confetti), loaded only when the punchline lands

## Tech Stack

- Manifest V3 Chrome Extension
- Vanilla JavaScript (ES modules)
- CSS3
- Motion (mini) and canvas-confetti, vendored

## Version

4.2

- 4.2: animated popup (Motion mini + canvas-confetti, honours reduced motion), reliability fixes, and a new transparent SVG DFWSC logo (replaces the 240 KB JPG).
