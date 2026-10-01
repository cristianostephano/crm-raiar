---
phase: 31-agenda-2-visitas-manuais-na-lista
plan: 01
subsystem: database
tags: [postgres, rls, supabase, lgpd, agenda2]

requires:
  - phase: 10-desativa-o-de-membro-da-equipe
    provides: "is_supervisor() exigindo ativo = true; padrão vendedor/supervisor ativo nas policies de escrita"
  - phase: 30-ader-ncia-de-uso-no-dashboard
    provides: "precedente de migration com tabela pessoal mínima + RLS + comentário LGPD (0038_acessos_diarios.sql)"
provides:
  - "Tabela agenda2_itens (8 colunas) com RLS assimétrica: SELECT dono-ou-supervisor, INSERT/UPDATE/DELETE dono-e-vendedor-ativo"
  - "Gatilho agenda2_itens_carimbos() — criado_em/atualizado_em sempre do servidor, sem elevação de privilégio"
  - "tests/agenda2/migracao-agenda2.test.ts — 13 casos estruturais verdes sem banco"
  - "tests/agenda2/rls-agenda2.test.ts — 20 casos de integração contra o banco real, vermelhos até a aplicação da migration (plano 31-03)"
affects: [31-02, 31-03, 31-04, 31-05, 31-08]

tech-stack:
  added: []
  patterns:
    - "RLS assimétrica dono-escreve/role-privilegiada-só-lê: escrita exige `vendedor_id = (select auth.uid())` E `exists (select 1 from profiles p where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true)` — não basta `and not is_supervisor()`, pois um vendedor DESATIVADO com sessão ainda válida não é supervisor e continuaria passando nessa checagem mais fraca"
    - "Um gatilho só (BEFORE INSERT OR UPDATE) decide os dois carimbos: criado_em forçado só no INSERT, atualizado_em renovado em todo INSERT/UPDATE, criado_em preservado no UPDATE via old.criado_em"
    - "Constraint de 'sem sequência de documento': `regexp_replace(coluna, '[./[:space:]-]', '', 'g') !~ '[0-9]{8,}'` — remove separadores comuns de CPF/CNPJ/telefone/CEP antes de checar 8+ dígitos consecutivos, sem usar barra invertida na classe de caracteres"

key-files:
  created:
    - supabase/migrations/0048_agenda2_itens.sql
    - tests/agenda2/migracao-agenda2.test.ts
    - tests/agenda2/rls-agenda2.test.ts
  modified: []

key-decisions:
  - "Escrita exige vendedor ATIVO (exists com p.role='vendedor' and p.ativo=true), não apenas 'not is_supervisor()' — corrige a proposta original da pesquisa, que deixaria um vendedor desativado com sessão ainda válida continuar gravando"
  - "Limites de tamanho usam text + constraint char_length(btrim(...)) between 1 and N (120 nome / 60 bairro), igual ao precedente de tarefas.resumo (migration 0015), em vez de varchar(n)"
  - "Carimbos sempre do servidor: um único gatilho BEFORE INSERT OR UPDATE cobre os dois casos (a pesquisa só previa o gatilho de UPDATE); sem isso um vendedor poderia forjar criado_em pela API e bagunçar a ordem de criação (D-08)"
  - "vendedor_id ... on delete cascade: conta apagada leva os itens; conta só desativada (D-19) mantém os itens visíveis ao Supervisor, sem transferência"
  - "Nenhum descarte automático nesta fase — prazo de guarda dos dados do piloto (LGPD) segue pendente de decisão do dono do projeto (ver Alerta LGPD abaixo)"

patterns-established:
  - "Primeira tabela do projeto com RLS 'dono escreve, uma segunda role só lê o time inteiro' (Pattern 1 do 31-RESEARCH.md) — diferente de clientes (CRUD completo para ambas as roles) e de acessos_diarios (só-leitura para ninguém escrever direto)"

requirements-completed: [AGD2-01, AGD2-03, AGD2-04, AGD2-05, AGD2-07]

