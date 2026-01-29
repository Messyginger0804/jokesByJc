# Ticket 007: Optimize Avatar Images

**Category:** Performance
**Status:** Open
**Priority:** Low

## Description

Avatar PNG images are 87-173KB each, which is large for a browser extension. Could be optimized or converted to WebP for faster loading.

## Current Image Sizes

- `coolguy.png` - 173KB
- `pointing.png` - 150KB
- `lol.png` - 147KB
- `intro.png` - 93KB
- `thinking.png` - 87KB

**Total: ~650KB for avatars alone**

## Suggested Optimizations

1. **Convert to WebP** - Typically 25-35% smaller than PNG
2. **Compress PNGs** - Use tools like pngquant or tinypng
3. **Resize dimensions** - If images are larger than displayed size
4. **Use SVG** - If images can be vectorized

## Files Affected

- `images/` directory
- Possibly `popup.js` and `popup.html` if format changes

## Acceptance Criteria

- [ ] Total image size reduced by at least 40%
- [ ] No visible quality loss at display size
- [ ] Images still load correctly in extension
