---
phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
plan: 07
subsystem: ui
tags: [agenda2, calendario, integracao, react, vitest, git-guard]

requires:
  - phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
    provides: "Agenda2ItemForm com onRecarregar e campo Repetir (plano 32-05)"
  - phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
    provides: "Agenda2Calendario - conteiner do calendario (plano 32-06)"
provides:
  - "components/agenda2/Agenda2List.tsx: tela da Agenda 2 com Lista (padrao) + Calendario Dia/Semana/Mes, mesmas acoes e mesmo filtro de vendedor nas duas visoes"
  - "tests/agenda2/agenda2-calendario-integracao.test.tsx: 7 casos de integracao Lista <-> Calendario"
  - "Prova por git de que a Agenda atual saiu da fase identica (criterio 5 do ROADMAP)"
affects: [fechamento da Fase 32, verificacao da fase, deploy staging -> master]

tech-stack:
  added: []
  patterns:
    - "Tela dona unica das escritas: calendario recebe handlers + reloadKey; qualquer acao em qualquer visao recarrega as duas"
    - "Barra do calendario sempre montada (caminho de volta); bloco da Lista so renderiza quando visao === lista"

key-files:
  created:
    - tests/agenda2/agenda2-calendario-integracao.test.tsx
  modified:
    - components/agenda2/Agenda2List.tsx
    - tests/agenda2/agenda2-list.test.tsx

key-decisions:
  - "Leitura da Lista (getAgenda2Action) continua rodando em qualquer visao: alimenta itensExistentes (aviso de duplicado) e as opcoes do filtro do Supervisor; nao otimizado de proposito"
  - "app/(app)/agenda-2/page.tsx nao muda"

patterns-established:
  - "Integracao testada com relogio falso so para Date (sexta 2026-08-14) e as sete acoes simuladas"

requirements-completed: [AGD2-02, AGD2-08]

coverage:
  - id: D1
    description: "Tela alterna Lista (padrao) <-> Dia/Semana/Mes pelo seletor sempre visivel; Mes le o periodo 2026-07-27..2026-09-06"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-integracao.test.tsx (alternar-visoes)"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx (sem-busca-e-extras + seletor de visao)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Concluido de dia passado escondido na Lista e riscado no calendario (D-28/D-29)"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-integracao.test.tsx (concluido-passado-so-no-calendario)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mesmo filtro Vendedor do Supervisor estreita Lista e Mes (D-30)"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-integracao.test.tsx (filtro-nas-duas-visoes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Concluir/editar/adicionar a partir do calendario usam as mesmas acoes e recarregam as duas visoes; formulario recebe onRecarregar"
    requirement: "AGD2-02"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-integracao.test.tsx (concluir-no-calendario-recarrega, editar-no-calendario-abre-formulario, adicionar-no-calendario)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Supervisor sem nenhum botao de escrita em nenhuma visao (D-16)"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-integracao.test.tsx (supervisor-somente-leitura-no-calendario)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Agenda atual (components/agenda, lib/agenda, validacoes, acoes, queries, rota, tests/agenda, migrations) intocada desde o inicio da Fase 32"
    requirement: "AGD2-08"
    verification:
      - kind: other
        ref: "guarda git deterministica (saida registrada abaixo) + 11 arquivos de teste da Agenda atual verdes"
        status: pass
    human_judgment: false
  - id: D7
    description: "Fluxo ponta a ponta no banco real / Preview da Vercel (riscado, navegacao, filtro, Agenda de sempre inalterada)"
    requirement: "AGD2-08"
    verification:
      - kind: manual
        ref: "human-check da Tarefa 2 do 32-07-PLAN.md, no Preview da branch staging"
        status: pending
    human_judgment: true

duration: 25min
completed: 2026-10-02
status: complete
---

# Phase 32 Plan 07: Integracao Lista + Calendario e verificacao final Summary

**Agenda2List agora mostra a Lista (padrao) e o calendario Dia/Semana/Mes pelo mesmo seletor, com as mesmas acoes e o mesmo filtro de vendedor nas duas visoes; a guarda git prova que a Agenda atual saiu da Fase 32 identica.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (Tarefa 1 TDD com RED/GREEN; Tarefa 2 so verificacao)
- **Files:** 1 criado (teste de integracao), 2 alterados (Agenda2List e seu teste)

## Accomplishments

- `Agenda2List` ganhou o estado `visao` (Lista por padrao) e monta `Agenda2Calendario` sempre, entre o banner de erro e o bloco da Lista; a barra com o seletor nunca some (e o caminho de volta). O bloco da Lista (esqueleto, erro, vazios e secoes Atrasado/Hoje/Proximos) so renderiza em `visao === "lista"`.
- O calendario recebe os mesmos quatro handlers da Lista, `reloadKey`, `vendedorFiltroId`, `showResponsavel`, `podeAlterar={!isSupervisor}` e `salvandoId`: concluir/desmarcar/editar/apagar pelo calendario recarregam Lista e calendario.
- `Agenda2ItemForm` passou a receber `onRecarregar={handleRecarregar}` (Pitfall 8), alem de `onSalvo`.
- Formulario e confirmacao de apagar continuam montados uma vez, so para o vendedor (D-16).
- `app/(app)/agenda-2/page.tsx` nao mudou; nada importado de `components/agenda/` nem de `app/actions/agenda`.

## Ciclo TDD

| Tarefa | RED | GREEN |
|--------|-----|-------|
| 1 - Agenda2List com Lista + Calendario | `0893e38` test(32-07) - 8 testes falhando (7 de integracao + sem-busca-e-extras ajustado) | `5f744ee` feat(32-07) - 25 testes verdes nos dois arquivos |

