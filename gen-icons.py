#!/usr/bin/env python3
"""Generate placeholder icons for Cluely Hidden.
Run:  python3 gen-icons.py
Produces: src-tauri/icons/{tray-icon,32x32,128x128,128x128@2x,icon}.png
          src-tauri/icons/{icon.icns,icon.ico}
"""
import os
import struct
import zlib

ICONS_DIR = os.path.join(os.path.dirname(__file__), "src-tauri", "icons")
os.makedirs(ICONS_DIR, exist_ok=True)


def make_png(width, height, pixels):
    """Build a 32-bit RGBA PNG. pixels is a flat list of (r,g,b,a)."""
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw = b""
    for y in range(height):
        raw += b"\x00"  # filter
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw += struct.pack("BBBB", r, g, b, a)
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def make_c_icon(size):
    """White 'C' on transparent background. Works as macOS template icon."""
    px = [(0, 0, 0, 0)] * (size * size)
    cx = (size - 1) / 2
    cy = (size - 1) / 2
    r_outer = size * 0.45
    r_inner = size * 0.30
    notch_top = int(cy - size * 0.10)
    notch_bot = int(cy + size * 0.10)
    notch_x = int(cx + size * 0.10)
    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            r = (dx * dx + dy * dy) ** 0.5
            if r_inner < r <= r_outer:
                if x > notch_x and notch_top <= y <= notch_bot:
                    px[y * size + x] = (0, 0, 0, 0)
                else:
                    px[y * size + x] = (255, 255, 255, 255)
    return px


# PNG variants
for name, size in [
    ("tray-icon.png", 16),
    ("32x32.png", 32),
    ("128x128.png", 128),
    ("128x128@2x.png", 256),
    ("icon.png", 256),
]:
    png_bytes = make_png(size, size, make_c_icon(size))
    with open(os.path.join(ICONS_DIR, name), "wb") as f:
        f.write(png_bytes)
    print(f"  {name}: {len(png_bytes)} bytes")

# icon.icns (macOS) — wraps the 256x256 PNG in ic08 chunk
png_256 = make_png(256, 256, make_c_icon(256))
icns_body = b"ic08" + struct.pack(">I", 8 + len(png_256)) + png_256
icns_full = b"icns" + struct.pack(">I", 8 + len(icns_body)) + icns_body
with open(os.path.join(ICONS_DIR, "icon.icns"), "wb") as f:
    f.write(icns_full)
print(f"  icon.icns: {len(icns_full)} bytes")

# icon.ico (Windows) — Tauri only needs it on Windows builds
ico_header = struct.pack("<HHH", 0, 1, 1)
ico_entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png_256), 22)
ico_full = ico_header + ico_entry + png_256
with open(os.path.join(ICONS_DIR, "icon.ico"), "wb") as f:
    f.write(ico_full)
print(f"  icon.ico: {len(ico_full)} bytes")

print("\nDone. Icons written to:", ICONS_DIR)
