---
phase: quick-260915-ls7
plan: 01
subsystem: database
tags: [supabase, postgres, rls, kanban, funil, export]

requires:
  - phase: quick-260914-ng5
    provides: buscarPaginado (paginador genérico usado por getClientesAgrupadosPorEtapa/getClientesParaExportacao)
provides:
  - "lib/funil/prospeccao.ts: fonte única da regra 'cliente ganho não aparece no funil de prospecção'"
  - "getClientesAgrupadosPorEtapa filtrando status_acompanhamento != 'ganho' no SQL, antes da paginação"
  - "escopoTudo na rota de exportação, preservando o alcance de EXP-03 quando a tela não está filtrada"
affects: [clientes, agenda, dashboard]

tech-stack:
  added: []
  patterns:
    - "Regra de exibição isolada em módulo puro (STATUS_FORA_DA_PROSPECCAO + apareceNaProspeccao), consumida em dois pontos (filtro SQL + guarda de laço) — mesmo padrão de isClienteIncompleto"
    - "Bandeira booleana estrita (escopoTudo === true) para distinguir 'exportar tudo que RLS permite' de 'exportar só os ids da tela filtrada', nunca coerção de truthy"

key-files:
  created:
    - lib/funil/prospeccao.ts
    - tests/clientes/prospeccao.test.ts
  modified:
    - lib/supabase/queries/clientes.ts
    - app/(app)/clientes/page.tsx
    - app/api/clientes/exportar/route.ts
    - components/clientes/KanbanBoard.tsx

key-decisions:
  - "Filtro por status_acompanhamento (nunca por etapa) — cliente na última etapa mas ainda em andamento continua sendo prospecção legítima"
  - "Filtro entra no SQL (.neq antes de .order/.range), não no navegador — mantém o ganho de egress da paginação da quick task 260914-ng5"
  - "Nenhuma migration, RLS ou RPC — regra de exibição, documentada explicitamente como tal no código para não virar policy por engano"
  - "escopoTudo nunca é entrada de autorização — getClientesParaExportacao(null) já é escopada por RLS em qualquer caminho"

requirements-completed: [QUICK-260915-ls7]

coverage:
  - id: D1
    description: "Cliente ganho não aparece mais nas 7 colunas do Kanban de prospecção, nem é somado nos contadores"
    requirement: "QUICK-260915-ls7"
    verification:
      - kind: unit
        ref: "tests/clientes/prospeccao.test.ts — 5 testes da regra apareceNaProspeccao/STATUS_FORA_DA_PROSPECCAO"
        status: pass
      - kind: manual_procedural
        ref: "Abrir /clientes logado e conferir que a coluna '1ª venda concluída' não traz mais os 1752 clientes ganhos"
        status: unknown
    human_judgment: true
    rationale: "Confirmação visual do comportamento real do Kanban com a base de produção (2181 clientes) não foi executada nesta sessão — requer login real na aplicação rodando; a leitura SQL foi verificada por teste de unidade da regra e por leitura de código (tsc + grep), não por captura de tela."
  - id: D2
    description: "Agenda, ficha, Diário, Dashboard e as duas importações continuam enxergando cliente ganho normalmente — nenhuma dessas leituras foi tocada"
    requirement: "QUICK-260915-ls7"
    verification:
      - kind: other
        ref: "Leitura de código: getDiario, getHistorico, getClienteById, getDiarioParaExportacao e as leituras de agenda.ts não foram modificadas neste plano (grep/diff confirmam escopo restrito a getClientesAgrupadosPorEtapa)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exportação da tela de Clientes continua alcançando a base completa (incluindo ganhos) quando não há filtro ativo; espelha a tela quando há"
    requirement: "QUICK-260915-ls7"
    verification:
      - kind: unit
        ref: "tests/clientes/export-ids.test.ts (collectExportIds inalterado) + tests/clientes/exportacao.test.ts (buildClientesWorkbook inalterado)"
        status: pass
      - kind: manual_procedural
        ref: "Clicar 'Exportar' sem filtro e conferir ~2181 linhas na planilha; com filtro, conferir que reflete só a tela"
        status: unknown
    human_judgment: true
    rationale: "Verificação end-to-end da rota /api/clientes/exportar com escopoTudo contra o banco real não foi executada nesta sessão (sem servidor de preview com sessão autenticada disponível); tsc --noEmit e os testes puros existentes confirmam que a lógica compila e não quebrou os caminhos já cobertos, mas o round-trip real fica pendente de checagem humana."

duration: 25min
completed: 2026-09-15
status: complete
---

# Quick Task 260915-ls7: Cliente Ganho Sai do Kanban de Prospecção Summary

**Filtro no SQL (`.neq status_acompanhamento`) exclui cliente ganho das 7 colunas do Kanban de `/clientes`, via módulo puro `lib/funil/prospeccao.ts` testado por unidade, preservando a exportação completa com uma bandeira `escopoTudo` explicitamente não-autorizativa.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-15T15:52:00Z
- **Completed:** 2026-09-15T15:56:00Z
- **Tasks:** 3/3 completos
- **Files modified:** 6 (2 criados, 4 modificados)

## Accomplishments

