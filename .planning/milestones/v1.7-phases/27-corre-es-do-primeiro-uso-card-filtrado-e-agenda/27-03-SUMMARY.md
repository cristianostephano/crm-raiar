---
phase: 27-corre-es-do-primeiro-uso-card-filtrado-e-agenda
plan: 03
subsystem: frontend
tags: [kanban, css, flexbox, kan-03, tdd]

requires: ["27-02"]
provides:
  - "Correção do KAN-03: card do Kanban não fica mais comprimido/cortado quando um filtro, busca ou a aba Incompletos está ativa"
affects: [27-corre-es-do-primeiro-uso-card-filtrado-e-agenda]

tech-stack:
  added: []
  patterns:
    - "StaticClienteCard agora entrega o ClienteCard dentro de um div simples, igual ao div que DraggableClienteCard já usava — nenhum estilo novo, só a mesma forma de DOM nos dois ramos de renderização do Kanban"

key-files:
  created:
    - tests/clientes/kanban-card-filtrado.test.tsx
  modified:
    - components/clientes/KanbanBoard.tsx

key-decisions:
  - "Portão do plano respeitado: só houve mudança de código porque 27-02-SUMMARY.md registra 'Resultado do diagnóstico KAN-03: H1-CONFIRMADO'"
  - "Correção aplicada exatamente como o diagnóstico de H1 previu: um div simples em volta do ClienteCard no ramo StaticClienteCard, sem nenhuma classe, estilo ou atributo novo"
  - "Causa secundária registrada no 27-02 foi 'nenhuma' — nenhum aviso adicional necessário para o dono do projeto"

requirements-completed: [KAN-03]

coverage:
  - id: T1-RED
    description: "Teste de paridade falha no código de antes da correção (Caso 2: card filtrado é filho direto da coluna de rolagem)"
    requirement: "KAN-03"
    verification:
      - kind: unit
        ref: "npx vitest run tests/clientes/kanban-card-filtrado.test.tsx (antes da correção)"
        status: pass
    human_judgment: false
    rationale: "Falha reproduzida e documentada abaixo antes de qualquer mudança em KanbanBoard.tsx — prova automatizada de H1 no código atual."
  - id: T1-GREEN
    description: "Os 4 casos do teste de paridade passam depois da correção (div simples em StaticClienteCard)"
    requirement: "KAN-03"
    verification:
      - kind: unit
        ref: "npx vitest run tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/cliente-card-setas-etapa.test.tsx tests/clientes/kanban-scroll-column.test.tsx"
        status: pass
    human_judgment: false
    rationale: "15/15 testes passando: os 4 casos novos de paridade, os 8 casos de regressão das setas de etapa e os 3 casos de ScrollColumnShell."
  - id: T2-SUITE
    description: "Suítes jsdom/puras do Kanban, lint e typecheck passam depois da correção"
    requirement: "KAN-03"
    verification:
      - kind: unit
        ref: "npx vitest run (8 arquivos, 57 testes) && npx eslint (2 arquivos) && npx tsc --noEmit"
        status: pass
    human_judgment: false
    rationale: "Nenhuma regressão detectada nas suítes relacionadas ao Kanban; lint e typecheck limpos nos dois arquivos tocados."
  - id: T2-HUMAN
    description: "Conferência visual final na branch staging, feita pelo dono do projeto no fechamento da fase"
    requirement: "KAN-03"
    verification:
      - kind: manual
        ref: "Ver seção 'Human-check pendente' abaixo"
        status: pending
    human_judgment: true
    rationale: "Altura, corte e rolagem dependem de layout real do navegador (colunas cheias) — o jsdom não calcula isso, então esta conferência fica para o fechamento da onda/fase, depois do deploy em staging."

duration: ~35min
completed: 2026-09-28
status: complete
---

# Phase 27 Plan 3: Correção do KAN-03 — Card do Kanban Comprimido com Filtro Ativo — Summary

**Quando um filtro de vendedor, uma busca ou a aba "Incompletos" está ligada no Kanban, o card deixa de perder categoria, vendedor, cidade/estado e ícones em colunas cheias: a correção coloca o card dentro de um `div` simples, exatamente como o card sem filtro já usa, e a coluna volta a rolar em vez de espremer os cards.**

## BASE 27-03: a9721e01d64602413147db3d859dea7f2c2701ed

