---
phase: 28-relat-rio-de-perdidos
plan: 03
subsystem: api
tags: [supabase, rpc, server-actions, pagination, typescript, lgpd]

requires:
  - phase: 28-relat-rio-de-perdidos (28-01)
    provides: "função clientes_perdidos(p_inicio, p_fim) — leitura SECURITY INVOKER aplicada em produção"
provides:
  - "lib/perdidos/lista.ts — módulo puro: ClientePerdido (7 campos), presets/resolvePeriodoPerdidos/temRecortePeriodo, validarPeriodoPerdidos, filtrarPerdidosPorNome, MOTIVO_PERDA_AUSENTE"
  - "lib/supabase/queries/perdidos.ts — getClientesPerdidos(intervalo), leitura paginada sobre a RPC clientes_perdidos"
  - "app/actions/perdidos.ts — getClientesPerdidosAction(intervalo), checa sessão + valida período antes de qualquer ida ao banco"
affects: [28-04]

tech-stack:
  added: []
  patterns:
    - "Módulo puro de regras (período + busca) sem import de Supabase/next/headers, importável tanto pela Server Action quanto pelo Client Component — mesma disciplina de lib/dashboard/periodo.ts"
    - "Leitura paginada com buscarPaginado + .order() duplo explícito no chamador, mesmo molde de getClientesSemDiaFixo (Pitfall 2, quick task 260914-ng5)"
    - "Server Action de leitura: auth.getUser() primeiro, validação de entrada em seguida (ANTES de qualquer chamada ao banco), try/catch em volta da leitura, sem revalidatePath — mesmo molde de getClientesSemDiaFixoAction"

key-files:
  created:
    - lib/perdidos/lista.ts
    - lib/supabase/queries/perdidos.ts
    - app/actions/perdidos.ts
    - tests/funil/perdidos-lista.test.ts
    - tests/funil/perdidos-query.test.ts
  modified: []

key-decisions:
  - "Nenhuma checagem de papel/dono no leitor nem na Server Action (D-10) — a RLS dentro de clientes_perdidos (28-01) é a única fronteira; provado por grep de acceptance criteria (isSupervisor/is_supervisor/from(\"profiles\")/.eq(\"responsavel\") ausentes fora de comentário)"
  - "Nenhuma Server Action de reabrir criada (D-08) — a tela do plano 28-04 reusa marcarStatus de app/actions/funil.ts; grep confirma ausência de chamada a marcarStatus/mover_card_funil fora de comentário"
  - "Reescrito o comentário de cabeçalho de lib/perdidos/lista.ts para não citar a substring literal 'next/headers' (Rule 1 — mesmo padrão de falso positivo já documentado na 28-01-SUMMARY para 'console.log')"

patterns-established: []

requirements-completed: [PERD-02, PERD-03, PERD-04]

coverage:
  - id: D1
    description: "lib/perdidos/lista.ts — presets de período (Tudo padrão, janelas móveis 30/90 dias sem limite superior, personalizado com último dia incluído), temRecortePeriodo, validarPeriodoPerdidos e filtrarPerdidosPorNome, todos testados sem Supabase"
    requirement: "PERD-04"
    verification:
      - kind: unit
        ref: "tests/funil/perdidos-lista.test.ts (35 casos: presets, tudo, 30dias, 90dias, personalizado, personalizado-sem-intervalo, recorte, validacao, busca)"
        status: pass
    human_judgment: false
  - id: D2
    description: "lib/supabase/queries/perdidos.ts — getClientesPerdidos(intervalo) chama a RPC clientes_perdidos uma vez por página com p_inicio/p_fim, ordena perdido_em desc + cliente_id asc, pagina com buscarPaginado (1000 + 5 linhas = 1005 itens provados), mapeia as 7 colunas para ClientePerdido sem alterar nulos"
    requirement: "PERD-02"
    verification:
      - kind: unit
        ref: "tests/funil/perdidos-query.test.ts (leitor-rpc, leitor-mapeamento, leitor-paginado, leitor-erro)"
        status: pass
    human_judgment: false
  - id: D3
    description: "app/actions/perdidos.ts — getClientesPerdidosAction(intervalo) recusa sem sessão (unauthenticated) e período inválido (periodo_invalido) ANTES de chamar a RPC, devolve dados mapeados no caminho feliz e fetch_falhou com mensagem fixa em caso de erro do leitor; nenhuma checagem de papel/dono"
    requirement: "PERD-03"
    verification:
      - kind: unit
        ref: "tests/funil/perdidos-query.test.ts (acao-sem-sessao, acao-periodo-invalido, acao-ok, acao-falha)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-25
