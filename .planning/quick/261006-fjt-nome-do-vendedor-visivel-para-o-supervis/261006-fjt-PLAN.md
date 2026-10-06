---
phase: quick-261006-fjt
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-261006-fjt]
files_modified:
  - components/agenda2/Agenda2CalendarioSemana.tsx
  - components/agenda2/Agenda2CalendarioMes.tsx
  - components/agenda2/Agenda2Calendario.tsx
  - tests/agenda2/agenda2-calendario-semana.test.tsx
  - tests/agenda2/agenda2-calendario-mes.test.tsx
  - tests/agenda2/agenda2-calendario.test.tsx
  - tests/agenda2/agenda2-item-row.test.tsx
  - tests/agenda2/agenda2-calendario-integracao.test.tsx

must_haves:
  truths:
    - "Supervisor sem filtro de vendedor, na visão Semana da Agenda (/agenda-2), vê em cada cartão de visita uma TERCEIRA linha discreta (texto pequeno e apagado) com o nome do vendedor dono, logo abaixo do nome do cliente (linha 1) e do bairro (linha 2), dentro do mesmo cartão clicável."
    - "Supervisor sem filtro de vendedor, na visão Mês, vê em cada chip o nome do cliente e, logo abaixo, uma SEGUNDA linha pequena e apagada com o nome do vendedor (cortada com reticências se não couber). O limite de 3 chips por célula + '+N mais', a célula inteira clicável e o rótulo acessível da célula ('<dia>, N visita(s)') continuam exatamente iguais."
    - "Na visão Dia, no diálogo do dia aberto pela Semana/Mês e na Lista, o Supervisor sem filtro continua vendo o nome do vendedor — isso JÁ existia em Agenda2ItemRow (showResponsavel && item.responsavelNome) e não muda de código; ganha teste para nome ausente."
    - "Vendedor NUNCA vê o nome extra em nenhuma das quatro visões (Lista, Dia, Semana, Mês). Com um vendedor escolhido no filtro, o Supervisor também não vê a linha extra (o nome já está no próprio filtro) — mesma regra showResponsavel = isSupervisor && vendedorFiltroId === null que a Lista e o Dia já usam."
    - "Visita com responsavelNome null, vazio ou só espaços não mostra linha vazia, não escreve 'null' e não quebra a tela — o cartão/chip fica igual ao de hoje."
    - "Nenhum dado novo é buscado (Agenda2Item.responsavelNome já vem na leitura existente), nenhuma migration/tabela/RLS/consulta/ação muda, a Agenda antiga não é tocada, nada é renomeado, nenhuma dependência nova; commits só locais (sem push)."
  artifacts:
    - path: components/agenda2/Agenda2CalendarioSemana.tsx
      provides: "Prop opcional showResponsavel (padrão false) e terceira linha data-slot='agenda2-responsavel' no WeekItemChip"
    - path: components/agenda2/Agenda2CalendarioMes.tsx
      provides: "Prop opcional showResponsavel (padrão false) repassada a MonthDayCell -> MonthItemChip; segunda linha data-slot='agenda2-responsavel' dentro de um span envoltório"
    - path: components/agenda2/Agenda2Calendario.tsx
      provides: "Repasse de showResponsavel também para Agenda2CalendarioSemana e Agenda2CalendarioMes (hoje só vai para o Dia)"
    - path: tests/agenda2/agenda2-calendario-semana.test.tsx
      provides: "Casos responsavel-supervisor / responsavel-vendedor / responsavel-ausente / responsavel-concluido"
    - path: tests/agenda2/agenda2-calendario-mes.test.tsx
      provides: "Casos responsavel-supervisor / responsavel-vendedor / responsavel-ausente / responsavel-mais-n-e-rotulo / responsavel-concluido"
    - path: tests/agenda2/agenda2-calendario.test.tsx
      provides: "Repasse de showResponsavel às grades Semana e Mês"
    - path: tests/agenda2/agenda2-item-row.test.tsx
      provides: "Nome null/vazio com showResponsavel true não cria parágrafo extra nem texto 'null'"
    - path: tests/agenda2/agenda2-calendario-integracao.test.tsx
      provides: "Fluxo real Agenda2List: Supervisor sem filtro vê nomes em Semana e Mês, com filtro some; Vendedor nunca vê"
  key_links:
    - from: "components/agenda2/Agenda2List.tsx (linha ~144, NÃO editar)"
      to: "components/agenda2/Agenda2Calendario.tsx"
      via: "prop showResponsavel = isSupervisor && vendedorFiltroId === null, já passada hoje ao Agenda2Calendario"
      pattern: "showResponsavel=\\{showResponsavel\\}"
    - from: "components/agenda2/Agenda2Calendario.tsx renderCorpo()"
      to: "Agenda2CalendarioSemana e Agenda2CalendarioMes"
      via: "O GAP atual: showResponsavel só é repassado ao Agenda2CalendarioDia; precisa ser repassado também nos ramos modo === 'mes' e modo === 'semana'"
      pattern: "<Agenda2Calendario(Mes|Semana)[\\s\\S]*showResponsavel"
    - from: "tests/agenda2/agenda2-calendario-mes.test.tsx (testes existentes chip-concluido-riscado e chip-atrasado)"
      to: "MonthItemChip"
      via: "Os testes atuais fazem screen.getByText(nome).closest('div') e esperam o CHIP (classes border-l-*). Por isso o envoltório novo das duas linhas TEM de ser um <span>, nunca uma <div> — senão closest('div') para no envoltório e os testes existentes quebram."
    - from: "Agenda2CalendarioSemana/Mes"
      to: "privacidade por padrão"
      via: "showResponsavel é OPCIONAL com padrão false: quem não passar a prop (ou passar false) nunca mostra o nome — ausência = escondido."
