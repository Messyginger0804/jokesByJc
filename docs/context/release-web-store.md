# Releasing and Chrome Web Store

The extension is already published on the Chrome Web Store. Updates go to the existing listing; never create a new item. The dashboard cannot be scripted from this repo, so the upload is manual.

## Ship a release
1. In a PR, bump `version` in `manifest.json` and the "Version" section of `README.md` (the package check fails if they differ). Each upload must have a higher version than the one published. Update `store/SUBMISSION.md` if the listing text, permissions or assets changed. Merge to `main`.
2. Tag the merge commit and push the tag: `git tag -a vX.Y -m 'vX.Y' && git push origin vX.Y`.
3. `.github/workflows/release.yml` (triggered by `v*` tags) checks the tag is `vX.Y[.Z]` and equals the manifest version, reruns full CI, runs `build.sh`, and publishes a GitHub release with `jokesByJc-vX.Y.zip` and a `.sha256` file.
4. Download that release zip (verify with `sha256sum -c`) and upload it as-is in the developer dashboard, on the listing's Package tab ("Upload new package"). Do not rebuild locally or zip the repo folder.
5. Submit for review. Review can take days; the listing text and screenshots from `store/SUBMISSION.md` are entered by hand.

## Packaging
`build.sh` zips an explicit allowlist of runtime files into `jokesByJc-extension.zip`. Tests, scripts, `store/` and docs never ship.

## Store assets (`store/`)
Screenshots (1280x800), promo tiles and icon sources live in `store/` with the scripts that render them (`store/scripts/render-store-assets.mjs`, `store/scripts/make_icons.py`); see `store/README.md`. Images must be 24-bit PNG without alpha. Icons in `icons/` must be real 16, 48 and 128 pixel sizes (v4.3 fixed 32 px images the store rejected).

## History
- 4.4: daily joke window made opt-in. 4.3: real-size icons and store assets. 4.2: animated popup and reliability fixes.
