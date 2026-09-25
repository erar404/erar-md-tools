"""POST /jobs/mixdown — ffmpeg per-stem volume + amix, so the exported file
matches the gain/mute/solo levels the user heard in the Splitter tab, not
just a flat sum of the raw stems."""
import subprocess
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field

from ..config import FFMPEG_PATH, PROCESSED_BUCKET
from ..jobs import run_job
from ..security import verify_service_token
from ..storage import download_to, upload_file
from ..supabase_client import get_job

router = APIRouter()


class StemGain(BaseModel):
    storage_path: str
    gain: float = Field(ge=0, le=4)


class MixdownRequest(BaseModel):
    job_id: str
    stems: list[StemGain] = Field(min_length=1, max_length=8)


def _do_mixdown(job_id: str, stems: list[StemGain], tmp_dir: Path) -> dict[str, Any]:
    job = get_job(job_id)
    track_id = job["track_id"]
    user_id = job["user_id"]
    if not track_id:
        raise RuntimeError(f"Job {job_id} has no track_id to mix down")

    input_args: list[str] = []
    filter_stages: list[str] = []
    mix_labels: list[str] = []
    for i, stem in enumerate(stems):
        local_path = download_to(stem.storage_path, tmp_dir)
        input_args += ["-i", str(local_path)]
        label = f"a{i}"
        filter_stages.append(f"[{i}:a]volume={stem.gain}[{label}]")
        mix_labels.append(f"[{label}]")

    filter_complex = (
        ";".join(filter_stages)
        + f";{''.join(mix_labels)}amix=inputs={len(stems)}:duration=longest:normalize=0[out]"
    )

    out_path = tmp_dir / "mixdown.mp3"
    cmd = [
        FFMPEG_PATH, "-y", *input_args,
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-codec:a", "libmp3lame", "-qscale:a", "2",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg mixdown failed: {result.stderr[-2000:]}")

    key = f"{user_id}/{track_id}/mixdown_{job_id}.mp3"
    return {"storage_path": upload_file(out_path, PROCESSED_BUCKET, key)}


@router.post(
    "/jobs/mixdown", status_code=202, dependencies=[Depends(verify_service_token)]
)
async def mixdown(payload: MixdownRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        run_job,
        payload.job_id,
        lambda tmp_dir: _do_mixdown(payload.job_id, payload.stems, tmp_dir),
    )
    return {"job_id": payload.job_id, "status": "accepted"}
