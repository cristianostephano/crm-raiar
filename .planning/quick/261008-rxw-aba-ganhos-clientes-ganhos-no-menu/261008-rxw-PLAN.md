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
  - components/ganhos/GanhosList.tsx
  - app/(app)/ganhos/page.tsx
  - components/layout/AppSidebar.tsx
  - tests/funil/ganhos-lista.test.ts
  - tests/funil/ganhos-query.test.ts
  - tests/funil/ganhos-item-row.test.tsx
  - tests/funil/ganhos-periodo-filter.test.tsx
  - tests/funil/ganhos-list.test.tsx
  - tests/funil/app-sidebar-ganhos.test.tsx
  - tests/funil/app-sidebar-perdidos.test.tsx
  - tests/funil/app-sidebar-encerrados.test.tsx
  - tests/agenda2/app-sidebar-agenda2.test.tsx

must_haves:
  truths:
    - "D-01/D-08/P-04: Vendedor e Supervisor veem no menu principal um item 'Ganhos' (ícone de troféu, sem contador) entre Clientes e Perdidos; a ordem visível passa a ser Agenda, Clientes, Ganhos, Perdidos, Encerrados, Dashboard; /ganhos fica dentro do grupo protegido (app) e manda para /login quem não tem sessão, igual a /perdidos."
    - "D-02: a tela Ganhos lista os clientes com status ganho HOJE; cada linha mostra o nome exibido (Nome Fantasia, senão razão social), 'Ganho em dd/MM/aaaa' e — só para o Supervisor — o nome do vendedor; busca por nome e filtro de período Tudo / Últimos 30 dias / Últimos 90 dias / Personalizado iguais aos de Perdidos."
    - "D-02/P-02: 'Ganho em' é a data da troca de status mais recente para ganho no histórico (cliente encerrado e reativado conta a reativação); cliente cadastrado já como ganho, sem essa troca, usa a data de cadastro — editar a ficha nunca muda a data nem tira/põe o cliente do recorte de período (provado ao vivo)."
    - "D-06: o Vendedor recebe só os próprios clientes ganhos e o Supervisor recebe todos — decidido só pela RLS (sem checagem de papel na leitura), provado ao vivo; a leitura devolve exatamente 6 colunas, nenhuma de contato."
    - "D-05: clicar numa linha (ou Enter/espaço com o foco nela) abre a MESMA ficha do funil (ClienteDetailSheet), com contato, histórico e edição; salvar, apagar ou encerrar pela ficha recarrega a lista — cliente encerrado some da tela Ganhos."
    - "D-03/D-04/P-03: a lista não tem coluna de motivo, nem dado de contato, nem botão Reabrir."
    - "D-06/D-07/D-12: exatamente UMA migration nova (0053) e UM arquivo de volta desde 89a8707bd3e4ef581951d84f97906ca02e15b76e, sem cláusula de elevação de privilégio, inventário de 11 funções elevadas intacto, volta atrás com NAO APLICAR; o dono aprovou e aplicou a 0053 ANTES de qualquer publicação da tela."
    - "D-08: Agenda, funil de Clientes, Perdidos, Encerrados, Dashboard e a própria ficha do cliente não mudam (guarda de escopo e diff vazio nesses caminhos)."
  artifacts:
    - path: supabase/migrations/0053_clientes_ganhos.sql
      provides: "Leitura nova clientes_ganhos(p_inicio, p_fim), somente leitura, roda como quem chama, 6 colunas mínimas"
      contains: "create or replace function clientes_ganhos("
    - path: supabase/rollbacks/0053_volta_clientes_ganhos.sql
      provides: "Volta atrás que remove só a leitura nova, fora de supabase/migrations, cabeçalho NAO APLICAR"
      contains: "NAO APLICAR"
    - path: tests/funil/ganhos-migracao.test.ts
      provides: "Teste estrutural (fs) da 0053: corpo = corpo da 0034 com trocas listadas, 6 colunas, sem elevação nem escrita, comentários seguros, volta atrás"
      contains: "corpo-0034-com-trocas"
    - path: tests/funil/ganhos-rpc.test.ts
      provides: "Testes ao vivo de clientes_ganhos (RLS, data do ganho, data de cadastro de reserva, último ganho, período, paginação), VERMELHOS até o dono aplicar a 0053"
      contains: "sem-historico-usa-cadastro"
    - path: lib/ganhos/lista.ts
      provides: "Camada pura: tipo ClienteGanho (6 campos), presets e resolução de período, validação de entrada, busca por nome"
      contains: "export function resolvePeriodoGanhos"
    - path: lib/supabase/queries/ganhos.ts
      provides: "Leitor paginado getClientesGanhos (buscarPaginado + ordem ganho_em desc, cliente_id asc)"
      contains: "clientes_ganhos"
    - path: app/actions/ganhos.ts
      provides: "Server Action getClientesGanhosAction (sessão, validação de período, erro fixo)"
      contains: "getClientesGanhosAction"
    - path: components/ganhos/GanhosList.tsx
      provides: "Tela inteira (título, busca, período, lista) + ClienteDetailSheet aberta pela linha"
      contains: "ClienteDetailSheet"
    - path: app/(app)/ganhos/page.tsx
      provides: "Rota protegida /ganhos com os catálogos que a ficha exige"
      contains: "getCategoriasAtivas"
    - path: components/layout/AppSidebar.tsx
      provides: "Item Ganhos (Trophy) entre Clientes e Perdidos"
      contains: "href: \"/ganhos\""
  key_links:
    - from: "components/ganhos/GanhosList.tsx"
      to: "app/actions/ganhos.ts getClientesGanhosAction -> lib/supabase/queries/ganhos.ts getClientesGanhos -> RPC clientes_ganhos"
      via: "efeito de carga com reloadKey e intervalo memorizado, leitura paginada"
      pattern: "getClientesGanhosAction\\("
    - from: "components/ganhos/GanhosItemRow.tsx onAbrir"
      to: "ClienteDetailSheet clienteId/open em GanhosList"
      via: "handleAbrirFicha define selectedClienteId e sheetOpen"
      pattern: "onAbrir"
    - from: "ClienteDetailSheet onSaved/onDeleted/onStatusChanged"
      to: "GanhosList handleRecarregar (reloadKey)"
      via: "mesma fiação da Agenda (components/agenda/AgendaList.tsx linhas 440-452)"
      pattern: "onStatusChanged=\\{handleRecarregar\\}"
    - from: "app/(app)/ganhos/page.tsx"
      to: "GanhosList -> ClienteDetailSheet"
      via: "categoriaOptions, produtoOptions, vendedorOptions (só Supervisor) e isSupervisor, molde app/(app)/agenda/page.tsx"
      pattern: "vendedorOptions"
    - from: "supabase/migrations/0053_clientes_ganhos.sql"
      to: "RLS de clientes/historico/profiles"
      via: "função sem elevação de privilégio e sem checagem de papel — RLS é a única fronteira"
      pattern: "language sql"
    - from: "tests/funil/ganhos-migracao.test.ts"
      to: "supabase/migrations/0034_clientes_perdidos.sql"
      via: "corpo (do 'as $$' ao '$$;', inclusive) da 0034 normalizado + 8 trocas == corpo da 0053 normalizado; assinatura provada à parte pela ASSINATURA_ESPERADA"
      pattern: "corpo-0034-com-trocas"
    - from: "components/layout/AppSidebar.tsx PRINCIPAL_SECTION"
      to: "/ganhos"
      via: "link entre /clientes e /perdidos, sem badgeCount"
      pattern: "Trophy"
---

<objective>
Pedido do dono (2026-10-08): criar no menu uma aba "Ganhos" (clientes ganhos), ao lado de "Perdidos". Hoje, depois que a Agenda antiga saiu do menu, não existe nenhum lugar que liste os clientes com status ganho — e por isso também não há caminho visível até a ficha deles.

Explicando sem jargão: (1) o banco ganha uma leitura nova, irmã da leitura da tela Perdidos, que responde "quais clientes estão ganhos hoje, desde quando e de qual vendedor"; (2) quem decide quais clientes cada pessoa vê continua sendo a regra de acesso do banco (vendedor vê só os seus; Supervisor vê todos); (3) a tela Ganhos é uma cópia de comportamento da tela Perdidos, sem motivo e sem "Reabrir", e clicar num cliente abre a mesma ficha do funil; (4) o PRÓPRIO dono cola a mudança no SQL Editor depois de aprovar, e só depois a tela é publicada (o site de teste e o de produção usam o MESMO banco).

Decisões do dono, numeradas para rastreio:
- D-01: Nova aba "Ganhos" no menu principal, perto de "Perdidos", listando clientes com status_acompanhamento = 'ganho' (status ATUAL).
- D-02: Colunas/comportamento IGUAIS a Perdidos: nome (nomeExibicaoCliente: Nome Fantasia / razão social); data em que o cliente virou ganho (registro mais recente de troca de status para "ganho" no historico, com data de reserva quando não houver registro); nome do vendedor só para o Supervisor (a RLS decide as linhas; Vendedor só os próprios); mesmo filtro de período (Tudo, Últimos 30 dias, Últimos 90 dias, Personalizado) e mesma busca por nome.
- D-03: SEM coluna de motivo. SEM dado de contato na lista (telefone/e-mail/contato ficam só na ficha — minimização LGPD, mesma disciplina de colunas mínimas de Perdidos).
- D-04: SEM ação "Reabrir", salvo justificativa — decidido: nenhuma (ver P-03).
- D-05: Clicar numa linha ABRE A FICHA do cliente (a mesma ClienteDetailSheet do funil) com contato, histórico e edição; catálogos fornecidos por página de servidor como app/(app)/agenda/page.tsx; reutilizar componentes existentes, nunca duplicar a ficha.
- D-06: Banco — RPC nova clientes_ganhos(p_inicio, p_fim) na migration 0053 (próxima depois da 0052), no estilo da 0034: language sql stable, SEM cláusula de elevação de privilégio, sem checagem de papel dentro, RLS como única fronteira, colunas mínimas (cliente_id, razao_social, nome_fantasia, ganho_em, responsavel, responsavel_nome). Comentários ASCII dentro de um bloco barra-asterisco (comentário de dois hífens quebra a colagem no SQL Editor). Arquivo de volta em supabase/rollbacks (não aplicado automaticamente, cabeçalho NAO APLICAR). Teste de inventário de funções elevadas intacto.
- D-07: Ordem — staging e produção usam UM banco só; o código novo chama a RPC nova, então o dono aplica a migration PRIMEIRO e só depois a tela é publicada (nada vai para o GitHub antes).
- D-08: Menu — item "Ganhos" na AppSidebar, ordem deliberada com testes/comentários do menu atualizados de propósito; ícone distinto de Archive/PauseCircle; rota protegida como /perdidos; Agenda e todo o resto intocados.
- D-09: Testes — estrutural da migration, camada pura, leitor e ação (com dublês), tela (linhas, período, nome do vendedor só para o Supervisor, clique abre a ficha), menu atualizado de propósito, testes ao vivo (no máximo 2 logins, nomes inventados, nunca imprimir dado real, sem tocar a tabela de acesso diário da aderência, sem deixar resíduo; VERMELHOS até o dono aplicar; escritos mas NÃO executados na tarefa de construção).
- D-10: Gate final — testes afetados, tsc, eslint --max-warnings 0 nos arquivos tocados, npm run build com código de saída conferido, guarda de escopo (exatamente 1 migration nova + 1 arquivo de volta). NÃO rodar a suíte legada inteira (~49 arquivos vermelhos pré-existentes).
- D-11: Commits só locais, NENHUM push (o orquestrador publica depois da migration aplicada e do gate verde). Todo commit termina com "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>". Nunca adicionar .planning/config.json a um commit.
- D-12: O agente NUNCA aplica SQL nem usa db push. Checkpoints do dono (decisão + ação humana) em português simples, como nas quick 261006-ncy e 261008-mrf, com alerta de LGPD (lista de nomes de clientes + quem os ganhou; nenhum dado novo coletado; colunas mínimas; contato só na ficha; cada vendedor vê só os próprios clientes). Prazo: idealmente pronto nesta semana.

