# Phase 32: Agenda 2 — Repetição Semanal e Calendário - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 32-agenda-2-repeti-o-semanal-e-calend-rio
**Areas discussed:** Vínculo entre ocorrências, Histórico no calendário, Indicador visual de repetição, Data passada+repetição, Editar e repetir, Duplicado em lote

---

## Vínculo entre ocorrências

| Option | Description | Selected |
|--------|-------------|----------|
| Não guarda nada (recomendado) | Menos dado pessoal, mais simples | ✓ |
| Guarda identificador de série | Prepara terreno futuro, não pedido | |

**User's choice:** Não guarda nada

---

## Histórico no calendário

| Option | Description | Selected |
|--------|-------------|----------|
| Mostra o que foi concluído naquele dia | Mesmo padrão da Agenda atual | ✓ |
| Só mostra pendentes, igual a Lista | Consistente com a regra da Fase 31 | |

**User's choice:** Mostra o que foi concluído naquele dia

---

## Indicador visual de repetição

| Option | Description | Selected |
|--------|-------------|----------|
| Fica idêntico a um item avulso (recomendado) | Sem indicador, mais simples | ✓ |
| Tem ícone/marca | Ajuda a identificar, mais complexo | |

**User's choice:** Fica idêntico a um item avulso

---

## Data passada + repetição

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, repetição funciona com qualquer data | Mesma regra de D-09 | |
| Repetição só disponível para data de hoje em diante | Trava nova, caso de uso é planejamento futuro | ✓ |

**User's choice:** Repetição só disponível para data de hoje em diante

---

## Editar e repetir

| Option | Description | Selected |
|--------|-------------|----------|
| Só ao criar (recomendado) | Mais simples | ✓ |
| Também dá pra adicionar repetição ao editar | Mais flexível, mais complexo | |

**User's choice:** Só ao criar

---

## Duplicado em lote

| Option | Description | Selected |
|--------|-------------|----------|
| Só no item original, antes de repetir | Mais simples | ✓ |
| Verifica cada ocorrência gerada | Mais completo, mais complexo | |

**User's choice:** Só no item original, antes de repetir

---

## Claude's Discretion

- Forma exata da query que alimenta o calendário (nova função vs. reaproveitar `getAgenda2()` com filtro de período).
- Nome exato dos novos arquivos/componentes copiados.
- Paginação/limite de busca por período visível no calendário.

## Deferred Ideas

- Identificador de série / "apagar todas as próximas" — descartado nesta fase, revisitar só se pedido real surgir.
- Indicador visual de repetição — descartado, decorre da decisão de não guardar série.
- Adicionar repetição ao editar um item existente — descartado, repetir só na criação.
