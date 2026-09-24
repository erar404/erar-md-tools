"""Supabase Storage helpers.

Convention shared with the Next.js app: every `storage_path` stored in the
database (tracks.storage_path, jobs.result.*_path, track_stems.storage_path)
is `<bucket>/<user_id>/<...>` — the bucket name is always the first path
segment, so a bare path is never ambiguous about which private bucket it
lives in.
"""
from pathlib import Path
from typing import Tuple

from .supabase_client import get_supabase


def split_storage_path(storage_path: str) -> Tuple[str, str]:
    bucket, _, key = storage_path.partition("/")
    if not key:
        raise ValueError(
            f"storage_path must be '<bucket>/<key>', got {storage_path!r}"
        )
    return bucket, key


def download_to(storage_path: str, dest_dir: Path) -> Path:
    bucket, key = split_storage_path(storage_path)
    data = get_supabase().storage.from_(bucket).download(key)
    dest_dir.mkdir(parents=True, exist_ok=True)
    local_path = dest_dir / Path(key).name
    local_path.write_bytes(data)
    return local_path


def upload_file(local_path: Path, bucket: str, key: str) -> str:
    with open(local_path, "rb") as f:
        get_supabase().storage.from_(bucket).upload(
            key, f.read(), {"upsert": "true"}
        )
    return f"{bucket}/{key}"
