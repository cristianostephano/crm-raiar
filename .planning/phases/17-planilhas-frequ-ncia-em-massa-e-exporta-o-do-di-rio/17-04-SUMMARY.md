---
phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio
plan: 04
subsystem: ui
tags: [react, typescript, vitest, testing-library, base-ui, shadcn]

# Dependency graph
requires:
  - phase: 17-03
    provides: "annotarLinhaFrequencia/annotarLoteFrequencia (anotação pura por linha), validarLoteFrequencia/confirmarLoteFrequencia (Server Actions), lib/importacao/mapping.ts generalizado (D4) — as três peças não visuais que este plano encaixa em componentes"
provides:
  - "components/importacao/ColumnMappingTable.tsx generalizado (D4) — serve as duas listas de campos via prop opcional `fields`, retrocompatível por construção"
  - "components/importacao/FrequenciaPreviewTable.tsx — tabela de revisão de 5 colunas do fluxo de frequências, sem coluna de Ação/decisão por linha"
  - "components/importacao/FrequenciaImportSummary.tsx — tela de resumo pós-gravação, contagem de puladas derivada"
  - "lib/importacao/annotarLinhaFrequencia.ts: ResolvedRowFrequencia.clienteEncontradoRazaoSocial — nome do banco do cliente casado, distinto da célula da planilha"
affects: [17-05-assistente-rota-menu]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Componente de mapeamento de colunas parametrizado por chave genérica (K extends string), com Select genérico explicitamente tipado (<Select<MappingTargetOf<K>>>) para contornar a inferência de generics do Base UI Select quando o valor não é um union literal concreto"
    - "Interação de teste com Base UI Select requer fireEvent.pointerDown seguido de fireEvent.click no <SelectItem> — um clique isolado é tratado como clique virtual/não confiável e ignorado a menos que o item já esteja destacado"

key-files:
  created:
    - components/importacao/FrequenciaPreviewTable.tsx
    - components/importacao/FrequenciaImportSummary.tsx
    - tests/importacao/column-mapping-table.test.tsx
    - tests/importacao/frequencia-preview-table.test.tsx
    - tests/importacao/frequencia-import-summary.test.tsx
  modified:
    - components/importacao/ColumnMappingTable.tsx
    - lib/importacao/annotarLinhaFrequencia.ts
    - tests/importacao/confirmarFrequencia.test.ts

key-decisions:
  - "ColumnMappingTable virou genérico (<K extends string = SystemField>) com fields?: SystemFieldDefinition<K>[] opcional (padrão SYSTEM_FIELDS) — provado retrocompatível pelo caso `padrao` do novo teste e por git diff vazio em ImportWizard.tsx"
  - "Select do Base UI precisou de argumento de tipo explícito (<Select<MappingTargetOf<K>>>) porque o compilador não conseguiu inferir o parâmetro Value do componente genérico a partir de um valor cujo tipo depende de K (generic abstrato, não union literal) — sem isso, tsc reclamava que o valor não era atribuível ao tipo do sentinela"
  - "ResolvedRowFrequencia ganhou o campo clienteEncontradoRazaoSocial (Rule 2): a tabela de revisão precisa mostrar a razão social do BANCO na coluna 'Cliente encontrado' para o Supervisor confirmar visualmente o casamento (T-17-31/critério de sucesso 2), e essa informação não existia no tipo entregue pelo 17-03 (razaoSocial ali é sempre a célula da planilha). Populado quando exatamente um cliente casa com a linha (mesmo se não apto), nulo em ambiguidade/não-encontrado"

patterns-established:
  - "Tabela/tela irmã estrutural de um fluxo existente: mesmo PAGE_SIZE, mesmo efeito de reinício de paginação, mesmo estado vazio, mesma barra de paginação, cor/contagem importadas sem modificação do módulo de revisão único — nunca duplicar essa camada por fluxo novo"

requirements-completed: []  # IMP-01 permanece Pending — este plano entrega as peças visuais isoladas; o encaixe no assistente (17-05) é que completa o requisito de usuário final

