---
phase: 25-importa-o-de-clientes-ativos
plan: 02
subsystem: importacao
tags: [typescript, vitest, server-actions, supabase-rls, importacao]

requires:
  - phase: 25-importa-o-de-clientes-ativos
    provides: "Plano 25-01 — RPC `importar_clientes_ativos_lote` + função auxiliar `cliente_ativo_pronto_para_ganho` (9 campos), em produção (migration 0027)"

provides:
  - "SYSTEM_FIELDS_ATIVO (lib/importacao/typesAtivo.ts) — quarto vocabulário de campos, mesmas 16 chaves de SYSTEM_FIELDS, 9 obrigatórias, cada uma com sua própria frase de campo faltando (autoridade única de obrigatoriedade)"
  - "buildModeloAtivos (lib/importacao/modeloAtivo.ts) — gerador do modelo de planilha de 16 colunas"
  - "annotarLinhaAtivo/annotarLoteAtivos (lib/importacao/annotarLinhaAtivo.ts) — anotação pura por linha, reusando MappedRow/ResolvedRow/VendedorLookup/CidadeLookup de annotarLinha.ts, com motivo distinto para responsável-não-encontrado vs responsável-em-branco"
  - "reconciliarAtivos/fundirGruposDeMotivosAtivos (lib/importacao/confirmarAtivo.ts) — reconciliação do retorno classificado (inserido/duplicado/incompleto) da RPC"
  - "validarLoteAtivos/confirmarLoteAtivos (app/actions/importacaoAtivos.ts) — ações de servidor gate-por-supervisor que validam (findDuplicates, ATIVO-04) e confirmam (planConfirmacao reusado verbatim) o lote"
  - "toRpcClienteRow, DUPLICADO_PULADO_NA_REVISAO_REASON, DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON agora exportados de lib/importacao/confirmar.ts (mudança mínima de visibilidade)"

affects: [25-03-tela-de-importa-o-de-ativos, 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu]

tech-stack:
  added: []
  patterns:
    - "Quarto vocabulário de campos (SystemFieldDefinitionAtivo estende SystemFieldDefinition<SystemField> com campoFaltandoReason opcional) — mantém compatibilidade total com suggestMapping/applyMapping/requiredFieldsFaltando genéricos desde a Fase 17, sem função nova"
    - "Frase de campo faltando declarada NA PRÓPRIA definição do campo (não num mapa paralelo) — a anotação lê a frase da lista, nunca reescreve o texto"
    - "Módulos de confirmação por planilha (confirmarAtivo.ts) nunca importam o módulo irmão mais recente que pode ser removido (confirmarCnpj.ts) — fundirGruposDeMotivos é duplicada localmente de propósito, para não acoplar a uma tela que a Fase 26 vai apagar"

key-files:
  created:
    - lib/importacao/typesAtivo.ts
    - lib/importacao/modeloAtivo.ts
    - lib/importacao/annotarLinhaAtivo.ts
    - lib/importacao/confirmarAtivo.ts
    - app/actions/importacaoAtivos.ts
    - tests/importacao/ativos-vocabulario.test.ts
    - tests/importacao/annotarLinhaAtivo.test.ts
    - tests/importacao/confirmarAtivo.test.ts
  modified:
    - lib/importacao/confirmar.ts

key-decisions:
  - "SYSTEM_FIELDS_ATIVO estende a interface genérica em vez de criar um tipo paralelo — preserva compatibilidade com toda a camada de mapeamento já parametrizada desde a Fase 17"
  - "Responsável preenchido mas não encontrado gera um motivo NOVO e distinto de responsável em branco — melhoria deliberada sobre a importação antiga, que confundia os dois numa frase só"
  - "toRpcClienteRow e as duas constantes de motivo de duplicado passam a ser exportadas de confirmar.ts (mudança de visibilidade apenas) para que o fluxo de ativos reuse a mesma conversão/vocabulário em vez de duplicar"
  - "fundirGruposDeMotivosAtivos é uma cópia local, não um import de confirmarCnpj.ts — evita acoplar o fluxo novo a um módulo que a Fase 26 vai remover"

