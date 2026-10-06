---
phase: quick-261006-gvo
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-261006-gvo]
files_modified:
  - supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql
  - supabase/rollbacks/0050_volta_policy_delete_clientes.sql
  - tests/clientes/apagar-cliente-migracao.test.ts
  - tests/clientes/rls-apagar-cliente-prospeccao.test.ts
  - tests/clientes/rls-clientes.test.ts
  - tests/clientes/update-delete.test.ts
  - app/actions/clientes.ts
  - components/clientes/ClienteDetailSheet.tsx
  - components/clientes/KanbanBoard.tsx
  - "app/(app)/clientes/page.tsx"
  - tests/clientes/kanban-card-filtrado.test.tsx
  - tests/clientes/cliente-detail-sheet-apagar.test.tsx
  - tests/clientes/apagar-cliente-action.test.ts

must_haves:
  truths:
    - "D-01/D-06: na aba Clientes, um Vendedor ATIVO vê o botão 'Apagar cliente' na ficha de um cliente DELE que está 'Em andamento'; confirma no diálogo que avisa 'Essa ação não pode ser desfeita e vai remover todo o histórico do funil.' e o cliente some do kanban."
    - "D-01/D-06: o Vendedor NÃO vê o botão num cliente próprio Ganho, Perdido ou Encerrado, num cliente de outro vendedor, nem na ficha aberta pela Agenda (que não recebe o id do usuário); o Supervisor continua vendo o botão sempre, em qualquer status."
    - "D-01/D-02: mesmo chamando a API direto, o banco decide: a policy de DELETE da 0050 só deixa o Vendedor ativo apagar o próprio cliente em andamento; cliente de outro, ganho/perdido/encerrado, vendedor desativado e visitante anônimo resultam em 0 linhas apagadas; o Supervisor apaga qualquer cliente."
    - "D-07: a ação deleteCliente não lê papel nem perfil — só tenta apagar; 0 linhas vira o erro 'forbidden', que a ficha mostra como 'Você não tem permissão para apagar este cliente, ou ele já foi apagado.'"
    - "D-05(a): ao apagar, tarefas, visitas, produtos do cliente e todo o histórico (Diário) somem junto pela cascata das chaves estrangeiras, sem policy nova nessas tabelas e sem função nova com privilégio elevado (inventário de 11 intacto)."
    - "D-02/D-04/D-09: existe exatamente UMA migration nova (0050) desde a base 27672fe, nenhuma migration antiga editada; o arquivo de volta com a policy original fica em supabase/rollbacks e NÃO é aplicado."
    - "D-09/D-10/D-11: o dono aprovou antes, em português simples, ciente de que apagar é definitivo, do alerta de LGPD, do contorno residual (voltar status para Em andamento) e da ordem segura; foi ele quem colou a 0050 no SQL Editor; os testes ao vivo ficaram verdes depois disso."
  artifacts:
    - path: supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql
      provides: "Policy de DELETE de clientes recriada: (dono E em_andamento E vendedor ativo) OU supervisor"
      contains: "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos"
    - path: supabase/rollbacks/0050_volta_policy_delete_clientes.sql
      provides: "Volta atrás com a policy original da 0002, cabeçalho NAO APLICAR"
      contains: "NAO APLICAR"
    - path: tests/clientes/apagar-cliente-migracao.test.ts
      provides: "Teste estrutural (fs) da 0050 e do arquivo de volta"
    - path: tests/clientes/rls-apagar-cliente-prospeccao.test.ts
      provides: "Testes ao vivo da regra (8 casos), VERMELHO até o dono aplicar a 0050"
    - path: app/actions/clientes.ts
      provides: "deleteCliente sem checagem de papel; 0 linhas -> forbidden"
    - path: components/clientes/ClienteDetailSheet.tsx
      provides: "Prop opcional currentUserId; botão visível para Supervisor ou dono em andamento; mensagem amigável de forbidden"
    - path: tests/clientes/cliente-detail-sheet-apagar.test.tsx
      provides: "Visibilidade do botão, texto do diálogo, erro amigável e sucesso"
    - path: tests/clientes/apagar-cliente-action.test.ts
      provides: "deleteCliente: 0 linhas -> forbidden, nunca lê profiles"
  key_links:
    - from: "app/(app)/clientes/page.tsx"
      to: "components/clientes/KanbanBoard.tsx -> components/clientes/ClienteDetailSheet.tsx"
      via: "currentUserId={user.id} (obrigatório no KanbanBoard, opcional na ficha); AgendaList NÃO é tocada e não passa o id"
      pattern: 'currentUserId=\{(user\.id|currentUserId)\}'
    - from: "components/clientes/ClienteDetailSheet.tsx handleConfirmDelete"
      to: "app/actions/clientes.ts deleteCliente"
      via: "error.code 'forbidden' mapeado para a mensagem amigável; 'generic'/'unauthenticated' para a mensagem genérica"
      pattern: 'forbidden'
    - from: "app/actions/clientes.ts deleteCliente"
      to: "policy de DELETE de clientes (0050)"
      via: "delete().eq('id').select('id').maybeSingle() sob RLS; a RLS é a única autoridade"
      pattern: 'delete\(\)'
    - from: "policy 0050"
      to: "profiles (role vendedor, ativo) e is_supervisor()"
      via: "exists em profiles igual às policies de escrita da 0048; is_supervisor() já exige ativo (0008)"
      pattern: "p.ativo = true"
    - from: "DELETE em clientes"
      to: "tarefas, visitas, cliente_produtos, historico"
      via: "FK on delete cascade (0002 e 0013), executada com os direitos do dono da tabela, sem passar pela RLS"
      pattern: "on delete cascade"
---

<objective>
Pedido do dono (2026-10-06): permitir que o VENDEDOR apague os PRÓPRIOS clientes que ainda estão em prospecção ("Em andamento"), pela ficha do cliente na aba Clientes. O Supervisor continua apagando qualquer cliente. Clientes Ganho, Perdido e Encerrado continuam só com o Supervisor.

Explicando sem jargão: hoje só o Supervisor tem o botão "Apagar cliente". Vamos (1) mudar a regra no banco — é o banco que decide quem pode apagar, então mesmo alguém tentando "por fora" da tela não consegue apagar o que não pode; (2) mostrar o botão para o Vendedor só quando o cliente é dele e está Em andamento; (3) se o banco recusar, a tela mostra uma mensagem clara em vez de um erro genérico. A mudança no banco é aplicada pelo próprio dono, colando um arquivo no SQL Editor, depois de aprovar — o agente nunca aplica.

Esta tarefa emenda o requisito antigo CLI-06 ("Vendedor pode editar os próprios clientes, mas não apagar") — registrar no SUMMARY.

Decisões do dono, numeradas aqui para rastreio:
- D-01: Vendedor apaga só os próprios clientes com status_acompanhamento = 'em_andamento'; Ganho/Perdido/Encerrado só Supervisor; Supervisor apaga qualquer (inalterado).
- D-02: Autorização só por RLS: migration NOVA 0050 recriando a policy de DELETE de clientes como (responsavel = usuário E em_andamento E chamador é vendedor ATIVO) OU is_supervisor(), no mesmo formato das policies de escrita da 0048. Nunca editar migration antiga. Nenhuma função nova com privilégio elevado (o projeto mantém 11).
- D-03: Comentários da migration só em ASCII e só em bloco barra-asterisco; nunca escrever a cláusula literal de elevação de privilégio; não citar o nome da tabela da Agenda 2.
- D-04: Arquivo de volta supabase/rollbacks/0050_volta_policy_delete_clientes.sql com a policy ORIGINAL, fora de supabase/migrations, cabeçalho "NAO APLICAR".
- D-05: Pesquisa registrada no plano: (a) efeitos de cascata e se algo bloqueia o apagar do vendedor ou quebra a trilha de auditoria; (b) impacto no Dashboard — só documentar no SUMMARY, NÃO mudar métricas.
- D-06: Botão "Apagar cliente" também para o Vendedor, SÓ quando o cliente é dele e está em andamento (escondido nos outros casos); Supervisor sempre vê. Mantém o diálogo de confirmação, em português claro e deixando claro que é definitivo ("Essa ação não pode ser desfeita e vai remover todo o histórico do funil.").
- D-07: A Server Action de apagar NÃO faz checagem de papel feita à mão: só tenta apagar e trata "0 linhas apagadas" como erro amigável — a RLS decide.
- D-08: Testes: estrutural da migration; ao vivo contra o banco real (VERMELHO até o dono aplicar), com fixtures descartáveis, no máximo 2 logins no arquivo, nomes inventados sem sequência de 8+ dígitos, nada impresso; de tela (visibilidade do botão e texto do diálogo) e da ação (erro amigável em 0 linhas).
- D-09: Estrutura da Fase 33: Tarefa 1 banco + testes; Tarefa 2 tela + ação + testes; checkpoint de decisão (aprovação em português simples, LGPD, "apagar é definitivo"); checkpoint de ação humana (dono cola no SQL Editor; o agente nunca aplica SQL nem roda db push); tarefa final (testes ao vivo verdes, tsc, eslint --max-warnings 0 nos arquivos tocados, npm run build, guarda de escopo desde 27672fe com exatamente uma migration nova). Sem push.
- D-10: O orquestrador envia os commits para a branch staging depois da aprovação e ANTES de o dono aplicar o SQL (staging e produção usam o MESMO banco). Não mexer nas Agendas nem em outras regras. Não atualizar o Manual.
- D-11: LGPD no threat model e no SUMMARY: apagar dados de prospecção apoia a minimização; registrar a decisão; apagar também remove o histórico do cliente.

