---
phase: 28-relat-rio-de-perdidos
plan: 02
subsystem: database
tags: [supabase, postgrest, kanban, funil, rls-display-rule, vitest]

requires:
  - phase: quick-260915-ls7
    provides: "lib/funil/prospeccao.ts (regra de exibição de um status só, 'ganho') + escopoTudo na exportação"
provides:
  - "STATUS_FORA_DA_PROSPECCAO_LISTA (conjunto de dois status: ganho, perdido), fonte única consumida pelo filtro SQL e pela guarda do laço de getClientesAgrupadosPorEtapa"
  - "getClientesAgrupadosPorEtapa filtrando ganho e perdido no SQL via .not(..., 'in', ...), antes da paginação"
  - "Prova ao vivo (contra o PostgREST real) de que a sintaxe .not('status_acompanhamento', 'in', '(ganho,perdido)') é aceita e exclui os dois status"
  - "Guarda de regressão do D-07: getClientesParaExportacao/exportar/route.ts continuam sem filtro de status"
affects: [clientes, kanban, exportacao, perdidos]

tech-stack:
  added: []
  patterns:
    - "Regra de exibição de conjunto (não mais status único) isolada em módulo puro (STATUS_FORA_DA_PROSPECCAO_LISTA como const array + Set interno + apareceNaProspeccao), consumida em dois pontos (filtro SQL + guarda de laço) — mesmo padrão de isClienteIncompleto, agora estendido de 1 para 2 valores"
    - "Prova ao vivo de sintaxe PostgREST (.not(col, 'in', '(a,b)')) via teste de integração service-role-only, sem login, quando a única incerteza é a sintaxe do filtro (não a RLS)"
    - "Teste de regressão por leitura de código-fonte (fs.readFileSync + recorte do corpo da função) para travar 'esta função nunca deve importar/usar X', quando não há como expressar isso por assinatura de tipo"

key-files:
  created:
    - tests/clientes/kanban-sem-perdidos.test.ts
    - tests/clientes/filtro-prospeccao-postgrest.test.ts
    - tests/clientes/exportacao-inclui-perdidos.test.ts
  modified:
    - lib/funil/prospeccao.ts
    - lib/supabase/queries/clientes.ts
    - tests/clientes/prospeccao.test.ts
    - app/(app)/clientes/page.tsx

key-decisions:
  - "Filtro SQL usa .not('status_acompanhamento', 'in', '(ganho,perdido)') — a sintaxe da premissa A1 da pesquisa, provada ao vivo contra o banco real na Tarefa 2 sem precisar do fallback de dois .neq() encadeados"
  - "Nenhuma mudança de código em getClientesParaExportacao nem em app/api/clientes/exportar/route.ts (D-07/Pitfall 4 da pesquisa) — só um teste de regressão novo, exatamente como a pesquisa recomendou"
  - "Fixture de teste ao vivo (filtro-prospeccao-postgrest.test.ts) usa só serviceClient(), nenhum signInWithPassword — evita o rate limit conhecido do Supabase Auth, já que o que se prova é sintaxe de filtro, não RLS"

patterns-established:
  - "Regra de exibição em conjunto (array as const + Set interno) para filtros multi-valor no PostgREST, com o array também alimentando a string do .not(..., 'in', ...) — nunca duplicar a lista entre o TS e o SQL"

requirements-completed: [PERD-01]

coverage:
  - id: D1
    description: "Cliente perdido some das 7 colunas do Kanban de /clientes, pela mesma fonte única que já esconde o cliente ganho (STATUS_FORA_DA_PROSPECCAO_LISTA)"
    requirement: "PERD-01"
    verification:
      - kind: unit
        ref: "tests/clientes/prospeccao.test.ts — apareceNaProspeccao('perdido') === false, lista exportada === ['ganho','perdido']"
        status: pass
      - kind: unit
        ref: "tests/clientes/kanban-sem-perdidos.test.ts — caso filtro-sql (chamada exata do .not) e caso guarda-do-laco (só em_andamento sobrevive numa página mista)"
        status: pass
      - kind: integration
        ref: "tests/clientes/filtro-prospeccao-postgrest.test.ts — caso sintaxe-not-in, prova contra o PostgREST real"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cliente reaberto (status volta a em_andamento) reaparece no Kanban, na etapa em que já estava (D-08)"
    requirement: "PERD-01"
    verification:
      - kind: unit
        ref: "tests/clientes/kanban-sem-perdidos.test.ts — caso reaberto (linha em_andamento em aguardando_feedback aparece na coluna certa)"
        status: pass
    human_judgment: false
  - id: D3
    description: "'Exportar todos' (escopoTudo e caminho sem ids) continua trazendo perdidos e ganhos, sem filtro de status e sem importar a regra de prospecção"
    requirement: "PERD-01"
    verification:
      - kind: unit
        ref: "tests/clientes/exportacao-inclui-perdidos.test.ts — casos escopo-tudo, lista-vazia, com-ids e fonte-sem-regra"
        status: pass
      - kind: other
        ref: "git diff --name-only 67e2165 -- app/api/clientes/exportar/route.ts (vazio) + grep '{ escopoTudo: true }' components/clientes/KanbanBoard.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mensagem de Kanban vazio aponta a tela Perdidos, além da Agenda"
    requirement: "PERD-01"
    verification:
      - kind: other
        ref: "node -e (colapsa espaços e confere a string exata em app/(app)/clientes/page.tsx)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-25