coverage:
  - id: D1
    description: "Migration 0048 cria agenda2_itens com exatamente 8 colunas (LGPD), 4 constraints de tamanho/privacidade e índice de apoio"
    requirement: "AGD2-01"
    verification:
      - kind: unit
        ref: "tests/agenda2/migracao-agenda2.test.ts#colunas-minimas"
        status: pass
      - kind: unit
        ref: "tests/agenda2/migracao-agenda2.test.ts#limites-de-tamanho"
        status: pass
      - kind: unit
        ref: "tests/agenda2/migracao-agenda2.test.ts#sem-sequencia-de-documento"
        status: pass
    human_judgment: false
  - id: D2
    description: "RLS assimétrica: SELECT dono-ou-supervisor; INSERT/UPDATE/DELETE exigem dono E vendedor ativo, nunca Supervisor (D-16)"
    requirement: "AGD2-07"
    verification:
      - kind: unit
        ref: "tests/agenda2/migracao-agenda2.test.ts#select-dono-ou-supervisor"
        status: pass
      - kind: unit
        ref: "tests/agenda2/migracao-agenda2.test.ts#escrita-so-vendedor-ativo"
        status: pass
      - kind: integration
        ref: "tests/agenda2/rls-agenda2.test.ts#supervisor-nao-cria/supervisor-nao-edita/supervisor-nao-apaga"
        status: fail
    human_judgment: true
    rationale: "Os 20 casos de integração contra o banco real estão escritos e corretos, mas ficam VERMELHOS de propósito até o plano 31-03 aplicar a migration 0048 no projeto hospedado (não há banco de teste separado — é o mesmo projeto de produção). A prova real de RLS só fecha depois dessa aplicação; verify-work deve reclassificar como comprovado só após o 31-03."
  - id: D3
    description: "Carimbos criado_em/atualizado_em sempre reescritos pelo servidor via gatilho, sem elevação de privilégio"
    verification:
      - kind: unit
        ref: "tests/agenda2/migracao-agenda2.test.ts#carimbos-do-servidor"
        status: pass
      - kind: integration
        ref: "tests/agenda2/rls-agenda2.test.ts#carimbos-do-servidor"
        status: fail
    human_judgment: true
    rationale: "Mesmo motivo do D2 — caso de integração correto, vermelho até o 31-03 aplicar a migration."
  - id: D4
    description: "Inventário de funções com elevação de privilégio permanece em 11 (nenhuma exceção nova criada por esta fase)"
    verification:
      - kind: unit
        ref: "tests/agenda2/migracao-agenda2.test.ts#inventario-elevacao-inalterado"
        status: pass
    human_judgment: false

duration: ~11min
completed: 2026-10-01
status: complete
---

# Phase 31 Plan 1: Migration agenda2_itens + RLS assimétrica Summary

**Tabela `agenda2_itens` (8 colunas mínimas, LGPD) com RLS assimétrica dono-escreve/Supervisor-só-lê e carimbos sempre do servidor; 13 testes estruturais verdes e 20 testes de integração escritos (vermelhos até a aplicação manual no plano 31-03).**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-10-01T12:17:32Z
- **Completed:** 2026-10-01T12:28:02Z
- **Tasks:** 2
- **Files modified:** 3 (todos criados, nenhum arquivo existente alterado)

## Accomplishments
- `supabase/migrations/0048_agenda2_itens.sql` criada: tabela `agenda2_itens` (id, vendedor_id, nome_cliente, bairro, data, concluido, criado_em, atualizado_em), 4 constraints (`chk_agenda2_nome_cliente_tamanho`, `chk_agenda2_bairro_tamanho`, `chk_agenda2_nome_cliente_sem_documento`, `chk_agenda2_bairro_sem_documento`), índice `idx_agenda2_itens_vendedor_data`, RLS com 4 policies assimétricas e gatilho `agenda2_itens_carimbos()` — nenhuma função com `security definer`.
- `tests/agenda2/migracao-agenda2.test.ts`: 13 casos estruturais (arquivo-unico, colunas-minimas, dono-com-cascata, rls-ligada, quatro-policies, select-dono-ou-supervisor, escrita-so-vendedor-ativo, limites-de-tamanho, sem-sequencia-de-documento, carimbos-do-servidor, sem-elevacao, sem-descarte-automatico, inventario-elevacao-inalterado) — todos verdes, sem precisar de banco.
- `tests/agenda2/rls-agenda2.test.ts`: 20 casos de integração contra o banco real (fixtures descartáveis via `createTestMember`/`deleteTestMember`, no máximo 2 `signInAs`), confirmados VERMELHOS (18/20 falham por "tabela agenda2_itens inexistente"; 2 passam incidentalmente porque já esperavam erro de insert) — esperado até o plano 31-03 aplicar a migration no projeto hospedado.
- Inventário de funções com elevação de privilégio confirmado inalterado: as mesmas 11 funções de antes da fase (6 exceções documentadas + 5 gatilhos de sistema/auditoria).

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Migration 0048_agenda2_itens.sql + teste estrutural** - `0ed2aff` (feat)
2. **Tarefa 2: Testes de integração rls-agenda2 (vermelhos até o 31-03)** - `1b2abf1` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `supabase/migrations/0048_agenda2_itens.sql` - tabela agenda2_itens + RLS 4-policy assimétrica + gatilho de carimbos
- `tests/agenda2/migracao-agenda2.test.ts` - 13 testes estruturais (sem banco)
- `tests/agenda2/rls-agenda2.test.ts` - 20 testes de integração contra o banco real (vermelhos até 31-03)

