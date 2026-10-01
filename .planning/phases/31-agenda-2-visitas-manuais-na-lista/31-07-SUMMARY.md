---
phase: 31-agenda-2-visitas-manuais-na-lista
plan: "07"
subsystem: ui
tags: [react-hook-form, zod, react-day-picker, agenda2, lgpd, tdd]

requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "02"
    provides: "agenda2ItemSchema, Agenda2ItemInput, AGENDA2_NOME_MAX/BAIRRO_MAX (lib/validations/agenda2.ts); Agenda2Item, existeItemParecido (lib/agenda2/itens.ts)"
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "04"
    provides: "criarAgenda2Item(values) / atualizarAgenda2Item(itemId, values) → Agenda2MutationResult (app/actions/agenda2.ts)"
provides:
  - "components/agenda2/Agenda2ItemForm.tsx — janela de criar/editar item da Agenda 2, three-field Dialog controlado de fora (open/onOpenChange/modo/item/itensExistentes/onSalvo)"
  - "tests/agenda2/agenda2-item-form.test.tsx — 11 casos verdes (criar/editar/validação/documento/duplicado/falha/enviando)"
affects: [31-08]

tech-stack:
  added: []
  patterns:
    - "Aviso de duplicado (D-07) 100% derivado de estado (sem useEffect): avisoPara guarda o snapshot BRUTO (form.getValues()) no momento em que existeItemParecido bate; mostrarAviso compara esse snapshot campo-a-campo com useWatch (também bruto) — qualquer edição depois derruba o aviso sozinha, sem limpeza manual"
    - "data-day do Calendar (react-day-picker, components/ui/calendar.tsx) vem de Date.toLocaleDateString() SEM locale explícito — não é AAAA-MM-DD; o seletor de teste usa a mesma chamada (new Date().toLocaleDateString()) em vez de um literal fixo, continuando portátil entre locales/CI diferentes"
    - "Dialog controlado sem DialogTrigger próprio (a Lista, 31-08, decide quando abrir, a partir de três lugares) — componente interno com key=`${modo}-${item?.id ?? \"novo\"}` para garantir defaultValues frescos a cada abertura diferente"

key-files:
  created:
    - components/agenda2/Agenda2ItemForm.tsx
    - tests/agenda2/agenda2-item-form.test.tsx
  modified: []

key-decisions:
  - "Mensagem de falha ao salvar é sempre o texto fixo do UI-SPEC ('Não foi possível salvar. Tente novamente.'), nunca error.message vindo da Server Action — mesma postura de não vazar detalhe interno já usada em outros fluxos do projeto"
  - "Popup trigger da Data usa type=\"button\" explicitamente — sem isso, o botão herdaria o type=\"submit\" padrão do HTML por estar dentro de um <form>, e clicar para abrir o calendário submeteria o formulário"
  - "beforeEach com mockReset() dos mocks de @/app/actions/agenda2 (precedente de tests/agenda/agenda-list.test.tsx) — sem isso, mockResolvedValueOnce/mockReturnValueOnce enfileirados por um teste vazavam para o próximo teste e produziam falsos negativos no estado 'enviando' e nos testes de duplicado/falha"

patterns-established: []

requirements-completed: [AGD2-01, AGD2-03]

coverage:
  - id: D1
    description: "Agenda2ItemForm: três campos (nome, bairro, data), dica de LGPD sempre visível, sem nenhum campo de dono/responsável na tela"
    requirement: "AGD2-01"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#criar-campos"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#criar-validacao"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#criar-documento"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#criar-ok"
        status: pass
    human_judgment: false
  - id: D2
    description: "Edição pré-preenchida mesmo para item concluído (D-06), mantendo a data original sem travas de passado (D-09)"
    requirement: "AGD2-03"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#editar-prefill"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#editar-ignora-o-proprio"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#data-passada"
        status: pass
    human_judgment: false
  - id: D3
    description: "Aviso não-bloqueante de possível duplicado (D-07): não envia na primeira tentativa, mostra o aviso, envia na segunda; mexer em qualquer campo apaga o aviso"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#duplicado-avisa"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#duplicado-limpa-ao-editar"
        status: pass
    human_judgment: false
  - id: D4
    description: "Falha ao salvar mostra mensagem genérica fixa e mantém a janela aberta; botão desabilitado com 'Salvando...' durante o envio"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#falha"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#enviando"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-10-01
