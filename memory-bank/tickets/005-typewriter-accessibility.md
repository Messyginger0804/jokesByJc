# Ticket 005: Typewriter Effect Accessibility

**Category:** Accessibility
**Status:** Open
**Priority:** Medium

## Description

The typewriter effect may cause issues for screen readers, as text is added character by character which could trigger repeated announcements.

## Current Behavior

Text is typed out one character at a time using `element.textContent += text.charAt(i)`. Screen readers may announce each character or word as it appears.

## Possible Solutions

1. **aria-live="polite"** - Only announce when typing is complete
2. **Hidden text** - Keep full text in aria-label, animate visible text separately
3. **Reduced motion** - Respect `prefers-reduced-motion` and show text instantly
4. **Screen reader detection** - Disable animation for assistive technology users

## Files Affected

- `popup.js` (typeWriterEffect function)
- `popup.html` (aria attributes)

## Acceptance Criteria

- [ ] Screen readers announce complete joke text, not character-by-character
- [ ] Animation respects user motion preferences
- [ ] Sighted users still see typewriter effect (unless they prefer reduced motion)
