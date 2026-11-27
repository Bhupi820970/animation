#!/usr/bin/env python3
"""Make a YouTube thumbnail: dramatic still plus 3-4 hook words."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def cover(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize((int(image.width * scale), int(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def wrap_words(words: list[str]) -> list[str]:
    if len(words) <= 2:
        return [" ".join(words)]
    if len(words) == 3:
        return [" ".join(words[:1]), " ".join(words[1:])]
    return [" ".join(words[:2]), " ".join(words[2:])]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--words", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    words = [part.strip().upper() for part in args.words.replace(",", " ").split() if part.strip()]
    if not words:
        words = ["THE STORY"]

    canvas = cover(Image.open(args.image).convert("RGB"), 1280, 720)
    shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw_shade = ImageDraw.Draw(shade)
    for y in range(720):
        if y < 280:
            alpha = int(50 * (1 - y / 280))
        elif y > 360:
            alpha = int(200 * ((y - 360) / 360))
        else:
            alpha = 40
        draw_shade.line([(0, y), (1280, y)], fill=(0, 0, 0, alpha))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shade)
    draw = ImageDraw.Draw(canvas)

    font = load_font(108 if len(words) <= 3 else 96)
    lines = wrap_words(words)
    line_h = 118
    y = 720 - 70 - line_h * len(lines)
    cream = (245, 235, 214, 255)
    accent = (255, 210, 0, 255)
    gap = 22
    for index, line in enumerate(lines):
        parts = line.split()
        widths = [draw.textbbox((0, 0), part, font=font)[2] for part in parts]
        total = sum(widths) + gap * (len(parts) - 1)
        x = (1280 - total) // 2
        for word_index, part in enumerate(parts):
            color = accent if index == len(lines) - 1 and word_index == len(parts) - 1 else cream
            for dx, dy in ((5, 5), (0, 5), (5, 0), (-2, 3)):
                draw.text((x + dx, y + dy), part, font=font, fill=(0, 0, 0, 230))
            draw.text((x, y), part, font=font, fill=color)
            x += widths[word_index] + gap
        y += line_h

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(args.out, "PNG", optimize=True)
    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
