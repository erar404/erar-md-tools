"""POST /jobs/analyze — tempo/key/time-signature, written onto the track
row (not just jobs.result) so the edit page's analyzer header can read it
straight off `tracks` without joining through jobs.
"""
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel

from ..audio_analysis import analyze
from ..jobs import run_job
from ..security import verify_service_token
from ..storage import download_to
from ..supabase_client import get_job, update_track

router = APIRouter()


class AnalyzeRequest(BaseModel):
    job_id: str
    storage_path: str


def _do_analyze(job_id: str, storage_path: str, tmp_dir: Path) -> dict[str, Any]:
    job = get_job(job_id)
    track_id = job["track_id"]
    if not track_id:
        raise RuntimeError(f"Job {job_id} has no track_id to analyze against")

    local_path = download_to(storage_path, tmp_dir)
    result = analyze(local_path)
    analyzed_key = f"{result.key_root} {result.key_mode}"

    update_track(
        track_id,
        {
            "analyzed_key": analyzed_key,
            "analyzed_tempo": result.tempo,
            "analyzed_time_signature": result.time_signature,
            "duration_seconds": result.duration_seconds,
            "sample_rate": result.sample_rate,
        },
    )

    return {
        "analyzed_key": analyzed_key,
        "analyzed_tempo": result.tempo,
        "analyzed_time_signature": result.time_signature,
    }


@router.post(
    "/jobs/analyze", status_code=202, dependencies=[Depends(verify_service_token)]
)
async def analyze_route(payload: AnalyzeRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        run_job,
        payload.job_id,
        lambda tmp_dir: _do_analyze(payload.job_id, payload.storage_path, tmp_dir),
    )
    return {"job_id": payload.job_id, "status": "accepted"}
