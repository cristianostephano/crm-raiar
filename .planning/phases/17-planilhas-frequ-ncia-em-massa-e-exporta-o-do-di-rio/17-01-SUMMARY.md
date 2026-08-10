---
phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio
plan: 01
subsystem: database
tags: [postgres, supabase, rls, plpgsql, rpc, vitest]

# Dependency graph
requires:
  - phase: 13-cliente-ativo-e-frequ-ncia-de-visita
    provides: "frequencia_visita_enum e a coluna clientes.frequencia_visita que esta operação escreve"
provides:
  - "atualizar_frequencia_visita_lote(p_atualizacoes jsonb) returns table(id uuid, razao_social text) — grava, numa única instrução UPDATE, a frequência de visita de vários clientes 'ganho' de uma vez"
affects: [17-03-logica-pura-e-acoes-servidor, 17-04-tabela-revisao-resumo, 17-05-assistente-rota-menu]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC set-based não-security-definer que só sabe ALTERAR (nunca CRIAR) — irmã estrutural de importar_clientes_lote, mas oposta na direção de escrita"

key-files:
  created:
    - supabase/migrations/0017_atualizar_frequencia_visita_lote.sql
    - tests/importacao/rls-frequencia-lote.test.ts
  modified: []

key-decisions:
  - "Migration aplicada em produção via supabase db push executado pelo orquestrador (não pelo agente de worktree) — mesmo padrão de separação de responsabilidade usado desde a Fase 13, e reforçado explicitamente neste plano por causa de um bloqueio conhecido do classificador de segurança do harness contra pushes de banco de produção disparados por subagentes"
  - "Dono do projeto confirmou explicitamente, no checkpoint humano do Task 2, os dois pontos de produto sinalizados: (1) a planilha não agenda a primeira visita automaticamente — comportamento consistente com a edição individual de frequência já existente desde a Fase 13; (2) sobrescrever uma frequência já existente sem alerta linha-a-linha é aceitável, pois a tela de revisão (planos seguintes) já mostra cada linha antes da gravação"

patterns-established:
  - "Toda operação de escrita em massa nova deste projeto declara explicitamente, no comentário de cabeçalho, qual dos cinco critérios de sucesso da fase é garantido por construção do SQL (não por disciplina de tela) — mesmo padrão que importar_clientes_lote já seguia implicitamente"

requirements-completed: [IMP-01]