coverage:
  - id: D1
    description: "ColumnMappingTable.tsx serve as duas listas de campos (D4) via um único parâmetro novo opcional, sem componente duplicado, e o ponto de uso existente no assistente de clientes não muda uma linha"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/column-mapping-table.test.tsx#padrao, #frequencia, #sentinela, #mudanca"
        status: pass
      - kind: unit
        ref: "verificação mecânica do plano (prop opcional, padrão correto, opções percorrendo lista recebida, ausência de referência à segunda lista, sentinela por último, git diff vazio em ImportWizard.tsx/ImportPreviewTable.tsx/ImportSummary.tsx/FileDropzone.tsx/app/actions/importacao.ts/supabase/migrations)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tabela de revisão de frequências mostra, por linha, a razão social da planilha, o cliente encontrado no BANCO (fonte distinta, provada por texto diferente nas duas colunas), a nova frequência pelo rótulo de exibição, e o selo de situação com os motivos por extenso — sem coluna de Ação"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/frequencia-preview-table.test.tsx#colunas, #encontrado, #naoencontrado, #frequencia, #motivos, #resumo, #vazio, #paginacao"
        status: pass
      - kind: unit
        ref: "verificação mecânica do plano (import de cor/contagem sem modificação, ausência de sistema de cor novo, ausência de estado de decisão, ausência de coluna de Ação, rótulos de frequência não redigitados)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tela de resumo mostra os dois números (atualizados/puladas) e a lista de motivos com quantidade por motivo; a contagem de puladas é DERIVADA somando os grupos, nunca recebida separada"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/frequencia-import-summary.test.tsx#contagens, #motivos, #semmotivos, #botoes"
        status: pass
      - kind: unit
        ref: "verificação mecânica do plano (reduce presente, puladasCount nunca é propriedade, copy exata sem vazamento entre fluxos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O restante do fluxo de importação de clientes (ImportWizard/ImportPreviewTable/ImportSummary/FileDropzone/ação de servidor/migrations) permanece byte-idêntico; tests/importacao/import-summary.test.tsx e as seis suítes do 17-03 continuam verdes"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "git diff --name-only HEAD (vazio para a lista completa do fluxo de clientes) + tests/importacao/import-summary.test.tsx (2/2) + tests/importacao/mapping.test.ts, modelo.test.ts, confirmar.test.ts, frequencia-vocabulario.test.ts, annotarLinhaFrequencia.test.ts, confirmarFrequencia.test.ts (47/47)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-10
status: complete
---

# Phase 17 Plan 4: Peças Visuais Reutilizáveis da Planilha de Frequências — Mapeamento Generalizado (D4), Tabela de Revisão e Resumo Summary

**ColumnMappingTable generalizado por parâmetro opcional (D4, retrocompatível por construção) + FrequenciaPreviewTable (5 colunas, sem estado de decisão) + FrequenciaImportSummary (contagem de puladas derivada) — as três peças apresentacionais puras que o assistente do plano 17-05 vai encaixar.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T13:36:00-03:00 (aprox.)
- **Completed:** 2026-08-10T13:43:38-03:00
- **Tasks:** 2
- **Files modified:** 8 (1 generalizado, 2 novos de componente, 5 de teste — 3 novos + 2 ajustados)

## Accomplishments

- `components/importacao/ColumnMappingTable.tsx` generalizado com parâmetro genérico `K extends string = SystemField` e prop opcional `fields?: SystemFieldDefinition<K>[]` (padrão `SYSTEM_FIELDS`) — as opções do Select passam a percorrer a lista **recebida**, nunca mais a lista de 14 fixa; o ponto de uso existente em `ImportWizard.tsx` não mudou uma linha (`git diff` vazio), provado retrocompatível por renderização no caso `padrao`
- `components/importacao/FrequenciaPreviewTable.tsx` (novo): tabela de revisão de 5 colunas (Linha / Razão social na planilha / Cliente encontrado / Nova frequência / Status), sem coluna de Ação — este fluxo não tem estado de decisão por linha, a coluna simplesmente não é montada; cor de borda por situação e contagem de resumo importadas de `lib/importacao/preview.ts` sem modificação
- `components/importacao/FrequenciaImportSummary.tsx` (novo): dois cartões de contagem (verde/âmbar), lista de motivos com singular/plural, dois botões (`Ver clientes` / `Enviar outra planilha`); contagem de puladas **derivada** somando os grupos recebidos
- 3 arquivos de teste novos (16 casos no total: 4 + 8 + 4), todos verdes; `tests/importacao/import-summary.test.tsx` (irmão do fluxo de clientes) continua verde sem alteração
- Deviation necessária: `ResolvedRowFrequencia` (17-03) ganhou o campo `clienteEncontradoRazaoSocial` — sem ele a coluna "Cliente encontrado" não tinha de onde ler o nome do banco, e o critério de sucesso 2 (confirmação visual do casamento) ficaria estruturalmente impossível de cumprir

