---
phase: quick-260914-j8g
plan: 01
subsystem: importacao
tags: [dedupe, cnpj, findDuplicates, importacao, importacaoAtivos, vitest]

requires: []
provides:
  - "findDuplicates (lib/importacao/dedupe.ts) considera CNPJ na decisão de duplicado, não só razão social normalizada"
  - "nomesExistentesParaDedupe (lib/importacao/existentes.ts) extrai CNPJ alinhado por índice de cada cliente já cadastrado"
  - "planConfirmacao (lib/importacao/confirmar.ts) aplica a mesma regra de CNPJ na revalidação D-02"
  - "As 4 leituras de clientes já cadastrados nas Server Actions de importação (Prospecção e Ativos) trazem e repassam CNPJ"
affects: [importacao, importacaoAtivos, dedupe]

tech-stack:
  added: []
  patterns:
    - "Comparação de CNPJ por dígitos (normalização feita SÓ para comparação, nunca para exibição/gravação — mesma disciplina de normalizeRazaoSocial)"
    - "Ambiguidade (CNPJ ausente de um dos lados) preserva o comportamento antigo — trata como possível duplicado"

key-files:
  created: []
  modified:
    - lib/importacao/dedupe.ts
    - tests/importacao/dedupe.test.ts
    - lib/importacao/existentes.ts
    - tests/importacao/existentes.test.ts
    - lib/importacao/confirmar.ts
    - tests/importacao/confirmar.test.ts
    - app/actions/importacao.ts
    - app/actions/importacaoAtivos.ts

key-decisions:
  - "Nome igual só vira 'Possível duplicado' quando o CNPJ também bate OU quando falta CNPJ em pelo menos um dos dois lados — nome igual com CNPJ diferente presente nos DOIS lados NUNCA é duplicado (decisão de negócio confirmada pelo dono do projeto)"
  - "Comparação de CNPJ é por dígitos, ignorando pontuação, normalização nova vive só dentro de dedupe.ts, só para fins de comparação"
  - "existentesCnpj/existentesNomesFantasiaCnpj entram como novos parâmetros opcionais no final da assinatura de findDuplicates e planConfirmacao — nenhuma chamada existente quebra de compilação"

patterns-established:
  - "existentesByKey e firstInBatchByKey em findDuplicates viram listas de candidatos por chave (não mais um único valor), porque duas empresas diferentes podem compartilhar a mesma chave de nome com CNPJs diferentes (filiais de rede)"

requirements-completed: [QUICK-260914-j8g]

coverage:
  - id: D1
    description: "findDuplicates não marca duplicado quando nome bate mas CNPJ diverge (ambos os lados preenchidos) — lote-contra-banco e lote-contra-lote"
    requirement: QUICK-260914-j8g
    verification:
      - kind: unit
        ref: "tests/importacao/dedupe.test.ts#(b1)/(b2)/(e)/(f)"
        status: pass
    human_judgment: false
  - id: D2
    description: "findDuplicates continua marcando duplicado quando nome bate e CNPJ bate, ou quando falta CNPJ de um dos lados (regressão preservada)"
    requirement: QUICK-260914-j8g
    verification:
      - kind: unit
        ref: "tests/importacao/dedupe.test.ts#(a1)/(a2)/(c1)/(c2) e os 8 testes pré-existentes de findDuplicates"
        status: pass
    human_judgment: false
  - id: D3
    description: "nomesExistentesParaDedupe extrai CNPJ alinhado por índice a razoesSociais/nomesFantasia, tolerando nulo/whitespace"
    requirement: QUICK-260914-j8g
    verification:
      - kind: unit
        ref: "tests/importacao/existentes.test.ts#nomesExistentesParaDedupe"
        status: pass
    human_judgment: false
  - id: D4
    description: "planConfirmacao aplica a regra de CNPJ na revalidação D-02 (tela de confirmar, não só a de revisão)"
    requirement: QUICK-260914-j8g
    verification:
      - kind: unit
        ref: "tests/importacao/confirmar.test.ts#planConfirmacao (quick task 260914-j8g)"
        status: pass
    human_judgment: false
  - id: D5
    description: "As 4 leituras de clientes já cadastrados (validar + confirmar, Prospecção e Ativos) trazem CNPJ e repassam pra findDuplicates/planConfirmacao — tsc e eslint limpos"
    requirement: QUICK-260914-j8g
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "npx eslint app/actions/importacao.ts app/actions/importacaoAtivos.ts"
        status: pass
      - kind: integration
        ref: "tests/importacao/preview.test.ts, tests/importacao/importar-ativos-lote.test.ts, tests/importacao/confirmarAtivo.test.ts, tests/importacao/ativo-preview-table.test.tsx"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-14
status: complete
---

# Quick Task 260914-j8g: Corrigir falso positivo de dedupe por filiais de rede (CNPJ)

