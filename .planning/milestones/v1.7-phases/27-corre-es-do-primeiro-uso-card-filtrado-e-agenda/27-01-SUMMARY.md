---
phase: 27-corre-es-do-primeiro-uso-card-filtrado-e-agenda
plan: 01
subsystem: ui
tags: [agenda, react, supabase, typescript, nomeExibicaoCliente]

requires:
  - phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu
    provides: "lib/clientes/nomeExibicao.ts (nomeExibicaoCliente/ROTULO_SEM_NOME), nome_fantasia opcional em clientes"
provides:
  - "getClientesSemDiaFixo() lendo e repassando nome_fantasia cru até o componente"
  - "ClienteSemDiaFixo com razaoSocial anulável e nomeFantasia novo"
  - "AgendaSemDiaFixo.tsx mostrando o título da linha via nomeExibicaoCliente(), nunca em branco"
affects: [agenda, clientes]

tech-stack:
  added: []
  patterns:
    - "Título de tela sempre via nomeExibicaoCliente() nos dois pontos (title + texto filho), nunca campo cru de razão social"

key-files:
  created:
    - tests/agenda/clientes-sem-dia-fixo-query.test.ts
  modified:
    - lib/agenda/itens.ts
    - lib/supabase/queries/agenda.ts
    - components/agenda/AgendaSemDiaFixo.tsx
    - tests/agenda/sem-dia-fixo.test.tsx
    - tests/agenda/itens.test.ts
    - tests/agenda/agenda-list.test.tsx

key-decisions:
  - "Stopgap de tipo intermediário entre a Tarefa 1 e a Tarefa 2 (title={cliente.razaoSocial ?? undefined}) para manter npx tsc --noEmit limpo após razaoSocial virar anulável, sem antecipar a lógica de queda de nome da Tarefa 2 — substituído no mesmo plano, poucos minutos depois, pela chamada real a nomeExibicaoCliente()"

patterns-established:
  - "Pattern 2 da pesquisa (mudar select + tipo da linha + tipo exportado juntos, num único passo) confirmado como o caminho sem atrito para levar uma coluna nova por uma cadeia de leitura já existente"

requirements-completed: [AGD-15]

coverage:
  - id: D1
    description: "getClientesSemDiaFixo() passa a ler nome_fantasia no select e repassa o valor cru (sem queda aplicada) até ClienteSemDiaFixo.nomeFantasia"
    requirement: "AGD-15"
    verification:
      - kind: unit
        ref: "tests/agenda/clientes-sem-dia-fixo-query.test.ts (4 casos: select, mapeamento completo, razão social nula repassada, nome_fantasia nulo)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Na seção 'Sem dia fixo definido', o título de cada linha usa nomeExibicaoCliente() — razão social quando preenchida, senão Nome Fantasia, senão 'Sem nome' — e o nome do vendedor continua ao lado (D-03), nunca no lugar do nome do cliente"
    requirement: "AGD-15"
    verification:
      - kind: unit
        ref: "tests/agenda/sem-dia-fixo.test.tsx > AgendaSemDiaFixo — nome exibido (AGD-15) (6 casos novos: razão social preenchida, razão social nula, razão social só com espaços, ambos ausentes, D-03 vendedor ao lado, clique pelo nome exibido)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Confirmação visual com dados reais importados (clientes sem razão social) na branch staging, antes de ir para master"
    verification: []
    human_judgment: true
    rationale: "Depende do link de preview da Vercel gerado pela branch staging (Fluxo de Deploy do CLAUDE.md) e de dados reais importados — explicitamente adiado para o fechamento da fase pelo próprio plano (bloco <output>), não bloqueia esta execução de plano."

duration: ~16min
completed: 2026-09-25
status: complete
---

# Phase 27 Plan 01: Nome do cliente na Agenda "Sem dia fixo definido" Summary

**Correção do AGD-15: `getClientesSemDiaFixo()` agora lê `nome_fantasia`, e o título de cada linha da Agenda usa a mesma função única de nome exibido (`nomeExibicaoCliente`) do cartão do funil e da ficha, nunca mais ficando em branco.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-09-25T14:52:00-03:00 (aprox., leitura inicial dos arquivos)
- **Completed:** 2026-09-25T14:58:55-03:00
- **Tasks:** 2/2 completas
- **Files modified:** 6 modificados + 1 criado

## Accomplishments
- A consulta `getClientesSemDiaFixo()` passa a pedir `nome_fantasia` no `.select()` e repassá-lo cru (sem aplicar queda de nome) até `ClienteSemDiaFixo.nomeFantasia`
- `ClienteSemDiaFixo.razaoSocial` passou a ser anulável (`string | null`), refletindo a verdade do banco desde a migration 0024 (razão social opcional)
- O título de cada linha da seção "Sem dia fixo definido" (texto e atributo `title`) sai de `nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)` — cliente sem razão social aparece pelo Nome Fantasia; sem os dois, aparece "Sem nome" (`ROTULO_SEM_NOME`)
- O nome do vendedor (`showResponsavel`) continua aparecendo ao lado do nome do cliente, nunca no lugar dele (D-03, comportamento pré-existente, coberto por teste novo)

## Task Commits

Cada tarefa foi commitada atomicamente, com RED antes e GREEN depois (TDD):

1. **Tarefa 1: Levar nome_fantasia da consulta até o tipo ClienteSemDiaFixo** - `3b8faf6` (feat)
   - RED: `tests/agenda/clientes-sem-dia-fixo-query.test.ts` criado e rodado antes das mudanças de fonte — os 4 casos falharam (select sem `nome_fantasia`, `nomeFantasia` chegando `undefined`)
   - GREEN: após alterar `lib/agenda/itens.ts`, `lib/supabase/queries/agenda.ts` e os 3 fixtures existentes, os 4 arquivos de teste do plano (94 testes) e `npx tsc --noEmit` ficaram limpos
