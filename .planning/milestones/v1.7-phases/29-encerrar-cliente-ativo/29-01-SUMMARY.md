---
phase: 29-encerrar-cliente-ativo
plan: 01
subsystem: database
tags: [postgres, supabase, rls, rpc, plpgsql, lgpd]

requires: []
provides:
  - "Migration 0035: valor 'encerrado' isolado em status_acompanhamento_enum (único comando, re-executável)"
  - "Migration 0036: 7a lista editável motivos_encerramento (RLS 4-policy) + clientes.motivo_encerramento_id + 2 CHECKs de integridade (chk_encerrado_exige_motivo, chk_encerrado_somente_etapa_final) + mover_card_funil de 8 parâmetros (guards de encerrar/reativar, frequência liberada só na reativação) + agenda_do_vendedor filtrando encerrado nas duas metades + clientes_encerrados (leitura, LGPD-safe)"
  - "tests/funil/encerrados-rpc.test.ts: 25 casos de integração contra o banco real (RED até o push do 29-03)"
affects: [29-encerrar-cliente-ativo (plans 03, 04, 05, 06, 07)]

tech-stack:
  added: []
  patterns:
    - "Enum novo sempre em duas migrations: a primeira contém SOMENTE o ALTER TYPE ADD VALUE (re-executável), a segunda (aplicada depois de committed) usa o literal livremente — evita o erro 'unsafe use of new value' do Postgres"
    - "Guard de frequência obrigatória (VIS-01) condicionado a 'status atual is distinct from X' em vez de checar só a transição de destino — permite abrir uma exceção estreita (reativar restaura o estado anterior) sem afrouxar a regra geral"
    - "Guard de transição 'só é possível encerrar quem já está como ganho' aceita o próprio estado de destino como não-bloqueante (v_status_atual not in ('ganho', 'encerrado')) para não travar uma chamada idempotente"

key-files:
  created:
    - supabase/migrations/0035_status_encerrado_enum.sql
    - supabase/migrations/0036_encerrar_cliente_ativo.sql
    - tests/funil/encerrados-rpc.test.ts
  modified: []

key-decisions:
  - "Guard de frequência (VIS-01) movido para DEPOIS da leitura do estado atual em mover_card_funil (antes vinha antes) — necessário para a condição nova 'v_status_atual is distinct from encerrado' enxergar o status já lido; guards de CNPJ/razão social/endereço permanecem exatamente onde estavam e continuam condicionados a 'is distinct from ganho', então disparam também na reativação (D-11), sem edição"
  - "clientes_encerrados é cópia estrutural literal de clientes_perdidos (migration 0034, Fase 28) trocando só as colunas específicas de encerramento — mesmo padrão de leitura sem elevação de privilégio, sem checagem de papel, sem filtro de dono no corpo"
  - "requirements-completed deixado vazio nesta SUMMARY (ENCR-01..05 ficam Pending em REQUIREMENTS.md): este plano entrega só a fundação de banco + prova de integração; cada requisito só fecha funcionalmente depois dos planos 29-04/29-05/29-06/29-07 (Server Actions + UI), mesma convenção já travada nas Fases 9-01/19-01/20-01/25-01 para requisitos multi-plano"

patterns-established:
  - "Toda transição de status que pode ser revertida (ganho <-> encerrado) precisa decidir, guard por guard, se a condição de disparo é 'o destino pedido' ou 'o estado atual não é X' — os dois guards novos desta migration usam a segunda forma de propósito para que revert-then-reapply nunca duplique efeito nem trave sem necessidade"

requirements-completed: []

coverage:
  - id: D1
    description: "Migrations 0035 (enum isolado) e 0036 (lista de motivos + RLS + 2 CHECKs + mover_card_funil de 8 parâmetros + agenda_do_vendedor filtrando encerrado + clientes_encerrados), nenhuma função com elevação de privilégio, clientes_encerrados sem campo de contato"
    requirement: "ENCR-01"
    verification:
      - kind: unit
        ref: "script estrutural do bloco <verify> da Tarefa 1 do 29-01-PLAN.md (confere ausência de security definer/contato/telefone/email, presença de todas as 4 policies/2 CHECKs/8 parâmetros/2 filtros de encerrado/7 colunas do returns table)"
        status: pass
    human_judgment: false
  - id: D2
    description: "tests/funil/encerrados-rpc.test.ts — 25 casos de integração cobrindo motivos_encerramento (seed/RLS), encerrar (guards, histórico intacto, cross-vendedor), Agenda (some/contador), clientes_encerrados (LGPD, período, paginação, RLS) e reativar (com/sem frequência, guards preservados, Agenda de volta, idempotência)"
    requirement: "ENCR-02, ENCR-03, ENCR-04, ENCR-05"
    verification:
      - kind: integration
        ref: "tests/funil/encerrados-rpc.test.ts"
        status: unknown
    human_judgment: true
    rationale: "O arquivo está estruturalmente correto (tsc/eslint/script de casos limpos) mas fica VERMELHO contra o banco real até o plano 29-03 aplicar as migrations 0035/0036 — o resultado real da suíte só pode ser confirmado depois do push, não nesta dispatch."

duration: ~35min
completed: 2026-09-26
status: complete
---

# Phase 29 Plan 1: Fundação de Banco — Encerrar Cliente Ativo Summary

**Migrations 0035/0036 ensinam o banco o status "Encerrado" (enum isolado, 7a lista editável de motivos, 2 CHECKs, `mover_card_funil` de 8 parâmetros que encerra e reativa, `agenda_do_vendedor` filtrando encerrado, e a leitura `clientes_encerrados` sem dado de contato) — provado por 25 casos de integração, todos RED até o push do 29-03.**