status: complete
---

# Phase 31 Plan 7: Formulário de Criar/Editar Item da Agenda 2 Summary

**`Agenda2ItemForm` — Dialog de três campos (nome do cliente, bairro, data) com dica de LGPD, validação pelo schema compartilhado, aviso não-bloqueante de duplicado 100% derivado de estado (D-07), e calendário sem travas de data passada (D-09); 11/11 testes verdes.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-10-01T11:08:00-03:00 (aprox.)
- **Completed:** 2026-10-01T11:26:34-03:00
- **Tasks:** 2
- **Files modified:** 2 (1 criado em cada tarefa)

## Accomplishments
- `components/agenda2/Agenda2ItemForm.tsx` criado: Dialog controlado de fora (sem `DialogTrigger` próprio — a Lista, 31-08, decide quando abrir), três campos via `react-hook-form` + `zodResolver(agenda2ItemSchema)`, dica de LGPD como `FormDescription` fixa abaixo do nome, e nenhum campo de dono/responsável em nenhum estado da tela.
- Aviso de duplicado (D-07) implementado sem `useEffect`: `avisoPara` guarda o snapshot bruto (`form.getValues()`) no instante em que `existeItemParecido` bate; `mostrarAviso` é derivado comparando esse snapshot, campo a campo, com os valores observados via `useWatch` — qualquer edição subsequente derruba o aviso e o rótulo do botão sozinhos, sem limpeza manual de estado.
- Campo de data: `Popover` + `Calendar mode="single"` sem nenhuma prop de dias desabilitados (D-09, calendário aceita qualquer data, inclusive passada); conversão sempre via `format(dia, "yyyy-MM-dd")`/`parseISO`, nunca o construtor de data cru a partir de texto.
- Edição abre pré-preenchida mesmo para item concluído (D-06) e nunca inclui `concluido` no payload (o schema só tem os 3 campos, a Server Action de 31-04 já reforça isso do lado do servidor).
- `tests/agenda2/agenda2-item-form.test.tsx`: 11 casos verdes exercitando o schema e as funções puras REAIS (`agenda2ItemSchema`, `existeItemParecido`) — só `@/app/actions/agenda2` é mockado, provando o contrato de ponta a ponta no navegador.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1 RED: testes do formulário da Agenda 2** - `3631bdf` (test)
2. **Tarefa 2 GREEN: Agenda2ItemForm** - `bf4aef6` (feat)

**Plan metadata:** pending (this commit)

_Nota: as 2 tarefas TDD deste plano (uma RED, uma GREEN) resultaram em 2 commits — não houve necessidade de um commit REFACTOR; o código ficou verde na primeira versão escrita, depois de um ajuste no próprio arquivo de teste (ver Deviations)._

## Files Created/Modified
- `components/agenda2/Agenda2ItemForm.tsx` - Dialog de criar/editar item, três campos + aviso de duplicado
- `tests/agenda2/agenda2-item-form.test.tsx` - 11 testes de componente (RTL + jsdom)