Escolhas do planejador (discricionárias, documentadas):
- O id do usuário logado chega à ficha por uma prop nova `currentUserId`, obrigatória no KanbanBoard (o TypeScript obriga a aba Clientes a passar) e OPCIONAL na ficha. A AgendaList não é tocada (D-10), então na Agenda o Vendedor continua sem o botão — privacidade/segurança por padrão: sem o id, o botão não aparece para quem não é Supervisor.
- Texto da mensagem para 0 linhas: "Você não tem permissão para apagar este cliente, ou ele já foi apagado." (0 linhas também acontece se outra pessoa apagou o cliente antes).
- Nome da policy nova: "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos" (molde de "vendedor edita os proprios clientes, supervisor edita todos" da 0002).
- `is_supervisor()` envolto em `(select ...)`, como nas policies da 0048 (avaliado uma vez por comando).
- Os dois casos antigos que afirmam "Vendedor não apaga o próprio cliente" (tests/clientes/rls-clientes.test.ts e tests/clientes/update-delete.test.ts) passam a afirmar a regra nova. Eles usam as contas semente antigas (apagadas), então continuam sem rodar — a mudança evita que alguém "conserte" a regra de volta quando as contas semente voltarem.
- Caso extra ao vivo "vendedor desativado não apaga", porque D-02 trava a palavra ATIVO.

Purpose: reduzir fricção (o vendedor limpa prospecções erradas ou duplicadas sem depender do Supervisor) mantendo a regra de quem pode apagar o quê dentro do banco.
Output: migration 0050 + arquivo de volta + testes (estrutural, ao vivo, tela, ação) + tela e ação ajustadas, aplicação feita pelo dono, gate final verde.
</objective>

<execution_context>
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/Supabase-conventions/SKILL.md
@.planning/phases/33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos/33-04-SUMMARY.md
</context>

## Pesquisa registrada (verificada lendo as migrations em 2026-10-06)

**Policy de DELETE atual de clientes.** Única e intocada desde a criação: `"somente supervisor apaga clientes"`, em supabase/migrations/0002_clientes_and_funil.sql (linhas 202-206), `on clientes for delete to authenticated using (is_supervisor());`. Nenhuma migration posterior (0003-0049) cria, remove ou altera policy de clientes (grep por `on clientes`, `drop policy`, `alter policy`). O arquivo 0002 está com fim de linha CRLF no disco — comparações devem normalizar CRLF para LF.

**(a) Cascata ao apagar um cliente.**
- Só 4 tabelas apontam para clientes, todas com `on delete cascade`: cliente_produtos (0002, linha 138), tarefas (0002, linha 148), historico (0002, linha 161) e visitas (0013, linha 67). Nenhuma tabela aponta para tarefas, visitas ou historico. O "Diário" não é tabela: é uma leitura montada sobre historico/tarefas/visitas, então some junto.
- A ação de cascata é executada pelo próprio Postgres como verificação de integridade referencial, com os direitos do DONO da tabela filha e sem aplicar RLS (comportamento documentado do Postgres: verificações de integridade referencial sempre ignoram a segurança por linha). Por isso o fato de historico não ter policy de DELETE (nem de INSERT) NÃO bloqueia o apagar do Vendedor — é exatamente assim que o apagar do Supervisor já funciona hoje. Nenhuma policy nova é necessária em tarefas, visitas, cliente_produtos ou historico; nenhuma função nova com privilégio elevado é necessária.
- Não existe nenhum gatilho de DELETE no projeto (grep por `before delete`, `after delete`, `or delete`): os gatilhos de historico de clientes, tarefas e visitas são só de UPDATE. Logo, apagar não grava nada no historico e a trilha "à prova de adulteração" continua sem caminho de escrita pela API.
- Efeito na trilha de auditoria (a registrar no SUMMARY e no checkpoint): o historico DAQUELE cliente é apagado junto, e o sistema não guarda registro de quem apagou nem quando — isso já é verdade hoje para o Supervisor e passa a valer para o Vendedor. Não há como manter um registro de exclusão sem tabela nova ou função com privilégio elevado — fora do escopo (D-02); fica como item adiado.
- Limpeza dos testes: clientes.responsavel aponta para profiles SEM ação de cascata, e visitas.criado_por também; por isso os testes ao vivo apagam os clientes de fixture (a cascata leva as visitas) ANTES de apagar os membros de teste.
- A policy nova consulta profiles do próprio usuário (exists com role 'vendedor' e ativo true) — o mesmo trecho das policies de escrita da 0048, já provado ao vivo, então a RLS de profiles permite essa leitura.
- Conclusão: NÃO é preciso nenhum ajuste extra no banco. O executor só para e reporta se o caso ao vivo de cascata falhar depois da aplicação (Tarefa 5).

**Risco residual descoberto (decisão do dono no checkpoint).** Nenhuma trava no banco nem na ação `marcarStatus` (app/actions/funil.ts) impede o Vendedor de voltar um cliente próprio Ganho ou Perdido para "Em andamento" (isso já é permitido hoje, inclusive pela tela). Depois disso, a regra nova deixaria ele apagar — um contorno em dois passos de D-01 — e como o historico vai junto, não sobra registro da volta de status. Implementar exatamente D-01/D-02 (decisão travada) e apresentar o risco ao dono na Tarefa 3; se ele quiser uma regra mais rígida (por exemplo, "só clientes que nunca mudaram de status"), isso muda uma decisão travada e volta ao orquestrador para replanejar — o executor não improvisa.

**(b) Impacto no Dashboard (só documentar no SUMMARY, não mudar nada).** Todas as funções do dashboard leem clientes/historico com RLS e sem cópia; um prospect apagado some de:
- "Clientes por etapa" (dashboard_clientes_por_etapa) e prospecção por produto/categoria (dashboard_prospeccao_por_produto / dashboard_prospeccao_por_categoria);
- comparativo por vendedor (dashboard_comparativo_vendedor, versão da 0037): "Negócios iniciados" cai e, como o ganho não muda, a taxa de conversão do vendedor pode SUBIR artificialmente;
- funil detalhado / tempo por etapa (dashboard_funil_detalhado, baseado em historico);
- aderência de uso (dashboard_aderencia_uso): a parte que conta atividade pelo historico pode perder dias passados daquele vendedor; o registro de acessos diários (acessos_diarios) não é afetado.
- Apagar não é registrado como "dia de uso" (a ação não chama registrarAcessoDiario; isso não muda).

**Estados intermediários (ordem segura, D-10).** (1) Tela no staging antes da 0050: no link de teste o Vendedor vê o botão, mas o banco ainda recusa e aparece a mensagem amigável — inofensivo. (2) 0050 aplicada antes do merge em master: no site real o Vendedor ainda não vê o botão; a regra nova só seria usada por quem chamasse a API direto, e só para os próprios prospects — inofensivo. A 0050 é re-executável (drop policy if exists antes de cada create), então um `supabase db push` futuro não quebra.

## Contrato SQL (texto exato a usar — o cabeçalho de comentário é descrito na Tarefa 1)

Corpo da migration supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql (depois do bloco de comentário):

```sql
drop policy if exists "somente supervisor apaga clientes" on clientes;
drop policy if exists "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos" on clientes;
create policy "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos"
on clientes for delete
to authenticated
using (
  (select is_supervisor())
  or (
    responsavel = (select auth.uid())
    and status_acompanhamento = 'em_andamento'
    and exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
    )
  )
);
```

Corpo do arquivo de volta supabase/rollbacks/0050_volta_policy_delete_clientes.sql (depois do bloco de comentário); as 4 últimas linhas são cópia exata das linhas 203-206 da 0002:

```sql
drop policy if exists "vendedor ativo apaga os proprios clientes em prospeccao, supervisor apaga todos" on clientes;
drop policy if exists "somente supervisor apaga clientes" on clientes;
create policy "somente supervisor apaga clientes"
on clientes for delete
to authenticated
using (is_supervisor());
```

## Interfaces existentes (lidas no código)

