---
phase: 29-encerrar-cliente-ativo
plan: 05
subsystem: api
tags: [supabase, server-actions, rls, pagination, react, configuracoes]

# Dependency graph
requires:
  - phase: 29-encerrar-cliente-ativo (plano 29-01)
    provides: "migration 0036 — RPC clientes_encerrados(p_inicio, p_fim) e tabela motivos_encerramento (RLS 4-policy, is_supervisor() na escrita)"
provides:
  - "lib/encerrados/lista.ts: tipo ClienteEncerrado (7 campos), presets de período, resolvePeriodoEncerrados, validarPeriodoEncerrados, filtrarEncerradosPorNome"
  - "lib/supabase/queries/encerrados.ts: getClientesEncerrados (leitor paginado sobre a RPC) e getMotivosEncerramentoAtivos"
  - "app/actions/encerrados.ts: getClientesEncerradosAction e getMotivosEncerramento (Server Actions)"
  - "7ª lista editável (motivos_encerramento) registrada em ListaTabela e na aba 'Motivos de encerramento' de Configurações"
affects: [29-06, 29-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Camada de dados de tela como módulo irmão deliberado (não generalização) do mesmo padrão da Fase 28 — mesmo formato período/validação/busca/leitor/Server Action, zero import cruzado entre Perdidos e Encerrados"
    - "RLS como única fronteira de autorização no leitor/Server Action (nenhuma checagem de papel/dono no código)"

key-files:
  created:
    - lib/encerrados/lista.ts
    - lib/supabase/queries/encerrados.ts
    - app/actions/encerrados.ts
    - tests/funil/encerrados-lista.test.ts
    - tests/funil/encerrados-query.test.ts
  modified:
    - app/actions/listas.ts
    - components/configuracoes/ConfiguracoesTabs.tsx
    - tests/configuracoes/configuracoes-tabs.test.tsx

key-decisions:
  - "Nenhuma ação de reativar criada neste plano (D-10) — a tela vai reusar marcarStatus já existente em app/actions/funil.ts"
  - "'Motivos de encerramento' entra na aba de Configurações logo depois de 'Motivos de perda' (exceção deliberada à ordem 'mais nova por último', por serem listas irmãs de saída de rotina)"

patterns-established:
  - "Módulos irmãos por tela (lib/<tela>/lista.ts + lib/supabase/queries/<tela>.ts + app/actions/<tela>.ts) em vez de generalização entre telas parecidas"

requirements-completed: [ENCR-02, ENCR-04, ENCR-05]

coverage:
  - id: D1
    description: "Camada pura de período/validação/busca da tela Encerrados (ClienteEncerrado de 7 campos, presets, resolvePeriodoEncerrados, validarPeriodoEncerrados, filtrarEncerradosPorNome)"
    requirement: "ENCR-05"
    verification:
      - kind: unit
        ref: "tests/funil/encerrados-lista.test.ts (28 casos: presets, tudo, 30dias, 90dias, personalizado, personalizado-sem-intervalo, recorte, validacao, busca)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Leitor paginado getClientesEncerrados sobre a RPC clientes_encerrados e catálogo getMotivosEncerramentoAtivos, escopados só pela RLS"
    requirement: "ENCR-05"
    verification:
      - kind: unit
        ref: "tests/funil/encerrados-query.test.ts (leitor-rpc, leitor-mapeamento, leitor-paginado, leitor-erro, motivos-ativos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Server Actions getClientesEncerradosAction (sessão + validação de período antes do banco) e getMotivosEncerramento, sem checagem de papel/dono"
    requirement: "ENCR-04"
    verification:
      - kind: unit
        ref: "tests/funil/encerrados-query.test.ts (acao-sem-sessao, acao-periodo-invalido, acao-ok, acao-falha, motivos-sem-sessao)"
        status: pass
    human_judgment: false
  - id: D4
    description: "7ª lista editável 'motivos_encerramento' registrada em ListaTabela e como aba 'Motivos de encerramento' em Configurações, logo depois de 'Motivos de perda'"
    requirement: "ENCR-02"
    verification:
      - kind: unit
        ref: "tests/configuracoes/configuracoes-tabs.test.tsx (seteabas, ordem, ligada)"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-09-26
status: complete
---

# Phase 29 Plan 05: Camada de Dados da Tela Encerrados Summary

**Leitor paginado + Server Actions da tela Encerrados sobre a RPC `clientes_encerrados` (29-01), com módulo puro de período/validação/busca irmão do de Perdidos (Fase 28), e a 7ª lista editável (`motivos_encerramento`) registrada em Configurações.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-26T17:24:27Z (aprox. — logo após o wrap-up da Wave 1)
- **Completed:** 2026-09-26T17:32:48-03:00
- **Tasks:** 3/3
- **Files modified:** 8 (5 criados, 3 alterados)

## Accomplishments

- Módulo puro `lib/encerrados/lista.ts` com o tipo `ClienteEncerrado` (7 campos exatos, sem meio de comunicação — LGPD), presets de período (Tudo/30 dias/90 dias/Personalizado), `resolvePeriodoEncerrados`/`validarPeriodoEncerrados`/`filtrarEncerradosPorNome` — irmão deliberado de `lib/perdidos/lista.ts`, sem nenhum import cruzado (Pitfall 4 da pesquisa).
- Leitor paginado `getClientesEncerrados` sobre a RPC `clientes_encerrados` (ordem `encerrado_em desc, cliente_id asc`, páginas de 1000 via `buscarPaginado`) e catálogo `getMotivosEncerramentoAtivos`, ambos escopados só pela RLS — nenhuma checagem de papel ou filtro de dono no código.
- Server Actions `getClientesEncerradosAction` (checa sessão → valida período → delega ao leitor → mapeia erro para `fetch_falhou`) e `getMotivosEncerramento`, sem nenhuma ação de reativar paralela (D-10 — a tela reusará `marcarStatus` já existente).
- 7ª lista editável (`motivos_encerramento`) registrada nos 2 lugares de código restantes: união `ListaTabela` e aba "Motivos de encerramento" em `ConfiguracoesTabs.tsx`, logo ao lado de "Motivos de perda" (o 3º lugar, a migration, já veio pronto do plano 29-01).

## Task Commits

Cada tarefa TDD gerou um commit RED (test) e um GREEN (feat):

1. **Tarefa 1: Módulo puro lib/encerrados/lista.ts** — `1c296d9` (test, RED) → `b18fc59` (feat, GREEN)
2. **Tarefa 2: Leitor paginado + Server Actions** — `36dbcd4` (test, RED) → `0a7f01f` (feat, GREEN)
3. **Tarefa 3: 7ª lista editável em Configurações** — `743b7d2` (test, RED) → `9ff00c4` (feat, GREEN)

_Nenhum arquivo fora dos 8 declarados em `files_modified` foi tocado (conferido com `git diff --stat` sobre o range dos 6 commits deste plano)._

## Files Created/Modified

- `lib/encerrados/lista.ts` - Camada pura: tipo ClienteEncerrado, presets/resolução/validação de período, busca por nome
- `lib/supabase/queries/encerrados.ts` - getClientesEncerrados (paginado, RPC) e getMotivosEncerramentoAtivos
- `app/actions/encerrados.ts` - getClientesEncerradosAction e getMotivosEncerramento ("use server")
- `app/actions/listas.ts` - ListaTabela ganha "motivos_encerramento"
- `components/configuracoes/ConfiguracoesTabs.tsx` - 7ª aba "Motivos de encerramento"
- `tests/funil/encerrados-lista.test.ts` - 28 testes do módulo puro
- `tests/funil/encerrados-query.test.ts` - 14 testes do leitor + Server Actions + catálogo
- `tests/configuracoes/configuracoes-tabs.test.tsx` - Atualizado de 6 para 7 abas (seteabas/ordem/ligada)

## Decisions Made

- Nenhuma ação de reativar foi criada em `app/actions/encerrados.ts` (D-10) — comentário de cabeçalho registra explicitamente que a tela deve chamar `marcarStatus` (app/actions/funil.ts) já existente, para ninguém criar uma ação paralela depois.
- "Motivos de encerramento" entra na aba de Configurações logo depois de "Motivos de perda", não por último — decisão discricionária documentada no doc-comment do componente, por serem listas irmãs (ambas explicam por que um cliente saiu da rotina).

## Deviations from Plan

None - plan executado exatamente como escrito. Um ajuste cosmético foi feito durante a Tarefa 2: o doc-comment inicial de `app/actions/encerrados.ts` citava literalmente o caminho `app/actions/perdidos.ts`, o que disparava falso-positivo no grep de acceptance criteria do Pitfall 4 (que não distingue comentário de import). Reescrito para citar a Fase 28 por nome sem o caminho literal do arquivo — sem mudança de comportamento, só de texto do comentário; não é um desvio de Regra 1-4 (nenhum código mudou), documentado aqui por transparência.

## Issues Encountered

None.

## Migration 0036 — Status

Este plano NÃO toca o banco (nenhum teste chama Supabase real — tudo mockado, conforme o `<objective>` do plano). A migration 0036 (RPC `clientes_encerrados` + tabela `motivos_encerramento`) é responsabilidade do plano 29-01 (já completo no nível de código) e da sua aplicação em produção, que está em andamento em paralelo no plano 29-03 (checkpoint humano). Nenhuma tarefa deste plano ficou blocked-pending-29-03 — todas as 3 tarefas são unit/mocked e não dependem da migration estar viva.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Contrato publicado exatamente como o bloco `<interfaces>` do plano: `ClienteEncerrado`, `IntervaloEncerrados`, `resolvePeriodoEncerrados`, `validarPeriodoEncerrados`, `filtrarEncerradosPorNome`, `getClientesEncerradosAction`, `getMotivosEncerramento` — pronto para os planos 29-06 (tela Encerrados) e 29-07 (diálogo de encerrar).
- Bloqueio real antes da tela ir para produção: a migration 0036 precisa estar aplicada (plano 29-03) para a RPC `clientes_encerrados` e a tabela `motivos_encerramento` existirem de fato — sem isso, `getClientesEncerradosAction`/`getMotivosEncerramento` falham em runtime real (mas isso é esperado e já rastreado pelo 29-03, não uma pendência deste plano).

## Self-Check: PASSED

All 8 files_modified paths + this SUMMARY.md confirmed present on disk. All 6 task commit hashes (1c296d9, b18fc59, 36dbcd4, 0a7f01f, 743b7d2, 9ff00c4) confirmed in `git log`.

---
*Phase: 29-encerrar-cliente-ativo*
*Completed: 2026-09-26*
