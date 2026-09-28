---
phase: 29-encerrar-cliente-ativo
plan: 06
subsystem: ui
tags: [react, typescript, base-ui, select, dialog, kanban, server-actions]

requires:
  - phase: 29-encerrar-cliente-ativo (plan 04)
    provides: "marcarStatus estendido com o 6º parâmetro motivoEncerramentoId, pré-checagens de encerrar (encerramento_travado), frequência efetiva e revalidação de /agenda"
  - phase: 29-encerrar-cliente-ativo (plan 05)
    provides: "getMotivosEncerramento() (Server Action) para popular o Select de motivo"
provides:
  - "EncerramentoMotivoDialog — diálogo irmão de PerdaMotivoDialog para o motivo obrigatório de encerramento (ENCR-02)"
  - "4ª opção 'Encerrado' no Select de Status da ficha (ClienteDetailSheet), desabilitada fora de 'Ganho'/'Encerrado', com tooltip (D-01/D-04/D-05)"
  - "ClienteDetailSheet ganha a prop opcional onStatusChanged, consumida por AgendaList para recarregar a Agenda depois de qualquer troca de status pela ficha (critério 2)"
affects: []

tech-stack:
  added: []
  patterns:
    - "EncerramentoMotivoDialog é cópia estrutural deliberada de PerdaMotivoDialog (componente irmão, não generalização) — mesmo padrão já usado entre Perdidos/Encerrados em planos anteriores desta fase"

key-files:
  created:
    - components/clientes/EncerramentoMotivoDialog.tsx
    - tests/clientes/encerramento-motivo-dialog.test.tsx
    - tests/clientes/cliente-detail-sheet-encerrar.test.tsx
  modified:
    - components/clientes/ClienteDetailSheet.tsx
    - components/agenda/AgendaList.tsx

key-decisions:
  - "'Encerrado' não fica desabilitado para quem já está encerrado (decisão de tela 2 do plano) — condição usada foi 'status atual não é ganho NEM encerrado', em vez do UI-SPEC §2 literal (só não-ganho), para a opção já selecionada não aparecer com o tooltip confuso de 'Ganho'"
  - "onStatusChanged é opcional e só a Agenda passa — o Kanban não precisa (não muda de comportamento)"

requirements-completed: [ENCR-01, ENCR-02, ENCR-03, ENCR-04]

coverage:
  - id: D1
    description: "EncerramentoMotivoDialog — diálogo com Select de motivo alimentado por getMotivosEncerramento, botão 'Confirmar encerramento' desabilitado até escolher motivo, erro de carga e de submit tratados sem fechar o diálogo"
    requirement: "ENCR-02"
    verification:
      - kind: unit
        ref: "tests/clientes/encerramento-motivo-dialog.test.tsx (titulo, carrega-motivos, botao-desabilitado, confirma, erro-carga, erro-submit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "4ª opção 'Encerrado' sempre presente no Select de Status, habilitada quando ganho/encerrado, desabilitada com tooltip nos demais status (D-01/D-04)"
    requirement: "ENCR-01"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-detail-sheet-encerrar.test.tsx (opcao-presente-habilitada, opcao-desabilitada-fora-de-ganho)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selecionar 'Encerrado' abre o diálogo de motivo; confirmar chama marcarStatus(clienteId, 'encerrado', undefined, undefined, undefined, motivoId) — mesmo caminho de escrita de qualquer troca de status"
    requirement: "ENCR-02"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-detail-sheet-encerrar.test.tsx (abre-dialogo, confirma-encerramento)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Erro de marcarStatus (ex.: encerramento_travado) mantém o diálogo aberto com a mensagem; onStatusChanged não é chamada"
    requirement: "ENCR-02"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-detail-sheet-encerrar.test.tsx (erro-mantem-dialogo)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Depois de uma troca de status bem-sucedida pela ficha aberta na Agenda, a Agenda recarrega via onStatusChanged/handleRecarregar — o encerrado some da lista na hora (critério 2)"
    requirement: "ENCR-03"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-detail-sheet-encerrar.test.tsx (confirma-encerramento, assert em onStatusChanged); tests/agenda/agenda-list.test.tsx e tests/agenda/agenda-calendario-integracao.test.tsx reconfirmados intactos"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-27
status: complete
---

# Phase 29 Plan 6: Encerrar pela Ficha do Cliente Summary

**4ª opção "Encerrado" no Select de Status da ficha do cliente (bolinha cinza, desabilitada com tooltip fora de "Ganho"/"Encerrado"), diálogo irmão de motivo obrigatório (`EncerramentoMotivoDialog`), e recarga automática da Agenda depois de qualquer troca de status pela ficha — fechando o caminho de "vendedor encerra sozinho" da Fase 29.**

## Performance

- **Duration:** ~35min
- **Tasks:** 2/2
- **Files modified:** 5 (3 criados, 2 alterados)

## Accomplishments

