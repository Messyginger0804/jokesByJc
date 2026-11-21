# Extension architecture

Chrome Manifest V3 extension, vanilla ES modules, no build step for the extension itself. `README.md` covers features, permissions and install; this doc adds how the pieces fit.

## Files and entry points
- `manifest.json`: declares the service worker (`background.js`), the popup (`popup.html`), permissions (`alarms`, `storage`, the byjc API host) and the version.
- `popup.html` + `popup.js`: UI and flow (intro, setup typed out, punchline button, "another"). Owns the joke cache and the daily-joke checkbox.
- `jokes.js`: joke sources, response parsing and validation, and the timed fetch chain. Also imported by `scripts/check-apis.mjs`, so keep it free of `chrome.*` use.
- `motion.js`: all animation, driven by named states via `playState(...)`. Honours reduced motion.
- `background.js`: service worker. Only while `dailyPopupEnabled` is true in `chrome.storage.local` does it keep an hourly `chrome.alarms` check and open the popup in its own window once per day. Turning the setting off clears the alarms; an update from an older version also clears them (the daily joke became opt-in in 4.4).
- `vendor/`: pre-built Motion (mini) and canvas-confetti, with licences; see `vendor/README.md`. Do not edit by hand.
- `styles.css`, `ad.css`, `images/`, `icons/`: styling and art. `ad.css` and the DFWSC mark belong to the small footer ad.

## Joke fetch behaviour (`jokes.js`)
Primary source is the byjc API; on failure or after 5 seconds the other public APIs are tried in random order; the whole search stops at 8 seconds. If all fail, the cached joke is shown unless it is already on screen, else a "Try again" button. Adding a source means updating `jokes.js`, its tests and, if it needs a host permission, `manifest.json` (the fallbacks currently need none because they send permissive CORS headers).

## Storage
Everything is in `chrome.storage.local`: last joke (with a flag for whether the punchline was shown), date of the last daily popup, and `dailyPopupEnabled` (missing means off).

## Gotchas
- Any new runtime file must be added to the allowlist in `build.sh`, or it will not ship (and `npm run check:package` will fail on unexpected files).
- Adding a permission or host permission changes the Web Store review and listing justifications; update `store/SUBMISSION.md`.
- `*.zip` and `coverage/` are git-ignored; the zip is never committed.