patterns-established:
  - "Todo vocabulário de campos com obrigatoriedade variável carrega sua própria frase de erro na definição, nunca num mapa de mensagens à parte"

requirements-completed: [ATIVO-01, ATIVO-03, ATIVO-04]

coverage:
  - id: D1
    description: "SYSTEM_FIELDS_ATIVO declara as mesmas 16 chaves de SYSTEM_FIELDS com exatamente 9 obrigatórias (razão social, CNPJ, CEP, rua, número, cidade, estado, responsável, contato), cada uma com frase de campo faltando própria, e SYSTEM_FIELDS (2 obrigatórias) permanece intocada"
    requirement: "ATIVO-01"
    verification:
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts#campos"
        status: pass
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts#obrigatorios"
        status: pass
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts#invariante"
        status: pass
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts#naoregride"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uma linha sem um campo obrigatório vira erro só daquela linha, com a frase que nomeia o campo lida da própria definição (nunca de um mapa paralelo); linhas boas do mesmo lote continuam ok"
    requirement: "ATIVO-03"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#faltando"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#soespacos"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#multiplosmotivos"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#loteindependente"
        status: pass
    human_judgment: false
  - id: D3
    description: "Responsável preenchido mas não encontrado produz motivo distinto de responsável em branco; categoria/produtos/estado/cidade inexistentes viram erro nomeando o valor lido; sanitização de fórmula roda antes de qualquer comparação"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#responsavelnaoencontrado"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#categoriainexistente"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#produtos"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#estadocidade"
        status: pass
      - kind: unit
        ref: "tests/importacao/annotarLinhaAtivo.test.ts#sanitizacao"
        status: pass
    human_judgment: false
  - id: D4
    description: "reconciliarAtivos classifica o retorno da RPC (inserido/duplicado/incompleto) em importados/puladas com o motivo correto para cada caso, inclusive linha ausente do retorno e razão social repetida na carga; fundirGruposDeMotivosAtivos soma quantidades por texto de motivo sem duplicar grupo"
    requirement: "ATIVO-04"
    verification:
      - kind: unit
        ref: "tests/importacao/confirmarAtivo.test.ts#reconciliainserido"
        status: pass
      - kind: unit
        ref: "tests/importacao/confirmarAtivo.test.ts#reconciliaincompleto"
        status: pass
      - kind: unit
        ref: "tests/importacao/confirmarAtivo.test.ts#reconciliaduplicado"
        status: pass
      - kind: unit
        ref: "tests/importacao/confirmarAtivo.test.ts#reconciliaausente"
        status: pass
      - kind: unit
        ref: "tests/importacao/confirmarAtivo.test.ts#razaorepetida"
        status: pass
      - kind: unit
        ref: "tests/importacao/confirmarAtivo.test.ts#fundemotivos"
        status: pass
    human_judgment: false
  - id: D5
    description: "validarLoteAtivos/confirmarLoteAtivos (app/actions/importacaoAtivos.ts) checam sessão+papel de supervisor antes de qualquer leitura, usam getTodasCidades() paginado, chamam importar_clientes_ativos_lote uma única vez com o lote inteiro, e não têm cobertura de teste automatizado direto (dependem de escopo de requisição do Next)"
    verification: []
    human_judgment: true
    rationale: "Server Actions não são invocáveis diretamente pelo executor de testes (dependem de next/headers cookies() com escopo de requisição real) — mesma limitação já registrada no projeto para validarLoteImportacao/confirmarLoteImportacao/validarLoteCnpj/confirmarLoteCnpj. A cobertura funcional vem do checkpoint humano do plano 25-03, quando a tela existir."

duration: ~25min
completed: 2026-08-26
status: complete
---

# Phase 25 Plan 02: Anotação e Validação da Planilha de Ativos Summary

**Quarto vocabulário de campos (`SYSTEM_FIELDS_ATIVO`, 9 obrigatórios com frase própria), anotação pura por linha e as duas Server Actions (`validarLoteAtivos`/`confirmarLoteAtivos`) que fecham ATIVO-03 (erro nunca trava o lote) e ATIVO-04 (duplicado reusando `findDuplicates`).**

