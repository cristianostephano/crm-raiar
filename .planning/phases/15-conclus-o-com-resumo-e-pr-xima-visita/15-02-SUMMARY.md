---
phase: 15-conclus-o-com-resumo-e-pr-xima-visita
plan: 02
subsystem: api
tags: [zod, next-server-actions, typescript, vitest]

# Dependency graph
requires:
  - phase: 15-conclus-o-com-resumo-e-pr-xima-visita
    provides: "Plano 15-01 — concluir_tarefa_prospeccao(uuid,text), concluir_visita(uuid,text,date), agenda_do_vendedor() com frequencia_visita/proxima_data_sugerida, limites 10..500 gravados no banco"
provides:
  - "lib/validations/agenda.ts — fonte única dos limites (10/500) e das três mensagens de validação do resumo, esquema zod que apara e valida, auxiliar validarResumo()"
  - "lib/funil/frequencia.ts — geraProximaVisita(), autoridade única de 'este cliente gera próxima visita?'"
  - "AgendaItem (lib/agenda/itens.ts) com frequenciaVisita/proximaDataSugerida, vindas prontas do banco"
  - "lib/supabase/queries/agenda.ts mapeando as duas colunas novas"
  - "app/actions/agenda.ts — concluirTarefaProspeccao() e concluirVisita(), únicas ações de escrita de conclusão"