- app/actions/clientes.ts (linhas 395-449): `DeleteClienteErrorCode = "unauthenticated" | "forbidden" | "generic"`; `deleteCliente(id)` hoje lê `profiles.role` e devolve "forbidden" antes de tentar o DELETE quando não é Supervisor; depois `delete().eq("id", id).select("id").maybeSingle()`; sem linha -> "generic"; sucesso -> `revalidatePath("/clientes")`. createCliente/updateCliente também leem profiles — FORA do escopo, não mexer.
- components/clientes/ClienteDetailSheet.tsx: props `isSupervisor`, `onDeleted`, etc. (linhas 210-236); `DELETE_GENERIC_ERROR` (linha 112); botão no cabeçalho com a condição `isSupervisor && cliente` (linhas 746-755); `handleConfirmDelete` (linhas 707-729); diálogo (linhas 1538-1575) já com "Essa ação não pode ser desfeita e vai remover todo o histórico do funil."; `cliente.responsavel` e `cliente.statusAcompanhamento` vêm de ClienteDetalhe e o status local é atualizado após `handleStatusChange` (linhas 433-437).
- components/clientes/KanbanBoard.tsx (linhas 264-279 props; 885-895 renderiza a ficha com `isSupervisor={showResponsavel}`).
- app/(app)/clientes/page.tsx: já tem `user.id` (passa `currentUserId={user.id}` ao ClienteQuickCreateForm) e renderiza `<KanbanBoard grouped callerRole categoriaOptions produtoOptions />`.
- Chamadores da ficha: só KanbanBoard e components/agenda/AgendaList.tsx (esta NÃO muda).
- tests/helpers/supabase-test-clients.ts: `anonClient()`, `serviceClient()`, `signInAs(email, password)`, `createTestMember(role, label)`, `deleteTestMember(id)`, tipo `TestMember`.

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Migration 0050 + arquivo de volta + teste estrutural (verde) + testes ao vivo (VERMELHOS até a aplicação)</name>
  <files>supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql, supabase/rollbacks/0050_volta_policy_delete_clientes.sql, tests/clientes/apagar-cliente-migracao.test.ts, tests/clientes/rls-apagar-cliente-prospeccao.test.ts, tests/clientes/rls-clientes.test.ts, tests/clientes/update-delete.test.ts</files>
  <read_first>
    - supabase/migrations/0002_clientes_and_funil.sql (linhas 100-206: tabelas, FKs com cascata, policies de clientes; a policy original de DELETE nas linhas 202-206)
    - supabase/migrations/0048_agenda2_itens.sql (linhas 84-144: forma das policies com vendedor ativo e drop policy if exists antes de cada create)
    - supabase/migrations/0049_agenda_atual_so_prospeccao.sql e supabase/rollbacks/0049_volta_agenda_do_vendedor.sql (estilo do cabeçalho ASCII em bloco e do NAO APLICAR)
    - tests/agenda/agenda-sem-visitas-migracao.test.ts (molde do teste estrutural: lf, semComentarios, ehAsciiPuro, linhaComecaComDoisHifens, cláusula montada por concatenação)
    - tests/agenda2/migracao-agenda2.test.ts (inventário de 11 funções com elevação; varre TODAS as migrations, inclusive comentários em bloco)
    - tests/agenda2/rls-agenda2.test.ts (molde do teste ao vivo: 3 fixtures, 2 logins, nomeInventado com timestamp quebrado, afterAll que reativa e apaga membros)
    - tests/funil/encerrados-rpc.test.ts (linhas 115-213: semear clientes pelo cliente de serviço, motivos de encerramento, ordem de limpeza)
    - tests/clientes/rls-clientes.test.ts (linhas 140-166) e tests/clientes/update-delete.test.ts (linhas 192-221)
  </read_first>
  <behavior>
    - Estrutural arquivo-unico: só um arquivo de migration começa com "0050" e é o 0050_vendedor_apaga_cliente_em_prospeccao.sql; o arquivo de volta existe em supabase/rollbacks e não em supabase/migrations.
    - Estrutural so-a-policy-de-delete: sem comentários, o SQL tem os dois drop policy if exists (nome antigo e nome novo, ambos "on clientes"), exatamente um create policy, "on clientes for delete" e "to authenticated", e nenhum "for select", "for insert", "for update" ou "with check".
    - Estrutural regra-do-dono: o bloco da policy nova (normalizado) contém "responsavel = (select auth.uid())", "status_acompanhamento = 'em_andamento'", "p.id = (select auth.uid())", "p.role = 'vendedor'", "p.ativo = true", "(select is_supervisor()) or (" e não contém "'ganho'", "'perdido'" nem "'encerrado'".
    - Estrutural sem-elevacao-sem-funcao: sem comentários, nenhuma cláusula de elevação, nenhum "function", "grant ", "revoke ", "alter table", "insert into", "update ", "delete from", "truncate", "drop table", "disable row level security" nem "$$".
    - Estrutural comentarios-seguros: arquivo cru é ASCII puro, nenhuma linha começa com dois hífens, e o texto cru (minúsculo) não contém a cláusula de elevação, o nome da tabela da Agenda 2, nem "function".
    - Estrutural rollback-original: arquivo de volta ASCII, sem linha com dois hífens, com "NAO APLICAR", com os dois drop policy if exists, exatamente um create policy, sem cláusula de elevação; o bloco do create policy "somente supervisor apaga clientes" até o primeiro ";" é IDÊNTICO (após CRLF->LF) ao da 0002.
    - Ao vivo (VERMELHO até a 0050 existir no banco): vendedor-apaga-proprio-em-andamento-com-cascata, vendedor-nao-apaga-cliente-de-outro-vendedor, vendedor-nao-apaga-proprio-ganho, vendedor-nao-apaga-proprio-perdido, vendedor-nao-apaga-proprio-encerrado, vendedor-desativado-nao-apaga, supervisor-apaga-qualquer-status-e-dono, anonimo-nao-apaga.
  </behavior>
  <action>
