# Phase 2: Cadastro e Funil de Vendas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 2-Cadastro e Funil de Vendas
**Areas discussed:** Completar depois, Lista de clientes, Duplicidade, Busca e filtro (plus a mid-discussion roadmap restructuring: merging the old Phase 3 Kanban into Phase 2)

---

## Roadmap restructuring (before area discussion concluded)

During "Lista de clientes", the user shared a screenshot of their current CRM's kanban board and asked for the funnel columns to be included in this phase rather than deferred to the (then) Phase 3. This was flagged as a scope/sequencing decision bigger than a phase discussion detail. Presented two paths:

| Option | Description | Selected |
|--------|-------------|----------|
| Merge Phase 2 and 3 into one | Cadastro + funil ship together | ✓ |
| Keep separate, lock the visual for later | Phase 2 stays cadastro-only | |

**User's choice:** Merge. Executed via `gsd-tools query phase.remove "3"` (deleted old Kanban phase, renumbered Admin 4→3 and Dashboard 5→4) followed by manually merging FUN-01..10 requirements and success criteria into Phase 2's ROADMAP.md section, and updating REQUIREMENTS.md traceability (FUN-* rows Phase 3 → Phase 2, ADM-* Phase 4 → Phase 3, DSH-* Phase 5 → Phase 4).

---

## Completar depois

| Option | Description | Selected |
|--------|-------------|----------|
| Abre o cliente e edita | Same edit screen as any other edit | |
| Área de pendências | Separate section listing incomplete registrations | ✓ |

**User's choice:** Área de pendências

Follow-up: Is this a fully separate screen, or a filter/tab within the main client list?

| Option | Description | Selected |
|--------|-------------|----------|
| Filtro na lista principal | Not a separate screen — a filter/tab within the same client list | ✓ |
| Tela separada de verdade | A dedicated page outside the normal client list | |

**User's choice:** Filtro na lista principal

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, destacar | Visual badge "cadastro incompleto" on the list/card | ✓ |
| Não precisa | No visual indicator | |

**User's choice:** Sim, destacar

---

## Lista de clientes

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela | Compact rows/columns | |
| Cartões | One block per client | |
| (freeform) | "Vários clientes por tela, e a sua etapa do funil, vou mandar uma imagem" | ✓ (freeform) |

**User's choice:** Freeform — user shared a screenshot of their current CRM's kanban board (compact cards, quick-action icons, alert icons, search bar + Filtros button, "Adicionar negócio" primary button) as the visual reference.

| Option | Description | Selected |
|--------|-------------|----------|
| Razão social + categoria | Basic identification fields shown at a glance | ✓ |
| Responsável (vendedor) | Important for the supervisor | |
| Selo de cadastro incompleto | Confirm it also shows on the list | |
| Deixe eu descrever | Freeform | |

**User's choice:** Razão social + categoria

---

## Duplicidade

| Option | Description | Selected |
|--------|-------------|----------|
| Avisar, mas permitir | Warn but allow saving anyway | |
| Bloquear duplicidade | Refuse to save if razão social already exists | ✓ |
| Não verificar | No check at all | |

**User's choice:** Bloquear duplicidade

| Option | Description | Selected |
|--------|-------------|----------|
| Base toda | Unique across the whole client base, any vendedor | ✓ |
| Só por vendedor | Unique only within the same vendedor's own clients | |

**User's choice:** Base toda

---

## Busca e filtro

| Option | Description | Selected |
|--------|-------------|----------|
| Botão "Filtros" | Search always visible, filters behind a button (matches current CRM) | |
| Tudo sempre visível | Search and all filters shown together | |
| (freeform) | "A busca serve apenas para buscar a razão social por texto. Os filtros servem para filtrar vendedor, endereço, cidade, estado, canal de venda etc." | ✓ (freeform) |

**User's choice:** Freeform — search is razão-social-only; filters cover vendedor, endereço, cidade, estado, canal de venda.

| Option | Description | Selected |
|--------|-------------|----------|
| Só Supervisor vê esse filtro | Vendedor filter only shown to Supervisor | ✓ |
| Aparece pra todo mundo | Shown to everyone | |

**User's choice:** Só Supervisor vê esse filtro

Follow-up on new filter fields (cidade/estado, canal de venda):

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, adicionar cidade e estado | New address sub-fields beyond CEP/rua/número/complemento | ✓ |
| Não precisa | Defer city/state filtering | |

**User's choice:** Sim, adicionar cidade e estado

| Option | Description | Selected |
|--------|-------------|----------|
| É a categoria mesmo | "Canal de venda" = existing categoria field (FS/VT/AS), same as confirmed at project init | ✓ |
| É um campo novo e diferente | A genuinely new field | |

**User's choice:** É a categoria mesmo

---

## Claude's Discretion

- Exact card layout within the established shadcn/ui + Tailwind v4 design system (blue accent) from Phase 1
- Where exactly the "Filtros" button sits and how the filter panel opens (dropdown vs. drawer)
- Error/feedback copy (e.g., duplicate-block message)
- Underlying data model for the funnel (separate "cards" table vs. fields on the clientes table) — left to research/planning

## Deferred Ideas

None beyond what REQUIREMENTS.md already scoped (CLI-* and FUN-*). The phase merge was a resequencing decision, not new scope.