**`findDuplicates` passa a considerar CNPJ na detecção de "Possível duplicado" — razão social igual com CNPJ diferente entre os dois lados nunca mais marca duplicado, corrigindo o falso positivo de filiais (Carrefour/Outback), com o mesmo comportamento preservado quando falta CNPJ de um dos lados.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completas
- **Files modified:** 8 (4 de produção + 4 de teste)

## O bug real e a evidência

Confirmado ao vivo pelo dono do projeto: a detecção de "Possível duplicado" nas duas telas de importação (Clientes em Prospecção e Clientes Ativos) comparava só a razão social normalizada (`findDuplicates` em `lib/importacao/dedupe.ts`), ignorando CNPJ por completo. Isso fazia com que redes com várias lojas — exemplos citados no plano: "CARREFOUR COMERCIO E INDUSTRIA LTDA" e "OUTBACK STEAKHOUSE RESTAURANTES BRASIL S.A." — tivessem suas filiais (razão social igual, CNPJ diferente por matriz/filial) marcadas como duplicado uma da outra, mesmo sendo clientes PJ legitimamente diferentes. Isso já tinha corroído a confiança do dono do projeto na tela de revisão de importação.

## Regra de desambiguação implementada e onde ela vive

Regra de negócio travada: nome igual só vira "Possível duplicado" quando o CNPJ também bate **OU** quando falta CNPJ em pelo menos um dos dois lados (sem CNPJ não há como desambiguar, mantém o comportamento antigo). Nome igual com CNPJ diferente presente nos **dois** lados nunca é duplicado.

- **`lib/importacao/dedupe.ts`** (Task 1, o fix central): `DedupeBatchItem` ganhou o campo opcional `cnpj`; `findDuplicates` ganhou dois parâmetros opcionais (`existentesCnpj`, `existentesNomesFantasiaCnpj`), alinhados por índice a `existentes`/`existentesNomesFantasia`. As estruturas internas `existentesByKey` e `firstInBatchByKey` passaram de "um valor por chave" para "lista de candidatos/âncoras por chave" — necessário porque agora duas empresas diferentes (ou duas filiais já cadastradas) podem compartilhar a mesma chave de nome com CNPJs diferentes. A comparação de CNPJ é feita por dígitos (pontuação ignorada), numa normalização nova e isolada dentro de `dedupe.ts`, usada só para comparação — nunca para exibição/gravação.
- **`lib/importacao/existentes.ts`** (Task 2): `nomesExistentesParaDedupe` passou a extrair também o CNPJ de cada cliente já cadastrado em `razoesSociaisCnpj`/`nomesFantasiaCnpj`, alinhados por índice com `razoesSociais`/`nomesFantasia`, reaproveitando o `textoUtilizavel` já existente (mesma tolerância a nulo/whitespace).
- **`lib/importacao/confirmar.ts`** (Task 2): `planConfirmacao` ganhou os mesmos dois parâmetros opcionais (`existentesCnpj`, `existentesNomesFantasiaCnpj`, na 5ª/6ª posição) e passa o `resolved.cnpj` de cada linha candidata para `findDuplicates` na revalidação D-02.
- **`app/actions/importacao.ts` e `app/actions/importacaoAtivos.ts`** (Task 3): as 4 leituras de "clientes já cadastrados" (validar + confirmar, nos dois fluxos) passaram a trazer a coluna `cnpj` e repassá-la para `nomesExistentesParaDedupe`/`findDuplicates`/`planConfirmacao`. RLS opera por linha, não por coluna — trazer `cnpj` de uma leitura já RLS-escopada não expõe nenhum dado novo.

## Confirmação: vale tanto na revisão quanto na revalidação de confirmar (D-02)

Confirmado por teste dedicado em `tests/importacao/confirmar.test.ts` ("does not exclude an 'ok' row whose nome bate mas cujo CNPJ diverge..."): uma linha "ok" cujo nome bate com uma entrada de `existentesRazaoSocial`, mas cujo CNPJ diverge do CNPJ correspondente em `existentesCnpj`, **entra** em `rowsToInsert` — não é mais excluída como "Duplicado encontrado ao confirmar". A regra é a mesma função `findDuplicates` reutilizada verbatim, então qualquer ajuste futuro na regra de CNPJ se propaga automaticamente para as duas telas.

## Task Commits

Cada task seguiu o ciclo TDD (RED → GREEN):

1. **Task 1: Tornar findDuplicates ciente de CNPJ**
   - `285e0dc` test(quick-260914-j8g): cobrir regra de CNPJ em findDuplicates (RED)
   - `14d4c55` fix(quick-260914-j8g): findDuplicates nao marca duplicado quando CNPJ diverge (GREEN)
2. **Task 2: Threading de CNPJ pelas camadas de suporte (existentes.ts e confirmar.ts)**
   - `f8a3041` test(quick-260914-j8g): cobrir threading de CNPJ em existentes/confirmar (RED)
   - `4ffe8bc` feat(quick-260914-j8g): threading de CNPJ em existentes.ts e confirmar.ts (GREEN)
