"""Draws the Boekenhoekje app icon and saves it in all needed sizes.
Run from the project folder:  python3 tools/make-icons.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

CREAM = "#F5EFE6"
BEIGE = "#E8DCCB"
LATTE = "#C8AD8D"
MOCHA = "#8B6B4E"
ROSE = "#D8A7A0"

S = 4                 # draw 4x bigger, then shrink for smooth edges
N = 1024 * S
LINE = 20 * S


def p(v):
    return v * S


def book(d, x0, y0, x1, y1, fill):
    d.rounded_rectangle([p(x0), p(y0), p(x1), p(y1)], radius=p(26), fill=fill, outline=MOCHA, width=LINE)
    # spine bands
    for x in (x0 + 62, x0 + 84):
        d.line([p(x), p(y0 + 14), p(x), p(y1 - 14)], fill=MOCHA, width=int(LINE * 0.6))
    # pages on the right side
    d.line([p(x1 - 70), p((y0 + y1) / 2), p(x1 - 26), p((y0 + y1) / 2)], fill=MOCHA, width=int(LINE * 0.6))


def sparkle(d, cx, cy, r, fill):
    pts = []
    for i in range(240):
        t = 2 * math.pi * i / 240
        pts.append((p(cx + r * math.cos(t) ** 3), p(cy + r * math.sin(t) ** 3)))
    d.polygon(pts, fill=fill)


img = Image.new("RGB", (N, N), CREAM)
d = ImageDraw.Draw(img)

book(d, 252, 650, 772, 760, BEIGE)   # bottom
book(d, 300, 540, 724, 650, ROSE)    # middle
book(d, 276, 430, 700, 540, LATTE)   # top

# little bookmark ribbon hanging from the top book
d.polygon([(p(600), p(540)), (p(640), p(540)), (p(640), p(612)), (p(620), p(596)), (p(600), p(612))], fill=MOCHA)

sparkle(d, 760, 330, 82, ROSE)
sparkle(d, 300, 330, 40, LATTE)
sparkle(d, 838, 470, 28, LATTE)

# zoom in a little so the books fill the icon nicely
img = img.crop((p(102), p(140), p(922), p(960)))

out = Path(__file__).resolve().parent.parent / "icons"
out.mkdir(exist_ok=True)
for name, size in [
    ("icon-512.png", 512),
    ("icon-maskable-512.png", 512),
    ("icon-192.png", 192),
    ("apple-touch-icon.png", 180),
]:
    img.resize((size, size), Image.LANCZOS).save(out / name, optimize=True)
print("Icons saved in", out)
