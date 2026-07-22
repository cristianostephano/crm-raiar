# Phase 5: Exportação de Clientes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 5-Exportação de Clientes
**Areas discussed:** Formato do arquivo, Quais colunas saem no arquivo, Onde fica o botão de exportar

---

## Formato do arquivo

| Option | Description | Selected |
|--------|-------------|----------|
| Excel (.xlsx) | Abre direto no Excel sem confusão de separador vírgula/ponto-e-vírgula do padrão brasileiro | ✓ |
| CSV | Arquivo mais simples e leve, mas pode abrir com acentuação ou separador errado | |
| Os dois, usuário escolhe | Botão com as duas opções | |

**User's choice:** Excel (.xlsx)

---

## Quais colunas saem no arquivo

| Option | Description | Selected |
|--------|-------------|----------|
| Cadastro + funil | Razão social, endereço, categoria, contato, produtos, responsável + etapa atual, status, observação | ✓ |
| Só dados de cadastro | Apenas os campos do cadastro, sem etapa/status/observação | |

**User's choice:** Cadastro + Funil
**Notes:** Usuário acrescentou: "na ausência da informação colocar na primeira etapa do funil". Esclarecido que isso já é coberto pela regra de importação (IMP-09, fase 7) — na exportação não existe cliente sem etapa preenchida, já que a etapa é a mesma coluna que sustenta o card do kanban (não pode ser nula).

---

## Onde fica o botão de exportar

| Option | Description | Selected |
|--------|-------------|----------|
| Topo da lista, reflete tudo | Botão "Exportar" ao lado de "Novo cliente", exporta exatamente o que está na tela (busca + filtros + aba ativa) | ✓ |
| Só reflete filtros, ignora busca por texto | Exporta considerando categoria/vendedor/produto, mas sempre a base completa | |

**User's choice:** Topo da lista, reflete tudo

---

## Claude's Discretion

- Nome do arquivo baixado (padrão razoável, ex: `clientes_AAAA-MM-DD.xlsx`)
- Ordem exata das colunas e formatação do arquivo
- Onde no código a geração acontece (decisão técnica de implementação)

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