## Performance

- **Duration:** ~25min
- **Tasks:** 3/3 (todas `type="auto"`, sem checkpoint — plano autônomo)
- **Files modified:** 9 (8 criados, 1 editado)

## Accomplishments

- `SYSTEM_FIELDS_ATIVO` declara as mesmas 16 chaves de `SYSTEM_FIELDS` (importação de clientes novos), com exatamente 9 marcadas obrigatórias — o mesmo conjunto que `cliente_ativo_pronto_para_ganho` (RPC do plano 25-01) exige para gravar, sem subconjunto nem superconjunto — e cada obrigatória carrega sua própria frase de campo faltando, fechando o risco de "duas fontes de obrigatoriedade" registrado em STATE.md.
- `annotarLinhaAtivo`/`annotarLoteAtivos` (módulo puro, sem Supabase) anotam cada linha reusando os tipos já existentes de `annotarLinha.ts` (nenhuma segunda verdade), com uma melhoria deliberada: responsável preenchido-mas-não-encontrado agora tem um motivo distinto de responsável-em-branco.
- `confirmarAtivo.ts` reconcilia o retorno classificado (`inserido`/`duplicado`/`incompleto`) da RPC `importar_clientes_ativos_lote`, reusando `toRpcClienteRow` e o vocabulário de motivo de duplicado já existentes em `confirmar.ts` (mudança de visibilidade mínima, sem efeito de comportamento).
- `app/actions/importacaoAtivos.ts` implementa `validarLoteAtivos` (só leitura, gate de supervisor antes de qualquer dado, `getTodasCidades()` paginado, `findDuplicates` para ATIVO-04) e `confirmarLoteAtivos` (reusa `planConfirmacao` verbatim, chama a RPC uma única vez, invalida o cache de `/clientes`).
- 24 novos casos de teste (8 + 11 + 5) cobrindo vocabulário, anotação linha a linha e reconciliação de confirmação — todos verdes, junto com os testes antigos das duas importações irmãs, provando ausência de regressão.

## Task Commits

Each task was committed atomically:

1. **Task 1: Vocabulário de campos da planilha de ativos + gerador do modelo** - `5410039` (feat)
2. **Task 2: Anotação linha a linha da planilha de ativos** - `b231e1f` (feat)
3. **Task 3: Planejamento de confirmação + ações de servidor de validar e confirmar** - `4433bb5` (feat)

**Plan metadata:** (a ser preenchido pelo commit final desta etapa)

## Files Created/Modified

- `lib/importacao/typesAtivo.ts` - `SYSTEM_FIELDS_ATIVO` (16 campos, 9 obrigatórios com `campoFaltandoReason`) + justificativa completa de cada fronteira de obrigatoriedade em comentário de cabeçalho
- `lib/importacao/modeloAtivo.ts` - `buildModeloAtivos()`, gerador do modelo de planilha de 16 colunas
- `lib/importacao/annotarLinhaAtivo.ts` - `annotarLinhaAtivo`/`annotarLoteAtivos`, módulo puro reusando tipos de `annotarLinha.ts`
- `lib/importacao/confirmarAtivo.ts` - `reconciliarAtivos`, `fundirGruposDeMotivosAtivos`, `DADO_OBRIGATORIO_FALTANDO_AO_GRAVAR_REASON`
- `app/actions/importacaoAtivos.ts` - `validarLoteAtivos`, `confirmarLoteAtivos` (ações de servidor, gate de supervisor)
- `lib/importacao/confirmar.ts` - `toRpcClienteRow`, `DUPLICADO_PULADO_NA_REVISAO_REASON`, `DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON` agora exportados (visibilidade apenas)
- `tests/importacao/ativos-vocabulario.test.ts` - 8 casos cobrindo o vocabulário e o modelo
- `tests/importacao/annotarLinhaAtivo.test.ts` - 11 casos cobrindo a anotação linha a linha
- `tests/importacao/confirmarAtivo.test.ts` - 5 casos cobrindo a reconciliação de confirmação