## Task Commits

Each task was committed atomically:

1. **Task 1: A tabela de mapeamento de colunas servindo as duas listas de campos (D4)** - `f16f25d` (feat)
2. **Task 2: Tabela de revisão e tela de resumo do fluxo de frequências** - `e324cbe` (feat)

**Plan metadata:** commit deste SUMMARY.md (docs)

## Files Created/Modified

- `components/importacao/ColumnMappingTable.tsx` - parametrizado por `K`, prop `fields` opcional (padrão `SYSTEM_FIELDS`), `<Select<MappingTargetOf<K>>>` com argumento de tipo explícito
- `components/importacao/FrequenciaPreviewTable.tsx` - tabela de revisão de 5 colunas, sem Ação, paginação de 50, cor/contagem reusadas de `lib/importacao/preview.ts`
- `components/importacao/FrequenciaImportSummary.tsx` - resumo pós-gravação, contagem de puladas derivada, copy do contrato deste fluxo
- `lib/importacao/annotarLinhaFrequencia.ts` - `ResolvedRowFrequencia.clienteEncontradoRazaoSocial` (novo campo, populado quando exatamente um cliente casa com a linha)
- `tests/importacao/column-mapping-table.test.tsx` - 4 casos (padrao/frequencia/sentinela/mudanca)
- `tests/importacao/frequencia-preview-table.test.tsx` - 8 casos (colunas/encontrado/naoencontrado/frequencia/motivos/resumo/vazio/paginacao)
- `tests/importacao/frequencia-import-summary.test.tsx` - 4 casos (contagens/motivos/semmotivos/botoes)
- `tests/importacao/confirmarFrequencia.test.ts` - fixture `makeResolved` atualizada com o novo campo (17-03, teste já existente, continua 8/8 verde)

## Decisions Made

