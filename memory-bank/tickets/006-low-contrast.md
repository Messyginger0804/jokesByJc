# Ticket 006: Fix Low Contrast

**Category:** Accessibility
**Status:** Open
**Priority:** Medium

## Description

Gray background (`rgba(120, 113, 113)`) on gray container creates low contrast, which may be difficult to read for users with visual impairments.

## Current Behavior

- Body background: `rgba(120, 113, 113, 0.9)`
- Popup container: `rgba(120, 113, 113, 0.9)`
- Similar gray tones make boundaries unclear

## Expected Behavior

- Meet WCAG 2.1 contrast requirements (4.5:1 for normal text, 3:1 for large text)
- Clear visual distinction between elements
- Maintain aesthetic appeal

## Suggested Changes

- Increase contrast between background and container
- Ensure text has sufficient contrast against backgrounds
- Consider adding subtle borders or shadows for element separation

## Files Affected

- `styles.css`

## Acceptance Criteria

- [ ] All text meets WCAG 2.1 AA contrast requirements
- [ ] UI elements are clearly distinguishable
- [ ] Design remains visually appealing
