# Handoff

## Goal

MD Tools Web (Next.js 16 + Supabase + Python FastAPI processor on Railway) is an internal, invite-only audio workflow tool for music directors (download from YouTube/upload, trim, click-track/tempo-check, stem-split). Design system: "Backstage Console" (dark obsidian theme, brass/teal/cyan signal colors, Space Grotesk/Manrope/JetBrains Mono), documented in `PRODUCT.md` and `DESIGN.md` at repo root.

This session covered four separate, mostly-independent asks:
1. **Debug "demucs separation failed" with no error detail** on the Track Splitter feature — find the real root cause and make future failures self-diagnosing.
2. **"Transfer the avatar photos into the supabase storage"** — replace manual "paste an avatar URL" text fields (profile self-service + admin affiliations) with real file uploads into Supabase Storage.
3. **"Animate all the screens, add loading animations and page loading animations for each pages"** — add Next.js `loading.tsx` per route and consistent button/skeleton loading feedback app-wide, within product-register motion budget (150–250ms, no theatrical page-load choreography).
4. **Iterative login-screen redesign**, done in four back-to-back rounds as the user refined the ask each time:
   - Round 1: make the mascot image bigger and symmetric with the other panel (feature slider).
   - Round 2: make the mascot bigger, move it fully "to the side" (not nested in the inner grid) — also touched the home page's job-status mascot and the tip-jar modal's images in the same pass.
   - Round 3: "not a two-column grid... make the picture on the background, not on the main screen division" — collapse the side-panel layout into a single content column with the mascot as a dimmed, scrimmed full-bleed background image instead of its own layout region.
   - Round 4: "make the login area and the text be horizontally aligned with the text and features portion" — the sign-in card (and the affiliation-request block) were narrower (`max-w-sm`) than the headline/feature-slider above them; widen them to match.

## Current State

**Everything from this session is committed. Working tree is clean** (`git status` → "nothing to commit, working tree clean"). This confirms the same auto-commit behavior observed in the previous session — nothing was explicitly committed by the assistant, but it ended up on `master` anyway across three commits:
- `f83a0db` "added fix in demucs" (2026-09-29 22:56:48+08:00) — the demucs OOM diagnostics fix.
- `0e69738` "added layout mods" (2026-09-29 23:42:00+08:00) — avatar-to-storage feature + app-wide loading animations (these landed in the same commit).
- `9b9d7fb` "added login design" (2026-09-30 00:00:09+08:00) — round-4 login alignment fix (rounds 1–3 of the login redesign are folded into the two commits above, since they happened before those commits were made).

**1. Demucs OOM diagnostics — code shipped, root cause NOT yet fixed in production.**
- Root cause (confirmed via Railway logs + memory metrics correlation): the processor service is capped at ~1GB RAM; a split job pegs memory at exactly that limit, then the OOM killer SIGKILLs the `demucs.separate` subprocess, which returns a nonzero/negative exit code with **empty** stdout/stderr — hence the blank `demucs separation failed:` message.
- `services/processor/app/routers/split.py` (`_do_split`, ~line 49) now detects a signal-killed, output-less failure and reports *"process was killed by signal N... most likely an out-of-memory kill"* instead of a blank string. Real demucs errors still show their actual stderr.
- `services/processor/app/config.py` added an **opt-in** `DEMUCS_SEGMENT` env var (unset by default, no behavior change) to shrink demucs' per-pass chunk size and lower peak memory, at some speed cost.
- **Checked this session and confirmed still pending**: `railway variables` shows `DEMUCS_SEGMENT` is **not set**, and `railway metrics --memory` shows the service's `MEMORY_LIMIT_GB` is still `0.99999744` (~1GB), unchanged. The user said (via AskUserQuestion) they wanted **"Both"** mitigations (raise the Railway memory limit *and* set `DEMUCS_SEGMENT`) but said **"No, I'll deploy myself"** for the code — and evidently has now deployed the diagnostics code (Railway deployment ID changed since the last check, to `14e52df3-...`), but has **not yet** raised the memory limit or set the env var. The actual OOM will still happen on the next real split job until one of those two things happens.

