---
phase: 18-cnpj-obrigat-rio-no-ganho
plan: 02
subsystem: ui
tags: [react, nextjs, server-actions, react-hook-form, forms]

# Dependency graph
requires:
  - phase: 18-cnpj-obrigat-rio-no-ganho (plano 01)
    provides: "mover_card_funil com 7o parametro p_cnpj e guard de transicao para ganho, aplicada em producao (migration 0018)"
provides:
  - "GanhoFrequenciaDialog com campo CNPJ (props cnpjAtual/exigirCnpj, onConfirm(frequencia, cnpj))"
  - "marcarStatus repassando p_cnpj ao RPC, com pre-checagem cnpj_obrigatorio espelhando o CNPJ efetivo do banco"
  - "ClienteDetailSheet fiado ao dialogo com a condicao de transicao correta e sincronizacao pos-ganho do CNPJ no formulario"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "exigirCnpj = statusAcompanhamento !== 'ganho' — mesma condicao de TRANSICAO usada nas tres camadas (tela, Server Action, RPC), nunca o estado em si (grandfathering, CNPJ-02)"
    - "CNPJ efetivo (parametro OU coluna ja gravada, ambos aparados) calculado tambem na pre-checagem da Server Action — espelha o coalesce/nullif/btrim do guard do RPC (18-01) para nunca bloquear no frontend o que o banco aceitaria"
    - "sincronizacao pos-mutacao: setCliente(estado local) + form.setValue(campo do react-hook-form) no mesmo bloco de sucesso, para um formulario que so e populado quando a gaveta abre nao divergir do estado apos uma mudanca de status feita por fora do formulario"

key-files:
  created: []
  modified:
    - components/clientes/GanhoFrequenciaDialog.tsx
    - app/actions/funil.ts
    - components/clientes/ClienteDetailSheet.tsx
    - tests/clientes/ganho-frequencia-dialog.test.tsx

key-decisions:
  - "Pre-checagem de CNPJ em marcarStatus usa o CNPJ EFETIVO (parametro OU cliente.cnpj ja gravado, opcao (i) do plano) em vez de so olhar o parametro — evita bloquear no servidor uma chamada que o RPC aceitaria para um cliente que ja tem CNPJ na ficha e nao reenviou o valor"
  - "Testes de Select (base-ui) em jsdom: só o primeiro item da lista (Semanal) demonstrou clique confiável via fireEvent nesta suíte — os 3 casos novos que dependem de frequência selecionada usam esse item; documentado aqui para não ser 'consertado' por engano depois pensando que outro item deveria funcionar igual"

patterns-established: []

requirements-completed: [CNPJ-01, CNPJ-02]

coverage:
  - id: D1
    description: "GanhoFrequenciaDialog exige CNPJ (campo + botao desabilitado) apenas quando exigirCnpj e verdadeiro; o valor e aparado antes de decidir se esta preenchido e antes de ser repassado a onConfirm"
    requirement: CNPJ-01
    verification:
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx#cnpjvazio"
        status: pass
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx#cnpjrepassa"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cliente com cnpjAtual ja preenchido abre o dialogo com o campo preenchido, sem texto de apoio de pendencia"
    requirement: CNPJ-01
    verification:
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx#cnpjpreenchido"
        status: pass
    human_judgment: false
  - id: D3
    description: "Com exigirCnpj falso (cliente ja ganho), a tela nunca cobra CNPJ — confirmar habilita so com frequencia e chama onConfirm mesmo com CNPJ vazio"
    requirement: CNPJ-02
    verification:
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx#cnpjdispensado"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhuma validacao de formato/digito verificador de CNPJ existe no dialogo — um CNPJ obviamente invalido e aceito normalmente"
    verification:
      - kind: unit
        ref: "tests/clientes/ganho-frequencia-dialog.test.tsx#cnpjformato"
        status: pass
    human_judgment: false
  - id: D5
    description: "marcarStatus le status_acompanhamento (nao so etapa), pre-checa o CNPJ efetivo apenas na transicao para ganho, e envia p_cnpj ao RPC na mesma chamada de p_frequencia_visita"
    requirement: CNPJ-01
    verification:
      - kind: other
        ref: "check estrutural do executor: cnpj_obrigatorio, p_cnpj, status_acompanhamento, trim, p_frequencia_visita presentes em app/actions/funil.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "ClienteDetailSheet deriva exigirCnpj do statusAcompanhamento atual (condicao de transicao) e sincroniza o CNPJ informado no ganho de volta no form via form.setValue, sem aumentar a contagem de eslint-disable nem adicionar aviso de CNPJ pendente"
    requirement: CNPJ-02
    verification:
      - kind: other
        ref: "check estrutural do executor: regex exigirCnpj=.*statusAcompanhamento, setValue('cnpj', ...), contagem de eslint-disable nao aumentou, ausencia de texto de cobranca"
        status: pass
    human_judgment: false
  - id: D7
    description: "Fluxo completo de ponta a ponta no navegador: exigir CNPJ na transicao, dispensar CNPJ de cliente ja ganho, e o CNPJ sobrevive a um 'Salvar alteracoes' subsequente"
    requirement: CNPJ-01
    verification:
      - kind: manual_procedural
        ref: "Task 3 (checkpoint:human-verify) — roteiro de 7 passos no navegador"
        status: pass
    human_judgment: true
    rationale: "Comportamento visual/interativo (janela abrindo, botao habilitando, dado sobrevivendo a um salvamento subsequente, ausencia de aviso em cliente legado) so pode ser confirmado por um humano clicando na aplicacao real — nenhum teste automatizado substitui isso."