1. RED — criar tests/clientes/apagar-cliente-migracao.test.ts (ambiente node, só fs/path/vitest, mesmo molde do teste estrutural da 0049). Constantes: pasta de migrations, nome e caminho da 0050, nome e caminho do arquivo de volta em supabase/rollbacks, caminho da 0002, o nome da policy nova e o nome da policy original (texto exato do "Contrato SQL"). A cláusula de elevação de privilégio é montada juntando as duas palavras (security e definer) com um espaço, e o nome da tabela da Agenda 2 juntando "agenda2" e "itens" com sublinhado — assim nenhuma das duas aparece inteira no arquivo de teste. Funções auxiliares: lf (CRLF para LF), semComentarios (remove blocos barra-asterisco e linhas cujo trim começa com dois hífens), ehAsciiPuro, linhaComecaComDoisHifens, normaliza (todo espaço em branco vira um espaço, trim), contaOcorrencias, e blocoPolicy(sql, nome) que recorta de `create policy "<nome>"` até o primeiro ";" depois dele, inclusive (lança erro se não achar). Escrever os seis casos do bloco behavior com esses nomes de it. Rodar o arquivo e confirmar que FALHA (arquivos ainda não existem). Commit: `test(quick-261006-gvo): add failing structural test for migration 0050 and rollback file`.
2. GREEN — criar supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql (per D-02/D-03): primeiro um único bloco de comentário barra-asterisco, só ASCII, sem nenhuma linha começando com dois hífens, dizendo em português sem acento: quick task 261006-gvo; decisão do dono de 2026-10-06 (vendedor ATIVO apaga só clientes dele em andamento; ganho, perdido e encerrado continuam só com o supervisor; supervisor apaga qualquer um, sem mudança); emenda o requisito CLI-06; recria a policy de DELETE de clientes que antes era só do supervisor (migration 0002), no mesmo formato das policies de escrita da 0048 (perfil vendedor ativo); a cascata (tarefas, visitas, cliente_produtos e historico do cliente saem junto pelas chaves estrangeiras com cascata da 0002 e da 0013) roda com os direitos do dono da tabela e não passa pela RLS, por isso nenhuma policy nova é necessária nessas tabelas e o historico continua sem policy de escrita para usuarios; apagar é definitivo e remove todo o historico do funil do cliente (LGPD: apoia a minimizacao, decisão registrada no SUMMARY da quick task); nenhuma funcao nova e nenhuma clausula de elevacao de privilegio; volta atrás em supabase/rollbacks/0050_volta_policy_delete_clientes.sql, NAO aplicado automaticamente. O comentário NÃO pode conter a palavra inglesa de função, a cláusula de elevação, o nome da tabela da Agenda 2, nem cifrões duplos. Depois do comentário, o corpo EXATO da seção "Contrato SQL" (migration). Criar supabase/rollbacks/0050_volta_policy_delete_clientes.sql (per D-04): bloco de comentário ASCII começando com "NAO APLICAR automaticamente", dizendo que fica fora de supabase/migrations de propósito, que é a volta atrás da 0050 e recoloca a policy original da 0002 (só supervisor apaga clientes), que só deve ser colado no SQL Editor se o dono decidir desfazer, que clientes já apagados NÃO voltam, e que a parte da tela volta revertendo o commit feat da Tarefa 2 desta quick task; depois o corpo EXATO do "Contrato SQL" (volta atrás). Nunca editar a 0002 nem nenhuma outra migration. Rodar o teste estrutural até ficar verde e rodar junto tests/agenda2/migracao-agenda2.test.ts (inventário de 11 sem edição) e tests/agenda/agenda-sem-visitas-migracao.test.ts. Commit: `feat(quick-261006-gvo): add migration 0050 (vendedor apaga os proprios clientes em prospeccao) and rollback file`.
3. Criar tests/clientes/rls-apagar-cliente-prospeccao.test.ts (per D-08), molde de tests/agenda2/rls-agenda2.test.ts. Cabeçalho em comentário explicando: prova a policy da 0050 contra o banco REAL (o projeto de teste é o de produção); fica VERMELHO até o dono aplicar a 0050 (o caso positivo do vendedor falha antes disso); usa só fixtures descartáveis (nunca as contas semente antigas); exatamente duas autenticações no arquivo (Vendedor A e Supervisor; Vendedor B nunca faz login; o anônimo usa o cliente sem login); nunca imprime nada; toda leitura de conferência é feita pelo cliente de serviço filtrando pelos ids de fixture (nunca baixa dado real); nomes inventados. beforeAll: criar Vendedor A, Vendedor B e Supervisor com createTestMember (rótulos "apaga-a", "apaga-b", "apaga"); fazer login só de A e do Supervisor com signInAs; buscar pelo cliente de serviço um id de motivos_perda, um de motivos_encerramento ativo, um de tipos_tarefa e um de produtos_consumidos (limit 1; lançar erro sem imprimir linha se faltar). Função de nome inventado: "Teste Apagar Prospeccao <rótulo> <timestamp quebrado a cada 3 dígitos com a letra x>-<6 caracteres base36>", para nunca formar 8 ou mais dígitos seguidos; o arquivo inteiro não pode conter nenhum literal com 8+ dígitos seguidos. Semeadura só pelo cliente de serviço com o mínimo de campos (minimização): razao_social inventada, responsavel, e quando preciso etapa/status_acompanhamento/motivo_perda_id/motivo_encerramento_id — sem CNPJ, endereço, telefone, e-mail ou contato (todos opcionais desde as migrations 0023/0024; se o banco exigir algum campo, acrescentar o mínimo inventado e registrar no SUMMARY). Ganho: etapa primeira_venda + status ganho. Perdido: status perdido + motivo_perda_id. Encerrado: etapa primeira_venda + status encerrado + motivo_encerramento_id. Guardar todo id semeado numa lista; afterEach apaga essa lista pelo cliente de serviço; afterAll recoloca ativo = true em A e B (caso um teste tenha falhado no meio), apaga qualquer cliente restante dos três membros pelo cliente de serviço e só DEPOIS chama deleteTestMember para os três. Casos (cada um confere o resultado do DELETE pedindo `.select("id")` e checando o tamanho da lista, e confere pelo cliente de serviço se a linha ainda existe — só por id, nunca imprimindo): (1) vendedor-apaga-proprio-em-andamento-com-cascata: semear cliente em andamento de A e, pelo serviço, uma tarefa (tipo de tarefa), uma visita (data de hoje no fuso de São Paulo, criado_por A), um vínculo em cliente_produtos e uma linha em historico (tipo e descrição de teste, autor nulo); A apaga -> 1 linha, sem erro; pelo serviço: o cliente não existe mais e a contagem (head + count exato, filtrando cliente_id) em tarefas, visitas, cliente_produtos e historico é 0. (2) vendedor-nao-apaga-cliente-de-outro-vendedor: cliente em andamento de B; A apaga -> 0 linhas, sem erro; continua existindo. (3)(4)(5) vendedor-nao-apaga-proprio-ganho / -perdido / -encerrado: cliente de A em cada status; A apaga -> 0 linhas; continua existindo. (6) vendedor-desativado-nao-apaga: cliente em andamento de A; pelo serviço, ativo = false no perfil de A; A (sessão ainda válida) apaga -> 0 linhas; continua existindo; em finally, ativo = true de volta. (7) supervisor-apaga-qualquer-status-e-dono: clientes de B em andamento, ganho e perdido e de A encerrado; Supervisor apaga os quatro por in(ids) -> 4 linhas; nenhum existe mais. (8) anonimo-nao-apaga: cliente em andamento de A; o cliente anônimo tenta apagar -> lista vazia (aceitar erro ou lista vazia, nunca linha apagada); continua existindo. Não executar este arquivo nesta tarefa (o banco de teste é o de produção e a 0050 ainda não foi aplicada — mesmo procedimento do 33-01); só tsc, eslint e a checagem estrutural do verify.
4. Atualizar os dois casos antigos que afirmam o contrário da regra nova (escolha documentada do planejador): em tests/clientes/rls-clientes.test.ts, renomear o describe "RLS: clientes DELETE is Supervisor-only (CLI-06)" para citar a 0050 (vendedor ativo apaga os próprios em prospecção; supervisor apaga todos; emenda do CLI-06) e transformar o caso "Vendedor A cannot delete their own cliente (0 rows affected)" em "Vendedor A CAN delete their own em_andamento cliente (0050)", esperando 1 linha; em tests/clientes/update-delete.test.ts, mesma mudança no describe da linha 192 e no caso da linha 193 (esperar 1 linha, comentário apontando para a 0050 e para tests/clientes/rls-apagar-cliente-prospeccao.test.ts). Não mexer em mais nada desses arquivos (continuam usando as contas semente antigas e continuam sem rodar — registrar no SUMMARY). Commit: `test(quick-261006-gvo): add live RLS tests for vendedor deleting own prospects and update stale delete cases`.
  </action>
  <verify>
    <automated>npx vitest run tests/clientes/apagar-cliente-migracao.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 tests/clientes/apagar-cliente-migracao.test.ts tests/clientes/rls-apagar-cliente-prospeccao.test.ts tests/clientes/rls-clientes.test.ts tests/clientes/update-delete.test.ts && node -e "const s=require('fs').readFileSync('tests/clientes/rls-apagar-cliente-prospeccao.test.ts','utf8');const n=(s.match(/signInAs\(/g)||[]).length;if(n!==2)throw new Error('logins: '+n);if(/console\./.test(s))throw new Error('impressao');if(/SEED_ACCOUNTS/.test(s))throw new Error('contas semente');if(!/createTestMember\(/.test(s)||!/deleteTestMember\(/.test(s))throw new Error('fixtures');if(/[0-9]{8,}/.test(s))throw new Error('8+ digitos');for(const c of ['vendedor-apaga-proprio-em-andamento-com-cascata','vendedor-nao-apaga-cliente-de-outro-vendedor','vendedor-nao-apaga-proprio-ganho','vendedor-nao-apaga-proprio-perdido','vendedor-nao-apaga-proprio-encerrado','vendedor-desativado-nao-apaga','supervisor-apaga-qualquer-status-e-dono','anonimo-nao-apaga']){if(!s.includes(c))throw new Error('caso ausente: '+c)}console.log('OK teste ao vivo (estrutura)')" && node -e "const cp=require('child_process');const st=cp.execFileSync('git',['diff','--name-status','27672fe','HEAD','--','supabase/migrations']).toString().split('\n').map(s=>s.trim()).filter(Boolean);if(st.length!==1||st[0]!=='A\tsupabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql')throw new Error('migrations: '+st.join(' | '));console.log('OK uma migration nova')"</automated>
  </verify>
  <acceptance_criteria>
    - Teste estrutural: houve rodada vermelha antes dos arquivos e agora 6/6 verdes; tests/agenda2/migracao-agenda2.test.ts (inventário de 11) e tests/agenda/agenda-sem-visitas-migracao.test.ts verdes SEM edição.
    - A 0050 e o arquivo de volta seguem o "Contrato SQL" ao pé da letra; cabeçalhos ASCII, só em bloco, sem a cláusula de elevação, sem o nome da tabela da Agenda 2.
    - Desde 27672fe, supabase/migrations tem exatamente uma linha "A" (a 0050); nenhuma migration antiga editada.
    - O teste ao vivo tem os 8 casos, exatamente 2 logins, nenhuma impressão, só fixtures, nenhum literal de 8+ dígitos; NÃO foi executado nesta tarefa.
    - Os dois casos antigos agora afirmam a regra nova (1 linha apagada), com o describe citando a 0050; nada mais mudou nesses arquivos.
    - tsc e eslint --max-warnings 0 limpos nos arquivos de teste tocados.
  </acceptance_criteria>
  <done>Regra nova escrita (não aplicada) com volta atrás pronta, prova estrutural verde e prova ao vivo pronta para ficar verde quando o dono aplicar a 0050.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Ação sem checagem de papel + botão do Vendedor na ficha (aba Clientes) + testes de tela e da ação</name>
  <files>app/actions/clientes.ts, components/clientes/ClienteDetailSheet.tsx, components/clientes/KanbanBoard.tsx, app/(app)/clientes/page.tsx, tests/clientes/kanban-card-filtrado.test.tsx, tests/clientes/cliente-detail-sheet-apagar.test.tsx, tests/clientes/apagar-cliente-action.test.ts</files>
  <read_first>
    - app/actions/clientes.ts (linhas 1-60 e 395-449)
    - components/clientes/ClienteDetailSheet.tsx (linhas 106-118, 210-245, 403-440, 707-756, 1538-1576)
    - components/clientes/KanbanBoard.tsx (linhas 264-282 e 880-897)
    - app/(app)/clientes/page.tsx
    - tests/clientes/cliente-detail-sheet-encerrar.test.tsx (linhas 1-115: mocks das actions e buildCliente — molde do teste de tela)
    - tests/clientes/registro-acesso-cliente.test.ts (linhas 1-100: dublê de @/lib/supabase/server e next/cache com vi.hoisted — molde do teste da ação)
    - tests/clientes/kanban-card-filtrado.test.tsx (linhas 85-100: o único render do KanbanBoard)
  </read_first>
  <behavior>
    - Ação zero-linhas-vira-forbidden: com usuário logado e o DELETE devolvendo data nula e erro nulo, deleteCliente devolve error.code "forbidden" e não chama revalidatePath.
    - Ação apagou-uma-linha: DELETE devolvendo a linha { id: "c1" } -> devolve data.id "c1" e chama revalidatePath("/clientes").
    - Ação erro-do-banco-vira-generic: DELETE devolvendo erro -> error.code "generic".
    - Ação sem-sessao: getUser sem usuário -> error.code "unauthenticated" e nenhuma tabela é consultada.
    - Ação nao-le-perfil: em todos os casos, a única tabela consultada é "clientes" (nunca "profiles").
    - Tela vendedor-dono-em-andamento-ve-botao: isSupervisor false, currentUserId "vendedor-1", cliente com responsavel "vendedor-1" e status em_andamento -> botão "Apagar cliente" presente.
    - Tela vendedor-dono-fora-de-prospeccao-nao-ve (ganho, perdido, encerrado): botão ausente depois que a ficha carregou.
    - Tela vendedor-nao-dono-nao-ve: responsavel "vendedor-2", em_andamento -> ausente.
    - Tela sem-currentUserId-vendedor-nao-ve (caminho da Agenda): isSupervisor false e sem currentUserId -> ausente.
    - Tela supervisor-sempre-ve (os 4 status, responsavel de outro, sem currentUserId) -> presente.
    - Tela dialogo-definitivo: clicar em "Apagar cliente" abre o diálogo com a frase "Essa ação não pode ser desfeita e vai remover todo o histórico do funil." e os botões "Cancelar" e "Apagar".
    - Tela erro-amigavel-forbidden: deleteCliente devolve forbidden -> alerta "Você não tem permissão para apagar este cliente, ou ele já foi apagado."; onDeleted não é chamado.
    - Tela erro-generico: deleteCliente devolve generic -> alerta "Não foi possível apagar o cliente. Tente novamente."
    - Tela apagou-chama-onDeleted: deleteCliente devolve data { id: "c1" } -> onDeleted("c1") e onOpenChange(false).
  </behavior>
  <action>
