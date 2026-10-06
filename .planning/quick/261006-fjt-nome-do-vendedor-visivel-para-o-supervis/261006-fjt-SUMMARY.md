---
phase: quick-261006-fjt
plan: 01
subsystem: agenda2
tags: [agenda, supervisor, semana, mes, lgpd]
requires: []
provides:
  - "Nome do vendedor visivel para o Supervisor nas visoes Semana e Mes da Agenda"
affects:
  - components/agenda2/Agenda2Calendario.tsx
  - components/agenda2/Agenda2CalendarioSemana.tsx
  - components/agenda2/Agenda2CalendarioMes.tsx
key-files:
  modified:
    - components/agenda2/Agenda2CalendarioSemana.tsx
    - components/agenda2/Agenda2CalendarioMes.tsx
    - components/agenda2/Agenda2Calendario.tsx
    - tests/agenda2/agenda2-calendario-semana.test.tsx
    - tests/agenda2/agenda2-calendario-mes.test.tsx
    - tests/agenda2/agenda2-calendario.test.tsx
    - tests/agenda2/agenda2-item-row.test.tsx
    - tests/agenda2/agenda2-calendario-integracao.test.tsx
decisions:
  - "Semana: 3a linha pequena e apagada no cartao; Mes: 2a linha pequena dentro do chip, cortada com reticencias"
  - "Reaproveita a regra que ja existia (Supervisor sem filtro de vendedor); com filtro, a linha some"
metrics:
  tasks: 3
  commits: 2
completed: 2026-10-06
status: complete
---

# Quick 261006-fjt: nome do vendedor visivel para o Supervisor (Semana e Mes) Summary

O Supervisor agora ve DE QUEM e cada visita tambem nas visoes Semana e Mes da Agenda, em letra pequena e apagada, sem precisar escolher um vendedor no filtro.

## O que mudou, visao por visao

- **Semana:** cada cartaozinho de visita ganhou uma terceira linha, embaixo do nome do cliente e do bairro, com o nome do vendedor dono da visita.
- **Mes:** cada visita (chip) ganhou uma segunda linha pequena, embaixo do nome do cliente, com o nome do vendedor. Se o nome nao couber, e cortado com reticencias (passando o mouse, aparece inteiro). O limite de 3 visitas por dia, o "+N mais", o clique no dia inteiro e a leitura por voz do dia ("<dia>, N visitas") continuam exatamente iguais. Para o Supervisor, um dia bem cheio fica um pouco mais alto (cerca de 3 linhas pequenas); para o Vendedor nada muda.
- **Dia, janela do dia e Lista:** ja mostravam o nome do vendedor para o Supervisor. Nao mudei nada ali; so acrescentei um teste que garante que nome ausente nao deixa linha vazia nem escreve "null".

## Quando o nome extra aparece

- Aparece **somente para o Supervisor** e **somente quando nenhum vendedor esta escolhido no filtro** (opcao "todos"). E a mesma regra que a Lista e o Dia ja usavam.
- O **Vendedor nunca ve** essa linha extra (ele so ve as proprias visitas, de qualquer forma).
- Se o Supervisor escolhe um vendedor no filtro, a linha some (o nome ja esta escrito no filtro; repetir em todo cartao seria ruido). Se o dono preferir mostrar tambem com filtro, e trocar UMA linha em `Agenda2List.tsx` e vale para todas as visoes de uma vez; ficou fora desta tarefa.
- Se a visita nao tem nome de vendedor (vazio), nao aparece linha vazia nem o texto "null"; o cartao fica igual ao de antes.
- Nome do vendedor numa visita concluida nao e riscado (so o nome do cliente e riscado).

## Nota LGPD

O nome do vendedor e dado pessoal de um colaborador. Esta tarefa **nao cria, busca, guarda nem exporta nenhum dado novo**: o nome ja chegava a tela (Lista, Dia e o filtro "Vendedor"). So passou a ser exibido em mais duas visoes, para o mesmo papel (Supervisor) que ja o via. Privacidade por padrao aplicada: o recurso nasce desligado (sem a configuracao, nada aparece) e o Vendedor nunca ve. Quem decide o que cada pessoa pode ver continua sendo a regra de acesso do banco (RLS), que nao foi alterada. Recomenda-se que o dono confirme que essa exibicao esta dentro da finalidade (gestao do time de vendas).

## Nada mais foi tocado

Nenhuma mudanca em banco, migrations, regras de acesso, consultas, acoes do servidor, Agenda antiga ou dependencias. Apenas 3 componentes visuais da Agenda nova foram alterados (mais testes). Nada foi enviado ao GitHub (2 commits locais).

## Commits

- `b26bdca` — Semana e Mes mostram o nome do vendedor para o Supervisor
- `dcedb59` — calendario repassa o nome do vendedor as visoes Semana e Mes

## Testes e verificacao final

- 9 arquivos de teste da Agenda nova: 134 testes passando (casos novos para Semana, Mes, repasse, nome ausente e fluxo real Supervisor com e sem filtro e Vendedor).
- Verificacao de tipos e lint (sem avisos) limpos nos 8 arquivos; `npm run build` concluido.
- Portoes finais: **GATES-OK** (Agenda antiga e `supabase/` intocados; so os 3 componentes de agenda2 mudaram; sem dependencia nova).

## Deviations from Plan

Nenhuma de comportamento. Detalhe de processo: no Task 2 o componente foi editado antes dos testes; para respeitar o "primeiro ver falhar", desfiz temporariamente a edicao, vi 3 testes novos falharem e restaurei a edicao.

## Como publicar (lembrete)

Publicar segue o fluxo do projeto: staging -> link de teste -> master. Conferencia sugerida no link de teste: entrar como Supervisor, abrir Agenda -> Semana e Mes com "todos os vendedores" e ver o nome embaixo de cada visita; escolher um vendedor e ver a linha sumir; entrar como Vendedor e confirmar que nenhuma linha extra aparece.

## Self-Check: PASSED

- Arquivos alterados existem; commits b26bdca e dcedb59 existem; nada enviado (master ahead 2 local).
