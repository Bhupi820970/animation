#!/usr/bin/env python3
"""Build a 30fps mouth-open envelope from a voice clip, for lip motion without a GPU model."""

from __future__ import annotations

import argparse
import json
import math
import struct
import subprocess
from pathlib import Path


def envelope(audio: Path, fps: int = 30) -> list[float]:
    raw = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(audio),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-f",
            "f32le",
            "pipe:1",
        ]
    )
    samples = struct.unpack("<" + "f" * (len(raw) // 4), raw)
    hop = 16000 / fps
    values = []
    i = 0.0
    n = len(samples)
    while i < n:
        start = int(i)
        end = min(n, int(i + hop))
        if end <= start:
            break
        acc = 0.0
        for s in samples[start:end]:
            acc += s * s
        rms = math.sqrt(acc / (end - start))
        values.append(rms)
        i += hop
    if not values:
        return [0.0]
    peak = max(values) or 1.0
    # Soft normalize and add a small floor so closed mouths stay closed.
    out = []
    for v in values:
        nrm = min(1.0, (v / peak) * 1.35)
        out.append(round(0.0 if nrm < 0.06 else nrm, 3))
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--fps", type=int, default=30)
    args = parser.parse_args()
    values = envelope(Path(args.audio), args.fps)
    Path(args.out).write_text(json.dumps(values), encoding="utf-8")
    print(f"Wrote mouth envelope {args.out} frames={len(values)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
