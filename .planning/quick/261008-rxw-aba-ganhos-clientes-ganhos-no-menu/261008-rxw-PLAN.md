---
phase: quick-261008-rxw
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-261008-rxw]
files_modified:
  - supabase/migrations/0053_clientes_ganhos.sql
  - supabase/rollbacks/0053_volta_clientes_ganhos.sql
  - tests/funil/ganhos-migracao.test.ts
  - tests/funil/ganhos-rpc.test.ts
  - lib/ganhos/lista.ts
  - lib/supabase/queries/ganhos.ts
  - app/actions/ganhos.ts
  - components/ganhos/GanhosItemRow.tsx
  - components/ganhos/GanhosPeriodoFilter.tsx
  - tests/funil/ganhos-lista.test.ts
  - tests/funil/ganhos-query.test.ts
  - tests/funil/ganhos-item-row.test.tsx
  - tests/funil/ganhos-periodo-filter.test.tsx
  - lib/clientes/dataDoGanho.ts
  - lib/validations/cliente.ts
  - lib/supabase/queries/clientes.ts
  - app/actions/clientes.ts
  - components/clientes/ClienteDetailSheet.tsx
  - tests/clientes/data-do-ganho.test.ts
  - tests/clientes/update-cliente-data-ganho.test.ts
  - tests/clientes/cliente-detail-sheet-data-ganho.test.tsx
  - tests/clientes/cliente-detail-sheet-apagar.test.tsx
  - tests/clientes/cliente-detail-sheet-encerrar.test.tsx
  - components/ganhos/GanhosList.tsx
  - app/(app)/ganhos/page.tsx
  - components/layout/AppSidebar.tsx
  - tests/funil/ganhos-list.test.tsx
  - tests/funil/app-sidebar-ganhos.test.tsx
  - tests/funil/app-sidebar-perdidos.test.tsx
  - tests/funil/app-sidebar-encerrados.test.tsx
  - tests/agenda2/app-sidebar-agenda2.test.tsx

must_haves:
  truths:
    - "D-01/D-08/P-04: Vendedor e Supervisor veem no menu principal um item 'Ganhos' (ícone de troféu, sem contador) entre Clientes e Perdidos; a ordem visível passa a ser Agenda, Clientes, Ganhos, Perdidos, Encerrados, Dashboard; /ganhos fica dentro do grupo protegido (app) e manda para /login quem não tem sessão, igual a /perdidos."
    - "D-02/D-16: a tela Ganhos lista os clientes com status ganho HOJE; cada linha mostra o nome exibido (Nome Fantasia, senão razão social), 'Ganho em dd/MM/aaaa' (ou 'Data não informada' quando a data real do ganho está vazia) e — só para o Supervisor — o nome do vendedor; busca por nome e filtro de período Tudo / Últimos 30 dias / Últimos 90 dias / Personalizado iguais aos de Perdidos; ordem pela data do ganho, mais recente primeiro, vazias por último."
    - "D-16/P-13/P-16: clientes sem data do ganho aparecem SÓ em 'Tudo' (nunca em 30 dias, 90 dias nem Personalizado), e a tela avisa isso quando um período com recorte está ativo — provado ao vivo e na tela."
    - "D-13/D-14/P-12: clientes.ganho_em (data, opcional) é preenchida sozinha com a data de São Paulo quando o status passa a ganho e ela está vazia; nunca sobrescreve uma data existente; não é preenchida em cadastro direto (cliente importado já ganho fica vazio) — provado ao vivo."
    - "D-15: na aplicação, os clientes ganhos sem data recebem a data (São Paulo) do registro mais recente de troca para ganho no histórico; os sem registro ficam vazios — provado estruturalmente (texto exato do backfill) e conferível pelo dono com uma contagem só de números."
    - "D-17/P-14/P-15: a ficha de um cliente ganho mostra o campo opcional 'Data do ganho' (oculto para os demais status); quem já pode editar a ficha pela RLS pode preencher/corrigir/limpar a data; data no futuro ou antes de 01/01/1990 é recusada no navegador e no servidor; data anterior ao cadastro no CRM é aceita; o servidor recusa a data se o cliente não estiver ganho naquele momento (P-18); um 'Salvar alterações' sem mexer no campo nunca grava nem apaga a data."
    - "D-06/P-11: o Vendedor recebe só os próprios clientes ganhos e o Supervisor recebe todos — decidido só pela RLS (sem checagem de papel na leitura nem no gatilho), provado ao vivo; a leitura devolve exatamente 6 colunas, nenhuma de contato; esconder o nome do vendedor de quem não é Supervisor é só de tela."
    - "D-05: clicar numa linha (ou Enter/espaço com o foco nela) abre a MESMA ficha do funil (ClienteDetailSheet); salvar, apagar ou encerrar pela ficha recarrega a lista — cliente encerrado some da tela Ganhos."
    - "D-03/D-04/P-03: a lista não tem coluna de motivo, nem dado de contato, nem botão Reabrir."
    - "D-06/D-07/D-12/D-18: exatamente UMA migration nova (0053, reescrita por commits novos antes de qualquer aplicação) e UM arquivo de volta desde 89a8707bd3e4ef581951d84f97906ca02e15b76e, sem cláusula de elevação de privilégio, inventário de 11 funções elevadas intacto, nenhuma policy nova, volta atrás com NAO APLICAR avisando que APAGA as datas; o dono aprovou e aplicou a 0053 ANTES de qualquer publicação (o código novo lê a coluna em TODA ficha)."
    - "D-08/D-18: Agenda, funil de Clientes, Perdidos, Encerrados e Dashboard não mudam; a ficha muda só pelo campo 'Data do ganho' e sua fiação; o código hoje em produção continua funcionando com a coluna nova."
  artifacts:
    - path: supabase/migrations/0053_clientes_ganhos.sql
      provides: "Coluna clientes.ganho_em, gatilho de preenchimento sem elevação, backfill único pelo histórico e leitura clientes_ganhos(p_inicio, p_fim) com 6 colunas"
      contains: "alter table clientes add column if not exists ganho_em date;"
    - path: supabase/rollbacks/0053_volta_clientes_ganhos.sql
      provides: "Volta atrás (leitura, gatilho, função do gatilho e coluna), fora de supabase/migrations, NAO APLICAR, aviso de que apaga as datas"
      contains: "NAO APLICAR"
    - path: tests/funil/ganhos-migracao.test.ts
      provides: "Teste estrutural (fs) da 0053 reescrita: SQL exato, coluna, gatilho, backfill, leitura, mesmas regras de acesso da 0034, sem elevação, comentários seguros, volta atrás"
      contains: "mesmas-regras-de-acesso-da-0034"
    - path: tests/funil/ganhos-rpc.test.ts
      provides: "Testes ao vivo (gatilho, vazio só em Tudo, edição pela RLS, período em data de São Paulo, ordem com vazios por último, RLS), VERMELHOS até o dono aplicar a 0053"
      contains: "sem-data-so-em-tudo"
    - path: lib/clientes/dataDoGanho.ts
      provides: "hojeEmSaoPaulo e validarDataDoGanho (regra única do navegador e do servidor)"
      contains: "export function validarDataDoGanho"
    - path: lib/validations/cliente.ts
      provides: "updateClienteSchema com ganhoEm opcional validado no superRefine do objeto"
      contains: "ganhoEm"
    - path: app/actions/clientes.ts
      provides: "updateCliente grava ganho_em só quando ganhoEm está presente no envio"
      contains: "ganho_em"
    - path: components/clientes/ClienteDetailSheet.tsx
      provides: "Campo 'Data do ganho' só para cliente ganho; envia só quando mexido; relê a data depois de marcar ganho"
      contains: "Data do ganho"
    - path: lib/ganhos/lista.ts
      provides: "Camada pura: ClienteGanho (6 campos, ganhoEm opcional), presets, período, validação, busca, DATA_GANHO_AUSENTE"
      contains: "export function resolvePeriodoGanhos"
    - path: lib/supabase/queries/ganhos.ts
      provides: "Leitor paginado getClientesGanhos (ganho_em desc com vazios por último, cliente_id asc)"
      contains: "nullsFirst: false"
    - path: app/actions/ganhos.ts
      provides: "Server Action getClientesGanhosAction"
      contains: "getClientesGanhosAction"
    - path: components/ganhos/GanhosList.tsx
      provides: "Tela inteira + aviso de 'sem data só em Tudo' + ClienteDetailSheet aberta pela linha"
      contains: "ClienteDetailSheet"
    - path: app/(app)/ganhos/page.tsx
      provides: "Rota protegida /ganhos com os catálogos que a ficha exige"
      contains: "getCategoriasAtivas"
    - path: components/layout/AppSidebar.tsx
      provides: "Item Ganhos (Trophy) entre Clientes e Perdidos"
      contains: "href: \"/ganhos\""
  key_links:
    - from: "components/ganhos/GanhosList.tsx"
      to: "app/actions/ganhos.ts getClientesGanhosAction -> lib/supabase/queries/ganhos.ts getClientesGanhos -> RPC clientes_ganhos -> clientes.ganho_em"
      via: "efeito de carga com reloadKey e intervalo memorizado, leitura paginada"
      pattern: "getClientesGanhosAction\\("
    - from: "gatilho trg_clientes_preenche_ganho_em (0053)"
      to: "clientes.ganho_em"
      via: "BEFORE UPDATE com WHEN (status passa a ganho e ganho_em vazio) — cobre mover_card_funil, reativação e qualquer UPDATE permitido pela RLS"
      pattern: "execute function clientes_preenche_ganho_em"
    - from: "ClienteDetailSheet campo ganhoEm"
      to: "app/actions/clientes.ts updateCliente -> clientes.ganho_em"
      via: "enviado só quando sujo (dirtyFields); gravado só quando presente; '' vira nulo; schema revalida no servidor"
      pattern: "ganho_em"
    - from: "lib/supabase/queries/clientes.ts getClienteById"
      to: "coluna clientes.ganho_em"
      via: "select explícito acrescido de ganho_em (por isso a coluna tem de existir ANTES da publicação)"
      pattern: "ganho_em"
    - from: "ClienteDetailSheet onSaved/onDeleted/onStatusChanged"
      to: "GanhosList handleRecarregar (reloadKey)"
      via: "mesma fiação da Agenda (components/agenda/AgendaList.tsx linhas 440-452)"
      pattern: "onStatusChanged=\\{handleRecarregar\\}"
    - from: "tests/funil/ganhos-migracao.test.ts"
      to: "supabase/migrations/0034_clientes_perdidos.sql"
      via: "mesmas regras de acesso: language sql, stable, sem elevação, sem checagem de papel, tabelas lidas pela 0053 contidas nas da 0034, expressão de responsavel_nome idêntica"
      pattern: "mesmas-regras-de-acesso-da-0034"
    - from: "components/layout/AppSidebar.tsx PRINCIPAL_SECTION"
      to: "/ganhos"
      via: "link entre /clientes e /perdidos, sem badgeCount"
      pattern: "Trophy"
---

<objective>
Pedido do dono (2026-10-08): criar no menu uma aba "Ganhos" (clientes ganhos), ao lado de "Perdidos". Hoje, depois que a Agenda antiga saiu do menu, não existe nenhum lugar que liste os clientes com status ganho — e por isso também não há caminho visível até a ficha deles. REVISÃO do mesmo dia (decisão do dono no chat): "a data de ganho deveria ser a data de ganho" — a data mostrada passa a ser um CAMPO REAL do cliente ("Data do ganho"), preenchido sozinho quando o cliente vira ganho, recuperado do histórico para os ganhos atuais e editável na ficha para quem foi importado sem essa informação.

Explicando sem jargão: (1) o banco ganha uma coluna nova "data do ganho" no cliente, uma regra automática que a preenche quando o cliente vira ganho, um preenchimento único dos ganhos de hoje a partir do histórico e uma leitura nova para a tela; (2) quem decide quais clientes cada pessoa vê e edita continua sendo a regra de acesso do banco (vendedor os seus; Supervisor todos); (3) a tela Ganhos é uma cópia de comportamento da tela Perdidos, sem motivo e sem "Reabrir", e clicar num cliente abre a mesma ficha do funil — que ganha o campo "Data do ganho" quando o cliente é ganho; (4) o PRÓPRIO dono cola a mudança no SQL Editor depois de aprovar, e só depois o código é publicado (o site de teste e o de produção usam o MESMO banco, e o código novo lê a coluna nova em toda ficha).

Estado de execução ao revisar: a Tarefa 1 já rodou uma vez com o desenho antigo (commits 5a5419e, 92394bc, db416a8 — só locais; a 0053 NUNCA foi aplicada nem publicada). Esta revisão REESCREVE os mesmos 4 arquivos dessa tarefa com commits NOVOS por cima — sem amend, sem rebase, sem force; o histórico fica honesto.

Decisões do dono, numeradas para rastreio:
- D-01: Nova aba "Ganhos" no menu principal, perto de "Perdidos", listando clientes com status_acompanhamento = 'ganho' (status ATUAL).
- D-02: Colunas/comportamento IGUAIS a Perdidos: nome (nomeExibicaoCliente: Nome Fantasia / razão social); data do ganho (desde a revisão: a coluna ganho_em — ver D-13/D-16); nome do vendedor só para o Supervisor (a RLS decide as linhas; Vendedor só os próprios); mesmo filtro de período (Tudo, Últimos 30 dias, Últimos 90 dias, Personalizado) e mesma busca por nome.
- D-03: SEM coluna de motivo. SEM dado de contato na lista (telefone/e-mail/contato ficam só na ficha — minimização LGPD).
- D-04: SEM ação "Reabrir" (ver P-03).
- D-05: Clicar numa linha ABRE A FICHA do cliente (a mesma ClienteDetailSheet do funil); catálogos fornecidos por página de servidor como app/(app)/agenda/page.tsx; nunca duplicar a ficha.
- D-06: Banco — migration 0053 (próxima depois da 0052), leitura clientes_ganhos(p_inicio, p_fim) no estilo da 0034: language sql stable, SEM cláusula de elevação de privilégio, sem checagem de papel, RLS como única fronteira, 6 colunas mínimas (cliente_id, razao_social, nome_fantasia, ganho_em, responsavel, responsavel_nome). Comentários ASCII num bloco barra-asterisco. Arquivo de volta em supabase/rollbacks (não aplicado automaticamente, cabeçalho NAO APLICAR). Inventário de funções elevadas intacto.
- D-07: Ordem — o dono aplica a migration PRIMEIRO e só depois o código é publicado; nada vai para o GitHub antes.
- D-08: Menu — item "Ganhos" na AppSidebar, ordem deliberada com testes/comentários do menu atualizados de propósito; ícone distinto de Archive/PauseCircle; rota protegida como /perdidos; Agenda e todo o resto intocados.
- D-09: Testes — estrutural da migration, camada pura, leitor e ação (dublês), tela (linhas, período, nome do vendedor só para o Supervisor, clique abre a ficha), menu, ficha (campo novo), testes ao vivo (no máximo 2 logins, nomes inventados, nunca imprimir dado real, sem tocar a tabela de acesso diário da aderência, sem deixar resíduo; VERMELHOS até o dono aplicar; escritos mas NÃO executados antes da aplicação).
- D-10: Gate final — testes afetados, tsc, eslint --max-warnings 0 nos arquivos tocados, npm run build com código de saída conferido, guarda de escopo (exatamente 1 migration nova + 1 arquivo de volta). NÃO rodar a suíte legada inteira (~49 arquivos vermelhos pré-existentes).
- D-11: Commits só locais, NENHUM push (o orquestrador publica depois da migration aplicada e do gate verde). Todo commit termina com "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>". Nunca adicionar .planning/config.json a um commit.
- D-12: O agente NUNCA aplica SQL nem usa db push. Checkpoints do dono (decisão + ação humana) em português simples, com alerta de LGPD. Prazo: idealmente pronto nesta semana.
- D-13 (revisão 2026-10-08): "Ganho em" é uma coluna REAL e opcional do cliente — clientes.ganho_em (data), a "data real do ganho". A data de cadastro como reserva (antiga P-02) foi RECUSADA pelo dono.
- D-14: ganho_em é preenchida AUTOMATICAMENTE (data de São Paulo) quando o status do cliente passa a ser 'ganho' e ela está vazia; o planejador escolhe o mecanismo mais seguro (P-12), sem função elevada nova e com o inventário de 11 intacto.
- D-15: BACKFILL na mesma migration para os clientes ganhos de hoje: data (São Paulo) do registro MAIS RECENTE de troca para "ganho" no histórico. Sem registro (importados pela planilha de Clientes Ativos) fica vazio.
- D-16: Lista — "Ganho em" mostra ganho_em; vazio mostra "Data não informada". Filtros de período: linha sem data aparece SÓ em "Tudo" (fora de 30 dias, 90 dias e Personalizado) — dito claramente ao dono e na tela. Ordem: ganho_em do mais recente para o mais antigo, vazios por último.
- D-17: Ficha — campo opcional "Data do ganho", visível/editável só quando o cliente é ganho, para quem já pode editar a ficha pela RLS atual (nenhuma policy nova). Entra no schema zod (lib/validations/cliente.ts), na ação de edição e na leitura que alimenta a ficha. Validação sensata, SEM proibir datas anteriores ao cadastro no CRM (o ganho real pode ser anterior à importação). Testes que conferem colunas/forma do cliente atualizados de propósito.
- D-18: A 0053 (nunca aplicada nem publicada) é reescrita no MESMO arquivo, por commits novos; continua UMA migration. O arquivo de volta remove a leitura, o gatilho, a função do gatilho e a coluna, e AVISA que desfazer APAGA as datas preenchidas. O código hoje em produção precisa continuar funcionando com a coluna nova presente.

