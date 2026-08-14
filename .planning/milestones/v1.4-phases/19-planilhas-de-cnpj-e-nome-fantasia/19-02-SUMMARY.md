---
phase: 19-planilhas-de-cnpj-e-nome-fantasia
plan: 02
subsystem: import
tags: [typescript, zod, xlsx, vitest, import-wizard]

# Dependency graph
requires:
  - phase: 19-planilhas-de-cnpj-e-nome-fantasia (plano 01)
    provides: "importar_clientes_lote (migration 0019) já lê cnpj/nome_fantasia do registro de cada linha da carga; as duas colunas continuam opcionais"
provides:
  - "cnpj e nomeFantasia como membros de SystemField (16 campos no total), opcionais, com rótulos 'CNPJ' e 'Nome Fantasia'"
  - "modelo de planilha baixável com as duas colunas novas e exemplos plausíveis"
  - "sugestão automática de coluna reconhecendo variações de cabeçalho de CNPJ/Nome Fantasia, sem contaminar o vocabulário de frequência (Fase 17)"
  - "ResolvedRow e RpcClienteRow carregando os dois valores até a carga da chamada em lote, com as chaves snake_case exatas que a função do banco lê"
affects: [19-03-planilha-cnpj-em-massa-logica, 19-04-planilha-cnpj-em-massa-tela]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vocabulário único (SYSTEM_FIELDS) continua sendo a única fonte que alimenta modelo, mapeamento de coluna e Select da tela ao mesmo tempo — estender a lista lá propaga para os três consumidores sem editar cada um"
    - "Campo opcional novo no formato annotarLinha: trim() explícito + conversão para null quando vazio, sem entrada no schema Zod de linha e sem motivo de erro — molde reusável para qualquer futuro campo de texto livre opcional"

key-files:
  created: []
  modified:
    - lib/importacao/types.ts
    - lib/importacao/modelo.ts
    - lib/importacao/mapping.ts
    - lib/importacao/annotarLinha.ts
    - lib/importacao/confirmar.ts
    - tests/importacao/mapping.test.ts
    - tests/importacao/column-mapping-table.test.tsx
    - tests/importacao/annotarLinha.test.ts
    - tests/importacao/confirmar.test.ts

key-decisions:
  - "cnpj/nomeFantasia inseridos logo depois de razaoSocial na lista de 16 campos (não no final), por serem as outras duas formas de identificar a empresa"
  - "Apenas um apelido novo em ALIASES ('fantasia' -> nomeFantasia) — todas as outras variações de cabeçalho do plano ('CNPJ', 'cnpj', 'C.N.P.J.', 'Cnpj', 'Nome Fantasia', 'nome_fantasia', 'NOME FANTASIA') já normalizam para o mesmo texto do label de SYSTEM_FIELDS e batem por correspondência de label, sem precisar de entrada redundante na tabela"
  - "Nenhuma edição em tests/importacao/modelo.test.ts — suas asserções já derivam de SYSTEM_FIELDS.length/labels e continuam corretas automaticamente com 16 campos"

patterns-established: []

requirements-completed: [IMP-01, IMP-02]

coverage:
  - id: D1
    description: "cnpj e nomeFantasia existem no vocabulário SYSTEM_FIELDS (16 entradas), com rótulos 'CNPJ'/'Nome Fantasia', ambos opcionais; os 7 campos obrigatórios continuam exatamente os mesmos"
    requirement: IMP-01
    verification:
      - kind: unit
        ref: "node -e verificação mecânica do plano (16 definições, 7 obrigatórias idênticas, cnpj/nomeFantasia opcionais)"
        status: pass
      - kind: unit
        ref: "tests/importacao/mapping.test.ts, tests/importacao/column-mapping-table.test.tsx, tests/importacao/frequencia-vocabulario.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "O modelo de planilha baixável ganha as duas colunas novas, na ordem da lista, com exemplo plausível em cada"
    requirement: IMP-02
    verification:
      - kind: unit
        ref: "tests/importacao/modelo.test.ts (asserções autoderivadas de SYSTEM_FIELDS, sem edição necessária)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sugestão automática de coluna reconhece as variações de cabeçalho de CNPJ e Nome Fantasia, sem vazar para o vocabulário de frequência (Fase 17, D4)"
    requirement: IMP-01
    verification:
      - kind: unit
        ref: "tests/importacao/mapping.test.ts#suggests cnpj for spelling variations of the header (IMP-01), #suggests nomeFantasia for spelling variations of the header (IMP-02), #does not leak the new cnpj/nomeFantasia aliases into the frequência vocabulary (Fase 17, D4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "annotarLinha carrega os dois valores saneados até a linha resolvida (texto opcional, nulo quando ausente/só espaço), sem motivo de erro e sem validação de formato de CNPJ (T-19-11)"
    requirement: IMP-01
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#resolves cnpj and nomeFantasia from sanitized cells when present, #resolves cnpj and nomeFantasia to null when absent, #resolves a whitespace-only cnpj cell to null, #accepts any non-empty cnpj value regardless of format, #sanitizes a formula-risk cnpj cell through the same row-wide sanitization path"
        status: pass
    human_judgment: false
  - id: D5
    description: "A carga da chamada em lote leva cnpj/nome_fantasia nas chaves snake_case exatas que a função do banco lê, mapeadas a partir da linha resolvida (incluindo o caso nulo) (T-19-12)"
    requirement: IMP-02
    verification:
      - kind: unit
        ref: "tests/importacao/confirmar.test.ts#maps cnpj and nomeFantasia from the resolved row to the RPC's snake_case keys, #maps a null cnpj/nomeFantasia on the resolved row to null in the RPC payload"
        status: pass
    human_judgment: false
  - id: D6
    description: "Nenhuma regressão: dedupe/preview continuam verdes; typesFrequencia.ts, ColumnMappingTable.tsx e lib/validations/importacao.ts não foram tocados"
    verification:
      - kind: unit
        ref: "tests/importacao/preview.test.ts, tests/importacao/dedupe.test.ts (40 testes verdes no total dos 4 arquivos de Task 2); git diff --name-only confirma os 3 arquivos proibidos intocados"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-08-11
