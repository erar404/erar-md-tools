"""POST /jobs/split — Demucs (htdemucs) stem separation, uploaded to
processed, one track_stems row per stem.

stems=4 uses htdemucs's native 4-source output (vocals/drums/bass/other).
stems=2 uses Demucs's own --two-stems=vocals mode (a real vocals/
accompaniment separation, not a post-hoc mixdown of the 4-stem output) —
the accompaniment side is stored under stem_name "other" since the
track_stems.stem_name enum has no dedicated "instrumental" value.
"""
import os
import subprocess
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel

from ..audio_chunking import merge_stem_chunks, probe_duration_seconds, split_into_chunks
from ..config import (
    DEMUCS_CHUNK_OVERLAP_SECONDS,
    DEMUCS_CHUNK_SECONDS,
    DEMUCS_MODEL,
    DEMUCS_SEGMENT,
    DEMUCS_SUBPROCESS_ENV_OVERRIDES,
    FFMPEG_PATH,
    PROCESSED_BUCKET,
)
from ..jobs import run_job
from ..security import verify_service_token
from ..storage import download_to, upload_file
from ..supabase_client import get_job, insert_track_stem

router = APIRouter()


class SplitRequest(BaseModel):
    job_id: str
    storage_path: str
    stems: Literal[2, 4]


def _run_demucs(input_path: Path, out_dir: Path, stems: int) -> dict[str, Path]:
    """Runs demucs on a single file (a whole track, or one chunk of one) and
    returns stem name -> output path. Raises with an OOM-aware message on
    failure, same as before chunking existed."""
    cmd = ["python", "-m", "demucs.separate", "-n", DEMUCS_MODEL, "-j", "1", "-o", str(out_dir)]
    if DEMUCS_SEGMENT:
        cmd += ["--segment", DEMUCS_SEGMENT]
    if stems == 2:
        cmd += ["--two-stems", "vocals"]
    cmd.append(str(input_path))

    # `-j 1` keeps demucs from spawning parallel workers, and the thread-pool
    # caps stop the CPU BLAS backend from allocating a scratch buffer per
    # detected core — both only apply to this subprocess's own environment.
    subprocess_env = {**os.environ, **DEMUCS_SUBPROCESS_ENV_OVERRIDES}
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=1800, env=subprocess_env
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        if not detail and result.returncode < 0:
            # A killed-with-no-output process (empty stdout/stderr, negative
            # returncode = -signal) is almost always the OOM killer, not a
            # demucs error — surface that instead of a silent blank message.
            detail = (
                f"process was killed by signal {-result.returncode} before it produced "
                "any output — most likely an out-of-memory kill (demucs needs more RAM "
                "than this container currently has)"
            )
        elif not detail:
            detail = f"exit code {result.returncode}, no output captured"
        raise RuntimeError(f"demucs separation failed: {detail[-2000:]}")

    stem_dir = out_dir / DEMUCS_MODEL / input_path.stem
    if stems == 2:
        return {
            "vocals": stem_dir / "vocals.wav",
            "other": stem_dir / "no_vocals.wav",
        }
    return {
        name: stem_dir / f"{name}.wav" for name in ("vocals", "drums", "bass", "other")
    }


def _do_split(job_id: str, storage_path: str, stems: int, tmp_dir: Path) -> dict[str, Any]:
    job = get_job(job_id)
    track_id = job["track_id"]
    user_id = job["user_id"]
    if not track_id:
        raise RuntimeError(f"Job {job_id} has no track_id to split")

    local_path = download_to(storage_path, tmp_dir)

    # CPU peak memory for demucs scales with the *total* duration fed to it
    # in one call, independent of --segment (confirmed via production OOM
    # traces on this exact 1GB container). Short sources run through demucs
    # whole, as before; anything longer is pre-split into overlapping chunks,
    # processed one at a time, and the stems merged back with a crossfade —
    # bounding peak memory to one chunk regardless of source length.
    duration = probe_duration_seconds(local_path, FFMPEG_PATH)
    if duration <= DEMUCS_CHUNK_SECONDS * 1.5:
        stem_files = _run_demucs(local_path, tmp_dir / "demucs_out", stems)
    else:
        chunks = split_into_chunks(
            local_path,
            tmp_dir / "chunks",
            DEMUCS_CHUNK_SECONDS,
            DEMUCS_CHUNK_OVERLAP_SECONDS,
            FFMPEG_PATH,
        )
        per_chunk_stems = [
            _run_demucs(chunk.path, tmp_dir / f"demucs_out_{i}", stems)
            for i, chunk in enumerate(chunks)
        ]
        merged_dir = tmp_dir / "merged"
        merged_dir.mkdir(parents=True, exist_ok=True)
        stem_files = {}
        for stem_name in per_chunk_stems[0]:
            merged_path = merged_dir / f"{stem_name}.wav"
            merge_stem_chunks(
                [cs[stem_name] for cs in per_chunk_stems],
                DEMUCS_CHUNK_OVERLAP_SECONDS,
                merged_path,
            )
            stem_files[stem_name] = merged_path

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
