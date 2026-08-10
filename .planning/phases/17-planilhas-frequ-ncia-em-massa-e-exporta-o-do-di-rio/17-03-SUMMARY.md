---
phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio
plan: 03
subsystem: import
tags: [typescript, vitest, server-actions, supabase-rpc, mapping]

# Dependency graph
requires:
  - phase: 17-01
    provides: "atualizar_frequencia_visita_lote(p_atualizacoes jsonb) returns table(id uuid, razao_social text) — RPC de gravação em lote aplicada em produção"
provides:
  - "lib/importacao/typesFrequencia.ts + lib/importacao/modeloFrequencia.ts — segunda lista de campos (razaoSocial/frequenciaVisita) e gerador do modelo de planilha"
  - "lib/importacao/mapping.ts generalizado (D4) para servir qualquer lista de campos, retrocompatível com a importação de clientes"
  - "lib/importacao/annotarLinhaFrequencia.ts — anotação pura por linha/lote (encontrado/apto/frequência), com índice de clientes por chave normalizada mapeando para LISTA (revela ambiguidade)"
  - "lib/importacao/confirmarFrequencia.ts — planejamento da carga, dedup por identificador (L2), reconciliação enviado x devolvido, fusão de grupos de motivos"
  - "app/actions/importacaoFrequencia.ts — validarLoteFrequencia (somente leitura) + confirmarLoteFrequencia (uma chamada por lote à RPC do 17-01)"
affects: [17-04-tabela-revisao-resumo, 17-05-assistente-rota-menu]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface de definição de campo (SystemFieldDefinition<K>) e os dois tipos de mapeamento (MappingTargetOf<K>/ColumnMappingOf<K>) parametrizados por chave, com valor padrão igual à união de 14 chaves — permite uma segunda lista de campos sem duplicar a camada de mapeamento (D4)"
    - "Índice de lookup por chave normalizada mapeando para LISTA (não item único) como forma padrão de revelar ambiguidade de nome em fluxos de importação futuros"
    - "Dedup por identificador de recurso (não por texto) na fase de planejamento de gravação — primeira ocorrência vence, mesma convenção 'first wins' já usada na detecção de duplicados de razão social"

key-files:
  created:
    - lib/importacao/typesFrequencia.ts
    - lib/importacao/modeloFrequencia.ts
    - lib/importacao/annotarLinhaFrequencia.ts
    - lib/importacao/confirmarFrequencia.ts
    - app/actions/importacaoFrequencia.ts
    - tests/importacao/frequencia-vocabulario.test.ts
    - tests/importacao/annotarLinhaFrequencia.test.ts
    - tests/importacao/confirmarFrequencia.test.ts
  modified:
    - lib/importacao/types.ts
    - lib/importacao/mapping.ts

key-decisions:
  - "SystemFieldDefinition ganhou um parâmetro genérico K (padrão = união de 14 chaves) em vez de uma segunda interface — evita duplicar a camada de mapeamento entre os dois vocabulários de importação (D4), provado retrocompatível por tests/importacao/mapping.test.ts e tests/importacao/modelo.test.ts intocados e verdes"
  - "suggestMapping passou a conferir se o resultado de um apelido pertence à lista de campos recebida antes de devolvê-lo — sem essa conferência, um cabeçalho como 'CEP' numa planilha de frequências devolveria uma chave inexistente naquela lista"
  - "Ambiguidade de razão social (lacuna L1, não coberta pelo 17-UI-SPEC.md original) tratada como erro com identificador nulo, com um sexto motivo de linha declarado como adição consciente ao contrato de copy"
  - "Linhas repetindo o mesmo cliente na planilha (lacuna L2) são deduplicadas por identificador na fase de planejamento da carga — primeira ocorrência vence, demais viram puladas com motivo próprio"
  - "A leitura de validação (validarLoteFrequencia) não filtra por status_acompanhamento — filtrar transformaria 'não é ganho' em 'não encontrado', uma mensagem errada para o Supervisor"

