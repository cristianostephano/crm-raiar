# Phase 12: Comparativo por Vendedor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 12-Comparativo por Vendedor
**Areas discussed:** O que conta como "negócios iniciados", Filtro de período, Fórmula de "taxa de conversão"

---

## O que conta como "negócios iniciados"

| Option | Description | Selected |
|--------|-------------|----------|
| Total desde sempre | Conta todos os clientes já atribuídos ao vendedor, desde o começo | ✓ |
| Só dentro do período filtrado | Conta só os que entraram no período selecionado | |

**User's choice:** Total desde sempre

---

## A tabela usa o filtro de período do dashboard ou mostra tudo desde sempre

| Option | Description | Selected |
|--------|-------------|----------|
| Histórico completo, sem filtro | Consistente com o funil detalhado da Fase 11 | ✓ |
| Respeita o filtro de período existente | Mesmo comportamento do gráfico "Desempenho por vendedor" atual | |

**User's choice:** Histórico completo, sem filtro

---

## Como calcular a "taxa de conversão"

| Option | Description | Selected |
|--------|-------------|----------|
| Ganhos ÷ (ganhos + perdidos) | Eficácia de fechamento entre negócios já decididos | ✓ |
| Ganhos ÷ total de negócios iniciados | Conversão real da carteira inteira, incluindo em andamento | |

**User's choice:** Ganhos ÷ (ganhos + perdidos)

---

## Claude's Discretion

- Ordem das linhas na tabela (alfabético ou por desempenho).
- Nome/assinatura exata da nova RPC (nova dedicada vs. extensão da existente).
- Forma exata de filtrar vendedores ativos na lista sem truncar a agregação histórica.

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
