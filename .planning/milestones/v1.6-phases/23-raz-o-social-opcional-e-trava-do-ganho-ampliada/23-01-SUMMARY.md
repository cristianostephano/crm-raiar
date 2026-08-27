---
phase: 23-raz-o-social-opcional-e-trava-do-ganho-ampliada
plan: 01
subsystem: database
tags: [postgres, plpgsql, rls, mover_card_funil, supabase]

# Dependency graph
requires:
  - phase: 18-cnpj-obrigat-rio-no-ganho
    provides: "mover_card_funil com o guard de CNPJ condicionado a TRANSIÇÃO (molde literal do grandfathering GANHO-02)"
  - phase: 260819-m8q (quick task)
    provides: "os 5 campos de endereço (cep/rua/numero/cidade/estado) já nullable em clientes (migration 0023) — pré-requisito da branch de endereço incompleto"
provides:
  - "clientes.razao_social nullable (migration 0024), unicidade preservada"
  - "mover_card_funil recriada (migration 0025) com dois guards novos de TRANSIÇÃO para ganho: razão social e endereço completo (os 5 campos), mesma assinatura de 7 parâmetros"
  - "grandfathering provado: clientes já ganho antes desta versão continuam legíveis/editáveis/reafirmáveis mesmo incompletos"
affects: [23-02, 25-import-a-o-de-clientes-ativos, 26-import-a-o-de-clientes-em-prospec-o-e-limpeza-de-menu]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard de transição: `p_novo_status = 'ganho' and v_encontrado and v_status_atual is distinct from 'ganho' and <condição de campo vazio>` — mesma forma para CNPJ, razão social e endereço, cada um em bloco `if` separado com mensagem própria"
    - "Booleano derivado calculado uma vez só para múltiplos campos relacionados (v_endereco_completo), em vez de checagens espalhadas"

key-files:
  created:
    - supabase/migrations/0024_razao_social_opcional.sql
    - supabase/migrations/0025_ganho_exige_razao_social_e_endereco.sql
    - tests/clientes/ganho-ficha-completa.test.ts
  modified: []

key-decisions:
  - "razao_social vira nullable sem tocar a unicidade (dois nulos nunca conflitam) — importar_clientes_lote não precisou ser recriada"
  - "Os dois guards novos são condicionados à TRANSIÇÃO (status atual diferente de 'ganho'), nunca ao estado — é o único mecanismo que entrega o grandfathering do GANHO-02, espelhando literalmente o CNPJ-02 da migration 0018"
  - "Endereço completo = exatamente os 5 campos que a migration 0023 tornou nullable (cep, rua, numero, cidade, estado); complemento fica de fora de propósito (D-04)"
  - "Assinatura de mover_card_funil não mudou (7 parâmetros) — os guards novos leem colunas já gravadas na linha, sem receber razão social/endereço como parâmetro"
  - "tests/clientes/ganho-ficha-completa.test.ts usa só serviceClient() (sem signInAs/senha) porque prova um fato de SCHEMA/corpo de função, não de RLS — e as contas seed de vendedor foram apagadas (STATE.md, 260819-l6o)"

patterns-established:
  - "Migration nova recriando mover_card_funil sem mudar assinatura não precisa do ritual de drop function — só é necessário quando a contagem/tipo de parâmetros muda"

requirements-completed: [GANHO-01, GANHO-02]

