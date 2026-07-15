# Phase 1: Autenticação e Papéis - Research

**Researched:** 2026-07-14
**Domain:** Supabase Auth (admin-invited users) + Next.js App Router SSR sessions + Postgres RLS role model
**Confidence:** MEDIUM (core RLS/SSR architecture is HIGH — carried over from prior project research and official docs; the invite-by-admin flow specific to this phase is MEDIUM/LOW — synthesized from official docs + community sources, not fetched verbatim from a primary source in this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Criação de conta**
- **D-01:** Não existe auto-cadastro aberto. O Supervisor cadastra o vendedor (nome, sobrenome, email, celular) de dentro do sistema, já logado — não é uma tela fora do login.
- **D-02:** Ao criar a conta, o sistema envia um convite por e-mail (fluxo padrão do Supabase Auth) para o vendedor definir a própria senha. O Supervisor nunca sabe a senha de ninguém.
- **D-03:** O primeiro Supervisor (o usuário/dono do projeto) é cadastrado diretamente no banco durante a implementação desta fase — não precisa de tela especial de "primeiro acesso". Claude deve pedir o email a ser usado quando for implementar este passo.
- **D-04:** Desativar o acesso de um vendedor que saiu do time fica fora de escopo nesta fase — se precisar, é feito diretamente no banco por enquanto. Candidato a fase futura se virar necessidade recorrente.

**Atribuição de papel**
- **D-05:** No formulário de cadastro de usuário, o Supervisor escolhe explicitamente o papel (Supervisor ou Vendedor) — não há um papel padrão implícito.
- **D-06:** O sistema deve suportar mais de um Supervisor desde o início (não travar a lógica assumindo supervisor único).
- **D-07:** Trocar o papel de um usuário já existente (ex: vendedor promovido a supervisor) fica fora de escopo nesta fase — ajuste feito diretamente no banco se acontecer.

**Recuperação de senha**
- **D-08:** "Esqueci minha senha" entra nesta fase, usando o fluxo padrão do Supabase Auth (link por e-mail para redefinir).

**Tela de login e gestão de equipe**
- **D-09:** Tela de login simples: campos de email e senha, mais o link "esqueci minha senha". Sem opção de auto-cadastro visível.
- **D-10:** O cadastro de novos vendedores/supervisores acontece dentro do sistema, numa área de "gerenciar equipe" acessível só a quem está logado como Supervisor — não é uma tela pública.

### Claude's Discretion
- Layout visual específico da tela de login e da área de gerenciar equipe (Claude decide, dentro do design system já escolhido em `.claude/CLAUDE.md` — shadcn/ui + Tailwind v4).
- Textos de erro e mensagens de feedback.
- Duração exata da sessão / estratégia de refresh de token — usar o padrão do `@supabase/ssr`.

### Deferred Ideas (OUT OF SCOPE)
- Desativar/reativar acesso de um usuário pela tela — fora de escopo nesta fase (D-04). Candidato a fase futura.
- Trocar o papel de um usuário existente pela tela — fora de escopo nesta fase (D-07). Candidato a fase futura.

### Additional Canonical References (from CONTEXT.md)
- `.claude/Skills/Supabase-conventions/SKILL.md` — RLS/RPC/Edge Function escalation order; obrigatório para lógica de autorização/papéis.
- `.claude/CLAUDE.md` §Technology Stack — `@supabase/ssr` (não `@supabase/auth-helpers-nextjs`), `react-hook-form` + `zod`, shadcn/ui.
- `.planning/research/ARCHITECTURE.md` — padrão `is_supervisor()` `SECURITY DEFINER` para evitar recursão em RLS.
- `.planning/research/PITFALLS.md` — pitfalls de RLS (P1, P2, P4, P10, P11 apply directly to this phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Usuário faz login via Supabase Auth com email e senha | `supabase.auth.signInWithPassword` + `@supabase/ssr` server/browser client split — see Architecture Patterns |
| AUTH-02 | Cadastro de usuário com email, nome, sobrenome, senha, celular | Supervisor-invoked `admin.inviteUserByEmail` via Edge Function, metadata → `profiles` trigger — see Pattern 2 |
| AUTH-03 | Sistema distingue dois papéis — Supervisor e Vendedor — com permissões diferentes | `profiles.role` enum + `is_supervisor()` `SECURITY DEFINER` RLS helper — see Pattern 1 |
| AUTH-04 | Sessão do usuário persiste entre acessos (não precisa logar toda hora) | `@supabase/ssr` cookie-based session + `middleware.ts` refresh — see Pattern 3 |
</phase_requirements>

## Summary

This phase has two distinct halves that must both land for the phase to be "done": (1) the **session/identity plumbing** — `@supabase/ssr` wired into Next.js App Router (browser client, server client, middleware) so login and persistent sessions work at all — and (2) the **role/authorization model** — a `profiles` table holding `role` (`supervisor`/`vendedor`), synced from `auth.users` via a trigger, with a single `is_supervisor()` `SECURITY DEFINER` helper that every future RLS policy in this project will call. Because this is Phase 1 of a walking skeleton, both halves need to exist end-to-end in their thinnest working form: one real Supabase project connected, one migration creating `profiles` + RLS + the helper function, one working login round-trip, and one working "Supervisor invites a Vendedor" round-trip — not a fully-featured user-management system.

The non-obvious part of this phase, driven directly by the locked decisions (D-01/D-02), is that there is no public sign-up form at all — user creation is admin-invoked and must call `supabase.auth.admin.inviteUserByEmail()`, which **requires the service_role/secret key and can only run server-side**. Per this project's own `supabase-conventions` skill (RLS → RPC → Edge Function escalation, and `CLAUDE.md`'s "lógica de backend adicional: Supabase Edge Functions"), this points to a Supabase Edge Function as the correct place for the invite call — not a Next.js Server Action holding the secret key, even though the latter is technically also safe. The Edge Function must independently re-check "is the caller actually a Supervisor?" via the caller's JWT, since an Edge Function's HTTP endpoint is otherwise publicly reachable.

**Primary recommendation:** Build the `profiles` + `is_supervisor()` + RLS foundation first (nothing else in the project is safely buildable without it), then the SSR session plumbing (login/logout/middleware), then the Supervisor-invite Edge Function + "gerenciar equipe" screen, then "esqueci minha senha" (which reuses the same `/auth/confirm` callback route as the invite flow). Seed **two** vendedor test accounts from the very first migration — testing this phase's RLS only as Supervisor is the single most common way this exact phase goes wrong (see Common Pitfalls).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login (email + senha) | API / Backend (Supabase Auth) | Frontend Server (SSR) | Supabase Auth issues/validates the session; Next.js server client reads/writes the session cookie via `@supabase/ssr` |
| Session persistence | Frontend Server (SSR) | Browser / Client | `middleware.ts` refreshes the cookie-based session on every request; the browser client reads it for client-interactive calls (e.g. logout button) |
| Role distinction (Supervisor/Vendedor) | Database / Storage (RLS) | API / Backend | `profiles.role` + `is_supervisor()` is the authorization source of truth; the app layer only reflects role in the UI, never enforces it |
| User invite (Supervisor cadastra Vendedor) | API / Backend (Edge Function) | Frontend Server (SSR) | Needs the service_role/secret key and sends email — must run server-side only, per `supabase-conventions`; the "gerenciar equipe" page's Server Action or client code just calls `supabase.functions.invoke(...)` |
| Password reset ("esqueci minha senha") | API / Backend (Supabase Auth) | Frontend Server (SSR) | `resetPasswordForEmail` + `verifyOtp` + `updateUser` are all Supabase Auth calls; the SSR app only hosts the `/auth/confirm` callback route and the "set new password" form |
| "Gerenciar equipe" UI (list + invite form) | Frontend Server (SSR) | Browser / Client | Server Component reads `profiles` (RLS-scoped); the invite form is a Client Component calling the Edge Function |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.110.5 [VERIFIED: npm registry] | Postgres/Auth client, `admin.inviteUserByEmail`, `functions.invoke` | Already locked in `.claude/CLAUDE.md`; single official Supabase SDK |
| `@supabase/ssr` | 0.12.3 [VERIFIED: npm registry] | Cookie-based session across Server Components/Actions/middleware | Official replacement for the deprecated `@supabase/auth-helpers-nextjs`; already locked in `.claude/CLAUDE.md` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | 7.81.0 [VERIFIED: npm registry] | Login form, "gerenciar equipe" invite form | Already locked stack-wide in `.claude/CLAUDE.md` |
| `zod` | 4.4.3 [VERIFIED: npm registry] | Validate login/invite form input client- and server-side | Already locked stack-wide; Server Actions/Edge Function must re-validate, never trust client input |
| `@hookform/resolvers` | 5.4.0 [VERIFIED: npm registry] | Bridges `react-hook-form` + `zod` | Needed wherever both are used together |
| shadcn/ui (`form`, `input`, `button`, `card`, `badge`) | CLI-installed | Login card, invite form, role badge in nav | Already the project's chosen design system; no new dependency, copy-paste components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Edge Function for the invite call | Next.js Server Action holding `SUPABASE_SERVICE_ROLE_KEY` in a server-only env var | Technically also safe (never shipped to the browser bundle), but contradicts this project's explicit convention ("lógica de backend adicional: Supabase Edge Functions" in `CLAUDE.md`, and the `supabase-conventions` skill's RLS→RPC→Edge-Function escalation for "usar secret key"/"enviar e-mail" cases). Use the Server Action route only if the team later decides Edge Functions add unwanted deploy friction — not a reason to deviate now |
| Postgres enum type for `profiles.role` | A separate `roles` lookup table (like the CRUD-editable enums) | `role` is fixed to exactly Supervisor/Vendedor for the life of this project (not a Supervisor-editable list like categoria/produtos/tipos_tarefa) — a lookup table would add a join and CRUD screen nobody asked for. A Postgres enum type (or `text` + `CHECK`) is correct and matches `CLAUDE.md`'s explicit distinction between fixed roles and the CRUD-editable enums |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install react-hook-form zod @hookform/resolvers
npx shadcn@latest add form input button card badge label
```

**Version verification:** Verified live against the npm registry on 2026-07-14 (see command output below); these are the same versions already recorded in `.planning/research/STACK.md`, so no drift since that research pass.
```
npm view @supabase/supabase-js version   → 2.110.5
npm view @supabase/ssr version           → 0.12.3
npm view react-hook-form version         → 7.81.0
npm view zod version                     → 4.4.3
npm view @hookform/resolvers version     → 5.4.0
```

## Package Legitimacy Audit

| Package | Registry | Age signal | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------|-----------|-------------|---------|-------------|
| `@supabase/supabase-js` | npm | Latest version published 2026-07-14 (same day) | 18,666,435/wk | github.com/supabase/supabase-js | SUS ("too-new") | Approved — flag is a false positive: the legitimacy checker's "too-new" signal reads the *latest version's* publish date, not the package's first-release date. 18.6M weekly downloads and the official `supabase` GitHub org make this unambiguously legitimate. Planner should still add a `checkpoint:human-verify` before install per protocol, but no real risk expected |
| `@supabase/ssr` | npm | Latest version published 2026-07-14 (same day) | 4,897,592/wk | github.com/supabase/ssr | SUS ("too-new") | Approved — same false-positive pattern as above (official org, high downloads) |
| `react-hook-form` | npm | Latest version published 2026-07-05 | 53,317,020/wk | github.com/react-hook-form/react-hook-form | SUS ("too-new") | Approved — same false-positive pattern; this is one of the most widely used React form libraries |
| `zod` | npm | Latest version published 2026-05-04 | 208,074,660/wk | github.com/colinhacks/zod | OK | Approved |
| `@hookform/resolvers` | npm | Latest version published 2026-05-21 | 37,375,056/wk | github.com/react-hook-form/resolvers | OK | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@supabase/supabase-js`, `@supabase/ssr`, `react-hook-form` — all three are flagged purely because their most recent published version landed the same day/week as this research, not because of any actual legitimacy concern (see download counts and official source repos above). Per protocol, the planner must still gate each `npm install` behind a `checkpoint:human-verify` task, but reviewers should expect this to be a quick pass, not a real red flag. No `postinstall` scripts were found on any of the five packages checked.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ BROWSER                                                          │
│  Login form (email+senha) ──┐        "Gerenciar equipe" form ──┐ │
└──────────────────────────────┼──────────────────────────────────┼─┘
                                │                                  │
                     signInWithPassword               functions.invoke('invite-user')
                                │                                  │
┌───────────────────────────────▼──────────────────────────────────▼─┐
│ NEXT.JS APP ROUTER (Vercel)                                         │
│  middleware.ts ── refreshes session cookie on every request        │
│  lib/supabase/server.ts (SSR client, Server Components/Actions)    │
│  lib/supabase/client.ts (browser client)                           │
│  app/(auth)/login/page.tsx                                          │
│  app/auth/confirm/route.ts ── shared invite + password-reset landing│
│  app/(app)/equipe/page.tsx ── Supervisor-only "gerenciar equipe"    │
└──────────────────────────────┬──────────────────────────┬──────────┘
                                │                          │
                     auth.users session               invoke Edge Function
                                │                          │
┌───────────────────────────────▼──────────────────────────▼──────────┐
│ SUPABASE                                                             │
│  auth.users (Supabase Auth) ──AFTER INSERT trigger──▶ profiles       │
│                                                        (id, role,     │
│                                                         nome, ...)    │
│  RLS: is_supervisor() SECURITY DEFINER used by every policy          │
│  Edge Function invite-user: verifies caller is supervisor (JWT),     │
│    then calls auth.admin.inviteUserByEmail(email, {data, redirectTo})│
│    using the service_role/secret key                                 │
└────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
app/
├── (auth)/
│   ├── login/page.tsx              # AUTH-01, D-09
│   └── forgot-password/page.tsx    # D-08 step 1 (request reset email)
├── auth/
│   ├── confirm/route.ts            # shared callback: verifyOtp for invite AND recovery links
│   └── reset-password/page.tsx     # D-08 step 2 (set new password, has active session from confirm)
├── (app)/
│   ├── layout.tsx                  # auth guard (redirect to /login if no session), role in nav
│   └── equipe/page.tsx             # D-10 "gerenciar equipe" (Supervisor-only)
├── middleware.ts                   # AUTH-04 session refresh + route guard
components/
├── auth/                           # LoginForm, InviteUserForm
└── ui/                             # shadcn primitives
lib/
└── supabase/
    ├── client.ts                   # browser client (createBrowserClient)
    ├── server.ts                   # SSR client (createServerClient, cookies)
    └── middleware.ts                # updateSession helper used by middleware.ts
supabase/
├── migrations/
│   └── 0001_profiles_and_roles.sql # profiles table, role enum, is_supervisor(), RLS, trigger
└── functions/
    └── invite-user/
        └── index.ts                # D-02: admin.inviteUserByEmail, Supervisor-only
```

### Pattern 1: `is_supervisor()` SECURITY DEFINER helper + RLS on `profiles`

**What:** A single Postgres function that looks up the caller's role, marked `SECURITY DEFINER` so the lookup itself bypasses RLS (avoiding infinite recursion — see Common Pitfalls). This exact pattern is already documented project-wide in `.planning/research/ARCHITECTURE.md` Pattern 1; this phase is where it must first be created, since every later phase's RLS policy depends on it.
**When to use:** Any RLS policy in this project that needs to check "is the current user a Supervisor?"

**Example:**
```sql
-- Source: .planning/research/ARCHITECTURE.md Pattern 1, cross-checked against
-- https://github.com/orgs/supabase/discussions/1138 [CITED, confidence LOW per this session's classify-confidence — verify at implementation]
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

-- read policy: every authenticated user can see the team list
-- (needed for the "responsavel" dropdown in later phases, and the
-- "gerenciar equipe" list itself)
create policy "usuarios autenticados veem todos os perfis"
on profiles for select
to authenticated
using (true);

-- no insert/update/delete policy for regular users in this phase:
-- profiles rows are only ever created by the handle_new_user trigger
-- (SECURITY DEFINER, bypasses RLS) — see Pattern 2. Editing an
-- existing profile's role/data is explicitly out of scope (D-07).
```

### Pattern 2: Admin-invoked user creation via Edge Function + trigger-populated `profiles`

**What:** Because there is no public sign-up (D-01), user creation always starts with a Supervisor filling the "gerenciar equipe" form. That form calls a Supabase Edge Function (not a Server Action) because the underlying call — `auth.admin.inviteUserByEmail` — needs the service_role/secret key and sends an email, which is exactly the `supabase-conventions` skill's trigger for "Edge Function, not RLS/RPC."
**When to use:** AUTH-02 (Supervisor cadastra vendedor) and D-03 (first Supervisor — though the *first* one is created directly via a one-off `supabase.auth.admin.createUser` or SQL insert at migration/setup time, not through this UI, since no Supervisor exists yet to invite them).
**Trade-offs:** The Edge Function must independently verify the caller is a Supervisor (its HTTP endpoint is otherwise publicly reachable even with `verify_jwt` enabled, since *any* authenticated user has a valid JWT — the check must be "is this specific user a Supervisor," not just "is this request authenticated").

**Example:**
```typescript
// supabase/functions/invite-user/index.ts
// Source: pattern synthesized from Supabase official Edge Functions +
// Admin API docs and community examples (blog.mansueli.com,
// github.com/orgs/supabase/discussions/1687) [CITED, confidence LOW — verify at implementation]
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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service_role/secret key, server-only
  )
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { nome, sobrenome, celular, role }, // → NEW.raw_user_meta_data in the trigger below
    redirectTo: `${Deno.env.get('SITE_URL')}/auth/confirm`,
  })
  if (error) return new Response(error.message, { status: 400 })
  return new Response(JSON.stringify({ ok: true, user: data.user }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

```sql
-- Source: standard Supabase community pattern (multiple sources agree)
-- [CITED, confidence LOW — verify exact raw_user_meta_data field names at implementation]
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

Frontend call from the "gerenciar equipe" form:
```typescript
// components/auth/InviteUserForm.tsx (Client Component)
const { error } = await supabase.functions.invoke('invite-user', {
  body: { email, nome, sobrenome, celular, role },
})
```

### Pattern 3: `@supabase/ssr` session across Server Components, Server Actions, and middleware

**What:** Three cooperating pieces — a browser client, a server client that reads/writes cookies, and middleware that refreshes the session on every request (Server Components alone cannot write cookies, so without the middleware piece sessions silently expire).
**When to use:** AUTH-01 (login) and AUTH-04 (persistence) — this is the walking-skeleton's first working login round-trip.

**Example:**
```typescript
// lib/supabase/client.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs [CITED, confidence LOW per this session — verify exact API against current docs at implementation, since this is a fast-moving package]
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // or PUBLISHABLE_KEY — check actual .env.local key names, see Open Questions
  )
}
```

```typescript
// lib/supabase/server.ts
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