# Metrics
duration: ~20min de execucao (Tasks 1-2) + verificacao humana no navegador (Task 3, aprovada pelo dono do projeto)
completed: 2026-08-11
status: complete
---

# Phase 18 Plan 2: CNPJ Obrigatório no Ganho (camada de aplicação) Summary

**Diálogo de ganho (`GanhoFrequenciaDialog`) ganha campo CNPJ ao lado da frequência de visita, `marcarStatus` repassa `p_cnpj` na mesma chamada de RPC, e `ClienteDetailSheet` sincroniza o CNPJ recém-informado de volta no formulário para sobreviver a um "Salvar alterações" seguinte.**

## Performance

- **Duration:** ~20 min de execução automatizada (Tasks 1 e 2) + o tempo que o dono do projeto levou para rodar o roteiro de 7 passos no navegador (Task 3, checkpoint humano)
- **Tasks:** 3/3 (2 auto, 1 checkpoint humano)
- **Files modified:** 4 (`GanhoFrequenciaDialog.tsx`, `app/actions/funil.ts`, `ClienteDetailSheet.tsx`, `tests/clientes/ganho-frequencia-dialog.test.tsx`)

## Accomplishments

- `GanhoFrequenciaDialog` ganhou as props `cnpjAtual`/`exigirCnpj` e um campo CNPJ (`id="ganho-cnpj-input"`) ao lado da frequência de visita; "Confirmar ganho" só habilita com os dois preenchidos quando `exigirCnpj` é verdadeiro, e o valor é aparado antes de ser repassado a `onConfirm(frequencia, cnpj)` — nenhuma máscara, `pattern`, `maxLength` ou dígito verificador foi adicionado (CNPJ-01, decisão travada de escopo).
- `marcarStatus` (`app/actions/funil.ts`) passou a ler `status_acompanhamento` (além de `etapa`) para saber se a chamada é uma TRANSIÇÃO para ganho, calcula o CNPJ efetivo (parâmetro OU `clientes.cnpj` já gravado, ambos aparados) para a pré-checagem `cnpj_obrigatorio`, e envia `p_cnpj` ao RPC na mesma chamada de `p_frequencia_visita` — uma transação só, como o plano exigia.
- `ClienteDetailSheet` passa `cnpjAtual`/`exigirCnpj` (derivado do `statusAcompanhamento` atual — a mesma condição de transição do guard do banco) ao diálogo, e sincroniza o CNPJ informado no ganho tanto no estado local (`setCliente`) quanto no formulário (`form.setValue('cnpj', ...)`) — sem essa sincronização, um "Salvar alterações" logo depois do ganho apagaria o valor que acabou de ser exigido (T-18-11).
- 5 casos novos de teste (`cnpjvazio`, `cnpjpreenchido`, `cnpjdispensado`, `cnpjrepassa`, `cnpjformato`) somados aos 5 já existentes — 10/10 verdes.
- Checkpoint humano (Task 3) aprovado pelo dono do projeto: os sete passos do roteiro no navegador se comportaram como esperado, incluindo os dois pontos mais sensíveis — o CNPJ sobrevive a um "Salvar alterações" seguinte, e um cliente já ganho sem CNPJ continua intocado (sem aviso, sem bloqueio).

## Task Commits

