---
title: "Company Ad Replacement – Plan"
phase: Plan
date: "2026-01-28T23:45:00"
owner: "agent"
parent_research: "memory-bank/tickets/009-company-ad-replacement.md"
git_commit_at_plan: "2f2b5f6"
tags: [plan, company-ad, feature]
---

## Goal

**Replace the blog section with a company advertisement for dfwsc.com** that displays the company logo, "Need custom software?" text, and links to https://dfwsc.com.

**Non-goals:**
- Changing any other popup functionality (jokes, buttons, avatar)
- Adding analytics or tracking
- Complex animations beyond existing patterns

## Scope & Assumptions

**In Scope:**
- Remove blog bubble link (lines 29-31 in popup.html)
- Remove blog container div (line 28 in popup.html)
- Remove blog.css link and blog.js script references
- Delete blog.js and blog.css files
- Add company logo image to /images/ folder
- Create ad section HTML with logo, text, and link
- Create ad.css with styling matching popup theme

**Out of Scope:**
- Modifying popup.js or styles.css
- Changing manifest.json (blog files not registered there)
- Any backend changes

**Assumptions:**
- Company logo will be provided or a placeholder used
- Ad opens dfwsc.com in new tab (target="_blank")
- Styling matches existing dark theme with light content areas

## Deliverables (DoD)

| Deliverable | Acceptance Criteria |
|-------------|---------------------|
| Blog removal | No blog-related HTML, CSS, or JS in codebase |
| Ad section | Logo + text + link visible in popup |
| Ad styling | Consistent with popup theme (colors, radius, shadows) |
| Link functionality | dfwsc.com opens in new tab on click |

## Readiness (DoR)

- [x] Ticket 009 requirements documented
- [x] Codebase structure analyzed
- [x] Files to modify identified
- [ ] Company logo file (PNG/SVG) — **BLOCKER: User must provide**

## Milestones

| ID | Milestone | Description |
|----|-----------|-------------|
| M1 | Cleanup | Remove blog.js, blog.css, and HTML references |
| M2 | Ad Implementation | Add logo, create ad section HTML and ad.css |
| M3 | Validation | Manual test popup loads correctly |

## Work Breakdown (Tasks)

| Task ID | Summary | Dependencies | Milestone | Files/Interfaces |
|---------|---------|--------------|-----------|------------------|
| T1 | Remove blog references from popup.html | None | M1 | popup.html (lines 6, 28-31, 34) |
| T2 | Delete blog.js file | T1 | M1 | blog.js (delete) |
| T3 | Delete blog.css file | T1 | M1 | blog.css (delete) |
| T4 | Add company logo to images folder | User provides logo | M2 | images/dfwsc-logo.png |
| T5 | Create ad.css with styling | T3 | M2 | ad.css (new) |
| T6 | Add ad section HTML to popup.html | T1, T4, T5 | M2 | popup.html |
| T7 | Manual validation | T6 | M3 | Load extension, verify ad displays |

**Task Details:**

### T1: Remove blog references from popup.html
- Remove line 6: `<link rel="stylesheet" href="blog.css" />`
- Remove line 28: `<div id="blog-container" class="blog-layout"></div>`
- Remove lines 29-31: Blog bubble `<a>` tag
- Remove line 34: `<script src="blog.js"></script>`

**Acceptance Tests:**
- [ ] No `blog.css` link in HTML
- [ ] No `blog-container` div in HTML
- [ ] No `blog-bubble` link in HTML
- [ ] No `blog.js` script in HTML

### T2-T3: Delete blog.js and blog.css
**Acceptance Tests:**
- [ ] blog.js file deleted from project root
- [ ] blog.css file deleted from project root

### T4: Add company logo
**Acceptance Tests:**
- [ ] Logo file exists at images/dfwsc-logo.png (or .svg)
- [ ] Logo is appropriately sized (~100-150px width)

### T5: Create ad.css
**Styling Requirements:**
- Match popup theme colors (dark bg, light content areas)
- Use existing border-radius pattern (30px containers)
- Include hover effects matching button patterns
- Keep minimal — only styles needed for ad

**Acceptance Tests:**
- [ ] ad.css file created
- [ ] Styles for .ad-container, .ad-logo, .ad-text, .ad-link

### T6: Add ad section HTML
**Structure:**
```html
<link rel="stylesheet" href="ad.css" />
...
<a href="https://dfwsc.com" target="_blank" class="ad-container" aria-label="Visit dfwsc.com for custom software">
  <img src="./images/dfwsc-logo.png" alt="DFWSC Logo" class="ad-logo" />
  <span class="ad-text">Need custom software?</span>
</a>
```

**Acceptance Tests:**
- [ ] Ad section renders in popup
- [ ] Link opens dfwsc.com in new tab
- [ ] Logo and text visible
- [ ] Accessible (aria-label present)

### T7: Manual validation
**Acceptance Tests:**
- [ ] Extension loads without console errors
- [ ] Ad displays correctly
- [ ] Clicking ad opens dfwsc.com
- [ ] Popup layout intact (jokes still work)

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation | Trigger |
|------|--------|------------|------------|---------|
| No logo provided | High | Medium | Use text-only fallback or placeholder | T4 blocked |
| CSS conflicts | Low | Low | Use unique class names with `ad-` prefix | Visual bugs |

## Test Strategy

**One Manual Test:**
- Load extension in Chrome, verify ad displays with logo, text, and working link to dfwsc.com

## References

- Ticket: `memory-bank/tickets/009-company-ad-replacement.md`
- popup.html current structure: lines 28-34 contain blog section
- Styling reference: styles.css for color palette and patterns

---

## Alternative Option

**Text-only ad (no logo):** If logo file is not available, implement a styled text link using existing chat-bubble pattern. This would reduce scope by removing T4 dependency.

---

## Final Gate

| Item | Value |
|------|-------|
| Plan path | `memory-bank/plan/2026-01-28_23-45-00_company-ad-replacement.md` |
| Milestones | 3 (Cleanup, Implementation, Validation) |
| Tasks | 7 |
| Blocking dependency | Company logo file (T4) |
| Next command | `/ce-ex "memory-bank/plan/2026-01-28_23-45-00_company-ad-replacement.md"` |

**Note:** Before execution, user must provide company logo file or confirm text-only fallback.
