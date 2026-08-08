---
phase: 13-cliente-ativo-e-frequ-ncia-de-visita
plan: 02
subsystem: ui
tags: [react, nextjs, server-actions, vitest, base-ui]

requires:
  - phase: 13-01
    provides: "migration 0013 — frequencia_visita_enum, clientes.frequencia_visita nullable column, mover_card_funil extended with p_frequencia_visita (6th param, required guard when status=ganho)"
provides:
  - "lib/funil/frequencia.ts — single vocabulary source for the 4 frequência values (FREQUENCIAS_VISITA, FrequenciaVisita, FREQUENCIA_VISITA_LABELS, FREQUENCIA_VISITA_ITEMS, isFrequenciaVisita), reusable by Phases 14-17"
  - "GanhoFrequenciaDialog — captures frequência de visita before a card can be marked ganho, wired into ClienteDetailSheet's Status select"
  - "ClienteDetalhe.frequenciaVisita — read from the same select() as the rest of the ficha, no extra query"
affects: [13-03, 14, 15, 16, 17]

tech-stack:
  added: []
  patterns:
    - "Fixed-vocabulary modules (etapas.ts, now frequencia.ts) stay import-pure (no next/react/@supabase) so both a Client Component and a Server Action can import the same source of truth without leaking server-only code into the client bundle"

key-files:
  created:
    - lib/funil/frequencia.ts
    - components/clientes/GanhoFrequenciaDialog.tsx
    - tests/clientes/ganho-frequencia-dialog.test.tsx
  modified:
    - lib/supabase/queries/clientes.ts
    - app/actions/funil.ts
    - components/clientes/ClienteDetailSheet.tsx

key-decisions:
  - "GanhoFrequenciaDialog mirrors PerdaMotivoDialog's structure but with two deliberate deviations (both locked in 13-UI-SPEC.md): no async load (options are a static, pure vocabulary — no useEffect, no loading/error state) and the confirm button uses the default/primary Button variant, never destructive, since marking ganho is a positive outcome."
  - "marcarStatus's frequência precheck is a UX courtesy only — the real, unbypassable guard is the mover_card_funil RPC from migration 0013. Passing p_frequencia_visita=null outside the ganho case is required so the RPC's coalesce preserves the existing value instead of erasing it."
  - "handleStatusChange updates local frequenciaVisita state only when the new status is ganho; other status changes preserve the previous value in state, mirroring the RPC's own coalesce so client state never diverges from the DB (ATV-03)."

patterns-established: []

requirements-completed: [VIS-01]

coverage:
  - id: D1
    description: "Escolher 'Ganho' no Select de Status abre o diálogo de frequência antes de qualquer gravação; cancelar não grava nada"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx — desabilitado, cancelar cases"
        status: pass
    human_judgment: true
    rationale: "O fluxo completo (abrir Select → escolher Ganho → diálogo aparece → escolher frequência → confirmar → grava no RPC) precisa de confirmação visual ao vivo — fica para o checkpoint humano do plano 13-03."
  - id: D2
    description: "Botão de confirmar nasce desabilitado e usa a variante primária, não a destrutiva"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx — desabilitado, variante cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vocabulário das quatro frequências existe em um único módulo, na ordem travada"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx — vocabulario case"
        status: pass
    human_judgment: false
  - id: D4
    description: "Copy do diálogo bate literalmente com o Copywriting Contract do UI-SPEC"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx — copy case + structural node-eval check in the plan's own verify command"
        status: pass
    human_judgment: false

duration: "~40min (interrupted once by a session usage-limit reset mid-Task-1; resumed and completed without re-doing any work)"
completed: 2026-08-07
status: complete
---

# Phase 13 Plan 02: Diálogo de Frequência ao Marcar Ganho Summary

**Marcar um cliente como "Ganho" agora abre um diálogo pedindo a frequência de visita antes de gravar qualquer coisa — a mesma cadência que a Fase 13-01 passou a exigir no banco.**

## Performance

- **Duration:** ~40min
- **Tasks:** 2/2
- **Files modified:** 6 (3 novos, 3 editados)

## Accomplishments
- `lib/funil/frequencia.ts` — módulo único de vocabulário das 4 frequências, puro (sem import de next/react/supabase), reusado tanto pelo diálogo quanto pela Server Action.
- `ClienteDetalhe.frequenciaVisita` lido no mesmo `select()` que já busca o resto da ficha, sem query extra.
- `marcarStatus` estendido com o 4º parâmetro `frequenciaVisita`, pré-checagem amigável (`frequencia_obrigatoria`) e envio condicional de `p_frequencia_visita` ao RPC.
- `GanhoFrequenciaDialog` novo, espelhando `PerdaMotivoDialog` com duas diferenças propositais (sem carregamento assíncrono, botão de confirmar na variante primária).
- `ClienteDetailSheet.tsx` ligado: `handleStatusSelect` abre o diálogo antes de gravar, `handleStatusChange` leva a frequência até o RPC e atualiza o estado local sem recarregar a ficha.
- 5 testes de render novos, todos verdes.

## Task Commits

1. **Task 1: Vocabulário + leitura + passagem ao RPC** — `184aea9`
2. **Task 2: GanhoFrequenciaDialog + ligação ao Select de Status** — `211a421`

## Files Created/Modified
- `lib/funil/frequencia.ts` — vocabulário único das frequências
- `components/clientes/GanhoFrequenciaDialog.tsx` — diálogo novo
- `lib/supabase/queries/clientes.ts` — `frequenciaVisita` em `ClienteDetalhe` + coluna no `select()`
- `app/actions/funil.ts` — `marcarStatus` estendido
- `components/clientes/ClienteDetailSheet.tsx` — ramo `ganho`, estado `ganhoDialogOpen`, render do diálogo
- `tests/clientes/ganho-frequencia-dialog.test.tsx` — teste de render novo

## Decisions Made
- Nenhuma decisão de produto nova — este plano só liga a UI ao guard que a Fase 13-01 já tinha estabelecido no banco.

## Issues Encountered

**Interrupção por limite de sessão durante o Task 1.** A execução original parou no meio da edição de `app/actions/funil.ts`, com `lib/funil/frequencia.ts` já criado e `lib/supabase/queries/clientes.ts` já editado, ambos sem commit. Ao retomar, confirmei que o trabalho parcial batia exatamente com o que o plano pedia (nenhuma linha precisou ser refeita), rodei a verificação estrutural do Task 1 (`tsc`/`eslint` limpos), commitei, e segui pro Task 2 normalmente.

**Assertion do teste `variante` precisou de ajuste.** A primeira versão checava `not.toContain("destructive")` na className do botão, mas a classe base do `Button` sempre carrega tokens `destructive` para o estado `aria-invalid`, independente da variante escolhida — o teste falhava mesmo com a variante certa. Corrigido para checar especificamente `bg-destructive` (a classe que só aparece quando `variant="destructive"` é passado), que é o marcador real da variante.

## User Setup Required

None — nenhuma configuração externa necessária.

## Next Phase Readiness
- Plano 13-03 (controle permanente de frequência na ficha) pode começar: o vocabulário, a leitura de `frequenciaVisita` e a atualização de estado local após o ganho já estão prontos pra ele consumir.
- A verificação visual completa do fluxo (abrir Select, escolher Ganho, ver o diálogo, confirmar, ver a mudança refletida) fica marcada para o checkpoint humano do plano 13-03, que já cobre o fluxo de ponta a ponta desta fase.

---
*Phase: 13-cliente-ativo-e-frequ-ncia-de-visita*
*Plan: 02*
*Completed: 2026-08-07*
