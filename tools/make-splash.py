"""Makes the start-up (splash) screens the iPhone shows while the app opens,
in light and dark, for each iPhone screen size, and prints the <link> tags for index.html.
Run from the project folder:  python3 tools/make-splash.py
"""
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("icons", HERE / "make-icons.py")
icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icons)

OUT = HERE.parent / "icons" / "splash"
FONT = "/System/Library/Fonts/Supplemental/Georgia.ttf"

THEMES = {
    "light": {"bg": "#F5EFE6", "text": "#8B6B4E"},
    "dark": {"bg": "#2A1F18", "text": "#CDAE90"},
}

# iPhone screens in portrait: (css width, css height, pixel ratio)
SCREENS = [
    (440, 956, 3),  # 16 Pro Max, 17 Pro Max
    (430, 932, 3),  # 14 Pro Max, 15 Plus/Pro Max, 16 Plus
    (428, 926, 3),  # 12/13 Pro Max, 14 Plus
    (420, 912, 3),  # Air
    (414, 896, 3),  # XS Max, 11 Pro Max
    (414, 896, 2),  # XR, 11
    (402, 874, 3),  # 16 Pro, 17, 17 Pro
    (393, 852, 3),  # 14 Pro, 15, 15 Pro, 16
    (390, 844, 3),  # 12, 13, 14, 16e
    (375, 812, 3),  # X, XS, 11 Pro, 12/13 mini
    (375, 667, 2),  # SE (2nd/3rd), 8
]

OUT.mkdir(parents=True, exist_ok=True)
links = []
for theme, colors in THEMES.items():
    art = icons.draw_art(colors["bg"])
    for w, h, r in SCREENS:
        W, H = w * r, h * r
        img = Image.new("RGB", (W, H), colors["bg"])
        size = int(W * 0.46)
        img.paste(art.resize((size, size), Image.LANCZOS), ((W - size) // 2, int(H * 0.40 - size / 2)))
        font = ImageFont.truetype(FONT, int(W * 0.075))
        d = ImageDraw.Draw(img)
        d.text((W / 2, H * 0.40 + size / 2 + W * 0.02), "Boekenhoekje", font=font, fill=colors["text"], anchor="mt")
        name = f"splash-{W}x{H}-{theme}.png"
        img.save(OUT / name, optimize=True)
        links.append(
            f'  <link rel="apple-touch-startup-image" href="icons/splash/{name}" '
            f'media="(device-width: {w}px) and (device-height: {h}px) and (-webkit-device-pixel-ratio: {r}) '
            f'and (orientation: portrait) and (prefers-color-scheme: {theme})">'
        )

print("\n".join(links))
