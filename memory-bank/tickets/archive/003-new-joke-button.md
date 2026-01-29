# Ticket 003: Add "New Joke" Button

**Category:** UX Improvement
**Status:** Closed
**Priority:** High

## Description

After the punchline is revealed, users can only replay the same joke. There's no option to get a new joke without closing and reopening the extension.

## Current Behavior

After punchline reveal, button changes to "Hear the joke again!" which replays the current joke's setup.

## Expected Behavior

Add a "New Joke" button (or replace current button) that fetches a completely new joke from the APIs.

## Suggested Implementation

After punchline reveal, show two buttons:
- "Hear it again" - Replay current joke
- "New Joke" - Fetch a fresh joke

Or replace with single "New Joke" button.

## Files Affected

- `popup.js` (revealPunchline function)
- Possibly `styles.css` for button styling

## Acceptance Criteria

- [x] Users can request a new joke after seeing the punchline
- [x] New joke fetches from random API (existing logic)
- [x] UI flow remains smooth and intuitive

---

## Implementation Notes (Closure)

**Closed:** 2026-01-28

**Implementation Summary:**
- Single "Get another joke!" button approach was chosen (cleaner UX than two-button option)
- Button appears after punchline reveal in `revealPunchline()` function (`popup.js:229-231`)
- Button also handles one-liner jokes in `showPunchlineButton()` function (`popup.js:188-190`)
- Clicking button calls `initializeJoke()` which fetches from a random API

**Related Commits:**
- `c77ffe9`: feat(T1): update parseJoke to return isOneLiner flag for icanhazdadjoke
- `8e751f7`: feat(T2): handle one-liners in showPunchlineButton
- `81ea54f`: feat(T3): update button text to 'Get another joke!' for consistency

**Verification:** All acceptance criteria verified via code review on 2026-01-28
