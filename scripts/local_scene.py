#!/usr/bin/env python3
"""Draw a layered paper-cutout still when an image API is unavailable."""

from __future__ import annotations

import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


WIDTH, HEIGHT = 1920, 1080

PALETTES = {
    "ocean": ((8, 16, 32), (16, 40, 62), (28, 78, 96), (186, 198, 176), (236, 214, 140)),
    "interior": ((16, 10, 8), (58, 32, 20), (118, 70, 36), (204, 160, 96), (246, 214, 154)),
    "fog": ((10, 12, 16), (32, 38, 48), (86, 90, 100), (168, 174, 180), (228, 214, 150)),
    "default": ((12, 10, 16), (38, 26, 44), (90, 56, 68), (176, 146, 126), (228, 208, 166)),
}


def pick_kind(prompt: str) -> str:
    text = prompt.lower()
    if any(word in text for word in ("door", "desk", "coffee", "interior", "wooden", "room")):
        return "interior"
    if any(word in text for word in ("fog", "lantern", "silhouette", "mist")):
        return "fog"
    if any(word in text for word in ("ocean", "sea", "lighthouse", "storm", "wave", "cliff")):
        return "ocean"
    return "default"


def paper_sheet(size, color, rng, jagged=10):
    w, h = size
    pad = 16
    points = []
    # walk around the rectangle with small jagged offsets
    for x in range(pad, w - pad, max(8, w // jagged)):
        points.append((x, pad + rng.randint(-7, 7)))
    for y in range(pad, h - pad, max(8, h // jagged)):
        points.append((w - pad + rng.randint(-7, 7), y))
    for x in range(w - pad, pad, -max(8, w // jagged)):
        points.append((x, h - pad + rng.randint(-7, 7)))
    for y in range(h - pad, pad, -max(8, h // jagged)):
        points.append((pad + rng.randint(-7, 7), y))
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.polygon(points, fill=(*color, 255))
    # subtle fiber
    fiber = Image.new("RGBA", size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fiber)
    for _ in range(int(w * h / 280)):
        x = rng.randint(0, w - 1)
        y = rng.randint(0, h - 1)
        shade = rng.randint(-14, 14)
        fd.point(
            (x, y),
            fill=(
                max(0, min(255, color[0] + shade)),
                max(0, min(255, color[1] + shade)),
                max(0, min(255, color[2] + shade)),
                50,
            ),
        )
    layer = Image.alpha_composite(layer, fiber)
    return layer.filter(ImageFilter.SMOOTH)


def paste_rotated(base, layer, xy, angle, shadow=True):
    rotated = layer.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    if shadow:
        shade = Image.new("RGBA", rotated.size, (0, 0, 0, 0))
        mask = rotated.split()[-1]
        shade.paste((0, 0, 0, 90), mask=mask)
        shade = shade.filter(ImageFilter.GaussianBlur(8))
        base.alpha_composite(shade, (xy[0] + 10, xy[1] + 14))
    base.alpha_composite(rotated, xy)


def add_glow(base, box, color, blur=36, alpha=70):
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(box, fill=(*color, alpha))
    base.alpha_composite(glow.filter(ImageFilter.GaussianBlur(blur)))


def draw_ocean(canvas, palette, rng):
    for i, y in enumerate((560, 680, 800, 920)):
        water = paper_sheet((2300, 260), palette[min(2, 1 + (i % 2))], rng, 14)
        paste_rotated(canvas, water, (-160, y), rng.uniform(-4, 4))
    rocks = paper_sheet((780, 240), palette[1], rng, 12)
    paste_rotated(canvas, rocks, (680, 820), rng.uniform(-5, 3))
    tower = paper_sheet((170, 560), palette[3], rng, 8)
    paste_rotated(canvas, tower, (1000, 250), rng.uniform(-1.5, 1.5))
    cap = paper_sheet((240, 120), palette[4], rng, 6)
    paste_rotated(canvas, cap, (966, 210), 0)
    add_glow(canvas, (820, 80, 1360, 560), palette[4], blur=48, alpha=80)
    # light beam
    beam = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    ImageDraw.Draw(beam).polygon([(1090, 280), (1700, 700), (1900, 700), (1150, 280)], fill=(*palette[4], 28))
    canvas.alpha_composite(beam.filter(ImageFilter.GaussianBlur(12)))


def draw_interior(canvas, palette, rng):
    wall = paper_sheet((1700, 960), palette[1], rng, 10)
    paste_rotated(canvas, wall, (110, 50), rng.uniform(-0.8, 0.8))
    window = paper_sheet((340, 280), palette[4], rng, 5)
    paste_rotated(canvas, window, (400, 180), 0)
    add_glow(canvas, (360, 140, 780, 500), palette[4], blur=30, alpha=60)
    door = paper_sheet((300, 680), palette[2], rng, 7)
    paste_rotated(canvas, door, (1300, 250), 0)
    bar = paper_sheet((40, 80), palette[4], rng, 3)
    paste_rotated(canvas, bar, (1520, 560), 0)
    desk = paper_sheet((680, 180), palette[2], rng, 8)
    paste_rotated(canvas, desk, (300, 760), rng.uniform(-2, 2))
    mug = paper_sheet((100, 100), palette[4], rng, 4)
    paste_rotated(canvas, mug, (500, 700), 6)
    steam = paper_sheet((40, 90), palette[3], rng, 4)
    steam.putalpha(80)
    paste_rotated(canvas, steam, (530, 620), -8, shadow=False)


def draw_fog(canvas, palette, rng):
    ground = paper_sheet((2200, 400), palette[1], rng, 12)
    paste_rotated(canvas, ground, (-80, 760), rng.uniform(-2, 2))
    body = paper_sheet((150, 340), (16, 16, 20), rng, 7)
    paste_rotated(canvas, body, (860, 500), rng.uniform(-3, 3))
    head = paper_sheet((130, 130), (16, 16, 20), rng, 4)
    paste_rotated(canvas, head, (870, 410), 0)
    lantern = paper_sheet((80, 100), palette[4], rng, 3)
    paste_rotated(canvas, lantern, (1040, 610), 10)
    add_glow(canvas, (960, 540, 1220, 800), palette[4], blur=32, alpha=90)
    for i in range(6):
        strip = paper_sheet((1000, 90), palette[3], rng, 16)
        fade = strip.copy()
        fade.putalpha(60)
        paste_rotated(canvas, fade, (rng.randint(-60, 700), 360 + i * 80), rng.uniform(-8, 8), shadow=False)


def draw_generic(canvas, palette, rng):
    for i, size in enumerate(((1500, 520), (1180, 380), (860, 250))):
        layer = paper_sheet(size, palette[min(i + 1, 3)], rng, 12)
        paste_rotated(canvas, layer, (140 + i * 90, 260 + i * 150), rng.uniform(-5, 5))


def add_vignette(canvas):
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx, cy = WIDTH / 2, HEIGHT / 2
    for radius, alpha in ((700, 0), (860, 30), (1040, 80), (1220, 130)):
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=(0, 0, 0, alpha), width=40)
    edge = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rectangle((0, 0, WIDTH, HEIGHT), outline=(0, 0, 0, 180), width=90)
    canvas.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(28)))
    canvas.alpha_composite(edge.filter(ImageFilter.GaussianBlur(40)))
    return canvas


def render(prompt: str, out_path: Path, seed: int) -> None:
    rng = random.Random(seed)
    kind = pick_kind(prompt)
    palette = PALETTES.get(kind, PALETTES["default"])
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (*palette[0], 255))
    backdrop = paper_sheet((2200, 1000), palette[1], rng, 12)
    paste_rotated(canvas, backdrop, (-120, -80), rng.uniform(-2, 2))

    if kind == "ocean":
        draw_ocean(canvas, palette, rng)
    elif kind == "interior":
        draw_interior(canvas, palette, rng)
    elif kind == "fog":
        draw_fog(canvas, palette, rng)
    else:
        draw_generic(canvas, palette, rng)

    canvas = add_vignette(canvas)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out_path, format="JPEG", quality=92)
    print(f"Wrote local paper-cutout scene ({kind}) to {out_path}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args()
    render(args.prompt, Path(args.out), args.seed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
