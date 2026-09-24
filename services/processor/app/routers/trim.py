"""POST /jobs/trim — ffmpeg precise trim, uploaded to processed."""
import subprocess
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel

from ..config import FFMPEG_PATH, PROCESSED_BUCKET
from ..jobs import run_job
from ..security import verify_service_token
from ..storage import download_to, upload_file
from ..supabase_client import get_job

router = APIRouter()


class TrimRequest(BaseModel):
    job_id: str
    storage_path: str
    start_ms: int
    end_ms: int


def _do_trim(
    job_id: str, storage_path: str, start_ms: int, end_ms: int, tmp_dir: Path
) -> dict[str, Any]:
    job = get_job(job_id)
    track_id = job["track_id"]
    user_id = job["user_id"]
    if not track_id:
        raise RuntimeError(f"Job {job_id} has no track_id to trim")

    local_path = download_to(storage_path, tmp_dir)
    out_path = tmp_dir / f"trim{local_path.suffix}"

    # -ss/-to placed AFTER -i (not before) and re-encoded rather than
    # stream-copied, so the cut lands exactly on the requested millisecond
    # instead of snapping to the nearest keyframe.
    cmd = [
        FFMPEG_PATH, "-y",
        "-i", str(local_path),
        "-ss", f"{start_ms / 1000:.3f}",
        "-to", f"{end_ms / 1000:.3f}",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg trim failed: {result.stderr[-2000:]}")

    key = f"{user_id}/{track_id}/trim_{job_id}{local_path.suffix}"
    out_storage_path = upload_file(out_path, PROCESSED_BUCKET, key)

    return {"storage_path": out_storage_path}


@router.post(
    "/jobs/trim", status_code=202, dependencies=[Depends(verify_service_token)]
)
async def trim(payload: TrimRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        run_job,
        payload.job_id,
        lambda tmp_dir: _do_trim(
            payload.job_id, payload.storage_path, payload.start_ms, payload.end_ms, tmp_dir
        ),
    )
    return {"job_id": payload.job_id, "status": "accepted"}
