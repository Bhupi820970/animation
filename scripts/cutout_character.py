#!/usr/bin/env python3
"""Turn a character still into a reusable transparent paper-cutout puppet.

Tries, in order:
1. Keep an existing alpha channel if it already isolates the figure.
2. Chroma-key a lime-green (or other flat corner) backdrop.
3. Draw a consistent local paper puppet from a fixed palette and pose.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


def parse_color(value, default):
    if not value:
        return default
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        return tuple(int(value[i]) for i in range(3))
    text = str(value).strip().lstrip("#")
    if len(text) == 6:
        return tuple(int(text[i : i + 2], 16) for i in (0, 2, 4))
    return default


def load_palette(raw: str | None) -> dict:
    data = {}
    if raw:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
    return {
        "skin": parse_color(data.get("skin"), (210, 176, 150)),
        "hair": parse_color(data.get("hair"), (58, 46, 40)),
        "coat": parse_color(data.get("coat"), (164, 42, 38)),
        "pants": parse_color(data.get("pants"), (36, 40, 48)),
        "boots": parse_color(data.get("boots"), (22, 22, 24)),
        "accent": parse_color(data.get("accent"), (214, 186, 128)),
        "shirt": parse_color(data.get("shirt"), (80, 86, 92)),
    }


def is_green_screen(r, g, b) -> bool:
    # Bright lime / chroma green, or very green-dominant flat backdrop.
    if g > 90 and g > r * 1.25 and g > b * 1.25 and (g - r) > 28 and (g - b) > 28:
        return True
    if g > 170 and r < 140 and b < 140:
        return True
    return False


def corner_color(img: Image.Image) -> tuple[int, int, int]:
    px = img.load()
    w, h = img.size
    samples = [
        px[2, 2],
        px[w - 3, 2],
        px[2, h - 3],
        px[w - 3, h - 3],
        px[w // 2, 2],
        px[2, h // 2],
        px[w - 3, h // 2],
    ]
    # median-ish: pick the most common-ish by averaging corners
    rs, gs, bs = zip(*[(c[0], c[1], c[2]) for c in samples])
    return (sorted(rs)[len(rs) // 2], sorted(gs)[len(gs) // 2], sorted(bs)[len(bs) // 2])


def color_dist(a, b) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def chroma_cutout(src: Image.Image) -> Image.Image | None:
    rgb = src.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    corner = corner_color(rgb)
    use_green = is_green_screen(*corner)
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    removed = 0
    threshold = 42 if use_green else 28
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            drop = False
            if use_green and is_green_screen(r, g, b):
                drop = True
            elif color_dist((r, g, b), corner) < threshold:
                drop = True
            if drop:
                ap[x, y] = 0
                removed += 1
    ratio = removed / float(w * h)
    if ratio < 0.12 or ratio > 0.92:
        return None
    # Keep only the component that is not connected to the corners.
    alpha = flood_clear_edges(alpha)
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    rgba = despill(rgba)
    rgba = rgba.filter(ImageFilter.MedianFilter(size=3))
    # Feather
    a = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(1.4))
    rgba.putalpha(a)
    bbox = a.getbbox()
    if not bbox:
        return None
    # Trim empty margins but keep a little padding
    pad = 8
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(w, right + pad)
    bottom = min(h, bottom + pad)
    return rgba.crop((left, top, right, bottom))


def flood_clear_edges(alpha: Image.Image) -> Image.Image:
    """Make sure backdrop connected to the border is fully transparent."""
    w, h = alpha.size
    ap = alpha.load()
    seen = set()
    stack = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or x < 0 or y < 0 or x >= w or y >= h:
            continue
        seen.add((x, y))
        if ap[x, y] > 80:
            continue
        ap[x, y] = 0
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return alpha


def despill(img: Image.Image) -> Image.Image:
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if g > r + 8 and g > b + 6:
                g2 = min(g, int((r + b) * 0.5) + 4)
                px[x, y] = (r, max(0, min(255, g2)), b, a)
    return img


def defringe(img: Image.Image, shrink=3) -> Image.Image:
    """Eat the lime halo left by chroma key, then feather the edge."""
    out = despill(img.convert("RGBA"))
    alpha = out.getchannel("A")
    for _ in range(max(1, shrink)):
        alpha = alpha.filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7))
    out.putalpha(alpha)
    return despill(out)


def row_occupancy(alpha: Image.Image) -> list[int]:
    w, h = alpha.size
    px = alpha.load()
    rows = []
    for y in range(h):
        rows.append(sum(1 for x in range(w) if px[x, y] > 40))
    return rows


def derive_back(front: Image.Image, palette: dict) -> Image.Image:
    """Build a back view from the same front sheet so clothes stay identical."""
    img = front.convert("RGBA").copy()
    w, h = img.size
    alpha = img.getchannel("A")
    bbox = alpha.getbbox() or (0, 0, w, h)
    x0, y0, x1, y1 = bbox
    fh = max(1, y1 - y0)
    head_bottom = y0 + int(fh * 0.28)
    # Sample hair from the top of the head.
    hair = palette.get("hair", (40, 32, 28))
    px = img.load()
    ap = alpha.load()
    samples = []
    for y in range(y0, min(y0 + max(8, fh // 12), h)):
        for x in range(x0, x1, 3):
            if ap[x, y] > 180:
                r, g, b, _a = px[x, y]
                samples.append((r, g, b))
    if samples:
        samples.sort()
        hair = samples[len(samples) // 2]
    face_top = y0 + int(fh * 0.08)
    face_left = x0 + int((x1 - x0) * 0.22)
    face_right = x0 + int((x1 - x0) * 0.78)
    draw = ImageDraw.Draw(img)
    draw.ellipse((face_left, face_top, face_right, head_bottom), fill=(*hair, 255))
    shade = Image.new("RGBA", img.size, (0, 0, 0, 48))
    img = Image.alpha_composite(img, Image.composite(shade, Image.new("RGBA", img.size, (0, 0, 0, 0)), alpha))
    img.putalpha(alpha)
    return img


def build_rig(full: Image.Image, dest_prefix: Path) -> dict:
    """Split a standing puppet into head / torso / legs for a 2D cutout rig."""
    img = full.convert("RGBA")
    w, h = img.size
    alpha = img.getchannel("A")
    bbox = alpha.getbbox() or (0, 0, w, h)
    x0, y0, x1, y1 = bbox
    fh = max(1, y1 - y0)
    fw = max(1, x1 - x0)
    cx = (x0 + x1) // 2
    neck_y = y0 + int(fh * 0.24)
    hip_y = y0 + int(fh * 0.58)
    overlap = max(12, fh // 40)

    def layer_box(box):
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        crop = img.crop(box)
        layer.paste(crop, (box[0], box[1]))
        # Keep only the original alpha inside the box
        mask = Image.new("L", (w, h), 0)
        mask.paste(alpha.crop(box), (box[0], box[1]))
        layer.putalpha(mask)
        return layer

    head = layer_box((0, 0, w, min(h, neck_y + overlap)))
    torso = layer_box((0, max(0, neck_y - overlap), w, min(h, hip_y + overlap)))
    left_leg = layer_box((0, max(0, hip_y - overlap), cx + overlap, h))
    right_leg = layer_box((cx - overlap, max(0, hip_y - overlap), w, h))

    files = {}
    for name, layer in (
        ("head", head),
        ("torso", torso),
        ("left_leg", left_leg),
        ("right_leg", right_leg),
    ):
        path = Path(str(dest_prefix) + f"_{name}.png")
        layer.save(path, "PNG")
        files[name] = path.name

    rig = {
        "width": w,
        "height": h,
        "neckY": round(neck_y / h, 4),
        "hipY": round(hip_y / h, 4),
        "centerX": round(cx / w, 4),
        "mouthY": round((y0 + int(fh * 0.20)) / h, 4),
        "eyeY": round((y0 + int(fh * 0.12)) / h, 4),
        "files": files,
    }
    Path(str(dest_prefix) + "_rig.json").write_text(json.dumps(rig, indent=2), encoding="utf-8")
    return rig


def alpha_usable(img: Image.Image) -> bool:
    if img.mode != "RGBA":
        return False
    alpha = img.getchannel("A")
    # histogram: count near-transparent vs opaque
    hist = alpha.histogram()
    clear = sum(hist[:16])
    solid = sum(hist[200:])
    total = img.size[0] * img.size[1]
    if total == 0:
        return False
    return clear / total >= 0.12 and solid / total >= 0.06


def paper_texture(layer: Image.Image, shade=12) -> Image.Image:
    import random

    rng = random.Random(7)
    fiber = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fiber)
    w, h = layer.size
    for _ in range(max(80, w * h // 220)):
        x = rng.randint(0, w - 1)
        y = rng.randint(0, h - 1)
        d = rng.randint(-shade, shade)
        fd.point((x, y), fill=(max(0, 128 + d), max(0, 128 + d), max(0, 128 + d), 40))
    out = Image.alpha_composite(layer, fiber)
    # Do not leave fiber specks in the transparent area.
    out.putalpha(layer.getchannel("A"))
    return out


def jagged_ellipse(draw, box, fill, jagged=7):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = (x1 - x0) / 2, (y1 - y0) / 2
    pts = []
    for i in range(28):
        ang = (i / 28) * 2 * math.pi
        jitter = 1 + ((i * 3) % 5 - 2) * 0.012
        pts.append((cx + math.cos(ang) * rx * jitter, cy + math.sin(ang) * ry * jitter))
    draw.polygon(pts, fill=fill)


def draw_local_puppet(pose: str, palette: dict, size=(768, 1152)) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Geometry is fixed so the same character is identical every time.
    back = pose == "back"
    front = pose == "front"
    lean = 0 if front or back else -36

    boots = palette["boots"]
    pants = palette["pants"]
    coat = palette["coat"]
    shirt = palette["shirt"]
    skin = palette["skin"]
    hair = palette["hair"]
    accent = palette["accent"]

    # Feet / legs
    left_leg = (330 + lean, 760, 400 + lean, 1040)
    right_leg = (400 + lean, 760, 470 + lean, 1040)
    draw.rounded_rectangle(left_leg, radius=18, fill=pants)
    draw.rounded_rectangle(right_leg, radius=18, fill=pants)
    draw.rounded_rectangle((320 + lean, 1000, 408 + lean, 1088), radius=14, fill=boots)
    draw.rounded_rectangle((400 + lean, 1000, 488 + lean, 1088), radius=14, fill=boots)

    # Torso / coat
    body = (250 + lean, 420, 530 + lean, 820)
    draw.rounded_rectangle(body, radius=48, fill=coat)
    if not back:
        # shirt opening
        draw.rounded_rectangle((360 + lean, 450, 420 + lean, 700), radius=10, fill=shirt)
        # zipper / accent
        draw.rectangle((386 + lean, 460, 394 + lean, 690), fill=accent)

    # Arms
    if back:
        draw.rounded_rectangle((220 + lean, 460, 290 + lean, 820), radius=28, fill=coat)
        draw.rounded_rectangle((490 + lean, 460, 560 + lean, 820), radius=28, fill=coat)
    elif front:
        draw.rounded_rectangle((200 + lean, 470, 280 + lean, 840), radius=28, fill=coat)
        draw.rounded_rectangle((500 + lean, 470, 580 + lean, 840), radius=28, fill=coat)
        jagged_ellipse(draw, (200 + lean, 800, 280 + lean, 880), skin)
        jagged_ellipse(draw, (500 + lean, 800, 580 + lean, 880), skin)
    else:
        draw.rounded_rectangle((170 + lean, 480, 260 + lean, 860), radius=28, fill=coat)
        draw.rounded_rectangle((500 + lean, 450, 575 + lean, 780), radius=28, fill=coat)
        jagged_ellipse(draw, (168 + lean, 830, 258 + lean, 910), skin)

    # Head
    hx0, hy0, hx1, hy1 = 300 + lean, 170, 480 + lean, 390
    jagged_ellipse(draw, (hx0, hy0, hx1, hy1), skin)

    # Hair
    if back:
        jagged_ellipse(draw, (292 + lean, 150, 488 + lean, 330), hair)
        draw.rounded_rectangle((292 + lean, 250, 488 + lean, 360), radius=20, fill=hair)
    else:
        jagged_ellipse(draw, (292 + lean, 140, 490 + lean, 260), hair)
        # short sides
        draw.rounded_rectangle((292 + lean, 200, 322 + lean, 330), radius=12, fill=hair)
        draw.rounded_rectangle((458 + lean, 200, 492 + lean, 330), radius=12, fill=hair)

    if not back:
        # simple calm face: eyes and a small mouth, same every time
        eye = (36, 28, 32)
        draw.ellipse((340 + lean, 250, 372 + lean, 274), fill=eye)
        draw.ellipse((408 + lean, 250, 440 + lean, 274), fill=eye)
        draw.ellipse((348 + lean, 256, 360 + lean, 268), fill=(230, 230, 230))
        draw.ellipse((416 + lean, 256, 428 + lean, 268), fill=(230, 230, 230))
        draw.arc((356 + lean, 300, 424 + lean, 338), start=20, end=160, fill=(120, 70, 70), width=3)

    # Hood / collar
    draw.rounded_rectangle((280 + lean, 360, 500 + lean, 455), radius=30, fill=coat)
    if not back:
        draw.arc((300 + lean, 340, 480 + lean, 470), start=200, end=340, fill=accent, width=8)

    img = paper_texture(img)
    # Drop a tiny self-shadow baked under feet? skip, Remotion adds shadow.
    bbox = img.getchannel("A").getbbox()
    if bbox:
        pad = 10
        box = (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(w, bbox[2] + pad),
            min(h, bbox[3] + pad),
        )
        img = img.crop(box)
    return img


def make_silhouette(img: Image.Image) -> Image.Image:
    sil = Image.new("RGBA", img.size, (0, 0, 0, 0))
    mask = img.getchannel("A")
    sil.paste((12, 12, 16, 255), mask=mask)
    return sil


def process(src_path: Path | None, out_path: Path, pose: str, palette: dict, silhouette: bool) -> tuple[str, Image.Image]:
    cut = None
    source = "local"
    if src_path and src_path.exists() and src_path.stat().st_size > 1000:
        try:
            src = Image.open(src_path)
            src.load()
            if alpha_usable(src.convert("RGBA")):
                cut = src.convert("RGBA")
                a = cut.getchannel("A")
                bbox = a.getbbox()
                if bbox:
                    cut = cut.crop(bbox)
                source = "alpha"
            else:
                cut = chroma_cutout(src)
                if cut is not None:
                    source = "chroma"
        except Exception:
            cut = None
    if cut is None:
        cut = draw_local_puppet(pose, palette)
        source = "local"
    if not silhouette:
        cut = defringe(cut, shrink=3)
    if silhouette:
        cut = make_silhouette(cut)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Normalize height so Remotion scaling is predictable
    target_h = 1400
    if cut.size[1] != target_h:
        ratio = target_h / cut.size[1]
        cut = cut.resize((max(1, int(cut.size[0] * ratio)), target_h), Image.Resampling.LANCZOS)
    cut.save(out_path, "PNG")
    return source, cut


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="src", default="")
    parser.add_argument("--out", required=True)
    parser.add_argument("--pose", default="three_quarter")
    parser.add_argument("--palette", default="")
    parser.add_argument("--silhouette", action="store_true")
    parser.add_argument("--derive-views", action="store_true")
    parser.add_argument("--rig", action="store_true")
    args = parser.parse_args()
    palette = load_palette(args.palette or None)
    src = Path(args.src) if args.src else None
    out = Path(args.out)
    source, cut = process(src, out, args.pose, palette, args.silhouette)
    print(f"Wrote cutout {out} source={source}")
    if not out.exists() or out.stat().st_size < 2000:
        raise SystemExit("cutout did not write a usable PNG")
    if args.derive_views and not args.silhouette:
        if out.name.endswith("_three_quarter.png"):
            back_path = out.with_name(out.name.replace("_three_quarter.png", "_back.png"))
            sil_path = out.with_name(out.name.replace("_three_quarter.png", "_silhouette.png"))
        else:
            back_path = out.with_name(out.stem + "_back.png")
            sil_path = out.with_name(out.stem + "_silhouette.png")
        derive_back(cut, palette).save(back_path, "PNG")
        print(f"Wrote derived back {back_path}")
        make_silhouette(cut).save(sil_path, "PNG")
        print(f"Wrote silhouette {sil_path}")
    if args.rig and not args.silhouette:
        if out.name.endswith("_three_quarter.png"):
            prefix = out.with_name(out.name.replace("_three_quarter.png", ""))
        else:
            prefix = out.with_suffix("")
        rig = build_rig(cut, prefix)
        print(f"Wrote rig {prefix}_rig.json layers={list(rig['files'].values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
