---
phase: quick-261006-gvo
plan: 01
subsystem: clientes / RLS (apagar cliente)
tags: [rls, delete, vendedor, lgpd, migration-0050, clientes]
requires: [supabase/migrations/0002 (policy original de DELETE), 0048 (molde de vendedor ativo)]
provides: [policy de DELETE de clientes da 0050, botao Apagar cliente para o Vendedor na aba Clientes]
affects: [CLI-06 (emendado)]
tech-stack:
  added: []
  patterns: [RLS como unica autoridade; UI so como conforto; migration re-executavel; arquivo de volta fora de migrations]
key-files:
  created:
    - supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql
    - supabase/rollbacks/0050_volta_policy_delete_clientes.sql
    - tests/clientes/apagar-cliente-migracao.test.ts
    - tests/clientes/rls-apagar-cliente-prospeccao.test.ts
    - tests/clientes/cliente-detail-sheet-apagar.test.tsx
    - tests/clientes/apagar-cliente-action.test.ts
  modified:
    - app/actions/clientes.ts
    - components/clientes/ClienteDetailSheet.tsx
    - components/clientes/KanbanBoard.tsx
    - app/(app)/clientes/page.tsx
    - tests/clientes/kanban-card-filtrado.test.tsx
    - tests/clientes/rls-clientes.test.ts
    - tests/clientes/update-delete.test.ts
decisions:
  - "Vendedor ATIVO apaga so o proprio cliente Em andamento; Ganho/Perdido/Encerrado e de outros so Supervisor (D-01)"
  - "Autorizacao so por RLS na migration nova 0050; a acao deleteCliente nao le papel; 0 linhas vira 'forbidden' (D-02, D-07)"
  - "Dono aceitou o risco do contorno em dois passos (voltar status para Em andamento e apagar) - nao fechado agora"
metrics:
  tasks: 5
  completed: 2026-10-06
status: complete
---

# Quick 261006-gvo: Vendedor apaga os proprios clientes em prospeccao - Resumo

**Em uma frase:** o Vendedor ativo passa a ver e usar o botao "Apagar cliente" nos clientes DELE que ainda estao "Em andamento" (aba Clientes), e quem decide se pode apagar e o banco de dados (migration 0050), nao a tela; o Supervisor continua apagando qualquer cliente.

## O que mudou (em portugues simples)

- **No banco:** a regra "so o Supervisor apaga clientes" foi trocada por: "o Supervisor apaga qualquer cliente; o Vendedor ATIVO apaga so o cliente que e dele E que esta Em andamento". Ganho, Perdido e Encerrado continuam so com o Supervisor. Vendedor desativado nao apaga nada. Visitante sem login nao apaga nada.
- **Na tela:** na aba Clientes, ao abrir a ficha, o botao "Apagar cliente" aparece para o Vendedor so no cliente proprio Em andamento. Na Agenda o Vendedor continua sem o botao (de proposito, so a aba Clientes foi pedida). O Supervisor ve o botao sempre. O aviso de confirmacao continua dizendo: "Essa acao nao pode ser desfeita e vai remover todo o historico do funil."
- **Mensagem quando o banco recusa:** "Voce nao tem permissao para apagar este cliente, ou ele ja foi apagado." (antes aparecia um erro generico).
- **Por que assim:** esconder o botao nao e seguranca; mesmo alguem tentando apagar "por fora" da tela e barrado pelo banco. A acao de apagar no sistema nao confere o papel da pessoa, so tenta apagar e respeita a resposta do banco.
- **Emenda de requisito:** isto altera o requisito antigo CLI-06 ("Vendedor pode editar os proprios clientes, mas nao apagar"), por decisao do dono em 2026-10-06.

## O que foi provado

