---
phase: 30-ader-ncia-de-uso-no-dashboard
plan: 05
subsystem: api
tags: [typescript, vitest, dashboard, tdd, supabase-rpc]

# Dependency graph
requires:
  - phase: 30-02
    provides: "dashboard_aderencia_uso() (migration 0040) — contrato de colunas snake_case consumido por getAderenciaUso()"
provides:
  - "lib/aderencia/exibicao.ts — módulo puro: rotuloAderencia() (D-09/ADER-03) e mesclarAderencia() (junção por responsavel)"
  - "getAderenciaUso() — leitor tipado de dashboard_aderencia_uso(), lança em erro como os demais leitores do arquivo"
  - "getComparativoVendedorAction() devolvendo ComparativoVendedorLinha[] — comparativo + aderência mesclados, tolerante a falha da métrica nova"
affects: ["30-06 (ComparativoVendedorTable.tsx renderiza a nova coluna usando rotuloAderencia/TEXTO_TOOLTIP_ADERENCIA)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regra de exibição separada em módulo puro (lib/aderencia/exibicao.ts), sem import em tempo de execução de módulo server-only — testável sem dublê de Supabase e seguro para componente de cliente"
    - "Junção de duas leituras independentes na Server Action via Promise.all + .catch(() => null) na métrica decorativa — uma falha isolada nunca derruba a tabela já em produção (VEND-01)"

key-files:
  created:
    - lib/aderencia/exibicao.ts
    - tests/dashboard/aderencia-exibicao.test.ts
    - tests/dashboard/aderencia-uso-reader.test.ts
    - tests/dashboard/comparativo-vendedor-action.test.ts
  modified:
    - lib/supabase/queries/dashboard.ts
    - app/actions/dashboard.ts
    - tests/dashboard/comparativo-vendedor-table.test.tsx

key-decisions:
  - "dashboard_comparativo_vendedor() e getComparativoVendedor() não mudam de assinatura — a junção por responsavel acontece só na camada de consulta/ação, nunca no banco (evita regressão de VEND-01 já em produção)"
  - "aderenciaPct nunca é multiplicado por 100 — já chega em pontos percentuais do banco, ao contrário de taxaConversao (razão 0-1) que a tabela multiplica"
  - "getAderenciaUso().catch(() => null) isola a falha da métrica nova dentro da própria Server Action — o comparativo mantém o comportamento de erro de sempre"

patterns-established:
  - "Regra de exibição de métrica com aviso de coleta incompleta (D-09): o texto 'Coletando dados desde DD/MM/AAAA' vence sobre qualquer percentual presente na mesma linha, decidido inteiramente pelo banco (coletando_desde), nunca por conta de data no navegador"

requirements-completed: [ADER-01, ADER-03]

coverage:
  - id: D1
    description: "rotuloAderencia() decide o texto/detalhe de cada célula — travessão para aderência nula/pct nulo, aviso 'Coletando dados desde DD/MM/AAAA' quando coletandoDesde preenchido (vence sobre o percentual), ou percentual em pt-BR (1 casa) + 'N de M dias úteis'/'N de M dia útil'"
    requirement: "ADER-03"
    verification:
      - kind: unit
        ref: "tests/dashboard/aderencia-exibicao.test.ts#rotuloAderencia (9 casos: nulo-vira-travessao, coletando-com-data, coletando-vence-percentual, denominador-zero-mesmo-texto, percentual-ja-em-pontos, percentual-decimal, singular, pct-nulo-defensivo, tooltip-texto)"
        status: pass
    human_judgment: false
  - id: D2
    description: "mesclarAderencia() junta o comparativo (VEND-01) com a aderência por responsavel, preservando ordem e linhas do comparativo; vendedor sem aderência recebe aderencia nula, nunca some; sobras de aderência sem linha correspondente são ignoradas"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/aderencia-exibicao.test.ts#mesclarAderencia (3 casos: mesclar-preserva-ordem, mesclar-ignora-sobras, mesclar-lista-vazia)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getAderenciaUso() chama dashboard_aderencia_uso() sem parâmetros, normaliza bigint/numeric em texto para número real, preserva nulos de aderencia_pct/coletando_desde, e lança com mensagem contendo 'aderência de uso' em erro"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/aderencia-uso-reader.test.ts (4 casos: chama-rpc-sem-parametros, normaliza-numeros, preserva-nulos, erro-lanca)"
        status: pass
    human_judgment: false
  - id: D4
    description: "getComparativoVendedorAction() busca as duas leituras em paralelo e devolve ComparativoVendedorLinha[] mesclado; uma falha isolada de getAderenciaUso() nunca derruba a tabela comparativa (aderencia nula em todas as linhas, sem erro); uma falha do comparativo mantém o erro fetch_falhou de sempre; sem sessão continua unauthenticated sem chamar nenhum dos dois leitores"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/comparativo-vendedor-action.test.ts (4 casos: sem-sessao, mescla-as-duas-leituras, aderencia-falha-nao-derruba, comparativo-falha-continua-erro)"
        status: pass
    human_judgment: false
  - id: D5
    description: "ComparativoVendedorTable.tsx continua compilando e passando nos 7 casos existentes com o tipo novo ComparativoVendedorLinha (aderencia: null no buildRow) — a coluna nova em si é renderizada só no plano 30-06"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/comparativo-vendedor-table.test.tsx (7 casos existentes, inalterados)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-09-27
status: complete
---

# Phase 30 Plan 5: Leitor e junção da aderência de uso Summary

**Módulo puro `lib/aderencia/exibicao.ts` (rótulo de célula + junção por responsavel), `getAderenciaUso()` lendo `dashboard_aderencia_uso()`, e `getComparativoVendedorAction()` devolvendo o comparativo já mesclado com a aderência, tolerante a falha da métrica nova — 27 casos de teste (12+4+4+7) verdes.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 7 (4 novos, 3 alterados)

## Accomplishments
- `lib/aderencia/exibicao.ts`: `rotuloAderencia()` implementa D-09/ADER-03 (travessão / aviso de coleta / percentual + dias úteis, singular vs. plural, nunca multiplica por 100) e `mesclarAderencia()` junta o comparativo com a aderência por `responsavel`, preservando ordem e linhas — módulo puro, só `import type` de `@/lib/supabase/queries/dashboard`, sem dependência de servidor.
- `getAderenciaUso()` (novo, em `lib/supabase/queries/dashboard.ts`) lê `dashboard_aderencia_uso()` (migration 0040) sem parâmetros, normaliza os campos numéricos (bigint/numeric chegam como texto do PostgREST) e preserva nulos; `getComparativoVendedor()` e `ComparativoVendedorRow` não mudaram de assinatura.
- `getComparativoVendedorAction()` agora busca as duas leituras em paralelo (`Promise.all`) com `.catch(() => null)` só na aderência, e devolve `mesclarAderencia(comparativo, aderencia ?? [])` — uma falha isolada da métrica nova nunca derruba a tabela comparativa (VEND-01) já em produção; uma falha do comparativo mantém o comportamento de erro de sempre. Nenhuma checagem de papel na ação (D-08 é garantido inteiramente pela RLS/função do banco).
- `tests/dashboard/comparativo-vendedor-table.test.tsx` ajustado no mínimo necessário (`buildRow` devolve `ComparativoVendedorLinha` com `aderencia: null`) — os 7 casos existentes continuam verdes sem nenhuma mudança de comportamento; a coluna nova em si fica para o plano 30-06.

## Task Commits

Cada tarefa foi commitada atomicamente (RED → GREEN):

1. **Tarefa 1 RED: teste de rotuloAderencia/mesclarAderencia** - `1f3f8ba` (test)
2. **Tarefa 1 GREEN: lib/aderencia/exibicao.ts** - `481be8c` (feat)
3. **Tarefa 2 RED: teste de getAderenciaUso e junção tolerante a falha** - `800bfdd` (test)
4. **Tarefa 2 GREEN: getAderenciaUso() + getComparativoVendedorAction()** - `57a9459` (feat)

## Files Created/Modified
- `lib/aderencia/exibicao.ts` - módulo puro: `ComparativoVendedorLinha`, `RotuloAderencia`, `TEXTO_TOOLTIP_ADERENCIA`, `rotuloAderencia()`, `mesclarAderencia()`
- `tests/dashboard/aderencia-exibicao.test.ts` - 12 casos do módulo puro (RED)
- `lib/supabase/queries/dashboard.ts` - `AderenciaUsoRow` + `getAderenciaUso()` adicionados; `getComparativoVendedor()` intocado
- `tests/dashboard/aderencia-uso-reader.test.ts` - 4 casos do leitor com dublê de `@/lib/supabase/server`
- `app/actions/dashboard.ts` - `getComparativoVendedorAction()` mescla as duas leituras, tolerante a falha da aderência
- `tests/dashboard/comparativo-vendedor-action.test.ts` - 4 casos da ação com dublê de sessão + `vi.mock(..., importOriginal)` dos dois leitores
- `tests/dashboard/comparativo-vendedor-table.test.tsx` - `buildRow` ajustado para `ComparativoVendedorLinha` (`aderencia: null`); nenhum caso novo, nenhum caso alterado

## Decisions Made
- Nenhuma decisão fora do que o plano já travava. `dashboard_comparativo_vendedor()` (migration 0011) permanece intocada; a junção acontece só na camada de consulta/ação, exatamente como o 30-02-SUMMARY já antecipava.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Comentário do módulo continha as próprias substrings proibidas pelo script de verificação**
- **Found during:** Tarefa 1 (verificação automatizada, após o GREEN)
- **Issue:** O comentário de cabeçalho de `lib/aderencia/exibicao.ts` explicava, em português, que o módulo não importa `next/headers` nem `@/lib/supabase/server` em tempo de execução — mas o próprio script `node -e` da verificação do plano proíbe essas substrings literais em qualquer lugar do arquivo (inclusive comentários), então o comentário se auto-reprovava.
- **Fix:** Reescrita a frase do comentário para descrever a mesma garantia sem usar as substrings literais proibidas ("nenhum acesso ao ambiente do Next.js nem ao cliente Supabase do servidor aqui").
- **Files modified:** `lib/aderencia/exibicao.ts`
- **Verification:** Script `node -e` do plano (Tarefa 1) e `npx vitest run tests/dashboard/aderencia-exibicao.test.ts` voltaram a passar depois do ajuste.
- **Committed in:** `481be8c` (a correção foi feita antes do commit, então o commit já reflete a versão corrigida)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Correção redacional no comentário do próprio módulo, sem nenhum impacto de comportamento, tipo ou teste. Nenhum scope creep.

**Nota sobre ordem de verificação (não é desvio, é observação de execução):** O script `<verify>` da Tarefa 1 inclui `npx tsc --noEmit`, mas `lib/aderencia/exibicao.ts` importa (só por tipo) `AderenciaUsoRow`, que só passa a existir em `lib/supabase/queries/dashboard.ts` na Tarefa 2 — dependência inerente à própria divisão de arquivos do plano entre as duas tarefas. `npx tsc --noEmit` rodou vermelho por esse motivo logo após o commit da Tarefa 1 isoladamente, e voltou a rodar limpo assim que a Tarefa 2 (imediatamente seguinte, mesma sessão, sem checkpoint entre elas) adicionou o tipo. `npx vitest`, eslint e o script `node -e` de checagem estrutural da Tarefa 1 passaram normalmente nesse meio-tempo. Nenhuma ação foi necessária além de continuar para a Tarefa 2 — documentado aqui só para rastreabilidade, já que a verificação final do plano (rodada depois da Tarefa 2) confirma `tsc --noEmit` limpo.

## Issues Encountered
None além do já documentado acima em Deviations.

## User Setup Required
None — nenhuma configuração de serviço externo necessária. A migration 0040 (`dashboard_aderencia_uso()`) ainda não está aplicada em produção (plano 30-03, em andamento em paralelo); os leitores deste plano foram escritos e testados inteiramente com dublês, sem nenhuma chamada real ao banco.

## LGPD / Privacidade
Este plano lê e exibe, de forma agregada, dado pessoal de funcionário (dias de uso por vendedor, via `acessos_diarios` — criado no plano 30-01). O módulo de exibição nunca expõe dado bruto além do que a RPC já agrega (contagens, percentual, uma data), e nenhuma checagem de papel foi adicionada no app: a única fronteira de autorização é a RLS/função do banco (D-08), que já devolve zero linhas para quem não é Supervisor. Nenhuma nova coleta ou retenção de dado pessoal foi introduzida por este plano — ele só consome o que o 30-01/30-02 já desenharam com minimização.

## Next Phase Readiness
- `lib/aderencia/exibicao.ts` (rotuloAderencia/TEXTO_TOOLTIP_ADERENCIA) e `getComparativoVendedorAction()` (devolvendo `ComparativoVendedorLinha[]`) estão prontos para o plano 30-06 renderizar a nova coluna em `ComparativoVendedorTable.tsx`.
- Nenhum push feito para `staging` nem `master` — commits locais apenas, por instrução explícita do plano (o marco v1.7 é testado todo junto no fim, depois do 30-03 aplicar a migration 0040 em produção).

---
*Phase: 30-ader-ncia-de-uso-no-dashboard*
*Completed: 2026-09-27*

## Self-Check: PASSED

- FOUND: lib/aderencia/exibicao.ts
- FOUND: tests/dashboard/aderencia-exibicao.test.ts
- FOUND: tests/dashboard/aderencia-uso-reader.test.ts
- FOUND: tests/dashboard/comparativo-vendedor-action.test.ts
- FOUND commit: 1f3f8ba
- FOUND commit: 481be8c
- FOUND commit: 800bfdd
- FOUND commit: 57a9459
