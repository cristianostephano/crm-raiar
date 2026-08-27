---
phase: 25-importa-o-de-clientes-ativos
plan: 01
subsystem: database
tags: [postgres, plpgsql, supabase-rls, vitest, jsonb_to_recordset]

requires:
  - phase: 23-raz-o-social-opcional-e-trava-do-ganho-ampliada
    provides: "razão social nullable (migration 0024) + guard ampliado de ganho na migration 0025 (razão social + endereço completo), que esta RPC precisa copiar verbatim"

provides:
  - "RPC `importar_clientes_ativos_lote(p_clientes jsonb)` — gravação em massa, baseada em conjunto, que cria clientes já em `status_acompanhamento = 'ganho'` / `etapa = 'primeira_venda'`, sem passar por `mover_card_funil`"
  - "Função auxiliar `cliente_ativo_pronto_para_ganho` — autoridade única de completude sobre os NOVE campos obrigatórios da importação de ativos, usada tanto no filtro do INSERT quanto na classificação do retorno"
  - "Retorno por linha (`razao_social, id, status`) classificando cada linha de entrada como `inserido`/`duplicado`/`incompleto`, sem exceção de lote inteiro"

affects: [25-02-anota-o-e-valida-o-da-planilha-de-ativos, 25-03-tela-de-importa-o-de-ativos]

tech-stack:
  added: []
  patterns:
    - "Função pura de completude com aridade fixa (9 parâmetros) chamada em dois pontos da mesma RPC — divergência futura de campos vira erro de compilação SQL, não bug silencioso"
    - "Filtro de completude pendurado na MESMA cláusula de seleção que alimenta o INSERT (nunca uma passada de validação separada) — fecha estruturalmente o risco de violação de restrição not null derrubar o lote inteiro"

key-files:
  created:
    - supabase/migrations/0027_importar_clientes_ativos_lote.sql
    - tests/importacao/importar-ativos-lote.test.ts
  modified: []

key-decisions:
  - "cliente_ativo_pronto_para_ganho cobre NOVE campos (razão social, CNPJ, CEP, rua, número, cidade, estado, responsável, contato) — estritamente maior que os sete campos dos guards de transição das migrations 0018/0025, porque responsável (not null desde a 0002) e contato (exigido por ATIVO-01) só entram no caminho de criação, não no de transição"
  - "Testes de integração usam createTestMember/signInAs (fixtures descartáveis) em vez das contas semente antigas, que foram apagadas em 2026-08-19 e derrubam ~49 arquivos de teste no projeto"
  - "Push da migration 0027 aplicado pelo dono do projeto via `npx supabase@2.111.0 db push` — mesmo padrão já registrado nas Fases 18/19/24 (o classificador de modo automático do ambiente bloqueia a tentativa do executor)"

patterns-established:
  - "Nome de função inédito no banco não precisa do ritual drop-antes-de-create (só necessário quando a assinatura de uma função já existente muda de contagem/tipo de parâmetro)"

requirements-completed: [ATIVO-01, ATIVO-02, ATIVO-03]

coverage:
  - id: D1
    description: "Uma linha completa de importação de ativos cria um cliente já em status_acompanhamento='ganho'/etapa='primeira_venda', numa única gravação, sem passar pelas 7 etapas do funil"
    requirement: "ATIVO-02"
    verification:
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#lotecompleto"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cliente importado nasce sem frequência de visita, sem âncora de dia fixo e sem visita pendente (frequência é definida depois, individualmente)"
    requirement: "ATIVO-01"
    verification:
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#semfrequencia"
        status: pass
    human_judgment: false
  - id: D3
    description: "Linha incompleta (CNPJ, cidade, responsável ou contato ausente/em branco) é recusada individualmente; as linhas boas do MESMO lote continuam sendo gravadas, sem exceção de lote inteiro"
    requirement: "ATIVO-03"
    verification:
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#loteMisto"
        status: pass
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#semresponsavel"
        status: pass
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#semcontato"
        status: pass
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#somenteespacos"
        status: pass
    human_judgment: false
  - id: D4
    description: "A função devolve uma linha por linha de entrada, classificada como inserido/duplicado/incompleto, com identificador nulo nas duas recusas"
    requirement: "ATIVO-03"
    verification:
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#retornoclassificado"
        status: pass
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#duplicado"
        status: pass
    human_judgment: false
  - id: D5
    description: "Produtos consumidos informados na linha são gravados em cliente_produtos, e um chamador não-Supervisor recebe exceção sem gravar nada"
    verification:
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#produtos"
        status: pass
      - kind: integration
        ref: "tests/importacao/importar-ativos-lote.test.ts#naosupervisor"
        status: pass
    human_judgment: false
  - id: D6
    description: "Os guards existentes de mover_card_funil (Fase 23/24) continuam intactos — esta migration não os toca"
    verification:
      - kind: integration
        ref: "tests/clientes/ganho-ficha-completa.test.ts"
        status: pass
    human_judgment: false

