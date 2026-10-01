---
phase: 31-agenda-2-visitas-manuais-na-lista
plan: 02
subsystem: ui
tags: [zod, date-fns, agenda2, typescript, lgpd]

requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "01"
    provides: "Migration 0048 agenda2_itens — nomes de colunas, limites 120/60 e regra de 8+ dígitos que o schema deste plano espelha"
provides:
  - "lib/agenda2/itens.ts — tipo Agenda2Item e funções puras da Lista (seções, visibilidade dos concluídos, opções do filtro, aviso de duplicado), toda decisão de dia delegada a bucketDoItem()"
  - "lib/validations/agenda2.ts — agenda2ItemSchema único (navegador + Server Action), contemSequenciaLongaDeDigitos espelhando a constraint do banco, agenda2ItemIdSchema"
  - "tests/agenda2/itens.test.ts — 16 casos verdes"
  - "tests/agenda2/validacao-agenda2.test.ts — 15 casos verdes"
affects: [31-04, 31-07, 31-08]

tech-stack:
  added: []
  patterns:
    - "Agenda2Item reusa bucketDoItem/filtrarPorVendedor de lib/agenda/itens.ts por import direto — nenhuma segunda autoridade de data/filtro é criada (mesmo contrato que o próprio lib/agenda/itens.ts já documenta para si)"
    - "visivelNaListaAgenda2: pendente sempre visível; concluído de hoje/futuro sempre visível; concluído de data passada só visível se atualizadoEm cai no bucket 'hoje' — resolve a lacuna entre D-01 (3 seções) e D-04 (concluído riscado) sem inventar um quarto bucket"
    - "agenda2ItemSchema segue o padrão trim()+min()+max()+refine() do zod v4: trim roda antes de min/max no mesmo campo, e cada campo produz só UM issue por vez (confirmado em runtime antes de escrever o schema)"

key-files:
  created:
    - lib/agenda2/itens.ts
    - lib/validations/agenda2.ts
    - tests/agenda2/itens.test.ts
    - tests/agenda2/validacao-agenda2.test.ts
  modified: []

key-decisions:
  - "existeItemParecido normaliza nome com trim + colapso de espaços internos + toLocaleLowerCase('pt-BR'), e compara data como TEXTO (nunca convertendo para objeto de data) — mesma imunidade a fuso que o resto do arquivo já pratica"
  - "contemSequenciaLongaDeDigitos remove ponto, barra, hífen e espaço antes de testar /[0-9]{8,}/ — confirmado em runtime que replicar a regex SQL [./[:space:]-] como /[./\\s-]/g produz o mesmo resultado nos 5 casos do teste"
  - "data: z.string().min(1,...).refine(...) na ordem literal do plano — parseISO('2026-02-30') já devolve Invalid Date (confirmado em runtime), então o refine isValid+format é dupla proteção, não gambiarra"

patterns-established: []

requirements-completed: [AGD2-01, AGD2-03, AGD2-05, AGD2-07]

coverage:
  - id: D1
    description: "lib/agenda2/itens.ts: Agenda2Item + agruparAgenda2/visivelNaListaAgenda2/itensDaListaAgenda2/vendedoresDaAgenda2/existeItemParecido, toda decisão de dia delegada a bucketDoItem()"
    requirement: "AGD2-01"
    verification:
      - kind: unit
        ref: "tests/agenda2/itens.test.ts (16 casos: agrupa-tres-secoes, proximos-sem-horizonte, particao-verdadeira, preserva-ordem, visivel-pendente-passado, visivel-concluido-hoje-e-futuro, oculto-concluido-de-dia-passado, visivel-concluido-passado-alterado-hoje, itens-da-lista-filtra-e-preserva-ordem, vendedores-distintos, filtro-reusa-filtrarPorVendedor, parecido-ignora-caixa-e-espacos, parecido-data-diferente, parecido-nome-diferente, parecido-ignora-o-proprio, fonte-sem-data-propria)"
        status: pass
    human_judgment: false
  - id: D2
    description: "visivelNaListaAgenda2 resolve a correção 7 do 31-01-PLAN.md (D-04/D-05): pendente sempre visível, concluído hoje/futuro visível, concluído passado só visível se alterado hoje"
    requirement: "AGD2-05"
    verification:
      - kind: unit
        ref: "tests/agenda2/itens.test.ts#visivel-concluido-hoje-e-futuro"
        status: pass
      - kind: unit
        ref: "tests/agenda2/itens.test.ts#oculto-concluido-de-dia-passado"
        status: pass
      - kind: unit
        ref: "tests/agenda2/itens.test.ts#visivel-concluido-passado-alterado-hoje"
        status: pass
    human_judgment: false
  - id: D3
    description: "lib/validations/agenda2.ts: agenda2ItemSchema (nome/bairro/data), contemSequenciaLongaDeDigitos espelhando chk_agenda2_*_sem_documento, agenda2ItemIdSchema"
    requirement: "AGD2-03"
    verification:
      - kind: unit
        ref: "tests/agenda2/validacao-agenda2.test.ts (15 casos: aceita-valido-aparado, nome-vazio, nome-limite, bairro-vazio, bairro-limite, data-vazia, data-invalida, data-passada-aceita, documento-no-nome, numeros-curtos-aceitos, documento-no-bairro, contem-sequencia, sem-campos-extras, id-uuid, constantes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "filtro por vendedor (D-17) reusa filtrarPorVendedor de lib/agenda/itens.ts sem alteração, aplicado a Agenda2Item[]"
    requirement: "AGD2-07"
    verification:
      - kind: unit
        ref: "tests/agenda2/itens.test.ts#filtro-reusa-filtrarPorVendedor"
        status: pass
    human_judgment: false

