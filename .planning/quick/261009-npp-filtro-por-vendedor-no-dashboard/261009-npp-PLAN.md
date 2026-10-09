---
phase: quick-261009-npp
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-261009-npp]
files_modified:
  - supabase/migrations/0054_dashboard_filtro_vendedor.sql
  - supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql
  - tests/dashboard/filtro-vendedor-migracao.test.ts
  - lib/dashboard/vendedorFiltro.ts
  - lib/supabase/queries/dashboard.ts
  - app/actions/dashboard.ts
  - tests/dashboard/filtro-vendedor-leitores.test.ts
  - tests/dashboard/filtro-vendedor-acoes.test.ts
  - components/dashboard/VendedorFilter.tsx
  - components/dashboard/DashboardClient.tsx
  - components/dashboard/ClientesPorEtapaChart.tsx
  - components/dashboard/FunilDetalhadoTable.tsx
  - components/dashboard/TempoAteFechamentoCards.tsx
  - components/dashboard/GanhosPerdidosCards.tsx
  - components/dashboard/ProspeccaoChart.tsx
  - app/(app)/dashboard/page.tsx
  - tests/dashboard/dashboard-filtro-vendedor.test.tsx

must_haves:
  truths:
    - "D-01/D-07: no Dashboard, o Supervisor vê ao lado do filtro de período um seletor 'Vendedor' com 'Todos os vendedores' (padrão) e uma opção por vendedor ATIVO (só o nome); quem tem papel Vendedor nunca vê o seletor e nunca envia vendedor nenhum."
    - "D-02/P-02: escolhido um vendedor, Clientes por etapa, Funil de conversão detalhado, Tempo até fechamento, Ganhos/Perdidos/Taxa de conversão e as duas Prospecções mostram só os clientes cujo responsável ATUAL é esse vendedor; com 'Todos os vendedores' os números são exatamente os de hoje."
    - "P-01 (confirmado EXPLICITAMENTE pelo dono na decisão 1 da Tarefa 2, ANTES da Tarefa 3): Comparativo por vendedor (com a Aderência de uso) e Desempenho por vendedor continuam mostrando todos os vendedores (funções do banco intocadas) e a tela avisa isso quando um vendedor está escolhido."
    - "D-03: o filtro só estreita — a RLS continua a única fronteira: um Vendedor que manda o id de outro vendedor não recebe nada além dos próprios clientes, e um visitante sem login não recebe nada (provado ao vivo)."
    - "D-04/D-05: exatamente UMA migration nova (0054), inteira dentro de begin;/commit; (uma transação só), remove as 6 assinaturas antigas e recria as 6 leituras com p_vendedor uuid default null, mesmas colunas de retorno, corpo = última definição anterior com SÓ as trocas listadas (prova estrutural), sem cláusula de elevação, inventário de 11 intacto, nenhuma policy nova; as chamadas no formato antigo (código hoje em produção) continuam valendo (prova ao vivo)."
    - "D-05: o arquivo de volta (supabase/rollbacks, NAO APLICAR) recria exatamente as 6 versões anteriores e remove as novas."
    - "D-06/D-12: o dono aprovou (com alerta de LGPD e as duas decisões explícitas) e aplicou a 0054 pelo SQL Editor ANTES de qualquer publicação, colando o arquivo INTEIRO de uma vez; logo depois do Success rodou, como instrução separada, a recarga do cache do PostgREST e conferiu o Dashboard do site real; os testes ao vivo ficaram verdes depois disso, com a contagem de fixtures igual antes e depois; nenhum push pelo executor."
  artifacts:
    - path: supabase/migrations/0054_dashboard_filtro_vendedor.sql
      provides: "begin; + 6 remoções de assinatura antiga + 6 leituras recriadas com p_vendedor uuid default null (filtro só estreita) + commit; (uma transação só), comentário ASCII num bloco barra-asterisco"
      contains: "drop function if exists dashboard_ganhos_perdidos(timestamptz, timestamptz);"
    - path: supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql
      provides: "Volta atrás: remove as 6 assinaturas novas e recria as versões de 0003/0037, inteira dentro de begin;/commit;; fora de supabase/migrations; NAO APLICAR"
      contains: "NAO APLICAR"
    - path: tests/dashboard/filtro-vendedor-migracao.test.ts
      provides: "Prova estrutural (fs, sem banco): 0054 = fontes 0003/0037 com só as trocas listadas; volta atrás = fontes; comentários seguros; sem elevação"
      contains: "migracao-exata"
    - path: tests/dashboard/filtro-vendedor-rpc.test.ts
      provides: "Testes ao vivo (2 logins, fixtures inventadas, sem resíduo): filtro estreita, nulo = todos, Vendedor não amplia, chamada antiga continua valendo, anônimo sem dados"
      contains: "vendedor-nao-amplia"
    - path: lib/dashboard/vendedorFiltro.ts
      provides: "normalizarVendedorFiltro (regra pura: vazio = todos; formato de uuid; inválido recusado)"
      contains: "export function normalizarVendedorFiltro"
    - path: lib/supabase/queries/dashboard.ts
      provides: "6 leitores com vendedorId opcional (p_vendedor só quando escolhido) + getVendedoresAtivosFiltro (id e nome, só vendedores ativos)"
      contains: "export async function getVendedoresAtivosFiltro"
    - path: app/actions/dashboard.ts
      provides: "6 Server Actions com vendedorId opcional validado; desempenho e comparativo inalterados"
      contains: "normalizarVendedorFiltro"
    - path: components/dashboard/VendedorFilter.tsx
      provides: "Seletor 'Vendedor' (Todos os vendedores + vendedores ativos) no molde do filtro da Agenda"
      contains: "Todos os vendedores"
    - path: components/dashboard/DashboardClient.tsx
      provides: "Estado do vendedor escolhido (só Supervisor), repassado aos 6 quadros afetados; aviso das comparações; subtítulo com o nome"
      contains: "VendedorFilter"
    - path: app/(app)/dashboard/page.tsx
      provides: "Lista de vendedores ativos carregada só para o Supervisor"
      contains: "getVendedoresAtivosFiltro"
  key_links:
    - from: "components/dashboard/DashboardClient.tsx (vendedorId, só Supervisor)"
      to: "ClientesPorEtapaChart, FunilDetalhadoTable, TempoAteFechamentoCards, GanhosPerdidosCards, 2x ProspeccaoChart -> app/actions/dashboard.ts -> lib/supabase/queries/dashboard.ts -> RPC dashboard_* (0054)"
      via: "prop vendedorId nas dependências do efeito de carga; a ação valida e repassa; o leitor manda p_vendedor só quando há vendedor escolhido"
      pattern: "p_vendedor"
    - from: "app/(app)/dashboard/page.tsx"
      to: "lib/supabase/queries/dashboard.ts getVendedoresAtivosFiltro -> DashboardClient vendedorOptions"
      via: "chamada só quando isSupervisor; falha vira lista vazia (seletor só com 'Todos')"
      pattern: "getVendedoresAtivosFiltro"
    - from: "supabase/migrations/0054_dashboard_filtro_vendedor.sql (remoção das assinaturas antigas)"
      to: "chamadas no formato antigo do código em produção (PostgREST)"
      via: "uma única versão de cada leitura, com o parâmetro novo opcional — sem sobrecarga ambígua (lição da 0018)"
      pattern: "drop function if exists dashboard_"
    - from: "tests/dashboard/filtro-vendedor-migracao.test.ts"
      to: "supabase/migrations/0003_dashboard_aggregates.sql e 0037_dashboard_ganho_sobrevive_encerramento.sql"
      via: "SQL esperado da 0054 montado a partir das fontes + tabela de trocas; comparação normalizada sem comentários"
      pattern: "migracao-exata"
---

<objective>
Pedido do dono (2026-10-09, esclarecido: vale para o DASHBOARD INTEIRO, não só para a tabela do funil): um filtro de VENDEDOR no Dashboard — "Todos os vendedores" (padrão, igual a hoje) e uma opção por vendedor — para ver "o que cada vendedor tem" nos indicadores. Útil para a reunião de 13/10/2026.

Explicando sem jargão: (1) seis leituras do banco que alimentam o Dashboard ganham um "recorte por vendedor" opcional; sem recorte, o resultado é exatamente o de hoje; (2) quem decide o que cada pessoa pode ver continua sendo a regra de acesso do próprio banco — o recorte só ESTREITA, nunca abre nada novo; (3) a tela ganha um seletor "Vendedor" ao lado do período, só para o Supervisor; (4) o PRÓPRIO dono cola a mudança no SQL Editor depois de aprovar, e só depois o código é publicado (o site de teste e o de produção usam o MESMO banco).

Decisões do pedido, numeradas para rastreio:
- D-01: Filtro de vendedor no Dashboard inteiro: "Todos os vendedores" (padrão = comportamento de hoje) + uma opção por vendedor ATIVO, só o nome; visível só para o Supervisor, ao lado do filtro de período.
- D-02: Parâmetro opcional p_vendedor uuid default null nas leituras que fazem sentido filtrar: dashboard_clientes_por_etapa, dashboard_funil_detalhado, dashboard_ganhos_perdidos, dashboard_tempo_ate_fechamento, dashboard_prospeccao_por_categoria, dashboard_prospeccao_por_produto. Desempenho/comparativo/aderência: decisão do planejador (P-01), comunicada ao dono no checkpoint.
- D-03: O filtro é só estreitamento sobre a RLS, na forma "(p_vendedor is null or <responsavel> = p_vendedor)" — NUNCA permissão; nenhuma checagem de papel dentro das leituras; RLS continua a única fronteira; Vendedor que manda o id de outro recebe só os próprios (prova ao vivo).
- D-04: Armadilha de sobrecarga do PostgREST: acrescentar parâmetro com padrão cria uma versão NOVA ao lado da antiga e a chamada antiga fica ambígua. A migration REMOVE as assinaturas antigas e CRIA as novas com o padrão, mesmas colunas de retorno, numa ÚNICA migration 0054 (+ um arquivo de volta). O código hoje em produção (chamadas só com os argumentos antigos) precisa continuar funcionando depois da aplicação. A exclusão da carteira feita antes pelo dono, direto no banco, não muda nada aqui (nenhuma migration nem leitura depende dela).
- D-05: Corpo de cada leitura = última definição anterior com SÓ as trocas listadas (prova estrutural, como 0052/0053). Comentários só ASCII em bloco barra-asterisco (comentário de dois hífens quebra a colagem no SQL Editor). Sem cláusula de elevação de privilégio nova, inventário de 11 funções elevadas intacto, nenhuma policy nova. Arquivo de volta em supabase/rollbacks (NÃO aplicado automaticamente, cabeçalho NAO APLICAR) restaurando as assinaturas anteriores.
- D-06: Banco PRIMEIRO; nada vai para o GitHub antes de o dono aplicar o SQL; o agente nunca aplica SQL nem usa db push.
- D-07: Tela: seletor reaproveitando o componente Select existente e o molde do filtro de vendedor da Agenda; o id escolhido vai para todo quadro afetado; estados de carregando/vazio sensatos; o papel Vendedor nunca vê o seletor.
- D-08: LGPD: nomes de vendedores num seletor são dado de funcionário que o Supervisor já vê; nenhum dado novo; é recorte por pessoa de métricas que já existem; apresentar como acompanhamento, não avaliação individual.
- D-09: Testes: estrutural da 0054; ao vivo (no máximo 2 logins, nomes inventados, nada de dado real impresso, sem resíduo, sem tocar a tabela de registro de acesso diário, escritos mas NÃO executados antes da aplicação) provando que o filtro estreita, nulo = todos e Vendedor não amplia; testes de componente do seletor e da fiação (ações com dublês); testes existentes cujas chamadas mudem são atualizados DE PROPÓSITO.
- D-10: Gate final: testes afetados, tsc, eslint --max-warnings 0 nos arquivos tocados, npm run build com código de saída, guarda de escopo (exatamente 1 migration + 1 arquivo de volta + arquivos listados). NÃO rodar a suíte legada (~49 arquivos vermelhos pré-existentes por contas semente apagadas) — registrar os testes ao vivo do Dashboard que dependem dessas contas, sem consertá-los.
- D-11: Commits só locais, NENHUM push; todo commit termina com "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"; nunca adicionar .planning/config.json a um commit.
- D-12: Checkpoints do dono em português simples: decisão primeiro (o que o filtro faz em cada quadro, o que fica sem filtro, LGPD, ordem com banco primeiro, volta atrás), depois o dono aplica o SQL, depois o gate final. Ordem das tarefas: banco + testes (local) -> decisão do dono -> código -> dono aplica o SQL -> gate final.