---

<objective>
Pedido do dono: na Agenda (tela /agenda-2, rotulada "Agenda"), o Supervisor precisa ver DE QUEM é cada visita também nas visões Semana e Mês, sem precisar escolher um vendedor no filtro.

Explicando sem jargão: hoje, na Semana, cada cartãozinho mostra só o nome do cliente e o bairro; no Mês, só o nome do cliente. Quem é Supervisor e olha "todos os vendedores" não sabe de quem é cada visita sem abrir o dia. Vamos acrescentar o nome do vendedor em letra pequena e apagada embaixo — só para o Supervisor. O Vendedor continua vendo exatamente o que vê hoje (ele só enxerga as próprias visitas mesmo).

O que existe e o que falta (verificado no código):
- Agenda2List.tsx já calcula `showResponsavel = isSupervisor && vendedorFiltroId === null` e já passa para o Agenda2Calendario.
- O Agenda2Calendario hoje só repassa essa informação para a visão Dia; Semana e Mês não recebem. Esse é o buraco.
- Dia, diálogo do dia e Lista usam Agenda2ItemRow, que JÁ mostra o nome do vendedor quando `showResponsavel` é verdadeiro (`showResponsavel && item.responsavelNome`). Por decisão do dono, Agenda2ItemRow NÃO muda — só ganha teste para o caso de nome ausente.
- `Agenda2Item.responsavelNome` já vem na leitura existente (lib/supabase/queries/agenda2.ts monta "Nome Sobrenome"). Nenhuma busca nova.

Escolha feita para o Mês (discricionária, documentada a pedido do dono): segunda linha DENTRO do chip, abaixo do nome do cliente, em `text-[11px] leading-tight text-muted-foreground`, cortada com reticências (`truncate`), com `title` mostrando o nome inteiro ao passar o mouse; só aparece quando `showResponsavel` é verdadeiro E há nome. Não muda o limite de 3 chips nem o "+N mais", nem a altura mínima da célula (`min-h-28`): para o Supervisor, uma célula cheia fica cerca de 3 linhas pequenas mais alta (a linha da grade cresce junto, como já acontece hoje quando a célula enche); para o Vendedor, nada muda visualmente. O rótulo acessível da célula fica igual (ele já não cita nomes de clientes; o detalhe completo, com o vendedor, está a um clique, no diálogo do dia).

Escolha sobre o filtro (discricionária, documentada): reaproveitar exatamente o `showResponsavel` que já existe. Com um vendedor escolhido no filtro, a linha extra some (o nome já está escrito no filtro e repetir em todo cartão seria ruído) — igual ao que Lista e Dia fazem hoje. Se o dono quiser o nome também com filtro ativo, é trocar UMA linha em Agenda2List.tsx (e isso valeria para todas as visões ao mesmo tempo) — fora deste plano.