status: complete
---

# Phase 28 Plan 2: Cliente Perdido Sai do Kanban (PERD-01/D-06/D-07/D-08) Summary

**A regra única de `lib/funil/prospeccao.ts` passou de um status excluído ("ganho") para um conjunto de dois ("ganho" e "perdido"), via `.not("status_acompanhamento", "in", "(ganho,perdido)")` provado ao vivo contra o PostgREST real, mantendo "Exportar todos" intocado e travado por teste de regressão.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-25T20:20:00Z
- **Completed:** 2026-09-25T20:34:00Z
- **Tasks:** 3/3 completos
- **Files modified:** 7 (3 criados, 4 modificados)

## Accomplishments

- `lib/funil/prospeccao.ts` refatorado: `STATUS_FORA_DA_PROSPECCAO_LISTA = ["ganho", "perdido"] as const` substitui a constante de valor único; `apareceNaProspeccao` agora checa pertencimento a um `Set` interno derivado da lista. Cabeçalho corrigido para não afirmar mais que "perdido continua aparecendo normalmente" — agora aponta a tela Perdidos.
- `getClientesAgrupadosPorEtapa` troca a antiga desigualdade simples (`.neq`) por `.not("status_acompanhamento", "in", "(ganho,perdido)")`, montado a partir da lista única, no SQL, antes da paginação. A guarda do laço (`if (!apareceNaProspeccao(...)) continue`) ficou intocada de propósito — mesma fonte, dois pontos de aplicação.
- Sintaxe do filtro `.not(..., "in", ...)` provada contra o Supabase real (fecha a premissa A1 da pesquisa) — nenhum fallback de dois `.neq()` encadeados foi necessário.
- Texto de Kanban vazio em `/clientes` atualizado para citar a tela Perdidos, além da Agenda.
- Guarda de regressão nova (`exportacao-inclui-perdidos.test.ts`) prova que `getClientesParaExportacao` e a rota `/api/clientes/exportar` continuam sem qualquer filtro de status — "Exportar todos" nunca esconde silenciosamente um cliente perdido ou ganho (D-07). Zero mudança de código de produção nesse caminho.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Regra de prospecção vira conjunto de dois status e o Kanban passa a usá-lo (D-06)** - `31ac3cc` (feat)
2. **Tarefa 2: Prova ao vivo da sintaxe do filtro e mensagem de Kanban vazio apontando os Perdidos** - `9149ae8` (test)
3. **Tarefa 3: Guarda de regressão do D-07 — a exportação continua trazendo perdidos** - `4075205` (test)

**Plan metadata:** pending (docs commit handled by orchestrator)

_Nota: as três tarefas eram `tdd="true"`; para a Tarefa 1, testes foram escritos/atualizados primeiro e confirmados falhando (RED) antes das mudanças de produção (GREEN) — ver seção RED/GREEN abaixo. As Tarefas 2 e 3 não alteram (ou quase não alteram) produção, então "RED" nelas é o teste inexistente até ser escrito, sem um commit de teste falhando separado por não haver produção a esperar._

## RED/GREEN por tarefa

- **Tarefa 1 — RED:** `npx vitest run tests/clientes/prospeccao.test.ts tests/clientes/kanban-sem-perdidos.test.ts` rodado logo após escrever/atualizar os testes (ainda sobre o código de produção antigo) — 7 de 9 testes falharam, exatamente os que dependiam do comportamento novo (constante renomeada, `perdido` esperado como `false`, filtro `.not` esperado no mock). **GREEN:** após editar `lib/funil/prospeccao.ts` e `lib/supabase/queries/clientes.ts`, os mesmos 9 testes + `paginacao.test.ts` (16 no total) passaram.
- **Tarefa 2 — GREEN direto:** `filtro-prospeccao-postgrest.test.ts` é 100% novo (nenhum código de produção equivalente já existia para falhar contra); rodado contra o Supabase real e passou de primeira depois de um ajuste de fixture (ver Deviations). O texto de Kanban vazio é uma mudança de string só, verificada pelo node-script do plano.
- **Tarefa 3 — GREEN direto:** `exportacao-inclui-perdidos.test.ts` é regressão pura sobre código já existente e inalterado — não há "RED" esperado, já que a função sob teste não muda nesta tarefa.

## Files Created/Modified

