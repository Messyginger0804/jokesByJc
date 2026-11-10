# Vendored libraries

These files are committed as-is so the extension still loads unpacked with no build step.
Each one is a single minified ES module produced once with esbuild (whitespace removal,
identifier shortening and bundling only; no obfuscation). Nothing here is fetched at runtime.

| File | Package | Version | Exports | License |
|---|---|---|---|---|
| `motion-mini.js` | [motion](https://www.npmjs.com/package/motion) | 14.12.0 | `animate` (from `motion/mini`, WAAPI-based), `spring`, `stagger` | MIT, `licenses/motion.txt` |
| `confetti.js` | [canvas-confetti](https://www.npmjs.com/package/canvas-confetti) | 1.9.4 | `create` | ISC, `licenses/canvas-confetti.txt` |

SHA-256 of each committed file, so provenance can be checked with `sha256sum -c` (run in `vendor/`)
instead of a rebuild:

```text
5d73f4aed99531baba80e82a3829cf12335ee84c662bd2f3ce58fc1faff91ba3  motion-mini.js
2ff729a2dffc3b5c3ad4963916c731c71d09f5f1383ca1af073b6d4ee302863e  confetti.js
1bf0dc3f7727723e5a032ed12164a47cf92c05204cb1a3485f123c24e2833ed1  licenses/motion.txt
fd44477c30a832a1dee9ef0b6cfb34677fbe5ef58c0cf655d27c646f11bb2f7a  licenses/canvas-confetti.txt
```

Built with esbuild 0.28.2.

`confetti.js` is always used through `create(canvas, { useWorker: false })`. Its worker mode
builds a `blob:` worker, which the extension CSP does not allow, so never enable it.

## Rebuilding

Run this outside the repository (it installs packages into a temporary folder). Set `REPO` to
your checkout first; the last lines copy the outputs and licenses into `vendor/`:

```sh
REPO=/path/to/jokesByJc
mkdir -p /tmp/jokes-vendor/src && cd /tmp/jokes-vendor
npm init -y >/dev/null
npm install --save-exact motion@14.12.0 canvas-confetti@1.9.4 esbuild@0.28.2

printf 'export { animate } from "motion/mini";\nexport { spring, stagger } from "motion";\n' > src/motion-mini.js
printf 'export { create } from "canvas-confetti";\n' > src/confetti.js

npx esbuild src/motion-mini.js --bundle --minify --format=esm \
  --banner:js="/* motion@14.12.0 (animate from motion/mini, spring, stagger). MIT License, see vendor/licenses/motion.txt */" \
  --outfile=out/motion-mini.js
npx esbuild src/confetti.js --bundle --minify --format=esm \
  --banner:js="/* canvas-confetti@1.9.4 (create). ISC License, see vendor/licenses/canvas-confetti.txt */" \
  --outfile=out/confetti.js

cp out/motion-mini.js out/confetti.js "$REPO/vendor/"
cp node_modules/motion/LICENSE.md "$REPO/vendor/licenses/motion.txt"
cp node_modules/canvas-confetti/LICENSE "$REPO/vendor/licenses/canvas-confetti.txt"
```

With the versions above, `git status` in `$REPO` should show no changes afterwards.

When bumping a version, update the banner, this table, the checksums and the license files, then check that
the output contains no `eval`, `new Function` or `http(s)://` strings:

```sh
grep -nE 'eval\(|new Function|https?://' vendor/*.js
```
