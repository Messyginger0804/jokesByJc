---
title: "Image Error Handling – Plan"
phase: Plan
date: "2026-01-28T21:24:17"
owner: "agent"
parent_research: "memory-bank/tickets/001-image-error-handling.md"
git_commit_at_plan: "77a6f7f"
tags: [plan, image-error-handling, avatar, bug-fix]
---

## Goal

**Add `onerror` handling to avatar images so broken image icons never appear to users.**

Non-goals:
- Preloading/caching images
- Changing avatar images or adding new ones
- Refactoring the existing avatar state machine

## Scope & Assumptions

**In Scope:**
- Add `onerror` handler to avatar `<img>` element
- Provide fallback behavior when image fails to load
- Log errors for debugging

**Out of Scope:**
- CSS changes to avatar styling
- Adding new avatar images
- Modifying joke fetching logic

**Assumptions:**
- At least one image (`intro.png`) will always exist as fallback
- Browser extension environment supports standard `onerror` events
- Console logging is acceptable for debugging

## Deliverables (DoD)

1. **popup.js** updated with `onerror` handler function
2. Avatar displays fallback (hide or placeholder) when any image fails
3. Console logs image load failures for debugging
4. No broken image icons visible under any failure scenario

## Readiness (DoR)

- [x] popup.js readable and understood (lines 81-87, 110-112, 127-129, 138-140, 171-174, 201-204)
- [x] popup.html structure understood (line 18 - avatar img)
- [x] Images directory confirmed: `images/intro.png`, `images/thinking.png`, `images/lol.png`
- [x] No blocking dependencies

## Milestones

| ID | Milestone | Description |
|----|-----------|-------------|
| M1 | Error Handler | Add `onerror` handler to avatar element |
| M2 | Fallback Logic | Implement graceful fallback (hide or use data URI) |
| M3 | Validation | Manual test with missing/broken image path |

## Work Breakdown (Tasks)

### Task 1: Add onerror handler to avatar initialization
- **ID:** T1
- **Summary:** Create reusable error handler and attach on avatar element query
- **Owner:** executor
- **Dependencies:** None
- **Target Milestone:** M1
- **Files/Interfaces:** `popup.js` (after line 87)
- **Acceptance Tests:**
  - [ ] `onerror` handler attached to avatar element
  - [ ] Handler logs error to console with image src

### Task 2: Implement fallback behavior
- **ID:** T2
- **Summary:** When image fails, hide avatar or use inline SVG/data URI placeholder
- **Owner:** executor
- **Dependencies:** T1
- **Target Milestone:** M2
- **Files/Interfaces:** `popup.js`
- **Acceptance Tests:**
  - [ ] Avatar hidden OR shows neutral placeholder on error
  - [ ] No browser broken-image icon displayed

### Task 3: Add error handler to dynamic src changes
- **ID:** T3
- **Summary:** Ensure onerror persists when avatar.src is changed (lines 110, 127, 138, 173, 203)
- **Owner:** executor
- **Dependencies:** T1
- **Target Milestone:** M2
- **Files/Interfaces:** `popup.js`
- **Acceptance Tests:**
  - [ ] Error handling works after any `avatar.src = ...` assignment

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation | Trigger |
|------|--------|------------|------------|---------|
| onerror not firing in extension context | High | Low | Test in actual extension load | Handler never triggers on bad path |
| Infinite loop if fallback also fails | Medium | Low | Use data URI or hide instead of another image path | Console shows repeated errors |

## Test Strategy

**Single Manual Test:**
- Temporarily rename `images/intro.png` → `images/intro.bak`
- Load extension popup
- Verify: No broken image icon, avatar hidden or placeholder shown, console logs error
- Restore `images/intro.png`

## Implementation Approach

**Primary Approach (Recommended):**
Add a single helper function that sets the `onerror` handler and call it after every `avatar.src` assignment:

```
Location: popup.js, new function near top
Pattern:
  function handleAvatarError(avatarEl) {
    avatarEl.onerror = function() {
      console.error('Avatar failed to load:', this.src);
      this.style.visibility = 'hidden';
      this.onerror = null; // prevent loops
    };
  }
```

Then call `handleAvatarError(avatar)` after each `avatar.src = ...` line.

**Alternative Approach:**
Use CSS `object-fit` with a background fallback. Less reliable across browsers.

## References

- Ticket: `memory-bank/tickets/001-image-error-handling.md`
- popup.js avatar handling: lines 81-87, 110-112, 127-129, 138-140, 171-174, 201-204
- popup.html avatar element: line 18

---

## Final Gate

| Item | Value |
|------|-------|
| Plan Path | `memory-bank/plan/2026-01-28_21-24-17_image-error-handling.md` |
| Milestones | 3 |
| Tasks | 3 |
| Test Count | 1 (manual) |
| Risk Items | 2 |

**Next Command:**
```
/cc-ex memory-bank/plan/2026-01-28_21-24-17_image-error-handling.md
```