status: complete
---

# Phase 28 Plan 3: Relatório de Perdidos — Camada de Dados (Leitor + Server Action) Summary

**Módulo puro de período/busca (lib/perdidos/lista.ts), leitor paginado getClientesPerdidos e Server Action getClientesPerdidosAction sobre a RPC clientes_perdidos já em produção — 71 testes unitários (35+36) provando período, validação de entrada, busca e paginação, sem tocar o banco real.**

## Performance

- **Duration:** ~20min
- **Started:** 2026-09-25T23:50:00Z (aprox.)
- **Completed:** 2026-09-25T23:56:57Z
- **Tasks:** 2/2 concluídas
- **Files modified:** 5 (3 produção + 2 teste)

## Accomplishments

- `lib/perdidos/lista.ts`: tipo `ClientePerdido` com exatamente os 7 campos do contrato do plano 28-01; presets de período com "Tudo" como padrão (sem recorte), janelas móveis de 30/90 dias sem limite superior, e "Personalizado" recortando do início do primeiro dia ao fim do último dia (limite superior exclusivo, mesmo o banco pedindo o dia seguinte à meia-noite); `validarPeriodoPerdidos` recusando entrada malformada (não-objeto, data inválida, início ≥ fim) antes de qualquer ida ao banco; `filtrarPerdidosPorNome` reusando a mesma regra de busca pelo nome exibido do Kanban (T-26-15).
- `lib/supabase/queries/perdidos.ts`: `getClientesPerdidos(intervalo)` chama a RPC `clientes_perdidos` (migration 0034, já aplicada em produção) uma vez por página, com `p_inicio`/`p_fim`, ordenação dupla explícita (`perdido_em` desc, `cliente_id` asc) e paginação via `buscarPaginado` — prova de que 1000+5 linhas viram 1005 itens sem truncar (Pitfall 2). Nenhuma checagem de papel ou filtro de dono: a RLS de `clientes_perdidos` é a única fronteira (D-10).
- `app/actions/perdidos.ts`: `getClientesPerdidosAction(intervalo)` checa sessão primeiro, valida o período recebido do navegador em seguida (endpoint público — validação de entrada, não de autorização), delega ao leitor dentro de um `try/catch`, e devolve uma união discriminada `{ data } | { error: { code, message } }`. Sem `revalidatePath` (leitura pura recarregada pelo `reloadKey` da tela). Sem ação de reabrir (D-08) — comentário de cabeçalho documenta que a tela do plano 28-04 reusa `marcarStatus` de `app/actions/funil.ts`.
- Todas as verificações mecânicas dos dois blocos `<verify>`/`<acceptance_criteria>` do plano passaram: `npx vitest run` (71 testes, 2 arquivos), `npx tsc --noEmit`, `npx eslint` nos 5 arquivos, e todos os `grep` de forma/escopo (exports, ausência de import de Supabase/`next/headers` no módulo puro, ausência de campos de contato/telefone/email fora de comentário, ausência de checagem de papel/dono, ausência de ação de reabrir paralela).
- Conferido com `git show --stat` nos dois commits: exatamente os 5 arquivos declarados em `files_modified` do plano foram tocados, nenhum arquivo fora do escopo.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Módulo puro lib/perdidos/lista.ts — tipo, período, validação e busca** - `0a293e5` (feat, RED→GREEN)
2. **Tarefa 2: Leitor paginado getClientesPerdidos e Server Action getClientesPerdidosAction** - `c1738fa` (feat, RED→GREEN)

## Files Created/Modified

- `lib/perdidos/lista.ts` - módulo puro: tipo `ClientePerdido`, presets/resolução/validação de período, busca pelo nome exibido
- `lib/supabase/queries/perdidos.ts` - `getClientesPerdidos(intervalo)`, leitura paginada sobre a RPC `clientes_perdidos`
- `app/actions/perdidos.ts` - `getClientesPerdidosAction(intervalo)`, Server Action de leitura chamada pela tela
- `tests/funil/perdidos-lista.test.ts` - 35 testes unitários puros (Tarefa 1)
- `tests/funil/perdidos-query.test.ts` - 8 casos com mock de `@/lib/supabase/server` (Tarefa 2)