Nenhum REFACTOR necessario. A Tarefa 2 nao gera commit de codigo (so verificacao).

## Verificacao final da fase (Tarefa 2)

| Passo | Resultado |
|-------|-----------|
| `npx vitest run` - `tests/agenda2` inteiro + 11 arquivos da Agenda atual (calendario x7, agenda-list, agenda-item-row, itens, app-sidebar-agenda) + `tests/layout` | **35 arquivos, 479 testes, todos verdes** (inclui os testes com o banco real de `tests/agenda2`) |
| `npx tsc --noEmit` | codigo 0 |
| `npm run lint` | codigo 0 |
| `npm run build` | codigo 0 (rota `/agenda-2` presente) |
| Guarda git | OK (saida abaixo) |
| Arquivos de `tests/agenda` editados | nenhum |

### Guarda git - saida exata

```
BASE=1502a931cd71824ca9da90abce70720bc1171dd4
OK Agenda atual intocada
```

- Hash-base calculado pelo script (pai do commit mais antigo `tipo(32-0N)`): `1502a931cd71824ca9da90abce70720bc1171dd4`.
- Hash anotado no 32-01-SUMMARY (HEAD no inicio da execucao da Fase 32): `1502a931cd71824ca9da90abce70720bc1171dd4` - **bate**.
- Hash anotado no 32-02-SUMMARY (HEAD no inicio do plano 32-02, nao da fase): `62624e33daa5cb8030774996a6a205fb06c799db` - e o HEAD depois dos commits do 32-01, por isso e diferente; o ponto-base da fase e o do 32-01.
- `git diff --name-only <base> HEAD` e `git status --porcelain` vazios para: `components/agenda`, `lib/agenda`, `lib/validations/agenda.ts`, `app/actions/agenda.ts`, `lib/supabase/queries/agenda.ts`, `app/(app)/agenda`, `tests/agenda`, `supabase/migrations` (nenhuma migration nova).
- A unica modificacao no working tree e `.planning/config.json` (diferenca so de fim de linha, anterior a fase, nao tocada nem commitada).

## Notas para o dono (linguagem simples)

**(a) Repeticao e contador.** Cada repeticao de 12 semanas cria 12 visitas separadas, e as 12 aparecem em "Proximos dias" e no numero do menu. Isso e o comportamento ja decidido na Fase 31 (D-03/D-13) - cada visita e um item de verdade. Se isso incomodar, mudar exige uma decisao nova (por exemplo, mostrar so as proximas semanas no contador).

**(b) Redacao do requisito AGD2-08.** O requisito diz "reaproveitando o mesmo componente". Foi atendido como uma **copia** do calendario da Agenda de hoje, com o mesmo visual e comportamento (decisao D-27), para nao arriscar mexer na tela que o time usa todo dia. Sugestao: ajustar a redacao do requisito ao fechar o marco, para dizer "copia com o mesmo visual".

**(c) Privacidade (LGPD).** A repeticao cria uma agenda futura de deslocamento do vendedor, de ate 12 semanas, com nome do cliente + bairro. Nenhuma coluna nova foi criada (D-22), o padrao do campo e "Nao repetir", e o calendario le so o periodo visivel (menos dado no navegador). Mas o prazo de guarda de 1 ano decidido em 2026-10-01 continua **sem descarte automatico**: o dono deve avaliar quando isso vira prioridade.

## Deploy (instrucao)

Nada foi enviado para nenhum remoto. O envio vai primeiro para a branch `staging` (Preview da Vercel), e conferido ali (human-check abaixo), e so depois vai para `master` (CLAUDE.md, "Fluxo de Deploy"). Nao ha passo de banco pendente.

## Conferencia humana pendente (human-check da Tarefa 2)

No Preview da `staging` (ou `npm run dev`): como vendedor de teste, criar uma visita para hoje com "Por 4 semanas"; trocar a data para ontem e ver o campo Repetir voltar para "Nao repetir" e travar; alternar Mes/Semana; concluir uma das 4 ocorrencias pelo calendario; apagar outra; usar as setas e "Hoje". Como Supervisor, abrir "Agenda 2" em "Mes" e filtrar por um vendedor. Por fim abrir a "Agenda" de sempre e o calendario dela. Esperado: 4 visitas, uma por semana, no mesmo dia da semana; concluida riscada no calendario e na Lista; apagar uma nao mexe nas outras; semana comeca na segunda; Supervisor sem botoes de escrita; Agenda de sempre igual a antes e sem itens da Agenda 2.

## Deviations from Plan

None - plan executed exactly as written.

## Privacidade (LGPD)

Este plano nao cria campo, coluna, migration, endpoint nem exportacao. Apenas conecta a tela a leituras e acoes ja existentes; a visibilidade continua imposta pela RLS da 0048 (o filtro de vendedor e `podeAlterar` sao so reflexo visual/estreitamento local). Os dados exibidos (nome do cliente, bairro, e nome do vendedor so para o Supervisor) ja eram exibidos na Lista. Ver nota (c) acima sobre o prazo de guarda.

## Known Stubs

None.

## Threat Flags

None - nenhuma superficie nova. Mitigados: T-32-10 (guarda git + 11 testes da Agenda atual), T-32-15 (Supervisor sem botoes: caso `supervisor-somente-leitura-no-calendario`), T-32-09 (filtro como estreitamento local nas duas visoes), T-32-19 (pagina inalterada, calendario le so o periodo visivel, sem exportacao).

## Self-Check: PASSED

- FOUND: components/agenda2/Agenda2List.tsx, tests/agenda2/agenda2-calendario-integracao.test.tsx, tests/agenda2/agenda2-list.test.tsx
- FOUND commits: 0893e38, 5f744ee
