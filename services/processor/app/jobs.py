"""Shared background-job execution wrapper: marks the job row processing,
runs the work, marks it done with the returned result or error on failure.
Used by every /jobs/* route so error handling and status transitions live
in one place instead of being repeated per endpoint.
"""
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Any, Callable, Optional

from .config import TMP_DIR
from .supabase_client import mark_job_done, mark_job_error, mark_job_processing

logger = logging.getLogger("processor.jobs")


def run_job(job_id: str, work: Callable[[Path], Optional[dict[str, Any]]]) -> None:
    """Runs `work(tmp_dir)` for a job, handling status transitions and
    cleanup. `work` returns the dict to store as jobs.result."""
    mark_job_processing(job_id)
    Path(TMP_DIR).mkdir(parents=True, exist_ok=True)
    tmp_dir = Path(tempfile.mkdtemp(prefix=f"job-{job_id}-", dir=TMP_DIR))
    try:
        result = work(tmp_dir)
        mark_job_done(job_id, result or {})
    except Exception as exc:  # noqa: BLE001 — surfaced to the job row, not swallowed
        logger.exception("Job %s failed", job_id)
        mark_job_error(job_id, str(exc))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
