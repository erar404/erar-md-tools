"""YouTube download format/quality mapping.

Mirrors dlp-gui's format tables (dlp_gui/constants.py, dlp_gui/ytdlp_args.py)
but targets the yt-dlp Python API (a ydl_opts dict) instead of its CLI args,
since the processor calls yt-dlp as a library, not a subprocess.
"""

VIDEO_QUALITIES = {
    "best": "",
    "2160p": "[height<=2160]",
    "1440p": "[height<=1440]",
    "1080p": "[height<=1080]",
    "720p": "[height<=720]",
    "480p": "[height<=480]",
    "360p": "[height<=360]",
}

AUDIO_QUALITIES = {
    "best": "0",
    "320k": "320",
    "256k": "256",
    "192k": "192",
    "128k": "128",
}

AUDIO_FORMATS = {"mp3", "m4a", "aac", "flac", "wav", "opus", "ogg"}
VIDEO_FORMATS = {"mp4", "mkv", "webm"}

# yt-dlp's FFmpegExtractAudio postprocessor wants "vorbis", not "ogg".
_AUDIO_CODEC_OVERRIDES = {"ogg": "vorbis"}


def build_ydl_opts(format_key: str, quality_key: str, output_template: str) -> dict:
    format_key = (format_key or "").lower()
    quality_key = (quality_key or "best").lower()

    if format_key in AUDIO_FORMATS:
        codec = _AUDIO_CODEC_OVERRIDES.get(format_key, format_key)
        bitrate = AUDIO_QUALITIES.get(quality_key, AUDIO_QUALITIES["best"])
        return {
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": codec,
                    "preferredquality": bitrate,
                }
            ],
        }

    if format_key in VIDEO_FORMATS:
        q = VIDEO_QUALITIES.get(quality_key, VIDEO_QUALITIES["best"])
        if format_key == "mp4":
            fmt = (
                f"bestvideo{q}[ext=mp4]+bestaudio[ext=m4a]/bestvideo{q}+bestaudio/best{q}"
                if q
                else "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best"
            )
        elif format_key == "webm":
            fmt = (
                f"bestvideo{q}[ext=webm]+bestaudio[ext=webm]/best{q}"
                if q
                else "bestvideo[ext=webm]+bestaudio[ext=webm]/best"
            )
        else:  # mkv
            fmt = f"bestvideo{q}+bestaudio/best{q}" if q else "bestvideo+bestaudio/best"
        return {
            "format": fmt,
            "outtmpl": output_template,
            "merge_output_format": format_key,
        }

    raise ValueError(f"Unsupported format: {format_key!r}")