1. RED — criar tests/clientes/apagar-cliente-action.test.ts (ambiente node) no molde de registro-acesso-cliente.test.ts: vi.hoisted com espiões (revalidatePath, um espião que registra o nome de toda tabela pedida em from) e um estado configurável (usuário logado ou nulo; resposta do maybeSingle de clientes); vi.mock de next/cache e de @/lib/supabase/server (auth.getUser lendo o estado; from devolvendo um construtor encadeável select/eq/delete/maybeSingle). Escrever os cinco casos de ação do bloco behavior. Criar tests/clientes/cliente-detail-sheet-apagar.test.tsx (jsdom) copiando os vi.mock e o buildCliente de cliente-detail-sheet-encerrar.test.tsx, com um renderSheet que aceita isSupervisor, currentUserId (opcional), onDeleted e onOpenChange; para afirmar ausência, esperar a ficha carregar (por exemplo, o combobox "Status") e então usar queryByRole do botão "Apagar cliente". Escrever os casos de tela do bloco behavior (it.each para os status). Rodar os dois arquivos e confirmar que FALHAM. Commit: `test(quick-261006-gvo): add failing tests for vendedor delete button and friendly forbidden error`.
2. GREEN — ação (per D-07): em deleteCliente de app/actions/clientes.ts, manter a checagem de sessão (getUser -> "unauthenticated" sem consultar tabela), REMOVER a leitura do perfil e o bloqueio por papel, tentar o DELETE exatamente como hoje (delete, eq por id, select id, maybeSingle); erro do banco -> "generic"; nenhuma linha devolvida -> "forbidden" (a RLS recusou, ou o cliente não existe mais); sucesso -> revalidatePath("/clientes") e devolve o id. Reescrever o JSDoc: a policy de DELETE da migration 0050 é a ÚNICA autoridade (vendedor ativo apaga os próprios em andamento; supervisor apaga qualquer), a ação não decide papel, e 0 linhas vira "forbidden". Manter o tipo DeleteClienteErrorCode igual. Não tocar em createCliente, updateCliente nem em nenhuma outra função do arquivo.
3. GREEN — ficha (per D-06): em components/clientes/ClienteDetailSheet.tsx, adicionar a prop opcional currentUserId (string) com JSDoc: id do usuário logado, passado só pela aba Clientes; sem ele, quem não é Supervisor nunca vê o botão de apagar (padrão seguro); é só conforto de tela — quem decide é a RLS da 0050. Adicionar a constante DELETE_FORBIDDEN_ERROR com o texto exato "Você não tem permissão para apagar este cliente, ou ele já foi apagado." ao lado de DELETE_GENERIC_ERROR. Calcular podeApagar = cliente carregado E (isSupervisor OU (currentUserId definido E cliente.responsavel igual a currentUserId E cliente.statusAcompanhamento igual a "em_andamento")), e usar podeApagar no lugar da condição atual do botão do cabeçalho (mesmo botão, mesmo texto, mesmo estilo). Em handleConfirmDelete, quando result.error.code for "forbidden" mostrar DELETE_FORBIDDEN_ERROR; nos demais erros e na exceção, DELETE_GENERIC_ERROR (como hoje). Manter o diálogo como está — a frase "Essa ação não pode ser desfeita e vai remover todo o histórico do funil." já existe e deve continuar exatamente assim. Como o status local já é atualizado após a troca de status, o botão some sozinho para o Vendedor se ele marcar o cliente como Perdido/Ganho na própria ficha.
4. GREEN — fiação só na aba Clientes (per D-10, AgendaList intocada): em components/clientes/KanbanBoard.tsx adicionar a prop OBRIGATÓRIA currentUserId (string) com JSDoc curto e repassá-la à ClienteDetailSheet (currentUserId={currentUserId}); nada mais muda no KanbanBoard. Em app/(app)/clientes/page.tsx passar currentUserId={user.id} ao KanbanBoard. Em tests/clientes/kanban-card-filtrado.test.tsx acrescentar currentUserId="supervisor-1" ao único render do KanbanBoard (nenhuma outra mudança). Rodar os testes até ficarem verdes, mais a regressão listada no verify. Commit: `feat(quick-261006-gvo): vendedor ve Apagar cliente nos proprios clientes em prospeccao; acao confia so na RLS`.
Não atualizar o Manual. Não tocar em components/agenda/AgendaList.tsx nem em nada das Agendas.
  </action>
  <verify>
    <automated>npx vitest run tests/clientes/apagar-cliente-action.test.ts tests/clientes/cliente-detail-sheet-apagar.test.tsx tests/clientes/cliente-detail-sheet-encerrar.test.tsx tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/registro-acesso-cliente.test.ts tests/agenda/agenda-list.test.tsx tests/agenda/agenda-calendario-integracao.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 app/actions/clientes.ts components/clientes/ClienteDetailSheet.tsx components/clientes/KanbanBoard.tsx "app/(app)/clientes/page.tsx" tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/cliente-detail-sheet-apagar.test.tsx tests/clientes/apagar-cliente-action.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Os dois arquivos novos tiveram rodada vermelha e agora estão verdes; regressão (encerrar, kanban, registro de acesso, agenda-list, integração do calendário) verde sem edição além da linha do currentUserId no teste do kanban.
    - deleteCliente não consulta profiles (provado pelo caso nao-le-perfil) e transforma 0 linhas em "forbidden"; createCliente/updateCliente intocados.
    - Botão: Vendedor só vê no cliente próprio em andamento com currentUserId; Supervisor sempre; diálogo com a frase de "definitivo" intacta; erro forbidden com o texto exato.
    - components/agenda/AgendaList.tsx sem nenhuma mudança.
    - tsc e eslint --max-warnings 0 limpos nos 7 arquivos.
  </acceptance_criteria>
  <done>A tela da aba Clientes mostra o botão ao Vendedor só onde a regra nova permite, a ação deixa a decisão para o banco, e os testes de tela e da ação provam isso.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Tarefa 3: Aprovação do dono — o que muda, apagar é definitivo, risco residual, LGPD e como voltar atrás</name>
  <read_first>
    - supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql (o que será aplicado)
    - supabase/rollbacks/0050_volta_policy_delete_clientes.sql (o desfazer)
    - Seção "Pesquisa registrada" deste plano
  </read_first>
  <action>Pausar a execução. Apresentar ao dono do projeto, em linguagem simples (ele não programa — CLAUDE.md), o texto dos blocos decision/context abaixo e só seguir depois de uma resposta explícita (per D-09/D-11). Não enviar arquivo para aplicação, não rodar supabase db push e não colar SQL em lugar nenhum antes disso. Ao devolver este checkpoint ao orquestrador com a resposta "aplicar", pedir que ele envie os commits das Tarefas 1 e 2 para a branch staging (nunca master) ANTES de apresentar a Tarefa 4 — o executor não faz push (per D-10). Se o dono escolher "ajustar" com mudança só de texto de tela: tratar nos arquivos da Tarefa 2, rodar o verify da Tarefa 2, registrar no SUMMARY e reapresentar. Se o ajuste mexer na regra (por exemplo, travar também clientes que já foram Ganho/Perdido, ou incluir a Agenda): isso muda decisão travada — registrar e devolver ao orquestrador para replanejar, sem implementar. A 0050 ainda NÃO está aplicada, então qualquer correção dela, se o orquestrador autorizar, é feita editando a própria 0050 junto com os testes estrutural e ao vivo.</action>
  <decision>Aplicar agora, no banco do sistema, a mudança 0050 que deixa o Vendedor apagar os próprios clientes que ainda estão Em andamento?</decision>
  <context>
    **Leia primeiro: a mudança no banco vale na hora, para todo o time.** O site de teste e o site que a equipe usa todo dia guardam os dados no MESMO banco.

    **O que muda para o time:**
    - Na aba Clientes, ao abrir a ficha de um cliente DELE que está "Em andamento", o Vendedor passa a ver o botão "Apagar cliente" (hoje só o Supervisor vê).
    - Em clientes Ganho, Perdido ou Encerrado o botão NÃO aparece para o Vendedor, e o banco também recusa se alguém tentar por fora da tela.
    - Na Agenda, a ficha do cliente continua sem esse botão para o Vendedor (só na aba Clientes, como pedido).
    - Supervisor: nada muda — continua apagando qualquer cliente.
    - Se o banco recusar, aparece a mensagem: "Você não tem permissão para apagar este cliente, ou ele já foi apagado."

    **Apagar é definitivo.** Não existe lixeira. Some o cliente e tudo dele: tarefas, visitas, produtos, todo o histórico do funil e o Diário. O aviso continua no diálogo de confirmação: "Essa ação não pode ser desfeita e vai remover todo o histórico do funil." O sistema também não guarda registro de quem apagou nem quando (isso já é assim hoje para o Supervisor).

    **Ponto de atenção para você decidir:** hoje o Vendedor já consegue voltar um cliente Perdido ou Ganho para "Em andamento". Depois disso, com a regra nova, ele conseguiria apagar esse cliente — e como o histórico vai junto, não sobra registro. Se você quiser travar isso também, escolha "ajustar" (exige replanejar a regra antes de aplicar).

    **Efeito nos números do Dashboard (nada é mudado no Dashboard):** um cliente apagado deixa de contar em "Clientes por etapa", prospecção por produto/categoria, "Negócios iniciados" do comparativo por vendedor (a taxa de conversão do vendedor pode subir, porque o total de iniciados diminui), tempo por etapa e na parte de atividade da aderência de uso.

    **Ordem segura que vamos seguir:**
    1. A nova versão da tela vai primeiro para o site de teste (staging), sem mexer no site real. Nesse momento, no site de teste o botão aparece para o Vendedor, mas o banco ainda recusa — inofensivo.
    2. Você cola e roda a mudança no banco (Tarefa 4).
    3. Eu confiro com os testes automáticos e no link do site de teste.
    4. Só então a mudança vai para o site real. Entre os passos 2 e 4, o site real ainda não mostra o botão ao Vendedor — também inofensivo.

    **Como voltar atrás, se precisar:** existe um arquivo pronto (`supabase/rollbacks/0050_volta_policy_delete_clientes.sql`) que se cola no mesmo lugar (SQL Editor) e devolve a regra antiga (só Supervisor apaga); e o botão some do Vendedor desfazendo uma única mudança do site. Atenção: clientes que já tiverem sido apagados NÃO voltam.

    **Alerta de conformidade (LGPD):** clientes PJ guardam dados pessoais de contato (nome, telefone e e-mail da pessoa de contato). Permitir que o Vendedor apague prospecções erradas ou abandonadas APOIA a minimização de dados (guardar só o necessário) e a eliminação prevista na LGPD; esta decisão fica registrada no resumo da tarefa. Em contrapartida, apagar remove também o histórico do cliente (perde-se a trilha do que foi feito com ele), e cópias que já tenham sido exportadas em planilha fora do sistema não são apagadas. Recomendação: avaliar o escopo à luz da LGPD e, se fizer sentido, orientar o time sobre quando apagar. A decisão é sua, como responsável pelos dados.

    **Dados reais nos testes:** os testes automáticos rodam no mesmo banco dos dados reais. Eles criam vendedores e clientes temporários com nomes inventados, apagam tudo no fim e nunca mostram dados reais.
  </context>
  <options>
    <option id="aplicar">
      <name>Aprovar e aplicar agora</name>
      <pros>O Vendedor passa a limpar as próprias prospecções sem depender do Supervisor; a regra fica no banco; existe volta atrás pronta.</pros>
      <cons>Apagar é definitivo e leva o histórico junto; fica o contorno de voltar o status para Em andamento antes de apagar; os números do Dashboard mudam quando alguém apaga.</cons>
    </option>
    <option id="ajustar">
      <name>Ajustar antes de aplicar</name>
      <pros>Permite mudar textos de tela agora, ou pedir uma regra mais rígida antes de tocar o banco.</pros>
      <cons>Mudança de regra volta para replanejamento e atrasa a entrega.</cons>
    </option>
  </options>
  <acceptance_criteria>
    - O dono respondeu "aplicar" (ou aprovação explícita equivalente) antes de qualquer envio de arquivo para aplicação, supabase db push ou execução no SQL Editor.
    - O SUMMARY registra a resposta e a ciência de: efeito imediato (banco compartilhado), botão só na aba Clientes, apagar é definitivo (com histórico e Diário), sem registro de quem apagou, o contorno de voltar o status, o efeito no Dashboard, a ordem segura, como voltar atrás e o alerta de LGPD.
    - O pedido ao orquestrador de enviar os commits das Tarefas 1-2 para staging antes da Tarefa 4 foi feito; nenhum push pelo executor.
    - Se o dono escolheu "ajustar", o caminho da action foi seguido antes de qualquer aplicação.
  </acceptance_criteria>
  <resume-signal>Responda "aplicar" para autorizar a 0050 no banco do sistema, ou "ajustar: ..." descrevendo o que mudar.</resume-signal>
  <done>Decisão explícita do dono registrada, com impacto, definitividade, risco residual, LGPD e volta atrás reconhecidos, e o envio para staging solicitado ao orquestrador.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Tarefa 4: [BLOCKING] Dono aplica a 0050 pelo SQL Editor da Supabase (tela nova já no staging)</name>
  <read_first>
    - .planning/phases/33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos/33-04-SUMMARY.md (mesmo caminho manual, já usado com sucesso)
    - .planning/STATE.md, Blockers/Concerns (o push de schema do executor é bloqueado neste ambiente)
  </read_first>
  <action>Pré-condição de ordem segura (per D-10): rodar `git fetch origin staging` e `git merge-base --is-ancestor <hash do commit feat da Tarefa 2> origin/staging`. Se falhar (a tela nova ainda não está no staging), NÃO enviar por conta própria: devolver ao orquestrador pedindo o envio dos commits das Tarefas 1-2 para staging (nunca master) e só então seguir. Com a pré-condição OK, enviar ao dono o arquivo supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql pela ferramenta de envio de arquivo ao usuário (mesmo caminho das Fases 27-33); se a ferramenta não estiver disponível, informar o caminho absoluto do arquivo. NÃO enviar o arquivo de volta para aplicação. Não tentar supabase db push nem qualquer contorno do bloqueio do ambiente (nada de gerar credencial, extrair token ou chamar API de gerenciamento) — per D-09. Passar ao dono as instruções do bloco how-to-verify e aguardar a confirmação.</action>
  <what-built>Um arquivo de mudança no banco (0050), aprovado na Tarefa 3, pronto para colar no SQL Editor; a nova versão da tela já está no site de teste (staging), sem afetar o site real.</what-built>
  <how-to-verify>
    1. Abrir o SQL Editor do projeto: https://supabase.com/dashboard/project/afbiwgbqkogsrhxjshkk/sql/new
    2. Colar o conteúdo COMPLETO de `0050_vendedor_apaga_cliente_em_prospeccao.sql` (o comentário do topo pode ir junto, é seguro), clicar em "Run" e esperar "Success. No rows returned".
    3. Se aparecer qualquer erro, copiar a mensagem e mandar aqui antes de tentar de novo.
    4. NÃO colar o arquivo `0050_volta_policy_delete_clientes.sql` — ele só serve se um dia você quiser desfazer.
  </how-to-verify>
  <resume-signal>Responda "aplicado" depois de ver "Success", ou cole a mensagem de erro.</resume-signal>
  <acceptance_criteria>
    - A pré-condição foi conferida (commit feat da Tarefa 2 contido em origin/staging) antes de enviar o arquivo; o executor não fez push.
    - O dono confirmou "Success" na 0050 (registrado no SUMMARY, com o caminho: SQL Editor, pelo dono); o arquivo de volta não foi aplicado.
    - Nenhuma tentativa de supabase db push ou contorno pelo executor.
    - O SUMMARY sugere ao dono, como passo opcional, `supabase migration repair --status applied 0050` (a 0050 é re-executável, então um push futuro não quebra mesmo sem o repair).
  </acceptance_criteria>
  <done>A 0050 está aplicada no banco, confirmada pelo dono, com a tela nova já disponível no Preview da staging.</done>