Escolhas do planejador (discricionárias, documentadas):
- P-01: Desempenho por vendedor, Comparativo por vendedor e Aderência de uso NÃO mudam (funções do banco intocadas, componentes intocados, sem destaque). Motivo: elas SÃO a comparação entre vendedores; recortadas para uma pessoa só repetiriam os números dos cartões de Ganhos/Perdidos. Deixá-las de fora também diminui o risco (3 leituras a menos para recriar). Quando há vendedor escolhido, a tela mostra o aviso "Comparativo por vendedor e Desempenho por vendedor continuam mostrando todos os vendedores." Esta escolha é PERGUNTADA ao dono como decisão explícita 1 da Tarefa 2 e precisa estar respondida ANTES da Tarefa 3; a alternativa (estender o recorte a Desempenho e Comparativo, 8 leituras em vez de 6) volta para replanejamento.
- P-02: O recorte usa o responsável ATUAL do cliente (clientes.responsavel) — a mesma base do Comparativo desde a Fase 12. Cliente transferido conta, com a sua história, para quem está com ele hoje.
- P-03: No funil detalhado, todo o cálculo nasce do bloco stage_events; filtrar as duas metades desse bloco (clientes pelo responsável; histórico de etapa pelos clientes daquele responsável, via subconsulta em clientes sujeita à RLS) recorta tudo o que vem depois (visitas, durações, maior etapa, alcançados, avançados, perdidos por etapa, tempo médio).
- P-04: Os leitores mandam p_vendedor SÓ quando há vendedor escolhido. Com "Todos", a chamada é idêntica à de hoje: os testes atuais não mudam e, se um dia o banco for revertido com o código novo no ar, "Todos" continua funcionando (só escolher um vendedor daria erro nos quadros).
- P-05: As Server Actions aceitam vendedorId opcional e validam o formato (uuid) numa regra pura (lib/dashboard/vendedorFiltro.ts); formato inválido devolve o erro de sempre sem chamar o banco. É higiene de entrada, não autorização — a RLS decide.
- P-06: Lista do seletor: leitor novo getVendedoresAtivosFiltro em lib/supabase/queries/dashboard.ts, no molde da consulta de profiles da página da Agenda, mas mínimo (só id, nome, sobrenome; só papel vendedor e ativo; ordem por nome). Chamado pela página do Dashboard só para o Supervisor; falha vira lista vazia (seletor só com "Todos").
- P-07: Com vendedor escolhido: subtítulo "Números de {nome}"; vazio de Clientes por etapa e do Funil detalhado vira "Nenhum cliente deste vendedor." (sem vendedor, o texto atual "Nenhum cliente cadastrado ainda." fica igual).
- P-08: Teste ao vivo semeado UMA vez (beforeAll) — são agregados, não listas filtráveis por id. Números exatos só onde quem chama enxerga apenas fixtures (Vendedor A, ou Supervisor com recorte A/B); o Supervisor sem recorte (que enxerga a carteira real) só é conferido por comparações booleanas "maior ou igual", com mensagens sem valores — nada de dado real impresso.
- P-09: Nomes: supabase/migrations/0054_dashboard_filtro_vendedor.sql e supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql. Re-executável: "drop function if exists" da assinatura antiga + "create or replace function" da nova. Os DOIS arquivos ficam inteiros dentro de `begin;` ... `commit;` (W1 do checador): a remoção e a recriação das 6 leituras são UMA transação, qualquer que seja a forma como o SQL Editor envia as instruções — nunca fica o Dashboard sem leitura no meio do caminho. Este projeto não aplica pelo CLI (db push): o dono cola no SQL Editor, e o `migration repair` opcional só registra o histórico, sem executar o arquivo.
- P-10: Vendedores desativados não aparecem no seletor (os números deles continuam em "Todos os vendedores"); clientes cujo responsável é um Supervisor também só aparecem em "Todos".
- P-11 (W2 do checador): recarga do cache de esquema do PostgREST como passo PADRÃO da Tarefa 5 — `notify pgrst, 'reload schema';` numa aba nova do SQL Editor, logo depois do Success, como instrução SEPARADA (nunca dentro do arquivo da migration) — e só então o dono abre o Dashboard do site real para conferir que tudo carrega.
- P-12 (W4 do checador): na Tarefa 6, contagem antes/depois das fixtures do teste ao vivo (clientes com o prefixo inventado "Teste Filtro Vendedor" e membros de teste com nome "Fixture"), só números, sem nenhuma linha impressa; antes e depois precisam ser iguais.
- P-13 (W3 do checador): tamanhos das tarefas aceitos como estão (Tarefa 4 com 9 arquivos, mudança mecânica de uma prop e uma dependência por quadro) — registrado no SUMMARY.

Purpose: dar ao Supervisor, para a reunião de 13/10, a visão "o que cada vendedor tem" nos indicadores do Dashboard, sem dado novo e sem mexer em quem pode ver o quê.
Output: migration 0054 + arquivo de volta + leitores/ações com recorte opcional + seletor no Dashboard + testes; aplicação feita pelo dono ANTES de publicar; gate final verde.
</objective>

<owner_answers>
## Respostas do dono ao checkpoint da Tarefa 2 (2026-10-09, relatadas pelo orquestrador) e ADAPTACAO DO PLANO

Resposta literal do dono: "1 aceito sem filtro nesses dois; 2 nao precisa de testes".
- Decisao 1 = ACEITA: Comparativo por vendedor (com a Aderencia de uso) e Desempenho por vendedor continuam SEM o filtro, com o aviso na tela (P-01 confirmada).
- Decisao 2 = RECUSADA: nenhum teste pode criar contas ou clientes temporarios, nem fazer login com contas criadas, nem gravar linhas no banco real (que e o mesmo da producao). Por instrucao do orquestrador, NAO ha replanejamento: o plano foi adaptado assim.

Adaptacoes (substituem o texto antigo onde houver conflito):
- O arquivo tests/dashboard/filtro-vendedor-rpc.test.ts (testes ao vivo, commit 36aaecf) foi REMOVIDO num commit novo (git rm, sem reescrever historico). Toda etapa que o roda, cria fixtures ou faz contagem antes/depois de residuo (P-12) esta CANCELADA: Tarefa 1 passo 3, Tarefa 6 passos 1 e 2 e a sequencia ANTES/DEPOIS do verify da Tarefa 6; os 7 casos ao vivo, o item (c) do SUMMARY e a ameaca T-npp-08 deixam de existir como teste. O arquivo tambem sai da lista de 18 arquivos da guarda de escopo (ficam 17).
- A prova de corretude passa a ser: teste estrutural da 0054 (corpos = fontes + trocas listadas), testes de camada de dados e de tela (dubles), tsc/eslint/build, e a conferencia do PROPRIO DONO no Dashboard real depois de aplicar (com "Todos" tudo igual; escolhendo um vendedor, os numeros mudam). Opcional, fora da suite e a cargo do orquestrador: comparar, so por CONTAGENS agregadas somente leitura com o cliente de servico (sem imprimir linhas), o numero de clientes por vendedor com o que o filtro deve mostrar.
- Registrar no SUMMARY, item (a), estas respostas e esta adaptacao.
</owner_answers>

<execution_context>
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/Supabase-conventions/SKILL.md
@supabase/migrations/0003_dashboard_aggregates.sql
@supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql
@tests/dashboard/aderencia-parcial-migracao.test.ts
</context>

## Pesquisa registrada (verificada lendo o código em 2026-10-09, base b3401c9bed155f03b275a99e7417acba86b846ca)

**Última definição de cada leitura do Dashboard (busca por "create or replace function dashboard_" em supabase/migrations):** dashboard_clientes_por_etapa -> 0003 (linha 39); dashboard_prospeccao_por_produto -> 0003 (linha 153); dashboard_prospeccao_por_categoria -> 0003 (linha 182); dashboard_ganhos_perdidos -> 0037 (linha 62); dashboard_tempo_ate_fechamento -> 0037 (linha 176); dashboard_funil_detalhado -> 0037 (linha 345; 0010 e 0009 são versões antigas); dashboard_desempenho_vendedor -> 0037; dashboard_comparativo_vendedor -> 0037; dashboard_aderencia_uso -> 0052. Todas language sql stable, sem cláusula de elevação.

**Comentários dentro dos corpos de origem:** os corpos de 0037 para ganhos_perdidos e tempo_ate_fechamento não têm comentário; o corpo de funil_detalhado em 0037 tem várias linhas de dois hífens com acento; os corpos de prospecção em 0003 têm comentário de dois hífens NO FIM de uma linha de código (`from clientes c  -- RLS on clientes applies here`). Por isso o helper de remoção de comentários do teste novo precisa tirar blocos barra-asterisco E tudo de dois hífens até o fim da linha (nenhum literal de texto dos corpos contém dois hífens), e a 0054 leva os corpos SEM comentário nenhum.

**Permissões:** nenhuma migration tem grant/revoke (busca em supabase/migrations). Remover e recriar uma leitura devolve as permissões padrão da Supabase, que são as mesmas que as leituras têm hoje.

**Chamadas atuais (lib/supabase/queries/dashboard.ts):** `rpc("dashboard_clientes_por_etapa")`, `rpc("dashboard_funil_detalhado")`, `rpc("dashboard_tempo_ate_fechamento")` sem argumentos; ganhos_perdidos, desempenho_vendedor e as duas prospecções com `{ p_inicio, p_fim }` (ISO). O PostgREST aceita omitir parâmetros que têm padrão, desde que só exista UMA versão com aquele nome — por isso a remoção da assinatura antiga é obrigatória (D-04; precedente da 0018 em STATE.md).

**Tela:** components/dashboard/DashboardClient.tsx monta PeriodoFilter e os quadros; ClientesPorEtapaChart, FunilDetalhadoTable e TempoAteFechamentoCards não têm props e carregam no efeito com dependência [reloadKey]; GanhosPerdidosCards e ProspeccaoChart recebem {inicio, fim} (ProspeccaoChart recebe também `action: (inicio, fim) => Promise<...>`); ComparativoVendedorTable e DesempenhoVendedorChart são só do Supervisor. Vazio de ClientesPorEtapaChart (totalClientes === 0) e de FunilDetalhadoTable (totalQuantidade === 0): "Nenhum cliente cadastrado ainda.". app/(app)/dashboard/page.tsx só lê o papel e passa isSupervisor.

**Molde do seletor:** components/agenda/AgendaList.tsx linhas 165-180 e 322-347 (sentinela "__todos__", Label "Vendedor", Select com `items`, SelectTrigger com id e className "w-56", SelectItem "Todos os vendedores"). Interação em teste: tests/agenda/agenda-calendario-integracao.test.tsx linhas 238-266 (combobox "Vendedor", option, pointerDown antes do click no Base UI). Consulta de nomes: app/(app)/agenda/page.tsx linhas 52-62.

**Testes ao vivo (molde):** tests/funil/ganhos-rpc.test.ts linhas 1-245 (createTestMember/deleteTestMember/signInAs/serviceClient/anonClient de tests/helpers/supabase-test-clients.ts; baseClienteFields com CNPJ único — trava 0030; ganho exige etapa 'primeira_venda'; perdido exige motivo_perda_id; clientes apagados ANTES dos membros (FK sem ON DELETE em responsavel); historico e cliente_produtos vão por cascata ao apagar o cliente). Etapas (lib/funil/etapas.ts): aguardando_contato, conversa_comprador, aguardando_data_reuniao, aguardando_feedback, aguardando_aprovacao, em_cadastro_produto, primeira_venda. clientes.categoria_id é opcional.

**Testes do Dashboard existentes:** dublês de tela (ganhos-perdidos-cards, funil-detalhado-table, tempo-ate-fechamento-cards, comparativo-vendedor-table) não conferem argumentos das ações — continuam verdes sem edição com props opcionais. Leitores com dublê só existem para aderência (aderencia-uso-reader) e a ação do comparativo (comparativo-vendedor-action). Ao vivo que dependem das contas semente apagadas (NÃO rodar, só registrar): clientes-por-etapa, comparativo-vendedor, desempenho-vendedor, funil-detalhado, ganhos-perdidos, prospeccao, rls-dashboard. Ao vivo que tocam a tabela de acesso diário (NÃO rodar; a aderência não muda): acessos-diarios, aderencia-uso, aderencia-parcial. tests/dashboard/encerrado-preserva-historico.test.ts usa fixture própria (1 login), não toca a tabela de acesso diário e chama 5 leituras no FORMATO ANTIGO — serve de prova extra de regressão depois da aplicação.

**Inventário de funções elevadas:** tests/agenda2/migracao-agenda2.test.ts (linhas 43-155) varre todas as migrations, sem linhas de dois hífens mas COM blocos barra-asterisco, procurando "create [or replace] function nome(...)" até o primeiro fechamento de cifrões duplos com ponto e vírgula. O bloco de comentário da 0054 não pode conter a palavra inglesa de função, nem cifrões duplos, nem a cláusula de elevação, nem o nome da tabela da Agenda 2.

## Contrato SQL (texto exato, comparado normalizado: comentários removidos e todo espaço em branco reduzido a um espaço)

Ordem fixa das 6 leituras (na 0054 e no arquivo de volta): 1 dashboard_clientes_por_etapa (fonte 0003), 2 dashboard_funil_detalhado (fonte 0037), 3 dashboard_tempo_ate_fechamento (fonte 0037), 4 dashboard_ganhos_perdidos (fonte 0037), 5 dashboard_prospeccao_por_produto (fonte 0003), 6 dashboard_prospeccao_por_categoria (fonte 0003).

**0054:** depois do bloco de comentário do topo, a primeira instrução é `begin;` e a última é `commit;` (P-09). Entre elas, para cada leitura i, na ordem: a linha de remoção da assinatura antiga, seguida do bloco da fonte (de "create or replace function <nome>(" até o primeiro "$$;", sem comentários) com a troca de assinatura e as trocas de corpo abaixo. Nada mais no arquivo — em especial, a recarga do cache do PostgREST NÃO entra no arquivo (é passo separado da Tarefa 5, P-11).

Remoções (0054):
```sql
drop function if exists dashboard_clientes_por_etapa();
drop function if exists dashboard_funil_detalhado();
drop function if exists dashboard_tempo_ate_fechamento();
drop function if exists dashboard_ganhos_perdidos(timestamptz, timestamptz);
drop function if exists dashboard_prospeccao_por_produto(timestamptz, timestamptz);
drop function if exists dashboard_prospeccao_por_categoria(timestamptz, timestamptz);
```

Troca de assinatura (texto normalizado):
- leituras sem argumento (1, 2, 3): `<nome>()` -> `<nome>(p_vendedor uuid default null)` — escrever numa linha só, ex.: `create or replace function dashboard_clientes_por_etapa(p_vendedor uuid default null)`.
- leituras com período (4, 5, 6): `p_fim timestamptz )` -> `p_fim timestamptz, p_vendedor uuid default null )` — escrever em várias linhas como na fonte, com `  p_vendedor uuid default null` numa linha própria antes do `)`.

Trocas de corpo (texto normalizado; cada trecho antigo aparece exatamente 1 vez no corpo da sua fonte):
- R-ETAPA (1): `from clientes group by etapa;` -> `from clientes where (p_vendedor is null or responsavel = p_vendedor) group by etapa;`
- R-FUNIL-1 (2): `c.criado_em as entrada from clientes c union all` -> `c.criado_em as entrada from clientes c where (p_vendedor is null or c.responsavel = p_vendedor) union all`
- R-FUNIL-2 (2): `from historico h where h.tipo = 'etapa' ),` -> `from historico h where h.tipo = 'etapa' and (p_vendedor is null or h.cliente_id in (select c2.id from clientes c2 where c2.responsavel = p_vendedor)) ),`
- R-FECH (3 e 4): `c.status_acompanhamento = 'encerrado')) group by u.status_evento;` -> `c.status_acompanhamento = 'encerrado')) and (p_vendedor is null or c.responsavel = p_vendedor) group by u.status_evento;`
- R-PROD (5): `and c.criado_em < p_fim group by pc.id, pc.nome;` -> `and c.criado_em < p_fim and (p_vendedor is null or c.responsavel = p_vendedor) group by pc.id, pc.nome;`
- R-CAT (6): `and c.criado_em < p_fim group by cat.id, cat.nome;` -> `and c.criado_em < p_fim and (p_vendedor is null or c.responsavel = p_vendedor) group by cat.id, cat.nome;`

