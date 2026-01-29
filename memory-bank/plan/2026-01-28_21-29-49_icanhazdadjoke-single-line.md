---
title: "icanhazdadjoke Single-Line Handling – Plan"
phase: Plan
date: "2026-01-28_21-29-49"
owner: "agent"
parent_research: "memory-bank/tickets/002-icanhazdadjoke-single-line.md"
git_commit_at_plan: "570cf06"
tags: [plan, icanhazdadjoke, single-line, ux]
---

## Goal

**Singular Focus:** Eliminate awkward `😄`-only punchlines for icanhazdadjoke single-line jokes by implementing a one-liner display flow that skips the punchline step entirely.

**Non-Goals:**
- Improving split pattern matching (adds complexity, unreliable)
- Filtering API results (reduces joke variety)
- Major UI redesign

## Scope & Assumptions

**In Scope:**
- Modify `parseJoke` function for icanhazdadjoke API to flag one-liners
- Update `showPunchlineButton` and `revealPunchline` flow to handle one-liners
- Skip "See the punchline" step for jokes without natural split points

**Out of Scope:**
- Changes to other joke APIs
- New UI components or styling
- Backend modifications

**Assumptions:**
- One-liners are jokes where no split pattern is found
- Existing typewriter effect works for one-liner display
- "New Joke" button flow already exists via "Hear the joke again" pattern

## Deliverables (DoD)

| Artifact | Acceptance Criteria |
|----------|---------------------|
| Modified `parseJoke` | Returns `{ setup, punchline, isOneLiner }` flag |
| Updated joke flow | One-liners skip "See punchline" → go directly to "New Joke" button |
| Clean UX | No `😄` emoji-only punchlines displayed |

## Readiness (DoR)

- [x] `popup.js` file accessible and understood
- [x] Current flow documented (lines 45-61, 172-220)
- [x] No blocking dependencies
- [x] Git state clean for branching

## Milestones

| ID | Milestone | Description |
|----|-----------|-------------|
| M1 | Parser Update | Add `isOneLiner` flag to parseJoke return object |
| M2 | Flow Logic | Update `showPunchlineButton` to detect and handle one-liners |
| M3 | Test & Verify | Manual QA with icanhazdadjoke API |

## Work Breakdown (Tasks)

| ID | Task | Owner | Dependencies | Milestone |
|----|------|-------|--------------|-----------|
| T1 | Update `parseJoke` for icanhazdadjoke to return `isOneLiner: true` when no split found | agent | - | M1 |
| T2 | Modify `showPunchlineButton` to check `isOneLiner` and skip to "New Joke" flow | agent | T1 | M2 |
| T3 | Update button text from "Hear the joke again" to "Get another joke!" for clarity | agent | T2 | M2 |
| T4 | Manual QA: refresh until icanhazdadjoke one-liner appears, verify flow | agent | T3 | M3 |

### Task Details

**T1: Update parseJoke**
- File: `popup.js:45-61`
- Change: Replace `{ setup: joke, punchline: "😄" }` with `{ setup: joke, punchline: null, isOneLiner: true }`
- Acceptance: parseJoke returns object with `isOneLiner` boolean

**T2: Modify showPunchlineButton**
- File: `popup.js:172-190`
- Change: Check `currentJoke.isOneLiner`; if true, show "Get another joke!" button instead of "See the punchline!"
- Acceptance: One-liners skip punchline reveal step

**T3: Button text update**
- File: `popup.js:210-211`
- Change: Update button text for consistency
- Acceptance: Button reads "Get another joke!" after punchline or for one-liners

**T4: Manual QA**
- Verify: Load extension, click through until icanhazdadjoke one-liner appears
- Verify: No `😄` shown, button goes to "Get another joke!"
- Verify: Two-part jokes still work normally

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation | Trigger |
|------|--------|------------|------------|---------|
| icanhazdadjoke API unavailable during testing | Medium | Low | Use local fallback jokes to verify flow logic | API timeout |
| Breaking two-part joke flow | High | Low | Ensure `isOneLiner` defaults to `false`/`undefined` for split jokes | QA catches regression |

## Test Strategy

**Single Manual Test:**
- Load extension and repeatedly fetch jokes until an icanhazdadjoke one-liner appears
- Verify: joke displays fully, no punchline step, "Get another joke!" button appears
- Verify: clicking button fetches new joke

## References

- Ticket: `memory-bank/tickets/002-icanhazdadjoke-single-line.md`
- Current implementation: `popup.js:45-61` (parseJoke), `popup.js:172-220` (button flow)

---

## Alternative Approach (Not Recommended)

**Option B: Enhanced Pattern Matching**
- Add more split patterns (`. `, `— `, sentence detection)
- Pros: More jokes get setup/punchline format
- Cons: Unreliable, some jokes still won't split well, adds complexity
- Decision: Rejected in favor of clean one-liner handling

---

## Final Gate

| Item | Value |
|------|-------|
| Plan Path | `memory-bank/plan/2026-01-28_21-29-49_icanhazdadjoke-single-line.md` |
| Milestones | 3 |
| Tasks | 4 |
| Primary Gate | Manual QA verification |
| Next Command | `/ce-ex "memory-bank/plan/2026-01-28_21-29-49_icanhazdadjoke-single-line.md"` |