duration: ~15min (Tasks 1-2) + pausa de checkpoint (push manual do dono do projeto)
completed: 2026-08-26
status: complete
---

# Phase 25 Plan 01: Migration 0027 — importar_clientes_ativos_lote Summary

**Nova RPC `importar_clientes_ativos_lote`, com função auxiliar `cliente_ativo_pronto_para_ganho` de nove campos, que cria clientes já em "ganho"/"1ª venda concluída" numa gravação em massa baseada em conjunto, sem nunca passar por `mover_card_funil`.**

## Performance

- **Duration:** ~15min de execução ativa (Tasks 1-2) + pausa de checkpoint enquanto o dono do projeto aplicava a migration no banco hospedado
- **Tasks:** 3/3 (2 auto + 1 checkpoint humano)
- **Files modified:** 2 (1 migration nova, 1 arquivo de teste novo)

## Accomplishments

- RPC `importar_clientes_ativos_lote` grava clientes diretamente em `status_acompanhamento = 'ganho'` / `etapa = 'primeira_venda'`, numa única instrução, entregando ATIVO-02.
- Função auxiliar `cliente_ativo_pronto_para_ganho` centraliza a completude dos NOVE campos obrigatórios (razão social, CNPJ, CEP, rua, número, cidade, estado, responsável, contato) — usada tanto no filtro do INSERT quanto na classificação do retorno, com aridade fixa que transforma qualquer divergência futura entre os dois pontos de chamada em erro de compilação do SQL.
- O filtro de completude vive na MESMA cláusula de seleção que alimenta a criação (nunca uma passada de validação separada), fechando estruturalmente o risco de uma linha sem `responsavel` (coluna `not null` desde a migration 0002) abortar o lote inteiro por violação de restrição — o pior modo de falha possível contra ATIVO-03.
- Retorno por linha (`razao_social, id, status`) classifica cada linha de entrada como `inserido`, `duplicado` ou `incompleto`, permitindo à camada TypeScript (plano 25-02) explicar cada linha pulada sem adivinhar.
- 10 casos de teste de integração provam o contrato inteiro contra o banco hospedado real, usando fixtures descartáveis (`createTestMember`/`signInAs`) em vez das contas semente antigas apagadas.

## Task Commits

Each task was committed atomically:

1. **Task 1: Teste de integração que define o contrato da RPC de importação de ativos** - `3d3c573` (test)
2. **Task 2: Migration 0027 — função auxiliar de completude + RPC importar_clientes_ativos_lote** - `9d265d0` (feat)
3. **Task 3: Checkpoint humano — push da migration para o banco hospedado** - sem commit de código (ação externa do dono do projeto)

**Plan metadata:** (a ser preenchido pelo commit final desta etapa)

## Files Created/Modified

- `supabase/migrations/0027_importar_clientes_ativos_lote.sql` - função `cliente_ativo_pronto_para_ganho` (completude de 9 campos, immutable, sem elevação de privilégio) + RPC `importar_clientes_ativos_lote` (grava em `clientes`/`cliente_produtos`, retorno classificado por linha)
- `tests/importacao/importar-ativos-lote.test.ts` - 10 casos de integração cobrindo ATIVO-01/ATIVO-02/ATIVO-03, incluindo os dois casos críticos `semresponsavel` (not null na tabela) e `semcontato` (falha silenciosa sem o filtro)