Contagens resultantes na 0054 sem comentários: "p_vendedor is null or" = 7 (1+2+1+1+1+1); "drop function if exists" = 6; "create or replace function" = 6; "begin;" = 1 (primeira instrução); "commit;" = 1 (última instrução); "notify" = 0. No arquivo cru minúsculo: "$$" = 12, a palavra "function" = 12, a palavra "begin" = 1 e a palavra "commit" = 1 — por isso os cabeçalhos dos DOIS arquivos não usam as palavras inglesas begin e commit (nem "commits"), e nenhum corpo de leitura contém essas palavras (todas são language sql).

**Arquivo de volta:** a mesma moldura `begin;` ... `commit;` e, entre elas, para cada leitura i (mesma ordem): remoção da assinatura NOVA seguida do bloco da fonte sem comentários, SEM troca nenhuma:
```sql
drop function if exists dashboard_clientes_por_etapa(uuid);
drop function if exists dashboard_funil_detalhado(uuid);
drop function if exists dashboard_tempo_ate_fechamento(uuid);
drop function if exists dashboard_ganhos_perdidos(timestamptz, timestamptz, uuid);
drop function if exists dashboard_prospeccao_por_produto(timestamptz, timestamptz, uuid);
drop function if exists dashboard_prospeccao_por_categoria(timestamptz, timestamptz, uuid);
```

**Bloco de comentário do topo da 0054** (um único bloco barra-asterisco, primeira linha não vazia do arquivo, só ASCII, português sem acento; sem a palavra inglesa de função, sem as palavras inglesas begin e commit, sem cifrões duplos, sem dois hífens, sem a cláusula de elevação, sem o nome da tabela da Agenda 2; use "leitura" e "transacao"). Deve dizer: quick task 261009-npp, pedido do dono de 2026-10-09; as 6 leituras do Dashboard (nomes) ganham o parametro opcional p_vendedor (uuid, padrao nulo); nulo = resultado identico ao de hoje; preenchido = so clientes cujo responsavel ATUAL e esse vendedor (cliente transferido conta para quem esta com ele hoje); o recorte so estreita: roda com as permissoes de quem chama, sem elevacao de privilegio, sem checagem de papel, sem grant/revoke, sem regra de acesso nova — a RLS de clientes e historico continua a unica fronteira (um Vendedor que mande o id de outro recebe so os proprios clientes); as assinaturas antigas sao removidas antes de criar as novas, para existir uma unica versao de cada leitura e as chamadas antigas (sem p_vendedor) continuarem validas — duas versoes com o mesmo nome deixariam a chamada ambigua (licao da 0018); colunas de retorno iguais; o corpo de cada leitura e o da ultima definicao (0003 ou 0037) sem comentarios, com so as trocas do recorte (um teste estrutural confere); desempenho por vendedor, comparativo por vendedor e aderencia de uso NAO mudam; LGPD: nenhum dado novo e coletado, so recorte por vendedor de numeros que o Supervisor ja ve; o arquivo inteiro roda numa transacao so (remocao e recriacao juntas): colar o arquivo INTEIRO de uma vez no SQL Editor, sem selecionar so um trecho; depois do Success, rodar a recarga do cache do PostgREST como passo separado (fora deste arquivo); ORDEM: aplicar ANTES de publicar o codigo novo; o codigo hoje publicado continua funcionando depois da aplicacao; volta atras em supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql, NAO aplicado automaticamente.

**Bloco de comentário do arquivo de volta** (mesmas regras de texto, inclusive sem as palavras inglesas begin, commit e commits): NAO APLICAR automaticamente; fica FORA de supabase/migrations de proposito (o CLI nunca le); desfaz a 0054 (quick 261009-npp): remove as 6 leituras com p_vendedor e recria as versoes anteriores (0003/0037) exatamente como eram, numa transacao so; nenhum dado e apagado (so leituras); colar o arquivo INTEIRO de uma vez e depois rodar a recarga do cache do PostgREST como passo separado; ORDEM: primeiro desfazer as mudancas de codigo desta quick task (os registros feat do git) e publicar, so DEPOIS colar este arquivo no SQL Editor — na ordem inversa, "Todos os vendedores" continua funcionando, mas escolher um vendedor faz os quadros mostrarem erro ate o codigo ser desfeito; aplicar SO se o dono decidir desfazer.

## Interfaces (contrato desta quick)

- lib/dashboard/vendedorFiltro.ts (sem React, sem Supabase): `export type VendedorFiltroNormalizado = { ok: true; vendedorId: string | null } | { ok: false }`; `export function normalizarVendedorFiltro(valor: string | null | undefined): VendedorFiltroNormalizado` — nulo, indefinido ou texto vazio/só espaços -> `{ ok: true, vendedorId: null }`; texto no formato 8-4-4-4-12 hexadecimal (maiúsculas ou minúsculas, expressão regular sem exigir versão) -> `{ ok: true, vendedorId: valor }`; qualquer outra coisa -> `{ ok: false }`.
- lib/supabase/queries/dashboard.ts: `getClientesPorEtapa(vendedorId: string | null = null)`, `getFunilDetalhado(vendedorId: string | null = null)`, `getTempoAteFechamento(vendedorId: string | null = null)`, `getGanhosPerdidos(inicio, fim, vendedorId: string | null = null)`, `getProspeccaoPorProduto(inicio, fim, vendedorId: string | null = null)`, `getProspeccaoPorCategoria(inicio, fim, vendedorId: string | null = null)`; sem vendedor a chamada é EXATAMENTE a de hoje (sem argumento nas 3 primeiras; `{ p_inicio, p_fim }` nas outras); com vendedor acrescenta só `p_vendedor`. `getDesempenhoVendedor`, `getComparativoVendedor`, `getAderenciaUso` inalterados. Novo: `export type VendedorFiltroOpcao = { id: string; nome: string }` e `export async function getVendedoresAtivosFiltro(): Promise<VendedorFiltroOpcao[]>` — `from("profiles").select("id, nome, sobrenome").eq("role", "vendedor").eq("ativo", true).order("nome", { ascending: true })`, nome = nome e sobrenome não vazios unidos por espaço, lança erro como os demais leitores.
- app/actions/dashboard.ts: `getClientesPorEtapaAction(vendedorId?: string | null)`, `getFunilDetalhadoAction(vendedorId?: string | null)`, `getTempoAteFechamentoAction(vendedorId?: string | null)`, `getGanhosPerdidosAction(inicio, fim, vendedorId?: string | null)`, `getProspeccaoPorProdutoAction(inicio, fim, vendedorId?: string | null)`, `getProspeccaoPorCategoriaAction(inicio, fim, vendedorId?: string | null)`; tipos de resultado e códigos de erro inalterados; `getDesempenhoVendedorAction(inicio, fim)` e `getComparativoVendedorAction()` inalterados.
- components/dashboard/VendedorFilter.tsx: `VendedorFilter({ vendedores, vendedorId, onVendedorChange }: { vendedores: VendedorFiltroOpcao[]; vendedorId: string | null; onVendedorChange: (vendedorId: string | null) => void })`.
- DashboardClient: props `{ isSupervisor: boolean; vendedorOptions?: VendedorFiltroOpcao[] }` (padrão []). ClientesPorEtapaChart, FunilDetalhadoTable, TempoAteFechamentoCards: prop opcional `vendedorId?: string | null`; GanhosPerdidosCards e ProspeccaoChart: idem, além das atuais; `ProspeccaoChart.action: (inicio: Date, fim: Date, vendedorId: string | null) => Promise<ProspeccaoActionResult>`.

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Migration 0054 (6 leituras com recorte opcional por vendedor), arquivo de volta, teste estrutural (vermelho -> verde) e testes ao vivo (escritos, NÃO executados)</name>
  <files>supabase/migrations/0054_dashboard_filtro_vendedor.sql, supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql, tests/dashboard/filtro-vendedor-migracao.test.ts, tests/dashboard/filtro-vendedor-rpc.test.ts</files>
  <read_first>
    - supabase/migrations/0003_dashboard_aggregates.sql (linhas 39-47 e 153-203) e supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql (linhas 62-109, 176-220, 345-488) — as fontes
    - tests/dashboard/aderencia-parcial-migracao.test.ts (helpers estruturais a copiar e estender)
    - tests/agenda2/migracao-agenda2.test.ts linhas 43-155 (inventário — não editar)
    - tests/funil/ganhos-rpc.test.ts linhas 1-245 e tests/helpers/supabase-test-clients.ts (molde dos testes ao vivo)
    - Seções "Pesquisa registrada" e "Contrato SQL" deste plano
  </read_first>
  <behavior>
    - Estrutural (tests/dashboard/filtro-vendedor-migracao.test.ts, ambiente node, só fs/path/vitest; nomes de it exatos):
      - arquivo-unico: só um arquivo com prefixo 0054 em supabase/migrations (0054_dashboard_filtro_vendedor.sql); o arquivo de volta existe em supabase/rollbacks e não em supabase/migrations.
      - fontes-sao-as-ultimas-definicoes: para cada uma das 6 leituras, o arquivo de MAIOR nome em supabase/migrations (ignorando a 0054) que contém uma frase de criação dela é a fonte declarada (0003 ou 0037); a 0054 sem comentários não menciona dashboard_desempenho_vendedor, dashboard_comparativo_vendedor nem dashboard_aderencia_uso.
      - migracao-exata: 0054 sem comentários e normalizada == "begin; " + junção, na ordem do contrato, de (linha de remoção + bloco da fonte sem comentários, normalizado, com a troca de assinatura e as trocas de corpo) + " commit;"; antes de trocar, confere que cada trecho antigo aparece exatamente 1 vez no bloco da fonte.
      - filtro-so-estreita: em cada um dos 6 blocos da 0054, "p_vendedor is null or" aparece o número esperado de vezes (2 no funil, 1 nos demais), toda ocorrência de p_vendedor fora da assinatura está dentro de um desses parênteses de recorte, e nenhum bloco contém is_supervisor nem auth.uid; cada assinatura tem "language sql" e "stable".
      - sem-elevacao-escrita-restrita: 0054 sem comentários, minúscula: sem a cláusula de elevação (montada por concatenação), sem grant, revoke, policy, insert into, delete from, truncate, alter table, create table, nem "update "; "drop " aparece exatamente 6 vezes, todas como "drop function if exists"; "begin;" exatamente 1 vez e no começo, "commit;" exatamente 1 vez e no fim; nenhum "notify" (a recarga do cache fica fora do arquivo); as leituras criadas são exatamente as 6 do contrato, na ordem.
      - comentarios-seguros: arquivo cru ASCII puro; primeira linha não vazia abre o bloco barra-asterisco; nenhum par de hífens em lugar nenhum do arquivo; "$$" exatamente 12; no texto cru minúsculo a palavra "function" exatamente 12 vezes, "begin" exatamente 1 e "commit" exatamente 1 (o cabeçalho não usa essas palavras); sem a cláusula de elevação nem o nome da tabela da Agenda 2 (montados por concatenação); contém "261009-npp" e "supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql".
      - volta-restaura-anteriores: arquivo de volta ASCII, sem par de hífens, contém "NAO APLICAR"; no texto cru minúsculo "$$" 12, "function" 12, "begin" 1 e "commit" 1; sem a cláusula de elevação; sem comentários e normalizado == "begin; " + junção, na ordem, de (remoção da assinatura nova + bloco da fonte sem comentários, normalizado, sem troca nenhuma) + " commit;".
    - Inventário (tests/agenda2/migracao-agenda2.test.ts) e os estruturais existentes (0049, 0050, 0051, 0052, 0053) continuam verdes SEM edição.
    - Ao vivo (tests/dashboard/filtro-vendedor-rpc.test.ts — VERMELHO até a 0054 ser aplicada; NÃO executado nesta tarefa), um describe, 7 casos com exatamente estes nomes: vendedor-sem-filtro-igual-ao-proprio, vendedor-nao-amplia, supervisor-filtra-a, supervisor-filtra-b, supervisor-sem-filtro-inclui-todos, chamada-antiga-continua-valendo, anonimo-sem-dados.
  </behavior>
  <action>
