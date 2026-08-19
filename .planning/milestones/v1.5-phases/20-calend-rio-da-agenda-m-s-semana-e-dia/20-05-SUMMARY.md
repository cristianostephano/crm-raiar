---
phase: 20-calend-rio-da-agenda-m-s-semana-e-dia
plan: 05
subsystem: ui
tags: [react, agenda, calendar-ui, presentational-composition, base-ui-select]

# Dependency graph
requires:
  - phase: 20-calend-rio-da-agenda-m-s-semana-e-dia (plano 20-01)
    provides: "AgendaVisao type e a camada pura de calendário em lib/agenda/itens.ts"
  - phase: 20-calend-rio-da-agenda-m-s-semana-e-dia (plano 20-04)
    provides: "AgendaCalendario — contêiner que este plano compõe dentro de AgendaList.tsx (visao/onVisaoChange como props, nunca estado local)"
provides:
  - "components/agenda/AgendaList.tsx — estado de visão (padrão Lista, D-01) e composição de AgendaCalendario como irmão da Lista, alimentado pelo mesmo itensFiltrados que a Lista já consome"
  - "tests/agenda/agenda-calendario-integracao.test.tsx — alternância Lista/Calendário, garantia de busca única, coerência do filtro de vendedor entre as duas visões, e roteamento de concluir/abrir a partir do calendário"
  - "Fase 20 (Calendário da Agenda) encerrada — AGD-07/AGD-14 completos, verificação humana no navegador aprovada pelo dono do projeto"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "O corte que decidia toda a tela (carregando/erro/vazio/seções) passa a decidir só o bloco da Lista; AgendaCalendario é composto no mesmo ramo de 'dados prontos', antes desse corte, para que a barra sobreviva a qualquer estado da Lista (inclusive vazia)"
    - "Testes de Select (base-ui) em jsdom: clicar numa option que não é a primeira da lista exige fireEvent.pointerDown(option) ANTES de fireEvent.click(option) — um clique avulso é tratado como não-confiável e ignorado (mesma ressalva já documentada em tests/importacao/column-mapping-table.test.tsx)"

key-files:
  created:
    - "tests/agenda/agenda-calendario-integracao.test.tsx"
  modified:
    - "components/agenda/AgendaList.tsx"

key-decisions:
  - "O caso de teste 'vendedor sem item nenhum com a barra ainda visível' foi reescrito para reproduzir o mesmo risco estrutural (corte de vazio escapando para a tela inteira) pelo caminho SEM filtro de vendedor (concluir o único item pendente), em vez do caminho COM filtro — o caminho com filtro esbarra num bug pré-existente e fora de escopo do Select de vendedor (ver Deviations)"
  - "Dados de teste do checkpoint humano (4 clientes 'ZZ-TESTE 20-05 *') semeados e apagados via service-role client (mesmo padrão já usado nas Fases 13/18/19/19-04), nunca pela UI — evita o rate-limit conhecido de signInWithPassword"

requirements-completed: [AGD-07, AGD-14]