status: complete
---

# Phase 19 Plan 2: Planilhas de CNPJ e Nome Fantasia (camada de aplicação) Summary

**CNPJ e Nome Fantasia atravessam a cadeia inteira do assistente "Importar clientes" já existente — vocabulário, modelo baixável, sugestão automática de coluna, Select de mapeamento, linha resolvida e carga da chamada em lote — sem tocar em nenhuma validação de formato.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2
- **Files modified:** 9 (5 de aplicação, 4 de teste)

## Accomplishments

- `SYSTEM_FIELDS` cresce de 14 para 16 entradas: `cnpj` ("CNPJ") e `nomeFantasia` ("Nome Fantasia") inseridas logo após `razaoSocial`, ambas opcionais — o conjunto de 7 campos obrigatórios permanece idêntico, verificado mecanicamente.
- Modelo de planilha baixável (`buildModeloImportacao`) ganha as duas colunas com exemplos plausíveis ("12.345.678/0001-90" e "Distribuidora Exemplo"), sem precisar editar o teste (`modelo.test.ts` deriva suas asserções da própria lista de campos).
- Sugestão automática de coluna reconhece "CNPJ"/"cnpj"/"C.N.P.J."/"Cnpj" e "Nome Fantasia"/"nome_fantasia"/"NOME FANTASIA" via correspondência direta de label (já cobertas pela normalização existente); só "fantasia" isolado precisou de um apelido novo em `ALIASES`. Provado que os apelidos novos não vazam para o vocabulário de frequência da Fase 17 (checagem de pertencimento D4, intocada).
- `ColumnMappingTable.tsx` não precisou de nenhuma edição — verificado mecanicamente que o arquivo continua sem menção a `cnpj`/`nomeFantasia`, confirmando que ele já deriva as opções do Select da lista de campos recebida.
- `ResolvedRow` ganha `cnpj`/`nomeFantasia` (`string | null`), carregados a partir da célula já saneada pelo passo de sanitização da linha inteira (nenhum segundo ponto de leitura de célula criado, mitigando T-19-11), aparados e convertidos para `null` quando ausentes ou só espaço em branco — sem nenhum motivo de erro novo e sem entrada no schema Zod de linha (`lib/validations/importacao.ts` intocado, verificado mecanicamente).
- `RpcClienteRow` ganha `cnpj`/`nome_fantasia` (chaves snake_case, exatamente as que `importar_clientes_lote` lê desde a migration 0019 do plano 19-01); `toRpcClienteRow` mapeia os dois valores direto da linha resolvida, incluindo o caso nulo — mitigando T-19-12 (grafia errada faria o valor sumir sem erro).
- 40 testes verdes nos 4 arquivos-alvo do Task 2 (`annotarLinha.test.ts`, `confirmar.test.ts`, `preview.test.ts`, `dedupe.test.ts`); 67 testes verdes na suíte completa de verificação do plano (8 arquivos).

## Task Commits

1. **Task 1: Vocabulário, modelo e sugestão automática de coluna**
   - `6ebc68d` (test) — casos RED de `suggestMapping` para CNPJ/Nome Fantasia + não-contaminação; textos "14"→"16" em `column-mapping-table.test.tsx`
   - `c528469` (feat) — GREEN: `types.ts`/`modelo.ts`/`mapping.ts` estendidos