1. RED — criar tests/dashboard/filtro-vendedor-migracao.test.ts com os 7 casos do behavior (per D-04, D-05). Copiar do molde aderencia-parcial-migracao os helpers lerCru, lf, normaliza, ehAsciiPuro, contaOcorrencias e a ideia de assinatura/corpo; escrever semComentarios que remove blocos barra-asterisco e, em cada linha, tudo a partir do primeiro par de hífens (registrar no comentário do helper que nenhum literal de texto dos corpos de origem contém dois hífens); blocoDaFuncao(sql, nome) que recorta de "create or replace function <nome>(" até o primeiro "$$;" depois dela, inclusive. Constantes: os 6 itens do contrato (nome, arquivo-fonte, linha de remoção da 0054, linha de remoção do arquivo de volta, troca de assinatura, lista de trocas de corpo com antigo/novo em texto normalizado — copiados AO PÉ DA LETRA da seção "Contrato SQL"); cláusula de elevação, frase de remoção de leitura e nome da tabela da Agenda 2 montados por concatenação (nenhum aparece inteiro no arquivo de teste). Cabeçalho do teste: protege a forma da 0054 sem banco; o SQL esperado é montado a partir das fontes 0003/0037 + tabela de trocas (prova de que o resto do corpo não mudou); a aplicação real é do dono pelo SQL Editor. Rodar e confirmar que FALHA (a 0054 não existe). Commit: `test(quick-261009-npp): add structural test for migration 0054 (dashboard vendor filter)`.
2. GREEN — criar supabase/migrations/0054_dashboard_filtro_vendedor.sql (per D-02, D-03, D-04, D-05, P-02, P-03, P-09): o bloco de comentário do contrato, depois `begin;`, depois, na ordem, cada linha de remoção seguida do bloco recriado, e por último `commit;` — corpo copiado da fonte SEM nenhum comentário e com SÓ as trocas do contrato; assinaturas no formato do contrato; mesmas colunas de retorno; "language sql" e "stable" como na fonte; nenhuma cláusula de elevação, nenhuma permissão, nenhuma regra de acesso. Criar supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql: bloco de comentário do contrato + `begin;` + as 6 remoções das assinaturas novas, cada uma seguida do bloco da fonte sem comentários + `commit;`. Nenhum dos dois cabeçalhos usa as palavras inglesas begin, commit ou commits (as contagens do estrutural dependem disso). Nenhuma migration antiga é tocada. Rodar o estrutural até ficar verde, junto com o inventário e os estruturais existentes do verify. Commit: `feat(quick-261009-npp): add migration 0054 with optional vendor filter on six dashboard reads (and rollback file)`.
3. Criar tests/dashboard/filtro-vendedor-rpc.test.ts (per D-03, D-09, P-08) no molde de tests/funil/ganhos-rpc.test.ts. Cabeçalho: prova a 0054 contra o banco REAL, que é o de produção; VERMELHO até o dono aplicar — esperado e NÃO medido; só fixtures descartáveis criadas e apagadas aqui (nunca as contas semente antigas); exatamente duas autenticações (Vendedor A e Supervisor; Vendedor B nunca loga); nenhuma impressão no terminal; nomes e CNPJs inventados; nunca lê nem grava a tabela de registro de acesso diário da aderência (não escrever o nome dessa tabela no arquivo, nem em comentário); toda troca de etapa/status pelo cliente de serviço (autor nulo). Fixtures criadas UMA vez no beforeAll (são agregados): membros A, B (vendedores) e S (supervisor) por createTestMember com os rótulos "filtro-vendedor-a", "filtro-vendedor-b" e "filtro-vendedor-s"; toda razão social de fixture começa com o prefixo inventado "Teste Filtro Vendedor" (a contagem antes/depois da Tarefa 6 depende desse prefixo, P-12); leituras só de leitura pelo serviço do primeiro motivo de perda ativo, da primeira categoria ativa e do primeiro produto ativo (ids apenas); 4 clientes, todos com essa categoria e uma linha em cliente_produtos com esse produto: A1 de A (insere em aguardando_contato e depois troca a etapa para conversa_comprador), A2 de A (insere em primeira_venda/em_andamento e depois troca o status para ganho), B1 de B (insere em aguardando_contato e depois troca a etapa para aguardando_data_reuniao), B2 de B (insere em aguardando_contato/em_andamento e depois troca para perdido com o motivo). Janela de período: agora menos 1 dia até agora mais 1 dia, calculada depois da semeadura. Helpers: chamar(cliente, nome, comVendedor: string | null | "ausente") que monta os argumentos (sem p_vendedor quando "ausente"; com p_vendedor nulo ou id nos outros casos; p_inicio/p_fim só nas leituras de período) e lança erro sem imprimir linha; ordenar(rows) por JSON; para o funil, comparar só etapa, quantidade, avancou_count e perdidos_count (tempo e gargalo dependem do relógio). Números esperados (derivados do desenho das fixtures; se um caso falhar depois da aplicação por suposição do próprio teste, corrigir o teste sem afrouxar nenhuma asserção de recorte, RLS ou formato antigo): recorte A -> clientes_por_etapa {conversa_comprador 1, primeira_venda 1}; ganhos_perdidos [{ganho, 1}]; tempo_ate_fechamento só o status ganho; prospecção por produto [{produto, 2}] e por categoria [{categoria, 2}]; funil com 7 linhas: aguardando_contato 2, conversa_comprador 1, demais 0 (inclusive aguardando_data_reuniao — prova da metade do histórico), perdidos_count todos 0. Recorte B -> clientes_por_etapa {aguardando_contato 1, aguardando_data_reuniao 1}; ganhos_perdidos [{perdido, 1}]; tempo só o status perdido; prospecções 2 e 2; funil aguardando_contato 2, aguardando_data_reuniao 1, conversa_comprador 0, perdidos_count de aguardando_contato 1. Casos: vendedor-sem-filtro-igual-ao-proprio (sessão A: nas 6 leituras, nulo == recorte A == números de A); vendedor-nao-amplia (sessão A com p_vendedor = id de B: clientes_por_etapa, ganhos_perdidos, tempo e as duas prospecções vazias; funil com 7 linhas e quantidade, avancou_count e perdidos_count todos 0); supervisor-filtra-a (sessão S, recorte A == números de A); supervisor-filtra-b (sessão S, recorte B == números de B); supervisor-sem-filtro-inclui-todos (sessão S, p_vendedor nulo: para cada leitura, total do resultado >= total A + total B, e no funil quantidade de aguardando_contato >= 4 — só com expect de booleano e mensagem SEM valores, porque esse resultado inclui a carteira real); chamada-antiga-continua-valendo (sessão A: as 6 leituras no formato antigo — sem argumento nas 3 primeiras, só p_inicio/p_fim nas outras — sem erro e iguais ao resultado com p_vendedor nulo; sessão S: as mesmas 6 chamadas antigas sem erro, resultado não comparado nem impresso); anonimo-sem-dados (cliente anônimo com p_vendedor = id de A: erro, ou resultado vazio/todo zero). afterAll: apaga os 4 clientes pelo serviço (histórico e produtos por cascata), depois os 3 membros, e confere pelo serviço que não sobrou linha em clientes, historico nem cliente_produtos para os ids criados, lançando erro com contagens (nunca linhas) se sobrou. NÃO executar este arquivo nesta tarefa — exceção registrada (CLAUDE.md pede teste passando antes de concluir): fica VERMELHO POR DESENHO até o dono aplicar a 0054 e só é exigido verde na Tarefa 6. Commit: `test(quick-261009-npp): add live tests for the dashboard vendor filter (red until 0054 is applied)`.
4. Checagem rápida de banco local, sem instalar nada: rodar `supabase --version` e `docker --version`; se algum existir, PROPOR ao orquestrador (passo opcional antes da Tarefa 5) rodar 0001..0054 num Postgres local descartável; se não, registrar a lacuna para o SUMMARY. Todo commit com a linha de coautoria da D-11; nunca adicionar .planning/config.json.
  </action>
  <verify>
    <automated>npx vitest run tests/dashboard/filtro-vendedor-migracao.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts tests/dashboard/aderencia-parcial-migracao.test.ts tests/funil/ganhos-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 tests/dashboard/filtro-vendedor-migracao.test.ts tests/dashboard/filtro-vendedor-rpc.test.ts && node -e "const fs=require('fs');const s=fs.readFileSync('tests/dashboard/filtro-vendedor-rpc.test.ts','utf8');const n=(s.match(/signInAs\(/g)||[]).length;if(n!==2)throw new Error('logins: '+n);if(/console\./.test(s))throw new Error('impressao');if(/SEED_ACCOUNTS/.test(s))throw new Error('contas semente');if(/acessos_diarios/.test(s))throw new Error('tabela de acesso diario citada');if(!/createTestMember\(/.test(s)||!/deleteTestMember\(/.test(s))throw new Error('fixtures');if(!s.includes('p_vendedor'))throw new Error('sem p_vendedor');if(!s.includes('Teste Filtro Vendedor'))throw new Error('sem prefixo de fixture');for(const c of ['vendedor-sem-filtro-igual-ao-proprio','vendedor-nao-amplia','supervisor-filtra-a','supervisor-filtra-b','supervisor-sem-filtro-inclui-todos','chamada-antiga-continua-valendo','anonimo-sem-dados']){if(!s.includes(c))throw new Error('caso ausente: '+c)}console.log('OK testes ao vivo (estrutura)')" && node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString().split('\n').map(s=>s.trim()).filter(Boolean);const b='b3401c9bed155f03b275a99e7417acba86b846ca';const m=g(['diff','--name-status',b,'HEAD','--','supabase/migrations']);if(m.length!==1||m[0]!=='A\tsupabase/migrations/0054_dashboard_filtro_vendedor.sql')throw new Error('migrations: '+m.join(' | '));const r=g(['diff','--name-status',b,'HEAD','--','supabase/rollbacks']);if(r.length!==1||r[0]!=='A\tsupabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql')throw new Error('rollbacks: '+r.join(' | '));console.log('OK uma migration e um arquivo de volta')"</automated>
  </verify>
  <acceptance_criteria>
    - Estrutural: rodada vermelha registrada e depois 7/7 verdes; inventário de 11 e estruturais 0049-0053 verdes sem edição.
    - A 0054 é exatamente o "Contrato SQL": begin; + 6 remoções de assinatura antiga + 6 leituras com p_vendedor uuid default null, corpos = fontes 0003/0037 sem comentários com só as trocas listadas + commit;; sem recarga de cache dentro do arquivo; cabeçalho ASCII num único bloco, sem as palavras begin/commit.
    - Arquivo de volta com a mesma moldura begin;/commit;, as 6 remoções das assinaturas novas e os 6 blocos das fontes, NAO APLICAR e a ordem código-antes-banco-depois.
    - Teste ao vivo usa o prefixo "Teste Filtro Vendedor" em toda razão social de fixture e os rótulos "filtro-vendedor-a/b/s" nos membros.
    - Desde a base b3401c9: exatamente uma linha "A" em supabase/migrations (0054) e uma em supabase/rollbacks; nenhuma migration antiga editada.
    - Teste ao vivo com os 7 casos, 2 logins, nada impresso, só fixtures, conferência de resíduo; NÃO executado nesta tarefa (vermelho por desenho até a aplicação — exceção registrada).
    - Resultado da checagem de banco local (supabase/docker) registrado para o SUMMARY; tsc e eslint limpos nos 2 arquivos de teste.
  </acceptance_criteria>
  <done>A 0054 (não aplicada) recria as 6 leituras com o recorte opcional e sem ambiguidade; volta atrás pronta; prova estrutural verde; prova ao vivo pronta para ficar verde após a aplicação.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Tarefa 2: Aprovação do dono — o que o filtro faz em cada quadro, o que fica sem filtro, alerta de LGPD, ordem segura (banco PRIMEIRO) e como voltar atrás</name>
  <read_first>
    - supabase/migrations/0054_dashboard_filtro_vendedor.sql (o que será aplicado)
    - supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql (o desfazer)
    - Escolhas P-01..P-10 deste plano
  </read_first>
  <action>Pausar a execução. Apresentar ao dono, em linguagem simples (ele não programa — CLAUDE.md), o texto dos blocos decision/context abaixo e só seguir depois de uma resposta explícita (per D-12). O dono precisa RESPONDER EXPLICITAMENTE às DUAS decisões do bloco context: (1) se aceita que "Comparativo por vendedor" (com a Aderência de uso) e "Desempenho por vendedor" fiquem SEM o filtro — elas já comparam os vendedores e a tela mostra um aviso quando um vendedor é escolhido —, ou se prefere estender o filtro também a Desempenho e Comparativo (replanejamento: a mudança no banco passa de 6 para 8 leituras); (2) se aceita os testes com contas temporárias no banco real. A Tarefa 3 NÃO começa sem as duas respostas registradas (per P-01). Se uma resposta vier vaga ("pode ser", "tanto faz"), reapresentar só aquela pergunta. Não enviar arquivo para aplicação, não rodar db push, não colar SQL antes da resposta. Ao devolver ao orquestrador com "aplicar", dizer EXPLICITAMENTE que NADA vai para staging nem master antes de o dono aplicar a 0054 na Tarefa 5 (per D-06). Caminhos do "ajustar": (a) só de tela (textos do seletor, do aviso das comparações, do subtítulo ou do vazio; posição do seletor) — registrar no SUMMARY e aplicar na Tarefa 4, sem retrabalho; (b) qualquer mudança de regra (decisão 1 respondida com "estender o filtro a Desempenho e Comparativo", destacar o vendedor nas comparações, incluir vendedores desativados na lista, recortar por quem era o responsável na época em vez do responsável atual, decisão 2 respondida com recusa) — registrar e devolver ao orquestrador para replanejar, sem implementar nada da Tarefa 3 em diante. Em (a), a aprovação para aplicar continua valendo se dada junto; senão reapresentar só a pergunta de aplicar.</action>
  <decision>Aprovar o filtro de vendedor no Dashboard como descrito e aplicar agora, no banco do sistema, a mudança 0054 — respondendo explicitamente à decisão 1 (Comparativo e Desempenho por vendedor ficam sem o filtro, ou estender a eles) e à decisão 2 (testes com contas temporárias)?</decision>
  <context>
    **Leia primeiro: a mudança no banco vale na hora, para o banco do time inteiro.** O site de teste e o site que a equipe usa guardam os dados no MESMO banco. Desta vez a mudança NÃO grava nem apaga dado nenhum: ela só ensina seis contas do Dashboard a aceitar um "recorte por vendedor". Sem recorte, cada conta dá exatamente o mesmo resultado de hoje, e o site atual continua funcionando igual depois da aplicação.

    **O que você vai ver na tela (só você, como Supervisor):**
    - Ao lado do filtro de período aparece "Vendedor", com "Todos os vendedores" (o padrão, igual a hoje) e o nome de cada vendedor ATIVO.
    - Escolhido um vendedor, o subtítulo muda para "Números de {nome}".
    - Os vendedores nunca veem esse seletor; cada vendedor continua vendo só os próprios números, como hoje.

    **O que o filtro muda em cada quadro, quando um vendedor é escolhido:**
    - Clientes por etapa: só os clientes desse vendedor.
    - Funil de conversão detalhado: só os clientes dele (quantidade, % que avançou, perdidos e tempo médio por etapa).
    - Tempo até fechamento: só os clientes dele.
    - Ganhos, Perdidos e Taxa de conversão: só os dele, dentro do período escolhido.
    - Prospecção por produto e por categoria: só os cadastros dele, dentro do período.
    - Quando ele não tem nenhum cliente, Clientes por etapa e o Funil mostram "Nenhum cliente deste vendedor.".

    **O que NÃO muda com o filtro (recomendação nossa — você decide na decisão 1 abaixo):**
    - "Comparativo por vendedor" (com a aderência de uso) e "Desempenho por vendedor" continuam mostrando TODOS os vendedores lado a lado, porque eles já são a comparação entre as pessoas — recortados para uma pessoa só, repetiriam os números dos cartões de Ganhos/Perdidos. A tela avisa isso quando um vendedor está escolhido: "Comparativo por vendedor e Desempenho por vendedor continuam mostrando todos os vendedores."

    **Detalhes que valem saber:**
    - Os números de cada vendedor contam os clientes que estão com ele HOJE. Se um cliente foi transferido, a história dele (ganho, perdido, tempo no funil) vai junto para o vendedor atual.
    - Vendedores desativados não aparecem na lista; os números deles continuam somados em "Todos os vendedores". Clientes cujo responsável é um Supervisor também só aparecem em "Todos".
    - Segurança: o recorte só ESTREITA. Quem decide o que cada pessoa pode ver continua sendo a regra de acesso do próprio banco. Mesmo que alguém tentasse mandar o código de outro vendedor, o banco não entrega nada além do que essa pessoa já pode ver — e um teste automático prova isso.

    **Duas decisões suas, explícitas (responda a CADA uma — sem as duas respostas eu não continuo):**
    1. **Comparativo e Desempenho sem o filtro.** Você ACEITA que "Comparativo por vendedor" (com a aderência de uso) e "Desempenho por vendedor" continuem mostrando todos os vendedores, mesmo com um vendedor escolhido (com o aviso na tela)? Ou você PREFERE que o filtro também valha para esses dois quadros? Nesse segundo caso eu paro e o plano é refeito: a mudança no banco passa de 6 para 8 contas, e isso pode atrasar a entrega antes da reunião de 13/10.
    2. **Testes com contas temporárias no banco real.** Para provar as regras de verdade, os testes automáticos criam, no MESMO projeto do Supabase usado em produção, contas temporárias (2 vendedores e 1 supervisor de teste) e 4 clientes temporários, todos com nomes inventados; a conta de supervisor de teste também lê os TOTAIS do Dashboard sem recorte (só números, nunca mostrados na tela do teste); no fim apagam tudo e conferem, por contagem antes e depois, que não sobrou nada. Você pode ACEITAR (mesmo procedimento já usado nas tarefas anteriores) ou RECUSAR — nesse caso volta para replanejamento.

    **Alerta de conformidade (LGPD) — leia com atenção:**
    - Nenhum dado novo é coletado nem guardado. O seletor mostra só o nome dos vendedores ativos, que você já vê hoje no Comparativo, na Agenda e na Equipe (nada de e-mail ou celular).
    - O filtro faz um recorte por pessoa de números que já existem — isso é dado de desempenho de funcionário. Recomendamos usar como acompanhamento do funil e apoio na reunião, não como avaliação individual isolada; evitar print ou compartilhamento fora da empresa; e lembrar que os números contam os clientes que estão com cada um HOJE.
    - Nenhuma regra nova de quem vê o quê; sem exportação nova.
    - Avalie o escopo à luz da LGPD; a decisão é sua, como responsável pelos dados.

    **Ordem segura que vamos seguir:**
    1. Eu termino a tela, só no computador (sem publicar nada).
    2. Você cola e roda a mudança no banco (próxima etapa de ação): o arquivo INTEIRO de uma vez — ele roda tudo junto, ou nada —, depois um comando curto de uma linha que manda o banco "reler" as contas, e então você abre o Dashboard do site real para ver que continua igual.
    3. Eu confiro com os testes automáticos contra o banco.
    4. Só então tudo vai para o site de teste (staging) para conferência, e depois para o site real — de preferência antes da reunião de 13/10.
    Por que nessa ordem: a tela nova manda o vendedor escolhido para o banco; se fosse publicada antes da mudança 0054, escolher um vendedor faria os quadros mostrarem erro.

    **Como voltar atrás, se precisar:** primeiro tirar do ar o código novo (desfazer as mudanças de tela desta tarefa e publicar), e SÓ DEPOIS colar o arquivo `supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql` no SQL Editor. Nada é apagado — só as contas do Dashboard voltam a ser como eram.
  </context>
  <options>
    <option id="aplicar">
      <name>Aprovar e aplicar agora (com "1: aceito as comparações sem filtro")</name>
      <pros>Filtro por vendedor nos 6 quadros a tempo da reunião de 13/10; nenhum dado novo; quem vê o quê não muda; "Todos" igual a hoje; volta atrás pronta e sem perda de dado.</pros>
      <cons>Comparativo e Desempenho não recortam (decisão 1 aceita); vendedores desativados não aparecem na lista; os números seguem o responsável atual do cliente.</cons>
    </option>
    <option id="estender-comparacoes">
      <name>Estender o filtro a Desempenho e Comparativo (decisão 1 = "prefiro filtrar também")</name>
      <pros>Todos os quadros do Dashboard respondem ao seletor.</pros>
      <cons>Replanejamento: a mudança no banco passa de 6 para 8 contas (desempenho e comparativo) e a tela das comparações muda; pode atrasar a entrega antes da reunião; nada da Tarefa 3 em diante é feito até o plano novo.</cons>
    </option>
    <option id="ajustar">
      <name>Ajustar antes de aplicar</name>
      <pros>Permite mudar textos e posição do seletor (sem retrabalho), ou pedir outra regra.</pros>
      <cons>Mudança de regra (incluir desativados, outra base de responsável, destacar o vendedor nas comparações, recusar os testes) volta para replanejamento e pode atrasar a entrega antes da reunião.</cons>
    </option>
  </options>
  <acceptance_criteria>
    - O dono respondeu "aplicar" (ou aprovação explícita equivalente) antes de qualquer envio de arquivo para aplicação, db push ou execução no SQL Editor.
    - O dono respondeu EXPLICITAMENTE à decisão 1 (aceita Comparativo por vendedor, com a Aderência, e Desempenho por vendedor SEM o filtro, ou pediu para estender -> caminho (b), replanejamento com 8 leituras) e à decisão 2 (aceita os testes com contas temporárias, ou recusou -> caminho (b), replanejamento). As duas respostas, com as palavras do dono, ficam no SUMMARY e estão registradas ANTES de qualquer commit da Tarefa 3.
    - O SUMMARY registra a resposta e a ciência de: efeito imediato no banco único (só leituras, nenhum dado gravado/apagado); o que cada quadro passa a fazer; Comparativo/Desempenho sem recorte (P-01); responsável atual (P-02); desativados fora da lista (P-10); os pontos do alerta de LGPD; a ordem com o banco PRIMEIRO; a volta atrás (código antes, banco depois, sem perda de dado).
    - O orquestrador foi avisado de que nada vai para staging/master antes da Tarefa 5; nenhum push pelo executor.
  </acceptance_criteria>
  <files>supabase/migrations/0054_dashboard_filtro_vendedor.sql, supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql (só leitura — o que é apresentado ao dono; nenhum arquivo muda neste checkpoint)</files>
  <verify>
    <automated>npx vitest run tests/dashboard/filtro-vendedor-migracao.test.ts && git diff --quiet HEAD -- supabase/migrations/0054_dashboard_filtro_vendedor.sql supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql && echo "OK arquivos apresentados = arquivos testados e commitados"</automated>
    <human-check>
      <test>Resposta explícita do dono ao texto deste checkpoint ("aplicar" + resposta à decisão 1 sobre Comparativo/Desempenho + resposta à decisão 2 sobre os testes; ou "estender ..." / "ajustar: ...").</test>
      <expected>"aplicar" (ou aprovação equivalente) e as respostas às decisões 1 e 2 registradas no SUMMARY antes da Tarefa 3.</expected>
      <why_human>Decisão do dono como responsável pelos dados (LGPD) e pela mudança no banco único.</why_human>
    </human-check>
  </verify>
  <resume-signal>Responda, por exemplo, "aplicar; 1: aceito Comparativo e Desempenho sem o filtro; 2: aceito os testes com contas temporárias" — ou "1: quero o filtro também em Desempenho e Comparativo" (replanejamento) — ou "ajustar: ..." descrevendo o que mudar.</resume-signal>
  <done>Decisão explícita do dono registrada (aplicar + respostas às decisões 1 e 2), com o que cada quadro faz, o que fica sem filtro, o alerta de LGPD, a ordem segura e a volta atrás reconhecidos, e o orquestrador ciente de que não publica nada antes da aplicação.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 3: Regra pura do vendedor, leitores com p_vendedor opcional, lista de vendedores ativos e Server Actions (vermelho -> verde)</name>
  <files>lib/dashboard/vendedorFiltro.ts, lib/supabase/queries/dashboard.ts, app/actions/dashboard.ts, tests/dashboard/filtro-vendedor-leitores.test.ts, tests/dashboard/filtro-vendedor-acoes.test.ts</files>
  <read_first>
    - lib/supabase/queries/dashboard.ts e app/actions/dashboard.ts (inteiros)
    - tests/dashboard/aderencia-uso-reader.test.ts (dublê de "@/lib/supabase/server" para leitores)
    - tests/dashboard/comparativo-vendedor-action.test.ts (dublê de sessão + leitores para ações)
    - app/(app)/agenda/page.tsx linhas 52-62 (consulta de nomes em profiles)
    - Seção "Interfaces" deste plano
  </read_first>
  <behavior>
    - tests/dashboard/filtro-vendedor-leitores.test.ts (dublê de "@/lib/supabase/server" com rpc e from encadeável; nomes de it exatos):
      - regra-vazio-e-todos: normalizarVendedorFiltro de nulo, indefinido, "" e "   " -> { ok: true, vendedorId: null }.
      - regra-uuid-valido: id minúsculo e id maiúsculo no formato 8-4-4-4-12 -> { ok: true, vendedorId: o mesmo texto }.
      - regra-invalido: "abc", "123", um uuid com um caractere a mais e um texto com aspas e ponto e vírgula -> { ok: false }.
      - leitores-sem-vendedor-chamada-de-hoje: getClientesPorEtapa(), getFunilDetalhado(), getTempoAteFechamento() (e com null) chamam rpc com SÓ o nome (mock.calls[i].length === 1); getGanhosPerdidos, getProspeccaoPorProduto e getProspeccaoPorCategoria com (inicio, fim) e com (inicio, fim, null) chamam com exatamente { p_inicio, p_fim } (sem a chave p_vendedor).
      - leitores-com-vendedor: com um id, as 3 primeiras chamam com { p_vendedor: id } e as 3 de período com { p_inicio, p_fim, p_vendedor: id }.
      - comparacoes-inalteradas: getDesempenhoVendedor(inicio, fim) continua chamando "dashboard_desempenho_vendedor" com exatamente { p_inicio, p_fim }; getComparativoVendedor chama só o nome.
      - vendedores-ativos: getVendedoresAtivosFiltro chama from("profiles"), select("id, nome, sobrenome"), eq("role", "vendedor"), eq("ativo", true), order("nome", { ascending: true }) e devolve [{ id, nome: "Nome Sobrenome" }] (sobrenome vazio ou nulo não deixa espaço sobrando); erro do banco -> lança.
    - tests/dashboard/filtro-vendedor-acoes.test.ts (dublês de "@/lib/supabase/server" para a sessão e de "@/lib/supabase/queries/dashboard" para os leitores; nomes de it exatos):
      - repassa-vendedor: cada uma das 6 ações com um id válido chama o seu leitor com esse id (as de período com (inicio, fim, id)) e devolve { data }.
      - sem-vendedor-repassa-nulo: sem o argumento e com null, o leitor recebe null.
      - vendedor-invalido-nao-chama-banco: id malformado -> { error: { code: "fetch_falhou" } } e o leitor NÃO é chamado.
      - sem-sessao: sem usuário -> { error: { code: "unauthenticated" } } e o leitor não é chamado.
      - comparacoes-inalteradas: getDesempenhoVendedorAction(inicio, fim) chama o leitor com exatamente (inicio, fim).
  </behavior>
  <action>
