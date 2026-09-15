---
phase: quick-260915-ls7
verified: 2026-09-15T16:10:00Z
status: human_needed
score: 6/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260915-ls7: Cliente Ganho Sai do Kanban de Prospecção — Verification Report

**Task Goal:** Cliente "ganho" (`status_acompanhamento = 'ganho'`) deve sumir do Kanban de prospecção (as 7 colunas do funil), aparecendo só na Agenda. Sem tela própria de "Clientes Ativos". Exportação de clientes precisa continuar alcançando a base inteira quando não há filtro ativo na tela.

**Verified:** 2026-09-15
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Kanban de prospecção não mostra nenhum cliente ganho, nem no card nem no contador | ✓ VERIFIED (code+unit test) / live count not confirmed | `lib/supabase/queries/clientes.ts:296` adds `.neq("status_acompanhamento", STATUS_FORA_DA_PROSPECCAO)` inside the `buscarPaginado` callback, before `.order`/`.range`; line 319 adds `if (!apareceNaProspeccao(row.status_acompanhamento)) continue` as the loop guard. Both consume the exact same constant/predicate exercised by `tests/clientes/prospeccao.test.ts` (5/5 passing). No other reader in the file was touched. Live confirmation against the real 2181-row dataset (SUMMARY D1) was not performed this session — routed to human verification below. |
| 2 | Contadores, busca, filtros, ordenação e drag-and-drop operam sobre o mesmo conjunto `grouped`, sem filtro próprio novo | ✓ VERIFIED | `components/clientes/KanbanBoard.tsx` has zero direct Supabase calls (`grep` for `createClient`/`supabase.from` in the file returns only a code comment) — `filteredGrouped`, `totalFiltrado`, `hasActiveFilters`, and drag state all derive from the `grouped` prop passed down from `getClientesAgrupadosPorEtapa()`, which is already the filtered set. |
| 3 | Marcar como ganho continua funcionando; cartão some só na próxima carga | ✓ VERIFIED | `ClienteDetailSheet` (the status-change UI) is not in the `files_modified` list and no diff touches it; the write path to `status_acompanhamento` is untouched, so existing "no live-refresh on save" behavior is preserved by omission. |
| 4 | Agenda, ficha, Diário, Dashboard e importação de Clientes Ativos continuam enxergando cliente ganho | ✓ VERIFIED | `lib/supabase/queries/agenda.ts` (`.eq("status_acompanhamento", "ganho")` at line 199) was not touched by any of the 3 task commits (last commit touching it, `cc6c397`, predates this task). `getClienteById`, `getDiario`, `getHistorico`, `getDiarioParaExportacao` in `clientes.ts` are unmodified — no `.neq`/guard added to any of them. `lib/supabase/queries/dashboard.ts` only references `getClientesAgrupadosPorEtapa` in a comment; its actual data comes from independent `dashboard_*` RPCs. `app/actions/importacaoAtivos.ts` does not call `getClientesAgrupadosPorEtapa`. |
| 5 | Exportação sem filtro ativo continua alcançando a base inteira (incl. ganhos); com filtro, espelha a tela | ✓ VERIFIED (code+unit test) / live round-trip not confirmed | `app/api/clientes/exportar/route.ts` accepts `escopoTudo` with strict `=== true` comparison, calls `getClientesParaExportacao(null)` (unfiltered by status) when true, skips `ids` validation only on that path, and preserves the existing 400 response otherwise. `KanbanBoard.tsx:386-388` sends `{ escopoTudo: true }` when `hasActiveFilters === false` and otherwise still sends `{ ids: collectExportIds(filteredGrouped) }`. `export-ids.test.ts` and `exportacao.test.ts` (unchanged logic) both pass. Live end-to-end confirmation of the exported row count against the real 2181-row dataset (SUMMARY D3) was not performed this session — routed to human verification below. |
| 6 | Zero migration, zero RLS, zero RPC nova | ✓ VERIFIED | `git diff --stat` across the 3 task commits touches only `.ts`/`.tsx` files; `supabase/migrations` has no new/changed files for this task. |
| 7 | A leitura do Kanban passa a trazer ~429 linhas em vez de 2181 (egress) | ? UNCERTAIN (data-dependent, needs live check) | Logically follows from truth 1 (SQL filter runs before pagination) but the exact row count is a live-data assertion that cannot be verified by static analysis; not exercised against the production dataset in this session. |

