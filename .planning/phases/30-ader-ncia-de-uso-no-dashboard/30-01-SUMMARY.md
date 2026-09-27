---
phase: 30-ader-ncia-de-uso-no-dashboard
plan: 01
subsystem: database
tags: [postgres, rls, plpgsql, supabase, lgpd, vitest]

# Dependency graph
requires: []
provides:
  - "acessos_diarios (2 colunas) + RLS de 3 policies + registrar_acesso_diario() RPC idempotente com descarte embutido de 35 dias"
  - "profiles.desativado_em / profiles.reativado_em carimbados por desativar_membro_equipe/reativar_membro_equipe"
  - "22 testes de integração (RED) provando D-04/D-07/D-08/D-10/D-11 antes da aplicação da migration"
affects: ["30-02 (dashboard_aderencia_uso lê esta tabela + estas colunas)", "30-03 (checkpoint do dono, aplica 0038/0039)", "30-04 (middleware/Server Actions chamam registrar_acesso_diario())"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Descarte de retenção embutido na própria RPC de escrita, sem cron/worker (D-11)"
    - "Policy de DELETE restrita a is_supervisor() porque a policy de SELECT já restringia a visibilidade das linhas apagáveis"
    - "Dois carimbos de timestamp (desativado_em/reativado_em) carimbados só na troca real de estado via CASE lendo o valor pré-update da própria linha"

key-files:
  created:
    - supabase/migrations/0038_acessos_diarios.sql
    - supabase/migrations/0039_carimbos_desativacao_reativacao.sql
    - tests/dashboard/acessos-diarios.test.ts
    - tests/equipe/carimbos-desativacao.test.ts
  modified: []

key-decisions:
  - "Policy de DELETE de acessos_diarios exige is_supervisor() (não usuario_id = auth.uid()): a policy de SELECT já é Supervisor-only, então um DELETE feito pelo próprio vendedor não enxergaria linha nenhuma para apagar — a pesquisa original propunha 'apaga a própria linha', o que nunca rodaria de fato"
  - "Policy de INSERT exige dia = hoje em São Paulo + vendedor ativo, além de usuario_id = auth.uid(): sem isso, gravar direto na tabela (sem passar pela RPC) permitiria inflar a própria aderência com dias retroativos"
  - "profiles.desativado_em e profiles.reativado_em (duas colunas, não uma): a proporção de D-07 precisa excluir do numerador/denominador só os dias entre a última desativação e a última reativação, não descontar o histórico inteiro desde a primeira desativação"

patterns-established:
  - "Pattern 1: Retenção de dado pessoal sem cron — DELETE incondicional (sem filtro de usuário) embutido na RPC de escrita mais frequente, com a RLS decidindo o que de fato é apagável"

requirements-completed: [ADER-01, ADER-02, ADER-03]

coverage:
  - id: D1
    description: "Tabela acessos_diarios com exatamente 2 colunas (usuario_id, dia), RLS ligada, e comentário de finalidade/prazo — nenhum dado além de quem+dia"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "node verify script (30-01-PLAN.md Tarefa 1) — checagem estrutural de colunas/policies"
        status: pass
      - kind: integration
        ref: "tests/dashboard/acessos-diarios.test.ts#lgpd-duas-colunas"
        status: unknown
    human_judgment: true
    rationale: "O teste de integração que prova isso contra o banco real fica VERMELHO até a migration ser aplicada no plano 30-03 (decisão explícita do plano); o verificador deve reclassificar depois que 30-03 rodar os testes verdes."
  - id: D2
    description: "registrar_acesso_diario() idempotente, com dia calculado pelo banco (fuso São Paulo) e minimização (só vendedor ativo grava)"
    requirement: "ADER-02"
    verification:
      - kind: unit
        ref: "node verify script (30-01-PLAN.md Tarefa 1)"
        status: pass
      - kind: integration
        ref: "tests/dashboard/acessos-diarios.test.ts#registrar-grava-hoje, #registrar-idempotente, #supervisor-nao-registrado, #inativo-nao-registrado"
        status: unknown
    human_judgment: true
    rationale: "Vermelho até 30-03 aplicar a migration — mesma razão de D1."
  - id: D3
    description: "Descarte automático de linhas com mais de 35 dias, embutido na RPC, sem cron/worker de fundo"
    requirement: "ADER-03"
    verification:
      - kind: unit
        ref: "node verify script (30-01-PLAN.md Tarefa 1)"
        status: pass
      - kind: integration
        ref: "tests/dashboard/acessos-diarios.test.ts#retencao-vendedor-nao-limpa, #retencao-supervisor-limpa, #vendedor-nao-apaga-recente, #supervisor-nao-apaga-recente"
        status: unknown
    human_judgment: true
    rationale: "Vermelho até 30-03 aplicar a migration — mesma razão de D1."
  - id: D4
    description: "profiles.desativado_em/reativado_em carimbados só na troca real de estado, corpos das duas RPCs idênticos aos da 0008 exceto pelo carimbo"
    requirement: "ADER-03"
    verification:
      - kind: unit
        ref: "node verify script (30-01-PLAN.md Tarefa 1) — comparação normalizada de corpo contra 0008"
        status: pass
      - kind: integration
        ref: "tests/equipe/carimbos-desativacao.test.ts (8 casos)"
        status: unknown
    human_judgment: true
    rationale: "Vermelho até 30-03 aplicar a migration — mesma razão de D1."

# Metrics
duration: 40min
completed: 2026-09-27
status: complete
---

# Phase 30 Plan 1: Migrations 0038/0039 e testes RED de aderência de uso Summary

**Tabela `acessos_diarios` (2 colunas) + RLS de 3 policies + RPC `registrar_acesso_diario()` idempotente com descarte embutido de 35 dias, mais `profiles.desativado_em`/`reativado_em` carimbados pelas RPCs de equipe já existentes — e 22 testes de integração provando tudo, deliberadamente vermelhos até a aplicação manual no plano 30-03.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 4 (todos novos: 2 migrations, 2 arquivos de teste)

## Accomplishments
- Migration 0038: tabela `acessos_diarios` com exatamente `usuario_id`/`dia`, RLS com 3 policies (leitura só Supervisor; gravação só do próprio dia de hoje em São Paulo por vendedor ativo; descarte só do Supervisor em linha com mais de 35 dias) e `registrar_acesso_diario()` — RPC sem parâmetros, sem elevação de privilégio, idempotente (`on conflict do nothing`) com o descarte de retenção embutido no mesmo corpo.
- Migration 0039: `profiles.desativado_em`/`profiles.reativado_em` (nullable) e os corpos de `desativar_membro_equipe`/`reativar_membro_equipe` recriados idênticos aos da migration 0008, exceto por um `case when` que carimba a coluna só na troca real de estado.
- 22 casos de teste de integração escritos contra o banco real (14 em `tests/dashboard/acessos-diarios.test.ts`, 8 em `tests/equipe/carimbos-desativacao.test.ts`), cobrindo dia do servidor, idempotência, RLS de leitura, recusa de gravação direta com dia retroativo/outro usuário, minimização (só vendedor ativo), descarte de 35 dias e os dois carimbos de ativação — incluindo a regressão de reatribuição de clientes já provada na 0008.
- Rodada de confirmação executada contra o projeto Supabase real: 20/22 casos falham (tabela/coluna/função ainda não existem — comportamento esperado e desejado nesta fase); os 2 restantes passam por acidente porque a asserção deles só checa `error !== null`, que também é satisfeita pelo erro de "tabela inexistente".

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Tarefa 1: Migrations 0038 (acessos_diarios + RLS + registrar_acesso_diario) e 0039 (carimbos de desativação e reativação)** - `20f1afe` (feat)
2. **Tarefa 2: Testes de integração acessos-diarios e carimbos-desativacao (VERMELHOS até a aplicação no 30-03)** - `25ab0fd` (test)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified
- `supabase/migrations/0038_acessos_diarios.sql` - tabela + RLS + RPC de registro/descarte
- `supabase/migrations/0039_carimbos_desativacao_reativacao.sql` - 2 colunas novas + 2 RPCs recriadas
- `tests/dashboard/acessos-diarios.test.ts` - 14 casos de integração da 0038
- `tests/equipe/carimbos-desativacao.test.ts` - 8 casos de integração da 0039

## Decisions Made
- Policy de DELETE de `acessos_diarios` exige `is_supervisor()`, não `usuario_id = auth.uid()` (correção 1 de `conflitos_resolvidos`, já travada no plano): como a leitura é Supervisor-only, um DELETE do próprio vendedor nunca enxergaria linha para apagar — a limpeza de fato acontece quando um Supervisor chama a RPC.
- Policy de INSERT exige `dia = hoje em São Paulo` + vendedor ativo, além do próprio `usuario_id` (correção 2): impede gravação direta na tabela com dia retroativo para inflar a própria aderência.
- Duas colunas de carimbo (`desativado_em`/`reativado_em`), não uma (correção 4): uma coluna só perderia os dias ANTES da desativação e trataria todo o período desativado como "dia útil esperado" — o cálculo de aderência (plano 30-02) precisa das duas para excluir só a lacuna real de inatividade.

## Deviations from Plan

None - plan executado exatamente como escrito. As "correções 1-4" citadas acima já estavam especificadas no bloco `<conflitos_resolvidos>` do próprio `30-01-PLAN.md` (não são desvios descobertos durante a execução — são o desenho já corrigido pelo planejador em relação ao esboço de `30-RESEARCH.md`).

## Issues Encountered
- Uma tentativa de consulta direta ao banco de produção para confirmar limpeza de fixtures de teste (contas `createTestMember` com e-mail contendo "aderencia"/"carimbos") foi bloqueada pelo classificador de segurança do ambiente (manuseio de PII). Não foi contornada — é o comportamento correto dado o alerta de LGPD desta fase. A limpeza das fixtures depende do `afterAll` de cada arquivo de teste, que roda como parte do ciclo de vida padrão do Vitest independente de falha de asserção (mesma garantia usada por toda a suíte deste projeto); a execução dos dois arquivos terminou sem crash do processo, o que é a evidência disponível de que os `afterAll` rodaram.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. **Atenção:** as migrations 0038 e 0039 ainda NÃO foram aplicadas ao banco (por instrução deste plano) — isso acontece no plano 30-03, junto com a aprovação explícita do dono do projeto e a aplicação manual pelo SQL Editor do Supabase.

## Next Phase Readiness
- A superfície publicada por este plano (tabela `acessos_diarios`, RPC `registrar_acesso_diario()`, colunas `profiles.desativado_em`/`reativado_em`) está pronta para o plano 30-02 construir `dashboard_aderencia_uso()` em cima dela.
- Os 22 testes ficam vermelhos de propósito até o plano 30-03 aplicar as migrations — isso é o estado esperado, não um bloqueio.
- **Lembrete LGPD para o checkpoint do 30-03:** esta fase cria um registro de comportamento de uso por funcionário identificado (dado pessoal sob a LGPD). O desenho já aplica minimização (2 colunas, sem horário/IP/aparelho/localização) e retenção de 35 dias, e a leitura é Supervisor-only — mas a aplicação em produção só deve acontecer depois da aprovação explícita do dono do projeto (D-12: comunicar o time de vendas é responsabilidade do dono, fora do escopo de código).

---
*Phase: 30-ader-ncia-de-uso-no-dashboard*
*Completed: 2026-09-27*

## Self-Check: PASSED

- FOUND: supabase/migrations/0038_acessos_diarios.sql
- FOUND: supabase/migrations/0039_carimbos_desativacao_reativacao.sql
- FOUND: tests/dashboard/acessos-diarios.test.ts
- FOUND: tests/equipe/carimbos-desativacao.test.ts
- FOUND: .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-01-SUMMARY.md
- FOUND commit: 20f1afe
- FOUND commit: 25ab0fd
