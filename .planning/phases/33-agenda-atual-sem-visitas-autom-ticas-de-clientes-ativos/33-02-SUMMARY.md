---
phase: 33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos
plan: 02
subsystem: testing
tags: [vitest, supabase, agenda, regression-oracle]

requires:
  - phase: 33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos
    provides: migration 0049 escrita (plano 33-01), que faz agenda_do_vendedor() devolver so prospeccao
provides:
  - encerrados-rpc e dia-fixo-visita esperando a regra nova (visita guardada, fora da Agenda atual)
  - agenda-rpc e concluir-rpc sem afirmacao falsa sobre visita na Agenda (nao executaveis ate a decisao das contas semente)
  - prova bloco a bloco de que nenhum outro caso desses quatro arquivos mudou
affects: [33-03, 33-04]

tech-stack:
  added: []
  patterns:
    - "Edicao de proposito de teste com registro no cabecalho do arquivo e no SUMMARY"
    - "Comparacao bloco a bloco com git show HEAD:<arquivo> para provar que o oraculo de regressao nao foi tocado"

key-files:
  created: []
  modified:
    - tests/funil/encerrados-rpc.test.ts
    - tests/clientes/dia-fixo-visita.test.ts
    - tests/agenda/agenda-rpc.test.ts
    - tests/agenda/concluir-rpc.test.ts

key-decisions:
  - "Bloco F de dia-fixo-visita passa a filtrar a leitura da agenda por cliente_id do cliente de teste (nunca baixa a agenda real inteira pelo cliente de servico)"
  - "Import de date-fns e helper hojeSaoPaulo removidos de concluir-rpc porque so o caso sugerida os usava"

patterns-established:
  - "Todo caso editado de proposito continua provando que a visita existe guardada em visitas, so nao aparece na Agenda atual"

requirements-completed: []  # AGD-16 NAO marcado aqui, de proposito: fecha no plano 33-04 (0049 aplicada e testes ao vivo verdes)

duration: 3min
completed: 2026-10-04
status: complete
---

# Phase 33 Plan 02: Testes ajustados para a Agenda sem visitas automaticas Summary

**Cinco casos de quatro arquivos de teste editados de proposito para esperar que a visita pendente do cliente ativo fique guardada mas fora da Agenda atual, com comparacao bloco a bloco provando que todos os outros casos continuam identicos ao HEAD.**

## Performance

- **Duration:** cerca de 3 min
- **Completed:** 2026-10-04
- **Tasks:** 2 de 2
- **Files modified:** 4 (nenhum criado)

## Accomplishments

- Nenhum teste do repositorio afirma mais que a visita automatica aparece na Agenda atual (ROADMAP nota g; decisao 3 do orquestrador).
- Os casos editados continuam provando que a visita existe e fica guardada na tabela `visitas` (reativar mantem a MESMA visita pelo id; concluir cria a proxima), so nao aparece na Agenda (D-34).
- A tarefa de prospeccao do mesmo cliente continua afirmada como presente (D-36).
- `ganho-sem-frequencia-continua-bloqueado` (D-35) e todo o resto de encerrados-rpc fora dos dois casos editados ficou sem nenhuma edicao; `tests/clientes/frequencia-visita.test.ts` nao foi tocado.
- LGPD (T-33-08): o Bloco F reescrito deixou de baixar a agenda real inteira pelo cliente de servico e filtra por `cliente_id` do cliente de teste.

## Task Commits

1. **Tarefa 1:** `8fef680` - test(33-02): expect no automatic visit in Agenda for encerrados-rpc and dia-fixo-visita
2. **Tarefa 2:** `24b0265` - test(33-02): update seed-account agenda tests for agenda without automatic visits

## Casos por arquivo

### tests/funil/encerrados-rpc.test.ts (RODA hoje; fica VERMELHO ate o 33-04 aplicar a 0049)

Editados de proposito:
- `agenda-some`: antes de encerrar, exatamente 1 linha do cliente (origem `prospeccao`, item_id = id da tarefa), nenhuma com o id da visita, contagem exata 1; depois de encerrar, 0 linhas e contagem 0.
- `reativar-volta-agenda` renomeado para `reativar-mantem-visita-guardada`: apos reativar, nenhuma linha do cliente na agenda; `visitasPendentesDoCliente` tem 1 item e o id e o MESMO da visita semeada.
- Comentario de cabecalho com a frase da mudanca de proposito.

Oraculos intocados: todos os demais casos, em especial `ganho-sem-frequencia-continua-bloqueado`, `reativar-semeia-visita`, `reativar-sem-frequencia-restaura`, `reativar-outro-vendedor`; titulos de `describe` intactos.

