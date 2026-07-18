# Phase 4: Dashboard Gerencial - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 4-Dashboard Gerencial
**Areas discussed:** Período de análise, Onde fica / tela inicial, Tipos de gráfico

---

## Período de análise

| Option | Description | Selected |
|--------|-------------|----------|
| Filtro de período | Selectable period (30 days / month / year / custom) | ✓ |
| Sempre tudo, sem filtro | All-time total, no filter | |

**User's choice:** Filtro de período

| Option | Description | Selected |
|--------|-------------|----------|
| Data da mudança de status | Period filters ganhos/perdidos by when the status changed | ✓ |
| Data de cadastro do cliente | Period filters by client creation date | |

**User's choice:** Data da mudança de status

---

## Onde fica / tela inicial

| Option | Description | Selected |
|--------|-------------|----------|
| Funil continua sendo a tela inicial | Dashboard in a separate menu item | ✓ |
| Dashboard é a tela inicial | Dashboard replaces funil as the landing screen | |

**User's choice:** Funil continua sendo a tela inicial

---

## Tipos de gráfico

| Option | Description | Selected |
|--------|-------------|----------|
| Barras | Bar chart for clientes por etapa | ✓ |
| Cards com número | Simple number cards | |

**User's choice:** Barras (clientes por etapa)

| Option | Description | Selected |
|--------|-------------|----------|
| Números em destaque | Large numbers for ganhos/perdidos and conversão | ✓ |
| Gráfico de pizza/rosca | Pie/donut chart | |

**User's choice:** Números em destaque

| Option | Description | Selected |
|--------|-------------|----------|
| Barras horizontais | Horizontal bars for produto/categoria/vendedor | ✓ |
| Tabela simples | Simple table | |

**User's choice:** Barras horizontais

---

## Claude's Discretion

- Charting library: Recharts via shadcn/ui Chart component (already decided project-wide)
- Exact screen layout/grid
- Exact period filter presets and custom-date component
- Where aggregates are computed (Postgres view/RPC vs client-side)

## Deferred Ideas

None — discussion stayed within phase scope.