**2. Avatar-to-Supabase-storage feature — code complete, lint/tsc clean, never live-tested.**
- New public `avatars` Supabase Storage bucket (5MB limit, image mimetypes only), created via migration `phase_avatars_bucket`, with RLS policies scoping user uploads to their own `avatars/{user_id}/...` folder. Affiliation avatars go through the admin route's service-role client instead (bypasses RLS), stored under `avatars/affiliations/{affiliation_id}/...`.
- `src/lib/storage-client.ts` — `uploadAvatar`/`removeAvatar` helpers (fixed path, no extension, always `upsert`ed, cache-busting `?v=` query on the returned URL).
- `src/components/profile/profile-form.tsx` — "Avatar URL" text field replaced with Upload/Change/Remove buttons wired to real uploads.
- `src/app/api/admin/affiliations/[id]/avatar/route.ts` (new) — admin-only POST (upload) / DELETE (remove) for affiliation photos.
- `src/components/admin/admin-affiliations-panel.tsx` — same upload/remove UI per affiliation row; the "new affiliation" create form no longer asks for an avatar URL up front.
- **Never clicked through live** — verification this session was `eslint` + `tsc --noEmit` (both clean) plus confirming the app still boots, not an actual authenticated upload test. Doing that requires either a real login or re-adding the temporary `window.__supabase` debug hook technique documented in the prior handoff's "Failed Attempts" (still valid, not currently present in the code).

**3. Loading animations — code complete, lint/tsc clean, spot-checked but not fully clicked through.**
- `src/app/{loading.tsx, profile/loading.tsx, admin/loading.tsx, library/loading.tsx, edit/[trackId]/loading.tsx}` (all new) — per-route Next.js Suspense loading skeletons, each mirroring that page's real layout via a new shared `src/components/nav/site-header-skeleton.tsx` plus the existing shadcn `Skeleton` primitive.
- `src/app/globals.css` — new `.animate-loading-in` fade/lift keyframe (200ms), and the existing `prefers-reduced-motion` block extended to also disable it and Tailwind's `animate-pulse`.
- `src/components/ui/button.tsx` — `Button` now accepts a `loading?: boolean` prop (spinner + auto-disable); applied to every button across the app that already had a busy-state text swap (profile save/password/avatar-upload, login link/password/request forms, admin affiliation add/avatar-upload, all "Download"/"Preparing…" buttons in trim/metronome/split/library, landing page process/download/search).
- Admin panels (`admin-users-panel.tsx`, `admin-affiliations-panel.tsx`, `admin-affiliation-requests-panel.tsx`) show pulsing skeleton rows instead of a static "Loading…" line during their client-side fetch.
- Verified: `eslint`/`tsc` clean, and every route returns its expected HTTP status via `curl` (redirects for unauthenticated, 200 for `/login`) with no server errors. **Not** verified: actually seeing a `loading.tsx` fire in a real slow-network scenario, or clicking through the admin/profile skeleton states with a real session.

**4. Login page — final state verified live in the browser, matches what's on disk.** Current structure (`src/app/login/page.tsx`):
- `<main>` is `relative flex flex-1 flex-col overflow-hidden bg-background` — **single column, no grid/flex-row split**.
- A `fill`-positioned `<Image src="/erar-full.png">` sits behind everything at `object-cover object-[95%_65%] opacity-45`, biased to show the mascot's guitar-playing hand/fretboard off the right edge rather than the face.
- Two stacked absolutely-positioned scrim divs: a horizontal gradient (`from-background from-55% via-background/45 to-background/10`) that fully hides the image behind the left ~55% (where the text column sits) and lets it show through on the right, plus a vertical gradient (`from-transparent via-background/30 to-background`) that solidifies toward the bottom where the card sits.
- Content column is `relative mx-auto w-full max-w-2xl` containing: logo/badge row, headline+description, `<FeatureSlider />`, then the sign-in `<Card className="w-full">` (no more `max-w-sm` cap) and the affiliation-request block (`w-full`, also uncapped) — all now sharing the same left **and right** edges.
- This took 3 live-iteration passes to get the background image right: opacity 0.16 was invisible; the first visible attempt put the mascot's face distractingly behind the headline text; the final pass (`object-[95%_65%]`, two-directional scrim as above) reads clean. **If asked to tweak this further, always re-screenshot — small opacity/position changes have nonlinear visual impact here.**