- `EncerramentoMotivoDialog` (novo, cópia estrutural deliberada de `PerdaMotivoDialog` — componente irmão, não generalização): busca `getMotivosEncerramento()` ao abrir, exige a escolha de um motivo antes de habilitar "Confirmar encerramento" (`variant="destructive"`), mostra erro de carga/submit sem fechar o diálogo.
- `ClienteDetailSheet.tsx`: `STATUS_OPTIONS` ganha a 4ª entrada `{ value: "encerrado", label: "Encerrado" }`; a opção fica desabilitada (com `ENCERRADO_TOOLTIP`, mesmo padrão de `Info`/`Tooltip` já usado por "Ganho") sempre que o cliente não está "ganho" nem "encerrado" — condição refinada em relação ao UI-SPEC §2 literal para a opção já selecionada não exibir um tooltip confuso (decisão de tela 2 do plano). Selecionar "Encerrado" abre `EncerramentoMotivoDialog`; confirmar chama `handleStatusChange("encerrado", undefined, undefined, undefined, motivoId)`, que repassa `motivoEncerramentoId` como 6º argumento de `marcarStatus` — o mesmo caminho de escrita de qualquer troca de status, sem lógica paralela.
- Nova prop opcional `onStatusChanged?: (novoStatus) => void`, chamada no sucesso de `handleStatusChange` depois do refresh de histórico/diário; `AgendaList.tsx` passa `onStatusChanged={handleRecarregar}` — a Agenda recarrega e o cliente encerrado some dela na hora, sem esperar navegação (critério 2).

## Task Commits

Cada tarefa TDD gerou um commit RED (test) e um GREEN (feat):

1. **Tarefa 1: EncerramentoMotivoDialog** — `ae21c0f` (test, RED) → `86a9d4e` (feat, GREEN)
2. **Tarefa 2: Opção "Encerrado" no Select de Status + diálogo + recarga da Agenda** — `c6d3387` (test, RED) → `a2b2f2b` (feat, GREEN)

_Nenhum commit de `.planning/` foi feito por esta subagent — este SUMMARY.md e a atualização de STATE.md/ROADMAP.md ficam a cargo do orquestrador._

## Files Created/Modified

- `components/clientes/EncerramentoMotivoDialog.tsx` - novo, diálogo de motivo obrigatório para encerrar
- `tests/clientes/encerramento-motivo-dialog.test.tsx` - novo, 6 casos
- `components/clientes/ClienteDetailSheet.tsx` - 4ª opção "Encerrado", `ENCERRADO_TOOLTIP`, estado `encerramentoDialogOpen`, ramo em `handleStatusSelect`, 5º parâmetro `motivoEncerramentoId` em `handleStatusChange`, prop `onStatusChanged`, render de `EncerramentoMotivoDialog`
- `tests/clientes/cliente-detail-sheet-encerrar.test.tsx` - novo, 5 casos
- `components/agenda/AgendaList.tsx` - uma prop nova (`onStatusChanged={handleRecarregar}`) + comentário de uma linha

## Decisions Made

- "Encerrado" não fica desabilitado para quem já está encerrado — o UI-SPEC §2 desabilita literalmente sempre que o status não é "ganho", o que faria a própria opção selecionada de um cliente já encerrado aparecer desabilitada com o tooltip "Disponível somente quando o cliente já está \"Ganho\"." (confuso). Condição usada: desabilitada quando o status atual não é "ganho" NEM "encerrado" (decisão de tela 2, já registrada no próprio `<decisoes_de_tela>` do plano antes da execução — não uma decisão nova tomada durante a execução).
- `onStatusChanged` é opcional e só `AgendaList` passa — `KanbanBoard` não precisa (mantém o comportamento atual).

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhuma correção de Regra 1/2/3 foi necessária.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Este era o último plano da Fase 29 (`29-06`, wave 4). O caminho de ENCERRAR pela ficha está completo e testado: opção no Select, diálogo de motivo obrigatório, escrita única via `marcarStatus`, recarga da Agenda.
- `npm run build` conclui sem erro; `npx tsc --noEmit` e `npx eslint` limpos nos arquivos tocados.
- Pendência fora do escopo desta subagent: o checklist de human-verify (deploy em `staging`, link de preview da Vercel, checagem visual ao vivo) fica a cargo do orquestrador/dono do projeto no fechamento da fase — nenhuma ação de deploy foi tomada aqui, conforme as constraints desta dispatch.
- Nenhum bloqueio conhecido para o fechamento da Fase 29.

## Self-Check: PASSED

- FOUND: components/clientes/EncerramentoMotivoDialog.tsx
- FOUND: tests/clientes/encerramento-motivo-dialog.test.tsx
- FOUND: tests/clientes/cliente-detail-sheet-encerrar.test.tsx
- FOUND: components/clientes/ClienteDetailSheet.tsx (ENCERRADO_TOOLTIP, EncerramentoMotivoDialog render, onStatusChanged)
- FOUND: components/agenda/AgendaList.tsx (onStatusChanged={handleRecarregar})
- FOUND commit ae21c0f
- FOUND commit 86a9d4e
- FOUND commit c6d3387
- FOUND commit a2b2f2b
- 43/43 testes verdes no comando de verificação completo do plano; `npm run build` concluído sem erro

---
*Phase: 29-encerrar-cliente-ativo*
*Completed: 2026-09-27*
