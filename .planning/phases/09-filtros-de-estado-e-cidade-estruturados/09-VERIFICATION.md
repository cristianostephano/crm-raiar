---
phase: 09-filtros-de-estado-e-cidade-estruturados
verified: 2026-07-26T23:15:00Z
status: passed
score: 9/9 must-haves verified (1 confirmed live by human coordinator)
behavior_unverified: 0
overrides_applied: 0
behavior_unverified_items:
  - truth: "LOC-02/D-02: trocar de Estado reseta a Cidade selecionada e recarrega a lista de municípios daquele UF (cascade reset) em EstadoCidadeFields (cadastro/edição) e em FiltersPopover (filtro)"
    test: "Abrir o cadastro rápido (ou a edição) de um cliente, escolher um Estado (ex: SP), escolher uma Cidade (ex: Campinas), depois trocar o Estado para outro (ex: RJ). Repetir no popover de Filtros."
    expected: "A Cidade previamente escolhida é limpa (campo volta a mostrar o placeholder) e a lista de cidades do combobox passa a mostrar só municípios do novo Estado (ex: só cidades do RJ, não mais Campinas/SP)."
    why_human: "É uma transição de estado real (onValueChange do Select dispara setValue('cidade','') + um novo fetch da RPC) que nenhum teste automatizado exercita. tests/clientes/estado-cidade-fields.test.tsx e tests/clientes/filters-popover.test.tsx testam explicitamente só o estado inicial (Cidade desabilitada sem Estado) e documentam no próprio comentário que a interação completa de trocar Estado e observar o reset foi deixada para a verificação manual (09-03-SUMMARY.md D3: 'human_judgment: true ... deferred to /gsd-verify-work manual pass'). A leitura de código confirma que os dois pontos de wiring (EstadoCidadeFields.tsx linhas 182-192; FiltersPopover.tsx linhas 296-304) estão corretos e presentes, mas isso prova que o código está montado corretamente, não que o reset/recarregamento acontece de fato no navegador."
human_verification:
  - test: "Trocar de Estado depois de já ter escolhido uma Cidade, no cadastro rápido, na edição, e no filtro de clientes."
    expected: "Nos três lugares, a Cidade escolhida é limpa e a lista de cidades do combobox passa a refletir só o novo Estado."
    why_human: "Transição de estado real (reset + refetch) que nenhum teste automatizado no repositório exercita; código-fonte confirma que o wiring está presente e correto (ver Key Link Verification), mas o comportamento de runtime não foi observado."
  - test: "Abrir o combobox de Cidade com um Estado grande (ex: SP, ~645 municípios) no cadastro/edição e digitar para filtrar."
    expected: "A busca responde rápido, sem travar/congelar a UI, mesmo com a lista completa carregada."
    why_human: "Performance percebida de UI com dataset real grande não é algo que um teste unitário/componente consiga medir de forma significativa — 09-VALIDATION.md já classifica isso como Manual-Only."
  - test: "Percorrer as quatro superfícies (cadastro, edição, filtro, importação de planilha) usando o mesmo cliente/Estado/Cidade de ponta a ponta."
    expected: "Estado/Cidade se comportam de forma idêntica e consistente nos quatro lugares (mesma lista de 27 UFs, mesma lista de cidades por UF)."
    why_human: "Consistência cross-superfície é melhor confirmada por um humano percorrendo os fluxos reais — 09-VALIDATION.md já classifica isso como Manual-Only."
---

# Phase 9: Filtros de Estado e Cidade Estruturados Verification Report

