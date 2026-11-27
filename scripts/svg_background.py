#!/usr/bin/env python3
"""Rasterize a paper-style SVG-like backdrop when Flux/Gemini are unavailable."""

from __future__ import annotations

import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance


PALETTES = {
    "city": [(231, 220, 198), (196, 179, 148), (168, 146, 110), (143, 131, 108)],
    "shop": [(42, 28, 22), (90, 60, 40), (106, 74, 48), (224, 180, 90)],
    "water": [(26, 36, 48), (28, 48, 64), (36, 56, 72), (201, 168, 74)],
    "space": [(7, 8, 20), (16, 20, 38), (138, 145, 152), (92, 200, 216)],
    "office": [(216, 216, 212), (168, 168, 162), (154, 160, 166), (182, 224, 138)],
    "village": [(216, 224, 230), (138, 154, 122), (160, 144, 128), (243, 237, 227)],
    "desert": [(232, 216, 184), (200, 184, 122), (184, 152, 96), (232, 216, 176)],
    "night": [(26, 20, 32), (58, 42, 64), (36, 28, 40), (192, 57, 43)],
}


def kind_from_prompt(text: str) -> str:
    v = (text or "").lower()
    if any(w in v for w in ("space", "hull", "station", "orbit", "eva")):
        return "space"
    if any(w in v for w in ("office", "hold music", "headset", "fluorescent")):
        return "office"
    if any(w in v for w in ("gulf", "marsh", "flood", "river", "water", "boat")):
        return "water"
    if any(w in v for w in ("shop", "clock", "candle", "victorian")):
        return "shop"
    if any(w in v for w in ("village", "wedding", "grave", "pine")):
        return "village"
    if any(w in v for w in ("desert", "expedition", "railway", "parchment")):
        return "desert"
    if any(w in v for w in ("racetrack", "neon", "betting", "cigarette")):
        return "night"
    return "city"


def paperize_layers(img: Image.Image, rng: random.Random) -> Image.Image:
    img = img.filter(ImageFilter.MedianFilter(size=3))
    img = ImageEnhance.Contrast(img).enhance(1.06)
    fiber = Image.new("RGB", img.size)
    pix = fiber.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            d = rng.randint(-10, 10)
            pix[x, y] = (128 + d, 124 + d, 116 + d)
    return Image.blend(img, fiber, 0.07)


def render(dest: Path, seed: int, prompt: str) -> None:
    rng = random.Random(seed)
    kind = kind_from_prompt(prompt)
    sky, far, mid, accent = PALETTES[kind]
    img = Image.new("RGB", (1920, 1080), sky)
    draw = ImageDraw.Draw(img)

    def hill(y0: int, color, jitter: int) -> None:
        pts = [(0, 1080)]
        x = 0
        y = y0
        while x <= 1920:
            y = y0 + rng.randint(-jitter, jitter)
            pts.append((x, y))
            x += 80
        pts.append((1920, 1080))
        draw.polygon(pts, fill=color)

    hill(430, far, 40)
    hill(540, mid, 36)
    draw.polygon([(0, 760), (1920, 730), (1920, 1080), (0, 1080)], fill=tuple(max(0, c - 20) for c in mid))

    def building(x: int, top: int, w: int, h: int) -> None:
        color = tuple(max(0, min(255, c + rng.randint(-12, 12))) for c in mid)
        dark = tuple(max(0, c - 28) for c in color)
        draw.polygon([(x, top + h), (x, top + 30), (x + 30, top), (x + w, top), (x + w + 20, top + 40), (x + w + 20, top + h)], fill=color)
        draw.polygon([(x, top + 30), (x + 30, top), (x + 30, top + h), (x, top + h)], fill=dark)
        for r, c in ((0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (2, 1)):
            wx = x + 40 + c * 58
            wy = top + 50 + r * 80
            if wy + 40 < top + h - 20:
                draw.rectangle([wx, wy, wx + 36, wy + 46], fill=accent if (r + c + seed) % 3 == 0 else tuple(min(255, a + 40) for a in far))

    building(80, 360, 240, 500)
    building(1460, 300, 280, 560)
    # torn bottom edge
    edge = [(0, 1040)]
    x = 0
    while x <= 1920:
        edge.append((x, 1030 + rng.randint(-18, 18)))
        x += 70
    edge += [(1920, 1080), (0, 1080)]
    draw.polygon(edge, fill=(40, 32, 24))

    img = paperize_layers(img, rng)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=92)
    print(f"Wrote SVG-style paper backdrop {dest} kind={kind}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--prompt", default="")
    args = parser.parse_args()
    render(Path(args.out), args.seed, args.prompt)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