**Alerta LGPD (instrução da organização):** o nome do vendedor é dado pessoal de um colaborador. Esta tarefa NÃO cria, busca, exporta nem guarda nenhum dado novo: o nome já chega à tela hoje (Lista, Dia e o próprio filtro "Vendedor" do Supervisor). A mudança só o exibe em mais duas visões, para o MESMO papel (Supervisor) que já o vê. Privacidade por padrão aplicada no código: a prop nova é opcional e começa desligada (sem ela, nada aparece); o Vendedor nunca vê; quem decide o que cada pessoa enxerga continua sendo a RLS do Supabase (sem alteração). O texto é renderizado como texto comum pelo React (sem HTML injetado). Recomenda-se que o dono avalie o escopo à luz da LGPD (finalidade: gestão do time de vendas), mas não há mudança de tratamento de dados pessoais.

Purpose: dar ao Supervisor visibilidade de quem vai visitar quem, direto na Semana e no Mês, sem cliques extras.

Output:
- 2 commits locais (Task 1 e Task 2; teste + código no mesmo commit). Task 3 só confere — commit apenas se precisar corrigir algo. Nada de push: publicar segue o fluxo staging → link de teste → master do CLAUDE.md, fora deste plano.
- SUMMARY em linguagem simples, com a escolha do Mês explicada e a saída GATES-OK.
</objective>

<execution_context>
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@components/agenda2/Agenda2CalendarioSemana.tsx
@components/agenda2/Agenda2CalendarioMes.tsx
@components/agenda2/Agenda2Calendario.tsx
@components/agenda2/Agenda2ItemRow.tsx
@tests/agenda2/agenda2-calendario-semana.test.tsx
@tests/agenda2/agenda2-calendario-mes.test.tsx

<interfaces>
Contratos já existentes (extraídos do código; o executor não precisa explorar):

lib/agenda2/itens.ts — tipo (NÃO editar):
  Agenda2Item = { id: string; nomeCliente: string; bairro: string; data: string /* YYYY-MM-DD */; concluido: boolean; atualizadoEm: string; responsavel: string | null; responsavelNome: string | null /* "Nome Sobrenome" */ }

components/agenda2/Agenda2List.tsx (NÃO editar):
  linha ~144: const showResponsavel = isSupervisor && vendedorFiltroId === null
  linha ~279: <Agenda2Calendario ... showResponsavel={showResponsavel} podeAlterar={!isSupervisor} ... />
  linha ~354: <Agenda2ItemRow ... showResponsavel={showResponsavel} ... /> (Lista)

components/agenda2/Agenda2Calendario.tsx — props atuais: visao, onVisaoChange, reloadKey, vendedorFiltroId, showResponsavel: boolean, podeAlterar, salvandoId, onEditar, onApagar, onConcluir, onDesmarcar, now?
  renderCorpo(): ramo "mes" monta <Agenda2CalendarioMes referencia porData onSelecionarDia={setDiaDialogo} now /> (SEM showResponsavel)
                 ramo "semana" monta <Agenda2CalendarioSemana referencia porData onSelecionarDia={setDiaDialogo} now /> (SEM showResponsavel)
                 ramo "dia" e diálogo do dia montam <Agenda2CalendarioDia ... showResponsavel={showResponsavel} ... /> (JÁ repassa)

components/agenda2/Agenda2CalendarioSemana.tsx — export function Agenda2CalendarioSemana({ referencia, porData, onSelecionarDia, now }); componente interno WeekItemChip({ item, atrasado, onAbrirDia }) = div role="button" flex-col com: linha 1 (ícone de concluído + span nome com line-through se concluído), linha 2 span "truncate text-xs text-muted-foreground" com item.bairro.

components/agenda2/Agenda2CalendarioMes.tsx — export function Agenda2CalendarioMes({ referencia, porData, onSelecionarDia, now }); internos MonthDayCell({ dia, noMesVisivel, ehHoje, ultimaColuna, itens, now, onSelecionar }) com aria-label "<EEEE, d 'de' MMMM>, N visita(s)" e MonthItemChip({ item, atrasado }) = div "flex items-center gap-1 rounded border-l-2 px-1.5 py-0.5 text-xs" + classes de estado, contendo ícone de concluído + span "min-w-0 flex-1 truncate" (+ line-through se concluído) com item.nomeCliente. MAX_ITENS_NA_CELULA = 3 (lib/agenda/itens.ts, NÃO editar).

