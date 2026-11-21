# Error log

Entries go newest first. Format: signature, cause, fix, date.

## Web Store rejects icons (48 and 128 px icons were really 32x32 images)
- Cause: the shipped 48 and 128 icon files were 32x32 pixels, which the Chrome Web Store rejects.
- Fix: regenerated 16/48/128 icons at real sizes and made `npm run check:package` fail when an icon's pixel size does not match its manifest key (v4.3).
- Date: 2026-11-10
