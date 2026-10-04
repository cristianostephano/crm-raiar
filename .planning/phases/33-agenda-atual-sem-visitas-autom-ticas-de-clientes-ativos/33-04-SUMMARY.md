---
phase: 33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos
plan: 04
subsystem: database
tags: [supabase, migration, agenda, rls, vitest, lgpd]

requires:
  - phase: 33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos
    provides: migration 0049 escrita (33-01), testes ajustados (33-02), tela sem a secao de dia fixo (33-03)
provides:
  - migration 0049 aplicada no banco hospedado pelo dono (SQL Editor)
  - testes ao vivo L1-L6, encerrados-rpc e dia-fixo-visita verdes contra o banco real
  - guarda de escopo, tsc, lint e build limpos para a fase inteira
  - instrucao staging para master, itens adiados e caminho de volta atras
affects: [STATE, deploy da fase 33 para master]

tech-stack:
  added: []
  patterns:
    - "Mudanca de leitura no banco unico: tela nova primeiro na staging, dono aplica a migration, testes ao vivo, so depois master"

key-files:
  created: []
  modified: []

key-decisions:
  - "Nenhum teste nem migration precisou de correcao depois da aplicacao: a 0049 funcionou como escrita (nenhuma 0050)"
  - "AGD-16 fechado neste plano, com os 5 criterios provados contra o banco real"

patterns-established:
  - "Gate final de fase usa lista explicita de arquivos (nao a suite inteira), porque cerca de 49 arquivos de teste ao vivo estao vermelhos por contas semente apagadas (fora do escopo, ja conhecido)"

requirements-completed: [AGD-16]

duration: sessao em tres partes (decisao, aplicacao pelo dono, verificacao)
completed: 2026-10-04
status: complete
---

# Phase 33 Plan 04: Aplicacao da 0049 e prova contra o banco real Summary

**A 0049 (Agenda atual so com prospeccao) foi aplicada pelo dono no SQL Editor e os 58 casos ao vivo passaram de vermelho para verde sem editar teste algum; guarda de escopo, 321 testes do gate, tsc, lint e build estao limpos.**

## Resposta do dono (Tarefa 1, checkpoint:decision)

O dono respondeu **"Aplicar"** depois de ver, em linguagem simples, o texto completo do checkpoint, que ele reconheceu:

- A mudanca vale na hora para o time inteiro (staging e producao usam o mesmo banco).
- O numero ao lado de "Agenda" no menu cai bastante (passa a contar so prospeccao).
- No filtro "Vendedor" do Supervisor, quem so tinha visitas deixa de aparecer.
- Nada e apagado: as visitas automaticas continuam sendo criadas por baixo, escondidas. Se um dia voltar a Agenda atual, as acumuladas aparecem de uma vez, muitas atrasadas.
- Volta atras: colar `supabase/rollbacks/0049_volta_agenda_do_vendedor.sql` no SQL Editor (NAO aplicado) e reverter o commit `0db2139` (AgendaList) para a caixinha "Sem dia fixo definido" voltar.
- Nota sobre o texto de apoio do dia fixo na ficha do cliente (fica como esta, decisao futura).
- Alerta de LGPD: visitas escondidas continuam sendo guardadas sem prazo de retencao; decisao e do dono como controlador.
- Dados reais nos testes: os testes criam vendedor e clientes temporarios com nomes inventados, limpam tudo e nunca imprimem linhas reais.

O pedido de envio de 33-01 a 33-03 para `staging` foi feito ao orquestrador. Nenhum push pelo executor.

## Pre-condicao de staging e aplicacao (Tarefa 2, checkpoint:human-action)

- Orquestrador enviou 33-01..33-03 para `origin/staging` (HEAD `c78c937`). Conferido (`git fetch origin staging` + `git merge-base --is-ancestor 0db2139 origin/staging`): **verdadeiro**. `0db2139` e o commit `feat(33-03)` da AgendaList.
- Caminho de aplicacao: **SQL Editor da Supabase, pelo proprio dono** (corpo da `0049_agenda_atual_so_prospeccao.sql` sem o comentario de cabecalho). Resposta: **"Success. No rows returned"**.
- O arquivo de volta NAO foi aplicado. Nenhum `supabase db push` nem contorno pelo executor.
- Passo opcional sugerido ao dono: `supabase migration repair --status applied 0049` para o historico do CLI refletir a aplicacao manual. A 0049 e re-executavel (`create or replace function`), entao um push futuro nao quebra mesmo sem o repair.

## Testes ao vivo (Tarefa 3)

`npx vitest run tests/agenda/agenda-sem-visitas-automaticas.test.ts tests/funil/encerrados-rpc.test.ts tests/clientes/dia-fixo-visita.test.ts`

