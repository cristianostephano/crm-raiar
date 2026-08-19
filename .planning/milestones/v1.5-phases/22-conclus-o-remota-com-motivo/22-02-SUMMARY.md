---
phase: 22-conclus-o-remota-com-motivo
plan: 02
subsystem: frontend
tags: [server-actions, react, supabase, editable-lists]

# Dependency graph
requires:
  - phase: 22-conclus-o-remota-com-motivo
    plan: 01
    provides: "tabela motivos_conclusao_remota (6ª lista editável) com RLS 4-policy, migration 0022 já em produção"
provides:
  - "ListaTabela union com o 6º nome (motivos_conclusao_remota), reusado sem nenhuma linha de CRUD nova"
  - "6ª aba 'Motivos de conclusão remota' em Configurações, painel mantido montado"
  - "revalidatePath(\"/agenda\") nas 3 ações de escrita de lista (criar/renomear/ativar-desativar)"
  - "getMotivosConclusaoRemotaAtivos() em lib/supabase/queries/clientes.ts — leitura de catálogo (só ativos, ordenado por nome)"
affects: [22-03-plano-tela-conclusao-remota]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registro de lista editável nova continua exigindo 3 lugares (migration, união ListaTabela, aba) — 4º lugar novo neste plano: revalidatePath da rota que passa a consumir a lista (aqui, /agenda)"

key-files:
  created:
    - tests/configuracoes/configuracoes-tabs.test.tsx
    - tests/configuracoes/motivos-conclusao-remota-catalogo.test.ts
  modified:
    - app/actions/listas.ts
    - components/configuracoes/ConfiguracoesTabs.tsx
    - lib/supabase/queries/clientes.ts

key-decisions:
  - "CONC-03 deixado como Pending em REQUIREMENTS.md após este plano (não marcado Complete) — mesma convenção já travada nas Fases 9-01/19-01/22-01: o Supervisor já consegue administrar a lista pela 6ª aba, mas o requisito só fica funcionalmente coberto quando o plano 22-03 fiar o campo de escolha do Vendedor na tela de conclusão."
  - "O script mecânico do bloco <verify> do Task 1 conta ocorrências textuais de 'tabela:' esperando exatamente 6 — mas essa contagem já incluía (mesmo antes deste plano) a linha da anotação de tipo do array TABS, não só as entradas. Com a 6ª entrada acrescentada o total real passa a ser 7 (6 entradas + 1 linha de tipo). Verificado manualmente com uma contagem mais estreita ('tabela: \"') que confirma exatamente 6 entradas reais — documentado como defeito pré-existente do próprio script de verificação, não do código."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "ListaTabela ganha o 6º nome sem nenhuma linha nova nas 4 ações genéricas de CRUD"
    requirement: "CONC-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit + npx eslint (limpos)"
        status: pass
      - kind: manual
        ref: "grep confirma zero condição por nome de tabela nas 4 ações"
        status: pass
    human_judgment: false
  - id: D2
    description: "6ª aba 'Motivos de conclusão remota' em Configurações, painel mantido montado, mesmos gestos das outras cinco"
    requirement: "CONC-03"
    verification:
      - kind: unit
        ref: "tests/configuracoes/configuracoes-tabs.test.tsx (3 casos: seisabas, ordem, ligada)"
        status: pass
    human_judgment: false
  - id: D3
    description: "As 3 ações de escrita de lista revalidam /agenda além de /configuracoes e /clientes"
    requirement: "CONC-03"
    verification:
      - kind: manual
        ref: "grep confirma 3 ocorrências de revalidatePath(\"/agenda\") em app/actions/listas.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "getMotivosConclusaoRemotaAtivos() devolve só ativos, ordenado por nome, sem checagem de papel — provado com sessão de Vendedor contra o banco real"
    requirement: "CONC-03"
    verification:
      - kind: integration
        ref: "tests/configuracoes/motivos-conclusao-remota-catalogo.test.ts (4 casos: sementes, vendedor, ordem, desativado — contra o banco real)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-19
status: complete
---

# Phase 22 Plan 2: Configurações e Catálogo dos Motivos de Conclusão Remota Summary

**A 6ª lista editável (`motivos_conclusao_remota`, criada no plano 22-01) agora é administrável pelo Supervisor numa nova aba de Configurações, com a Agenda passando a ser revalidada em toda escrita de lista, e a leitura de catálogo que o plano 22-03 vai consumir já provada contra o banco real com sessão de Vendedor.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-19
- **Tasks:** 2/2
- **Files created:** 2 (arquivos de teste)
- **Files modified:** 3

## Accomplishments

