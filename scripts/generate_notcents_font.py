# NotCents single-glyph font generator (BP041 SAGA 3).
# Creates cai-notcents.woff2 + cai-notcents.ttf at PUA codepoint U+E000.
#
# Source: amplify-computer/src/renderer/public/icons/notcents.png
# Output: amplify-computer/src/renderer/public/fonts/cai-notcents.{woff2,ttf}
#
# Canon: project_notcents_custom_font_one_glyph_bp041.md
# Font: family "CAINotCents", version 1.0, AGPL Free Forever, PUA U+E000 single-glyph.
#
# Run: python.exe scripts\generate_notcents_font.py

import sys
import os
from pathlib import Path
from collections import defaultdict

# Ensure Microsoft Store Python can find user-installed packages
_candidates = [
    Path.home() / "AppData/Local/Packages/PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0/LocalCache/local-packages/Python313/site-packages",
]
for _c in _candidates:
    if _c.exists() and str(_c) not in sys.path:
        sys.path.insert(0, str(_c))

try:
    from PIL import Image
except ImportError:
    sys.exit("Error: Pillow not found. pip install Pillow")

try:
    from fontTools.fontBuilder import FontBuilder
    from fontTools.ttLib import TTFont
    from fontTools.pens.ttGlyphPen import TTGlyphPen
except ImportError as e:
    sys.exit(f"Error: fonttools import failed: {e}. pip install fonttools")

# ─── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
ROOT = SCRIPT_DIR.parent
PNG_PATH   = ROOT / "src" / "renderer" / "public" / "icons" / "notcents.png"
FONT_DIR   = ROOT / "src" / "renderer" / "public" / "fonts"
TTF_PATH   = FONT_DIR / "cai-notcents.ttf"
WOFF2_PATH = FONT_DIR / "cai-notcents.woff2"

FONT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Font parameters ──────────────────────────────────────────────────────────

UPM          = 1000
ASCENDER     = 800
DESCENDER    = -200
CAP_HEIGHT   = 700
X_HEIGHT     = 500
ADVANCE_W    = 700
PUA_CP       = 0xE000    # U+E000 first Private Use Area slot
MARGIN_L     = 40
MARGIN_R     = 40

# ─── Load + binarize source PNG ───────────────────────────────────────────────

print(f"Loading {PNG_PATH}...")
if not PNG_PATH.exists():
    sys.exit(f"Source PNG not found: {PNG_PATH}")

img = Image.open(PNG_PATH).convert("RGBA")
img_w, img_h = img.size
print(f"  Source: {img_w} x {img_h} RGBA")

# Binarize: pixel is glyph fill when alpha > 64 AND luminance < 160
pixels = []
for y in range(img_h):
    row = []
    for x in range(img_w):
        r, g, b, a = img.getpixel((x, y))
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        row.append(1 if (a > 64 and lum < 160) else 0)
    pixels.append(row)

# ─── Map image coords to glyph coords ────────────────────────────────────────
# Image: y=0 top, y=img_h-1 bottom.  Glyph: y=0 baseline, y=CAP_HEIGHT top.

scale_x = (ADVANCE_W - MARGIN_L - MARGIN_R) / img_w
scale_y = CAP_HEIGHT / img_h

def px_to_glyph(px_x, px_y_row):
    """
    Image pixel column px_x, row px_y_row  =>  glyph unit rectangle.
    Returns (gx0, gy0, gx1, gy1) with gy0 < gy1.
    """
    gx0 = MARGIN_L + px_x * scale_x
    gx1 = MARGIN_L + (px_x + 1) * scale_x
    # Flip y: row 0 at top of image = cap height; row img_h-1 at bottom = 0
    gy1 = CAP_HEIGHT - px_y_row * scale_y
    gy0 = CAP_HEIGHT - (px_y_row + 1) * scale_y
    return gx0, gy0, gx1, gy1

# ─── Extract horizontal run-length rectangles ────────────────────────────────

raw_rects = []
for row_i in range(img_h):
    in_run = False
    run_start = 0
    for col_i in range(img_w + 1):
        val = pixels[row_i][col_i] if col_i < img_w else 0
        if val == 1 and not in_run:
            in_run = True
            run_start = col_i
        elif val == 0 and in_run:
            in_run = False
            # Run spans columns [run_start, col_i)
            gx0 = MARGIN_L + run_start * scale_x
            gx1 = MARGIN_L + col_i * scale_x
            gy1 = CAP_HEIGHT - row_i * scale_y
            gy0 = CAP_HEIGHT - (row_i + 1) * scale_y
            raw_rects.append((gx0, gy0, gx1, gy1))

print(f"  {len(raw_rects)} scanline rectangles extracted")

# ─── Merge vertically adjacent rects with same x-extents ─────────────────────

