# Phase 10: Desativação de Membro da Equipe - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 6 (1 migration, 1 Server Action file, 1 new admin client, 2 new components, 1 edited page)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `supabase/migrations/0008_desativacao_membro_equipe.sql` | migration | CRUD (guarded write) + event-driven (reassignment) | `supabase/migrations/0002_clientes_and_funil.sql` (`mover_card_funil`) + `supabase/migrations/0001_profiles_and_roles.sql` (`is_supervisor()`) | exact |
| `lib/supabase/admin.ts` | config/client factory | — | `supabase/functions/invite-user/index.ts`'s `adminClient` construction (Deno) + `lib/supabase/server.ts` (Next.js client factory shape) | role-match (first Node-side service_role client in this codebase) |
| `app/actions/equipe.ts` | service (Server Action) | request-response (RPC-then-Auth-Admin-API orchestration) | `app/actions/clientes.ts` (`deleteCliente`, role-check + structured error-code result shape) | exact |
| `components/equipe/EquipeList.tsx` | component (Client Component) | request-response (row actions + optimistic local state update) | `components/configuracoes/EditableListTab.tsx` | exact |
| `components/equipe/DesativarMembroDialog.tsx` | component (dialog + form) | request-response (confirm + required-Select submit) | `components/clientes/ClienteDetailSheet.tsx`'s delete-confirmation `Dialog` (lines 1062-1096) + its `Select`-based required-field pattern (lines 622-640) | role-match |
| `app/(app)/equipe/page.tsx` | route (Server Component, edited in place) | request-response (read + pass to Client Component) | itself (existing file, edited in place) | exact |

## Pattern Assignments

### `supabase/migrations/0008_desativacao_membro_equipe.sql` (migration, CRUD + event-driven)

**Analogs:** `supabase/migrations/0001_profiles_and_roles.sql` (`is_supervisor()`, `profiles`'s "deliberately no write policy" posture) + `supabase/migrations/0002_clientes_and_funil.sql` (`mover_card_funil`'s guard-first non-definer shape, referenced only for the *guard-first* structure — this migration deviates into `security definer` for the reason below).

