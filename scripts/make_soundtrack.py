#!/usr/bin/env python3
"""Create an original CC0 cinematic bed, transition effects, and film grain."""

from __future__ import annotations

import argparse
import math
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path


RATE = 44100


def write_wav(path: Path, samples: list[float], rate: int = RATE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as fh:
        fh.setnchannels(1)
        fh.setsampwidth(2)
        fh.setframerate(rate)
        frames = bytearray()
        for sample in samples:
            clipped = max(-0.99, min(0.99, sample))
            frames += struct.pack("<h", int(clipped * 32767))
        fh.writeframes(frames)


def to_mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(wav_path), "-b:a", "192k", str(mp3_path)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def make_bed(seconds: float, seed: int) -> list[float]:
    rng = random.Random(seed)
    n = int(seconds * RATE)
    samples = [0.0] * n
    # Slow moving drones
    freqs = [49.0, 73.5, 98.0, 147.0]
    for freq in freqs:
        phase = rng.random() * math.tau
        lfo = 0.04 + rng.random() * 0.05
        lfo_phase = rng.random() * math.tau
        amp = 0.09 if freq < 80 else 0.05
        for i in range(n):
            t = i / RATE
            trem = 0.55 + 0.45 * math.sin(math.tau * lfo * t + lfo_phase)
            samples[i] += math.sin(math.tau * freq * t + phase) * amp * trem

    # Brown-ish noise, heavily rolled off
    brown = 0.0
    for i in range(n):
        brown += (rng.random() * 2 - 1) * 0.02
        brown *= 0.97
        # gentle wave-like swell
        swell = 0.5 + 0.5 * math.sin(math.tau * (0.03) * (i / RATE))
        samples[i] += brown * 0.35 * swell

    # Fade in/out
    fade = int(2.5 * RATE)
    for i in range(fade):
        samples[i] *= i / fade
        samples[n - 1 - i] *= i / fade
    return samples


def make_whoosh(duration: float = 0.55) -> list[float]:
    rng = random.Random(7)
    n = int(duration * RATE)
    samples = [0.0] * n
    for i in range(n):
        t = i / n
        env = math.sin(math.pi * t) ** 1.4
        noise = rng.random() * 2 - 1
        # rising brightness
        tone = math.sin(math.tau * lerp(180, 900, t) * (i / RATE))
        samples[i] = (noise * 0.55 + tone * 0.2) * env * 0.5
    return samples


def make_boom(duration: float = 0.9) -> list[float]:
    n = int(duration * RATE)
    samples = [0.0] * n
    for i in range(n):
        t = i / RATE
        env = math.exp(-3.2 * t)
        samples[i] = math.sin(math.tau * 52 * t) * env * 0.7
        samples[i] += math.sin(math.tau * 78 * t) * env * 0.25
    return samples


def make_paper(duration: float = 0.35) -> list[float]:
    rng = random.Random(21)
    n = int(duration * RATE)
    samples = [0.0] * n
    for i in range(n):
        t = i / n
        env = math.sin(math.pi * t) * (0.4 + 0.6 * rng.random())
        samples[i] = (rng.random() * 2 - 1) * env * 0.22
    return samples


def loop_to_length(samples: list[float], seconds: float) -> list[float]:
    needed = int(seconds * RATE)
    out = []
    while len(out) < needed:
        out.extend(samples)
    return out[:needed]


def make_grain(path: Path, width: int = 1920, height: int = 1080) -> None:
    from PIL import Image
    import random as rnd

    rng = rnd.Random(99)
    img = Image.new("L", (width, height))
    pix = img.load()
    for y in range(height):
        for x in range(width):
            pix[x, y] = rng.randint(90, 165)
    img.convert("RGB").save(path, quality=85)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="public")
    parser.add_argument("--seconds", type=float, default=300)
    parser.add_argument("--seed", type=int, default=11)
    args = parser.parse_args()
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        bed = loop_to_length(make_bed(90, args.seed), args.seconds)
        bed_wav = tmp_path / "bed.wav"
        write_wav(bed_wav, bed)
        to_mp3(bed_wav, out / "music.mp3")

        whoosh_wav = tmp_path / "whoosh.wav"
        write_wav(whoosh_wav, make_whoosh())
        to_mp3(whoosh_wav, out / "sfx_whoosh.mp3")

        boom_wav = tmp_path / "boom.wav"
        write_wav(boom_wav, make_boom())
        to_mp3(boom_wav, out / "sfx_boom.mp3")

        paper_wav = tmp_path / "paper.wav"
        write_wav(paper_wav, make_paper())
        to_mp3(paper_wav, out / "sfx_paper.mp3")

    make_grain(out / "grain.jpg")
    print(f"Wrote soundtrack and grain into {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
