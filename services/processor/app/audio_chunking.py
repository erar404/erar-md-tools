"""Splits a long source file into overlapping WAV chunks before demucs, and
merges per-chunk stem output back into one file afterward.

Why this exists: demucs's own `--segment` flag only bounds the model's
per-pass processing window — confirmed (via production OOM traces, and
matching reports upstream, e.g. facebookresearch/demucs#498) that CPU peak
memory still scales with the *total* input duration regardless of segment
size, because the full output tensor is assembled before being written out.
Feeding demucs one short chunk at a time instead bounds peak memory to a
chunk's worth of audio, independent of how long the source track is.
"""
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

_DURATION_RE = re.compile(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)")


def probe_duration_seconds(path: Path, ffmpeg_path: str) -> float:
    # `ffmpeg -i <file>` with no output always exits non-zero, but still
    # prints "Duration: HH:MM:SS.ms" to stderr first — that's all we need.
    result = subprocess.run(
        [ffmpeg_path, "-i", str(path)], capture_output=True, text=True, timeout=60
    )
    match = _DURATION_RE.search(result.stderr)
    if not match:
        raise RuntimeError(f"could not determine duration of {path}: {result.stderr[-500:]}")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


@dataclass
class AudioChunk:
    path: Path


def split_into_chunks(
    source_path: Path,
    chunk_dir: Path,
    chunk_seconds: float,
    overlap_seconds: float,
    ffmpeg_path: str,
) -> list[AudioChunk]:
    """Cuts `source_path` into fixed-stride chunks, each one (after the
    first) extended backward by `overlap_seconds` so adjacent chunks share
    a short overlap region for crossfading back together later. Re-encodes
    to a standard PCM WAV so the cut lands on an exact sample, not the
    nearest keyframe of whatever codec yt-dlp/upload produced."""
    duration = probe_duration_seconds(source_path, ffmpeg_path)
    chunk_dir.mkdir(parents=True, exist_ok=True)

    chunks: list[AudioChunk] = []
    i = 0
    while i * chunk_seconds < duration:
        raw_start = i * chunk_seconds
        start = max(0.0, raw_start - overlap_seconds) if i > 0 else 0.0
        end = min(duration, raw_start + chunk_seconds)
        chunk_path = chunk_dir / f"chunk_{i:03d}.wav"
        cmd = [
            ffmpeg_path, "-y",
            "-i", str(source_path),
            "-ss", f"{start:.3f}",
            "-to", f"{end:.3f}",
            "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le",
            str(chunk_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg chunk split failed: {result.stderr[-2000:]}")
        chunks.append(AudioChunk(path=chunk_path))
        i += 1
    return chunks


def merge_stem_chunks(chunk_paths: list[Path], overlap_seconds: float, out_path: Path) -> None:
    """Concatenates one stem's per-chunk output back into a single file,
    linearly crossfading each chunk boundary's overlap region instead of
    hard-cutting it, so the join isn't audible. Holds at most two chunks'
    worth of samples in memory at a time, not the full merged length."""
    first, sr = sf.read(str(chunk_paths[0]), dtype="float32", always_2d=True)
    overlap_samples = int(round(overlap_seconds * sr))
    channels = first.shape[1]

    with sf.SoundFile(
        str(out_path), mode="w", samplerate=sr, channels=channels, subtype="PCM_16"
    ) as out:
        if len(chunk_paths) == 1:
            out.write(first)
            return

        split_at = max(0, len(first) - overlap_samples)
        out.write(first[:split_at])
        pending_tail = first[split_at:]

        for idx, path in enumerate(chunk_paths[1:], start=1):
            data, chunk_sr = sf.read(str(path), dtype="float32", always_2d=True)
            if chunk_sr != sr:
                raise RuntimeError("stem chunk sample rate mismatch during merge")

            n = min(overlap_samples, len(pending_tail), len(data))
            if n:
                fade_out = np.linspace(1.0, 0.0, n, dtype="float32")[:, None]
                fade_in = np.linspace(0.0, 1.0, n, dtype="float32")[:, None]
                out.write(pending_tail[-n:] * fade_out + data[:n] * fade_in)

            is_last = idx == len(chunk_paths) - 1
            body_end = len(data) if is_last else max(n, len(data) - overlap_samples)
            out.write(data[n:body_end])
            pending_tail = np.zeros((0, channels), dtype="float32") if is_last else data[body_end:]
