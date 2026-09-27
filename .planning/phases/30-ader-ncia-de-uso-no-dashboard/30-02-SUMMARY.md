---
phase: 30-ader-ncia-de-uso-no-dashboard
plan: 02
subsystem: database
tags: [postgres, rls, sql, supabase, lgpd, vitest]

# Dependency graph
requires:
  - phase: 30-01
    provides: "acessos_diarios (2 colunas) + registrar_acesso_diario() RPC; profiles.desativado_em/reativado_em"
provides:
  - "dashboard_aderencia_uso() — leitura agregada read-only (language sql stable, sem elevação de privilégio) do percentual de aderência de uso por vendedor nos últimos 28 dias"
  - "18 testes de integração (RED) provando janela de dias úteis, união de sinais sem duplicar, fuso de São Paulo, proporção por admissão/lacuna de desativação, aviso de coleta e trava de Supervisor"
affects: ["30-03 (checkpoint do dono, aplica 0038→0039→0040)", "30-05 (lib/supabase/queries/dashboard.ts#getAderenciaUso consome esta RPC)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Função dashboard_* separada e unida na camada de consulta em vez de estender uma função já em produção (dashboard_comparativo_vendedor, migration 0011, permanece intocada)"
    - "Filtro (select is_supervisor()) dentro de uma função dashboard_* — exceção deliberada à convenção geral, necessária porque profiles tem leitura aberta e a tabela de origem (acessos_diarios) por si só não bastaria para esconder a linha agregada de um Vendedor"
    - "União (não union all) de duas fontes de sinal de uso para dedupe automático do mesmo dia, sem lógica de deduplicação em código"

key-files:
  created:
    - supabase/migrations/0040_dashboard_aderencia_uso.sql
    - tests/dashboard/aderencia-uso.test.ts
  modified: []

key-decisions:
  - "dashboard_aderencia_uso() é função nova e separada, nunca uma extensão de dashboard_comparativo_vendedor() — evita regressão de VEND-01 já em produção; a junção dos dois resultados por responsavel acontece na camada de consulta (plano 30-05), nunca no banco"
  - "Testes criam e destroem 7 vendedores de fixture (não 2-3 como o padrão usual do projeto) — beforeAll precisou ser paralelizado (Promise.all) e ganhar timeout explícito de 60s, porque a criação sequencial de 8 membros + toda a semeadura estourava o hookTimeout padrão de 10s do Vitest"
  - "Helpers de seedAcesso/tentarDefinirCarimbos (tabela acessos_diarios e colunas desativado_em/reativado_em) são melhor esforço, sem lançar exceção — essas duas migrations (0038/0039) ainda não existem no banco até o 30-03, e uma falha aí não deve derrubar a suíte inteira via beforeAll; os casos que dependem delas falham sozinhos, de forma isolada, quando a RPC é chamada"

patterns-established:
  - "Pattern: uma CTE 'parametros' single-row com hoje/inicio_janela calculados uma vez no fuso de São Paulo, cross-joined pelas demais CTEs, evita recalcular now() em múltiplos lugares do mesmo corpo de função"

requirements-completed: [ADER-01, ADER-02, ADER-03]

coverage:
  - id: D1
    description: "dashboard_aderencia_uso() calcula dias_usados/dias_uteis/aderencia_pct/coletando_desde por vendedor, janela de 28 dias corridos com denominador só de dias úteis (segunda a sexta)"
    requirement: "ADER-03"
    verification:
      - kind: unit
        ref: "node verify script (30-02-PLAN.md Tarefa 1) — checagem estrutural do corpo SQL"
        status: pass
      - kind: integration
        ref: "tests/dashboard/aderencia-uso.test.ts#janela-cheia-20-dias-uteis, #admissao-no-meio, #lacuna-de-desativacao, #reativado-sem-carimbo-de-desativacao, #denominador-zero"
        status: unknown
    human_judgment: true
    rationale: "Os testes de integração que provam isso contra o banco real ficam VERMELHOS até a migration ser aplicada no plano 30-03 (decisão explícita do plano) — o verificador deve reclassificar depois que 30-03 rodar os testes verdes."
  - id: D2
    description: "Um dia conta como usado por união (não interseção) de acessos_diarios com historico de autoria do vendedor dos 4 tipos existentes, sem duplicar o mesmo dia e ignorando autor nulo/fora da janela"
    requirement: "ADER-02"
    verification:
      - kind: unit
        ref: "node verify script (30-02-PLAN.md Tarefa 1)"
        status: pass
      - kind: integration
        ref: "tests/dashboard/aderencia-uso.test.ts#acessos-contam, #historico-conta, #uniao-sem-duplicar, #autor-nulo-e-fora-da-janela-ignorados, #fuso-sao-paulo, #fim-de-semana-nao-conta"
        status: unknown
    human_judgment: true
    rationale: "Vermelho até 30-03 aplicar a migration — mesma razão de D1."
  - id: D3
    description: "Leitura Supervisor-only (D-08): Vendedor e chamador anônimo recebem zero linhas; o Supervisor vê exatamente o mesmo conjunto de vendedores de dashboard_comparativo_vendedor()"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "node verify script (30-02-PLAN.md Tarefa 1) — checagem do filtro (select is_supervisor())"
        status: pass
      - kind: integration
        ref: "tests/dashboard/aderencia-uso.test.ts#rls-vendedor-zero-linhas, #anonimo-zero-linhas, #mesmo-conjunto-do-comparativo"
        status: unknown
    human_judgment: true
    rationale: "Vermelho até 30-03 aplicar a migration — mesma razão de D1."
  - id: D4
    description: "Aviso de coleta incompleta (coletando_desde) preenchido quando a medição começou há menos de 28 dias OU o vendedor não tem dia útil ativo na janela; nulo quando o percentual pode ser mostrado"
    requirement: "ADER-03"
    verification:
      - kind: unit
        ref: "node verify script (30-02-PLAN.md Tarefa 1)"
        status: pass
      - kind: integration
        ref: "tests/dashboard/aderencia-uso.test.ts#coletando-desde-coerente, #janela-completa-some-o-aviso, #fora-da-janela-nao-conta"
        status: unknown
    human_judgment: true
    rationale: "Vermelho até 30-03 aplicar a migration — mesma razão de D1."

# Metrics
duration: 55min
completed: 2026-09-27
status: complete
---

# Phase 30 Plan 2: dashboard_aderencia_uso() e testes RED de aderência de uso Summary

**Migration 0040 cria `dashboard_aderencia_uso()` — leitura agregada read-only (SQL stable, sem elevação de privilégio) que calcula, por vendedor ativo, o percentual de dias úteis usados nos últimos 28 dias, com proporção por admissão/desativação-reativação e aviso de "coletando dados" — mais 18 testes de integração deliberadamente vermelhos até a aplicação manual no plano 30-03.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 2 (todos novos: 1 migration, 1 arquivo de teste)

## Accomplishments
- Migration 0040: `dashboard_aderencia_uso()` sem parâmetros, `language sql stable`, retornando `(responsavel uuid, dias_usados integer, dias_uteis integer, aderencia_pct numeric, coletando_desde date)` — calendário de dias úteis via `generate_series`/`isodow`, união (não `union all`) de `acessos_diarios` + `historico` (4 tipos, autor não nulo, corte por instante convertido para o fuso de São Paulo), proporção por admissão/lacuna de desativação-reativação, e filtro `(select is_supervisor())` como exceção deliberada à convenção de não checar papel em função `dashboard_*` (necessária porque `profiles` tem leitura aberta). `dashboard_comparativo_vendedor()` (migration 0011) permanece intocada.
- 18 casos de teste de integração escritos contra o banco real (`tests/dashboard/aderencia-uso.test.ts`), com 7 vendedores de fixture cobrindo: contrato de colunas, janela cheia de 20 dias úteis, acessos e histórico contando (com dedupe da união), evento sem autor e fora da janela ignorados, fuso de São Paulo (sexta 23:30 não vira sábado), admissão no meio da janela, lacuna de desativação/reativação, reativação sem carimbo de desativação correspondente, denominador zero com aviso de coleta, coerência do aviso "coletando dados" antes/depois de uma linha fora da janela, e as duas travas de RLS/Supervisor.
- Rodada de confirmação executada contra o projeto Supabase real: 17/18 casos falham (função inexistente — comportamento esperado e desejado nesta fase); 1 caso (`anonimo-zero-linhas`) passa por acidente porque a asserção aceita tanto "erro" quanto "zero linhas", e o erro de função inexistente também satisfaz essa condição — mesmo padrão já documentado no 30-01-SUMMARY.

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: Migration 0040 — dashboard_aderencia_uso()** - `10c12fe` (feat)
2. **Tarefa 2: Testes de integração tests/dashboard/aderencia-uso.test.ts (VERMELHOS até a aplicação no 30-03)** - `f5fbec6` (test)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `supabase/migrations/0040_dashboard_aderencia_uso.sql` - função agregada de aderência de uso
- `tests/dashboard/aderencia-uso.test.ts` - 18 casos de integração da 0040

## Decisions Made
- `dashboard_aderencia_uso()` é função separada de `dashboard_comparativo_vendedor()`, nunca uma extensão dela — evita regressão de VEND-01 já em produção; a junção dos dois resultados por `responsavel` acontece na camada de consulta (plano 30-05), nunca no banco.
- O `beforeAll` do teste precisou ser reescrito com `Promise.all` (criação dos 8 membros e toda a semeadura em paralelo) e ganhar um timeout explícito de 60s — a versão sequencial inicial estourava o `hookTimeout` padrão de 10s do Vitest, porque este arquivo cria bem mais fixtures (7 vendedores + 1 supervisor) que o padrão usual de 2-4 no resto do projeto. Confirmado depois da correção: suíte inteira roda em ~6-10s, sem estourar o novo limite.
- Os helpers que escrevem em `acessos_diarios` e nas colunas `desativado_em`/`reativado_em` (`seedAcesso`/`tentarDefinirCarimbos`) são "melhor esforço" — não lançam exceção em caso de erro, porque essas duas migrations (0038/0039) ainda não existem no banco até o 30-03 e uma falha ali não deve derrubar a suíte inteira por dentro do `beforeAll`; os casos que realmente dependem desses dados falham sozinhos, de forma isolada, quando a RPC é chamada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `beforeAll` sequencial estourava o hookTimeout padrão do Vitest**
- **Found during:** Tarefa 2 (primeira rodada de confirmação contra o banco real)
- **Issue:** A criação sequencial de 8 membros de fixture (`createTestMember`, uma chamada de Admin API por vez) mais toda a semeadura subsequente ultrapassava os 10.000ms padrão do hook `beforeAll` do Vitest, derrubando a suíte inteira com "Hook timed out" antes de qualquer `it()` rodar — e o `afterAll` seguinte também falhava ao tentar limpar um estado parcialmente interrompido.
- **Fix:** Reescrito o `beforeAll` para criar os 8 membros e semear todos os dados independentes via `Promise.all` (paralelo em vez de sequencial), e adicionado um timeout explícito de 60.000ms tanto no `beforeAll` quanto no `afterAll`.
- **Files modified:** tests/dashboard/aderencia-uso.test.ts
- **Verification:** Segunda rodada contra o banco real terminou em ~6-10s, sem timeout, com os 18 casos rodando e falhando individualmente pelo motivo esperado (função inexistente) em vez de um crash de hook.
- **Committed in:** f5fbec6 (commit da Tarefa 2 — a correção foi feita antes do commit, não depois, então o commit já reflete a versão corrigida)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Correção de tooling do próprio teste (Vitest hookTimeout), sem nenhum impacto na lógica de negócio ou no desenho da migration. Nenhum scope creep.

## Issues Encountered
None além do já documentado acima em Deviations.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. **Atenção:** a migration 0040 ainda NÃO foi aplicada ao banco (por instrução deste plano) — isso acontece no plano 30-03, junto com a aprovação explícita do dono do projeto e a aplicação manual pelo SQL Editor do Supabase, na ordem obrigatória 0038 → 0039 → 0040.

## Next Phase Readiness
- A superfície publicada por este plano (`dashboard_aderencia_uso()`) está pronta para o plano 30-05 consumir via `lib/supabase/queries/dashboard.ts#getAderenciaUso`, unindo o resultado com `dashboard_comparativo_vendedor()` pelo id `responsavel`.
- Os 18 testes ficam vermelhos de propósito até o plano 30-03 aplicar as três migrations em ordem — isso é o estado esperado, não um bloqueio.
- **Lembrete LGPD para o checkpoint do 30-03:** esta função lê `acessos_diarios` (dado pessoal de funcionário, criado no plano 30-01) e o expõe agregado, só para o Supervisor. O desenho já aplica minimização (nenhuma linha bruta sai da função, só contagens/percentual/data) e a leitura é Supervisor-only — mas a aplicação em produção só deve acontecer depois da aprovação explícita do dono do projeto (D-12: comunicar o time de vendas é responsabilidade do dono, fora do escopo de código).

---
*Phase: 30-ader-ncia-de-uso-no-dashboard*
*Completed: 2026-09-27*

## Self-Check: PASSED

- FOUND: supabase/migrations/0040_dashboard_aderencia_uso.sql
- FOUND: tests/dashboard/aderencia-uso.test.ts
- FOUND commit: 10c12fe
- FOUND commit: f5fbec6
