---
phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu
plan: 01
subsystem: database
tags: [postgres, supabase, rpc, migration]

# Dependency graph
requires:
  - phase: 25-importa-o-de-clientes-ativos
    provides: "importar_clientes_ativos_lote (migration 0027), a nova planilha que substitui o caso de uso das duas RPCs removidas aqui"
provides:
  - "Migration 0028 aplicada em produção — atualizar_cnpj_lote e atualizar_frequencia_visita_lote não existem mais no banco"
  - "Confirmação de que importar_clientes_lote e importar_clientes_ativos_lote continuam intactas pós-push"
affects: [26-04-limpeza-de-menu]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - supabase/migrations/0028_remover_atualizar_cnpj_e_frequencia_lote.sql
  modified: []

key-decisions:
  - "Remoção via drop function if exists com assinatura completa (p_atualizacoes jsonb) em cada função, seguindo a disciplina já documentada na migration 0018 — remoção sem assinatura seria ambígua"
  - "Os dois testes de integração ao vivo dessas funções (rls-cnpj-lote.test.ts, rls-frequencia-lote.test.ts) foram deletados por serem os únicos arquivos de teste que as exercitavam"
  - "Arquivos de tela/rota/ação das duas planilhas antigas (app/actions/importacaoCnpj.ts, app/actions/importacaoFrequencia.ts, etc.) deliberadamente não tocados — responsabilidade do plano 26-04"

requirements-completed: [MENU-01, MENU-02]

coverage:
  - id: D1
    description: "Migration 0028 remove atualizar_cnpj_lote e atualizar_frequencia_visita_lote do banco, sem tocar em nenhuma outra função"
    requirement: "MENU-01"
    verification:
      - kind: other
        ref: "checagem mecânica do plano (grep sobre o arquivo): 2 drop function if exists, 2 ocorrências de p_atualizacoes jsonb, 0 create, 0 menções a importar_clientes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Testes de integração ao vivo das duas funções removidas apagados; nenhum arquivo em tests/ ainda cita as funções"
    requirement: "MENU-02"
    verification:
      - kind: other
        ref: "grep -rl sobre tests/ para atualizar_cnpj_lote e atualizar_frequencia_visita_lote — 0 ocorrências"
        status: pass
    human_judgment: false
  - id: D3
    description: "Migration 0028 aplicada em produção via supabase db push; conferência pós-push confirma que as duas funções órfãs sumiram e as duas RPCs de importação em uso continuam existindo"
    verification:
      - kind: manual_procedural
        ref: "Dono do projeto chamou as 4 funções via RPC diretamente: importar_clientes_lote e importar_clientes_ativos_lote existem (erro de permissão esperado sem sessão de supervisor); atualizar_cnpj_lote e atualizar_frequencia_visita_lote retornam 'Could not find the function'"
        status: pass
    human_judgment: true
    rationale: "Escrita de schema em produção; confirmação depende do dono do projeto rodar o push com credencial de administrador, convenção já estabelecida nas Fases 18/19/24/25"

# Metrics
duration: ~10min (Tasks 1-2) + pausa de checkpoint até aprovação do push
completed: 2026-08-26
status: complete
---

# Phase 26 Plan 1: Drop das RPCs órfãs (CNPJ e frequência em massa) Summary

**Migration 0028 removeu do banco de produção `atualizar_cnpj_lote` e `atualizar_frequencia_visita_lote` — as duas RPCs de gravação em massa que a planilha "Importar Clientes Ativos" da Fase 25 tornou redundantes — junto com os dois únicos testes de integração que as exercitavam.**

## Performance

- **Duration:** ~10min (Tasks 1-2, execução automática) + pausa de checkpoint até o dono do projeto aplicar o push e confirmar
- **Started:** 2026-08-26T22:40:00-03:00 (aprox.)
- **Completed:** 2026-08-26 (aprovação do checkpoint)
- **Tasks:** 3 (2 auto + 1 checkpoint human-action)
- **Files modified:** 3 (1 criado, 2 removidos)

