# Ticket 001: Image Error Handling

**Category:** Bug / Issue
**Status:** Open
**Priority:** Medium

## Description

If avatar images fail to load, there's no fallback. This could leave broken image icons visible to users.

## Current Behavior

Avatar images are loaded directly without error handling. If the image path is wrong or the file is missing, the browser shows a broken image icon.

## Expected Behavior

- Add `onerror` handlers to avatar images
- Provide a fallback image or hide the avatar gracefully
- Log errors for debugging

## Files Affected

- `popup.js`
- `popup.html`

## Acceptance Criteria

- [ ] Avatar images have error handling
- [ ] Fallback displays when image fails to load
- [ ] No broken image icons visible to users
