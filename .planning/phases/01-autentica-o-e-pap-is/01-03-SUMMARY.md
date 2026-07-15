---
phase: 01-autentica-o-e-pap-is
plan: 03
subsystem: auth
tags: [supabase-ssr, nextjs-app-router, react-hook-form, zod, playwright, vitest]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Installed @supabase/supabase-js + @supabase/ssr, Vitest/Playwright wired, tests/helpers/supabase-test-clients.ts, shadcn primitives (form, input, card, badge, label)"
  - phase: 01-02
    provides: "profiles table + user_role enum + is_supervisor() + RLS live on the hosted project; 3 seeded accounts (Supervisor + Vendedor A/B) exported as SEED_ACCOUNTS from tests/auth/rls-roles.test.ts"
provides:
  - "lib/supabase/client.ts / server.ts / middleware.ts — the browser/server/middleware client split every later phase's Server Component, Server Action, and Client Component reuses"
  - "middleware.ts root file refreshing the session cookie via auth.getUser() on every request (session-only, no authorization branching)"
  - "app/(auth)/login/page.tsx + components/auth/LoginForm.tsx — the real login screen, authenticated against the hosted Supabase project"
  - "app/(app)/layout.tsx — the auth-guard + role-badge convention every future protected route group nests under"
  - "components/auth/LogoutButton.tsx — the Sair control pattern (hard navigation) reused wherever logout is needed"
  - "First working end-to-end walking-skeleton round-trip: login -> role-aware protected page -> persistent session -> logout, confirmed against the real hosted project by the project owner"