duration: ~9min
completed: 2026-10-01
status: complete
---

# Phase 31 Plan 2: Funções Puras e Schema da Lista da Agenda 2 Summary

**Dois módulos puros TDD: `lib/agenda2/itens.ts` (seções, visibilidade dos concluídos, opções do filtro, aviso de duplicado — toda decisão de dia delegada a `bucketDoItem()`) e `lib/validations/agenda2.ts` (schema Zod único do formulário e da Server Action, com recusa de sequência de dígitos de documento), com 31/31 testes verdes.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-10-01T12:30:50Z
- **Completed:** 2026-10-01T12:38:53Z
- **Tasks:** 2
- **Files modified:** 4 (todos criados, nenhum arquivo existente alterado)

## Accomplishments
- `lib/agenda2/itens.ts` criado: `Agenda2Item`, `Agenda2Agrupada`, `agruparAgenda2`, `visivelNaListaAgenda2`, `itensDaListaAgenda2`, `vendedoresDaAgenda2`, `existeItemParecido` — zero importação de `next/*`/`@/lib/supabase/*`, zero conta de data própria (toda decisão de atrasado/hoje/próximos vem de `bucketDoItem()`, importada de `lib/agenda/itens.ts`).
- `lib/validations/agenda2.ts` criado: `agenda2ItemSchema`, `agenda2ItemIdSchema`, `AGENDA2_NOME_MAX`/`AGENDA2_BAIRRO_MAX`/`AGENDA2_DIGITOS_SEGUIDOS_MAX`, `contemSequenciaLongaDeDigitos` e as 8 constantes de mensagem — espelhando literalmente as constraints `chk_agenda2_*` da migration 0048 (31-01).
- `tests/agenda2/itens.test.ts`: 16 casos verdes, incluindo `fonte-sem-data-propria` (lê o próprio arquivo-fonte com `fs` e confirma, por regex, que não há `differenceInCalendarDays`/`parseISO`/`new Date(texto)` nem mais de uma chamada de `.sort()`).
- `tests/agenda2/validacao-agenda2.test.ts`: 15 casos verdes, incluindo `sem-campos-extras` (confirma que o `z.object` padrão descarta `vendedorId`/`concluido` enviados a mais no payload).
- `lib/agenda/itens.ts` (Agenda atual) confirmado intocado: `git diff --name-only 071871f -- lib/agenda` não lista nada.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1 RED: testes das funções puras da Agenda 2** - `6a3f291` (test)
2. **Tarefa 1 GREEN: funções puras da Lista da Agenda 2** - `0756831` (feat)
3. **Tarefa 2 RED: testes do schema da Agenda 2** - `4045c91` (test)
4. **Tarefa 2 GREEN: schema compartilhado do item da Agenda 2** - `b8135e6` (feat)

**Plan metadata:** pending (this commit)

_Nota: as 4 tarefas TDD deste plano (duas RED, duas GREEN) resultaram em 4 commits — não houve necessidade de um commit REFACTOR em nenhuma delas; o código ficou verde já na primeira versão escrita._

## Files Created/Modified
- `lib/agenda2/itens.ts` - tipo `Agenda2Item` + 5 funções puras da Lista da Agenda 2
- `lib/validations/agenda2.ts` - schema Zod único (nome/bairro/data) + validador de id
- `tests/agenda2/itens.test.ts` - 16 testes das funções puras
- `tests/agenda2/validacao-agenda2.test.ts` - 15 testes do schema