</task>

<task type="auto">
  <name>Tarefa 5: [BLOCKING] Testes ao vivo a VERDE contra o banco real + gate final + guarda de escopo</name>
  <files>tests/clientes/rls-apagar-cliente-prospeccao.test.ts</files>
  <read_first>
    - tests/clientes/rls-apagar-cliente-prospeccao.test.ts
    - supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql (aplicada)
    - .planning/STATE.md, Blockers/Concerns (limite de tentativas de login do Supabase Auth)
  </read_first>
  <action>
1. Rodar a guarda de escopo (primeiro comando do verify, base 27672fe per D-09) e depois `npx vitest run tests/clientes/rls-apagar-cliente-prospeccao.test.ts` até ficar verde. Se um caso falhar por comportamento do banco (por exemplo, a cascata não apagar os filhos, ou o vendedor ativo não conseguir apagar o próprio em andamento), PARAR e reportar ao orquestrador: a correção vira migration NOVA (0051 em diante) com nova aprovação do dono pelo mesmo caminho das Tarefas 3-4 — nunca edição da 0050 aplicada nem do arquivo de volta, e nunca uma função nova com privilégio elevado. Se falhar por erro do próprio teste, corrigir o teste sem afrouxar nenhuma asserção de D-01/D-02 (nenhum caso pode passar a aceitar linha apagada onde a regra proíbe) e registrar. Se o limite de login impedir a rodada, esperar e repetir o arquivo isolado (convenção das Fases 13/18/19), registrando. Nunca imprimir linhas lidas durante o diagnóstico (dados reais, LGPD).
2. Rodar o verify completo. Os arquivos tests/clientes/rls-clientes.test.ts e tests/clientes/update-delete.test.ts NÃO entram no gate (usam as contas semente antigas, apagadas — problema conhecido; ver 33-04-SUMMARY).
3. Registrar no SUMMARY: (a) resposta do dono e tudo o que ele reconheceu na Tarefa 3; (b) pré-condição de staging e aplicação pelo dono (Tarefa 4); (c) resultado dos testes ao vivo (8 casos) e do gate; (d) pesquisa (a) de cascata confirmada ao vivo pelo caso com cascata; (e) impacto no Dashboard (pesquisa b), em linguagem simples; (f) emenda do requisito CLI-06 por decisão do dono de 2026-10-06; (g) alerta de LGPD e a decisão registrada (apagar apoia a minimização; remove o histórico do cliente; cópias exportadas fora do sistema não são apagadas); (h) itens adiados: registro de quem apagou (trilha de exclusão — exigiria tabela nova ou função com privilégio elevado, decisão futura do dono), regra mais rígida contra o contorno de voltar status (se o dono quiser), casos antigos atualizados que continuam sem rodar (contas semente), passo opcional `supabase migration repair --status applied 0050`; (i) conferência humana do Preview da staging pendente (bloco human-check) e instrução ao orquestrador: só depois do Preview conferido levar para master; (j) como voltar atrás: colar supabase/rollbacks/0050_volta_policy_delete_clientes.sql no SQL Editor + reverter o commit feat da Tarefa 2 (clientes já apagados não voltam).
Commit `test(quick-261006-gvo): ...` só se o teste ao vivo precisou de correção; caso contrário, nenhum commit de código nesta tarefa. Não fazer push.
  </action>
  <verify>
    <automated>node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString();const base='27672fe';console.log('BASE='+g(['rev-parse',base]).trim());const ok=new Set(['supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql','supabase/rollbacks/0050_volta_policy_delete_clientes.sql','tests/clientes/apagar-cliente-migracao.test.ts','tests/clientes/rls-apagar-cliente-prospeccao.test.ts','tests/clientes/rls-clientes.test.ts','tests/clientes/update-delete.test.ts','app/actions/clientes.ts','components/clientes/ClienteDetailSheet.tsx','components/clientes/KanbanBoard.tsx','app/(app)/clientes/page.tsx','tests/clientes/kanban-card-filtrado.test.tsx','tests/clientes/cliente-detail-sheet-apagar.test.tsx','tests/clientes/apagar-cliente-action.test.ts']);const permitido=f=>f.startsWith('.planning/')||ok.has(f);const mudados=g(['diff','--name-only',base,'HEAD']).split('\n').map(s=>s.trim()).filter(Boolean);const sujos=g(['status','--porcelain']).split('\n').filter(Boolean).filter(l=>!l.startsWith('??')).map(l=>l.slice(3).trim());const fora=mudados.concat(sujos).filter(f=>!permitido(f));if(fora.length)throw new Error('fora do escopo: '+fora.join(', '));const mig=g(['diff','--name-status',base,'HEAD','--','supabase/migrations']).split('\n').map(s=>s.trim()).filter(Boolean);if(mig.length!==1||mig[0]!=='A\tsupabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql')throw new Error('migrations: '+mig.join(' | '));console.log('OK escopo 261006-gvo')" && npx vitest run tests/clientes/rls-apagar-cliente-prospeccao.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts tests/clientes/apagar-cliente-action.test.ts tests/clientes/cliente-detail-sheet-apagar.test.tsx tests/clientes/cliente-detail-sheet-encerrar.test.tsx tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/registro-acesso-cliente.test.ts tests/agenda/agenda-list.test.tsx tests/agenda/agenda-calendario-integracao.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 app/actions/clientes.ts components/clientes/ClienteDetailSheet.tsx components/clientes/KanbanBoard.tsx "app/(app)/clientes/page.tsx" tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/cliente-detail-sheet-apagar.test.tsx tests/clientes/apagar-cliente-action.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/clientes/rls-apagar-cliente-prospeccao.test.ts tests/clientes/rls-clientes.test.ts tests/clientes/update-delete.test.ts && npm run build</automated>
    <human-check>
      <test>Abrir o link de Preview da branch staging na Vercel (projeto RAIAR) e entrar como um vendedor: (1) na aba Clientes, criar um cliente de teste com nome inventado (ex.: "Teste Apagar Preview"), abrir a ficha dele — o botão "Apagar cliente" aparece; clicar, conferir o aviso "Essa ação não pode ser desfeita e vai remover todo o histórico do funil." e confirmar — o cliente some do kanban; (2) abrir a ficha de um cliente pela Agenda — o botão NÃO aparece para o vendedor. Depois entrar como Supervisor: o botão continua aparecendo em qualquer ficha (não precisa apagar nada real).</test>
      <expected>Vendedor apaga só o próprio cliente em andamento pela aba Clientes, com aviso de definitivo; na Agenda o vendedor não vê o botão; Supervisor sem mudança.</expected>
      <why_human>Conferência visual no site publicado de teste antes de levar para produção (CLAUDE.md, Fluxo de Deploy); os testes automáticos não abrem o Preview da Vercel.</why_human>
    </human-check>
  </verify>
  <acceptance_criteria>
    - tests/clientes/rls-apagar-cliente-prospeccao.test.ts verde por inteiro (8 casos) contra o banco real, inclusive a cascata (tarefas, visitas, cliente_produtos e historico zerados) e o vendedor desativado.
    - Gate verde: testes estruturais (inclusive o inventário de 11 sem edição), de tela, da ação e a regressão; tsc, eslint --max-warnings 0 nos arquivos tocados e npm run build sem erro.
    - Guarda de escopo OK desde 27672fe: só os 13 arquivos planejados (mais .planning/); supabase/migrations com exatamente uma linha "A" (a 0050); AgendaList e Agendas intocadas.
    - Nenhuma asserção de D-01/D-02 afrouxada; qualquer correção de teste ou migration nova está registrada no SUMMARY.
    - SUMMARY com os itens (a)-(j) da action; nenhum push pelo executor.
  </acceptance_criteria>
  <done>A regra nova está valendo no banco e provada contra ele, a tela está no staging pronta para a conferência do Preview, e o pacote inteiro está dentro do escopo combinado.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador (Vendedor/Supervisor) -> PostgREST/Postgres | Pedido de DELETE em clientes atravessa aqui; só a RLS da 0050 decide |
