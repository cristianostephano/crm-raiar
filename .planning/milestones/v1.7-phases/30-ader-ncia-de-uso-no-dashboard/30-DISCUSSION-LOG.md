# Phase 30: Aderência de Uso no Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-27
**Phase:** 30-Aderência de Uso no Dashboard
**Areas discussed:** O que é "login", Dias úteis, Meio da janela, Prazo de guarda, Avisar o time

---

## O que é "login"

| Option | Description | Selected |
|--------|-------------|----------|
| Contar como "abriu alguma tela do sistema naquele dia" | Registra o primeiro acesso do dia | ✓ |
| Contar só login de verdade (Supabase Auth) | Mais simples, mas subestima quem usa todo dia | |

**User's choice:** Contar como "abriu alguma tela do sistema naquele dia"

---

## Dias úteis

| Option | Description | Selected |
|--------|-------------|----------|
| Segunda a sexta, sem excluir feriados | Simples de calcular | ✓ |
| Segunda a sexta, excluindo feriados nacionais | Mais preciso, mais complexo | |

**User's choice:** Segunda a sexta, sem excluir feriados

---

## Meio da janela

| Option | Description | Selected |
|--------|-------------|----------|
| Só conta os dias em que ele estava ativo no time | Justo com quem entrou/saiu recentemente | ✓ |
| Sempre os 28 dias completos | Mais simples, mas injusto | |

**User's choice:** Só conta os dias em que ele estava ativo no time

---

## Prazo de guarda

| Option | Description | Selected |
|--------|-------------|----------|
| Só os últimos ~35 dias, apagando o resto | Minimização de dado pessoal | ✓ |
| Guardar indefinidamente | Acumula dado pessoal sem prazo | |

**User's choice:** Só os últimos ~35 dias, apagando o resto automaticamente

---

## Avisar o time

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, recomendo avisar (fora do escopo do código) | Boa prática de transparência | ✓ |
| Não é necessário | — | |

**User's choice:** Sim, recomendo avisar — decisão de comunicação do dono do projeto, fora do escopo de código desta fase.

---

## Claude's Discretion

- Nome exato da tabela/mecanismo de registro de acesso diário
- Texto exato do indicador de janela incompleta (D-09)
- Se cadastro/edição de cliente é registrado estendendo o gatilho de histórico existente ou via tabela nova

## Deferred Ideas

- Comunicação ao time sobre a métrica de uso — fora do escopo de código, responsabilidade do dono do projeto (D-12).