3. **Task 3: Ligar CNPJ nas duas Server Actions de importação (Prospecção e Ativos)**
   - `4764683` fix(quick-260914-j8g): ligar CNPJ nas Server Actions de importacao

## Files Created/Modified

- `lib/importacao/dedupe.ts` - `findDuplicates` passa a considerar CNPJ; `DedupeBatchItem` ganha campo `cnpj?`
- `tests/importacao/dedupe.test.ts` - 10 testes novos cobrindo os cenários (a)-(f) do pedido original
- `lib/importacao/existentes.ts` - `nomesExistentesParaDedupe` extrai `razoesSociaisCnpj`/`nomesFantasiaCnpj` alinhados por índice
- `tests/importacao/existentes.test.ts` - 2 testes novos + ajuste do teste de leitura vazia
- `lib/importacao/confirmar.ts` - `planConfirmacao` aceita e repassa CNPJ pra `findDuplicates` na revalidação D-02
- `tests/importacao/confirmar.test.ts` - 1 teste novo provando que D-02 respeita a regra de CNPJ
- `app/actions/importacao.ts` - `validarLoteImportacao`/`confirmarLoteImportacao` trazem e repassam CNPJ
- `app/actions/importacaoAtivos.ts` - `validarLoteAtivos`/`confirmarLoteAtivos` trazem e repassam CNPJ

## Decisions Made

Nenhuma decisão nova além das já travadas no plano (`<decisoes_travadas>`) — plano executado exatamente como especificado: campo `cnpj` opcional em `DedupeBatchItem`, novos parâmetros opcionais no final das assinaturas de `findDuplicates`/`planConfirmacao`, comparação de CNPJ por dígitos isolada em `dedupe.ts`.

## Deviations from Plan

None - plano executado exatamente como escrito.

## Issues Encountered

Nenhum relacionado ao código desta task. A suíte completa (`npx vitest run`, sem escopo) foi rodada como verificação extra além do exigido pelo plano e terminou com 271 falhas em 43 arquivos — todas por `Error: signInAs("...") failed: Request rate limit reached` (rate limit no endpoint de Auth do Supabase, não relacionado a `findDuplicates`/`planConfirmacao`/`nomesExistentesParaDedupe`). Isso afeta arquivos completamente alheios a esta task (ex. `tests/clientes/update-delete.test.ts`) e confirma que é uma condição de ambiente/rede pré-existente — exatamente o cenário já antecipado na seção `<verification>` do plano, item 4 ("uma eventual falha desses arquivos por falta de `supabase start`/ambiente é uma condição pré-existente, não uma regressão desta task"). Nenhuma falha nos arquivos tocados por este plano (`dedupe.test.ts`, `existentes.test.ts`, `confirmar.test.ts`) ou nas suítes de integração relacionadas a duplicado. Todas as verificações explicitamente exigidas pelo plano e pelo prompt do orquestrador rodaram com sucesso e de forma isolada antes disso:
- `npx tsc --noEmit` — limpo
- `npx eslint` nos 8 arquivos de produção/teste tocados — limpo
- `npx vitest run tests/importacao/dedupe.test.ts tests/importacao/existentes.test.ts tests/importacao/confirmar.test.ts` — 44/44 testes passando
- `npx vitest run tests/importacao/preview.test.ts tests/importacao/importar-ativos-lote.test.ts tests/importacao/confirmarAtivo.test.ts tests/importacao/ativo-preview-table.test.tsx` (suítes de integração de importacao/importacaoAtivos relacionadas a duplicado) — 27/27 testes passando

`tests/importacao/rls-dedup-read.test.ts` e `tests/importacao/prospeccao-vocabulario.test.ts`/`tests/importacao/ativos-vocabulario.test.ts` não foram tocados nem rodados como regressão desta task, conforme decisão travada no plano (não exercitam o código alterado aqui).

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

O fix está completo e testado nas duas telas de importação (Prospecção e Ativos), tanto na revisão inicial quanto na revalidação de confirmar. Nenhum bloqueio conhecido. Recomenda-se, numa sessão futura com `supabase start` disponível, rodar a suíte completa (incluindo `rls-*.test.ts`) para confirmar que nada mais foi afetado — não é esperado nenhum impacto, já que RLS opera por linha e a coluna `cnpj` já era lida em outros contextos da mesma tabela `clientes`.

---
*Quick task: 260914-j8g*
*Completed: 2026-09-14*

## Self-Check: PASSED

Todos os 8 arquivos de produção/teste modificados e o próprio SUMMARY.md existem em disco. Todos os 5 commits de task (`285e0dc`, `14d4c55`, `f8a3041`, `4ffe8bc`, `4764683`) existem no histórico git.