def merge_rects_vertical(rects):
    groups = defaultdict(list)
    for gx0, gy0, gx1, gy1 in rects:
        key = (round(gx0, 1), round(gx1, 1))
        groups[key].append((gy0, gy1))
    merged = []
    for (gx0, gx1), segs in groups.items():
        segs.sort()
        c_y0, c_y1 = segs[0]
        for gy0, gy1 in segs[1:]:
            if abs(gy0 - c_y1) < 0.6:
                c_y1 = max(c_y1, gy1)
            else:
                merged.append((gx0, c_y0, gx1, c_y1))
                c_y0, c_y1 = gy0, gy1
        merged.append((gx0, c_y0, gx1, c_y1))
    return merged

merged = merge_rects_vertical(raw_rects)
print(f"  {len(merged)} rectangles after vertical merge")

# ─── Draw glyph using TTGlyphPen ─────────────────────────────────────────────

def draw_rect_contour(pen, x0, y0, x1, y1):
    """Filled rectangle as counter-clockwise TrueType contour."""
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    if x1 <= x0 or y1 <= y0:
        return
    pen.moveTo((x0, y0))
    pen.lineTo((x0, y1))
    pen.lineTo((x1, y1))
    pen.lineTo((x1, y0))
    pen.closePath()

def build_notcents_glyph():
    pen = TTGlyphPen(None)
    for gx0, gy0, gx1, gy1 in merged:
        draw_rect_contour(pen, gx0, gy0, gx1, gy1)
    return pen.glyph()

def build_notdef_glyph():
    pen = TTGlyphPen(None)
    # Outer box
    pen.moveTo((50, 0))
    pen.lineTo((50, 700))
    pen.lineTo((450, 700))
    pen.lineTo((450, 0))
    pen.closePath()
    # Inner cutout (clockwise = hole in even-odd)
    pen.moveTo((100, 50))
    pen.lineTo((400, 50))
    pen.lineTo((400, 650))
    pen.lineTo((100, 650))
    pen.closePath()
    return pen.glyph()

notcents_glyph = build_notcents_glyph()
notdef_glyph   = build_notdef_glyph()

# ─── Assemble font with FontBuilder ──────────────────────────────────────────

print("Assembling font...")
fb = FontBuilder(UPM, isTTF=True)

fb.setupGlyphOrder([".notdef", "uniE000"])
fb.setupCharacterMap({PUA_CP: "uniE000"})
fb.setupHorizontalMetrics({
    ".notdef": (500, 50),
    "uniE000": (ADVANCE_W, MARGIN_L),
})
fb.setupHorizontalHeader(ascent=ASCENDER, descent=DESCENDER)
fb.setupNameTable({
    "familyName":              "CAINotCents",
    "styleName":               "Regular",
    "uniqueFontIdentifier":    "CAINotCents-Regular-BP041",
    "fullName":                "CAI NotCents",
    "version":                 "Version 1.0",
    "psName":                  "CAINotCents-Regular",
    "copyright":               "Liana Banyan Corporation. AGPL Free Forever.",
    "description":             "Single-glyph: NotCents (D with two vertical strokes) at PUA E000. NO-FIAT-CONVERSION identity.",
})
fb.setupOS2(
    sTypoAscender=ASCENDER,
    sTypoDescender=DESCENDER,
    sTypoLineGap=0,
    usWinAscent=ASCENDER,
    usWinDescent=abs(DESCENDER),
    sxHeight=X_HEIGHT,
    sCapHeight=CAP_HEIGHT,
    fsType=0,
    achVendID="LBCA",
)
fb.setupPost()
fb.setupHead(unitsPerEm=UPM)

# Use FontBuilder.setupGlyf to properly wire glyf + loca tables
fb.setupGlyf({
    ".notdef": notdef_glyph,
    "uniE000": notcents_glyph,
})

# ─── Save TTF ─────────────────────────────────────────────────────────────────

print(f"  Saving TTF -> {TTF_PATH}")
fb.font.save(str(TTF_PATH))
size_ttf = TTF_PATH.stat().st_size
print(f"  TTF saved: {size_ttf:,} bytes")

# ─── Convert to WOFF2 ─────────────────────────────────────────────────────────

print(f"  Converting TTF -> WOFF2...")
try:
    from fontTools.ttLib.woff2 import compress
    compress(str(TTF_PATH), str(WOFF2_PATH))
    size_w2 = WOFF2_PATH.stat().st_size
    print(f"  WOFF2 saved: {size_w2:,} bytes")
except Exception as e:
    print(f"  WOFF2 compression failed: {e}")
    print(f"  (TTF is still valid and usable)")

print()
print("=== NotCents font generated ===")
print(f"  Family:    CAINotCents")
print(f"  Codepoint: U+E000  (PUA first slot)")
print(f"  AGPL:      Free Forever")
print(f"  TTF:       {TTF_PATH}")
print(f"  WOFF2:     {WOFF2_PATH}")