components/agenda2/Agenda2ItemRow.tsx (NÃO editar): já renderiza {showResponsavel && item.responsavelNome ? <p className="truncate text-sm text-muted-foreground">{item.responsavelNome}</p> : null}

Precedente de marcador de teste no projeto: atributo data-slot (ex.: data-slot="agenda-pendente-dot" em AppSidebar.tsx).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Semana e Mês mostram o nome do vendedor (só com showResponsavel) + testes das duas grades</name>
  <files>components/agenda2/Agenda2CalendarioSemana.tsx, components/agenda2/Agenda2CalendarioMes.tsx, tests/agenda2/agenda2-calendario-semana.test.tsx, tests/agenda2/agenda2-calendario-mes.test.tsx</files>
  <behavior>
    Semana (tests/agenda2/agenda2-calendario-semana.test.tsx, acrescentar ao describe existente; helper renderSemana já aceita props parciais):
    - responsavel-supervisor: com showResponsavel true e item { nomeCliente "Mercado Bom", bairro "Jardins", responsavelNome "Ana Souza" }, getByText("Ana Souza") existe, tem data-slot="agenda2-responsavel", vem DEPOIS do bairro (compareDocumentPosition FOLLOWING) e está no MESMO chip (mesmo closest('[role="button"]') do nome do cliente).
    - responsavel-vendedor: sem passar showResponsavel (padrão) e com showResponsavel false explícito, queryByText("Ana Souza") é null e nenhum elemento [data-slot="agenda2-responsavel"] existe.
    - responsavel-ausente: showResponsavel true com três itens na semana (ids e datas diferentes) com responsavelNome null, "" e "   " — zero [data-slot="agenda2-responsavel"], queryByText("null") é null, e os três nomes de cliente e bairros continuam na tela.
    - responsavel-concluido: item concluído com showResponsavel true — o nome do cliente continua com line-through, a linha do vendedor NÃO tem line-through.
    Mês (tests/agenda2/agenda2-calendario-mes.test.tsx, acrescentar ao describe existente; helpers renderMes e celulaDoDia já existem):
    - responsavel-supervisor: com showResponsavel true e item { nomeCliente "Mercado Bom Preço", responsavelNome "Ana Souza" }, getByText("Ana Souza") existe, tem data-slot="agenda2-responsavel" e a classe truncate, vem depois do nome do cliente, e nome.closest("div") === vendedor.closest("div") (mesmo chip).
    - responsavel-vendedor: padrão e showResponsavel false → nenhum "Ana Souza" e nenhum [data-slot="agenda2-responsavel"].
    - responsavel-ausente: showResponsavel true com responsavelNome null, "" e "   " (três itens) → zero data-slot, nenhum texto "null", nomes de cliente presentes.
    - responsavel-mais-n-e-rotulo: showResponsavel true e 7 itens no dia 14 → "+4 mais" presente, exatamente 3 elementos [data-slot="agenda2-responsavel"], e o aria-label de celulaDoDia(container, "14 de agosto") termina em "7 visitas" e NÃO contém "Ana Souza".
    - responsavel-concluido: item concluído com showResponsavel true → screen.getByText(nomeCliente).closest("div") continua tendo border-l-emerald-600 (o envoltório novo é span) e a linha do vendedor não tem line-through.
    Os testes que já existem nos dois arquivos NÃO têm asserções alteradas e continuam passando.
  </behavior>
  <action>
RED primeiro: escrever os casos acima nos dois arquivos de teste (eles passam `showResponsavel` via o parâmetro de props parciais dos helpers já existentes), rodar e ver falhar. Só então mudar os componentes.

Agenda2CalendarioSemana.tsx (per decisão do dono: "Week view: third line, discreet muted small text"):
- Acrescentar à assinatura de Agenda2CalendarioSemana a prop OPCIONAL `showResponsavel?: boolean` com padrão `false` (privacidade por padrão: sem a prop, nada aparece) e repassá-la ao WeekItemChip (nova prop `showResponsavel: boolean`).
- No WeekItemChip, calcular `const nomeResponsavel = showResponsavel ? (item.responsavelNome ?? "").trim() : ""`. Depois do span do bairro, renderizar SOMENTE quando `nomeResponsavel` não for vazio um `<span>` com `data-slot="agenda2-responsavel"`, `title={nomeResponsavel}`, classes `truncate text-[11px] leading-tight text-muted-foreground`, texto = nomeResponsavel (sem prefixo como "Vendedor:"; mesmo formato do Agenda2ItemRow). Caso contrário, `null` (nenhum elemento vazio). Sem line-through nessa linha, mesmo com item concluído (D-29 risca só o nome do cliente).
- Não mudar mais nada: classes do chip, borda por estado, role="button", teclado, ícone de concluído, "—" do dia vazio, colunas.
- Atualizar o JSDoc do componente/chip: acrescentar que, para o Supervisor vendo todos (showResponsavel), o chip ganha uma 3ª linha discreta com o nome do vendedor (quick 261006-fjt); Vendedor nunca vê.

