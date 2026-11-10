# Chrome Web Store submission: Jokes By JC v4.4

Everything needed to publish the extension listing. Upload is done by hand in the Chrome Web
Store Developer Dashboard; nothing here is automated.

## Package

- Release: https://github.com/Messyginger0804/jokesByJc/releases/tag/v4.4
- Zip: https://github.com/Messyginger0804/jokesByJc/releases/download/v4.4/jokesByJc-v4.4.zip
- Checksum: https://github.com/Messyginger0804/jokesByJc/releases/download/v4.4/jokesByJc-v4.4.zip.sha256
  (the zip is built by the release workflow, so its sha256 is only known after the tag runs;
  verify with `sha256sum -c jokesByJc-v4.4.zip.sha256` after downloading both files)
- Upload the release zip as-is. Don't rebuild it locally or zip the repo folder.
- Manifest: version 4.4, manifest_version 3, permissions `alarms`, `storage`, host permission
  `https://www.byjc.dev/*`. No content scripts, no remote code, `web_accessible_resources` empty.
- Each later upload needs a higher `version` than the one published (bump it in a PR, then tag).

## Listing fields

- **Name** (from the manifest): Jokes By JC
- **Summary / short description** (manifest `description`, max 132 chars). Current value:
  "A fun extension where a character tells a joke." The summary shown in the store comes from the
  manifest, so changing it means a new version. Suggested for the next version (97 chars):
  "A joke from a friendly animated character, with an optional daily joke. Setup, punchline, confetti. No sign-up."
- **Category:** Fun (alternative: Entertainment, if the dashboard's category list differs)
- **Language:** English
- **Detailed description** (draft, plain text):

```
Jokes By JC brings a quick laugh to your browser. JC, a cartoon character, tells you a joke in two parts: first the setup, then, when you're ready, the punchline.

How it works
- Click the toolbar icon any time and say "Yes" to hear a joke.
- JC types out the setup and points you to the "See the punchline!" button.
- The punchline lands with a laugh and a small burst of confetti. Ask for another whenever you like.
- Optional: tick "Show me a joke once a day (opens a small window)" in the popup and a small joke window opens once a day. It is off by default and you can switch it off again at any time.
- Reopen the popup and your last joke is still there.

Comfortable for everyone
- With "reduce motion" turned on in your operating system, animations become simple fades and the confetti and tilt effects are switched off.
- Jokes come from the developer's joke API at byjc.dev, with public joke APIs as a fallback.

Private by design
- No account, no sign-up, no analytics, no tracking.
- The extension only stores your daily joke setting, the date of the last daily popup and the last joke shown, locally in your browser.

The popup footer links to the developer's site (dfwsc.com) and blog (www.byjc.dev).
```

## Graphic assets (all in this repo)

| Dashboard field | File | Size |
|---|---|---|
| Store icon | `icons/icon128.png` (also inside the zip) | 128x128 PNG |
| Screenshot 1 | `store/screenshots/01-intro.png` | 1280x800 PNG, no alpha |
| Screenshot 2 | `store/screenshots/02-setup.png` | 1280x800 PNG, no alpha |
| Screenshot 3 | `store/screenshots/03-punchline.png` | 1280x800 PNG, no alpha |
| Screenshot 4 | `store/screenshots/04-another.png` | 1280x800 PNG, no alpha |
| Small promo tile | `store/promo/small-promo-440x280.png` | 440x280 PNG, no alpha |
| Marquee promo tile (optional) | `store/promo/marquee-1400x560.png` | 1400x560 PNG, no alpha |

Download them from the `v4.4` tag (for example
`https://raw.githubusercontent.com/Messyginger0804/jokesByJc/v4.4/store/screenshots/01-intro.png`).
Until v4.2 the 48 and 128 icons were 32x32 images; the store would not accept that 128 icon.
v4.3 and later ship real 16, 48 and 128 icons, and `npm run check:package` now fails on a wrong size.

## Privacy practices tab

**Single purpose:**
"Shows a short, animated joke (setup and punchline) told by a cartoon character whenever the
user opens the toolbar popup, and, only if the user turns it on, once a day in a small window."

**Permission justifications:**
- `alarms`: "Used only when the user turns on the optional daily joke (off by default). It schedules
  an hourly background check so the extension can open one joke window per day. When the setting
  is off, no alarm is created, and any existing one is cleared. There is no other background
  activity."
- `storage`: "Stores, locally on the device, the user's daily joke on/off setting, the date of the last
  daily popup and the most recent joke, so the popup shows only once a day (if enabled) and can
  show the last joke again when reopened. Nothing is synced or sent anywhere."
- Host permission `https://www.byjc.dev/*`: "Fetches jokes (plain JSON text) from the developer's
  own joke API at www.byjc.dev. No user data is sent with the request."
- Remote code: **No.** "All JavaScript is included in the package. The two libraries (Motion and
  canvas-confetti) are bundled in the vendor folder; nothing is loaded or evaluated at runtime
  from a server."

