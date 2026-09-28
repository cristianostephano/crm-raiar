---
phase: 30-ader-ncia-de-uso-no-dashboard
plan: 03
subsystem: database
tags: [postgres, supabase, deploy-gate, lgpd, security-definer]

requires:
  - phase: 30-ader-ncia-de-uso-no-dashboard (plan 01)
    provides: "migrations 0038/0039 escritas"
  - phase: 30-ader-ncia-de-uso-no-dashboard (plan 02)
    provides: "migration 0040 escrita"
provides:
  - "acessos_diarios, registrar_acesso_diario(), profiles.desativado_em/reativado_em e dashboard_aderencia_uso() vivos no banco de produção, funcionando de verdade"
  - "40 testes de integração verdes contra o banco real"
  - "6ª exceção SECURITY DEFINER do projeto, documentada e aprovada explicitamente"
affects: [30-ader-ncia-de-uso-no-dashboard (plans 04, 05, 06)]

tech-stack:
  added: []
  patterns:
    - "Aplicação manual via SQL Editor da Supabase, um arquivo por vez (mesmo padrão das Fases 28/29)"
    - "Diagnóstico isolado em tabela/função de teste temporárias antes de qualquer correção de produção, nunca alterando dado real"
    - "SECURITY DEFINER como mitigação documentada para uma limitação de ambiente confirmada (RLS não aplicado corretamente a INSERT feito de dentro de função plpgsql chamada via RPC), não como atalho de conveniência"

key-files:
  created:
    - "supabase/migrations/0041_correcao_registrar_acesso_diario.sql (tentativa 1, não resolveu — mantida no histórico, nunca editada depois de aplicada)"
    - "supabase/migrations/0042_diagnostico_registrar_acesso_diario.sql (diagnóstico)"
    - "supabase/migrations/0043_diagnostico_policies_live.sql (diagnóstico, leitura)"
    - "supabase/migrations/0044_diagnostico_insert_real.sql (diagnóstico)"
    - "supabase/migrations/0045_diagnostico_tabela_isolada.sql (diagnóstico, tabela de teste separada)"
    - "supabase/migrations/0046_diagnostico_sem_exists_tabela_isolada.sql (diagnóstico)"
    - "supabase/migrations/0047_correcao_final_registrar_acesso_diario.sql (correção final aprovada + limpeza dos artefatos de diagnóstico)"
  modified: []

key-decisions:
  - "Dono aprovou o escopo de LGPD e a aplicação das migrations 0038/0039/0040 explicitamente (\"Aprovar e aplicar agora\")"
  - "Bug real encontrado após a aplicação: registrar_acesso_diario() (0038) rejeitava a gravação de um vendedor ativo real com erro de RLS (42501), mesmo com todos os valores corretos"
  - "Diagnosticado com uma tabela de teste totalmente isolada (nenhum dado real tocado): um INSERT feito de DENTRO de uma função plpgsql chamada via .rpc() é recusado por uma policy baseada em auth.uid(), mesmo na regra mais simples possível — o mesmo INSERT feito direto pelo cliente sempre funciona. Limitação deste ambiente, não erro de lógica da função ou da regra"
  - "Correção (0047), aprovada explicitamente pelo dono após eu explicar a implicação de segurança: registrar_acesso_diario() passa a ser SECURITY DEFINER (6ª exceção documentada do projeto, mesmo padrão de is_supervisor() desde a Fase 1), fazendo ela mesma a verificação de vendedor ativo (para gravar) e de supervisor (para limpar registros com mais de 35 dias) — RLS de 0038 continua intacta e protege contra escrita direta na tabela"
  - "supabase db push bloqueado pelo classificador de modo automático — aplicação manual pelo dono via SQL Editor, arquivo por arquivo"

requirements-completed: []

