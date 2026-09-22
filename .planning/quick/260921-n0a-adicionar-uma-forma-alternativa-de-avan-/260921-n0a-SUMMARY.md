---
phase: quick-260921-n0a
plan: 01
subsystem: ui
tags: [react, kanban, dnd-kit, funil, server-actions]

requires:
  - phase: 02-04
    provides: "moverCard() Server Action, mover_card_funil RPC, o banner transitório de sucesso/erro do KanbanBoard"
provides:
  - "etapaAnterior()/etapaSeguinte() em lib/funil/etapas.ts — etapa vizinha derivada de ETAPA_KEYS"
  - "Duas setas (ChevronLeft/ChevronRight) no ClienteCard, via props opcionais onMoverEtapa/movendoEtapa"
  - "handleMoverEtapaAdjacente no KanbanBoard, reaproveitando moverCard() e o banner existente, funcionando nos dois ramos de render (DndContext e dragDisabled)"
affects: [funil, kanban, clientes]

tech-stack:
  added: []
  patterns:
    - "Segunda entrada de escrita no funil (setas) sempre convergindo na mesma Server Action que o arrastar já usa — nunca um caminho de escrita paralelo"

key-files:
  created:
    - tests/clientes/etapa-adjacente.test.ts
    - tests/clientes/cliente-card-setas-etapa.test.tsx
  modified:
    - lib/funil/etapas.ts
    - components/clientes/ClienteCard.tsx
    - components/clientes/KanbanBoard.tsx

key-decisions:
  - "Setas direto no card do Kanban (não na ficha do cliente) — decisão da Revisão 2 do CONTEXT.md, motivada por teste real com o time mostrando que o arrastar 'não ia' na maioria das tentativas em celular/tablet"
  - "Só etapa adjacente (uma coluna por vez), nunca salto livre entre as 7 etapas — mesmo raciocínio do arrastar quando solta na coluna vizinha"
  - "Posição de destino é sempre o fim da coluna, calculada sobre grouped (conjunto completo), nunca filteredGrouped — necessário para funcionar corretamente com busca/filtro ativos"

patterns-established:
  - "Toda ação de mover etapa (arrastar OU seta) passa por handleDragEnd/handleMoverEtapaAdjacente, que só divergem em como calculam a posição de destino — ambos terminam em moverCard()"

requirements-completed: [QUICK-260921-n0a]

coverage:
  - id: D1
    description: "etapaAnterior()/etapaSeguinte() como função pura, derivada de ETAPA_KEYS, retornando null nas duas bordas do funil"
    requirement: "QUICK-260921-n0a"
    verification:
      - kind: unit
        ref: "tests/clientes/etapa-adjacente.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Duas setas no ClienteCard, condicionadas a onMoverEtapa e à existência do vizinho, desabilitadas por movendoEtapa, nunca disparando onOpen"
    requirement: "QUICK-260921-n0a"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-card-setas-etapa.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Setas ligadas ao mesmo moverCard()/mover_card_funil do arrastar, com rollback e banner de erro compartilhado, funcionando nos dois ramos de render (DndContext e dragDisabled) — comportamento visível ao vivo no navegador"
    requirement: "QUICK-260921-n0a"
    verification:
      - kind: unit
        ref: "tests/clientes/kanban-scroll-column.test.tsx (regressão do arrastar intacto)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit && npx eslint components/clientes/KanbanBoard.tsx components/clientes/ClienteCard.tsx lib/funil/etapas.ts"
        status: pass
    human_judgment: true
    rationale: "O comportamento real de clicar a seta no celular/tablet e ver o card mudar de coluna, o rollback visual em caso de recusa do RPC, e a confirmação de que o arrastar continua idêntico só podem ser confirmados ao vivo no preview da staging — não há teste automatizado que substitua a checagem humana listada no PLAN.md (`<verification>`, checklist final)."

duration: ~20min
completed: 2026-09-22
status: complete
---

# Quick Task 260921-n0a: Setas de avançar/voltar etapa no card Summary

**Duas setas (ChevronLeft/ChevronRight) no card do Kanban, avançando/voltando exatamente uma etapa via a mesma Server Action `moverCard()` que o arrastar já usa, funcionando também quando o arrastar está desligado por busca/filtro/ordenação.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3/3 completos
- **Files modified:** 5 (3 de código + 2 de teste)

## Accomplishments

