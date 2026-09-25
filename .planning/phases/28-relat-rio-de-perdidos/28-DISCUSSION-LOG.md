# Phase 28: Relatório de Perdidos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 28-Relatório de Perdidos
**Areas discussed:** Onde no menu, Estilo da lista, Contador no menu

---

## Onde no menu

| Option | Description | Selected |
|--------|-------------|----------|
| Item novo no menu principal | Ao lado de Agenda/Clientes/Dashboard | ✓ |
| Uma aba dentro da tela de Clientes | Junto com o quadro do funil | |

**User's choice:** Item novo no menu principal
**Notes:** Mesmo nível de importância de Agenda/Clientes/Dashboard.

---

## Estilo da lista

| Option | Description | Selected |
|--------|-------------|----------|
| Lista simples, uma linha por cliente | Mesmo estilo da Agenda | ✓ |
| Card parecido com o do Kanban | Mantém aparência do card do funil | |

**User's choice:** Lista simples, uma linha por cliente
**Notes:** Reaproveita `AgendaSemDiaFixo.tsx`/`AgendaItemRow.tsx` como molde.

---

## Contador no menu

| Option | Description | Selected |
|--------|-------------|----------|
| Só o nome, sem contador | Mais simples | ✓ |
| Mostrar contagem, como a Agenda | Número chamando atenção | |

**User's choice:** Só o nome, sem contador
**Notes:** Perdido não é pendência urgente como a Agenda — um número ali soaria como alarme à toa.

---

## Claude's Discretion

- Ícone exato do menu (D-03)
- Layout exato da página, posição do filtro de período, se tem busca por nome (fim de `<decisions>`)
- Padrão default do filtro de período (mostrar tudo vs. últimos N dias)

## Deferred Ideas

Nenhuma — a discussão ficou dentro do escopo da fase (PERD-01..05).
