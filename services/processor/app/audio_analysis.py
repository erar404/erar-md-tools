"""Tempo/key/time-signature analysis and click-track rendering.

Ported from dlp-gui's TEMPO_CLICK_SCRIPT (a subprocess-injected script
string in the desktop app, see dlp_gui/constants.py) into an importable
module — same algorithm, run in-process instead of shelled out to a
portable interpreter.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

import librosa
import numpy as np
import soundfile as sf

PITCH_CLASSES = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
]
MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)
TIME_SIGNATURES = {2: "2/4", 3: "3/4", 4: "4/4", 5: "5/4", 6: "6/8"}


@dataclass
class AnalysisResult:
    tempo: float
    key_root: str
    key_mode: str  # "major" | "minor"
    time_signature: str
    beats_per_bar: int
    duration_seconds: float
    sample_rate: int


def _best_rotation(profile: np.ndarray, template: np.ndarray) -> Tuple[int, float]:
    template = template - template.mean()
    best_i, best_score = 0, -np.inf
    for i in range(12):
        rotated = np.roll(template, i)
        denom = np.linalg.norm(profile) * np.linalg.norm(rotated)
        score = float(np.dot(profile, rotated) / denom) if denom else -np.inf
        if score > best_score:
            best_i, best_score = i, score
    return best_i, best_score


def beats_per_bar_from_time_signature(time_signature: str) -> int:
    return int(time_signature.split("/")[0])


def analyze(
    audio_path: Path,
    *,
    min_bpm: float = 60.0,
    max_bpm: float = 200.0,
    tightness: float = 100.0,
    beats_override: int = 0,
) -> AnalysisResult:
    if min_bpm > max_bpm:
        min_bpm, max_bpm = max_bpm, min_bpm

    y, sr = librosa.load(str(audio_path), sr=None, mono=True)

    # --- Tempo ---------------------------------------------------------
    # Only the single overall tempo estimate is trusted (not the raw,
    # sometimes-irregular beat_frames) — the click track is built on a
    # perfectly even grid at this one tempo so the metronome never skips.
    tempo, beat_frames = librosa.beat.beat_track(
        y=y, sr=sr, start_bpm=(min_bpm + max_bpm) / 2.0, tightness=tightness
    )
    tempo = float(np.ravel(tempo)[0])
    if not np.isfinite(tempo) or tempo <= 0:
        tempo = 120.0

    # Octave-fold into the plausible range — beat trackers routinely lock
    # onto half or double the true tempo.
    for _ in range(6):
        if tempo >= min_bpm:
            break
        tempo *= 2
    for _ in range(6):
        if tempo <= max_bpm:
            break
        tempo /= 2

    # --- Key -------------------------------------------------------------
    # Krumhansl-Schmuckler: correlate the chroma profile against every
    # rotation of the major/minor key templates, keep the best match.
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    profile = chroma.mean(axis=1)
    profile = profile - profile.mean()

    maj_i, maj_score = _best_rotation(profile, MAJOR_PROFILE)
    min_i, min_score = _best_rotation(profile, MINOR_PROFILE)
    if maj_score >= min_score:
        key_root, key_mode = PITCH_CLASSES[maj_i], "major"
    else:
        key_root, key_mode = PITCH_CLASSES[min_i], "minor"

    # --- Time signature (heuristic, or a caller-forced override) ---------
    # For each candidate beats-per-bar, checks how much stronger the onset
    # envelope is on the implied downbeat than the bar's other beats.
    if beats_override in TIME_SIGNATURES:
        beats_per_bar = beats_override
    else:
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        beat_idx = np.clip(beat_frames, 0, len(onset_env) - 1)
        beat_strengths = onset_env[beat_idx]

        beats_per_bar, best_contrast = 4, -np.inf
        if len(beat_strengths) >= 8:
            for n in TIME_SIGNATURES:
                if len(beat_strengths) < n * 2:
                    continue
                groups = [beat_strengths[i::n] for i in range(n)]
                means = [g.mean() for g in groups if len(g)]
                if len(means) < n:
                    continue
                contrast = max(means) - (sum(means) / len(means))
                if contrast > best_contrast:
                    beats_per_bar, best_contrast = n, contrast

    return AnalysisResult(
        tempo=round(tempo, 1),
        key_root=key_root,
        key_mode=key_mode,
        time_signature=TIME_SIGNATURES[beats_per_bar],
        beats_per_bar=beats_per_bar,
        duration_seconds=len(y) / sr,
        sample_rate=sr,
    )


def render_click_track(
    *,
    duration_seconds: float,
    bpm: float,
    beats_per_bar: int,
    accented: bool,
    sr: int = 44100,
    start_offset: float = 0.0,
) -> Tuple[np.ndarray, int]:
    """Even click grid at a fixed BPM spanning `duration_seconds`.

    Unlike `analyze`, this doesn't tempo-track — `bpm` here is already the
    user-confirmed value (from analysis, tap-tempo, or a half/double-time
    multiplier), so the grid is just laid out directly at that tempo.
    """
    length = int(duration_seconds * sr)
    interval = 60.0 / bpm
    n_clicks = max(0, int((duration_seconds - start_offset) / interval) + 1)
    click_times = start_offset + np.arange(n_clicks) * interval

    if not accented:
        clicks = librosa.clicks(
            times=click_times, sr=sr, click_freq=1000.0, click_duration=0.08,
            length=length,
        )
    else:
        downbeat_times = click_times[0::beats_per_bar]
        weak_mask = np.ones(len(click_times), dtype=bool)
        weak_mask[0::beats_per_bar] = False
        weak_times = click_times[weak_mask]

        accent = librosa.clicks(
            times=downbeat_times, sr=sr, click_freq=1600.0, click_duration=0.08,
            length=length,
        )
        regular = (
            librosa.clicks(
                times=weak_times, sr=sr, click_freq=1000.0, click_duration=0.08,
                length=length,
            )
            if len(weak_times)
            else np.zeros(length, dtype=np.float32)
        )
        clicks = accent + regular

    peak = np.max(np.abs(clicks)) if len(clicks) else 0.0
    if peak > 1.0:
        clicks = clicks / peak
    return clicks, sr


def write_wav(samples: np.ndarray, sr: int, path: Path) -> None:
    sf.write(str(path), samples, sr)
