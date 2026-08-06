---
created: 2026-08-06T12:26:58.279Z
title: Filtro de Cidade mostra todas as cidades do Brasil em vez de só as com clientes
area: ui
files:
  - components/clientes/EstadoCidadeFields.tsx
  - components/clientes/FiltersPopover.tsx
---

## Problem

O filtro de Cidade (tela de Clientes, e possivelmente também cadastro/edição) mostra a lista completa de municípios do Brasil vinda do IBGE (~5570 cidades, filtradas só por Estado) toda vez que é aberto. O usuário reportou que, na prática, só uma fração pequena dessas cidades (ele estimou uns 20%) tem algum cliente cadastrado — as outras 80% aparecem na lista mas nunca vão ser escolhidas, e rolar por todas até achar a certa é muito trabalho.

Print de referência mostrado pelo usuário: um combobox com a lista de cidades de um Estado inteiro (ex: "Espírito Santo do Turvo", "Embu das Artes", etc.), sem nenhum filtro por "já tem cliente aqui". O rótulo visível no print dizia "Vendedor/responsável", o que pode indicar que o print capturou o dropdown errado ou que há um problema de rótulo/posicionamento — **precisa confirmar exatamente qual tela/campo foi capturado antes de implementar qualquer mudança**.

Este comportamento (lista completa de cidades por Estado, sem filtrar por clientes existentes) foi uma decisão deliberada da Fase 9 (Filtros de Estado e Cidade Estruturados) — ver `.planning/phases/09-filtros-de-estado-e-cidade-estruturados/`. Mudar isso é uma revisão dessa decisão, não um bug da implementação original.

## Solution

TBD. Abordagens possíveis a discutir:
1. No filtro de clientes (não no cadastro/edição), trocar a fonte da lista de cidades: em vez de vir da tabela `cidades` (IBGE completo) filtrada por Estado, vir de uma consulta às cidades que já aparecem em `clientes.cidade` (distintas, filtradas por Estado e talvez por vendedor/permissão).
2. Cadastro/edição de cliente provavelmente deve continuar usando a lista completa do IBGE (afinal, é onde se cadastra uma cidade nova pela primeira vez) — a mudança seria só no filtro de busca/listagem.
3. Confirmar com o usuário exatamente qual tela ele quer mudar antes de rodar `/gsd-discuss-phase` ou `/gsd-quick` para isso.