Agenda2CalendarioMes.tsx (per decisão do dono: "Month view: simplest legible form ... keep the +N mais behavior and cell height sane"):
- Acrescentar a prop OPCIONAL `showResponsavel?: boolean` (padrão `false`) em Agenda2CalendarioMes, repassar a MonthDayCell (nova prop `showResponsavel: boolean`) e daí a cada MonthItemChip (nova prop `showResponsavel: boolean`).
- No MonthItemChip, manter a `div` externa do chip com EXATAMENTE as mesmas classes de hoje (layout em linha, borda lateral por estado). Trocar só o miolo: o ícone de concluído continua igual; o span do nome passa a ficar dentro de um ENVOLTÓRIO `<span className="flex min-w-0 flex-1 flex-col">` — TEM de ser span, não div, porque os testes existentes fazem `getByText(nome).closest("div")` e esperam o chip. Dentro do envoltório: (a) o span do nome do cliente com `truncate` e `line-through` quando concluído (o `min-w-0 flex-1` sai do nome e vai para o envoltório); (b) SOMENTE quando `nomeResponsavel` (mesmo cálculo com trim da Semana) não for vazio, um `<span>` com `data-slot="agenda2-responsavel"`, `title={nomeResponsavel}`, classes `truncate text-[11px] leading-tight text-muted-foreground`, sem line-through.
- NÃO mudar: MonthDayCell (exceto receber e repassar a prop), o aria-label da célula (continua "<dia>, N visita(s)" — escolha documentada no objective), `dividirCelulaAgenda2`, `MAX_ITENS_NA_CELULA`, o "+N mais", `min-h-28`, a célula como único alvo de clique.
- Atualizar o JSDoc do MonthItemChip/componente descrevendo a 2ª linha opcional e o motivo do envoltório ser span.

Restrições: nenhum import novo além do que já existe (nada de ícone novo), nenhuma dependência nova, nenhum `any`. Não tocar Agenda2ItemRow, Agenda2CalendarioDia, Agenda2List, lib/, app/, supabase/, nem nada da Agenda antiga.