| ficha do cliente (UI) -> Server Action deleteCliente | Esconder o botão é só conforto; a ação não confia no papel vindo da tela |
| executor/dono -> banco de produção | Mudança de regra com efeito imediato; só com aprovação explícita e aplicação pelo dono |
| branch staging -> branch master | Preview usa o mesmo banco da produção; master só depois da conferência |
| dono (controlador) -> contatos dos clientes e vendedores (titulares) | Apagar elimina dados pessoais de contato e o histórico do cliente |
| suíte de testes -> banco de produção | Fixtures temporárias no projeto que guarda dados reais |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-gvo-01 | Elevation of Privilege | policy de DELETE de clientes (0050) | high | mitigate | USING exige responsavel = auth.uid() E status 'em_andamento' E perfil vendedor ativo, OU is_supervisor(); casos ao vivo: cliente de outro, ganho, perdido, encerrado -> 0 linhas |
| T-gvo-02 | Elevation of Privilege | vendedor desativado com sessão ainda válida | medium | mitigate | exists em profiles com ativo = true (mesmo trecho da 0048); is_supervisor() já exige ativo (0008); caso ao vivo vendedor-desativado-nao-apaga |
| T-gvo-03 | Spoofing | botão escondido na tela como se fosse segurança | low | mitigate | UI é só conforto; deleteCliente não lê papel e confia na RLS; teste nao-le-perfil; 0 linhas -> mensagem amigável |
| T-gvo-04 | Elevation of Privilege | anônimo | low | mitigate | policy "to authenticated"; caso ao vivo anonimo-nao-apaga |
| T-gvo-05 | Tampering | contorno: vendedor volta Ganho/Perdido para Em andamento e depois apaga | medium | accept | Fora da decisão travada D-01/D-02; apresentado ao dono na Tarefa 3 com a opção "ajustar" (replanejar regra mais rígida); registrado como item adiado no SUMMARY |
| T-gvo-06 | Repudiation | nenhum registro de quem apagou; historico do cliente sai na cascata | medium | accept | Já é assim para o Supervisor; registro de exclusão exigiria tabela nova ou função com privilégio elevado (proibido por D-02); dono informado na Tarefa 3; item adiado |
| T-gvo-07 | Elevation of Privilege | função nova com privilégio elevado ou edição de migration antiga | high | mitigate | Teste estrutural (sem cláusula, sem função, sem grant/alter); tests/agenda2/migracao-agenda2.test.ts (inventário de 11) no gate; guarda de escopo exige só a linha "A" da 0050 em supabase/migrations |
| T-gvo-08 | Tampering | aplicação em produção sem revisão | high | mitigate | Checkpoint bloqueante da Tarefa 3 antes de qualquer envio/aplicação; dono aplica pelo SQL Editor; executor nunca aplica nem faz push nem db push |
| T-gvo-09 | Denial of Service | staging e produção no mesmo banco | medium | mitigate | Ordem segura: tela no staging (pré-condição conferida na Tarefa 4) -> aplicação -> testes ao vivo + Preview -> master; estados intermediários inofensivos; volta atrás pronta antes de aplicar |
| T-gvo-10 | Information Disclosure (LGPD) | eliminação de dados de contato e do histórico; cópias exportadas fora do sistema | low | transfer | Decisão do dono como controlador (D-11): apagar apoia minimização/eliminação; alerta explícito na Tarefa 3; registro no SUMMARY; nenhuma exclusão automática |
| T-gvo-11 | Information Disclosure (LGPD) | testes ao vivo no banco real | medium | mitigate | Fixtures descartáveis, nomes inventados sem 8+ dígitos, sem CNPJ/endereço/contato, 2 logins, conferências só por id de fixture e por contagem, nada impresso, limpeza antes de apagar os membros |
</threat_model>