patterns-established:
  - "Uma segunda lista de campos de importação reusa a interface de definição de campo via parâmetro genérico, nunca duplica a interface"
  - "Todo índice de lookup construído para anotação de planilha usa Map<string, T[]> (lista, não item único) para poder representar e reportar ambiguidade"

requirements-completed: []  # IMP-01 permanece Pending — este plano entrega só a camada não visual (17-01 já entregou o banco); a UI dos planos 17-04/17-05 é que completa o requisito de usuário final

coverage:
  - id: D1
    description: "A camada de mapeamento de colunas (lib/importacao/mapping.ts) passa a servir as duas listas de campos (14 da importação de clientes + 2 da importação de frequências) sem nenhuma função ou componente duplicado"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/frequencia-vocabulario.test.ts#apelidoforadalista, #apelidopreservado, #sugestao, #obrigatorios, #aplicar"
        status: pass
      - kind: unit
        ref: "tests/importacao/mapping.test.ts (intocado, 8/8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O arquivo de teste de mapeamento existente (tests/importacao/mapping.test.ts) continua verde SEM UMA LINHA ALTERADA — prova mecânica de que a generalização não mexeu no comportamento da importação de clientes"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "git diff --name-only HEAD -- tests/importacao/mapping.test.ts (vazio) + tests/importacao/mapping.test.ts (8/8 pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cada linha da planilha sai anotada dizendo se o cliente foi encontrado e se está apto, com o motivo por extenso, antes de qualquer gravação — annotarLinhaFrequencia/annotarLoteFrequencia são funções puras que não escrevem nada"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinhaFrequencia.test.ts (11/11: ok, variacao, semrazao, naoencontrado, ambiguo, naoganho, semfrequencia, frequenciainvalida, multiplosmotivos, saneamento, lote)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Os identificadores enviados para a gravação vêm sempre de uma consulta feita no servidor (validarLoteFrequencia), nunca de célula de planilha — uma linha inapta ou ambígua tem o identificador zerado antes de sair da anotação, e o planejamento da carga descarta qualquer linha ok com identificador nulo"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinhaFrequencia.test.ts#naoganho, #ambiguo + tests/importacao/confirmarFrequencia.test.ts#incompleto"
        status: pass
      - kind: unit
        ref: "verificação mecânica (Task 3 do plano) — checagem de papel ANTES de qualquer leitura, leitura de validação somente leitura, nenhum filtro de dono"
        status: pass
    human_judgment: false
  - id: D5
    description: "Linha com erro nunca é enviada; das que são enviadas, a reconciliação entre enviado e devolvido produz os dois números do resumo (atualizados/puladas) com motivo agrupado; gravação é UMA chamada por lote"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/confirmarFrequencia.test.ts (8/8: carga, erro, repetido, incompleto, frequenciainvalida, reconcilia, funde, vazio)"
        status: pass
      - kind: unit
        ref: "verificação mecânica — exatamente 1 chamada .rpc( na confirmação, sem laço, atualizar_frequencia_visita_lote referenciada"
        status: pass
    human_judgment: false
  - id: D6
    description: "As duas lacunas adicionais reveladas pela leitura do código real (razão social ambígua L1, linha repetida na planilha L2) estão fechadas e testadas"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinhaFrequencia.test.ts#ambiguo (L1) + tests/importacao/confirmarFrequencia.test.ts#repetido (L2)"
        status: pass
    human_judgment: false
  - id: D7
    description: "As duas ações de servidor (validarLoteFrequencia/confirmarLoteFrequencia) e a chamada real à RPC atualizar_frequencia_visita_lote funcionam de ponta a ponta contra o banco hospedado (não só a lógica pura simulada)"
    verification: []
    human_judgment: true
    rationale: "As Server Actions não podem ser invocadas diretamente pelo Vitest (dependem do contexto de requisição do Next — precedente documentado desde a Fase 2 em STATE.md), e este plano não inclui tela para exercitá-las via UI. A cobertura automatizada prova a lógica pura por trás delas (anotação, planejamento, reconciliação) e a verificação mecânica prova a forma/ordem de auth+RPC; o exercício de ponta a ponta contra o banco real fica para o checkpoint humano dos planos 17-04/17-05, quando a tela existir para chamá-las."

