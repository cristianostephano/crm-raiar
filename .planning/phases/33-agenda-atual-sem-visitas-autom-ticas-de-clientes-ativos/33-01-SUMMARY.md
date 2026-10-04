---
phase: 33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos
plan: 01
subsystem: database
tags: [postgres, supabase, migration, agenda, vitest]

requires:
  - phase: 29-encerrar-cliente-ativo
    provides: agenda_do_vendedor() com filtro de encerrado (migration 0036), que a 0049 reaproveita
provides:
  - migration 0049 (escrita, NAO aplicada) que faz agenda_do_vendedor() devolver so prospeccao
  - arquivo de volta supabase/rollbacks/0049_volta_agenda_do_vendedor.sql (nunca aplicado automaticamente)
  - teste estrutural verde da 0049 e do arquivo de volta (sem banco)
  - teste ao vivo L1-L6, vermelho ate o plano 33-04 aplicar a 0049
affects: [33-02, 33-03, 33-04]

tech-stack:
  added: []
  patterns:
    - "Troca de corpo de funcao por create or replace com assinatura identica, provada por teste estrutural"
    - "Arquivo de volta em supabase/rollbacks, fora do caminho do CLI, com cabecalho NAO APLICAR"

key-files:
  created:
    - supabase/migrations/0049_agenda_atual_so_prospeccao.sql
    - supabase/rollbacks/0049_volta_agenda_do_vendedor.sql
    - tests/agenda/agenda-sem-visitas-migracao.test.ts
    - tests/agenda/agenda-sem-visitas-automaticas.test.ts
  modified: []

key-decisions:
  - "0049 e migration nova (a 0036 nao foi tocada), mesma assinatura e 10 colunas, sem sobrecarga e sem remover a funcao antes"
  - "Metade de prospeccao copiada textualmente da 0036 (filtro de encerrado e order by 8, 4 incluidos), provado por teste"
  - "Arquivo de volta fica fora de supabase/migrations para o CLI nunca o aplicar"

patterns-established:
  - "Cabecalho de migration so em bloco barra-asterisco e ASCII (colagem no SQL Editor nao quebra)"

requirements-completed: []  # AGD-16 so fecha no plano 33-04 (dono aplica a 0049 e os testes ao vivo ficam verdes). NAO marcado aqui, de proposito.

duration: 9min
completed: 2026-10-04
status: complete
---

# Phase 33 Plan 01: Migration 0049 (Agenda so com prospeccao) Summary

**Migration 0049 escrita e NAO aplicada: agenda_do_vendedor() passa a devolver so a metade de prospeccao da 0036 (mesma assinatura e 10 colunas), com arquivo de volta fora do CLI e prova estrutural verde mais prova ao vivo pronta.**

## Base de execucao da Fase 33

Saida de `git rev-parse HEAD` tirada antes de qualquer edicao (usada pela guarda de escopo final do plano 33-04):

```
5476c7045c4442dc4d6f95d1960d151743d4b1ce
```

## Performance

- **Duration:** cerca de 9 min
- **Completed:** 2026-10-04
- **Tasks:** 2 de 2
- **Files modified:** 4 criados, 0 existentes alterados

## Accomplishments

- A 0049 recria `agenda_do_vendedor()` so com a metade de prospeccao. Lista, pendentes do Calendario e selo do menu leem esta mesma funcao, entao os tres vao mudar juntos quando a migration for aplicada (no 33-04).
- Prova por construcao de que a prospeccao nao muda: o corpo da 0049 e, depois de normalizar espacos, igual ao corpo da 0036 ate o `union all` mais `order by 8, 4;`.
- Nenhum comando de escrita, remocao, permissao ou elevacao de privilegio na 0049; nao cita as funcoes de escrita (D-34). Nenhuma migration existente foi modificada.
- Arquivo de volta com o bloco da 0036 identico caractere a caractere, em `supabase/rollbacks/` (fora do caminho do CLI), com cabecalho NAO APLICAR.
- Teste ao vivo L1-L6 escrito (um vendedor descartavel, um unico login, leitura global so por contagem, nada impresso, dados inventados).

## Task Commits

1. **Tarefa 1 (RED):** `de5db0b` - test(33-01): add failing structural test for migration 0049 and rollback file (7 casos falhando)
2. **Tarefa 1 (GREEN):** `8f54e36` - feat(33-01): add migration 0049 and rollback file (7 casos verdes)
3. **Tarefa 1 (ajuste de lint):** `f65f360` - chore(33-01): drop unused eslint directive in structural test
4. **Tarefa 2:** `ac9515b` - test(33-01): add live test L1-L6 for agenda without automatic visits

## Resultados dos testes

- `npx vitest run tests/agenda/agenda-sem-visitas-migracao.test.ts tests/agenda2/migracao-agenda2.test.ts`: 2 arquivos, 20 testes, todos verdes. Houve rodada vermelha antes da 0049 (7 de 7 falhando). `tests/agenda2/migracao-agenda2.test.ts` ficou verde sem nenhuma edicao (inventario de 11 funcoes com elevacao intacto).
- `git diff --name-status 5476c70 HEAD -- supabase/migrations`: uma unica linha, `A` da 0049.
- `npx tsc --noEmit` e `npx eslint` do teste ao vivo: limpos. A checagem estrutural do enunciado do plano para o teste ao vivo deu OK.
- **AVISO: `tests/agenda/agenda-sem-visitas-automaticas.test.ts` fica VERMELHO ate o plano 33-04 aplicar a 0049 no banco.** Isso e esperado e nao e falha deste plano. Ele NAO foi executado neste plano (o banco de teste e o de producao; a 0049 nao foi aplicada).

## Decisions Made

- Migration nova 0049 (CLAUDE.md: nunca editar migration ja aplicada); `create or replace` sem `drop function`, para nao criar sobrecarga ambigua no PostgREST.
- Arquivo de volta em `supabase/rollbacks/` (decisao do orquestrador), para o CLI nunca o aplicar sozinho.
- Cabecalhos so em bloco barra-asterisco e ASCII, sem linhas iniciadas por dois hifens (colagem no SQL Editor ja quebrou a 0042).

## Deviations from Plan

**1. [Rule 1 - Bug] Diretiva eslint-disable desnecessaria no teste estrutural**
- **Found during:** Tarefa 1 (lint)
- **Issue:** `eslint-disable-next-line no-control-regex` gerava aviso de diretiva nao usada.
- **Fix:** diretiva removida.
- **Files modified:** tests/agenda/agenda-sem-visitas-migracao.test.ts
- **Commit:** f65f360

Fora isso, plano executado como escrito. Nenhum desvio de arquitetura, nenhuma dependencia nova.

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: a 0049 nao adiciona endpoint, caminho de autenticacao nem alteracao de schema; so troca o corpo de uma funcao de leitura que continua com as permissoes de quem chama.

## Notas para o dono (linguagem simples)

Preparamos a troca da leitura da Agenda e o botao de desfazer. Nada foi aplicado no banco e nada foi enviado ao GitHub ainda; a aplicacao e no plano 33-04, com sua autorizacao. Os testes novos usam so dados inventados e um vendedor temporario que e apagado no fim (LGPD).

## Self-Check: PASSED

- supabase/migrations/0049_agenda_atual_so_prospeccao.sql: encontrado
- supabase/rollbacks/0049_volta_agenda_do_vendedor.sql: encontrado
- tests/agenda/agenda-sem-visitas-migracao.test.ts: encontrado
- tests/agenda/agenda-sem-visitas-automaticas.test.ts: encontrado
- Commits de5db0b, 8f54e36, f65f360, ac9515b: encontrados