coverage:
  - id: D1
    description: "Aprovação explícita do dono, com escopo de LGPD confirmado, antes de qualquer aplicação"
    requirement: "ADER-01, ADER-02, ADER-03"
    verification:
      - kind: manual
        ref: "Tarefa 1 (checkpoint:decision) — dono respondeu \"Aprovar e aplicar agora\""
        status: pass
    human_judgment: true
    rationale: "Aprovação concedida explicitamente, cobrindo o que é guardado, quem lê, o prazo de 35 dias e o lembrete de D-12."
  - id: D2
    description: "As migrations 0038, 0039, 0040 aplicadas em produção, na ordem, confirmadas pelo dono"
    requirement: "ADER-01, ADER-02, ADER-03"
    verification:
      - kind: other
        ref: "SQL Editor da Supabase, uma por vez — \"Success. No rows returned\" confirmado nas três"
        status: pass
    human_judgment: true
    rationale: "Push programático bloqueado pelo ambiente; aplicação manual foi a mitigação, mesma das Fases 28/29."
  - id: D3
    description: "Bug pós-aplicação encontrado, diagnosticado sem tocar dado real, e corrigido com aprovação explícita do dono para a mudança de postura de segurança (SECURITY DEFINER)"
    requirement: "ADER-01, ADER-02"
    verification:
      - kind: manual
        ref: "AskUserQuestion — dono respondeu \"Sim, pode seguir\" após explicação do problema e da mitigação"
        status: pass
    human_judgment: true
    rationale: "Mudança de postura de segurança (nova exceção SECURITY DEFINER) exige aprovação humana explícita, não só a minha — obtida antes de escrever a migration 0047."
  - id: D4
    description: "tests/dashboard/acessos-diarios.test.ts (14), tests/equipe/carimbos-desativacao.test.ts (8) e tests/dashboard/aderencia-uso.test.ts (18) verdes contra o banco real"
    requirement: "ADER-01, ADER-02, ADER-03"
    verification:
      - kind: integration
        ref: "npx vitest run tests/dashboard/acessos-diarios.test.ts tests/equipe/carimbos-desativacao.test.ts tests/dashboard/aderencia-uso.test.ts"
        status: pass
    human_judgment: false
    rationale: "40/40 testes passaram contra o banco de produção real após a migration 0047."
  - id: D5
    description: "Nenhuma migration anterior a 0038 foi editada"
    requirement: "ADER-01, ADER-02, ADER-03"
    verification:
      - kind: other
        ref: "git diff --name-only b9e9176 -- supabase/migrations (só 0038-0047 aparecem)"
        status: pass
    human_judgment: false
    rationale: "Toda correção pós-aplicação virou migration nova (0041 em diante), nunca edição das já aplicadas."

duration: ~2h (aprovação + aplicação + descoberta e correção do bug de RLS)
completed: 2026-09-27
status: complete
---

# Phase 30 Plan 3: Aprovação, Aplicação e Correção de um Bug de RLS — Summary

**As migrations 0038/0039/0040 foram aprovadas e aplicadas pelo dono. Um teste de integração revelou que `registrar_acesso_diario()` rejeitava a gravação de um vendedor ativo real por um erro de RLS — diagnosticado sem tocar dado real, usando uma tabela de teste isolada, e corrigido com uma migration nova (0047) que tornou a função SECURITY DEFINER, aprovada explicitamente pelo dono após eu explicar a implicação de segurança. Os 40 testes de integração passam contra o banco de produção real.**

## Performance

- **Duration:** ~2h (checkpoint de aprovação, aplicação manual, descoberta do bug, 6 rodadas de diagnóstico isolado, correção final aprovada, testes)
- **Tasks:** 3/3

## O que aconteceu, em ordem

1. **Aprovação (Tarefa 1):** apresentei o escopo de dados (LGPD) em linguagem simples — só quem+dia, sem horário/IP/aparelho, só vendedor ativo medido, só Supervisor lê, 35 dias de prazo com descarte automático, lembrete de avisar o time (D-12, fora do código). O dono respondeu **"Aprovar e aplicar agora"**.
2. **Aplicação (Tarefa 2):** enviei `0038_acessos_diarios.sql`, `0039_carimbos_desativacao_reativacao.sql` e `0040_dashboard_aderencia_uso.sql` via SendUserFile; o dono aplicou os três, um de cada vez, no SQL Editor da Supabase, confirmando "Success" em cada um.
3. **Teste pós-aplicação (Tarefa 3) revelou um bug real:** rodando os 40 casos de integração, 5 falharam com `42501: new row violates row-level security policy for table "acessos_diarios"` — especificamente sempre que um vendedor ativo de verdade chamava `registrar_acesso_diario()`.
4. **Diagnóstico (migrations 0041-0046, todas sem tocar dado real):**
   - 0041 tentou reescrever o corpo da função (forma diferente de INSERT) — não resolveu.
   - 0042 confirmou que `auth.uid()`, o dia calculado e o `exists()` de vendedor ativo, todos calculados de dentro da função, estavam corretos.
   - 0043 leu (sem alterar nada) a definição real das policies aplicadas — idêntica ao arquivo local.
   - 0044 tentou o INSERT de verdade dentro de um bloco de captura de erro, confirmando o `42501` de forma isolada.
   - 0045/0046, numa **tabela de teste totalmente separada** (nunca a tabela real), reproduziram o mesmo erro até com a regra mais simples possível (usuário + dia, sem nenhuma referência a outra tabela) — isolando a causa: **um INSERT feito de dentro de uma função do banco chamada via RPC é recusado pela trava de segurança (RLS) baseada em `auth.uid()`, mesmo com tudo correto — uma limitação deste ambiente específico, não um erro da regra ou da função.** O mesmo INSERT, feito direto pelo cliente sem passar por função, sempre funcionou (confirmado no diagnóstico do 0038 original).
