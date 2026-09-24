"""POST /jobs/download — yt-dlp fetch + format conversion, uploaded to
raw-uploads. Track creation happens client-side after this job completes
(Phase 4's "Continue to Edit"), not here — this endpoint only produces a
file in storage plus metadata for the client to act on.
"""
from pathlib import Path
from typing import Any, Optional

import yt_dlp
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel

from ..config import RAW_UPLOADS_BUCKET
from ..jobs import run_job
from ..security import verify_service_token
from ..storage import upload_file
from ..supabase_client import get_job
from ..ytdlp_formats import build_ydl_opts

router = APIRouter()


class DownloadRequest(BaseModel):
    job_id: str
    youtube_url: str
    format: str
    quality: Optional[str] = None


def _do_download(
    job_id: str, youtube_url: str, format: str, quality: Optional[str], tmp_dir: Path
) -> dict[str, Any]:
    job = get_job(job_id)
    user_id = job["user_id"]

    output_template = str(tmp_dir / "%(title).200B.%(ext)s")
    ydl_opts = build_ydl_opts(format, quality or "best", output_template)
    ydl_opts.update({"quiet": True, "no_warnings": True, "noplaylist": True})

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)

    # Postprocessors (e.g. audio extraction) rename/re-extension the file
    # after download, so recompute from what actually landed in tmp_dir
    # rather than trust the pre-postprocess filename.
    candidates = [p for p in tmp_dir.iterdir() if p.is_file()]
    if not candidates:
        raise RuntimeError("yt-dlp reported success but produced no output file")
    final_path = max(candidates, key=lambda p: p.stat().st_size)

    title = info.get("title") or final_path.stem
    key = f"{user_id}/{job_id}/{final_path.name}"
    storage_path = upload_file(final_path, RAW_UPLOADS_BUCKET, key)

    return {
        "storage_path": storage_path,
        "title": title,
        "filename": final_path.name,
        "duration_seconds": info.get("duration"),
    }


@router.post(
    "/jobs/download", status_code=202, dependencies=[Depends(verify_service_token)]
)
async def download(payload: DownloadRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        run_job,
        payload.job_id,
        lambda tmp_dir: _do_download(
            payload.job_id, payload.youtube_url, payload.format, payload.quality, tmp_dir
        ),
    )
    return {"job_id": payload.job_id, "status": "accepted"}
