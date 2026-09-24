"""Service-role Supabase access — bypasses RLS. Only ever used server-side
in this processor, never exposed to a browser."""
from functools import lru_cache
from typing import Any, Optional

from supabase import Client, create_client

from .config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL


@lru_cache
def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_job(job_id: str) -> dict[str, Any]:
    res = get_supabase().table("jobs").select("*").eq("id", job_id).single().execute()
    return res.data


def mark_job_processing(job_id: str) -> None:
    get_supabase().table("jobs").update({"status": "processing"}).eq(
        "id", job_id
    ).execute()


def mark_job_done(job_id: str, result: dict[str, Any]) -> None:
    get_supabase().table("jobs").update(
        {"status": "done", "result": result}
    ).eq("id", job_id).execute()


def mark_job_error(job_id: str, message: str) -> None:
    get_supabase().table("jobs").update(
        {"status": "error", "error_message": message}
    ).eq("id", job_id).execute()


def update_track(track_id: str, fields: dict[str, Any]) -> None:
    get_supabase().table("tracks").update(fields).eq("id", track_id).execute()


def get_track(track_id: str) -> Optional[dict[str, Any]]:
    res = (
        get_supabase()
        .table("tracks")
        .select("*")
        .eq("id", track_id)
        .maybe_single()
        .execute()
    )
    return res.data if res else None


def insert_track_stem(
    track_id: str, job_id: str, stem_name: str, storage_path: str
) -> None:
    get_supabase().table("track_stems").insert(
        {
            "track_id": track_id,
            "job_id": job_id,
            "stem_name": stem_name,
            "storage_path": storage_path,
        }
    ).execute()
