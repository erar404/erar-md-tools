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
# Chunk length (seconds) demucs feeds the model per pass. Unset by default —
# smaller values cut peak memory per pass (at a small speed cost) but the
# real fix for an out-of-memory kill is raising the service's memory limit;
# only set this if that's not an option. htdemucs was trained on ~7.8s
# segments, so values above that get silently clamped by demucs itself.
DEMUCS_SEGMENT = os.environ.get("DEMUCS_SEGMENT")
FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "ffmpeg")

# Optional escape hatch for YouTube's "Sign in to confirm you're not a bot"
# block on datacenter IPs (Railway's in particular gets flagged). Set
# YTDLP_COOKIES to the full contents of a Netscape-format cookies.txt
# exported from a real, signed-in YouTube session (e.g. via the "Get
# cookies.txt LOCALLY" browser extension) and this writes it to disk once at
# startup for yt-dlp's `cookiefile` option. Never put real cookie values in
# code or chat — set this directly as a Railway variable.
YTDLP_COOKIES_PATH: str | None = None
_cookies_content = os.environ.get("YTDLP_COOKIES")
if _cookies_content:
    os.makedirs(TMP_DIR, exist_ok=True)
    YTDLP_COOKIES_PATH = os.path.join(TMP_DIR, "cookies.txt")
    with open(YTDLP_COOKIES_PATH, "w", encoding="utf-8") as _f:
        _f.write(_cookies_content)

# Small-team scope, but still worth a basic cap on yt-dlp source size —
# protects the processor's disk/memory from an unexpectedly huge source.
MAX_DOWNLOAD_BYTES = int(os.environ.get("MAX_DOWNLOAD_BYTES", 500 * 1024 * 1024))

RAW_UPLOADS_BUCKET = "raw-uploads"
PROCESSED_BUCKET = "processed"
