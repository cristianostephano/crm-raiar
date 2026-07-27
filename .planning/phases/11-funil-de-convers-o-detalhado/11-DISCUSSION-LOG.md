# Phase 11: Funil de Conversão Detalhado - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 11-Funil de Conversão Detalhado
**Areas discussed:** Formato da visualização, Como calcular o "% que avançou", Destaque visual de etapas travadas, Limite de gargalo

---

## Formato da visualização

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela | Uma linha por etapa, colunas: quantidade, % avançou, perdidos (número e %), tempo médio parado. Fácil de ler números exatos. | ✓ |
| Gráfico de funil (barras decrescentes) | Visual mais chamativo, mas esconde tempo médio e perdidos sem interação | |

**User's choice:** Tabela
**Notes:** Confirmado que é uma seção adicional ao gráfico simples "clientes por etapa" já existente — não substitui nada.

---

## Como calcular o "% que avançou"

| Option | Description | Selected |
|--------|-------------|----------|
| Inclui quem ainda está parado | Denominador = todos que já passaram pela etapa (incluindo parados agora); parados contam como "ainda não avançou" | ✓ |
| Só quem já saiu da etapa | Ignora quem ainda está parado; % fica "mais limpo" mas esconde travamento atual do cálculo | |

**User's choice:** Inclui quem ainda está parado

---

## Destaque visual de etapas travadas

| Option | Description | Selected |
|--------|-------------|----------|
| Destacar gargalos | Cor de alerta quando tempo médio passa de um limite | ✓ |
| Só os números, sem destaque | Sem regra de gargalo, usuário interpreta visualmente | |

**User's choice:** Destacar gargalos

---

## Limite de gargalo

| Option | Description | Selected |
|--------|-------------|----------|
| Acima da média das outras etapas | Comparação relativa entre as 7 etapas, se ajusta sozinho | ✓ |
| Acima de um número fixo de dias | Limite fixo igual pra todas as etapas | |

**User's choice:** Acima da média das outras etapas

---

## Claude's Discretion

- Fórmula estatística exata do "bem acima da média" (desvio padrão, múltiplo da média, etc.).
- Estrutura exata da(s) RPC(s) Postgres (uma por métrica ou uma única).
- Como reconstruir tempo por etapa e dias até ganho/perdido a partir de `historico`.

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
