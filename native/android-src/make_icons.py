#!/usr/bin/env python3
"""Put the Letschat "LA" logo on the Android app: launcher icons (normal, round and adaptive) and the start-up image.

Run it after `npx cap add android`:
    python3 make_icons.py <folder with icon-512.png and icon-maskable-512.png> <android res folder>
Example (from native/):
    python3 android-src/make_icons.py ../client/icons android/app/src/main/res

Needs Pillow (pip install pillow). It only writes new files or replaces the default Capacitor icon/splash images.
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

if len(sys.argv) != 3:
    sys.exit(__doc__)

src_dir, res_dir = sys.argv[1], sys.argv[2]
if not os.path.isdir(res_dir):
    sys.exit("Android res folder not found: %s (run `npx cap add android` first)" % res_dir)

icon = Image.open(os.path.join(src_dir, "icon-512.png")).convert("RGBA")
maskable = Image.open(os.path.join(src_dir, "icon-maskable-512.png")).convert("RGBA")

BG = maskable.getpixel((2, 2))[:3]
BG_HEX = "#%02X%02X%02X" % BG
print("Icon background colour", BG_HEX)

# launcher icon size (dp) x density scale; adaptive icon layers are 108 dp
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
written = []


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    written.append(path)


def smooth_mask(size, shape):
    """Anti-aliased mask: 'round' = circle, 'squircle' = rounded square."""
    big = size * 4
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)
    if shape == "round":
        d.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.2), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def masked(img, size, shape):
    img = img.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), smooth_mask(size, shape))
    return out


# Old phones (before Android 8) show these two as they are
for name, scale in DENSITIES.items():
    d = os.path.join(res_dir, "mipmap-" + name)
    size = int(round(48 * scale))
    for stale in glob.glob(os.path.join(d, "ic_launcher*.webp")):
        os.remove(stale)
    save(masked(icon, size, "squircle"), os.path.join(d, "ic_launcher.png"))
    save(masked(icon, size, "round"), os.path.join(d, "ic_launcher_round.png"))
    # adaptive icon foreground: the maskable logo already keeps its safe margin, so it fills the whole 108 dp layer
    fg = int(round(108 * scale))
    save(maskable.resize((fg, fg), Image.LANCZOS), os.path.join(d, "letschat_fg.png"))

# Android 8+ adaptive icon (the phone cuts it to a circle, squircle, etc.)
ADAPTIVE = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/letschat_icon_bg"/>
    <foreground android:drawable="@mipmap/letschat_fg"/>
</adaptive-icon>
"""
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    p = os.path.join(res_dir, "mipmap-anydpi-v26", name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(ADAPTIVE)
    written.append(p)

p = os.path.join(res_dir, "values", "letschat_colors.xml")
os.makedirs(os.path.dirname(p), exist_ok=True)
with open(p, "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="letschat_icon_bg">%s</color>\n</resources>\n' % BG_HEX)
written.append(p)

# Start-up image: replace Capacitor's default splash pictures, keeping each file's own size
splashes = sorted(glob.glob(os.path.join(res_dir, "drawable*", "splash.png")))
for path in splashes:
    with Image.open(path) as old:
        w, h = old.size
    canvas = Image.new("RGBA", (w, h), BG + (255,))
    logo = int(min(w, h) * 0.30)
    logo_img = icon.resize((logo, logo), Image.LANCZOS)
    canvas.paste(logo_img, ((w - logo) // 2, (h - logo) // 2), logo_img)
    save(canvas, path)
print("Start-up images replaced:", len(splashes))

print("Wrote %d files" % len(written))
