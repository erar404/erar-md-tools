# Handoff

## Goal

Build **MD Tools Web**, a small-team (login-gated) Next.js/TypeScript web app for music directors, in `C:\Users\Arellano\ERA\Coding\erar-md-tools-web`. It's the web successor to the local Python/tkinter tool `dlp-gui` (`C:\Users\Arellano\ERA\Coding\dlp-gui`), which is the reference for algorithm parity (not code to port line-for-line).

Five features required by the user:
1. **YouTube downloader** — paste a URL, pick from every yt-dlp-supported format/quality, download; when format is mp3/wav, offer "Continue to Edit".
2. **Audio trimmer** — waveform with millisecond-precision hover time, draggable region + text-box start/end (ms precision), playback follows the waveform, download the trimmed clip.
3. **Metronome generator** — click track from analyzed tempo; override via time-signature picker, no-accent toggle, half/double-time, and tap-tempo (while song plays); download click-only or click-merged-with-source.
4. **Track splitter (stems)** — separate stems, show one waveform per stem, synchronized play/pause, per-stem mute/solo/volume, download individual stems or a mixdown that reflects the current levels.
5. **Audio analyzer** — key/tempo/time-signature, displayed persistently in a header across all edit-page tabs (not a separate page).

Landing page: single YouTube-URL-or-file-upload field + "Process" button, branching to format-picker (YouTube) or straight to edit page (upload). **Built (Phase 4).**

