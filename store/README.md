# Chrome Web Store assets

Listing assets for Jokes By JC and the scripts that produce them. Nothing in `store/` ships
in the extension: `build.sh` packages an allowlist of runtime files, and `npm run check:package`
fails if any other file ends up in the zip. The only shipped output of this folder is the icon
set in `icons/`.

Submission steps, listing text and permission justifications: [SUBMISSION.md](SUBMISSION.md).

## Assets

| File | Size | Use |
|---|---|---|
| `../icons/icon128.png` | 128x128 RGBA | Store icon and chrome://extensions. 96x96 badge with 16 px transparent margin |
| `../icons/icon48.png` | 48x48 RGBA | chrome://extensions, 2x toolbar |
| `../icons/icon16.png` | 16x16 RGBA | Toolbar, favicon |
| `icons-src/icon-preview-sheet.png` | review only | Icons on light (#f1f3f4) and dark (#202124) toolbars: 16, 32 (48 scaled), 48, 96 (128 scaled), 128, and the 16 magnified 8x |
| `screenshots/01-intro.png` | 1280x800 RGB | "A joke a day, delivered by JC": intro state, Yes / No |
| `screenshots/02-setup.png` | 1280x800 RGB | "First, the setup...": setup typed out, JC pointing, punchline button |
| `screenshots/03-punchline.png` | 1280x800 RGB | "...then the punchline!": laughing pose with the confetti burst |
| `screenshots/04-another.png` | 1280x800 RGB | "One more? Sure.": end pose (sunglasses), Get another joke |
| `promo/small-promo-440x280.png` | 440x280 RGB | Small promo tile (required) |
| `promo/marquee-1400x560.png` | 1400x560 RGB | Marquee promo tile (optional) |

Screenshots and promo images are 24-bit PNGs with no alpha channel, as the store requires.

## Icons

`python3 store/scripts/make_icons.py` (needs Pillow) writes `icons/icon{16,48,128}.png` and
the preview sheet.

- 128 and 48: JC's laughing face from `images/lol.png` on a blue rounded badge (the popup's
  accent blue, `#3b82f6` to `#1d4ed8`) with a small white speech bubble. The shirt runs off the
  bottom of the badge.
- 16: the front-facing smile from `images/intro.png` on a full-bleed blue circle, no bubble.
  The laughing face (eyes shut, head tilted) is unreadable at 16 px.
- The avatar art is 240 px, so every icon is a downscale (Lanczos) straight from the source;
  nothing is upscaled. Badge and bubble shapes are drawn at 8x and downsampled.

## Screenshots and promo images

`node store/scripts/render-store-assets.mjs` (after `npm install`, which provides Puppeteer and
Chrome for Testing) regenerates everything in `screenshots/` and `promo/`:

1. Loads the unpacked extension from the repo root (or `EXT_DIR`) in headless Chrome for
   Testing, the same way the E2E suite does, with the byjc joke API mocked to return one clean
   joke ("What do you call a fake noodle?" / "An impasta!"). Other hosts are blocked.
2. Clicks through intro, Yes, See the punchline, and captures the 480 px popup window at
   device scale factor 2 in each state. It checks the visible pose for each capture (intro,
   pointing, lol, coolguy) and fails on any console or CSP error. `Math.random` is seeded so
   the confetti comes out the same every run.
3. Places each capture on a 1280x800 background in the popup's colours with a headline and
   one line of copy, and renders the promo tile and marquee from `icons/icon128.png` and
   `images/intro.png` (mirrored, as the popup shows it).
4. Re-encodes Chrome's RGBA PNGs as RGB and checks the final dimensions.

The screenshots show the popup as it really renders; nothing in it is edited. Re-run both
scripts after changing the icons, the avatar art or the popup's look.