affects: [15-03-dialogo-de-conclusao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validação de texto compartilhada entre tela e servidor via zod .transform().superRefine(), devolvendo um formato simples { valido, resumo|message } em vez do resultado bruto do zod"
    - "Decisão de negócio pura (geraProximaVisita) espelhando exatamente o guard já existente na RPC — camada educada do lado da aplicação, nunca a fronteira real"
    - "Ação de servidor de escrita: checagem de sessão -> revalidação de input compartilhada -> chamada de RPC nomeada -> tradução de erro cru para mensagem genérica -> revalidatePath dos caminhos afetados"

key-files:
  created:
    - lib/validations/agenda.ts
    - tests/agenda/conclusao-validacao.test.ts
  modified:
    - lib/funil/frequencia.ts
    - lib/agenda/itens.ts
    - lib/supabase/queries/agenda.ts
    - app/actions/agenda.ts
    - tests/agenda/agenda-item-row.test.tsx
    - tests/agenda/agenda-list.test.tsx
    - tests/agenda/itens.test.ts

key-decisions:
  - "geraProximaVisita/AgendaItem usam null (não string vazia) para representar 'sem frequência'/'sem data sugerida' — segue a convenção já estabelecida no projeto para colunas nullable (responsavel, responsavelNome) e o tipo explícito 'FrequenciaVisita | null' que o 15-UI-SPEC.md já define nas Props do ConcluirItemDialog."
  - "revalidatePath('/agenda') + revalidatePath('/clientes') nas duas ações novas — a tarefa/visita concluída desaparece da agenda e a mesma tarefa/histórico aparece na ficha do cliente."
  - "Rule 3 auto-fix: tests/agenda/itens.test.ts (não listado em files_modified do plano) também constrói AgendaItem através de um builder local — precisou ganhar frequenciaVisita/proximaDataSugerida vazios para o projeto continuar compilando, mesma mudança mínima já pedida explicitamente para agenda-item-row.test.tsx/agenda-list.test.tsx."

patterns-established:
  - "lib/validations/agenda.ts é o dono único dos limites/mensagens do resumo — qualquer tela ou ação futura que valide um resumo deve importar daqui, nunca redeclarar os números 10/500 ou as três strings."

requirements-completed: []
# CONC-01/VIS-03 permanecem 'Pending' em REQUIREMENTS.md após este plano — mesma
# convenção do 15-01-SUMMARY.md: a camada de aplicação está completa e testada,
# mas o comportamento do usuário final só fica completo depois do Plano 15-03
# (ConcluirItemDialog na tela da Agenda).

coverage:
  - id: D1
    description: "lib/validations/agenda.ts: RESUMO_MIN/RESUMO_MAX (10/500) e as três mensagens do Copywriting Contract como fonte única, apara espaços antes de medir"
    requirement: "CONC-01"
    verification:
      - kind: unit
        ref: "tests/agenda/conclusao-validacao.test.ts#minimo/curto/maximo/longo/vazio/espacos/aparado"
        status: pass
      - kind: other
        ref: "check estrutural do Task 1 (node -e): mensagens copiadas literalmente do 15-UI-SPEC.md, arquivo puro (sem next/* nem lib/supabase)"
        status: pass
    human_judgment: false
  - id: D2
    description: "geraProximaVisita(): decisão pura de cadência, verdadeiro para semanal/quinzenal/mensal, falso para 'nenhuma' e para ausência de frequência"
    requirement: "VIS-03"
    verification:
      - kind: unit
        ref: "tests/agenda/conclusao-validacao.test.ts#cadencia"
        status: pass
    human_judgment: false
  - id: D3
    description: "AgendaItem ganha frequenciaVisita/proximaDataSugerida, mapeados de agenda_do_vendedor() sem nenhuma aritmética de data do lado da aplicação"
    requirement: "VIS-03"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts (17/17, builder atualizado com os dois campos novos)"
        status: pass
      - kind: other
        ref: "check estrutural do Task 2 (node -e): colunas frequencia_visita/proxima_data_sugerida presentes no mapeamento, zero addMonths/addWeeks/addDays em lib/agenda/itens.ts, exatamente 2 chamadas .rpc() em lib/supabase/queries/agenda.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "concluirTarefaProspeccao/concluirVisita: ações de servidor tipadas, chamando exatamente as RPCs concluir_tarefa_prospeccao/concluir_visita do Plano 15-01, revalidando o resumo pelo esquema compartilhado, zerando a data quando o cliente não tem cadência, revalidando /agenda + /clientes no sucesso, sem vazar erro cru do banco"
    requirement: "CONC-01"
    verification:
      - kind: other
        ref: "check estrutural do Task 2 (node -e): nomes das RPCs presentes, zero .update()/.insert()/.delete() direto em tarefas/visitas/historico, revalidatePath presente, import de lib/validations/agenda e lib/funil/frequencia presentes, zero ': any'"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit (projeto inteiro) + npx eslint (5 arquivos tocados) limpos"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-08-09
status: complete
---

# Phase 15 Plan 2: Camada de Aplicação (Validação Compartilhada + Server Actions de Conclusão) Summary

**Esquema de validação do resumo com dono único (10-500 caracteres), função pura de decisão de cadência, item de agenda estendido com frequência/data sugerida vindas prontas do banco, e duas Server Actions (`concluirTarefaProspeccao`/`concluirVisita`) que só chamam as RPCs do Plano 15-01.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-09T01:41:00Z (aprox.)
- **Completed:** 2026-08-09T02:16:38Z
- **Tasks:** 2 (ambos `auto`, sem checkpoint)
- **Files modified:** 9 (1 novo + 5 modificados de aplicação + 3 arquivos de teste de componente/unidade)

## Accomplishments
- `lib/validations/agenda.ts` (novo): `RESUMO_MIN`/`RESUMO_MAX` (10/500) e as três mensagens de validação do Copywriting Contract (`15-UI-SPEC.md`) copiadas literalmente, como fonte única no código de aplicação; `resumoSchema` (zod) que apara espaços ANTES de medir, espelhando exatamente o `btrim`+`char_length` que a RPC já faz no banco; `validarResumo()` auxiliar devolvendo `{ valido: true, resumo }` ou `{ valido: false, message }` para tela e servidor consumirem sem reinterpretar o formato bruto do zod
- `lib/funil/frequencia.ts` estendido com `geraProximaVisita()` — autoridade única de "este cliente gera próxima visita?", verdadeiro para `semanal`/`quinzenal`/`mensal`, falso para `nenhuma` e para ausência de frequência
- `tests/agenda/conclusao-validacao.test.ts` (novo, 11/11 verde): mínimo, curto demais, máximo, longo demais, vazio, só espaços (mensagem de vazio, não de curto), aparado (aceito e valor devolvido já aparado), aparado curto demais, e as 3 variações da decisão de cadência
- `lib/agenda/itens.ts`: `AgendaItem` ganhou `frequenciaVisita: FrequenciaVisita | null` e `proximaDataSugerida: string | null`, ambas documentadas como vindas PRONTAS do banco (Pitfall 1) — módulo continua puro, importa `FrequenciaVisita` de `lib/funil/frequencia.ts` (também puro)
- `lib/supabase/queries/agenda.ts`: `AgendaRow`/`mapRow` mapeiam as duas colunas novas (`frequencia_visita`/`proxima_data_sugerida`) de `agenda_do_vendedor()`; leitura continua 1 chamada de RPC por função (`getAgenda`/`getAgendaPendentesCount`), sem reordenar/filtrar/cortar
- `app/actions/agenda.ts`: cabeçalho atualizado (deixa de ser "fase de leitura pura"); duas ações de escrita novas —
  - `concluirTarefaProspeccao(tarefaId, resumo)`: checa sessão, revalida resumo com `validarResumo()`, chama `concluir_tarefa_prospeccao`, traduz erro cru para mensagem genérica, revalida `/agenda` + `/clientes`
  - `concluirVisita(visitaId, resumo, frequenciaVisita, proximaData)`: mesmos passos, mais a guarda de cadência via `geraProximaVisita()` — zera a data enviada quando o cliente não tem cadência (independente do que a tela mandou) e recusa localmente (sem ir ao banco) quando há cadência real e nenhuma data foi confirmada
  - Ambas devolvem a mesma forma de união discriminada do resto do projeto, com códigos `unauthenticated`/`resumo_invalido`/`data_nao_confirmada`/`salvar_falhou`
- `tests/agenda/{agenda-item-row,agenda-list,itens}.test.tsx/.ts`: builders de `AgendaItem` completados com `frequenciaVisita: null, proximaDataSugerida: null` — mudança mínima para o projeto voltar a compilar, sem caso de teste novo (comportamento novo é do Plano 15-03)
- Verificação completa: `npx tsc --noEmit` limpo no projeto inteiro, `npx eslint` limpo nos 5 arquivos de aplicação tocados, 39/39 testes verdes (`itens.test.ts` + `conclusao-validacao.test.ts` + `agenda-item-row.test.tsx` + `agenda-list.test.tsx`), e todos os checks estruturais mecânicos dos dois tasks passaram

## Task Commits

Each task was committed atomically:

1. **Task 1: Esquema de validação do resumo e a decisão de cadência, com testes puros** - `f779cbe` (feat)
2. **Task 2: Item de agenda com frequência e data sugerida, e as duas ações de servidor de conclusão** - `eac6263` (feat)

**Plan metadata:** commit deste SUMMARY.md (docs)

## Files Created/Modified
- `lib/validations/agenda.ts` - limites/mensagens/esquema/auxiliar de validação do resumo (novo)
- `lib/funil/frequencia.ts` - `geraProximaVisita()` acrescentada
- `tests/agenda/conclusao-validacao.test.ts` - 11 testes puros dos limites do resumo e da cadência (novo)
- `lib/agenda/itens.ts` - `AgendaItem` com `frequenciaVisita`/`proximaDataSugerida`
- `lib/supabase/queries/agenda.ts` - mapeamento das duas colunas novas
- `app/actions/agenda.ts` - `concluirTarefaProspeccao`/`concluirVisita` acrescentadas
- `tests/agenda/agenda-item-row.test.tsx` - builder completado
- `tests/agenda/agenda-list.test.tsx` - builder completado
- `tests/agenda/itens.test.ts` - builder completado (Rule 3, fora do `files_modified` original)

## Decisions Made

- `frequenciaVisita`/`proximaDataSugerida` tipados como `| null` (não `| ""`), seguindo a convenção já estabelecida no projeto para campos opcionais vindos do banco (`responsavel`/`responsavelNome`) e o tipo explícito que o `15-UI-SPEC.md` já define nas Props de `ConcluirItemDialog` (`frequenciaVisita: FrequenciaVisita | null`).
- `revalidatePath` chama tanto `/agenda` quanto `/clientes` nas duas ações novas, porque a tarefa/histórico concluído e a próxima visita seedada também aparecem na ficha do cliente (mesmo raciocínio já usado em `app/actions/tarefas.ts`).
- Mensagem de erro genérica reaproveitada literalmente do `GanhoFrequenciaDialog`/`PerdaMotivoDialog` (`"Não foi possível salvar as alterações. Tente novamente."`), em vez de inventar um texto novo — consistência de copy across dialogs de conclusão/perda/ganho.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/agenda/itens.test.ts` também precisou do builder completado**
- **Found during:** Task 2 (verificação `npx tsc --noEmit`/`npx vitest`)
- **Issue:** `AgendaItem` ganhou duas propriedades obrigatórias; `tests/agenda/itens.test.ts` tem seu próprio builder local `item()` (não listado em `files_modified` do plano, que só citava `agenda-item-row.test.tsx`/`agenda-list.test.tsx`) e quebraria a compilação sem a mesma mudança mínima.
- **Fix:** Adicionadas `frequenciaVisita: null, proximaDataSugerida: null` ao builder, igual ao que o plano já pedia explicitamente para os outros dois arquivos de teste. Nenhum caso de teste novo adicionado.
- **Files modified:** `tests/agenda/itens.test.ts`
- **Verification:** `npx vitest run tests/agenda/itens.test.ts` (17/17 verde), `npx tsc --noEmit` limpo.
- **Committed in:** `eac6263` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessário apenas para manter o projeto compilando após a mudança de formato do item de agenda — sem scope creep, nenhum comportamento novo introduzido.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Nenhuma dependência npm nova, nenhuma migration, nenhuma alteração de banco.

## Next Phase Readiness

- O Plano 15-03 (`ConcluirItemDialog` na tela da Agenda) tem tudo de que precisa: `lib/validations/agenda.ts` exporta `RESUMO_MIN`/`RESUMO_MAX`/as três mensagens/`validarResumo()`; `lib/funil/frequencia.ts` exporta `geraProximaVisita()`; `AgendaItem` já carrega `frequenciaVisita`/`proximaDataSugerida` prontos; `app/actions/agenda.ts` exporta `concluirTarefaProspeccao(tarefaId, resumo)` e `concluirVisita(visitaId, resumo, frequenciaVisita, proximaData)`, ambas tipadas em união discriminada.
- Contrato para o 15-03 (repetido do `artifacts_produced` do plano): a tela NUNCA redeclara os limites/mensagens do resumo — importa de `lib/validations/agenda.ts`. A data sugerida é exibida/pré-selecionada sem nenhum recálculo (o `date-fns` `addWeeks`/`addMonths` que o `15-UI-SPEC.md` descreve para o preview inicial da tela é um cálculo de EXIBIÇÃO client-side, nunca confundir com o campo `proximaDataSugerida` vindo do banco, que já está pronto).
- Nenhum requisito marcado como `Complete` em `REQUIREMENTS.md` por este plano — CONC-01/VIS-03 continuam `Pending` até o Plano 15-03 entregar o comportamento visível ao usuário final, mesma convenção documentada em `15-01-SUMMARY.md`.
- Requisitos CONC-01/VIS-03 permanecem Pending; ROADMAP/STATE ficam sob responsabilidade do orquestrador após a wave (execução em worktree paralelo — `gsd-tools.cjs` indisponível neste checkout, conforme já registrado em `STATE.md` > Blockers/Concerns).

---
*Phase: 15-conclus-o-com-resumo-e-pr-xima-visita*
*Completed: 2026-08-09*
