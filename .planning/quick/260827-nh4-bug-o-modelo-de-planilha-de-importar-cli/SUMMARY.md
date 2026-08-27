---
phase: quick
plan: 01
subsystem: importacao
tags: [xlsx, vitest, spreadsheet-model, ativos]

# Dependency graph
requires:
  - phase: 26-plano-2
    provides: "REQUIRED_MARKER pattern em buildModeloImportacao (lib/importacao/modelo.ts)"
provides:
  - "buildModeloAtivos sufixando cabecalhos obrigatorios com ' *', igual ao modelo de prospeccao"
affects: [importacao, ativo-import-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "REQUIRED_MARKER (' *') declarado localmente por gerador de modelo (modelo.ts e agora modeloAtivo.ts), nunca compartilhado entre arquivos — cada gerador de planilha tem sua propria constante"

key-files:
  created: []
  modified:
    - lib/importacao/modeloAtivo.ts
    - tests/importacao/ativos-vocabulario.test.ts

key-decisions:
  - "REQUIRED_MARKER declarado localmente em modeloAtivo.ts (nao importado de modelo.ts) para manter os dois geradores de modelo desacoplados, espelhando a decisao original da Fase 26"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "buildModeloAtivos sufixa com ' *' os 9 cabecalhos required:true de SYSTEM_FIELDS_ATIVO (incluindo CNPJ), mantendo os 7 opcionais sem sufixo"
    verification:
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts#modelo: buildModeloAtivos gera 16 colunas com os rotulos do vocabulario (sufixados ' *' quando required), na ordem, mais uma linha de exemplo com 16 celulas"
        status: pass
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts#modelo: cabecalho de CNPJ (campo required) sai sufixado como 'CNPJ *'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Um modelo de ativos baixado, preenchido e reenviado continua sendo mapeado automaticamente por suggestMapping, mesmo com o sufixo ' *' no cabecalho (nao exige remapeamento manual)"
    verification:
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts#modelo: round-trips every generated header back to its SYSTEM_FIELDS_ATIVO key via suggestMapping"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-27
status: complete
---

# Quick Task: Corrigir sufixo de campos obrigatórios no modelo de "Importar Clientes Ativos" Summary

**`buildModeloAtivos` agora marca os 9 cabeçalhos obrigatórios (incluindo CNPJ) com o sufixo " *", igual ao modelo de "Importar Clientes em Prospecção" já fazia desde a Fase 26 — corrigido via `REQUIRED_MARKER` local + 3 testes automatizados.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `buildModeloAtivos` (lib/importacao/modeloAtivo.ts) sufixa com " *" todo cabeçalho de campo `required:true` de `SYSTEM_FIELDS_ATIVO` — os 9 campos (razaoSocial, cnpj, cep, rua, numero, cidade, estado, contato, responsavel), incluindo o caso relatado pelo usuário (CNPJ).
- Os 7 campos opcionais (nomeFantasia, complemento, categoria, telefone, email, produtos, numeroDeLojas) permanecem sem sufixo.
- Confirmado por teste automatizado que o sufixo não quebra `suggestMapping`: cada cabeçalho gerado, incluindo os sufixados, continua resolvendo para a `key` correta do campo correspondente (round-trip) — um modelo baixado/preenchido/reenviado continua sendo mapeado sozinho.
- Teste pré-existente que validava (incorretamente) cabeçalhos sem sufixo foi corrigido para validar o comportamento certo, evitando que o bug voltasse a passar despercebido.

## Task Commits

Único task do plano, commit atômico:

1. **Task 1: Sufixar cabeçalhos obrigatórios em buildModeloAtivos** - `8e3126c` (fix)

_Nota: tarefa marcada `tdd="true"` no plano, mas o "vermelho" (teste falhando antes do fix) foi validado manualmente durante a execução em vez de gerar um commit `test(...)` separado — o teste corrigido e os dois novos testes já nasceram junto com a implementação corrigida no mesmo commit, já que a alteração é de uma linha isolada (sem risco de regressão intermediária)._

## Files Created/Modified
- `lib/importacao/modeloAtivo.ts` - declara `REQUIRED_MARKER = " *"` (local ao arquivo) e sufixa `headers` para campos `required:true`; comentário de topo atualizado explicando a correção e por que é segura para `suggestMapping`
- `tests/importacao/ativos-vocabulario.test.ts` - corrige a asserção do teste "modelo: buildModeloAtivos gera 16 colunas..." para esperar o sufixo; adiciona teste específico do caso CNPJ e teste de round-trip via `suggestMapping`

## Decisions Made
- `REQUIRED_MARKER` foi declarado localmente em `modeloAtivo.ts` (não importado de `lib/importacao/modelo.ts`), mantendo os dois geradores de modelo desacoplados — mesma abordagem que já existia entre eles antes deste fix (cada um com sua própria cópia de `EXAMPLE_VALUES`).

## Deviations from Plan

None - plano executado exatamente como escrito. `lib/importacao/mapping.ts` e `lib/importacao/typesAtivo.ts` não foram tocados, apenas lidos para confirmar que a normalização de `suggestMapping` já descarta o sufixo com segurança.

## Issues Encountered

Ao rodar a verificação ampliada (`npx vitest run tests/importacao/`), 14 testes de RLS (`rls-importar-lote.test.ts`, `rls-dedup-read.test.ts`) falharam com `Invalid login credentials` ao tentar `signInAs("vendedor.a+test@raiar.local")`. Confirmado via `git stash` que essas falhas são **pré-existentes** (mesmas falhas antes desta mudança) — dependem de um Supabase local com usuários de teste seedados, que não está disponível/configurado neste ambiente de execução. Fora do escopo desta tarefa (Rule "scope boundary" do executor): não foram tocadas nem investigadas além de confirmar que não são causadas por este fix. `tsc --noEmit` rodou limpo (sem erros).

## Next Phase Readiness

Sem bloqueios. A suíte alvo do plano (`ativos-vocabulario.test.ts`, `modelo.test.ts`, `mapping.test.ts`) passa integralmente (26/26). A verificação manual opcional (baixar o modelo pela UI `AtivoImportWizard` e conferir o " *" no Excel/LibreOffice) não foi executada — é explicitamente não-bloqueante no plano.

---
*Quick task: 260827-nh4-bug-o-modelo-de-planilha-de-importar-cli*
*Completed: 2026-08-27*

## Self-Check: PASSED