- `ColumnMappingTable` virou genérico (`K extends string = SystemField`) em vez de ganhar uma segunda versão — a lista de campos é parâmetro (`fields`), com o padrão de sempre, para não duplicar o componente entre os dois vocabulários de importação (D4).
- O `<Select>` do Base UI precisou de argumento de tipo explícito (`<Select<MappingTargetOf<K>>>`) porque o compilador não conseguia inferir o parâmetro `Value` a partir de um valor cujo tipo depende de `K` (generic abstrato) — sem essa anotação, `tsc` rejeitava a atribuição do valor ao tipo do item sentinela.
- `ResolvedRowFrequencia` ganhou `clienteEncontradoRazaoSocial: string | null` (Rule 2 — funcionalidade crítica faltante): populado com a razão social do banco sempre que exatamente um cliente casa com a linha (mesmo quando ele não está apto — o motivo "não está com status Ganho" faz mais sentido mostrando quem foi encontrado), nulo em ambiguidade (L1) ou ausência de casamento. Sem esse campo, a coluna "Cliente encontrado" não tinha nenhuma fonte de dado do banco para exibir, e o critério de sucesso 2 (confirmação visual do casamento antes de gravar) ficaria impossível de cumprir mecanicamente.
- Testes de interação com `<Select>` do Base UI precisam disparar `fireEvent.pointerDown` antes de `fireEvent.click` no `<SelectItem>` — um `click` isolado (sem `pointerdown` antecedente) é tratado pela biblioteca como clique virtual/não confiável e é ignorado a menos que o item já esteja destacado (`highlighted`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Campo `clienteEncontradoRazaoSocial` ausente em `ResolvedRowFrequencia`**
- **Found during:** Task 2 (montagem de `FrequenciaPreviewTable.tsx`)
- **Issue:** O plano especifica que a coluna "Cliente encontrado" deve mostrar "a razão social **do banco** quando houver casamento" (17-UI-SPEC.md, ponto 6), distinta da razão social da planilha (coluna 2) — mas `ResolvedRowFrequencia` (entregue pelo 17-03) só carregava `razaoSocial` (sempre a célula da planilha saneada) e `clienteId`. Sem um segundo campo de nome, a tabela não tinha de onde ler o valor do banco, e o teste mecânico `encontrado` (duas colunas com textos diferentes) seria estruturalmente impossível de satisfazer.
- **Fix:** Adicionado `clienteEncontradoRazaoSocial: string | null` em `ResolvedRowFrequencia` (`lib/importacao/annotarLinhaFrequencia.ts`), populado com `cliente.razaoSocial` sempre que `encontrados.length === 1` (independente de aptidão), nulo em ambiguidade/não-encontrado. `app/actions/importacaoFrequencia.ts` não precisou de nenhuma alteração — o campo flui automaticamente porque `resolved: linha.resolved` já copia a forma inteira.
- **Files modified:** `lib/importacao/annotarLinhaFrequencia.ts`, `tests/importacao/confirmarFrequencia.test.ts` (fixture `makeResolved` precisou do campo novo para o TypeScript aceitar o objeto — teste em si não mudou de comportamento, continua 8/8 verde)
- **Verification:** `tests/importacao/annotarLinhaFrequencia.test.ts` (11/11, sem alteração de asserção) e `tests/importacao/confirmarFrequencia.test.ts` (8/8) continuam verdes; `tests/importacao/frequencia-preview-table.test.tsx#encontrado` prova mecanicamente que as duas colunas mostram textos diferentes
- **Committed in:** `e324cbe` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessário para cumprir o critério de sucesso 2 (confirmação visual do casamento) e a mitigação T-17-31 do threat_model deste próprio plano. Sem escopo além do estritamente necessário — nenhuma mudança de comportamento em `app/actions/importacaoFrequencia.ts` ou `lib/importacao/confirmarFrequencia.ts`.

## Issues Encountered

- `tsc --noEmit` inicialmente rejeitava `<Select value={...} onValueChange={...}>` dentro do componente genérico: o parâmetro `Value` do `Select` do Base UI não conseguia ser inferido a partir de um tipo que depende de `K` (generic abstrato). Resolvido com argumento de tipo explícito `<Select<MappingTargetOf<K>>>`.
- `fireEvent.click` isolado em `<SelectItem role="option">` não disparava `onValueChange` nos testes — investigação do código-fonte do Base UI (`SelectItem.mjs`) revelou que um clique só é aceito sem `pointerdown` antecedente se o item já estiver destacado (`highlighted`). Resolvido disparando `fireEvent.pointerDown` antes do `fireEvent.click` no teste `mudanca`.

## User Setup Required

None - nenhuma configuração de serviço externo necessária; nenhuma dependência nova instalada.

## Next Phase Readiness

- As três peças visuais reutilizáveis do fluxo de frequências existem, testadas por renderização isolada, prontas para o plano 17-05 encaixar no assistente (`FrequenciaImportWizard.tsx`) e na rota `/clientes/importar-frequencias`.
- `ColumnMappingTable` já aceita `fields={SYSTEM_FIELDS_FREQUENCIA}` sem nenhuma mudança adicional.
- `FrequenciaPreviewTable` recebe diretamente `linhas: ValidatedRowFrequencia[]` (o retorno de `validarLoteFrequencia`) sem transformação intermediária.
- `FrequenciaImportSummary` recebe diretamente `{ atualizados, puladas }` (o retorno de `confirmarLoteFrequencia`), com `atualizadosCount = atualizados.length` a calcular no assistente.
- **REQUIREMENTS.md deliberadamente não marcado como concluído para IMP-01 por este plano** — mesma convenção do 17-01/17-03: IMP-01 só é cumprido de ponta a ponta quando o assistente do plano 17-05 existir.
- Nenhum bloqueio novo identificado. As 3 suítes de teste que falham neste ambiente (`rls-frequencia-lote.test.ts`, `rls-importar-lote.test.ts`, e mais uma RLS) exigem `.env.local` com um projeto Supabase real — pré-existente, fora do escopo deste plano, mesma limitação documentada desde a Fase 2.

---
*Phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio*
*Completed: 2026-08-10*