- `lib/funil/prospeccao.ts` criado: fonte única (`STATUS_FORA_DA_PROSPECCAO` + `apareceNaProspeccao`) da regra "ganho sai do funil de prospecção", com comentário explicando exibição x autorização.
- `getClientesAgrupadosPorEtapa` agora filtra `status_acompanhamento != 'ganho'` no SQL (antes da paginação/`.range`) e reaplica a mesma regra como guarda no laço de agrupamento — duas aplicações, uma fonte.
- Texto de tela vazia de `/clientes` corrigido para não afirmar "nenhum cliente cadastrado" quando na verdade só existem clientes ganhos (agora cita a Agenda).
- Rota `/api/clientes/exportar` aceita `escopoTudo` (comparação estrita com `true`) e `KanbanBoard.handleExport` manda essa bandeira quando a tela não está filtrada — preserva o alcance de ~2181 clientes na exportação "tudo", mesmo com o Kanban agora mostrando só ~429.

## Task Commits

Each task was committed atomically:

1. **Task 1: Módulo puro com a regra de visibilidade do funil de prospecção + testes** - `281ff0b` (test)
2. **Task 2: Excluir cliente ganho da leitura do Kanban + corrigir o texto de tela vazia** - `b4810b9` (fix)
3. **Task 3: Preservar o alcance da exportação da tela de Clientes** - `5aeffe5` (feat)

**Plan metadata:** pending (docs commit handled by orchestrator)

## Files Created/Modified

- `lib/funil/prospeccao.ts` - Módulo puro: `STATUS_FORA_DA_PROSPECCAO` + `apareceNaProspeccao()`
- `tests/clientes/prospeccao.test.ts` - 5 testes cobrindo os 3 status possíveis
- `lib/supabase/queries/clientes.ts` - `.neq("status_acompanhamento", STATUS_FORA_DA_PROSPECCAO)` no SQL de `getClientesAgrupadosPorEtapa` + guarda `apareceNaProspeccao` no laço de agrupamento + comentário de exibição-x-autorização
- `app/(app)/clientes/page.tsx` - Texto de tela vazia corrigido (cita a Agenda)
- `app/api/clientes/exportar/route.ts` - Aceita `escopoTudo` (bool estrito), chama `getClientesParaExportacao(null)` sem exigir `ids` nesse caminho
- `components/clientes/KanbanBoard.tsx` - `handleExport` manda `{ escopoTudo: true }` quando `hasActiveFilters === false`, senão continua com `{ ids: collectExportIds(filteredGrouped) }`

## Decisions Made

- Filtro por `status_acompanhamento`, nunca por etapa — já travado no plano, seguido à risca.
- Filtro no SQL, não no navegador — mantém o ganho de egress da paginação (quick task 260914-ng5).
- Zero migration/RLS/RPC — regra de exibição, documentada explicitamente no código.
- `escopoTudo` como bandeira booleana estrita (`=== true`), nunca coerção — evita qualquer valor "verdadeiro por acaso" no corpo do POST abrir o caminho de exportação total.

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered

- Nenhum. `npx tsc --noEmit` compilou sem erro após as 4 edições e todos os testes puros relevantes (prospeccao, export-ids, paginacao, incompleto, exportacao) passaram em todas as rodadas.

### Limitação pré-existente do ambiente (não é regressão deste plano)

- `npx vitest run tests/clientes/rls-clientes.test.ts` falhou nesta sessão com `Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"` — este worktree isolado não tem `.env.local` com credenciais Supabase (o repositório principal tem, o worktree não). Isso é uma limitação do ambiente de execução isolado, não uma regressão de código: o plano já previa que os testes de RLS/rate-limit poderiam falhar por questão de ambiente/credenciais e pediu para registrar isso como limitação pré-existente, nunca como regressão. Não foi possível rodar `rls-exportacao.test.ts` pela mesma causa raiz.
- Verificação manual na aplicação rodando (passo 5 da seção `<verification>` do plano) não foi executada nesta sessão automática — não havia sessão autenticada disponível no ambiente isolado do worktree para abrir `/clientes`, a Agenda e a exportação de fato. Marcado como `human_judgment: true` no bloco `coverage` (D1/D3) acima para o dono do projeto confirmar visualmente quando revisar a mudança.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Kanban de prospecção volta a mostrar só quem ainda está sendo trabalhado (~429 em vez de 2181), sem tocar em nenhuma leitura da Agenda/ficha/Diário/Dashboard.
- Pendência para o dono do projeto confirmar visualmente (sem bloquear o merge): abrir `/clientes` e conferir a contagem da coluna "1ª venda concluída"; testar o botão "Exportar" com e sem filtro ativo.

---
*Phase: quick-260915-ls7*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: lib/funil/prospeccao.ts
- FOUND: tests/clientes/prospeccao.test.ts
- FOUND: lib/supabase/queries/clientes.ts
- FOUND: app/(app)/clientes/page.tsx
- FOUND: app/api/clientes/exportar/route.ts
- FOUND: components/clientes/KanbanBoard.tsx
- FOUND commit: 281ff0b
- FOUND commit: b4810b9
- FOUND commit: 5aeffe5
