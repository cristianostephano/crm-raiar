# Phase 27: Correções do Primeiro Uso — Card Filtrado e Agenda - Research

**Researched:** 2026-09-25
**Domain:** Bug fixing in an existing Next.js/React (App Router) + Supabase codebase — no new stack, no new packages, two isolated presentational fixes.
**Confidence:** MEDIUM (AGD-15: HIGH — root cause reconfirmed by direct file read, exact lines match CONTEXT.md's citations. KAN-03: LOW — root cause remains genuinely unconfirmed after a second independent code-archaeology pass; see below.)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AGD-15 — causa raiz já confirmada por leitura de código**
- **D-01:** `components/agenda/AgendaSemDiaFixo.tsx` (linha 77) renderiza `{cliente.razaoSocial}` diretamente como título, em vez de usar `nomeExibicaoCliente(razaoSocial, nomeFantasia)` — a mesma função que `ClienteCard.tsx` e `ClienteDetailSheet.tsx` já usam para cair no Nome Fantasia quando a razão social é nula (padrão fixado na Fase 26 do marco v1.6, PROSP-02). Quando a razão social vem nula, o título fica vazio e só o nome do vendedor sobra visível — exatamente o sintoma relatado.
- **D-02:** A correção é reaproveitar `nomeExibicaoCliente()` — igual ao resto do sistema já faz — nunca inventar uma segunda regra de fallback de nome.
- **D-03:** O nome do vendedor deve continuar aparecendo do lado do nome do cliente (não sumir) — comportamento atual (`showResponsavel && cliente.responsavelNome`) já correto, não precisa de mudança nessa parte.
- **D-04 (dependência técnica encontrada):** `getClientesSemDiaFixo()` hoje só faz `select` de `razao_social`, não de `nome_fantasia` — o tipo `ClienteSemDiaFixo`/`ClienteSemDiaFixoRow` não tem esse campo. Precisa: (a) adicionar `nome_fantasia` ao `select`, (b) adicionar `nomeFantasia` ao tipo e ao mapeamento da row, (c) só então trocar a linha 77 de `AgendaSemDiaFixo.tsx` para usar `nomeExibicaoCliente()`.

**KAN-03 — causa raiz NÃO encontrada por leitura de código; confirmado como bug real e persistente pelo dono do projeto**
- **D-05:** Leitura cuidadosa de `KanbanBoard.tsx` (branches `dragDisabled`/`DndContext`, ambos usam a mesma classe de largura de coluna `w-[280px] shrink-0`) e de `ClienteCard.tsx` (categoria/vendedor/cidade/ícones são renderizados incondicionalmente, sem nenhuma classe de ocultação responsiva `hidden`/`sm:hidden`) não revelou nenhum caminho de código que explique a compressão relatada. Pelo código como está hoje, o card filtrado DEVERIA já aparecer idêntico ao sem filtro.
- **D-06:** O dono do projeto confirmou explicitamente que o bug é real e persistente (não é cache do navegador). **A pesquisa/planejamento desta fase PRECISA reproduzir o bug ao vivo antes de propor qualquer correção** — não há uma linha de código óbvia para "consertar" só de leitura estática. Hipóteses a testar durante a reprodução, nenhuma confirmada: (a) extensão/config específica do navegador; (b) viewport realmente estreito; (c) deploy desatualizado; (d) caminho de código ainda não encontrado.
- **D-07:** Critério de sucesso não muda por causa da incerteza da causa: o card filtrado tem que ficar 100% idêntico ao sem filtro.

### Claude's Discretion
- Ordem de execução entre as duas correções (independentes, sem risco de conflito).
- Se a investigação ao vivo de KAN-03 revelar que a causa está em código fora de `KanbanBoard.tsx`/`ClienteCard.tsx`, o planejamento pode se ajustar sem precisar voltar pra discussão — o critério de sucesso (D-07) é o que não muda.

### Deferred Ideas (OUT OF SCOPE)
Nenhuma — a discussão ficou dentro do escopo da fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KAN-03 | Card do Kanban com filtro de vendedor ativo mostra as mesmas informações (categoria, vendedor, cidade/estado, ícones) e não corta nomes — idêntico ao card sem filtro | Static/data-flow analysis confirms no code-level cause today (see "KAN-03 Investigation" below). A mandatory live-diagnosis task must precede any code change. Success criteria (D-07) and regression guard for the 260921-n0a arrows are unambiguous and testable regardless of root cause. |
| AGD-15 | Seção "Sem dia fixo definido" da Agenda mostra o nome do cliente junto do nome do vendedor responsável, com fallback para Nome Fantasia | Root cause confirmed exact line numbers still match. Fix path: extend `select`/type/mapper in `lib/supabase/queries/agenda.ts` + `ClienteSemDiaFixo` type in `lib/agenda/itens.ts`, then call `nomeExibicaoCliente()` in `AgendaSemDiaFixo.tsx`. Existing test fixtures in `tests/agenda/agenda-list.test.tsx` will need a `nomeFantasia` field added once the type changes. |
</phase_requirements>

## Summary

Both requirements are small, isolated UI bug fixes in an already-mature codebase (26 phases in, ~50 completed plans). Neither touches the database schema, RLS, or Server Actions — this is a pure presentation-layer phase.

**AGD-15** has a fully confirmed root cause: `AgendaSemDiaFixo.tsx` renders `cliente.razaoSocial` raw instead of going through the project's single nome-exibição authority, `nomeExibicaoCliente()` (`lib/clientes/nomeExibicao.ts`). This function was introduced in Fase 26 (T-26-15) specifically because razão social became nullable — `AgendaSemDiaFixo.tsx` predates that convention (Fase 24) and was never retrofitted. The fix is mechanical: thread `nome_fantasia` through the query → type → mapper → component, then swap the raw field access for the shared function call — exactly the same pattern `ClienteCard.tsx` and `ClienteDetailSheet.tsx` already use. I independently re-read every file/line CONTEXT.md cites and confirm they are still accurate at today's line numbers.

**KAN-03 remains a genuine open investigation.** I performed a second, independent pass beyond what CONTEXT.md already documents — full re-read of `KanbanBoard.tsx`, `ClienteCard.tsx`, `ClienteToolbar.tsx`, and `FiltersPopover.tsx`; confirmed `showResponsavel` is derived only from `callerRole` (never from filter state); confirmed all filtering (`clienteAtendeFiltros`, search, tab) happens 100% in-memory over an already-fully-loaded card set with zero conditional column selection or re-fetch (`getClientesAgrupadosPorEtapa()` always selects the same full column list regardless of any filter); confirmed no responsive/`hidden` classes, no dynamic `next/dynamic` imports, no Tailwind dynamic-class-string construction that could differ between dev and a production build, and no CSS in `globals.css` that targets nth-child or a filtered state. I also read the full diff of every commit touching `KanbanBoard.tsx`/`ClienteCard.tsx` since the 260921-n0a arrows quick task and found nothing that could explain a filter-dependent rendering difference, past or present. **This confirms D-05's conclusion with a wider net, not just re-affirms it: no code path exists today that would produce the reported symptom.** The bug is real (per the project owner's live testing), so the explanation is very likely something the static code can't reveal — a live/runtime condition. The plan for this requirement must start with a mandatory, human-run, live diagnostic task (concrete steps provided below) before any code is touched.