```typescript
// middleware.ts
// Source: same as above — the "session refresh" responsibility documented
// under Setting up Server-Side Auth for Next.js
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

### Anti-Patterns to Avoid
- **Checking role only in the browser:** e.g. hiding the "gerenciar equipe" menu item for a Vendedor without an RLS policy backing it — the Supabase anon key is public, so a Vendedor could still call the Edge Function or query `profiles` directly. RLS + the Edge Function's own server-side role check are the actual boundary (matches `CLAUDE.md`'s explicit rule).
- **Storing `role` only in `auth.users.raw_user_meta_data` / JWT claims and trusting it in RLS:** metadata set via `inviteUserByEmail`'s `data` option is a *convenient transport* into the trigger, but the trigger must copy it into the RLS-protected `profiles.role` column — never write an RLS policy that reads role straight out of JWT claims, since app-level metadata can be user-editable in some Supabase configurations.
- **Using `auth.getSession()` inside middleware:** official guidance explicitly warns against this — it can return a stale/unrefreshed session; always call `auth.getUser()` (or `getClaims()`) in middleware/server contexts, which validates against Supabase's servers.
- **A Next.js Server Action holding the service_role key "to keep it simple":** works technically, but contradicts this project's own stated convention (`CLAUDE.md`: "lógica de backend adicional: Supabase Edge Functions"); use the Edge Function per Pattern 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing/storage, session tokens | A custom `users` table + bcrypt + JWT signing | Supabase Auth (`auth.users`, `signInWithPassword`) | `CLAUDE.md` explicitly forbids "implementar autenticação/autorização por conta própria"; Supabase Auth already handles this correctly, for free |
| "Invite a user by email" flow | A custom token table + email-sending code | `auth.admin.inviteUserByEmail()` (native Supabase Auth invite) | Explicitly required by D-02 ("fluxo padrão do Supabase Auth"); Supabase already generates the secure token, sends the email (via its built-in SMTP or a configured custom SMTP), and exposes the standard `verifyOtp` exchange |
| "Forgot password" flow | Custom reset-token generation/expiry logic | `resetPasswordForEmail()` + `/auth/confirm` (`verifyOtp`) + `updateUser()` | Explicitly required by D-08; same underlying token-exchange mechanism as the invite flow, so one callback route serves both |
| Role-based visibility | `if (role === 'supervisor')` branching to decide which Postgres query to run | RLS policies + `is_supervisor()` — same query for both roles, Postgres filters the rows | `CLAUDE.md` + `supabase-conventions` skill both mandate RLS as the authorization source of truth |

**Key insight:** Every "don't hand-roll" item above already has an explicit rule against it in this project's own `CLAUDE.md` or locked decisions — this phase's job is to follow those rules literally, not to find a clever alternative.

## Common Pitfalls

> Full detail already researched project-wide in `.planning/research/PITFALLS.md`. The subset most load-bearing for *this specific phase* is summarized below — do not re-derive from scratch, read the source document for full recovery-strategy detail.

### Pitfall 1 (= PITFALLS.md P1): RLS enabled but no policy → silent empty results, or RLS never enabled → silent full leak
**What goes wrong:** `profiles` created without `ENABLE ROW LEVEL SECURITY`, or enabled with no `SELECT` policy.
**How to avoid:** The migration that creates `profiles` must, in the same file, enable RLS and add the policy — never split across migrations. Verify with `SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles';` before considering the migration done.

