# Phase 10: Desativação de Membro da Equipe - Research

**Researched:** 2026-07-27
**Domain:** Supabase RLS/RPC + Auth Admin API two-service authorization change, on an existing Next.js 16 + Supabase CRM
**Confidence:** MEDIUM-HIGH (schema/RLS reasoning HIGH — traced directly to live migrations; Auth Admin API mechanism MEDIUM — official docs page fetched directly + cross-checked community threads)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Autodesativação):** Um Supervisor NÃO pode desativar a própria conta, mesmo havendo outros Supervisores ativos (regra separada da trava do "último Supervisor ativo" — essa é sobre nunca zerar Supervisores, esta é sobre nunca se autodesativar no meio de uma ação).
- **D-02 (Reativação):** É possível reativar um membro desativado depois. A pessoa desativada continua aparecendo na lista "Gerenciar equipe" (com um selo/indicação "Inativo"), e o Supervisor tem uma ação para reativar o acesso dela quando quiser.
- **D-03 (Substituto mesmo sem cliente em andamento):** O fluxo de desativação SEMPRE pede para escolher um vendedor substituto, mesmo quando o vendedor a ser desativado não tem nenhum cliente em andamento pra transferir (só clientes fechados/perdidos) — mantém um único caminho na tela, sem bifurcação condicional.

### Claude's Discretion

- Exato local/gatilho na tela "Gerenciar equipe" (ex: botão "Desativar" por linha, ou um menu de ações "...") e o desenho exato do diálogo de escolha do substituto.
- Nome e assinatura exatos da nova RPC de desativação/reativação, e se desativação e reativação são a mesma RPC com um parâmetro ou duas RPCs separadas. **Resolved by this research — see Pattern 1.**
- Estratégia técnica exata para bloquear o login do membro desativado (ex: `supabase.auth.admin.updateUserById` com `ban_duration`, chamado de uma Server Action com a service_role key). **Resolved by this research — see Pattern 2.**
- Se a coluna `profiles.ativo` precisa de uma RPC `security definer` pra ser escrita ou se uma nova policy de UPDATE restrita a Supervisor é o caminho certo. **Resolved by this research — see Pattern 1.**

### Deferred Ideas (OUT OF SCOPE)

