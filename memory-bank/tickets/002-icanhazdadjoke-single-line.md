# Ticket 002: icanhazdadjoke Single-Line Handling

**Category:** Bug / Issue
**Status:** Open
**Priority:** Medium

## Description

Single-line jokes from the icanhazdadjoke API don't always split well into setup/punchline format. Currently falls back to showing the whole joke with a 😄 emoji as the punchline.

## Current Behavior

The parser attempts to split jokes at patterns like `? `, `! `, or ` - `. When no pattern is found, it displays the entire joke as the setup and shows 😄 as the punchline.

## Possible Solutions

1. **Skip punchline step** - For one-liners, show the joke and go straight to the "New Joke" button
2. **Different display flow** - Detect single-line jokes and use an alternate UI flow
3. **Better splitting logic** - Improve the pattern matching to handle more joke formats
4. **Filter API results** - Only use jokes that have natural split points

## Files Affected

- `popup.js` (jokeApis array, icanhazdadjoke parseJoke function)

## Acceptance Criteria

- [ ] Single-line jokes display in a user-friendly way
- [ ] No awkward 😄-only punchlines
- [ ] Maintains good UX flow for all joke types
