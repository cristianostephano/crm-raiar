---
phase: 260806-h8a
plan: 01
subsystem: database
tags: [postgres, supabase, rls, security-definer, rpc, react, vitest]

requires:
  - phase: 09-filtros-de-estado-e-cidade-estruturados
    provides: "cidades_por_estado(p_uf) RPC (IBGE seed table), UFS constant, Combobox pattern, FiltersPopover/EstadoCidadeFields split"
provides:
  - "cidades_com_clientes_por_estado(p_uf) RPC — SECURITY DEFINER, returns only distinct city names from clientes for the chosen estado, system-wide across every vendedor"
  - "lib/clientes/cidadesComClientes.ts — buscarCidadesComClientes() typed reader consumed only by FiltersPopover.tsx"
affects: [filtro-de-clientes]

tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER scoped to the absolute minimum (distinct text column only, no row data) is an acceptable, documented exception to the project's default SECURITY INVOKER convention when RLS-invoker semantics would otherwise produce an incomplete result for a legitimate cross-vendedor use case"

key-files:
  created:
    - supabase/migrations/0012_cidades_com_clientes_por_estado.sql
    - lib/clientes/cidadesComClientes.ts
    - tests/clientes/cidades-com-clientes.test.ts
    - tests/clientes/cidades-com-clientes-reader.test.ts
  modified:
    - components/clientes/FiltersPopover.tsx
    - tests/clientes/filters-popover.test.tsx

key-decisions:
  - "SECURITY DEFINER é a TERCEIRA exceção documentada deste projeto (depois de is_supervisor() e desativar_membro_equipe/reativar_membro_equipe, ambas em 0008) — a função devolve exclusivamente nomes de cidade distintos, sem id/razão social/contato/contagem/atribuição a vendedor, então não pode ser usada como canal de leitura de dados de cliente. RLS da tabela clientes não foi alterada (nenhuma policy criada/alterada/removida)."
  - "cidades_com_clientes_por_estado alimenta SOMENTE o filtro de Clientes (FiltersPopover.tsx). O cadastro/edição (EstadoCidadeFields.tsx) continua usando cidades_por_estado (lista completa do IBGE) — deliberado, para permitir cadastrar cliente numa cidade nova pela primeira vez."
  - "UF 'TO' (Tocantins) usada como fixture de teste em tests/clientes/cidades-com-clientes.test.ts — confirmado ao vivo, antes de semear, que não tinha nenhum cliente real. Futuras suítes não devem usar 'TO' sem checar de novo se ainda está livre."
  - "order by 1 (posição ordinal) em vez de order by nome no corpo da função — evita o SQLSTATE 42702 de sombreamento de coluna de saída já documentado na Fase 9/migration 0005."

patterns-established:
  - "Quando uma decisão de produto exige que uma RPC devolva dados agregados do sistema inteiro (não escopados ao usuário chamador) mas a RLS da tabela de origem escopa por usuário, a resolução é uma função SECURITY DEFINER que devolve o MÍNIMO absoluto de dado (aqui: só nomes de cidade, nunca linhas inteiras), nunca uma nova policy de SELECT liberando a tabela toda."

requirements-completed: [QT-H8A-01, QT-H8A-02, QT-H8A-03, QT-H8A-04]

coverage:
  - id: D1
    description: "Escolher um Estado no filtro de Clientes lista só cidades com cliente cadastrado naquele Estado"
    requirement: "QT-H8A-01"
    verification:
      - kind: integration
        ref: "tests/clientes/cidades-com-clientes.test.ts (9 testes, contra o banco ao vivo)"
        status: pass
      - kind: manual
        ref: "Conferência humana ao vivo: filtro de SP caiu de 641 para 3 cidades (Osasco, Sao Paulo, São Paulo)"
        status: pass
    human_judgment: true
  - id: D2
    description: "Lista de cidades do filtro é do sistema inteiro (não escopada ao vendedor logado); RLS da listagem de clientes continua intacta"
    requirement: "QT-H8A-02"
    verification:
      - kind: integration
        ref: "tests/clientes/cidades-com-clientes.test.ts — Vendedor A vê cidade de cliente do Vendedor B; contraprova de que select direto em clientes como Vendedor A não devolve a linha do Vendedor B"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cadastro/edição de cliente continua com a lista completa do IBGE"
    requirement: "QT-H8A-03"
    verification:
      - kind: manual
        ref: "Conferência humana ao vivo: formulário Novo cliente, Estado=SP, Cidade lista 641 municípios (inalterado)"
        status: pass
    human_judgment: true
  - id: D4
    description: "Estado sem nenhum cliente mostra Cidade vazia com mensagem de vazio, sem erro"
    requirement: "QT-H8A-04"
    verification:
      - kind: manual
        ref: "Conferência humana ao vivo: Estado=AC (sem clientes), Cidade mostra 'Nenhuma cidade encontrada'"
        status: pass
    human_judgment: true