Todos os critérios de "arquivo intacto" deste plano comparam contra este commit (o HEAD no início da execução, antes de qualquer mudança deste plano).

## Portão do diagnóstico (Passo 0)

`grep -E "^Resultado do diagnóstico KAN-03: H1-(CONFIRMADO|COMPATIVEL)$" 27-02-SUMMARY.md` encontrou:

```
Resultado do diagnóstico KAN-03: H1-CONFIRMADO
```

Portão liberado — a correção de código foi aplicada.

## Explicação simples (para o dono do projeto)

Com filtro ligado, quando uma coluna do Kanban tinha muitos cards, o card ficava espremido até uma faixa fininha, cortando o nome e escondendo categoria, vendedor, cidade/estado e os ícones. Isso acontecia porque, nesse caso, o "molde" do card ficava colado direto dentro da área que rola — sem um espaçador simples em volta dele, o navegador achava que podia encolher o card até quase sumir. Agora o card tem esse mesmo espaçador que o card sem filtro já usava, então ele mantém o tamanho normal e é a coluna que rola, não o card que encolhe.

## O que foi feito (Tarefa 1 — TDD)

**Passo 1 — teste (RED).** Criado `tests/clientes/kanban-card-filtrado.test.tsx` com 4 casos, usando busca (em vez do filtro de vendedor — mesmo ramo de código, mas determinística no jsdom). Rodado ANTES da correção:

```
FAIL  tests/clientes/kanban-card-filtrado.test.tsx > KAN-03 — paridade entre card sem filtro e card filtrado > Caso 2 (busca ativa, mesmo ramo dragDisabled que o filtro de vendedor liga): o card também não é filho direto da coluna de rolagem
AssertionError: expected 'min-h-0 flex-1 overflow-y-auto flex f…' not to contain 'overflow-y-auto'

Expected: "overflow-y-auto"
Received: "min-h-0 flex-1 overflow-y-auto flex flex-col gap-2"

Test Files  1 failed (1)
     Tests  1 failed | 3 passed (4)
```

Essa falha é a prova automatizada de H1 no código de antes: com busca ativa, o card filtrado era filho DIRETO da coluna de rolagem (`overflow-y-auto`), em vez de ter um `div` simples entre os dois — os Casos 1, 3 e 4 já passavam (linha de base).

**Passo 2 — correção (GREEN).** Em `components/clientes/KanbanBoard.tsx`, `StaticClienteCard` passou a devolver o `ClienteCard` dentro de um `<div>` sem nenhum atributo, mesma forma de DOM que `DraggableClienteCard` já usa (menos o que é de arrastar). Doc-comment da função ampliado explicando o porquê (overflow-hidden do Card + altura mínima automática zero como filho direto de uma coluna flex-col de rolagem). Nada mais foi tocado: ramo `DndContext`/`DraggableClienteCard`/`DroppableColumn`, a expressão de `dragDisabled`/`hasActiveFilters`, a largura `w-[280px] shrink-0` (nos dois ramos), `ScrollColumnShell.tsx`, `ClienteCard.tsx` e `components/ui/card.tsx` ficaram intactos.

Depois da correção, os 4 casos passam:

```
Test Files  3 passed (3)
     Tests  15 passed (15)
```

(kanban-card-filtrado.test.tsx + cliente-card-setas-etapa.test.tsx + kanban-scroll-column.test.tsx)

**Passo 3 — critérios de aceite do diff**, todos conferidos contra a BASE acima:

- `grep -c 'w-\[280px\] shrink-0' components/clientes/KanbanBoard.tsx` → `2` (larguras intactas nos dois ramos)
- `grep -c 'const dragDisabled = hasActiveFilters || sortBy !== "recentes"' components/clientes/KanbanBoard.tsx` → `1`
- `git diff -U0 <BASE> -- components/clientes/KanbanBoard.tsx | grep -E '^\+[^+]' | grep -c 'className'` → `0` (nenhuma classe CSS nova)
- `git diff --stat <BASE> -- components/clientes/ScrollColumnShell.tsx components/clientes/ClienteCard.tsx components/ui/card.tsx tests/clientes/cliente-card-setas-etapa.test.tsx` → vazio (arquivos protegidos, intactos)
- `npx tsc --noEmit` → limpo

