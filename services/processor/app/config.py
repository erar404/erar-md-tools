"""Environment configuration. Loaded once at import time — fail fast on
missing required vars rather than surfacing an obscure error mid-job."""
import os

from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


PROCESSOR_SERVICE_TOKEN = _require("PROCESSOR_SERVICE_TOKEN")
SUPABASE_URL = _require("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = _require("SUPABASE_SERVICE_ROLE_KEY")

TMP_DIR = os.environ.get("PROCESSOR_TMP_DIR", "/tmp/md-tools-processor")
DEMUCS_MODEL = os.environ.get("DEMUCS_MODEL", "htdemucs")
FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "ffmpeg")

RAW_UPLOADS_BUCKET = "raw-uploads"
PROCESSED_BUCKET = "processed"