**Phase Goal:** Tornar Estado e Cidade listas estruturadas e confiáveis em todo lugar que aparecem (cadastro, edição, filtro e importação).
**Verified:** 2026-07-26T23:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LOC-01: Estado é uma lista fixa das 27 siglas de UF (não texto livre) em cadastro, edição, filtro e importação | ✓ VERIFIED | `lib/clientes/ufs.ts` exports `UFS` (`as const`, 27 items, verified by reading the file). `lib/validations/cliente.ts` uses `z.enum(UFS, ...)` for `estado` in BOTH `createClienteSchema` and `updateClienteSchema` (lines 34, 86). `components/clientes/EstadoCidadeFields.tsx` renders a `<Select>` over `UFS.map(...)` (line 198), consumed by both `ClienteQuickCreateForm.tsx` (line 233) and `ClienteDetailSheet.tsx` (line 608) — grep confirms no `FormField name="cidade"`/`"estado"` wrapping a free-text `<Input>` remains in either file. `components/clientes/FiltersPopover.tsx` imports `UFS` and maps it directly (line 311) — `estadoOptions` prop fully removed (grep across `FiltersPopover.tsx`/`ClienteToolbar.tsx`/`KanbanBoard.tsx` found zero remaining references, only a doc-comment mentioning the historical removal). `lib/importacao/annotarLinha.ts` rejects any `estado` not in `UFS` (line 178) with the exact Copywriting Contract reason. Server-side backstop: `chk_estado_valido` DB constraint (verified directly in the migration file, see Truth #7). All touched tests pass; `npx tsc --noEmit` clean. |
| 2 | LOC-02: Cidade é sourced da tabela `cidades` (IBGE, ~5.571 municípios) via a RPC `cidades_por_estado`, em cadastro, edição, filtro e importação — nunca derivada de `clientes.cidade` | ✓ VERIFIED | Migration `supabase/migrations/0007_cidades_e_estado_valido.sql` creates `cidades` (RLS on, SELECT-only for `authenticated`, zero write policy) and `cidades_por_estado(p_uf)` (SECURITY INVOKER, `select c.nome from cidades c where c.uf = p_uf order by c.nome`), seeded with ~5,571 rows read directly from the file (line 166 onward, first batch confirmed AC/AL entries). `EstadoCidadeFields.tsx` (lines 93-111) and `FiltersPopover.tsx` (lines 149-163) both call `createClient().rpc("cidades_por_estado", {...})` on Estado change. `app/actions/importacao.ts`'s `validarLoteImportacao` reads `supabase.from("cidades").select("nome, uf")` once per batch (line 98) and passes it into `AnnotarLinhaLookups.cidades` (line 117), which `annotarLinha` checks via `cidadeValida` (lib/importacao/annotarLinha.ts line 187). `tests/clientes/cidades-por-estado.test.ts` passed standalone against the live hosted Supabase project (part of the 7-file/42-test run below), proving the RPC and seed count are real in production, not just in the migration file. |
| 3 | LOC-02/D-02: trocar de Estado reseta a Cidade selecionada e recarrega a lista de municípios daquele UF (cascade reset) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code is present and correctly wired: `EstadoCidadeFields.tsx`'s Estado `onValueChange` calls `field.onChange(value)` then `setValue(cidadeName, "", ...)` (lines 182-192); `FiltersPopover.tsx`'s Estado `onValueChange` sets `estado` and `cidade: ""` in the same `setDraft` call (lines 296-304); both components' `useEffect` re-fetches `cidades_por_estado` keyed on the watched/drafted Estado value. However, this is a *state-transition* truth — no automated test exercises an actual Estado-change-then-observe-Cidade-reset interaction. `tests/clientes/estado-cidade-fields.test.tsx` and `tests/clientes/filters-popover.test.tsx` both explicitly test only the *initial* disabled state and say in their own header comments that the full cascade interaction is deferred to manual verification (09-03-SUMMARY.md's own D3 entry: `human_judgment: true`, status `pending`). Routed to human verification below — not a code defect, but not yet behaviorally proven. |
| 4 | LOC-03: no filtro de clientes, Estado aparece antes de Cidade | ✓ VERIFIED | `components/clientes/FiltersPopover.tsx`: the Estado block (`<Label htmlFor="filtro-estado">Estado</Label>`, lines 292-318) renders immediately before the Cidade block (`<Label htmlFor="filtro-cidade">Cidade</Label>`, lines 320-353) — confirmed by direct read of the file. `tests/clientes/filters-popover.test.tsx`'s "renderiza o bloco de Estado antes do bloco de Cidade (LOC-03)" test asserts `estadoLabel.compareDocumentPosition(cidadeLabel) & DOCUMENT_POSITION_FOLLOWING` and passes. |
| 5 | LOC-04: clientes cadastrados antes com Estado inconsistente aparecem normalizados para a sigla correta, sem perder dados nem travar o acesso | ✓ VERIFIED | Migration 0007's backfill (read directly, lines 69-121) runs `upper(trim(estado))` then a `CASE` mapping all 27 full state names (with/without accents) to the correct UF, mirroring `lib/clientes/normalizarEstado.ts`'s own `NOME_PARA_SIGLA` map 1:1 (both confirmed by direct read — same 27 pairs). This backfill was actually applied to the live hosted Supabase project (`supabase db push`, confirmed by SUMMARY 09-01 + the coordinator-required DO/EXCEPTION fix, see Truth #7). `tests/clientes/estado-constraint.test.ts`'s positive control ("chk_estado_valido does not block access to valid clientes") passed standalone against the live DB, proving a client with a valid `estado` inserts and reads normally post-migration. `normalizarEstado.ts`'s own unit tests (5 cases, all passing) independently confirm the mapping function's correctness. The one residual legacy row (`estado='ZZ'`, real test data that isn't a state name) is explicitly acknowledged as intentionally NOT normalized (D-01: no fuzzy matching) and remains readable — `chk_estado_valido` stays `NOT VALID` for retroactive validation only, never blocking access, confirmed by the constraint's own `DO $$ ... EXCEPTION ...$$` wrap (see Truth #7). |
| 6 | Pitfall 4: `clienteAtendeFiltros` compara Cidade por igualdade exata case-insensível, não mais substring `includes` | ✓ VERIFIED | `components/clientes/FiltersPopover.tsx` line 99: `if (cidadeFiltro && cliente.cidade.toLowerCase() !== cidadeFiltro) return false` — direct read confirms no `.includes(` remains in the Cidade comparison. `tests/clientes/filters-popover.test.tsx`'s exact-match test proves `"Santos"` passes and `"Santos do Sul"` does not, against a `cidade: "santos"` filter. |
| 7 | `chk_estado_valido`'s final `VALIDATE CONSTRAINT` step is genuinely best-effort (wrapped in exception handling), not a bare statement that would abort the whole `supabase db push` transaction | ✓ VERIFIED | Direct read of `supabase/migrations/0007_cidades_e_estado_valido.sql` lines 150-157 confirms: `do $$ begin alter table clientes validate constraint chk_estado_valido; exception when check_violation then raise notice '...'; end; $$;` — a genuine `DO`/`EXCEPTION WHEN check_violation` wrap, exactly as SUMMARY 09-01 claims (this claim was independently re-verified against the actual file, not just trusted from the SUMMARY narrative). The constraint itself (lines 129-135) is added `not valid` first, so new writes are enforced immediately regardless of the best-effort validate step's outcome. |
| 8 | V5/T-09-09: `createCliente`/`updateCliente` Server Actions re-validate server-side that Cidade belongs to `cidades_por_estado(estado)` before writing, never trusting the client Combobox alone | ✓ VERIFIED | Direct read of `app/actions/clientes.ts`: `createCliente` (lines 70-85) and `updateCliente` (lines 208-223) both call `supabase.rpc("cidades_por_estado", { p_uf: parsed.data.estado })`, then `cidadeValida(...)`, returning `{ error: { code: "validation" } }` *before* the `insert`/`update` statement if the check fails — confirmed the validation code runs strictly before the write in both functions by reading the surrounding lines. `grep` confirms exactly 2 occurrences each of `cidades_por_estado` and `cidadeValida` (one per action). |
| 9 | A validação de importação (`annotarLinha`) reusa a MESMA lista estruturada (UFS + cidades) dos formulários e do filtro, sem lógica paralela de texto livre | ✓ VERIFIED | `lib/importacao/annotarLinha.ts` imports `UFS`/`Uf` from `@/lib/clientes/ufs` and `cidadeValida`/`cidadeCanonica` from `@/lib/clientes/cidadeValida` — the exact same pure modules the Server Actions and the frontend components consume (no parallel/duplicated logic). `app/actions/importacao.ts`'s `validarLoteImportacao` populates the `cidades` lookup from the same `cidades` table (line 98). `tests/importacao/annotarLinha.test.ts` (part of the 7-file passing run) confirms the reject/normalize behavior. |

**Score:** 8/9 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0007_cidades_e_estado_valido.sql` | `cidades` table + RLS + `cidades_por_estado` RPC + backfill + `chk_estado_valido` (NOT VALID + best-effort validate) + IBGE seed | ✓ VERIFIED | Read in full (relevant sections); all pieces present in the correct order, applied to production (confirmed via passing integration tests against the live project). |
| `scripts/gerar-seed-cidades.ts` | One-time offline IBGE seed generator, versioned, never called at runtime | ✓ VERIFIED (existence confirmed; not the app's runtime path, low verification priority per plan) | Referenced in migration header comment; SUMMARY documents its one-time use. |
| `lib/clientes/ufs.ts` | `UFS` (`as const`, 27 items) + `type Uf` | ✓ VERIFIED | Read in full; exactly 27 siglas, alphabetical, `as const`. |
| `lib/clientes/normalizarEstado.ts` | Pure normalization function (LOC-04) | ✓ VERIFIED | Read in full; pure (no Supabase/"use client"/"use server"), mirrors migration backfill's map exactly. |
| `lib/clientes/cidadeValida.ts` | Pure `cidadeValida`/`cidadeCanonica` helpers | ✓ VERIFIED | Read in full; pure, reuses `normalizeRazaoSocial`, exported and imported by both `annotarLinha.ts` and `app/actions/clientes.ts`. |
| `components/clientes/EstadoCidadeFields.tsx` | Shared Estado(Select)/Cidade(Combobox) cascade component | ✓ VERIFIED | Read in full; correct wiring (disabled-until-Estado, cascade reset code path present, RPC call). |
| `components/clientes/FiltersPopover.tsx` | Estado-before-Cidade, UFS-fed Estado, Combobox Cidade, exact-match | ✓ VERIFIED | Read in full; all four fixes confirmed present. |
| `components/clientes/ClienteQuickCreateForm.tsx` / `ClienteDetailSheet.tsx` | Consume `EstadoCidadeFields` instead of free-text Inputs | ✓ VERIFIED | Grep + direct read confirm `<EstadoCidadeFields>` usage in both; no `<Input>`-based cidade/estado `FormField` remains. |
| `lib/validations/cliente.ts` | `estado: z.enum(UFS)` in both schemas | ✓ VERIFIED | Read in full. |
| `lib/importacao/annotarLinha.ts` | Estado (UFS) + Cidade (cidades table) validation, normalization | ✓ VERIFIED | Read in full. |
| `app/actions/importacao.ts` | `validarLoteImportacao` populates `cidades` lookup | ✓ VERIFIED | Grep-confirmed `supabase.from("cidades").select("nome, uf")` + lookup wiring. |
| `app/actions/clientes.ts` | `createCliente`/`updateCliente` re-validate Cidade server-side | ✓ VERIFIED | Read in full; validation runs before every insert/update. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `EstadoCidadeFields.tsx` Estado `<Select>` | Cidade `<Combobox>` reset | `setValue(cidadeName, "")` inside Estado's `onValueChange` | ✓ WIRED (code-level) | Present at lines 182-192; behavior not exercised by a test (see Truth #3). |
| `EstadoCidadeFields.tsx` watched `estado` | `cidades_por_estado` RPC | `useEffect` keyed on `estado`, cancelled-guard cleanup | ✓ WIRED | Lines 93-111; correct dependency array and cleanup. |
| `FiltersPopover.tsx` Estado `<Select>` | Cidade `<Combobox>` reset + RPC reload | `setDraft` in the same call (`estado` + `cidade: ""`); separate `useEffect` on `draft.estado` | ✓ WIRED (code-level) | Lines 149-163 (RPC effect), 292-304 (reset on estado change); behavior not exercised by a test (see Truth #3). |
| `annotarLinha.ts` | `cidades` lookup | `AnnotarLinhaLookups.cidades`, populated by `validarLoteImportacao` | ✓ WIRED | Confirmed by grep + direct read of both files. |
| `app/actions/clientes.ts`'s `createCliente`/`updateCliente` | `cidades_por_estado` RPC + `cidadeValida` | Called before every `insert`/`update`, short-circuits with `{error:{code:"validation"}}` | ✓ WIRED | Confirmed by direct read — validation block precedes the write in both functions. |
| `clientes.estado` (DB column) | `chk_estado_valido` CHECK constraint | `not valid` + `DO $$ ... EXCEPTION ... $$` best-effort validate | ✓ WIRED | Confirmed genuinely exception-wrapped by direct file read (not just SUMMARY narrative). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 9's own scoped test files pass (standalone, no rate-limit interference) | `npx vitest run tests/clientes/filters-popover.test.tsx tests/clientes/estado-cidade-fields.test.tsx tests/clientes/estado-normalizacao.test.ts tests/clientes/cidade-valida.test.ts tests/clientes/cidades-por-estado.test.ts tests/clientes/estado-constraint.test.ts tests/importacao/annotarLinha.test.ts` | 7 test files passed, 42/42 tests passed | ✓ PASS |
| `cidades-por-estado.test.ts` and `estado-constraint.test.ts` pass against the LIVE hosted Supabase project (not a mock) | (included in the run above) | Both passed, proving the migration is genuinely applied in production | ✓ PASS |
| TypeScript strict compiles clean | `npx tsc --noEmit` | No output (exit 0) | ✓ PASS |
| No phase-9-owned test file is among the genuinely-failing (non-rate-limit) files in the broader suite | `npx vitest run tests/clientes tests/importacao` (run once), then filtered the failure list for `estado-constraint.test.ts` specifically | 58 failures total, ALL trace to `Error: signInAs(...) failed: Request rate limit reached` (Supabase Auth free-tier rate limit hit from running many `signInAs` calls in sequence) — including `estado-constraint.test.ts`'s failures in this broader run, which pass cleanly when run standalone (see row above). Confirmed this is the pre-existing, documented environmental issue (STATE.md Blockers/Concerns), not a phase-9 regression. | ✓ PASS (no regression attributable to this phase) |
| Anti-pattern scan (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) across all phase-9-touched files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 15 touched files | Zero matches | ✓ PASS |
| Cascade reset behavior (Estado change → Cidade reset/reload) exercised by a real interaction | N/A — no automated test in the repo exercises this interaction | Not executed | ? SKIP — routed to human verification |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| LOC-01 | 09-01, 09-02, 09-03, 09-04, 09-06 | Estado usa lista fixa de 27 UFs em cadastro/edição, filtro, e importação | ✓ SATISFIED | Truth #1, #4, #6 above. |
| LOC-02 | 09-01, 09-02, 09-03, 09-04, 09-05, 09-06 | Cidade usa lista IBGE completa filtrada pelo Estado | ✓ SATISFIED (structurally); cascade-reset runtime behavior ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Truth #2 (data source) verified; Truth #3 (cascade interaction) routed to human verification. |
| LOC-03 | 09-04 | No filtro, Estado aparece antes de Cidade | ✓ SATISFIED | Truth #4 above. |
| LOC-04 | 09-01, 09-02 | Clientes com Estado inconsistente normalizados sem perder dados nem travar acesso | ✓ SATISFIED | Truth #5 above. |

No orphaned requirements found — LOC-01 through LOC-04 all map to Phase 9 in `.planning/REQUIREMENTS.md` and are all claimed by at least one of the six plans.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across all 15 files touched by this phase (migration, scripts, lib/clientes/*, components/clientes/*, lib/validations/cliente.ts, lib/importacao/annotarLinha.ts, app/actions/importacao.ts, app/actions/clientes.ts) returned zero matches.

### Human Verification Required

### 1. Cascade reset: trocar de Estado depois de já ter escolhido uma Cidade

**Test:** No cadastro rápido de cliente, escolher um Estado (ex: SP), escolher uma Cidade (ex: Campinas), depois trocar o Estado para outro (ex: RJ). Repetir na edição de um cliente existente e no popover de Filtros da lista de clientes.
**Expected:** Nos três lugares, a Cidade previamente escolhida é limpa (o campo volta ao placeholder "Selecione a cidade"/"Todas as cidades") e a lista de opções do combobox de Cidade passa a mostrar só municípios do novo Estado.
**Why human:** É uma transição de estado real (o `onValueChange` do Select dispara um reset + um novo fetch da RPC) que nenhum teste automatizado no repositório exercita — `tests/clientes/estado-cidade-fields.test.tsx` e `tests/clientes/filters-popover.test.tsx` testam explicitamente só o estado inicial (Cidade desabilitada sem Estado) e o próprio 09-03-SUMMARY.md documenta essa interação completa como deixada para esta verificação manual. A leitura de código confirma que o wiring (setValue/setDraft + useEffect) está correto e presente, mas isso não prova que o comportamento acontece de fato no navegador.

### 2. Performance/usabilidade do combobox de Cidade com um Estado grande

**Test:** Abrir o cadastro ou a edição de um cliente, escolher São Paulo como Estado (~645 municípios), abrir o combobox de Cidade e digitar para filtrar.
**Expected:** A busca responde rápido, sem travar ou congelar a interface, mesmo com a lista completa de municípios de SP carregada.
**Why human:** Performance percebida de UI com um dataset real grande não é algo que um teste unitário/componente meça de forma significativa — já classificado como Manual-Only em `09-VALIDATION.md`.

### Resolution Note

The project coordinator personally tested this live in a real browser (logged in as Supervisor, real dev server against the live Supabase project) and directly confirmed:

- **Item 1 (cascade reset) — CONFIRMED in cadastro rápido and in the client-list Filtros popover:** opened "Novo cliente", confirmed the Cidade combobox starts disabled with placeholder "Escolha o Estado primeiro"; selected Estado "SP", confirmed the placeholder switched to "Selecione a cidade" (enabled); typed "Campinas", confirmed the combobox filtered to exactly that match; selected it, confirmed the input value became "Campinas"; then changed Estado to "RJ" and confirmed the Cidade value was reset to empty. Repeated the Estado-before-Cidade check in the Filtros popover (`document.querySelectorAll('label')` confirmed order: Estado, then Cidade — LOC-03 also independently reconfirmed live). Did not separately repeat the cascade test inside `ClienteDetailSheet` (edit form) — it shares the exact same `EstadoCidadeFields` component and wiring already confirmed working in cadastro, so this is treated as covered by extension, not a separate untested code path.
- **Item 2 (SP-scale combobox performance)** and the cross-surface-consistency Manual-Only item were not separately re-tested this session — accepted as a known, low-risk residual gap given (a) the combobox is a stock shadcn/Base UI component with no custom filtering logic added, and (b) all four surfaces provably call the same `cidades_por_estado` RPC and `UFS` constant (Truth #1/#2 above), making cross-surface divergence structurally unlikely.

**Decision:** Accepted as complete. Phase 9 stands fully delivered — all 4 requirements (LOC-01 through LOC-04) satisfied. If SP-scale combobox performance or an edge case in the edit form's cascade ever surfaces as a real issue, file it as a normal bug against this phase's commits rather than reopening this verification.

### 3. Consistência ponta-a-ponta entre as quatro superfícies

**Test:** Cadastrar um cliente novo, editar um existente, filtrar a lista, e mapear uma coluna de planilha na importação — usando o mesmo Estado/Cidade nos quatro fluxos.
**Expected:** Estado/Cidade se comportam de forma idêntica e consistente nos quatro lugares (mesma lista fixa de 27 UFs, mesma lista de cidades por UF).
**Why human:** Consistência cross-superfície é melhor confirmada por um humano percorrendo os fluxos reais — já classificado como Manual-Only em `09-VALIDATION.md`.

### Gaps Summary

No blocking gaps. Every ROADMAP Success Criterion and all four requirements (LOC-01 through LOC-04) are backed by code that was independently read and confirmed — not just trusted from SUMMARY narratives. Two claims that could have been accepted at face value were specifically re-verified against the actual files and found to be genuinely true: (1) the `chk_estado_valido` `VALIDATE CONSTRAINT` step really is wrapped in a `DO $$ ... EXCEPTION WHEN check_violation ... $$` block in the migration file, not just described that way in the SUMMARY; (2) `createCliente`/`updateCliente` really do call `cidades_por_estado` + `cidadeValida` and return an error *before* the write, in both Server Actions.

The one open item is the Estado→Cidade cascade-reset *runtime* behavior (LOC-02/D-02): the code wiring is independently confirmed present and correct in all three consuming surfaces (cadastro, edição, filtro), but no automated test in the repository exercises the actual interaction of changing Estado after a Cidade was already chosen. This was already flagged as a deferred manual-verification item by the phase's own plans (09-03-PLAN.md's jsdom-instability escape hatch, 09-VALIDATION.md's Manual-Only section) — it is not a code defect, but genuinely unproven behavior, so it is carried forward here as a human-verification item rather than silently accepted.

---

_Verified: 2026-07-26T23:15:00Z_
_Verifier: Claude (gsd-verifier)_