- **Testes ao vivo contra o banco real, depois de o dono aplicar a 0050: 8 de 8 verdes** (`tests/clientes/rls-apagar-cliente-prospeccao.test.ts`):
  1. Vendedor apaga o proprio cliente Em andamento, e tarefas, visitas, produtos do cliente e historico somem junto (cascata confirmada ao vivo: contagem zero nas 4 tabelas);
  2. Vendedor nao apaga cliente de outro vendedor;
  3. Vendedor nao apaga o proprio cliente Ganho;
  4. idem Perdido;
  5. idem Encerrado;
  6. Vendedor desativado nao apaga (mesmo com sessao ainda valida);
  7. Supervisor apaga qualquer status e de qualquer dono (4 de 4);
  8. Visitante anonimo nao apaga.
  Os testes usam vendedores e clientes temporarios com nomes inventados, apagam tudo no fim e nunca imprimem dados reais. Nenhuma assercao de D-01/D-02 foi afrouxada; nenhuma correcao de teste foi necessaria nesta etapa.
- **Verificacao completa (Tarefa 5):** 10 arquivos de teste, 81 testes verdes (estrutural da 0050 e do arquivo de volta, inventario de 11 funcoes com privilegio elevado sem edicao, Agenda sem visitas automaticas, acao, tela, encerrar, kanban, registro de acesso, agenda-list, calendario); `tsc --noEmit` exit 0; `eslint --max-warnings 0` nos 11 arquivos tocados exit 0; `npm run build` exit 0.
- **Guarda de escopo (base impressa: `27672fecd336bf2618613b3fbb3a698459824f84`):** OK. So os 13 arquivos planejados mais `.planning/`; `supabase/migrations` tem exatamente UMA linha nova (a 0050); nenhuma migration antiga editada; AgendaList e as Agendas intocadas; nenhuma funcao nova com privilegio elevado.

## Decisao e ciencia do dono (Tarefa 3)

Resposta do dono: **"Aplicar como esta"**. Ele foi informado e reconheceu: a mudanca vale na hora para todo o time (staging e producao usam o MESMO banco); botao so na aba Clientes; apagar e definitivo (leva tarefas, visitas, produtos, todo o historico do funil e o Diario); o sistema nao guarda quem apagou nem quando; o contorno em dois passos (abaixo); o efeito no Dashboard (abaixo); a ordem segura; como voltar atras; e o alerta de LGPD.

## Risco aceito: o contorno do status

Hoje o Vendedor ja consegue voltar um cliente proprio Ganho ou Perdido para "Em andamento". Depois disso, com a regra nova, ele consegue apagar esse cliente. Como o historico vai junto, nao sobra registro da volta de status. O dono escolheu **nao fechar isso agora** (aceite consciente do risco, T-gvo-05). Se um dia quiser travar, ver "Pendencias".

## Como foi aplicado no banco (Tarefa 4)

- Pre-condicao conferida: o commit `fde2cce` (tela nova) ja esta em `origin/staging` (conferido: `fde2cce` e ancestral de `origin/staging`; o push foi feito pelo orquestrador, nunca por mim).
- O proprio dono colou os comandos de politica da 0050 (sem o comentario do topo) no SQL Editor da Supabase e rodou; resposta: "Success. No rows returned". O arquivo de volta NAO foi aplicado. Nenhum `supabase db push` nem contorno foi tentado.

## Efeito no Dashboard (nada foi mudado no Dashboard)

Um cliente apagado deixa de contar em:
- "Clientes por etapa" e prospeccao por produto e por categoria;
- "Negocios iniciados" do comparativo por vendedor. Como os ganhos nao mudam, a taxa de conversao do vendedor pode SUBIR artificialmente quando ele apaga prospeccoes;
- tempo por etapa / funil detalhado;
- a parte da aderencia de uso que conta atividade pelo historico (pode perder dias passados daquele vendedor). O registro de acessos diarios nao e afetado, e apagar nao conta como "dia de uso".

## Permanencia

Apagar e permanente: nao existe lixeira. Nao ha gatilho de DELETE no projeto, entao nada e gravado sobre a exclusao. A cascata roda com os direitos do dono da tabela (comportamento normal do Postgres), por isso nenhuma policy nova foi preciso nas tabelas filhas e nenhuma funcao com privilegio elevado foi criada (inventario continua em 11).

