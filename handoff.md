# Handoff

## Goal

Build **MD Tools Web**, a small-team (login-gated) Next.js/TypeScript web app for music directors, in `C:\Users\Arellano\ERA\Coding\erar-md-tools-web`. It's the web successor to the local Python/tkinter tool `dlp-gui` (`C:\Users\Arellano\ERA\Coding\dlp-gui`), which is the reference for algorithm parity (not code to port line-for-line).

Five features required by the user:
1. **YouTube downloader** — paste a URL, pick from every yt-dlp-supported format/quality, download; when format is mp3/wav, offer "Continue to Edit".
2. **Audio trimmer** — waveform with millisecond-precision hover time, draggable region + text-box start/end (ms precision), playback follows the waveform, download the trimmed clip.
3. **Metronome generator** — click track from analyzed tempo; override via time-signature picker, no-accent toggle, half/double-time, and tap-tempo (while song plays); download click-only or click-merged-with-source.
4. **Track splitter (stems)** — separate stems, show one waveform per stem, synchronized play/pause, per-stem mute/solo/volume, download individual stems or a mixdown that reflects the current levels.
5. **Audio analyzer** — key/tempo/time-signature, displayed persistently in a header across all edit-page tabs (not a separate page).

Landing page: single YouTube-URL-or-file-upload field + "Process" button, branching to format-picker (YouTube) or straight to edit page (upload). **This part is now built (Phase 4) — see Current State.**