**Primary recommendation:** Plan AGD-15 as a normal 3-file mechanical fix with a unit test. Plan KAN-03 as: (1) a `checkpoint:human-verify` / live-diagnosis task FIRST, with the exact DevTools steps below handed to the project owner; (2) a conditional follow-up task whose shape depends entirely on what that diagnosis finds (framed as "if X, do Y" branches, not a single fix path) — do not let the planner or executor guess a fix and ship it without that evidence.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nome exibido no card do Kanban / ficha / Agenda "Sem dia fixo" | Browser/Client (Client Component render, via `nomeExibicaoCliente()`) | API/Backend (query must select the raw `nome_fantasia` column so the client has the data to fall back to) | `nomeExibicaoCliente()` is a pure, dependency-free function called at render time in every consuming component (established Fase 26 pattern) — the backend's only job is not to withhold the column, never to pre-compute the fallback itself. |
| Card do Kanban com/sem filtro de vendedor | Browser/Client (100% in-memory filter + React render) | — | `getClientesAgrupadosPorEtapa()` (API/Backend tier) already returns the FULL unfiltered dataset once per page load; every filter/search/sort/tab operates purely client-side (Pitfall 7, `KanbanBoard.tsx` comments). Any real difference between filtered/unfiltered card rendering must originate in the Browser tier — the backend genuinely cannot be the cause, since it never sees "filter applied" as a concept. |
| Setas de avançar/voltar etapa (regression guard, success criterion 3) | Browser/Client (`ClienteCard.tsx` render) + API/Backend (`moverCard` Server Action / `mover_card_funil` RPC) | — | Unaffected by this phase's scope but must not regress — both branches of `KanbanBoard.tsx` pass `onMoverEtapa`/`movendoEtapa` identically today; any KAN-03 fix touching `ClienteCard.tsx` must preserve this prop contract exactly. |