Commit local (git add só dos 4 arquivos desta task — NUNCA `git add -A`/`.`; `.planning/config.json` tem modificação local pré-existente que não é desta tarefa): `feat(quick-261006-fjt): Semana e Mes mostram o nome do vendedor para o Supervisor`.
  </action>
  <verify>
    <automated>cd "C:/Users/Cristiano Stephano/workspace/crm-raiar" && npx vitest run tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario-mes.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 components/agenda2/Agenda2CalendarioSemana.tsx components/agenda2/Agenda2CalendarioMes.tsx tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario-mes.test.tsx && test "$(grep -c 'data-slot="agenda2-responsavel"' components/agenda2/Agenda2CalendarioSemana.tsx)" -ge 1 && test "$(grep -c 'data-slot="agenda2-responsavel"' components/agenda2/Agenda2CalendarioMes.tsx)" -ge 1</automated>
  </verify>
  <done>Os dois arquivos de teste passam (casos novos + todos os antigos sem asserção alterada); Semana mostra a 3ª linha e Mês a 2ª linha com o nome do vendedor só com showResponsavel true e nome não vazio; padrão (sem prop) não mostra nada; aria-label da célula do Mês e "+N mais" inalterados; tsc e eslint limpos; commit local da task feito.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Calendário repassa showResponsavel às grades + cobertura de Dia/Lista e integração Supervisor x Vendedor</name>
  <files>components/agenda2/Agenda2Calendario.tsx, tests/agenda2/agenda2-calendario.test.tsx, tests/agenda2/agenda2-item-row.test.tsx, tests/agenda2/agenda2-calendario-integracao.test.tsx</files>
  <behavior>
    tests/agenda2/agenda2-calendario.test.tsx — dentro do describe "Agenda2Calendario — diálogo do dia e ações do dono" (o beforeEach já resolve o período com item12 = "Cliente do dia 12", 2026-08-12, responsavelNome "Ana Souza"):
    - responsavel-nas-grades-semana: visao "semana", showResponsavel true → após findByText("Cliente do dia 12"), getByText("Ana Souza") existe (sem abrir diálogo).
    - responsavel-nas-grades-mes: visao "mes", showResponsavel true → idem.
    - responsavel-nas-grades-desligado: visao "semana" e (em outro it ou após unmount) visao "mes" com showResponsavel false → nenhum "Ana Souza" e nenhum [data-slot="agenda2-responsavel"].
    tests/agenda2/agenda2-item-row.test.tsx (Agenda2ItemRow NÃO muda — confirmação de cobertura que faltava):
    - responsavel-ausente: renderizar uma vez com showResponsavel false e responsavelNome "Ana Souza" e contar os <p> do cartão; desmontar; renderizar com showResponsavel true e responsavelNome null → mesma quantidade de <p>, queryByText("null") é null; repetir com responsavelNome "" → mesma quantidade.
    tests/agenda2/agenda2-calendario-integracao.test.tsx (fluxo real Agenda2List, mesmos mocks e relógio falso já configurados no arquivo):
    - nome-do-vendedor-nas-grades-supervisor: itens "Cliente da Ana" (v-ana, "Ana Souza") e "Cliente do Bruno" (v-bruno, "Bruno Lima"), data 2026-08-14; renderList({ isSupervisor: true }); aguardar "Hoje (2)"; clicar "Semana" → aguardar "Cliente da Ana"; os elementos [data-slot="agenda2-responsavel"] do document são 2 e seus textos (ordenados) são ["Ana Souza", "Bruno Lima"]; clicar "Mês" → aguardar o cliente de novo; de novo 2 elementos com esses textos; escolher "Bruno Lima" no combobox "Vendedor" (mesmo padrão pointerDown+click do teste filtro-nas-duas-visoes) → "Cliente do Bruno" visível e ZERO elementos [data-slot="agenda2-responsavel"] (contar pelo data-slot, porque o próprio filtro exibe "Bruno Lima").
    - nome-do-vendedor-nunca-para-vendedor: itens com responsavelNome "Vendedor Um"; renderList() (isSupervisor false); aguardar "Hoje (1)"; clicar "Semana" → aguardar o cliente; zero [data-slot="agenda2-responsavel"] e queryByText("Vendedor Um") null; clicar "Mês" → aguardar o cliente; idem.
    Todos os testes já existentes nos três arquivos continuam passando sem asserção alterada (ex.: "supervisor-somente-leitura" usa within(dialogo), então o nome a mais no chip do Mês não colide).
  </behavior>
  <action>
RED primeiro: escrever os casos acima e ver os de agenda2-calendario.test.tsx e os de integração do Supervisor falharem (as grades ainda não recebem a prop). O caso novo de agenda2-item-row deve passar já de primeira — é cobertura de comportamento existente (decisão do dono: "Day view and List: Agenda2ItemRow — first CHECK whether it already shows the responsible ... if it does, do not change it (just add/confirm test coverage if missing)"; verificado: já mostra, com guarda `showResponsavel && item.responsavelNome`).

Agenda2Calendario.tsx (o único arquivo de componente desta task):
- Em renderCorpo(), acrescentar `showResponsavel={showResponsavel}` ao `<Agenda2CalendarioMes ... />` e ao `<Agenda2CalendarioSemana ... />`. O repasse ao Agenda2CalendarioDia (visão Dia e diálogo) já existe e fica como está.
- Não mudar a leitura do período, o filtro local `filtrarPorVendedor`, o diálogo, nem as props do componente (showResponsavel já é prop dele).
- Acrescentar ao bloco "O que MUDOU" do JSDoc uma linha: showResponsavel (Supervisor vendo todos, calculado em Agenda2List) também vai para Semana e Mês, que mostram o nome do vendedor no chip (quick 261006-fjt); é reflexo visual, a fronteira continua sendo a RLS.

NÃO editar Agenda2List.tsx (a regra `isSupervisor && vendedorFiltroId === null` já está certa e é a mesma da Lista/Dia), Agenda2ItemRow.tsx nem Agenda2CalendarioDia.tsx.