## Decisions Made

- **Estender em vez de duplicar tipos:** `SystemFieldDefinitionAtivo` estende `SystemFieldDefinition<SystemField>` — a lista continua compatível com `suggestMapping`/`applyMapping`/`requiredFieldsFaltando`/`ColumnMappingTable`, todos já parametrizados desde a Fase 17, sem nenhuma função nova.
- **Motivo distinto de responsável não encontrado:** diferente da importação antiga (que usa a mesma frase "Responsável não informado" tanto para campo vazio quanto para valor sem casamento), a planilha de ativos usa `Responsável "X" não foi encontrado` para o caso preenchido-mas-sem-casamento — melhoria deliberada permitida pelo plano.
- **Visibilidade mínima em `confirmar.ts`:** `toRpcClienteRow` e as duas constantes de motivo de duplicado passam de privadas para exportadas — nenhuma outra linha do arquivo mudou, e `confirmar.test.ts` passa sem edição, provando que não houve efeito de comportamento.
- **`fundirGruposDeMotivosAtivos` duplicada localmente:** não importa `confirmarCnpj.ts`'s `fundirGruposDeMotivos` de propósito — a Fase 26 vai remover as telas antigas de importação, e uma dependência cruzada transformaria essa limpeza numa quebra de compilação.

## Deviations from Plan

None - plan executado exatamente como escrito. A única correção durante a execução foi de importação de tipos: `AnnotarLinhaLookups`/`MappedRow`/`ResolvedRow`/`VendedorLookup` precisaram ser importados de `lib/importacao/annotarLinha.ts` diretamente em `app/actions/importacaoAtivos.ts` (em vez de reexportados de `annotarLinhaAtivo.ts`), porque `annotarLinhaAtivo.ts` os usa apenas como tipo interno e não os reexporta — `tsc --noEmit` pegou o erro imediatamente (Rule 3, blocking, corrigido inline antes de qualquer commit).

## Issues Encountered

- `npx vitest run tests/importacao/` mostrou 34 falhas pré-existentes em `tests/importacao/rls-frequencia-lote.test.ts` e `tests/importacao/rls-importar-lote.test.ts` — falha de login (`Invalid login credentials`) para `vendedor.a+test@raiar.local`, a mesma pendência já registrada em STATE.md (contas semente apagadas em 2026-08-19, ~49 arquivos afetados). Fora de escopo deste plano: nenhum dos dois arquivos foi tocado, e a falha é de autenticação, não de comportamento do código deste plano. Os 204 demais testes da pasta (incluindo os 24 novos e os 4 arquivos antigos de importação de clientes/CNPJ/frequência que este plano toca indiretamente) passaram.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- `validarLoteAtivos`/`confirmarLoteAtivos` estão prontas para o plano 25-03 construir a tela de importação (wizard de upload/mapeamento/revisão/confirmação) sobre elas — mesmo contrato de tipos (`ValidatedRowAtivo`) e mesma disciplina de gate de supervisor das duas telas irmãs.
- `SYSTEM_FIELDS_ATIVO`/`buildModeloAtivos` estão prontos para o botão "Baixar modelo de planilha" e o Select de mapeamento de coluna do plano 25-03.
- Nenhum bloqueio novo. A pendência pré-existente das contas semente apagadas continua registrada em STATE.md, sem relação com este plano.

---
*Phase: 25-importa-o-de-clientes-ativos*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: lib/importacao/typesAtivo.ts
- FOUND: lib/importacao/modeloAtivo.ts
- FOUND: lib/importacao/annotarLinhaAtivo.ts
- FOUND: lib/importacao/confirmarAtivo.ts
- FOUND: app/actions/importacaoAtivos.ts
- FOUND: tests/importacao/ativos-vocabulario.test.ts
- FOUND: tests/importacao/annotarLinhaAtivo.test.ts
- FOUND: tests/importacao/confirmarAtivo.test.ts
- FOUND: commit 5410039 (feat, Task 1)
- FOUND: commit b231e1f (feat, Task 2)
- FOUND: commit 4433bb5 (feat, Task 3)