<source_audit>
SOURCE  | ID   | Item | Tarefa | Status
------- | ---- | ---- | ------ | ------
GOAL    | —    | Vendedor apaga os próprios clientes em prospecção na aba Clientes; Supervisor inalterado; Ganho/Perdido/Encerrado só Supervisor | 1, 2, 5 | COVERED
REQ     | QUICK-261006-gvo | Pedido do dono (emenda CLI-06) | 1-5 | COVERED
CONTEXT | D-01 | Regra de quem apaga | 1 (policy + ao vivo), 2 (botão) | COVERED
CONTEXT | D-02 | Só RLS, migration nova 0050, sem função elevada | 1, 5 | COVERED
CONTEXT | D-03 | Comentários ASCII em bloco, sem cláusula, sem tabela da Agenda 2 | 1 | COVERED
CONTEXT | D-04 | Arquivo de volta com a policy original | 1 | COVERED
CONTEXT | D-05 | Pesquisa (a) cascata e (b) Dashboard | Pesquisa registrada, 1 (caso cascata), 5 (SUMMARY) | COVERED
CONTEXT | D-06 | Botão para o Vendedor só no próprio em andamento; diálogo de definitivo | 2 | COVERED
CONTEXT | D-07 | Ação sem checagem de papel; 0 linhas = erro amigável | 2 | COVERED
CONTEXT | D-08 | Testes estrutural, ao vivo, tela e ação | 1, 2 | COVERED
CONTEXT | D-09 | Estrutura Fase 33 + gate final + guarda de escopo + sem push | 3, 4, 5 | COVERED
CONTEXT | D-10 | Staging antes da aplicação; Agendas/Manual intocados | 2, 3, 4, 5 | COVERED
CONTEXT | D-11 | LGPD no threat model e SUMMARY | 3, 5, threat_model | COVERED
</source_audit>

<verification>
- Tarefa 1: teste estrutural vermelho -> verde; inventário de 11 intacto; uma migration nova; teste ao vivo escrito e não executado.
- Tarefa 2: testes de tela e da ação vermelho -> verde; regressão verde; AgendaList intocada.
- Tarefa 3: aprovação explícita com definitividade, risco residual, Dashboard, LGPD e volta atrás reconhecidos.
- Tarefa 4: tela no staging conferida; dono aplica a 0050 no SQL Editor com "Success"; volta atrás não aplicada.
- Tarefa 5: 8 casos ao vivo verdes; gate (testes, tsc, eslint --max-warnings 0, build) verde; guarda de escopo OK; Preview pendente para o fim.
</verification>

<success_criteria>
- O Vendedor ativo apaga, pela aba Clientes, só os próprios clientes Em andamento; o banco recusa todo o resto; Supervisor inalterado.
- Nenhuma função nova com privilégio elevado; nenhuma migration antiga editada; exatamente uma migration nova; volta atrás pronta e documentada.
- Dono aprovou e aplicou ele mesmo; pendências (trilha de exclusão, contorno de status, contas semente) registradas.
</success_criteria>

<output>
Criar `.planning/quick/261006-gvo-vendedor-apaga-os-proprios-clientes-em-p/261006-gvo-SUMMARY.md` com os itens (a)-(j) da Tarefa 5, os hashes dos commits, o BASE impresso pela guarda e as notas para o dono em linguagem simples.
Não fazer push. O orquestrador leva para staging depois da Tarefa 3 e para master só depois da conferência do Preview da staging (CLAUDE.md, "Fluxo de Deploy").
</output>