## O que foi feito (Tarefa 2 — guarda de regressão e suítes)

1. **Guarda de regressão obrigatória (quick task 260921-n0a):** `npx vitest run tests/clientes/cliente-card-setas-etapa.test.tsx` → 8/8 casos passando. `git diff --stat <BASE> -- tests/clientes/cliente-card-setas-etapa.test.tsx` → vazio (arquivo não editado).
2. **Suítes jsdom/puras do Kanban:**

```
npx vitest run tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/kanban-scroll-column.test.tsx tests/clientes/filters-popover.test.tsx tests/clientes/nome-exibicao.test.ts tests/clientes/staleness.test.ts tests/clientes/incompleto.test.ts tests/clientes/export-ids.test.ts

Test Files  8 passed (8)
     Tests  57 passed (57)
```

3. **Lint:** `npx eslint components/clientes/KanbanBoard.tsx tests/clientes/kanban-card-filtrado.test.tsx` → código de saída 0.
4. **Typecheck:** `npx tsc --noEmit` → código de saída 0.
5. **Causa secundária (do 27-02):** registrada como "nenhuma" — nenhum aviso adicional para o dono do projeto além da explicação simples acima.

## Human-check pendente (fechamento da fase)

Ainda falta a conferência visual do dono na branch `staging` (Fluxo de Deploy do CLAUDE.md), depois que a mudança for publicada:

1. Entrar como Supervisor e ir em Clientes.
2. Escolher a coluna com mais cards e reparar num card: categoria, vendedor, cidade/estado, ícones e as duas setas.
3. Clicar em Filtros, escolher o vendedor desse card e aplicar.
4. Olhar o mesmo card de novo — deve mostrar exatamente as mesmas informações, mesmo tamanho de sem filtro.
5. Clicar na seta de avançar e depois na de voltar no card filtrado — devem funcionar.
6. Tirar o filtro — tudo deve continuar igual a antes da correção, inclusive o arrastar.

Este plano não fez esse teste porque exige navegador real com colunas cheias (jsdom não calcula altura/corte de layout) e a mudança ainda não foi publicada em staging — fica para o fechamento da onda/fase, antes do `/gsd-verify-work`.

## Deviations from Plan

None — plano executado exatamente como escrito. Portão respeitado, TDD seguido (RED antes de GREEN), nenhum arquivo fora do escopo tocado.

## Known Stubs

Nenhum stub introduzido por este plano.

## Threat Flags

Nenhuma superfície nova de segurança introduzida (correção puramente de CSS/estrutura de DOM em componente já existente, sem novo endpoint, rota, schema ou caminho de autenticação).

## Files Created/Modified

- `tests/clientes/kanban-card-filtrado.test.tsx` (criado) — teste de paridade de estrutura e conteúdo entre card sem filtro e card filtrado.
- `components/clientes/KanbanBoard.tsx` (modificado) — `StaticClienteCard` envolve o `ClienteCard` num `div` simples; doc-comment ampliado.

## Self-Check: PASSED

- `[ -f "tests/clientes/kanban-card-filtrado.test.tsx" ]` → FOUND
- `git log --oneline --all | grep -q "6e1ee01"` → FOUND (test commit)
- `git log --oneline --all | grep -q "f2abfd5"` → FOUND (feat commit)
- `grep -c "it(" tests/clientes/kanban-card-filtrado.test.tsx` → 4
- `npx vitest run tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/cliente-card-setas-etapa.test.tsx tests/clientes/kanban-scroll-column.test.tsx` → 15/15 passando
- `npx eslint components/clientes/KanbanBoard.tsx tests/clientes/kanban-card-filtrado.test.tsx` → código de saída 0
- `npx tsc --noEmit` → código de saída 0
- Nenhum dado real (nome de cliente/vendedor, telefone, print) neste SUMMARY ou nas fixtures de teste — só dados inventados (LGPD)

## Next Phase Readiness

- KAN-03 corrigido por código e prova automatizada. Falta só a conferência visual humana em staging, no fechamento da fase (não bloqueia outros planos da Fase 27).
- Nenhuma migration, RLS policy ou Server Action tocada — correção puramente de frontend/CSS.

---
*Phase: 27-corre-es-do-primeiro-uso-card-filtrado-e-agenda*
*Status: complete*