0. Pré-condição (per P-01): conferir que as respostas do dono às decisões 1 e 2 da Tarefa 2 estão registradas. Decisão 1 = "aceito Comparativo e Desempenho sem o filtro" -> seguir este plano. Decisão 1 = "estender" ou decisão 2 = "recuso" -> PARAR e devolver ao orquestrador para replanejar, sem nenhum commit desta tarefa.
1. RED — criar os 2 arquivos de teste do behavior (per D-07, D-09, P-04, P-05, P-06), com cabeçalho explicando que "Todos" mantém as chamadas idênticas às de hoje e que a validação do id é higiene de entrada, não autorização (a RLS decide). Rodar e confirmar que FALHAM. Commit: `test(quick-261009-npp): add failing tests for vendor filter rule, dashboard readers and actions`.
2. GREEN — criar lib/dashboard/vendedorFiltro.ts com normalizarVendedorFiltro e o tipo da seção "Interfaces" (sem React, sem Supabase; JSDoc dizendo que só confere o formato e que quem decide o que cada um vê é a RLS). Em lib/supabase/queries/dashboard.ts: acrescentar o parâmetro opcional vendedorId (padrão null, sempre o ÚLTIMO) aos 6 leitores; montar os argumentos do rpc de modo que sem vendedor a chamada seja byte a byte a de hoje (sem segundo argumento nas 3 leituras sem período; só p_inicio/p_fim nas outras) e com vendedor acrescente só p_vendedor (per P-04); acrescentar VendedorFiltroOpcao e getVendedoresAtivosFiltro (per P-06; só id, nome e sobrenome — minimização LGPD). Atualizar o comentário do topo do arquivo: o recorte p_vendedor é decidido no SQL e só estreita (RLS continua a fronteira, per D-03); o filtro por ativo dos agregados continua só no SQL, e a única leitura deste arquivo que filtra ativo é a LISTA de nomes do seletor. Leitores de desempenho, comparativo e aderência intocados (per P-01). Em app/actions/dashboard.ts: as 6 ações ganham vendedorId opcional como ÚLTIMO parâmetro; depois da checagem de sessão, normalizarVendedorFiltro — inválido devolve o mesmo erro "fetch_falhou" com a mensagem atual, sem chamar o leitor; válido repassa o vendedorId normalizado (null para "Todos"). getDesempenhoVendedorAction e getComparativoVendedorAction intocados. Atualizar os JSDoc das ações afetadas citando o recorte opcional. Rodar até verde, junto com os testes existentes do verify (SEM editá-los; se o tsc ou um teste existente exigir mudança, mudar DE PROPÓSITO e registrar no SUMMARY o motivo). Commit: `feat(quick-261009-npp): optional vendor filter in dashboard readers and actions, active vendor list`. Linha de coautoria da D-11; nunca adicionar .planning/config.json.
  </action>
  <verify>
    <automated>npx vitest run tests/dashboard/filtro-vendedor-leitores.test.ts tests/dashboard/filtro-vendedor-acoes.test.ts tests/dashboard/comparativo-vendedor-action.test.ts tests/dashboard/aderencia-uso-reader.test.ts tests/dashboard/aderencia-exibicao.test.ts tests/dashboard/periodo.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 lib/dashboard/vendedorFiltro.ts lib/supabase/queries/dashboard.ts app/actions/dashboard.ts tests/dashboard/filtro-vendedor-leitores.test.ts tests/dashboard/filtro-vendedor-acoes.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada; os 12 casos novos verdes; comparativo-vendedor-action, aderencia-uso-reader, aderencia-exibicao e periodo verdes sem edição.
    - Sem vendedor, as 6 chamadas rpc são idênticas às de hoje; com vendedor, só p_vendedor é acrescentado; desempenho/comparativo/aderência inalterados.
    - Id malformado nunca chega ao banco; ação sem sessão continua devolvendo unauthenticated.
    - getVendedoresAtivosFiltro lê só id, nome e sobrenome de vendedores ativos, em ordem de nome.
    - tsc e eslint --max-warnings 0 limpos nos 5 arquivos.
  </acceptance_criteria>
  <done>A camada de dados aceita o recorte opcional por vendedor sem mudar nenhuma chamada de "Todos", e a lista de vendedores ativos está pronta para a página.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 4: Seletor "Vendedor" no Dashboard (só Supervisor) e fiação nos 6 quadros afetados (vermelho -> verde)</name>
  <files>components/dashboard/VendedorFilter.tsx, components/dashboard/DashboardClient.tsx, components/dashboard/ClientesPorEtapaChart.tsx, components/dashboard/FunilDetalhadoTable.tsx, components/dashboard/TempoAteFechamentoCards.tsx, components/dashboard/GanhosPerdidosCards.tsx, components/dashboard/ProspeccaoChart.tsx, app/(app)/dashboard/page.tsx, tests/dashboard/dashboard-filtro-vendedor.test.tsx</files>
  <read_first>
    - components/dashboard/DashboardClient.tsx e os 5 quadros listados (efeitos de carga e estados de vazio)
    - components/agenda/AgendaList.tsx linhas 165-180 e 320-350 (molde do seletor — copiar, nunca importar)
    - tests/agenda/agenda-calendario-integracao.test.tsx linhas 236-266 (interação com o Select do Base UI)
    - tests/dashboard/funil-detalhado-table.test.tsx (dublê das ações do Dashboard)
    - app/(app)/dashboard/page.tsx
  </read_first>
  <behavior>
    - tests/dashboard/dashboard-filtro-vendedor.test.tsx (jsdom; dublê de "@/app/actions/dashboard" com as 8 ações devolvendo { data: [] }; vendedores inventados "Alice Teste" e "Bruno Teste" com ids no formato uuid; se o Recharts exigir ResizeObserver no jsdom, criar um stub mínimo no próprio teste; nomes de it exatos):
      - vendedor-nao-ve-filtro: isSupervisor falso -> não existe combobox "Vendedor" nem o texto "Todos os vendedores"; getClientesPorEtapaAction chamada com null; getGanhosPerdidosAction com terceiro argumento null; subtítulo "Seus números de vendas".
      - supervisor-ve-todos-e-ativos: isSupervisor verdadeiro -> combobox "Vendedor" mostrando "Todos os vendedores"; aberto, as opções são, nesta ordem, "Todos os vendedores", "Alice Teste", "Bruno Teste"; subtítulo "Números da equipe".
      - escolher-vendedor-filtra-seis-quadros: escolher "Alice Teste" -> a ÚLTIMA chamada de getClientesPorEtapaAction, getFunilDetalhadoAction e getTempoAteFechamentoAction recebe o id da Alice; a última de getGanhosPerdidosAction, getProspeccaoPorProdutoAction e getProspeccaoPorCategoriaAction recebe (inicio, fim, id da Alice); subtítulo "Números de Alice Teste"; aparece o aviso "Comparativo por vendedor e Desempenho por vendedor continuam mostrando todos os vendedores."
      - comparacoes-nao-filtram: depois de escolher a Alice, TODA chamada de getComparativoVendedorAction tem zero argumentos e TODA chamada de getDesempenhoVendedorAction tem exatamente 2 argumentos.
      - voltar-para-todos: escolher de novo "Todos os vendedores" -> as últimas chamadas dos 6 quadros voltam a receber null; subtítulo "Números da equipe"; o aviso some.
      - vazio-do-vendedor: com a Alice escolhida e { data: [] }, "Nenhum cliente deste vendedor." aparece exatamente 2 vezes (Clientes por etapa e Funil) e "Nenhum cliente cadastrado ainda." não aparece; sem vendedor, o texto antigo aparece 2 vezes.
    - Testes de tela existentes (ganhos-perdidos-cards, funil-detalhado-table, tempo-ate-fechamento-cards, comparativo-vendedor-table) continuam verdes SEM edição.
  </behavior>
  <action>
