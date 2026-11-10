#!/usr/bin/env sh
# Packages the extension for the Chrome Web Store.
# Allowlist of runtime files only: no .git, node_modules, tests, scripts, docs or editor settings.
# npm run check:package verifies the result.
set -eu
cd "$(dirname "$0")"

OUT="jokesByJc-extension.zip"
rm -f "$OUT"
zip -r -X "$OUT" \
  manifest.json \
  background.js \
  popup.html \
  popup.js \
  jokes.js \
  motion.js \
  vendor/motion-mini.js \
  vendor/confetti.js \
  vendor/licenses \
  styles.css \
  ad.css \
  icons \
  images \
  -x '*.DS_Store'
unzip -l "$OUT"