## Decisions Made
- `existeItemParecido` normaliza nome com `trim()` + colapso de espaços internos + `toLocaleLowerCase("pt-BR")`, e compara `data` como texto puro (nunca `parseISO`/`new Date`), mantendo a mesma imunidade a fuso horário que o resto do arquivo documenta.
- `contemSequenciaLongaDeDigitos` usa `/[./\s-]/g` para remover os separadores antes do teste `/[0-9]{8,}/` — verificado em runtime (node -e) que reproduz exatamente os 5 casos do teste e a mesma regra da constraint SQL `regexp_replace(coluna, '[./[:space:]-]', '', 'g') !~ '[0-9]{8,}'`.
- Antes de escrever `agenda2ItemSchema`, confirmei em runtime (node -e) três comportamentos do zod v4 instalado neste projeto, já que a interface do plano dependia deles: (1) `.string().trim().min(1,...)` aplica o trim antes do min e gera só um issue; (2) `z.object({...}).safeParse` descarta chaves desconhecidas por padrão (sem precisar de `.strict()`); (3) `z.uuid()` existe como helper de nível superior (não só `z.string().uuid()`). Nenhuma suposição ficou sem checagem.

## Deviations from Plan

None - plan executed exactly as written. Os 31 casos de teste e a implementação dos dois módulos seguem literalmente o bloco `<behavior>`/`<implementation>` de cada feature do 31-02-PLAN.md.

## Issues Encountered
None.

## User Setup Required
None - módulos puros em TypeScript, sem dependência de serviço externo nem de banco.

## Alerta de Conformidade (LGPD)

Conforme instrução organizacional: este plano implementa a camada de validação de um campo de **dado pessoal** (nome livre do cliente, que pode identificar uma pessoa física em pequenos negócios PJ/MEI, e bairro — parte da rotina de deslocamento do vendedor). A minimização já decidida na migration 0048 (31-01) é reforçada aqui no lado da aplicação: `agenda2ItemSchema` só aceita os três campos (`nomeCliente`, `bairro`, `data`) — qualquer campo extra enviado ao formulário é descartado pelo próprio `z.object` (caso `sem-campos-extras`) — e `contemSequenciaLongaDeDigitos` recusa automaticamente, nos dois campos de texto livre, qualquer sequência que lembre CPF/CNPJ/telefone/CEP, com a mesma regra já aplicada como constraint no banco. Nenhum dado é persistido nesta plano (módulos puros, sem escrita); o prazo de retenção dos dados do piloto continua em aberto, como já registrado no 31-01-SUMMARY.md.

## Next Phase Readiness
- `lib/agenda2/itens.ts` e `lib/validations/agenda2.ts` estão prontos para serem consumidos pela Server Action (31-04) e pelo formulário/tela (31-07/31-08) — a mesma `agenda2ItemSchema` deve validar nos dois lados, e a Server Action monta o insert só a partir do resultado do `parse` (nunca do payload cru), conforme o threat register deste plano (T-31-10).
- Nenhum bloqueio para o plano 31-03 (aplicação da migration 0048 em produção) nem para planos seguintes — este plano não toca em banco, Supabase ou `next/*`.
- Os limites 120/60 e a regra de 7 dígitos seguidos ficam fixados nos dois lados (banco e aplicação); qualquer mudança futura precisa alterar migration E este schema na mesma leva (o teste de sincronia é responsabilidade do plano 31-04).

---
*Phase: 31-agenda-2-visitas-manuais-na-lista*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: lib/agenda2/itens.ts
- FOUND: lib/validations/agenda2.ts
- FOUND: tests/agenda2/itens.test.ts
- FOUND: tests/agenda2/validacao-agenda2.test.ts
- FOUND commit: 6a3f291 (Tarefa 1 RED)
- FOUND commit: 0756831 (Tarefa 1 GREEN)
- FOUND commit: 4045c91 (Tarefa 2 RED)
- FOUND commit: b8135e6 (Tarefa 2 GREEN)
- Re-ran `npx vitest run tests/agenda2/itens.test.ts tests/agenda2/validacao-agenda2.test.ts` — 31/31 passed
- Re-ran `npx tsc --noEmit` — clean
- Re-ran `npx eslint lib/agenda2/itens.ts lib/validations/agenda2.ts tests/agenda2/itens.test.ts tests/agenda2/validacao-agenda2.test.ts` — clean
- Confirmed `git diff --name-only 071871f -- lib/agenda` lists no file (Agenda atual intocada)
