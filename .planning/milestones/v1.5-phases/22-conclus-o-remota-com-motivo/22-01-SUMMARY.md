---
phase: 22-conclus-o-remota-com-motivo
plan: 01
subsystem: database
tags: [postgres, supabase, rls, plpgsql, rpc, trigger]

# Dependency graph
requires:
  - phase: 16-ficha-do-cliente-ativo-campos-e-di-rio
    provides: "padrão de lista editável de 4 policies (frequencias_pedido) copiado literalmente para a 6ª lista"
  - phase: 15-conclus-o-com-resumo-e-pr-xima-visita
    provides: "corpos atuais de concluir_tarefa_prospeccao/concluir_visita e dos dois gatilhos de auditoria, estendidos aqui"
provides:
  - "tabela motivos_conclusao_remota (6ª lista editável) com RLS 4-policy: leitura aberta a authenticated, escrita atrás de is_supervisor()"
  - "colunas opcionais tarefas.motivo_conclusao_remota_id e visitas.motivo_conclusao_remota_id"
  - "concluir_tarefa_prospeccao/concluir_visita aceitando p_motivo_conclusao_remota_id (default null, sempre no fim) — chamada antiga sem o parâmetro continua válida"
  - "revalidação server-side do motivo (existe + ativo) dentro das duas RPCs — a lista de opções da tela nunca é fronteira de autorização"
  - "tarefas_before_update_historico/visitas_after_update_historico resolvendo o motivo em nome legível no Diário no formato '[Nome do motivo] resumo'"
affects: [22-02-plano-configuracoes-motivos-conclusao-remota, 22-03-plano-tela-conclusao-remota]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gatilho de auditoria resolvendo FK de lista editável em texto legível antes de gravar em historico (lógica nova no projeto — motivo_perda nunca fez isso)"
    - "Guard de revalidação (existe + ativo) dentro do corpo do RPC de escrita, reaproveitando o mesmo estilo fail-closed do guard de resumo já existente"

key-files:
  created:
    - supabase/migrations/0022_conclusao_remota_com_motivo.sql
    - tests/configuracoes/rls-motivos-conclusao-remota.test.ts
    - tests/agenda/conclusao-remota-rpc.test.ts
  modified: []

key-decisions:
  - "CONC-02/03/04/05 deixados como Pending em REQUIREMENTS.md após este plano (não marcados Complete) — mesma convenção já travada nas Fases 9-01/19-01: o próprio source_audit do plano mostra que nenhum requisito fecha sozinho aqui, todos precisam dos planos 22-02/22-03 (UI) para ficarem funcionalmente cobertos."
  - "Apagar-antes-de-criar (drop function if exists <assinatura antiga> seguido de create function) nas duas RPCs de conclusão, nunca create or replace — mesma lição já documentada pela migration 0018 com mover_card_funil."
  - "Guarda de motivo inválido/desativado vive DENTRO das duas RPCs (fail-closed), não confia na lista de opções renderizada na tela."
  - "Texto do Diário é retrato congelado (D-04): renomear/desativar um motivo depois não reescreve histórico já gravado — mesmo comportamento de frequencias_pedido/motivo_perda."

patterns-established:
  - "6ª lista editável (motivos_conclusao_remota) segue exatamente a forma id/nome/ativo/created_at e as 4 policies das outras cinco — nenhuma variação de shape."

requirements-completed: []

