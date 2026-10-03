# Handoff

## Goal

MD Tools Web (Next.js 16 + Supabase + Python FastAPI processor on Railway) is an internal, invite-only audio workflow tool for music directors (download from YouTube/upload, trim, click-track/tempo-check, stem-split). Design system: "Backstage Console" (dark obsidian theme, brass/teal/cyan signal colors, Space Grotesk/Manrope/JetBrains Mono), documented in `PRODUCT.md` and `DESIGN.md` at repo root.

This session had two threads, one finished, one still open:

**A. UI work (all done, all shipped):**
1. Login page: iterative redesign across several rounds (continuing from a prior session) — ended with the mascot as a dimmed full-bleed background image, then a follow-up to make it fit one screen with no scrolling by putting the text/feature-slider column and the sign-in card side by side again (`lg:grid lg:grid-cols-[1.3fr_1fr]`).
2. Edit screen: `/edit/[trackId]` no longer auto-redirects to `/trim` — it now shows a "What do you want to do?" chooser (Trim/Metronome/Split, each with a real description), per explicit request.
3. Split tab: fixed a genuine flicker bug (the idle "Split" button was reappearing for a frame right when the job finished, before stems were ready) and replaced the plain "Loading stems…" spinner with a `happy-logo-animated.gif` + rotating status text, cross-faded into the finished mixer via `withViewTransition`.

**B. The demucs OOM saga (still open, actively failing as of the last real test):**
The Track Splitter feature has been failing in production with `demucs separation failed: process was killed by signal 9` (OOM kill) across this entire session and the one before it. Goal: make Split actually work reliably for real users. Constraint discovered early: the Railway processor service (`md-tools-processor`) is hard-capped at **~1GB RAM**, and raising that is a **dashboard-only** action (Railway CLI has no vertical-memory-limit command) that the user has not done yet despite repeated prompts.

## Current State

**UI work (A) is fully shipped and clean.** All three pieces above are committed (see Files section), `eslint`/`tsc --noEmit` pass, and the login page + edit-screen changes were spot-checked live in the browser this session. The split-page flicker fix was **not** live-tested against a real job (would need a real multi-minute split run) but is logically verified by reading the fixed render-gate condition (see that file's section below).

**The OOM issue is NOT resolved.** Timeline of what's been tried, all now live on Railway and all insufficient on their own:
1. Diagnostic-only fix (earlier session): turned a blank `demucs separation failed:` message into a real explanation. This is working correctly — it's the mechanism that's been telling us "signal 9 / OOM" every time since.
2. `DEMUCS_SEGMENT=7` → tested, **still OOM'd** (this session confirmed via `railway metrics` that this was barely a cut from htdemucs's own ~7.8s native segment, so it did almost nothing).
3. `DEMUCS_SEGMENT=4` + code-level `-j 1` (no parallel demucs workers) + BLAS/OpenMP thread caps (`OMP_NUM_THREADS`, `MKL_NUM_THREADS`, `OPENBLAS_NUM_THREADS`, `VECLIB_MAXIMUM_THREADS`, `NUMEXPR_NUM_THREADS`, all `=1`) + a `gc.collect()` after freeing the downloaded source file's in-memory buffer in `download_to()` → deployed, **still OOM'd**. Confirmed via `railway metrics --memory --raw --json` for the exact failing job's timestamp (2026-09-29 18:43 UTC, job `90998c57-78bc-4723-8d12-da038526d34f`): baseline ~67MB, sampled peak only **559MB** (well under the 1GB limit), yet the process was still SIGKILL'd. This means either (a) the real spike happened faster than Railway's 30-second metric sampling can catch, or (b) htdemucs's fixed cost (model weights + baseline torch overhead, independent of segment size) is already large enough on its own that segment tuning has hit its ceiling as a lever.
4. Given (3) still failed, the next lever applied (**this is the newest, least-tested change**): switched `DEMUCS_MODEL` from `htdemucs` (Hybrid Transformer, heavier) to `mdx_extra_q` (older, pure-convolutional, quantized — meaningfully lighter, some quality cost). Set via `railway variable set DEMUCS_MODEL=mdx_extra_q`, confirmed set in `railway variables --kv` output. **As of the end of this session, the Railway service was still showing `Online · Deploying (3m)` and had not yet finished restarting with the new model — nobody has run a real split job against `mdx_extra_q` yet.** This is the single open thread.

**Current live Railway variables on `md-tools-processor`** (confirmed via `railway variables --kv`):
```
DEMUCS_MODEL=mdx_extra_q
DEMUCS_SEGMENT=4
OMP_NUM_THREADS=1
MKL_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
VECLIB_MAXIMUM_THREADS=1
NUMEXPR_NUM_THREADS=1
```
**Memory limit is still ~1GB, unchanged, all session.** Nothing done this session or the prior one has touched it, because it can only be changed via the Railway dashboard (Settings → Resources on the `md-tools-processor` service), which requires the user to do it themselves.

