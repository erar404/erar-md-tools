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
# Chunk length (seconds) demucs feeds the model per pass — the main lever we
# have over the model's own peak memory, since the container has a hard 1GB
# ceiling. Defaults to a conservative 4s (htdemucs was trained on ~7.8s
# segments, so 7 is barely a cut from its own default and wasn't enough on
# its own — 4 gives a real reduction in per-pass activation memory, at a
# real but acceptable speed cost). Override via the env var if the memory
# limit is ever raised and the faster/higher-quality default is wanted back.
DEMUCS_SEGMENT = os.environ.get("DEMUCS_SEGMENT", "4")
# Longer sources are pre-split into overlapping chunks and fed to demucs one
# at a time (see audio_chunking.py) because CPU peak memory scales with
# *total* input duration regardless of --segment — confirmed both in our own
# production OOM traces and upstream reports (facebookresearch/demucs#498:
# ~7GB RSS for a 1h track, ~34GB for 4h, even with segment-based internal
# processing). A file under CHUNK_SECONDS * 1.5 is run whole, unchanged, to
# avoid the extra split/merge cost on the common short-song case.
DEMUCS_CHUNK_SECONDS = float(os.environ.get("DEMUCS_CHUNK_SECONDS", "45"))
DEMUCS_CHUNK_OVERLAP_SECONDS = float(os.environ.get("DEMUCS_CHUNK_OVERLAP_SECONDS", "3"))
# Caps BLAS/OpenMP thread pools for the demucs subprocess so CPU inference
# doesn't spin up one scratch buffer per detected core — real memory
# savings on a memory-capped container, at a speed cost that's acceptable
# since a split job already runs for minutes. Only affects the demucs
# subprocess's environment, not this API process itself.
DEMUCS_SUBPROCESS_ENV_OVERRIDES = {
    "OMP_NUM_THREADS": os.environ.get("OMP_NUM_THREADS", "1"),
    "MKL_NUM_THREADS": os.environ.get("MKL_NUM_THREADS", "1"),
    "OPENBLAS_NUM_THREADS": os.environ.get("OPENBLAS_NUM_THREADS", "1"),
    "VECLIB_MAXIMUM_THREADS": os.environ.get("VECLIB_MAXIMUM_THREADS", "1"),
    "NUMEXPR_NUM_THREADS": os.environ.get("NUMEXPR_NUM_THREADS", "1"),
}
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