## Standard Stack

No new libraries. This phase reuses existing project modules exclusively:

| Module | Purpose | Why Standard (established this project) |
|--------|---------|-------------------------------------------|
| `lib/clientes/nomeExibicao.ts` (`nomeExibicaoCliente`, `ROTULO_SEM_NOME`) | Single source of truth for "which name to show for a cliente" | Established Fase 26 (T-26-15); already used by `ClienteCard.tsx` and `ClienteDetailSheet.tsx`. AGD-15 is explicitly about extending this to a third, currently-noncompliant consumer. |
| `lib/agenda/itens.ts` (`ClienteSemDiaFixo` type, `motivoSemDiaFixo`) | Pure type/logic layer for the "Sem dia fixo" section | Existing Fase 24 module; only needs one field added to a type, no restructuring. |
| `lib/supabase/queries/paginacao.ts` (`buscarPaginado`) | Handles the >1000-row PostgREST pagination limit | Already wraps `getClientesSemDiaFixo()`; adding a column to the `select()` string does not change this contract. |

No `npm install` needed for this phase. **Package Legitimacy Audit is not applicable** — no external packages are introduced.

## Architecture Patterns

### System Architecture Diagram — AGD-15 data flow (current vs. fixed)

```
Current (buggy):
Postgres `clientes` table
   │  (SELECT only razao_social, NOT nome_fantasia)
   ▼
getClientesSemDiaFixo() → ClienteSemDiaFixoRow → mapClienteSemDiaFixoRow()
   │  (ClienteSemDiaFixo has no nomeFantasia field)
   ▼
AgendaSemDiaFixo.tsx  →  {cliente.razaoSocial}   ← raw field, blank when null
   ▼
Rendered title: "" (empty) — only responsavelNome remains visible

Fixed:
Postgres `clientes` table
   │  (SELECT razao_social, nome_fantasia)
   ▼
getClientesSemDiaFixo() → ClienteSemDiaFixoRow{+nome_fantasia} → mapClienteSemDiaFixoRow(){+nomeFantasia}
   │
   ▼
AgendaSemDiaFixo.tsx  →  nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)
   ▼
Rendered title: razão social, or Nome Fantasia, or "Sem nome" — never blank
```

### System Architecture Diagram — KAN-03 data flow (confirmed today, static analysis)

```
Page load (Server Component, app/(app)/clientes/page.tsx)
   │  getClientesAgrupadosPorEtapa() — ALWAYS full column set, ALWAYS all etapas
   ▼
KanbanBoard.tsx (Client Component) receives `grouped` (complete, unfiltered) ONCE
   │
   ├── searchQuery / filtros / sortBy / activeTab  (all local React state)
   │
   ▼
filteredGrouped = useMemo(...)  — pure in-memory .filter()/.sort() over `grouped`
   │  (categoria/vendedor/cidade/estado/produtos/telefone are NEVER stripped here —
   │   clienteAtendeFiltros only returns true/false, never mutates the row)
   ▼
ClienteCard receives the SAME ClienteCardData shape whether or not a filter is active
   ▼
Expected render: identical fields, identical classes, in both branches
   (dragDisabled / DndContext — verified byte-identical column width classes)
```

No branch point in this diagram explains a filter-dependent visual difference. The divergence, if real today, must be introduced by something this diagram cannot show: a runtime/browser condition, a stale deployed bundle, or a DOM/CSS interaction invisible to static source review.

### Recommended Project Structure
No new files/folders. Touched files only:
```
components/agenda/AgendaSemDiaFixo.tsx     # AGD-15: swap raw field for nomeExibicaoCliente()
lib/supabase/queries/agenda.ts              # AGD-15: add nome_fantasia to select + row type + mapper
lib/agenda/itens.ts                         # AGD-15: add nomeFantasia to ClienteSemDiaFixo type
tests/agenda/agenda-list.test.tsx           # AGD-15: existing ClienteSemDiaFixo fixtures need nomeFantasia added (TS will fail to compile otherwise)
tests/clientes/nome-exibicao.test.ts        # AGD-15: molde/reference for new test file, do not modify
[TBD after live diagnosis]                  # KAN-03: cannot be named until root cause is confirmed
```

