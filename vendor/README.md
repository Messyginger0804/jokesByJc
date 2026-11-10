# Vendored libraries

These files are committed as-is so the extension still loads unpacked with no build step.
Each one is a single minified ES module produced once with esbuild (whitespace removal,
identifier shortening and bundling only; no obfuscation). Nothing here is fetched at runtime.

| File | Package | Version | Exports | License |
|---|---|---|---|---|
| `motion-mini.js` | [motion](https://www.npmjs.com/package/motion) | 14.12.0 | `animate` (from `motion/mini`, WAAPI-based), `spring`, `stagger` | MIT, `licenses/motion.txt` |
| `confetti.js` | [canvas-confetti](https://www.npmjs.com/package/canvas-confetti) | 1.9.4 | `create` | ISC, `licenses/canvas-confetti.txt` |

Built with esbuild 0.28.2.

`confetti.js` is always used through `create(canvas, { useWorker: false })`. Its worker mode
builds a `blob:` worker, which the extension CSP does not allow, so never enable it.

## Rebuilding

Run this outside the repository (it installs packages into a temporary folder),
then copy the two output files over the ones in `vendor/`:

```sh
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

cp node_modules/motion/LICENSE.md licenses-motion.txt
cp node_modules/canvas-confetti/LICENSE licenses-canvas-confetti.txt
```

When bumping a version, update the banner, this table and the license files, then check that
the output contains no `eval`, `new Function` or `http(s)://` strings:

```sh
grep -nE 'eval\(|new Function|https?://' vendor/*.js
```
