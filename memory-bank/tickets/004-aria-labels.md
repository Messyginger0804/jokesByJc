# Ticket 004: Add ARIA Labels

**Category:** Accessibility
**Status:** Open
**Priority:** Medium

## Description

Buttons and interactive elements lack accessibility attributes, making the extension difficult to use with screen readers.

## Current Behavior

Buttons have visible text but no ARIA labels or roles for assistive technology.

## Expected Behavior

All interactive elements should have appropriate ARIA attributes:
- `aria-label` for buttons with unclear purpose
- `role` attributes where needed
- `aria-live` regions for dynamic content updates

## Elements to Update

- Close button
- Yes/No buttons
- Punchline button
- "Hear joke again" button
- Joke text container (should announce updates)
- Avatar image (alt text)

## Files Affected

- `popup.html`
- `popup.js` (for dynamically created buttons)

## Acceptance Criteria

- [ ] All buttons have descriptive aria-labels
- [ ] Joke container uses aria-live for updates
- [ ] Extension is navigable with screen reader
- [ ] Passes basic accessibility audit
