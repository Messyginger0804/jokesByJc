# Ticket 008: Add Joke Caching

**Category:** Performance
**Status:** Open
**Priority:** Low

## Description

Could cache the last fetched joke to avoid repeat API calls and improve offline experience.

## Current Behavior

Every time user clicks "Yes" for a joke, a new API call is made. If user closes and reopens popup, another API call is needed.

## Suggested Implementation

1. **Cache last joke** - Store in `chrome.storage.local`
2. **Show cached on open** - Display last joke immediately while fetching new one
3. **Offline support** - Use cached joke when API fails
4. **Cache multiple** - Store last N jokes to reduce API calls

## Benefits

- Faster perceived load time
- Better offline experience
- Reduced API calls
- Can show "last joke" on popup open

## Files Affected

- `popup.js`
- `background.js` (if pre-fetching)

## Acceptance Criteria

- [ ] Last joke cached in chrome.storage
- [ ] Cached joke available offline
- [ ] Cache doesn't grow indefinitely
- [ ] User can still get fresh jokes