coverage:
  - id: D1
    description: "AgendaList ganha o alternador Lista/Calendário: abre em Lista por padrão (D-01), a barra aparece assim que os dados carregam (nunca durante carregando/erro), e um clique troca para qualquer um dos três modos de calendário e de volta, sem disparar segunda busca"
    requirement: "AGD-07"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-integracao.test.tsx#visão inicial / carregando e erro / alternância / sem segunda busca"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Lista continua se comportando exatamente como antes — mesmas três seções, mesmo cartão, mesmos dois estados de vazio, mesmo botão de exportar/carregando/erro — provado por tests/agenda/agenda-list.test.tsx passando SEM nenhuma edição"
    requirement: "AGD-07"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-list.test.tsx (10/10, zero edições) + verificação mecânica do plano (arquivo não menciona 'Calendário')"
        status: pass
    human_judgment: false
  - id: D3
    description: "O filtro de vendedor do Supervisor é aplicado uma única vez, acima das duas visões (itensFiltrados), e manda nos dois: escolher um vendedor muda a Lista E a grade de mês em concordância; voltar para 'Todos' restaura as duas"
    requirement: "AGD-14"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-integracao.test.tsx#coerência com o filtro de vendedor"
        status: pass
    human_judgment: false
  - id: D4
    description: "Concluir um item pelo calendário (visão de Dia) abre a mesma ConcluirItemDialog da Lista; abrir um item pelo calendário (visão de Semana) abre a mesma ClienteDetailSheet da Lista — nenhum diálogo duplicado"
    requirement: "AGD-07"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-integracao.test.tsx#concluir pela visão de Dia / abrir pela visão de Semana"
        status: pass
    human_judgment: false
  - id: D5
    description: "Verificação completa no navegador: alternância Lista↔Calendário, navegação de mês/semana/dia com botão Hoje e semana começando na segunda-feira, +N mais com clique abrindo a lista do dia, cores prospecção/visita e acento de atraso (inclusive em célula de mês vizinho), e o filtro de vendedor do Supervisor mandando nas duas visões com as contagens '+N' acompanhando"
    requirement: "AGD-07"
    verification:
      - kind: manual_procedural
        ref: "Roteiro de 10 passos conduzido pelo dono do projeto em http://localhost:3000/agenda, com dados semeados via service-role (ZZ-TESTE 20-05 *) — aprovado: 'tudo certo'"
        status: pass
    human_judgment: true
    rationale: "Cobre os 5 critérios de sucesso visuais/interativos da Fase 20 (cores, alinhamento de grade, navegação, contagem +N sob filtro) que só um humano pode confirmar a olho no navegador real."

duration: ~55min (incl. tempo de espera da aprovação humana no checkpoint)
completed: 2026-08-18
status: complete
---

# Phase 20 Plan 05: Fiação Lista/Calendário na tela da Agenda Summary

**AgendaList.tsx ganha o alternador Lista/Dia/Semana/Mês (estado `visao`, padrão Lista) compondo `AgendaCalendario` como irmão da Lista, alimentado pelo mesmo `itensFiltrados` já usado pelas seções — a Lista provadamente intacta (zero edição em `agenda-list.test.tsx`) e verificada de ponta a ponta no navegador pelo dono do projeto, fechando a Fase 20 inteira.**

## Performance

- **Duration:** ~55min (inclui o tempo de espera pela aprovação humana no checkpoint)
- **Tasks:** 2 (Task 1 com RED/GREEN via `tdd="true"`; Task 2 automação + checkpoint humano)
- **Files modified:** 2 (`AgendaList.tsx`, `tests/agenda/agenda-calendario-integracao.test.tsx`)

## Accomplishments

- `AgendaList.tsx` ganhou exatamente um estado novo (`visao: AgendaVisao`, iniciado em `"lista"` — D-01) e passou a compor `AgendaCalendario` logo antes do bloco que decide entre o estado de vazio e as três seções, dentro do mesmo ramo de "dados prontos" do `FetchState`.
- O corte que antes encerrava a renderização da tela inteira quando não havia item nenhum agora vale só para o bloco da Lista (`visao === "lista"`) — a barra de alternância (e o caminho de volta ao Calendário) sobrevive mesmo com a Lista vazia.
- `filtrarPorVendedor` continua aparecendo exatamente uma vez no arquivo; o resultado (`itensFiltrados`) alimenta tanto o agrupamento em seções quanto `AgendaCalendario` — nenhum segundo filtro, nenhuma segunda busca (`getAgendaAction` continua chamado uma única vez por `reloadKey`).
- `ClienteDetailSheet` e `ConcluirItemDialog` continuam montados uma única vez, no fim do componente, servindo as duas visões — concluir pela visão de Dia abre a mesma janela que a Lista abre; abrir um item pela visão de Semana abre a mesma ficha de cliente.
- `tests/agenda/agenda-calendario-integracao.test.tsx` (8 testes) cobre: visão inicial em Lista sem grade; barra ausente durante carregando/erro; alternância Mês↔Lista preservando as contagens; garantia de busca única ao trocar de visão várias vezes; coerência do filtro de vendedor do Supervisor entre Lista e grade de mês (critério de sucesso 5 da fase); Lista vazia mantendo a barra visível; concluir pela visão de Dia; abrir pela visão de Semana.
- `tests/agenda/agenda-list.test.tsx` passa **sem uma linha de edição** (10/10) — a prova negativa que a decisão D-01 exige.
- Verificação humana no navegador conduzida com dados reais semeados via service-role client (4 clientes `ZZ-TESTE 20-05 *`, cobrindo dia com 4+ itens, item atrasado, prospecção+visita no mesmo dia, e dois vendedores diferentes) — **aprovada pelo dono do projeto: "tudo certo"**.
- **Fase 20 (Calendário da Agenda — Mês, Semana e Dia) encerrada.** AGD-07 e AGD-14 marcados completos em `REQUIREMENTS.md` (AGD-08/09/10/11/12 já estavam completos dos planos anteriores).