**One-time cost heads-up for `mdx_extra_q`:** if this container has never run that model before, demucs will download its weights from the internet on first use before the first job can start. This should just work (outbound network already works fine for yt-dlp) but adds delay to whichever split job runs first.

## Files Actively Being Edited

Nothing is mid-edit — everything below is committed (working tree is clean; this session's work landed in commits `063617f`, `a9e1174`, `b86537b`, `15cad95`, continuing the same "commits appear without an explicit `git commit` from the assistant" pattern noted in prior handoffs).

**UI (all committed, all shipped):**
- `src/app/login/page.tsx` — final structure: `<main>` has a full-bleed background `<Image>` (`object-[95%_65%] opacity-45`) + two gradient scrims (unchanged from the round before this session), and the content div is now `max-w-5xl` with an `lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-12` splitting headline+feature-slider (left, with `lg:border-r`) from the sign-in card (right) — this is the "no scrolling" fix. Verified via direct DOM measurement in-browser: `main.scrollHeight` now exactly equals `window.innerHeight` (869px both) at the tested viewport, vs. 1099px vs 869px (230px of forced scroll) before.
- `src/app/edit/[trackId]/page.tsx` — no longer `redirect()`s to `/trim`; renders a heading ("What do you want to do?") + `<ToolChooser trackId={trackId} />`.
- `src/components/edit/tool-chooser.tsx` (new) — three linked panels (Trim/Metronome/Split), each with an icon (reusing `edit-tabs.tsx`'s icon choices), a title, and a full descriptive sentence (not just the short hint already in the persistent tab bar). Uses the same `withViewTransitionNav` click-intercept pattern as `EditTabs` for a smooth panel swap instead of a hard navigation.
- `src/app/edit/[trackId]/split/page.tsx` — the actual bug fix: added `preparingStems` (`splitJob?.status === "done" && !stems && !stemsError`), computed at render time instead of depending on the old `loadingStems` effect-driven state, closing a one-frame gap where the idle "Split" button used to flash back before the "loading stems" UI took over. Replaced the plain spinner+"Loading stems…" text with a `happy-logo-animated.gif` + `STEM_LOADING_MESSAGES` array cycling every `STEM_LOADING_MESSAGE_MS` (2200ms). The final `setStems(...)` call is now wrapped in `withViewTransition` for a cross-fade into the finished mixer. Added a `stemsError` state so a genuine decode failure (as opposed to OOM on the split job itself) still falls back to the idle button instead of showing the loading panel forever.

**Processor / demucs memory work (all committed, deployed, and confirmed still insufficient — see Current State):**
- `services/processor/app/config.py` — `DEMUCS_SEGMENT` now defaults to `"4"` in code (was previously unset-by-default, opt-in only). New `DEMUCS_SUBPROCESS_ENV_OVERRIDES` dict (OMP/MKL/OPENBLAS/VECLIB/NUMEXPR thread caps, all default `"1"`, each overridable via its own env var).
- `services/processor/app/routers/split.py` — `_do_split`'s demucs command now includes `-j 1`; the `subprocess.run(...)` call now passes `env={**os.environ, **DEMUCS_SUBPROCESS_ENV_OVERRIDES}`.
- `services/processor/app/storage.py` — `download_to()` now does `del data; gc.collect()` after writing the downloaded bytes to disk, to stop the downloaded source file's buffer from permanently inflating the parent uvicorn worker's RSS baseline (CPython/glibc rarely return freed heap to the OS otherwise).

**Explicitly NOT done, considered and deliberately deferred:** rewriting `download_to`/`upload_file` to stream directly over HTTP (bypassing the Supabase Python SDK's full-buffer `.download()`) instead of the `gc.collect()` band-aid. This would be a bigger real memory win but means hand-rolling the Storage REST calls (auth headers, endpoint shape) used by **every** job type (download, analyze, split, mixdown) with no way to test it against the live deployment first — flagged to the user as available but higher-risk, not yet approved.

## Failed Attempts

- **What was tried**: `DEMUCS_SEGMENT=7` (first mitigation, prior session). — **Why it failed**: htdemucs's own native training segment is ~7.8s, so 7 was barely a reduction from its default; confirmed still OOM'ing via `railway logs`.
- **What was tried**: `DEMUCS_SEGMENT=4` + `-j 1` + BLAS/OpenMP thread caps + `gc.collect()` on the downloaded-file buffer (this session's first round of fixes). — **Why it failed**: Still SIGKILL'd (signal 9) on a real job. Correlating `railway metrics --memory --raw --json` against the failing job's exact timestamp showed the sampled peak was only 559MB, well under the 1GB limit — meaning either the real spike is faster than the 30-second metric sampling window, or htdemucs's fixed model-loading cost alone is close to the ceiling regardless of segment size. This is the strongest evidence yet that segment-length tuning alone cannot fix this for the `htdemucs` model on a 1GB container.
- **What was tried (this session, earlier)**: `railway service restart --service md-tools-processor --yes` right after a `railway variable set` call. — **Why it failed / note**: Errored once with "Deployment is not restartable" — turned out the variable-set itself had already auto-triggered a restart/redeploy before the explicit restart command ran, so the error was harmless (a race, not a real failure). Don't assume a restart is needed after `railway variable set` on this project; it appears to auto-redeploy. Use `railway status` to check `Online · Initializing`/`Deploying` before issuing a manual restart.
- **Considered, not attempted**: SSH into the Railway container to inspect anything directly (e.g., check actual resident memory of the demucs process, or verify exact demucs CLI flags). — **Why not attempted**: An earlier session had this hard-blocked by the platform's own auto-mode permission classifier under "Production Reads," with explicit instructions not to route around it. Has not been retried since; assume it's still blocked.

## Next Step

**Do this first**: check whether the `mdx_extra_q` deploy finished (`cd services/processor && railway status` — look for `Online` without `Initializing`/`Deploying` suffix), then run a real split job (a real user, via the app UI, or ask the user to trigger one) and watch it:
```
cd services/processor
railway logs -d --lines 30              # look for a NEW "Job ... failed" or a success, not the old 90998c57 one
railway metrics --memory --raw --json --since "<job start time>Z" --until "<job start time + 5min>Z"
```
Compare peak `MEMORY_USAGE_GB` against `MEMORY_LIMIT_GB` (~1.024) the same way this session did for job `90998c57-78bc-4723-8d12-da038526d34f`.

- **If `mdx_extra_q` succeeds**: tell the user, and note the quality tradeoff (older/lighter model) so they can decide if it's acceptable long-term, or whether they'd rather raise the memory limit and switch back to `htdemucs`.
- **If `mdx_extra_q` still OOMs**: the code-level levers are now genuinely exhausted (segment size, threading, model choice, subprocess env, download buffering have all been tried). At that point, stop proposing further code tweaks and say so plainly — the only remaining fix is raising the Railway memory limit via the dashboard (Settings → Resources on `md-tools-processor`, this is **not** possible via `railway` CLI, confirmed this session and the prior one). Push for the user to actually do this rather than accepting another round of "try one more code thing."

## Context & Gotchas

- **Auto-commit behavior continues**: for the third session in a row, code changes ended up committed to `master` (`063617f`, `a9e1174`, `b86537b`, `15cad95`) without the assistant ever running `git commit`. Always run `git status`/`git log` fresh at the start of any resumed work; never assume "uncommitted."
- **Railway CLI specifics learned this session**:
  - `railway variable set KEY=VALUE [KEY2=VALUE2 ...] --service <name>` sets multiple vars in one call (the older `--set` flag on `railway variables` only takes one pair and is marked legacy).
  - `--skip-deploys` avoids triggering a restart for a variable change — useful when the currently-deployed code doesn't read that variable yet, so there's no reason to disrupt the running service.
  - Without `--skip-deploys`, setting a variable appears to auto-trigger a restart/redeploy on its own; a manual `railway service restart` issued right after can race it and fail harmlessly with "Deployment is not restartable."
  - `railway metrics --memory --raw --json --since <ISO> --until <ISO>` gives 30-second-resolution `MEMORY_USAGE_GB`/`MEMORY_LIMIT_GB` time series — this is the tool that confirmed the 559MB-peak-yet-still-killed finding. Get a job's exact timestamp from the `jobs` table (`created_at`) via the Supabase MCP `execute_sql` tool first, then window the metrics query tightly around it.
  - `railway ssh` for even a read-only command (e.g. checking demucs's actual installed CLI flags) is hard-blocked by the platform's auto-mode classifier under "Production Reads." Don't retry it.
- **Local machine memory** wasn't specifically re-checked this session (no `npm run build`/`dev` server restarts were needed since this session's work was mostly reviewed via `eslint`/`tsc` plus browser checks against the already-running dev server on port 3000, PID 23196 — same one that's survived across at least four sessions now). Worth a fresh check next time before any build.
- **Design system reminder** (`PRODUCT.md`/`DESIGN.md` at repo root): "Backstage Console" theme — dark obsidian, brass/teal/cyan signal colors, no box-shadow, hairline borders, 4px hardware corners on controls/8px on cards. The login page's full-bleed background photo remains a deliberate, explicitly-requested exception to the flat/tonal-tier elevation model; don't "clean it up" without checking with the user.
- **`AGENTS.md`/`CLAUDE.md`**: this Next.js version (16) renames Middleware to **Proxy** (`src/proxy.ts` + `src/lib/supabase/proxy.ts`, not `middleware.ts`). Check `node_modules/next/dist/docs/` before assuming standard Next.js behavior on anything unfamiliar.
- **The org's admin instructions** (RGMC Group company structure, top of system prompt) are irrelevant to this codebase — noted only so a future session isn't confused by their presence.
