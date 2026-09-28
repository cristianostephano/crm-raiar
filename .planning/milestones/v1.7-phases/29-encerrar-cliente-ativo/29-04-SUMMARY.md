---
phase: 29-encerrar-cliente-ativo
plan: 04
subsystem: api
tags: [typescript, server-actions, kanban, supabase-rpc]

requires:
  - phase: 29-encerrar-cliente-ativo (plan 03)
    provides: "status 'encerrado' vivo em produção (migrations 0035/0036/0037), RPC mover_card_funil com 8 parâmetros"
provides:
  - "StatusAcompanhamento com 'encerrado' + rótulo 'Encerrado' na exportação (D-01)"
  - "STATUS_FORA_DA_PROSPECCAO_LISTA com 3 status — encerrado nunca aparece no Kanban (D-13)"
  - "marcarStatus estendido: pré-checagens de encerrar (D-04/ENCR-02), frequência efetiva (D-10, destrava 'Reativar' de um toque), revalidação de /agenda (D-12)"
affects: [29-encerrar-cliente-ativo (plans 05, 06, 07)]

tech-stack:
  added: []
  patterns:
    - "Frequência EFETIVA (parâmetro senão valor gravado, ambos revalidados por isFrequenciaVisita) — mesmo padrão já usado para cnpjEfetivo, agora estendido para não bloquear a reativação sem frequência gravada"

key-files:
  created:
    - tests/clientes/exportacao-status-encerrado.test.ts
    - tests/funil/reativar-guard.test.ts
  modified:
    - lib/supabase/queries/clientes.ts
    - lib/clientes/exportacao.ts
    - lib/funil/prospeccao.ts
    - app/actions/funil.ts
    - tests/clientes/prospeccao.test.ts
    - tests/clientes/kanban-sem-perdidos.test.ts
    - tests/clientes/filtro-prospeccao-postgrest.test.ts

key-decisions:
  - "Espelho exato do padrão de STATUS_FORA_DA_PROSPECCAO_LISTA já estabelecido na Fase 28 (de 1 para 2, agora de 2 para 3 status) — nenhuma mudança de forma na guarda do laço nem no filtro SQL"
  - "marcarStatus ganha o 6º parâmetro motivoEncerramentoId no FIM da assinatura — nenhuma chamada existente muda"

requirements-completed: [ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05]

coverage:
  - id: D1
    description: "StatusAcompanhamento inclui 'encerrado'; STATUS_LABELS da exportação mostra 'Encerrado' (D-01)"
    requirement: "ENCR-01"
    verification:
      - kind: unit
        ref: "tests/clientes/exportacao-status-encerrado.test.ts (rotulo-encerrado, rotulos-antigos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "STATUS_FORA_DA_PROSPECCAO_LISTA = ['ganho', 'perdido', 'encerrado'] — encerrado nunca aparece nas 7 colunas do Kanban, provado com mock e ao vivo contra o banco de produção real"
    requirement: "ENCR-03"
    verification:
      - kind: unit
        ref: "tests/clientes/prospeccao.test.ts, tests/clientes/kanban-sem-perdidos.test.ts"
        status: pass
      - kind: integration
        ref: "tests/clientes/filtro-prospeccao-postgrest.test.ts (contra produção real)"
        status: pass
    human_judgment: false
  - id: D3
    description: "marcarStatus recusa encerrar sem motivo e sem estar em 'Ganho'; com motivo, manda p_motivo_encerramento_id à RPC (D-04/ENCR-02)"
    requirement: "ENCR-02"
    verification:
      - kind: unit
        ref: "tests/funil/reativar-guard.test.ts (encerrar-exige-motivo, encerrar-so-de-ganho, encerrar-ok)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Frequência efetiva: 'Reativar' de um toque funciona com frequência gravada e sem frequência gravada (restaura ganho sem frequência); fora da reativação, ganho sem frequência continua bloqueado; parâmetro sempre vence sobre o gravado (D-10/ENCR-05)"
    requirement: "ENCR-05"
    verification:
      - kind: unit
        ref: "tests/funil/reativar-guard.test.ts (reativar-usa-frequencia-gravada, reativar-sem-frequencia-restaura, ganho-comum-sem-frequencia-bloqueia, ganho-comum-parametro-vence)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Na reativação, CNPJ/razão social/endereço continuam exigidos quando a ficha está incompleta (D-11)"
    requirement: "ENCR-05"
    verification:
      - kind: unit
        ref: "tests/funil/reativar-guard.test.ts (reativar-ficha-incompleta)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Em qualquer sucesso de marcarStatus, /agenda é revalidada junto de /clientes (D-12, critério 2)"
    requirement: "ENCR-04"
    verification:
      - kind: unit
        ref: "tests/funil/reativar-guard.test.ts (revalida-agenda)"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-27