### Pattern 1: Nome exibido — always call at render time, never precompute in the mapper
**What:** `mapRow`/`mapClienteSemDiaFixoRow` and similar mapping functions pass through raw `razao_social`/`nome_fantasia` unmodified; the fallback decision (`nomeExibicaoCliente`) is called only inside the presentational component, at the point of display.
**When to use:** Any place in this codebase that renders a cliente's "name" (title, search match, sort key).
**Example:**
```typescript
// Source: components/clientes/ClienteCard.tsx (existing, established pattern)
<CardTitle
  className="truncate text-base leading-tight font-semibold"
  title={nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)}
>
  {nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)}
</CardTitle>
```
The AGD-15 fix is this exact pattern applied to `components/agenda/AgendaSemDiaFixo.tsx` lines 73-78 (currently `{cliente.razaoSocial}` used both in the `title` attribute and as children — both call sites need the swap, matching `ClienteCard.tsx`'s convention of using the function in both places).

### Pattern 2: Adding a column to an existing typed Supabase read (3-point change)
**What:** This project's established discipline (seen repeatedly: `nome_fantasia` added to `getClientesAgrupadosPorEtapa` in Fase 26, `cidade`/`estado` handling in quick task 260819-m8q) is that adding a column to a query always touches exactly three points together: the `.select()` string, the raw `*Row` type, and the mapper function that converts row → domain type.
**When to use:** AGD-15's D-04.
**Example:**
```typescript
// Source: lib/supabase/queries/agenda.ts (current state, confirmed today)
type ClienteSemDiaFixoRow = {
  id: string
  razao_social: string
  responsavel: string
  profiles: { nome: string; sobrenome: string } | null
  frequencia_visita: FrequenciaVisita | null
}
// → needs: nome_fantasia: string | null

function mapClienteSemDiaFixoRow(row: ClienteSemDiaFixoRow): ClienteSemDiaFixo {
  return {
    clienteId: row.id,
    razaoSocial: row.razao_social,
    responsavel: row.responsavel,
    responsavelNome: row.profiles
      ? `${row.profiles.nome} ${row.profiles.sobrenome}`
      : null,
    frequenciaVisita: row.frequencia_visita,
  }
}
// → needs: nomeFantasia: row.nome_fantasia added to the returned object

// and the select() string itself:
.select(
  "id, razao_social, responsavel, profiles(nome, sobrenome), frequencia_visita, dia_semana_visita, semana_do_mes_visita"
)
// → needs: nome_fantasia added
```
And `lib/agenda/itens.ts`'s `ClienteSemDiaFixo` type needs `nomeFantasia: string | null` added alongside `razaoSocial`.

### Anti-Patterns to Avoid
- **Guessing a KAN-03 fix without live evidence:** Given D-05/D-06 and this research's independent confirmation that no static code path explains the symptom, shipping a speculative CSS/layout change (e.g., "just in case" widening a container, adding `min-w`, forcing `flex-shrink-0` somewhere) risks masking a real (possibly environment-specific) bug behind an unrelated change, and burns a deploy/verify cycle without confirming the fix addresses the actual cause.
- **Inventing a second name-fallback rule for AGD-15:** D-02 explicitly forbids this — always call `nomeExibicaoCliente()`, never re-implement `razaoSocial || nomeFantasia || "algo"` inline.
- **Making `nomeFantasia` optional on `ClienteSemDiaFixo` "to save a keystroke" in tests:** Every other cliente-shaped type in this codebase (`ClienteCardData`, `ClienteListItem`) has `nomeFantasia`/`nome_fantasia` as `string | null` (present, nullable) — never `nomeFantasia?:` (optional/absent). Matching that convention means TypeScript will correctly force every existing test fixture to be updated, rather than silently compiling with the field missing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| "Which name to show for this cliente" | A new inline `razaoSocial || nomeFantasia || "Sem nome"` expression in `AgendaSemDiaFixo.tsx` | `nomeExibicaoCliente()` from `lib/clientes/nomeExibicao.ts` | Already the single source of truth (Fase 26); a second implementation is exactly the "cartão e ficha discordando" failure mode the module's own doc-comment warns about. |
| Diagnosing a UI bug with no reproducible code path | A speculative code fix | A live, human-run diagnostic pass (browser DevTools) BEFORE any KAN-03 code change | Static analysis has now been performed twice (CONTEXT.md's Discuss pass + this research pass) with the same negative result — further code reading will not find what isn't there. The next unit of information can only come from observing the live bug. |

**Key insight:** This phase's real risk isn't technical complexity (both fixes, once root-caused, are small) — it's the temptation to "fix" KAN-03 without evidence. The plan must structurally prevent that by gating on a diagnostic checkpoint.

## Common Pitfalls

### Pitfall 1: Adding `nome_fantasia` breaks existing test fixtures silently... or not silently, which is good
**What goes wrong:** `tests/agenda/agenda-list.test.tsx` builds `ClienteSemDiaFixo` object literals (e.g. `{ razaoSocial: "Padaria Central", ... }` at multiple lines) without a `nomeFantasia` field. Once the type gains a required `nomeFantasia: string | null` field, TypeScript will fail to compile these fixtures.
**Why it happens:** The type is changing to add a new required field, and existing literal fixtures predate it.
**How to avoid:** Grep `tests/agenda/agenda-list.test.tsx` for every `ClienteSemDiaFixo`-shaped object literal (there are at least 5, per the earlier grep of `razaoSocial:` occurrences at lines 53, 202, 223, 257, 309, 358) and add `nomeFantasia: null` (or a specific value for a fallback-path test case) to each. This is a compile-time-enforced pitfall (TypeScript will refuse to build if missed), so it cannot ship silently broken — but the planner should list it as an explicit task, not something the executor discovers ad hoc.
**Warning signs:** `npm test` / `tsc` failing with "Property 'nomeFantasia' is missing" after the type change.

### Pitfall 2: Treating KAN-03 as "already fixed by inspection" because the code looks correct
**What goes wrong:** Since the current code, read statically, already looks like it should render identically filtered/unfiltered, there's a temptation to conclude "there's nothing to fix" and close the requirement without ever reproducing the reported behavior.
**Why it happens:** Two independent static-analysis passes (CONTEXT.md's Discuss-phase pass and this Research pass) both found no code-level explanation — but the project owner independently reproduced the bug live and confirmed it is NOT a caching artifact.
**How to avoid:** Success criteria (D-07) is unconditional — "idêntico ao card sem filtro" — and does not get satisfied by "we read the code and it looks fine." The plan MUST include a live-reproduction step and cannot mark KAN-03 done until the bug is either reproduced-and-fixed or reproduced-and-confirmed-resolved-by-something-external (e.g., a stale deploy that gets refreshed). If, after a genuine live attempt, the bug cannot be reproduced at all on the current `staging` preview, that itself is a valid (and very different) outcome that should be reported back to the project owner rather than silently assumed.
**Warning signs:** A plan for KAN-03 whose first task is a code edit rather than a diagnostic/reproduction step.

### Pitfall 3: >1000-row PostgREST pagination silently truncating `clientes` reads (pre-existing, project-wide convention — not a new risk from this phase, but relevant if KAN-03's fix ends up touching `getClientesAgrupadosPorEtapa`)
**What goes wrong:** A direct `.select()` without `.range()` silently caps at 1000 rows (documented in this project's own code comments, quick task 260914-ng5, and mirrored in `getClientesSemDiaFixo`'s own comment).
**Why it happens:** PostgREST's default row limit.
**How to avoid:** Any query touching `clientes` in this project already goes through `buscarPaginado()` — do not bypass it if KAN-03's investigation leads to a change in `getClientesAgrupadosPorEtapa()` (unlikely, but flagged since it's the same table).
**Warning signs:** A kanban column showing a suspiciously round total (e.g., capped at 1000).

## Code Examples

### AGD-15 — full before/after of the title line
```typescript
// Source: components/agenda/AgendaSemDiaFixo.tsx, lines 72-79 (current, confirmed today)
<CardHeader className="px-3">
  <CardTitle
    className="truncate text-base leading-tight font-semibold"
    title={cliente.razaoSocial}
  >
    {cliente.razaoSocial}
  </CardTitle>
</CardHeader>

// Fixed (mirrors ClienteCard.tsx's own established call pattern):
<CardHeader className="px-3">
  <CardTitle
    className="truncate text-base leading-tight font-semibold"
    title={nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)}
  >
    {nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)}
  </CardTitle>
</CardHeader>
```
Requires adding the import: `import { nomeExibicaoCliente } from "@/lib/clientes/nomeExibicao"` to `AgendaSemDiaFixo.tsx` (not currently imported there).

### KAN-03 — mandatory live-diagnosis script (hand this to the project owner as a `checkpoint:human-verify` task)

Since the project owner does not code, phrase the ask in plain terms, in Portuguese, matching this project's established non-technical-explanation convention (CLAUDE.md). Concrete steps, in order:

1. Abra o link de teste da `staging` (Preview Deployment da Vercel) num navegador, faça login como Supervisor, e vá até a tela de Clientes (Kanban).
2. Clique em "Filtros", escolha um vendedor, clique em "Aplicar filtros" — reproduza a compressão do card.
3. Clique com o botão direito num card comprimido → "Inspecionar" (ou aperte F12 e clique na ferramenta de seleção, depois clique no card). Isso abre o DevTools do navegador.
4. Na aba "Elements"/"Elementos", com o card ainda selecionado, olhe o painel "Computed"/"Calculado" à direita — anote a largura (`width`) mostrada ali para o card e para a coluna que o contém.
5. Ainda no DevTools, procure no HTML do card se os textos que sumiram (categoria, nome do vendedor, cidade/estado) aparecem escritos no HTML mesmo que não apareçam na tela — isso distingue "o dado chegou mas o CSS escondeu" de "o dado nunca chegou".
6. Clique com o botão direito de novo → "Inspecionar" → aba "Console" — tire um print de qualquer texto em vermelho (erro) que apareça ali, especialmente ao aplicar o filtro.
7. Aperte Ctrl+Shift+R (recarrega ignorando cache) com o filtro ainda aplicado — o card volta ao normal? Se sim, é fortemente um problema de cache do navegador ou de build desatualizado, não do código atual.
8. Repita o mesmo teste numa janela anônima/privada (sem extensões) — se o problema some, é uma extensão do navegador, não o sistema.
9. Anote: tamanho da janela do navegador no momento do teste (F12 mostra isso no canto, ou o print de tela mostra a barra de rolagem horizontal do quadro) — para descartar viewport estreito.
10. Reporte de volta, com prints de cada passo acima: (a) a largura calculada do card comprimido vs. de um card normal; (b) se o HTML tinha o texto escondido ou realmente ausente; (c) se sumiu depois do Ctrl+Shift+R; (d) se sumiu na janela anônima.

This script is designed so a non-technical project owner can gather conclusive evidence (data-missing vs. CSS-hiding vs. cache vs. extension vs. viewport) without needing to read code — exactly the kind of "porquê" a GSD plan should hand off as a `checkpoint:human-verify` task per this project's established workflow.

## State of the Art

Not applicable — no external library/version drift involved in this phase. Both fixes are internal-convention corrections (using an already-established internal function), not framework/library upgrades.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The screenshots referenced in CONTEXT.md's "Specific Ideas" section were taken on the current `staging`/production deploy, not an old cached tab or an outdated preview link | KAN-03 Investigation | If the screenshots are actually stale (an old deploy), the live-diagnosis step will fail to reproduce the bug at all — this is explicitly anticipated as a valid diagnostic outcome (see Pitfall 2), not a research gap, but worth flagging as unverified. |
| A2 | No other component beyond `AgendaSemDiaFixo.tsx` in the "Sem dia fixo" section reads `cliente.razaoSocial` directly (i.e., the bug is fully isolated to the one line found) | AGD-15 Pattern 1 | Low risk — `AgendaSemDiaFixo.tsx` is a small, self-contained presentational component (95 lines, fully read in this research pass) with exactly one place accessing the field. |

**If this table is empty:** N/A — see above, both entries are LOW-risk/well-hedged assumptions rather than open compliance/security questions.

## Open Questions

1. **What actually causes KAN-03's card compression?**
   - What we know: Two independent full-code-read passes (Discuss-phase + this Research pass) confirm no code path today explains the symptom. All filtering is in-memory over an already-complete dataset; `showResponsavel` never depends on filter state; no responsive-hiding CSS exists in the card; no dynamic-import/code-splitting boundary separates filtered from unfiltered rendering; the git history of every relevant commit shows no regression window that would explain a "fixed since the screenshot" theory either.
   - What's unclear: Whether the actual cause is a stale/different deployed build, a browser-specific/extension-specific rendering quirk, a viewport condition, or a code path in a file this research didn't examine (e.g., a global CSS reset, a browser zoom setting, or something introduced by a third-party script).
   - Recommendation: Structure the KAN-03 plan as a mandatory live-diagnosis task FIRST (script provided above), with the subsequent code-change task(s) explicitly conditioned on that diagnosis's findings — do not let planning proceed past this gate with a guessed fix.

2. **Is `nome_fantasia` guaranteed non-empty-string (vs. null) in the same way `razao_social` is, for existing "Sem dia fixo" rows?**
   - What we know: `isAusente()` in `nomeExibicaoCliente` already treats whitespace-only strings as absent, matching how `razao_social` is handled elsewhere.
   - What's unclear: Nothing materially — this is already handled correctly by the shared function; flagged only so the planner's test task explicitly covers the "both null" (falls to `ROTULO_SEM_NOME`) case for a client in the "Sem dia fixo" list, mirroring `tests/clientes/nome-exibicao.test.ts`'s own coverage.
   - Recommendation: New/extended test in this phase should cover: razão social present, razão social null + Nome Fantasia present, both null.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (existing project setup, no change needed) |
| Config file | `vitest.config.ts` (environment: `node` by default, `jsdom` for `tests/**/*.test.tsx` via `environmentMatchGlobs`) |
| Quick run command | `npx vitest run tests/clientes/nome-exibicao.test.ts tests/agenda/agenda-list.test.tsx` |
| Full suite command | `npm test` (runs `vitest run`; note: `fileParallelism: false` — this project's suite is intentionally serialized against a real Supabase project, so a full run is slower than a typical Vitest suite) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGD-15 | "Sem dia fixo" title falls back to Nome Fantasia when razão social is null, mirroring `nomeExibicaoCliente`'s existing coverage | unit/render | `npx vitest run tests/agenda/` | ✅ existing file needs extending — `tests/agenda/agenda-list.test.tsx` fixtures need `nomeFantasia` added; a new focused test asserting `AgendaSemDiaFixo` renders the fallback is recommended (component-render test, jsdom, mirrors `tests/clientes/cliente-card-setas-etapa.test.tsx`'s pattern) |
| AGD-15 | `getClientesSemDiaFixo()` selects and maps `nome_fantasia` correctly | unit (mapper) | new test target — no dedicated test file for `agenda.ts`'s mapper exists yet | ❌ Wave 0 — the planner should decide whether to unit-test `mapClienteSemDiaFixoRow` directly (pure function, easy to test with a plain object) or rely on the render-level test above; either satisfies "at least one automated test" (CLAUDE.md) |
| KAN-03 | Filtered card renders identically to unfiltered card (categoria/vendedor/cidade-estado/ícones present, name not truncated differently) | integration/render, POST-diagnosis only | cannot be specified until root cause is known | ❌ Wave 0 — depends entirely on the live-diagnosis outcome; if the fix is a CSS/prop change in `ClienteCard.tsx`, a `render()`-based test comparing `showResponsavel`+filtered vs. unfiltered prop sets (mirroring `tests/clientes/cliente-card-setas-etapa.test.tsx`'s `buildCliente()` fixture pattern) is the natural home |
| KAN-03 | Setas de avançar/voltar etapa continuam funcionando (no regression) | unit/render | `npx vitest run tests/clientes/cliente-card-setas-etapa.test.tsx` | ✅ existing, passes today — re-run after any KAN-03 code change as a regression guard, do not modify unless the fix genuinely requires touching this behavior |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test files>`
- **Per wave merge:** `npm test` (full suite — note the real-Supabase-project rate-limit caveat already documented in STATE.md for `signInWithPassword`-heavy suites; this phase's own tests are pure-function/render tests with no auth calls, so they are not expected to hit that limit)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/agenda/agenda-list.test.tsx` — add `nomeFantasia` to every existing `ClienteSemDiaFixo` fixture (compile-time forced once the type changes) + at least one new case exercising the fallback
- [ ] A render-level test for `AgendaSemDiaFixo.tsx`'s fallback behavior does not exist yet — recommend creating one (jsdom, mirrors `tests/clientes/cliente-card-setas-etapa.test.tsx`'s `@vitest-environment jsdom` + `@testing-library/react` pattern)
- [ ] KAN-03's test cannot be written until the live diagnosis identifies what's actually different — this is expected and should be explicitly called out in the plan, not treated as an oversight

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — this phase touches no auth code |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No | Unchanged — RLS on `clientes` already scopes every row returned to both `getClientesAgrupadosPorEtapa()` and `getClientesSemDiaFixo()` before either fix runs; this phase adds a column to an existing already-authorized `SELECT`, it does not touch which rows are returned or to whom |
| V5 Input Validation | N/A | No new user input is introduced by either fix (no new form fields, no new Server Action parameters) |
| V6 Cryptography | No | Unchanged |

### Known Threat Patterns for this stack
No new threat surface. Both fixes add a read of an already-RLS-scoped column (`nome_fantasia`, which is already selected and displayed elsewhere in the app — `getClientesAgrupadosPorEtapa()`, `ClienteCard.tsx`, `ClienteDetailSheet.tsx` — for the exact same rows) to one more read path. No new column, no new table, no new exposure of data a user couldn't already see through an existing screen.

**LGPD note (organizational policy, not a phase blocker):** `razao_social`/`nome_fantasia` (empresa PJ) and `responsavel_nome` (nome de um funcionário/vendedor) are, respectively, business-identifying and personal data already displayed today across the Kanban card, the client detail sheet, and the Agenda's other sections — under RLS scoping already established as this project's authorization boundary since Fase 1. This phase does not introduce a new category of personal data, a new export path, or a new audience for existing data; it only makes an already-authorized field (`nome_fantasia`) visible in one more place it was already selectively missing from. No new LGPD review is triggered by this phase's scope specifically, but this note is included per this organization's standing instruction to flag anything touching personal-data display, however small.

## Sources

### Primary (HIGH confidence — direct codebase read, this session)
- `.planning/phases/27-corre-es-do-primeiro-uso-card-filtrado-e-agenda/27-CONTEXT.md` — full read, all decisions/canonical refs
- `components/agenda/AgendaSemDiaFixo.tsx` — full read, confirms D-01's line 77 citation exactly
- `lib/supabase/queries/agenda.ts` — full read, confirms D-04's line citations (`ClienteSemDiaFixoRow` at 132, `getClientesSemDiaFixo` at 182, `mapClienteSemDiaFixoRow` at 140) exactly
- `lib/clientes/nomeExibicao.ts` — full read
- `lib/agenda/itens.ts` (lines 495-544) — full read of `ClienteSemDiaFixo` type and `motivoSemDiaFixo`
- `components/clientes/KanbanBoard.tsx` — full read (886 lines), independent re-verification of D-05
- `components/clientes/ClienteCard.tsx` — full read (349 lines)
- `components/clientes/ClienteToolbar.tsx`, `components/clientes/FiltersPopover.tsx`, `components/clientes/ScrollColumnShell.tsx` — full read, ruled out as compression sources
- `lib/supabase/queries/clientes.ts` (lines 260-379, `getClientesAgrupadosPorEtapa`) — confirms data is fully/identically loaded regardless of any client-side filter
- `app/(app)/clientes/page.tsx` — confirms no filter-dependent server-side query path exists
- `app/actions/agenda.ts` (lines 1-13, 271-306) — confirms `getClientesSemDiaFixoAction()` is a pure pass-through, no extra logic to update
- `tests/agenda/agenda-list.test.tsx`, `tests/clientes/nome-exibicao.test.ts`, `tests/clientes/cliente-card-setas-etapa.test.tsx` — existing test patterns/molds
- `git log`/`git show` on `a2028b5`, `8051200`, `dae2dd6` and full commit history of `KanbanBoard.tsx`/`ClienteCard.tsx`/`FiltersPopover.tsx`/`ClienteToolbar.tsx` — confirms no historical code path explains the KAN-03 symptom
- `.planning/config.json` — confirms `security_enforcement: true`, `nyquist_validation: true` for this project
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — confirms requirement text and no additional undocumented decisions affecting Phase 27

### Secondary / Tertiary
None used — this research required no external web search or library documentation lookup, since the entire domain is internal-codebase archaeology with no new packages or unfamiliar APIs involved.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new stack, fully internal reuse, confirmed by direct read
- Architecture (AGD-15): HIGH — mechanical, 3-point change pattern already established and precedented in this codebase
- Architecture (KAN-03): LOW — genuinely unresolved after two independent full-code-read passes; this is an honest limitation, not a research gap that more code-reading would close
- Pitfalls: HIGH for AGD-15 (compile-time-enforced, well-understood); N/A for KAN-03 until live diagnosis narrows the cause

**Research date:** 2026-09-25
**Valid until:** Effectively indefinite for AGD-15 (internal convention, not time-sensitive). For KAN-03, valid only until the live diagnosis is performed — this research's KAN-03 findings are a snapshot of "what static code review can and cannot tell us today" and should be treated as superseded the moment diagnostic evidence exists.