**Data usage** (from reading the source: `background.js`, `popup.js`, `jokes.js`):
- The extension keeps three keys in `chrome.storage.local`: `dailyPopupEnabled` (the daily joke
  setting, a boolean, off when absent), `lastPopupDate` (a date string) and
  `lastJoke` (the joke text, a revealed flag and a timestamp). Nothing else, and nothing leaves
  the device.
- Network: GET requests for a joke to `www.byjc.dev`, and if that fails to
  `official-joke-api.appspot.com`, `v2.jokeapi.dev` or `icanhazdadjoke.com`. They carry no user
  data, cookies or identifiers (those servers see the IP address, as with any web request).
- The jokes are data (plain JSON text) fetched from third-party joke APIs and byjc.dev. They are
  only ever displayed as text; no code is downloaded or evaluated.
- No analytics, accounts, cookies, fingerprinting or tracking. Footer links open only on click.
- Answer for every data category (personally identifiable information, health, financial and
  payment, authentication, personal communications, location, web history, user activity,
  website content): **not collected.**
- Tick all three certifications: data is not sold to third parties; not used or transferred for
  purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

**Privacy policy:** Determination: **not required.** The store requires a privacy policy URL
only when an extension collects or handles user data, and this one collects none. Leave the
field empty, or, if JC would rather have one (it helps if a reviewer asks about the third-party
joke APIs), publish this text on byjc.dev (for example `https://www.byjc.dev/jokes-privacy`) and
paste the URL:

```
Jokes By JC (Chrome extension) privacy policy

Jokes By JC does not collect, sell or share any personal data. It saves three things locally in your browser: your daily joke setting (off unless you turn it on), the date of the last daily joke window and the last joke shown. These never leave your device and are removed when you uninstall the extension.

To get a joke, the extension sends an anonymous request to www.byjc.dev and, if that is unavailable, to one of these public joke services: official-joke-api.appspot.com, v2.jokeapi.dev or icanhazdadjoke.com. The requests contain no personal information; like any web request, they reveal your IP address to the server that answers. The extension contains no analytics or tracking.

Questions: contact the developer through www.byjc.dev.
```

## Dashboard procedure

1. Sign in at https://chrome.google.com/webstore/devconsole with **JC's** Google account.
   Credentials are JC's: use the browser vault if an entry exists, otherwise ask JC to sign in.
   Never guess or type a password, and never accept one pasted into chat.
2. If the account is not registered as a Chrome Web Store developer yet, the dashboard asks for
   the one-time US$5 registration fee and the developer agreement. **Stop and get JC's explicit
   OK** before paying anything; JC should complete the payment himself.
3. Complete the account page if prompted (publisher name, contact email; the email must be
   verified before publishing).
4. Click **New item** and upload `jokesByJc-v4.4.zip` (downloaded from the release and checked
   against its `.sha256`).
5. **Store listing** tab: paste the detailed description, choose category and language, upload
   the 128 icon, the four screenshots in order (01 to 04), the small promo tile and, optionally,
   the marquee. Optional fields: homepage URL `https://www.byjc.dev`, support URL (ask JC).
6. **Privacy practices** tab: single purpose, the three permission justifications, remote code
   "No", data usage answers and certifications above, privacy policy URL (empty or the published
   page).
7. **Distribution** tab: visibility Public (or Unlisted for a soft launch, ask JC), all regions
   unless JC says otherwise, free.
8. Save the draft, check that every tab shows no warnings, then **Submit for review** only once JC
   has approved the listing. Review usually takes from a few days to a few weeks; the dashboard
   and the account email show the outcome.
9. Afterwards record the item ID and store URL in this file and in the repo README.

## Open questions for JC

1. Does a Chrome Web Store developer account already exist on your Google account? If not, OK
   to pay the one-time $5 registration (you do the payment)?
2. Publisher display name and the contact email for the listing.
3. Public or Unlisted at launch? Any regions to leave out?
4. Privacy policy page on byjc.dev: skip it (not required) or publish the text above?
5. Support URL / email for the listing (byjc.dev contact page, or an email address)?
6. Keep the manifest summary as is for v4.4, or ship the more descriptive one in a later version?

Decisions recorded:
- The once-a-day joke window is now opt-in and off by default (done in v4.4). Windows that open
  unprompted are what a store reviewer flags; the user turns it on with a checkbox in the popup.
- The avatar art is confirmed OK by JC.