- **3 arquivos, 58 testes, todos verdes** (62 s) na primeira rodada apos a aplicacao. Eram os que estavam vermelhos ate a 0049 existir no banco.
- Inclui L1-L6, a trava de ganho (`ganho-sem-frequencia-continua-bloqueado`, D-35), a criacao escondida de visitas (D-34) e o caso de `mover_card_funil` em dia-fixo-visita.
- Premissa A1 (contagem com filtro na RPC): `sem-visita-global` passou como escrito, a alternativa prevista nao foi necessaria.
- **Nenhum teste foi alterado, nenhuma migration nova (0050) foi necessaria, nenhuma asserção de D-33 a D-37 foi tocada.** Limite de login do Supabase Auth nao atrapalhou.
- Nenhuma linha real foi lida ou impressa.

## Gate final da fase

| Verificacao | Resultado |
|-------------|-----------|
| Guarda de escopo | OK escopo da fase 33 |
| BASE impresso pela guarda | `5476c7045c4442dc4d6f95d1960d151743d4b1ce` (igual ao registrado em "Base de execucao da Fase 33" no 33-01-SUMMARY) |
| supabase/migrations desde a base | so `A` (apenas a 0049); nenhuma migration antiga editada |
| `app/actions/clientes.ts`, `lib/importacao/typesAtivo.ts` | so comentario |
| Vitest, lista explicita da fase (22 arquivos, inclui `tests/agenda2/migracao-agenda2.test.ts` com o inventario de 11) | 22 arquivos, 321 testes verdes |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |

Observacao: `.planning/config.json` segue modificado no working tree (pre-existente, fora desta fase, nao staged).

A suite completa NAO foi usada como gate: cerca de 49 arquivos de teste ao vivo estao vermelhos desde antes da fase por contas semente apagadas (problema conhecido, fora do escopo).

## Deviations from Plan

None - plan executed exactly as written. Nenhuma correcao de teste, nenhuma migration nova.

## Auth gates

Nenhum. O unico passo manual (aplicar a 0049) foi o checkpoint human-action planejado.

## Para o fim da fase (instrucoes ao orquestrador)

1. **Conferencia humana do Preview da staging, antes de qualquer envio para master.** Abrir o Preview da Vercel (projeto RAIAR) da branch `staging` e entrar como vendedor: (1) Agenda sem itens "Visita" pendentes e sem a caixinha "Sem dia fixo definido", prospeccao em Atrasado/Hoje/Proximos dias, numero do menu igual ao total da Lista; (2) modo "Mes": visitas ja concluidas continuam nos dias passados; (3) ficha de cliente ativo com frequencia e dia fixo editaveis; (4) Agenda 2 igual a antes. Depois como Supervisor, "Todos os vendedores": numero do menu bate com a Lista.
2. **Deploy:** somente depois do Preview conferido, levar a fase para `master` (CLAUDE.md, Fluxo de Deploy). O banco ja esta com a 0049; o site real esta num meio-termo inofensivo (sem visitas automaticas, ainda com a caixinha) ate o merge.
3. **Voltar atras:** colar `supabase/rollbacks/0049_volta_agenda_do_vendedor.sql` no SQL Editor + reverter o commit `0db2139` (feat(33-03) da AgendaList).

## Itens adiados (para o STATE)

- **Prazo de guarda das visitas escondidas (LGPD)**: as visitas automaticas continuam sendo criadas e guardadas sem uso visivel e sem prazo de retencao (idem itens da Agenda 2). Decisao do dono como controlador; sugestao: apagar as nunca usadas se a Agenda 2 ficar de vez. Nenhum descarte automatico.
- **Texto de apoio do dia fixo no `ClienteDetailSheet` (~linha 1318)**: ainda diz que a proxima visita continua sendo sugerida contando os dias da conclusao anterior; durante o piloto isso nao aparece na Agenda. Ajuste opcional, tarefa futura.
- **Limpeza do conjunto dormente** (`components/agenda/AgendaSemDiaFixo.tsx`, `lib/supabase/queries/agenda.ts`, `app/actions/agenda.ts`, `lib/agenda/itens.ts` e testes): quando o dono confirmar a Agenda 2 como definitiva.
- **Contas semente**: decisao pendente. `tests/agenda/agenda-rpc.test.ts` e `concluir-rpc.test.ts` foram editados no 33-02 mas nao executam (contas semente apagadas); cerca de 49 arquivos ao vivo seguem vermelhos por isso.
- Opcional: `supabase migration repair --status applied 0049`.

## Threat Flags

Nenhuma superficie nova: o plano nao criou nem alterou codigo. Mitigacoes T-33-14 (aprovacao antes de aplicar), T-33-15 (ordem staging, aplicacao, testes, master), T-33-17 (so `A` em migrations) e T-33-19 (nada impresso, so fixtures) cumpridas; T-33-16 (LGPD) transferida ao dono e registrada acima.

## Self-Check: PASSED

- 0049 e arquivo de volta existem em `supabase/`; commits de 33-01..33-03 presentes no historico e em `origin/staging`.
- Nenhum commit de codigo nesta tarefa (nenhuma correcao necessaria).