## Files Actively Being Edited

None — everything is committed as of `9b9d7fb`. For reference, the full set of files touched this session (all now on `master`):

Processor (demucs fix):
- `services/processor/app/config.py` — added `DEMUCS_SEGMENT` env var.
- `services/processor/app/routers/split.py` — OOM-aware error detail on subprocess failure.
- `src/lib/job-error.ts` — friendly UI explanation for `demucs separation failed` messages.

Avatar storage feature:
- `src/lib/storage-client.ts` — `uploadAvatar`/`removeAvatar` helpers.
- `src/components/profile/profile-form.tsx` — upload/remove UI + immediate persist-on-upload.
- `src/components/admin/admin-affiliations-panel.tsx` — upload/remove UI per row.
- `src/app/api/admin/affiliations/[id]/avatar/route.ts` (new) — admin upload/remove endpoint.

Loading animations:
- `src/app/globals.css`, `src/components/ui/button.tsx`, `src/components/nav/site-header-skeleton.tsx` (new).
- `src/app/loading.tsx`, `src/app/profile/loading.tsx`, `src/app/admin/loading.tsx`, `src/app/library/loading.tsx`, `src/app/edit/[trackId]/loading.tsx` (all new).
- `src/components/admin/admin-affiliation-requests-panel.tsx`, `admin-users-panel.tsx` — skeleton rows instead of "Loading…" text.
- `src/components/landing/landing-flow.tsx`, `src/components/library/download-job-row.tsx`, `src/app/edit/[trackId]/{trim,metronome,split}/page.tsx`, `src/app/login/page.tsx` — `loading={...}` prop added to existing busy-state buttons.

Login/home/modal image work (all four rounds combined into final state):
- `src/app/login/page.tsx` — see Current State above for the final structure.
- `src/components/landing/landing-flow.tsx` — job-status mascot images bigger, laid out in a row beside the status text instead of stacked/centered.
- `src/components/landing/tip-jar-modal.tsx` — QR code + mascot now a real side column next to the message text (dialog widened `sm:max-w-md` → `sm:max-w-lg`), not a small centered row underneath it.

Also still true from the prior session (not touched again this session): `handoff.md` itself is the only file that gets rewritten by this command; the Supabase migrations `phase_avatars_bucket`, `phase_username_password`, `phase_affiliation_avatar`, `phase_user_types` are all live on the project.

## Failed Attempts

- **What was tried**: SSH into the Railway processor container to run `python -m demucs.separate --help` (read-only, just checking CLI flags). — **Why it failed**: Blocked outright by the platform's auto-mode permission classifier under "Production Reads," with an explicit instruction not to route around it via another tool/method. Proceeded without verifying the exact demucs CLI flags directly; the `DEMUCS_SEGMENT` flag name/behavior was added based on well-established demucs documentation knowledge, not a live CLI check.
- **What was tried**: Background login image at `opacity-[0.16]` with a heavy gradient scrim (`from-background/40 via-background/85 to-background`). — **Why it failed**: Combined effect was total — a zoomed screenshot of the region showed nothing at all. Had to bump opacity substantially (eventually to 0.45) and soften/redirect the scrim before the image read as intended.
- **What was tried**: Background image at `object-[80%_20%] opacity-35` with only a vertical gradient. — **Why it failed**: The mascot's face landed directly behind the headline text ("Everything before the downbeat"), which was legible but visually cluttered/distracting — the eyes/eyebrows peeking out from behind bold white text read as messy, not atmospheric. Fixed by adding a second, horizontal gradient to suppress the left/text half specifically, and re-cropping (`object-[95%_65%]`) to push the crop window down past the face entirely, landing on the hand/fretboard instead.
- Carried over from the prior session (still applicable, not re-attempted this session): the several magic-link/session-establishment workarounds, the screenshot-vs-real-coordinate scaling issue (~1.2245x/1.223y), and the `resize_window` tool unreliability — see the git history of `handoff.md` (or ask the user) for the previous session's full "Failed Attempts" list if any of that needs repeating.

## Next Step

