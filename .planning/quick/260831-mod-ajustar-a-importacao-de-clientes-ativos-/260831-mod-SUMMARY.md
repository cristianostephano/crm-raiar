---
phase: quick-260831-mod
plan: 01
subsystem: database
tags: [supabase, rls, vitest, importacao, vendedor, plpgsql]

requires:
  - phase: 25-importacao-clientes-ativos
    provides: "SYSTEM_FIELDS_ATIVO com contato required:true, cliente_ativo_pronto_para_ganho (migration 0027) exigindo contato"
  - phase: 26-importacao-prospeccao-limpeza-menu
    provides: "isolamento entre annotarLinha.ts (Prospecção) e annotarLinhaAtivo.ts (Ativos)"
provides:
  - "Contato opcional na importação de Clientes Ativos (tela e RPC de gravação em massa)"
  - "Casamento de Responsável por primeiro nome único em annotarLinhaAtivo.ts"
  - "Migration 0029 aplicada no banco hospedado"
affects: [importacao-clientes-ativos, findVendedor, cliente_ativo_pronto_para_ganho]

tech-stack:
  added: []
  patterns:
    - "Migration que altera só o CORPO de uma função PL/pgSQL preservando a assinatura, quando outra função já aplicada em produção chama por argumentos posicionais"

key-files:
  created:
    - supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql
    - .planning/quick/260831-mod-ajustar-a-importacao-de-clientes-ativos-/deferred-items.md
  modified:
    - lib/importacao/typesAtivo.ts
    - lib/importacao/annotarLinhaAtivo.ts
    - tests/importacao/ativos-vocabulario.test.ts
    - tests/importacao/annotarLinhaAtivo.test.ts
    - tests/importacao/importar-ativos-lote.test.ts

key-decisions:
  - "D-01: Contato deixa de ser obrigatório na importação de Clientes Ativos — reversão explícita da decisão da Fase 25 (ATIVO-01), motivada por teste ao vivo com a planilha real da equipe (1909 linhas) que ainda não coleta contato/telefone"
  - "D-02: Casamento por primeiro nome fica restrito a annotarLinhaAtivo.ts (Ativos); annotarLinha.ts (Prospecção) permanece intocado"
  - "D-03: Ambiguidade de primeiro nome (2+ vendedores) nunca resolve por acaso — sempre produz o erro 'não foi encontrado'"

requirements-completed: [QUICK-260831-mod]

coverage:
  - id: D1
    description: "SYSTEM_FIELDS_ATIVO com 8 campos obrigatórios (contato fora); linha sem contato é aceita na tela (status ok) e gravada na RPC hospedada (status inserido, coluna contato nula)"
    requirement: "QUICK-260831-mod"
    verification:
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts"
        status: pass
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#contatoopcional (revertido, quick task 260831-mod): linha com contato nulo é aceita e gravada normalmente"
        status: pass
    human_judgment: false
  - id: D2
    description: "findVendedor casa por primeiro nome único (case/acento-insensitive); ambiguidade de 2+ vendedores com mesmo primeiro nome continua produzindo o erro 'não foi encontrado'; casamento por email e por nome completo sem regressão"
    requirement: "QUICK-260831-mod"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#primeironomeunico"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#primeironomeambiguo"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#responsavelnomecompleto"
        status: pass
    human_judgment: false
  - id: D3
    description: "Migration 0029 aplicada no banco hospedado via checkpoint humano (Task 3)"
    requirement: "QUICK-260831-mod"
    verification:
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts (suíte completa contra banco hospedado)"
        status: pass
    human_judgment: false

duration: (não medido — sessão retomada; ver nota de continuação abaixo)
completed: 2026-08-31
status: complete
---

# Quick Task 260831-mod: Ajustar importação de Clientes Ativos Summary

**Contato deixa de ser obrigatório na importação de Ativos e `findVendedor` passa a casar Responsável por primeiro nome único quando não há ambiguidade — migration 0029 já aplicada no banco hospedado.**

## Performance

- **Duration:** não medido de ponta a ponta (esta execução retomou uma sessão anterior já com as Tasks 1 e 2 commitadas; ver "Issues Encontrados" abaixo)
- **Completed:** 2026-08-31
- **Tasks:** 3/3 (Task 1 e 2 auto; Task 3 checkpoint:human-action)
- **Files modified:** 6 (1 arquivo novo de migration + 5 modificados)

## Accomplishments

- `SYSTEM_FIELDS_ATIVO` (lib/importacao/typesAtivo.ts) tem agora 8 campos obrigatórios (era 9) — `contato` virou `required: false`, mantendo o histórico da decisão original da Fase 25 (ATIVO-01) no comentário de justificativa.
- Migration `0029_contato_opcional_na_importacao_de_ativos.sql` alterou só o CORPO de `cliente_ativo_pronto_para_ganho`, removendo a checagem de contato da condição de completude, preservando a assinatura de 9 parâmetros usada por `importar_clientes_ativos_lote` (migration 0027, já em produção). **Aplicada no banco hospedado** (Task 3, confirmada pelo teste de integração passando contra o banco real).
- `findVendedor` em `lib/importacao/annotarLinhaAtivo.ts` ganhou um terceiro critério de casamento: primeiro nome único (normalizado via `normalizeRazaoSocial`, case/acento-insensitive) — só resolve quando exatamente 1 vendedor da lista de lookups tem aquele primeiro nome.
- `lib/importacao/annotarLinha.ts` (Prospecção) permanece byte-a-byte intocado — confirmado por `git diff --stat` vazio.