**`profiles.ativo` column + `is_supervisor()` extension** (copy exactly, per RESEARCH.md Code Examples, itself already traced to this repo's `0001` file above):
```sql
alter table profiles add column ativo boolean not null default true;

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

**`SECURITY DEFINER` RPC-pair pattern to copy** (RESEARCH.md Pattern 1, full text — this is the exact SQL to use, not just inspiration; only the naming/guard-order structure is "borrowed" from `is_supervisor()`'s own `security definer` self-gate rationale in `0001`, since `mover_card_funil` itself is non-definer and does NOT need to be copied verbatim, only its "raise exception as first statement" shape):
```sql
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

  if p_profile_id = (select auth.uid()) then
    raise exception 'Não é possível desativar a própria conta';
  end if;

  select role into v_target_role from profiles where id = p_profile_id;
  if v_target_role is null then
    raise exception 'Membro não encontrado';
  end if;

  if not exists (
    select 1 from profiles
    where id = p_novo_responsavel_id and ativo = true
  ) then
    raise exception 'Vendedor substituto inválido ou inativo';
  end if;

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

  -- Sequential top-level statement, NOT chained into the same CTE as the
  -- next UPDATE (Pitfall A / the 0006 CTE-RLS-visibility bug precedent).
  update clientes
  set responsavel = p_novo_responsavel_id
  where responsavel = p_profile_id
    and status_acompanhamento = 'em_andamento';
  get diagnostics v_reatribuidos = row_count;

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

  update profiles set ativo = true where id = p_profile_id;
end;
$$;
```

**Why `security definer` here, not the `mover_card_funil` non-definer style:** `profiles` (per `0001`'s own header comment, quoted above) has zero write policies for any regular user by design — a non-definer RPC's internal `UPDATE profiles` would affect 0 rows regardless of caller. This is the second documented exception to the project's "avoid security definer" convention, mirroring `is_supervisor()`'s own precedent exactly (self-gate as literal first statement). Do not add a general Supervisor-scoped UPDATE policy on `profiles` as an alternative — see RESEARCH.md's Alternatives Considered (privilege-escalation surface on every column, including `role`).

**Anti-pattern to avoid explicitly (already fixed once in this codebase):** do not combine the `clientes` reassignment `UPDATE` and the `profiles.ativo` `UPDATE` into one `WITH ... AS (...)` CTE. Reference fix already in this repo: `supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql`.

**Decision resolved by the user (RESEARCH.md Pitfall B / Open Question 1) — do NOT re-ask, do NOT add scope:** presented directly to the user as "Quando um vendedor é desativado... a sessão antiga pode continuar valendo por até 1 hora... ele ainda consegue ver/editar os PRÓPRIOS clientes já fechados... Isso é aceitável?" User selected **"Aceitável (Recomendado)"**. This phase does NOT add an `is_ativo()` helper or extend the Vendedor-branch RLS on `clientes`/`tarefas`/`historico` — the ~1h residual-JWT window (Auth `ban_duration` blocks future logins/refreshes only, doesn't revoke an already-issued token) is an accepted, documented tradeoff, not a gap to close in this phase. The planner should treat this as already-decided scope, not surface it as an open question again.

---

### `lib/supabase/admin.ts` (new file — service_role client factory)

**Analog:** `supabase/functions/invite-user/index.ts`'s `adminClient` construction (lines 110-113, Deno runtime) for the "service_role key + createClient with no cookie/session handling" shape, adapted to a Next.js server module (mirrors `lib/supabase/server.ts`'s existing "one exported factory function" convention, but reads a Node env var instead of `Deno.env.get` and skips the cookie-based session entirely since this client's only use is the Admin API, not a user-scoped session).

**Pattern to copy** (RESEARCH.md's own example, already verified against this repo's `invite-user` precedent):
```typescript
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

**Critical constraint:** import this file ONLY from `app/actions/equipe.ts` — never from a Client Component or anything handling untrusted request bodies directly (same "blast radius of one file" discipline the `invite-user` Edge Function's own header comment documents for its own `adminClient`). Confirm `SUPABASE_SERVICE_ROLE_KEY` is available as a plain Node env var to Next.js Server Actions (not just `Deno.env.get` inside the Edge Function runtime) — per RESEARCH.md's Environment Availability table, this is the first feature reading it from the Next.js server process.

---

### `app/actions/equipe.ts` (new file — Server Action)

**Analog:** `app/actions/clientes.ts`, specifically `deleteCliente`'s shape (lines 299-353: role-check via `profiles.role` lookup, structured `{ data } | { error: { code } }` result type, `revalidatePath` on success) and `createCliente`/`updateCliente`'s "look up caller role, then act" preamble (lines 32-56).

**Imports pattern to copy** (`app/actions/clientes.ts` lines 1-13):
```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
```
Add `import { createAdminClient } from "@/lib/supabase/admin"` for the Auth Admin API step.

**Result-type pattern to copy** (`app/actions/clientes.ts` lines 299-304, `DeleteClienteResult` shape):
```typescript
export type DesativarMembroErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "rpc_failed"
  | "ban_failed"
  | "generic"

export type DesativarMembroResult =
  | { data: { clientesReatribuidos: number }; error?: undefined }
  | { data?: undefined; error: { code: DesativarMembroErrorCode; message?: string } }
```

**Core orchestration pattern — RPC first, Auth Admin API second** (RESEARCH.md Pattern 2's example, this is the exact code to use):
```typescript
export async function desativarMembroEquipe(
  profileId: string,
  novoResponsavelId: string
): Promise<DesativarMembroResult> {
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
    // Step 1 already committed — ativo=false already enforced. Surface this
    // distinctly (UI-SPEC's "ban_failed" partial-failure copy), same
    // discipline as deleteCliente's non-revealing-but-distinct error codes.
    return { error: { code: "ban_failed" } }
  }

  revalidatePath("/equipe")
  return { data: { clientesReatribuidos: data?.[0]?.clientes_reatribuidos ?? 0 } }
}

export async function reativarMembroEquipe(
  profileId: string
): Promise<DesativarMembroResult> {
  const supabase = await createClient()

  const { error } = await supabase.rpc("reativar_membro_equipe", {
    p_profile_id: profileId,
  })
  if (error) {
    return { error: { code: "rpc_failed", message: error.message } }
  }

  const admin = createAdminClient()
  const { error: banError } = await admin.auth.admin.updateUserById(
    profileId,
    { ban_duration: "none" } // [ASSUMED — verify live, RESEARCH.md A1/A2]
  )
  if (banError) {
    return { error: { code: "ban_failed" } }
  }

  revalidatePath("/equipe")
  return { data: { clientesReatribuidos: 0 } }
}
```

**Error handling pattern** — map Postgres `raise exception` messages (or a distinguishing `error.message` substring/code) to the exact UI-SPEC Copywriting Contract strings inside `DesativarMembroDialog.tsx`'s submit handler, the same way `EditableListTab.confirmDeactivate()`/`ClienteDetailSheet.onSubmit` map `result.error.code` to copy — do not invent new generic error-banner plumbing.

---

### `components/equipe/EquipeList.tsx` (Client Component, row actions + Status badge)

**Analog:** `components/configuracoes/EditableListTab.tsx` (full file, read above).

**State/tracking pattern to copy** (`EditableListTab.tsx` lines 73-96 — adapt to this component's narrower scope, no edit-in-place needed here, only deactivate-dialog-target + reactivating-id + success/form banners):
```typescript
const [formError, setFormError] = useState<string | null>(null)
const [successMessage, setSuccessMessage] = useState<string | null>(null)

// Deactivate confirmation dialog — low-friction, reversible (mirrors D-03).
const [deactivateTarget, setDeactivateTarget] = useState<Member | null>(null)

// Reactivate (no dialog) — tracks which row's Eye button is mid-flight.
const [reactivatingId, setReactivatingId] = useState<string | null>(null)
```

**Reactivate-no-dialog pattern to copy verbatim in shape** (`EditableListTab.tsx` lines 245-265, `reactivate()`):
```typescript
async function handleReativar(member: Member) {
  setReactivatingId(member.id)
  const result = await reativarMembroEquipe(member.id)
  if (result.error) {
    setSuccessMessage(null)
    setFormError("Não foi possível reativar. Tente novamente.")
    setReactivatingId(null)
    return
  }
  setMembers((current) =>
    current.map((m) => (m.id === member.id ? { ...m, ativo: true } : m))
  )
  setFormError(null)
  setSuccessMessage(`${member.nome} reativado(a).`)
  setReactivatingId(null)
}
```

**Row-action Button/Badge pattern to copy exactly** (`EditableListTab.tsx` lines 386-458 — `EyeOff`/`Eye` icon buttons, `variant="ghost"`, `size="icon"`, `Badge variant="outline"` for the inactive indicator; UI-SPEC extends this to show BOTH "Ativo"/"Inativo" states, not just the inactive one, still using the same neutral `variant="outline"`):
```typescript
<Badge variant="outline">{member.ativo ? "Ativo" : "Inativo"}</Badge>
...
{member.ativo ? (
  isSelf ? null : ( // D-01: hide the action entirely on the caller's own row
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Desativar ${member.nome}`}
      onClick={() => openDeactivateDialog(member)}
    >
      <EyeOff className="size-4" />
    </Button>
  )
) : (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    aria-label={`Reativar ${member.nome}`}
    disabled={reactivatingId === member.id}
    onClick={() => void handleReativar(member)}
  >
    <Eye className="size-4" />
  </Button>
)}
```

**Success/error banner pattern to copy exactly** (`EditableListTab.tsx` lines 296-312 — `role="alert"`/`role="status"`, `bg-destructive/10`/`bg-primary/10`):
```typescript
{formError ? (
  <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {formError}
  </div>
) : null}
{successMessage ? (
  <div role="status" className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
    {successMessage}
  </div>
) : null}
```

**Table structure note:** unlike `EditableListTab`'s div-list rows, `EquipeList` renders inside the existing real `<table>` from `app/(app)/equipe/page.tsx` (UI-SPEC §1: "stays the existing `<tr>`/`<td className=\"px-4 py-2\">` rhythm... do NOT switch to `EditableListTab`'s `min-h-11` div-row shape"). Copy `EditableListTab`'s *interaction* patterns (dialog/badge/no-dialog-reactivate), not its *row-container* markup.