2. **Task 2: Levar os dois valores da célula até a carga da chamada em lote**
   - `e54cf7f` (test) — casos RED em `annotarLinha.test.ts`/`confirmar.test.ts`
   - `ad85d34` (feat) — GREEN: `annotarLinha.ts`/`confirmar.ts` estendidos

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified

- `lib/importacao/types.ts` — `SystemField` união ganha `cnpj`/`nomeFantasia`; `SYSTEM_FIELDS` cresce para 16 entradas; banner do topo atualizado.
- `lib/importacao/modelo.ts` — `EXAMPLE_VALUES` ganha os dois valores de exemplo novos (mapa total tipado por chave, compilador força a completude).
- `lib/importacao/mapping.ts` — `ALIASES` ganha a entrada `fantasia -> nomeFantasia`; nenhuma outra função tocada.
- `lib/importacao/annotarLinha.ts` — `ResolvedRow` ganha `cnpj`/`nomeFantasia` (`string | null`); preenchidos a partir da célula saneada, aparados, nulos quando vazios.
- `lib/importacao/confirmar.ts` — `RpcClienteRow` ganha `cnpj`/`nome_fantasia`; `toRpcClienteRow` mapeia os dois valores.
- `tests/importacao/mapping.test.ts` — casos novos de sugestão de CNPJ/Nome Fantasia e não-contaminação do vocabulário de frequência.
- `tests/importacao/column-mapping-table.test.tsx` — texto de nome de caso e variável de teste atualizados de "14"/"quatorze" para "16"/"dezesseis" (nenhuma asserção afrouxada).
- `tests/importacao/annotarLinha.test.ts` — casos novos cobrindo presença/ausência/espaço-em-branco/formato-livre/sanitização-de-fórmula para os dois campos.
- `tests/importacao/confirmar.test.ts` — `makeResolved`/`emptyRpcRow` ganham os dois campos; casos novos provando o mapeamento para a carga, incluindo o caso nulo.

## Decisions Made

- **Posição dos campos novos:** `cnpj`/`nomeFantasia` logo após `razaoSocial` na lista de 16, não no final — fazem mais sentido lidos junto com a razão social por quem preenche a planilha.
- **Um único apelido novo:** todas as variações de cabeçalho do bloco de comportamento, exceto "fantasia" isolado, já batiam por correspondência direta de label (a normalização de acento/pontuação/caixa já existente cobre "C.N.P.J." → "cnpj" e "nome_fantasia" → "nomefantasia"), evitando entradas redundantes na tabela de apelidos.
- **`tests/importacao/modelo.test.ts` não editado:** suas asserções já derivam de `SYSTEM_FIELDS` (`.length`, `.map(label)`), então continuam corretas automaticamente com 16 campos sem qualquer mudança de texto.

## Deviations from Plan

None — plano executado exatamente como escrito. Os dois arquivos que o plano marcava como potencialmente proibidos (`components/importacao/ColumnMappingTable.tsx`, `lib/importacao/typesFrequencia.ts`, `lib/validations/importacao.ts`) permaneceram intocados durante toda a execução, confirmado mecanicamente pelo script de verificação de cada task e por `git log` no arquivo.

## Issues Encountered

None.

## User Setup Required

None — nenhuma configuração de serviço externo necessária. A tela do assistente "Importar clientes" já existente passa a oferecer as duas colunas novas sem nenhuma mudança de infraestrutura.

## Next Phase Readiness

- IMP-01/IMP-02 fecham nesta plano: a cadeia inteira (vocabulário → modelo → sugestão → Select → linha resolvida → carga da chamada) está provada de ponta a ponta por teste automatizado.
- Os planos 19-03 (lógica) e 19-04 (tela) da planilha "CNPJ em massa" (IMP-03) seguem independentes desta plano — nenhum arquivo compartilhado foi tocado além do vocabulário comum já generalizado desde a Fase 17.
- Nenhum bloqueio técnico identificado.

---
*Phase: 19-planilhas-de-cnpj-e-nome-fantasia*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `lib/importacao/types.ts`
- FOUND: `lib/importacao/modelo.ts`
- FOUND: `lib/importacao/mapping.ts`
- FOUND: `lib/importacao/annotarLinha.ts`
- FOUND: `lib/importacao/confirmar.ts`
- FOUND: `tests/importacao/mapping.test.ts`
- FOUND: `tests/importacao/column-mapping-table.test.tsx`
- FOUND: `tests/importacao/annotarLinha.test.ts`
- FOUND: `tests/importacao/confirmar.test.ts`
- FOUND: commit `6ebc68d` (Task 1 RED)
- FOUND: commit `c528469` (Task 1 GREEN)
- FOUND: commit `e54cf7f` (Task 2 RED)
- FOUND: commit `ad85d34` (Task 2 GREEN)
