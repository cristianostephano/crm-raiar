# Phase 8: Rolagem por Coluna no Kanban - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 8-Rolagem por Coluna no Kanban
**Areas discussed:** Indicador de mais conteúdo, Altura em telas menores

---

## Indicador de mais conteúdo

| Option | Description | Selected |
|--------|-------------|----------|
| Não precisa, a barra de rolagem já basta | Mais simples de construir | |
| Sim, quero a sombra/indicador extra | Deixa mais óbvio visualmente que tem mais clientes abaixo, mesmo antes de rolar | ✓ |

**User's choice:** Sim, quero a sombra/indicador extra

---

## Altura em telas menores

| Option | Description | Selected |
|--------|-------------|----------|
| Ajustar à tela disponível, com um mínimo razoável | A altura acompanha o tamanho da janela, mas nunca fica pequena demais | ✓ |
| Altura fixa sempre, do mesmo jeito em qualquer tela | Valor fixo único, independente do tamanho da janela | |

**User's choice:** Ajustar à tela disponível, com um mínimo razoável

---

## Claude's Discretion

- Valor exato do mínimo de altura e da fórmula de cálculo do "espaço disponível na tela".
- Implementação exata do indicador de sombra/fade.
- Configuração do dnd-kit necessária pra manter o auto-scroll do drag funcionando dentro de colunas com scroll interno.

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
