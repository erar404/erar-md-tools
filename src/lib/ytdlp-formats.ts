/**
 * YouTube download format/quality options shown in the landing page's
 * format picker. Mirrors services/processor/app/ytdlp_formats.py — keep
 * both in sync if the supported format list changes.
 */

export const AUDIO_FORMATS = ["mp3", "wav", "m4a", "aac", "flac", "opus", "ogg"] as const;
export const VIDEO_FORMATS = ["mp4", "mkv", "webm"] as const;

export type AudioFormat = (typeof AUDIO_FORMATS)[number];
export type VideoFormat = (typeof VIDEO_FORMATS)[number];
export type DownloadFormat = AudioFormat | VideoFormat;

export const AUDIO_QUALITIES = [
  { value: "best", label: "Best (VBR)" },
  { value: "320k", label: "320 Kbps" },
  { value: "256k", label: "256 Kbps" },
  { value: "192k", label: "192 Kbps" },
  { value: "128k", label: "128 Kbps" },
] as const;

export const VIDEO_QUALITIES = [
  { value: "best", label: "Best available" },
  { value: "2160p", label: "4K (2160p)" },
  { value: "1440p", label: "1440p" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "360p", label: "360p" },
] as const;

export const FORMAT_OPTIONS: { value: DownloadFormat; label: string }[] = [
  { value: "mp3", label: "MP3" },
  { value: "wav", label: "WAV" },
  { value: "m4a", label: "M4A" },
  { value: "aac", label: "AAC" },
  { value: "flac", label: "FLAC" },
  { value: "opus", label: "OPUS" },
  { value: "ogg", label: "OGG" },
  { value: "mp4", label: "MP4" },
  { value: "mkv", label: "MKV" },
  { value: "webm", label: "WebM" },
];

export function isAudioFormat(format: string): format is AudioFormat {
  return (AUDIO_FORMATS as readonly string[]).includes(format);
}

/** Only mp3/wav downloads can continue into the editor — every other
 * format (other audio codecs, or video) is download-only, since editing
 * needs an audio file the browser can decode for waveform playback. */
export function isEditableFormat(format: string): boolean {
  return format === "mp3" || format === "wav";
}

export function qualitiesForFormat(format: string) {
  return isAudioFormat(format) ? AUDIO_QUALITIES : VIDEO_QUALITIES;
}

const YOUTUBE_URL_PATTERN =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)/i;

export function looksLikeYoutubeUrl(value: string): boolean {
  return YOUTUBE_URL_PATTERN.test(value.trim());
}
