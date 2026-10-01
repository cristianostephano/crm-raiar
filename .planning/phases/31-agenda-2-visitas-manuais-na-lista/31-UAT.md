---
status: testing
phase: 31-agenda-2-visitas-manuais-na-lista
source: [31-VERIFICATION.md]
started: 2026-10-01T00:00:00.000Z
updated: 2026-10-01T00:00:00.000Z
---

## Current Test

number: 1
name: Fluxo completo de vendedor e Supervisor na Agenda 2
expected: |
  Vendedor: o item aparece em "Hoje"; a correção aparece na hora; concluído fica riscado e continua na lista; desmarcar volta ao normal; apagar pede confirmação e some; nome com telefone é recusado com a mensagem de documento; o selo do menu acompanha o número de pendentes.
  Supervisor: vê os itens do time com o nome do vendedor, filtro "Vendedor" em "Todos os vendedores", nenhum botão de adicionar/editar/apagar/concluir, selo da Agenda 2 dele sem número.
  A tela "Agenda" continua exatamente como antes.
awaiting: user response

## Tests

### 1. Fluxo completo de vendedor e Supervisor na Agenda 2
expected: Como vendedor de teste — abrir "Agenda 2" no menu (logo abaixo de "Agenda"), adicionar uma visita para hoje, corrigir o bairro, marcar como concluída, desmarcar, apagar (confirmando). Tentar um nome com número de telefone/CPF (deve ser recusado). Depois entrar como Supervisor e abrir "Agenda 2".
result: [pending]

### 2. Prazo de guarda (retenção) dos dados da Agenda 2 — decisão do dono
expected: Confirmar com o dono do projeto uma política de prazo de guarda para os itens da Agenda 2, antes de uso real continuado em produção (ex.: apagar tudo se a Agenda 2 for descartada; ou descarte automático após N dias, no espírito dos 35 dias já usados no registro de uso da v1.7).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