## Performance

- **Duration:** ~35min
- **Completed:** 2026-09-26
- **Tasks:** 2/2
- **Files modified:** 3 (todos criados)

## Accomplishments
- `supabase/migrations/0035_status_encerrado_enum.sql` isola em um único comando (`alter type ... add value if not exists 'encerrado'`) a adição do valor novo ao enum, evitando o erro "unsafe use of new value" do Postgres quando a 0036 for aplicada logo em seguida.
- `supabase/migrations/0036_encerrar_cliente_ativo.sql`: 7a lista editável `motivos_encerramento` (RLS 4-policy, mesmo molde das outras seis), coluna `clientes.motivo_encerramento_id`, duas CHECKs (`chk_encerrado_exige_motivo`, `chk_encerrado_somente_etapa_final`), `mover_card_funil` recriada com o 8º parâmetro `p_motivo_encerramento_id` (dois guards novos de encerrar, guard de frequência reposicionado para permitir reativar sem frequência quando o estado anterior já era assim, guard de transição "só de ganho"), `agenda_do_vendedor` filtrando `status_acompanhamento <> 'encerrado'` nas duas metades do `union all`, e `clientes_encerrados` (leitura nova, 7 colunas, sem elevação de privilégio, sem campo de contato).
- `tests/funil/encerrados-rpc.test.ts` cobre os 25 comportamentos do plano: lista de motivos (seed, RLS de leitura/escrita), encerrar (guard de motivo, guard de etapa, guard "só de ganho", cross-vendedor, histórico intacto), Agenda (some da Lista/Calendário/contador do menu), `clientes_encerrados` (LGPD, RLS, período, paginação, cliente sem histórico), e reativar (com frequência, sem frequência restaurando o estado anterior, guard de ganho de verdade intacto, visita pendente reaparecendo, visita nova semeada, cross-vendedor).

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Migrations 0035/0036** - `36126ca` (feat)
2. **Tarefa 2: Testes de integração (RED)** - `f82f446` (test)

**Plan metadata:** pending (this SUMMARY's own commit, handled by the orchestrator)

## Files Created/Modified
- `supabase/migrations/0035_status_encerrado_enum.sql` - Único comando: adiciona 'encerrado' a status_acompanhamento_enum
- `supabase/migrations/0036_encerrar_cliente_ativo.sql` - motivos_encerramento + RLS + seed, coluna, 2 CHECKs, mover_card_funil (8 params), agenda_do_vendedor, clientes_encerrados
- `tests/funil/encerrados-rpc.test.ts` - 25 casos de integração (RED até o push)

## Decisions Made
Ver `key-decisions` no frontmatter: guard de frequência reposicionado para depois da leitura do estado atual (necessário para a exceção de reativação sem frequência); `clientes_encerrados` copiada estruturalmente de `clientes_perdidos`; requisitos ENCR-01..05 deixados Pending em REQUIREMENTS.md (fecham só depois dos planos de UI/Server Action).

## Deviations from Plan

None - plan executed exactly as written. Todas as travas, guards, mensagens e nomes de coluna seguem literalmente o contrato do bloco `<interfaces>` do PLAN.md.

## Issues Encountered
Um ajuste de disciplina de teste (não um desvio de plano): a primeira versão do comentário de cabeçalho do arquivo de teste mencionava "console.log/console.table" em prosa para explicar a regra de não imprimir dados reais — isso disparava falsamente o próprio grep de proibição de `console.(log|info|dir|table)` do script de verificação da Tarefa 2. Reescrito para descrever a regra sem usar o padrão literal proibido; nenhum código de teste foi afetado, só o comentário.

## User Setup Required

None - no external service configuration required. Nenhuma migration foi aplicada nesta dispatch (`supabase db push` explicitamente fora de escopo) — a aplicação de 0035/0036 (junto com 0037 do plano 29-02) acontece no plano 29-03, que reúne a aprovação do dono do projeto para as três migrations da fase de uma vez só.

## Next Phase Readiness

- Migrations 0035/0036 e o teste de integração estão prontos para a aprovação e o `supabase db push` do plano 29-03 (junto com 0037 do plano 29-02).
- `tests/funil/encerrados-rpc.test.ts` fica VERMELHO até esse push — esperado, documentado no bloco `coverage` acima (`D2`, `human_judgment: true`) para o verificador confirmar o resultado real depois da aplicação.
- A interface publicada neste plano (8 parâmetros de `mover_card_funil`, 7 colunas de `clientes_encerrados`, nomes/mensagens exatas) é o contrato que os planos 29-04 (Server Action `marcarStatus`), 29-05 (camada de dados de Encerrados) e 29-06 (diálogo de motivo na ficha) consomem sem reabrir — nenhuma coluna ou parâmetro a mais deve ser suposto por eles.

## Self-Check: PASSED

- FOUND: supabase/migrations/0035_status_encerrado_enum.sql
- FOUND: supabase/migrations/0036_encerrar_cliente_ativo.sql
- FOUND: tests/funil/encerrados-rpc.test.ts
- FOUND: .planning/phases/29-encerrar-cliente-ativo/29-01-SUMMARY.md
- FOUND commit: 36126ca (feat(29-01): migrations 0035/0036)
- FOUND commit: f82f446 (test(29-01): testes de integração RED)

---
*Phase: 29-encerrar-cliente-ativo*
*Completed: 2026-09-26*
