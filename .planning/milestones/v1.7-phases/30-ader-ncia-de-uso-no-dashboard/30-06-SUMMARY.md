---
phase: 30-ader-ncia-de-uso-no-dashboard
plan: 06
subsystem: ui
tags: [typescript, react, vitest, dashboard, tdd]

# Dependency graph
requires:
  - phase: 30-05
    provides: "lib/aderencia/exibicao.ts (rotuloAderencia/TEXTO_TOOLTIP_ADERENCIA/mesclarAderencia) e getComparativoVendedorAction() devolvendo ComparativoVendedorLinha[]"
provides:
  - "Coluna 'Aderência de uso' (ADER-01/03) como última coluna da tabela 'Comparativo por vendedor', visível só ao Supervisor"
  - "6 casos de tela novos cobrindo cabeçalho, percentual, aviso de coleta (D-09), aderência nula, descrição e intactidade das colunas antigas"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Célula de métrica derivada só chama a função de exibição pura (rotuloAderencia) — nenhum cálculo de data/percentual/decisão de estado no componente"

key-files:
  created: []
  modified:
    - components/dashboard/ComparativoVendedorTable.tsx
    - tests/dashboard/comparativo-vendedor-table.test.tsx

key-decisions:
  - "Nenhuma decisão fora do que o plano já travava — coluna renderizada exatamente como especificado, sem checagem de papel nova (D-08 continua garantido só por DashboardClient + RLS)"

patterns-established: []

requirements-completed: [ADER-01, ADER-03]

coverage:
  - id: D1
    description: "Coluna 'Aderência de uso' aparece como última coluna da tabela comparativa, com cabeçalho + tooltip (TEXTO_TOOLTIP_ADERENCIA) igual ao padrão do 'Ciclo médio'"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/comparativo-vendedor-table.test.tsx#coluna-aderencia-cabecalho"
        status: pass
    human_judgment: false
  - id: D2
    description: "Célula mostra percentual com 1 casa + 'N de M dias úteis' quando a aderência está completa"
    requirement: "ADER-03"
    verification:
      - kind: unit
        ref: "tests/dashboard/comparativo-vendedor-table.test.tsx#aderencia-percentual"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-09: quando coletandoDesde está preenchido, a célula mostra só 'Coletando dados desde DD/MM/AAAA', sem percentual"
    requirement: "ADER-03"
    verification:
      - kind: unit
        ref: "tests/dashboard/comparativo-vendedor-table.test.tsx#aderencia-coletando"
        status: pass
    human_judgment: false
  - id: D4
    description: "Aderência ausente (null) mostra travessão e a linha nunca some"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/comparativo-vendedor-table.test.tsx#aderencia-nula"
        status: pass
    human_judgment: false
  - id: D5
    description: "Descrição do cartão passa a mencionar 'últimos 28 dias'; D-12 respeitado — nenhum aviso de 'uso sendo medido' criado no sistema"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/comparativo-vendedor-table.test.tsx#descricao-menciona-28-dias"
        status: pass
    human_judgment: false
  - id: D6
    description: "As 5 colunas existentes, a ordem das linhas e os estados de loading/erro/vazio continuam exatamente como antes"
    requirement: "ADER-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/comparativo-vendedor-table.test.tsx#colunas-antigas-intactas e os 7 casos pré-existentes do arquivo"
        status: pass
    human_judgment: false
  - id: D7
    description: "Checagem visual no navegador (Supervisor vê a coluna por último; Vendedor não vê a tabela) — deferida por instrução explícita do dono para o teste conjunto do marco v1.7"
    verification: []
    human_judgment: true
    rationale: "Plano determina explicitamente que a checagem visual fica para o teste conjunto do marco v1.7, sem checkpoint humano neste plano — roteiro de verificação documentado abaixo em 'Checagem visual pendente'."

# Metrics
duration: ~15min
completed: 2026-09-27
status: complete
---

# Phase 30 Plan 6: Coluna "Aderência de uso" na tabela comparativa Summary

**Última coluna da tabela "Comparativo por vendedor" agora mostra, só para o Supervisor, o percentual de dias úteis usados nos últimos 28 dias (ou o aviso de coleta incompleta) — 13 casos de tela verdes, sem nenhuma mudança nas 5 colunas existentes.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `ComparativoVendedorTable.tsx` ganhou a 6ª e última coluna "Aderência de uso": cabeçalho com o mesmo padrão de tooltip do "Ciclo médio" (ícone `CircleHelp`, `aria-label` = `TEXTO_TOOLTIP_ADERENCIA`), e célula que só chama `rotuloAderencia(row.aderencia)` — nenhum cálculo de data, percentual ou decisão de "coletando" no componente.
- `CardDescription` passou a citar "os últimos 28 dias" (mantendo a frase original sobre o histórico completo), sem nenhum aviso de "o uso está sendo medido" (D-12 respeitado — decisão de comunicação ao time fica fora do código).
- `FetchState` agora guarda `ComparativoVendedorLinha[]` (tipo do plano 30-05); `DashboardClient.tsx` permanece intocado — a única fronteira de quem vê a tabela continua sendo `isSupervisor` lá + RLS no banco.
- `tests/dashboard/comparativo-vendedor-table.test.tsx` ganhou 6 casos novos (cabeçalho, percentual, aviso de coleta, aderência nula, descrição, intactidade das colunas antigas) mantendo os 7 casos pré-existentes sem nenhuma alteração de asserção — 13 casos ao todo, todos verdes.

