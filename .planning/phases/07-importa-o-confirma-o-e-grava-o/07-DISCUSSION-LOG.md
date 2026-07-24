# Phase 7: Importação — Confirmação e Gravação - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 7-Importação — Confirmação e Gravação
**Areas discussed:** O que acontece depois de confirmar, Revalidar na hora de confirmar, Linhas puladas somem ou ficam registradas

---

## O que acontece depois de confirmar

| Option | Description | Selected |
|--------|-------------|----------|
| Tela de resumo, depois vai pra lista | Mostra "X importados, Y pulados" com botão "Ver clientes" | ✓ |
| Vai direto pra lista de clientes | Sem tela intermediária | |

**User's choice:** Tela de resumo, depois vai pra lista

---

## Revalidar na hora de confirmar

| Option | Description | Selected |
|--------|-------------|----------|
| Revalidar antes de gravar | Roda a mesma checagem de duplicado de novo | ✓ |
| Confiar na revisão já feita | Grava exatamente o que foi revisado, sem checar de novo | |

**User's choice:** Revalidar antes de gravar

---

## Linhas puladas somem ou ficam registradas

| Option | Description | Selected |
|--------|-------------|----------|
| Some, só aparece no resumo final | Sem tabela nova, sem histórico permanente | ✓ |
| Fica um registro permanente no sistema | Histórico consultável depois | |

**User's choice:** Some, só aparece no resumo final

---

## Claude's Discretion

- Layout exato da tela de resumo
- Nome/assinatura exata da RPC de inserção em lote
- Estratégia SQL exata pra "uma linha ruim não trava o lote"

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