## Task Commits

Cada task foi commitada atomicamente (nesta sessão de continuação, os commits das Tasks 1 e 2 já existiam de uma sessão anterior):

1. **Task 1: Contato vira opcional — vocabulário + migration 0029 + testes** — `1d2ca26` (fix, vocabulário/testes) + `10e6213` (fix, migration 0029)
2. **Task 2: Casamento de Responsável por primeiro nome único** — `b75ed1a` (feat)
3. **Task 3: Checkpoint — aplicar migration 0029 no banco hospedado** — sem commit de código; verificado por teste de integração passando contra o banco hospedado nesta sessão (`npx vitest run tests/importacao/importar-ativos-lote.test.ts` → 10/10 verde, incluindo o caso `contatoopcional`)

## Files Created/Modified

- `lib/importacao/typesAtivo.ts` - `contato` vira `required: false`; comentário de justificativa documenta a reversão de D-01 sem apagar o histórico da Fase 25
- `supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql` - remove a checagem de contato do corpo de `cliente_ativo_pronto_para_ganho`, aridade de 9 parâmetros preservada
- `lib/importacao/annotarLinhaAtivo.ts` - `findVendedor` ganha terceiro critério: primeiro nome único
- `tests/importacao/ativos-vocabulario.test.ts` - `REQUIRED_KEYS` com 8 chaves (contato fora)
- `tests/importacao/annotarLinhaAtivo.test.ts` - testes de contato opcional + 3 testes novos de casamento por primeiro nome (único, ambíguo, regressão nome completo)
- `tests/importacao/importar-ativos-lote.test.ts` - teste `contatoopcional` substituindo o antigo `semcontato`
- `.planning/quick/260831-mod-ajustar-a-importacao-de-clientes-ativos-/deferred-items.md` - item adiado (ver abaixo)

## Decisions Made

- **D-01** (dono do projeto): Contato deixa de bloquear a importação de Ativos — a planilha real da equipe (1909 linhas testadas ao vivo) ainda não coleta esse dado; os vendedores preenchem depois na ficha do cliente. O campo continua existindo e sendo gravado quando vier preenchido.
- **D-02** (dono do projeto): O casamento por primeiro nome é exclusivo de `annotarLinhaAtivo.ts` (Ativos) — `annotarLinha.ts` (Prospecção) fica fora de escopo nesta task.
- **D-03** (dono do projeto): Ambiguidade de primeiro nome (2+ vendedores) nunca resolve por acaso, sempre é erro — proteção contra atribuir cliente ao vendedor errado.

## Deviations from Plan

None - plano executado exatamente como escrito nas Tasks 1 e 2. A Task 3 (checkpoint humano) foi confirmada por verificação automatizada nesta sessão de continuação: a suíte de integração já estava verde contra o banco hospedado, indicando que a migration 0029 já havia sido aplicada (`npx supabase db push` rodado pelo dono do projeto) antes desta retomada.

## Issues Encountered

- **Sessão de continuação:** esta execução começou como um agente novo sem histórico da conversa anterior. As Tasks 1 e 2 já estavam commitadas (`1d2ca26`, `10e6213`, `b75ed1a`) quando a execução foi retomada. Confirmado via `git log` e reexecução dos testes (24/24 verdes nos arquivos puros) que nenhum retrabalho era necessário. A Task 3 foi validada rodando o teste de integração diretamente contra o banco hospedado (10/10 verdes, incluindo `contatoopcional`), sem necessidade de pedir novamente a ação humana — a migration já estava aplicada.
- **Falha pré-existente fora de escopo:** `tests/importacao/rls-importar-lote.test.ts` falha em 8/8 casos que dependem de login do usuário de teste `vendedor.a+test@raiar.local` (`Invalid login credentials`) no banco hospedado. Confirmado via `git log` que nenhum arquivo relacionado (`rls-importar-lote.test.ts`, `tests/helpers/supabase-test-clients.ts`) foi tocado por esta task — a última alteração é de fases anteriores (07-01/10-02/19-01). Documentado em `deferred-items.md`; não bloqueia as mudanças desta task porque `annotarLinha.ts` e `importar_clientes_lote` (RPC irmã de Prospecção) não foram alterados aqui.

## User Setup Required

Nenhum passo pendente — a migration 0029 já foi aplicada no banco hospedado (Task 3, checkpoint humano concluído antes desta retomada, confirmado por teste de integração passando).

## Next Phase Readiness

- Importação de Clientes Ativos pronta para reuso pela equipe com a planilha real (contato opcional, Responsável por primeiro nome).
- Pendência para tarefa futura dedicada: investigar por que a credencial de teste `vendedor.a+test@raiar.local` está inválida no banco hospedado (`tests/importacao/rls-importar-lote.test.ts`), fora do escopo desta quick task.

## Self-Check: PASSED

- FOUND: lib/importacao/typesAtivo.ts
- FOUND: supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql
- FOUND: lib/importacao/annotarLinhaAtivo.ts
- FOUND: tests/importacao/ativos-vocabulario.test.ts
- FOUND: tests/importacao/annotarLinhaAtivo.test.ts
- FOUND: tests/importacao/importar-ativos-lote.test.ts
- FOUND: commit 1d2ca26
- FOUND: commit 10e6213
- FOUND: commit b75ed1a

---
*Phase: quick-260831-mod*
*Completed: 2026-08-31*
