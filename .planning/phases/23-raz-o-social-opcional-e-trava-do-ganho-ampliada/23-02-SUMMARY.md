---
phase: 23-raz-o-social-opcional-e-trava-do-ganho-ampliada
plan: 02
subsystem: ui
tags: [server-actions, react, vitest, funil, ganho]

# Dependency graph
requires:
  - phase: 23-01
    provides: "guard PL/pgSQL de mover_card_funil (migration 0025) exigindo razão social e endereço completo na TRANSIÇÃO para ganho, com grandfathering — este plano é o lado da mensagem na tela"
provides:
  - "lib/funil/fichaParaGanho.ts — módulo puro, autoridade única do lado TypeScript de 'quais campos faltam para o ganho', espelhando campo por campo o guard PL/pgSQL da migration 0025"
  - "marcarStatus (app/actions/funil.ts) devolvendo o código ficha_incompleta com mensagem nomeando os campos faltando, na TRANSIÇÃO para ganho, antes de deixar a exceção do Postgres cair crua na tela"
affects: [25-import-a-o-de-clientes-ativos, 26-import-a-o-de-clientes-em-prospec-o-e-limpeza-de-menu]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pré-checagem cortesia/backstop: mesma forma das pré-checagens de frequência/CNPJ já existentes em marcarStatus — só dispara na TRANSIÇÃO (status atual != 'ganho'), o guard REAL continua sendo o RPC"
    - "Módulo puro dependency-free (sem Supabase/Next/React) como autoridade única de uma regra de negócio compartilhada entre TypeScript e PL/pgSQL, mesmo molde de lib/clientes/completude.ts"

key-files:
  created:
    - lib/funil/fichaParaGanho.ts
    - tests/clientes/ficha-para-ganho.test.ts
  modified:
    - app/actions/funil.ts
    - tests/clientes/ganho-frequencia-dialog.test.tsx

key-decisions:
  - "GanhoFrequenciaDialog.tsx não foi tocado (D-03) — já exibia result.error.message como alerta e mantinha a caixinha aberta; a mensagem nova reaproveita esse comportamento sem nenhuma edição de componente"
  - "camposFaltandoParaGanho() lê os 6 campos em nomes de coluna do banco (razao_social/cep/rua/numero/cidade/estado), sem tradução no meio, para vir direto do select do Supabase"
  - "Um campo conta como faltando quando nulo OU, aparado, texto vazio — mesma regra do guard PL/pgSQL; complemento fica de fora nos dois lados (D-04)"
  - "A pré-checagem nova em marcarStatus fica depois da pré-checagem de CNPJ, espelhando a ordem dos guards dentro do RPC (guard de CNPJ antes dos guards novos de razão social/endereço na migration 0025)"

requirements-completed: [GANHO-01, GANHO-03]

coverage:
  - id: D1
    description: "Tentar marcar como ganho um cliente com ficha incompleta mostra mensagem orientando completar a ficha e nomeando exatamente os campos faltando"
    requirement: GANHO-01
    verification:
      - kind: unit
        ref: "tests/clientes/ficha-para-ganho.test.ts#camposFaltandoParaGanho e mensagemFichaIncompleta (13 casos)"
        status: pass
      - kind: automated_ui
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx#fichaincompleta (GANHO-01, 23-02): confirmação devolvendo erro de ficha incompleta mostra a mensagem como alerta e a caixinha não fecha"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3) — dono do projeto confirmou no navegador: bloqueio com mensagem citando 'cidade' apareceu, e após completar a cidade o ganho funcionou normalmente"
        status: pass
    human_judgment: false
  - id: D2
    description: "A caixinha de marcar ganho continua com exatamente dois campos (Frequência de visita e CNPJ) — nenhum campo de razão social/endereço foi acrescentado"
    requirement: GANHO-03
    verification:
      - kind: automated_ui
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx#formadacaixinha (GANHO-03, 23-02): a caixinha tem exatamente um campo de texto e os dois rótulos de sempre"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3) — dono do projeto confirmou: caixinha aberta com só Frequência+CNPJ (2 campos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Um cliente que já é ganho nunca é cobrado por esta pré-checagem (grandfathering, mesma condição do guard do banco)"
    requirement: GANHO-02
    verification:
      - kind: unit
        ref: "app/actions/funil.ts — pré-checagem condicionada a cliente.status_acompanhamento !== 'ganho', mesma condição literal do guard PL/pgSQL (migration 0025)"
        status: pass
    human_judgment: true
    rationale: "A condição de transição foi provada por teste de integração contra o banco real no plano 23-01 (ganho-ficha-completa.test.ts, Bloco C). Este plano só replica a mesma condição do lado TypeScript sem cobertura de integração própria (nenhuma conta de vendedor seed disponível — ver STATE.md Blockers), por isso marcado para revisão humana."