1. RED — criar tests/dashboard/dashboard-filtro-vendedor.test.tsx com os 6 casos do behavior (per D-01, D-07, D-09, P-01, P-07), renderizando o DashboardClient REAL (quadros reais, só as ações com dublê) e esperando as chamadas com waitFor. Rodar e confirmar que FALHA. Commit: `test(quick-261009-npp): add failing tests for the dashboard vendor select and wiring`.
2. GREEN — criar components/dashboard/VendedorFilter.tsx ("use client"), cópia de comportamento do seletor da Agenda (per D-07): sentinela própria "__todos__", Label "Vendedor" ligado ao id "dashboard-filtro-vendedor", Select com items, SelectTrigger com esse id e className "w-56", placeholder e primeira opção "Todos os vendedores", uma SelectItem por vendedor com o nome; troca para a sentinela vira null. Nos 5 quadros afetados (mudança mecânica): prop opcional vendedorId (padrão null), incluída nas dependências do efeito de carga e repassada à ação como último argumento (ClientesPorEtapaChart, FunilDetalhadoTable, TempoAteFechamentoCards: action(vendedorId); GanhosPerdidosCards: action(inicio, fim, vendedorId); ProspeccaoChart: tipo da prop action passa a (inicio, fim, vendedorId: string | null) e a chamada repassa o vendedorId); em ClientesPorEtapaChart e FunilDetalhadoTable o texto de vazio vira "Nenhum cliente deste vendedor." quando há vendedorId e continua "Nenhum cliente cadastrado ainda." sem ele (per P-07); atualizar o JSDoc de cada quadro citando o recorte opcional. DashboardClient: nova prop vendedorOptions (padrão []); estado vendedorId (null); vendedor efetivo = vendedorId só quando isSupervisor (senão sempre null — o Vendedor nunca envia recorte, per D-01); linha de filtros com PeriodoFilter e, só para o Supervisor, VendedorFilter; subtítulo "Números de {nome}" com vendedor escolhido, senão o texto atual; quando há vendedor escolhido, o aviso do P-01 logo abaixo dos filtros (texto exato do behavior); vendedor efetivo repassado a ClientesPorEtapaChart, FunilDetalhadoTable, TempoAteFechamentoCards, GanhosPerdidosCards e às duas ProspeccaoChart — NUNCA a ComparativoVendedorTable nem a DesempenhoVendedorChart (per P-01); atualizar o JSDoc do componente (quais quadros recebem período e quais recebem vendedor). app/(app)/dashboard/page.tsx: só quando isSupervisor, carregar getVendedoresAtivosFiltro com falha virando lista vazia, e passar vendedorOptions ao DashboardClient (Vendedor recebe []); atualizar o JSDoc da página. ComparativoVendedorTable.tsx, DesempenhoVendedorChart.tsx e PeriodoFilter.tsx NÃO são tocados. Rodar até verde, junto com os testes de tela existentes do verify (SEM editá-los; se algum exigir mudança, mudar DE PROPÓSITO e registrar o motivo). Commit: `feat(quick-261009-npp): vendor select on the dashboard (supervisor only) wired to the six filtered blocks`. Linha de coautoria da D-11; nunca adicionar .planning/config.json.
  </action>
  <verify>
    <automated>npx vitest run tests/dashboard/dashboard-filtro-vendedor.test.tsx tests/dashboard/ganhos-perdidos-cards.test.tsx tests/dashboard/funil-detalhado-table.test.tsx tests/dashboard/tempo-ate-fechamento-cards.test.tsx tests/dashboard/comparativo-vendedor-table.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 components/dashboard/VendedorFilter.tsx components/dashboard/DashboardClient.tsx components/dashboard/ClientesPorEtapaChart.tsx components/dashboard/FunilDetalhadoTable.tsx components/dashboard/TempoAteFechamentoCards.tsx components/dashboard/GanhosPerdidosCards.tsx components/dashboard/ProspeccaoChart.tsx "app/(app)/dashboard/page.tsx" tests/dashboard/dashboard-filtro-vendedor.test.tsx && git diff --quiet b3401c9bed155f03b275a99e7417acba86b846ca -- components/dashboard/ComparativoVendedorTable.tsx components/dashboard/DesempenhoVendedorChart.tsx components/dashboard/PeriodoFilter.tsx && echo "OK comparacoes e periodo intocados"</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada; os 6 casos novos verdes; os 4 testes de tela existentes verdes sem edição.
    - Só o Supervisor vê o seletor; o Vendedor nunca envia recorte; escolher um vendedor recarrega exatamente os 6 quadros afetados com o id; Comparativo e Desempenho nunca recebem o id; "Todos" volta a mandar null.
    - Subtítulo, aviso das comparações e vazio "Nenhum cliente deste vendedor." como no behavior; carregando/erro de cada quadro continuam os de hoje (cada quadro carrega sozinho).
    - ComparativoVendedorTable, DesempenhoVendedorChart e PeriodoFilter idênticos à base; tsc e eslint limpos nos 9 arquivos.
  </acceptance_criteria>
  <done>O Supervisor escolhe um vendedor e os 6 quadros afetados mostram só os números dele; as comparações continuam com todos; o Vendedor não vê nada de novo.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Tarefa 5: [BLOCKING] Dono aplica a 0054 pelo SQL Editor da Supabase (ANTES de qualquer publicação do código)</name>
  <read_first>
    - .planning/STATE.md, seção Blockers/Concerns (aplicação manual pelo dono, mesmo caminho das quick 261008-mrf/261008-rxw)
  </read_first>
  <action>Pré-condição da ordem segura (per D-06, D-12), conferida IMEDIATAMENTE antes de enviar o arquivo ao dono: rodar o comando automatizado do verify (git fetch origin + nenhum commit feat desta quick ancestral de origin/staging nem de origin/master). O executor nunca faz push. Se algum estiver publicado, avisar o orquestrador e o dono NA HORA, em linguagem simples, que naquele site escolher um vendedor no Dashboard mostra erro até a 0054 ser aplicada ("Todos" continua normal), e seguir com a aplicação imediatamente (ela é a correção). Enviar ao dono o arquivo supabase/migrations/0054_dashboard_filtro_vendedor.sql pela ferramenta de envio de arquivo ao usuário; se não houver, informar o caminho absoluto. NÃO enviar o arquivo de volta para aplicação. Nada de db push nem contorno (gerar credencial, extrair token, API de gerenciamento) — per D-06. Passar ao dono as instruções do bloco how-to-verify e aguardar.</action>
  <what-built>Um arquivo de mudança no banco (0054), aprovado na Tarefa 2, pronto para colar no SQL Editor. O seletor de vendedor e a fiação estão só no computador (commits locais).</what-built>
  <how-to-verify>
    1. Abrir o SQL Editor do projeto: https://supabase.com/dashboard/project/afbiwgbqkogsrhxjshkk/sql/new
    2. Colar o conteúdo INTEIRO de `0054_dashboard_filtro_vendedor.sql` de uma vez só (do comentário do topo até a última linha; o comentário pode ir junto, é seguro). Não colar em pedaços e não deixar só um trecho selecionado — com um trecho selecionado o SQL Editor roda só aquele trecho. Clicar em "Run" e esperar "Success. No rows returned". O arquivo começa e termina com as palavras que fazem tudo rodar como um bloco só: ou tudo é aplicado, ou nada é.
    3. Se aparecer qualquer erro, copiar a mensagem e mandar aqui antes de tentar de novo (com erro, nada foi aplicado).
    4. Passo padrão, SEMPRE, logo depois do "Success": abrir uma aba NOVA do SQL Editor, colar só esta linha e clicar em "Run": `notify pgrst, 'reload schema';` — ela manda o sistema "reler" as contas do Dashboard. Esperar uns 10 segundos.
    5. Abrir o Dashboard do site REAL (o que a equipe usa), como Supervisor, e conferir que todos os quadros carregam como antes (nenhum "Não foi possível carregar os dados do dashboard"). Isso prova que o site de hoje continua funcionando com o banco novo.
    6. Se algum quadro mostrar erro: rodar de novo a linha do passo 4, esperar e recarregar. Se continuar com erro, colar o arquivo `0054_volta_dashboard_filtro_vendedor.sql` INTEIRO (neste momento é seguro, porque o código novo ainda não foi publicado), rodar de novo a linha do passo 4 e mandar a mensagem aqui.
    7. Fora do caso do passo 6, NÃO colar o arquivo `0054_volta_dashboard_filtro_vendedor.sql` — ele só serve se um dia você quiser desfazer.
  </how-to-verify>
  <files>supabase/migrations/0054_dashboard_filtro_vendedor.sql (só leitura — enviado ao dono; nenhum arquivo do projeto muda neste checkpoint)</files>
  <verify>
    <automated>git fetch origin && HS=$(git log --format=%H -F --grep="feat(quick-261009-npp)" b3401c9bed155f03b275a99e7417acba86b846ca..HEAD) && test -n "$HS" && for H in $HS; do if git merge-base --is-ancestor "$H" origin/staging || git merge-base --is-ancestor "$H" origin/master; then echo "PUBLICADO $H"; exit 1; fi; done && echo "OK codigo ainda nao publicado (pre-condicao da ordem segura)"</automated>
    <human-check>
      <test>O dono cola a 0054 INTEIRA de uma vez no SQL Editor, roda em seguida a linha de recarga do passo 4 e confere o Dashboard do site real.</test>
      <expected>"Success. No rows returned" na 0054 e na linha de recarga, confirmado pelo dono ("aplicado"), e Dashboard do site real carregando todos os quadros; o arquivo de volta não foi colado (ou, se foi pelo passo 6, isso foi informado).</expected>
      <why_human>O executor nunca aplica SQL no banco de produção (D-06); só o dono aplica, pelo SQL Editor.</why_human>
    </human-check>
  </verify>
  <resume-signal>Responda "aplicado, recarga feita, Dashboard do site real normal" depois de ver "Success" nas duas, ou cole a mensagem de erro.</resume-signal>
  <acceptance_criteria>
    - Pré-condição conferida imediatamente antes de enviar o arquivo (nenhum commit feat desta quick em origin/staging nem origin/master), ou o aviso foi dado; o executor não fez push.
    - O dono confirmou que colou o arquivo INTEIRO de uma vez, viu "Success" na 0054, rodou a linha de recarga do cache como instrução separada (passo padrão, P-11) e conferiu o Dashboard do site real funcionando (registrado no SUMMARY); o arquivo de volta não foi aplicado (ou o uso do passo 6 foi registrado e a execução parou para o orquestrador).
    - Nenhuma tentativa de db push ou contorno pelo executor.
    - O SUMMARY sugere ao dono, como passo opcional, `supabase migration repair --status applied 0054` (a 0054 é re-executável: remoção com "if exists" + "create or replace").
  </acceptance_criteria>
  <done>A 0054 está aplicada no banco, confirmada pelo dono, com o site atual funcionando, antes de qualquer publicação do código novo.</done>