## Decisions Made
- A mensagem de falha ao salvar é sempre o texto fixo do UI-SPEC ("Não foi possível salvar. Tente novamente."), nunca `error.message` vindo da Server Action — mesma postura de não vazar detalhe interno de erro já usada em outros fluxos do projeto (ex. `ForgotPasswordForm`).
- O gatilho (`PopoverTrigger`) do campo Data usa `type="button"` explicitamente — por estar dentro de um `<form>`, sem isso o navegador trataria o clique no gatilho como um submit (type padrão de `<button>` em formulário é "submit").
- `beforeEach` com `mockReset()` dos mocks de `@/app/actions/agenda2` no arquivo de teste (mesmo precedente de `tests/agenda/agenda-list.test.tsx`) — ver Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Seletor de dia do calendário no teste corrigido: `data-day` não é "AAAA-MM-DD"**
- **Found during:** Tarefa 1 (escrita do teste, antes do RED)
- **Issue:** O bloco `<interfaces>`/`<behavior>` do plano descreve o dia do calendário como `role="gridcell"` com `data-day="AAAA-MM-DD"` e "um botão dentro". Verificado em runtime (probe isolado com `npx vitest run` sobre `components/ui/calendar.tsx` antes de escrever o seletor): o atributo `data-day` vem de `day.date.toLocaleDateString(locale?.code)` **sem locale explícito** — no ambiente deste projeto isso resolve para o formato local da máquina (ex. `"01/10/2026"`, dd/MM/yyyy), não ISO. Além disso, o elemento com o atributo já É o `<button>` (o `role="gridcell"` é o `<td>` PAI, não um wrapper com um botão "dentro" dele).
- **Fix:** O teste usa `new Date().toLocaleDateString()` (mesma chamada, sem locale, no mesmo processo) para montar o seletor `[data-day="..."]`, em vez de um literal `"AAAA-MM-DD"` fixo — assim o seletor fica portátil entre máquinas/CI com locales diferentes, sempre batendo com o que `CalendarDayButton` realmente renderiza. A data em formato ISO (`format(new Date(), "yyyy-MM-dd")`) continua usada separadamente só para validar o payload enviado à Server Action.
- **Files modified:** tests/agenda2/agenda2-item-form.test.tsx
- **Verification:** 11/11 testes verdes, incluindo os 5 casos que dependem de selecionar uma data no calendário (`criar-documento`, `criar-ok`, `duplicado-avisa`, `duplicado-limpa-ao-editar`, `falha`, `enviando`).
- **Committed in:** `3631bdf` (Tarefa 1, já incorporado no arquivo de teste RED)

**2. [Rule 3 - Blocking] Mocks de Server Action vazavam entre testes, mascarando o estado "enviando" e o fluxo de duplicado**
- **Found during:** Tarefa 2 (primeira rodada do GREEN — 4 dos 11 casos falhavam de forma inconsistente)
- **Issue:** `mockResolvedValueOnce`/`mockReturnValueOnce` enfileirados em testes anteriores (ex. `falha`) não eram sempre consumidos na ordem esperada quando um teste anterior tinha um comportamento ligeiramente diferente do previsto, fazendo o valor "once" de um teste ser consumido pela chamada de outro teste — isso derrubava silenciosamente o teste `enviando` (a Promise controlada manualmente nunca era a que a implementação realmente recebia) e intermitentemente os testes de duplicado/falha.
- **Fix:** Adicionado `beforeEach(() => { mockedCriar.mockReset(); mockedAtualizar.mockReset() })` no `describe` do arquivo de teste — mesmo precedente já usado em `tests/agenda/agenda-list.test.tsx` (`mockClear()` nos 4 mocks de `@/app/actions/agenda`).
- **Files modified:** tests/agenda2/agenda2-item-form.test.tsx
- **Verification:** 11/11 testes verdes de forma estável (reexecutado 2x seguidas sem flutuação).
- **Committed in:** `bf4aef6` (Tarefa 2)

---

**Total deviations:** 2 auto-fixed (1 bug de seletor de teste, 1 bloqueio de isolamento entre testes)
**Impact on plan:** Nenhuma mudança de comportamento do componente de produção — os dois ajustes são só no arquivo de teste, para o teste refletir corretamente o DOM real do `react-day-picker` já instalado e para isolar corretamente os mocks entre casos. O plano já antecipava esse risco explicitamente no bloco `<output>` ("registrando... qualquer desvio, inclusive se a interação com o calendário em jsdom exigiu ajuste no seletor de dia").

