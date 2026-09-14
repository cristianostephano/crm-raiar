---
phase: quick-260914-ng5
plan: 01
subsystem: database
tags: [supabase, postgrest, pagination, kanban, agenda, importacao]

requires:
  - phase: quick-260819-l6o
    provides: "getTodasCidades — padrão de leitura paginada específico para cidades, espelhado aqui de forma genérica"
provides:
  - "buscarPaginado (lib/supabase/queries/paginacao.ts) — paginador genérico reusável por qualquer leitura Supabase já filtrada/ordenada"
  - "5 pontos de leitura de clientes corrigidos para não truncar em 1000 linhas (Kanban, Agenda, exportação, 2x checagem de duplicado de importação)"
affects: [kanban, agenda, importacao, importacaoAtivos, exportacao]

tech-stack:
  added: []
  patterns:
    - "Paginador genérico via callback (buscarPagina) em vez de reimplementar o laço .range() em cada leitura — chamador monta a query, paginador só une as páginas"
    - ".order(\"id\", { ascending: true }) obrigatório como desempate em toda leitura paginada nova, garantindo ordem estável entre chamadas de .range()"

key-files:
  created:
    - lib/supabase/queries/paginacao.ts
    - tests/clientes/paginacao.test.ts
  modified:
    - lib/supabase/queries/clientes.ts
    - lib/supabase/queries/agenda.ts
    - app/actions/importacao.ts
    - app/actions/importacaoAtivos.ts

key-decisions:
  - "Paginador genérico único (buscarPaginado) em vez de 5 funções específicas — os 5 pontos leem a mesma tabela clientes com selects diferentes, então o chamador monta a query e só o laço de páginas é compartilhado."
  - "getClientesParaExportacao só pagina o caminho SEM ids (exportar tudo); o caminho COM ids (.in(\"id\", ids)) continua uma única chamada sem .range(), sem mudança."
  - "As 4 checagens de duplicado das importações usam um paginador local por arquivo (buscarClientesExistentesParaDedupe / buscarClientesExistentesCnpjParaDedupe) que embrulha buscarPaginado e devolve o mesmo formato { data, error } que os chamadores já checavam antes."

requirements-completed: [QUICK-260914-ng5]

coverage:
  - id: D1
    description: "Paginador genérico buscarPaginado criado, com 7 testes de unidade cobrindo união de páginas, parada em página curta, múltiplo exato, erro em qualquer página, lista vazia, e teto de páginas sem página curta."
    requirement: "QUICK-260914-ng5"
    verification:
      - kind: unit
        ref: "tests/clientes/paginacao.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "getClientesAgrupadosPorEtapa (Kanban) e getClientesParaExportacao (caminho sem ids) leem a base inteira de clientes via buscarPaginado, sem mudar assinatura pública nem RLS."
    requirement: "QUICK-260914-ng5"
    verification:
      - kind: other
        ref: "npx tsc --noEmit -p tsconfig.json"
        status: pass
    human_judgment: true
    rationale: "Sem servidor Supabase local com >1000 clientes disponível neste ambiente para uma verificação end-to-end da contagem do Kanban — a correção segue byte-a-byte o padrão já testado de getTodasCidades, mas a contagem real (1752 na etapa 'primeira_venda') só é confirmável em produção/staging, listada como verificação manual não bloqueante no plano."
  - id: D3
    description: "getClientesSemDiaFixo (Agenda) lê a base inteira via buscarPaginado."
    requirement: "QUICK-260914-ng5"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-list.test.tsx"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-integracao.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "As 4 checagens de duplicado (validação + confirmação, nos dois fluxos de importação) leem a base inteira de clientes via paginadores locais que embrulham buscarPaginado."
    requirement: "QUICK-260914-ng5"
    verification:
      - kind: other
        ref: "npx tsc --noEmit -p tsconfig.json"
        status: pass
    human_judgment: true
    rationale: "Os testes de integração que exerceriam este caminho fim-a-fim (tests/importacao/rls-dedup-read.test.ts, tests/importacao/rls-importar-lote.test.ts) falham neste ambiente por credenciais/rate-limit de signInWithPassword — limitação pré-existente documentada em STATE.md e no plano 260914-k3g, não uma regressão desta mudança. A lógica de negócio em torno da leitura (nomesExistentesParaDedupe, findDuplicates, planConfirmacao) permanece coberta por testes de unidade que passam."

duration: 45min
completed: 2026-09-14
status: complete
---

# Quick Task 260914-ng5: Bug de escala na tabela `clientes` (paginação PostgREST) Summary

**Paginador genérico `buscarPaginado` (lib/supabase/queries/paginacao.ts) elimina o truncamento em 1000 linhas do PostgREST nos 5 pontos de leitura de `clientes` (Kanban, Agenda, exportação, e as 2 checagens de duplicado de importação).**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-14T20:04:00Z (aprox.)
- **Completed:** 2026-09-14T20:16:19Z
- **Tasks:** 4/4 completas
- **Files modified:** 6 (2 criados, 4 modificados)

## Accomplishments