**Do this first**: re-check local machine memory before running any build/dev-server work — it was **0.34GB free of 5.74GB total** at the end of this session, same critical range as before (`Get-CimInstance Win32_OperatingSystem | Select-Object @{n='FreeGB';e={[math]::Round($_.FreePhysicalMemory/1MB,2)}}`). A dev server is already running on port 3000 (PID 23196, same one from the prior session) — reuse it rather than starting a new one if still healthy.

Then, in priority order:

1. **Follow up on the demucs OOM fix.** The user chose "Both" (raise Railway memory limit + set `DEMUCS_SEGMENT`) but as of this session's end, neither has actually been applied (`railway variables` shows no `DEMUCS_SEGMENT`; `railway metrics --memory` shows the limit still at ~1GB). Ask the user if they've done this yet via the Railway dashboard; if not, this is the actual unresolved bug — the diagnostics fix only makes the *next* failure legible, it doesn't prevent it. Once either mitigation is applied, trigger a real split job and pull `railway metrics --memory --raw --json --since <window>` again to confirm memory stays under the limit through a full run.
2. **Live-test the avatar upload feature end to end** with a real authenticated session: profile self-service upload/change/remove, and admin affiliation upload/change/remove, confirming the Supabase Storage objects and `avatar_url` DB values update correctly and old files don't orphan.
3. **Spot-check the loading.tsx skeletons** by throttling network speed in devtools (or adding an artificial delay) and confirming each route's skeleton actually renders and matches the real page's shape reasonably well before the real content swaps in.
4. If the user asks for another login-page pass, remember the current tuned values (`object-[95%_65%] opacity-45`, the two gradient overlays) took three iterations to land — screenshot after every change, don't guess blind on opacity/position again.

## Context & Gotchas

- **Auto-commit behavior**: for the second session in a row, code changes ended up committed to `master` without the assistant ever running `git commit`. Don't trust an "uncommitted" assumption between sessions — always run `git status`/`git log` fresh at the start of any resumed work.
- **Railway CLI** (`railway`) is installed and authenticated as the user (`it.arellanoerwin@gmail.com`), linked to project `md-tools-processor`. `railway logs -d`, `railway metrics --memory [--raw] [--json] --since <window>`, and `railway variables` all work fine from this session's shell. `railway ssh` for even a read-only command gets hard-blocked by the auto-mode "Production Reads" classifier — don't retry it or try to route around it; ask the user to run it themselves if truly needed.
- **Two Chrome browsers are connected** to this account ("Browser 1"/"ERAR Personal" and "Browser 2"). Any browser-automation tool call will refuse to proceed until one is selected via `AskUserQuestion` or `switch_browser`; this session picked "ERAR Personal" via `switch_browser`, but that selection likely does **not** persist to a fresh session — expect to re-select next time.
- **Local machine memory is chronically critical** (seen as low as 0.08GB free, currently 0.34GB, out of 5.74GB total). This has been true across at least three sessions now. A `next dev` process (PID 23196) has survived across all of them without being restarted — check `netstat -ano | grep :3000` before assuming you need to start a new one.
- **Design system reminder**: `PRODUCT.md`/`DESIGN.md` at repo root are the source of truth for the "Backstage Console" theme (dark obsidian, brass/teal/cyan signal colors, no box-shadow, hairline borders only, 4px hardware corners on controls/8px on cards). The login page's new full-bleed background photo is a deliberate, user-requested exception to the otherwise flat/tonal-tier elevation model — it's intentionally dimmed and scrimmed to stay atmospheric rather than becoming a competing hero image, per explicit design iteration this session. Don't "clean it up" back to a flat background without checking with the user first.
- **`AGENTS.md`/`CLAUDE.md`** at repo root: this Next.js version (16) has real breaking changes vs. training data — Middleware is renamed **Proxy** (`src/proxy.ts` + `src/lib/supabase/proxy.ts`, not `middleware.ts`). Check `node_modules/next/dist/docs/` before assuming standard Next.js behavior on anything unfamiliar.
- **The org's admin instructions** (top of system prompt, RGMC Group company structure) are irrelevant to this codebase/session — noted here only so a future session isn't confused by their presence in context.