- `lib/funil/prospeccao.ts` - `STATUS_FORA_DA_PROSPECCAO_LISTA` (array de 2 status) + `apareceNaProspeccao` baseada em Set; cabeçalho corrigido (D-06)
- `lib/supabase/queries/clientes.ts` - `getClientesAgrupadosPorEtapa` usa `.not(..., "in", ...)` sobre a lista única; doc-comments atualizados
- `tests/clientes/prospeccao.test.ts` - 6 casos atualizados para o conjunto de dois status
- `tests/clientes/kanban-sem-perdidos.test.ts` - novo: prova o filtro SQL exato, a guarda do laço e o caso reaberto (D-08) com mock de `@/lib/supabase/server`
- `tests/clientes/filtro-prospeccao-postgrest.test.ts` - novo: prova ao vivo (Supabase real, só `serviceClient()`) da sintaxe do `.not(..., "in", ...)`
- `app/(app)/clientes/page.tsx` - texto de Kanban vazio aponta a tela Perdidos
- `tests/clientes/exportacao-inclui-perdidos.test.ts` - novo: guarda de regressão do D-07 (escopo-tudo, lista-vazia, com-ids, fonte-sem-regra)

## Decisions Made

- `.not("status_acompanhamento", "in", "(ganho,perdido)")` confirmado como sintaxe válida contra o PostgREST real — nenhuma necessidade do fallback de dois `.neq()` encadeados que a pesquisa deixou de prontidão (Assumption A1 fechada com risco zero).
- `getClientesParaExportacao`/`app/api/clientes/exportar/route.ts` permanecem 100% intocados (D-07/Pitfall 4 da pesquisa) — a proteção é só um teste de regressão novo, nunca uma mudança de produção.
- Nenhuma migration, RLS ou RPC tocada — regra de exibição só, exatamente como delimitado pelo plano.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Insert em lote da fixture de teste ao vivo violava NOT NULL em `etapa`**
- **Found during:** Tarefa 2 (primeira execução de `filtro-prospeccao-postgrest.test.ts`)
- **Issue:** O insert de 3 linhas em uma única chamada `.insert([...])` omitia `etapa` nas linhas `em_andamento`/`perdido` (esperando o `default 'aguardando_contato'` da coluna) enquanto a linha `ganho` especificava `etapa: "primeira_venda"`. O PostgREST normaliza as colunas pela união das chaves de todas as linhas do lote e envia `NULL` explícito para quem não especificou a coluna, em vez de deixar o `DEFAULT` do Postgres agir — resultado: `null value in column "etapa" of relation "clientes" violates not-null constraint`.
- **Fix:** `etapa: "aguardando_contato"` adicionado explicitamente nas duas linhas que antes confiavam no default.
- **Files modified:** tests/clientes/filtro-prospeccao-postgrest.test.ts
- **Verification:** `npx vitest run tests/clientes/filtro-prospeccao-postgrest.test.ts` passou (2/2) na sequência.
- **Committed in:** `9149ae8` (parte do commit da Tarefa 2, teste ainda não existia em nenhum commit anterior)

---

**Total deviations:** 1 auto-fixed (1 bug em fixture de teste, nunca em código de produção)
**Impact on plan:** Nenhum impacto em escopo — o desvio foi só um ajuste de dados de teste para respeitar uma peculiaridade conhecida de inserts em lote do PostgREST (normalização de colunas), não uma mudança de comportamento do sistema.

## Issues Encountered

Nenhum, além do desvio documentado acima. `npx tsc --noEmit` compilou sem erro após todas as edições, e todos os testes/greps/scripts de verificação de cada tarefa passaram na primeira ou segunda tentativa.

### Nota sobre arquivos concorrentes no mesmo checkout

Durante a execução deste plano, dois arquivos de outra dispatch em paralelo (`supabase/migrations/0034_clientes_perdidos.sql` e `.planning/phases/28-relat-rio-de-perdidos/28-01-SUMMARY.md`, do plano 28-01) apareceram como untracked no `git status` — não fazem parte do escopo `files_modified` deste plano 28-02 e não foram tocados, adicionados nem commitados em nenhum dos 3 commits acima (confirmado com `git show --stat` em cada um).

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- PERD-01 completo: cliente perdido some das 7 colunas do Kanban, junto com o ganho, pela mesma fonte única.
- D-06/D-07/D-08 provados por teste; a exportação "tudo" continua alcançando a base completa.
- A tela "Perdidos" (PERD-02..05, plano 28-01 em paralelo) pode consumir `apareceNaProspeccao`/`STATUS_FORA_DA_PROSPECCAO_LISTA` sem qualquer ajuste adicional — a regra já está pronta para o caminho de reabrir (D-08) fazer o cliente reaparecer na etapa certa.
- Nenhum bloqueio conhecido para o fechamento da Fase 28.

---
*Phase: 28-relat-rio-de-perdidos*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: lib/funil/prospeccao.ts
- FOUND: lib/supabase/queries/clientes.ts
- FOUND: tests/clientes/prospeccao.test.ts
- FOUND: tests/clientes/kanban-sem-perdidos.test.ts
- FOUND: app/(app)/clientes/page.tsx
- FOUND: tests/clientes/filtro-prospeccao-postgrest.test.ts
- FOUND: tests/clientes/exportacao-inclui-perdidos.test.ts
- FOUND commit: 31ac3cc
- FOUND commit: 9149ae8
- FOUND commit: 4075205