## Task Commits

Cada tarefa foi commitada atomicamente (RED → GREEN):

1. **Tarefa 1 RED: casos de tela da coluna "Aderência de uso"** - `cf16e73` (test)
2. **Tarefa 2 GREEN: coluna "Aderência de uso" em ComparativoVendedorTable.tsx** - `d2b3550` (feat)

## Files Created/Modified
- `components/dashboard/ComparativoVendedorTable.tsx` - nova coluna "Aderência de uso" (cabeçalho + célula), `CardDescription` atualizada, tipo `FetchState` migrado para `ComparativoVendedorLinha[]`, comentário de documentação do componente atualizado.
- `tests/dashboard/comparativo-vendedor-table.test.tsx` - helper `aderencia(partial)`, import de `TEXTO_TOOLTIP_ADERENCIA`/`AderenciaUsoRow`, 6 casos novos.

## Decisions Made
Nenhuma decisão fora do que o plano já travava. A coluna foi renderizada exatamente como especificado nas instruções da Tarefa 2 (mesma estrutura de tooltip do "Ciclo médio", célula derivada só de `rotuloAderencia`).

## Deviations from Plan
None - plano executado exatamente como escrito.

## Issues Encountered
Nenhum. `npx tsc --noEmit`, eslint e `npm run build` limpos na primeira tentativa após o GREEN.

Nota de execução: `npx vitest run tests/dashboard/` (rodando o diretório inteiro, fora do escopo do `<verify>` da Tarefa 2) mostra falhas em `rls-dashboard.test.ts` e outros arquivos que exigem uma instância local do Supabase / rate limit de login — pré-existentes, sem nenhuma relação com este plano (confirmado por grep: nenhum desses arquivos referencia a coluna nova ou os arquivos alterados). A verificação escopada do próprio plano (`comparativo-vendedor-table`, `aderencia-exibicao`, `aderencia-uso-reader`, `comparativo-vendedor-action`) roda 33/33 verde.

## User Setup Required
None - nenhuma configuração de serviço externo necessária.

## LGPD / Privacidade
Este plano só renderiza dado já agregado pelo banco (percentual, contagem de dias, uma data) através de `rotuloAderencia()` — nenhum dado bruto novo é exposto, nenhuma nova coleta ou retenção foi introduzida, e nenhuma checagem de papel foi adicionada no app (a fronteira de autorização continua sendo inteiramente a RLS/função do banco, D-08). Como o dado exibido é de uso de um funcionário (vendedor), fica registrado aqui, por reforço: qualquer extensão futura desta coluna (ex. exportação, novo agrupamento) deve reavaliar o escopo de dado pessoal exposto à luz da LGPD antes de implementar.

## Checagem visual pendente (para o teste conjunto do marco v1.7)
Por instrução explícita do dono do projeto, a checagem visual no navegador fica para o teste conjunto do marco v1.7 (sem checkpoint humano neste plano). Roteiro para quem for verificar nessa hora:
1. Entrar como Supervisor, abrir o Dashboard e conferir a coluna "Aderência de uso" como última coluna da tabela "Comparativo por vendedor" (logo após o lançamento em produção ela deve mostrar "Coletando dados desde ..." para todo mundo, já que a janela de 28 dias ainda não se completou).
2. Entrar como Vendedor e confirmar que a tabela inteira nem aparece (D-08).

## Next Phase Readiness
- Fase 30 (Aderência de Uso no Dashboard) está com a última entrega de código feita: banco (30-01/02/03, migrations 0038-0047 já aplicadas em produção), leitura/junção (30-05) e renderização (30-06, este plano).
- ADER-01/02/03 só passam a Complete em REQUIREMENTS.md pelo orquestrador, por convenção multi-plano (Fases 9/19/20/25) — este plano não tocou REQUIREMENTS.md.
- Nenhum push feito para `staging` nem `master` — commits locais apenas, por instrução explícita do dono (o marco v1.7 é testado todo junto no fim).

---
*Phase: 30-ader-ncia-de-uso-no-dashboard*
*Completed: 2026-09-27*

## Self-Check: PASSED

- FOUND: components/dashboard/ComparativoVendedorTable.tsx
- FOUND: tests/dashboard/comparativo-vendedor-table.test.tsx
- FOUND: .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-06-SUMMARY.md
- FOUND commit: cf16e73
- FOUND commit: d2b3550