coverage:
  - id: D1
    description: "clientes.razao_social aceita valor nulo e a unicidade não trata dois nulos como conflito (D-05)"
    requirement: GANHO-01
    verification:
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts#Bloco A - insert direto com razao_social nula e aceito e cria a linha"
        status: pass
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts#Bloco A - dois inserts diretos com razao_social nula sao os dois aceitos"
        status: pass
    human_judgment: false
  - id: D2
    description: "Transição para ganho é recusada quando falta razão social ou qualquer um dos 5 campos de endereço, com o status permanecendo não-ganho"
    requirement: GANHO-01
    verification:
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts#Bloco B - cliente completo sem o campo de endereco '%s' tem o ganho recusado (it.each x5)"
        status: pass
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts#Bloco B - cliente completo com CNPJ mas razao_social nula tem o ganho recusado"
        status: pass
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts#Bloco B - cliente completo com razao_social so com espacos em branco tem o ganho recusado"
        status: pass
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts#Bloco B - cliente com razao_social, os 5 campos de endereco e CNPJ tem o ganho aceito"
        status: pass
    human_judgment: false
  - id: D3
    description: "Grandfathering: cliente já ganho antes desta versão, sem razão social e sem endereço, continua legível/editável e não é bloqueado ao reafirmar ganho nem ao ser arrastado"
    requirement: GANHO-02
    verification:
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts#Bloco C - cliente legado ganho sem razao_social e sem endereco continua legivel, editavel, e a reafirmacao de ganho nao e bloqueada"
        status: pass
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts#Bloco C - cliente legado ganho sem razao_social e sem endereco nao e bloqueado numa chamada no formato de arrastar card"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhuma regressão nos guards antigos (etapa do ganho, motivo de perda, frequência de visita, CNPJ) nem na RLS de mover_card_funil após a recriação da função"
    verification:
      - kind: manual_procedural
        ref: "npx vitest run tests/clientes/funil-constraints.test.ts tests/clientes/rls-visitas.test.ts (checkpoint humano, Task 3)"
        status: unknown
    human_judgment: true
    rationale: "As duas suítes rodaram e falharam, mas as 18 falhas são todas 'Invalid login credentials' — as contas seed vendedor.a+test/vendedor.b+test foram apagadas numa quick task anterior (260819-l6o, documentado em STATE.md Blockers), não é regressão desta fase. Nenhuma falha cita razão social/endereço/CNPJ, o que confirma que o guard não ficou retroativo, mas a suíte não pôde rodar de ponta a ponta por falta de credencial válida — decisão de aceitar essa evidência indireta foi do dono do projeto no checkpoint, registrado aqui para auditoria futura."

# Metrics
duration: ~15min (Tasks 1-2 automáticas) + pausa para checkpoint humano (Task 3: push + validação)
completed: 2026-08-24
status: complete
---

# Phase 23 Plan 1: Razão Social Opcional e Trava do Ganho Ampliada Summary

**`clientes.razao_social` vira nullable e `mover_card_funil` ganha dois guards novos de transição (razão social + os 5 campos de endereço) exigidos só no momento do ganho, com grandfathering total para quem já era ganho antes desta versão**

## Performance

- **Duration:** ~15min de execução automática (Tasks 1-2) + pausa para o checkpoint humano da Task 3 (push das migrations + validação dos testes)
- **Started:** 2026-08-24T17:11:00Z (aprox., a partir do commit do plano)
- **Completed:** 2026-08-24T18:08:00Z
- **Tasks:** 3/3 (2 automáticas + 1 checkpoint humano aprovado)
- **Files modified:** 3 (todos novos)

## Accomplishments
- `clientes.razao_social` deixou de exigir valor obrigatório (migration 0024), mantendo a unicidade — dois clientes sem razão social coexistem
- `mover_card_funil` recriada (migration 0025) com dois guards novos condicionados à TRANSIÇÃO para "ganho": razão social vazia e endereço incompleto (qualquer um dos 5 campos: CEP, rua, número, cidade, estado), cada um com mensagem própria orientando a completar a ficha
- Grandfathering provado: um cliente já "ganho" antes desta fase, mesmo sem razão social e sem endereço nenhum, continua legível, editável, e a transição não é bloqueada nem ao reafirmar ganho nem ao arrastar o card
- Migrations 0024/0025 aplicadas no banco hospedado pelo dono do projeto (`npx supabase@2.111.0 db push`) e os 12 testes de `tests/clientes/ganho-ficha-completa.test.ts` passaram

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrations 0024 e 0025 — razão social anulável e trava do ganho ampliada** - `3a1fdef` (feat)
2. **Task 2: Teste de integração da trava ampliada e do grandfathering** - `8491b48` (test)
3. **Task 3: Aplicar as migrations 0024 e 0025 no banco hospedado** - checkpoint humano, executado pelo dono do projeto (sem commit de código; push de schema)