coverage:
  - id: D1
    description: "atualizar_frequencia_visita_lote é estruturalmente incapaz de criar cliente — uma única instrução UPDATE em todo o arquivo, zero instruções de criação, verificado mecanicamente e provado por contagem de linhas antes/depois de um lote com identificador inexistente"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "node -e (script de verificação mecânica embutido no Task 1 do plano) — ausência de insert/loop/alter table/create policy, exatamente 1 'update clientes'"
        status: pass
      - kind: integration
        ref: "tests/importacao/rls-frequencia-lote.test.ts#naocria: um lote com identificador inexistente nao cria cliente novo"
        status: pass
    human_judgment: false
  - id: D2
    description: "Só o Supervisor executa a operação — guard de papel usando is_supervisor() do projeto, posicionado antes de qualquer acesso a dado; Vendedor é recusado E nenhuma frequência é alterada"
    requirement: "IMP-01"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-frequencia-lote.test.ts#vendedor: a chamada e recusada e nenhuma frequencia muda"
        status: pass
      - kind: integration
        ref: "tests/importacao/rls-frequencia-lote.test.ts#anonimo: um cliente nao autenticado chamando a operacao e recusado"
        status: pass
    human_judgment: false
  - id: D3
    description: "A operação só altera clientes com status_acompanhamento = 'ganho'; um cliente em andamento no mesmo lote passa incólume, sem erro e sem alteração"
    requirement: "IMP-01"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-frequencia-lote.test.ts#naoganho: um cliente em andamento no mesmo lote passa incolume"
        status: pass
    human_judgment: false
  - id: D4
    description: "Uma linha que não casa com nenhum cliente apto não derruba o lote — não levanta erro, não reverte, não aparece no retorno; as demais linhas do mesmo lote são gravadas normalmente"
    requirement: "IMP-01"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-frequencia-lote.test.ts#inexistente: um identificador que nao existe na base nao derruba as demais linhas do lote"
        status: pass
    human_judgment: false
  - id: D5
    description: "A operação devolve exatamente os clientes de fato alterados (id + razão social) e sobrescreve frequência já existente sem erro — é o dado que 17-03 usa para reconciliar 'enviado x gravado'"
    requirement: "IMP-01"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-frequencia-lote.test.ts#supervisor: grava a frequencia de varios clientes ganho de uma vez, sobrescrevendo valor existente"
        status: pass
    human_judgment: false
  - id: D6
    description: "A operação nunca agenda visita — definir cadência em massa não é o mesmo que agendar a próxima visita, mesma regra já em vigor na edição individual de frequência desde a Fase 13"
    requirement: "IMP-01"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-frequencia-lote.test.ts#semvisita: definir frequencia em massa nao agenda visita nenhuma"
        status: pass
    human_judgment: false
  - id: D7
    description: "A função não tem elevação de privilégio (roda como quem chama) — a regra de alteração de clientes da migration 0002 continua sendo a fronteira real, e o projeto continua com exatamente três exceções SECURITY DEFINER, nenhuma nova"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "script de verificação mecânica do Task 1 — ausência de 'security definer' no arquivo da migration"
        status: pass
    human_judgment: false
  - id: D8
    description: "Migration 0017 aplicada no projeto Supabase hospedado (produção) com aprovação humana prévia no checkpoint bloqueante do Task 2"
    verification:
      - kind: manual_procedural
        ref: "checkpoint Task 2 — dono aprovou explicitamente com o texto 'approved', confirmando os dois pontos de produto sinalizados (visita não agendada automaticamente; sobrescrita silenciosa aceitável); push confirmado pelo orquestrador com saída {\"upToDate\":false,\"migrations\":[\"0017_atualizar_frequencia_visita_lote.sql\"],\"message\":\"Finished supabase db push.\"} sem erros, e pelas 12/12 execuções de rls-frequencia-lote.test.ts contra o banco real depois do push"
        status: pass
    human_judgment: true
    rationale: "Aplicação em produção já teve aprovação humana explícita e específica no checkpoint bloqueante do Task 2 — registrado aqui só para rastreabilidade, não é um novo pedido de julgamento."
  - id: D9
    description: "As duas suítes de frequência de visita da Fase 13 (edição individual) continuam verdes após a migration 0017 — nenhuma regressão"
    verification:
      - kind: integration
        ref: "tests/clientes/frequencia-visita.test.ts (17/17)"
        status: pass
      - kind: integration
        ref: "tests/clientes/frequencia-visita-edicao.test.ts (11/11)"
        status: pass
    human_judgment: false

# Metrics
duration: ~40min (Task 1 + espera do checkpoint humano + Task 3, incluindo um cooldown de rate limit de Auth)
completed: 2026-08-10
status: complete
---

# Phase 17 Plan 1: Fundação de Gravação — RPC de Frequência de Visita em Massa Summary

**Migration 0017 aplicada em produção: RPC `atualizar_frequencia_visita_lote` — uma única instrução UPDATE, não-security-definer, que grava a frequência de visita de vários clientes "ganho" de uma vez, estruturalmente incapaz de criar cliente ou de agendar visita.**

## Performance

- **Duration:** ~40 min (Task 1 auto + checkpoint humano bloqueante + Task 3 auto, incluindo um cooldown de ~5 min por rate limit conhecido do Supabase Auth)
- **Started:** 2026-08-10T11:15:00Z (aprox.)
- **Completed:** 2026-08-10T11:34:47Z
- **Tasks:** 3 (Task 1 auto, Task 2 checkpoint humano bloqueante, Task 3 auto)
- **Files modified:** 2 (1 migration nova + 1 arquivo de teste novo)