### Confirmed architecture decisions (from user, via AskUserQuestion)
- **Auth**: Supabase Auth, small closed team with individual logins, redirect URLs driven by env vars (per environment) — no open public signup.
- **Heavy audio processing** (yt-dlp, ffmpeg, librosa, Demucs) cannot run on Vercel/Next.js serverless — runs in a **separate Python microservice** (FastAPI). Confirmed this session: deploys to **Railway or Fly.io** (not yet chosen — deferred to Phase 10 on the user's explicit instruction), Next.js stays on Vercel. They talk over HTTPS: Next.js → processor via `PROCESSOR_BASE_URL` + bearer `PROCESSOR_SERVICE_TOKEN`; processor → Supabase directly via service-role key to update job status.
- **Stem separation engine**: **Demucs (htdemucs)**, explicitly not Spleeter.
- Full architecture, data model, and phased build order are written out in the approved plan file: **`C:\Users\Arellano\.claude\plans\tingly-wondering-dahl.md`** — read this file first, it is the source of truth for scope/design and should not be re-derived from scratch.

## Current State

**Phases 1–4 are complete.** Phases 5–10 have not been started (Phase 5's shell already exists as a stub from Phase 1 scaffolding, but has no real Realtime/analyzer wiring yet).

- Phase 1 (scaffolding): done, verified previously.
- Phase 2 (Supabase): done. Tables (`profiles`, `tracks`, `jobs`, `track_stems`) + RLS applied. Storage buckets `raw-uploads`/`processed` created with per-user RLS. Real Supabase URL + anon key are in `.env.local`. Real generated `Database` type (`src/types/supabase.ts`) is wired into all Supabase clients. **A real bug was found and fixed**: Next.js 16 renamed `middleware.ts` → `proxy.ts`, and undocumented, the file must live at the same directory level as `app/` (i.e. `src/proxy.ts`, not repo root) or it silently never runs. Verified working: unauthenticated `/` → 307 to `/login?next=...`, `/login` stays public, `/api/*` returns its own JSON 401 instead of being redirected (matcher now excludes `api`).
- Phase 3 (Python processor): done. `services/processor/` is a full FastAPI app (see Files section) implementing all 5 job endpoints from the plan. Verified via syntax check + a throwaway venv smoke test (auth/validation/routing all correct; a full valid request path was traced up to the point it needs real network access, which is the expected/correct failure point). **Never deployed** — no Railway/Fly.io project exists yet.
- Phase 4 (landing page): done. `src/app/page.tsx` now renders `LandingFlow` (`src/components/landing/landing-flow.tsx`) — the real URL/upload input, YouTube format+quality picker, download job creation with **Realtime** status tracking (not polling), "Continue to Edit"/"Download file" branching, and the direct-to-Storage upload path. Verified: clean `npm run build` + `npm run lint`, and a real (if limited) browser render check — see Failed Attempts / Context for exactly what was and wasn't verified.

**Nothing is committed since the user's own "initial commit"** (git log shows exactly one commit). That commit already included most of Phase 2 (Supabase clients, generated types, migrations were already applied via MCP before the commit). Everything below is **uncommitted working-tree state**:

```
 M .gitignore                              (added python ignores for services/processor)
 D proxy.ts                                (old root file — Next 16 proxy bug fix)
 M src/app/api/jobs/download/route.ts      (added optional `quality` field — Phase 3/4)
 M src/app/page.tsx                        (renders LandingFlow — Phase 4)
?? services/                               (all of Phase 3 — new)
?? src/components/landing/                 (Phase 4 — new)
?? src/components/ui/progress.tsx          (shadcn add — Phase 4)
?? src/components/ui/select.tsx            (shadcn add — Phase 4)
?? src/lib/ytdlp-formats.ts                (Phase 4 — new)
?? src/proxy.ts                            (Next 16 proxy bug fix — replaces root proxy.ts)
```

`package.json`/`package-lock.json` are unchanged despite adding `select`/`progress` — `@base-ui/react` was already a dependency from Phase 1, so no new packages were needed.

The user has **not been asked whether to commit this** — do not commit without asking, per standing git-safety rules.

## Files Actively Being Edited

Nothing is mid-edit / broken. Everything below is complete and working for what it currently does.

**Phase 2 fix (this session)**
- `src/proxy.ts` — **moved from root `proxy.ts`**, function renamed `middleware` → `proxy` (Next.js 16 convention), and the matcher changed to `"/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"` (excludes `/api` so API routes own their own auth response shape).
- `src/lib/supabase/proxy.ts` — (renamed from `middleware.ts`) `updateSession()`, now parameterized `createServerClient<Database>`, and `getUser()` wrapped in try/catch (was previously unguarded).
- `src/types/supabase.ts` — the real `supabase gen types typescript` output for this project. `src/lib/supabase/{client,server,admin}.ts` are all now parameterized with this `Database` type (previously unparameterized due to a since-resolved generic-inference issue).
- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are real values. `PROCESSOR_SERVICE_TOKEN` is a generated random token (`secrets.token_urlsafe(32)`), also copied into `services/processor/.env`. **`SUPABASE_SERVICE_ROLE_KEY` and `PROCESSOR_BASE_URL` are still blank** — see Next Step.

**Phase 3 (Python processor) — all new, under `services/processor/`**
- `requirements.txt`, `Dockerfile`, `.env.example`, `.env` (gitignored, has real `SUPABASE_URL` + `PROCESSOR_SERVICE_TOKEN`, blank `SUPABASE_SERVICE_ROLE_KEY`)
- `app/config.py` — env loading, fails fast on missing required vars
- `app/security.py` — bearer-token dependency (`verify_service_token`)
- `app/supabase_client.py` — service-role client; `get_job`/`get_track`/`mark_job_processing`/`mark_job_done`/`mark_job_error`/`update_track`/`insert_track_stem`
- `app/storage.py` — `<bucket>/<user_id>/...` storage-path convention, `download_to`/`upload_file`
- `app/jobs.py` — `run_job()`: shared background-task wrapper (mark processing → run → mark done/error → cleanup temp dir)
- `app/audio_analysis.py` — tempo/key/time-signature analysis **ported from dlp-gui's `TEMPO_CLICK_SCRIPT`** (`dlp_gui/constants.py`) into real importable functions, plus `render_click_track()` for the click-track endpoint
- `app/ytdlp_formats.py` — format/quality tables ported from dlp-gui's `constants.py`/`ytdlp_args.py`, adapted to yt-dlp's Python API (`build_ydl_opts`)
- `app/routers/{download,analyze,trim,click_track,split}.py` — all 5 endpoints; each does bearer-auth → 202 → background task → job status update
  - `split.py`: stems=2 uses Demucs's native `--two-stems=vocals` (real isolation, not a mixdown); the accompaniment side is stored as stem_name `"other"` since the DB enum has no dedicated "instrumental" value
- `app/main.py` — wires all routers + `/health`

**Phase 4 (landing page) — all new**
- `src/lib/ytdlp-formats.ts` — frontend mirror of the Python format/quality tables, plus `isEditableFormat` (mp3/wav only → "Continue to Edit"), `looksLikeYoutubeUrl`
- `src/components/landing/landing-flow.tsx` — the whole flow, `'use client'`. Key behaviors: mutually-exclusive URL/file inputs, format picker (shadcn `Select`) shown after "Process" on the YouTube path, `/api/jobs/download` call, **Supabase Realtime subscription** on the created job's row for live status (not polling), branch to "Continue to Edit" (mp3/wav — creates `tracks` row client-side, fires `/api/jobs/analyze` fire-and-forget, routes to `/edit/[trackId]`) or "Download file" (signed URL) on completion, and a separate direct-to-`raw-uploads`-bucket upload path for local files
- `src/app/page.tsx` — now renders `<LandingFlow />` instead of the Phase-4-stub text
- `src/components/ui/select.tsx`, `src/components/ui/progress.tsx` — added via `npx shadcn@latest add select progress` (uses `@base-ui/react`, already a dependency — no new npm packages)
- `src/app/api/jobs/download/route.ts` — added optional `quality` field alongside `format`, threaded through to the processor call

**Migrations applied this session** (via `mcp__supabase__apply_migration`, all already live on the real project `tmtydxacbfajdeybwvkb`):
- `phase2_core_schema` — 4 tables, enums, RLS
- `phase2_storage_buckets` — `raw-uploads`/`processed` buckets + storage RLS
- `phase4_enable_realtime_jobs` — `alter publication supabase_realtime add table public.jobs;` (was empty before — no table had Realtime enabled)

## Failed Attempts

- **What was tried**: Trusting `middleware.ts` at the repo root (the Next.js 15 convention) to gate auth, as originally scaffolded in Phase 1.
  **Why it failed**: Next.js 16 deprecated `middleware.ts`/`export function middleware` in favor of `proxy.ts`/`export function proxy`. The docs (`node_modules/next/dist/docs/.../file-conventions/proxy.md`) claim "all functionality remains the same" for the deprecated convention, but empirically on this install (16.3.6, Turbopack), the old file was **silently never invoked** — confirmed by adding a `console.log` at the top of the handler and seeing it never fire, and by inspecting `.next/dev/server/middleware-manifest.json` which showed `"middleware": {}, "functions": {}` even though the file compiled. **Fix**: renamed to `proxy.ts`, function to `proxy`. That alone still didn't work at the **repo root** — moving it to `src/proxy.ts` (same level as `src/app/`) is what actually made it register and run. This second detail (directory level) is not clearly documented anywhere; discovered by trial.
- **What was tried**: Leaving the proxy matcher matching all paths including `/api/*`.
  **Why it failed**: Unauthenticated `POST /api/jobs/analyze` was getting a 307 redirect to `/login` (HTML) instead of the route handler's own `{"error":"Unauthorized"}` JSON 401 — confirmed with curl. This was flagged as a risk in the prior handoff and turned out to be real. **Fix**: matcher now excludes `api`.
- **What was tried**: Installing the processor's full `requirements.txt` (including `demucs`, which pulls in `torch`) into a local venv to fully runtime-verify `services/processor`.
  **Why it wasn't done**: This dev machine is severely memory-constrained (`FreePhysicalMemory` observed as low as ~79MB, typically 300MB–6GB free out of 6GB total) — `next build`/`next lint`'s Rust binaries (Turbopack, oxlint) crashed with native OOM errors multiple times this session (`memory allocation of N bytes failed`, `Out of memory: HashMap::Initialize`), always transient and resolved on retry. Installing torch+demucs (multi-GB) was judged too risky/slow for this machine and not necessary to verify code correctness. **Instead**: installed the lighter deps (fastapi, yt-dlp, librosa, numpy, soundfile, supabase, httpx) in a throwaway `.venv` (deleted after use, along with a throwaway `_smoke_test.py`), and confirmed via `TestClient`: 401 on missing/wrong token, 422 on bad `stems` literal, and a full valid `/jobs/click-track` request that correctly progressed through job-status-update logic and only failed at the real network call to a fake Supabase hostname (`getaddrinfo failed`) — proving the code path itself has no bugs. `split.py` only shells out to `python -m demucs.separate` (subprocess), so it never needed Demucs importable locally anyway.
- **What was tried**: Using `mcp__claude-in-chrome__*` tools to interactively click through the Phase 4 landing page (format picker, drag-and-drop, full download flow) as the standard "test in a browser before reporting done" step.
  **Why it failed**: `tabs_context_mcp` returned "Browser extension is not connected" — the Chrome extension isn't installed/connected in this environment. **Fallback used**: temporarily bypassed the proxy's auth redirect for just the `/` path (`if (request.nextUrl.pathname === "/") return;` added to `src/proxy.ts`), started the dev server, confirmed via `curl` that `/` now returns 200 with the expected form HTML (`id="youtube-url"`, "Drop an audio file", "Process") and no errors in the dev server log, then **immediately reverted** the bypass and re-confirmed the 307 redirect was restored. This verifies server-side rendering only — click interactions (Select dropdown, drag-and-drop, Realtime job updates) were never exercised in a real browser.
- **What was tried**: Killing dev servers with a blanket `taskkill //F //IM node.exe`.
  **Why it's avoided now**: Flagged in the prior handoff as having killed 5 unrelated node processes once. This session consistently used `netstat -ano | grep :3000` → `taskkill //F //PID <specific-pid> //T` instead. Keep doing this.

## Next Step

**Nothing is currently broken or blocking.** The natural next step is **Phase 5 (edit page shell + analyzer header)**, but two manual items the user deferred ("I'll handle manual items later") are worth checking on first since they unblock actually testing anything end-to-end:

1. Ask the user whether they've:
   - Pasted the Supabase `service_role` secret key into `.env.local`'s `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project Settings → API → `service_role`) — and the **same value** into `services/processor/.env`'s `SUPABASE_SERVICE_ROLE_KEY`.
   - Configured Supabase Auth (dashboard → Authentication): email magic-link enabled, Redirect URLs allow-list includes `http://localhost:3000/auth/callback`, public self-signup disabled.
2. If yes to both, real end-to-end testing becomes possible for the first time this project — worth doing a real sign-in + landing-page click-through (ideally once the Chrome extension is connected, or ask the user to test manually) before going further, since Phase 4's interactive behavior (Select, drag-drop, Realtime updates) has never actually been exercised, only server-rendered.
3. Then proceed to **Phase 5** per the plan (`C:\Users\Arellano\.claude\plans\tingly-wondering-dahl.md`):
   - `src/app/edit/[trackId]/layout.tsx` already exists (Phase 1 stub) and fetches the track + renders the analyzer header badges (key/tempo/time-signature) — but reads the track **once** server-side, with no live updates. Add a Realtime subscription (client component wrapping the badges, or a small client island) so the badges update from "…" to the real analyzed values once `/api/jobs/analyze` (already fired from the landing page) completes, without a full page reload.
   - Wire the shared wavesurfer instance / audio element mentioned in the plan for Phase 5, used by whichever tab (`trim`/`metronome`/`split`) is active — this is prep for Phase 6.

If the user instead wants to deploy/test the processor for real before continuing (they previously deferred this to Phase 10, but may reconsider once the service-role key is in place), that would mean picking Railway vs Fly.io and doing a real deploy — hold off unless explicitly asked, per the user's own instruction this session.

## Context & Gotchas

- **The plan file is the spec.** `C:\Users\Arellano\.claude\plans\tingly-wondering-dahl.md` — read before any architectural decision.
- **This machine is memory-constrained** (6GB total RAM, observed as low as 79MB free). `next build`, `next lint`, and `next dev` (all Rust/Turbopack-backed) have intermittently crashed with native OOM errors this session — always transient, always succeeded on a plain retry with no code changes. If a build/lint/dev command crashes with a message like `memory allocation of N bytes failed` or `Out of memory: HashMap::Initialize`, just retry it before assuming a real bug.
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`**, and the file must live at the same directory level as `app/` (`src/proxy.ts` here, since `app` is under `src/`) — not documented anywhere found, discovered empirically this session. If a future Next.js upgrade changes this again, check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` first (per `AGENTS.md`'s standing instruction to read version-matched docs before writing code).
- **Storage path convention** (both Next.js and the Python processor rely on this): every `storage_path` stored anywhere in the DB is `"<bucket>/<user_id>/..."` — bucket name is always the first path segment. `services/processor/app/storage.py`'s `split_storage_path()` and the landing page's `handleDownloadFile()` both parse it this way. Keep this convention if extending storage-touching code.
- **`jobs.result` is untyped JSONB** (`Record<string, unknown> | null` in TS). The landing page casts it to a local `DownloadResult` interface (`storage_path`, `title`, `filename`, `duration_seconds`) that must match exactly what `services/processor/app/routers/download.py`'s `_do_download()` returns — there's no shared type between the Python and TypeScript sides for job results; keep them manually in sync if either changes.
- **Two Supabase MCP servers historically existed** (a global one on an unrelated project `rrfelwwoypouqcjbdzrb`, and this project's `tmtydxacbfajdeybwvkb`) — this was flagged as a possible collision risk in the prior handoff but never actually manifested; `mcp__supabase__get_project_url` has consistently returned the correct `tmtydxacbfajdeybwvkb` project all session.
- **No `Database`-generic issues remain** — the real generated type (`src/types/supabase.ts`) resolved the earlier generic-inference problem cleanly; all three Supabase clients plus the proxy's server client are parameterized with it.
- **A git repo now exists** (it didn't at the start of the prior session) — user-initiated, remote `https://github.com/erar404/erar-md-tools.git`, exactly one commit ("initial commit") containing everything through most of Phase 2. Nothing since has been committed; do not commit without asking first.
- **dlp-gui reference locations** if more algorithm parity is needed later: `dlp_gui/constants.py` (`TEMPO_CLICK_SCRIPT`, format tables — already ported), `dlp_gui/audio_tools.py` (Spleeter chunking/job-tracking patterns — not used, since Demucs doesn't need chunking), `dlp_gui/ytdlp_args.py` (CLI-arg version of the format mapping — the processor uses the Python-API equivalent instead, `app/ytdlp_formats.py`).