affects: [01-04, 01-05, phase-02-cliente, phase-03-kanban, phase-04-admin, phase-05-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase client split: lib/supabase/client.ts (browser, Client Components) vs lib/supabase/server.ts (async, Server Components/Actions, cookies() from next/headers) vs lib/supabase/middleware.ts (updateSession(), session refresh only) — never share one client module across contexts"
    - "middleware.ts calls auth.getUser() only, never getSession() — refreshes the session, does not branch on role; RLS (database) + app/(app)/layout.tsx's redirect are the only real authorization boundaries"
    - "Auth-transition navigation (login success, logout) uses window.location.assign() hard navigation instead of next/navigation's router.push()+router.refresh() — a soft client transition right after a session-cookie change can reuse a stale pre-login Router Cache entry for the same URL, silently leaving the user stuck on the old page"
    - "app/(app)/layout.tsx is the auth-guard convention: Server Component reads auth.getUser(), redirects to /login if absent, reads the caller's own profiles row for name/role, renders a neutral/secondary role Badge (never --primary blue) — role display here is UX only, RLS is the boundary"

key-files:
  created:
    - lib/supabase/client.ts
    - lib/supabase/server.ts
    - lib/supabase/middleware.ts
    - middleware.ts
    - app/(auth)/login/page.tsx
    - components/auth/LoginForm.tsx
    - components/auth/LogoutButton.tsx
    - app/(app)/layout.tsx
    - app/(app)/page.tsx
    - tests/auth/login.test.ts
    - tests/e2e/session-persistence.spec.ts
  modified: []
  deleted:
    - app/page.tsx

key-decisions:
  - "Deleted the default create-next-app app/page.tsx — it and the new app/(app)/page.tsx both resolved to route \"/\", a routing conflict; the protected landing page is the only real owner of \"/\" going forward."
  - "Login/logout use window.location.assign() (hard navigation) instead of next/navigation's router.push()+router.refresh(), discovered necessary when the e2e test showed the post-login redirect silently stalling on /login despite a successful signInWithPassword() and a correctly-set session cookie."
  - "Kept the root file named middleware.ts (not proxy.ts) to match this plan's stated artifact contract, even though Next.js 16.2.10 prints a deprecation warning recommending the renamed \"proxy\" convention — confirmed the app still works correctly under the deprecated name; flagged as a low-priority future rename, not a blocker."

patterns-established:
  - "Every future Client Component doing an auth-state-changing action (login, logout, invite acceptance, password reset) that needs the very next Server Component render to see the new session should hard-navigate via window.location, not router.push()+router.refresh()."
  - "Every future protected route group nests under a layout.tsx following app/(app)/layout.tsx's shape: getUser() -> redirect if absent -> read profiles for display data -> render children."

requirements-completed: [AUTH-01, AUTH-03, AUTH-04]

coverage:
  - id: D1
    description: "@supabase/ssr browser client, server client, and middleware session-refresh helper wired; middleware calls getUser() (never getSession()) and never branches on role"
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (passes); node -e source-assertion on lib/supabase/middleware.ts confirming getUser present, getSession absent -> 'ssr wiring ok'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Login screen (D-09): centered Card, email+senha fields, inline destructive error banner, no sign-up affordance, authenticates against the real hosted Supabase project"
    requirement: AUTH-01
    verification:
      - kind: integration
        ref: "tests/auth/login.test.ts#valid seeded Vendedor credentials return a session / #wrong password returns an error and no session"
        status: pass
      - kind: other
        ref: "grep -i 'criar conta|sign.?up|cadastr(ar|e-se)' app/(auth)/login/page.tsx components/auth/LoginForm.tsx -> no matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "Protected (app) area redirects unauthenticated visitors to /login, shows name + neutral role Badge for authenticated users, and the session persists across a reload"
    requirement: AUTH-04
    verification:
      - kind: e2e
        ref: "tests/e2e/session-persistence.spec.ts#unauthenticated visit redirects to /login; login persists across reload"
        status: pass
    human_judgment: false
  - id: D4
    description: "Walking-skeleton proof: full local stack (npm run dev against the real hosted Supabase project) — login, name+role badge (neutral color), reload persistence, and logout all work end-to-end"
    verification:
      - kind: manual_procedural
        ref: "Task 4 checkpoint — project owner confirmed all 6 verification steps against http://localhost:3000 on 2026-07-15"
        status: pass
    human_judgment: true
    rationale: "Requires a human to visually confirm the role badge renders in a neutral/gray color (not blue) and that the full click-through experience (login -> greeting -> reload -> logout) feels correct in a real browser — not fully expressible as an automated assertion."

# Metrics
duration: ~90min (including one human-verify checkpoint pause)
completed: 2026-07-15
status: complete
---

# Phase 1 Plan 3: Login, Session Persistence & Protected Area Summary

**First working walking-skeleton round-trip: `@supabase/ssr` browser/server/middleware client split, a real login screen (D-09) authenticating against the hosted Supabase project, and a protected `(app)` route group showing the logged-in user's name + neutral role badge — session persists across reloads and logout works, all confirmed end-to-end by the project owner.**

## Performance

- **Duration:** ~90 min active work (across 1 human-verify checkpoint pause for the final walking-skeleton proof)
- **Started:** 2026-07-15T13:03:00Z (approx, first task commit)
- **Completed:** 2026-07-15T14:35:00Z (approx, checkpoint approval)
- **Tasks:** 4 (3 auto + 1 checkpoint)
- **Files modified:** 11 created, 1 deleted

## Accomplishments
- Wired `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (async SSR client with cookie `getAll`/`setAll`), and `lib/supabase/middleware.ts` (`updateSession()` calling `auth.getUser()`, never `getSession()`) plus the root `middleware.ts` — confirmed via `tsc --noEmit` and a source assertion that the anti-pattern (`getSession()` in middleware) is absent
- Built the login screen (`app/(auth)/login/page.tsx` + `components/auth/LoginForm.tsx`) matching `01-UI-SPEC.md`'s contract exactly: centered 400px `Card`, `react-hook-form` + `zod` validation, inline `--destructive` error banner (not a toast), full-width `--primary` "Entrar" button, "Esqueci minha senha?" link to `/forgot-password`, and — critically — no sign-up affordance anywhere (D-01/D-09), verified by both `tests/auth/login.test.ts` (valid/invalid `signInWithPassword` contract) and a source grep
- Built the protected area (`app/(app)/layout.tsx` auth guard + `app/(app)/page.tsx` landing + `components/auth/LogoutButton.tsx`): redirects unauthenticated visitors to `/login`, reads the caller's own `profiles` row to show name + a neutral/secondary role `Badge` (never blue, per UI-SPEC), and provides a working "Sair" logout — proven by `tests/e2e/session-persistence.spec.ts` (unauthenticated redirect, login, role badge visible, session survives a full page reload)
- Discovered and fixed a real login-flow bug during e2e verification: `router.push("/")` + `router.refresh()` left the user visually stuck on `/login` even though `signInWithPassword()` succeeded and the session cookie was correctly set — root-caused to a stale pre-login Router Cache entry for `/`, fixed by switching both login-success and logout navigation to `window.location.assign()` (a real server round-trip)
- Ran the Task 4 walking-skeleton checkpoint: started the dev server, confirmed the redirect behavior server-side (`curl`/`fetch` against `/`), then had the project owner manually verify all 6 steps (redirect to login, login succeeds, name + neutral "Supervisor" badge shown, reload keeps the session, logout returns to login) against the real hosted Supabase project — all confirmed working

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the @supabase/ssr browser client, server client, and session-refresh middleware** - `ae7c7fb` (feat)
2. **Task 2: Build the login page + form (D-09) and its login integration test** - `1be07bb` (feat)
3. **Task 3: Build the protected (app) area with auth guard + role badge and the session-persistence e2e test** - `b87c459` (feat)
4. **Task 4: Walking-skeleton proof — run the full stack locally and log in** - checkpoint, no code commit (gate-only; approved by the project owner after verifying all 6 steps)

**Plan metadata:** _pending — see final commit below_

## Files Created/Modified
- `lib/supabase/client.ts` - Browser `createClient()` via `createBrowserClient`, using `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `lib/supabase/server.ts` - Async SSR `createClient()` via `createServerClient`, `cookies()` from `next/headers` (Next.js 16 async), `setAll` wrapped in try/catch for the Server Component case
- `lib/supabase/middleware.ts` - `updateSession(request)` refreshing the session via `auth.getUser()`, no role branching
- `middleware.ts` - Root middleware wiring `updateSession`, `config.matcher` excluding static assets
- `app/(auth)/login/page.tsx` - Centered login `Card` (max-width 400px), "Entrar" title, "Esqueci minha senha?" link, no sign-up affordance
- `components/auth/LoginForm.tsx` - `react-hook-form` + `zod` login form calling `signInWithPassword`, inline destructive error banner, hard-navigates to `/` on success
- `components/auth/LogoutButton.tsx` - Client Component calling `signOut()` then hard-navigating to `/login`
- `app/(app)/layout.tsx` - Server Component auth guard: redirects to `/login` if unauthenticated, reads `profiles` for name/role, renders neutral role `Badge` + logout control
- `app/(app)/page.tsx` - Protected landing page greeting the user by name and stating their role
- `tests/auth/login.test.ts` - `signInWithPassword` contract test (valid seeded Vendedor A -> session; wrong password -> error, no session)
- `tests/e2e/session-persistence.spec.ts` - Playwright: unauthenticated `/` redirects to `/login`; login shows the role badge; session survives a reload
- `app/page.tsx` (deleted) - Default `create-next-app` scaffold page removed; it and `app/(app)/page.tsx` both resolved to route `"/"`, a routing conflict

## Decisions Made
- Deleted `app/page.tsx` (the default `create-next-app` landing) once `app/(app)/page.tsx` became the real owner of route `"/"` — kept both would have been a Next.js routing collision.
- Switched login/logout navigation from `router.push()`+`router.refresh()` to `window.location.assign()` — a soft client transition right after a session-cookie change can reuse a stale pre-login Router Cache entry for the same URL, which is exactly what happened during e2e verification (user stayed on `/login` despite a successful, cookie-confirmed sign-in).
- Kept the root file named `middleware.ts` rather than renaming to Next.js 16's newer `proxy.ts` convention, to match this plan's stated artifact contract — the deprecated name still works correctly (verified via `curl`/`fetch` against a fresh dev server), just prints a startup warning. Left a code comment flagging this for a future low-priority rename.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deleted app/page.tsx to resolve a route collision**
- **Found during:** Task 3 (building `app/(app)/page.tsx`)
- **Issue:** The default `create-next-app` scaffold `app/page.tsx` and the new `app/(app)/page.tsx` both resolve to route `"/"` (the `(app)` parentheses form a route group, not a URL segment) — Next.js cannot serve two pages for the same route.
- **Fix:** Deleted `app/page.tsx`; `app/(app)/page.tsx` (behind the auth guard) is now the only page serving `"/"`. Also cleared the stale `.next/` build cache, whose generated route-type file (`validator.ts`) still referenced the deleted module and briefly broke `tsc --noEmit`.
- **Files modified:** `app/page.tsx` (deleted)
- **Verification:** `npx tsc --noEmit` passes; `curl`/`fetch` against a fresh dev server confirms `"/"` now correctly serves the protected landing (or redirects to `/login` when unauthenticated).
- **Committed in:** `b87c459` (Task 3 commit)

**2. [Rule 1 - Bug] Fixed post-login/logout navigation getting stuck due to stale Router Cache**
- **Found during:** Task 3 (running the `session-persistence.spec.ts` e2e test)
- **Issue:** `LoginForm.tsx`'s success path called `router.push("/")` then `router.refresh()` (the common Next.js App Router pattern). In practice the user stayed visually on `/login` after a successful login — verified with debug scripts that `signInWithPassword()` returned no error, the Supabase auth endpoint returned `200` with a valid session, and the `sb-*-auth-token` cookie was correctly set on `document.cookie` — yet the client-side transition to `"/"` never completed. Root cause: a stale pre-login Router Cache entry for `"/"` (captured while the user was still unauthenticated, before login) was being reused instead of triggering a fresh server request.
- **Fix:** Replaced `router.push("/")` + `router.refresh()` with `window.location.assign("/")` in `LoginForm.tsx`, forcing a real full-page navigation that always hits the server with the current cookies. Applied the same fix to `LogoutButton.tsx` (`window.location.assign("/login")`) for symmetry and to avoid the equivalent issue in reverse.
- **Files modified:** `components/auth/LoginForm.tsx`, `components/auth/LogoutButton.tsx`
- **Verification:** `tests/e2e/session-persistence.spec.ts` passes (login navigates to `/` and shows the role badge; logout returns to `/login`); manually confirmed via the Task 4 checkpoint.
- **Committed in:** `b87c459` (Task 3 commit)

**3. [Rule 1 - Bug] Fixed a strict-mode locator collision in the e2e test itself**
- **Found during:** Task 3 (running `session-persistence.spec.ts` after the navigation fix)
- **Issue:** `page.getByText("Supervisor", { exact: true })` matched two elements — the role `Badge` in the header and the word "Supervisor" inside the landing page's prose sentence ("Você está conectado(a) como **Supervisor**") — causing a Playwright strict-mode violation.
- **Fix:** Scoped the locator to the header landmark: `page.getByRole("banner").getByText("Supervisor", { exact: true })`.
- **Files modified:** `tests/e2e/session-persistence.spec.ts`
- **Verification:** Test passes deterministically.
- **Committed in:** `b87c459` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking route collision, 2 Rule 1 bugs — one in application code, one in test code)
**Impact on plan:** All three were necessary for the plan's own stated deliverables (a working login round-trip, a working protected page) to actually function. No scope creep — no new features or screens were added beyond what the plan specified.