# Metrics
duration: ~20min (Tasks 1-2 automáticas) + pausa para checkpoint humano (Task 3)
completed: 2026-08-26
status: complete
---

# Phase 23 Plan 2: Razão Social Opcional e Trava do Ganho Ampliada (Mensagem na Tela) Summary

**`marcarStatus` bloqueia a transição para ganho com uma mensagem que nomeia os campos faltando na ficha (razão social e/ou endereço), sem acrescentar nenhum campo à caixinha de marcar ganho**

## Performance

- **Duration:** ~20min de execução automática (Tasks 1-2) + pausa para o checkpoint humano da Task 3 (verificação no navegador)
- **Started:** 2026-08-26T09:53:00Z (aprox.)
- **Completed:** 2026-08-26T10:15:00Z (aprox.)
- **Tasks:** 3/3 (2 automáticas + 1 checkpoint humano aprovado)
- **Files modified:** 4 (2 novos, 2 editados)

## Accomplishments
- `lib/funil/fichaParaGanho.ts` criado — módulo puro, sem import de Supabase/Next/React, autoridade única do lado TypeScript de "quais campos faltam para o cliente virar ganho": `camposFaltandoParaGanho()` decide a lista de rótulos faltando (razão social, CEP, rua, número, cidade, estado, nessa ordem fixa; `complemento` fora de propósito) e `mensagemFichaIncompleta()` monta a mensagem para o vendedor
- `marcarStatus` (`app/actions/funil.ts`) ampliou a consulta prévia (mesma consulta, sem leitura extra) para trazer razão social e os 5 campos de endereço, ganhou o código de erro `ficha_incompleta`, e passou a bloquear com mensagem específica só na TRANSIÇÃO para ganho (grandfathering, GANHO-02) e só quando a ficha realmente está incompleta
- `GanhoFrequenciaDialog.tsx` **não foi editado** — já exibia `result.error.message` como alerta e mantinha a caixinha aberta; a mensagem nova aparece sem nenhuma mudança de componente, confirmando GANHO-03 mecanicamente (contador de `<Input>`=1 e `<Label>`=2 inalterado)
- Checkpoint humano (Task 3) aprovado: bloqueio no navegador mostrou a mensagem citando "cidade", a caixinha permaneceu com só dois campos, e depois de completar o endereço o ganho funcionou normalmente

## Task Commits

Each task was committed atomically:

1. **Task 1: Módulo puro que decide o que falta na ficha para o ganho** - `07adfe3` (test)
2. **Task 2: marcarStatus devolve o bloqueio explicado, e a caixinha de ganho continua do mesmo tamanho** - `b16b415` (feat)
3. **Task 3: Conferência no navegador — bloqueio explicado e caixinha do mesmo tamanho** - checkpoint humano, aprovado pelo dono do projeto (sem commit de código)

**Plan metadata:** (este commit)

## Files Created/Modified
- `lib/funil/fichaParaGanho.ts` - módulo puro: `camposFaltandoParaGanho()` + `mensagemFichaIncompleta()`, autoridade TypeScript única espelhando o guard PL/pgSQL da migration 0025
- `tests/clientes/ficha-para-ganho.test.ts` - 13 casos: ficha completa, cada campo isolado (inclusive os 5 de endereço via `it.each`), whitespace conta como ausência, ordem fixa, `complemento` fora, mensagem com/sem lista
- `app/actions/funil.ts` - `marcarStatus`: select amplia para 9 colunas (era 3), código `ficha_incompleta` novo, pré-checagem nova depois da de CNPJ
- `tests/clientes/ganho-frequencia-dialog.test.tsx` - 2 casos novos: bloqueio mostra alerta e caixinha não fecha; forma da caixinha (1 `<Input>`, 2 `<Label>`, nenhum campo de razão social/CEP/rua/número/cidade/estado)

