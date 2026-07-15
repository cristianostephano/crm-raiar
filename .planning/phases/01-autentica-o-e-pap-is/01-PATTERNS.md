# Phase 1: Autenticação e Papéis - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 15 (new)
**Analogs found:** 2 / 15 (project skeleton only — see note below)

## Important Note: Greenfield Phase

This is Phase 1 of a brand-new project. The codebase currently contains only the default `create-next-app` skeleton (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`) plus a freshly-initialized shadcn/ui setup (`components/ui/button.tsx`, `lib/utils.ts`) added during the UI-spec step for this same phase. **There are no prior auth, CRUD, Supabase, form, or route-handler patterns anywhere in this codebase.**

Because of this, most files below have **no real codebase analog** — the planner must build them from `01-RESEARCH.md`'s Architecture Patterns (Pattern 1/2/3, fully-coded examples) and `01-UI-SPEC.md`'s screen contracts, not from existing code. This PATTERNS.md exists to (a) point at the two real analogs that do exist (`components/ui/button.tsx`, `lib/utils.ts`, `app/layout.tsx`) for styling/import conventions, and (b) consolidate the RESEARCH.md code excerpts into one per-file map so the planner doesn't have to re-derive them.

Treat every "No Analog Found" entry's RESEARCH.md excerpt as the de facto pattern source — copy it close to verbatim, adjusting only what the Open Questions in RESEARCH.md flag as unverified (exact `@supabase/ssr` API surface, `.env.local` key names).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/supabase/client.ts` | service (SDK factory) | request-response | none | no-analog |
| `lib/supabase/server.ts` | service (SDK factory) | request-response | none | no-analog |
| `lib/supabase/middleware.ts` | middleware | request-response | none | no-analog |
| `middleware.ts` | middleware | request-response | none | no-analog |
| `supabase/migrations/0001_profiles_and_roles.sql` | migration | CRUD (schema) | none | no-analog |
| `supabase/functions/invite-user/index.ts` | route (Edge Function handler) | request-response | none | no-analog |
| `app/(auth)/login/page.tsx` | component (page, Server) | request-response | `app/page.tsx` | role-match (page shell only) |
| `components/auth/LoginForm.tsx` | component (Client, form) | request-response | `components/ui/button.tsx` | partial (styling/import convention only) |
| `app/(auth)/forgot-password/page.tsx` | component (page) | request-response | `app/(auth)/login/page.tsx` (once built) | role-match |
| `app/auth/confirm/route.ts` | route (Route Handler) | request-response | none | no-analog |
| `app/auth/reset-password/page.tsx` | component (page) | request-response | `app/(auth)/login/page.tsx` (once built) | role-match |
| `app/(app)/layout.tsx` | provider/layout (auth guard) | request-response | `app/layout.tsx` | role-match (layout shell only) |
| `app/(app)/equipe/page.tsx` | component (page, Server, Supervisor-only) | CRUD (list) | `app/(auth)/login/page.tsx` (once built) | role-match |
| `components/auth/InviteUserForm.tsx` | component (Client, form) | request-response | `components/auth/LoginForm.tsx` (once built) | role-match |
| `tests/auth/*.test.ts` | test | request-response | none | no-analog |

## Pattern Assignments

### `lib/supabase/client.ts` (service, request-response)

**Analog:** none — first Supabase integration in this project.

**Source pattern** — `01-RESEARCH.md` Pattern 3, lines 335-345 (browser client):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```
Caveat (RESEARCH.md Open Question #1 / Assumption A4): verify the actual `.env.local` variable names before hardcoding — may be `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` instead of `NEXT_PUBLIC_SUPABASE_ANON_KEY` depending on key-naming generation.

---

### `lib/supabase/server.ts` (service, request-response)

**Analog:** none.

**Source pattern** — `01-RESEARCH.md` Pattern 3, lines 347-373 (SSR client, async `cookies()`):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies() // Next.js 15/16: cookies() is async
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from a Server Component — middleware refreshes instead
          }
        },
      },
    }
  )
}
```

---

### `middleware.ts` / `lib/supabase/middleware.ts` (middleware, request-response)

**Analog:** none.

**Source pattern** — `01-RESEARCH.md` Pattern 3, lines 376-407:
```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  await supabase.auth.getUser() // refreshes token if expired; do NOT use getSession() here
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```
**Critical:** must call `auth.getUser()`, never `auth.getSession()` (RESEARCH.md Anti-Patterns / ASVS V3).

---

### `supabase/migrations/0001_profiles_and_roles.sql` (migration, CRUD/schema)

**Analog:** none — first migration in this project.

**Source pattern** — `01-RESEARCH.md` Pattern 1, lines 198-240 (enum + table + RLS + `is_supervisor()`):
```sql
create type user_role as enum ('supervisor', 'vendedor');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text not null,
  sobrenome text not null,
  celular text not null,
  role user_role not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create or replace function is_supervisor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'supervisor'
  );
$$;

create policy "usuarios autenticados veem todos os perfis"
on profiles for select
to authenticated
using (true);
```
Plus the `handle_new_user` trigger, Pattern 2 lines 295-318 (must live in this same migration file per Pitfall 1 — RLS enable + policy + trigger cannot be split across migrations):
```sql
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, sobrenome, celular, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nome',
    new.raw_user_meta_data ->> 'sobrenome',
    new.raw_user_meta_data ->> 'celular',
    (new.raw_user_meta_data ->> 'role')::user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```
**Mandatory:** wrap `auth.uid()` in `(select auth.uid())` everywhere (Pitfall 4) — already reflected above.
**Verification step:** `SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles';` before considering the migration done (Pitfall 1).

---

### `supabase/functions/invite-user/index.ts` (route/Edge Function, request-response)

**Analog:** none — first Edge Function in this project. Do not use a Next.js Server Action instead (see `.claude/Skills/Supabase-conventions/SKILL.md` and RESEARCH.md Anti-Patterns — service_role key must stay server-side in Deno, not Node).

**Source pattern** — `01-RESEARCH.md` Pattern 2, lines 250-290:
```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')!
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await anonClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'supervisor') {
    return new Response('Forbidden', { status: 403 })
  }

  const { email, nome, sobrenome, celular, role } = await req.json()

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { nome, sobrenome, celular, role },
    redirectTo: `${Deno.env.get('SITE_URL')}/auth/confirm`,
  })
  if (error) return new Response(error.message, { status: 400 })
  return new Response(JSON.stringify({ ok: true, user: data.user }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```
**Critical (Pitfall, phase-specific):** the role check against `profiles` (using the caller's own JWT-scoped `anonClient`, not the admin client) must happen *before* touching `adminClient` — this is the actual authorization boundary, `verify_jwt` alone is insufficient.

---

### `app/(auth)/login/page.tsx` + `components/auth/LoginForm.tsx` (component, request-response)

**Analog:** `app/page.tsx` (only existing page, structurally trivial) for App Router page conventions; `components/ui/button.tsx` for import/styling conventions (`cn()` from `lib/utils.ts`, `@/` path alias, shadcn `data-slot` pattern).

**Import/path-alias convention** — from `components/ui/button.tsx` lines 1-4:
```typescript
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
```
Use `@/` path alias consistently (already configured in `tsconfig.json`); import shadcn primitives from `@/components/ui/*`.

**No form/auth logic analog exists.** Build `LoginForm.tsx` as a Client Component using `react-hook-form` + `zodResolver` + `signInWithPassword` per RESEARCH.md Pattern 3 (browser client) and `01-UI-SPEC.md` Screen-Specific Notes → Login: centered `Card` max-width 400px, Email + Senha fields, inline (non-toast) error banner in `--destructive`, full-width `--primary` "Entrar" button, "Esqueci minha senha?" link.

**Layout wrapper convention** — `app/layout.tsx` lines 1-27 (root layout, font variables, `min-h-full flex flex-col` body):
```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// ... font setup ...
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```
The `(auth)` route group's own nested layout (if added) and the `(app)` layout (auth guard) should follow this same shell convention rather than introducing a different structure.

---

### `app/auth/confirm/route.ts` (route, request-response)

**Analog:** none — no Route Handlers exist yet in this project.

No RESEARCH.md code excerpt provided verbatim for this file (only referenced architecturally as "shared callback: verifyOtp for invite AND recovery links" in the Recommended Project Structure, line 170). Planner/executor must implement using Supabase's standard `verifyOtp` Route Handler pattern (official docs: `https://supabase.com/docs/guides/auth/server-side/nextjs`), reusing `lib/supabase/server.ts`'s `createClient()`. Flag as LOW confidence per RESEARCH.md Metadata — re-verify exact `verifyOtp` params against official docs at implementation time.

---

### `app/(app)/layout.tsx` (provider/layout, auth guard)

**Analog:** `app/layout.tsx` (root layout shell) for structural convention only — no auth-guard logic exists yet.

**Source pattern** — RESEARCH.md Recommended Project Structure line 173: `layout.tsx  # auth guard (redirect to /login if no session), role in nav`. Combine with `lib/supabase/server.ts`'s `createClient()` + `auth.getUser()` to redirect unauthenticated users, and render the role `Badge` per `01-UI-SPEC.md` "Role indicator" section (non-blue, secondary/neutral variant, next to user's name).

---

### `app/(app)/equipe/page.tsx` + `components/auth/InviteUserForm.tsx` (component, CRUD-list / request-response)

**Analog:** none for data-fetching (first Server Component reading `profiles`); `components/auth/LoginForm.tsx` (once built this phase) is the closest form analog for the invite form's `react-hook-form` + `zod` structure.

**Invoke pattern** — `01-RESEARCH.md` Pattern 2, lines 320-326:
```typescript
// components/auth/InviteUserForm.tsx (Client Component)
const { error } = await supabase.functions.invoke('invite-user', {
  body: { email, nome, sobrenome, celular, role },
})
```
**UI contract** — `01-UI-SPEC.md` Screen-Specific Notes → Gerenciar Equipe: Display heading (28px/600) + "Convidar" button top-right (inline section or `Dialog`); table of nome/sobrenome/papel (neutral `Badge`)/email; empty-state copy from the Copywriting Contract table; invite form field order nome → sobrenome → email → celular → papel (`Select`, no default per D-05); route must redirect non-Supervisors (RLS is the real boundary, per RESEARCH.md Anti-Patterns).

---

### `tests/auth/*.test.ts`, `tests/e2e/session-persistence.spec.ts` (test)

**Analog:** none — no test framework installed yet (Vitest/Playwright are Wave 0 gaps per RESEARCH.md Validation Architecture).

**Source pattern:** RESEARCH.md's Phase Requirements → Test Map (lines 522-528) and Wave 0 Gaps (lines 535-539) — must seed Supervisor + two Vendedor test accounts and assert cross-role RLS isolation (Pitfall 2), not just Supervisor-only testing.

## Shared Patterns

### Supabase client creation split (browser vs. server)
**Source:** `01-RESEARCH.md` Pattern 3
**Apply to:** every file that touches Supabase — always import `createClient` from `lib/supabase/client.ts` in Client Components, from `lib/supabase/server.ts` in Server Components/Route Handlers. Never share one client module across both contexts.

### `(select auth.uid())` wrapping in RLS
**Source:** `01-RESEARCH.md` Pitfall 4 / Pattern 1
**Apply to:** every RLS policy written in `0001_profiles_and_roles.sql` and all future migrations — establishes the project-wide convention starting here.

### `auth.getUser()` not `auth.getSession()` in server contexts
**Source:** `01-RESEARCH.md` Anti-Patterns, Pattern 3
**Apply to:** `middleware.ts`, `app/(app)/layout.tsx`, `app/auth/confirm/route.ts` — anywhere session validity is checked server-side.

### shadcn import/styling convention (`@/` alias, `cn()`, `data-slot`)
**Source:** `components/ui/button.tsx` lines 1-4, 43-56 (only real analog in the codebase)
**Apply to:** `components/auth/LoginForm.tsx`, `components/auth/InviteUserForm.tsx`, and any new page/component file — use `@/lib/utils`'s `cn()` for conditional classNames, `@/components/ui/*` for shadcn primitives, follow the `data-slot="..."` attribute convention shadcn components already use.

### Role check duplicated at two layers (RLS + Edge Function), never trust client role/UI-only checks
**Source:** `01-RESEARCH.md` Anti-Patterns, Security Domain (ASVS V4)
**Apply to:** `supabase/functions/invite-user/index.ts` (check caller's own `profiles.role` before touching admin client) and `app/(app)/equipe/page.tsx` / `app/(app)/layout.tsx` (redirect non-Supervisors at the app layer as UX only — RLS is the actual boundary, never the only check).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/supabase/client.ts` | service | request-response | First Supabase integration; no prior SDK factory pattern in repo |
| `lib/supabase/server.ts` | service | request-response | Same |
| `lib/supabase/middleware.ts` / `middleware.ts` | middleware | request-response | No middleware exists yet |
| `supabase/migrations/0001_profiles_and_roles.sql` | migration | CRUD (schema) | First migration ever written for this project |
| `supabase/functions/invite-user/index.ts` | route (Edge Function) | request-response | First Edge Function; no Deno runtime code in repo |
| `app/auth/confirm/route.ts` | route | request-response | First Next.js Route Handler; also no verbatim RESEARCH.md code — only architectural reference, must be implemented against official docs |
| `tests/auth/*.test.ts`, `tests/e2e/*.spec.ts` | test | request-response | No test framework installed yet (Wave 0 gap) |

For all of the above, use the RESEARCH.md excerpts embedded in this document (traced back to `01-RESEARCH.md` Pattern 1/2/3) as the pattern source instead of a codebase analog.

## Metadata

**Analog search scope:** entire repository root (`app/`, `components/`, `lib/`) — confirmed via `ls` that no other source directories exist yet.
**Files scanned:** `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `components/ui/button.tsx`, `lib/utils.ts` (all existing source files in the repo).
**Pattern extraction date:** 2026-07-15
