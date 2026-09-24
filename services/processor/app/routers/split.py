"""POST /jobs/split — Demucs (htdemucs) stem separation, uploaded to
processed, one track_stems row per stem.

stems=4 uses htdemucs's native 4-source output (vocals/drums/bass/other).
stems=2 uses Demucs's own --two-stems=vocals mode (a real vocals/
accompaniment separation, not a post-hoc mixdown of the 4-stem output) —
the accompaniment side is stored under stem_name "other" since the
track_stems.stem_name enum has no dedicated "instrumental" value.
"""
import subprocess
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel

from ..config import DEMUCS_MODEL, PROCESSED_BUCKET
from ..jobs import run_job
from ..security import verify_service_token
from ..storage import download_to, upload_file
from ..supabase_client import get_job, insert_track_stem

router = APIRouter()


class SplitRequest(BaseModel):
    job_id: str
    storage_path: str
    stems: Literal[2, 4]


def _do_split(job_id: str, storage_path: str, stems: int, tmp_dir: Path) -> dict[str, Any]:
    job = get_job(job_id)
    track_id = job["track_id"]
    user_id = job["user_id"]
    if not track_id:
        raise RuntimeError(f"Job {job_id} has no track_id to split")

    local_path = download_to(storage_path, tmp_dir)
    out_dir = tmp_dir / "demucs_out"

    cmd = ["python", "-m", "demucs.separate", "-n", DEMUCS_MODEL, "-o", str(out_dir)]
    if stems == 2:
        cmd += ["--two-stems", "vocals"]
    cmd.append(str(local_path))

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if result.returncode != 0:
        raise RuntimeError(f"demucs separation failed: {result.stderr[-2000:]}")

    stem_dir = out_dir / DEMUCS_MODEL / local_path.stem
    if stems == 2:
        stem_files = {
            "vocals": stem_dir / "vocals.wav",
            "other": stem_dir / "no_vocals.wav",
        }
    else:
        stem_files = {
            name: stem_dir / f"{name}.wav" for name in ("vocals", "drums", "bass", "other")
        }

    uploaded: dict[str, str] = {}
    for stem_name, path in stem_files.items():
        if not path.exists():
            raise RuntimeError(f"demucs did not produce expected stem: {path}")
        key = f"{user_id}/{track_id}/stems_{job_id}/{stem_name}.wav"
        stem_storage_path = upload_file(path, PROCESSED_BUCKET, key)
        insert_track_stem(track_id, job_id, stem_name, stem_storage_path)
        uploaded[stem_name] = stem_storage_path

    return {"stems": uploaded}


@router.post(
    "/jobs/split", status_code=202, dependencies=[Depends(verify_service_token)]
)
async def split(payload: SplitRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        run_job,
        payload.job_id,
        lambda tmp_dir: _do_split(payload.job_id, payload.storage_path, payload.stems, tmp_dir),
    )
    return {"job_id": payload.job_id, "status": "accepted"}