---

### `components/equipe/DesativarMembroDialog.tsx` (replacement picker + confirm)

**Analog:** `components/clientes/ClienteDetailSheet.tsx`'s delete-confirmation `Dialog` (lines 1062-1096) for the Dialog/Cancelar-Confirmar shape, and its `Select`-based required-field pattern (lines 622-640, the `responsavel` picker) for the replacement-vendedor `Select`.

**Dialog shell pattern to copy** (`ClienteDetailSheet.tsx` lines 1062-1096 — note this project's precedent uses `variant="destructive"` for a truly-irreversible delete; per UI-SPEC and `EditableListTab`'s own deactivate dialog, THIS dialog must use `variant="secondary"` instead, since deactivation is reversible, D-02):
```typescript
<Dialog open={deactivateTarget !== null} onOpenChange={handleDialogChange}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Desativar {member?.nome} {member?.sobrenome}?</DialogTitle>
    </DialogHeader>

    <p className="text-sm text-muted-foreground">
      Os clientes em andamento de {member?.nome} passam a ser atendidos pelo
      vendedor que você escolher abaixo. Os clientes já ganhos ou perdidos
      continuam no histórico de {member?.nome}, sem mudar. {member?.nome} não
      vai mais conseguir entrar no sistema, mas o nome e o histórico dele(a)
      continuam visíveis. Você pode reativar o acesso quando quiser.
    </p>

    {/* Select goes here — see below */}

    {formError ? (
      <p role="alert" className="text-sm text-destructive">{formError}</p>
    ) : null}

    <DialogFooter>
      <Button type="button" variant="ghost" onClick={() => handleDialogChange(false)} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button type="button" variant="secondary" onClick={() => void handleConfirm()} disabled={isSubmitting}>
        {isSubmitting ? "Desativando..." : "Desativar"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Required-Select pattern to copy exactly** (`ClienteDetailSheet.tsx` lines 622-640, the `responsavel` field — same "no sentinel value, must pick a real id" shape UI-SPEC requires for "Vendedor substituto"):
```typescript
<Select value={novoResponsavelId} onValueChange={setNovoResponsavelId}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Selecione o substituto" />
  </SelectTrigger>
  <SelectContent>
    {vendedoresAtivos.map((vendedor) => (
      <SelectItem key={vendedor.id} value={vendedor.id}>
        {vendedor.nome} {vendedor.sobrenome}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```
`vendedoresAtivos` must be filtered to `role === "vendedor" && ativo === true` (RESEARCH.md Open Question 3's recommendation) — a UI-level convenience only; the RPC's own defensive `ativo = true` check (Pattern 1 above) remains the real trust boundary.

**Validation-order pattern to copy** (mirrors `ClienteDetailSheet.onSubmit`'s "client-side check first, then map Server Action's `error.code`" discipline): block the Confirm click if nothing is selected (UI-SPEC's "Selecione um vendedor substituto antes de confirmar."), then call `desativarMembroEquipe` and map `error.code` (`rpc_failed`/`ban_failed`/`generic`) to the exact Copywriting Contract strings — same mapping shape as `EditableListTab.confirmDeactivate()`'s `GENERIC_ERROR` fallback.

**Submit handler pattern to copy** (`ClienteDetailSheet.tsx` lines 465-487, `handleConfirmDelete` — same try/catch + `isSubmitting`/error-state shape, adapted to call `desativarMembroEquipe(member.id, novoResponsavelId)` instead of `deleteCliente`).

---

### `app/(app)/equipe/page.tsx` (edited in place)

**Analog:** itself (full file read above, 96 lines).

**Change 1 — fetch `ativo`** (extend the existing `select` on line 41):
```typescript
const { data: members } = await supabase
  .from("profiles")
  .select("id, nome, sobrenome, email, role, ativo")
  .order("nome", { ascending: true })
```

**Change 2 — replace the inline `<table>` (lines 54-81) with `<EquipeList members={members ?? []} currentUserId={user.id} />`**, passing `session user id` so `EquipeList` can hide the Desativar action on the caller's own row (D-01, UI-SPEC §1) — this is new plumbing this file doesn't currently have (today's `page.tsx` never passes the logged-in user's id downstream to a child component).

**Unchanged:** the Supervisor-only redirect guard (lines 18-37), the `InviteUserForm` header, and the "Nenhum membro cadastrado" empty state (lines 82-93) — all stay exactly as-is per UI-SPEC's "no new screen, this is composition only" framing.

---

## Shared Patterns

### Server Action structured error-code result
**Source:** `app/actions/clientes.ts` (`{ data } | { error: { code } }` shape, used by `createCliente`/`updateCliente`/`deleteCliente`)
**Apply to:** `desativarMembroEquipe`/`reativarMembroEquipe` in `app/actions/equipe.ts` — same discriminated-union return shape, same "map code to copy in the caller" discipline.

### Caller-role check before privileged action
**Source:** `app/actions/clientes.ts`'s `deleteCliente` (lines 313-334) and `supabase/functions/invite-user/index.ts`'s caller-role gate (lines 70-87)
**Apply to:** any app-layer check inside `app/actions/equipe.ts` before calling the RPC — UX-only, since the real boundary is `is_supervisor()` inside the `SECURITY DEFINER` RPC itself (mirrors the invite-user Edge Function's own documented "this app-layer check is UX only" framing).

### Dialog for destructive-feeling-but-reversible action, no-dialog for its reverse
**Source:** `components/configuracoes/EditableListTab.tsx` (`confirmDeactivate`/`reactivate`), already logged as a locked decision in `STATE.md`'s Phase 3 entry
**Apply to:** `DesativarMembroDialog.tsx` (Dialog) + `EquipeList.tsx`'s direct-click Reativar (no dialog) — including the `variant="secondary"` (not `"destructive"`) confirm-button convention, since D-02 frames deactivation as reversible.

### Neutral `Badge variant="outline"` for ativo/inativo state
**Source:** `components/configuracoes/EditableListTab.tsx` line 395 (`Badge variant="outline"`, "Inativo")
**Apply to:** `EquipeList.tsx`'s new Status column — extended to render both "Ativo" and "Inativo" (UI-SPEC explicitly forbids color-coding this, e.g. no green/red).

### `service_role` client confined to one file
**Source:** `supabase/functions/invite-user/index.ts`'s `adminClient` construction + its own header comment on key-exposure discipline
**Apply to:** `lib/supabase/admin.ts` — import only from `app/actions/equipe.ts`, never from a Client Component.

### `NOT VALID`-style migration caution / sequential-statement-not-CTE discipline
**Source:** `supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql` (the bug this project already fixed once)
**Apply to:** `desativar_membro_equipe`'s reassignment + deactivation `UPDATE`s — keep as two sequential top-level statements, never chain into one CTE.

## No Analog Found

None — every new/modified file in this phase has a strong same-codebase precedent (see Match Quality column above). The one genuinely novel piece (`lib/supabase/admin.ts` as a Next.js-side service_role client) still has a directly transposable analog in `supabase/functions/invite-user/index.ts`'s `adminClient`, just in a different runtime.

## Metadata

**Analog search scope:** `app/actions/`, `app/(app)/equipe/`, `components/configuracoes/`, `components/clientes/`, `lib/supabase/`, `supabase/functions/invite-user/`, `supabase/migrations/`
**Files scanned:** `app/(app)/equipe/page.tsx`, `components/configuracoes/EditableListTab.tsx`, `app/actions/clientes.ts`, `lib/supabase/server.ts`, `supabase/functions/invite-user/index.ts`, `supabase/migrations/0001_profiles_and_roles.sql`, `components/clientes/ClienteDetailSheet.tsx` (grep-scanned + targeted reads of Dialog/Select/delete-handler sections)
**Pattern extraction date:** 2026-07-27