Commit local (git add só dos 4 arquivos desta task): `feat(quick-261006-fjt): calendario repassa o nome do vendedor as visoes Semana e Mes`.
  </action>
  <verify>
    <automated>cd "C:/Users/Cristiano Stephano/workspace/crm-raiar" && npx vitest run tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx tests/agenda2/agenda2-calendario-dia.test.tsx tests/agenda2/agenda2-list.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 components/agenda2/Agenda2Calendario.tsx tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx && test "$(grep -c 'showResponsavel={showResponsavel}' components/agenda2/Agenda2Calendario.tsx)" -eq 4</automated>
  </verify>
  <done>Agenda2Calendario repassa showResponsavel a Mês, Semana, Dia e diálogo (4 ocorrências); Supervisor sem filtro vê os nomes nas grades, com filtro não vê, Vendedor nunca vê — provado no fluxo real do Agenda2List; nome null/vazio no Agenda2ItemRow não cria parágrafo extra; testes de Dia e Lista seguem verdes; tsc e eslint limpos; commit local da task feito.</done>
</task>

<task type="auto">
  <name>Task 3: Portões finais (testes da Agenda, tipos, lint, build e Agenda antiga intocada)</name>
  <files>(nenhum arquivo novo; só conferência — se algum portão falhar, corrigir nos arquivos das Tasks 1/2)</files>
  <action>
Rodar, nesta ordem, e colar a saída final (GATES-OK) no SUMMARY:
1. Testes de componente/lógica da Agenda nova que tocam estas telas: semana, mês, dia, item-row, calendário, integração, lista, toolbar e itens.test.ts. (Não rodar rls-*/migracao-* — exigem banco local e não são afetados.)
2. `npx tsc --noEmit` e eslint com `--max-warnings 0` nos 8 arquivos de files_modified.
3. `npm run build`. Se falhar só por variável de ambiente ausente ou por um servidor de desenvolvimento segurando a pasta .next, registrar no SUMMARY em vez de contornar.
4. Portão do dono "Agenda antiga, banco e dados intocados": `git diff --name-only dcf5420` (dcf5420 = HEAD no momento do planejamento; compara commit com árvore de trabalho, cobrindo commitado e não commitado) NÃO pode listar nada em app/(app)/agenda/, components/agenda/, lib/agenda/, lib/supabase/queries/agenda.ts, app/actions/agenda.ts nem supabase/.
5. Portão de escopo: os arquivos de código alterados desde dcf5420 em components/, lib/, app/ e supabase/ são EXATAMENTE os três componentes desta tarefa (Agenda2Calendario.tsx, Agenda2CalendarioMes.tsx, Agenda2CalendarioSemana.tsx) — prova que Agenda2List, Agenda2ItemRow, Agenda2CalendarioDia, lib/agenda2, consultas e ações não mudaram; e package.json/package-lock.json não mudaram (nenhuma dependência nova).
6. `git log --oneline dcf5420..HEAD` mostra os commits da tarefa e `git status` NÃO mostra nada enviado — não fazer push.

Se algo falhar, corrigir no arquivo da task responsável, rodar de novo e commitar a correção como `fix(quick-261006-fjt): ...` (git add só dos arquivos corrigidos). Sem falhas, esta task não gera commit.
  </action>
  <verify>
    <automated>cd "C:/Users/Cristiano Stephano/workspace/crm-raiar" && npx vitest run tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario-mes.test.tsx tests/agenda2/agenda2-calendario-dia.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx tests/agenda2/agenda2-list.test.tsx tests/agenda2/agenda2-calendario-toolbar.test.tsx tests/agenda2/itens.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 components/agenda2/Agenda2CalendarioSemana.tsx components/agenda2/Agenda2CalendarioMes.tsx components/agenda2/Agenda2Calendario.tsx tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario-mes.test.tsx tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx && npm run build && test -z "$(git diff --name-only dcf5420 | grep -E '^(app/\(app\)/agenda/|components/agenda/|lib/agenda/|lib/supabase/queries/agenda\.ts$|app/actions/agenda\.ts$|supabase/)')" && test "$(git diff --name-only dcf5420 -- components lib app supabase | LC_ALL=C sort | tr '\n' ' ')" = "components/agenda2/Agenda2Calendario.tsx components/agenda2/Agenda2CalendarioMes.tsx components/agenda2/Agenda2CalendarioSemana.tsx " && test -z "$(git diff --name-only dcf5420 -- package.json package-lock.json)" && echo GATES-OK</automated>
    <human-check>Depois que o dono autorizar a publicação (fora deste plano, via staging → link de teste → master): entrar como Supervisor no link de teste, abrir Agenda → Semana e Mês com "Todos os vendedores" e conferir o nome do vendedor embaixo de cada visita; escolher um vendedor no filtro e ver a linha sumir; entrar como Vendedor e confirmar que nenhuma linha extra aparece.</human-check>
  </verify>
  <done>Saída GATES-OK: 9 arquivos de teste verdes, tsc/eslint limpos, build concluído (ou falha só de ambiente registrada), git diff vazio para a Agenda antiga e supabase/ contra dcf5420, só os 3 componentes de agenda2 alterados em código, nenhuma dependência nova, nada enviado ao GitHub.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Supabase (RLS da migration 0048) → navegador | Quais visitas cada pessoa recebe (e com elas o responsavelNome) é decidido pela RLS; esta tarefa não muda a leitura nem a RLS. |