- `ListaTabela` (`app/actions/listas.ts`) ganhou o 6º nome, `motivos_conclusao_remota`, sem nenhuma linha nova nas 4 ações genéricas de CRUD (listar/criar/renomear/ativar-desativar) — elas já eram parametrizadas pelo nome da tabela.
- As 3 ações de escrita (criar, renomear, ativar/desativar) agora também `revalidatePath("/agenda")`, além das duas rotas que já revalidavam — um motivo criado/renomeado/desativado pelo Supervisor passa a refletir no diálogo de conclusão da Agenda sem recarga completa.
- `ConfiguracoesTabs.tsx` ganhou a 6ª aba "Motivos de conclusão remota" (texto literal do requisito), reusando o mesmo `EditableListTab` genérico e mantida montada como as outras cinco.
- `getMotivosConclusaoRemotaAtivos()` (`lib/supabase/queries/clientes.ts`) — irmã literal de `getMotivosPerdaAtivos`: sem argumentos, filtra por ativo, ordena por nome, sem checagem de papel (a RLS da migration 0022 já é a fronteira).
- `tests/configuracoes/configuracoes-tabs.test.tsx` (3 casos, ambiente jsdom): as 6 abas aparecem, na ordem certa, e cada uma busca sua própria tabela (prova indireta de que o painel continua montado).
- `tests/configuracoes/motivos-conclusao-remota-catalogo.test.ts` (4 casos, contra o banco real): os 5 valores de partida da migration aparecem ativos, um Vendedor recebe o catálogo não vazio, a ordem é alfabética, e um valor desativado some do catálogo sem ser apagado.

## Task Commits

1. **Task 1: Registrar a 6ª lista editável — união de nomes, aba de Configurações e revalidação da Agenda** - `5584d61` (feat)
2. **Task 2: Leitura de catálogo dos motivos ativos + prova contra o banco real** - `a6b6323` (feat)

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified

- `app/actions/listas.ts` - `ListaTabela` com o 6º nome; comentário do bloco atualizado; `revalidatePath("/agenda")` nas 3 ações de escrita
- `components/configuracoes/ConfiguracoesTabs.tsx` - 6ª entrada em `TABS` (rótulo literal "Motivos de conclusão remota"); comentário do topo atualizado
- `lib/supabase/queries/clientes.ts` - `getMotivosConclusaoRemotaAtivos()` nova, ao lado de `getMotivosPerdaAtivos`
- `tests/configuracoes/configuracoes-tabs.test.tsx` - novo, 3 casos (seisabas, ordem, ligada)
- `tests/configuracoes/motivos-conclusao-remota-catalogo.test.ts` - novo, 4 casos (sementes, vendedor, ordem, desativado)

## Decisions Made

- CONC-03 deixado como **Pending** em REQUIREMENTS.md — mesma convenção das Fases 9-01/19-01/22-01 para requisitos multi-plano: o Supervisor já administra a lista, mas o requisito só fecha funcionalmente quando o plano 22-03 fiar o campo de escolha do Vendedor.
- Nenhuma checagem de papel na leitura de catálogo nova — a RLS aberta a `authenticated` (migration 0022) é a fronteira real, mesma postura de `getMotivosPerdaAtivos`/`getFrequenciasPedidoAtivas`.

## Deviations from Plan

### Auto-fixed Issues

None — nenhum bug ou funcionalidade crítica ausente foi encontrado durante a execução.

### Verification script note (not a code deviation)

O script mecânico embutido no `<verify>` do Task 1 conta ocorrências textuais de `tabela:` em `ConfiguracoesTabs.tsx` esperando exatamente 6. Essa contagem sempre incluiu a linha de anotação de tipo do array `TABS` (`tabela: ListaTabela`) junto com as entradas reais — antes deste plano, 5 entradas + 1 linha de tipo já somavam 6, por coincidência batendo com o valor esperado pelo script. Com a 6ª entrada acrescentada, o total real passa a ser 7, e o script literal (`(c.match(/tabela:/g)||[]).length!==6`) reportaria erro mesmo com o código correto. Confirmado manualmente com uma contagem mais estreita (`tabela: "` — só entradas reais, não a anotação de tipo) que o array tem exatamente 6 entradas, e reforçado pelo caso `ligada` do teste automatizado (prova que exatamente 6 tabelas distintas são buscadas). Nenhuma mudança de código foi necessária; documentado aqui para quem revisar o histórico do plano.

## Issues Encountered

None.

## User Setup Required

None — nenhuma migration nova, nenhuma configuração externa. A tabela `motivos_conclusao_remota` já estava em produção desde o plano 22-01.

## Next Phase Readiness

- O plano 22-03 já tem `getMotivosConclusaoRemotaAtivos()` publicada para alimentar o campo de escolha de motivo do diálogo de conclusão remota, e a rota `/agenda` já é revalidada em toda escrita de lista — nenhuma fiação extra necessária do lado de Configurações.
- Nenhum bloqueio conhecido para o 22-03.

---
*Phase: 22-conclus-o-remota-com-motivo*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `app/actions/listas.ts`
- FOUND: `components/configuracoes/ConfiguracoesTabs.tsx`
- FOUND: `lib/supabase/queries/clientes.ts`
- FOUND: `tests/configuracoes/configuracoes-tabs.test.tsx`
- FOUND: `tests/configuracoes/motivos-conclusao-remota-catalogo.test.ts`
- FOUND: commit `5584d61` in git log
- FOUND: commit `a6b6323` in git log