status: complete
---

# Phase 29 Plan 4: Kanban + marcarStatus com "Encerrado" Summary

**Status "encerrado" ligado ao tipo do app e à exportação (D-01), excluído das 7 colunas do Kanban pela mesma fonte única de ganho/perdido (D-13), e `marcarStatus` estendido com as pré-checagens de encerrar, motivo obrigatório, frequência efetiva (destrava o "Reativar" de um toque, D-10) e revalidação da Agenda (D-12) — tudo provado por 33 testes automatizados (10 novos + 23 atualizados/reconfirmados), incluindo 2 ao vivo contra o banco de produção real.**

## Performance

- **Duration:** ~25min
- **Tasks:** 3/3
- **Files modified:** 7 (2 criados, 5 atualizados)

## Accomplishments

- `StatusAcompanhamento` (lib/supabase/queries/clientes.ts) ganha o valor `"encerrado"`; `STATUS_LABELS` da exportação (lib/clientes/exportacao.ts) mostra "Encerrado" na planilha.
- `STATUS_FORA_DA_PROSPECCAO_LISTA` (lib/funil/prospeccao.ts) passa de `["ganho", "perdido"]` para `["ganho", "perdido", "encerrado"]` — cliente encerrado nunca aparece nas 7 colunas do Kanban, tanto no filtro SQL (`getClientesAgrupadosPorEtapa`) quanto na guarda do laço, e isso foi confirmado ao vivo contra o banco de produção com um 4º cliente semeado já encerrado.
- `marcarStatus` (app/actions/funil.ts) ganha:
  - `MarcarStatusErrorCode` com `"encerramento_travado"`;
  - 6º parâmetro `motivoEncerramentoId?: string`;
  - select ampliado com `frequencia_visita`;
  - pré-checagem "só é possível encerrar quem já está como Ganho" e "motivo do encerramento é obrigatório";
  - frequência EFETIVA (parâmetro senão gravada) usada tanto na pré-checagem quanto no parâmetro da RPC, com a condição de reativação (`novoStatus === "ganho" && status atual === "encerrado"`) dispensando a exigência quando não há frequência gravada;
  - chamada da RPC `mover_card_funil` com `p_motivo_encerramento_id`;
  - `revalidatePath("/agenda")` somado a `revalidatePath("/clientes")` em qualquer sucesso.
- `getClientesSemDiaFixo` (lib/supabase/queries/agenda.ts) confirmado intacto (guarda de regressão do D-12) — continua filtrando só `"ganho"`, sem mudança de código.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Tipo StatusAcompanhamento com "encerrado" e rótulo "Encerrado" na exportação (D-01)** - `b2ac8e1` (feat) — RED (undefined) → GREEN
2. **Tarefa 2: Regra de prospecção com 3 status — encerrado nunca aparece no Kanban (D-13)** - `3888ced` (feat) — RED → GREEN, incluindo o teste ao vivo contra produção
3. **Tarefa 3: marcarStatus — pré-checagens de encerrar, motivo novo, frequência efetiva e revalidação da Agenda** - `8676a2a` (feat) — RED (8/10 falhando) → GREEN (10/10)

_Nenhum commit de `.planning/` foi feito por esta subagent — este SUMMARY.md e a atualização de STATE.md/ROADMAP.md ficam a cargo do orquestrador._

## Files Created/Modified

