---
sketch: 003
name: agenda-calendario
question: "Como fica a Agenda em formato calendário (dia/semana/mês), reaproveitando o mesmo visual de card/badge da lista atual, com contador em dia lotado?"
winner: "A"
tags: [agenda, calendario, layout]
---

# Sketch 003: Agenda em Calendário

## Design Question

Como deve ficar a nova visão de calendário (dia/semana/mês) da Agenda — reaproveitando as
cores/badges que a lista atual já usa pra distinguir Prospecção (cinza) de Visita/Ativo (azul),
com contador + clique em dias lotados, e sem arrastar itens (só visualização)?

Nota importante: os itens da Agenda (`agenda_do_vendedor()`) têm data, mas não hora do dia —
por isso não existe grade de horários como no Google Agenda de verdade. "Dia" e "Semana" mostram
os itens daquele(s) dia(s) numa lista/coluna, não numa grade de 24h.

## How to View

```
open .planning/sketches/003-agenda-calendario/index.html
```

## Variants

- **A: Toolbar simples ★** — botão de alternância Lista/Dia/Semana/Mês + navegação de data no topo, sem elementos extras. Visão de mês em grid 7 colunas com chips coloridos (até 3 por dia + contador "+N"); semana em 7 colunas lado a lado, cada uma com os itens daquele dia; dia é uma lista igual à existente hoje.
- **B: Com mini-calendário lateral** — adiciona um mini-calendário de navegação rápida (tipo Google Agenda de verdade) do lado esquerdo do grid principal, com pontinho nos dias que têm item.

## What to Look For

- Se o grid de mês fica legível com os chips coloridos, ou se fica poluído.
- Se o contador "+N mais" em dia lotado (dia 14 no mock, com 7 itens) é claro o suficiente.
- Se a Variante B (mini-calendário lateral) agrega valor real ou é complexidade desnecessária — o pedido original foi "o mais simples possível".
- Se a distinção visual Prospecção (cinza, ícone 📋) vs Ativo/Visita (azul, ícone 🔁) — mesma linguagem do `AgendaItemRow.tsx` real — fica clara nos 3 modos.
