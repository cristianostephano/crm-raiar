# Phase 6: Importação — Upload, Mapeamento e Revisão - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 6-Importação — Upload, Mapeamento e Revisão
**Areas discussed:** Formato de arquivo aceito, Categoria/Produto que não existe no sistema, Duplicado dentro da própria planilha, Como mostrar o "possível duplicado" na revisão

---

## Formato de arquivo aceito

| Option | Description | Selected |
|--------|-------------|----------|
| Excel (.xlsx) e CSV | Aceita os dois formatos, evita conversão manual | ✓ |
| Só Excel (.xlsx) | Consistente com a exportação, mais simples | |

**User's choice:** Excel (.xlsx) e CSV

---

## Categoria/Produto que não existe no sistema

| Option | Description | Selected |
|--------|-------------|----------|
| Marcar como erro, supervisor decide | Linha aparece com aviso; supervisor cadastra antes ou pula a linha | ✓ |
| Criar automaticamente | Sistema cadastra sozinho, sem perguntar | |
| Importar sem o campo (em branco) | Linha entra, campo fica vazio | |

**User's choice:** Marcar como erro, supervisor decide

---

## Duplicado dentro da própria planilha

| Option | Description | Selected |
|--------|-------------|----------|
| Marcar as duas como possível duplicado | Mesmo tratamento do duplicado contra o banco | ✓ |
| Bloquear a planilha inteira | Nenhuma linha importa até corrigir | |

**User's choice:** Marcar as duas como possível duplicado

---

## Como mostrar duplicado na revisão

| Option | Description | Selected |
|--------|-------------|----------|
| Aviso na linha + escolha por linha | Selo por linha, decisão granular (Importar mesmo assim / Pular) | ✓ |
| Aviso simples, pular por padrão | Linhas suspeitas já vêm marcadas pra pular | |

**User's choice:** Aviso na linha + escolha por linha

---

## Claude's Discretion

- Layout exato das telas de mapeamento e revisão (paginação, grid vs. tabela)
- Algoritmo de normalização de razão social para comparação de duplicado
- Onde os dados validados ficam entre upload e confirmação (arquitetura)

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