1. **Task 1: Campo CNPJ no diálogo de ganho + `marcarStatus` repassando `p_cnpj`** — `2863c96` (feat)
2. **Task 2: Fiação na ficha do cliente e sincronização do CNPJ após o ganho** — `d04f19e` (feat)
3. **Task 3: Verificação humana no navegador — os quatro critérios da fase** — checkpoint humano, sem commit próprio; aprovado pelo dono do projeto via roteiro de 7 passos.

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified

- `components/clientes/GanhoFrequenciaDialog.tsx` — campo CNPJ, props `cnpjAtual`/`exigirCnpj`, `onConfirm(frequencia, cnpj)`.
- `app/actions/funil.ts` — `marcarStatus` com quinto parâmetro `cnpj`, código de erro `cnpj_obrigatorio`, leitura de `status_acompanhamento`/`cnpj`, envio de `p_cnpj` ao RPC.
- `components/clientes/ClienteDetailSheet.tsx` — fiação do diálogo (`cnpjAtual`/`exigirCnpj`) e sincronização pós-ganho (`setCliente` + `form.setValue`).
- `tests/clientes/ganho-frequencia-dialog.test.tsx` — 5 casos novos de CNPJ, 5 antigos preservados.

## Decisions Made

- **Pré-checagem de `marcarStatus` usa o CNPJ efetivo (parâmetro OU coluna já gravada)** — opção (i) do plano, escolhida em vez de simplesmente não pré-checar. Evita bloquear no servidor uma chamada que o RPC aceitaria (cliente que já tem CNPJ na ficha e não reenviou o valor no diálogo).
- **Testes de `Select` em jsdom (base-ui) só clicaram de forma confiável no primeiro item da lista ("Semanal")** — os 3 casos novos que dependem de frequência escolhida (`cnpjdispensado`, `cnpjrepassa`, `cnpjformato`) usam esse item. Tentativas com "Mensal"/"Quinzenal" deixaram o botão preso em `disabled` mesmo após o clique no item (suspeita de limitação de posicionamento/pointer-capture do base-ui em jsdom, não um bug do componente) — comportamento confirmado manualmente pelo dono do projeto no navegador real (Task 3), onde os quatro itens funcionam normalmente.

## Deviations from Plan

### Auto-fixed Issues

None — nenhum bug ou lacuna encontrada além do já previsto pelo próprio plano. O plano antecipou corretamente a possibilidade de o `Select` não ser diretamente acionável em jsdom e deu a instrução de adaptação; nenhuma correção de comportamento de produção foi necessária.

---

**Total deviations:** 0
**Impact on plan:** Nenhum. Plano executado exatamente como escrito; o único ajuste foi na estratégia de interação dos testes de `Select` em jsdom, já antecipado como alternativa aceitável pelo próprio plano.

## Issues Encountered

- **`Select` (base-ui) em jsdom só aceita clique confiável no primeiro item da lista.** Ao escrever os casos `cnpjdispensado`/`cnpjrepassa`/`cnpjformato`, selecionar "Mensal" ou "Quinzenal" via `fireEvent.click` no `option` não atualizava o estado (botão continuava desabilitado), enquanto "Semanal" funcionava de forma consistente. Resolvido usando "Semanal" nos três casos — nenhuma asserção de botão desabilitado foi enfraquecida para contornar o problema, conforme a restrição explícita do plano. Comportamento real no navegador (todos os 4 itens) foi confirmado funcionando normalmente no checkpoint humano (Task 3).
- **Servidor de desenvolvimento (`npm run dev`) iniciado pelo executor antes do checkpoint humano**, respondendo em `http://localhost:3000`, para que o dono do projeto só precisasse visitar a URL e clicar — nenhum comando de terminal foi pedido a ele.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Fase 18 (CNPJ Obrigatório no Ganho) está completa: banco (18-01, em produção) e aplicação (18-02) entregam CNPJ-01 e CNPJ-02 de ponta a ponta, confirmados por teste automatizado e por verificação humana no navegador.
- Nenhum bloqueio técnico para a próxima fase.

---
*Phase: 18-cnpj-obrigat-rio-no-ganho*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `components/clientes/GanhoFrequenciaDialog.tsx`
- FOUND: `app/actions/funil.ts`
- FOUND: `components/clientes/ClienteDetailSheet.tsx`
- FOUND: `tests/clientes/ganho-frequencia-dialog.test.tsx`
- FOUND: `.planning/phases/18-cnpj-obrigat-rio-no-ganho/18-02-SUMMARY.md`
- FOUND: commit `2863c96` (Task 1)
- FOUND: commit `d04f19e` (Task 2)
