---
phase: 9
slug: filtros-de-estado-e-cidade-estruturados
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (existing, `tests/` directory with per-domain subfolders) |
| **Config file** | `vitest.config.ts` (existing — `environmentMatchGlobs` restricts jsdom to `tests/**/*.test.tsx`) |
| **Quick run command** | `npm run test -- tests/clientes tests/importacao` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30-60s (existing suite size) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/clientes tests/importacao`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | LOC-01 | V5 | `estado` Zod schema rejects non-UF, accepts all 27 | unit | `npm run test -- tests/clientes/cliente-actions.test.ts` | ✅ extend existing | ⬜ pending |
| TBD | TBD | TBD | LOC-01 | V4 | `chk_estado_valido` constraint rejects invalid `estado` at DB level | integration | `tests/clientes/estado-constraint.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LOC-02 | V4 | `cidades_por_estado('SP')` returns only SP municipalities, sorted, non-empty | integration | `tests/clientes/cidades-por-estado.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LOC-02 | — | `cidades` row count matches seeded IBGE total (catches broken/partial seed) | integration | same file as above | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LOC-03 | — | `FiltersPopover` renders Estado before Cidade in DOM order | component | `tests/clientes/filters-popover.test.tsx` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LOC-03 | — | Cidade combobox disabled until Estado selected (D-02) | component | same new file | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LOC-04 | — | Known legacy variants ("São Paulo", "sp ", "SP") all normalize to "SP" | unit | `tests/clientes/estado-normalizacao.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | LOC-04 | — | A row that still doesn't match after normalization remains readable/editable | integration | extend `tests/clientes/rls-clientes.test.ts` or new focused test | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | V5 | T-09-01 | Server Action re-validates `estado ∈ UFS` and `cidade ∈ cidades_por_estado(estado)` server-side, never trusting the Combobox alone | unit/integration | new Server Action test | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*(Plan/Wave/Task IDs filled in by the planner once plans are created.)*

---

## Wave 0 Requirements

- [ ] `tests/clientes/estado-constraint.test.ts` — covers LOC-01's DB-level constraint (integration, needs local Supabase instance per existing `tests/clientes/rls-clientes.test.ts` pattern)
- [ ] `tests/clientes/cidades-por-estado.test.ts` — covers LOC-02's RPC behavior + seed completeness
- [ ] `tests/clientes/filters-popover.test.tsx` — covers LOC-03's ordering + cascade-disable behavior (new RTL component test, following the pattern established by `tests/importacao/AppSidebar.test.tsx`/`FileDropzone.test.tsx`)
- [ ] `tests/clientes/estado-normalizacao.test.ts` — covers LOC-04's backfill normalization as a pure, directly-unit-testable function (extract into `lib/clientes/normalizarEstado.ts`, mirroring `lib/importacao/dedupe.ts`'s `normalizeRazaoSocial` precedent)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cidade combobox is searchable and usable with ~5,570 municipalities loaded (no jank/freeze) | LOC-02 | Perceived UI performance with a real large dataset isn't meaningfully asserted by a unit/component test | Open cadastro/edição de cliente, escolher um Estado grande (ex: SP, ~645 municípios), abrir o combobox de Cidade, digitar pra filtrar, confirmar que a busca responde rápido e sem travar |
| End-to-end cadastro/edição/filtro/importação all consistently use the same Estado/Cidade source | LOC-01, LOC-02, LOC-03 | Cross-surface consistency is best confirmed by a human walking the actual flows | Cadastrar um cliente novo, editar um existente, filtrar a lista, e mapear uma coluna de planilha na importação — confirmar que Estado/Cidade se comportam identicamente nos quatro lugares |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — to be filled in during planning