## Decisions Made
- Escrita exige vendedor ATIVO (`exists (...) p.role = 'vendedor' and p.ativo = true`), não apenas "não é supervisor" — corrige a proposta original de `31-RESEARCH.md` (`and not is_supervisor()`), que deixaria um vendedor desativado com sessão ainda válida continuar gravando.
- Limites de tamanho com `text` + constraint `char_length(btrim(...)) between 1 and N`, mesmo padrão de `tarefas.resumo` (migration 0015), em vez de `varchar(n)` sugerido na pesquisa.
- Um único gatilho `BEFORE INSERT OR UPDATE` cobre os dois carimbos (a pesquisa só previa `UPDATE`) — sem isso um vendedor poderia forjar `criado_em` pela API.
- `vendedor_id ... on delete cascade`: conta apagada leva os itens; conta só desativada mantém os itens visíveis ao Supervisor (D-19), sem transferência.
- Nenhum descarte automático de dados — prazo de guarda do piloto segue sem decisão do dono (ver Alerta LGPD abaixo).

## Deviations from Plan

None - plan executed exactly as written. As "correções 1-5 e 8" descritas no bloco `conflitos_resolvidos` do próprio 31-01-PLAN.md já estavam especificadas pelo planner (não são desvios desta execução) e foram implementadas literalmente como escrito.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. A aplicação da migration em produção (SQL Editor) é responsabilidade do plano 31-03, após aprovação explícita do dono.

## Alerta de Conformidade (LGPD)

Conforme instrução organizacional: esta migration cria uma tabela que armazenará **dado pessoal** — nome livre do cliente (pode identificar pessoa física em pequenos negócios PJ/MEI) e, indiretamente, a rotina de deslocamento de um funcionário (vendedor), associada a bairro e data. A minimização de campos já está aplicada por design (exatamente 8 colunas, sem telefone/endereço completo/observação/localização, com limite de tamanho e recusa de sequência de 8+ dígitos que lembre CPF/CNPJ/telefone/CEP). **O prazo de retenção dos dados do piloto permanece em aberto** — nenhum descarte automático foi implementado nesta fase, por decisão explícita de adiar essa definição (ver `31-RESEARCH.md` Open Questions #2 e `31-CONTEXT.md`). Recomenda-se que o dono do projeto confirme uma política de retenção antes do uso continuado em produção; isso será sinalizado novamente no checkpoint do plano 31-03, que é quem efetivamente aplica esta migration no banco real.

## Next Phase Readiness
- `supabase/migrations/0048_agenda2_itens.sql` está pronta para revisão e aplicação manual no plano 31-03 (SQL Editor, após aprovação do dono — único banco do projeto é produção).
- Os 20 testes de integração em `tests/agenda2/rls-agenda2.test.ts` ficarão verdes assim que a migration for aplicada; nenhuma mudança de código é esperada neles no 31-03, só a mudança de estado do banco.
- Nenhum bloqueio para o plano 31-02 (regras de visibilidade/validação em TypeScript), que pode prosseguir em paralelo usando os mesmos limites (120/60) e a mesma regra de documento já fixados aqui.

---
*Phase: 31-agenda-2-visitas-manuais-na-lista*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: supabase/migrations/0048_agenda2_itens.sql
- FOUND: tests/agenda2/migracao-agenda2.test.ts
- FOUND: tests/agenda2/rls-agenda2.test.ts
- FOUND commit: 0ed2aff (Tarefa 1)
- FOUND commit: 1b2abf1 (Tarefa 2)
- Re-ran `npx vitest run tests/agenda2/migracao-agenda2.test.ts` — 13/13 passed
- Re-ran `npx tsc --noEmit` — clean
- Re-ran `npx eslint tests/agenda2/rls-agenda2.test.ts tests/agenda2/migracao-agenda2.test.ts` — clean
- Confirmed `git diff --name-only 071871f -- supabase/migrations/` lists no file other than 0048