coverage:
  - id: D1
    description: "Tabela motivos_conclusao_remota (6ª lista editável) com RLS 4-policy — leitura aberta a authenticated, escrita atrás de is_supervisor(), incluindo prova com sessão real de Vendedor"
    requirement: "CONC-03"
    verification:
      - kind: integration
        ref: "tests/configuracoes/rls-motivos-conclusao-remota.test.ts (11 casos, contra o banco real)"
        status: pass
    human_judgment: false
  - id: D2
    description: "concluir_tarefa_prospeccao/concluir_visita aceitam o motivo, gravam-no, recusam identificador inexistente/desativado, e a chamada antiga sem o parâmetro continua válida"
    requirement: "CONC-02"
    verification:
      - kind: integration
        ref: "tests/agenda/conclusao-remota-rpc.test.ts (13 casos: prospeccao, visita, presencial, identificador, invalido x2, assinatura x2, contra o banco real)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Concluir visita remotamente continua criando a próxima visita pela frequência do cliente, byte a byte igual à conclusão presencial (D-07)"
    requirement: "CONC-04"
    verification:
      - kind: integration
        ref: "tests/agenda/conclusao-remota-rpc.test.ts#visita"
        status: pass
    human_judgment: false
  - id: D4
    description: "Diário do cliente mostra o motivo em texto legível ('[Nome do motivo] resumo') nas duas origens, nunca o identificador cru; conclusão presencial permanece byte a byte idêntica"
    requirement: "CONC-05"
    verification:
      - kind: integration
        ref: "tests/agenda/conclusao-remota-rpc.test.ts#prospeccao, #visita, #identificador, #presencial"
        status: pass
    human_judgment: false
  - id: D5
    description: "Não-regressão: os quatro arquivos de teste de conclusão pré-existentes passam com zero diff (D-06) contra o banco já migrado"
    verification:
      - kind: integration
        ref: "tests/agenda/concluir-rpc.test.ts, tests/agenda/rls-conclusao.test.ts, tests/agenda/conclusao-validacao.test.ts, tests/agenda/agenda-rpc.test.ts"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-08-19
status: complete
---

# Phase 22 Plan 1: Migration da Conclusão Remota com Motivo Summary

**Migration 0022 aplicada em produção: 6ª lista editável (motivos_conclusao_remota), duas colunas de FK opcionais em tarefas/visitas, as duas RPCs de conclusão estendidas com apagar-antes-de-criar, e os dois gatilhos de auditoria resolvendo o motivo em nome legível no Diário — provado por 24 casos de integração contra o banco real, com zero regressão nos quatro arquivos de conclusão anteriores.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-19
- **Tasks:** 3/3 (Task 1 auto, Task 2 checkpoint humano, Task 3 auto)
- **Files created:** 3 (1 migration + 2 arquivos de teste)

## Accomplishments

- Tabela nova `motivos_conclusao_remota` (6ª lista editável do projeto), cópia estrutural literal de `motivos_perda`/`frequencias_pedido`, com as mesmas 4 regras de acesso — leitura aberta a qualquer autenticado, escrita atrás de `is_supervisor()` — e cinco valores de partida.
- Colunas opcionais `tarefas.motivo_conclusao_remota_id` e `visitas.motivo_conclusao_remota_id`: chave preenchida é o próprio sinal de "foi remoto" (D-05), sem indicador booleano irmão.
- `concluir_tarefa_prospeccao`/`concluir_visita` apagadas e recriadas juntas, na mesma migration, com `p_motivo_conclusao_remota_id uuid default null` sempre no fim — a chamada antiga (sem esse argumento) continua válida, sem assinatura ambígua no PostgREST.
- Guarda nova dentro das duas RPCs: identificador de motivo que não exista ou não esteja ativo derruba a conclusão inteira — a lista de opções da tela nunca é fronteira de autorização.
- Os dois gatilhos de auditoria (`tarefas_before_update_historico`, `visitas_after_update_historico`) ganharam lógica nova (sem precedente no projeto): resolvem a FK do motivo em nome antes de gravar em `historico`, produzindo `[Nome do motivo] resumo` quando há motivo, e mantendo o texto de hoje byte a byte quando não há.
- O bloco de próxima visita dentro de `concluir_visita` permanece intocado (D-07/CONC-04) — verificado mecanicamente pelo recorte de região no script de checagem.
- Migration aplicada em produção via `supabase db push` (rodado diretamente pelo dono do projeto, mesmo padrão das Fases 18/19/21) e os dois arquivos de teste novos passaram GREEN contra o banco real, junto com os quatro arquivos de conclusão pré-existentes com zero diff.

## Task Commits