## Accomplishments
- Migration `0017_atualizar_frequencia_visita_lote.sql` escrita, mecanicamente conforme (guard de papel antes do UPDATE, pragma `#variable_conflict use_column`, zero elevação de privilégio, zero instrução de criação, exatamente uma instrução `update clientes` com a cláusula `status_acompanhamento = 'ganho'`) e aplicada no projeto Supabase hospedado com aprovação humana explícita no checkpoint do Task 2
- Novo arquivo `tests/importacao/rls-frequencia-lote.test.ts` prova, contra o banco real e com sessões reais de cada papel, os sete cenários exigidos pelo plano: `supervisor` (grava e sobrescreve), `vendedor` (recusado + zero efeito), `naoganho` (cliente não-ganho passa incólume), `inexistente` (linha ruim não derruba o lote), `naocria` (contagem de clientes idêntica antes/depois), `semvisita` (nenhuma visita agendada) e `anonimo` (chamador não autenticado recusado)
- As duas suítes de regressão da edição individual de frequência (Fase 13) — `tests/clientes/frequencia-visita.test.ts` e `tests/clientes/frequencia-visita-edicao.test.ts` — continuam 100% verdes depois do push
- O plano 17-03 (lógica pura + ações de servidor do fluxo de planilha) está desbloqueado

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration da operação de gravação em lote + arquivo de teste de integração** - `625d8c0` (feat)
2. **Task 2: Aprovação humana — checkpoint** - sem commit de código (aprovação registrada; `supabase db push` executado diretamente pelo orquestrador, fora deste worktree, conforme instrução explícita do plano para não rodar push de produção a partir de um subagente)
3. **Task 3: Aplicar a migration e levar os testes a GREEN** - sem commit de código novo (nenhum arquivo de aplicação alterado nesta tarefa; a migration já estava commitada no Task 1, e o push é uma operação de infraestrutura, não um diff de código)

**Plan metadata:** commit deste SUMMARY.md (docs)

## Files Created/Modified
- `supabase/migrations/0017_atualizar_frequencia_visita_lote.sql` - RPC `atualizar_frequencia_visita_lote(p_atualizacoes jsonb) returns table(id uuid, razao_social text)`, `language plpgsql`, sem `security definer`, pragma `#variable_conflict use_column`, guard `is_supervisor()` antes de qualquer acesso a dado, uma única instrução `UPDATE clientes ... FROM jsonb_to_recordset(...) WHERE status_acompanhamento = 'ganho' RETURNING id, razao_social`
- `tests/importacao/rls-frequencia-lote.test.ts` - 7 casos de integração contra o banco real (12 testes no total no arquivo, incluindo os 5 já existentes de `rls-roles.test.ts` importados via `SEED_ACCOUNTS`): `supervisor`, `vendedor`, `naoganho`, `inexistente`, `naocria`, `semvisita`, `anonimo`

## Decisions Made
- O `supabase db push` da migration 0017 foi executado pelo orquestrador a partir do seu próprio contexto, não por este agente de worktree — o classificador de segurança do harness bloqueia pushes de banco de produção disparados por subagentes (mesmo comportamento já confirmado nas Fases 14, 15 e 16). O agente de worktree apenas escreveu a migration, apresentou o checkpoint em português simples e, após a aprovação, rodou os testes contra o banco já atualizado.
- O dono do projeto confirmou explicitamente, no texto de aprovação do checkpoint, os dois pontos de produto sinalizados no Task 2: (1) a planilha de frequências não agenda a primeira visita automaticamente — mantém a mesma regra já em vigor na edição individual de frequência desde a Fase 13; (2) sobrescrever uma frequência já existente sem um alerta específico linha-a-linha é aceitável, porque a tela de revisão dos próximos planos já mostra cada linha antes de qualquer gravação.
- A primeira tentativa de rodar as suítes de regressão da Fase 13 (`tests/clientes/frequencia-visita.test.ts` + `tests/clientes/frequencia-visita-edicao.test.ts`) logo depois da suíte nova de 12 testes esgotou a cota de `signInWithPassword` do Supabase Auth (mesmo blocker já documentado em `STATE.md`, achado originalmente na Fase 6-03 e revisitado na Fase 13-01) — resolvido com um cooldown de ~5 minutos antes de repetir, sem qualquer mudança de código.

