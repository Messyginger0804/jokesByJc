# Ticket 003: Add "New Joke" Button

**Category:** UX Improvement
**Status:** Open
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

- [ ] Users can request a new joke after seeing the punchline
- [ ] New joke fetches from random API (existing logic)
- [ ] UI flow remains smooth and intuitive
