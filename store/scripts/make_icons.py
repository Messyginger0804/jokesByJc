#!/usr/bin/env python3
"""Builds the extension icons (16, 48, 128) from the 240x240 avatar art.

Usage (from the repo root):  python3 store/scripts/make_icons.py
Needs Pillow (pip install pillow). Writes icons/icon{16,48,128}.png and the review
sheet store/icons-src/icon-preview-sheet.png (store/ is not part of the extension package).

Design: JC's laughing face (images/lol.png) on a blue rounded badge that uses the
popup's accent blue, with a small white speech bubble in the corner. The badge
fills the centre 96x96 of the 128 canvas (16 px transparent margin, as the
Chrome Web Store asks). The 48 keeps the bubble. The 16 drops it and uses the
front-facing smile from images/intro.png on a full-bleed circle, because the
laughing face (eyes shut, head tilted) turns into a blob at that size.

Shapes are drawn at 8x and downsampled. The avatar is always resampled straight
from the 240 px source to the final size (downscale only, never upscaled).
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SS = 8  # supersampling factor for vector shapes

BLUE_TOP = (59, 130, 246)  # #3b82f6
BLUE_BOTTOM = (29, 78, 216)  # #1d4ed8 (popup --accent-blue-hover)
WHITE = (255, 255, 255)


def vgradient(size, top, bottom):
    w, h = size
    col = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        col.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return col.resize((w, h))


def rounded_mask(size, box, radius):
    m = Image.new("L", (size * SS, size * SS), 0)
    x0, y0, x1, y1 = (v * SS for v in box)
    ImageDraw.Draw(m).rounded_rectangle((x0, y0, x1 - 1, y1 - 1), radius * SS, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def circle_mask(size, box):
    m = Image.new("L", (size * SS, size * SS), 0)
    x0, y0, x1, y1 = (v * SS for v in box)
    ImageDraw.Draw(m).ellipse((x0, y0, x1 - 1, y1 - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def bubble_layer(size, box, dots=3):
    """White speech bubble with a tail at the bottom-left and blue dots inside."""
    big = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    x0, y0, x1, y1 = (v * SS for v in box)
    h = y1 - y0
    shadow = Image.new("RGBA", big.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    off = max(1, size // 64) * SS
    sd.rounded_rectangle((x0, y0 + off, x1, y1 + off), h // 2, fill=(10, 30, 90, 110))
    tail = [(x0 + h * 0.35, y1 - h * 0.2), (x0 + h * 0.15, y1 + h * 0.42), (x0 + h * 0.85, y1 - h * 0.1)]
    sd.polygon([(x, y + off) for x, y in tail], fill=(10, 30, 90, 110))
    big.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(off)))
    d.rounded_rectangle((x0, y0, x1, y1), h // 2, fill=WHITE + (255,))
    d.polygon(tail, fill=WHITE + (255,))
    r = h * 0.11
    cy = (y0 + y1) / 2
    for i in range(dots):
        cx = x0 + (x1 - x0) * (i + 1) / (dots + 1)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=BLUE_BOTTOM + (255,))
    return big.resize((size, size), Image.LANCZOS)


def avatar_layer(size, art, crop, dest):
    """Paste a crop of the 240 px art, resampled once to its final size."""
    src = Image.open(os.path.join(ROOT, "images", art)).convert("RGBA")
    x0, y0, x1, y1 = dest
    w, h = x1 - x0, y1 - y0
    cw, ch = crop[2] - crop[0], crop[3] - crop[1]
    assert w <= cw and h <= ch, "avatar would be upscaled"
    face = src.resize((w, h), Image.LANCZOS, box=crop)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.alpha_composite(face, (x0, y0))
    return layer


def badge_icon(size, art, badge_box, radius, face_crop, face_dest, bubble_box=None, circle=False):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = circle_mask(size, badge_box) if circle else rounded_mask(size, badge_box, radius)
    bx0, by0, bx1, by1 = badge_box
    fill = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fill.paste(vgradient((bx1 - bx0, by1 - by0), BLUE_TOP, BLUE_BOTTOM), (bx0, by0))
    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    badge.paste(fill, (0, 0), mask)
    # Avatar clipped to the badge so the shirt runs off the bottom edge.
    face = avatar_layer(size, art, face_crop, face_dest)
    clip = Image.new("L", (size, size), 0)
    clip.paste(face.getchannel("A"), (0, 0), mask)
    face.putalpha(clip)
    badge.alpha_composite(face)
    canvas.alpha_composite(badge)
    if bubble_box:
        canvas.alpha_composite(bubble_layer(size, bubble_box))
    return canvas


def save_png(img, path):
    img.save(path, optimize=True)
    print(f"{os.path.relpath(path, ROOT)}: {img.size[0]}x{img.size[1]}, {os.path.getsize(path)} bytes")


ICONS = {
    # 96x96 badge centred in 128; face from the laughing pose.
    128: dict(art="lol.png", badge_box=(16, 16, 112, 112), radius=24, face_crop=(78, 10, 226, 158),
              face_dest=(22, 22, 112, 112), bubble_box=(18, 19, 50, 39)),
    # 48: 2 px margin, bubble kept.
    48: dict(art="lol.png", badge_box=(2, 2, 46, 46), radius=11, face_crop=(78, 10, 226, 158),
             face_dest=(7, 6, 49, 48), bubble_box=(3, 3, 19, 13)),
    # 16: full-bleed circle, front-facing smile, no bubble.
    16: dict(art="intro.png", badge_box=(0, 0, 16, 16), radius=8, face_crop=(6, 10, 118, 122),
             face_dest=(1, 1, 16, 16), circle=True),
}


def build(size):
    return badge_icon(size, **ICONS[size])


def main():
    out = {}
    for size in (128, 48, 16):
        img = build(size)
        save_png(img, os.path.join(ROOT, "icons", f"icon{size}.png"))
        out[size] = img
    os.makedirs(os.path.join(ROOT, "store", "icons-src"), exist_ok=True)
    preview_sheet(out, os.path.join(ROOT, "store", "icons-src"))


def preview_sheet(icons, outdir):
    """Icons on light (#f1f3f4) and dark (#202124) toolbars.

    Columns: 16 (1x toolbar), 32 (2x toolbar: Chrome scales the 48 down), 48 (1x
    extensions page), 96 (2x extensions page: the 128 scaled down), 128, and the
    16 magnified 8x (nearest) to check the pixels.
    """
    os.makedirs(outdir, exist_ok=True)
    cells = [icons[16], icons[48].resize((32, 32), Image.LANCZOS), icons[48],
             icons[128].resize((96, 96), Image.LANCZOS), icons[128], icons[16].resize((128, 128), Image.NEAREST)]
    pad, band_h = 32, 128 + 64
    width = pad + sum(c.width + pad for c in cells)
    sheet = Image.new("RGB", (width, band_h * 2))
    for r, bg in enumerate([(241, 243, 244), (32, 33, 36)]):
        band = Image.new("RGB", (width, band_h), bg)
        x = pad
        for c in cells:
            band.paste(c, (x, (band_h - c.height) // 2), c)
            x += c.width + pad
        sheet.paste(band, (0, r * band_h))
    path = os.path.join(outdir, "icon-preview-sheet.png")
    sheet.save(path)
    print("preview:", path)


if __name__ == "__main__":
    main()