2. **Tarefa 2: Título da linha "Sem dia fixo" pela função única nomeExibicaoCliente** - `f652995` (fix)
   - RED: os 6 casos novos foram escritos em `tests/agenda/sem-dia-fixo.test.tsx` e rodados antes da troca do título — 5 dos 6 falharam (título vazio/sem nome acessível quando razão social é nula ou ausente)
   - GREEN: após trocar os dois pontos de chamada no `CardTitle` por `nomeExibicaoCliente(...)`, os 5 arquivos de teste do bloco verify (106 testes) e `npx tsc --noEmit` ficaram limpos

**Plan metadata:** commit de fechamento pendente (STATE.md/ROADMAP.md são responsabilidade do orquestrador, conforme constraints desta execução)

_Nota: as duas tarefas seguiram RED → GREEN explícito, sem etapa REFACTOR separada — nenhuma limpeza adicional foi necessária além do que cada GREEN já deixou pronto._

## Files Created/Modified
- `lib/agenda/itens.ts` - `ClienteSemDiaFixo` ganha `nomeFantasia: string | null`; `razaoSocial` passa a `string | null`
- `lib/supabase/queries/agenda.ts` - `.select()` de `getClientesSemDiaFixo` pede `nome_fantasia`; `ClienteSemDiaFixoRow` e `mapClienteSemDiaFixoRow` repassam o valor cru
- `components/agenda/AgendaSemDiaFixo.tsx` - título da linha (texto e `title`) calculado por `nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)`
- `tests/agenda/clientes-sem-dia-fixo-query.test.ts` - novo, prova o select e o repasse cru de `nome_fantasia` (4 casos)
- `tests/agenda/sem-dia-fixo.test.tsx` - fixture `buildCliente` ganha `nomeFantasia: null`; novo describe "AgendaSemDiaFixo — nome exibido (AGD-15)" com 6 casos
- `tests/agenda/itens.test.ts` - fixture `clienteSemDiaFixo` ganha `nomeFantasia: null`
- `tests/agenda/agenda-list.test.tsx` - objeto literal `ClienteSemDiaFixo` do teste "aviso de dia fixo (AGENDA-01)" ganha `nomeFantasia: null`

## Decisions Made
- Stopgap de tipo entre as duas tarefas: ao tornar `razaoSocial` anulável na Tarefa 1, `AgendaSemDiaFixo.tsx` (ainda não corrigido) quebrava o typecheck no atributo `title` (`string | null` não é atribuível a `string | undefined`). Em vez de antecipar a lógica de `nomeExibicaoCliente()` da Tarefa 2, apliquei o stopgap mínimo `title={cliente.razaoSocial ?? undefined}` só para satisfazer o compilador — sem mudar o comportamento visual (ainda mostrava razão social crua, ainda em branco quando nula). A Tarefa 2 substituiu essa linha pela chamada real a `nomeExibicaoCliente()` minutos depois, no mesmo plano.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stopgap de tipo em `AgendaSemDiaFixo.tsx` para manter `tsc --noEmit` limpo entre as Tarefas 1 e 2**
- **Found during:** Tarefa 1 (verificação `npx tsc --noEmit`)
- **Issue:** Tornar `ClienteSemDiaFixo.razaoSocial` anulável (exigido por D-04a) quebrou o typecheck em `AgendaSemDiaFixo.tsx`, que ainda passava `cliente.razaoSocial` cru para o atributo `title` (tipo `string | undefined`) — bloqueando o critério de aceite da própria Tarefa 1 ("O comando do bloco verify termina com código de saída 0")
- **Fix:** `title={cliente.razaoSocial ?? undefined}` como stopgap mínimo, sem tocar no texto filho nem antecipar `nomeExibicaoCliente()` (isso é escopo da Tarefa 2, que substituiu esta linha na sequência)
- **Files modified:** `components/agenda/AgendaSemDiaFixo.tsx`
- **Verification:** `npx tsc --noEmit` limpo; 94 testes do bloco verify da Tarefa 1 passando
- **Committed in:** `3b8faf6` (parte do commit da Tarefa 1)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3)
**Impact on plan:** Consequência direta e esperada de sequenciar duas tarefas TDD que tocam o mesmo tipo em passos distintos — resolvido no mesmo plano, sem mudança de escopo, sem alterar o resultado final descrito no `<done>` da Tarefa 2.

## Issues Encountered
None além do deviation documentado acima.

## User Setup Required
None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- AGD-15 implementado e coberto por teste automatizado (consulta + tela), typecheck do projeto limpo, nenhuma migration tocada
- Pendência explícita, fora do escopo desta execução de plano: verificação visual com dados reais na branch `staging` antes do fechamento da fase (D3 acima) — o próprio plano adia isso para o fim da fase, seguindo o Fluxo de Deploy do CLAUDE.md
- Nenhum bloqueio para os próximos planos da Fase 27

---
*Phase: 27-corre-es-do-primeiro-uso-card-filtrado-e-agenda*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: tests/agenda/clientes-sem-dia-fixo-query.test.ts
- FOUND: .planning/phases/27-corre-es-do-primeiro-uso-card-filtrado-e-agenda/27-01-SUMMARY.md
- FOUND: commit 3b8faf6 (Tarefa 1)
- FOUND: commit f652995 (Tarefa 2)