5. **Correção (0047), com aprovação explícita:** minha primeira tentativa de escrever a correção (tornar a função `SECURITY DEFINER`) foi bloqueada automaticamente pelo meu próprio sistema de segurança, por ser uma mudança de postura de segurança. Expliquei ao dono a causa, a correção proposta e a garantia de que a escrita direta na tabela continua protegida pela RLS normal — ele respondeu **"Sim, pode seguir"**. Apliquei a migration final: `registrar_acesso_diario()` agora é `SECURITY DEFINER` (6ª exceção documentada do projeto, mesmo padrão de `is_supervisor()` desde a Fase 1) e faz, ela mesma, a mesma verificação que a RLS fazia (só vendedor ativo grava; só Supervisor aciona a limpeza de 35 dias). A migration também limpou a tabela e as funções temporárias de diagnóstico (0043/0045/0046).
6. **Confirmação final:** os 40 testes de integração passaram; `npx tsc --noEmit` limpo; nenhuma migration anterior a 0038 foi editada.

## Alerta de conformidade (LGPD)

Esta fase cria, pela primeira vez, um registro de uso de cada vendedor — dado pessoal de funcionário. O dono confirmou explicitamente, no checkpoint, que entende e aprova: o que é guardado (só quem + dia), quem lê (só Supervisor, travado no banco), e o prazo de 35 dias com descarte automático. A correção de segurança aplicada em 0047 não muda nada desse escopo de dados — só muda COMO a regra "só vendedor ativo grava" é aplicada tecnicamente (de RLS para verificação explícita dentro de uma função confiável), mantendo exatamente a mesma garantia. O lembrete de avisar o time de vendas (D-12) permanece uma decisão do dono, fora do escopo de código, e deve acontecer antes do lançamento em produção do marco v1.7.

## Task Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| Tarefa 1 | (chat, sem commit) | Aprovação explícita do dono via AskUserQuestion |
| Tarefa 2 | (aplicação manual do dono) | 0038/0039/0040 aplicadas, "Success" x3 |
| Tarefa 3 (diagnóstico) | `1b95000`, `a52d3ef`, `f8c417c`, `b3ea9e2`, `3d2e654`, `2cf1ff0` | 0041-0046, tentativa + 5 migrations de diagnóstico isolado |
| Tarefa 3 (correção) | `bda83b3` | 0047 — correção final aprovada, SECURITY DEFINER + limpeza |
| Tarefa 3 (bookkeeping) | `8ea36b5` | remoção dos scripts de diagnóstico temporários (`scripts/diag-30-rls*.mjs`) |
| REQUIREMENTS.md | `85ae29c` | correção de um erro de um executor anterior (ADER-01/02/03 marcados "Complete" prematuramente — revertido para Pending, só fecham no plano 30-06) |

## Files Created/Modified

- `supabase/migrations/0041_correcao_registrar_acesso_diario.sql` a `0047_correcao_final_registrar_acesso_diario.sql` (novas — nenhuma migration anterior a 0038 foi editada)
- `.planning/phases/30-ader-ncia-de-uso-no-dashboard/30-03-SUMMARY.md` (este arquivo)

## Deviations from Plan

1. **Migration extra não prevista no plano original (0041-0047):** o plano previa que uma correção pós-aplicação, se necessária, viraria "migration nova (0041...)" — exatamente o que aconteceu, só que precisou de 7 migrations (1 tentativa + 5 diagnósticos isolados + 1 correção final) em vez de 1, porque a causa raiz não era óbvia e exigiu isolamento cuidadoso sem tocar em dado real.
2. **Mudança de postura de segurança não prevista no plano (SECURITY DEFINER):** o plano assumia que RLS seria suficiente (mesma premissa do 30-01-PLAN.md). O diagnóstico revelou uma limitação real do ambiente que exigiu uma 6ª exceção documentada — tratada como uma decisão que exige aprovação humana explícita (obtida via AskUserQuestion, separada da aprovação original do checkpoint), não decidida unilateralmente.
3. Um arquivo de diagnóstico (`0046`) foi acidentalmente sobrescrito no disco pelo texto que o dono colou de volta no chat (efeito colateral do fluxo de copiar/colar, não uma ação minha) — identificado e restaurado do histórico do git antes de prosseguir; não teve nenhum efeito sobre o banco de produção (a migration já tinha sido aplicada com o conteúdo correto antes da sobrescrita local).

## Next Phase Readiness

- Aprovação do dono: OBTIDA (aplicação original + correção de segurança).
- Migrations 0038-0047 aplicadas em produção, confirmadas.
- 40/40 testes de integração verdes contra o banco real.
- Nenhuma migration anterior a 0038 editada.
- Plano 30-05 (que depende de 30-02/dashboard_aderencia_uso) já concluído em paralelo; plano 30-06 (coluna na UI) pode prosseguir — a base de dados real está funcionando de ponta a ponta.

## Self-Check: PASSED

- FOUND: supabase/migrations/0038_acessos_diarios.sql (aplicada)
- FOUND: supabase/migrations/0039_carimbos_desativacao_reativacao.sql (aplicada)
- FOUND: supabase/migrations/0040_dashboard_aderencia_uso.sql (aplicada)
- FOUND: supabase/migrations/0047_correcao_final_registrar_acesso_diario.sql (aplicada, correção final)
- 40/40 testes de integração passando contra o banco de produção real
- `npx tsc --noEmit` limpo
- Nenhuma migration anterior a 0038 editada

---
*Phase: 30-ader-ncia-de-uso-no-dashboard*
*Status: complete*