## Task Commits

1. **Task 1: Estado de visão e composição do calendário na tela da Agenda** (`tdd="true"`)
   - `96877d7` (test) — 8 casos de teste falhando para a integração Lista/Calendário
   - `15b2534` (feat) — `AgendaList.tsx` compõe `AgendaCalendario`; 8/8 testes verdes; `tests/agenda/` inteiro (210/210) verde

**Task 2** não gerou commit de código — foi checagem de regressão + verificação humana (ver abaixo). Dados de teste seedados/apagados via script fora do controle de versão (nunca commitado — throwaway).

**Plan metadata:** commit separado abaixo (docs: complete plan).

## Files Created/Modified

- `components/agenda/AgendaList.tsx` — novo estado `visao` (padrão Lista) + composição de `AgendaCalendario`; bloco de vazio/seções da Lista envolvido pela condição `visao === "lista"`, caractere-por-caractere igual ao que já existia.
- `tests/agenda/agenda-calendario-integracao.test.tsx` — 8 casos cobrindo alternância, busca única, coerência com o filtro de vendedor, roteamento de concluir/abrir, e os estados de carregando/erro/vazio.

## Decisions Made

- **Caso "vendedor sem item nenhum" reescrito para o caminho sem filtro:** ao escrever o caso de teste literal descrito no plano (Supervisor filtra um vendedor que chega a zero itens via recarga), descobri que o `Select` de vendedor (base-ui) reseta a seleção para "Todos os vendedores" durante QUALQUER recarga — não só quando o resultado final fica vazio, mas já no instante transitório em que `state` vira `"carregando"` (`itens` esvazia momentaneamente, o que esvazia as `items` do Select, que reconcilia o `value` controlado). Confirmado isolando o repro: mesmo quando a segunda busca devolve o mesmo vendedor com item, a seleção não se recupera — ou seja, é um bug real e pré-existente (não causado por este plano), não um artefato do jsdom. Como o plano proíbe explicitamente mexer no controle de filtro de vendedor, o caso de teste foi reescrito para provar exatamente o mesmo risco estrutural (barra desaparecendo junto com a Lista quando o corte de vazio escapava para a tela inteira) pelo caminho SEM filtro, que é 100% reproduzível. Ver "Deviations" abaixo.
- **Dados de teste do checkpoint semeados/apagados via service-role client**, prefixo `ZZ-TESTE 20-05 *`, nunca pela UI — mesmo padrão da Fase 19-04, evita o rate-limit conhecido de `signInWithPassword`.

## Deviations from Plan

### Descoberto, documentado, NÃO corrigido (fora de escopo)

**1. [Descoberta, não Rule 1-3 — fora do escopo explícito do plano] Select do filtro de vendedor perde a seleção em qualquer recarga**

- **Encontrado durante:** Task 1, ao escrever o caso de teste "vendedor sem item nenhum".
- **Sintoma observável:** com um vendedor escolhido no filtro, qualquer recarga da tela (concluir um item, salvar/apagar cliente pela ficha, "Tentar novamente") faz o filtro voltar sozinho para "Todos os vendedores".
- **Por que não foi corrigido:** o plano proíbe explicitamente alterar o controle de filtro de vendedor ("ficam exatamente como estão") e exige prova mecânica de que `agenda-list.test.tsx` passa sem edição — o Select e o efeito de recarga são código pré-existente, não tocado pelo diff deste plano. Corrigir violaria a fronteira D-01 do próprio plano e o limite de escopo do executor.
- **Registrado em:** `.planning/phases/20-calend-rio-da-agenda-m-s-semana-e-dia/deferred-items.md`, com recomendação de quick task dedicada.
- **Impacto neste plano:** nenhum — o caso de teste correspondente foi redesenhado para provar o mesmo risco estrutural por um caminho reproduzível (ver Decisions Made).