**Plan metadata:** (este commit)

## Files Created/Modified
- `supabase/migrations/0024_razao_social_opcional.sql` - torna `clientes.razao_social` nullable, unicidade preservada
- `supabase/migrations/0025_ganho_exige_razao_social_e_endereco.sql` - `mover_card_funil` recriada com os dois guards novos de transição, mesma assinatura de 7 parâmetros, 4 guards antigos recopiados verbatim
- `tests/clientes/ganho-ficha-completa.test.ts` - 8 declarações (`it`/`it.each`), 12 execuções, três blocos (nulidade de razão social, trava ampliada, grandfathering)

## Decisions Made
- A condição de transição (`v_status_atual is distinct from 'ganho'`) é o único mecanismo do grandfathering — replicada literalmente do CNPJ-02 (migration 0018) para os dois guards novos
- Endereço completo = exatamente os 5 campos que a migration 0023 já tornou nullable; `complemento` fica de fora de propósito (D-04)
- Nenhuma constraint `CHECK` nova sobre razão social/endereço — uma exigência retroativa quebraria linhas "ganho" incompletas já em produção e abortaria o push
- Assinatura de `mover_card_funil` não mudou; por isso a migration 0025 não precisou do ritual de `drop function if exists <assinatura antiga>` que migrations com mudança de parâmetros exigem
- `tests/clientes/ganho-ficha-completa.test.ts` usa exclusivamente `serviceClient()` (nunca `signInAs`) porque o que se prova é um fato de schema/corpo de função, não de RLS, e as contas seed de vendedor foram apagadas numa quick task anterior

## Deviations from Plan

None - plan executado exatamente como escrito. As duas migrations e o arquivo de teste seguiram a especificação task a task, e todos os quatro contadores mecânicos de verificação da Task 1 bateram no primeiro try (drop not null=1, create or replace function=1, raise exception=6, is distinct from=3, 5 variáveis de endereço distintas).

## Issues Encountered

Ao rodar os dois arquivos de maior risco de regressão indicados pela Task 3 (`funil-constraints.test.ts`, `rls-visitas.test.ts`), as 18 falhas observadas foram todas `Invalid login credentials` para `vendedor.a+test@raiar.local` — a conta seed foi deliberadamente apagada numa quick task anterior (260819-l6o), pendência já documentada em `STATE.md` Blockers/Concerns, não uma regressão desta fase. Nenhuma das 18 falhas citou razão social, endereço ou CNPJ, o que é a evidência disponível de que o guard novo não ficou retroativo — mas, por não terem rodado de ponta a ponta com sessão válida, essa cobertura específica (D4 no bloco `coverage`) foi marcada `human_judgment: true` para auditoria futura, com a aprovação do dono do projeto registrada no checkpoint.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. O único passo manual (push das migrations no banco hospedado) já foi executado pelo dono do projeto na Task 3.

## Next Phase Readiness
- Plano 23-02 (mensagem na tela orientando completar a ficha) pode prosseguir: a trava no banco já existe e devolve mensagens específicas por campo faltante.
- Fase 25 (`importar_clientes_ativos_lote`) precisa copiar os dois guards novos verbatim, já que aquela RPC faz INSERT direto sem passar por `mover_card_funil` — referência cruzada já registrada no cabeçalho da migration 0025.
- Pendência não resolvida por este plano (fora de escopo): contas seed de teste (`vendedor.a+test`/`vendedor.b+test`) continuam apagadas, bloqueando a suíte completa de regressão de rodar limpa. Ver `STATE.md` Deferred Items.

---
*Phase: 23-raz-o-social-opcional-e-trava-do-ganho-ampliada*
*Completed: 2026-08-24*