## Issues Encountered
Nenhum bloqueio real — os dois itens acima foram resolvidos dentro do próprio ciclo RED/GREEN, sem precisar de decisão de arquitetura nem de intervenção do dono do projeto.

## User Setup Required
None - componente de interface puro em React/TypeScript, sem configuração de serviço externo. Depende das Server Actions de `app/actions/agenda2.ts` (31-04), que por sua vez dependem da migration 0048 (31-01, pendente de aplicação manual em produção) — esse bloqueio já estava documentado nos planos anteriores e não muda aqui; os 11 testes deste plano não dependem do banco real (ação mockada).

## Alerta de Conformidade (LGPD)

Conforme instrução organizacional: este plano constrói a TELA de entrada de um dado pessoal (nome livre do cliente, que pode identificar uma pessoa física em pequenos negócios PJ/MEI, e bairro). Reforços de Privacidade por Design e por Padrão aplicados aqui, na camada de interface:
- A dica "Use o Nome Fantasia do cliente. Evite nome completo de pessoa e documentos." aparece sempre, em criação e edição, como orientação (nunca bloqueia o envio) — caso `criar-campos`.
- Qualquer sequência de 8+ dígitos (típica de CPF/CNPJ/telefone/CEP) digitada no nome ou no bairro é recusada pelo schema compartilhado ANTES de qualquer chamada de rede — caso `criar-documento` — minimizando a chance de um documento de pessoa física chegar a ser enviado ao servidor a partir desta tela.
- `autoComplete="off"` nos dois campos de texto livre evita que o navegador memorize e sugira nomes/bairros de clientes digitados por outros usuários na mesma máquina.
- Nenhum campo de dono/responsável existe nesta tela — o vínculo com o vendedor é sempre carimbado pelo servidor (31-04), nunca enviado pelo navegador — caso `criar-campos` (ausência confirmada) e `criar-ok` (payload com exatamente 3 chaves).
- Nenhum dado é exportado ou agregado por este componente; ele só chama as duas Server Actions já auditadas em 31-04. O prazo de retenção dos dados do piloto continua em aberto, como já registrado nos planos 31-01/31-02/31-04.

## Next Phase Readiness
- `Agenda2ItemForm` está pronto para ser importado e aberto pela Lista (plano 31-08), nos três pontos previstos pelo UI-SPEC: botão do cabeçalho (criar), botão do estado vazio (criar) e "Editar" de cada linha (editar, inclusive de itens concluídos).
- A superfície pública do componente (`open`, `onOpenChange`, `modo`, `item`, `itensExistentes`, `onSalvo`) já está fixada exatamente como o bloco `<interfaces>` deste plano especifica — nenhuma mudança de assinatura deveria ser necessária no 31-08.
- Nenhum bloqueio de código para o plano 31-08. Bloqueio real de uso em produção continua sendo a aplicação manual da migration 0048 (31-03, aguardando aprovação do dono do projeto) — sem ela, `criarAgenda2Item`/`atualizarAgenda2Item` falhariam contra o banco real; os 11 testes deste plano não dependem disso (ação mockada).

---
*Phase: 31-agenda-2-visitas-manuais-na-lista*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: components/agenda2/Agenda2ItemForm.tsx
- FOUND: tests/agenda2/agenda2-item-form.test.tsx
- FOUND commit: 3631bdf (Tarefa 1 RED)
- FOUND commit: bf4aef6 (Tarefa 2 GREEN)
- Re-ran `npx vitest run tests/agenda2/agenda2-item-form.test.tsx` — 11/11 passed
- Re-ran `npx tsc --noEmit` — clean
- Re-ran `npx eslint components/agenda2/Agenda2ItemForm.tsx tests/agenda2/agenda2-item-form.test.tsx` — clean
- Re-ran `npx vitest run tests/agenda2/itens.test.ts tests/agenda2/validacao-agenda2.test.ts tests/agenda2/limites-sincronizados.test.ts` — 45/45 passed (no regression in sibling 31-02/31-04 suites)