## Decisions Made

- Nenhuma checagem de papel/dono no leitor nem na Server Action (D-10) — confirmado por `grep` que a única verificação é de sessão; quem decide as linhas visíveis é a RLS de `clientes_perdidos`, já provada por `rls-vendedor`/`rls-supervisor` no plano 28-01.
- Nenhuma Server Action de reabrir criada aqui (D-08) — o comentário de cabeçalho de `app/actions/perdidos.ts` deixa explícito que a tela (plano 28-04) chama `marcarStatus` de `app/actions/funil.ts` diretamente, para ninguém criar uma ação paralela depois.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentário de cabeçalho continha a substring literal "next/headers", disparando falso positivo no gate de módulo puro**
- **Found during:** Tarefa 1 (verificação mecânica `grep -cE 'from "@/lib/supabase|next/headers' lib/perdidos/lista.ts`, esperado 0)
- **Issue:** O comentário de cabeçalho descrevia a disciplina de módulo puro dizendo "sem import ... nem de next/headers" — a própria frase explicativa continha a substring que o grep do plano procura para garantir que o módulo não importa nada de servidor, disparando um alarme falso (mesma classe de bug já documentada em 28-01-SUMMARY.md para a palavra "console.log").
- **Fix:** Reescrita a frase para descrever a mesma coisa sem citar a substring literal ("Sem import do cliente Supabase nem do módulo de cabeçalhos/cookies do Next").
- **Files modified:** lib/perdidos/lista.ts
- **Verification:** `grep -cE 'from "@/lib/supabase|next/headers' lib/perdidos/lista.ts` voltou a imprimir 0; testes e tsc/eslint continuaram verdes.
- **Committed in:** 0a293e5 (Tarefa 1 commit — o arquivo já nasceu corrigido, sem commit intermediário quebrado)

---

**Total deviations:** 1 auto-fixed (1 falso positivo em verificação mecânica de comentário)
**Impact on plan:** Sem impacto de escopo — ajuste de texto de comentário, nenhuma mudança de comportamento ou de contrato público.

## Issues Encountered

None além do desvio documentado acima.

## User Setup Required

None. Nenhuma migration, dependência nova ou configuração de serviço externo neste plano — só código TypeScript sobre a função `clientes_perdidos` já aplicada em produção pelo plano 28-01.

## Next Phase Readiness

- Contrato publicado exatamente como o bloco `<interfaces>` do plano exigia: `ClientePerdido`, `MOTIVO_PERDA_AUSENTE`, `PeriodoPresetPerdidos`, `PERIODO_PADRAO_PERDIDOS`, `PERIODO_PRESETS_PERDIDOS`, `IntervaloPerdidos`, `resolvePeriodoPerdidos`, `temRecortePeriodo`, `ValidacaoPeriodoPerdidos`, `validarPeriodoPerdidos`, `filtrarPerdidosPorNome` (lib/perdidos/lista.ts); `getClientesPerdidos` (lib/supabase/queries/perdidos.ts); `ClientesPerdidosErrorCode`, `GetClientesPerdidosResult`, `getClientesPerdidosAction` (app/actions/perdidos.ts).
- O plano 28-04 (tela) já pode começar: pode importar `lib/perdidos/lista.ts` direto no Client Component (módulo puro, sem risco de puxar `next/headers` para o navegador) e chamar `getClientesPerdidosAction` a partir do navegador ao trocar o período e após cada "Reabrir".
- Nenhuma migration, RPC nova, rota nova ou pacote instalado neste plano — zero mudança de superfície de infraestrutura além do código TypeScript.
- Requisitos PERD-02/PERD-03/PERD-04 completos na camada de dados; a conclusão end-to-end (incluindo UI) depende do plano 28-04.

## Self-Check: PASSED

All 5 created files found on disk (lib/perdidos/lista.ts, lib/supabase/queries/perdidos.ts, app/actions/perdidos.ts, tests/funil/perdidos-lista.test.ts, tests/funil/perdidos-query.test.ts). Both task commits (0a293e5, c1738fa) confirmed present in git log.

---
*Phase: 28-relat-rio-de-perdidos*
*Completed: 2026-09-25*