### tests/clientes/dia-fixo-visita.test.ts (RODA hoje; fica VERMELHO ate o 33-04)

Editado de proposito:
- "Bloco F - agenda_do_vendedor mira o dia fixo..." virou "Bloco F - agenda_do_vendedor nao mostra mais a visita pendente do cliente ativo (Fase 33, D-34)": lista vazia para o cliente de teste (filtro por `cliente_id`) e a visita continua na tabela `visitas` com `data_realizada` nula.
- Comentario de cabecalho com a frase da mudanca de proposito.

Oraculos intocados: Blocos A-E (`proxima_data_visita`), "as duas colunas gravam e relêem o mesmo valor", "mover_card_funil semeia a primeira visita no dia fixo". `diaDaSemanaDe` continua em uso pelo caso de `mover_card_funil`.

### tests/agenda/agenda-rpc.test.ts (editado, nao executavel ate a decisao sobre as contas semente)

Editados de proposito: `origem` (tarefa presente com origem/titulo corretos; linha da visita indefinida), `cliente` (exatamente 1 linha, so a tarefa; laco de razao social/responsavel mantido), `ordem` (visita de ontem trocada por `ontemTarefa`; ordem esperada `[ontemTarefa, hojeTarefa, futuraTarefa]`, sem reordenar no teste). Cabecalho com a frase da Fase 33.

Oraculos intocados: `pendente`, `semdata`, `contagem`.

### tests/agenda/concluir-rpc.test.ts (editado, nao executavel ate a decisao sobre as contas semente)

Editados de proposito: `visita` (nem a visita fechada nem a proxima visita criada aparecem na agenda; a criacao continua, D-34), `sugerida` (nenhuma linha do cliente da visita; tarefa mantem `frequencia_visita` e `proxima_data_sugerida` nulas). Import de date-fns e `hojeSaoPaulo` removidos (so o `sugerida` os usava). Cabecalho com a frase da Fase 33.

Oraculos intocados: `resumocurto`, `resumovazio`, `resumolongo`, `tarefa`, `historico`, `nenhuma`, `semfrequencia`, `semdata`, `duplicada`.

## Estado esperado dos arquivos

| Arquivo | Estado hoje | Quando fica verde |
|---------|-------------|-------------------|
| tests/funil/encerrados-rpc.test.ts | VERMELHO (2 casos editados) | depois que o 33-04 aplicar a 0049 |
| tests/clientes/dia-fixo-visita.test.ts | VERMELHO (1 caso editado) | depois que o 33-04 aplicar a 0049 |
| tests/agenda/agenda-rpc.test.ts | nao executavel (contas semente apagadas em 2026-08-19) | so apos a decisao sobre as contas semente |
| tests/agenda/concluir-rpc.test.ts | nao executavel (contas semente) | so apos a decisao sobre as contas semente |

Nenhum dos casos ao vivo foi executado neste plano (o banco de teste e o de producao e a 0049 nao foi aplicada).

## Verificacao

- `npx tsc --noEmit`: limpo apos cada tarefa.
- `npx eslint` nos quatro arquivos: limpo (nenhum import ou helper sem uso).
- Comparacao bloco a bloco com `git show HEAD:<arquivo>` (feita antes de cada commit): so os casos listados mudaram; o filtro por `cliente_id` no Bloco F e o nome `reativar-mantem-visita-guardada` e `ontemTarefa` presentes.
- `git diff --name-status 5476c70 HEAD -- tests`: so os quatro arquivos deste plano (M) mais os dois testes novos do 33-01 (A); `frequencia-visita.test.ts` e demais oraculos ausentes da lista.

## Deviations from Plan

None - plano executado como escrito.

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: so testes foram editados; nenhuma superficie nova.

## Notas para o dono (linguagem simples)

Atualizamos as provas automaticas que diziam que as visitas apareciam na Agenda; as que conferem a prospeccao nao foram mexidas. Duas dessas provas vao ficar vermelhas ate a mudanca da Agenda ser aplicada no banco (plano 33-04) - isso e esperado. As outras duas dependem de contas de teste antigas que foram apagadas e ja nao rodavam. Nada foi enviado ao GitHub nem ao banco.

## Self-Check: PASSED

- tests/funil/encerrados-rpc.test.ts: encontrado (contem reativar-mantem-visita-guardada)
- tests/clientes/dia-fixo-visita.test.ts: encontrado
- tests/agenda/agenda-rpc.test.ts: encontrado (contem ontemTarefa)
- tests/agenda/concluir-rpc.test.ts: encontrado (contem "Fase 33")
- Commits 8fef680, 24b0265: encontrados