| Props do componente → DOM | showResponsavel decide só se um texto já recebido é desenhado; é reflexo visual, não fronteira de segurança. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261006-fjt-01 | Information Disclosure | WeekItemChip / MonthItemChip | low | mitigate | Prop showResponsavel opcional com padrão false (privacidade por padrão); valor vem de Agenda2List (isSupervisor && vendedorFiltroId === null), sem alteração; testes de unidade e de integração provam que Vendedor nunca vê a linha extra. O Vendedor, de qualquer forma, só recebe as próprias visitas pela RLS. |
| T-261006-fjt-02 | Tampering (XSS) | Texto do nome do vendedor no chip | low | mitigate | Nome renderizado como filho de texto do React (escapado) e em atributo title; proibido usar HTML injetado. |
| T-261006-fjt-03 | Elevation of Privilege | Agenda2Calendario / grades | low | accept | Nenhuma ação de escrita nova, nenhuma Server Action, consulta ou policy alterada; podeAlterar e a RLS da 0048 seguem como estão (portão de escopo da Task 3 prova que só 3 componentes apresentacionais mudaram). |
| T-261006-fjt-04 | Denial of Service (UI) | Chip com responsavelNome null/vazio | low | mitigate | Guarda com trim antes de renderizar; testes de null, "" e só espaços nas duas grades e no Agenda2ItemRow. |
</threat_model>

<verification>
- Task 1: casos novos de Semana e Mês verdes; testes antigos dos dois arquivos verdes sem alteração de asserção.
- Task 2: repasse em 4 lugares no Agenda2Calendario; integração Supervisor (com e sem filtro) e Vendedor verdes; cobertura de nome ausente no Agenda2ItemRow.
- Task 3: GATES-OK (testes, tsc, eslint --max-warnings 0, build, Agenda antiga/supabase intocados contra dcf5420, só 3 componentes alterados, sem dependência nova, sem push).
</verification>

<success_criteria>
- Supervisor com "Todos os vendedores" vê o nome do vendedor dono em cada visita nas quatro visões: Semana (3ª linha), Mês (2ª linha no chip), Dia e Lista (já existiam).
- Vendedor nunca vê essa linha; com filtro de vendedor ativo, a linha também não aparece para o Supervisor (mesma regra que Lista/Dia já usam).
- Nome ausente não gera linha vazia, "null" nem erro.
- "+N mais", limite de 3 chips, célula clicável e rótulo acessível do Mês inalterados.
- Nenhuma mudança em banco, RLS, consultas, ações, Agenda antiga ou dependências; 2 commits locais (mais eventuais fix), sem push.
</success_criteria>

<output>
Criar `.planning/quick/261006-fjt-nome-do-vendedor-visivel-para-o-supervis/261006-fjt-SUMMARY.md` ao terminar, em linguagem simples para o dono: o que mudou em cada visão, a escolha feita para o Mês (2ª linha pequena e cortada com reticências, rótulo acessível mantido), o comportamento com filtro ativo (linha some; mudar isso é uma linha em Agenda2List e vale para todas as visões), o alerta LGPD, a saída GATES-OK e o lembrete de que publicar segue staging → link de teste → master.
</output>
