"""POST /jobs/click-track — generates a click grid at the confirmed BPM,
spanning the track's full duration, optionally merged with the source.

Unlike dlp-gui's flow, this never re-runs tempo detection — `bpm` here is
already the value the user confirmed (from /jobs/analyze, tap-tempo, or a
half/double-time override), so this endpoint is pure rendering.
"""
import subprocess
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel

from ..audio_analysis import beats_per_bar_from_time_signature, render_click_track, write_wav
from ..config import FFMPEG_PATH, PROCESSED_BUCKET
from ..jobs import run_job
from ..security import verify_service_token
from ..storage import download_to, upload_file
from ..supabase_client import get_job, get_track

router = APIRouter()


class ClickTrackRequest(BaseModel):
    job_id: str
    storage_path: Optional[str] = None
    bpm: float
    time_signature: str
    accent: bool = True
    tempo_multiplier: float = 1
    merge_with_source: bool = False


def _encode_wav_to_mp3(wav_path: Path, mp3_path: Path) -> None:
    cmd = [
        FFMPEG_PATH, "-y", "-i", str(wav_path),
        "-codec:a", "libmp3lame", "-qscale:a", "2", str(mp3_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg mp3 encode failed: {result.stderr[-2000:]}")


def _do_click_track(
    job_id: str, payload: ClickTrackRequest, tmp_dir: Path
) -> dict[str, Any]:
    job = get_job(job_id)
    track_id = job["track_id"]
    user_id = job["user_id"]
    if not track_id:
        raise RuntimeError(f"Job {job_id} has no track_id to generate a click track for")

    track = get_track(track_id)
    duration = (track or {}).get("duration_seconds")
    if not duration:
        raise RuntimeError(f"Track {track_id} has no duration_seconds — run analyze first")

    bpm = payload.bpm * payload.tempo_multiplier
    beats_per_bar = beats_per_bar_from_time_signature(payload.time_signature)

    samples, sr = render_click_track(
        duration_seconds=duration, bpm=bpm, beats_per_bar=beats_per_bar,
        accented=payload.accent,
    )
    click_wav = tmp_dir / "click.wav"
    write_wav(samples, sr, click_wav)
    click_mp3 = tmp_dir / "click.mp3"
    _encode_wav_to_mp3(click_wav, click_mp3)

    click_key = f"{user_id}/{track_id}/click_{job_id}.mp3"
    result: dict[str, Any] = {
        "click_storage_path": upload_file(click_mp3, PROCESSED_BUCKET, click_key)
    }

    if payload.merge_with_source and payload.storage_path:
        source_path = download_to(payload.storage_path, tmp_dir)
        merged_mp3 = tmp_dir / "merged.mp3"
        cmd = [
            FFMPEG_PATH, "-y",
            "-i", str(source_path), "-i", str(click_mp3),
            "-filter_complex", "amix=inputs=2:duration=longest:normalize=0",
            "-codec:a", "libmp3lame", "-qscale:a", "2",
            str(merged_mp3),
        ]
        merge_result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if merge_result.returncode != 0:
            raise RuntimeError(f"ffmpeg merge failed: {merge_result.stderr[-2000:]}")
        merged_key = f"{user_id}/{track_id}/merged_{job_id}.mp3"
        result["merged_storage_path"] = upload_file(merged_mp3, PROCESSED_BUCKET, merged_key)

    return result


@router.post(
    "/jobs/click-track", status_code=202, dependencies=[Depends(verify_service_token)]
)
async def click_track(payload: ClickTrackRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        run_job,
        payload.job_id,
        lambda tmp_dir: _do_click_track(payload.job_id, payload, tmp_dir),
    )
    return {"job_id": payload.job_id, "status": "accepted"}
