---
phase: quick-260914-giv
plan: 01
subsystem: importacao
tags: [vitest, typescript, importacao-prospeccao, mensagens-de-erro]

requires: []
provides:
  - "Constante RESPONSAVEL_NAO_ENCONTRADO_REASON em lib/importacao/annotarLinha.ts, distinguindo responsável preenchido-sem-match de campo vazio"
affects: [importacao-prospeccao, importacao-ativos]

tech-stack:
  added: []
  patterns:
    - "Motivo de erro parametrizado por valor lido da célula (padrão já usado em annotarLinhaAtivo.ts), agora replicado em annotarLinha.ts para Responsável"

key-files:
  created: []
  modified:
    - lib/importacao/annotarLinha.ts
    - tests/importacao/annotarLinha.test.ts

key-decisions:
  - "RESPONSAVEL_NAO_ENCONTRADO_REASON segue exatamente o mesmo padrão de annotarLinhaAtivo.ts: `Responsável \"X\" não foi encontrado`, usada só no branch preenchido-sem-match (passo 4)"
  - "RESPONSAVEL_REASON (\"Responsável não informado\") continua intocada, reservada exclusivamente ao required-field check do passo 5 (campo genuinamente vazio)"
  - "lib/importacao/annotarLinhaAtivo.ts permanece fora de escopo — não editado, servindo só de referência de padrão"

patterns-established:
  - "Mensagens de erro de importação devem nomear o valor lido da célula quando o problema é 'valor não casa com nada', reservando frases genéricas só para 'campo vazio'"

requirements-completed: [QUICK-260914-giv]

coverage:
  - id: D1
    description: "Campo Responsável vazio continua produzindo 'Responsável não informado' (comportamento intocado)"
    requirement: "QUICK-260914-giv"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#flags a row with Nome Fantasia filled but Responsável blank as erro"
        status: pass
    human_judgment: false
  - id: D2
    description: "Campo Responsável preenchido mas sem match produz motivo distinto nomeando o valor lido, e nunca mais a frase de campo vazio"
    requirement: "QUICK-260914-giv"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#flags a responsável not found in lookups as erro (IMP-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Campo Responsável preenchido com match (email exato ou nome completo exato) continua status ok, sem regressão"
    requirement: "QUICK-260914-giv"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#resolves responsável by exact email"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#resolves responsável by normalized full name"
        status: pass
    human_judgment: false
  - id: D4
    description: "lib/importacao/annotarLinhaAtivo.ts permanece byte-a-byte intocado"
    requirement: "QUICK-260914-giv"
    verification:
      - kind: other
        ref: "git diff --stat -- lib/importacao/annotarLinhaAtivo.ts (saída vazia)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-14
status: complete
---

# Quick Task 260914-giv: Corrigir mensagem confusa de Responsável na importação de Prospecção Summary

**Nova constante `RESPONSAVEL_NAO_ENCONTRADO_REASON` em `annotarLinha.ts` nomeia o valor lido quando o Responsável não casa com nenhum vendedor, parando de reaproveitar a frase de campo vazio (mesmo padrão de `annotarLinhaAtivo.ts`).**

## Performance

- **Duration:** ~15 min
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Comportamento anterior confuso: uma linha com a coluna Responsável PREENCHIDA mas sem correspondência a nenhum vendedor cadastrado (nem por email, nem por "nome sobrenome" completo) mostrava a mesma frase `"Responsável não informado"` usada para célula genuinamente vazia — confirmado ao vivo na planilha real do dono: 231 de 429 linhas erraram com essa frase, nenhuma com célula de fato vazia. O usuário não tinha como saber, só olhando o erro, se o problema era "esqueci de preencher" ou "digitei um nome que não bate com ninguém cadastrado".
- Corrigido replicando o padrão já correto de `lib/importacao/annotarLinhaAtivo.ts` (importação de Clientes Ativos): nova constante `RESPONSAVEL_NAO_ENCONTRADO_REASON = (valor) => \`Responsável "${valor}" não foi encontrado\``, usada apenas no branch "preenchido mas sem match" (passo 4) de `annotarLinha.ts`. A constante `RESPONSAVEL_REASON` ("Responsável não informado") continua existindo e continua reservada exclusivamente ao required-field check do passo 5 (campo genuinamente vazio) — nenhuma mudança nesse branch.
- `lib/importacao/annotarLinhaAtivo.ts` (Clientes Ativos) confirmado intocado via `git diff --stat` (saída vazia) — era só a referência de padrão já correta, fora de escopo desta correção.

## Task Commits

Each task was committed atomically:

1. **Task 1: Distinguir mensagem de "não encontrado" da mensagem de "não informado" para Responsável em annotarLinha.ts** - `953c4c3` (fix, TDD: RED confirmado antes do GREEN)

## Files Created/Modified

- `lib/importacao/annotarLinha.ts` - nova constante `RESPONSAVEL_NAO_ENCONTRADO_REASON`; branch preenchido-sem-match do passo 4 passou a usá-la; comentários atualizados para explicar a distinção
- `tests/importacao/annotarLinha.test.ts` - teste existente do caso preenchido-sem-match ajustado para a nova mensagem + asserção negativa da frase antiga; teste do caso campo-vazio ganhou asserção de que nenhuma variante de "não foi encontrado" aparece

## Decisions Made

- Nenhuma decisão nova além das já travadas no PLAN.md: escopo estrito a `annotarLinha.ts` + seu teste, `RESPONSAVEL_REASON` intocada, nova constante seguindo o padrão exato de `annotarLinhaAtivo.ts`.

## Deviations from Plan

None - plano executado exatamente como escrito. Ciclo TDD (RED confirmado com a falha esperada antes do GREEN) seguido conforme especificado na tarefa.

## Issues Encountered

None.

## Verification Executed

1. `npx vitest run tests/importacao/annotarLinha.test.ts` — 29/29 passaram (GREEN).
2. `npx vitest run tests/importacao/confirmar.test.ts tests/importacao/prospeccao-vocabulario.test.ts` — 19/19 passaram (nada mais no fluxo de Prospecção quebrou).
3. `npx vitest run tests/importacao/annotarLinhaAtivo.test.ts` — 15/15 passaram, sem nenhuma mudança de comportamento (prova de isolamento entre os dois fluxos).
4. `npx tsc --noEmit` — limpo, sem erros.
5. `npx eslint lib/importacao/annotarLinha.ts tests/importacao/annotarLinha.test.ts` — limpo, sem erros.
6. `git diff --stat -- lib/importacao/annotarLinhaAtivo.ts` — saída vazia, arquivo de referência intocado.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

Correção pontual e isolada, sem impacto em outras fases. Não há bloqueios.

---
*Quick task: 260914-giv*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: lib/importacao/annotarLinha.ts
- FOUND: tests/importacao/annotarLinha.test.ts
- FOUND: .planning/quick/260914-giv-bug-mensagem-confusa-na-importacao-de-cl/260914-giv-SUMMARY.md
- FOUND: 953c4c3 (commit)
