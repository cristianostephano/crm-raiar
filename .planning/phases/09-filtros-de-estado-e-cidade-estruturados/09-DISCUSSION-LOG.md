# Phase 9: Filtros de Estado e Cidade Estruturados - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 9-Filtros de Estado e Cidade Estruturados
**Areas discussed:** Clientes já cadastrados com dado torto

---

## Clientes já cadastrados com dado torto

| Option | Description | Selected |
|--------|-------------|----------|
| Corrigir automaticamente (fuzzy match) | Tenta adivinhar a sigla certa a partir do texto livre existente | |
| Marcar pra revisão manual | Deixa os registros inconsistentes sinalizados pra alguém corrigir depois | |
| Outro (resposta livre) | — | ✓ |

**User's choice (texto livre):** "os clientes que estão no sistema são só para teste oque for atrapalhar menos pois vou deletar todos" — os clientes atuais são todos de teste e serão apagados; usar a abordagem tecnicamente mais simples pra migração, sem investir em correspondência aproximada ou revisão manual.

**Notes:** Isso resolve o gray area sem precisar de mais perguntas — dados de teste descartáveis não justificam uma lógica de migração cuidadosa.

---

## Claude's Discretion

- Campo Cidade desabilitado até o Estado ser escolhido (não foi perguntado ao usuário — baixo risco, padrão comum de filtro em cascata).
- Comportamento exato de registros legados sem correspondência exata após a normalização simples.
- Componente de UI exato pra busca de Cidade (combobox pesquisável).
- Fonte/formato exato dos dados de municípios do IBGE.

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