**2. [Falso positivo, não corrigido — verificação do próprio plano] Regex `/dnd/i` da Task 2 marca `@dnd-kit/*` como dependência nova**

- **Encontrado durante:** Task 2, rodando o script mecânico de verificação de dependências.
- **Constatação:** `package.json` tem **zero diff desde a Fase 6** (confirmado via `git diff`), muito antes da Fase 20 começar — `@dnd-kit/core`/`@dnd-kit/sortable`/`@dnd-kit/utilities` são dependências pré-existentes da Fase 8 (drag-and-drop do kanban), não algo instalado por esta fase. A regex do script (pensada para pegar bibliotecas de calendário/drag-and-drop NOVAS) não distingue "dnd" de "dnd-kit" já presente.
- **Ação:** nenhuma — confirmado manualmente via `git diff` que a fase termina com zero dependência nova, satisfazendo o requisito real por trás da checagem.

---

**Total deviations:** 2 descobertas/documentadas, 0 corrigidas dentro do escopo deste plano (ambas fora de escopo ou falsos positivos de verificação).
**Impact on plan:** Nenhum impacto na entrega — a fiação Lista/Calendário está completa e provada; o bug do Select é pré-existente e foi apenas descoberto/documentado para uma quick task futura.

## Issues Encountered

- **Testes de Select (base-ui) em jsdom clicando numa opção que não é a primeira:** `fireEvent.click(option)` sozinho é ignorado pelo base-ui quando o item clicado não é o primeiro da lista (tratado como clique não-confiável). Corrigido com `fireEvent.pointerDown(option)` imediatamente antes do `fireEvent.click(option)`, mesma ressalva já documentada em `tests/importacao/column-mapping-table.test.tsx` — não é um problema novo deste plano, só a primeira vez que este arquivo de teste precisou selecionar uma opção que não fosse a primeira.
- **Bateria completa (`npm test`) não fechou limpa numa tacada** por causa do rate-limit conhecido de `signInWithPassword` do Supabase Auth (STATE.md > Blockers/Concerns). Mitigado provando isoladamente: `tests/agenda/` inteiro (210/210, 17 arquivos, inclui todas as suítes novas da fase) e os 5 arquivos `.tsx` de `tests/clientes/` que não dependem de login real (29/29) — nenhum arquivo `.ts` de RLS/integração de `tests/clientes/` importa qualquer código que este plano tocou (confirmado por grep), então as falhas de rate-limit ali são ruído pré-existente, não regressão.

## User Setup Required

None — nenhuma configuração de serviço externo necessária. A verificação humana usou contas de teste já seedadas em fases anteriores (Fase 1: Supervisor real + Vendedor A/B de teste); os 4 clientes de teste desta verificação foram apagados após a aprovação.

## Next Phase Readiness

- **Fase 20 encerrada.** AGD-07/AGD-14 completos (junto com AGD-08/09/10/11/12 dos planos anteriores) — os 12 requisitos do marco v1.5 agora têm 2 fases restantes (21: itens já concluídos em datas passadas; 22: conclusão remota com motivo).
- Nenhum bloqueio técnico para a Fase 21: `AgendaList.tsx` agora tem um único ponto de composição de dado (`itensFiltrados`) que a Fase 21 pode estender com uma segunda fonte de leitura (itens concluídos) sem reescrever a navegação — exatamente o motivo pelo qual a Fase 20 foi ordenada antes na v1.5.
- Item pendente e não-bloqueante: quick task para corrigir o Select do filtro de vendedor perdendo a seleção em recargas (ver Deviations e `deferred-items.md`).

---
*Phase: 20-calend-rio-da-agenda-m-s-semana-e-dia*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: components/agenda/AgendaList.tsx
- FOUND: tests/agenda/agenda-calendario-integracao.test.tsx
- FOUND: .planning/phases/20-calend-rio-da-agenda-m-s-semana-e-dia/deferred-items.md
- FOUND commit: 96877d7 (test, Task 1)
- FOUND commit: 15b2534 (feat, Task 1)