- Criado `lib/supabase/queries/paginacao.ts` com `buscarPaginado<T>`, um paginador genérico que une múltiplas páginas de qualquer leitura Supabase já filtrada/ordenada pelo chamador (nunca devolve lista parcial disfarçada de completa).
- `getClientesAgrupadosPorEtapa` (Kanban) e `getClientesParaExportacao` (caminho "exportar tudo") agora leem a base inteira de `clientes`, corrigindo a contagem que hoje mostrava "571" em vez de 1752 na etapa "1ª venda concluída".
- `getClientesSemDiaFixo` (Agenda) agora lê a base inteira, corrigindo o teto artificial de "(1000)" na seção "Sem dia fixo definido".
- As 4 checagens de duplicado das duas telas de importação (Prospecção e Clientes Ativos) agora comparam cada linha nova contra TODOS os clientes já cadastrados, não só os primeiros 1000.
- Nenhuma assinatura pública, formato de retorno, ou postura de RLS mudou em nenhuma das 5 funções corrigidas.

## Task Commits

Cada task foi commitada atomicamente (Task 1 seguiu o ciclo RED/GREEN de TDD, 2 commits):

1. **Task 1 (RED): teste do paginador** — `3034ec1` (test)
2. **Task 1 (GREEN): paginador genérico buscarPaginado** — `e40cd85` (feat)
3. **Task 2: paginar Kanban + exportação (clientes.ts)** — `a617f74` (fix)
4. **Task 3: paginar Agenda "Sem dia fixo" (agenda.ts)** — `cc6c397` (fix)
5. **Task 4: paginar checagem de duplicado das importações** — `09bcd1b` (fix)

_Nota: nenhum commit de metadados (SUMMARY/STATE) foi feito nesta execução — o orquestrador cuida disso separadamente, conforme instruído._

## Files Created/Modified

- `lib/supabase/queries/paginacao.ts` — paginador genérico `buscarPaginado`, `TAMANHO_PAGINA_PADRAO`, `MAX_PAGINAS_PADRAO`.
- `tests/clientes/paginacao.test.ts` — 7 testes de unidade do paginador (sem Supabase real, dublê em memória).
- `lib/supabase/queries/clientes.ts` — `getClientesAgrupadosPorEtapa` e `getClientesParaExportacao` (caminho sem ids) migrados para `buscarPaginado`.
- `lib/supabase/queries/agenda.ts` — `getClientesSemDiaFixo` migrado para `buscarPaginado`.
- `app/actions/importacao.ts` — nova `buscarClientesExistentesParaDedupe`, reusada por `validarLoteImportacao` e `confirmarLoteImportacao`.
- `app/actions/importacaoAtivos.ts` — nova `buscarClientesExistentesCnpjParaDedupe`, reusada por `validarLoteAtivos` e `confirmarLoteAtivos`.

## Decisions Made

- Paginador genérico único (`buscarPaginado`) reusado pelos 5 pontos, em vez de 5 implementações específicas — evita reescrever o laço de páginas cinco vezes e evita tipar genericamente um `PostgrestFilterBuilder` que muda de shape a cada `.select()` diferente.
- `.order("id", { ascending: true })` adicionado como desempate (ou única ordenação, onde não havia nenhuma) em todo call site novo — `posicao`/`razao_social` não são garantidamente únicas, e sem um desempate único o PostgREST não garante ordem estável entre chamadas de `.range()` separadas.
- `getClientesParaExportacao`: extraído o texto de seleção comum (`CLIENTE_EXPORT_SELECT`) e reestruturada a função para obter `rows` por um dos dois caminhos (com/sem ids) antes do único `.map()` final — evita duplicar a lógica de mapeamento.

## Deviations from Plan

None - plano executado exatamente como escrito. O único ajuste foi de tipagem no teste (`simularBusca` sem anotação de retorno explícita, deixando o TypeScript inferir a assinatura de `vi.fn`), necessário para `npx tsc --noEmit` compilar sob strict mode — não muda comportamento nem cobertura de teste, incluído no mesmo commit da Task 2 por ter sido descoberto durante a verificação daquela task.

## Issues Encountered

- `tests/importacao/rls-dedup-read.test.ts`, `tests/importacao/rls-importar-lote.test.ts` e `tests/clientes/rls-exportacao.test.ts` falham neste ambiente com `signInAs(...) failed: Invalid login credentials` — limitação pré-existente de credenciais/rate-limit das contas seed de teste (`vendedor.a+test@raiar.local`), já documentada em STATE.md e no plano 260914-k3g. Não é uma regressão desta mudança: os testes de unidade que exercem a mesma lógica de negócio (`nomesExistentesParaDedupe`, `findDuplicates`, `planConfirmacao`, e os 190 outros testes do diretório `tests/importacao/`) passam normalmente. Registrado como limitação de ambiente, conforme instruído no item 3 de `<verification>` do plano.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Os 5 pontos de leitura de `clientes` não truncam mais em 1000 linhas; `buscarPaginado` fica disponível para qualquer leitura futura da base que precise do mesmo tratamento (mesmo padrão que `getTodasCidades` já demonstrava para `cidades`).
- Verificação manual pendente (não bloqueante, listada no plano): confirmar em produção/staging que o Kanban mostra 1752 na etapa "1ª venda concluída" e a Agenda mostra ~1752 em "Sem dia fixo definido".
- As 3 suítes de teste de integração RLS seguem bloqueadas pela limitação de credenciais do ambiente — re-executar quando as contas seed de teste forem renovadas/desbloqueadas.

## Self-Check: PASSED

Todos os 7 arquivos citados (criados/modificados/SUMMARY) confirmados em disco; todos os 5 commits de task (`3034ec1`, `e40cd85`, `a617f74`, `cc6c397`, `09bcd1b`) confirmados em `git log`.

---
*Quick task: 260914-ng5*
*Completed: 2026-09-14*
