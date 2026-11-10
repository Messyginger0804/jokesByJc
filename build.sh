#!/usr/bin/env sh
# Packages the extension for the Chrome Web Store.
# Only runtime files are included (no .git, notes, editor settings or test scripts).
set -eu
cd "$(dirname "$0")"

OUT="jokesByJc-extension.zip"
rm -f "$OUT"
zip -r -X "$OUT" \
  manifest.json \
  background.js \
  popup.html \
  popup.js \
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
