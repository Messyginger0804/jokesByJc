# Dev tooling, tests and CI

Node 22.12+ is needed only for dev tooling; nothing in `node_modules/` ships. Commands are listed in `README.md` ("Development"); do not install or run them unless the task needs it.

## Scripts (`package.json`)
- `npm run lint`: ESLint (`eslint.config.js`).
- `npm test`: Vitest with jsdom (`vitest.config.js`), tests in `tests/unit/`, an in-memory `chrome.*` mock in `tests/unit/chrome-mock.js`, setup in `tests/unit/setup.js`.
- `npm run coverage`: same tests with a hard 100% gate on lines, functions, statements and branches, for `background.js`, `popup.js`, `motion.js` and `jokes.js` only (not `vendor/`). New code in those files needs tests that keep it at 100%.
- `npm run e2e`: Puppeteer suite in `tests/e2e/` (`harness.mjs`, `popup.e2e.test.mjs`) loading the unpacked extension in headless Chrome with joke APIs mocked. `EXT_DIR=dist/unpacked npm run e2e` runs it against the packaged build.
- `npm run check:package`: runs `build.sh` and verifies zip contents, that manifest and README versions match, and that icon pixel sizes match their manifest keys (`scripts/check-package.mjs`).
- `npm run check:apis`: manual only; calls each live joke source once (`scripts/check-apis.mjs`). Not run in CI.

## CI (`.github/workflows/ci.yml`)
Runs lint, unit tests with coverage, the package check and the E2E suite (source and packaged build) on pull requests and pushes to `main`. It uploads the zip and coverage report as artifacts. Actions are pinned by commit SHA.

## Dependency note
`package.json` overrides `minimatch` because eslint 10 asks for a range with a known advisory (dev-only). Do not run `npm audit fix --force`; it downgrades eslint. See the README for when to drop the override.
