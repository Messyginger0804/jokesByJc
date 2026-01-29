# Jokes By JC - Improvements

A list of potential improvements for the extension.

## Bugs / Issues

- [ ] **No image error handling** - If avatar images fail to load, there's no fallback
- [ ] **icanhazdadjoke single-line handling** - Single-line jokes from icanhazdadjoke API don't always split well into setup/punchline. Currently falls back to showing whole joke with 😄 emoji. Consider: skipping punchline step for one-liners, or using a different display flow for this API

## UX Improvements

- [ ] **No "New Joke" button** - After the punchline, users can only replay the same joke, not get a new one

## Accessibility

- [ ] **No ARIA labels** - Buttons lack accessibility attributes
- [ ] **Typewriter effect** - May cause issues for screen readers
- [ ] **Low contrast** - Gray background (`rgba(120, 113, 113)`) on gray container

## Performance

- [ ] **Large images** - Avatar PNGs are 87-173KB each; could be optimized or converted to WebP
- [ ] **No joke caching** - Could cache the last fetched joke to avoid repeat API calls

