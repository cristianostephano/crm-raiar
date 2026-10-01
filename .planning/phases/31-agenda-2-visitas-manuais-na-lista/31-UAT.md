---
status: partial
phase: 31-agenda-2-visitas-manuais-na-lista
source: [31-VERIFICATION.md]
started: 2026-10-01T00:00:00.000Z
updated: 2026-10-01T00:00:02.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Fluxo completo de vendedor e Supervisor na Agenda 2
expected: Como vendedor de teste — abrir "Agenda 2" no menu (logo abaixo de "Agenda"), adicionar uma visita para hoje, corrigir o bairro, marcar como concluída, desmarcar, apagar (confirmando). Tentar um nome com número de telefone/CPF (deve ser recusado). Depois entrar como Supervisor e abrir "Agenda 2".
result: skipped
reason: "Dono optou por pular o teste manual nesta sessão (\"pula o teste\")"

### 2. Prazo de guarda (retenção) dos dados da Agenda 2 — decisão do dono
expected: Confirmar com o dono do projeto uma política de prazo de guarda para os itens da Agenda 2, antes de uso real continuado em produção (ex.: apagar tudo se a Agenda 2 for descartada; ou descarte automático após N dias, no espírito dos 35 dias já usados no registro de uso da v1.7).
result: blocked
blocked_by: other
reason: "Não consigo testar nada agora"

## Summary

total: 2
passed: 0
issues: 0
pending: 0
skipped: 1
blocked: 1

## Gaps