### Pitfall 2 (= PITFALLS.md P2): Testing only as Supervisor hides Vendedor-side RLS bugs
**What goes wrong:** Since Supervisor sees everything by design, a too-permissive Vendedor policy is invisible unless tested from a Vendedor account.
**How to avoid:** This phase must seed **two** Vendedor test accounts (not just the first Supervisor from D-03) and write at least one automated test asserting Vendedor A cannot read/write a row that isn't theirs — this is the natural place to establish that pattern since it's the first phase with RLS at all.

### Pitfall 4 (= PITFALLS.md P4): Unwrapped `auth.uid()` in RLS policies
**What goes wrong:** `USING (id = auth.uid())` re-evaluates per row instead of once per query.
**How to avoid:** Always write `(select auth.uid())` from this phase's very first policy onward (see Pattern 1's example) — this convention must be established here since every later phase copies it.

### Pitfall 11 (= PITFALLS.md P11): Editing an already-applied migration instead of writing a new one
**What goes wrong:** Especially likely in this phase specifically, since it's the *first* migration ever written for this project — "just tweak the migration I wrote 5 minutes ago" feels harmless before `supabase db push` has run against the real project.
**How to avoid:** Once `0001_profiles_and_roles.sql` has been applied (even locally via `supabase db reset`), any further change is a new migration file.

