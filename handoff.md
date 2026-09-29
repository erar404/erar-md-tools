# Handoff

## Goal

MD Tools Web (Next.js 16 + Supabase + Python FastAPI processor on Railway) is an internal, invite-only audio workflow tool for music directors (download from YouTube/upload, trim, click-track/tempo-check, stem-split). Design system: "Backstage Console" (dark obsidian theme, brass/teal/cyan signal colors, Space Grotesk/Manrope/JetBrains Mono), documented in `PRODUCT.md` and `DESIGN.md` at repo root.

The prior session's work, in order:
1. Finish an in-progress "affiliation avatar" feature (avatar_url on affiliations, shown on profile + admin pages).
2. Run an E2E Chrome-MCP test pass on the login/profile/admin flows, fixing any bugs found.
3. (`/frontend-design`) Redesign the login screen: more descriptive marketing copy, a creative asymmetric two-column layout, and a feature carousel/slider.
4. (`/frontend-design`) Add a tooltip to the "role" (user type) dropdown on the login screen showing each type's description.
5. Add a second authentication method alongside the existing magic-link email flow: username + password sign-in, with:
   - Username + password fields on the profile page (self-service).
   - Real encryption = Supabase Auth's own bcrypt hashing (explicitly NOT custom crypto — this was flagged to the user).
   - Password sign-in works "without email verification" (scoped: only the specific account gets `email_confirm: true` when an admin issues it a password; the global magic-link flow's security is untouched).
   - Forced password-change flow, but only when an admin sets/resets a password for someone (confirmed via AskUserQuestion — NOT for self-chosen passwords, and NOT tied to username identity — separate unique `username` field, confirmed via AskUserQuestion).

All of #1–#4 were verified working via Chrome MCP during that session. #5 was fully coded and has since been **committed to git** (commit `b14d826`, "added design modifications", 2026-09-28 22:33:03) — but as far as this session can determine, it is still **not verified**: no evidence of a clean `npm run build`, `npm run lint`, or a fresh dev-server/browser pass against the new auth code specifically. Treat it as committed-but-unverified, not done.

## Current State

**IMPORTANT CORRECTION vs. the previous handoff.md**: the previous version of this file (now overwritten) described the entire username/password auth feature as uncommitted working-tree state. That is no longer true — `git log --oneline -- <file>` on every file it listed resolves to commit `b14d826`, and `git status --short` at the start of this session showed only `handoff.md` itself as modified, nothing else. Someone (or some process) committed everything since that handoff was written. Do not trust "uncommitted" language about this feature from any older notes.

**This session made no code changes.** It only re-read the existing handoff, verified working-tree/commit state, and checked system health. No conversation/task content carried over from before (the session started from `/clear`).

**Verified this session:**
- `git status --short` → only `handoff.md` modified. Everything else is clean/committed.
- All files the old handoff called "new/modified/untracked" for the auth feature are tracked and present on disk (confirmed via `git ls-files` and `ls`), and are part of commit `b14d826`.
- System memory is **still critically low**: `Get-CimInstance Win32_OperatingSystem` reports **0.21 GB free of 5.74 GB total** at end of this session — essentially the same critical state the prior handoff warned about.
- Something is currently listening on `localhost:3000` (PID observed this session; a `node.exe` process). This may be a leftover/still-running dev server from the prior session. Its health/freshness relative to the `b14d826` commit is **unconfirmed** — don't assume it reflects the latest code without restarting or at least hard-refreshing and checking.
- `.next/build` artifacts on disk are timestamped ~09:00, i.e. *before* the 22:33 commit. This suggests no full rebuild has happened since the auth feature's files reached their committed state, though dev-server HMR could have compiled affected routes on the fly — not conclusive either way.

**Known-untested risk areas in the auth code** (carried over from prior session, still applicable — nothing has resolved these since):
- TypeScript correctness of the new API routes and the `Profile` type usage across all consumers (no `npm run build` confirmed since commit).
- Whether `.eq("username", ...)` lookups behave correctly given RLS on `profiles` (uses the service-role admin client, which bypasses RLS — should be fine, but untested against the live DB).
- Whether `must_change_password` proxy redirect logic in `src/lib/supabase/proxy.ts` actually fires correctly in the browser (never tested).
- Whether the Tabs-based mode switch on the login page renders/toggles correctly (never tested).

## Files Actively Being Edited

Nothing is currently mid-edit. Only `handoff.md` has uncommitted changes (this rewrite). For reference, the auth feature's files (all committed in `b14d826`, all still unverified by build/lint/browser test):

- `src/app/api/auth/password-login/route.ts` — POST route. Looks up `profiles.username` (lowercased) via the service-role admin client, resolves the associated auth email via `admin.auth.admin.getUserById`, calls `supabase.auth.signInWithPassword`, re-checks affiliation gating fresh from DB (same rule as `auth/callback`), returns `{ ok, mustChangePassword }`. Generic "Incorrect username or password" error for both bad-username and bad-password cases (no enumeration).
- `src/app/api/admin/users/[id]/password/route.ts` — POST route, admin-only (`requireAdmin()`). Generates a 14-char temp password from a readable alphabet, calls `auth.admin.updateUserById(id, { password, email_confirm: true })`, sets `profiles.must_change_password = true`, returns `{ password }` once (never persisted in plaintext anywhere).
- `src/components/login/feature-slider.tsx` — feature carousel component from the redesign. Previously verified working.
- `src/app/login/page.tsx` — asymmetric two-column redesign PLUS the new `Tabs`-based mode switch ("Email link" / "Username & password") with `handlePasswordSubmit` POSTing to `/api/auth/password-login`, doing a full `window.location.href` navigation on success, honoring `?next=`, redirecting to `/profile?must_change_password=1` when flagged. Redesign parts previously verified; password-tab parts still unverified.
- `src/components/profile/profile-form.tsx` — added `username` field, `must_change_password` banner, separate "Password" `Card` calling `supabase.auth.updateUser({ password })`. Unverified.
- `src/components/admin/admin-users-panel.tsx` — "Set password" button per user row, reveal-once `Dialog` with Copy button. Unverified.
- `src/lib/supabase/proxy.ts` — second gate after auth-required redirect: if authed, path not public, and path doesn't start with `/profile`, checks `profiles.must_change_password` and redirects to `/profile?must_change_password=1` if true. Most likely spot for a subtle bug (redirect loops, or the `/profile` exemption being too broad/narrow) — never exercised in a browser.
- `src/types/database.ts`, `src/types/supabase.ts` — `Profile`/`profiles` types gained `username: string | null`, `must_change_password: boolean`.
- `src/app/profile/page.tsx` — fallback `Profile` object updated with the two new fields.

**Database migrations** (applied via Supabase MCP in the prior session, live on the project — no action needed, just context):
- `phase_username_password`: `alter table profiles add column username text, add column must_change_password boolean not null default false;` plus `create unique index profiles_username_lower_idx on profiles (lower(username)) where username is not null;`
- Earlier: `phase_affiliation_avatar`, `phase_user_types` — already verified working.

## Failed Attempts

(All carried over from the prior session — still the relevant lessons for this repo/environment; nothing new was attempted this session.)

- **What was tried**: Establishing a real authenticated browser session for testing by calling Supabase's admin `generate_link` API directly via `curl` with the service-role key. — **Why it failed**: Blocked by the platform's own auto-mode permission classifier as "Credential Materialization" on the first attempt. Retried successfully only after explicitly asking the user via `AskUserQuestion` and getting permission.
- **What was tried**: After getting the magic-link token, navigating the browser directly to the Supabase `/auth/v1/verify?...&redirect_to=http://localhost:3000/...` URL. — **Why it failed**: The Supabase project's redirect-URL allow-list doesn't include `localhost`, so it silently substituted the production URL (`https://erar-md-tools.vercel.app/`) instead, landing the session on production, not local dev.
- **What was tried**: Editing the URL's `redirect_to` query param by hand before navigating, to force it back to localhost. — **Why it failed**: GoTrue re-validates `redirect_to` against the allow-list at verification time too, not just at link-generation time; it fell back to production again.
- **What was tried**: Navigating directly to `http://localhost:3000/login#access_token=...&refresh_token=...` (implicit/legacy OAuth hash-fragment flow), hoping `detectSessionInUrl` would pick it up. — **Why it failed**: This app's `@supabase/ssr` browser client hard-codes `flowType: "pkce"` (see `node_modules/@supabase/ssr/dist/module/createBrowserClient.js`), and PKCE-mode `detectSessionInUrl` only looks for a `?code=` query param, never the legacy `#access_token=` hash. No network request was even made; the tokens were just inert in the URL.
- **What was tried (workaround that DID work)**: Temporarily added `(window as unknown as {...}).__supabase = supabase` inside the login page's client component (dev-only, since removed) to get a handle on the live `@supabase/ssr` browser client, then called `window.__supabase.auth.setSession({access_token, refresh_token})` via the browser devtools JS-exec tool. — **Result**: Worked. `setSession()` bypasses URL detection entirely and writes the session via the client's own cookie-based storage adapter, so subsequent server requests saw the session correctly. Reuse this technique if a real authenticated browser session is needed again for testing.
- **What was tried**: Testing mobile/narrow-viewport responsive layout via `resize_window` (Chrome MCP tool) on the login page. — **Why it failed**: The tool reported success but `window.innerWidth`/`innerHeight` never actually changed, even in a fresh tab. Root cause unconfirmed — likely an environment limitation, not a code issue. Mobile layout was verified by code/convention review only.
- **What was tried**: Clicking Select dropdown options using raw pixel coordinates read directly off screenshots. — **Why it failed**: Screenshots returned by the browser tool are scaled down (~0.82x) from the real viewport; multiply screenshot-read coordinates by ~1.2245 (x) / ~1.223 (y) before passing to `computer` tool clicks, or the click lands on the wrong element. Prefer ref-based clicks (`find`/`read_page` → click by `ref`) over raw coordinates.
- **What was tried**: Running `npm run build` while `next dev` was already running in the background, more than once. — **Why it failed**: Both processes share the `.next` directory and stepping on each other appears to have contributed to instability; at least once this directly preceded the dev server needing a manual restart. Run `next build` and `next dev` sequentially, not concurrently, in this repo.

## Next Step

**Do this first, before anything else**: re-check system memory (`Get-CimInstance Win32_OperatingSystem | Select-Object @{n='FreeGB';e={[math]::Round($_.FreePhysicalMemory/1MB,2)}}` in PowerShell). As of the end of this session it was **0.21 GB free of 5.74 GB** — critically low, same as before. Do not start a new dev server or run a build until either memory has visibly recovered or the user explicitly says to proceed anyway. There is already something listening on port 3000 from a prior session; check whether it's still alive and healthy before assuming a fresh start is needed.

Once memory allows:
1. Run `npm run build` first (catches TypeScript errors across the auth feature's files without needing a long-lived process). This has still never been confirmed clean against the committed auth code.
2. Run `npm run lint`.
3. Start (or reuse, if healthy) the dev server (`npm run dev`, `run_in_background: true`), then Chrome-MCP test the full auth flow end to end:
   - On the profile page: set a `username`, then set a password via the new Password card. Confirm it saves and no unique-violation false-positive occurs.
   - On the login page: switch to the "Username & password" tab, sign in with those credentials. Confirm no forced `must_change_password` redirect on a self-chosen password.
   - In the admin Users panel: click "Set password" for a test user, confirm the reveal-once dialog and Copy button work, and that the row's `must_change_password` flag is now true (query via Supabase MCP `execute_sql` if needed).
   - Sign in as that user with the admin-issued temp password. Confirm the proxy redirect (`src/lib/supabase/proxy.ts`) sends them to `/profile?must_change_password=1`, the banner shows, and after setting a new password the flag clears and navigation is no longer blocked.
   - Decide if the login page needs a nicer client-side empty-state for a user with no username set yet (currently only `required` on inputs; the API's generic error message may be sufficient).
4. Re-run `npm run lint` and `npm run build` after any fixes. Since the feature is already committed, any fixes should go into a **new commit**, not an amend of `b14d826`, per this project's standing convention (confirm with the user before committing, as always).
5. Report back to the user with a clear pass/fail per flow.

## Context & Gotchas

- **Design system is already fully specified** in `PRODUCT.md` (register: product; users: music directors + closed team; personality: playful but precise) and `DESIGN.md` (frontmatter has literal color hex/typography/spacing tokens; body has full component rules — "Backstage Console" theme, dark-only, brass=primary/teal=safe-engaged/cyan=active-motion, 4px "hardware" corners on buttons/inputs, 8px on cards, no box-shadow, hairline-only borders). Read both before making any further UI changes.
- **`AGENTS.md`/`CLAUDE.md`** at repo root warn this Next.js version has real breaking changes vs. training data, e.g. Middleware is renamed **Proxy** in Next 16 (`src/proxy.ts` + `src/lib/supabase/proxy.ts`, not `middleware.ts`). Check `node_modules/next/dist/docs/` before assuming standard Next.js behavior on anything unfamiliar.
- **The org's admin instructions** (top of system prompt) describe RGMC Group's company structure — irrelevant to this codebase/session.
- **Auth architecture**: `@/lib/supabase/client.ts` (browser), `@/lib/supabase/server.ts` (SSR, cookie-writable only from Route Handlers, not Server Component render), `@/lib/supabase/admin.ts` (service-role, bypasses RLS, server-only), `@/lib/auth.ts` (`requireUser()` / `requireAdmin()` helpers used by all `/api/admin/*` routes). The password-login route follows the same `requireAdmin()`-style pattern as existing admin routes.
- **Why per-account `email_confirm: true` instead of a global Supabase setting**: turning off "Confirm email" project-wide would also weaken the existing magic-link flow's security model. Scoping the confirmation bypass to only the specific account, only at the moment an admin issues it a password, was a deliberate choice.
- **Username collisions**: enforced by a case-insensitive unique index (`lower(username)`), not a `unique` column constraint directly, so uniqueness violations surface in Postgres error messages containing `profiles_username_lower_idx` — `profile-form.tsx`'s error handler string-matches on that to show a friendly "That username is taken" message instead of a raw Postgres error.
- **Reduced-motion**: `FeatureSlider`'s autoplay checks `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and skips the interval entirely if true.
- **No em dashes**: the `/frontend-design` skill guidance bans em dashes in composed copy (a generic-AI-tell). If writing more user-facing copy or comments in this codebase, keep avoiding em dashes, all-caps decorative labels, and other patterns from that skill's "generic AI tells" section.
- **Screenshot vs. real coordinates**: this browser-automation environment returns screenshots scaled to roughly 1568x653 while the real viewport is 1920x799 — multiply screenshot-read pixel coordinates by ~1.2245 (x) / ~1.223 (y) before passing to `computer` tool click actions, or prefer ref-based clicks entirely.
- **The user's own Gmail** (`it.arellanoerwin@gmail.com`) is the sole existing `is_admin=true` account in this database, and also has `username`/password test state on it from prior verification (Music Director / The Feast affiliation were intentionally left in place as real, not junk, data).
- **The single seeded affiliation** ("The Feast") currently has no `avatar_url` set (explicitly reverted to `null` at the end of prior testing, to leave the DB clean).
- **Environment is memory-constrained.** Free RAM was 0.21 GB / 5.74 GB total at the end of this session — treat any dev-server/build work as fragile until this improves. Do not chain multiple heavy Node processes (build + dev + browser automation) without checking memory first.