- `lib/supabase/queries/clientes.ts` - `StatusAcompanhamento` ganha `"encerrado"`; doc-comments de `getClientesAgrupadosPorEtapa` citam a tela Encerrados (texto só, leitura intacta)
- `lib/clientes/exportacao.ts` - `STATUS_LABELS.encerrado = "Encerrado"`
- `lib/funil/prospeccao.ts` - `STATUS_FORA_DA_PROSPECCAO_LISTA` com 3 valores; cabeçalho estendido
- `app/actions/funil.ts` - `marcarStatus` com guards de encerrar, frequência efetiva, revalidação de `/agenda`
- `tests/clientes/exportacao-status-encerrado.test.ts` - novo (2 casos)
- `tests/clientes/prospeccao.test.ts` - atualizado (6 casos, 1 novo)
- `tests/clientes/kanban-sem-perdidos.test.ts` - atualizado (3 casos)
- `tests/clientes/filtro-prospeccao-postgrest.test.ts` - atualizado, 4º cliente encerrado semeado ao vivo
- `tests/funil/reativar-guard.test.ts` - novo (10 casos)

## Decisions Made

None - plan executado exatamente como escrito. As duas decisões de projeto envolvidas (D-10/reativação sem frequência e D-04/motivo obrigatório) já tinham sido travadas nos planos 29-01/29-03 e só foram implementadas aqui.

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhuma correção de Regra 1/2/3 foi necessária; o código de produção seguiu a `<action>` de cada tarefa literalmente.

Um único ajuste cosmético dentro da própria Tarefa 3: o parâmetro `p_motivo_encerramento_id` da chamada da RPC foi inicialmente formatado em duas linhas pelo editor; reformatado para uma linha só, para bater com o grep de aceitação do plano e manter o mesmo estilo dos demais parâmetros da mesma chamada. Sem efeito de comportamento — mesmo valor, mesma expressão.

## Issues Encountered

Durante a Tarefa 1, `npx tsc --noEmit` (comando de verificação do plano) reportou um erro em dois arquivos de teste fora do escopo desta dispatch (`tests/funil/encerrados-item-row.test.tsx`, `tests/funil/encerrados-periodo-filter.test.tsx`), pertencentes a uma dispatch concorrente do plano **29-07** rodando em paralelo no mesmo checkout (sem isolamento de worktree, conforme instrução desta dispatch — STATE.md registra Wave 3 = 29-04 + 29-07). Esses arquivos estavam em fase RED (teste escrito, componente ainda não implementado pela outra dispatch) e não faziam parte dos `files_modified` deste plano. Tratado como descoberta fora de escopo (SCOPE BOUNDARY): não foi corrigido por esta dispatch, apenas confirmado (por `grep -v`) que nenhum outro erro de `tsc` vinha das mudanças deste plano. Ao final da Tarefa 3, a dispatch concorrente já tinha implementado os componentes (`components/encerrados/EncerradosItemRow.tsx`, `EncerradosPeriodoFilter.tsx`) e o erro desapareceu por conta própria — `npx tsc --noEmit` roda limpo agora, sem nenhuma ação desta dispatch sobre esses arquivos.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `marcarStatus` é agora o único caminho de escrita que a ficha (29-06, "Encerrar") e a tela Encerrados (29-07, "Reativar") vão consumir — contrato publicado: `marcarStatus(clienteId, novoStatus, motivoPerdaId?, frequenciaVisita?, cnpj?, motivoEncerramentoId?)`.
- `StatusAcompanhamento` inclui `"encerrado"` em todo o app; a exportação já mostra o rótulo correto.
- Nenhum bloqueio conhecido para os planos 29-05/29-06/29-07. A dispatch concorrente do 29-07 (rodando em paralelo, sem isolamento de worktree) não tocou nenhum arquivo deste plano — `git log` confirma commits intercalados sem sobreposição de arquivos.

## Self-Check: PASSED

- FOUND: lib/supabase/queries/clientes.ts (StatusAcompanhamento com "encerrado")
- FOUND: lib/clientes/exportacao.ts (STATUS_LABELS.encerrado)
- FOUND: lib/funil/prospeccao.ts (STATUS_FORA_DA_PROSPECCAO_LISTA com 3 valores)
- FOUND: app/actions/funil.ts (motivoEncerramentoId, frequenciaEfetiva, revalidatePath("/agenda"))
- FOUND: tests/clientes/exportacao-status-encerrado.test.ts
- FOUND: tests/funil/reativar-guard.test.ts
- FOUND commit b2ac8e1
- FOUND commit 3888ced
- FOUND commit 8676a2a
- 50/50 testes verdes no comando de verificação completo do plano (incluindo o teste ao vivo contra produção)

---
*Phase: 29-encerrar-cliente-ativo*
*Completed: 2026-09-27*
