---
title: "Typewriter Effect Accessibility – Plan"
phase: Plan
date: "2026-01-28_22-04-41"
owner: "agent"
parent_ticket: "memory-bank/tickets/005-typewriter-accessibility.md"
git_commit_at_plan: "271ed6d"
tags: [plan, accessibility, typewriter, aria]
---

## Goal

**Singular Focus:** Make the typewriter effect screen-reader friendly by ensuring the complete joke text is announced once (not character-by-character) while preserving the visual animation for sighted users.

**Non-goals:**
- Adding new features to the joke system
- Refactoring the typewriter animation itself
- Adding comprehensive accessibility audit beyond this specific issue

## Scope & Assumptions

**In Scope:**
- Modify typewriter to work with screen readers properly
- Respect `prefers-reduced-motion` media query
- Ensure complete text is announced, not individual characters

**Out of Scope:**
- Changes to joke fetching logic
- CSS styling changes (beyond motion preference)
- New UI elements

**Assumptions:**
- The existing `aria-live="polite"` and `role="status"` on `#joke-container` are correct
- Users on screen readers prefer instant text over animated text
- The solution should not require JavaScript feature detection for screen readers

## Deliverables (DoD)

| Artifact | Acceptance Criteria |
|----------|---------------------|
| Updated `popup.js` | typeWriterEffect respects reduced-motion preference |
| Updated `popup.html` | Proper ARIA structure for progressive text reveal |
| Manual verification | Screen reader announces complete text once |

## Readiness (DoR)

- [x] Codebase analyzed - typeWriterEffect at popup.js:75-93
- [x] Current ARIA attributes documented
- [x] Ticket requirements understood
- [x] Git state clean on `improvements` branch

## Milestones

| ID | Description | Gate |
|----|-------------|------|
| M1 | Implement reduced-motion detection | Code compiles, no errors |
| M2 | Modify typewriter for accessibility | Visual animation preserved |
| M3 | Verify screen reader behavior | Manual test passes |

## Work Breakdown (Tasks)

### T1: Add prefers-reduced-motion check to typeWriterEffect
- **Summary:** Detect user's motion preference and skip animation if reduced motion is preferred
- **Owner:** Agent
- **Dependencies:** None
- **Target Milestone:** M1
- **Files/Interfaces:** `popup.js` (typeWriterEffect function, lines 75-93)
- **Acceptance Tests:**
  - When `prefers-reduced-motion: reduce` is set, text appears instantly
  - When no preference or `no-preference`, typewriter animates normally

### T2: Use aria-busy during typing animation
- **Summary:** Set `aria-busy="true"` while typing, `aria-busy="false"` when complete
- **Owner:** Agent
- **Dependencies:** T1
- **Target Milestone:** M2
- **Files/Interfaces:** `popup.js` (typeWriterEffect function)
- **Acceptance Tests:**
  - Container has `aria-busy="true"` during animation
  - Container has `aria-busy="false"` after animation completes
  - Screen readers wait for typing to finish before announcing

### T3: Manual verification with screen reader
- **Summary:** Test with browser accessibility tools or screen reader
- **Owner:** User (manual)
- **Dependencies:** T1, T2
- **Target Milestone:** M3
- **Acceptance Tests:**
  - Complete joke text announced once, not character-by-character
  - Visual typewriter effect still works for sighted users
  - Reduced motion users see instant text

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation | Trigger |
|------|--------|------------|------------|---------|
| `aria-busy` not supported by all screen readers | Medium | Low | Also use `prefers-reduced-motion` as primary mechanism | Testing reveals inconsistent behavior |
| Motion preference not detected correctly | Low | Low | Use standard `window.matchMedia` API | Animation runs when it shouldn't |

## Test Strategy

**Single Test:** Manual verification that typewriter respects `prefers-reduced-motion` preference.

To test:
1. Open Chrome DevTools > Rendering > Emulate CSS media feature `prefers-reduced-motion: reduce`
2. Load extension, click "Yes"
3. Verify text appears instantly (no character animation)
4. Remove emulation, reload
5. Verify typewriter animation works normally

## References

- Ticket: `memory-bank/tickets/005-typewriter-accessibility.md`
- Relevant code: `popup.js:75-93` (typeWriterEffect function)
- ARIA live regions: `popup.html:15` (`#joke-container`)
- MDN prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

---

## Alternative Approach (Not Recommended)

**Hidden Text Pattern:** Keep full text in an `aria-label` while animating visible text separately. This is more complex and creates maintenance burden of syncing two text sources. The reduced-motion approach is simpler and follows platform conventions.

---

## Final Gate Summary

| Item | Value |
|------|-------|
| Plan Path | `memory-bank/plan/2026-01-28_22-04-41_typewriter-accessibility.md` |
| Milestones | 3 |
| Tasks | 3 (T1, T2 are code changes; T3 is manual verification) |
| Primary Gate | T3 - Manual screen reader verification |

**Next Command:** `/ce-ex memory-bank/plan/2026-01-28_22-04-41_typewriter-accessibility.md`
