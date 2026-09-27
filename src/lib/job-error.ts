/** Human-friendly explanations for known job failure patterns. `error_message`
 * on a job row is whatever the processor's caught exception stringified to
 * (often a raw yt-dlp/ffmpeg line), so we pattern-match the common ones and
 * add a plain-language likely cause instead of showing only raw tool output.
 * Unrecognized messages still show as-is via `summary`, just without a `cause`. */
export function explainJobError(message: string | null | undefined): {
  summary: string;
  cause?: string;
} {
  const raw = message?.trim() || "Something went wrong.";

  if (/Requested format is not available/i.test(raw)) {
    return {
      summary: raw,
      cause:
        "The format or quality you picked isn't offered for this specific video — YouTube doesn't publish every resolution or bitrate for every upload. Try a different quality, or pick the \"Best available\" option instead.",
    };
  }

  if (/Video unavailable|This video is (private|unavailable)|content isn.t available/i.test(raw)) {
    return {
      summary: raw,
      cause: "The video may have been removed, made private, or isn't available in this region.",
    };
  }

  if (/Sign in to confirm your age|age[- ]restricted/i.test(raw)) {
    return {
      summary: raw,
      cause:
        "This video is age-restricted, and YouTube requires a signed-in session to download it, which this tool doesn't support.",
    };
  }

  if (/Sign in to confirm you.re not a bot/i.test(raw)) {
    return {
      summary: raw,
      cause:
        "YouTube is temporarily blocking automated downloads from our server's IP address. This usually clears up on its own — try again in a few minutes.",
    };
  }

  if (
    /getaddrinfo failed|Name or service not known|Failed to reach the processor|ERR_INVALID_URL|Connection refused|timed? ?out/i.test(
      raw
    )
  ) {
    return {
      summary: raw,
      cause: "The processing service was unreachable — this is usually temporary. Try again in a moment.",
    };
  }

  if (/ffmpeg .*(failed|error)/i.test(raw)) {
    return {
      summary: raw,
      cause: "Something went wrong converting or merging the audio. Try again, and if it keeps failing, try a different format.",
    };
  }

  return { summary: raw };
}
