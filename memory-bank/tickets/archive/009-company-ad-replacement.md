# Ticket 009: Replace Blog Section with Company Ad

**Category:** Feature
**Status:** Closed
**Priority:** Medium

## Description

Replace the current "Check out my blog!!!" section with a company advertisement promoting custom software services at dfwsc.com.

## Current Behavior

- A chat bubble button links to `https://www.byjc.dev/blogs/15-WinYourInternship` with text "Check out my blog!!!"
- A dynamic blog container fetches and displays blog content from `https://byjc.dev/api/blog-of-the-month`
- blog.js fetches blog title, snippet, and displays with images

## Proposed Changes

1. **Remove blog content** - Delete the blog bubble link and dynamic blog container
2. **Add company ad** - Display "Need custom software? dfwsc.com" with company logo
3. **Update styling** - Repurpose or replace blog.css for ad styling
4. **Clean up** - Remove unused blog.js API calls

## Design

- Company logo (needs to be added to `/images/` folder)
- Text: "Need custom software?"
- Link to: https://dfwsc.com
- Clean, professional styling that fits popup aesthetic

## Files Affected

- `popup.html` - Replace blog bubble and container with ad section
- `blog.js` - Remove or repurpose (delete if not needed)
- `blog.css` - Rename to `ad.css` or update styles for ad layout
- `images/` - Add company logo file

## Acceptance Criteria

- [x] Blog bubble link removed
- [x] Blog container removed
- [x] Company logo displays correctly
- [x] "Need custom software?" text visible
- [x] dfwsc.com link works (opens in new tab)
- [x] Ad section styled to match popup theme
- [x] Unused blog code cleaned up