</task>

<task type="auto">
  <name>Tarefa 6: [BLOCKING] Testes ao vivo a VERDE contra o banco real + gate final + guarda de escopo + SUMMARY</name>
  <files>tests/dashboard/filtro-vendedor-rpc.test.ts (só se precisar de correção do próprio teste)</files>
  <read_first>
    - tests/dashboard/filtro-vendedor-rpc.test.ts
    - supabase/migrations/0054_dashboard_filtro_vendedor.sql (aplicada)
    - .planning/STATE.md, Blockers/Concerns (limite de tentativas de login do Supabase Auth; ~49 arquivos vermelhos pré-existentes — NÃO rodar a suíte inteira)
  </read_first>
  <action>
1. Rodar a guarda de escopo (primeiro comando do verify, base b3401c9bed155f03b275a99e7417acba86b846ca, per D-10) e depois, isolado, a sequência do verify com contagem de resíduo (per P-12, W4 do checador): contagem ANTES (o comando de contagem do verify usa o cliente de serviço com contagem exata e SEM baixar linha nenhuma, e devolve só dois números: clientes cuja razão social começa com o prefixo inventado "Teste Filtro Vendedor" e membros de teste com nome "Fixture"), `npx vitest run tests/dashboard/filtro-vendedor-rpc.test.ts`, contagem DEPOIS — as duas linhas de números precisam ser idênticas. Registrar no SUMMARY os dois pares de números (são só contagens de fixtures, nenhum dado real). Se ANTES já vier com clientes de fixture maior que zero, é sobra de uma rodada anterior desta mesma quick: registrar. Se DEPOIS diferir de ANTES: conferir pelo serviço, só por contagem, apagar só clientes com o prefixo desta quick e depois só membros de teste com rótulo filtro-vendedor (clientes antes dos membros — FK sem ON DELETE), repetir a contagem até igualar e registrar. Repetir o arquivo ao vivo até ficar verde. Se um caso falhar por comportamento do banco (Vendedor recebendo dado de outro com o recorte, recorte não estreitando, chamada antiga com erro, "Todos" diferente do recorte do próprio Vendedor), PARAR e reportar ao orquestrador: a correção vira migration NOVA (0055 em diante) com nova aprovação do dono pelo caminho das Tarefas 2 e 5 — nunca edição da 0054 aplicada nem do arquivo de volta, e nunca função elevada. Se falhar por suposição do próprio teste (por exemplo um número esperado das fixtures), corrigir sem afrouxar nenhuma asserção de recorte, RLS, formato antigo ou resíduo, e registrar. Resíduo acusado no afterAll: conferir pelo serviço (sem imprimir linhas), apagar só ids de fixture e registrar. Limite de login: esperar e repetir o arquivo isolado, registrando. Nunca imprimir linhas lidas.
2. Prova extra de regressão do formato antigo: rodar, isolado, `npx vitest run tests/dashboard/encerrado-preserva-historico.test.ts` (fixture própria, 1 login, chama 5 leituras no formato antigo). Verde: registrar. Vermelho: se a mensagem indicar leitura não encontrada/ambígua ou número diferente numa das 6 leituras recriadas, PARAR e reportar (mesmo caminho do passo 1); se a causa for alheia a esta quick, registrar a causa sem "consertar" o teste.
3. Rodar o verify completo. Se um teste JÁ EXISTENTE da lista do gate falhar sem relação aparente com esta quick, conferir se ele já falhava na base criando uma árvore de trabalho temporária de b3401c9 na pasta de rascunho da sessão (git worktree add), rodando só aquele arquivo lá e removendo a árvore depois; registrar — nunca "consertar" teste alheio para passar.
4. Registrar no SUMMARY, em português simples: (a) resposta do dono na Tarefa 2, com as palavras dele: "aplicar", a decisão 1 (aceitou Comparativo por vendedor, com a Aderência, e Desempenho por vendedor SEM o filtro, com o aviso na tela) e a decisão 2 (testes com contas temporárias), registradas ANTES da Tarefa 3, e ajuste de tela, se houve; (b) pré-condição conferida e aplicação pelo dono (Tarefa 5): arquivo colado inteiro de uma vez (transação única begin/commit), recarga do cache do PostgREST rodada como passo padrão separado, conferência do Dashboard do site real; (c) resultado dos 7 casos ao vivo, das contagens de fixtures ANTES e DEPOIS (só números, iguais), da prova extra do formato antigo e do gate (arquivos/testes, tsc, eslint, BUILD_EXIT); o VERMELHO antes da aplicação era esperado e NÃO foi medido; (d) o que o filtro faz em cada quadro, em linguagem de tela, e o que fica sem filtro (P-01) com o porquê; (e) alerta de LGPD (nenhum dado novo; só nome de vendedor ativo; recorte por pessoa de números existentes; uso como acompanhamento; sem exportação; inventário de 11 intacto; nenhuma regra nova de acesso); (f) testes mudados DE PROPÓSITO (esperado: nenhum) e por quê; (g) o raciocínio da armadilha de versões duplicadas (remoção das assinaturas antigas) e do "só estreita", em palavras simples; (h) testes ao vivo do Dashboard NÃO executados e por quê — dependem das contas semente apagadas: clientes-por-etapa, comparativo-vendedor, desempenho-vendedor, funil-detalhado, ganhos-perdidos, prospeccao, rls-dashboard; tocam a tabela de acesso diário e a aderência não mudou: acessos-diarios, aderencia-uso, aderencia-parcial; (i) itens adiados: `supabase migration repair --status applied 0054` (opcional); destacar o vendedor nas comparações ou incluir desativados (só se o dono pedir); (j) conferência humana do Preview da staging pendente e instrução ao orquestrador: AGORA (banco aplicado + gate verde) enviar os commits para staging, conferir o Preview e só depois levar para master — de preferência antes da reunião de 13/10; (k) como voltar atrás: primeiro reverter os commits feat das Tarefas 3 e 4 e publicar; só depois colar supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql (sem perda de dado); (l) linha de coautoria usada (D-11); (m) lacuna de execução real: o SQL da 0054 só rodou num Postgres de verdade na colagem do dono — antes disso a prova foi estrutural; resultado da checagem de banco local da Tarefa 1; (n) exceção registrada à regra "nenhuma tarefa concluída sem testes passando" (CLAUDE.md): os testes ao vivo da Tarefa 1 ficaram vermelhos por desenho até a aplicação e só foram exigidos verdes aqui; (o) tamanhos das tarefas aceitos pelo checador (W3; P-13): Tarefa 4 com 9 arquivos de mudança mecânica (uma prop e uma dependência por quadro) e Tarefa 1 com 4 arquivos, sem divisão do plano.
Commit `test(quick-261009-npp): ...` só se algum teste ao vivo precisou de correção (linha de coautoria, sem .planning/config.json); caso contrário, nenhum commit de código nesta tarefa. Não fazer push.
  </action>
  <verify>
    <automated>node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString();const base='b3401c9bed155f03b275a99e7417acba86b846ca';console.log('BASE='+g(['rev-parse',base]).trim());const ok=new Set(['supabase/migrations/0054_dashboard_filtro_vendedor.sql','supabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql','tests/dashboard/filtro-vendedor-migracao.test.ts','tests/dashboard/filtro-vendedor-rpc.test.ts','lib/dashboard/vendedorFiltro.ts','lib/supabase/queries/dashboard.ts','app/actions/dashboard.ts','tests/dashboard/filtro-vendedor-leitores.test.ts','tests/dashboard/filtro-vendedor-acoes.test.ts','components/dashboard/VendedorFilter.tsx','components/dashboard/DashboardClient.tsx','components/dashboard/ClientesPorEtapaChart.tsx','components/dashboard/FunilDetalhadoTable.tsx','components/dashboard/TempoAteFechamentoCards.tsx','components/dashboard/GanhosPerdidosCards.tsx','components/dashboard/ProspeccaoChart.tsx','app/(app)/dashboard/page.tsx','tests/dashboard/dashboard-filtro-vendedor.test.tsx']);const permitido=f=>f.startsWith('.planning/')||ok.has(f);const mudados=g(['diff','--name-only',base,'HEAD']).split('\n').map(s=>s.trim()).filter(Boolean);const sujos=g(['status','--porcelain']).split('\n').filter(Boolean).filter(l=>!l.startsWith('??')).map(l=>l.slice(3).trim());const fora=mudados.concat(sujos).filter(f=>!permitido(f));if(fora.length)throw new Error('fora do escopo: '+fora.join(', '));const mig=g(['diff','--name-status',base,'HEAD','--','supabase/migrations']).split('\n').map(s=>s.trim()).filter(Boolean);if(mig.length!==1||mig[0]!=='A\tsupabase/migrations/0054_dashboard_filtro_vendedor.sql')throw new Error('migrations: '+mig.join(' | '));const rb=g(['diff','--name-status',base,'HEAD','--','supabase/rollbacks']).split('\n').map(s=>s.trim()).filter(Boolean);if(rb.length!==1||rb[0]!=='A\tsupabase/rollbacks/0054_volta_dashboard_filtro_vendedor.sql')throw new Error('rollbacks: '+rb.join(' | '));console.log('OK escopo 261009-npp')" && ANTES=$(node --env-file=.env.local -e "const {createClient}=require('@supabase/supabase-js');const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});Promise.all([s.from('clientes').select('id',{count:'exact',head:true}).ilike('razao_social','Teste Filtro Vendedor%'),s.from('profiles').select('id',{count:'exact',head:true}).eq('nome','Fixture')]).then(([c,p])=>{if(c.error||p.error){process.stderr.write('falha na contagem');process.exit(1)}process.stdout.write('clientes_fixture='+c.count+' membros_fixture='+p.count)})") && echo "ANTES $ANTES" && npx vitest run tests/dashboard/filtro-vendedor-rpc.test.ts && DEPOIS=$(node --env-file=.env.local -e "const {createClient}=require('@supabase/supabase-js');const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});Promise.all([s.from('clientes').select('id',{count:'exact',head:true}).ilike('razao_social','Teste Filtro Vendedor%'),s.from('profiles').select('id',{count:'exact',head:true}).eq('nome','Fixture')]).then(([c,p])=>{if(c.error||p.error){process.stderr.write('falha na contagem');process.exit(1)}process.stdout.write('clientes_fixture='+c.count+' membros_fixture='+p.count)})") && echo "DEPOIS $DEPOIS" && test "$ANTES" = "$DEPOIS" && echo "OK contagem de fixtures igual antes e depois" && npx vitest run tests/dashboard/filtro-vendedor-migracao.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts tests/dashboard/aderencia-parcial-migracao.test.ts tests/funil/ganhos-migracao.test.ts tests/dashboard/filtro-vendedor-leitores.test.ts tests/dashboard/filtro-vendedor-acoes.test.ts tests/dashboard/comparativo-vendedor-action.test.ts tests/dashboard/aderencia-uso-reader.test.ts tests/dashboard/aderencia-exibicao.test.ts tests/dashboard/periodo.test.ts tests/dashboard/dashboard-filtro-vendedor.test.tsx tests/dashboard/ganhos-perdidos-cards.test.tsx tests/dashboard/funil-detalhado-table.test.tsx tests/dashboard/tempo-ate-fechamento-cards.test.tsx tests/dashboard/comparativo-vendedor-table.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 lib/dashboard/vendedorFiltro.ts lib/supabase/queries/dashboard.ts app/actions/dashboard.ts components/dashboard/VendedorFilter.tsx components/dashboard/DashboardClient.tsx components/dashboard/ClientesPorEtapaChart.tsx components/dashboard/FunilDetalhadoTable.tsx components/dashboard/TempoAteFechamentoCards.tsx components/dashboard/GanhosPerdidosCards.tsx components/dashboard/ProspeccaoChart.tsx "app/(app)/dashboard/page.tsx" tests/dashboard/filtro-vendedor-migracao.test.ts tests/dashboard/filtro-vendedor-rpc.test.ts tests/dashboard/filtro-vendedor-leitores.test.ts tests/dashboard/filtro-vendedor-acoes.test.ts tests/dashboard/dashboard-filtro-vendedor.test.tsx && (npm run build; code=$?; echo "BUILD_EXIT=$code"; exit $code)</automated>
    <human-check>
      <test>Depois que o orquestrador enviar os commits para a branch staging, abrir o link de Preview da staging na Vercel (projeto RAIAR; exige login na Vercel), como Supervisor: (1) no Dashboard, ao lado do período, aparece "Vendedor" com "Todos os vendedores" e os nomes dos vendedores ativos; (2) com "Todos", os números são os mesmos do site real; (3) escolhendo um vendedor, o subtítulo vira "Números de {nome}", Clientes por etapa, Funil, Tempo até fechamento, Ganhos/Perdidos/Taxa e as duas Prospecções mudam, e Comparativo/Desempenho continuam com todos, com o aviso; (4) como um vendedor (se tiver uma conta de vendedor para testar), o seletor não aparece. Só olhar — não editar cliente real para testar. Não fotografar nem compartilhar a tela fora da empresa.</test>
      <expected>Seletor só para o Supervisor, "Todos" igual ao site real, 6 quadros recortados, comparações com todos, aviso visível, resto do site igual.</expected>
      <why_human>Conferência visual no site publicado de teste antes de levar para produção (CLAUDE.md, Fluxo de Deploy); os testes automáticos não abrem o Preview da Vercel.</why_human>
    </human-check>
  </verify>
  <acceptance_criteria>
    - tests/dashboard/filtro-vendedor-rpc.test.ts verde por inteiro (7 casos) contra o banco real, sem resíduo acusado; contagem de fixtures (clientes com o prefixo "Teste Filtro Vendedor" e membros "Fixture") IGUAL antes e depois, só números, registrada no SUMMARY; resultado da prova extra do formato antigo registrado.
    - SUMMARY com as respostas do dono às decisões 1 e 2 da Tarefa 2 e com o aceite dos tamanhos das tarefas (W3).
    - Gate verde: estruturais (0054 + inventário + 0049-0053), dados (leitores, ações, testes existentes), tela (novo + 4 existentes sem edição); tsc; eslint --max-warnings 0 nos 16 arquivos de código/teste tocados; BUILD_EXIT=0 impresso.
    - Guarda de escopo OK desde b3401c9: só os 18 arquivos planejados (mais .planning/); supabase/migrations com exatamente uma linha "A" (0054); supabase/rollbacks com exatamente uma linha "A".
    - Nenhuma asserção de recorte, RLS, formato antigo ou resíduo afrouxada; qualquer correção ou migration nova registrada.
    - SUMMARY com os itens (a)-(o) da action; nenhum push pelo executor.
  </acceptance_criteria>
  <done>O recorte por vendedor está no banco e provado contra ele, a tela está pronta (commits locais) para ir ao staging, e o pacote inteiro está dentro do escopo combinado.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador (Supervisor/Vendedor/visitante) -> Server Action -> PostgREST -> dashboard_* (0054) | vendedorId vindo do navegador (não confiável); as leituras rodam como quem chama e só a RLS decide as linhas |