Escolhas do planejador (discricionárias, documentadas):
- P-01: Leitura por RPC (molde 0034/0036), agora sobre a coluna real; nenhuma tela existente a chama.
- P-02: REVOGADA pela D-13 (era "data de cadastro como reserva"). Nada da versão antiga (junção com o histórico na leitura, reserva por criado_em) sobrevive na 0053 reescrita.
- P-03: Sem ação na linha. "Desganhar" um cliente não é fluxo do negócio; a saída de um cliente ativo é "Encerrar" (Fase 29), que mora dentro da ficha; onStatusChanged recarrega a lista e o encerrado some.
- P-04: Ordem do menu Agenda, Clientes, Ganhos, Perdidos, Encerrados, Dashboard; ícone Trophy (BadgeCheck já é "Importar Clientes Ativos"; Archive = Perdidos; PauseCircle = Encerrados); sem contador.
- P-05: Módulos IRMÃOS, sem import cruzado com Perdidos/Encerrados (precedente da Fase 29): lib/ganhos/lista.ts, lib/supabase/queries/ganhos.ts, app/actions/ganhos.ts, components/ganhos/*.
- P-06: Página app/(app)/ganhos/page.tsx no molde de app/(app)/agenda/page.tsx (categorias e produtos ativos; vendedorOptions só para o Supervisor).
- P-07: Linha clicável no molde de AgendaItemRow (role="button", tabIndex 0, Enter/espaço, rótulo "Abrir ficha de {nome}"); nenhum botão dentro da linha.
- P-08: A ficha recebe isSupervisor, os 3 catálogos e onSaved/onDeleted/onStatusChanged = recarregar; NÃO recebe currentUserId (igual à Agenda).
- P-09: Ordem das tarefas: 1 (banco e testes, local) -> 2 (decisão do dono) -> 3, 4, 5 (código, commits só locais) -> 6 (dono aplica o SQL; pré-condição: nenhum commit feat desta quick em origin/staging nem origin/master) -> 7 (testes ao vivo + gate).
- P-10: Os 3 testes de ordem do menu são atualizados DE PROPÓSITO para incluir /ganhos, com um comentário citando esta quick task.
- P-11: responsavel_nome volta da RPC para QUALQUER chamador autenticado (mesmo desenho da 0034); o Vendedor só recebe as próprias linhas pela RLS, então o único nome que ele recebe é o dele. Esconder o nome do vendedor de quem não é Supervisor é só conforto de TELA — registrado no SUMMARY (item m).
- P-12: Mecanismo do preenchimento automático = gatilho BEFORE UPDATE NOVO (trg_clientes_preenche_ganho_em -> função clientes_preenche_ganho_em), SEM elevação (roda como quem fez o UPDATE e só escreve NEW.ganho_em da própria linha), com a condição no WHEN (status novo = ganho, status antigo diferente, ganho_em vazio). Por que não dentro de mover_card_funil: recriar a função de escrita mais crítica (assinatura sensível — 0018; travas de ganho 0018/0025/0036) por uma linha é risco desproporcional, e o gatilho cobre TODO caminho (mover_card_funil, reativação de encerrado, qualquer UPDATE que a RLS permita). Por que não estender clientes_before_update: ela é elevada (está no inventário) — recriá-la exigiria copiar o corpo vigente e mantê-la elevada; uma função nova, pequena e sem elevação deixa o inventário em 11. Só em UPDATE: cliente cadastrado já ganho (planilha de Ativos) fica vazio (D-15/D-16). Nunca sobrescreve uma data existente (protege a data digitada na ficha numa futura reativação). Não limpa a data quando o cliente sai de ganho.
- P-13: Período em data de São Paulo. Os parâmetros continuam instantes (timestamptz) para a camada pura ser irmã idêntica de Perdidos; a RPC converte p_inicio/p_fim para a data de São Paulo; fim continua EXCLUSIVO (o Personalizado manda a meia-noite do dia seguinte ao último dia, então o último dia entra). Linha com ganho_em vazio cai fora de qualquer recorte pela comparação com nulo — só "Tudo" (os dois limites nulos) a mostra.
- P-14: Campo da ficha = entrada de data nativa (Input type="date", max = hoje em São Paulo): digitar uma data de anos atrás é mais rápido que folhear um calendário mês a mês, nenhuma dependência nova, e o valor já é AAAA-MM-DD como a coluna. Validação numa regra pura única (lib/clientes/dataDoGanho.ts) chamada pelo superRefine do OBJETO em updateClienteSchema (nunca refine por campo — mesmo motivo do JSDoc do schema), portanto valendo no navegador e no servidor: opcional; vazio = limpar; formato AAAA-MM-DD e data de calendário real ("Informe uma data válida."); não no futuro em relação a hoje de São Paulo ("A data do ganho não pode ser no futuro."); a partir de 01/01/1990, só para pegar erro de digitação de ano ("Informe uma data a partir de 01/01/1990."); data anterior ao cadastro no CRM é ACEITA (D-17).
- P-15: Gravação só quando o campo foi mexido. A ficha envia ganhoEm SÓ se o campo estiver sujo (formState.dirtyFields); updateCliente grava ganho_em SÓ se ganhoEm vier presente (mesmo padrão T-16-18 de nome fantasia/CNPJ/frequência de pedidos), com "" virando nulo. Assim um "Salvar alterações" qualquer nunca apaga a data que o gatilho acabou de gravar (mesma armadilha já vista com o CNPJ, T-18-11). Depois de marcar ganho pela própria ficha, ela relê o cliente (getClienteDetalhe) e mostra a data gravada com resetField (sem sujar o campo); falha nessa releitura é ignorada.
- P-16: Tela Ganhos mostra, quando um período com recorte está ativo, o aviso "Clientes sem data do ganho aparecem só em "Tudo"."
- P-17: ClienteDetalhe ganha ganhoEm OBRIGATÓRIO (string | null) — o tsc obriga a atualizar DE PROPÓSITO os construtores de teste de tests/clientes/cliente-detail-sheet-apagar.test.tsx e tests/clientes/cliente-detail-sheet-encerrar.test.tsx (só acrescentar ganhoEm: null). Exportação de clientes, Kanban, importação e Dashboard NÃO ganham a coluna (fora de escopo).
- P-18: Defesa no servidor além da tela: updateCliente só aceita ganhoEm quando o status ATUAL do cliente é ganho, lido pelo cliente Supabase da própria sessão (sujeito à RLS — sem linha = not_found); senão devolve o código ganho_em_fora_de_ganho, que a ficha mostra como "A data do ganho só pode ser informada para clientes ganhos.". A leitura extra só acontece quando ganhoEm vem no envio, então nenhum outro salvamento muda de comportamento nem de custo. A regra de tela (campo só para ganho) continua.

Purpose: devolver ao time um lugar para ver os clientes ganhos com a data real do ganho e chegar à ficha deles, com o mínimo de dado pessoal na lista e a mesma regra de acesso de sempre.
Output: migration 0053 reescrita (coluna + gatilho + backfill + leitura) + arquivo de volta + leitura/ação/camada pura + tela Ganhos com a ficha + campo "Data do ganho" na ficha + item de menu + testes; aplicação feita pelo dono ANTES de publicar; gate final verde.
</objective>

<execution_context>
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/Supabase-conventions/SKILL.md
@supabase/migrations/0034_clientes_perdidos.sql
@.planning/quick/261008-mrf-aderencia-de-uso-parcial-no-comparativo-/261008-mrf-PLAN.md
</context>

## Pesquisa registrada (verificada lendo o código em 2026-10-08, base 89a8707)

**Molde Perdidos (Fase 28).** app/(app)/perdidos/page.tsx, components/perdidos/{PerdidosList,PerdidosItemRow,PerdidosPeriodoFilter}.tsx, lib/perdidos/lista.ts, lib/supabase/queries/perdidos.ts, app/actions/perdidos.ts; testes tests/funil/perdidos-{lista,query,item-row,periodo-filter,list,rpc}.test.ts(x). Encerrados (Fase 29) é a cópia irmã já feita uma vez (nomes com sufixo, ex.: temRecortePeriodoEncerrados).

**Histórico e gatilhos de clientes.** 0002 linhas 411-441: clientes_after_update_historico grava, quando o status muda, tipo 'status_acompanhamento' e 'Status alterado para "<novo>"' (só o valor NOVO — ilike '%"ganho"%' casa só com trocas PARA ganho). Gatilhos de clientes existentes: trg_clientes_before_update (0002, elevada; renova atualizado_em em TODO update e etapa_alterada_em quando a etapa muda), trg_clientes_after_update_historico (0002, elevada; só grava em troca de etapa/status), trg_clientes_bloqueia_duplicata_razao_social_cnpj (0030; só em insert ou update OF razao_social, cnpj). Logo o backfill (UPDATE só de ganho_em) NÃO dispara a trava de duplicata nem grava histórico, mas renova atualizado_em dos clientes atualizados (nenhuma tela lê clientes.atualizado_em de cliente ganho — conferido por busca em lib/app/components; só as reservas de clientes_perdidos/clientes_encerrados usam, e só para perdidos/encerrados). Policy de UPDATE de clientes (0002 linhas 195-199): USING/WITH CHECK por dono ou Supervisor, sem restrição de coluna — a coluna nova fica editável por quem já edita a linha, sem policy nova. Nenhuma função devolve "setof clientes"/tipo de linha de clientes e nenhum código faz select de todas as colunas de clientes (busca por select("*") sem resultado) — coluna nova não muda nenhuma leitura existente.

**Caminhos que levam a ganho.** mover_card_funil (Kanban, ficha, reativação de encerrado) faz UPDATE em clientes — o gatilho novo cobre; importar_clientes_ativos_lote (0027) INSERE já ganho — o gatilho (só UPDATE) não preenche, por desenho (D-15/D-16).

**Ficha do cliente.** components/clientes/ClienteDetailSheet.tsx: props nas linhas 214-245; useForm com zodResolver(updateClienteSchema) e defaultValues (linhas 280-300); carga por getClienteDetalhe + form.reset(toFormValues(...)) (linhas 350-362); toFormValues (linhas 150-199) preenche os campos de cliente ativo para QUALQUER status (só são renderizados quando ganho); handleStatusChange (linha 412) — no sucesso sincroniza CNPJ no formulário por causa da T-18-11 (linhas 465-480) e chama onStatusChanged; bloco de campos só-de-ganho começa na linha 1059 (nome fantasia, CNPJ, frequência de pedidos com texto de apoio); onSubmit (linhas 692-713) chama updateCliente(values) e onSaved(values); botão "Salvar alterações" (linha 1549). Nenhum campo de data digitada existe hoje no formulário (as datas de tarefa usam Popover+Calendar fora do formulário).
**Leitura e gravação da ficha.** lib/supabase/queries/clientes.ts: tipo ClienteDetalhe (linhas 88-136), linha crua ClienteDetalheRow (linhas 138-166), getClienteById com select explícito (linhas 175-220). app/actions/clientes.ts: getClienteDetalhe (linhas 160-179), updateCliente (linhas 197-393) — safeParse do schema, gravação condicional à presença dos campos de cliente ativo (linhas 315-333), registrarAcessoDiario e revalidatePath no fim. lib/validations/cliente.ts: updateClienteSchema (linhas 101-145) com superRefine no objeto (responsavel).
**Testes da ficha.** tests/clientes/cliente-detail-sheet-encerrar.test.tsx e cliente-detail-sheet-apagar.test.tsx: só dublês (actions de clientes/funil/tarefas/encerrados e cliente de navegador), construtor buildCliente com ClienteDetalhe completo — molde do teste novo. tests/clientes/cliente-actions.test.ts e cliente-ativo-campos.test.ts misturam casos puros com casos contra o banco que usam as contas semente apagadas (parte da suíte legada vermelha) — NÃO são executados nem editados; a cobertura nova vai em arquivos novos só puros/dublês.

**Menu.** components/layout/AppSidebar.tsx linhas 98-126 (PRINCIPAL_SECTION) e 77-97 (JSDoc da ordem); Administração usa BadgeCheck; lucide-react 1.24.0 exporta Trophy (classe lucide-trophy). Testes de ordem a atualizar: tests/funil/app-sidebar-perdidos.test.tsx ("ordem"), tests/funil/app-sidebar-encerrados.test.tsx ("ordem"), tests/agenda2/app-sidebar-agenda2.test.tsx ("ordem-d15"). Demais testes do menu (tests/agenda/app-sidebar-agenda.test.tsx, tests/importacao/AppSidebar.test.tsx, tests/layout/app-sidebar-visual.test.tsx, tests/agenda2/app-layout-contagem.test.tsx) são só dublês e continuam verdes SEM edição.

**Inventário de funções elevadas.** tests/agenda2/migracao-agenda2.test.ts: varre TODAS as migrations em minúsculas SEM linhas de dois hífens mas COM blocos barra-asterisco, captura cada "create [or replace] function nome(...)" até o primeiro fechamento de cifrões duplos com ponto e vírgula e exige 11 elevadas. Por isso: cada função da 0053 termina com o fechamento de cifrões duplos seguido de ponto e vírgula (language ANTES do "as"), o bloco de comentário não contém a frase de criação de função, nem a cláusula de elevação, nem o nome da tabela da Agenda 2.

**Testes ao vivo (molde).** tests/funil/perdidos-rpc.test.ts, tests/funil/encerrados-rpc.test.ts e o ganhos-rpc.test.ts já escrito na primeira execução: createTestMember/deleteTestMember (tests/helpers/supabase-test-clients.ts: anonClient, serviceClient, signInAs, createTestMember(role, label) -> { id, email, password, nome, sobrenome }, deleteTestMember), 2 logins, semeadura pelo cliente de serviço, CNPJ único (trava 0030), leituras com .in("cliente_id", ids), afterEach apaga clientes (histórico em cascata), afterAll apaga membros. Constraints: ganho exige etapa 'primeira_venda'; perdido exige motivo_perda_id; encerrado exige motivo_encerramento_id.

**Fuso.** São Paulo está em UTC-03:00 o ano todo (sem horário de verão desde 2019) — meia-noite de São Paulo = 03:00Z.

## Contrato SQL (texto exato)

Bloco de comentário do topo da 0053 (um único bloco barra-asterisco, só ASCII, português sem acento, nenhuma linha começando com dois hífens, sem a palavra inglesa de função, sem cifrões duplos, sem a cláusula de elevação, sem o nome da tabela da Agenda 2). Deve dizer: quick task 261008-rxw, decisoes do dono de 2026-10-08 (revisada no mesmo dia: a data do ganho e um campo real); (1) coluna nova clientes.ganho_em, data opcional, "data real do ganho"; (2) preenchimento automatico: quando o status passa a ganho e a coluna esta vazia, recebe a data de hoje em Sao Paulo; nunca sobrescreve data existente; nao roda em cadastro direto, entao cliente importado ja ganho fica sem data ate alguem preencher na ficha; a regra roda com as permissoes de quem faz a alteracao, sem elevacao de privilegio, e so escreve na propria linha alterada; (3) preenchimento unico desta aplicacao: clientes ganhos sem data recebem a data (Sao Paulo) do registro mais recente de troca de status para ganho no historico; sem registro, ficam sem data; efeito colateral conhecido: a data de ultima atualizacao desses clientes passa a ser a hora da aplicacao; (4) leitura clientes_ganhos(p_inicio, p_fim): quais clientes estao ganhos hoje, data do ganho e vendedor; 6 colunas minimas, nenhum meio de contato com a pessoa do cliente (LGPD); roda com as permissoes de quem chama, sem elevacao, sem checagem de papel: a RLS de clientes e profiles decide (Vendedor so os proprios, Supervisor todos); periodo convertido para data de Sao Paulo, fim exclusivo; cliente sem data so aparece sem recorte de periodo ("Tudo"); ordem pela data do ganho, mais recente primeiro, sem data por ultimo; a versao rascunho desta leitura (mesmos parametros), se existir, e removida antes, para a colagem nunca falhar; nenhuma permissao nova, nenhuma regra de acesso nova; (5) ORDEM: aplicar ANTES de publicar o codigo novo, que le esta coluna em TODA ficha de cliente; o codigo atual continua funcionando com a coluna nova; (6) volta atras em supabase/rollbacks/0053_volta_clientes_ganhos.sql, NAO aplicado automaticamente, que APAGA as datas preenchidas; primeiro o codigo, depois o banco.

Código da 0053 depois do bloco de comentário (sem nenhum comentário no meio — o resultado deve ser exatamente isto):

```sql
alter table clientes add column if not exists ganho_em date;

create or replace function clientes_preenche_ganho_em()
returns trigger
language plpgsql
as $$
begin
  new.ganho_em := (now() at time zone 'America/Sao_Paulo')::date;
  return new;
end;
$$;

drop trigger if exists trg_clientes_preenche_ganho_em on clientes;

create trigger trg_clientes_preenche_ganho_em
  before update on clientes
  for each row
  when (
    new.status_acompanhamento = 'ganho'
    and old.status_acompanhamento is distinct from new.status_acompanhamento
    and new.ganho_em is null
  )
  execute function clientes_preenche_ganho_em();

update clientes c
set ganho_em = (h.ultimo_ganho at time zone 'America/Sao_Paulo')::date
from (
  select h2.cliente_id, max(h2.criado_em) as ultimo_ganho
  from historico h2
  where h2.tipo = 'status_acompanhamento'
    and h2.descricao ilike '%"ganho"%'
  group by h2.cliente_id
) h
where h.cliente_id = c.id
  and c.status_acompanhamento = 'ganho'
  and c.ganho_em is null;

drop function if exists clientes_ganhos(timestamptz, timestamptz);

create or replace function clientes_ganhos(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid,
  razao_social text,
  nome_fantasia text,
  ganho_em date,
  responsavel uuid,
  responsavel_nome text
)
language sql
stable
as $$
  select
    c.id as cliente_id,
    c.razao_social,
    c.nome_fantasia,
    c.ganho_em,
    c.responsavel,
    nullif(trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as responsavel_nome
  from clientes c
  left join profiles p on p.id = c.responsavel
  where c.status_acompanhamento = 'ganho'
    and (p_inicio is null or c.ganho_em >= (p_inicio at time zone 'America/Sao_Paulo')::date)
    and (p_fim is null or c.ganho_em < (p_fim at time zone 'America/Sao_Paulo')::date)
  order by 4 desc nulls last, 1 asc;
$$;
```

Assinatura esperada da leitura (texto normalizado: todo espaço em branco vira um espaço; minúsculas) — constante ASSINATURA_ESPERADA do teste:
`create or replace function clientes_ganhos( p_inicio timestamptz default null, p_fim timestamptz default null ) returns table ( cliente_id uuid, razao_social text, nome_fantasia text, ganho_em date, responsavel uuid, responsavel_nome text ) language sql stable as $$`

**Definição de "corpo" (vale para este contrato e para o teste):** o texto que começa no primeiro `as $$` depois da frase de criação da leitura clientes_ganhos e termina no primeiro `$$;` depois dele, INCLUSIVE os dois marcadores — nunca o bloco inteiro (nome e colunas de retorno são provados só pela ASSINATURA_ESPERADA). CORPO_ESPERADO = esse trecho do código acima, normalizado e em minúsculas.

**Por que as regras de acesso são as mesmas da 0034 (raciocínio que substitui a antiga prova "0034 + trocas"):** (a) as duas leituras são language sql, stable, sem cláusula de elevação, sem search_path próprio, sem checagem de papel (nenhuma menção a is_supervisor nem a auth.uid) e sem grant/revoke — logo rodam com os direitos de quem chama e cada SELECT interno passa pela RLS normal; (b) as tabelas lidas pela 0053 ({clientes, profiles}) estão contidas nas lidas pela 0034 ({clientes, historico, motivos_perda, profiles}), com a MESMA junção de profiles e a MESMA expressão de responsavel_nome — então não existe tabela nova cuja RLS precisasse ser revisada; (c) o recorte de linhas é o mesmo tipo (status atual + período), sem filtro de dono no corpo. O gatilho novo também roda com os direitos de quem faz o UPDATE (que já passou pela policy de UPDATE da linha) e só atribui NEW.ganho_em da própria linha — não lê nem escreve outra linha. O backfill roda uma vez, como o dono no SQL Editor, restrito a status ganho e ganho_em vazio. A 0034 já foi provada ao vivo na Fase 28; a 0053 é provada ao vivo na Tarefa 7.

Arquivo de volta supabase/rollbacks/0053_volta_clientes_ganhos.sql: um bloco barra-asterisco ASCII (sem a palavra inglesa de função) começando com "NAO APLICAR automaticamente.", dizendo: fica fora de supabase/migrations de propósito (o CLI nunca o lê); é a volta atrás da 0053 (quick 261008-rxw); "ATENCAO: esta volta APAGA a coluna ganho_em com TODAS as datas de ganho (as automaticas, as do preenchimento pelo historico e as digitadas na ficha) - nao ha como recupera-las depois"; se quiser guardar as datas antes, rodar no SQL Editor uma consulta só de leitura das colunas id e ganho_em dos clientes com data e guardar o resultado em local seguro da empresa; ORDEM obrigatória: primeiro reverter os commits feat desta quick task (tela Ganhos E campo "Data do ganho" da ficha) e publicar, só DEPOIS colar este arquivo — na ordem inversa a ficha de QUALQUER cliente (Clientes, Agenda, Ganhos) deixa de abrir, porque o código novo lê a coluna; aplicar só se o dono decidir desfazer. Depois do comentário, exatamente estas 4 instruções, nesta ordem:

```sql
drop function if exists clientes_ganhos(timestamptz, timestamptz);
drop trigger if exists trg_clientes_preenche_ganho_em on clientes;
drop function if exists clientes_preenche_ganho_em();
alter table clientes drop column if exists ganho_em;
```

## Interfaces existentes (lidas no código)

- lib/clientes/nomeExibicao.ts: `nomeExibicaoCliente(razaoSocial, nomeFantasia): string` (Nome Fantasia primeiro, depois razão social, senão `ROTULO_SEM_NOME`).
- lib/supabase/queries/paginacao.ts: `buscarPaginado<T>(buscarPagina: (inicio, fim) => Promise<{ data, error }>)` devolve `T[] | null`.
- lib/supabase/queries/clientes.ts: `getCategoriasAtivas()`, `getProdutosAtivos()`, `ClienteDetalhe`, `getClienteById(id)`.
- app/actions/clientes.ts: `getClienteDetalhe(id)`, `updateCliente(values: UpdateClienteInput)` com códigos validation/unauthenticated/not_found/duplicate_razao_social/generic.
- lib/validations/cliente.ts: `updateClienteSchema`, `UpdateClienteInput`, `createClienteSchema`.
- Moldes a COPIAR (nunca importar): lib/perdidos/lista.ts, lib/supabase/queries/perdidos.ts, app/actions/perdidos.ts, components/perdidos/*.
- Nomes novos (contrato desta quick):
  - lib/ganhos/lista.ts: `ClienteGanho = { clienteId: string; razaoSocial: string | null; nomeFantasia: string | null; ganhoEm: string | null; responsavel: string; responsavelNome: string | null }` (ganhoEm = "AAAA-MM-DD" ou nulo), `DATA_GANHO_AUSENTE = "Data não informada"`, `PeriodoPresetGanhos`, `PERIODO_PADRAO_GANHOS`, `PERIODO_PRESETS_GANHOS`, `IntervaloGanhos`, `resolvePeriodoGanhos`, `temRecortePeriodoGanhos`, `ValidacaoPeriodoGanhos`, `validarPeriodoGanhos`, `filtrarGanhosPorNome`.
  - lib/supabase/queries/ganhos.ts: `getClientesGanhos(intervalo)`; app/actions/ganhos.ts: `getClientesGanhosAction(intervalo)`, `ClientesGanhosErrorCode`, `GetClientesGanhosResult`.
  - components/ganhos: `GanhosItemRow({ cliente, showResponsavel, onAbrir })`, `GanhosPeriodoFilter({ preset, customRange, onPresetChange, onCustomRangeApply })`, `GanhosList({ isSupervisor, categoriaOptions, produtoOptions, vendedorOptions })`.
  - lib/clientes/dataDoGanho.ts: `hojeEmSaoPaulo(agora?: Date): string` ("AAAA-MM-DD" pelo Intl com fuso America/Sao_Paulo), `DATA_GANHO_MINIMA = "1990-01-01"`, `validarDataDoGanho(valor: string, hoje: string): string | null` (mensagem de erro ou nulo; "" é válido).
  - ClienteDetalhe ganha `ganhoEm: string | null`; UpdateClienteInput ganha `ganhoEm?: string`.
- tests/funil/perdidos-query.test.ts: molde de dublê de "@/lib/supabase/server". tests/clientes/kanban-card-filtrado.test.tsx linha 24: precedente de dublê da ficha. tests/dashboard/aderencia-parcial-migracao.test.ts: molde dos helpers estruturais.

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Reescrever a 0053 (coluna ganho_em + gatilho + backfill + leitura), o arquivo de volta, o teste estrutural (verde) e os testes ao vivo (VERMELHOS até a aplicação; escritos e não executados) — commits novos por cima dos da primeira execução</name>
  <files>supabase/migrations/0053_clientes_ganhos.sql, supabase/rollbacks/0053_volta_clientes_ganhos.sql, tests/funil/ganhos-migracao.test.ts, tests/funil/ganhos-rpc.test.ts</files>
  <read_first>
    - Os 4 arquivos atuais (versão da primeira execução — serão reescritos)
    - supabase/migrations/0034_clientes_perdidos.sql (para o caso mesmas-regras-de-acesso-da-0034)
    - supabase/migrations/0002_clientes_and_funil.sql linhas 120-131, 185-205 e 388-445 (colunas, policies e gatilhos de clientes)
    - tests/agenda2/migracao-agenda2.test.ts linhas 43-150 (inventário — não editar)
    - tests/dashboard/aderencia-parcial-migracao.test.ts (helpers estruturais)
    - tests/funil/encerrados-rpc.test.ts linhas 1-245 (semeadura de ganho/encerrado)
    - Seções "Pesquisa registrada" e "Contrato SQL" deste plano
  </read_first>
  <behavior>
    - Estrutural (tests/funil/ganhos-migracao.test.ts, reescrito; nomes de it exatos): arquivo-unico (só um arquivo com prefixo 0053 em supabase/migrations; o de volta existe em supabase/rollbacks e não em migrations); sql-exato (SQL da 0053 sem comentários, normalizado e minúsculo == código do "Contrato SQL" normalizado e minúsculo); coluna-ganho-em ("alter table clientes add column if not exists ganho_em date;" exatamente 1 vez; "alter table" exatamente 1 vez; nenhum "not null" nem "default" na linha da coluna); gatilho-sem-elevacao (bloco da função clientes_preenche_ganho_em: returns trigger, language plpgsql, sem cláusula de elevação, sem search_path próprio, corpo só com a atribuição de NEW.ganho_em pela data de São Paulo e o retorno; o create trigger é before update on clientes, for each row, com o WHEN exato do contrato); backfill-so-ganho-sem-data (o UPDATE do contrato aparece exatamente 1 vez; ele só atribui ganho_em; filtra status ganho e ganho_em vazio; a fonte é o máximo de criado_em do histórico tipo status_acompanhamento com '%"ganho"%', convertido para São Paulo); leitura-assinatura (== ASSINATURA_ESPERADA); leitura-corpo (corpo do `as $$` ao `$$;`, INCLUSIVE, normalizado e minúsculo == CORPO_ESPERADO; contém "order by 4 desc nulls last, 1 asc;" e as duas conversões para São Paulo; não contém historico, criado_em nem atualizado_em); mesmas-regras-de-acesso-da-0034 (os blocos das leituras da 0034 e da 0053: language sql, stable, sem elevação, sem search_path, sem is_supervisor/auth.uid/grant/revoke; tabelas após from/join da 0053 ⊆ as da 0034; a expressão de responsavel_nome e a junção de profiles da 0034 aparecem idênticas na 0053); sem-elevacao-escrita-restrita (SQL sem comentários: sem cláusula de elevação (montada por concatenação), sem grant/revoke/policy/insert into/delete from/truncate/create table; funções criadas exatamente {clientes_preenche_ganho_em, clientes_ganhos}; os únicos "drop " são o do gatilho e o da leitura rascunho do contrato); comentarios-seguros (arquivo cru ASCII puro; primeira linha não vazia abre o bloco barra-asterisco; nenhuma linha começando com dois hífens; "$$" exatamente 4 vezes; a palavra "function" exatamente 4 vezes no texto cru minúsculo; sem a cláusula de elevação nem o nome da tabela da Agenda 2 (montados por concatenação); contém "261008-rxw" e "supabase/rollbacks/0053_volta_clientes_ganhos.sql"); volta-desfaz-tudo (arquivo de volta ASCII, sem linha de dois hífens, contém "NAO APLICAR" e "APAGA"; a palavra "function" exatamente 2 vezes; SQL sem comentários normalizado == as 4 instruções do contrato, na ordem).
    - Inventário (tests/agenda2/migracao-agenda2.test.ts) e os estruturais 0049/0050/0051/0052 continuam verdes SEM edição.
    - Ao vivo (tests/funil/ganhos-rpc.test.ts, reescrito — VERMELHO até a 0053 ser aplicada; NÃO executado nesta tarefa), um describe, 13 casos com exatamente estes nomes: colunas-lgpd, rls-vendedor, rls-supervisor, gatilho-preenche-ao-ganhar, gatilho-nao-sobrescreve, gatilho-so-na-troca, sem-data-so-em-tudo, edicao-supervisor-persiste, edicao-vendedor-so-proprio, so-ganho-atual, periodo-limites, ordem-nulos-por-ultimo, anonimo-sem-dados.
  </behavior>
  <action>
Os commits da primeira execução (5a5419e, 92394bc, db416a8) ficam no histórico; esta tarefa faz commits NOVOS por cima — nunca amend, rebase, reset ou push forçado (per D-18). A 0053 nunca foi aplicada nem publicada, por isso pode ser reescrita no mesmo arquivo (CLAUDE.md proíbe só editar migration JÁ aplicada).
1. RED — reescrever tests/funil/ganhos-migracao.test.ts (ambiente node, só fs/path/vitest) com os 11 casos do behavior e os nomes de it exatos. Constantes: caminhos da pasta de migrations, da 0034, da 0053 e do arquivo de volta; CODIGO_ESPERADO (o código SQL do "Contrato SQL", copiado ao pé da letra), ASSINATURA_ESPERADA, CORPO_ESPERADO (derivado do CODIGO_ESPERADO com o mesmo helper de corpo), as 4 instruções da volta; cláusula de elevação, frase de remoção de função e nome da tabela da Agenda 2 montados por concatenação (nenhum aparece inteiro no arquivo). Helpers do molde (lerCru, lf, normaliza, semComentarios que tira blocos barra-asterisco e linhas de dois hífens, ehAsciiPuro, contaOcorrencias, linhaComecaComDoisHifens, blocoDaFuncao por frase de criação até o primeiro fechamento de cifrões duplos com ponto e vírgula) mais um helper de corpo que recorta do primeiro `as $$` depois da frase de criação até o primeiro `$$;` depois dele, INCLUSIVE os marcadores. Cabeçalho: protege a forma da 0053 reescrita sem banco (per D-06, D-13..D-16, D-18), com o raciocínio "mesmas regras de acesso da 0034" do contrato (substitui a prova antiga por trocas, que deixou de valer com a D-13). Rodar e confirmar que FALHA contra a 0053 antiga. Commit: `test(quick-261008-rxw): rewrite structural test for migration 0053 (ganho_em column, auto-fill trigger, backfill, read)`.
2. GREEN — reescrever supabase/migrations/0053_clientes_ganhos.sql (per D-06, D-13, D-14, D-15, D-16, D-18, P-12, P-13): primeiro o bloco de comentário do "Contrato SQL", depois o código EXATO do contrato. Reescrever supabase/rollbacks/0053_volta_clientes_ganhos.sql exatamente como descrito no contrato (aviso de que APAGA as datas, consulta só de leitura opcional para guardar as datas, ordem código-antes-banco-depois, as 4 instruções). Nenhuma outra migration é tocada. Rodar o estrutural até ficar verde, junto com tests/agenda2/migracao-agenda2.test.ts (inventário de 11 SEM edição) e os estruturais 0049-0052. Commit: `feat(quick-261008-rxw): rewrite migration 0053 with ganho_em column, auto-fill trigger, backfill and clientes_ganhos read`.
3. Reescrever tests/funil/ganhos-rpc.test.ts (per D-09) mantendo a estrutura e as regras do arquivo atual: cabeçalho (prova a 0053 contra o banco REAL, que é o de produção; VERMELHO até o dono aplicar — esperado e NÃO medido; só fixtures descartáveis; exatamente duas autenticações, Vendedor A e Supervisor — Vendedor B nunca loga; TODA leitura da RPC filtrada com .in("cliente_id", ids de fixture); nenhuma impressão no terminal; nomes inventados; nunca lê nem grava a tabela de registro de acesso diário da aderência (não escrever o nome dessa tabela no arquivo, nem em comentário); trocas de status pelo cliente de serviço (autor nulo); o preenchimento único pelo histórico (backfill) roda só na aplicação e NÃO é testável ao vivo com fixtures criadas depois — ele é provado pelo estrutural e o dono confere com uma contagem). Helpers: os do arquivo atual mais hojeSaoPaulo() (Intl.DateTimeFormat "en-CA" com timeZone America/Sao_Paulo -> AAAA-MM-DD), ganhoEmDe(id) (relê ganho_em pelo serviço), as leituras read-only dos primeiros motivos de perda e de encerramento ativos, e DOIS semeadores de ganho com papéis distintos (o gatilho é BEFORE UPDATE, nunca roda em INSERT): seedGanhoDireto(responsavelId, label, ganhoEm: string | null) — INSERT pelo serviço JÁ com status ganho, etapa primeira_venda e ganho_em exatamente igual ao argumento (nulo grava nulo; como o gatilho não roda em INSERT, o valor fica exatamente o informado) — usado em TODO caso que precisa de data conhecida ou de data vazia; e seedGanhoPorTroca(responsavelId, label) — INSERT em primeira_venda/em_andamento e UPDATE separado para ganho (o gatilho grava hoje de São Paulo) — usado SÓ nos casos que provam o gatilho (gatilho-preenche-ao-ganhar, gatilho-nao-sobrescreve e o encerrado de so-ganho-atual). Nenhum caso depende de um UPDATE posterior para anular a data. Casos (nomes exatos; datas comparadas como texto AAAA-MM-DD): colunas-lgpd (seedGanhoDireto(A, "2025-02-01"); chaves ordenadas da linha == as 6 colunas ordenadas); rls-vendedor (seedGanhoDireto de A e de B com datas; A recebe só o seu); rls-supervisor (seedGanhoDireto de A e de B; Supervisor recebe os dois; responsavel_nome da linha de A == nome e sobrenome da fixture A); gatilho-preenche-ao-ganhar (seedGanhoPorTroca; hoje lido antes e depois da troca; ganho_em relido == um desses dois dias; a linha da RPC tem a mesma data); gatilho-nao-sobrescreve (seedGanhoPorTroca; UPDATE pelo serviço de ganho_em para "2025-03-15"; troca para encerrado com o motivo lido; troca de volta para ganho; ganho_em continua "2025-03-15"); gatilho-so-na-troca (seedGanhoDireto(A, null) — ganho_em nulo porque o INSERT não aciona o gatilho; UPDATE só de observacao com texto inventado — continua nulo porque não houve troca de status; a linha da RPC tem ganho_em nulo); sem-data-so-em-tudo (seedGanhoDireto(A, null); o cliente sem data vem sem limites; NÃO vem com p_inicio = agora menos 30 dias; NÃO vem com Personalizado amplo p_inicio "1990-01-01T03:00:00Z" e p_fim "2100-01-01T03:00:00Z"); edicao-supervisor-persiste (seedGanhoDireto(B, null); sessão do Supervisor faz update de ganho_em para "2024-05-20" no id de B; relido "2024-05-20"; a RPC com p_inicio "2024-05-01T03:00:00Z" e p_fim "2024-06-01T03:00:00Z" traz o id); edicao-vendedor-so-proprio (seedGanhoDireto(A, "2022-01-10") e seedGanhoDireto(B, "2022-02-10"); sessão de A atualiza ganho_em do PRÓPRIO para "2023-11-30" — relido igual; sessão de A tenta atualizar o de B para "2023-11-30" — nenhuma linha devolvida e a data de B relida pelo serviço continua "2022-02-10"); so-ganho-atual (de A: em_andamento em primeira_venda, perdido com motivo, encerrado (seedGanhoPorTroca e depois encerrado) e seedGanhoDireto(A, "2025-04-01"); .in nos 4 devolve só o ganho); periodo-limites (seedGanhoDireto(A, "2026-01-31"): p_inicio "2026-01-31T03:00:00Z" + p_fim "2026-02-01T03:00:00Z" traz; p_fim "2026-01-31T03:00:00Z" não traz (fim exclusivo); p_inicio "2026-02-01T03:00:00Z" não traz); ordem-nulos-por-ultimo (seedGanhoDireto(A, "2025-06-10"), seedGanhoDireto(A, "2025-01-10") e seedGanhoDireto(A, null); a RPC com .in nos 3 devolve nessa ordem; com order ganho_em desc nulls last + cliente_id asc e range(0,0)/(1,1)/(2,2) os 3 ids vêm sem repetir — a ordem do leitor usa nullsFirst false); anonimo-sem-dados (seedGanhoDireto(A, "2025-02-01"); anonClient() com .in nesse id: erro ou zero linhas). afterAll: apaga os 3 membros e depois confere pelo serviço que não sobrou nenhuma linha de clientes nem de historico para todos os ids criados, lançando erro (sem imprimir linha) se sobrou. Não executar este arquivo nesta tarefa — exceção registrada (CLAUDE.md pede teste passando antes de concluir): os testes ao vivo ficam VERMELHOS POR DESENHO até o dono aplicar a 0053 e só são exigidos verdes na Tarefa 7. Commit: `test(quick-261008-rxw): rewrite live tests for clientes_ganhos and ganho_em (red until 0053 is applied)`. Todo commit com a linha de coautoria da D-11; nunca adicionar .planning/config.json.
4. Checagem rápida de banco local (per W5 do checador; sem instalar nada): rodar `supabase --version` e `docker --version`. No planejamento (2026-10-08) nenhum dos dois existia nesta máquina (e npx não baixa o CLI sem aprovação). Se algum existir agora, PROPOR ao orquestrador, como passo OPCIONAL antes da Tarefa 6, aplicar 0001..0053 num Postgres local descartável (supabase start + db reset) para a 0053 rodar num Postgres real antes da colagem do dono, e registrar o resultado; se não existir, registrar a lacuna para o SUMMARY (item n). Nunca instalar Docker/CLI nem baixar pacote sem aprovação (custo e dependência nova — CLAUDE.md).
  </action>
  <verify>
    <automated>npx vitest run tests/funil/ganhos-migracao.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts tests/dashboard/aderencia-parcial-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 tests/funil/ganhos-migracao.test.ts tests/funil/ganhos-rpc.test.ts && node -e "const fs=require('fs');const s=fs.readFileSync('tests/funil/ganhos-rpc.test.ts','utf8');const n=(s.match(/signInAs\(/g)||[]).length;if(n!==2)throw new Error('logins: '+n);if(/console\./.test(s))throw new Error('impressao');if(/SEED_ACCOUNTS/.test(s))throw new Error('contas semente');if(/acessos_diarios/.test(s))throw new Error('tabela de acesso diario citada');if(!/createTestMember\(/.test(s)||!/deleteTestMember\(/.test(s))throw new Error('fixtures');if(!s.includes('.in(\"cliente_id\"'))throw new Error('leitura sem filtro de ids');for(const c of ['colunas-lgpd','rls-vendedor','rls-supervisor','gatilho-preenche-ao-ganhar','gatilho-nao-sobrescreve','gatilho-so-na-troca','sem-data-so-em-tudo','edicao-supervisor-persiste','edicao-vendedor-so-proprio','so-ganho-atual','periodo-limites','ordem-nulos-por-ultimo','anonimo-sem-dados']){if(!s.includes(c))throw new Error('caso ausente: '+c)}console.log('OK testes ao vivo (estrutura)')" && node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString().split('\n').map(s=>s.trim()).filter(Boolean);const b='89a8707bd3e4ef581951d84f97906ca02e15b76e';const m=g(['diff','--name-status',b,'HEAD','--','supabase/migrations']);if(m.length!==1||m[0]!=='A\tsupabase/migrations/0053_clientes_ganhos.sql')throw new Error('migrations: '+m.join(' | '));const r=g(['diff','--name-status',b,'HEAD','--','supabase/rollbacks']);if(r.length!==1||r[0]!=='A\tsupabase/rollbacks/0053_volta_clientes_ganhos.sql')throw new Error('rollbacks: '+r.join(' | '));console.log('OK uma migration e um arquivo de volta')"</automated>
  </verify>
  <acceptance_criteria>
    - Estrutural reescrito: rodada vermelha contra a 0053 antiga registrada e agora 11/11 verdes; inventário de 11 e estruturais 0049-0052 verdes sem edição.
    - A 0053 segue o "Contrato SQL" ao pé da letra (coluna, gatilho sem elevação com WHEN, backfill só de ganhos sem data, remoção da leitura rascunho, leitura com 6 colunas, período em data de São Paulo, vazios só sem recorte e por último); cabeçalho ASCII num único bloco.
    - Arquivo de volta com as 4 instruções na ordem, NAO APLICAR, aviso de que APAGA as datas e a ordem código-antes-banco-depois.
    - Desde a base 89a8707: exatamente uma linha "A" em supabase/migrations (0053) e uma em supabase/rollbacks; nenhuma migration antiga editada; commits novos, nenhum histórico reescrito.
    - Teste ao vivo com os 13 casos, 2 logins, nada impresso, só fixtures, leituras filtradas por ids, conferência de resíduo; datas vazias e datas conhecidas semeadas por seedGanhoDireto (INSERT já ganho), gatilho provado só por seedGanhoPorTroca; NÃO executado nesta tarefa (vermelho por desenho até a aplicação — exceção registrada).
    - Resultado da checagem de banco local (supabase/docker) registrado para o SUMMARY.
    - tsc e eslint --max-warnings 0 limpos nos 2 arquivos de teste.
  </acceptance_criteria>
  <done>A 0053 reescrita (não aplicada) cria a data real do ganho, preenche sozinha, recupera o histórico dos ganhos atuais e alimenta a leitura; volta atrás pronta; prova estrutural verde; prova ao vivo pronta para ficar verde após a aplicação.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Tarefa 2: Aprovação do dono — campo "Data do ganho", o que a aba Ganhos mostra, alerta de LGPD, ordem segura (banco PRIMEIRO) e como voltar atrás</name>
  <read_first>
    - supabase/migrations/0053_clientes_ganhos.sql (o que será aplicado)
    - supabase/rollbacks/0053_volta_clientes_ganhos.sql (o desfazer)
    - Escolhas P-03..P-17 deste plano
  </read_first>
  <action>Pausar a execução. Apresentar ao dono do projeto, em linguagem simples (ele não programa — CLAUDE.md), o texto dos blocos decision/context abaixo e só seguir depois de uma resposta explícita (per D-12). As escolhas que ele já fez no chat (colunas iguais a Perdidos, clique abre a ficha, sem Reabrir, data real do ganho como campo editável) NÃO são reperguntadas — só confirmadas no texto. Não enviar arquivo para aplicação, não rodar db push, não colar SQL antes da resposta. Ao devolver ao orquestrador com "aplicar", dizer EXPLICITAMENTE que NADA vai para staging nem master antes de o dono aplicar a 0053 na Tarefa 6 (per D-07, D-18: o código novo lê a coluna em toda ficha — publicado antes, NENHUMA ficha de cliente abriria). Caminhos do "ajustar": (a) só de tela (textos "Data não informada", "Data do ganho", aviso do período, nome/ícone/posição da aba) — registrar no SUMMARY e aplicar nas Tarefas 3-5, sem retrabalho; (b) ajuste pequeno da regra da data que não mexe em quem pode editar (por exemplo o limite de 01/01/1990, ou o backfill pelo PRIMEIRO registro de ganho em vez do mais recente) — a 0053 ainda NÃO está aplicada: editar a 0053 e os testes da Tarefa 1 (commits novos), rodar o verify da Tarefa 1 e registrar; (c) qualquer outra mudança de regra (quem pode editar a data, registro de quem alterou a data — decisão 1 —, recusa dos testes com contas temporárias no banco real — decisão 2 —, mostrar contato na lista, mostrar o vendedor ao Vendedor, incluir encerrados, ação na linha, exportar) — registrar e devolver ao orquestrador para replanejar, sem implementar. Em (a)/(b), a aprovação para aplicar continua valendo se dada junto; senão reapresentar só a pergunta de aplicar.</action>
  <decision>Aprovar a aba "Ganhos" com o campo "Data do ganho" como descritos e aplicar agora, no banco do sistema, a mudança 0053?</decision>
  <context>
    **Leia primeiro: a mudança no banco vale na hora, para o banco do time inteiro.** O site de teste e o site que a equipe usa guardam os dados no MESMO banco. Desta vez a mudança acrescenta um campo novo ao cliente e grava nele a data do ganho dos clientes ganhos que têm esse registro. O site de hoje continua funcionando igual depois disso.

    **O campo novo "Data do ganho" (o que você pediu no chat):**
    - Cada cliente passa a ter uma "Data do ganho" de verdade.
    - Daqui para frente ela é preenchida sozinha no dia em que o cliente é marcado como ganho (data de São Paulo). Se o cliente já tinha uma data, ela nunca é trocada sozinha — por exemplo, se ele for encerrado e reativado, a data que já estava fica.
    - Na hora de aplicar, os clientes ganhos de hoje que têm no histórico o registro de "virou ganho" recebem essa data (a mais recente, se houver mais de uma).
    - Os clientes que entraram pela planilha de "Clientes Ativos" não têm esse registro: eles ficam SEM data e aparecem como "Data não informada" até alguém preencher a data real na ficha. Clientes que entrarem por essa planilha no futuro também chegam sem data.
    - Na ficha de um cliente ganho aparece o campo "Data do ganho" (só para clientes ganhos). Quem já pode editar a ficha pode preencher, corrigir ou apagar a data: o Supervisor em todos os clientes, e cada vendedor nos próprios clientes. Não pode data no futuro; pode data anterior ao cadastro no CRM (o ganho real pode ser antigo); datas antes de 01/01/1990 são recusadas só para pegar erro de digitação do ano.
    - O servidor também confere: a data só é aceita quando o cliente ESTÁ ganho naquele momento; para outro status a gravação é recusada com uma mensagem clara.

    **Duas decisões suas, explícitas (responda a cada uma):**
    1. **Alterações da "Data do ganho" NÃO ficam registradas.** O sistema não guarda quem mudou a data nem quando (o histórico do cliente continua registrando só as trocas de etapa e de status). Você pode ACEITAR assim, ou PEDIR que as alterações sejam registradas — nesse caso isso vira um replanejamento (mais uma mudança no banco) e pode atrasar a entrega.
    2. **Testes com contas temporárias no banco real.** Para provar as regras de verdade, os testes automáticos criam, no MESMO projeto do Supabase usado em produção, contas de acesso temporárias (2 vendedores e 1 supervisor de teste) e clientes temporários, todos com nomes inventados; usam essas contas, apagam tudo no fim e conferem que não sobrou nada. Nenhum dado real é mostrado. Você pode ACEITAR (é o mesmo procedimento já usado nas fases anteriores), ou RECUSAR — nesse caso os testes contra o banco não rodam, a prova fica só no texto da mudança e nos testes sem banco, e isso volta para replanejamento.

    **O que a aba Ganhos mostra (como você já escolheu):**
    - Item novo "Ganhos" no menu, com ícone de troféu, entre "Clientes" e "Perdidos". Ordem: Agenda, Clientes, Ganhos, Perdidos, Encerrados, Dashboard. Sem número/contador no item.
    - Cada linha: nome do cliente (Nome Fantasia, ou a razão social), "Ganho em dd/mm/aaaa" (ou "Data não informada") e — só para o Supervisor — o nome do vendedor.
    - Ordem da lista: os ganhos mais recentes primeiro; os sem data ficam no fim.
    - Mesma busca por nome e mesmo filtro de período de Perdidos (Tudo, Últimos 30 dias, Últimos 90 dias, Personalizado). **Atenção: clientes sem data do ganho só aparecem em "Tudo"** — não entram em 30 dias, 90 dias nem Personalizado, porque não dá para saber em que período foram ganhos. A tela avisa isso quando um período está escolhido.
    - Clicar num cliente abre a MESMA ficha do funil. Encerrar pela ficha tira o cliente da lista na hora (vai para "Encerrados"). Sem coluna de motivo e sem botão "Reabrir".
    - Cada vendedor vê só os próprios clientes ganhos; o Supervisor vê todos (regra do próprio banco, a mesma de sempre).
    - O que NÃO muda: Agenda, Clientes (funil), Perdidos, Encerrados, Dashboard. Na ficha, só entra o campo "Data do ganho".

    **Alerta de conformidade (LGPD) — leia com atenção:**
    - A lista mostra nomes de clientes (Nome Fantasia/razão social de MEI ou empresa pequena podem identificar uma pessoa) e, para o Supervisor, quem ganhou cada cliente e quando (dado de funcionário, ligado ao desempenho).
    - A "Data do ganho" é uma data de negócio sobre a empresa cliente — não é dado novo de contato. Nenhum telefone, e-mail ou nome de contato entra na lista; esses dados continuam só dentro da ficha, com as mesmas regras de acesso de hoje.
    - Nenhuma regra nova de quem vê ou quem edita: vale a regra que já existe para a ficha. Sem exportação nova, sem número no menu.
    - Avalie o escopo à luz da LGPD; a decisão é sua, como responsável pelos dados.

    **Ordem segura que vamos seguir (agora ainda mais importante):**
    1. Eu termino a tela e o campo da ficha, só no computador (sem publicar nada).
    2. Você cola e roda a mudança no banco (próxima etapa de ação). O site de hoje continua funcionando igual.
    3. Eu confiro com os testes automáticos contra o banco.
    4. Só então tudo vai para o site de teste (staging) para conferência, e depois para o site real.
    Por que nessa ordem: o código novo lê o campo "Data do ganho" em TODA ficha de cliente. Se fosse publicado antes de o banco ter o campo, nenhuma ficha abriria (nem em Clientes, nem na Agenda).

    **Como voltar atrás, se precisar:** primeiro tirar do ar o código novo (desfazer as mudanças de tela e de ficha desta tarefa e publicar), e SÓ DEPOIS colar o arquivo `supabase/rollbacks/0053_volta_clientes_ganhos.sql` no SQL Editor. **Cuidado: desfazer APAGA todas as datas do ganho, inclusive as que alguém tiver digitado na ficha — não há como recuperar.** O arquivo explica como guardar uma cópia das datas antes, se você quiser.

    **Dados reais nos testes:** (ver a decisão 2 acima) os testes leem só os próprios clientes temporários, nunca mostram dados reais e não mexem na medição de uso do sistema (aderência).
  </context>
  <options>
    <option id="aplicar">
      <name>Aprovar e aplicar agora</name>
      <pros>A data do ganho passa a ser a real; os ganhos atuais com histórico já ganham a data; os importados podem ser completados na ficha; quem vê/edita não muda; existe volta atrás pronta.</pros>
      <cons>Os importados aparecem como "Data não informada" (e só em "Tudo") até alguém preencher; a data é editável por quem edita a ficha, sem registro de quem alterou; desfazer apaga as datas preenchidas.</cons>
    </option>
    <option id="ajustar">
      <name>Ajustar antes de aplicar</name>
      <pros>Permite mudar textos, a posição da aba, ou detalhes da regra da data antes de tocar o banco.</pros>
      <cons>Mudança de quem pode editar, ou outras regras novas, volta para replanejamento e pode atrasar a entrega desta semana.</cons>
    </option>
  </options>
  <acceptance_criteria>
    - O dono respondeu "aplicar" (ou aprovação explícita equivalente) antes de qualquer envio de arquivo para aplicação, db push ou execução no SQL Editor.
    - O dono respondeu EXPLICITAMENTE às duas decisões: (1) aceita que as alterações da "Data do ganho" não sejam registradas (ou pediu registro -> caminho (c), replanejamento); (2) aceita os testes com contas temporárias no projeto compartilhado com a produção, nomes inventados e limpeza conferida (ou recusou -> caminho (c), replanejamento). As duas respostas ficam no SUMMARY.
    - O SUMMARY registra a resposta e a ciência de: efeito imediato no banco único (campo novo + gravação das datas do histórico); preenchimento automático e "nunca sobrescreve"; importados sem data ("Data não informada") até preencher na ficha; sem data só em "Tudo"; quem pode editar a data (regra atual da ficha) e a ausência de registro de quem alterou; os pontos do alerta de LGPD; a ordem segura com o banco PRIMEIRO (toda ficha lê o campo); a volta atrás (código antes, banco depois) que APAGA as datas.
    - O orquestrador foi avisado de que nada vai para staging/master antes da Tarefa 6; nenhum push pelo executor.
    - Se o dono escolheu "ajustar", o caminho (a), (b) ou (c) da action foi seguido antes de qualquer aplicação.
  </acceptance_criteria>
  <files>supabase/migrations/0053_clientes_ganhos.sql, supabase/rollbacks/0053_volta_clientes_ganhos.sql (só leitura — o que é apresentado ao dono; só mudam neste checkpoint no caminho (b) do "ajustar", junto com os testes da Tarefa 1)</files>
  <verify>
    <automated>npx vitest run tests/funil/ganhos-migracao.test.ts && git diff --quiet HEAD -- supabase/migrations/0053_clientes_ganhos.sql supabase/rollbacks/0053_volta_clientes_ganhos.sql && echo "OK arquivos apresentados = arquivos testados e commitados"</automated>
    <human-check>
      <test>Resposta explícita do dono ao texto deste checkpoint ("aplicar" + as duas decisões, ou "ajustar: ...").</test>
      <expected>"aplicar" (ou aprovação equivalente) e as respostas às decisões 1 e 2 registradas no SUMMARY com os itens reconhecidos.</expected>
      <why_human>Decisão do dono como responsável pelos dados (LGPD) e pela mudança no banco único.</why_human>
    </human-check>
  </verify>
  <resume-signal>Responda, por exemplo, "aplicar; 1: aceito sem registro; 2: aceito os testes com contas temporárias" — ou "ajustar: ..." descrevendo o que mudar (inclusive se quiser o registro das alterações da data ou não quiser os testes no banco real).</resume-signal>
  <done>Decisão explícita do dono registrada, com o campo "Data do ganho", o alerta de LGPD, a ordem segura e a volta atrás (que apaga as datas) reconhecidos, e o orquestrador ciente de que não publica nada antes da aplicação.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 3: Camada pura, leitor, Server Action, linha e filtro de período de Ganhos (irmãos de Perdidos, sem import cruzado; data do ganho opcional; commits só locais)</name>
  <files>lib/ganhos/lista.ts, lib/supabase/queries/ganhos.ts, app/actions/ganhos.ts, components/ganhos/GanhosItemRow.tsx, components/ganhos/GanhosPeriodoFilter.tsx, tests/funil/ganhos-lista.test.ts, tests/funil/ganhos-query.test.ts, tests/funil/ganhos-item-row.test.tsx, tests/funil/ganhos-periodo-filter.test.tsx</files>
  <read_first>
    - Resposta do dono no checkpoint da Tarefa 2 (registrada no SUMMARY em andamento): ajuste só de tela entra aqui
    - lib/perdidos/lista.ts, lib/supabase/queries/perdidos.ts, app/actions/perdidos.ts (arquivos inteiros — modelos a copiar, nunca importar)
    - components/perdidos/PerdidosItemRow.tsx, components/perdidos/PerdidosPeriodoFilter.tsx (arquivos inteiros)
    - components/agenda/AgendaItemRow.tsx linhas 60-115 (linha clicável com role button e teclado)
    - tests/funil/perdidos-lista.test.ts, tests/funil/perdidos-query.test.ts, tests/funil/perdidos-item-row.test.tsx, tests/funil/perdidos-periodo-filter.test.tsx (moldes)
    - lib/clientes/nomeExibicao.ts
  </read_first>
  <behavior>
    - ganhos-lista: presets Tudo, Últimos 30 dias, Últimos 90 dias, Personalizado nessa ordem; padrão "tudo"; resolvePeriodoGanhos com agora fixo (tudo = nulos; 30dias/90dias = início agora menos N dias e fim nulo; personalizado = início do primeiro dia e meia-noite do dia seguinte ao último; personalizado sem intervalo = nulos); temRecortePeriodoGanhos; validarPeriodoGanhos (mesmos casos e mensagens de Perdidos); filtrarGanhosPorNome (vazio/espaços devolvem tudo; nome exibido sem diferenciar maiúsculas; sem correspondência = vazio; não altera a entrada); DATA_GANHO_AUSENTE == "Data não informada".
    - ganhos-query (dublê de "@/lib/supabase/server"): leitor-rpc (rpc 1 vez com "clientes_ganhos" e { p_inicio, p_fim }; orders ("ganho_em", { ascending: false, nullsFirst: false }) e ("cliente_id", { ascending: true }); primeiro recorte (0, 999)); leitor-mapeamento (snake -> camel; ganho_em "2025-06-10" vira ganhoEm "2025-06-10"; ganho_em nulo vira ganhoEm nulo; exatamente as 6 chaves); leitor-paginado (1000 + 5 = 1005; segundo recorte (1000, 1999)); leitor-erro; acao-sem-sessao; acao-periodo-invalido; acao-ok; acao-falha ("Não foi possível carregar os clientes ganhos. Tente novamente.").
    - ganhos-item-row: titulo-fantasia; titulo-razao; titulo-sem-nome (ROTULO_SEM_NOME); data (ganhoEm "2026-09-10" mostra "Ganho em 10/09/2026"); data-ausente (ganhoEm nulo mostra "Data não informada" e nenhum "Ganho em"); responsavel-oculto; responsavel-visivel; abrir-clique (papel button, nome "Abrir ficha de {nome}", clique chama onAbrir 1 vez com o clienteId); abrir-teclado (Enter e espaço chamam; outra tecla não); sem-acao-extra (exatamente um elemento com papel button; nenhum "Reabrir" nem "Motivo").
    - ganhos-periodo-filter: opcoes; troca (Últimos 90 dias chama onPresetChange("90dias") 1 vez); personalizado-rotulo.
  </behavior>
  <action>
0. Se o dono pediu na Tarefa 2 um ajuste SÓ de tela que toque estes arquivos (por exemplo "Data não informada" ou "Ganho em"), usar o texto aprovado nos testes e no código e registrar no SUMMARY (per P-09).
1. RED — criar os 4 arquivos de teste do behavior com exatamente esses nomes de it (molde: os testes de Perdidos correspondentes; dados inventados; nenhum import de módulos de Perdidos/Encerrados). Rodar e confirmar que FALHAM. Commit: `test(quick-261008-rxw): add failing tests for ganhos list layer, reader, action, row and period filter`.
2. GREEN (per D-02, D-03, D-16, P-05, P-07, P-13):
   - lib/ganhos/lista.ts: cópia estrutural de lib/perdidos/lista.ts com os nomes do contrato (seção Interfaces): ClienteGanho com EXATAMENTE os 6 campos, ganhoEm "AAAA-MM-DD" ou nulo (JSDoc: espelha as 6 colunas de clientes_ganhos da 0053; acrescentar meio de comunicação com a pessoa do cliente muda o escopo de dado pessoal da tela e precisa de aprovação do dono); DATA_GANHO_AUSENTE; presets, IntervaloGanhos, resolvePeriodoGanhos (mesma regra de Perdidos — os instantes viram data de São Paulo dentro da RPC, P-13), temRecortePeriodoGanhos, validarPeriodoGanhos, filtrarGanhosPorNome via nomeExibicaoCliente. Sem import de Supabase nem de next/headers. Cabeçalho: irmã deliberada de lib/perdidos/lista.ts, sem import cruzado.
   - lib/supabase/queries/ganhos.ts: cópia de queries/perdidos.ts — linha snake_case com ganho_em string ou nulo, mapRow, getClientesGanhos com buscarPaginado, rpc("clientes_ganhos", { p_inicio, p_fim }), order("ganho_em", { ascending: false, nullsFirst: false }), order("cliente_id", { ascending: true }), range; nulo de buscarPaginado lança "Falha ao carregar clientes ganhos: leitura paginada incompleta". JSDoc: RLS dentro de clientes_ganhos é a única fronteira; a ordem repete a da RPC (vazios por último) por contrato de paginacao.ts.
   - app/actions/ganhos.ts ("use server"): cópia de app/actions/perdidos.ts com os nomes de Ganhos e a mensagem fixa do behavior; JSDoc: só leitura (P-03).
   - components/ganhos/GanhosItemRow.tsx: props { cliente, showResponsavel, onAbrir }; Card clicável no molde de AgendaItemRow (role="button", tabIndex 0, Enter/espaço com preventDefault, cursor-pointer), aria-label "Abrir ficha de {nome}"; CardTitle truncado com title = nome; linha de data "Ganho em dd/MM/yyyy" (format + parseISO sobre a data AAAA-MM-DD — nunca o construtor nativo de data a partir da string) ou DATA_GANHO_AUSENTE quando nulo; nome do vendedor só com showResponsavel e responsavelNome. Nenhum botão interno, nenhum motivo, nenhum contato.
   - components/ganhos/GanhosPeriodoFilter.tsx: cópia estrutural de PerdidosPeriodoFilter com os tipos de Ganhos.
   Rodar o verify até ficar verde. Commit: `feat(quick-261008-rxw): ganhos list layer, reader, action, row and period filter`. Linha de coautoria da D-11; nunca adicionar .planning/config.json.
3. Commits SÓ locais (per D-07): nada vai para staging/master antes da Tarefa 6.
  </action>
  <verify>
    <automated>npx vitest run tests/funil/ganhos-lista.test.ts tests/funil/ganhos-query.test.ts tests/funil/ganhos-item-row.test.tsx tests/funil/ganhos-periodo-filter.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 lib/ganhos/lista.ts lib/supabase/queries/ganhos.ts app/actions/ganhos.ts components/ganhos/GanhosItemRow.tsx components/ganhos/GanhosPeriodoFilter.tsx tests/funil/ganhos-lista.test.ts tests/funil/ganhos-query.test.ts tests/funil/ganhos-item-row.test.tsx tests/funil/ganhos-periodo-filter.test.tsx && node -e "const fs=require('fs');for(const f of ['lib/ganhos/lista.ts','lib/supabase/queries/ganhos.ts','app/actions/ganhos.ts','components/ganhos/GanhosItemRow.tsx','components/ganhos/GanhosPeriodoFilter.tsx']){const s=fs.readFileSync(f,'utf8');if(/@\/(lib|components|app\/actions)\/[A-Za-z\/]*(perdidos|encerrados)/i.test(s))throw new Error('import cruzado: '+f)}console.log('OK sem import cruzado')" && git diff --quiet 89a8707bd3e4ef581951d84f97906ca02e15b76e -- lib/perdidos lib/encerrados components/perdidos components/encerrados app/actions/perdidos.ts app/actions/encerrados.ts lib/supabase/queries/perdidos.ts lib/supabase/queries/encerrados.ts && echo "OK Perdidos e Encerrados intocados"</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada e agora os 4 arquivos de teste verdes.
    - ClienteGanho com exatamente 6 campos (ganhoEm opcional, sem motivo, sem contato); leitura paginada pela RPC com ganho_em desc e vazios por último + cliente_id asc.
    - Linha mostra "Ganho em dd/MM/yyyy" ou "Data não informada"; abre por clique, Enter e espaço; nenhum botão interno.
    - Nenhum import de módulos de Perdidos/Encerrados; Perdidos e Encerrados idênticos à base.
    - tsc e eslint --max-warnings 0 limpos nos 9 arquivos; nenhum push.
  </acceptance_criteria>
  <done>Toda a parte de dados da aba e as peças visuais da linha e do período existem e estão provadas por testes, ainda só no computador.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 4: Campo "Data do ganho" na ficha — regra pura, schema, leitura da ficha, ação de edição e componente (envio só quando mexido; testes de construtor atualizados de propósito; commits só locais)</name>
  <files>lib/clientes/dataDoGanho.ts, lib/validations/cliente.ts, lib/supabase/queries/clientes.ts, app/actions/clientes.ts, components/clientes/ClienteDetailSheet.tsx, tests/clientes/data-do-ganho.test.ts, tests/clientes/update-cliente-data-ganho.test.ts, tests/clientes/cliente-detail-sheet-data-ganho.test.tsx, tests/clientes/cliente-detail-sheet-apagar.test.tsx, tests/clientes/cliente-detail-sheet-encerrar.test.tsx</files>
  <read_first>
    - Resposta do dono no checkpoint da Tarefa 2 (ajuste de texto do campo entra aqui)
    - lib/validations/cliente.ts linhas 60-147
    - lib/supabase/queries/clientes.ts linhas 88-220
    - app/actions/clientes.ts linhas 1-32 e 146-393
    - components/clientes/ClienteDetailSheet.tsx linhas 140-300, 340-365, 405-500, 685-715 e 1040-1140 (só os trechos; o arquivo tem 1630 linhas)
    - tests/clientes/cliente-detail-sheet-encerrar.test.tsx (arquivo inteiro — molde dos dublês e do construtor)
    - tests/clientes/ganho-frequencia-dialog.test.tsx (campos do diálogo de ganho, para o caso marcar-ganho-mostra-data)
    - tests/funil/perdidos-query.test.ts linhas 1-50 (molde de dublê de "@/lib/supabase/server")
  </read_first>
  <behavior>
    - data-do-ganho (puro): hojeEmSaoPaulo(new Date("2026-10-09T02:30:00Z")) == "2026-10-08" e hojeEmSaoPaulo(new Date("2026-10-09T03:30:00Z")) == "2026-10-09"; validarDataDoGanho com hoje "2026-10-08": "" -> nulo; "2024-05-20" -> nulo; "2026-10-08" -> nulo; "2026-10-09" -> "A data do ganho não pode ser no futuro."; "2024-02-30" e "20-05-2024" -> "Informe uma data válida."; "1989-12-31" -> "Informe uma data a partir de 01/01/1990."; "1990-01-01" -> nulo; schema-sem-campo (updateClienteSchema aceita o objeto válido SEM ganhoEm e o resultado não tem ganhoEm); schema-vazio (aceita ganhoEm ""); schema-passado (aceita uma data de 2019, anterior a qualquer cadastro); schema-futuro (recusa amanhã de São Paulo com issue em path ["ganhoEm"] e a mensagem de futuro); schema-invalido (recusa "2024-13-01"); cadastro-ignora (createClienteSchema de um objeto com ganhoEm devolve resultado SEM ganhoEm).
    - update-cliente-data-ganho (dublês de "@/lib/supabase/server" com cadeias por tabela, "@/lib/aderencia/registroDiario" e "next/cache"; o dublê guarda o objeto passado a update em clientes): ausente-nao-grava (envio sem ganhoEm -> objeto sem a chave ganho_em); vazio-limpa (ganhoEm "" -> ganho_em nulo); data-grava (status atual lido = ganho; ganhoEm "2024-05-20" -> ganho_em "2024-05-20"); futura-recusa (ganhoEm amanhã -> error validation e update nunca chamado); fora-de-ganho-recusa (P-18: ganhoEm "2024-05-20" com o status atual lido = em_andamento -> error code "ganho_em_fora_de_ganho" e update NUNCA chamado); status-nao-encontrado (ganhoEm presente e a leitura do status sem linha — id inexistente ou fora da RLS -> error not_found e update nunca chamado); sem-campo-nao-le-status (envio sem ganhoEm -> a leitura de status NÃO é feita; garante que a cadeia de chamadas dos testes já existentes não muda).
    - cliente-detail-sheet-data-ganho (dublês como em cliente-detail-sheet-encerrar): campo-so-quando-ganho (cliente ganho com ganhoEm "2024-05-20" mostra o campo "Data do ganho" com esse valor; cliente em_andamento não mostra o campo); campo-vazio-importado (ganho com ganhoEm nulo mostra o campo vazio); salvar-envia-data-editada (mudar para "2024-05-20" e "Salvar alterações" -> updateCliente recebe ganhoEm "2024-05-20"); salvar-sem-mexer-nao-envia (mudar só o telefone e salvar -> updateCliente recebe ganhoEm indefinido); limpar-envia-vazio (apagar a data e salvar -> ganhoEm ""); erro-fora-de-ganho (updateCliente devolvendo o código ganho_em_fora_de_ganho -> aparece "A data do ganho só pode ser informada para clientes ganhos."); data-futura-bloqueia (amanhã -> aparece "A data do ganho não pode ser no futuro." e updateCliente não é chamado); marcar-ganho-mostra-data (cliente em_andamento em primeira_venda; marcar ganho pelo fluxo existente com marcarStatus de sucesso; a releitura de getClienteDetalhe devolve o cliente ganho com ganhoEm "2026-10-08" -> o campo mostra essa data, e salvar em seguida sem mexer não envia ganhoEm).
    - cliente-detail-sheet-apagar e cliente-detail-sheet-encerrar: só o construtor ganha ganhoEm: null (P-17); todos os casos continuam verdes sem outra edição.
    - Continuam verdes SEM edição: tests/clientes/ganho-frequencia-dialog.test.tsx, tests/clientes/kanban-card-filtrado.test.tsx, tests/agenda/agenda-list.test.tsx, tests/agenda/agenda-calendario-integracao.test.tsx, tests/clientes/registro-acesso-cliente.test.ts (dublês de updateCliente — por isso a leitura de status só acontece quando ganhoEm vem presente) e tests/clientes/endereco-opcional-edicao.test.ts (casos puros do updateClienteSchema + UPDATE direto pelo cliente de serviço com fixtures próprias apagadas no afterEach, sem login; não depende da coluna nova).
  </behavior>
  <action>
0. Se o dono ajustou na Tarefa 2 o texto do campo ou de ajuda, usar o texto aprovado e registrar no SUMMARY.
1. RED — criar tests/clientes/data-do-ganho.test.ts, tests/clientes/update-cliente-data-ganho.test.ts e tests/clientes/cliente-detail-sheet-data-ganho.test.tsx com os casos do behavior (nomes de it exatos; dados inventados; o teste de ação usa uma fábrica de cadeias por tabela — profiles devolve papel vendedor, frequencias_pedido devolve lista vazia, clientes distingue a leitura de status (select de status_acompanhamento + maybeSingle, devolvendo o status configurado no caso, ou nenhuma linha) do update (captura o objeto e devolve { id }) e conta quantas vezes cada um foi chamado, cliente_produtos aceita delete; cidade/estado vazios para pular a checagem de cidades; datas "amanhã/hoje" calculadas com hojeEmSaoPaulo, nunca literais que envelheçam). Acrescentar ganhoEm: null aos construtores de tests/clientes/cliente-detail-sheet-apagar.test.tsx e cliente-detail-sheet-encerrar.test.tsx, com comentário de uma linha "Quick 261008-rxw: ClienteDetalhe ganhou ganhoEm". Rodar e confirmar que os 3 arquivos novos FALHAM. Commit: `test(quick-261008-rxw): add failing tests for the Data do ganho field (rule, schema, action, ficha)`.
2. GREEN (per D-17, P-14, P-15, P-17):
   - lib/clientes/dataDoGanho.ts (novo, puro, importável no navegador e no servidor): hojeEmSaoPaulo(agora = new Date()) via Intl.DateTimeFormat "en-CA" com timeZone "America/Sao_Paulo"; DATA_GANHO_MINIMA "1990-01-01"; validarDataDoGanho(valor, hoje) com as 3 mensagens da P-14 (formato AAAA-MM-DD + data de calendário real conferida com parseISO/isValid e reformatação; futuro por comparação de texto com hoje; mínimo por comparação com DATA_GANHO_MINIMA); "" é válido. JSDoc: data anterior ao cadastro no CRM é permitida de propósito (D-17).
   - lib/validations/cliente.ts: em updateClienteSchema acrescentar ganhoEm: z.string().optional() junto aos campos de cliente ativo e, NO superRefine do objeto já existente, quando ganhoEm é uma string, chamar validarDataDoGanho(ganhoEm, hojeEmSaoPaulo()) e, havendo mensagem, addIssue custom com path ["ganhoEm"]. Nunca refine por campo (comentário do JSDoc do schema). createClienteSchema NÃO muda. Atualizar o JSDoc com um parágrafo da D-17/P-14.
   - lib/supabase/queries/clientes.ts: ClienteDetalhe ganha ganhoEm: string | null (JSDoc: data real do ganho, AAAA-MM-DD, migration 0053, preenchida sozinha ao virar ganho ou digitada na ficha); ClienteDetalheRow ganha ganho_em; o select de getClienteById ganha ", ganho_em" no fim; o mapeamento ganha ganhoEm: row.ganho_em. Nenhuma outra leitura muda.
   - app/actions/clientes.ts (per P-15, P-18): UpdateClienteErrorCode ganha "ganho_em_fora_de_ganho". Em updateCliente, depois da sessão e antes do UPDATE, SÓ quando parsed.data.ganhoEm !== undefined: ler o status ATUAL do cliente pelo mesmo cliente Supabase da sessão (respeita a RLS) com select de status_acompanhamento por id e maybeSingle; sem linha -> devolver not_found (mesma postura não reveladora de hoje); status diferente de "ganho" -> devolver { error: { code: "ganho_em_fora_de_ganho" } } sem gravar nada. Envio sem ganhoEm NÃO faz essa leitura (cadeia de chamadas igual à de hoje). Junto aos espalhamentos condicionais de cliente ativo, acrescentar a gravação condicional de ganho_em (presente -> ganhoEm || null; ausente -> chave nem aparece), com comentário citando P-15, P-18 e a T-16-18. Nada mais muda.
   - components/clientes/ClienteDetailSheet.tsx: defaultValues e toFormValues ganham ganhoEm ("" e cliente.ganhoEm ?? ""); dentro do bloco só-de-ganho (o mesmo dos campos de nome fantasia/CNPJ/frequência de pedidos), um FormField name="ganhoEm" com FormLabel "Data do ganho", Input type="date" com max = hojeEmSaoPaulo(), texto de apoio "Preenchida automaticamente quando o cliente vira ganho. Para clientes importados, informe a data real, se souber." e FormMessage (a regra de tela "campo só para ganho" continua, além da recusa do servidor); o mapeamento de erro do onSubmit ganha o código ganho_em_fora_de_ganho com a mensagem "A data do ganho só pode ser informada para clientes ganhos." (os demais códigos continuam como hoje); onSubmit passa a enviar ganhoEm SÓ quando form.formState.dirtyFields.ganhoEm é verdadeiro (senão envia o objeto com ganhoEm indefinido) e, no sucesso, resetField("ganhoEm") com o valor salvo como novo padrão; em handleStatusChange, no sucesso com novo status "ganho", reler o cliente por getClienteDetalhe e, se vier dado, atualizar cliente.ganhoEm no estado local e resetField("ganhoEm", { defaultValue: data.ganhoEm ?? "" }) — falha da releitura é ignorada (comentário citando P-15 e a T-18-11). Nenhuma outra parte da ficha muda.
   Rodar o verify até ficar verde. Se algum outro teste da ficha quebrar por causa do campo novo, PARAR e reportar (não afrouxar). Commit: `feat(quick-261008-rxw): Data do ganho field in the client ficha (optional, ganho only, sent only when edited)`. Linha de coautoria da D-11; nunca adicionar .planning/config.json.
3. Commits SÓ locais (per D-07, D-18): este código lê a coluna nova em TODA ficha — publicado antes da 0053, nenhuma ficha abre.
  </action>
  <verify>
    <automated>npx vitest run tests/clientes/data-do-ganho.test.ts tests/clientes/update-cliente-data-ganho.test.ts tests/clientes/cliente-detail-sheet-data-ganho.test.tsx tests/clientes/cliente-detail-sheet-apagar.test.tsx tests/clientes/cliente-detail-sheet-encerrar.test.tsx tests/clientes/ganho-frequencia-dialog.test.tsx tests/clientes/kanban-card-filtrado.test.tsx tests/agenda/agenda-list.test.tsx tests/agenda/agenda-calendario-integracao.test.tsx tests/clientes/registro-acesso-cliente.test.ts tests/clientes/endereco-opcional-edicao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 lib/clientes/dataDoGanho.ts lib/validations/cliente.ts lib/supabase/queries/clientes.ts app/actions/clientes.ts components/clientes/ClienteDetailSheet.tsx tests/clientes/data-do-ganho.test.ts tests/clientes/update-cliente-data-ganho.test.ts tests/clientes/cliente-detail-sheet-data-ganho.test.tsx tests/clientes/cliente-detail-sheet-apagar.test.tsx tests/clientes/cliente-detail-sheet-encerrar.test.tsx && git diff --quiet 89a8707bd3e4ef581951d84f97906ca02e15b76e -- app/actions/funil.ts app/actions/encerrados.ts components/clientes/KanbanBoard.tsx components/clientes/GanhoFrequenciaDialog.tsx components/clientes/PerdaMotivoDialog.tsx components/clientes/EncerramentoMotivoDialog.tsx lib/funil lib/clientes/exportacao.ts && echo "OK funil, dialogos e exportacao intocados"</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada e agora os 3 arquivos novos verdes; os 2 testes de ficha existentes verdes só com ganhoEm: null no construtor; os 4 testes consumidores da ficha e tests/clientes/registro-acesso-cliente.test.ts e tests/clientes/endereco-opcional-edicao.test.ts verdes SEM edição (se algum já falhava na base, conferir numa árvore temporária de 89a8707 como na Tarefa 7 e registrar — nunca editar).
    - Campo "Data do ganho" só para cliente ganho; validação igual no navegador e no servidor (futuro, data inválida, antes de 1990 recusados; antes do cadastro aceito); o servidor recusa a data quando o status ATUAL do cliente não é ganho (lido pela sessão, sob RLS) com mensagem clara; envio só quando mexido; gravação só quando presente; "" vira nulo; data relida depois de marcar ganho.
    - getClienteById lê ganho_em; nenhuma outra leitura, exportação, Kanban, diálogos ou ação de funil mudou.
    - tsc e eslint --max-warnings 0 limpos nos 10 arquivos; nenhum push.
  </acceptance_criteria>
  <done>A ficha de um cliente ganho mostra e deixa corrigir a data real do ganho, sem nunca apagar a data automática por acidente — provado por testes, ainda só no computador.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 5: Tela Ganhos que abre a ficha + aviso de "sem data só em Tudo" + rota /ganhos + item "Ganhos" no menu (testes do menu atualizados de propósito; commits só locais)</name>
  <files>components/ganhos/GanhosList.tsx, app/(app)/ganhos/page.tsx, components/layout/AppSidebar.tsx, tests/funil/ganhos-list.test.tsx, tests/funil/app-sidebar-ganhos.test.tsx, tests/funil/app-sidebar-perdidos.test.tsx, tests/funil/app-sidebar-encerrados.test.tsx, tests/agenda2/app-sidebar-agenda2.test.tsx</files>
  <read_first>
    - Resposta do dono no checkpoint da Tarefa 2 (ajuste de nome/ícone/posição/textos entra aqui)
    - components/perdidos/PerdidosList.tsx e app/(app)/perdidos/page.tsx (arquivos inteiros)
    - app/(app)/agenda/page.tsx (arquivo inteiro — catálogos da ficha)
    - components/agenda/AgendaList.tsx linhas 100-135, 180-190 e 425-455
    - components/clientes/ClienteDetailSheet.tsx linhas 214-245 (props — só leitura nesta tarefa)
    - components/layout/AppSidebar.tsx (arquivo inteiro)
    - tests/funil/perdidos-list.test.tsx, tests/funil/app-sidebar-encerrados.test.tsx, tests/clientes/kanban-card-filtrado.test.tsx linhas 15-30
    - tests/funil/app-sidebar-perdidos.test.tsx linhas 60-90 e tests/agenda2/app-sidebar-agenda2.test.tsx linhas 55-85
  </read_first>
  <behavior>
    - ganhos-list (dublês: "@/app/actions/ganhos" e "@/components/clientes/ClienteDetailSheet" — o dublê guarda as props e, quando open, renderiza um marcador com o clienteId e três botões que chamam onStatusChanged("encerrado"), onSaved com valores vazios e onDeleted com o clienteId): carga-inicial ({ inicio: null, fim: null }); vendedor-nome; vendedor-nome-oculto; data-e-ausente (uma linha com ganhoEm "2025-06-10" mostra "Ganho em 10/06/2025" e outra com nulo mostra "Data não informada"); abrir-ficha ("Abrir ficha de Padaria Central Ltda" -> dublê recebe clienteId "c1", open verdadeiro, isSupervisor, os 3 catálogos e currentUserId indefinido — P-08); ficha-encerrar-recarrega (2ª leitura; resposta vazia faz a linha sumir); ficha-salvar-apagar-recarrega (3 leituras no total); sem-reabrir; aviso-sem-data (em "Tudo" não aparece o texto "Clientes sem data do ganho aparecem só em"; ao escolher Últimos 30 dias o aviso aparece — P-16); vazio ("Nenhum cliente ganho" + "Quando um cliente for marcado como ganho, ele aparece aqui."); vazio-periodo (Últimos 30 dias dispara leitura com inicio preenchido; vazio mostra "Nenhum cliente ganho nesse período"); busca ("Nenhum cliente ganho com esse nome" sem nova leitura); busca-limpa; erro-carga ("Não foi possível carregar os clientes ganhos. Tente novamente." + "Tentar novamente").
    - app-sidebar-ganhos (molde app-sidebar-encerrados): vendedor; supervisor; ordem (Vendedor e Supervisor: /agenda-2, /clientes, /ganhos, /perdidos, /encerrados, /dashboard, filtrando por esses e /agenda); icone-trofeu (svg com classe lucide-trophy no link Ganhos, ausente no link Perdidos); sem-contador; recolhido-sem-contador; ativo (bg-slate-700 em /ganhos).
    - Atualizados DE PROPÓSITO (P-10): app-sidebar-perdidos "ordem", app-sidebar-encerrados "ordem" e app-sidebar-agenda2 "ordem-d15" incluem /ganhos entre /clientes e /perdidos, com o texto do it atualizado e o comentário "Quick 261008-rxw: Ganhos entra entre Clientes e Perdidos". Nenhum outro caso muda.
    - Continuam verdes SEM edição: tests/agenda/app-sidebar-agenda.test.tsx, tests/importacao/AppSidebar.test.tsx, tests/layout/app-sidebar-visual.test.tsx, tests/agenda2/app-layout-contagem.test.tsx, tests/funil/ganhos-item-row.test.tsx.
  </behavior>
  <action>
0. Se o dono pediu ajuste de nome da aba, ícone, posição ou textos na Tarefa 2, usar a escolha aprovada e registrar no SUMMARY.
1. RED — criar tests/funil/ganhos-list.test.tsx e tests/funil/app-sidebar-ganhos.test.tsx e atualizar os 3 casos de ordem como no behavior (nomes de it exatos; dublê da ficha com vi.mock no topo e estado via vi.hoisted). Rodar e confirmar que FALHAM. Commit: `test(quick-261008-rxw): add failing tests for ganhos screen and menu item`.
2. GREEN:
   - components/ganhos/GanhosList.tsx ("use client", per D-02, D-03, D-05, D-16, P-03, P-08, P-16): cópia estrutural de PerdidosList SEM nada de reabrir; props { isSupervisor; categoriaOptions, produtoOptions, vendedorOptions }; título "Ganhos"; busca + GanhosPeriodoFilter; logo abaixo da barra, quando temRecortePeriodoGanhos é verdadeiro, um parágrafo pequeno e discreto com o aviso da P-16; mesma máquina de carga (FetchState, intervalo em useMemo, efeito com cancelled e reloadKey, mesmos dois comentários de eslint-disable de PerdidosList); textos do behavior; lista de GanhosItemRow com showResponsavel = isSupervisor e onAbrir = handleAbrirFicha; UMA ClienteDetailSheet no fim com clienteId, open, onOpenChange, isSupervisor, os 3 catálogos e onSaved/onDeleted/onStatusChanged = handleRecarregar, SEM currentUserId. JSDoc: tela irmã de Perdidos; sem ação na linha; a ficha é a mesma do funil (e é nela que se preenche a "Data do ganho"); recarga por reloadKey; LGPD: a lista só mostra nome, data e (Supervisor) vendedor; esconder o vendedor de quem não é Supervisor é só de tela (P-11).
   - app/(app)/ganhos/page.tsx (per D-05, D-08, P-06): molde de app/(app)/agenda/page.tsx — getUser (sem usuário: redirect("/login")), role -> isSupervisor, Promise.all de getCategoriasAtivas e getProdutosAtivos, vendedorOptions de profiles (id, nome, sobrenome, ordenado por nome) só para o Supervisor; div "flex flex-1 flex-col p-6" com GanhosList. JSDoc: rota protegida dentro de (app) como /perdidos; RLS decide as linhas; os catálogos existem porque esta tela ABRE a ficha.
   - components/layout/AppSidebar.tsx (per D-08, P-04): importar Trophy (ordem alfabética) e inserir em PRINCIPAL_SECTION, entre /clientes e /perdidos, o link /ganhos "Ganhos" com Trophy e comentário curto (tela irmã de Perdidos, quick 261008-rxw; sem contador; Trophy distinto de Archive, PauseCircle e BadgeCheck). Atualizar o parágrafo de ordem do JSDoc acima de PRINCIPAL_SECTION com a ordem visível Agenda (/agenda-2), Clientes, Ganhos, Perdidos, Encerrados, Dashboard. Nada mais muda.
   NÃO tocar em components/clientes (a ficha já foi feita na Tarefa 4), components/perdidos, components/encerrados, components/agenda, components/agenda2, nas páginas de agenda/agenda-2/clientes/perdidos/encerrados nem no layout de (app); se algum teste ou o tsc exigir, PARAR e reportar. Commit: `feat(quick-261008-rxw): ganhos screen opening the client ficha and Ganhos menu item`. Linha de coautoria da D-11; nunca adicionar .planning/config.json.
3. Commits SÓ locais (per D-07): a Tarefa 6 confere, imediatamente antes da aplicação, que nenhum commit feat desta quick está em origin/staging ou origin/master.
  </action>
  <verify>
    <automated>npx vitest run tests/funil/ganhos-list.test.tsx tests/funil/app-sidebar-ganhos.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx tests/agenda/app-sidebar-agenda.test.tsx tests/importacao/AppSidebar.test.tsx tests/layout/app-sidebar-visual.test.tsx tests/agenda2/app-layout-contagem.test.tsx tests/funil/ganhos-item-row.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 components/ganhos/GanhosList.tsx "app/(app)/ganhos/page.tsx" components/layout/AppSidebar.tsx tests/funil/ganhos-list.test.tsx tests/funil/app-sidebar-ganhos.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx && git diff --quiet 89a8707bd3e4ef581951d84f97906ca02e15b76e -- components/perdidos components/encerrados components/agenda components/agenda2 "app/(app)/agenda" "app/(app)/agenda-2" "app/(app)/clientes" "app/(app)/perdidos" "app/(app)/encerrados" "app/(app)/layout.tsx" app/actions/funil.ts && echo "OK Agenda, Clientes, Perdidos e Encerrados intocados"</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada e agora tudo verde, incluindo os 4 testes do menu não editados.
    - A tela lista, busca, filtra por período (com o aviso de "sem data só em Tudo"), mostra "Data não informada", mostra o vendedor só para o Supervisor e abre a ficha pela linha; salvar/apagar/encerrar pela ficha recarrega; não há Reabrir.
    - /ganhos dentro de (app) com redirect para /login sem sessão e com os catálogos da ficha.
    - Menu com Ganhos (Trophy, sem contador) entre Clientes e Perdidos; 3 casos de ordem atualizados de propósito.
    - Agenda, Clientes, Perdidos, Encerrados e o layout do grupo idênticos à base.
    - tsc e eslint --max-warnings 0 limpos nos 8 arquivos; nenhum push.
  </acceptance_criteria>
  <done>A aba Ganhos existe no menu e funciona ponta a ponta no computador (com dublês), abrindo a ficha onde se preenche a data — pronta para ir ao staging depois que o dono aplicar a 0053.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Tarefa 6: [BLOCKING] Dono aplica a 0053 pelo SQL Editor da Supabase (ANTES de qualquer publicação do código)</name>
  <read_first>
    - .planning/STATE.md, seção Blockers/Concerns (aplicação manual pelo dono, mesmo caminho das Fases 27-33 e das quick 261006-gvo/261006-ncy/261008-mrf)
  </read_first>
  <action>Pré-condição da ordem segura (per D-07, D-12, D-18, P-09), conferida IMEDIATAMENTE antes de enviar o arquivo ao dono: rodar o comando automatizado do verify (git fetch origin + nenhum commit feat desta quick task ancestral de origin/staging nem de origin/master). O executor nunca faz push; quem publica é o orquestrador, só depois da Tarefa 7. Se algum estiver publicado, avisar o orquestrador e o dono NA HORA, em linguagem simples, que naquele site as fichas de cliente podem não abrir até a 0053 ser aplicada, e seguir com a aplicação imediatamente (ela é a correção). Enviar ao dono o arquivo supabase/migrations/0053_clientes_ganhos.sql pela ferramenta de envio de arquivo ao usuário; se não houver, informar o caminho absoluto. NÃO enviar o arquivo de volta para aplicação. Nada de db push nem contorno (gerar credencial, extrair token, API de gerenciamento) — per D-12. Passar ao dono as instruções do bloco how-to-verify e aguardar.</action>
  <what-built>Um arquivo de mudança no banco (0053), aprovado na Tarefa 2, pronto para colar no SQL Editor. A tela Ganhos, o item de menu e o campo da ficha estão só no computador (commits locais).</what-built>
  <how-to-verify>
    1. Abrir o SQL Editor do projeto: https://supabase.com/dashboard/project/afbiwgbqkogsrhxjshkk/sql/new
    2. Colar o conteúdo COMPLETO de `0053_clientes_ganhos.sql` (o comentário do topo pode ir junto, é seguro), clicar em "Run" e esperar "Success. No rows returned".
    3. Se aparecer qualquer erro, copiar a mensagem e mandar aqui antes de tentar de novo.
    4. NÃO colar o arquivo `0053_volta_clientes_ganhos.sql` — ele só serve se um dia você quiser desfazer (e apaga as datas).
    5. (Opcional, só números, sem dado pessoal) Numa aba nova do SQL Editor, rodar: `select count(*) filter (where ganho_em is not null) as com_data, count(*) filter (where ganho_em is null) as sem_data from clientes where status_acompanhamento = 'ganho';` — "sem_data" deve ser mais ou menos a quantidade de clientes que vieram pela planilha de Clientes Ativos.
    6. (Opcional) O site atual continua igual — a aba Ganhos e o campo da ficha só aparecem depois da publicação.
  </how-to-verify>
  <files>supabase/migrations/0053_clientes_ganhos.sql (só leitura — enviado ao dono; nenhum arquivo do projeto muda neste checkpoint)</files>
  <verify>
    <automated>git fetch origin && HS=$(git log --format=%H -F --grep="feat(quick-261008-rxw)" 89a8707bd3e4ef581951d84f97906ca02e15b76e..HEAD) && test -n "$HS" && for H in $HS; do if git merge-base --is-ancestor "$H" origin/staging || git merge-base --is-ancestor "$H" origin/master; then echo "PUBLICADO $H"; exit 1; fi; done && echo "OK codigo ainda nao publicado (pre-condicao da ordem segura)"</automated>
    <human-check>
      <test>O dono cola a 0053 no SQL Editor e informa o resultado (e, se quiser, os dois números da contagem).</test>
      <expected>"Success. No rows returned" confirmado pelo dono ("aplicado"); o arquivo de volta não foi colado.</expected>
      <why_human>O executor nunca aplica SQL no banco de produção (D-12); só o dono aplica, pelo SQL Editor.</why_human>
    </human-check>
  </verify>
  <resume-signal>Responda "aplicado" depois de ver "Success" (e, se quiser, os números com_data/sem_data), ou cole a mensagem de erro.</resume-signal>
  <acceptance_criteria>
    - Pré-condição conferida imediatamente antes de enviar o arquivo (nenhum commit feat desta quick em origin/staging nem origin/master), ou o aviso foi dado; o executor não fez push.
    - O dono confirmou "Success" na 0053 (registrado no SUMMARY, com os números da contagem se informados); o arquivo de volta não foi aplicado.
    - Nenhuma tentativa de db push ou contorno pelo executor.
    - O SUMMARY sugere ao dono, como passo opcional, `supabase migration repair --status applied 0053` (a 0053 é re-executável: coluna e gatilho com "if not exists"/remoção prévia, backfill só onde a data está vazia, leitura removida e recriada).
  </acceptance_criteria>
  <done>A 0053 está aplicada no banco, confirmada pelo dono, antes de qualquer publicação do código.</done>
</task>

<task type="auto">
  <name>Tarefa 7: [BLOCKING] Testes ao vivo a VERDE contra o banco real + gate final + guarda de escopo + SUMMARY</name>
  <files>tests/funil/ganhos-rpc.test.ts (só se precisar de correção do próprio teste)</files>
  <read_first>
    - tests/funil/ganhos-rpc.test.ts
    - supabase/migrations/0053_clientes_ganhos.sql (aplicada)
    - .planning/STATE.md, Blockers/Concerns (limite de tentativas de login do Supabase Auth; ~49 arquivos vermelhos pré-existentes — NÃO rodar a suíte inteira)
  </read_first>
  <action>
1. Rodar a guarda de escopo (primeiro comando do verify, base 89a8707bd3e4ef581951d84f97906ca02e15b76e, per D-10) e depois, isolado, `npx vitest run tests/funil/ganhos-rpc.test.ts` até ficar verde. Se um caso falhar por comportamento do banco (Vendedor recebendo/alterando cliente de outro, gatilho sobrescrevendo data, cliente sem data aparecendo em período, ordem errada, coluna a mais), PARAR e reportar ao orquestrador: a correção vira migration NOVA (0054 em diante) com nova aprovação do dono pelo caminho das Tarefas 2 e 6 — nunca edição da 0053 aplicada nem do arquivo de volta, e nunca função elevada. Se falhar por erro do próprio teste, corrigir sem afrouxar nenhuma asserção de D-06/D-13..D-17 nem os filtros de ids, e registrar. Resíduo acusado no afterAll: conferir pelo serviço (sem imprimir linhas), apagar só ids de fixture e registrar. Limite de login: esperar e repetir o arquivo isolado, registrando. Nunca imprimir linhas lidas.
2. Rodar o verify completo. Se um teste JÁ EXISTENTE da lista do gate (consumidores da ficha ou do menu) falhar sem relação aparente com esta quick, conferir se ele já falhava na base criando uma árvore de trabalho temporária de 89a8707 na pasta de rascunho da sessão (git worktree add), rodando só aquele arquivo lá e removendo a árvore depois; registrar o resultado — nunca "consertar" teste alheio para passar.
3. Registrar no SUMMARY, em português simples: (a) resposta do dono e o que ele reconheceu na Tarefa 2 (incluindo ajuste, se houve, e onde entrou); (b) pré-condição conferida e aplicação pelo dono (Tarefa 6), com os números com_data/sem_data se informados; (c) resultado do teste ao vivo (13 casos) e do gate (arquivos/testes, tsc, eslint, BUILD_EXIT); o VERMELHO antes da aplicação era esperado e NÃO foi medido; (d) o que a aba Ganhos e o campo "Data do ganho" fazem, em linguagem de tela (menu, colunas, "Data não informada", ordem com sem data no fim, período com o aviso de "sem data só em Tudo", ficha pela linha, encerrar tira da lista, sem Reabrir, onde preencher a data dos importados); (e) alerta de LGPD (nomes de clientes; quem ganhou e quando só para o Supervisor; data do ganho é dado de negócio; nenhum contato na lista; nenhuma regra nova de acesso; sem exportação; inventário de 11 intacto); (f) testes mudados DE PROPÓSITO e por quê (menu P-10; construtores da ficha P-17; reescrita do estrutural e do ao vivo da 0053 pela D-13/D-18); (g) raciocínio "mesmas regras de acesso da 0034" e do gatilho sem elevação, em palavras simples; (h) a regra automática da data (P-12): preenche ao virar ganho, nunca sobrescreve, não preenche em cadastro direto, não apaga ao sair de ganho; e que o preenchimento pelo histórico só pôde ser provado pelo texto exato (estrutural) e pela contagem do dono; (i) itens adiados: `supabase migration repair --status applied 0053` (opcional); registro de quem alterou a data do ganho (se o dono quiser); exportação/Kanban/Dashboard sem a data (fora de escopo); (j) conferência humana do Preview da staging pendente e instrução ao orquestrador: AGORA (banco aplicado + gate verde) enviar os commits para staging, conferir o Preview e só depois levar para master; (k) como voltar atrás: primeiro reverter os commits feat das Tarefas 3, 4 e 5 e publicar; só depois colar supabase/rollbacks/0053_volta_clientes_ganhos.sql — que APAGA todas as datas do ganho (guardar antes, se quiser, como explica o arquivo); (l) linha de coautoria usada: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" (D-11); (m) nota de segurança (P-11): clientes_ganhos devolve responsavel_nome para QUALQUER chamador; o Vendedor só recebe as próprias linhas pela RLS (portanto só o próprio nome); esconder o nome do vendedor de quem não é Supervisor é só da TELA, não regra de segurança; (n) lacuna de execução real: o SQL da 0053 NUNCA rodou num Postgres de verdade antes da colagem do dono — a prova antes da aplicação foi só textual/estrutural (texto exato, inventário, comentários seguros); o SQL Editor executa o arquivo inteiro como UMA transação implícita (se uma instrução falhar, nada fica aplicado pela metade) e os comandos são re-executáveis; registrar o resultado da checagem de banco local da Tarefa 1 (supabase/docker: no planejamento nenhum dos dois existia nesta máquina) e, se o passo opcional local foi feito, o resultado; (o) exceção registrada à regra "nenhuma tarefa concluída sem testes passando" (CLAUDE.md): os testes ao vivo escritos na Tarefa 1 ficaram VERMELHOS POR DESENHO até o dono aplicar a 0053 (função e coluna ainda não existiam) e só foram exigidos verdes nesta Tarefa 7, depois da aplicação; as respostas do dono às decisões explícitas 1 (sem registro das alterações da data) e 2 (testes com contas temporárias no projeto compartilhado) da Tarefa 2.
Commit `test(quick-261008-rxw): ...` só se algum teste ao vivo precisou de correção (com a linha de coautoria, sem .planning/config.json); caso contrário, nenhum commit de código nesta tarefa. Não fazer push.
  </action>
  <verify>
    <automated>node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString();const base='89a8707bd3e4ef581951d84f97906ca02e15b76e';console.log('BASE='+g(['rev-parse',base]).trim());const ok=new Set(['supabase/migrations/0053_clientes_ganhos.sql','supabase/rollbacks/0053_volta_clientes_ganhos.sql','tests/funil/ganhos-migracao.test.ts','tests/funil/ganhos-rpc.test.ts','lib/ganhos/lista.ts','lib/supabase/queries/ganhos.ts','app/actions/ganhos.ts','components/ganhos/GanhosItemRow.tsx','components/ganhos/GanhosPeriodoFilter.tsx','tests/funil/ganhos-lista.test.ts','tests/funil/ganhos-query.test.ts','tests/funil/ganhos-item-row.test.tsx','tests/funil/ganhos-periodo-filter.test.tsx','lib/clientes/dataDoGanho.ts','lib/validations/cliente.ts','lib/supabase/queries/clientes.ts','app/actions/clientes.ts','components/clientes/ClienteDetailSheet.tsx','tests/clientes/data-do-ganho.test.ts','tests/clientes/update-cliente-data-ganho.test.ts','tests/clientes/cliente-detail-sheet-data-ganho.test.tsx','tests/clientes/cliente-detail-sheet-apagar.test.tsx','tests/clientes/cliente-detail-sheet-encerrar.test.tsx','components/ganhos/GanhosList.tsx','app/(app)/ganhos/page.tsx','components/layout/AppSidebar.tsx','tests/funil/ganhos-list.test.tsx','tests/funil/app-sidebar-ganhos.test.tsx','tests/funil/app-sidebar-perdidos.test.tsx','tests/funil/app-sidebar-encerrados.test.tsx','tests/agenda2/app-sidebar-agenda2.test.tsx']);const permitido=f=>f.startsWith('.planning/')||ok.has(f);const mudados=g(['diff','--name-only',base,'HEAD']).split('\n').map(s=>s.trim()).filter(Boolean);const sujos=g(['status','--porcelain']).split('\n').filter(Boolean).filter(l=>!l.startsWith('??')).map(l=>l.slice(3).trim());const fora=mudados.concat(sujos).filter(f=>!permitido(f));if(fora.length)throw new Error('fora do escopo: '+fora.join(', '));const mig=g(['diff','--name-status',base,'HEAD','--','supabase/migrations']).split('\n').map(s=>s.trim()).filter(Boolean);if(mig.length!==1||mig[0]!=='A\tsupabase/migrations/0053_clientes_ganhos.sql')throw new Error('migrations: '+mig.join(' | '));const rb=g(['diff','--name-status',base,'HEAD','--','supabase/rollbacks']).split('\n').map(s=>s.trim()).filter(Boolean);if(rb.length!==1||rb[0]!=='A\tsupabase/rollbacks/0053_volta_clientes_ganhos.sql')throw new Error('rollbacks: '+rb.join(' | '));console.log('OK escopo 261008-rxw')" && npx vitest run tests/funil/ganhos-rpc.test.ts && npx vitest run tests/funil/ganhos-migracao.test.ts tests/funil/ganhos-lista.test.ts tests/funil/ganhos-query.test.ts tests/funil/ganhos-item-row.test.tsx tests/funil/ganhos-periodo-filter.test.tsx tests/funil/ganhos-list.test.tsx tests/funil/app-sidebar-ganhos.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx tests/agenda/app-sidebar-agenda.test.tsx tests/importacao/AppSidebar.test.tsx tests/layout/app-sidebar-visual.test.tsx tests/agenda2/app-layout-contagem.test.tsx tests/clientes/data-do-ganho.test.ts tests/clientes/update-cliente-data-ganho.test.ts tests/clientes/cliente-detail-sheet-data-ganho.test.tsx tests/clientes/cliente-detail-sheet-apagar.test.tsx tests/clientes/cliente-detail-sheet-encerrar.test.tsx tests/clientes/ganho-frequencia-dialog.test.tsx tests/clientes/kanban-card-filtrado.test.tsx tests/agenda/agenda-list.test.tsx tests/agenda/agenda-calendario-integracao.test.tsx tests/clientes/registro-acesso-cliente.test.ts tests/clientes/endereco-opcional-edicao.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts tests/dashboard/aderencia-parcial-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 lib/ganhos/lista.ts lib/supabase/queries/ganhos.ts app/actions/ganhos.ts components/ganhos/GanhosItemRow.tsx components/ganhos/GanhosPeriodoFilter.tsx components/ganhos/GanhosList.tsx "app/(app)/ganhos/page.tsx" components/layout/AppSidebar.tsx lib/clientes/dataDoGanho.ts lib/validations/cliente.ts lib/supabase/queries/clientes.ts app/actions/clientes.ts components/clientes/ClienteDetailSheet.tsx tests/funil/ganhos-migracao.test.ts tests/funil/ganhos-rpc.test.ts tests/funil/ganhos-lista.test.ts tests/funil/ganhos-query.test.ts tests/funil/ganhos-item-row.test.tsx tests/funil/ganhos-periodo-filter.test.tsx tests/funil/ganhos-list.test.tsx tests/funil/app-sidebar-ganhos.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx tests/clientes/data-do-ganho.test.ts tests/clientes/update-cliente-data-ganho.test.ts tests/clientes/cliente-detail-sheet-data-ganho.test.tsx tests/clientes/cliente-detail-sheet-apagar.test.tsx tests/clientes/cliente-detail-sheet-encerrar.test.tsx && (npm run build; code=$?; echo "BUILD_EXIT=$code"; exit $code)</automated>
    <human-check>
      <test>Depois que o orquestrador enviar os commits para a branch staging, abrir o link de Preview da staging na Vercel (projeto RAIAR; exige login na Vercel): (1) como Supervisor — o menu mostra "Ganhos" (troféu) entre Clientes e Perdidos; a lista mostra "Ganho em dd/mm/aaaa" para quem tem data e "Data não informada" para os importados, com os sem data no fim; escolher "Últimos 30 dias" mostra o aviso de que os sem data só aparecem em "Tudo"; (2) abrir a ficha de um cliente ganho — aparece o campo "Data do ganho"; abrir um cliente em prospecção pela aba Clientes — o campo NÃO aparece e a ficha abre normalmente; (3) como um vendedor — a aba mostra só os clientes dele e sem nome de vendedor; (4) Agenda, Clientes, Perdidos, Encerrados e Dashboard iguais aos do site real. Não editar, encerrar nem mudar a data de cliente real só para testar (se quiser testar a edição, combinar antes um cliente e a data real dele). Não fotografar nem compartilhar a tela fora da empresa.</test>
      <expected>Aba no lugar certo, datas e "Data não informada" corretas, aviso do período, campo na ficha só para ganhos, fichas abrindo normalmente em todo o sistema, vendedor vendo só os próprios clientes, resto do site igual.</expected>
      <why_human>Conferência visual no site publicado de teste antes de levar para produção (CLAUDE.md, Fluxo de Deploy); os testes automáticos não abrem o Preview da Vercel.</why_human>
    </human-check>
  </verify>
  <acceptance_criteria>
    - tests/funil/ganhos-rpc.test.ts verde por inteiro (13 casos) contra o banco real, sem resíduo acusado.
    - Gate verde: estruturais (0053 + inventário + 0049-0052), camada pura, leitor/ação, linha, período, tela, menu (os 4 não editados inclusive), regra/schema/ação/ficha da data, consumidores da ficha, tests/clientes/registro-acesso-cliente.test.ts e tests/clientes/endereco-opcional-edicao.test.ts verdes SEM edição; tsc; eslint --max-warnings 0 nos 29 arquivos de código/teste tocados; BUILD_EXIT=0 impresso.
    - Guarda de escopo OK desde 89a8707: só os 31 arquivos planejados (mais .planning/); supabase/migrations com exatamente uma linha "A" (0053); supabase/rollbacks com exatamente uma linha "A"; nenhum outro código tocado.
    - Nenhuma asserção de D-06/D-13..D-17 afrouxada; qualquer correção ou migration nova registrada.
    - SUMMARY com os itens (a)-(o) da action; nenhum push pelo executor.
  </acceptance_criteria>
  <done>A data real do ganho está no banco e provada contra ele, a aba Ganhos e o campo da ficha estão prontos (commits locais) para ir ao staging, e o pacote inteiro está dentro do escopo combinado.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador (Vendedor/Supervisor/visitante) -> Server Action -> PostgREST -> clientes_ganhos() | Período vindo do navegador (não confiável); a leitura roda como quem chama e só a RLS decide as linhas |
| navegador -> ClienteDetailSheet -> updateCliente -> clientes (ganho_em) | Data digitada (não confiável), revalidada no servidor; RLS de UPDATE decide a linha |
| qualquer UPDATE em clientes -> gatilho trg_clientes_preenche_ganho_em | Roda como quem atualiza, só na própria linha |
| executor/dono -> banco de produção | Coluna nova, gatilho e gravação em massa (backfill) com efeito imediato no banco único; só com aprovação explícita e aplicação pelo dono |
| commits locais -> branch staging -> branch master | Código novo lê a coluna em TODA ficha; publicar antes da 0053 derruba as fichas; Preview usa o mesmo banco da produção |
| dono (controlador) -> clientes e vendedores (titulares) | Lista de nomes de clientes, de quem ganhou cada um e quando |
| suíte de testes -> banco de produção | Fixtures temporárias no projeto que guarda dados reais |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-rxw-01 | Information Disclosure | Vendedor lendo clientes ganhos de colegas via clientes_ganhos | high | mitigate | Leitura sem elevação e sem checagem de papel (estrutural mesmas-regras-de-acesso-da-0034 e sem-elevacao-escrita-restrita); ao vivo rls-vendedor, rls-supervisor, anonimo-sem-dados |
| T-rxw-02 | Elevation of Privilege | função nova (leitura ou gatilho) com privilégio elevado ou permissão nova | high | mitigate | Estrutural sem cláusula de elevação, sem grant/revoke/policy; inventário de 11 em migracao-agenda2 sem edição; guarda de escopo |
| T-rxw-03 | Information Disclosure (LGPD) | dado de contato vazando na lista | medium | mitigate | 6 colunas fixas (sql-exato, colunas-lgpd ao vivo, leitor-mapeamento); tipo ClienteGanho com aviso de LGPD; linha sem contato |
| T-rxw-04 | Tampering (disponibilidade) | código novo publicado antes da 0053: NENHUMA ficha de cliente abre (getClienteById lê ganho_em) e a aba Ganhos falha | high | mitigate | D-07/D-18/P-09: commits das Tarefas 3-5 só locais; checkpoint da Tarefa 2 avisa o orquestrador com esse efeito; pré-condição automatizada da Tarefa 6 (nenhum commit feat em origin/staging ou origin/master); publicação só depois da Tarefa 7; volta atrás na ordem inversa documentada no arquivo de volta |
| T-rxw-05 | Tampering | período ou data malformados vindos do navegador | low | mitigate | validarPeriodoGanhos antes do banco; updateClienteSchema revalidado no servidor com validarDataDoGanho (futuro, inválida, antes de 1990); parâmetros como valores no PostgREST |
| T-rxw-06 | Spoofing | chamada da ação ou da rota sem sessão | medium | mitigate | getUser nas ações (acao-sem-sessao; updateCliente já checa); página com redirect para /login dentro de (app) |
| T-rxw-07 | Tampering | Vendedor alterando ganho_em de cliente de outro | medium | mitigate | Policy de UPDATE existente (dono ou Supervisor) é a fronteira; nenhuma policy nova; ao vivo edicao-vendedor-so-proprio e edicao-supervisor-persiste |
| T-rxw-18 | Tampering | ganhoEm enviado direto à Server Action para um cliente que não está ganho (contornando a tela) | low | mitigate | P-18: updateCliente lê o status atual pela sessão (RLS) só quando ganhoEm vem no envio e recusa com ganho_em_fora_de_ganho; testes fora-de-ganho-recusa, status-nao-encontrado e sem-campo-nao-le-status |
| T-rxw-08 | Repudiation | data do ganho editável sem registro de quem alterou | low | accept | Decisão explícita 1 do dono no checkpoint da Tarefa 2 (aceitar sem registro, ou pedir registro -> replanejamento); o histórico continua registrando as trocas de status com autor; resposta e item adiado no SUMMARY |
| T-rxw-09 | Tampering (integridade) | "Salvar alterações" apagando a data automática recém-gravada pelo gatilho | medium | mitigate | P-15: envio só quando o campo foi mexido + gravação só quando presente + releitura depois de marcar ganho; testes salvar-sem-mexer-nao-envia, marcar-ganho-mostra-data, ausente-nao-grava |
| T-rxw-10 | Tampering | gatilho sobrescrevendo data digitada | medium | mitigate | WHEN exige ganho_em vazio; ao vivo gatilho-nao-sobrescreve |
| T-rxw-11 | Tampering | aplicação em produção sem revisão | high | mitigate | Checkpoint bloqueante da Tarefa 2; dono aplica pelo SQL Editor; executor nunca aplica, nunca faz push nem db push |
| T-rxw-12 | Denial of Service | comentário de dois hífens ou caractere não ASCII quebrando a colagem | low | mitigate | Estrutural comentarios-seguros e volta-desfaz-tudo |
| T-rxw-13 | Information Disclosure (LGPD) | testes ao vivo no banco real (contas de Auth temporárias no projeto compartilhado com a produção) | medium | mitigate | Aceite explícito do dono (decisão 2 da Tarefa 2; recusa -> replanejamento); fixtures descartáveis com nomes inventados, 2 logins, leituras filtradas por ids, nada impresso, trocas de status pelo serviço, sem tocar a tabela de acesso diário, conferência de resíduo |
| T-rxw-14 | Tampering | backfill gravando em linhas erradas ou disparando outras regras | medium | mitigate | Texto exato do UPDATE (estrutural backfill-so-ganho-sem-data): só ganho_em, só status ganho com data vazia; a trava de duplicata só dispara em razao_social/cnpj; o gatilho de histórico só em etapa/status; efeito colateral em atualizado_em documentado (nenhuma tela de ganho usa) |
| T-rxw-15 | Denial of Service (perda de dados) | volta atrás apagando as datas preenchidas | medium | mitigate | Cabeçalho do arquivo de volta e checkpoint avisam que APAGA; consulta só de leitura opcional para guardar as datas antes; ordem código-antes-banco-depois |
| T-rxw-16 | Tampering | edição de migration antiga ou reescrita de histórico git | medium | mitigate | Guarda de escopo (uma migration nova, nenhuma antiga alterada); commits novos, sem amend/rebase/force (D-18) |
| T-rxw-17 | Denial of Service | lista crescente (toda a carteira ativa) | low | accept | Leitura paginada com 6 colunas e ordem estável |
</threat_model>

<source_audit>
SOURCE  | ID   | Item | Tarefa | Status
------- | ---- | ---- | ------ | ------
GOAL    | —    | Aba Ganhos no menu com a data real do ganho e caminho até a ficha | 1, 3, 4, 5, 6, 7 | COVERED
REQ     | QUICK-261008-rxw | Pedido do dono de 2026-10-08 (com a revisão do mesmo dia) | 1-7 | COVERED
CONTEXT | D-01 | Nova aba Ganhos perto de Perdidos, status ganho atual | 1 (where status = ganho), 5 | COVERED
CONTEXT | D-02 | Nome exibido, data do ganho, vendedor só Supervisor, RLS decide, período e busca iguais | 1, 3, 5 | COVERED
CONTEXT | D-03 | Sem motivo, sem contato na lista | 1 (sql-exato, colunas-lgpd), 3, 5 | COVERED
CONTEXT | D-04 | Sem Reabrir | P-03; 3 (sem-acao-extra), 5 (sem-reabrir) | COVERED
CONTEXT | D-05 | Linha abre a mesma ClienteDetailSheet; catálogos pela página | 3, 5 | COVERED
CONTEXT | D-06 | Leitura na 0053 estilo 0034, sem elevação, sem checagem de papel, 6 colunas, ASCII, volta atrás, inventário | 1, 2, 6 | COVERED
CONTEXT | D-07 | Banco PRIMEIRO; nada publicado antes | 2, 3, 4, 5, 6 (pré-condição), 7 | COVERED
CONTEXT | D-08 | Item Ganhos no menu, ordem deliberada, ícone distinto, testes do menu, rota protegida, resto intocado | 5, 7 | COVERED
CONTEXT | D-09 | Estrutural, camada pura, ação, tela, menu, ficha, ao vivo (2 logins, nomes inventados, nada impresso, sem acesso diário, sem resíduo, vermelhos até aplicar, não executados antes) | 1, 3, 4, 5, 7 | COVERED
CONTEXT | D-10 | Gate (testes afetados, tsc, eslint, build com exit code, guarda 1 migration + 1 volta; sem suíte legada) | 7 | COVERED
CONTEXT | D-11 | Commits locais, sem push, coautoria, sem .planning/config.json | 1, 3, 4, 5, 7 | COVERED
CONTEXT | D-12 | Agente nunca aplica SQL; checkpoints em português com LGPD | 2, 6 | COVERED
CONTEXT | D-13 | Coluna real clientes.ganho_em; reserva por cadastro recusada | 1 (coluna-ganho-em, sql-exato), 4 | COVERED
CONTEXT | D-14 | Preenchimento automático (São Paulo) ao virar ganho com data vazia; mecanismo justificado; inventário 11; sem elevação nova | 1 (gatilho, P-12; ao vivo gatilho-*) | COVERED
CONTEXT | D-15 | Backfill pelo registro mais recente de troca para ganho; sem registro fica vazio | 1 (backfill-so-ganho-sem-data), 6 (contagem do dono) | COVERED
CONTEXT | D-16 | "Data não informada"; vazio só em Tudo (dito claramente); ordem desc com vazios por último | 1 (leitura, sem-data-so-em-tudo, ordem-nulos-por-ultimo), 2 (texto ao dono), 3, 5 (aviso-sem-data) | COVERED
CONTEXT | D-17 | Campo "Data do ganho" na ficha só para ganho; schema, ação, leitura; validação sensata sem proibir antes do cadastro; RLS existente; testes de forma atualizados | 4 (+ ao vivo edicao-* na 1) | COVERED
CONTEXT | D-18 | 0053 reescrita por commits novos; uma migration; volta atrás remove tudo e avisa que apaga as datas; código atual compatível | 1, 2, 6, 7 | COVERED
</source_audit>

<verification>
- Tarefa 1: estrutural reescrito vermelho -> verde (11 casos, incluindo sql-exato e mesmas-regras-de-acesso-da-0034; corpo da leitura do `as $$` ao `$$;`, inclusive); inventário de 11 e estruturais 0049-0052 sem edição; uma migration nova e um arquivo de volta desde a base; ao vivo reescrito (13 casos) e não executado; commits novos sem reescrever histórico.
- Tarefa 2: aprovação explícita com campo "Data do ganho", "Data não informada"/"só em Tudo", quem edita, LGPD, ordem com banco primeiro (toda ficha lê a coluna) e volta atrás que apaga as datas; orquestrador avisado para não publicar.
- Tarefa 3: camada pura, leitor/ação, linha e período vermelho -> verde; sem import cruzado; Perdidos e Encerrados idênticos à base.
- Tarefa 4: regra pura, schema, ação e ficha vermelho -> verde; construtores atualizados de propósito; consumidores da ficha verdes sem edição; funil, diálogos e exportação intocados.
- Tarefa 5: tela, rota e menu vermelho -> verde; 3 casos de ordem atualizados de propósito; 4 testes do menu sem edição verdes.
- Tarefa 6: nada publicado conferido imediatamente antes; dono aplica a 0053 com "Success"; volta atrás não aplicada.
- Tarefa 7: 13 casos ao vivo verdes sem resíduo; gate verde (BUILD_EXIT=0); guarda de escopo OK (31 arquivos); Preview pendente para depois do envio à staging.
</verification>

<success_criteria>
- Vendedor e Supervisor veem a aba "Ganhos" (troféu) entre Clientes e Perdidos; cada cliente ganho aparece com "Ganho em dd/mm/aaaa" (data real) ou "Data não informada", ordenado do mais recente, sem data no fim; o vendedor responsável aparece só para o Supervisor.
- A data do ganho é preenchida sozinha ao virar ganho, nunca sobrescrita sozinha, recuperada do histórico para os ganhos atuais, e pode ser preenchida/corrigida na ficha (só para clientes ganhos) por quem já edita a ficha.
- Clientes sem data aparecem só em "Tudo", e a tela avisa isso quando há período escolhido.
- Clicar num cliente abre a mesma ficha do funil; encerrar pela ficha tira o cliente da lista; não há Reabrir, motivo nem contato na lista.
- Cada vendedor vê e edita só os próprios clientes; o Supervisor vê e edita todos — decidido só pela RLS, sem policy nova.
- Exatamente uma migration nova (0053) e um arquivo de volta, sem função elevada nova; nenhuma migration antiga editada; Agenda, Clientes, Perdidos, Encerrados e Dashboard intocados; o código atual de produção funciona com a coluna nova.
- O dono aprovou (com o alerta de LGPD) e aplicou a 0053 ANTES de qualquer publicação; testes ao vivo verdes depois disso.
</success_criteria>

<output>
Criar `.planning/quick/261008-rxw-aba-ganhos-clientes-ganhos-no-menu/261008-rxw-SUMMARY.md` com os itens (a)-(o) da Tarefa 7, os hashes dos commits (incluindo os da primeira execução da Tarefa 1, marcados como substituídos pela reescrita), o BASE impresso pela guarda e as notas para o dono em linguagem simples.
Não fazer push. Ordem para o orquestrador: NADA vai para staging antes de o dono aplicar a 0053 (Tarefa 6) e o gate da Tarefa 7 ficar verde — o código novo lê a coluna em toda ficha; depois disso, staging -> conferência do Preview -> master (CLAUDE.md, "Fluxo de Deploy").
</output>
