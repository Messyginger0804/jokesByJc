---
title: "Two-Part Joke Cache Fix – Plan"
phase: Plan
date: "2026-01-28_23-15-00"
owner: "agent"
parent_research: "memory-bank/execute/2026-01-28_22-45-00_joke-caching.md"
git_commit_at_plan: "1c93ebb"
tags: [plan, bugfix, caching, regression]
---

## Goal

**Fix the functional regression where two-part jokes cached before punchline reveal cannot have their punchline shown after popup reopen.**

The singular focus: Restore the "See the punchline!" button state when loading a cached two-part joke that hasn't had its punchline revealed yet.

Non-goals:
- Refactoring caching architecture
- Changing when/how jokes are cached
- Adding new features

## Scope & Assumptions

### In Scope
- Add `punchlineShown` flag to cached joke data
- Restore correct button state based on `punchlineShown` flag in `loadCachedJoke()`
- Update `punchlineShown` flag when punchline is revealed

### Out of Scope
- Multi-joke caching
- Cache expiration logic
- Refactoring existing caching functions

### Assumptions
- Current cache structure can be extended with one boolean field
- Existing cached jokes without the flag should show "Get another joke" (safe default)
- One-liners don't have punchlines, so flag only matters for two-part jokes

## Deliverables (DoD)

| Artifact | Acceptance Criteria |
|----------|---------------------|
| `popup.js` modifications | Persists and restores punchline reveal state |
| Two-part joke flow | Cached unrevealed jokes show "See the punchline!" button |
| One-liner flow | Unchanged behavior (no punchline to reveal) |
| Backward compatibility | Old cached jokes without flag still work |

## Readiness (DoR)

- [x] Bug identified - `loadCachedJoke()` always shows "Get another joke"
- [x] Root cause understood - No state tracking for punchline reveal
- [x] Fix approach clear - Add `punchlineShown` flag
- [x] Files identified - `popup.js` only

## Milestones

| ID | Milestone | Description |
|----|-----------|-------------|
| M1 | State Tracking | Cache includes `punchlineShown` flag |
| M2 | Button Restoration | `loadCachedJoke()` shows correct button based on flag |
| M3 | Verification | Manual test confirms fix |

## Work Breakdown (Tasks)

### T1: Add punchlineShown flag to cache and set on reveal

- **Summary**: Extend `cacheJoke()` to include `punchlineShown: false` by default. Update cache to `punchlineShown: true` when `revealPunchline()` runs.
- **Owner**: agent
- **Dependencies**: None
- **Target Milestone**: M1
- **Files/Interfaces**: `popup.js` - `cacheJoke()` function (lines 41-56), `revealPunchline()` function (lines 321-349)
- **Acceptance Tests**:
  - After joke fetch, `chrome.storage.local.get('lastJoke')` has `punchlineShown: false`
  - After clicking "See the punchline!", cache has `punchlineShown: true`

### T2: Restore correct button state in loadCachedJoke

- **Summary**: Modify `loadCachedJoke()` to check `punchlineShown` flag. If false and joke has punchline, show "See the punchline!" button instead of "Get another joke!".
- **Owner**: agent
- **Dependencies**: T1
- **Target Milestone**: M2
- **Files/Interfaces**: `popup.js` - `loadCachedJoke()` function (lines 9-35)
- **Acceptance Tests**:
  - Cached two-part joke with `punchlineShown: false` shows "See the punchline!" button
  - Cached two-part joke with `punchlineShown: true` shows "Get another joke!" button
  - Cached one-liner (no punchline) shows "Get another joke!" button
  - Old cached jokes without `punchlineShown` field show "Get another joke!" (backward compat)

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation | Trigger |
|------|--------|------------|------------|---------|
| Old cache without flag | Low | Medium | Treat undefined as true (shown) for backward compat | `punchlineShown === undefined` |
| Storage update fails | Low | Low | Non-blocking - user can still get new joke | Error in console |

## Test Strategy

**Single Manual Test**:
1. Open popup, click "Yes", get a two-part joke
2. Close popup BEFORE clicking "See the punchline!"
3. Reopen popup
4. Verify: Setup text displays, "See the punchline!" button visible
5. Click "See the punchline!" → punchline reveals
6. Close and reopen popup → "Get another joke!" button now visible

## References

- Review comment: Cache jokes before punchline revealed [P2]
- Related code: `popup.js:216-220` (caching), `popup.js:9-35` (loading)
- Previous execution log: `memory-bank/execute/2026-01-28_22-45-00_joke-caching.md`
- Ticket: `memory-bank/tickets/008-joke-caching.md`

## Implementation Details

### T1 Changes (cacheJoke + revealPunchline)

**In `cacheJoke()` around line 44-48:**
```
Add punchlineShown: false to cacheData object
```

**In `revealPunchline()` after punchline displays (around line 324):**
```
Update cache: chrome.storage.local.set({ lastJoke: {...currentJoke, punchlineShown: true} })
```

### T2 Changes (loadCachedJoke)

**In `loadCachedJoke()` around line 21-29:**
```
Check: if joke has punchline AND punchlineShown is not true
  → Show "See the punchline!" button with revealPunchline handler
Else
  → Show "Get another joke!" button (current behavior)
```

---

## Final Gate Summary

| Item | Value |
|------|-------|
| Plan Path | `memory-bank/plan/2026-01-28_23-15-00_two-part-joke-cache-fix.md` |
| Milestones | 3 |
| Tasks | 2 |
| Key Gate | M2 - Button restoration working correctly |
| Files Modified | `popup.js` only |
| Estimated Changes | ~15 lines added/modified |

**Next Command**: `/ce-ex memory-bank/plan/2026-01-28_23-15-00_two-part-joke-cache-fix.md`
