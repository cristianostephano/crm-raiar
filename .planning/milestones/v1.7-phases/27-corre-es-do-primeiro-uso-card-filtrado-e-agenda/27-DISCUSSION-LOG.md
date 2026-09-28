# Phase 27: Correções do Primeiro Uso — Card Filtrado e Agenda - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-25
**Phase:** 27-Correções do Primeiro Uso — Card Filtrado e Agenda
**Areas discussed:** Reprodução do bug KAN-03

---

## Reprodução do bug KAN-03

Antes de discutir formalmente, foi feita uma investigação de código (não uma pergunta de gray-area tradicional): leitura de `KanbanBoard.tsx` e `ClienteCard.tsx` não revelou nenhuma linha que explicasse a compressão visual relatada nas fotos (categoria/vendedor/cidade/ícones sumindo, nomes cortados, ao filtrar por vendedor). Os dois branches de renderização (`dragDisabled`/`DndContext`) usam a mesma largura de coluna, e o card não tem classes de ocultação responsiva.

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| Ainda vou testar e te aviso | Confirmar ao vivo antes de decidir o próximo passo | |
| Tenho certeza que ainda acontece (não precisa retestar) | Já visto acontecer múltiplas vezes recentemente, incluindo hoje | ✓ |

**Escolha do usuário:** "Tenho certeza que ainda acontece (não precisa retestar)"
**Notas:** Confirma que não é cache do navegador. A pesquisa/planejamento da fase precisa reproduzir o bug ao vivo (sessão autenticada real, filtro de vendedor aplicado) antes de propor uma correção, já que a leitura estática do código não aponta a causa.

---

## Achado de código — AGD-15 (não foi uma pergunta ao usuário, foi investigação prévia à discussão)

Localizada a causa raiz exata por leitura de código, sem precisar de decisão do usuário: `AgendaSemDiaFixo.tsx` usa `cliente.razaoSocial` cru como título, em vez de `nomeExibicaoCliente()` (a função de fallback pra Nome Fantasia já padronizada desde a Fase 26 do v1.6). A correção e a dependência técnica (adicionar `nome_fantasia` ao SELECT de `getClientesSemDiaFixo`) foram registradas diretamente em CONTEXT.md como decisões D-01 a D-04, sem necessidade de AskUserQuestion — não havia ambiguidade de produto a resolver, só a causa técnica a documentar.

## Claude's Discretion

- Ordem de execução entre as duas correções (independentes entre si).
- Se a investigação ao vivo de KAN-03 apontar causa em código fora dos dois arquivos já lidos, o planejamento pode se ajustar livremente — o critério de sucesso (card filtrado idêntico ao sem filtro) não muda.

## Deferred Ideas

Nenhuma — a discussão ficou dentro do escopo da fase (KAN-03, AGD-15).