## Decisions Made

- **Nove campos, não sete:** a condição de completude desta RPC cobre `responsavel` e `contato` além dos sete campos já exigidos nos guards de transição das migrations 0018/0025 (CNPJ + razão social + os cinco de endereço). `responsavel` entra porque a coluna é `not null` desde a migration 0002 e o caminho de criação (diferente do caminho de transição, onde o cliente já existe) precisa checá-la explicitamente; `contato` entra porque ATIVO-01 o nomeia como obrigatório nesta planilha nova, e a coluna é anulável na tabela (silenciosamente aceitaria nulo sem o filtro).
- **Filtro pendurado na mesma cláusula de seleção da criação** (nunca uma passada de validação separada, nunca um bloco de exceção em volta do INSERT) — é a única forma que fecha estruturalmente o risco de uma linha sem `responsavel` abortar o lote inteiro por violação de restrição `not null`.
- **Fixtures descartáveis em vez de contas semente:** `tests/importacao/importar-ativos-lote.test.ts` usa `createTestMember("supervisor"/"vendedor")` + `signInAs` (duas autenticações no arquivo inteiro), porque as contas semente antigas (`vendedor.a+test`/`vendedor.b+test`) foram apagadas em 2026-08-19 e a autenticação de sessão real é inevitável aqui — `is_supervisor()` lê `auth.uid()`, que é nulo sob o cliente de service role.
- **Push manual pelo dono do projeto:** mesma decisão já registrada nas Fases 18/19/24 — o classificador de modo automático do ambiente bloqueia a tentativa do executor de rodar `supabase db push`.

## Deviations from Plan

None - plan executado exatamente como escrito. A migration seguiu o molde das migrations 0006/0019/0025 ponto a ponto, e o arquivo de teste seguiu a disciplina de `ganho-ficha-completa.test.ts`/`endereco-opcional.test.ts` (RED até o checkpoint aplicar a migration).

## Issues Encountered

- `tests/importacao/rls-importar-lote.test.ts` (RPC irmã `importar_clientes_lote`, não tocada por esta migration) falhou com 8 erros de "Invalid login credentials" para `vendedor.a+test@raiar.local` durante a verificação pós-checkpoint — é a mesma pendência já conhecida e registrada em STATE.md (contas semente apagadas em 2026-08-19, ~49 arquivos afetados). Fora de escopo desta migration: confirmado pelo próprio erro (falha de login, não de comportamento da RPC) e pelo fato de o arquivo testar a função antiga, intocada aqui. Não foi corrigido — é o motivo exato pelo qual esta Task 1 optou por fixtures descartáveis em vez de reusar as contas semente.

## User Setup Required

None além do checkpoint já resolvido - migration 0027 aplicada em produção pelo dono do projeto via `npx supabase@2.111.0 db push` ("Finished supabase db push").

## Next Phase Readiness

- `importar_clientes_ativos_lote` está em produção, pronta para o plano 25-02 anotar/validar a planilha de ativos (resolução de responsável/produtos, checagem de duplicado do lado do cliente) e o plano 25-03 construir a tela de importação sobre ela.
- `SYSTEM_FIELDS_ATIVO` (plano 25-02, `lib/importacao/typesAtivo.ts`) precisa marcar exatamente os mesmos NOVE campos como obrigatórios que `cliente_ativo_pronto_para_ganho` exige aqui — a tela e o banco não podem divergir nem por subconjunto nem por superconjunto.
- Nenhum bloqueio novo. A pendência pré-existente das contas semente apagadas (rls-importar-lote.test.ts e ~48 outros arquivos) continua registrada em STATE.md, sem relação com este plano.

---
*Phase: 25-importa-o-de-clientes-ativos*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: supabase/migrations/0027_importar_clientes_ativos_lote.sql
- FOUND: tests/importacao/importar-ativos-lote.test.ts
- FOUND: .planning/phases/25-importa-o-de-clientes-ativos/25-01-SUMMARY.md
- FOUND: commit 3d3c573 (test)
- FOUND: commit 9d265d0 (feat)