### Pitfall (new, specific to this phase): Edge Function endpoint reachable by any authenticated user, not just Supervisors
**What goes wrong:** `verify_jwt` (Supabase's built-in Edge Function auth check) only confirms "this caller has *a* valid session," not "this caller is a Supervisor." A Vendedor could call `invite-user` directly and self-provision an account, or invite someone with `role: 'supervisor'`.
**Why it happens:** It's easy to assume `verify_jwt = true` in `supabase/functions/invite-user/index.ts`'s config (or the dashboard) is sufficient authorization, when it only proves authentication.
**How to avoid:** The Edge Function must query `profiles` for the caller's own role (using the caller's own JWT, RLS-scoped — not the service_role client) and explicitly reject non-Supervisors with a 403, as shown in Pattern 2's example, *before* touching the service_role client.
**Warning signs:** No test exists that calls `invite-user` as a Vendedor and asserts a 403.

## Code Examples

See Architecture Patterns above for the full working examples (RLS/trigger SQL, Edge Function, `@supabase/ssr` client/server/middleware). All are tagged `[CITED, confidence LOW]` in this document because they were synthesized from official-docs WebFetch + WebSearch snippets rather than fetched verbatim from a live Context7 session — **re-verify the exact `@supabase/ssr` API surface (`createServerClient` signature, `cookies()` async usage) against `https://supabase.com/docs/guides/auth/server-side/nextjs` at implementation time**, since this package moves fast and Next.js's cookie APIs have changed across recent majors.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Already deprecated per official Supabase guidance (predates this research) | Already reflected correctly in `.claude/CLAUDE.md` — do not use the old package |
| `auth.getSession()` in middleware | `auth.getUser()` (or `getClaims()`) in middleware | Current official guidance | `getSession()` can trust a stale/unrefreshed cookie; `getUser()` revalidates against Supabase |
| Legacy `anon`/`service_role` JWT-format keys | `sb_publishable_...` / `sb_secret_...` key naming (newer Supabase projects) | Ongoing Supabase key-naming migration, exact rollout timing not verified this session | Both formats work as the `createClient`/`createServerClient` key argument; only the *env var names* and dashboard labels differ — see Open Questions |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: do not use, already forbidden in `.claude/CLAUDE.md`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `admin.inviteUserByEmail`'s `data` option metadata lands in `auth.users.raw_user_meta_data` and is readable in a trigger the same way `admin.createUser`'s `user_metadata` is | Pattern 2 | If the field name/shape differs, the `handle_new_user` trigger silently inserts `NULL` for nome/sobrenome/celular/role instead of erroring — must be verified against a real invite response during implementation, not assumed |
| A2 | The exact `createServerClient`/middleware code shown (getAll/setAll signatures, async `cookies()`) matches the *current* `@supabase/ssr@0.12.3` API | Pattern 3, Code Examples | `@supabase/ssr` has changed its cookie-handling API across versions before; if the signature drifted, TypeScript will catch it at compile time, but budget time to re-check the official guide during implementation |
| A3 | A Postgres `enum` type (not a lookup table) is the right model for `profiles.role`, since role is fixed (not Supervisor-editable like categoria/produtos/tipos_tarefa) | Standard Stack, Pattern 1 | Low risk — `CLAUDE.md`'s own domain mapping already draws this distinction explicitly; changing to a lookup table later is a straightforward migration if ever needed |
| A4 | Supabase key naming for this specific project's `.env.local` (legacy `anon`/`service_role` vs newer `sb_publishable_`/`sb_secret_`) — not inspected in this session (file exists but its contents are outside this agent's read boundary) | Open Questions, Environment Availability | If code assumes the wrong env var *names* (not values), the app fails to connect to Supabase at all — first thing to check when wiring `lib/supabase/*.ts` during execution |
| A5 | The Edge Function example's Deno import style (`jsr:@supabase/supabase-js@2`) and `Deno.serve` usage reflect the current Supabase Edge Functions runtime convention | Pattern 2 | Low-medium risk — Edge Functions runtime/import conventions have shifted before; verify against `supabase functions new` scaffold output at implementation time rather than hand-typing from this example |