## Accomplishments
- Migration 0028 escrita e commitada, removendo `atualizar_cnpj_lote(p_atualizacoes jsonb)` e `atualizar_frequencia_visita_lote(p_atualizacoes jsonb)` por assinatura completa, com `if exists` e zero instruções de criação
- Os dois testes de integração ao vivo dessas funções (`tests/importacao/rls-cnpj-lote.test.ts`, `tests/importacao/rls-frequencia-lote.test.ts`) removidos — eram os únicos arquivos da suíte que as citavam
- Push aplicado em produção pelo dono do projeto; conferência via chamada RPC direta às 4 funções confirmou o resultado esperado: as duas RPCs de importação (`importar_clientes_lote`, `importar_clientes_ativos_lote`) continuam existindo, e as duas RPCs órfãs não existem mais ("Could not find the function")

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0028 — remover as duas funções de gravação em massa órfãs** - `6e8e0d3` (feat)
2. **Task 2: Remover os dois testes de integração ao vivo das funções apagadas** - `f2a4a51` (test)
3. **Task 3: Checkpoint humano — push em produção** - sem commit de código (ação do dono do projeto fora deste repositório de execução); aprovado com "aprovado" após conferência via RPC

**Plan metadata:** (a ser criado neste commit final)

## Files Created/Modified
- `supabase/migrations/0028_remover_atualizar_cnpj_e_frequencia_lote.sql` - migration nova, aditiva, com exatamente 2 remoções condicionais de função
- `tests/importacao/rls-cnpj-lote.test.ts` - removido (testava apenas a função apagada)
- `tests/importacao/rls-frequencia-lote.test.ts` - removido (testava apenas a função apagada)

## Decisions Made
- Remoção usa assinatura completa `(p_atualizacoes jsonb)` em cada `drop function if exists`, seguindo a disciplina já documentada na migration 0018 do projeto (remoção sem assinatura é ambígua e pode atingir a sobrecarga errada)
- Migrations 0017 e 0020 (já aplicadas em produção) permanecem byte a byte inalteradas — confirmado por `git diff --stat` vazio para ambas
- Arquivos de tela/rota/ação das duas planilhas antigas (`app/actions/importacaoCnpj.ts`, `app/actions/importacaoFrequencia.ts` e afins) deliberadamente não tocados nesta plano — ficam para o plano 26-04, evitando deixar o projeto sem compilar entre os dois planos

## Deviations from Plan

None - plano executado exatamente como escrito. O dono do projeto verificou o resultado do push chamando as 4 funções via RPC diretamente em vez de rodar a consulta SQL sugerida (`select proname from pg_proc where ...`) no SQL Editor — método diferente, mesmo resultado exigido pelo plano (as duas RPCs de importação existem; as duas RPCs órfãs não existem mais), portanto tratado como equivalente ao critério de `resume-signal`, não como desvio.

## Issues Encountered
None.

## User Setup Required
None - nenhuma configuração de serviço externo necessária. A única ação externa (aplicar a migration em produção) já foi executada e confirmada pelo dono do projeto durante este plano (Task 3).

## Next Phase Readiness
- Banco de produção está no estado esperado: `atualizar_cnpj_lote` e `atualizar_frequencia_visita_lote` não existem mais; `importar_clientes_lote` e `importar_clientes_ativos_lote` continuam funcionando
- O plano 26-04 (limpeza de menu) pode agora remover com segurança as telas/rotas/ações das duas planilhas antigas, sabendo que a camada de banco já não as expõe mais
- Nenhum bloqueio identificado

---
*Phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: supabase/migrations/0028_remover_atualizar_cnpj_e_frequencia_lote.sql
- CONFIRMED DELETED: tests/importacao/rls-cnpj-lote.test.ts
- CONFIRMED DELETED: tests/importacao/rls-frequencia-lote.test.ts
- FOUND commit: 6e8e0d3
- FOUND commit: f2a4a51