## Decisions Made
- `GanhoFrequenciaDialog.tsx` ficou intocado por decisão de design travada no plano (D-03) — confirmado lendo o componente antes de editar qualquer coisa, exatamente como a plano instruiu
- A pré-checagem nova em `marcarStatus` foi posicionada depois da pré-checagem de CNPJ, espelhando a ordem dos guards dentro do RPC (guard de CNPJ antes dos guards de razão social/endereço na migration 0025) — tela e banco reclamam do mesmo campo primeiro
- Um único `select` continua trazendo todas as colunas necessárias (nenhuma segunda consulta) — mesma disciplina já estabelecida pelas pré-checagens de frequência/CNPJ

## Deviations from Plan

None - plan executado exatamente como escrito. Os quatro contadores mecânicos de verificação da Task 2 bateram no primeiro try (`ficha_incompleta` ≥2, `razao_social` ≥1, 1 `<Input>`, 2 `<Label>`), `npx tsc --noEmit` e `eslint app components lib` limpos, e os 25 testes relevantes (13 novos + 12 do arquivo do diálogo) passaram verdes.

Nota sobre o script de verificação usado no checkpoint humano: `npx next lint --dir app --dir components --dir lib` (comando literal do plano) não existe mais nesta versão do Next.js (`next lint` foi removido; o projeto já usa `npm run lint` → `eslint` direto). Rodei `npx eslint app components lib` como equivalente funcional — mesmo lint, mesma config, sem achados.

## Issues Encountered

Durante o checkpoint humano (Task 3), o dono do projeto criou um cliente de teste ("Teste Verificacao 23-02 LTDA", id `b52a41f0-9d73-4378-a05e-cc10c82f4c16`) via script service-role para a verificação manual. Tentei apagá-lo eu mesmo via `serviceClient()` (mesmo helper que `tests/helpers/supabase-test-clients.ts` já usa em dezenas de suítes), mas a execução foi bloqueada pelo classificador de permissão do ambiente (ação de banco fora do escopo de teste automatizado). Não tentei contornar o bloqueio.

**Pendência:** o cliente de teste `b52a41f0-9d73-4378-a05e-cc10c82f4c16` ("Teste Verificacao 23-02 LTDA") pode ainda existir no banco de produção. Precisa ser apagado manualmente (pelo dono do projeto, direto no Supabase Studio, ou por um agente com permissão de execução de script service-role) antes de considerar o marco v1.6 fechado.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

**Ação pendente do dono do projeto:** apagar o cliente de teste `b52a41f0-9d73-4378-a05e-cc10c82f4c16` ("Teste Verificacao 23-02 LTDA") criado durante a verificação da Task 3, se ainda existir.

## Next Phase Readiness
- Fase 23 completa: GANHO-01, GANHO-02 e GANHO-03 fechados entre os planos 23-01 (guard no banco) e 23-02 (mensagem na tela).
- Fase 25 (`importar_clientes_ativos_lote`) precisa copiar os dois guards de razão social/endereço verbatim (referência cruzada já registrada no cabeçalho da migration 0025) — a importação de ativos faz INSERT direto, sem passar por `mover_card_funil` nem por esta pré-checagem de `marcarStatus`.
- Pendência não resolvida por este plano (fora de escopo): contas seed de teste (`vendedor.a+test`/`vendedor.b+test`) continuam apagadas, mesma limitação já documentada no plano 23-01 e em STATE.md Deferred Items — D3 do bloco `coverage` acima foi marcado `human_judgment: true` por essa razão.

---
*Phase: 23-raz-o-social-opcional-e-trava-do-ganho-ampliada*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: lib/funil/fichaParaGanho.ts
- FOUND: tests/clientes/ficha-para-ganho.test.ts
- FOUND: app/actions/funil.ts
- FOUND: tests/clientes/ganho-frequencia-dialog.test.tsx
- FOUND: commit 07adfe3
- FOUND: commit b16b415