**None of these claims should be treated as locked technical fact without a quick verification pass during plan execution — they are the starting hypothesis, not a final spec.**

## Open Questions

1. **Does `.env.local` already contain valid Supabase project credentials, and under which naming convention?**
   - What we know: `.env.local` exists (390 bytes, gitignored per `.gitignore`'s `.env*` rule) — someone has already started wiring this up.
   - What's unclear: This research agent cannot read `.env.local` (sensitive-file boundary) so the exact variable names (`NEXT_PUBLIC_SUPABASE_ANON_KEY` vs `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SECRET_KEY`) and whether a real Supabase project is actually behind them are unknown.
   - Recommendation: First implementation task should be "read `.env.local`, confirm a Supabase project URL + working anon key + service role key are present; if not, stop and ask the user for them" — this is exactly the walking-skeleton's first checkpoint, not something to assume.

2. **What email address should be the first Supervisor (D-03)?**
   - What we know: D-03 explicitly says Claude must ask the user for this email at implementation time.
   - What's unclear: Not something research can resolve — flagging so the plan includes an explicit "ask the user" step before the seed-Supervisor migration/script runs.

3. **Supabase project's outbound email (SMTP) readiness for invite/reset emails**
   - What we know: Supabase's built-in email sending has low rate limits on the free tier and is sometimes unreliable for anything beyond testing (well-known Supabase community caveat, not verified this session).
   - What's unclear: Whether the project's actual Supabase instance has this configured/tested yet.
   - Recommendation: Plan should include a manual verification step ("send a real invite, confirm the email arrives") rather than assuming it works — this is explicitly one of the walking-skeleton's "one real round-trip" requirements.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev/build, Supabase CLI via npx | ✓ (via `nvm4w`, not on this shell's default PATH) | v24.18.0 | Add `nvm4w`'s Node dir to PATH, or invoke Node directly by path, when running project scripts in this environment |