### Confirmed architecture decisions (from user, via AskUserQuestion)
- **Auth**: Supabase Auth, small closed team with individual logins, redirect URLs driven by env vars (per environment) — no open public signup.
- **Heavy audio processing** (yt-dlp, ffmpeg, librosa, Demucs) cannot run on Vercel/Next.js serverless — runs in a **separate Python microservice** (FastAPI). Deploys to **Railway or Fly.io** (not yet chosen — deferred to Phase 10 on the user's explicit instruction), Next.js stays on Vercel. They talk over HTTPS: Next.js → processor via `PROCESSOR_BASE_URL` + bearer `PROCESSOR_SERVICE_TOKEN`; processor → Supabase directly via service-role key to update job status.
- **Stem separation engine**: **Demucs (htdemucs)**, explicitly not Spleeter.
- Full architecture, data model, and phased build order are written out in the approved plan file: **`C:\Users\Arellano\.claude\plans\tingly-wondering-dahl.md`** — read this file first, it is the source of truth for scope/design and should not be re-derived from scratch.

## Current State

**Phases 1–8 are functionally complete and this session audited 5–8 against the plan.** Phase 9 (hardening) is partially done — see below. Phase 10 (deploy) not started, deferred by user.

- Phases 1–4: done, as previously verified (scaffolding, Supabase, Python processor skeleton, landing page).
- **Phase 5 (edit shell + analyzer header): done.** `src/app/edit/[trackId]/layout.tsx` loads the track server-side, renders `TrackAudioProvider` (one shared `<audio>` element so playback state survives tab switches — `src/components/edit/track-audio-provider.tsx`) and `AnalyzerHeader` (`src/components/edit/analyzer-header.tsx`, Realtime-subscribed to `public.tracks` UPDATE so key/tempo/time-signature badges flip from "…" to real values without a reload). **Confirmed this session**: `public.tracks` (not just `public.jobs`) is in the `supabase_realtime` publication — this was done in an undocumented prior session, verified via direct SQL against the live project.
- **Phase 6 (Trim tab): done.** `src/app/edit/[trackId]/trim/page.tsx` (231 lines) — wavesurfer.js + Hover (ms-precision via `src/lib/format-time.ts`'s `formatMsTime`) + Regions plugins, draggable region two-way bound to ms-precision start/end number inputs, playback via wavesurfer's own play/pause, "Download trim" → `/api/jobs/trim` → Realtime job-status subscription → signed URL. Matches plan exactly.
- **Phase 7 (Metronome tab): done.** `src/app/edit/[trackId]/metronome/page.tsx` (335 lines) — base BPM from `track.analyzed_tempo`, time-signature `Select`, no-accent `Switch`, half/double via a multiplier (¼×–4× clamped), tap-tempo button (rolling average of up to 8 taps, only enabled while the shared `<audio>` element is playing), client-side Web Audio oscillator preview independent of the server render, "Generate click track" → `/api/jobs/click-track` (always requests both outputs) → two downloads (click-only, merged-with-source). Verified the request payload matches `services/processor/app/routers/click_track.py`'s `ClickTrackRequest` field-for-field (`bpm`, `tempo_multiplier`, `time_signature`, `accent`, `merge_with_source`, `storage_path`).
- **Phase 8 (Split tab): done.** `src/app/edit/[trackId]/split/page.tsx` (526 lines) — 2 or 4 stem `Select`, one non-interactive per-stem wavesurfer waveform driven by a shared `requestAnimationFrame` playhead, one `AudioContext` with per-stem `GainNode`s, sample-accurate synchronized start/stop, mute/solo (`effectiveGain()` correctly implements solo-mutes-others and un-solo restoring each stem's own mute/volume state — no extra "previous gain" bookkeeping needed, the logic just falls through to the existing per-stem state), per-stem volume slider (0–1.5), per-stem download, and "Generate mixdown at current levels" → `/api/jobs/mixdown` → `services/processor/app/routers/mixdown.py` (ffmpeg per-stem `volume` filter + `amix`, gain clamped server-side to 0–4, max 8 stems) → download. Verified field-for-field match between frontend payload and the Python `MixdownRequest`/`StemGain` models.
- **Phase 9 (cross-cutting hardening): partially done, audited this session.**
  - ✅ Central job-status UI: `src/components/edit/job-status-button.tsx`, shared by all three tabs (idle/queued/processing/error states + toast on failure).
  - ✅ Job concurrency cap: `src/lib/jobs.ts`'s `checkJobCapacity()` — max 3 concurrent (`pending`/`processing`) jobs per user, called from every job-creating API route (confirmed at least in `/api/jobs/mixdown/route.ts`; same pattern used elsewhere).
  - ✅ yt-dlp download size cap: `services/processor/app/config.py`'s `MAX_DOWNLOAD_BYTES` (default 500MB), passed as yt-dlp's `max_filesize` option in `download.py`.
  - ✅ Signed-URL re-fetch on download click: every "Download …" button (trim result, click-track click/merged, per-stem, mixdown) calls `createSignedDownloadUrl()` fresh at click time rather than reusing a stale URL — satisfies the plan's literal requirement.
  - ⚠️ **Gap found and fixed this session**: the direct-to-`raw-uploads` file upload path (`src/components/landing/landing-flow.tsx`) only enforced its 300MB size cap **client-side** (`MAX_UPLOAD_BYTES` check before upload) — the Supabase storage buckets themselves had `file_size_limit: null`, so the check was trivially bypassable by any direct API call. **Fixed**: ran migration `phase9_storage_bucket_size_limit` (`update storage.buckets set file_size_limit = 524288000 where id in ('raw-uploads','processed')`) — 500MB matches `MAX_DOWNLOAD_BYTES` so it doesn't clip legitimate yt-dlp downloads, and closes the direct-upload bypass. Verified via SQL after applying. **Deliberately did not** set `allowed_mime_types` on the buckets — yt-dlp downloads can be mp3/m4a/aac/flac/wav/opus/ogg **or** mp4/mkv/webm (see `services/processor/app/ytdlp_formats.py`), and getting an incomplete mime allowlist wrong risked silently breaking legitimate downloads for low security value in a closed-team, RLS-scoped-per-user bucket. If mime restriction is wanted later, build the allowlist from `AUDIO_FORMATS`/`VIDEO_FORMATS` in that file first.
  - ❌ **Still not done**: `TrackAudioProvider`'s playback signed URL (`src/components/edit/track-audio-provider.tsx`) is fetched once on mount with a 3600s (1hr) expiry and never refreshed — if an edit session (not a download click, the actual `<audio>` playback source) stays open past an hour, playback silently breaks until a page reload. Low priority (generous window for a single editing session) but technically an unaddressed corner of the plan's "signed-URL expiry handling" line.
  - `npm run build` and `npm run lint` both pass clean after this session's bucket-limit migration — confirmed no regression.
- Phase 10 (deploy): **not started**, explicitly deferred by the user to later; no Railway/Fly.io project exists yet.

**Git**: `git log` shows three commits — `75489cc initial commit`, `3113642 added phase 4`, `fcf4704 added the services part` — and the working tree is **clean** (no uncommitted changes as of this session's start). **Important**: the previous `handoff.md` (as of the `3113642` commit) was stale — it described the repo as of end-of-Phase-4 and was never updated for the `fcf4704` commit, which already contained all of Phases 5–8 undocumented. This session's job was mostly reconciling that drift via direct code audit rather than trusting the old handoff's "Next Step". **This session made exactly one code/infra change**: the storage-bucket `file_size_limit` migration above. Nothing else was edited. The user has not been asked whether/how to commit anything — there's nothing uncommitted to commit right now (the migration is server-side Supabase state, not a file change), so no commit is needed for this session's work.

## Files Actively Being Edited

Nothing is mid-edit. Everything is complete for what it currently does, modulo the two known Phase 9 gaps noted above (mime allowlist intentionally skipped, playback-URL refresh not yet done).

See prior handoff content (still accurate, not repeated in full here) for the detailed file-by-file breakdown of Phases 1–4. For Phases 5–8, the "Current State" section above names every file involved; nothing further to add.

## Failed Attempts

(Still valid, carried forward from the prior handoff — none of this was re-litigated this session.)

- **Root `middleware.ts`**: Next.js 16 needs `src/proxy.ts` (same directory level as `app/`, i.e. `src/app/`), function named `proxy`, not `middleware`. Confirmed still in place and working (`src/proxy.ts` exists, matcher excludes `/api`).
- **Proxy matcher catching `/api/*`**: would break route handlers' own JSON 401s — matcher must exclude `api`. Still excluded.
- **Installing `demucs`/`torch` locally to verify the processor**: not necessary, and this machine is memory-constrained (6GB, seen as low as 79MB free) — `next build`/`next lint` have intermittently OOM'd and always succeeded on retry. `split.py` shells out to `python -m demucs.separate`, so Demucs doesn't need to be importable locally to verify the surrounding code.
- **Chrome extension browser automation**: was not connected in the prior session (`tabs_context_mcp` → "Browser extension is not connected"). Not attempted again this session — this session was a code-level audit (reading + grepping + one SQL migration), not an interactive UI pass. **A real browser click-through of Trim/Metronome/Split (drag-and-drop region, Select dropdowns, tap-tempo, mute/solo/volume sliders, actual downloads) has still never been done** — only build/lint/static-audit verification. Worth doing once the two manual env items below are filled in and/or the Chrome extension is connected.
- **`taskkill //F //IM node.exe`**: avoid — kills unrelated node processes. Use `netstat -ano | grep :3000` → `taskkill //F //PID <pid> //T`.

## Next Step

**Nothing is broken or blocking**, but two manual items are still genuinely pending (verified empty this session, not just trusted from the old handoff):

1. **`SUPABASE_SERVICE_ROLE_KEY`** — still blank in both `.env.local` (Next.js) and `services/processor/.env` (processor). Needs the real value from Supabase dashboard → Project Settings → API → `service_role`, pasted identically into both files.
2. **`PROCESSOR_BASE_URL`** — still blank in `.env.local`. For local dev, this should point at wherever `uvicorn app.main:app` is running (e.g. `http://localhost:8000`) once the processor is actually run locally.
3. Supabase Auth config (dashboard → Authentication) — email magic-link enabled, Redirect URLs allow-list includes `http://localhost:3000/auth/callback`, public self-signup disabled. Not re-verified this session (no MCP tool inspects this directly) — ask the user.

Once those are in place, **real end-to-end testing becomes possible for the first time** — a real sign-in + full click-through of all three edit tabs (this has genuinely never been done in any session; every prior verification has been build/lint/static-audit only). That's the highest-value next step, either via the Chrome extension (if connected) or asking the user to test manually and report back.

If the user doesn't want to do that yet, the next-best code work is the two remaining Phase 9 items:
- Refresh `TrackAudioProvider`'s signed playback URL before/near its 1hr expiry (or on `<audio>` error), so long-open editing sessions don't silently lose playback.
- Decide whether to bother with storage bucket `allowed_mime_types` (built from `AUDIO_FORMATS`/`VIDEO_FORMATS` in `services/processor/app/ytdlp_formats.py`) — currently skipped as low-value/high-risk-of-breakage for a closed team.

Phase 10 (deploy) is explicitly deferred by the user's own prior instruction — don't start picking Railway vs. Fly.io or deploying unless asked.

## Context & Gotchas

- **The plan file is the spec.** `C:\Users\Arellano\.claude\plans\tingly-wondering-dahl.md` — read before any architectural decision. Phase headings: 0 (design/Stitch), 1 (scaffolding), 2 (Supabase), 3 (processor), 4 (landing), 5 (edit shell), 6 (trim), 7 (metronome), 8 (split), 9 (hardening), 10 (deploy).
- **Trust the plan/code over old handoffs.** This session's main lesson: `handoff.md` can silently lag real repo state by a full commit if a session ends without running the handoff-writing skill, or if the user commits work directly outside a Claude session. Always diff `git log`/`git status` against what the handoff claims before trusting its "Next Step" — this session found an entire un-logged phase's worth of work that way.
- **This machine is memory-constrained** (6GB total RAM, observed as low as 79MB free). `next build`/`next lint`/`next dev` (Rust/Turbopack-backed) have intermittently OOM'd — always transient, always resolved on plain retry.
- **Storage path convention**: every `storage_path` anywhere is `"<bucket>/<user_id>/..."` — bucket name is always the first path segment. Both `services/processor/app/storage.py` and the frontend's storage helpers parse it this way.
- **`jobs.result` is untyped JSONB** — each tab's page component casts it to its own local result interface (`TrimResult`, `ClickTrackResult`, `SplitResult`, `MixdownResult`) that must exactly match what the corresponding Python router returns. No shared type between the two languages; keep them manually in sync if either side's job-result shape changes. Verified in sync this session for click-track and mixdown; trim/split were not re-diffed field-by-field this session (only spot-checked) but showed no issues.
- **Storage buckets `raw-uploads`/`processed` now both have `file_size_limit = 524288000` (500MB), `allowed_mime_types = null`** (this session's change, applied via direct SQL migration against the live project `tmtydxacbfajdeybwvkb` — no local migration files exist in this repo; everything is applied via `mcp__supabase__apply_migration`/`execute_sql`, not tracked in `supabase/migrations/`).
- **`public.tracks` and `public.jobs` are both in the `supabase_realtime` publication** — confirmed live this session via `select * from pg_publication_tables where pubname = 'supabase_realtime'`.
- **dlp-gui reference locations** if more algorithm parity is needed later: `dlp_gui/constants.py` (`TEMPO_CLICK_SCRIPT`, format tables — already ported), `dlp_gui/audio_tools.py` (Spleeter chunking — not used, Demucs doesn't need it), `dlp_gui/ytdlp_args.py` (CLI-arg version of the format mapping — processor uses the Python-API equivalent, `app/ytdlp_formats.py`).