# Metrics
duration: ~35min
completed: 2026-08-10
status: complete
---

# Phase 17 Plan 3: Camada Não Visual da Planilha de Frequências — Mapeamento Generalizado, Anotação e Server Actions Summary

**Generalização retrocompatível da camada de mapeamento de colunas (D4) + anotação pura por linha (encontrado/apto/frequência) + planejamento/reconciliação da gravação + duas Server Actions que chamam `atualizar_frequencia_visita_lote` numa única chamada por lote — todas as três lacunas do fluxo (D4, L1 ambiguidade, L2 repetição) fechadas e testadas.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-10T13:00:00-03:00 (aprox.)
- **Completed:** 2026-08-10T13:27:21-03:00
- **Tasks:** 3
- **Files modified:** 10 (2 generalizados, 5 novos de aplicação, 3 novos de teste)

## Accomplishments

- `lib/importacao/types.ts` e `lib/importacao/mapping.ts` generalizados com um parâmetro genérico de chave (`SystemFieldDefinition<K>`, `MappingTargetOf<K>`, `ColumnMappingOf<K>`), retrocompatíveis por construção — `tests/importacao/mapping.test.ts` e `tests/importacao/modelo.test.ts` continuam intocados e 100% verdes, prova mecânica de que a importação de clientes não mudou
- Conserto na sugestão de mapeamento por apelido: `suggestMapping` agora confere se a chave sugerida pertence à lista de campos recebida antes de devolvê-la — sem isso, um cabeçalho conhecido só na lista de 14 (ex: "CEP") vazaria para a lista de frequências
- `lib/importacao/typesFrequencia.ts` (segunda lista, 2 campos obrigatórios) e `lib/importacao/modeloFrequencia.ts` (gerador do modelo de planilha, rótulo de exemplo importado do módulo único de frequência) criados
- `lib/importacao/annotarLinhaFrequencia.ts`: anotação pura por linha e por lote, com índice de clientes construído uma única vez por lote mapeando chave normalizada → LISTA de clientes (a lista, não um cliente só, é o que revela a ambiguidade da lacuna L1); cliente ambíguo ou não-"ganho" sempre sai com identificador resolvido nulo
- `lib/importacao/confirmarFrequencia.ts`: planejamento da carga com dedup por identificador de cliente (lacuna L2, primeira ocorrência vence), rede de segurança para linha "ok" incompleta, re-validação defensiva da frequência antes de montar a carga, reconciliação enviado×devolvido, e fusão de grupos de motivos exportada e testável
- `app/actions/importacaoFrequencia.ts`: `validarLoteFrequencia` (somente leitura, papel checado antes de qualquer leitura de dado, sem filtro de dono nem de status) e `confirmarLoteFrequencia` (uma única chamada à RPC `atualizar_frequencia_visita_lote`, nunca em laço)
- Três arquivos de teste novos, 30 casos no total, todos verdes — 47/47 testes passando ao rodar as seis suítes do fluxo de importação juntas (as três novas + as três pré-existentes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Segunda lista de campos, modelo de planilha, e a camada de mapeamento servindo duas listas** - `d467b34` (feat)
2. **Task 2: Anotação por linha — encontrado, apto, frequência reconhecida** - `2d84e78` (feat)
3. **Task 3: Planejamento da gravação, reconciliação e as duas ações de servidor** - `e66a3d4` (feat)

**Plan metadata:** commit deste SUMMARY.md (docs)

## Files Created/Modified

- `lib/importacao/types.ts` - `SystemFieldDefinition` parametrizada por chave (`K`, padrão = união de 14), retrocompatível
- `lib/importacao/mapping.ts` - `MappingTargetOf<K>`/`ColumnMappingOf<K>` (com apelidos `MappingTarget`/`ColumnMapping`), `suggestMapping`/`applyMapping`/`requiredFieldsFaltando` generalizados; conserto de pertinência de apelido
- `lib/importacao/typesFrequencia.ts` - segunda lista de campos (razaoSocial/frequenciaVisita, ambos obrigatórios)
- `lib/importacao/modeloFrequencia.ts` - gerador do modelo de planilha de frequências
- `lib/importacao/annotarLinhaFrequencia.ts` - anotação pura por linha/lote (índice de clientes, reconhecimento de frequência, seis motivos)
- `lib/importacao/confirmarFrequencia.ts` - planejamento da carga (dedup L2, re-validação defensiva), reconciliação, fusão de motivos
- `app/actions/importacaoFrequencia.ts` - `validarLoteFrequencia` + `confirmarLoteFrequencia`
- `tests/importacao/frequencia-vocabulario.test.ts` - 7 casos (D4: campos/sugestão/apelido dentro e fora da lista/obrigatórios/aplicar/modelo)
- `tests/importacao/annotarLinhaFrequencia.test.ts` - 11 casos (ok/variação/lacunas/saneamento/paridade linha×lote)
- `tests/importacao/confirmarFrequencia.test.ts` - 8 casos (carga/erro/repetido L2/incompleto/frequência inválida/reconciliação/fusão/vazio)

## Decisions Made

- `SystemFieldDefinition` ganhou um parâmetro genérico `K` (padrão = união de 14 chaves de `SYSTEM_FIELDS`) em vez de uma segunda interface paralela — é o que torna D4 possível sem duplicar a tabela de mapeamento inteira entre os dois vocabulários de importação.
- `suggestMapping` passou a conferir explicitamente se o resultado de um apelido pertence à lista de campos efetivamente recebida antes de devolvê-lo — provado nos dois sentidos pelos casos `apelidoforadalista` (CEP não vaza para a lista de frequências) e `apelidopreservado` (CEP continua funcionando normalmente contra a lista de 14).
- Ambiguidade de razão social (mais de um cliente casando com a mesma chave normalizada) é tratada como erro com identificador nulo — a lacuna L1, não coberta pelo `17-UI-SPEC.md` original, ganhou um sexto motivo de linha documentado como adição consciente ao contrato de copy aprovado.
- Linhas repetindo o mesmo cliente na planilha (lacuna L2) são deduplicadas por identificador na fase de planejamento da carga (não na anotação) — primeira ocorrência vence, mesma convenção já usada na detecção de duplicados de razão social da v1.1.
- A leitura de validação não filtra por `status_acompanhamento` — filtrar aqui transformaria a mensagem "cliente encontrado mas não está ganho" em "cliente não encontrado", que seria uma informação errada para o Supervisor corrigir a planilha.

## Deviations from Plan

None - plan executado exatamente como escrito. Um ajuste de redação foi feito durante a auto-verificação: o comentário de cabeçalho original de `annotarLinhaFrequencia.ts` continha literalmente as strings `"use client"`/`"use server"` (para dizer que o módulo NÃO usa essas diretivas), o que disparava um falso positivo no script de verificação mecânica do próprio plano (que busca essas substrings para garantir pureza do módulo). Reescrito para "no client/server component directive" — mesmo significado, sem a colisão textual. Não é uma mudança de comportamento, é correção de comentário antes do primeiro commit da Task 2.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária; nenhuma dependência nova instalada.

## Next Phase Readiness

- A camada não visual do IMP-01 está completa: valida sem escrever, grava numa única chamada por lote, conta honestamente atualizados×puladas, e nenhuma linha inapta/ambígua/repetida/com frequência inválida consegue chegar ao banco.
- `lib/importacao/annotarLinhaFrequencia.ts` (tipos + `annotarLoteFrequencia`) e `app/actions/importacaoFrequencia.ts` (`validarLoteFrequencia`/`confirmarLoteFrequencia`) estão prontos para os planos 17-04 (tabela de revisão/resumo) e 17-05 (assistente/rota/menu) montarem a tela em cima.
- **REQUIREMENTS.md deliberadamente não marcado como concluído para IMP-01 por este plano** — mesma convenção já usada no 17-01: IMP-01 só é cumprido de ponta a ponta quando a tela dos planos 17-04/17-05 existir. Este plano entrega a lógica de aplicação; a fundação de banco já estava em produção desde o 17-01.
- Nenhum bloqueio novo identificado.

---
*Phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio*
*Completed: 2026-08-10*