| npm | package installs | ✓ | 11.16.0 | — |
| Supabase CLI | Local migrations, `supabase functions deploy`, local dev stack | Not yet installed in this project (no `supabase/` directory, not in `package.json`) | — | `npx supabase init` as the first execution step; confirmed it downloads/runs successfully (`supabase@2.109.1` resolved via npx during this research) |
| Supabase project (hosted) | The entire phase — login, invite, RLS all depend on a real project existing | Unconfirmed — `.env.local` exists but its contents are outside this research agent's read boundary | — | If no working project is behind the existing `.env.local`, this blocks the entire phase; verify as the first execution step (see Open Questions #1) |
| `@supabase/supabase-js`, `@supabase/ssr` | AUTH-01 through AUTH-04 | Not yet installed (`package.json` has no Supabase dependency yet) | Will install 2.110.5 / 0.12.3 | — |

**Missing dependencies with no fallback:**
- A working Supabase project connection — if `.env.local`'s credentials don't point to a real, reachable Supabase project, no part of this phase can be verified end-to-end. This must be confirmed before any migration is written.

**Missing dependencies with fallback:**
- Supabase CLI — not installed yet, but `npx supabase <command>` works without a project-level install (confirmed during this research); installing as a devDependency is a nice-to-have, not a blocker.
- Node/npm on PATH in this particular shell — has a known workaround (explicit path via `nvm4w`), not a blocker for actual project tooling (Vercel/CI will have Node on PATH normally).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed yet — Vitest + Playwright are the project-wide standard per `.planning/research/STACK.md`, not yet added to `package.json` |
| Config file | none — see Wave 0 Gaps |
| Quick run command | `npx vitest run` (once installed) |
| Full suite command | `npx vitest run && npx playwright test` (once installed) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login with valid email/senha succeeds; invalid credentials rejected | integration (Supabase JS client against local/test project) | `npx vitest run tests/auth/login.test.ts` | ❌ Wave 0 |
| AUTH-02 | Supervisor invites a Vendedor; Vendedor account is created with correct role/fields; a non-Supervisor calling the invite Edge Function is rejected (403) | integration | `npx vitest run tests/auth/invite.test.ts` | ❌ Wave 0 |
| AUTH-03 | `is_supervisor()` correctly distinguishes roles; a Vendedor querying another Vendedor's-only-visible data (once such data exists in later phases) is blocked — for *this* phase, assert Vendedor A cannot see/alter Vendedor B's `profiles` row where such a restriction should apply | integration (authenticated as each role, not service-role) | `npx vitest run tests/auth/rls-roles.test.ts` | ❌ Wave 0 |
| AUTH-04 | Session persists across a simulated new request (cookie round-trip through middleware) | e2e (Playwright, login once, reload/revisit without re-entering credentials) | `npx playwright test tests/e2e/session-persistence.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (fast integration tests against a local/test Supabase instance)
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual real-email-invite check from Open Questions #3

### Wave 0 Gaps
- [ ] Install Vitest + Testing Library + Playwright per `.planning/research/STACK.md`'s Dev Tools table (`npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @playwright/test && npx playwright install`)
- [ ] `tests/auth/` directory + a shared test helper that authenticates as a given seeded test user (Supervisor, Vendedor A, Vendedor B) against a local Supabase instance (`supabase start`) — this helper is reused by every future phase's RLS tests per Pitfall 2/10
- [ ] Seed script or migration creating the two Vendedor test accounts + the first Supervisor (D-03, asking the user for the real email) for both manual and automated testing
- [ ] Supabase CLI local dev stack (`supabase init`, `supabase start`) — needed so tests run against real RLS/policies rather than mocks, per `.claude/CLAUDE.md`'s stated testing philosophy

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Supabase Auth (`signInWithPassword`, `admin.inviteUserByEmail`) — never hand-rolled, per `CLAUDE.md` |
| V3 Session Management | yes | `@supabase/ssr` cookie-based session, refreshed via `middleware.ts` using `auth.getUser()` (never `getSession()` in server contexts) |
| V4 Access Control | yes | Postgres RLS on `profiles`, `is_supervisor()` `SECURITY DEFINER` helper; Edge Function re-checks caller role independently of `verify_jwt` |
| V5 Input Validation | yes | `zod` schemas for login form and invite form, validated both client-side (`react-hook-form` + `zodResolver`) and server-side (Edge Function must re-validate `email`/`role`/etc., never trust the client payload) |
| V6 Cryptography | yes | Password hashing and session token issuance handled entirely by Supabase Auth — never hand-rolled |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Vendedor self-elevates to Supervisor by calling the invite Edge Function directly with `role: 'supervisor'` | Elevation of Privilege | Edge Function must check the *caller's* `profiles.role` (not trust any role field in the request body for authorization decisions) before proceeding — see Pattern 2 |
| Vendedor forges/edits `role` via a direct `profiles` update call | Tampering | No `UPDATE` RLS policy exists on `profiles` for regular users in this phase (role change is out of scope per D-07) — absence of a write policy is itself the control |
| Invite/reset link reused or intercepted | Spoofing / Information Disclosure | Rely on Supabase Auth's own token-exchange (`verifyOtp`) expiry/single-use semantics — do not build a custom token scheme |
| RLS recursion or missing policy on `profiles` causing either a full leak or a broken login | Information Disclosure / Denial of Service | `is_supervisor()` marked `SECURITY DEFINER` specifically to avoid recursive RLS evaluation on `profiles` itself (see Pattern 1 and PITFALLS.md P1) |
| Service_role/secret key exposure | Information Disclosure | Used exclusively inside the Edge Function's server-side Deno runtime, sourced from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — never in any file shipped to the browser bundle, never in a `NEXT_PUBLIC_*` env var |

## Sources

### Primary (per this session's classify-confidence — none reached HIGH; treat all below as needing spot-verification during implementation)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/STACK.md` — project-authoritative prior research, HIGH confidence for the RLS/`is_supervisor()`/`security_invoker` patterns they already established (cross-checked against official Supabase docs in that research pass)
- `.claude/Skills/Supabase-conventions/SKILL.md`, `.claude/CLAUDE.md` — project-authoritative constraints (RLS-first, Edge Functions for secret-key/email logic, no separate Node backend)