## Como voltar atras

1. Colar `supabase/rollbacks/0050_volta_policy_delete_clientes.sql` no SQL Editor da Supabase (devolve a regra antiga: so Supervisor apaga).
2. Reverter o commit `fde2cce` (tela) para o botao sumir do Vendedor.
3. Clientes que ja tiverem sido apagados NAO voltam.

## Decisao de LGPD (registro)

Clientes PJ guardam dados pessoais de contato (nome, telefone, e-mail da pessoa de contato). Deixar o Vendedor apagar prospeccoes erradas ou abandonadas APOIA a minimizacao de dados e a eliminacao prevista na LGPD; a decisao e do dono como responsavel pelos dados e fica registrada aqui. Em contrapartida: apagar tambem remove o historico do cliente (perde-se a trilha do que foi feito) e copias ja exportadas em planilha fora do sistema nao sao apagadas. Recomendacao mantida: orientar o time sobre quando apagar. Os testes ao vivo seguiram minimizacao: fixtures descartaveis, nomes inventados, sem CNPJ/endereco/contato, sem imprimir dados.

## Commits

| Etapa | Hash | Mensagem |
|-------|------|----------|
| T1 RED | 85e32e2 | test: teste estrutural da 0050 e do arquivo de volta (falhando) |
| T1 GREEN | 7e2bb3e | feat: migration 0050 e arquivo de volta |
| T1 testes ao vivo | 634f234 | test: testes RLS ao vivo + casos antigos atualizados |
| T2 RED | 072aab4 | test: botao do Vendedor e erro amigavel (falhando) |
| T2 GREEN | fde2cce | feat: Vendedor ve Apagar cliente nos proprios em prospeccao; acao confia so na RLS |
| Plano | 66d8c4b | docs: plano da quick task |

Nenhum commit de codigo na Tarefa 5 (os testes ao vivo ficaram verdes sem correcao). Nada foi publicado pelo executor.

## Pendencias (para o dono / orquestrador)

1. **Conferencia humana do Preview da staging** (bloco human-check da Tarefa 5): entrar como Vendedor, criar cliente de teste "Teste Apagar Preview", abrir a ficha, ver o botao, confirmar o aviso e apagar; abrir ficha pela Agenda e ver que o botao NAO aparece; como Supervisor, o botao continua em qualquer ficha. **So depois disso levar para `master`.**
2. **Trilha de exclusao** (registro de quem apagou e quando): hoje nao existe; exigiria tabela nova ou funcao com privilegio elevado; decisao futura do dono.
3. **Regra mais rigida contra o contorno do status** (ex.: "so clientes que nunca mudaram de status"): so se o dono quiser; muda a regra e exige novo plano e nova migration (0051+).
4. **Opcional:** `supabase migration repair --status applied 0050` para o historico de migrations da CLI ficar em dia (a 0050 e re-executavel, entao um `db push` futuro nao quebra mesmo sem isso).
5. **Manual do Vendedor precisa ser atualizado** (nao foi tocado, por decisao D-10): agora o Vendedor pode apagar os proprios clientes Em andamento.
6. Os casos antigos atualizados em `tests/clientes/rls-clientes.test.ts` e `tests/clientes/update-delete.test.ts` usam as contas semente antigas (apagadas) e continuam sem rodar; a mudanca so impede que alguem "conserte" a regra de volta.

## Desvios do plano

Nenhum: plano executado como escrito. Os dois checkpoints foram resolvidos pelo dono (decisao e aplicacao no SQL Editor).

## Threat Flags

Nenhuma superficie nova alem da prevista no threat model do plano (T-gvo-01 a T-gvo-11).

## Self-Check: PASSED

- Arquivos criados/alterados existem e a guarda de escopo passou; commits 85e32e2, 7e2bb3e, 634f234, 072aab4, fde2cce, 66d8c4b presentes no historico; testes ao vivo 8/8 verdes; tsc, eslint e build com exit 0.