duration: ~1h (incluindo troubleshooting de isolamento de worktree)
completed: 2026-08-06
status: complete
---

# Quick Task 260806-h8a: Corrigir filtro de Cidade Summary

**O filtro de Cidade na tela de Clientes agora mostra só as cidades que já têm cliente cadastrado (confirmado ao vivo: 641 → 3 cidades em SP), enquanto o cadastro de cliente continua com a lista completa do IBGE.**

## Performance

- **Duration:** ~1h
- **Tasks:** 4/4 (2 checkpoints humanos aprovados)
- **Files modified:** 6 (1 migration nova, 1 RPC nova, 1 leitor tipado novo, 2 arquivos de teste novos, 2 arquivos existentes editados)

## Accomplishments
- Nova RPC `cidades_com_clientes_por_estado(p_uf)` (migration 0012), `SECURITY DEFINER` escopada ao mínimo absoluto (só nomes de cidade), aplicada em produção via `supabase db push` e confirmada com 9 testes de integração passando contra o banco real.
- `lib/clientes/cidadesComClientes.ts` — leitor tipado consumido apenas pelo `FiltersPopover.tsx`.
- `FiltersPopover.tsx` religado à nova fonte; `EstadoCidadeFields.tsx` (cadastro/edição) permanece intocado, confirmado tanto pelo diff quanto por conferência ao vivo no navegador.
- Conferência humana completa: lista do filtro encurtou de 641 para 3 cidades em SP; Estado sem cliente mostra "Nenhuma cidade encontrada" sem erro; cadastro continua com as 641 cidades do IBGE.

## Task Commits

1. **Task 1: Migration 0012 + teste de integração** — `8aa800d`
2. **Task 3: Leitor tipado + ligar FiltersPopover** — `7608573`

Merged into master via `b1f9497`.

## Checkpoints humanos

- **Task 2** (aplicar em produção): SQL revisado e apresentado ao usuário; aprovado; `supabase db push` rodado pelo orquestrador; 9/9 testes de integração passaram contra o banco ao vivo.
- **Task 4** (conferência final): `npm test`/`tsc`/`lint`/`build` rodados e reportados (nenhuma falha nova fora do ruído já conhecido de rate-limit do Supabase Auth); conferência visual ao vivo no navegador confirmando os 4 comportamentos esperados; aprovado pelo usuário.

## Deviations from Plan

**Isolamento de worktree do subagente executor não sobreviveu à pausa do checkpoint.** O plano previa que o mesmo agente executor pausasse na Task 2 e fosse retomado no MESMO worktree após a aprovação. Na prática, cada chamada de `Agent(isolation="worktree")` provisiona um worktree NOVO — não é possível "reentrar" no worktree de uma execução anterior já finalizada. Isso gerou uma sequência de tentativas (um subagente corretamente recusou prosseguir sem conseguir verificar de forma independente que o checkpoint anterior fora aprovado — comportamento correto dado que a aprovação estava sendo apenas relatada, não verificável por ele). Resolução: o orquestrador terminou as Tasks 3 e 4 diretamente, no mesmo worktree onde a Task 1 e o `db push` já tinham acontecido, evitando tanto a perda de contexto quanto o risco de editar `master` sem isolamento.

**Servidor de desenvolvimento próprio para a conferência visual.** Como o worktree tinha código ainda não mesclado em `master`, a conferência ao vivo precisou de um `next dev` rodando a partir do próprio worktree (porta 3001, não a porta 3000 usada pelo checkout principal) — cookies de sessão são compartilhados entre portas do mesmo `localhost`, então o login não precisou ser refeito.

## Issues Encountered

Nenhuma falha de teste nova fora do conjunto já documentado de arquivos dependentes de Supabase ao vivo (rate-limit do Auth) — incluindo o próprio teste novo desta tarefa, que passou 9/9 quando rodado isolado logo após o push, mas apareceu na lista de falhas quando rodado dentro da suíte completa (mesma causa ambiental, não regressão).

## User Setup Required

None — a migration já foi aplicada em produção como parte desta tarefa, com aprovação explícita do usuário.

## Next Phase Readiness

- Filtro de Cidade corrigido e no ar; nada pendente relacionado a este todo.
- O todo original (`.planning/todos/pending/2026-08-06-filtro-de-cidade-mostra-todas-as-cidades-do-brasil-em-vez-de.md`) deve ser removido/arquivado como resolvido.
- Terceira exceção de `SECURITY DEFINER` do projeto registrada — próximas fases que precisarem de padrão semelhante (dado agregado do sistema inteiro, sem vazar linha) têm este precedente pra seguir.

---
*Phase: 260806-h8a*
*Completed: 2026-08-06*
