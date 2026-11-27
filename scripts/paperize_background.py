#!/usr/bin/env python3
"""Push a generated background toward a locked paper-cutout look."""

from __future__ import annotations

import argparse
import random
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


def paperize(src: Path, dest: Path, seed: int = 1) -> None:
    img = Image.open(src).convert("RGB")
    img = img.resize((1920, 1080), Image.Resampling.LANCZOS)
    # Flatten photoreal lighting into stacked paper planes.
    img = ImageOps.posterize(img, 6)
    img = img.filter(ImageFilter.MedianFilter(size=3))
    img = ImageEnhance.Color(img).enhance(0.92)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Sharpness(img).enhance(1.15)
    # Paper fiber
    rng = random.Random(seed)
    fiber = Image.new("RGB", img.size)
    fp = fiber.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            d = rng.randint(-10, 10)
            fp[x, y] = (128 + d, 124 + d, 116 + d)
    img = Image.blend(img, fiber, 0.07)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=92)
    print(f"Wrote paperized background {dest}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="src", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args()
    paperize(Path(args.src), Path(args.out), args.seed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