Nenhuma — discussão ficou dentro do escopo da fase.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EQP-01 | Supervisor desativa um membro da equipe, escolhendo antes um vendedor substituto pra herdar os clientes em andamento | Pattern 1 (`desativar_membro_equipe` RPC — reassignment + last-supervisor guard + self-guard), Pattern 3 (UI reuses `EditableListTab`'s Dialog/Badge precedent) |
| EQP-02 | Sistema bloqueia a desativação do último Supervisor ativo | Pattern 1's `FOR UPDATE` guard (Pitfall A, TOCTOU-safe); Code Example 1 |
| EQP-03 | Membro desativado não consegue mais entrar no sistema; nome e histórico antigo permanecem intactos | Pattern 1 (`profiles.ativo` + `is_supervisor()` extension) as PRIMARY enforcement, Pattern 2 (Auth Admin ban) as secondary; Pitfall B (Vendedor-branch RLS gap — new finding, see below) |
| EQP-04 | Clientes já fechados (ganho/perdido) do vendedor desativado continuam contando pra ele nos números históricos — só os em andamento são transferidos | Pattern 1's reassignment `WHERE status_acompanhamento = 'em_andamento'` filter |

</phase_requirements>

## Summary

This phase adds exactly one new column (`profiles.ativo`), one modified helper function (`is_supervisor()`), two new RPCs (`desativar_membro_equipe` / `reativar_membro_equipe`), one new Server Action file (`app/actions/equipe.ts`), one new server-only Supabase client (`lib/supabase/admin.ts`), and new UI on the existing `app/(app)/equipe/page.tsx` (renders as `EquipePage` today). No new npm packages, no new Edge Function, no new external service beyond the Supabase Auth Admin API this project's own `service_role` key already grants access to.

The two RPCs must be `SECURITY DEFINER` — this is a deliberate second exception to this project's "avoid security definer" convention (the first and only precedent so far is `is_supervisor()` itself), made necessary because `profiles` has zero write policies today by design (only a `SECURITY DEFINER` trigger writes it) and adding a general Supervisor-scoped UPDATE policy on `profiles` would open every column (including `role`) to direct client `.update()` calls, not just `ativo` — a materially bigger privilege-escalation surface than this feature needs. Both RPCs self-gate with `is_supervisor()` as their first statement, exactly mirroring the existing `is_supervisor()` exception's own rationale.

The login-block itself is a two-service, two-step flow, not one transaction: the Postgres RPC (which sets `ativo = false` and reassigns in-progress clientes) is the PRIMARY, immediate cutoff — because RLS re-evaluates `is_supervisor()` on every single request — while `supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' })`, called from the Server Action with a service-role client AFTER the RPC transaction commits, is best-effort defense-in-depth against future logins/refreshes. This research also surfaces one gap not fully closed by the milestone-level research: `is_supervisor()` gates the Supervisor-branch of every RLS policy, but the Vendedor-branch (`responsavel = auth.uid()`) on `clientes`/`tarefas`/`historico` is NOT gated by `ativo` at all — see Pitfall B below, an explicit decision point for the planner.

**Primary recommendation:** Two `SECURITY DEFINER` RPCs (`desativar_membro_equipe`, `reativar_membro_equipe`), no new `profiles` write policy; Server Action orchestrates RPC-then-Auth-Admin-API in that order; extend `is_supervisor()` with `and ativo = true` (zero policy edits needed); explicitly decide whether to also gate the Vendedor-branch of `clientes`/`tarefas`/`historico` RLS on the caller's own `ativo` (Pitfall B) before considering EQP-03 fully closed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "Can this Supervisor deactivate this member" (last-supervisor guard, self-deactivation guard) | Database / Storage (Postgres RPC) | — | Business rule spanning more than row-visibility (aggregate count + self-reference check) — this project's established escalation point past plain RLS (Pattern 3 in the milestone `ARCHITECTURE.md`) |
| "Reassign in-progress clientes to the replacement vendedor" | Database / Storage (Postgres RPC, same transaction) | — | Must be atomic with the `ativo=false` write; a separate client-side call would reopen the exact race this phase must close |
| "Block future login/refresh" | API / Backend (Server Action, `service_role` client) | — | GoTrue (Supabase Auth) is a separate service from Postgres; cannot be reached from PL/pgSQL. Server Action is the trusted server context, per this project's own `supabase-conventions` escalation order |
| "Reject access on next request even with a still-valid JWT" | Database / Storage (RLS via `is_supervisor()`/`ativo`) | — | RLS evaluates fresh on every request; this is what actually closes the residual-JWT window the Auth ban alone cannot close instantly |
| "Show Inativo badge, Desativar/Reativar actions" | Browser / Client (React Server + Client Components) | — | Pure UI; the underlying authorization is never in this tier per `CLAUDE.md`'s explicit anti-pattern |
| "Pick replacement vendedor" (dialog) | Browser / Client | API / Backend (validates the id server-side inside the RPC) | UI collects the choice; the RPC — not the UI — is the actual trust boundary that validates the replacement is a real, active vendedor |

## Standard Stack

### Core

No new core dependencies. This phase is 100% additive on the existing stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.110.8 (installed: `^2.110.5`) [VERIFIED: npm registry] | `auth.admin.updateUserById` via a `service_role`-keyed client | Already the project's only Supabase client library; the Admin API is a namespace on the same package, not a separate install |

**Version verification:** `npm view @supabase/supabase-js version` → `2.110.8`, confirms the `^2.110.5` pinned in `package.json` resolves to a current, non-stale release. [VERIFIED: npm registry]

### Supporting

No new supporting libraries. Existing shadcn/ui primitives already installed cover every UI need for this phase:

| Component | Already Installed | Use in This Phase |
|-----------|--------------------|--------------------|
| `Dialog` (`components/ui/dialog.tsx`) | Yes | Confirmation dialog for "Desativar" — mirrors `EditableListTab`'s `confirmDeactivate` pattern exactly (Pattern 3) |
| `Badge` (`components/ui/badge.tsx`) | Yes | "Inativo" badge on deactivated rows — same `variant="outline"` usage already live in `EditableListTab.tsx` |
| `Select` (`components/ui/select.tsx`) | Yes | Replacement-vendedor picker inside the deactivation dialog |
| `Button` (`components/ui/button.tsx`) | Yes | Row actions (Desativar/Reativar), dialog footer actions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `SECURITY DEFINER` RPC for `profiles.ativo` writes | A new narrow `UPDATE` policy on `profiles` scoped to `is_supervisor()`, RPC stays non-`security definer` (mirroring `mover_card_funil`) | Postgres RLS has no column-level restriction — this policy would let a Supervisor `.from('profiles').update({ role: 'supervisor' })` on ANY row directly from the client, bypassing the RPC's reassignment-then-deactivate sequencing entirely. Would need a companion `BEFORE UPDATE` trigger rejecting changes to any column but `ativo` to be safe — strictly more moving parts than one `SECURITY DEFINER` RPC that self-gates. **Not recommended.** |
| One combined RPC `alterar_status_membro(p_profile_id, p_ativo boolean, p_novo_responsavel_id uuid default null)` | Two separate RPCs (`desativar_membro_equipe`, `reativar_membro_equipe`) | The guard logic genuinely differs (self-deactivation block + last-supervisor lock + reassignment only apply to deactivation; reactivation is a 2-line no-guard operation per D-02's "low-friction reversible" framing). A single RPC would need `if p_ativo then ... else ...` branching that muddies the single-purpose-function convention every existing RPC (`mover_card_funil`, `importar_clientes_lote`) already follows. **Two RPCs recommended.** |

**Installation:** None — no new packages to install for this phase.

## Package Legitimacy Audit

**Not applicable — this phase installs no new external packages.** It exclusively uses `@supabase/supabase-js`, already installed and verified above.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────── BROWSER ─────────────────────────────┐
│  app/(app)/equipe/page.tsx (Server Component, existing)           │
│    -> EquipeList (new Client Component)                           │
│       "Desativar" per row -> DesativarMembroDialog (new)          │
│         picks replacement vendedor (Select, required, D-03)       │
│       "Reativar" per row (no dialog, D-02 low-friction)           │
└───────────────────────────────┬────────────────────────────────--─┘
                                 │ Server Action call
                                 ▼
┌────────────────────── NEXT.JS SERVER ACTIONS ─────────────────────┐
│  app/actions/equipe.ts (new)                                      │
│                                                                    │
│  desativarMembroEquipe(profileId, novoResponsavelId)               │
│    Step 1 -> supabase.rpc('desativar_membro_equipe', {...})        │
│              (normal SSR client — RPC self-gates via is_supervisor)│
│    Step 2 -> adminClient.auth.admin.updateUserById(profileId,      │
│              { ban_duration: '876000h' })                          │
│              (lib/supabase/admin.ts — service_role, server-only)   │
│                                                                     │
│  reativarMembroEquipe(profileId)                                    │
│    Step 1 -> supabase.rpc('reativar_membro_equipe', {...})          │
│    Step 2 -> adminClient.auth.admin.updateUserById(profileId,       │
│              { ban_duration: 'none' })                              │
└───────────────┬─────────────────────────────────┬──────────────---┘
                 │ Step 1 (Postgres,               │ Step 2 (separate
                 │ transactional)                  │ service, GoTrue)
                 ▼                                 ▼
┌──────────── POSTGRES (RLS-protected) ───┐  ┌──── SUPABASE AUTH ────┐
│ desativar_membro_equipe() — SECURITY     │  │ auth.admin.           │
│ DEFINER, is_supervisor() self-gate:       │  │ updateUserById         │
│  1. p_profile_id <> auth.uid() (D-01)     │  │ (ban_duration)          │
│  2. if target role=supervisor: FOR UPDATE │  │ - blocks future login/  │
│     lock + count>=2 check (EQP-02)        │  │   token refresh only    │
│  3. UPDATE clientes SET responsavel=...    │  │ - does NOT revoke an    │
│     WHERE responsavel=target AND           │  │   already-issued JWT    │
│     status_acompanhamento='em_andamento'   │  │   (residual ~1h window) │
│     (EQP-04 — sequential statement, not    │  └─────────────────────---┘
│     chained CTE, Pitfall A)                │
│  4. UPDATE profiles SET ativo=false        │
│     WHERE id=p_profile_id                  │
│                                             │
│ is_supervisor() -- and ativo = true (new)  │
│  -> cascades to ~20 existing RLS policies   │
│     with ZERO policy edits (EQP-03 primary  │
│     enforcement, effective on next request) │
└─────────────────────────────────────────---┘
```

### Recommended Project Structure

```
app/(app)/equipe/
└── page.tsx                       # existing — extended to fetch profiles.ativo, pass to EquipeList
app/actions/
└── equipe.ts                      # NEW — desativarMembroEquipe / reativarMembroEquipe
components/equipe/                 # NEW folder (equipe.tsx currently has no dedicated component folder)
├── EquipeList.tsx                 # NEW — Client Component, row actions + Inativo badge
└── DesativarMembroDialog.tsx      # NEW — replacement-vendedor picker + confirm
lib/supabase/
└── admin.ts                       # NEW — service_role client, server-only, imported ONLY by app/actions/equipe.ts
supabase/migrations/
└── 0008_desativacao_membro_equipe.sql  # NEW — profiles.ativo, is_supervisor() update, both RPCs
tests/equipe/                      # NEW folder
├── rls-desativar-membro.test.ts   # is_supervisor guard, last-supervisor race, self-deactivation block
└── reassignment.test.ts           # EQP-04: em_andamento reassigned, ganho/perdido untouched
```

### Pattern 1: `SECURITY DEFINER` RPC pair for `profiles.ativo`, self-gated by `is_supervisor()` — a second documented exception

**What:** `desativar_membro_equipe(p_profile_id uuid, p_novo_responsavel_id uuid) returns table(clientes_reatribuidos bigint)` and `reativar_membro_equipe(p_profile_id uuid) returns void` — both `language plpgsql`, both `security definer`, both with `if not is_supervisor() then raise exception` as their literal first statement (same guard-first shape as `mover_card_funil`, `importar_clientes_lote`).

**Why `SECURITY DEFINER` here specifically (deviating from the `mover_card_funil`/`importar_clientes_lote` non-definer convention):** Those two existing RPCs are non-definer because the row-level permission they need (`clientes` UPDATE/INSERT for `responsavel = auth.uid() or is_supervisor()`) **already exists** as a policy — the RPC only adds a business-rule check on top of permission RLS already grants. `profiles` has **zero write policies for any regular user, by design** (0001's own header comment: "Deliberately NO insert/update/delete policy for regular users... the absence of a write policy is itself the Tampering control"). A non-definer RPC's internal `UPDATE profiles SET ativo = ...` would therefore affect 0 rows regardless of who calls it — there is no existing policy for it to lean on. The two options are (a) add a new UPDATE policy scoped to `is_supervisor()`, which grants raw-client write access to every column of `profiles` (including `role`), a bigger surface than this feature needs (see Alternatives Considered), or (b) `security definer` + an internal `is_supervisor()` guard as the function's very first statement — the exact same shape this codebase already accepts once for `is_supervisor()` itself. Recommend (b). [Confidence: HIGH — reasoning traced directly to the live `0001_profiles_and_roles.sql` policy set]

**Example:**
```sql
-- Source: this research, following the established mover_card_funil /
-- importar_clientes_lote guard-first shape, deviating only in
-- "security definer" for the reason above.
create or replace function desativar_membro_equipe(
  p_profile_id uuid,
  p_novo_responsavel_id uuid
)
returns table(clientes_reatribuidos bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role user_role;
  v_reatribuidos bigint;
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem desativar membros da equipe';
  end if;

  -- D-01: never allow self-deactivation, checked before anything else.
  if p_profile_id = (select auth.uid()) then
    raise exception 'Não é possível desativar a própria conta';
  end if;

  select role into v_target_role from profiles where id = p_profile_id;
  if v_target_role is null then
    raise exception 'Membro não encontrado';
  end if;

  -- Substitute must be a real, currently-active vendedor (defensive check —
  -- this function is security definer and bypasses RLS, so it cannot rely
  -- on the caller having already validated this via a scoped query).
  if not exists (
    select 1 from profiles
    where id = p_novo_responsavel_id and ativo = true
  ) then
    raise exception 'Vendedor substituto inválido ou inativo';
  end if;

  -- EQP-02: last-active-Supervisor guard, TOCTOU-safe via row lock
  -- (Pitfall A below) — only relevant when deactivating a Supervisor.
  if v_target_role = 'supervisor' then
    perform 1 from profiles
    where role = 'supervisor' and ativo = true
    for update;

    if (
      select count(*) from profiles
      where role = 'supervisor' and ativo = true and id <> p_profile_id
    ) < 1 then
      raise exception 'Não é possível desativar o último Supervisor ativo';
    end if;
  end if;

  -- EQP-01/EQP-04: reassign ONLY in-progress clientes. Sequential
  -- top-level statement, NOT chained into a CTE with the next UPDATE
  -- (Pitfall A / the 0006 CTE-RLS-visibility bug precedent).
  update clientes
  set responsavel = p_novo_responsavel_id
  where responsavel = p_profile_id
    and status_acompanhamento = 'em_andamento';
  get diagnostics v_reatribuidos = row_count;

  -- EQP-03 primary enforcement — effective on this profile's very next
  -- RLS-gated request, independent of the Auth Admin API call that follows
  -- in the Server Action (Pattern 2).
  update profiles set ativo = false where id = p_profile_id;

  return query select v_reatribuidos;
end;
$$;

create or replace function reativar_membro_equipe(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem reativar membros da equipe';
  end if;

  -- No last-supervisor/self-deactivation guards apply in this direction —
  -- reactivating strictly adds capacity back (D-02).
  update profiles set ativo = true where id = p_profile_id;
end;
$$;
```

**When to use:** Any future write to `profiles` that needs a business-rule gate beyond plain row-visibility, where no existing write policy can be safely reused. Do not generalize this into "always use security definer for profiles writes" — it's justified here specifically because zero write policy exists and adding one would be strictly worse.

### Pattern 2: Two-step, cross-service login block — Postgres commit first, Auth Admin API second

**What:** `app/actions/equipe.ts`'s `desativarMembroEquipe` Server Action calls the RPC (Pattern 1) using the normal SSR-authenticated client FIRST, and only after that call resolves successfully, calls `auth.admin.updateUserById(profileId, { ban_duration: '876000h' })` using a NEW server-only admin client (`lib/supabase/admin.ts`, `service_role` key, never `NEXT_PUBLIC_`-prefixed). `876000h` = 100 years, the same documented "effectively permanent" value used elsewhere in Supabase's own examples for this parameter. [CITED: supabase.com/docs/reference/javascript/auth-admin-updateuserbyid — fetched directly this session]

**`ban_duration` format, verified directly against the official docs page:** a Go-style duration string — a decimal number followed immediately by a unit suffix; confirmed accepted units include `h` (hours) with `"876000h"` as the docs' own long-ban example. Community sources (GitHub discussions, cross-checked against the docs page) additionally report `ns`, `us`/`µs`, `ms`, `s`, `m` as valid suffixes, consistent with Go's `time.ParseDuration` grammar that GoTrue (written in Go) is built on. [CITED: supabase.com/docs/reference/javascript/auth-admin-updateuserbyid, cross-checked against github.com/orgs/supabase/discussions/9239]

**Reactivation (unban):** call the same method with `{ ban_duration: 'none' }`. This specific value is reported consistently across community sources but is NOT independently confirmed on the officially-fetched docs page in this session — **tag this specific claim `[ASSUMED]`, verify at implementation time** against the target Supabase project (a community-reported GitHub issue, `supabase/auth#1798`, describes a version where `ban_duration` writes did not reliably persist — worth a live smoke-test of "deactivate then reactivate" against this project's actual hosted instance before considering the phase done, not just a code read-through). [ASSUMED — verify `'none'` and persistence live]

**Why sequence matters, and what "failure after step 1" means:** Postgres and GoTrue are separate services — they cannot share one transaction. If step 2 (the Auth ban call) fails or times out after step 1 (the RPC) has already committed, the deactivated profile is ALREADY locked out at the RLS layer (Pattern 1's `ativo=false`, which every `is_supervisor()`-gated policy already respects on the very next request) — only the "block a *new* login/refresh" layer is missing, for a residual window bounded by that profile's current access-token expiry (commonly ~1h by Supabase default; confirm this project's actual JWT expiry setting). Surface a clear, non-silent error to the Supervisor if step 2 fails: e.g. "Desativado no sistema, mas houve falha ao bloquear o login — tentando novamente pode ser necessário." Never treat this residual window as a reason to skip or defer step 2 — it's still the correct defense-in-depth layer, just not the primary one.

**Why a Server Action, not a new Edge Function:** this project's own `supabase-conventions` skill escalation order reserves Edge Functions for logic needing something external the app can't already do server-side. A Next.js Server Action is already a trusted, never-shipped-to-browser execution context that can safely hold `SUPABASE_SERVICE_ROLE_KEY` as a plain server-only env var — exactly like `SUPABASE_URL`/`SUPABASE_ANON_KEY` are already read server-side in `lib/supabase/server.ts`. Building a new Edge Function here would be new infrastructure for one admin call the existing layer already handles safely. This differs from `invite-user`'s existing Edge Function precedent only because invite-user ALSO needs to send an email via GoTrue's invite flow triggered server-side with no Next.js request context involved at accept-time — deactivation has no equivalent need.

**Example — `lib/supabase/admin.ts` (new file):**
```typescript
// Source: pattern established by this research, mirroring
// supabase/functions/invite-user/index.ts's own service_role client
// construction, adapted to a Next.js server-only module. NEVER import this
// file from a Client Component or anything that also handles untrusted
// request bodies directly — keep the blast radius of "code holding an
// RLS-bypassing key" to exactly one file, imported by exactly
// app/actions/equipe.ts.
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

**Example — `app/actions/equipe.ts` orchestration:**
```typescript
// Source: pattern established by this research, following Pattern 1/2.
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function desativarMembroEquipe(
  profileId: string,
  novoResponsavelId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("desativar_membro_equipe", {
    p_profile_id: profileId,
    p_novo_responsavel_id: novoResponsavelId,
  })
  if (error) {
    return { error: { code: "rpc_failed", message: error.message } }
  }

  const admin = createAdminClient()
  const { error: banError } = await admin.auth.admin.updateUserById(
    profileId,
    { ban_duration: "876000h" }
  )
  if (banError) {
    // Step 1 already committed — ativo=false is already enforced (Pattern
    // 1). Surface this specific failure distinctly so the UI can tell the
    // Supervisor the member IS deactivated in the app, but the login-block
    // step needs a retry.
    return {
      error: {
        code: "ban_failed",
        message:
          "Desativado no sistema, mas falha ao bloquear login. Tente novamente.",
      },
    }
  }

  return { data: { clientesReatribuidos: data?.[0]?.clientes_reatribuidos ?? 0 } }
}
```

### Pattern 3: Reuse `EditableListTab`'s Dialog/Badge/no-dialog-reactivate precedent, not a new UI vocabulary

**What:** Phase 3's `components/configuracoes/EditableListTab.tsx` already implements the exact UX shape this phase needs for a different table (`categorias`/`produtos_consumidos`/etc.): a per-row "Inativo" `Badge` (`variant="outline"`), a `Dialog`-based confirmation for the destructive-feeling action (deactivate), and a **no-dialog** one-click reactivate (matching D-02's "low-friction reversible" framing exactly — this project already made this same UX call once, in `STATE.md`'s Phase 3 decision log: "Reactivate has no confirmation dialog (only deactivate does) — D-03 treats reactivation as the deliberately low-friction reversal path").

**When to use:** Build `EquipeList`/`DesativarMembroDialog` following this exact shape (Dialog for desativar with the replacement-vendedor `Select` inside it, no dialog for reativar), rather than inventing a new confirmation pattern. The *data shape* differs (a profile isn't a lookup-table row, and desativar additionally requires picking a replacement — `ARCHITECTURE.md`'s own note that `equipe/` deserves its own subfolder rather than being forced into the generic `EnumList`/`EnumForm` pattern still holds), but the *interaction* precedent (Dialog vs. no-dialog, Badge styling, `variant="outline"`) should be copied, not redesigned.
**Trade-offs:** None — this is a pure consistency win, reduces UI-review surface since the interaction pattern is already proven live in this codebase.

### Anti-Patterns to Avoid

- **Chaining the reassignment `UPDATE` and the `ativo=false` `UPDATE` into one `WITH ... AS (...)` CTE "for efficiency":** they're already atomic as two sequential statements inside one `plpgsql` function/transaction — no CTE combination is needed for atomicity, and doing so risks reintroducing the exact bug already fixed once in this codebase (`0006_fix_importar_clientes_lote_cte_rls_visibility.sql` — see Pitfall A).
- **Treating the RPC-then-Auth-ban as one atomic operation:** it cannot be — GoTrue and Postgres are separate services (Anti-Pattern 5 in the milestone `ARCHITECTURE.md`). Always handle step 2's failure distinctly from step 1's.
- **Giving `profiles` a general Supervisor-scoped UPDATE policy "to keep things simple":** grants raw-client write access to every column, not just `ativo` — see Alternatives Considered.
- **Reaching for a new Edge Function because the Auth Admin API needs a secret key:** the heuristic in `supabase-conventions` targets logic needing something external the Server Action tier can't already do — a `service_role` env var read inside a Server Action is not "external," it's the same pattern this project already uses for its anon/URL env vars, just a more privileged key (Anti-Pattern 8 in the milestone `ARCHITECTURE.md`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blocking a user's future logins | A custom `blocked_users` table checked in middleware/login flow | `supabase.auth.admin.updateUserById(id, { ban_duration })` | GoTrue already has a first-class, documented mechanism for this; a custom table duplicates it and doesn't stop token refreshes the way the Auth-native ban does |
| Preventing concurrent "last Supervisor" race | A pre-check in the Server Action (`select count(*)` before calling the RPC) | `SELECT ... FOR UPDATE` inside the RPC's own transaction | A pre-check in application code is exactly the TOCTOU pattern Pitfall A warns against — two concurrent Server Action invocations could both pass a stale count before either RPC call locks anything |
| Confirming a destructive-feeling action | A custom modal component | The already-installed `Dialog` primitive, following `EditableListTab`'s exact usage | Consistency + zero new code; this project already has one working, reviewed confirmation-dialog pattern |

**Key insight:** Every piece of this phase's hard logic (concurrency-safe guard, cross-service login block, RLS cascade via a shared helper) already has an established, documented mechanism in this project's own stack or in Postgres/Supabase itself — there is no part of this phase that benefits from a custom implementation.

## Common Pitfalls

> Pitfalls 1-12 (numbered exactly as in the milestone-level `.planning/research/PITFALLS.md` v1.2 addendum) already cover this phase in depth — re-read Pitfalls 1, 2, 3, and 4 there before planning tasks; they are not repeated in full here. This section adds ONE new, phase-specific finding this research surfaced that the milestone-level document does not fully close.

### Pitfall A (= milestone Pitfall 4): Chained-CTE RLS-visibility bug recurrence

Already documented in `.planning/research/PITFALLS.md` (v1.2 addendum, Pitfall 4) — restated here because Pattern 1's RPC is the exact shape at risk. **How to avoid:** keep the `clientes` reassignment `UPDATE` and the `profiles.ativo` `UPDATE` (Pattern 1's Example) as two separate top-level `plpgsql` statements, never chained as two data-modifying CTEs inside one `WITH ... AS (...)` statement. Reference fix: `supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql`.

### Pitfall B (new): `is_supervisor()` gating `ativo` closes the Supervisor-branch of RLS, but NOT the Vendedor-branch — a residual-JWT-window gap the milestone research didn't fully resolve

**What goes wrong:** After this phase's `is_supervisor()` update, a deactivated **Supervisor** loses all Supervisor-branch access (`... or is_supervisor()`) on their very next request, because every affected policy already calls `is_supervisor()`. But `clientes`/`tarefas`/`historico`'s Vendedor-branch condition is `responsavel = (select auth.uid())` — a plain identity check that never references `profiles.ativo` at all. A deactivated **Vendedor**'s in-progress clientes are already reassigned away by Pattern 1's RPC (so `responsavel = auth.uid()` naturally stops matching those rows) — but per EQP-04, their `ganho`/`perdido` clientes are deliberately left with `responsavel` unchanged. This means: for as long as a deactivated Vendedor's JWT remains valid (the same ~1h residual window Pitfall 1 already names for the Supervisor case), that Vendedor's session can still `SELECT`/`UPDATE` their own remaining (closed) `clientes` rows, `tarefas`, and `historico` — e.g. editing `observacao` on an already-`ganho` cliente, or (absent any other guard) attempting to flip `status_acompanhamento` back to `em_andamento` via `mover_card_funil`, which itself has no `ativo` check either.

**Why it happens:** The milestone-level `ARCHITECTURE.md`/`PITFALLS.md` both frame the enforcement story around `is_supervisor()`'s cascade (correctly, for the Supervisor-only case), but EQP-03's actual requirement ("não consegue mais entrar no sistema") reads as "zero access, full stop" — a stronger bar than "loses Supervisor privileges" for the subset of users who are Vendedores, since Vendedor-branch RLS was never built to check role or `ativo` at all (it only ever checked row ownership).

**How to avoid — this is a genuine open decision for the planner, not a mechanically obvious fix:**
1. **Recommended, closes the gap fully:** add a second small helper, `is_ativo()` (`security definer`, same recursion-avoidance shape as `is_supervisor()`, `select exists (select 1 from profiles where id = (select auth.uid()) and ativo = true)`), and AND it into the Vendedor-branch of the `clientes`/`tarefas`/`historico` SELECT/UPDATE/INSERT policies (e.g. `using ((responsavel = (select auth.uid()) and is_ativo()) or is_supervisor())`). This requires editing ~8-10 existing policies via a new migration (`drop policy ...; create policy ...` — Postgres has no native "replace policy" statement analogous to `create or replace function`), a materially bigger diff than the "zero policy edits" story for the Supervisor-only cascade, but it makes `ativo` the true universal access gate `CLAUDE.md`'s "RLS is the sole authorization boundary" implies.
2. **Narrower, ships faster:** leave Vendedor-branch RLS unchanged, accept that a deactivated Vendedor retains read/write on their own already-closed clientes for up to the residual JWT window, and treat this as an accepted, documented residual limited to historical/closed records (not new prospecting, since `em_andamento` rows are already reassigned) — mirroring the "accepted residual" framing this project already uses for the Auth-ban window itself.

**Recommend option 1 if the team reads EQP-03 literally** ("não consegue mais entrar no sistema" = zero access); **option 2 is defensible** if the team is comfortable treating "can't create/move new business" (already guaranteed by reassignment) as sufficient and the residual window as cosmetic risk. This is exactly the kind of decision that should be made deliberately in planning, not defaulted silently either way.

**Warning signs:** A manual test — deactivate a Vendedor with at least one `ganho` cliente, keep their session open in a separate tab (don't refresh), and attempt to edit that cliente's `observacao` from the still-open tab. If it succeeds, the gap above is live.

**Phase to address:** This phase (Phase 10), as an explicit planning decision, not deferred.

## Code Examples

### `is_supervisor()` extension (same file/migration as Pattern 1's RPCs)

```sql
-- Source: pattern already fully specified in .planning/research/ARCHITECTURE.md
-- (v1.2 Additions, Pattern 7) — restated here for direct implementation.
create or replace function is_supervisor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'supervisor' and ativo = true
  );
$$;
```

### `profiles.ativo` column (same migration)

```sql
alter table profiles add column ativo boolean not null default true;
```

### Concurrency test shape (mirrors `tests/auth/rls-roles.test.ts`'s `SEED_ACCOUNTS` pattern)

```typescript
// Source: pattern established by this research, following
// tests/helpers/supabase-test-clients.ts's existing signInAs/serviceClient
// primitives and tests/auth/rls-roles.test.ts's SEED_ACCOUNTS shape.
//
// IMPORTANT: only ONE Supervisor seed account exists today
// (SEED_ACCOUNTS.supervisor). Testing EQP-02's last-active-Supervisor guard
// needs at least a SECOND active Supervisor — create one via
// serviceClient().auth.admin.createUser({ ..., role: "supervisor" }) as a
// test-local fixture (not a hardcoded SEED_ACCOUNTS entry, since it must be
// torn down/reset between test runs), then attempt two concurrent
// desativar_membro_equipe RPC calls against the last two active
// Supervisors and assert exactly one fails.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@supabase/auth-helpers-nextjs` for session handling | `@supabase/ssr` | Already migrated in this project (Phase 1) | Not directly relevant to this phase, but confirms the SSR client (`lib/supabase/server.ts`) used for the RPC call in Pattern 2 is already on the current supported package |

**Deprecated/outdated:** None specific to this phase — the Auth Admin API's `ban_duration` mechanism is the current, actively-documented approach (no older mechanism it replaced within this project's history, since this is the first feature needing it).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ban_duration: 'none'` is the correct value to unban/reactivate a user | Pattern 2 | If wrong, `reativar_membro_equipe`'s Server Action step 2 would fail or silently not restore login access even after `ativo=true` is set — low risk in practice since `ativo=true` already restores full RLS-level access; a residual Auth-side ban would only block a genuinely NEW sign-in attempt, surfacing quickly and visibly as a support report ("reativei mas a pessoa não consegue entrar") |
| A2 | `ban_duration` writes reliably persist on this project's specific hosted Supabase instance/version (a community-reported persistence bug exists in some versions, `supabase/auth#1798`) | Pattern 2 | If the ban doesn't persist, the Auth-level login block silently doesn't take effect — but `profiles.ativo=false` (Pattern 1) is still the PRIMARY enforcement and is unaffected, so the practical impact is limited to "a deactivated user can still complete a fresh login" while every subsequent RLS-gated request still correctly fails. Recommend a live smoke test (deactivate a real test account, attempt a fresh login) before considering this phase done, not just a code read-through |
| A3 | This project's current Supabase Auth JWT/access-token expiry is the ~1h Supabase default (used throughout this document as the residual-window estimate) | Pattern 2, Pitfall B | If the actual configured expiry is longer, the residual "still-valid-JWT" window after deactivation is correspondingly longer — worth a 2-minute check of the project's Auth settings (`access_token_expiry` / JWT expiry in `supabase/config.toml` or the dashboard) during planning, not a blocking assumption but cheap to confirm |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should Vendedor-branch RLS (`clientes`/`tarefas`/`historico`) also gate on `ativo`, not just `is_supervisor()`? (Pitfall B)**
   - What we know: `is_supervisor()`'s cascade fully closes the gap for the Supervisor role; it does nothing for the Vendedor-branch OR condition, which never checked role/ativo to begin with.
   - What's unclear: whether EQP-03's "não consegue mais entrar no sistema" is meant literally (zero access to anything, closing this gap now) or is satisfied by "can't create new business" (already guaranteed by reassignment), leaving a residual read/write window on already-closed clientes.
   - Recommendation: raise this explicitly in planning/discuss for a deliberate decision; default to Option 1 (add `is_ativo()`, extend the ~8-10 affected policies) if the team wants EQP-03 read literally, since `CLAUDE.md` treats RLS as the sole authorization boundary and this is the same class of gap the milestone research already flagged for the Supervisor case.

2. **Should reassignment write a `historico` audit entry (e.g. "Cliente reatribuído devido à desativação de X")?**
   - What we know: `historico.tipo` is a free-text column (no enum constraint), so a new `tipo = 'reatribuicao'` value is technically trivial to add; the existing triggers (`clientes_after_update_historico`) only fire on `etapa`/`status_acompanhamento` changes, not on `responsavel` changes, so reassignment currently produces NO historico trail at all.
   - What's unclear: not required by any of EQP-01..04's literal wording; CONTEXT.md doesn't mention it.
   - Recommendation: treat as a nice-to-have, not a requirement — flag to the human during planning as an optional Task, not a mandatory one; skip if it would meaningfully grow phase scope.

3. **Does `desativar_membro_equipe` need to validate that `p_novo_responsavel_id` is a `vendedor` specifically (not a `supervisor`)?**
   - What we know: the RPC's defensive check (Pattern 1's example) only validates the replacement exists and is `ativo = true`, not their role. Nothing in `CLAUDE.md`/CONTEXT.md forbids a Supervisor from being the reassignment target (a Supervisor already can own clientes per the domain model, though the UI/product flow calls the replacement "vendedor substituto").
   - What's unclear: whether the UI should restrict the picker to `role = 'vendedor'` only, or allow any active member.
   - Recommendation: default to restricting the picker's options to active Vendedores in the UI (matches the product framing "vendedor substituto" literally), but don't add a role check inside the RPC itself unless the team wants defense-in-depth here too — low risk either way since a Supervisor choosing another Supervisor as the reassignment target isn't a data-integrity problem.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` env var | Pattern 2's Server Action / `lib/supabase/admin.ts` | Assumed present (already used by `supabase/functions/invite-user/index.ts` via `Deno.env.get`) — confirm it is ALSO available as a plain Node.js server env var to Next.js Server Actions (not just to the Deno Edge Function runtime), since this is the first feature reading it from the Next.js server process rather than an Edge Function | — | If not present in `.env.local`/Vercel env vars for the Next.js app specifically, add it there before implementation — it is a different runtime from the Edge Function's `Deno.env.get`, even though the underlying secret value is the same |
| A second active Supervisor test account | EQP-02 concurrency test (Pitfall A / milestone Pitfall 3) | Not present today — only one Supervisor seed account exists (`SEED_ACCOUNTS.supervisor`) | — | Create a test-local fixture via `serviceClient().auth.admin.createUser(...)`, not a new hardcoded `SEED_ACCOUNTS` entry (see Code Examples) |

**Missing dependencies with no fallback:** None — both items above have a clear, low-cost resolution path.

**Missing dependencies with fallback:** `SUPABASE_SERVICE_ROLE_KEY` for the Next.js server process (fallback: add the env var); second Supervisor account (fallback: test-local fixture).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (installed, `"test": "vitest run"` in `package.json`) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npx vitest run tests/equipe` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EQP-01 | Supervisor deactivates a member, replacement inherits em_andamento clientes | integration (RLS/RPC, signed-in client, mirrors `tests/importacao/rls-importar-lote.test.ts`) | `npx vitest run tests/equipe/reassignment.test.ts -t "reassigns em_andamento"` | ❌ Wave 0 |
| EQP-02 | Last active Supervisor cannot be deactivated (incl. concurrently) | integration | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "last supervisor"` | ❌ Wave 0 |
| EQP-02 | Supervisor cannot deactivate own account (D-01) | integration | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "self"` | ❌ Wave 0 |
| EQP-03 | Deactivated member's `is_supervisor()`/RLS access is rejected on next request | integration, mirrors `tests/auth/rls-roles.test.ts`'s `is_supervisor()` RPC test shape | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "is_supervisor"` | ❌ Wave 0 |
| EQP-04 | ganho/perdido clientes keep original `responsavel` after deactivation | integration | `npx vitest run tests/equipe/reassignment.test.ts -t "preserves closed"` | ❌ Wave 0 |
| EQP-03 (manual) | Real Auth-ban blocks a fresh login attempt on the hosted project (Assumption A2) | manual-only, justified — Auth Admin API side effects aren't safely repeatable/automatable against the live free-tier project without a dedicated disposable test user each run | manual: attempt login as a just-deactivated test account | n/a |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/equipe`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/equipe/rls-desativar-membro.test.ts` — covers EQP-02, EQP-03
- [ ] `tests/equipe/reassignment.test.ts` — covers EQP-01, EQP-04
- [ ] A second active-Supervisor test fixture helper (see Environment Availability) — needed by the concurrency test in `rls-desativar-membro.test.ts`
- [ ] Framework install: none — Vitest already installed and configured project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth Admin API `ban_duration` (Pattern 2) — blocks future authentication, server-side only, `service_role` key never client-exposed |
| V3 Session Management | Yes | RLS re-evaluated per-request via `is_supervisor()`/`ativo` (Pattern 1) is what actually invalidates an already-authenticated session's *authorization*, since Supabase JWTs are not server-side-revocable mid-lifetime by this mechanism alone |
| V4 Access Control | Yes | `SECURITY DEFINER` RPCs self-gated by `is_supervisor()` as the first statement (Pattern 1); `FOR UPDATE` row lock closes the last-Supervisor TOCTOU window (Pitfall A) |
| V5 Input Validation | Yes | RPC parameters (`p_profile_id`, `p_novo_responsavel_id`) validated inside the `SECURITY DEFINER` function itself (existence + `ativo=true` check on the replacement) since RLS is bypassed for this function and cannot be relied on as a backstop here |
| V6 Cryptography | No | No new cryptographic operation introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| TOCTOU race on last-active-Supervisor count | Elevation of Privilege (indirectly — could zero out all Supervisor access) | `SELECT ... FOR UPDATE` lock inside the same transaction as the guard check (Pitfall A) |
| Self-deactivation mid-session | Denial of Service (self-inflicted, but still a real lockout risk if the last-supervisor guard alone were relied on) | Explicit `p_profile_id <> auth.uid()` check (D-01), independent of and prior to the last-supervisor guard |
| Residual valid JWT after ban (V3) | Elevation of Privilege / stale authorization | `profiles.ativo` + RLS as the PRIMARY, immediate cutoff (Pattern 1); Auth ban as secondary; explicitly documented residual window, not silently accepted |
| Vendedor-branch RLS not gated by `ativo` (Pitfall B) | Elevation of Privilege (a deactivated Vendedor retains access to their own closed clientes for the residual JWT window) | Explicit planning decision required — see Pitfall B / Open Question 1 |
| `SECURITY DEFINER` RPC used as a privilege-escalation vector if its internal guard is ever removed/weakened | Elevation of Privilege | Every `SECURITY DEFINER` function in this codebase (`is_supervisor()`, and now these two RPCs) MUST keep its authorization check as the literal first statement; code review checklist item, not just a test |

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/0001_profiles_and_roles.sql`, `0002_clientes_and_funil.sql`, `0003_dashboard_aggregates.sql` — read directly from this repository.
- `supabase/functions/invite-user/index.ts`, `app/(app)/equipe/page.tsx`, `components/configuracoes/EditableListTab.tsx`, `components/auth/InviteUserForm.tsx`, `lib/supabase/server.ts`, `tests/helpers/supabase-test-clients.ts`, `tests/auth/rls-roles.test.ts`, `tests/importacao/rls-importar-lote.test.ts`, `tests/dashboard/rls-dashboard.test.ts` — read directly, all live/committed code.
- `.claude/skills/Supabase-conventions/SKILL.md` — read directly, project convention.
- `.planning/research/ARCHITECTURE.md` (v1.2 Additions, Patterns 7-10, Anti-Patterns 5/8) and `.planning/research/PITFALLS.md` (v1.2 addendum, Pitfalls 1-4, 8, 11) — read directly, milestone-level research this phase builds on rather than repeats.
- `npm view @supabase/supabase-js version` → `2.110.8` — direct registry lookup. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- [JavaScript: updateUserById | Supabase Docs](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) — fetched directly via WebFetch this session; confirms `ban_duration` duration-string format and the `"876000h"` example. [CITED]
- Postgres `SELECT ... FOR UPDATE` pattern for TOCTOU-safe guard checks — cross-checked via WebSearch against multiple independent explanations (Stormatics, Medium/fresha-data-engineering, oneuptime.com), consistent with the already-adopted pattern in `.planning/research/PITFALLS.md`'s milestone addendum. [CITED]

### Tertiary (LOW confidence)

- `ban_duration: 'none'` as the unban value, and the accepted unit-suffix list beyond `h` — surfaced via WebSearch (community sources: a dev journal post, GitHub Discussion #22775, GitHub Issue supabase/auth#1798) but not independently confirmed on the officially-fetched docs page itself. [ASSUMED — see Assumptions Log A1/A2]
- `supabase/auth#1798` (community-reported `ban_duration` persistence bug in some versions) — a single GitHub issue, not cross-verified against this project's specific Supabase version. [ASSUMED — verify live per Assumption A2]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, existing package version verified against the live npm registry.
- Architecture (RPC/RLS design): HIGH — every schema/policy claim traced directly to this repository's own committed migrations, not inferred.
- Auth Admin API mechanism (`ban_duration`): MEDIUM — official docs page fetched directly this session, cross-checked against community sources, but the exact unban value and version-specific persistence behavior are not confirmed against an authoritative source and are flagged `[ASSUMED]` pending a live smoke test.
- Pitfalls: HIGH for Pitfall A (direct precedent already fixed once in this codebase); MEDIUM-HIGH for Pitfall B (sound RLS reasoning, but frames a genuine open product/security decision rather than a fixed fact).

**Research date:** 2026-07-27
**Valid until:** 30 days (stable domain — Postgres RLS/RPC semantics and this project's own schema don't change quickly; re-verify the Auth Admin API specifics if this phase is delayed past that window, since GoTrue's admin API has had version-specific behavior changes reported in the wild)