## Deviations from Plan

None - plan executado exatamente como escrito. (A espera pelo cooldown de rate limit de Auth no Task 3 não alterou nenhum código de aplicação nem a migration; é documentada em "Issues Encountered" abaixo, não como um desvio do plano.)

## Issues Encountered

**Rate limit de `signInWithPassword` do Supabase Auth interrompeu a primeira tentativa das suítes de regressão da Fase 13 — não uma regressão da migration.**

Depois de rodar `tests/importacao/rls-frequencia-lote.test.ts` (12 testes, ~14+ logins reais somando o próprio arquivo e os 5 testes de `rls-roles.test.ts` que ele importa), a primeira tentativa de `tests/clientes/frequencia-visita.test.ts` + `tests/clientes/frequencia-visita-edicao.test.ts` falhou com `Error: signInAs("...") failed: Request rate limit reached` em 1 e depois 3 de 11 testes — mesma causa raiz 100% das vezes, zero falha de asserção de schema/RPC. Consistente com o blocker já documentado em `STATE.md` (mesma causa-raiz da Fase 6-03 e da Fase 13-01).

**Mitigação aplicada:** aguardado um cooldown de ~5 minutos (rodado em background enquanto o checkpoint aguardava confirmação do coordenador) e repetidas as duas suítes isoladamente — ambas passaram 100% limpas na nova tentativa: `frequencia-visita-edicao.test.ts` (11/11) e `frequencia-visita.test.ts` (17/17). A suíte completa de `tests/importacao/` (12 arquivos, incluindo os dois que usam sessão real — `rls-dedup-read.test.ts` e `rls-importar-lote.test.ts`) também foi rodada em lotes pequenos como regressão adicional de menor custo pedida pelo Task 3, 100% verde (60 testes puros + 15 testes de RLS).

## User Setup Required

None - nenhuma configuração de serviço externo necessária além do que já estava documentado (Supabase CLI já linkado ao projeto, `.env.local` já presente).

## Next Phase Readiness

- A fundação de gravação do IMP-01 está em produção: `atualizar_frequencia_visita_lote` existe no banco hospedado, provada contra ele nos sete cenários exigidos.
- O plano 17-03 (lógica pura `annotarLinhaFrequencia` + Server Actions `validarLoteFrequencia`/`confirmarLoteFrequencia`) está desbloqueado — ele é quem vai chamar esta RPC a partir da tela.
- Nenhum bloqueio novo identificado. O rate limit de `signInWithPassword` do Supabase Auth continua sendo o único item operacional herdado (ver `STATE.md`, Blockers/Concerns) — mitigado com cooldown, não é um item de ação para este plano.
- **REQUIREMENTS.md deliberadamente não marcado como "Complete" para IMP-01 por este plano** — mesma convenção já documentada na Fase 9 (`LOC-01/LOC-02/LOC-04`): IMP-01 é um requisito de usuário final que só é cumprido quando a tela (17-03/17-04/17-05) existe de ponta a ponta. Este plano entrega só a fundação de banco; a checkbox/traceability table permanece "Pending" até o Plano 17-05 concluir o fluxo visível ao usuário.

---
*Phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: `supabase/migrations/0017_atualizar_frequencia_visita_lote.sql`
- FOUND: `tests/importacao/rls-frequencia-lote.test.ts`
- FOUND: commit `625d8c0` (Task 1)
- FOUND: `.planning/phases/17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio/17-01-SUMMARY.md` (this file)