## Issues Encountered
- A stale `next dev` server process (already running before this plan's changes) served empty responses for every route after `app/page.tsx` was deleted — restarting the dev server (and clearing `.next/`) resolved it. Not a code bug, but worth noting for future sessions: always restart the dev server after deleting/adding top-level route files rather than relying on hot-reload alone.
- Next.js 16.2.10 prints a deprecation warning ("The middleware file convention is deprecated. Please use proxy instead.") at every dev-server startup. Functionality is unaffected (confirmed via direct HTTP verification); left as a documented, low-priority future rename rather than an in-scope fix, since this plan's artifact contract explicitly named `middleware.ts`.

## User Setup Required

None further — the app connects to the same hosted Supabase project and seeded accounts established in plans 01-01/01-02. No new environment variables or external service configuration were introduced this plan.

## Next Phase Readiness
- The walking skeleton is proven end-to-end: a real user can log in, see their role, stay logged in across reloads, and log out — the foundation every later phase's UI builds on top of.
- `lib/supabase/client.ts`/`server.ts` are the canonical Supabase client imports for all future Server Components, Server Actions, and Client Components in this project.
- `app/(app)/layout.tsx` is the auth-guard convention every future protected route group (e.g. `app/(app)/equipe/page.tsx` in plan 04, and every phase-02+ feature page) should nest under.
- No blockers for 01-04 (Supervisor-invite Edge Function + "gerenciar equipe" screen) — it can reuse the login/session/auth-guard plumbing built here directly.
- Minor deferred item: `middleware.ts` could be renamed to `proxy.ts` (Next.js 16's current file-convention name) in a future cleanup pass — not urgent, current name still works.

---
*Phase: 01-autentica-o-e-pap-is*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 11 claimed created files found on disk (`lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `app/(auth)/login/page.tsx`, `components/auth/LoginForm.tsx`, `components/auth/LogoutButton.tsx`, `app/(app)/layout.tsx`, `app/(app)/page.tsx`, `tests/auth/login.test.ts`, `tests/e2e/session-persistence.spec.ts`); `app/page.tsx` confirmed deleted as claimed. All 3 task commits (`ae7c7fb`, `1be07bb`, `b87c459`) confirmed present in git history.