**Score:** 6/7 truths verified by code+test evidence; 1 (row-count claim) and parts of truths 1 & 5 need a human to confirm against the live app, exactly as SUMMARY.md's own `coverage` block (D1, D3) already flags with `status: unknown` / `human_judgment: true`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/funil/prospeccao.ts` | Pure module exporting `STATUS_FORA_DA_PROSPECCAO` + `apareceNaProspeccao` | ✓ VERIFIED | Exists, exports exactly the two symbols, imports only `type StatusAcompanhamento` (type-only import, erased at compile time). No runtime dependency. |
| `tests/clientes/prospeccao.test.ts` | 5 behaviors from the plan | ✓ VERIFIED | All 5 described behaviors present and passing (`npx vitest run` confirms 5/5 green). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `lib/supabase/queries/clientes.ts` (SQL filter) | `lib/funil/prospeccao.ts` | `STATUS_FORA_DA_PROSPECCAO` import, used in `.neq(...)` | ✓ WIRED | Line 296, exact literal match with the plan spec. |
| `lib/supabase/queries/clientes.ts` (loop guard) | `lib/funil/prospeccao.ts` | `apareceNaProspeccao` import, used in `if (!apareceNaProspeccao(...)) continue` | ✓ WIRED | Line 319, same source, single definition consumed twice as designed. |
| `components/clientes/KanbanBoard.tsx` (`handleExport`) | `app/api/clientes/exportar/route.ts` | `fetch` body `{ escopoTudo: true }` or `{ ids: ... }` depending on `hasActiveFilters` | ✓ WIRED | Route reads `escopoTudo` with strict boolean check and branches correctly; both sides use the same field name and semantics. |
| `app/(app)/clientes/page.tsx` (empty state) | `totalClientes` (post-filter count) | Conditional render `totalClientes === 0` | ✓ WIRED | Text updated to reference the Agenda and no longer claims "nenhum cliente cadastrado" falsely. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests for the visibility predicate | `npx vitest run tests/clientes/prospeccao.test.ts tests/clientes/export-ids.test.ts tests/clientes/paginacao.test.ts tests/clientes/incompleto.test.ts tests/clientes/exportacao.test.ts` | 5 files / 36 tests, all passed | ✓ PASS |
| Type-check across all 6 touched files | `npx tsc --noEmit -p tsconfig.json` | No output (clean) | ✓ PASS |
| Live Kanban count against real data (~429 rows) | Requires authenticated app session | Not run | ? SKIP — routed to human verification |
| Live export round-trip (unfiltered ~2181 rows, filtered mirrors screen) | Requires authenticated app session | Not run | ? SKIP — routed to human verification |

Note: `rls-clientes.test.ts` / `rls-exportacao.test.ts` were not re-run in this verification pass since SUMMARY.md already documents a pre-existing environment limitation (missing `NEXT_PUBLIC_SUPABASE_URL` in the isolated worktree) unrelated to this task's code — this is an environment gap, not a code gap, and re-running from this session's environment would hit the same missing-credential issue.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| QUICK-260915-ls7 | 01 | Cliente ganho sai do Kanban de prospecção; exportação preserva alcance | ✓ SATISFIED (pending live confirmation) | See truths 1-7 above; code-level implementation matches every locked decision in the plan (`decisoes_travadas`) with no deviation. |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers introduced in any of the 6 modified/created files (the one `TODO` grep hit in `clientes.ts` is a pre-existing Portuguese word "TODO cliente" = "every client", not a debt marker). No stub returns, no hardcoded empty data, no console-log-only implementations.

### Human Verification Required

These are exactly the two items SUMMARY.md's own `coverage` block already flags as `status: unknown` / `human_judgment: true` (D1, D3) — the executor could not obtain an authenticated session in the isolated worktree, so the live behavior was never actually exercised against the real 2181-row dataset. Code review confirms the implementation is structurally correct and consistent with the plan; only the observable runtime outcome remains unconfirmed.

### 1. Kanban column count drops correctly

**Test:** Log in to the app, open `/clientes`, and look at the "1ª venda concluída" column count and the overall total.
**Expected:** The "1ª venda concluída" column no longer includes the 1752 previously-ganho clients — only clients that reached the last stage but are still `em_andamento` should remain there. The overall Kanban total should be close to ~429.
**Why human:** Requires a live authenticated session against the real database; row counts are data-dependent and cannot be confirmed by static code analysis or unit tests.

### 2. Marking a client as "ganho" still works, and the card disappears on next load

**Test:** Drag/move a card to "1ª venda concluída" and mark it as ganho via the ficha; then reload `/clientes`.
**Expected:** The status change saves normally; the card remains visible until the page is reloaded, then disappears from all 7 columns.
**Why human:** Requires interacting with the live UI and a real save operation; the write path itself was not modified by this task, but the end-to-end round trip (save → reload → card gone) needs a real browser session to confirm.

### 3. Export button preserves full reach

**Test:** With no search/filter/tab active, click "Exportar" and check the row count in the downloaded spreadsheet; then apply a filter and click "Exportar" again.
**Expected:** Unfiltered export includes ~2181 rows (including all ganho clients). Filtered export includes only what's visible on screen (which now excludes ganho, per the new Kanban behavior).
**Why human:** Requires a real authenticated request to `/api/clientes/exportar` against production-shaped data; the code path is unit-tested and type-checked, but the actual file download and row count were not exercised end-to-end in this session.

### Gaps Summary

No code gaps were found. Every must-have truth from the plan's frontmatter and every locked decision in `<decisoes_travadas>` is implemented exactly as specified, verified by direct code reading (not by trusting SUMMARY.md's narrative), unit tests (36/36 passing), and a clean `tsc --noEmit`. The only open items are the two live/manual checks that the plan itself scheduled as "melhor esforço" / human confirmation (SUMMARY.md's D1 and D3), which genuinely cannot be verified through static analysis — they require an authenticated browser session against the real 2181-row dataset. This routes the phase to `human_needed` rather than `passed`, per the verification decision tree (any non-empty human-verification list blocks a clean pass), not because any artifact is missing, stub, or unwired.

---

_Verified: 2026-09-15_
_Verifier: Claude (gsd-verifier)_
