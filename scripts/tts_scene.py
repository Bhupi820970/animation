#!/usr/bin/env python3
"""Create a storytelling voice clip with sentence pauses and word timings."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import tempfile
from pathlib import Path

import edge_tts


DEFAULT_VOICE = "en-GB-RyanNeural"
DEFAULT_RATE = "-6%"
DEFAULT_PITCH = "-3Hz"
DEFAULT_PAUSE_SEC = 0.22
DEFAULT_TAIL_SEC = 0.16


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [part.strip() for part in parts if part.strip()]


def ticks_to_seconds(value: float) -> float:
    # Edge word offsets are usually 100-nanosecond units.
    if value > 1000:
        return value / 10_000_000.0
    return float(value)


async def synth_sentence(text: str, voice: str, dest: Path, rate: str, pitch: str) -> list[dict]:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    words: list[dict] = []
    with dest.open("wb") as fh:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                fh.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = ticks_to_seconds(chunk["offset"])
                dur = ticks_to_seconds(chunk["duration"])
                word = (chunk.get("text") or "").strip()
                if word:
                    words.append({"word": word, "start": start, "end": start + dur})
    return words


def silence_wav(dest: Path, seconds: float, rate: int = 24000) -> None:
    import wave

    frames = int(rate * seconds)
    with wave.open(str(dest), "w") as fh:
        fh.setnchannels(1)
        fh.setsampwidth(2)
        fh.setframerate(rate)
        fh.writeframes(b"\x00\x00" * frames)


def concat_audio(parts: list[Path], dest: Path) -> None:
    import subprocess

    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as lst:
        for part in parts:
            lst.write(f"file '{part}'\n")
        list_path = lst.name
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            list_path,
            "-ar",
            "24000",
            "-ac",
            "1",
            "-b:a",
            "128k",
            str(dest),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    Path(list_path).unlink(missing_ok=True)


async def render(text: str, voice: str, audio_out: Path, words_out: Path, rate: str, pitch: str, pause_sec: float, tail_sec: float) -> None:
    sentences = split_sentences(text) or [text.strip()]
    tmp = Path(tempfile.mkdtemp(prefix="tts_"))
    audio_parts: list[Path] = []
    words: list[dict] = []
    offset = 0.0

    try:
        for index, sentence in enumerate(sentences):
            sent_mp3 = tmp / f"s{index}.mp3"
            sent_words = await synth_sentence(sentence, voice, sent_mp3, rate, pitch)
            audio_parts.append(sent_mp3)
            for item in sent_words:
                words.append(
                    {
                        "word": item["word"],
                        "start": round(item["start"] + offset, 3),
                        "end": round(item["end"] + offset, 3),
                    }
                )
            # Measure actual clip length so pauses stay aligned.
            import subprocess

            dur = float(
                subprocess.check_output(
                    [
                        "ffprobe",
                        "-v",
                        "error",
                        "-show_entries",
                        "format=duration",
                        "-of",
                        "default=noprint_wrappers=1:nokey=1",
                        str(sent_mp3),
                    ],
                    text=True,
                ).strip()
            )
            offset += dur
            if index < len(sentences) - 1:
                pause = tmp / f"p{index}.wav"
                silence_wav(pause, pause_sec)
                audio_parts.append(pause)
                offset += pause_sec

        tail = tmp / "tail.wav"
        silence_wav(tail, tail_sec)
        audio_parts.append(tail)
        audio_out.parent.mkdir(parents=True, exist_ok=True)
        concat_audio(audio_parts, audio_out)
        words_out.write_text(json.dumps(words, indent=2), encoding="utf-8")
    finally:
        for path in tmp.glob("*"):
            path.unlink(missing_ok=True)
        tmp.rmdir()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--words", required=True)
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--rate", default=DEFAULT_RATE)
    parser.add_argument("--pitch", default=DEFAULT_PITCH)
    parser.add_argument("--pause", type=float, default=DEFAULT_PAUSE_SEC)
    parser.add_argument("--tail", type=float, default=DEFAULT_TAIL_SEC)
    args = parser.parse_args()
    if not args.text.strip():
        raise SystemExit("Narration text is empty")
    asyncio.run(
        render(
            args.text,
            args.voice,
            Path(args.out),
            Path(args.words),
            args.rate,
            args.pitch,
            args.pause,
            args.tail,
        )
    )
    print(f"Wrote voice {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
