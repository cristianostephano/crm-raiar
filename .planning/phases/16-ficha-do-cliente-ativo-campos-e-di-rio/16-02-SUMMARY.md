---
phase: 16-ficha-do-cliente-ativo-campos-e-di-rio
plan: 02
subsystem: ui
tags: [nextjs, server-actions, supabase, rls, editable-lists, configuracoes]

# Dependency graph
requires:
  - phase: 16-ficha-do-cliente-ativo-campos-e-di-rio (plan 01)
    provides: "frequencias_pedido table (id/nome/ativo/created_at) — RLS read-all/write-supervisor, 6 starter values seeded"
provides:
  - "ListaTabela union extended to 5 members (frequencias_pedido added) — zero changes to the 4 generic write functions in app/actions/listas.ts"
  - "5th Configurações tab (Frequência de pedidos), positioned last, full CRUD inherited from the generic EditableListTab infrastructure"
  - "getFrequenciasPedidoAtivas() — active-only catalog reader in lib/supabase/queries/clientes.ts, sibling of getTiposTarefaAtivos/getCategoriasAtivas/getProdutosAtivos"
  - "getFrequenciasPedido() — thin Server Action envelope in app/actions/clientes.ts, open to any authenticated user, no role check"
affects: [16-03, 16-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "5th editable-list table plugs into the existing ListaTabela union + TABS config with zero new component/logic — confirms the Fase 3 generic infrastructure design decision"
    - "Active-catalog readers (getXAtivas) always live in lib/supabase/queries/clientes.ts, filter ativo=true, order by nome, return [] on error (never throw) — getFrequenciasPedidoAtivas is the 4th instance of this exact shape"

key-files:
  created:
    - tests/configuracoes/frequencias-pedido-catalogo.test.ts
  modified:
    - app/actions/listas.ts
    - components/configuracoes/ConfiguracoesTabs.tsx
    - lib/supabase/queries/clientes.ts
    - app/actions/clientes.ts

key-decisions:
  - "Frequência de pedidos tab placed last (5th) in ConfiguracoesTabs, not in strict client-attribute-first order — it IS a client attribute but only applies to clientes already 'ganho', so it's the most specific of the five and shouldn't push the 4 daily-use tabs out of view"
  - "getFrequenciasPedidoAtivas() carries an explicit doc-comment warning that Plan 16-03's server-side validation must NOT reuse this reader (it only returns active rows) — a cliente with an already-stored, since-deactivated value must still be able to save; 16-03 needs a full-catalog reader instead"
  - "getFrequenciasPedido() Server Action performs no role check (unlike listas.ts's write actions) — catalog reads are open to any authenticated user by design, matching the RLS SELECT policy from migration 0016 and the requirement that the field work for Vendedor too"

patterns-established: []

requirements-completed: [ATV-02]

coverage:
  - id: D1
    description: "5th Configurações tab (Frequência de pedidos) added declaratively to ConfiguracoesTabs.tsx and ListaTabela — Supervisor gets full add/rename/deactivate/reactivate CRUD via the existing generic EditableListTab, zero new UI component"
    requirement: ATV-02
    verification:
      - kind: other
        ref: "node structural verification script (Task 1 <verify> block) — asserts 5-member ListaTabela union, 5 configured tabs, exact copy strings, keepMounted present on every panel, EditableListTab remains table-agnostic"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit && npm run lint"
        status: pass
    human_judgment: true
    rationale: "The tab's real-world CRUD behavior (add/rename/deactivate/reactivate through the browser UI) was proven mechanically as declarative configuration reusing already-shipped, already-verified EditableListTab logic (Fase 3) — no new component code exists to visually inspect — but no live browser click-through of this specific new tab was performed in this run, so a human spot-check is the honest classification rather than a false auto-pass."
  - id: D2
    description: "getFrequenciasPedidoAtivas() catalog reader + getFrequenciasPedido() Server Action — active-only, alphabetically ordered, narrow-column, open to any authenticated user (including Vendedor), proven against the live hosted database"
    requirement: ATV-02
    verification:
      - kind: integration
        ref: "tests/configuracoes/frequencias-pedido-catalogo.test.ts (10/10 passing against hosted project) — cases: ativos, ordem, vendedor, desativar, colunas"
        status: pass
      - kind: other
        ref: "node structural verification script (Task 2 <verify> block) + npx tsc --noEmit + npm run lint"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-09
status: complete
---

# Phase 16 Plan 2: Administração e Leitura do Vocabulário "Frequência de Pedidos" Summary

**Quinta aba de lista editável em Configurações (CRUD herdado, zero componente novo) + leitor de catálogo ativo (`getFrequenciasPedidoAtivas`/`getFrequenciasPedido`) provado por 10 testes de integração contra o banco real.**

## Performance

- **Duration:** ~35min
- **Tasks:** 2/2 (ambas `type="auto"`)
- **Files modified:** 5 (4 modificados, 1 teste novo)

## Accomplishments

- `ListaTabela` (app/actions/listas.ts) passou de 4 para 5 membros com a inclusão de `frequencias_pedido` — nenhuma das quatro funções de leitura/escrita mudou, confirmando que elas já eram genéricas sobre o nome da tabela desde a Fase 3.
- `ConfiguracoesTabs.tsx` ganhou a quinta aba "Frequência de pedidos", posicionada por último (depois de "Motivos de perda"), com a copy exata do plano: rótulo `Frequência de pedidos`, dica `Nome da frequência`, contagem `frequências ativas`. `keepMounted` continua presente em todos os cinco painéis. `EditableListTab.tsx` e `app/(app)/configuracoes/page.tsx` não foram tocados.
- `getFrequenciasPedidoAtivas()` (lib/supabase/queries/clientes.ts) — leitor de catálogo irmão literal de `getTiposTarefaAtivos`/`getCategoriasAtivas`/`getProdutosAtivos`: seleção estreita (id, nome), filtro `ativo = true`, ordenação alfabética por nome, retorno de lista vazia em caso de erro. Comentário de documentação registra explicitamente que a validação do plano 16-03 NÃO deve usar este leitor.
- `getFrequenciasPedido()` (app/actions/clientes.ts) — envelope fino de Server Action, checa usuário autenticado e não faz nenhuma checagem de papel (leitura de catálogo é aberta a qualquer autenticado, é o que faz o campo funcionar para o Vendedor).
- `tests/configuracoes/frequencias-pedido-catalogo.test.ts` — 10 testes de integração contra o projeto Supabase hospedado real, com sessões reais (`signInAs`, nunca a chave de serviço para afirmar comportamento): casos `ativos` (filtro exclui inativo), `ordem` (ordem alfabética), `vendedor` (Vendedor consegue ler), `desativar` (desativar tira da leitura ativa sem apagar a linha) e `colunas` (seleção estreita, só `id`/`nome`). Todos verdes.

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Quinta aba de lista editável em Configurações** - `81fc842` (feat)
2. **Task 2: Leitor do catálogo ativo + Server Action, com teste de integração** - `1ea3f7e` (feat)

**Plan metadata:** commit deste SUMMARY.md (ver hash no retorno da task de execução)

## Files Created/Modified

- `app/actions/listas.ts` - `ListaTabela` estendida para 5 membros (frequencias_pedido), comentário de documentação atualizado
- `components/configuracoes/ConfiguracoesTabs.tsx` - quinta entrada `TABS` (Frequência de pedidos), comentário explicando a posição
- `lib/supabase/queries/clientes.ts` - `getFrequenciasPedidoAtivas()` novo, irmão dos 3 leitores de catálogo já existentes
- `app/actions/clientes.ts` - `getFrequenciasPedido()` novo, envelope fino de Server Action
- `tests/configuracoes/frequencias-pedido-catalogo.test.ts` - teste de integração novo (10 casos)

## Decisions Made

- Aba "Frequência de pedidos" posicionada por último (5ª), não na ordem estrita "atributos do cliente primeiro" — ela é um atributo do cliente, mas só existe para o cliente já ganho, então entra como a mais específica das cinco, sem empurrar as quatro abas de uso diário do Supervisor.
- `getFrequenciasPedidoAtivas()` documentado explicitamente para nunca ser reusado pela validação do plano 16-03 (que precisa do catálogo completo, ativos + inativos, para não quebrar clientes que já guardaram um valor desde então desativado).
- `getFrequenciasPedido()` sem checagem de papel, de propósito — leitura de catálogo é aberta a qualquer autenticado, mesma fronteira real (RLS) já provada pelo plano 16-01.

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhuma correção automática (Regras 1-3) foi necessária; nenhuma decisão arquitetural (Regra 4) surgiu durante a execução.

## Issues Encountered

- Ambiente de teste do worktree não tinha `.env.local` nem `supabase/.temp/` (ambos gitignored, não versionados, então não copiados automaticamente para um worktree novo). Copiados do checkout principal do repositório só para viabilizar a execução dos testes de integração contra o banco real — nunca commitados (seguem fora do controle de versão em ambos os locais).

## User Setup Required

None - nenhuma configuração externa manual necessária.

## Next Phase Readiness

- `getFrequenciasPedido()` é o caminho pronto para o plano 16-04 montar o campo de escolha "Frequência de pedidos" na ficha do cliente ativo — nenhum outro leitor deve ser criado para esse fim.
- O Supervisor já pode administrar o vocabulário completo (adicionar/renomear/desativar/reativar) pela tela de Configurações, quinta aba, antes mesmo do campo existir na ficha (16-04).
- **ATV-02 permanece intencionalmente NÃO marcado como completo em `.planning/REQUIREMENTS.md`** por este plano — o campo "Frequência de pedidos" ainda não está wired na UI da ficha do cliente (isso é o plano 16-04). A tabela `requirements-completed` no frontmatter deste SUMMARY segue a convenção do template (copia o array `requirements` do PLAN.md verbatim), mas isso não deve ser confundido com o requisito estar entregue ponta a ponta — a checkbox real em REQUIREMENTS.md só deve virar "Complete" depois do plano 16-04.
- Nenhuma dependência npm nova, nenhum componente de interface novo, nenhuma migration neste plano.
- Nenhum bloqueio conhecido para os planos 16-03 e 16-04.

---
*Phase: 16-ficha-do-cliente-ativo-campos-e-di-rio*
*Completed: 2026-08-09*
