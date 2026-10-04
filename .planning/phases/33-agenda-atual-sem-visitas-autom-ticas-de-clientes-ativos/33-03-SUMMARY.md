---
phase: 33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos
plan: 03
subsystem: ui
tags: [react, nextjs, vitest, agenda, importacao]

requires:
  - phase: 33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos
    provides: migration 0049 escrita (plano 33-01) e testes ajustados (plano 33-02)
provides:
  - AgendaList sem a segunda leitura e sem a secao de clientes ativos sem dia fixo (D-32)
  - texto do vazio da Agenda falando so de prospeccao
  - aviso da importacao de ativos apontando para a ficha do cliente
  - vazio de Clientes sem a promessa de que ganhos aparecem na Agenda
affects: [33-04]

tech-stack:
  added: []
  patterns:
    - "Desligar funcionalidade removendo so a fiacao no ponto de uso e deixando as pecas dormentes sem edicao (volta = reverter um commit)"

key-files:
  created: []
  modified:
    - components/agenda/AgendaList.tsx
    - tests/agenda/agenda-list.test.tsx
    - components/importacao/AtivoImportSummary.tsx
    - tests/importacao/ativo-import-summary.test.tsx
    - app/(app)/clientes/page.tsx
    - app/actions/clientes.ts
    - lib/importacao/typesAtivo.ts

key-decisions:
  - "Mantido o vi.mock e a constante mockedSemDiaFixo em agenda-list.test.tsx (a pesquisa sugeria remover): sem o mock nao da para afirmar que a acao nunca e chamada"
  - "Ramo de visita de handleConfirmarConclusao e tipo AgendaOrigem mantidos: o historico concluido do calendario ainda usa origem visita (D-33)"
  - "Texto de apoio do dia fixo na ficha do cliente (ClienteDetailSheet) fica de fora, vira nota para o dono no 33-04 (decisao 1 do orquestrador, D-37)"

patterns-established:
  - "Comentario de cabecalho registra como voltar atras (o que recolocar ou qual commit reverter)"

requirements-completed: []  # AGD-16 NAO marcado aqui, de proposito: fecha no plano 33-04

duration: 5min
completed: 2026-10-04
status: complete
---

# Phase 33 Plan 03: Agenda atual sem a secao de dia fixo (tela e textos) Summary

**AgendaList deixou de buscar e de mostrar a secao "Sem dia fixo definido" (so a fiacao saiu, nenhuma peca foi apagada) e os textos de tela que prometiam essa secao ou "ganhos na Agenda" foram corrigidos.**

## Performance

- **Duration:** cerca de 5 min
- **Completed:** 2026-10-04
- **Tasks:** 2 de 2
- **Files modified:** 7 (nenhum criado)

## Accomplishments

- A Agenda atual nao chama mais `getClientesSemDiaFixoAction` e nao renderiza a secao, nem na Lista nem no Calendario. Provado por teste: a acao nunca e chamada.
- Lista, secoes Atrasado/Hoje/Proximos, filtro de vendedor, conclusao (os dois caminhos) e Calendario seguem iguais: os demais casos de `agenda-list` e os testes de calendario passam sem edicao de logica.
- Textos corrigidos: vazio da Agenda ("Nenhuma tarefa de prospeccao pendente no momento."), aviso fixo da conclusao da importacao de ativos (manda definir frequencia na ficha do cliente), vazio de Clientes (sem a frase sobre ganhos na Agenda).
- `app/actions/clientes.ts` e `lib/importacao/typesAtivo.ts` mudaram so em comentario (checado contra o HEAD; os dois `revalidatePath` continuam).

## Task Commits

1. **Tarefa 1 RED:** `9799582` test(33-03): add failing tests for agenda without dia-fixo section and prospeccao-only empty text (os dois casos novos falharam antes do componente mudar)
2. **Tarefa 1 GREEN:** `0db2139` feat(33-03): remove dia-fixo section wiring from AgendaList and make empty text prospeccao-only
3. **Tarefa 2:** `10305aa` fix(33-03): correct screen texts that promised the removed Agenda dia-fixo section

**Commit a reverter se o dono quiser a secao de volta: `0db2139`** (feat(33-03) da AgendaList).

## Verificacao

- `npx vitest run tests/agenda/agenda-list.test.tsx tests/agenda/agenda-calendario-integracao.test.tsx tests/agenda/sem-dia-fixo.test.tsx tests/agenda/clientes-sem-dia-fixo-query.test.ts`: 4 arquivos, 36 testes, verde.
- `npx vitest run tests/importacao/ativo-import-summary.test.tsx`: 5 testes, verde.
- `npx tsc --noEmit` e `npx eslint` nos arquivos tocados: limpos.
- Checagens por script do plano (fiacao removida, pecas dormentes presentes, textos corrigidos, so comentario): OK.

## Pecas dormentes (intocadas, sem nenhum commit `(33-` e sem diferenca contra 5476c70)

- `components/agenda/AgendaSemDiaFixo.tsx`
- `lib/supabase/queries/agenda.ts` (`getClientesSemDiaFixo`)
- `app/actions/agenda.ts` (`getClientesSemDiaFixoAction`)
- `lib/agenda/itens.ts` (tipos/rotulos)
- `tests/agenda/sem-dia-fixo.test.tsx`
- `tests/agenda/clientes-sem-dia-fixo-query.test.ts`

`tests/agenda/agenda-calendario-integracao.test.tsx` tambem nao foi editado (o `vi.mock` dele ainda lista a acao dormente, inofensivo).

## Deviations from Plan

None - plan executed as written. Um deslize de execucao sem efeito no resultado: a primeira escrita do comentario de cabecalho perdeu os nomes entre crases (o shell interpretou as crases); corrigido com Edit antes do commit da Tarefa 1.

## Notas para o dono (linguagem simples)

- A caixinha "Sem dia fixo definido" some da Agenda; nada foi apagado, ela pode voltar (reverter o commit `0db2139`).
- Ainda existe, na ficha do cliente (`components/clientes/ClienteDetailSheet.tsx`, ~linha 1318), um texto de apoio sobre dia fixo que nao foi mexido de proposito (decisao 1 do orquestrador). Fica para o dono decidir no plano 33-04.
- Estado intermediario inofensivo: tela nova + banco antigo = visitas ainda aparecem, sem a caixinha; banco novo + tela antiga = sem visitas, com a caixinha.

## Privacidade (LGPD)

A mudanca reduz leitura de dados de clientes (a Agenda deixa de buscar a lista de clientes ativos sem dia fixo a cada abertura), alinhada a minimizacao/privacidade por padrao. Nenhuma tabela, politica de acesso (RLS) ou dado pessoal novo foi criado; a regra de acesso nao mudou.

## Known Stubs

None.

## Threat Flags

None. Nenhuma superficie nova; T-33-12 mitigado (checagem "so comentario" em `app/actions/clientes.ts`).

## Self-Check: PASSED

- Commits `9799582`, `0db2139`, `10305aa` existem no historico.
- Os 7 arquivos listados em key-files foram modificados nesses commits; `.planning/config.json` nao foi commitado.
