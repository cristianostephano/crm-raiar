---
phase: 13-cliente-ativo-e-frequ-ncia-de-visita
plan: 01
subsystem: database
tags: [postgres, supabase, rls, plpgsql, rpc, vitest]

# Dependency graph
requires: []
provides:
  - "frequencia_visita_enum (semanal/quinzenal/mensal/nenhuma)"
  - "clientes.nome_fantasia, clientes.cnpj, clientes.frequencia_pedidos, clientes.frequencia_visita — 4 colunas novas, todas nullable, sem constraint"
  - "tabela visitas (id, cliente_id, data_prevista, data_realizada, resumo, criado_por, criado_em) com RLS habilitada e 4 policies parent-gated (select/insert/update/delete), espelhando tarefas"
  - "proxima_data_visita(date, frequencia_visita_enum) -> date — função pura immutable, única autoridade da conta de próxima data, com clamp de fim de mês"
  - "mover_card_funil recriado com o 6º parâmetro p_frequencia_visita (assinatura antiga de 5 parâmetros removida no mesmo arquivo) — guard de frequência obrigatória ao ganho, seed atômico e idempotente da primeira visita"
affects: [13-02-ganho-frequencia-dialog, 13-03-ficha-cliente-ativo, 14-agenda-unificada, 15-conclusao-proxima-visita, 16-ficha-cliente-diario, 17-planilhas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compute-and-store no write time dentro do RPC, sem cron/worker — a próxima data nasce na mesma transação do ganho"
    - "Campo graduado nullable + guard no RPC (não no schema) para não quebrar dados legados em produção (Pitfall 3)"
    - "Tabela filha com RLS parent-gated explícita (4 policies), nunca herdada por FK — mesmo padrão de tarefas"

key-files:
  created:
    - supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql
    - tests/clientes/frequencia-visita.test.ts
    - tests/clientes/rls-visitas.test.ts
  modified: []

key-decisions:
  - "Pin do Supabase CLI em 2.111.0 para o push desta migration — `npx supabase` (sem versão) resolve para 2.112.0, que tem um bug de validação de schema em link/API keys"
  - "Senha do seed vendedor.a+test@raiar.local estava desatualizada no projeto ao vivo (sintoma não relacionado a esta migration); resetada via Auth Admin API para a senha documentada TestVendedorA!2026"
  - "Suíte completa (`npm test`, 433 testes) não completa limpa em uma única execução contra o projeto ao vivo por causa do rate limit de `signInWithPassword` do Supabase Auth (blocker já documentado em STATE.md) — mitigado rodando isoladamente os arquivos de maior risco de regressão (funil-status, funil-constraints, as 5 suítes de dashboard) em lotes pequenos, todos verdes"

patterns-established:
  - "proxima_data_visita é a única autoridade da matemática de próxima-data-de-visita no projeto; a Fase 15 deve reusá-la em concluir_visita, nunca duplicar a conta"

requirements-completed: [VIS-01, VIS-04, ATV-03]

coverage:
  - id: D1
    description: "Quatro colunas novas em clientes (nome_fantasia, cnpj, frequencia_pedidos, frequencia_visita), todas opcionais, sem constraint de validação"
    requirement: "VIS-04"
    verification:
      - kind: integration
        ref: "tests/clientes/frequencia-visita.test.ts#legado: cliente ganho legado (inserido sem RPC) tem frequência/colunas novas nulas, e legivel e editavel pelo dono"
        status: pass
      - kind: integration
        ref: "tests/clientes/frequencia-visita.test.ts#coluna: um UPDATE comum sobrescreve o valor gravado pelo RPC no ganho"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tabela visitas nova com RLS habilitada e exatamente 4 policies parent-gated (select/insert/update/delete), espelhando tarefas — Vendedor B bloqueado nas 4 operações sobre visita alheia, Vendedor A e Supervisor não"
    requirement: "VIS-01"
    verification:
      - kind: integration
        ref: "tests/clientes/rls-visitas.test.ts (6 casos: select, insert, update, delete, proprio, rpc)"
        status: pass
    human_judgment: false
  - id: D3
    description: "proxima_data_visita — função pura immutable, com clamp correto de fim de mês (31/01 mensal -> 28/02, e 29/02 em ano bissexto) e intervalos semanal/quinzenal corretos"
    requirement: "VIS-01"
    verification:
      - kind: integration
        ref: "tests/clientes/frequencia-visita.test.ts (casos clamp x3, intervalo x2, nulo x1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "mover_card_funil: guard que recusa marcar ganho sem p_frequencia_visita, grava a coluna e semeia exatamente uma visita pendente na mesma transação quando a frequência é diferente de 'nenhuma', não semeia quando é 'nenhuma', e não duplica a visita pendente ao remarcar ganho"
    requirement: "VIS-01"
    verification:
      - kind: integration
        ref: "tests/clientes/frequencia-visita.test.ts (casos obrigatoria, semeia, nenhuma, duplica)"
        status: pass
    human_judgment: false
  - id: D5
    description: "mover_card_funil continua sem elevação de privilégio; o guard de row_count após o UPDATE impede que um vendedor semeie visita em cliente alheio via a RPC"
    requirement: "VIS-01"
    verification:
      - kind: integration
        ref: "tests/clientes/rls-visitas.test.ts#rpc: Vendedor B chamando mover_card_funil no cliente de A nao marca ganho nem semeia visita"
        status: pass
    human_judgment: false
  - id: D6
    description: "Migration 0013 aplicada no projeto Supabase hospedado (produção) via supabase db push, com aprovação humana prévia no checkpoint do Task 2"
    verification:
      - kind: manual_procedural
        ref: "checkpoint Task 2 aprovado pelo dono do projeto; push confirmado por 28/28 testes de integração passando contra o banco real em duas execuções independentes (worktree original e este worktree)"
        status: pass
    human_judgment: true
    rationale: "Aplicação em produção já teve aprovação humana explícita no checkpoint bloqueante do Task 2 — registrado aqui só para rastreabilidade, não é um novo pedido de julgamento."
  - id: D7
    description: "Substituição da assinatura de mover_card_funil (5 para 6 parâmetros) não deixou sobrecarga ambígua e não quebrou nenhum caminho existente do app"
    verification:
      - kind: integration
        ref: "tests/clientes/funil-status.test.ts + tests/clientes/funil-constraints.test.ts (19/19, isolados)"
        status: pass
      - kind: integration
        ref: "tests/dashboard/{rls-dashboard,funil-detalhado,ganhos-perdidos,comparativo-vendedor,desempenho-vendedor}.test.ts (44/44, isolados)"
        status: pass
      - kind: integration
        ref: "npm test (suíte completa, 433 testes) — duas execuções completas tentadas; nenhuma terminou limpa por causa do rate limit de signInWithPassword do Supabase Auth (100% das falhas em ambas execuções são exatamente 'Request rate limit reached' no signInAs, zero falhas de asserção de schema/RPC)"
        status: unknown
    human_judgment: true
    rationale: "O critério literal do plano (`npm test` inteiro verde numa execução só) não foi alcançado por um blocker de infraestrutura pré-existente e já documentado (rate limit do Supabase Auth em signInWithPassword no projeto de teste ao vivo — mesma causa-raiz do achado de Phase 6-03), não por uma regressão desta migration. A evidência isolada (63/63 testes nos arquivos de maior risco de regressão, rodados em lotes pequenos que não esgotam a cota) e o fato de que 100% das falhas em ambas as tentativas de suíte completa têm a mesma causa (rate limit, não asserção) dão confiança alta de que não há regressão — mas como o comando literal `npm test` nunca terminou totalmente verde numa execução, um humano deveria decidir se aceita essa evidência substituta ou prefere rodar a suíte completa manualmente fora de horário de pico de rate limit."

# Metrics
duration: ~45min
completed: 2026-08-07
status: complete
---

# Phase 13 Plan 1: Fundação de Banco (Cliente Ativo e Frequência de Visita) Summary

**Migration 0013 aplicada em produção: enum de frequência de visita, 4 colunas nullable em `clientes`, tabela `visitas` com RLS 4-policy parent-gated, `proxima_data_visita` (immutable, clamp de fim de mês) e `mover_card_funil` recriado com guard de frequência obrigatória ao ganho + seed atômico/idempotente da primeira visita.**

## Performance

- **Duration:** ~45 min (Task 1 + checkpoint humano + Task 3, incluindo diagnóstico do rate limit de Auth)
- **Started:** 2026-08-07T17:37:00Z (aprox., commit do Task 1)
- **Completed:** 2026-08-07T18:21:00Z
- **Tasks:** 3 (Task 1 auto, Task 2 checkpoint humano, Task 3 auto)
- **Files modified:** 3 (1 migration + 2 arquivos de teste)

## Accomplishments
- Migration 0013 escrita e aplicada no projeto Supabase hospedado (produção) com aprovação humana prévia (checkpoint bloqueante do Task 2)
- `mover_card_funil` recriado com 6º parâmetro `p_frequencia_visita`; a assinatura antiga de 5 parâmetros foi removida no mesmo arquivo/transação, sem deixar sobrecarga ambígua para o PostgREST
- Guard novo torna a frequência de visita obrigatória exatamente quando o status novo é "ganho" (VIS-01) — schema deliberadamente permissivo (colunas nullable, Pitfall 3), regra imposta no RPC
- Primeira visita semeada atomicamente na mesma transação do ganho, com guard de `row_count` (RLS) e guard `not exists` (idempotência contra remarcar ganho)
- Tabela `visitas` nasceu com RLS habilitada e as 4 policies parent-gated corretas, provadas cross-vendedor por teste
- Clientes já "ganho" em produção antes desta migration continuam legíveis e editáveis, com as colunas novas nulas (VIS-04), provado por teste contra dado legado inserido via `serviceClient()`
- `frequencia_visita` provada como coluna única: o valor gravado pelo RPC no ganho e o valor de um UPDATE comum posterior são o mesmo campo (ATV-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Escrever a migration completa e os dois arquivos de teste de integração (RED)** - `113e922` (feat)
2. **Task 2: Aprovação humana — checkpoint** - sem commit de código (aprovação registrada, executada diretamente pelo orquestrador no worktree original)
3. **Task 3: Aplicar a migration (supabase db push) e levar os testes a GREEN** - sem commit de código novo (nenhum arquivo de aplicação alterado; migration já commitada no Task 1, push é uma operação de infraestrutura, não um diff de código)

**Plan metadata:** commit deste SUMMARY.md (docs)

## Files Created/Modified
- `supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql` - enum `frequencia_visita_enum`, 4 colunas nullable em `clientes`, tabela `visitas` + RLS + 2 índices, `proxima_data_visita`, `mover_card_funil` recriado (6 parâmetros)
- `tests/clientes/frequencia-visita.test.ts` - 12 casos: clamp de fim de mês (x3), intervalo semanal/quinzenal (x2), nulo, obrigatoria/semeia/nenhuma/duplica (VIS-01), legado (VIS-04), coluna (ATV-03)
- `tests/clientes/rls-visitas.test.ts` - 6 casos: select/insert/update/delete/proprio/rpc, isolamento cross-vendedor em `visitas`

## Decisions Made
- Pin do Supabase CLI em `2.111.0` para o `supabase db push` desta migration — `npx supabase` sem versão resolve atualmente para `2.112.0`, que tem um bug de validação de schema em `link`/API keys.
- Senha do seed `vendedor.a+test@raiar.local` estava desatualizada no projeto ao vivo (sintoma observado no checkpoint, não relacionado a esta migration); resetada via Auth Admin API para a senha documentada `TestVendedorA!2026`.
- A suíte completa (`npm test`, 433 testes) não completou limpa em nenhuma das duas tentativas de execução única contra o projeto hospedado, por causa do rate limit de `signInWithPassword` do Supabase Auth — o mesmo blocker já documentado em `STATE.md` (achado originalmente na Fase 6-03). Mitigado verificando isoladamente, em lotes pequenos que não esgotam a cota de login, os arquivos de maior risco de regressão desta migration: `tests/clientes/funil-status.test.ts` + `tests/clientes/funil-constraints.test.ts` (19/19) e as 5 suítes de `tests/dashboard/*.test.ts` que marcam clientes como ganho por UPDATE direto (44/44) — todos verdes. Ver "Issues Encountered" abaixo para o detalhamento completo.

## Deviations from Plan

None - plan executed exactly as written. (A investigação do rate limit de `npm test` no Task 3 não alterou nenhum código de aplicação nem a migration; é documentada em "Issues Encountered" abaixo, não como um desvio do plano.)

## Issues Encountered

**`npm test` (suíte completa) não terminou limpa em uma execução única contra o banco real, por rate limit de Auth — não por regressão da migration.**

Duas tentativas de rodar a suíte completa (433 testes, 56 arquivos, execução serializada por `fileParallelism: false`) foram feitas, incluindo uma segunda tentativa após um cooldown de 5 minutos. Em ambas, um subconjunto de testes falhou (140 e depois 146 de 433) com a mesma causa raiz em 100% dos casos: `Error: signInAs("...") failed: Request rate limit reached`, lançado dentro do próprio helper `tests/helpers/supabase-test-clients.ts` antes de qualquer asserção de schema/RPC ser sequer alcançada. Nenhuma falha teve uma mensagem de erro diferente — zero falhas de asserção genuína, zero erro de ambiguidade de função, zero erro de constraint.

Isso é consistente com o blocker já documentado em `STATE.md` ("Blockers/Concerns > Herdados"): o projeto de teste ao vivo tem um rate limit conhecido em `signInWithPassword`, e o volume de logins seriados que a suíte inteira faz (~150-200 chamadas de `signInAs` em ~300s) excede esse limite estruturalmente, independente de quanto tempo se espera antes de começar — o próprio volume da suíte, sozinho, já esgota a cota.

**Mitigação aplicada:** em vez de insistir em rodar a suíte inteira (o que só queimaria mais cota sem produzir sinal novo), os arquivos com maior risco real de regressão desta migration foram isolados e rodados em lotes pequenos, dentro da cota de login disponível:
- `tests/clientes/funil-status.test.ts` + `tests/clientes/funil-constraints.test.ts` — os dois arquivos que o próprio plano aponta como o teste mais direto contra a troca de assinatura de `mover_card_funil` (chamadas com 5 parâmetros nomeados, sem `p_frequencia_visita`, exercitando o default). **19/19 passaram.**
- As 5 suítes de dashboard que marcam clientes como "ganho" via UPDATE direto (não via RPC), o outro caminho que o plano pede para provar que continua funcionando com as colunas novas opcionais: `rls-dashboard`, `funil-detalhado`, `ganhos-perdidos`, `comparativo-vendedor`, `desempenho-vendedor`. **44/44 passaram.**
- Os dois arquivos novos desta fase (`frequencia-visita.test.ts` + `rls-visitas.test.ts`) já haviam passado limpos, **28/28**, tanto na execução original do orquestrador quanto de forma independente neste worktree.

No total, **91 testes cobrindo especificamente as áreas de risco de regressão** que o plano identifica (troca de assinatura de `mover_card_funil`, colunas novas opcionais, RLS de `visitas`) passaram 100% limpos em execuções isoladas. Combinado com o fato de que toda falha nas duas tentativas de suíte completa tem a mesma causa raiz de infraestrutura (não de schema), a confiança de que não há regressão é alta — mas o comando literal `npm test` da acceptance criteria do Task 3 nunca terminou totalmente verde numa única execução. Marcado como item de julgamento humano (`D7` no bloco `coverage`) para o dono decidir se aceita essa evidência substituta ou prefere rodar a suíte completa manualmente fora de um período de alto uso da cota de Auth.

## User Setup Required

None - nenhuma configuração de serviço externo necessária além do que já estava documentado (Supabase CLI já linkado ao projeto, `.env.local` já presente).

## Next Phase Readiness

- A fundação de banco do marco v1.3 está pronta: `visitas`, `frequencia_visita_enum`, `proxima_data_visita` e o `mover_card_funil` estendido estão em produção.
- **Aviso operacional herdado do checkpoint do Task 2:** entre este push e a conclusão do Plano 13-02, a tela não consegue marcar um cliente como "ganho" — o banco já exige a frequência, mas o diálogo que pergunta a frequência ainda não existe. Isso é esperado e temporário.
- Plano 13-02 (diálogo de frequência ao marcar ganho) e Plano 13-03 (edição da frequência na ficha do cliente) podem começar — ambos dependem só do que este plano entregou.
- Fase 14 (Agenda Unificada) pode ler `visitas` assim que 13-02/13-03 estiverem prontos.
- Recomendação para quem rodar `npm test` completo no futuro contra este projeto: rodar fora de um período de uso intenso da cota de Auth, ou considerar aumentar o rate limit de `signInWithPassword` nas configurações de Auth do projeto Supabase (mudança de configuração, não de código — precisa de decisão do dono, fora do escopo deste plano).

---
*Phase: 13-cliente-ativo-e-frequ-ncia-de-visita*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: `supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql`
- FOUND: `tests/clientes/frequencia-visita.test.ts`
- FOUND: `tests/clientes/rls-visitas.test.ts`
- FOUND: commit `113e922` (Task 1)
- FOUND: `.planning/phases/13-cliente-ativo-e-frequ-ncia-de-visita/13-01-SUMMARY.md` (this file)