1. **Task 1: Migration da conclusão remota + testes de integração (vermelhos até o push)** - `25303f0` (feat)
2. **Task 2: Aprovação humana — aplicar a migration no banco Supabase de produção** - checkpoint humano; aprovado pelo dono do projeto, que também executou `npx -y supabase@2.111.0 db push` diretamente (classificador de modo automático deste ambiente bloqueia o push a partir de um subagente, mesmo padrão das Fases 18-01/19-01/21-01).
3. **Task 3: Aplicar a migration e levar os testes a GREEN** - sem commit próprio: nenhum arquivo precisou de correção pós-push (todos os 6 arquivos de risco passaram verdes na primeira tentativa); o resultado está documentado abaixo.

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified

- `supabase/migrations/0022_conclusao_remota_com_motivo.sql` - tabela nova + 4 policies + 5 valores iniciais + 2 colunas de FK + as 2 funções de conclusão apagadas-e-recriadas + os 2 gatilhos de auditoria recriados
- `tests/configuracoes/rls-motivos-conclusao-remota.test.ts` - contrato de acesso da 6ª lista (seed, vendedorle, vendedorescreve, supervisorescreve, nomeunico, anonimo)
- `tests/agenda/conclusao-remota-rpc.test.ts` - integração das duas RPCs estendidas (prospeccao, visita, presencial, identificador, invalido x2, assinatura x2)

## Decisions Made

- CONC-02/03/04/05 deixados como **Pending** em REQUIREMENTS.md — este plano é só a camada de banco; o próprio `source_audit` do plano já registra que nenhum dos quatro requisitos fecha sozinho, todos precisam dos planos 22-02 (aba de Configurações) e/ou 22-03 (tela de conclusão) para ficarem funcionalmente cobertos. Mesma convenção já travada nas Fases 9-01/19-01 para requisitos multi-plano.
- Apagar-antes-de-criar (`drop function if exists <assinatura antiga>` seguido de `create function`) nas duas RPCs, nunca `create or replace` — lição já documentada pela migration 0018 (`mover_card_funil`): mudar a contagem de parâmetros com `create or replace` cria uma segunda função e derruba toda chamada existente por ambiguidade.
- Guarda de motivo inválido/desativado vive dentro do corpo das duas RPCs (fail-closed), com a mesma postura do guard de resumo já existente — a chave estrangeira sozinha não bastaria para barrar um motivo já desativado.
- Texto gravado no Diário é retrato congelado (D-04) — renomear/desativar um motivo depois de uma conclusão não reescreve o histórico já gravado, mesmo comportamento já travado para `frequencias_pedido`/`motivo_perda`.

## Deviations from Plan

None - plan executado exatamente como escrito. Todos os 6 arquivos de teste de risco (os 2 novos + os 4 de conclusão pré-existentes) passaram GREEN na primeira execução pós-push, sem necessidade de migration corretiva nem edição de teste.

## Issues Encountered

None. O push foi executado diretamente pelo dono do projeto após o classificador de modo automático deste ambiente bloquear a tentativa do executor (comportamento já esperado e documentado nas notas do plano, mirando o mesmo fluxo das Fases 18-01/19-01/21-01).

## User Setup Required

None - nenhuma configuração externa nova. A migration já foi aplicada em produção pelo dono do projeto.

## Next Phase Readiness

- O banco de produção já sabe guardar e exibir o motivo de uma conclusão remota nas duas origens (tarefa de prospecção e visita) — os planos 22-02 (aba "Motivos de conclusão remota" em Configurações) e 22-03 (tela de conclusão com o campo de escolha) já têm chão para construir em cima.
- Interface publicada por este plano (nomes de tabela/colunas/parâmetros, formato do texto do Diário) está travada e documentada no bloco `<interface_context>` do 22-01-PLAN.md — os planos seguintes devem reusá-la literalmente, sem inventar nome próprio.
- Nenhum bloqueio conhecido para 22-02/22-03.

---
*Phase: 22-conclus-o-remota-com-motivo*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `supabase/migrations/0022_conclusao_remota_com_motivo.sql`
- FOUND: `tests/agenda/conclusao-remota-rpc.test.ts`
- FOUND: `tests/configuracoes/rls-motivos-conclusao-remota.test.ts`
- FOUND: `.planning/phases/22-conclus-o-remota-com-motivo/22-01-SUMMARY.md`
- FOUND: commit `25303f0` in git log