| código hoje em produção -> PostgREST -> dashboard_* (0054) | chamadas no formato antigo (sem p_vendedor) precisam continuar resolvendo para uma única versão |
| executor/dono -> banco de produção | 6 leituras removidas e recriadas com efeito imediato no banco único; só com aprovação explícita e aplicação pelo dono |
| commits locais -> branch staging -> branch master | código novo manda p_vendedor; Preview usa o mesmo banco da produção |
| dono (controlador) -> vendedores (titulares) | recorte por pessoa de métricas de desempenho |
| suíte de testes -> banco de produção | fixtures temporárias e leitura de totais agregados no projeto que guarda dados reais |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-npp-01 | Information Disclosure | Vendedor mandando p_vendedor de outro vendedor para ler os números dele | high | mitigate | Recorte só na forma "(p_vendedor is null or responsavel = p_vendedor)" sobre leituras sem elevação (estrutural filtro-so-estreita e sem-elevacao-escrita-restrita); ao vivo vendedor-nao-amplia e anonimo-sem-dados; o Vendedor nem envia recorte pela tela (DashboardClient) |
| T-npp-02 | Elevation of Privilege | leitura recriada com privilégio elevado, permissão ou regra de acesso nova | high | mitigate | Estrutural sem cláusula de elevação, sem grant/revoke/policy; inventário de 11 em tests/agenda2/migracao-agenda2.test.ts sem edição; guarda de escopo |
| T-npp-03 | Denial of Service | versão duplicada da leitura tornando ambígua a chamada antiga do código em produção, ou Dashboard sem leitura entre a remoção e a recriação | high | mitigate | Remoção da assinatura antiga antes de criar a nova, no mesmo arquivo (migracao-exata); arquivo inteiro dentro de begin;/commit; (P-09, contagens no estrutural) e dono instruído a colar o arquivo INTEIRO de uma vez; recarga do cache do PostgREST como passo padrão separado logo após o Success (P-11); conferência do Dashboard do site real; ao vivo chamada-antiga-continua-valendo + encerrado-preserva-historico; volta atrás segura como reserva (Tarefa 5) |
| T-npp-04 | Tampering (disponibilidade) | código novo publicado antes da 0054 | medium | mitigate | P-04 ("Todos" mantém a chamada antiga — só a escolha de vendedor falharia); D-06: commits só locais; pré-condição automatizada da Tarefa 5; publicação só depois da Tarefa 6 |
| T-npp-05 | Tampering | vendedorId malformado vindo do navegador | low | mitigate | normalizarVendedorFiltro antes do banco (vendedor-invalido-nao-chama-banco); parâmetro enviado como valor pelo PostgREST, nunca concatenado em SQL |
| T-npp-06 | Spoofing | chamada das ações sem sessão | medium | mitigate | getUser mantido em todas as ações (sem-sessao); página protegida pelo grupo (app) |
| T-npp-07 | Information Disclosure (LGPD) | nomes de vendedores no seletor e recorte de desempenho por pessoa | medium | mitigate | Só Supervisor, só vendedores ativos, só id e nome (getVendedoresAtivosFiltro); nenhum dado novo coletado; alerta de LGPD e orientação de uso no checkpoint da Tarefa 2; sem exportação |
| T-npp-08 | Information Disclosure (LGPD) | testes ao vivo no banco real (contas temporárias, leitura de totais agregados) | medium | mitigate | Aceite explícito do dono (Tarefa 2; recusa -> replanejamento); fixtures inventadas (prefixo "Teste Filtro Vendedor"), 2 logins, totais reais só em comparações booleanas sem valores, nada impresso, sem tocar a tabela de acesso diário, conferência de resíduo no afterAll + contagem antes/depois só de números na Tarefa 6 (P-12) |
| T-npp-09 | Tampering | aplicação em produção sem revisão | high | mitigate | Checkpoint bloqueante da Tarefa 2; o dono aplica pelo SQL Editor; executor nunca aplica, nunca faz push nem db push |
| T-npp-10 | Tampering (integridade da métrica) | mudança acidental na lógica de alguma conta ao recriar a leitura | medium | mitigate | migracao-exata: 0054 = fontes 0003/0037 sem comentários com só as trocas listadas; fontes-sao-as-ultimas-definicoes; volta-restaura-anteriores |
| T-npp-11 | Denial of Service | comentário de dois hífens ou caractere não ASCII quebrando a colagem | low | mitigate | Estrutural comentarios-seguros e volta-restaura-anteriores |
| T-npp-12 | Tampering | edição de migration antiga | medium | mitigate | Guarda de escopo (uma migration nova, nenhuma antiga alterada) |
| T-npp-13 | Repudiation (interpretação) | números atribuídos ao responsável ATUAL, não ao da época | low | accept | Decisão P-02 explicada ao dono no checkpoint; mesma base do Comparativo desde a Fase 12; mudança de regra vira replanejamento |
| T-npp-14 | Repudiation (interpretação) | dono supor que Comparativo/Desempenho também foram recortados | low | mitigate | Decisão explícita 1 da Tarefa 2 respondida ANTES da Tarefa 3 e registrada no SUMMARY; aviso na tela quando um vendedor está escolhido (teste escolher-vendedor-filtra-seis-quadros) |
| T-npp-SC | Tampering | instalação de pacotes | low | accept | Nenhuma dependência nova nesta quick (Select, Label e helpers de teste já existem) — sem install, sem checkpoint de legitimidade |
</threat_model>

<source_audit>
SOURCE  | ID   | Item | Tarefa | Status
------- | ---- | ---- | ------ | ------
GOAL    | —    | Filtro por vendedor no Dashboard inteiro, "Todos" = hoje, para a reunião de 13/10 | 1, 3, 4, 5, 6 | COVERED
REQ     | QUICK-261009-npp | Pedido do dono de 2026-10-09 (esclarecido: Dashboard inteiro) | 1-6 | COVERED
CONTEXT | D-01 | Todos + vendedores ativos, só nome, só Supervisor, ao lado do período | 3 (getVendedoresAtivosFiltro), 4 | COVERED
CONTEXT | D-02 | p_vendedor uuid default null nas 6 leituras; decisão sobre desempenho/comparativo/aderência | 1 (contrato), 2 (decisão explícita 1 do dono, antes da Tarefa 3), 3 (pré-condição), P-01 | COVERED
CONTEXT | D-03 | Só estreita sobre a RLS, sem checagem de papel; prova ao vivo de que o Vendedor não amplia | 1 (filtro-so-estreita, vendedor-nao-amplia) | COVERED
CONTEXT | D-04 | Remover assinaturas antigas + criar novas numa única 0054; código em produção continua valendo | 1 (migracao-exata, chamada-antiga-continua-valendo), 5 (conferência do site real), 6 | COVERED
CONTEXT | D-05 | Corpo = anterior com só as trocas; ASCII barra-asterisco; sem elevação; inventário 11; sem policy; volta atrás NAO APLICAR | 1 | COVERED
CONTEXT | D-06 | Banco primeiro; nada publicado antes; agente nunca aplica SQL | 2, 5 (pré-condição), 6 | COVERED
CONTEXT | D-07 | Seletor reaproveitando Select e molde da Agenda; id para todo quadro afetado; vazio/carregando; Vendedor nunca vê | 4 | COVERED
CONTEXT | D-08 | Alerta LGPD (sem dado novo, recorte por pessoa, acompanhamento) | 2, 6 (SUMMARY e) | COVERED
CONTEXT | D-09 | Estrutural, ao vivo (2 logins, inventados, nada impresso, sem resíduo, sem tabela de acesso diário, não executados antes), componentes, testes existentes atualizados de propósito | 1, 3, 4, 6 | COVERED
CONTEXT | D-10 | Gate (testes afetados, tsc, eslint, build com exit code, escopo); sem suíte legada; registrar testes que dependem das contas apagadas | 6 | COVERED
CONTEXT | D-11 | Commits locais, sem push, coautoria, sem .planning/config.json | 1, 3, 4, 6 | COVERED
CONTEXT | D-12 | Checkpoints em português: decisão -> aplicação -> gate | 2, 5, 6 | COVERED
</source_audit>

<verification>
- Tarefa 1: estrutural vermelho -> verde (7 casos, incluindo migracao-exata com a moldura begin;/commit; e volta-restaura-anteriores); inventário de 11 e estruturais 0049-0053 sem edição; uma migration nova e um arquivo de volta desde a base; ao vivo escrito (7 casos, prefixo de fixture) e não executado.
- Tarefa 2: aprovação explícita com o efeito por quadro, LGPD, ordem com banco primeiro e volta atrás; respostas explícitas às decisões 1 (Comparativo/Desempenho sem filtro, ou estender = replanejamento) e 2 (testes) registradas ANTES da Tarefa 3; orquestrador avisado para não publicar.
- Tarefa 3: regra pura, leitores e ações vermelho -> verde; chamadas de "Todos" idênticas às de hoje; testes existentes sem edição.
- Tarefa 4: seletor e fiação vermelho -> verde; comparações e período intocados; testes de tela existentes sem edição.
- Tarefa 5: nada publicado conferido imediatamente antes; dono cola a 0054 INTEIRA de uma vez com "Success", roda a recarga do cache como passo padrão separado e confere o Dashboard do site real.
- Tarefa 6: 7 casos ao vivo verdes sem resíduo; contagem de fixtures igual antes e depois; prova extra do formato antigo registrada; gate verde (BUILD_EXIT=0); guarda de escopo OK (18 arquivos); tamanhos das tarefas aceitos registrados; Preview pendente para depois do envio à staging.
</verification>

<success_criteria>
- O Supervisor escolhe "Todos os vendedores" ou um vendedor ativo ao lado do período; com um vendedor, Clientes por etapa, Funil detalhado, Tempo até fechamento, Ganhos/Perdidos/Taxa e as duas Prospecções mostram só os clientes que estão com ele hoje; com "Todos", tudo é igual a hoje.
- Comparativo e Desempenho por vendedor continuam com todos os vendedores, com aviso na tela; o Vendedor não vê o seletor.
- Um Vendedor que mande o id de outro não recebe nada além dos próprios clientes — decidido só pela RLS, provado ao vivo.
- Exatamente uma migration nova (0054) e um arquivo de volta, sem função elevada nova, sem policy nova, sem migration antiga editada; o código atual de produção continuou funcionando depois da aplicação.
- O dono aprovou (com o alerta de LGPD) e aplicou a 0054 ANTES de qualquer publicação; testes ao vivo verdes depois disso.
</success_criteria>

<output>
Criar `.planning/quick/261009-npp-filtro-por-vendedor-no-dashboard/261009-npp-SUMMARY.md` com os itens (a)-(o) da Tarefa 6, os hashes dos commits, o BASE impresso pela guarda e as notas para o dono em linguagem simples.
Não fazer push. Ordem para o orquestrador: NADA vai para staging antes de o dono aplicar a 0054 (Tarefa 5) e o gate da Tarefa 6 ficar verde; depois disso, staging -> conferência do Preview -> master (CLAUDE.md, "Fluxo de Deploy"), de preferência antes da reunião de 13/10.
</output>