- `etapaAnterior()`/`etapaSeguinte()` em `lib/funil/etapas.ts`, derivadas de `ETAPA_KEYS`, com `null` nas duas bordas do funil.
- `ClienteCard` ganhou duas setas opcionais (só aparecem com `onMoverEtapa` e vizinho existente), com `stopPropagation` duplo (clique não abre a ficha, ponteiro não inicia arraste do dnd-kit) e trava por `movendoEtapa`.
- `KanbanBoard` ganhou `handleMoverEtapaAdjacente`, espelhando `handleDragEnd` (otimismo local → `moverCard()` → rollback + banner de erro → banner de sucesso), fiada nos dois ramos de render (`DndContext` e `dragDisabled` — este último é onde busca/filtros/Incompletos/ordenação hoje desligam o arrastar e o vendedor fica sem saída alguma).
- Arrastar (`handleDragEnd`, `computeNovaPosicao`, sensores, `DndContext`) permanece intocado.

## Task Commits

Each task was committed atomically:

1. **Task 1: Etapa vizinha como função pura em lib/funil/etapas.ts** - `a2028b5` (feat, TDD: RED confirmado antes da implementação)
2. **Task 2: Duas setas de etapa no ClienteCard** - `8051200` (feat, TDD: RED confirmado antes da implementação)
3. **Task 3: Fiação no KanbanBoard reaproveitando moverCard e o banner existente** - `dae2dd6` (feat)

_Nenhum commit de plano/docs incluído aqui — a orquestração cuida do commit de `.planning/` separadamente._

## Files Created/Modified

- `lib/funil/etapas.ts` - `etapaAnterior()`/`etapaSeguinte()`, únicas definições de "etapa vizinha"
- `tests/clientes/etapa-adjacente.test.ts` - teste unitário puro (ambiente `node`, sem DOM)
- `components/clientes/ClienteCard.tsx` - duas setas opcionais (`EtapaArrowButton`), props `onMoverEtapa`/`movendoEtapa`
- `tests/clientes/cliente-card-setas-etapa.test.tsx` - teste de render (jsdom) cobrindo bordas, ausência da prop, destino por clique, isolamento de `onOpen`, e `movendoEtapa`
- `components/clientes/KanbanBoard.tsx` - `movendoEtapaId`, `handleMoverEtapaAdjacente`, fiação em `DraggableClienteCard`/`StaticClienteCard` e nos dois ramos de render

## Decisions Made

- Setas direto no card (Revisão 2 do CONTEXT.md) em vez do Select na ficha do cliente da Revisão 1 (substituída, nunca implementada) — motivado pelo teste real com o time mostrando fricção no gesto de arrastar em celular/tablet.
- Único caminho de escrita: `moverCard()` → `mover_card_funil`. Nenhuma consulta nova, nenhum `.rpc()` direto, nenhum guard duplicado — a trava do "ganho" e das demais regras de negócio mora só no RPC.
- Posição de destino sempre o fim de `grouped[destino]` (conjunto completo, nunca `filteredGrouped`), usando o mesmo `computeNovaPosicao` do arrastar.

## Deviations from Plan

None - plan executado exatamente como escrito. As 3 tasks seguiram a ordem, os comportamentos TDD (RED confirmado nas Tasks 1 e 2 antes de implementar) e os critérios `<done>` batem com o que foi entregue.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo. Nenhuma dependência npm nova (confirmado: `lucide-react` e `@testing-library/react` já estavam instalados).

## Next Phase Readiness

- Código pronto para a checagem humana ao vivo no preview da `staging`, listada em `<verification>` do PLAN.md (tocar as setas no celular/tablet, confirmar bordas do funil sem seta, confirmar que a ficha não abre, confirmar arrastar intacto, confirmar setas funcionando com busca ativa, confirmar recusa do RPC para cliente já ganho).
- Entrega segue o fluxo de deploy obrigatório do CLAUDE.md: push para `staging` → validar no preview da Vercel → só então `master`. Esta execução NÃO fez esse push (fora do escopo do executor, cabe à orquestração/dono do projeto).
- Nota LGPD/privacidade: esta mudança não introduz coleta, exibição ou processamento de nenhum dado pessoal novo — as setas apenas reordenam a mesma etapa do funil já exibida no card (`razaoSocial`, `responsavelNome`, `telefone`, etc., todos já renderizados hoje). Nenhum novo campo de dado pessoal foi adicionado, nenhuma nova consulta ao Supabase foi criada além da já existente `moverCard()`. Nada a alertar sob a LGPD para esta task específica.

---
*Phase: quick-260921-n0a*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 6 claimed files found on disk (5 code/test files + this SUMMARY.md); all 3 task commit hashes (`a2028b5`, `8051200`, `dae2dd6`) found in `git log`.