Escolhas do planejador (discricionárias, documentadas):
- P-01: RPC nova (e não leitura sem migration). Sem a RPC, o servidor teria de baixar TODOS os clientes ganhos (paginado), depois o histórico de status de todos eles (lista enorme de ids numa requisição), calcular a data e recortar o período em JavaScript — mais código, mais tráfego (free tier) e o filtro de período só depois de baixar tudo. A RPC é ~20 linhas, puramente de leitura, no molde já provado de 0034/0036, e nenhuma tela existente a chama, então aplicá-la não muda nada no site de hoje. O único custo é a ordem banco-primeiro, que já é o procedimento padrão.
- P-02: Data de reserva = clientes.criado_em (desvio CONSCIENTE do pedido, que sugeria atualizado_em espelhando a 0034 — apresentado ao dono no checkpoint da Tarefa 2). Motivo: o gatilho que grava troca de status no historico existe desde a 0002 (mesma migration que criou clientes) e grava 'Status alterado para "<novo>"'; então um cliente ganho SEM nenhuma linha de troca para "ganho" foi necessariamente CADASTRADO já como ganho — o caso comum é a planilha de Clientes Ativos (importar_clientes_ativos_lote, 0027). Para esses, a data de cadastro é exatamente "quando virou ganho". atualizado_em muda a CADA edição (gatilho de antes da atualização da 0002) — editar o telefone na ficha aberta pela própria tela Ganhos faria o cliente "virar ganho hoje" e pular para "Últimos 30 dias". Na 0034 o caso sem histórico era anomalia; aqui é o caso de centenas de clientes importados. Se o dono escolher "ajustar: usar última atualização" na Tarefa 2, a troca é só nas 3 ocorrências da expressão de data na 0053 + trocas R2/R6/R7 do teste estrutural + caso sem-historico-usa-cadastro (a 0053 ainda não estará aplicada).
- P-03: Sem ação na linha. "Reabrir" de Perdidos devolve um perdido ao funil; "desganhar" um cliente não é um fluxo do negócio. A saída de negócio de um cliente ativo é "Encerrar" (Fase 29), que já mora dentro da ficha com o motivo — e a ficha abre pela linha. onStatusChanged recarrega a lista e o encerrado some.
- P-04: Ordem do menu Agenda, Clientes, Ganhos, Perdidos, Encerrados, Dashboard (os dois desfechos do funil logo depois de Clientes, o bom primeiro; Encerrados continua depois de Perdidos). Ícone Trophy — BadgeCheck já é o de "Importar Clientes Ativos" (Administração), Archive é Perdidos, PauseCircle é Encerrados. Sem contador (mesma decisão D-02 de Perdidos: não é pendência).
- P-05: Módulos IRMÃOS, sem import cruzado com Perdidos/Encerrados (precedente da Fase 29, "irmã deliberada — não generalização"): lib/ganhos/lista.ts, lib/supabase/queries/ganhos.ts, app/actions/ganhos.ts, components/ganhos/*. GanhosPeriodoFilter é cópia estrutural de PerdidosPeriodoFilter com os tipos de Ganhos.
- P-06: Página app/(app)/ganhos/page.tsx no molde de app/(app)/agenda/page.tsx: categorias e produtos ativos para todos; vendedorOptions (profiles id/nome/sobrenome ordenado por nome) só para o Supervisor; sem catálogo de conclusão remota (a Agenda usa para outra janela).
- P-07: Linha clicável no molde de AgendaItemRow: Card com role="button", tabIndex 0, Enter/espaço abrem, cursor-pointer, rótulo acessível "Abrir ficha de {nome}"; nenhum botão dentro da linha.
- P-08: A ficha recebe isSupervisor, os 3 catálogos, onSaved/onDeleted/onStatusChanged = recarregar; NÃO recebe currentUserId (mesmo que a Agenda: sem ele o Vendedor nunca vê o botão de apagar — e a 0050 só deixa o Vendedor apagar em prospecção). Comportamento do Supervisor na ficha é o de hoje, sem mudança.
- P-09: Ordem das tarefas: Tarefa 1 (banco e testes, só local) -> Tarefa 2 (decisão do dono) -> Tarefas 3 e 4 (tela, commits só locais) -> Tarefa 5 (dono aplica o SQL; pré-condição: nenhum commit feat desta quick em origin/staging nem origin/master) -> Tarefa 6 (testes ao vivo + gate). A decisão vem antes da tela para que um ajuste de texto/ordem/ícone entre direto nas Tarefas 3-4, sem retrabalho.
- P-11: responsavel_nome volta da RPC para QUALQUER chamador autenticado (mesmo desenho da 0034); o Vendedor só recebe as próprias linhas pela RLS, então o único nome que ele recebe é o dele mesmo. Esconder o nome do vendedor de quem não é Supervisor é só conforto de TELA (showResponsavel = isSupervisor), não fronteira de segurança — registrado no SUMMARY (item m).
- P-10: Testes do menu: as 3 checagens de ordem existentes filtram por uma lista de hrefs e continuariam verdes sem edição; mesmo assim são atualizadas DE PROPÓSITO para incluir /ganhos (D-08), cada uma com um comentário de uma linha citando esta quick task.

Purpose: devolver ao time um lugar para ver os clientes ganhos e chegar à ficha deles, com o mínimo de dado pessoal na lista e a mesma regra de acesso de sempre.
Output: migration 0053 + arquivo de volta + leitura/ação/camada pura + tela Ganhos com a ficha + item de menu + testes (estrutural, ao vivo, camada pura, leitor/ação, tela, menu); aplicação feita pelo dono ANTES de publicar; gate final verde.
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

**Molde Perdidos (Fase 28).** app/(app)/perdidos/page.tsx (getUser -> redirect /login; role -> isSupervisor; renderiza PerdidosList). components/perdidos/PerdidosList.tsx (FetchState carregando/erro/pronto; preset + customRange + busca + reloadKey; intervalo em useMemo; efeito com cancelled e setState síncrono com os dois eslint-disable já usados; textos de vazio/sem recorte/busca/erro; botão "Tentar novamente"). components/perdidos/PerdidosItemRow.tsx (Card size sm; CardTitle truncado com title; data via format(parseISO(...), "dd/MM/yyyy"); vendedor só com showResponsavel). components/perdidos/PerdidosPeriodoFilter.tsx (Select + Popover/Calendar range + Cancelar/Aplicar período). lib/perdidos/lista.ts (tipo, presets, resolvePeriodo, temRecortePeriodo, validarPeriodo, filtrarPorNome — sem import de Supabase/Next). lib/supabase/queries/perdidos.ts (buscarPaginado + rpc + 2 orders + range; erro "leitura paginada incompleta"). app/actions/perdidos.ts (getUser; validação; try/catch com mensagem fixa). Testes: tests/funil/perdidos-{lista,query,item-row,periodo-filter,list,rpc}.test.ts(x). Encerrados (Fase 29) é a cópia irmã já feita uma vez (nomes com sufixo, ex.: temRecortePeriodoEncerrados).

**Formato do histórico.** supabase/migrations/0002_clientes_and_funil.sql linhas 411-441: clientes_after_update_historico grava, quando o status muda, tipo 'status_acompanhamento' e descrição 'Status alterado para "<novo status>"' — só o valor NOVO; logo ilike '%"ganho"%' casa só com trocas PARA ganho (mesmo filtro de dashboard_ganhos_perdidos, 0003). O gatilho só roda em UPDATE: cliente INSERIDO já ganho não tem linha (caso da planilha de Ativos, 0027). clientes tem criado_em e atualizado_em (0002 linhas 126-127); o gatilho de antes da atualização renova atualizado_em em TODO update (linha 401). historico, tarefas e visitas apagam em cascata com o cliente.

**Ficha do cliente.** components/clientes/ClienteDetailSheet.tsx linhas 214-245: props clienteId (string ou null), open, onOpenChange, isSupervisor, currentUserId opcional, categoriaOptions, produtoOptions, vendedorOptions (todos { id, nome }[]), onSaved(values), onDeleted(id), onStatusChanged opcional (Fase 29). A ficha carrega o próprio cliente/tarefas/histórico pelo id. Molde de uso fora do Kanban: components/agenda/AgendaList.tsx linhas 184-187 (handleOpenCliente) e 440-452 (montagem única da ficha com onSaved/onDeleted/onStatusChanged = handleRecarregar); app/(app)/agenda/page.tsx linhas 45-62 (catálogos). Encerrar/reativar acontecem dentro da ficha.

**Menu.** components/layout/AppSidebar.tsx linhas 98-126: PRINCIPAL_SECTION com /agenda (filtrada pela flag), /agenda-2, /clientes, /perdidos (Archive), /encerrados (PauseCircle), /dashboard; JSDoc das linhas 77-97 descreve a ordem visível; Administração usa BadgeCheck para "Importar Clientes Ativos". lucide-react 1.24.0 instalado exporta Trophy e gera a classe lucide-trophy no svg. Testes de ordem que filtram por lista de hrefs: tests/funil/app-sidebar-perdidos.test.tsx (caso "ordem", linhas 69-87), tests/funil/app-sidebar-encerrados.test.tsx (caso "ordem"), tests/agenda2/app-sidebar-agenda2.test.tsx (caso "ordem-d15", linhas 57-84). Demais testes do menu (tests/agenda/app-sidebar-agenda.test.tsx, tests/importacao/AppSidebar.test.tsx, tests/layout/app-sidebar-visual.test.tsx, tests/agenda2/app-layout-contagem.test.tsx) são só com dublês e não citam a ordem completa — continuam verdes SEM edição.

**Proteção de rota.** middleware.ts só renova a sessão; a guarda é o layout do grupo (app) + o getUser/redirect da própria página (molde /perdidos). Criar a página dentro de app/(app)/ganhos basta.

**Inventário de funções elevadas.** tests/agenda2/migracao-agenda2.test.ts (inventario-elevacao-inalterado): varre TODAS as migrations com o texto em minúsculas SEM linhas de dois hífens mas COM blocos barra-asterisco, pega a última definição de cada função e exige 11 elevadas. Logo o bloco de comentário da 0053 não pode conter a frase de criação de função, nem a cláusula de elevação, nem o nome da tabela da Agenda 2 (o caso arquivo-unico desse arquivo procura esse nome em TODAS as migrations). Os estruturais 0049/0050/0051/0052 só olham os próprios prefixos.

**Testes ao vivo (molde).** tests/funil/perdidos-rpc.test.ts e tests/funil/encerrados-rpc.test.ts: createTestMember/deleteTestMember (helpers em tests/helpers/supabase-test-clients.ts: anonClient, serviceClient, signInAs, createTestMember(role, label) -> { id, email, password, nome, sobrenome }, deleteTestMember), 2 logins (Vendedor A e Supervisor; Vendedor B nunca loga), semeadura pelo cliente de serviço (status mudado por UPDATE separado para o gatilho gravar o histórico, com autor nulo), CNPJ único por fixture (trava de duplicata da 0030), leituras do Supervisor filtradas com .in("cliente_id", ids) no próprio PostgREST (nunca baixa a carteira real), afterEach apaga os clientes, afterAll apaga os membros. Constraints: ganho exige etapa 'primeira_venda' (0002); perdido exige motivo_perda_id; encerrado exige motivo_encerramento_id (0036). As travas de transição para ganho (CNPJ/endereço/frequência) vivem dentro de mover_card_funil, não em gatilho — UPDATE pelo cliente de serviço não as aciona.

**Skill supabase-conventions.** O exemplo de RPC da skill usa a cláusula de elevação; a convenção do PROJETO (STATE.md: "Todo RPC novo deve seguir isso", 0034/0036) é o contrário — leitura roda como quem chama. Segue-se a convenção do projeto.

## Contrato SQL (texto exato)

Bloco de comentário do topo da 0053 (um único bloco barra-asterisco, só ASCII, português sem acento, nenhuma linha começando com dois hífens, sem a palavra inglesa de função, sem cifrões duplos, sem a cláusula de elevação, sem o nome da tabela da Agenda 2). Deve dizer: quick task 261008-rxw, decisao do dono de 2026-10-08, aba Ganhos no menu; cria uma leitura nova, somente leitura, clientes_ganhos(p_inicio, p_fim): quais clientes estao ganhos hoje, desde quando e de qual vendedor, irma da leitura clientes_perdidos (0034); roda com as permissoes de quem chama, sem elevacao de privilegio, sem grant e sem revoke, sem checagem de papel e sem filtro de dono no corpo — a RLS de clientes, historico e profiles e a unica fronteira (Vendedor recebe so os proprios clientes, Supervisor recebe todos); data do ganho = registro mais recente de troca de status para "ganho" no historico (cliente encerrado e reativado conta a reativacao); sem esse registro (cliente cadastrado ja como ganho, por exemplo pela planilha de Clientes Ativos) vale a data de cadastro do cliente, nunca a da ultima edicao, que mudaria a cada edicao da ficha — diferenca deliberada em relacao a 0034; colunas minimas (LGPD): cliente_id, razao_social, nome_fantasia, ganho_em, responsavel, responsavel_nome — nenhum meio de contato com a pessoa do cliente, que continua so na ficha; nada e gravado e nenhum dado novo e coletado; aplicar ANTES de publicar a tela Ganhos (o site atual nao usa esta leitura, entao aplicar nao muda nada no site de hoje); volta atras em supabase/rollbacks/0053_volta_clientes_ganhos.sql, NAO aplicado automaticamente, primeiro a tela e depois o banco.

Código da 0053 depois do bloco de comentário (o corpo não leva comentário nenhum — o resultado deve ser exatamente isto):

```sql
create or replace function clientes_ganhos(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid,
  razao_social text,
  nome_fantasia text,
  ganho_em timestamptz,
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
    coalesce(h.criado_em, c.criado_em) as ganho_em,
    c.responsavel,
    nullif(trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as responsavel_nome
  from clientes c
  left join lateral (
    select h2.criado_em
    from historico h2
    where h2.cliente_id = c.id
      and h2.tipo = 'status_acompanhamento'
      and h2.descricao ilike '%"ganho"%'
    order by h2.criado_em desc
    limit 1
  ) h on true
  left join profiles p on p.id = c.responsavel
  where c.status_acompanhamento = 'ganho'
    and (p_inicio is null or coalesce(h.criado_em, c.criado_em) >= p_inicio)
    and (p_fim is null or coalesce(h.criado_em, c.criado_em) < p_fim)
  order by 4 desc, 1 asc;
$$;
```

Assinatura esperada (texto normalizado: todo espaço em branco vira um espaço; minúsculas) — o teste estrutural guarda como constante ASSINATURA_ESPERADA:
`create or replace function clientes_ganhos( p_inicio timestamptz default null, p_fim timestamptz default null ) returns table ( cliente_id uuid, razao_social text, nome_fantasia text, ganho_em timestamptz, responsavel uuid, responsavel_nome text ) language sql stable as $$`

**Definição de "corpo" (vale para este contrato e para o teste corpo-0034-com-trocas):** o texto que começa no primeiro `as $$` depois da frase de criação da função e termina no primeiro `$$;` depois dele, INCLUSIVE os dois marcadores. NÃO é o bloco inteiro da função: na 0034 a assinatura (do `create or replace` até antes do `as $$`) ainda diz clientes_perdidos / motivo_perda_nome / perdido_em, e essas diferenças de nome e de colunas de retorno são cobertas SÓ pelo caso assinatura (ASSINATURA_ESPERADA). Conferido pelo checador: aplicando R1..R8 sobre o corpo assim definido da 0034, o resultado é igual ao corpo da 0053.

As 8 trocas que transformam o corpo da 0034 no corpo da 0053 (texto normalizado; aplicar sobre o corpo da 0034 sem comentários e normalizado, renormalizar depois das trocas e comparar com o corpo da 0053 sem comentários e normalizado). Cada "antigo" aparece exatamente 1 vez no corpo da 0034:
- R1: `mp.nome as motivo_perda_nome,` -> (vazio)
- R2: `coalesce(h.criado_em, c.atualizado_em) as perdido_em` -> `coalesce(h.criado_em, c.criado_em) as ganho_em`
- R3: `'%"perdido"%'` -> `'%"ganho"%'`
- R4: `left join motivos_perda mp on mp.id = c.motivo_perda_id` -> (vazio)
- R5: `where c.status_acompanhamento = 'perdido'` -> `where c.status_acompanhamento = 'ganho'`
- R6: `coalesce(h.criado_em, c.atualizado_em) >= p_inicio` -> `coalesce(h.criado_em, c.criado_em) >= p_inicio`
- R7: `coalesce(h.criado_em, c.atualizado_em) < p_fim` -> `coalesce(h.criado_em, c.criado_em) < p_fim`
- R8: `order by 5 desc, 1 asc;` -> `order by 4 desc, 1 asc;`

Por que isto prova que a autorização não mudou: a 0053 é a 0034 com exatamente estas trocas — tira o motivo, troca o status e o filtro de histórico, troca a data de reserva e a posição da coluna de ordenação. A junção com profiles, a junção lateral com historico, a ausência de checagem de papel e a ausência de elevação são as MESMAS da 0034, já provada ao vivo na Fase 28.

Arquivo de volta supabase/rollbacks/0053_volta_clientes_ganhos.sql: um bloco barra-asterisco ASCII começando com "NAO APLICAR automaticamente.", dizendo que fica fora de supabase/migrations de propósito (o CLI nunca o lê); que é a volta atrás da 0053 (quick 261008-rxw) e remove só a leitura clientes_ganhos; que nenhum dado é apagado (a 0053 só cria uma leitura); a ORDEM obrigatória — primeiro reverter os commits feat da tela Ganhos desta quick task e publicar (o item Ganhos sai do menu), só DEPOIS colar este arquivo no SQL Editor, porque na ordem inversa a aba Ganhos publicada mostraria "Não foi possível carregar os clientes ganhos" até a tela sair; aplicar só se o dono decidir desfazer. Depois do comentário, uma única instrução: `drop function if exists clientes_ganhos(timestamptz, timestamptz);`

## Interfaces existentes (lidas no código)

- lib/clientes/nomeExibicao.ts: `nomeExibicaoCliente(razaoSocial, nomeFantasia): string` (Nome Fantasia primeiro, depois razão social, senão `ROTULO_SEM_NOME`).
- lib/supabase/queries/paginacao.ts: `buscarPaginado<T>(buscarPagina: (inicio, fim) => Promise<{ data, error }>)` devolve `T[] | null` (null = leitura incompleta).
- lib/supabase/queries/clientes.ts: `getCategoriasAtivas()`, `getProdutosAtivos()` (usadas por app/(app)/agenda/page.tsx).
- lib/supabase/server.ts: `createClient()` (cliente sem tipagem de banco — rpc devolve dados a converter como em queries/perdidos.ts).
- lib/perdidos/lista.ts e app/actions/perdidos.ts: modelos a COPIAR (nunca importar) — `ClientePerdido`, `PeriodoPresetPerdidos`, `PERIODO_PADRAO_PERDIDOS`, `PERIODO_PRESETS_PERDIDOS`, `IntervaloPerdidos`, `resolvePeriodoPerdidos(preset, custom?, agora?)`, `temRecortePeriodo`, `validarPeriodoPerdidos(entrada: unknown)`, `filtrarPerdidosPorNome`, `getClientesPerdidosAction(intervalo)` com códigos unauthenticated/periodo_invalido/fetch_falhou.
- Nomes novos (contrato desta quick): `ClienteGanho = { clienteId; razaoSocial: string | null; nomeFantasia: string | null; ganhoEm: string; responsavel: string; responsavelNome: string | null }`, `PeriodoPresetGanhos`, `PERIODO_PADRAO_GANHOS`, `PERIODO_PRESETS_GANHOS`, `IntervaloGanhos`, `resolvePeriodoGanhos`, `temRecortePeriodoGanhos`, `ValidacaoPeriodoGanhos`, `validarPeriodoGanhos`, `filtrarGanhosPorNome`, `getClientesGanhos(intervalo)`, `getClientesGanhosAction(intervalo)` com `ClientesGanhosErrorCode` e `GetClientesGanhosResult`, `GanhosItemRow({ cliente, showResponsavel, onAbrir })`, `GanhosPeriodoFilter({ preset, customRange, onPresetChange, onCustomRangeApply })`, `GanhosList({ isSupervisor, categoriaOptions, produtoOptions, vendedorOptions })`.
- tests/funil/perdidos-query.test.ts: molde de dublê de "@/lib/supabase/server" (getUser/rpc/order/range com vi.hoisted).
- tests/clientes/kanban-card-filtrado.test.tsx linha 24: precedente de dublê de "@/components/clientes/ClienteDetailSheet" com vi.mock.
- tests/agenda/agenda-sem-visitas-migracao.test.ts e tests/dashboard/aderencia-parcial-migracao.test.ts: molde do teste estrutural (lerCru, lf, blocoDaFuncao, normaliza, assinatura, corpo, semComentarios, ehAsciiPuro, contaOcorrencias, linhaComecaComDoisHifens, cláusula montada por concatenação).

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Migration 0053 + arquivo de volta + teste estrutural (verde) + testes ao vivo (VERMELHOS até a aplicação, escritos e não executados)</name>
  <files>supabase/migrations/0053_clientes_ganhos.sql, supabase/rollbacks/0053_volta_clientes_ganhos.sql, tests/funil/ganhos-migracao.test.ts, tests/funil/ganhos-rpc.test.ts</files>
  <read_first>
    - supabase/migrations/0034_clientes_perdidos.sql (arquivo inteiro: o corpo a espelhar)
    - supabase/migrations/0052_aderencia_uso_parcial.sql e supabase/rollbacks/0052_volta_aderencia_uso.sql (estilo do bloco ASCII e do arquivo de volta)
    - tests/dashboard/aderencia-parcial-migracao.test.ts (molde do teste estrutural e helpers)
    - tests/agenda2/migracao-agenda2.test.ts linhas 43-150 (inventário — não editar)
    - tests/funil/perdidos-rpc.test.ts e tests/funil/encerrados-rpc.test.ts linhas 1-245 (molde dos testes ao vivo)
    - tests/helpers/supabase-test-clients.ts (assinaturas)
    - Seções "Pesquisa registrada" e "Contrato SQL" deste plano
  </read_first>
  <behavior>
    - Estrutural arquivo-unico: só um arquivo de migration começa com "0053" e é 0053_clientes_ganhos.sql; o arquivo de volta existe em supabase/rollbacks e não está em supabase/migrations.
    - Estrutural assinatura: a frase de criação de clientes_ganhos aparece exatamente 1 vez; a assinatura normalizada em minúsculas é igual a ASSINATURA_ESPERADA do "Contrato SQL".
    - Estrutural corpo-0034-com-trocas: "corpo" = do primeiro `as $$` depois da frase de criação até o primeiro `$$;` depois dele, INCLUSIVE os dois marcadores (definição do "Contrato SQL" — nunca o bloco inteiro, cuja assinatura na 0034 ainda tem o nome e as colunas de Perdidos); no corpo da 0034 sem comentários e normalizado cada "antigo" de R1..R8 aparece exatamente 1 vez; aplicando as 8 trocas e renormalizando, o resultado é IGUAL ao corpo da 0053 sem comentários e normalizado.
    - Estrutural colunas-minimas-lgpd: o bloco de retorno tem exatamente as 6 colunas na ordem do contrato; o SQL sem comentários em minúsculas não contém (como palavra inteira) telefone, email, contato, celular, cnpj, cep, rua, numero, observacao, motivo.
    - Estrutural sem-elevacao-sem-escrita: SQL sem comentários em minúsculas não contém a cláusula de elevação (montada por concatenação), "grant ", "revoke ", "insert into", "update ", "delete from", "truncate", "alter table", "drop ", "create table", "policy", "is_supervisor", "auth.uid", "atualizado_em", "etapa_alterada_em"; contém "language sql" e "stable"; a lista de funções criadas é exatamente ["clientes_ganhos"]; a expressão coalesce(h.criado_em, c.criado_em) aparece exatamente 3 vezes.
    - Estrutural comentarios-seguros: arquivo cru da 0053 é ASCII puro, primeira linha não vazia começa com o abre-comentário barra-asterisco, nenhuma linha começa com dois hífens, "$$" aparece exatamente 2 vezes, a palavra "function" aparece exatamente 1 vez no texto cru minúsculo, não contém a cláusula de elevação nem o nome da tabela da Agenda 2 (montados por concatenação), contém "261008-rxw" e "supabase/rollbacks/0053_volta_clientes_ganhos.sql".
    - Estrutural volta-remove-so-a-leitura: arquivo de volta ASCII puro, sem linha de dois hífens, contém "NAO APLICAR", "function" exatamente 1 vez no texto cru minúsculo; o SQL sem comentários, normalizado e minúsculo é exatamente a instrução única do contrato (remoção só de clientes_ganhos com a assinatura timestamptz, timestamptz).
    - Inventário (tests/agenda2/migracao-agenda2.test.ts) e os estruturais 0049/0050/0051/0052 continuam verdes SEM edição.
    - Ao vivo (tests/funil/ganhos-rpc.test.ts — VERMELHO até a 0053 ser aplicada; NÃO executado nesta tarefa), um describe, casos com exatamente estes nomes: colunas-lgpd, rls-vendedor, rls-supervisor, data-do-ganho, sem-historico-usa-cadastro, ultimo-ganho, so-ganho-atual, periodo, paginacao, anonimo-sem-dados.
  </behavior>
  <action>
1. RED — criar tests/funil/ganhos-migracao.test.ts (ambiente node, só fs/path/vitest) no molde de tests/dashboard/aderencia-parcial-migracao.test.ts: caminhos da pasta de migrations, da 0034, nome/caminho da 0053 e do arquivo de volta em supabase/rollbacks; frases de criação de clientes_perdidos e de clientes_ganhos; cláusula de elevação, frase de remoção de função e nome da tabela da Agenda 2 montados por concatenação (nenhum aparece inteiro no arquivo de teste); constante ASSINATURA_ESPERADA e as 8 trocas R1..R8 copiadas ao pé da letra do "Contrato SQL"; helpers copiados do molde (o recorte do bloco da função usa a frase de criação até o primeiro fechamento de cifrões duplos com ponto e vírgula), com UMA diferença deliberada: o helper de corpo deste arquivo recorta do primeiro `as $$` depois da frase de criação até o primeiro `$$;` depois dele, INCLUSIVE os dois marcadores (o helper do molde exclui os marcadores) — e o caso corpo-0034-com-trocas compara SÓ esse corpo, nunca o bloco inteiro, porque a assinatura da 0034 ainda tem clientes_perdidos/motivo_perda_nome/perdido_em; nome e colunas de retorno da 0053 são provados só pelo caso assinatura. Escrever os 7 casos estruturais do bloco behavior com exatamente estes nomes de it: arquivo-unico, assinatura, corpo-0034-com-trocas, colunas-minimas-lgpd, sem-elevacao-sem-escrita, comentarios-seguros, volta-remove-so-a-leitura. Cabeçalho do teste em comentário: protege a forma da 0053 sem banco (per D-06), prova estrutural de que a autorização é a mesma da 0034 (per P-01) e de que a data de reserva é a de cadastro (per P-02). Rodar e confirmar que FALHA (arquivos ainda não existem). Commit: `test(quick-261008-rxw): add failing structural test for migration 0053 and rollback file`.
2. GREEN — criar supabase/migrations/0053_clientes_ganhos.sql (per D-06, P-01, P-02): primeiro o bloco de comentário descrito no "Contrato SQL", depois o código EXATO do "Contrato SQL"; nenhuma cláusula de segurança, nenhum grant/revoke, corpo sem comentário nenhum. Criar supabase/rollbacks/0053_volta_clientes_ganhos.sql como descrito no "Contrato SQL" (cabeçalho NAO APLICAR com a ordem tela-antes-banco-depois; depois só a instrução de remoção). Nunca editar a 0034 nem nenhuma migration antiga. Rodar o teste estrutural até ficar verde, junto com tests/agenda2/migracao-agenda2.test.ts (inventário de 11 SEM edição) e os estruturais da 0049/0050/0051/0052. Commit: `feat(quick-261008-rxw): add migration 0053 (clientes_ganhos read) and rollback file`.
3. Testes ao vivo (per D-09). Criar tests/funil/ganhos-rpc.test.ts no molde de tests/funil/perdidos-rpc.test.ts e tests/funil/encerrados-rpc.test.ts. Cabeçalho em comentário: prova clientes_ganhos (0053) contra o banco REAL (o projeto de teste é o de produção, com dados reais); VERMELHO (função inexistente) até o dono aplicar a 0053 — vermelho esperado e NÃO medido nesta quick task (o arquivo só roda depois da aplicação, na Tarefa 6); só fixtures descartáveis (createTestMember/deleteTestMember, nunca as contas semente antigas); exatamente duas autenticações (Vendedor A e Supervisor; Vendedor B nunca loga — os ganhos dele são semeados pelo cliente de serviço); TODA leitura da RPC, de qualquer sessão, filtrada com .in("cliente_id", ids de fixture) no próprio PostgREST (nunca baixa a carteira real); nenhuma chamada de impressão no terminal; razões sociais/nomes fantasia inventados; nunca lê nem grava a tabela de registro de acesso diário da aderência (não escrever o nome dessa tabela no arquivo, nem em comentário); todo status é trocado pelo cliente de serviço (autor nulo no histórico, então nada conta na aderência de ninguém). Helpers locais: uniqueRazaoSocial com prefixo "Teste Ganhos", uniqueCnpj (14 dígitos, como em encerrados-rpc), baseClienteFields com cnpj e endereço inventado, seedCliente (insert pelo serviço, guarda o id em createdClienteIds e em todosIdsCriados), seedGanhoPorTroca (insert em etapa primeira_venda com status em_andamento e depois UPDATE separado para ganho — o gatilho grava o histórico), historicoDoCliente, clientePorId, e leituras read-only do primeiro motivo de perda ativo e do primeiro motivo de encerramento ativo. Fixtures: createTestMember("vendedor", "ganhos-a"), ("vendedor", "ganhos-b"), ("supervisor", "ganhos"); signInAs de A e do Supervisor em sequência. afterEach apaga os clientes criados no caso (histórico vai por cascata). afterAll: apaga os 3 membros; DEPOIS confere pelo serviço que não sobrou nenhuma linha de clientes nem de historico para todosIdsCriados e lança erro (sem imprimir linha nenhuma) se sobrou. Casos (um describe; nomes exatos): colunas-lgpd (chaves ordenadas da linha de A == as 6 colunas ordenadas); rls-vendedor (ganho de A e ganho de B; sessão de A com .in nos dois ids recebe só o de A); rls-supervisor (mesmos dois ids recebidos pelo Supervisor; responsavel_nome da linha de A == nome e sobrenome da fixture A separados por espaço); data-do-ganho (insert em primeira_venda/em_andamento, UPDATE recuando criado_em e etapa_alterada_em para 2020-01-01, UPDATE para ganho; a linha "ganho" do histórico existe; janela 2019-12-31 a 2020-01-02 NÃO traz o id; janela agora ±10 min traz, com ganho_em igual ao criado_em da linha de histórico — comparar por getTime); sem-historico-usa-cadastro (per P-02: insert JÁ ganho em primeira_venda com criado_em = agora menos 40 dias; UPDATE separado só de observacao com um texto inventado, para atualizado_em ficar em agora; zero linhas de histórico tipo status_acompanhamento; ganho_em == criado_em relido pelo serviço, por getTime, e diferente de atualizado_em; com p_inicio = agora menos 30 dias o id NÃO vem; com p_inicio = agora menos 41 dias vem); ultimo-ganho (seedGanhoPorTroca, UPDATE para encerrado com o motivo de encerramento lido, UPDATE de volta para ganho; uma linha só para o id; ganho_em == maior criado_em entre as linhas de histórico com "ganho" e estritamente maior que a menor delas); so-ganho-atual (de A: um em_andamento em primeira_venda, um perdido com o motivo de perda lido, um encerrado — ganho e depois encerrado — e um ganho; .in nos 4 ids devolve exatamente o id ganho); periodo (molde do caso periodo de perdidos-rpc: janela ±10 min traz; p_inicio daqui a 60 min não traz; p_fim de 60 min atrás não traz; sem limites traz); paginacao (molde de perdidos-rpc com order ganho_em desc + cliente_id asc e range(0,0)/range(1,1) devolvendo os dois ids sem repetir); anonimo-sem-dados (anonClient() com .in no id de um ganho de A: erro ou zero linhas, nunca dados). Comparações de data sempre por getTime. Não executar este arquivo nesta tarefa (banco de produção, 0053 ainda não aplicada — mesmo procedimento da quick 261006-ncy); só tsc, eslint e a checagem estrutural do verify. Commit: `test(quick-261008-rxw): add live tests for clientes_ganhos (red until 0053 is applied)`. Todo commit com a linha de coautoria da D-11; nunca adicionar .planning/config.json.
  </action>
  <verify>
    <automated>npx vitest run tests/funil/ganhos-migracao.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts tests/dashboard/aderencia-parcial-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 tests/funil/ganhos-migracao.test.ts tests/funil/ganhos-rpc.test.ts && node -e "const fs=require('fs');const s=fs.readFileSync('tests/funil/ganhos-rpc.test.ts','utf8');const n=(s.match(/signInAs\(/g)||[]).length;if(n!==2)throw new Error('logins: '+n);if(/console\./.test(s))throw new Error('impressao');if(/SEED_ACCOUNTS/.test(s))throw new Error('contas semente');if(/acessos_diarios/.test(s))throw new Error('tabela de acesso diario citada');if(!/createTestMember\(/.test(s)||!/deleteTestMember\(/.test(s))throw new Error('fixtures');if(!s.includes('.in(\"cliente_id\"'))throw new Error('leitura sem filtro de ids');for(const c of ['colunas-lgpd','rls-vendedor','rls-supervisor','data-do-ganho','sem-historico-usa-cadastro','ultimo-ganho','so-ganho-atual','periodo','paginacao','anonimo-sem-dados']){if(!s.includes(c))throw new Error('caso ausente: '+c)}console.log('OK testes ao vivo (estrutura)')" && node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString().split('\n').map(s=>s.trim()).filter(Boolean);const b='89a8707bd3e4ef581951d84f97906ca02e15b76e';const m=g(['diff','--name-status',b,'HEAD','--','supabase/migrations']);if(m.length!==1||m[0]!=='A\tsupabase/migrations/0053_clientes_ganhos.sql')throw new Error('migrations: '+m.join(' | '));const r=g(['diff','--name-status',b,'HEAD','--','supabase/rollbacks']);if(r.length!==1||r[0]!=='A\tsupabase/rollbacks/0053_volta_clientes_ganhos.sql')throw new Error('rollbacks: '+r.join(' | '));console.log('OK uma migration e um arquivo de volta')"</automated>
  </verify>
  <acceptance_criteria>
    - Teste estrutural novo: rodada vermelha antes dos arquivos e agora 7/7 verdes; migracao-agenda2 verde com o inventário de 11 sem edição; estruturais 0049/0050/0051/0052 verdes sem edição.
    - A 0053 segue o "Contrato SQL" ao pé da letra (corpo = 0034 + R1..R8; data de reserva = cadastro; 6 colunas; sem comentário no corpo); cabeçalho ASCII num único bloco, sem linha de dois hífens, sem a cláusula de elevação e sem a palavra inglesa de função.
    - O arquivo de volta só remove a leitura, avisa NAO APLICAR e a ordem (tela primeiro, banco depois).
    - Desde a base 89a8707, supabase/migrations tem exatamente uma linha "A" (a 0053) e supabase/rollbacks exatamente uma (a volta da 0053); nenhuma migration antiga editada.
    - Teste ao vivo com os 10 casos, exatamente 2 logins, nada impresso, só fixtures, toda leitura filtrada por ids de fixture, conferência de resíduo no afterAll, sem citar a tabela de acesso diário; NÃO executado nesta tarefa (o vermelho antes da aplicação é esperado e não é medido).
    - tsc e eslint --max-warnings 0 limpos nos 2 arquivos de teste.
  </acceptance_criteria>
  <done>Mudança no banco escrita (não aplicada) com volta atrás pronta, prova estrutural verde e prova ao vivo pronta para ficar verde quando o dono aplicar a 0053.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Tarefa 2: Aprovação do dono — o que a aba Ganhos mostra, data "Ganho em", alerta de LGPD, ordem segura (banco PRIMEIRO) e como voltar atrás</name>
  <read_first>
    - supabase/migrations/0053_clientes_ganhos.sql (o que será aplicado)
    - supabase/rollbacks/0053_volta_clientes_ganhos.sql (o desfazer)
    - Seções "Pesquisa registrada" e escolhas P-01..P-10 deste plano
  </read_first>
  <action>Pausar a execução. Apresentar ao dono do projeto, em linguagem simples (ele não programa — CLAUDE.md), o texto dos blocos decision/context abaixo e só seguir depois de uma resposta explícita (per D-12). Não enviar arquivo para aplicação, não rodar db push, não colar SQL em lugar nenhum antes disso. Ao devolver este checkpoint ao orquestrador com a resposta "aplicar", dizer EXPLICITAMENTE que NADA deve ir para a branch staging nem para master antes de o dono aplicar a 0053 na Tarefa 5 (per D-07: a aba Ganhos publicada antes do banco mostraria só a mensagem de erro de carregamento). Caminhos do "ajustar": (a) mudança SÓ de tela (nome da aba, ícone, posição no menu, textos de lista vazia/erro, frase "Ganho em") — registrar o texto/escolha aprovado no SUMMARY e seguir; a tela ainda não foi feita, então o ajuste entra direto nas Tarefas 3 e 4 sem retrabalho (per P-09); (b) "usar a data da última atualização" no lugar da data de cadastro para os clientes sem registro de troca — a 0053 ainda NÃO está aplicada: editar as 3 ocorrências da expressão de data na própria 0053 e no bloco de comentário, trocar R2/R6/R7 e o caso sem-historico-usa-cadastro (que passa a esperar atualizado_em, com o nome do it ajustado) no teste estrutural e no ao vivo, rodar o verify da Tarefa 1 e registrar (per P-02); (c) qualquer mudança de regra (mostrar contato na lista, mostrar o nome do vendedor ao Vendedor, incluir encerrados, botão de ação na linha, exportar) — registrar e devolver ao orquestrador para replanejar, sem implementar. Em (a) e (b), a aprovação para aplicar continua valendo se dada junto; senão reapresentar só a pergunta de aplicar.</action>
  <decision>Aprovar a aba "Ganhos" como descrita e aplicar agora, no banco do sistema, a mudança 0053 (uma leitura nova, que só lê dados que já existem)?</decision>
  <context>
    **Leia primeiro: a mudança no banco vale na hora, para o banco do time inteiro.** O site de teste e o site que a equipe usa guardam os dados no MESMO banco. Desta vez a mudança só CRIA uma leitura nova, que o site de hoje não usa — aplicar não muda nada no que a equipe vê hoje.

    **O que muda (depois que a tela nova for publicada):**
    - Aparece no menu um item novo "Ganhos", com ícone de troféu, entre "Clientes" e "Perdidos". Ordem do menu: Agenda, Clientes, Ganhos, Perdidos, Encerrados, Dashboard. Sem número/contador no item (ganho não é pendência, mesma regra de Perdidos).
    - A tela Ganhos lista os clientes que estão como "ganho" hoje. Cada linha mostra: o nome do cliente (Nome Fantasia, ou a razão social quando não houver), "Ganho em dd/mm/aaaa" e — só para o Supervisor — o nome do vendedor responsável.
    - Tem a mesma busca por nome e o mesmo filtro de período de Perdidos: Tudo, Últimos 30 dias, Últimos 90 dias, Personalizado.
    - Clicar num cliente abre a MESMA ficha do funil, com contato, histórico e edição. Se alguém encerrar o cliente pela ficha, ele sai da lista na hora (vai para "Encerrados").
    - Não tem coluna de motivo nem botão "Reabrir": "desfazer um ganho" não é um caminho do negócio — a saída de um cliente ativo é "Encerrar", que já fica dentro da ficha.
    - Quem vê o quê: cada vendedor vê só os próprios clientes ganhos; o Supervisor vê todos. Essa regra é a do próprio banco, a mesma de sempre.
    - O que NÃO muda: Agenda, Clientes (funil), Perdidos, Encerrados, Dashboard e a ficha do cliente.

    **A data "Ganho em" — um detalhe para você confirmar:**
    - Normalmente é a data em que o cliente foi marcado como ganho (se foi encerrado e reativado depois, vale a data da reativação).
    - Os clientes que entraram pela planilha de "Clientes Ativos" já entraram como ganhos, sem esse registro. Para eles, mostramos a data em que foram cadastrados/importados.
    - **Atenção — efeito visível disso:** todos os clientes de uma mesma importação pela planilha de Clientes Ativos aparecem com a MESMA data "Ganho em" (o dia da importação), mesmo que na vida real tenham sido conquistados em datas diferentes. E, durante o mês seguinte a cada importação, todos eles aparecem juntos no filtro "Últimos 30 dias" (e em "Últimos 90 dias" pelos 90 dias seguintes) — então esses filtros podem mostrar muito mais clientes do que os ganhos de fato no período. O sistema não tem a data real do ganho desses clientes; a data de cadastro é a mais próxima que existe e não muda depois.
    - Por que não a data da "última atualização" (que é o que a tela Perdidos usa nesse caso raro): ela muda toda vez que alguém edita a ficha. Se alguém corrigisse o telefone de um cliente antigo, ele apareceria como "ganho hoje" e entraria no filtro "Últimos 30 dias". Se você preferir mesmo assim a última atualização, responda "ajustar: usar última atualização".

    **Alerta de conformidade (LGPD) — leia com atenção:**
    - A lista mostra nomes de clientes (empresas — mas Nome Fantasia/razão social de MEI ou empresa pequena podem identificar uma pessoa) e, para o Supervisor, quem ganhou cada cliente (dado de funcionário, ligado ao desempenho).
    - Nenhum dado novo é coletado: a tela só lê o que já existe no sistema.
    - Colunas mínimas: a lista NÃO mostra telefone, e-mail nem nome do contato. Esses dados continuam só dentro da ficha, que já existe e já tem as mesmas regras de acesso.
    - Cada vendedor vê só os próprios clientes; não há exportação nova nem número no menu.
    - Avalie o escopo à luz da LGPD; a decisão é sua, como responsável pelos dados.

    **Ordem segura que vamos seguir:**
    1. Eu termino a tela, ainda só no computador (sem publicar nada).
    2. Você cola e roda a mudança no banco (próxima etapa de ação). O site de hoje continua igual.
    3. Eu confiro com os testes automáticos contra o banco.
    4. Só então a tela nova vai para o site de teste (staging) para conferência, e depois para o site real.
    Por que nessa ordem: se a tela fosse publicada antes de o banco mudar, a aba Ganhos mostraria só "Não foi possível carregar os clientes ganhos".

    **Como voltar atrás, se precisar:** primeiro tirar a tela do ar (desfazer as mudanças de tela desta tarefa e publicar), e SÓ DEPOIS colar o arquivo `supabase/rollbacks/0053_volta_clientes_ganhos.sql` no SQL Editor — ele remove só a leitura nova. Nenhum dado é apagado.

    **Dados reais nos testes:** os testes automáticos rodam no mesmo banco dos dados reais. Eles criam vendedores e clientes temporários com nomes inventados, leem só esses clientes, apagam tudo no fim (e conferem que não sobrou nada) e nunca mostram dados reais. Eles não mexem na medição de uso do sistema (aderência).
  </context>
  <options>
    <option id="aplicar">
      <name>Aprovar e aplicar agora</name>
      <pros>Os clientes ganhos voltam a ter um lugar no menu e um caminho até a ficha; nenhum dado novo é coletado; quem vê o quê não muda; aplicar o banco antes não muda nada no site de hoje; existe volta atrás pronta e sem perda de dados.</pros>
      <cons>A lista expõe ao Supervisor quem ganhou cada cliente (dado de funcionário) — é o mesmo que já aparece em Perdidos e no Dashboard, mas pede cuidado na forma de usar.</cons>
    </option>
    <option id="ajustar">
      <name>Ajustar antes de aplicar</name>
      <pros>Permite mudar nome, ícone, posição no menu, textos, ou a regra da data "Ganho em" antes de tocar o banco.</pros>
      <cons>Mudança de regra além da data volta para replanejamento e pode atrasar a entrega desta semana.</cons>
    </option>
  </options>
  <acceptance_criteria>
    - O dono respondeu "aplicar" (ou aprovação explícita equivalente) antes de qualquer envio de arquivo para aplicação, db push ou execução no SQL Editor.
    - O SUMMARY registra a resposta e a ciência de: efeito imediato no banco único (só leitura nova), o que muda na tela e no menu, a regra da data "Ganho em" (P-02) — incluindo que os importados pela planilha de Clientes Ativos aparecem todos com a mesma data (dia da importação) e ficam juntos em "Últimos 30 dias" no mês seguinte a cada importação —, os pontos do alerta de LGPD (nomes de clientes; quem ganhou cada cliente só para o Supervisor; nenhum dado novo; colunas mínimas; contato só na ficha; cada vendedor só os próprios; sem exportação), a ordem segura com o banco PRIMEIRO e como voltar atrás (tela antes, banco depois, nada apagado).
    - O orquestrador foi avisado de que nada vai para staging/master antes da Tarefa 5; nenhum push pelo executor.
    - Se o dono escolheu "ajustar", o caminho (a), (b) ou (c) da action foi seguido antes de qualquer aplicação.
  </acceptance_criteria>
  <files>supabase/migrations/0053_clientes_ganhos.sql, supabase/rollbacks/0053_volta_clientes_ganhos.sql (só leitura — o que é apresentado ao dono; só mudam neste checkpoint no caminho (b) do "ajustar", junto com os testes da Tarefa 1)</files>
  <verify>
    <automated>npx vitest run tests/funil/ganhos-migracao.test.ts && git diff --quiet HEAD -- supabase/migrations/0053_clientes_ganhos.sql supabase/rollbacks/0053_volta_clientes_ganhos.sql && echo "OK arquivos apresentados = arquivos testados e commitados"</automated>
    <human-check>
      <test>Resposta explícita do dono ao texto deste checkpoint ("aplicar" ou "ajustar: ...").</test>
      <expected>"aplicar" (ou aprovação equivalente) registrado no SUMMARY com os itens reconhecidos.</expected>
      <why_human>Decisão do dono como responsável pelos dados (LGPD) e pela mudança no banco único.</why_human>
    </human-check>
  </verify>
  <resume-signal>Responda "aplicar" para aprovar a aba Ganhos e autorizar a 0053 no banco do sistema, ou "ajustar: ..." descrevendo o que mudar.</resume-signal>
  <done>Decisão explícita do dono registrada, com a regra da data, o alerta de LGPD, a ordem segura e a volta atrás reconhecidos, e o orquestrador ciente de que não publica nada antes da aplicação.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 3: Camada pura, leitor, Server Action, linha e filtro de período de Ganhos (irmãos de Perdidos, sem import cruzado; commits só locais)</name>
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
    - ganhos-lista: presets exatamente Tudo, Últimos 30 dias, Últimos 90 dias, Personalizado nessa ordem; padrão "tudo"; resolvePeriodoGanhos com agora fixo — tudo = nulos, 30dias/90dias = início agora menos N dias e fim nulo, personalizado = início do primeiro dia e meia-noite do dia seguinte ao último (fim exclusivo), personalizado sem intervalo = nulos; temRecortePeriodoGanhos (tudo falso; 30/90 verdadeiro; personalizado só com intervalo); validarPeriodoGanhos (nulos ok; {} ok normalizado; data inválida, início maior ou igual ao fim, null, número, texto e início numérico inválidos — mensagens iguais às de Perdidos); filtrarGanhosPorNome (vazio e só espaços devolvem tudo; encontra pelo nome exibido sem diferenciar maiúsculas — Nome Fantasia quando existe, razão social quando não existe; sem correspondência = vazio; não altera a lista de entrada).
    - ganhos-query (dublê de "@/lib/supabase/server", molde perdidos-query): leitor-rpc (rpc chamada 1 vez com "clientes_ganhos" e { p_inicio, p_fim }; orders ganho_em desc e cliente_id asc; primeiro recorte (0, 999)); leitor-mapeamento (snake_case -> camelCase, nulos preservados, exatamente as 6 chaves do tipo); leitor-paginado (1000 + 5 = 1005; segundo recorte (1000, 1999)); leitor-erro (rejeita); acao-sem-sessao (unauthenticated, rpc não chamada); acao-periodo-invalido (periodo_invalido, rpc não chamada); acao-ok (itens mapeados); acao-falha (fetch_falhou com a mensagem "Não foi possível carregar os clientes ganhos. Tente novamente.").
    - ganhos-item-row: titulo-fantasia (Nome Fantasia aparece e é o title); titulo-razao (sem Nome Fantasia mostra a razão social); titulo-sem-nome (os dois nulos mostram ROTULO_SEM_NOME); data (ganhoEm "2026-09-10T15:00:00.000Z" mostra "Ganho em 10/09/2026"); responsavel-oculto (showResponsavel falso não mostra o nome); responsavel-visivel; abrir-clique (existe um elemento com papel button e nome acessível "Abrir ficha de {nome}"; clique chama onAbrir 1 vez com o clienteId); abrir-teclado (Enter e espaço chamam onAbrir; outra tecla não); sem-acao-extra (exatamente um elemento com papel button — a própria linha; nenhum texto "Reabrir" nem "Motivo").
    - ganhos-periodo-filter (molde perdidos-periodo-filter): opcoes (as 4 opções na ordem); troca (escolher Últimos 90 dias chama onPresetChange("90dias") 1 vez); personalizado-rotulo (sem intervalo "Selecionar período"; com intervalo as datas dd/MM/yyyy).
  </behavior>
  <action>
0. Se o dono pediu na Tarefa 2 um ajuste SÓ de tela que toque estes arquivos (por exemplo a frase "Ganho em"), usar o texto aprovado nos testes e no código e registrar no SUMMARY (per P-09).
1. RED — criar os 4 arquivos de teste do behavior com exatamente esses nomes de it (molde: os testes de Perdidos correspondentes, trocando nomes; dados inventados; nenhum import de lib/perdidos, lib/encerrados, components/perdidos ou components/encerrados). Rodar e confirmar que FALHAM. Commit: `test(quick-261008-rxw): add failing tests for ganhos list layer, reader, action, row and period filter`.
2. GREEN (per D-02, D-03, P-05, P-07):
   - lib/ganhos/lista.ts: cópia estrutural de lib/perdidos/lista.ts com os nomes do contrato (seção Interfaces): tipo ClienteGanho com EXATAMENTE os 6 campos (sem motivo); JSDoc do tipo dizendo que espelha as 6 colunas de clientes_ganhos (0053) e que acrescentar qualquer meio de comunicação com a pessoa do cliente muda o escopo de dado pessoal da tela (LGPD) e precisa de aprovação do dono antes; presets, padrão, IntervaloGanhos, resolvePeriodoGanhos (mesma regra: janelas móveis sem limite superior; personalizado com fim exclusivo na meia-noite do dia seguinte), temRecortePeriodoGanhos, ValidacaoPeriodoGanhos/validarPeriodoGanhos (mesmas mensagens), filtrarGanhosPorNome via nomeExibicaoCliente. Sem import de Supabase nem de next/headers (importável por servidor e navegador). Cabeçalho: irmã deliberada de lib/perdidos/lista.ts, sem import cruzado.
   - lib/supabase/queries/ganhos.ts: cópia de queries/perdidos.ts — tipo de linha snake_case com as 6 colunas, mapRow, getClientesGanhos(intervalo) com buscarPaginado, rpc("clientes_ganhos", { p_inicio, p_fim }), order ganho_em desc, order cliente_id asc, range; rows nulas lançam "Falha ao carregar clientes ganhos: leitura paginada incompleta". JSDoc: a RLS dentro de clientes_ganhos é a única fronteira — nenhuma checagem de papel nem filtro de dono aqui.
   - app/actions/ganhos.ts ("use server"): cópia de app/actions/perdidos.ts — ClientesGanhosErrorCode, GetClientesGanhosResult, getClientesGanhosAction(intervalo): getUser (sem usuário: unauthenticated "Sessão expirada."), validarPeriodoGanhos (periodo_invalido), try/catch com fetch_falhou e a mensagem fixa do behavior. JSDoc: não existe ação de escrita neste arquivo (P-03) — a tela só lê; edição/encerramento acontecem pela ficha.
   - components/ganhos/GanhosItemRow.tsx ("use client"): props { cliente: ClienteGanho; showResponsavel: boolean; onAbrir: (clienteId: string) => void }. Card size sm clicável no molde de AgendaItemRow (role="button", tabIndex 0, onClick e onKeyDown com Enter/espaço chamando onAbrir com preventDefault, cursor-pointer e realce de hover), aria-label "Abrir ficha de {nome}"; CardTitle truncado com title = nome (nomeExibicaoCliente); CardContent com "Ganho em dd/MM/yyyy" (format + parseISO — nunca o construtor nativo de data a partir da string) e o nome do vendedor só quando showResponsavel e responsavelNome. Nenhum botão interno, nenhum motivo, nenhum dado de contato. JSDoc: per D-03/D-05/P-03/P-07.
   - components/ganhos/GanhosPeriodoFilter.tsx: cópia estrutural de PerdidosPeriodoFilter usando PERIODO_PRESETS_GANHOS/PeriodoPresetGanhos (per P-05).
   Rodar o verify até ficar verde. Commit: `feat(quick-261008-rxw): ganhos list layer, reader, action, row and period filter`. Linha de coautoria da D-11; nunca adicionar .planning/config.json.
3. Commits SÓ locais (per D-07, D-11): nada vai para staging/master antes da Tarefa 5.
  </action>
  <verify>
    <automated>npx vitest run tests/funil/ganhos-lista.test.ts tests/funil/ganhos-query.test.ts tests/funil/ganhos-item-row.test.tsx tests/funil/ganhos-periodo-filter.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 lib/ganhos/lista.ts lib/supabase/queries/ganhos.ts app/actions/ganhos.ts components/ganhos/GanhosItemRow.tsx components/ganhos/GanhosPeriodoFilter.tsx tests/funil/ganhos-lista.test.ts tests/funil/ganhos-query.test.ts tests/funil/ganhos-item-row.test.tsx tests/funil/ganhos-periodo-filter.test.tsx && node -e "const fs=require('fs');for(const f of ['lib/ganhos/lista.ts','lib/supabase/queries/ganhos.ts','app/actions/ganhos.ts','components/ganhos/GanhosItemRow.tsx','components/ganhos/GanhosPeriodoFilter.tsx']){const s=fs.readFileSync(f,'utf8');if(/@\/(lib|components|app\/actions)\/[A-Za-z\/]*(perdidos|encerrados)/i.test(s))throw new Error('import cruzado: '+f)}console.log('OK sem import cruzado')" && git diff --quiet 89a8707bd3e4ef581951d84f97906ca02e15b76e -- lib/perdidos lib/encerrados components/perdidos components/encerrados app/actions/perdidos.ts app/actions/encerrados.ts lib/supabase/queries/perdidos.ts lib/supabase/queries/encerrados.ts && echo "OK Perdidos e Encerrados intocados"</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada e agora os 4 arquivos de teste verdes.
    - ClienteGanho com exatamente 6 campos (sem motivo, sem contato); leitura pela RPC clientes_ganhos, paginada, ordem ganho_em desc + cliente_id asc.
    - Linha abre por clique, Enter e espaço; rótulo "Abrir ficha de {nome}"; "Ganho em dd/MM/yyyy"; vendedor só com showResponsavel; nenhum botão interno.
    - Nenhum import de módulos de Perdidos/Encerrados nos arquivos novos; Perdidos e Encerrados idênticos à base.
    - tsc e eslint --max-warnings 0 limpos nos 9 arquivos; nenhum push.
  </acceptance_criteria>
  <done>Toda a parte de dados e as peças visuais da linha e do período existem e estão provadas por testes, ainda só no computador.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 4: Tela Ganhos que abre a ficha do cliente + rota /ganhos + item "Ganhos" no menu (testes do menu atualizados de propósito; commits só locais)</name>
  <files>components/ganhos/GanhosList.tsx, app/(app)/ganhos/page.tsx, components/layout/AppSidebar.tsx, tests/funil/ganhos-list.test.tsx, tests/funil/app-sidebar-ganhos.test.tsx, tests/funil/app-sidebar-perdidos.test.tsx, tests/funil/app-sidebar-encerrados.test.tsx, tests/agenda2/app-sidebar-agenda2.test.tsx</files>
  <read_first>
    - Resposta do dono no checkpoint da Tarefa 2 (ajuste de nome/ícone/posição/textos entra aqui)
    - components/perdidos/PerdidosList.tsx e app/(app)/perdidos/page.tsx (arquivos inteiros — molde da tela e da rota)
    - app/(app)/agenda/page.tsx (arquivo inteiro — catálogos da ficha)
    - components/agenda/AgendaList.tsx linhas 100-135, 180-190 e 425-455 (estado da ficha e montagem única com recarga)
    - components/clientes/ClienteDetailSheet.tsx linhas 214-245 (props — só leitura, este arquivo NÃO muda)
    - components/layout/AppSidebar.tsx (arquivo inteiro)
    - tests/funil/perdidos-list.test.tsx, tests/funil/app-sidebar-encerrados.test.tsx (moldes), tests/clientes/kanban-card-filtrado.test.tsx linhas 15-30 (dublê da ficha)
    - tests/funil/app-sidebar-perdidos.test.tsx linhas 60-90 e tests/agenda2/app-sidebar-agenda2.test.tsx linhas 55-85 (casos de ordem a atualizar)
  </read_first>
  <behavior>
    - ganhos-list (dublês: "@/app/actions/ganhos" e "@/components/clientes/ClienteDetailSheet" — o dublê guarda as props recebidas e, quando open, renderiza um marcador com o clienteId e três botões que chamam onStatusChanged("encerrado"), onSaved com valores vazios e onDeleted com o clienteId): carga-inicial (1 leitura com { inicio: null, fim: null }); vendedor-nome (isSupervisor verdadeiro mostra o nome do vendedor); vendedor-nome-oculto (falso não mostra); abrir-ficha (clicar na linha "Abrir ficha de Padaria Central Ltda" faz o dublê receber clienteId "c1" e open verdadeiro, isSupervisor e os 3 catálogos passados à tela, e currentUserId indefinido — per P-08); ficha-encerrar-recarrega (onStatusChanged dispara a 2ª leitura; com a 2ª resposta vazia a linha some); ficha-salvar-apagar-recarrega (onSaved e onDeleted disparam uma leitura cada — 3 no total); sem-reabrir (nenhum botão com nome contendo "Reabrir"); vazio ("Nenhum cliente ganho" + "Quando um cliente for marcado como ganho, ele aparece aqui."); vazio-periodo (escolher Últimos 30 dias dispara leitura com inicio preenchido; vazio mostra "Nenhum cliente ganho nesse período"); busca (filtra sem nova leitura; sem resultado "Nenhum cliente ganho com esse nome"); busca-limpa (trocar o período limpa a busca); erro-carga ("Não foi possível carregar os clientes ganhos. Tente novamente." + "Tentar novamente" refaz a leitura).
    - app-sidebar-ganhos (molde app-sidebar-encerrados): vendedor (link "Ganhos" com href /ganhos); supervisor (também tem); ordem (para Vendedor e para Supervisor, filtrando por /agenda, /agenda-2, /clientes, /ganhos, /perdidos, /encerrados, /dashboard, a ordem é /agenda-2, /clientes, /ganhos, /perdidos, /encerrados, /dashboard); icone-trofeu (o link Ganhos contém um svg com a classe lucide-trophy e o link Perdidos não contém); sem-contador (com contagem 5 na Agenda só existe 1 selo e o link Ganhos não tem "Ganhos ("); recolhido-sem-contador (exatamente uma bolinha e o link /ganhos existe); ativo (rota /ganhos deixa o link com bg-slate-700).
    - Atualizados DE PROPÓSITO (per P-10): app-sidebar-perdidos "ordem", app-sidebar-encerrados "ordem" e app-sidebar-agenda2 "ordem-d15" passam a incluir /ganhos na lista filtrada e na ordem esperada (entre /clientes e /perdidos), com o texto do it atualizado e um comentário de uma linha "Quick 261008-rxw: Ganhos entra entre Clientes e Perdidos". Nenhum outro caso desses arquivos muda.
    - Continuam verdes SEM edição: tests/agenda/app-sidebar-agenda.test.tsx, tests/importacao/AppSidebar.test.tsx, tests/layout/app-sidebar-visual.test.tsx, tests/agenda2/app-layout-contagem.test.tsx, tests/funil/ganhos-item-row.test.tsx.
  </behavior>
  <action>
0. Se o dono pediu na Tarefa 2 ajuste de nome da aba, ícone, posição no menu ou textos, usar a escolha aprovada nos testes e no código e registrar no SUMMARY (per P-09).
1. RED — criar tests/funil/ganhos-list.test.tsx e tests/funil/app-sidebar-ganhos.test.tsx e atualizar os 3 casos de ordem como no behavior (nomes de it exatamente os do behavior; dados inventados; o dublê da ficha declarado com vi.mock no topo, estado compartilhado via vi.hoisted). Rodar e confirmar que FALHAM. Commit: `test(quick-261008-rxw): add failing tests for ganhos screen and menu item`.
2. GREEN:
   - components/ganhos/GanhosList.tsx ("use client", per D-02, D-03, D-05, P-03, P-08): cópia estrutural de PerdidosList SEM nada de reabrir (sem marcarStatus, sem estado de reabrindo/erro de reabrir); props { isSupervisor: boolean; categoriaOptions, produtoOptions, vendedorOptions: { id: string; nome: string }[] }; título "Ganhos"; mesma barra (busca "Buscar por nome..." com aria-label "Buscar por nome" + GanhosPeriodoFilter); mesma máquina de carga (FetchState, intervalo em useMemo, efeito com cancelled e reloadKey, com os mesmos dois comentários de eslint-disable já usados em PerdidosList); textos do behavior; lista de GanhosItemRow com showResponsavel = isSupervisor e onAbrir = handleAbrirFicha (define selectedClienteId e sheetOpen como handleOpenCliente da Agenda). Montar UMA ClienteDetailSheet no fim com clienteId, open, onOpenChange, isSupervisor, os 3 catálogos e onSaved/onDeleted/onStatusChanged = handleRecarregar, SEM currentUserId (per P-08). JSDoc: tela irmã de Perdidos (D-02), sem ação na linha (P-03), a ficha é a mesma do funil (D-05), recarga por reloadKey; LGPD: a lista só mostra nome, data e (Supervisor) vendedor — contato só na ficha (D-03).
   - app/(app)/ganhos/page.tsx (Server Component, per D-05, D-08, P-06): molde de app/(app)/agenda/page.tsx — getUser (sem usuário: redirect("/login")), role -> isSupervisor, Promise.all de getCategoriasAtivas e getProdutosAtivos, vendedorOptions de profiles (id, nome, sobrenome, ordenado por nome, nome = nome + espaço + sobrenome) só para o Supervisor; renderiza div "flex flex-1 flex-col p-6" com GanhosList. JSDoc: rota protegida dentro de (app) como /perdidos; a RLS de clientes_ganhos decide as linhas e isSupervisor só escolhe mostrar o nome do vendedor; os catálogos existem porque esta tela ABRE a ficha (diferente de /perdidos).
   - components/layout/AppSidebar.tsx (per D-08, P-04): importar Trophy de lucide-react (ordem alfabética do import) e inserir em PRINCIPAL_SECTION, entre /clientes e /perdidos, o link /ganhos rotulado "Ganhos" com ícone Trophy, com comentário curto: tela irmã de Perdidos (quick 261008-rxw); sem contador (ganho não é pendência, mesmo raciocínio de Perdidos); Trophy distinto de Archive (Perdidos), PauseCircle (Encerrados) e BadgeCheck (Importar Clientes Ativos). Atualizar o parágrafo de ordem do JSDoc acima de PRINCIPAL_SECTION com uma frase: desde a quick 261008-rxw a ordem VISÍVEL é Agenda (/agenda-2), Clientes, Ganhos, Perdidos, Encerrados, Dashboard. Nada mais muda no componente (flag da Agenda antiga, contagens, estilos e Administração iguais).
   NÃO tocar em components/clientes (a ficha), components/perdidos, components/encerrados, components/agenda, components/agenda2, nas páginas de agenda/agenda-2/clientes/perdidos/encerrados nem no layout do grupo (app); se algum teste ou o tsc exigir mudança neles, PARAR e reportar. Rodar o verify até ficar verde. Commit: `feat(quick-261008-rxw): ganhos screen opening the client ficha and Ganhos menu item`. Linha de coautoria da D-11; nunca adicionar .planning/config.json.
3. Commits SÓ locais (per D-07): a Tarefa 5 confere, imediatamente antes da aplicação, que nenhum commit feat desta quick está em origin/staging ou origin/master; quem publica é o orquestrador, só depois da Tarefa 6.
  </action>
  <verify>
    <automated>npx vitest run tests/funil/ganhos-list.test.tsx tests/funil/app-sidebar-ganhos.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx tests/agenda/app-sidebar-agenda.test.tsx tests/importacao/AppSidebar.test.tsx tests/layout/app-sidebar-visual.test.tsx tests/agenda2/app-layout-contagem.test.tsx tests/funil/ganhos-item-row.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 components/ganhos/GanhosList.tsx "app/(app)/ganhos/page.tsx" components/layout/AppSidebar.tsx tests/funil/ganhos-list.test.tsx tests/funil/app-sidebar-ganhos.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx && git diff --quiet 89a8707bd3e4ef581951d84f97906ca02e15b76e -- components/clientes components/perdidos components/encerrados components/agenda components/agenda2 "app/(app)/agenda" "app/(app)/agenda-2" "app/(app)/clientes" "app/(app)/perdidos" "app/(app)/encerrados" "app/(app)/layout.tsx" app/actions/funil.ts app/actions/clientes.ts && echo "OK ficha, Agenda, Clientes, Perdidos e Encerrados intocados"</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada e agora tudo verde, incluindo os 4 testes do menu que não foram editados.
    - A tela Ganhos lista, busca, filtra por período, mostra o vendedor só para o Supervisor e abre a ficha pela linha; salvar/apagar/encerrar pela ficha recarrega; não há Reabrir.
    - /ganhos existe dentro de (app) com redirect para /login sem sessão e com os catálogos da ficha.
    - Menu com Ganhos (Trophy, sem contador) entre Clientes e Perdidos; os 3 casos de ordem atualizados de propósito com comentário.
    - ClienteDetailSheet, Agenda, Clientes, Perdidos, Encerrados e o layout do grupo idênticos à base.
    - tsc e eslint --max-warnings 0 limpos nos 8 arquivos; nenhum push.
  </acceptance_criteria>
  <done>A aba Ganhos existe no menu e funciona ponta a ponta no computador (com dublês), abrindo a mesma ficha do funil — pronta para ir ao staging depois que o dono aplicar a 0053.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Tarefa 5: [BLOCKING] Dono aplica a 0053 pelo SQL Editor da Supabase (ANTES de qualquer publicação da tela)</name>
  <read_first>
    - .planning/STATE.md, seção Blockers/Concerns (o push de schema pelo executor não é usado; aplicação manual pelo dono, mesmo caminho das Fases 27-33 e das quick 261006-gvo/261006-ncy/261008-mrf)
  </read_first>
  <action>Pré-condição da ordem segura (per D-07, D-12, P-09), conferida IMEDIATAMENTE antes de enviar o arquivo ao dono: rodar o comando automatizado do verify, que faz git fetch origin e confere que nenhum commit feat desta quick task é ancestral de origin/staging nem de origin/master. O executor nunca faz push; quem publica é o orquestrador, só depois da Tarefa 6. Se algum estiver publicado, avisar o orquestrador e o dono na hora, em linguagem simples, que a aba Ganhos daquele site mostra só a mensagem de erro de carregamento até a 0053 ser aplicada, e seguir com a aplicação (ela é a correção). Enviar ao dono o arquivo supabase/migrations/0053_clientes_ganhos.sql pela ferramenta de envio de arquivo ao usuário; se a ferramenta não estiver disponível, informar o caminho absoluto do arquivo. NÃO enviar o arquivo de volta para aplicação. Não tentar db push nem qualquer contorno (nada de gerar credencial, extrair token ou chamar API de gerenciamento) — per D-12. Passar ao dono as instruções do bloco how-to-verify e aguardar a confirmação.</action>
  <what-built>Um arquivo de mudança no banco (0053), aprovado na Tarefa 2, pronto para colar no SQL Editor. A tela Ganhos e o item de menu estão só no computador (commits locais), sem afetar nenhum site.</what-built>
  <how-to-verify>
    1. Abrir o SQL Editor do projeto: https://supabase.com/dashboard/project/afbiwgbqkogsrhxjshkk/sql/new
    2. Colar o conteúdo COMPLETO de `0053_clientes_ganhos.sql` (o comentário do topo pode ir junto, é seguro), clicar em "Run" e esperar "Success. No rows returned".
    3. Se aparecer qualquer erro, copiar a mensagem e mandar aqui antes de tentar de novo.
    4. NÃO colar o arquivo `0053_volta_clientes_ganhos.sql` — ele só serve se um dia você quiser desfazer.
    5. (Opcional) O site atual continua exatamente igual — ainda não existe a aba Ganhos nele; ela aparece só depois da publicação.
  </how-to-verify>
  <files>supabase/migrations/0053_clientes_ganhos.sql (só leitura — enviado ao dono para colar no SQL Editor; nenhum arquivo do projeto muda neste checkpoint)</files>
  <verify>
    <automated>git fetch origin && HS=$(git log --format=%H -F --grep="feat(quick-261008-rxw)" 89a8707bd3e4ef581951d84f97906ca02e15b76e..HEAD) && test -n "$HS" && for H in $HS; do if git merge-base --is-ancestor "$H" origin/staging || git merge-base --is-ancestor "$H" origin/master; then echo "PUBLICADO $H"; exit 1; fi; done && echo "OK tela ainda nao publicada (pre-condicao da ordem segura)"</automated>
    <human-check>
      <test>O dono cola a 0053 no SQL Editor e informa o resultado.</test>
      <expected>"Success. No rows returned" confirmado pelo dono ("aplicado"); o arquivo de volta não foi colado.</expected>
      <why_human>O executor nunca aplica SQL no banco de produção (D-12); só o dono aplica, pelo SQL Editor.</why_human>
    </human-check>
  </verify>
  <resume-signal>Responda "aplicado" depois de ver "Success", ou cole a mensagem de erro.</resume-signal>
  <acceptance_criteria>
    - A pré-condição foi conferida imediatamente antes de enviar o arquivo (nenhum commit feat desta quick em origin/staging nem em origin/master), ou o aviso foi dado; o executor não fez push.
    - O dono confirmou "Success" na 0053 (registrado no SUMMARY, com o caminho: SQL Editor, pelo dono); o arquivo de volta não foi aplicado.
    - Nenhuma tentativa de db push ou contorno pelo executor.
    - O SUMMARY sugere ao dono, como passo opcional, `supabase migration repair --status applied 0053` (a 0053 é re-executável — só cria/recria a leitura — então um push futuro não quebra mesmo sem o repair).
  </acceptance_criteria>
  <done>A 0053 está aplicada no banco, confirmada pelo dono, antes de qualquer publicação da tela.</done>
</task>

<task type="auto">
  <name>Tarefa 6: [BLOCKING] Testes ao vivo a VERDE contra o banco real + gate final + guarda de escopo + SUMMARY</name>
  <files>tests/funil/ganhos-rpc.test.ts (só se precisar de correção do próprio teste)</files>
  <read_first>
    - tests/funil/ganhos-rpc.test.ts
    - supabase/migrations/0053_clientes_ganhos.sql (aplicada)
    - .planning/STATE.md, Blockers/Concerns (limite de tentativas de login do Supabase Auth; ~49 arquivos vermelhos pré-existentes por contas semente apagadas — NÃO rodar a suíte inteira)
  </read_first>
  <action>
1. Rodar a guarda de escopo (primeiro comando do verify, base 89a8707bd3e4ef581951d84f97906ca02e15b76e, per D-10) e depois, isolado, `npx vitest run tests/funil/ganhos-rpc.test.ts` até ficar verde. Se um caso falhar por comportamento do banco (por exemplo, Vendedor recebendo cliente de outro, data do ganho errada, encerrado aparecendo, coluna a mais), PARAR e reportar ao orquestrador: a correção vira migration NOVA (0054 em diante) com nova aprovação do dono pelo mesmo caminho das Tarefas 2 e 5 — nunca edição da 0053 aplicada nem do arquivo de volta, e nunca uma função com privilégio elevado. Se falhar por erro do próprio teste (por exemplo, constraint de fixture, CNPJ repetido), corrigir o teste sem afrouxar nenhuma asserção de D-02/D-03/D-06/P-02 nem os filtros de ids, e registrar. Se o afterAll acusar resíduo, conferir pelo cliente de serviço (sem imprimir linhas) e apagar só os ids de fixture, registrando. Se o limite de login impedir a rodada, esperar e repetir o arquivo isolado (convenção das Fases 13/18/19), registrando. Nunca imprimir linhas lidas durante o diagnóstico (dados reais, LGPD).
2. Rodar o verify completo (ao vivo de novo, isolado, mais estruturais, camada pura, leitor/ação, linha, período, tela, menu, tsc, eslint e build).
3. Registrar no SUMMARY, em português simples: (a) resposta do dono e tudo o que ele reconheceu na Tarefa 2 (incluindo ajuste, se houve, e onde entrou); (b) pré-condição conferida imediatamente antes da aplicação e aplicação pelo dono (Tarefa 5); (c) resultado do teste ao vivo (10 casos) e do gate (arquivos/testes, tsc, eslint, BUILD_EXIT); dizer que o VERMELHO antes da aplicação era esperado e NÃO foi medido; (d) o que a aba Ganhos mostra, em linguagem de tela (menu, colunas, período, busca, ficha pela linha, encerrar tira da lista, sem Reabrir) e a regra da data "Ganho em" (P-02, com o motivo do desvio em relação à 0034); (e) alerta de LGPD (nomes de clientes; quem ganhou cada cliente só para o Supervisor; nenhum dado novo; colunas mínimas; contato só na ficha; cada vendedor só os próprios; sem exportação; inventário de 11 funções elevadas intacto); (f) testes do menu mudados DE PROPÓSITO e por quê (P-10); (g) prova estrutural de que a autorização é a mesma da 0034 (corpo = 0034 + 8 trocas), em palavras simples; (h) conferência só de leitura OPCIONAL para o dono no SQL Editor: `select count(*) from clientes_ganhos();` devolve só um número (quantos clientes ganhos existem hoje — no SQL Editor a conta vê todos), sem nenhum dado pessoal; (i) itens adiados: passo opcional `supabase migration repair --status applied 0053`; (j) conferência humana do Preview da staging pendente (bloco human-check) e instrução ao orquestrador: AGORA (banco aplicado + gate verde) enviar os commits para staging, conferir o Preview e só depois levar para master; (k) como voltar atrás: primeiro reverter os commits feat das Tarefas 3 e 4 e publicar; só depois colar supabase/rollbacks/0053_volta_clientes_ganhos.sql (nada é apagado); (l) linha de coautoria usada nos commits: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" (D-11); (m) nota de segurança (P-11): a leitura clientes_ganhos devolve responsavel_nome para QUALQUER chamador; o Vendedor só recebe as próprias linhas pela RLS (portanto só o próprio nome), e esconder o nome do vendedor de quem não é Supervisor é só da TELA, não uma regra de segurança. Junto, a ciência do dono (Tarefa 2) de que os clientes importados pela planilha de Clientes Ativos aparecem todos com a mesma data "Ganho em" (dia da importação) e ficam juntos em "Últimos 30 dias" no mês seguinte a cada importação.
Commit `test(quick-261008-rxw): ...` só se algum teste ao vivo precisou de correção (com a linha de coautoria, sem .planning/config.json); caso contrário, nenhum commit de código nesta tarefa. Não fazer push.
  </action>
  <verify>
    <automated>node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString();const base='89a8707bd3e4ef581951d84f97906ca02e15b76e';console.log('BASE='+g(['rev-parse',base]).trim());const ok=new Set(['supabase/migrations/0053_clientes_ganhos.sql','supabase/rollbacks/0053_volta_clientes_ganhos.sql','tests/funil/ganhos-migracao.test.ts','tests/funil/ganhos-rpc.test.ts','lib/ganhos/lista.ts','lib/supabase/queries/ganhos.ts','app/actions/ganhos.ts','components/ganhos/GanhosItemRow.tsx','components/ganhos/GanhosPeriodoFilter.tsx','components/ganhos/GanhosList.tsx','app/(app)/ganhos/page.tsx','components/layout/AppSidebar.tsx','tests/funil/ganhos-lista.test.ts','tests/funil/ganhos-query.test.ts','tests/funil/ganhos-item-row.test.tsx','tests/funil/ganhos-periodo-filter.test.tsx','tests/funil/ganhos-list.test.tsx','tests/funil/app-sidebar-ganhos.test.tsx','tests/funil/app-sidebar-perdidos.test.tsx','tests/funil/app-sidebar-encerrados.test.tsx','tests/agenda2/app-sidebar-agenda2.test.tsx']);const permitido=f=>f.startsWith('.planning/')||ok.has(f);const mudados=g(['diff','--name-only',base,'HEAD']).split('\n').map(s=>s.trim()).filter(Boolean);const sujos=g(['status','--porcelain']).split('\n').filter(Boolean).filter(l=>!l.startsWith('??')).map(l=>l.slice(3).trim());const fora=mudados.concat(sujos).filter(f=>!permitido(f));if(fora.length)throw new Error('fora do escopo: '+fora.join(', '));const mig=g(['diff','--name-status',base,'HEAD','--','supabase/migrations']).split('\n').map(s=>s.trim()).filter(Boolean);if(mig.length!==1||mig[0]!=='A\tsupabase/migrations/0053_clientes_ganhos.sql')throw new Error('migrations: '+mig.join(' | '));const rb=g(['diff','--name-status',base,'HEAD','--','supabase/rollbacks']).split('\n').map(s=>s.trim()).filter(Boolean);if(rb.length!==1||rb[0]!=='A\tsupabase/rollbacks/0053_volta_clientes_ganhos.sql')throw new Error('rollbacks: '+rb.join(' | '));console.log('OK escopo 261008-rxw')" && npx vitest run tests/funil/ganhos-rpc.test.ts && npx vitest run tests/funil/ganhos-migracao.test.ts tests/funil/ganhos-lista.test.ts tests/funil/ganhos-query.test.ts tests/funil/ganhos-item-row.test.tsx tests/funil/ganhos-periodo-filter.test.tsx tests/funil/ganhos-list.test.tsx tests/funil/app-sidebar-ganhos.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx tests/agenda/app-sidebar-agenda.test.tsx tests/importacao/AppSidebar.test.tsx tests/layout/app-sidebar-visual.test.tsx tests/agenda2/app-layout-contagem.test.tsx tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts tests/dashboard/aderencia-parcial-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 lib/ganhos/lista.ts lib/supabase/queries/ganhos.ts app/actions/ganhos.ts components/ganhos/GanhosItemRow.tsx components/ganhos/GanhosPeriodoFilter.tsx components/ganhos/GanhosList.tsx "app/(app)/ganhos/page.tsx" components/layout/AppSidebar.tsx tests/funil/ganhos-migracao.test.ts tests/funil/ganhos-rpc.test.ts tests/funil/ganhos-lista.test.ts tests/funil/ganhos-query.test.ts tests/funil/ganhos-item-row.test.tsx tests/funil/ganhos-periodo-filter.test.tsx tests/funil/ganhos-list.test.tsx tests/funil/app-sidebar-ganhos.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx && (npm run build; code=$?; echo "BUILD_EXIT=$code"; exit $code)</automated>
    <human-check>
      <test>Depois que o orquestrador enviar os commits para a branch staging, abrir o link de Preview da staging na Vercel (projeto RAIAR; exige login na Vercel): (1) entrar como Supervisor — o menu mostra "Ganhos" (troféu) entre Clientes e Perdidos; a tela lista clientes ganhos com "Ganho em dd/mm/aaaa" e o nome do vendedor; trocar o período para "Últimos 30 dias" e usar a busca por nome; (2) clicar num cliente — abre a mesma ficha do funil, com contato e histórico; fechar sem editar; (3) entrar como um vendedor — a aba mostra só os clientes dele e não mostra nome de vendedor; (4) conferir que Agenda, Clientes, Perdidos, Encerrados e Dashboard estão iguais aos do site real. Não editar nem encerrar cliente real só para testar. Não fotografar nem compartilhar a tela fora da empresa (nomes de clientes e de vendedores).</test>
      <expected>Aba Ganhos no lugar certo, lista com nome/data/(vendedor só para o Supervisor), período e busca funcionando, ficha abrindo pela linha, vendedor vendo só os próprios clientes, resto do site igual.</expected>
      <why_human>Conferência visual no site publicado de teste antes de levar para produção (CLAUDE.md, Fluxo de Deploy); os testes automáticos não abrem o Preview da Vercel.</why_human>
    </human-check>
  </verify>
  <acceptance_criteria>
    - tests/funil/ganhos-rpc.test.ts verde por inteiro (10 casos) contra o banco real, sem resíduo acusado no afterAll.
    - Gate verde: estruturais (0053 + inventário + 0049/0050/0051/0052), camada pura, leitor/ação, linha, período, tela, menu (os 4 não editados inclusive); tsc; eslint --max-warnings 0 nos 19 arquivos de código/teste tocados; BUILD_EXIT=0 impresso.
    - Guarda de escopo OK desde 89a8707: só os 21 arquivos planejados (mais .planning/); supabase/migrations com exatamente uma linha "A" (a 0053); supabase/rollbacks com exatamente uma linha "A" (a volta da 0053); ficha, Agenda, Clientes, Perdidos, Encerrados e Dashboard intocados.
    - Nenhuma asserção de D-02/D-03/D-06/P-02 afrouxada; qualquer correção de teste ou migration nova registrada no SUMMARY.
    - SUMMARY com os itens (a)-(m) da action; nenhum push pelo executor.
  </acceptance_criteria>
  <done>A leitura de ganhos está no banco e provada contra ele, a aba Ganhos está pronta (commits locais) para ir ao staging, e o pacote inteiro está dentro do escopo combinado.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador (Vendedor/Supervisor/visitante) -> Server Action -> PostgREST -> clientes_ganhos() | Período vindo do navegador (não confiável); a função roda como quem chama e só a RLS decide as linhas |
| navegador -> ClienteDetailSheet -> ações de cliente existentes | Ficha existente, agora alcançável pela aba Ganhos; leitura/edição/apagar/encerrar seguem as RLS e ações de hoje |
| executor/dono -> banco de produção | Função nova com efeito imediato no banco único; só com aprovação explícita e aplicação pelo dono |
| commits locais -> branch staging -> branch master | Tela nova chama a RPC nova; publicar antes da 0053 deixa a aba só com a mensagem de erro; Preview usa o mesmo banco da produção |
| dono (controlador) -> clientes e vendedores (titulares) | Lista de nomes de clientes e de quem ganhou cada um |
| suíte de testes -> banco de produção | Fixtures temporárias no projeto que guarda dados reais |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-rxw-01 | Information Disclosure | Vendedor lendo clientes ganhos de colegas via clientes_ganhos | high | mitigate | Função sem elevação e sem checagem de papel (RLS de clientes/historico/profiles é a fronteira); estrutural corpo-0034-com-trocas e sem-elevacao-sem-escrita; casos ao vivo rls-vendedor, rls-supervisor e anonimo-sem-dados |
| T-rxw-02 | Elevation of Privilege | função criada com privilégio elevado ou permissão nova | high | mitigate | Estrutural sem cláusula de elevação, sem grant/revoke; inventário de 11 em migracao-agenda2 sem edição; guarda de escopo exige só a linha "A" da 0053 |
| T-rxw-03 | Information Disclosure (LGPD) | dado de contato vazando na lista | medium | mitigate | 6 colunas fixas (estrutural colunas-minimas-lgpd, ao vivo colunas-lgpd, leitor-mapeamento com exatamente 6 chaves); tipo ClienteGanho com aviso de LGPD no JSDoc; linha sem contato (ganhos-item-row) |
| T-rxw-04 | Tampering (disponibilidade da tela) | tela publicada antes da 0053 | medium | mitigate | D-07/P-09: commits das Tarefas 3-4 só locais; checkpoint da Tarefa 2 avisa o orquestrador; pré-condição automatizada da Tarefa 5 confere que nenhum commit feat desta quick está em origin/staging ou origin/master; publicação só depois da Tarefa 6; volta atrás na ordem inversa documentada |
| T-rxw-05 | Tampering | período malformado vindo do navegador | low | mitigate | validarPeriodoGanhos antes de chamar o banco (acao-periodo-invalido); parâmetros enviados pelo PostgREST como valores, nunca concatenados em SQL |
| T-rxw-06 | Spoofing | chamada da Server Action ou da rota sem sessão | medium | mitigate | getUser na ação (acao-sem-sessao: unauthenticated, RPC não chamada); página com redirect para /login dentro do grupo (app) |
| T-rxw-07 | Information Disclosure (LGPD) | ficha com contato agora alcançável pela aba Ganhos | low | accept | É a ficha existente, carregada pelas ações e RLS de hoje (Vendedor só abre os próprios clientes); nenhuma exposição nova além do caminho de navegação; dono informado no alerta da Tarefa 2 |
| T-rxw-08 | Tampering | apagar cliente ganho pela ficha | low | mitigate | P-08: currentUserId não é passado (Vendedor nunca vê o botão); a RLS de apagar da 0050 continua a fronteira; Supervisor com o comportamento de hoje |
| T-rxw-09 | Tampering | aplicação em produção sem revisão | high | mitigate | Checkpoint bloqueante da Tarefa 2 antes de qualquer envio; dono aplica pelo SQL Editor; executor nunca aplica, nunca faz push nem db push |
| T-rxw-10 | Denial of Service | comentário de dois hífens ou caractere não ASCII quebrando a colagem no SQL Editor | low | mitigate | Estrutural comentarios-seguros e volta-remove-so-a-leitura (ASCII puro, nenhuma linha de dois hífens, 2 cifrões duplos) |
| T-rxw-11 | Information Disclosure (LGPD) | testes ao vivo no banco real | medium | mitigate | Fixtures descartáveis com nomes inventados, 2 logins, toda leitura filtrada por ids de fixture no PostgREST, nada impresso, status trocado pelo serviço (autor nulo, sem efeito na aderência), sem tocar a tabela de acesso diário, conferência de resíduo no afterAll |
| T-rxw-12 | Tampering | edição de migration antiga ou corpo divergente da 0034 fora das trocas | medium | mitigate | Estrutural corpo-0034-com-trocas; guarda de escopo (uma migration nova, nenhuma antiga alterada) |
| T-rxw-13 | Denial of Service | lista crescente (toda a carteira ativa) | low | accept | Leitura paginada (buscarPaginado) com 6 colunas e ordem estável; volume de centenas a poucos milhares de linhas no free tier |
</threat_model>

<source_audit>
SOURCE  | ID   | Item | Tarefa | Status
------- | ---- | ---- | ------ | ------
GOAL    | —    | Aba Ganhos no menu listando clientes ganhos, com caminho até a ficha | 1, 3, 4, 5, 6 | COVERED
REQ     | QUICK-261008-rxw | Pedido do dono de 2026-10-08 | 1-6 | COVERED
CONTEXT | D-01 | Nova aba Ganhos perto de Perdidos, status ganho atual | 1 (where status = ganho), 4 (menu e tela) | COVERED
CONTEXT | D-02 | Nome exibido, data do ganho do histórico com reserva, vendedor só Supervisor, RLS decide, período e busca iguais | 1 (0053, data-do-ganho, ultimo-ganho, sem-historico-usa-cadastro, rls), 3 (camada pura, linha, período), 4 (tela) | COVERED
CONTEXT | D-03 | Sem motivo, sem contato na lista | 1 (colunas-minimas-lgpd, colunas-lgpd), 3 (tipo e linha), 4 (tela) | COVERED
CONTEXT | D-04 | Sem Reabrir salvo justificativa | P-03; 3 (sem-acao-extra), 4 (sem-reabrir) | COVERED
CONTEXT | D-05 | Linha abre a mesma ClienteDetailSheet; catálogos pela página de servidor; sem duplicar a ficha | 3 (linha clicável), 4 (GanhosList + page; ficha intocada) | COVERED
CONTEXT | D-06 | RPC clientes_ganhos na 0053, estilo 0034, sem elevação, sem checagem de papel, 6 colunas, ASCII em bloco, volta atrás NAO APLICAR, inventário intacto | 1, 2, 5 | COVERED
CONTEXT | D-07 | Banco PRIMEIRO, depois a tela; nada publicado antes | 2, 3, 4, 5 (pré-condição), 6 | COVERED
CONTEXT | D-08 | Item Ganhos no menu, ordem deliberada, ícone distinto, testes do menu atualizados, rota protegida, resto intocado | 4, 6 (guarda) | COVERED
CONTEXT | D-09 | Estrutural, camada pura, ação, tela, menu, ao vivo (2 logins, nomes inventados, nada impresso, sem acesso diário, sem resíduo, vermelhos até aplicar, não executados no build) | 1, 3, 4, 6 | COVERED
CONTEXT | D-10 | Gate (testes afetados, tsc, eslint, build com exit code, guarda 1 migration + 1 volta; sem suíte legada) | 6 | COVERED
CONTEXT | D-11 | Commits locais, sem push, linha de coautoria, sem .planning/config.json | 1, 3, 4, 6 | COVERED
CONTEXT | D-12 | Agente nunca aplica SQL; checkpoints decisão + ação humana em português com alerta LGPD; prazo da semana | 2, 5 | COVERED
</source_audit>

<verification>
- Tarefa 1: estrutural vermelho -> verde (7 casos, incluindo a prova corpo-0034-com-trocas sobre o corpo do `as $$` ao `$$;`, inclusive — a assinatura é provada à parte pela ASSINATURA_ESPERADA); inventário de 11 e estruturais 0049-0052 sem edição; uma migration nova e um arquivo de volta; ao vivo escrito (10 casos, 2 logins, filtros de ids, conferência de resíduo) e não executado.
- Tarefa 2: aprovação explícita com a regra da data, LGPD, ordem com banco primeiro e volta atrás reconhecidos; ajuste (se houver) seguido pelo caminho (a)/(b)/(c); orquestrador avisado para não publicar.
- Tarefa 3: camada pura, leitor/ação, linha e período vermelho -> verde; sem import cruzado; Perdidos e Encerrados idênticos à base; commits só locais.
- Tarefa 4: tela, rota e menu vermelho -> verde; 3 casos de ordem atualizados de propósito; 4 testes do menu verdes sem edição; ficha/Agenda/Clientes/Perdidos/Encerrados idênticos à base; commits só locais.
- Tarefa 5: nada publicado conferido imediatamente antes; dono aplica a 0053 no SQL Editor com "Success"; volta atrás não aplicada.
- Tarefa 6: 10 casos ao vivo verdes sem resíduo; gate (estruturais, camada pura, leitor/ação, linha, período, tela, menu, tsc, eslint --max-warnings 0, BUILD_EXIT=0) verde; guarda de escopo OK; Preview pendente para depois do envio à staging.
</verification>

<success_criteria>
- Vendedor e Supervisor veem a aba "Ganhos" (troféu) entre Clientes e Perdidos; a tela lista os clientes ganhos com nome, "Ganho em" e — só para o Supervisor — o vendedor, com busca e filtro de período iguais aos de Perdidos.
- Clicar num cliente abre a mesma ficha do funil; encerrar pela ficha tira o cliente da lista; não há Reabrir, motivo nem contato na lista.
- A data "Ganho em" vem do histórico (última vez que virou ganho) e, para quem foi cadastrado já como ganho, da data de cadastro — editar a ficha não muda a data.
- Cada vendedor vê só os próprios clientes; o Supervisor vê todos — decidido só pela RLS.
- Exatamente uma migration nova (0053) e um arquivo de volta, sem permissão nova nem função elevada nova; nenhuma migration antiga editada; ficha, Agenda, Clientes, Perdidos, Encerrados e Dashboard intocados.
- O dono aprovou (com o alerta de LGPD) e aplicou a 0053 ANTES de qualquer publicação; testes ao vivo verdes depois disso.
</success_criteria>

<output>
Criar `.planning/quick/261008-rxw-aba-ganhos-clientes-ganhos-no-menu/261008-rxw-SUMMARY.md` com os itens (a)-(m) da Tarefa 6, os hashes dos commits, o BASE impresso pela guarda e as notas para o dono em linguagem simples.
Não fazer push. Ordem para o orquestrador: NADA vai para staging antes de o dono aplicar a 0053 (Tarefa 5) e o gate da Tarefa 6 ficar verde; depois disso, staging -> conferência do Preview -> master (CLAUDE.md, "Fluxo de Deploy").
</output>