### Secondary (LOW confidence per this session's `classify-confidence --provider webfetch` / `--provider websearch` output — official-docs URLs, but not fetched via an authoritative MCP doc tool this session)
- WebFetch: `https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail` — `inviteUserByEmail` signature/options
- WebFetch: `https://supabase.com/docs/guides/auth/server-side/nextjs` — `@supabase/ssr` client/middleware pattern
- WebFetch: `https://supabase.com/docs/guides/auth/passwords` — password reset flow
- WebSearch: "Supabase trigger on auth.users insert sync to public profiles table handle_new_user security definer" — `handle_new_user` trigger pattern (multiple community sources agree)
- WebSearch: "Supabase Edge Function admin.inviteUserByEmail service_role key restrict to admin caller" — Edge Function caller-role-check pattern

### Tertiary (LOW confidence, single community source, marked for validation)
- blog.mansueli.com "Allowing users to invite others with Supabase Edge Functions" — referenced via search snippet only (direct fetch returned HTTP 403 in this session); underlying pattern cross-checked against the official Admin API docs above

## Metadata

**Confidence breakdown:**
- Standard stack (library choices/versions): HIGH — versions verified live against npm registry this session, consistent with prior `STACK.md` research
- Architecture (RLS/`is_supervisor()`/profiles structure): HIGH — directly carried over from `.planning/research/ARCHITECTURE.md`, itself cross-checked against official Supabase docs
- Invite-by-admin Edge Function pattern (Pattern 2): LOW-MEDIUM — official docs confirm the `inviteUserByEmail` API shape and service_role requirement, but the exact Edge Function code shown is synthesized/typical rather than fetched verbatim; re-verify at implementation
- `@supabase/ssr` exact client/middleware code (Pattern 3): LOW — same caveat, this package's API has shifted before; treat the shown code as a strong starting point, not copy-paste-final
- Pitfalls: HIGH — directly carried over from `.planning/research/PITFALLS.md`, which is itself cross-checked against official docs and multiple independent community incident reports

**Research date:** 2026-07-14
**Valid until:** 30 days for the architecture/pitfalls portions (stable, project-internal); 7-14 days for the exact `@supabase/ssr`/Edge Functions API code shown (fast-moving package — re-verify before copy-pasting if this research is more than ~2 weeks old at implementation time)
