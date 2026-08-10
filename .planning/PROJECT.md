# CRM Raiar — Acompanhamento de Vendas

## What This Is

Um CRM de acompanhamento de vendas (funil/kanban) para substituir um CRM pago de custo elevado. Vendedores cadastram e trabalham clientes PJ ao longo de um funil de 7 etapas, do primeiro contato até a primeira venda concluída; um supervisor acompanha todos os clientes do time, tem um dashboard gerencial, e pode importar clientes em massa via planilha ou exportar a lista que enxerga. A partir do v1.3, o sistema também cuida do pós-venda: cliente "ganho" entra numa rotina de visitas recorrentes, e uma Agenda única junta tarefas de prospecção e visitas de pós-venda numa lista só, ordenada por urgência — com conclusão registrada (resumo + data + autor), diário por cliente, e planilhas para operar a frequência de visita e a exportação do diário em escala. Construído com custo zero de infraestrutura, pra validar a ideia antes de qualquer investimento em escala.

## Core Value

O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado — porque hoje o preenchimento no CRM pago é ruim (telas longas, esquecimento) e isso é o motivo real de trocar de ferramenta.

## Business Context

- **Customer**: equipe interna de vendas (vendedores + supervisor) — uso interno, não é um produto vendido a terceiros
- **Revenue model**: nenhum — o retorno é econômico (deixar de pagar pelo CRM atual)
- **Success metric**: time passa a usar o funil no dia a dia e o sistema cobre as necessidades gerenciais (incluindo dashboard) a ponto de o CRM pago poder ser cancelado
- **Strategy notes**: —

## Current State

**Shipped:** v1.0 MVP (Autenticação, Cadastro + Funil, Administração de Listas, Dashboard Gerencial), v1.1 Importação e Exportação de Clientes (2026-07-25), v1.2 Gestão de Equipe, Análises de Funil e Filtros (2026-08-06), e v1.3 Agenda do Vendedor (2026-08-10).

O CRM está em uso — login/papéis, cadastro e funil kanban completos, dashboard gerencial, importação/exportação em massa de clientes, o Supervisor consegue desativar um membro da equipe com segurança (transferindo os clientes em andamento), o dashboard mostra onde o funil trava (por etapa e por vendedor), os filtros de Estado/Cidade são listas estruturadas confiáveis, e agora o sistema também cobre o pós-venda: cliente "ganho" define uma frequência de visita (individualmente ou em massa via planilha), uma Agenda única junta o que precisa ser feito (prospecção + visitas), concluir exige um resumo curto que vira diário por cliente, e o diário pode ser exportado.

## Next Milestone Goals

Nada capturado ainda. Rode `/gsd-new-milestone` para começar o próximo marco.

## Requirements

### Validated

- ✓ Vendedor cadastra cliente PJ com mínimo obrigatório (razão social, endereço, responsável) e completa os demais dados depois — v1.0
- ✓ Cliente PJ tem: razão social, endereço (CEP, rua, número, complemento), categoria, contato, telefone, email, responsável, produtos consumidos, número de lojas (opcional) — v1.0
- ✓ Vendedor visualiza e movimenta no funil (kanban de 7 etapas) apenas os próprios clientes — v1.0
- ✓ Supervisor visualiza e movimenta no funil todos os clientes, de todos os vendedores — v1.0
- ✓ Vendedor pode editar os próprios clientes; apagar cliente é restrito ao supervisor — v1.0
- ✓ Supervisor pode cadastrar um cliente e atribuir a um vendedor específico — v1.0
- ✓ Card no funil tem status_acompanhamento: em andamento, perdido, ou ganho — v1.0
- ✓ Ao marcar um card como perdido, é obrigatório registrar o motivo (lista de motivos editável pelo supervisor) — v1.0
- ✓ Card tem observação (texto livre) e tarefas (lista editável pelo supervisor), cada tarefa com sua própria data de conclusão — v1.0
- ✓ Cards parados/atrasados ficam visualmente destacados no kanban ao abrir a tela — v1.0
- ✓ Histórico automático de mudanças por cliente (etapa, status, tarefas concluídas) — v1.0
- ✓ Busca e filtro na lista de clientes (por vendedor, categoria, produto, texto livre por razão social) — v1.0
- ✓ Supervisor faz CRUD de 4 listas editáveis: categoria do cliente, produtos consumidos, tipos de tarefa, motivos de perda — v1.0
- ✓ Autenticação via Supabase Auth com dois papéis (Supervisor, Vendedor) — v1.0
- ✓ Dashboard gerencial: clientes por etapa do funil, ganhos x perdidos, desempenho por vendedor, taxa de conversão, prospecções por produto e por categoria — v1.0
- ✓ Vendedor vê uma versão do dashboard só com os próprios números; supervisor vê os números de todo o time — v1.0
- ✓ Supervisor importa clientes em massa via planilha (Excel/CSV), com tela de mapear colunas pros campos do sistema — v1.1
- ✓ Sistema mostra erros e possíveis duplicados por linha antes de confirmar a importação, e revalida duplicados de novo no momento de gravar — v1.1
- ✓ Um lote de importação nunca é travado por uma linha ruim: linhas válidas são gravadas mesmo se outras tiverem erro ou forem puladas — v1.1
- ✓ Cliente importado sempre entra na etapa "Aguardando contato" do funil — v1.1
- ✓ Vendedor exporta a lista dos próprios clientes; Supervisor exporta a lista de todos os clientes, respeitando os mesmos filtros da tela — v1.1
- ✓ Supervisor desativa um membro da equipe, escolhendo antes pra quem transferir os clientes dele — v1.2
- ✓ Sistema nunca permite desativar o último Supervisor ativo — v1.2
- ✓ Dashboard mostra um funil de conversão detalhado por etapa (negócios, % de avanço, perdidos, tempo médio parado) — v1.2
- ✓ Dashboard mostra a média de dias até ganhar e até perder um cliente, separadamente — v1.2
- ✓ Dashboard mostra uma tabela comparando os vendedores (conversão, negócios iniciados/ganhos, ciclo médio), visível só pro Supervisor — v1.2
- ✓ Cada coluna do kanban tem rolagem própria com altura fixa, em vez de crescer a página infinitamente — v1.2
- ✓ Filtro de clientes usa Estado (sigla) antes de Cidade, e Cidade vira lista dependente do Estado escolhido — v1.2
- ✓ Estado é padronizado como lista de siglas em todo lugar que aparece (cadastro, edição, filtro, importação) — v1.2
- ✓ Vendedor vê uma agenda única com tarefas de prospecção e visitas de pós-venda juntas, ordenada por atrasado → hoje → próximos dias — v1.3
- ✓ Item de menu "Agenda" aparece no topo do menu principal, acima de "Clientes", mostrando a contagem de itens pendentes — v1.3
- ✓ Itens atrasados na Agenda ficam destacados visualmente, mesmo padrão do kanban — v1.3
- ✓ Vendedor vê só a própria agenda; Supervisor vê a agenda de todo o time e filtra por vendedor — v1.3
- ✓ Ao marcar um card como "ganho", o vendedor define a frequência de visita (semanal/quinzenal/mensal/nenhuma) — v1.3
- ✓ A frequência de visita pode ser editada ou cancelada a qualquer momento, sempre o mesmo valor entre ficha e agenda — v1.3
- ✓ Ao concluir uma visita, o sistema sugere a próxima data com base na frequência (calculada no banco); o vendedor confirma ou ajusta, nunca automático — v1.3
- ✓ Clientes já "ganho" antes do v1.3 começam sem frequência definida, nada suposto automaticamente — v1.3
- ✓ Ao concluir uma tarefa de prospecção ou visita pela Agenda, o vendedor escreve um resumo curto (10-500 caracteres) antes da conclusão ser aceita — v1.3
- ✓ Cada cliente tem um diário de visitas/tarefas concluídas (resumo + data + autor), visível ao vendedor responsável e ao Supervisor — v1.3
- ✓ Cliente "ativo" (ganho) aceita Nome Fantasia e CNPJ na ficha, nunca exigidos no cadastro rápido — v1.3
- ✓ Cliente ativo aceita frequência de pedidos (lista fixa gerenciada pelo Supervisor), só informativo — v1.3
- ✓ Supervisor define a frequência de visita de vários clientes "ganho" de uma vez, via planilha (mesmo fluxo já conhecido de importação) — v1.3
- ✓ Vendedor/Supervisor exporta o diário de visitas/tarefas concluídas como planilha, respeitando a mesma visibilidade da exportação de clientes — v1.3

### Active

Nada capturado ainda — próximo marco a definir via `/gsd-new-milestone`.

### Out of Scope

- Notificações ativas (email, push) de tarefas atrasadas — destaque visual no kanban já resolve o problema de esquecimento, sem custo/complexidade de um serviço de notificação
- Colunas do funil editáveis por permissão — as 7 etapas ficam fixas no código, pra reduzir complexidade
- App mobile nativo — web responsivo é suficiente
- Integração contínua (sync/API) com o CRM pago atual — o objetivo é substituí-lo, não integrar com ele
- Importação em massa pelo Vendedor — restrita ao Supervisor, decisão explícita do dono do projeto, confirmada e implementada em v1.1
- Validação de CNPJ na importação — adiado para uma v2 se vier a ser necessário (v1.1 valida só os campos mínimos de cadastro)
- Lembrar o mapeamento de colunas entre importações — cada planilha é mapeada do zero por enquanto (v1.1); útil se o volume de importações recorrentes crescer
- Importação como atualização de cliente existente — v1.1 só cria clientes novos; atualizar em massa fica para uma versão futura, se necessário
- Valor em R$ / ticket médio por negócio — o CRM não rastreia valor monetário de cliente hoje; adiado até virar necessidade real (v1.2 só trouxe métricas de tempo/conversão)
- Filtro de período (últimos 30/90 dias etc.) no funil de conversão detalhado — v1.2 mostra só o total geral desde sempre; filtro de data fica pra quando for pedido
- Apagar conta do membro desativado por completo — quebraria FKs de histórico (`clientes.responsavel`, `historico.autor_id`); desativação (soft, via `profiles.ativo` + Auth `ban_duration`) preserva integridade — v1.2
- Cadastro de cidades fora da lista oficial IBGE — a lista oficial cobre todos os municípios brasileiros reais; não há necessidade de entrada livre — v1.2
- Calendário completo (arrastar entre dias, visão de mês, recorrência customizável) na Agenda — uma lista ordenada por urgência já resolve "o que fazer hoje/essa semana"; as 4 frequências fixas cobrem o caso real — v1.3
- Reagendamento/troca automática e silenciosa da próxima visita — contradiz a decisão de sempre pedir confirmação do vendedor — v1.3
- Otimização de rota / mapeamento geográfico de visitas — fora do problema real do time (disciplina de funil, não deslocamento); exigiria serviço pago — v1.3
- Resumo de visita gerado por IA / transcrição automática — exigiria serviço pago de terceiros; campo de texto curto obrigatório já resolve — v1.3
- Priorização "inteligente" da Agenda por valor do negócio — CRM não rastreia valor monetário de cliente; ordenação simples por data já é suficiente na escala do time — v1.3
- Reatribuição de tarefas entre vendedores pela Agenda — sem necessidade demonstrada; o caso real (vendedor desativado) já foi resolvido no v1.2 — v1.3
- Opções de recorrência de visita além de semanal/quinzenal/mensal/nenhuma — mais opções = mais decisão no momento do "ganho", contra a mínima fricção — v1.3

## Context

- **Motivação**: hoje a empresa paga por um CRM externo com custo elevado, e o time de vendas não preenche direito — telas com muitos campos e esquecimento de atualizar o funil são as duas causas apontadas pelo usuário.
- **Origem do mapeamento de domínio**: existe um wireframe (Excalidraw) do fluxo de vendas atual, já documentado em `CLAUDE.md` — usuários/papéis, cliente PJ, funil de 7 etapas e os 3 enums editáveis originais (categoria, produtos consumidos, tipos de tarefa). O motivo de perda (4º enum editável) surgiu durante esta conversa de inicialização.
- **Migração de dados**: existe uma base de clientes no CRM pago atual que precisa ser trazida para o sistema novo. Na v1.0 isso foi tratado como migração única, fora da UI — na v1.1 essa decisão foi revista e implementada: o time recebe planilhas de clientes/leads com frequência (parceiros, feiras), e a importação agora é uma tela permanente do sistema, restrita ao Supervisor.
- **Perfil do usuário**: quem pilota o projeto não programa. Explicações devem evitar jargão técnico, focar em sintomas observáveis, e mudanças grandes precisam de um plano em linguagem simples antes de qualquer implementação.
- **Estado do código pós-v1.3**: Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS), sem backend Node separado. v1.3 adicionou: enum `frequencia_visita_enum` + 4 colunas nullable em `clientes` (nome_fantasia/cnpj/frequencia_pedidos/frequencia_visita), tabela `visitas` (RLS parent-gated, espelha `tarefas`), coluna `resumo` em `tarefas`, `mover_card_funil` estendido (6 parâmetros), RPC `agenda_do_vendedor()` (SECURITY INVOKER, une tarefas+visitas pendentes), RPCs atômicas `concluir_tarefa_prospeccao`/`concluir_visita` (SECURITY INVOKER), tabela `frequencias_pedido` (5ª lista editável do projeto), e RPC `atualizar_frequencia_visita_lote` (SECURITY INVOKER, escrita em massa). O projeto continua com exatamente 4 exceções `SECURITY DEFINER` documentadas: `is_supervisor()`, `desativar_membro_equipe`/`reativar_membro_equipe`, `cidades_com_clientes_por_estado()` — nenhuma nova em v1.3, apesar de 5 migrations novas (0013-0017).
- **Débito técnico conhecido**: nenhum item bloqueante. Um gap de verificação humana ficou formalmente aceito (Fase 8 — drag-and-drop com auto-scroll do kanban não foi exercitado por um teste automatizado nem por um drag real de mouse numa sessão anterior; risco julgado baixo por ser mudança isolada de CSS/layout, ver `.planning/phases/08-rolagem-por-coluna-no-kanban/08-VERIFICATION.md`). Um `eslint-disable` pontual e documentado permanece em `ClienteDetailSheet.tsx` (~linha 227) cobrindo um efeito de reset com ~13 setState — a Fase 16 acrescentou 3 campos + 1 seção nesse arquivo sem piorar a supressão (verificado mecanicamente), mas a correção com o padrão "ajustar estado durante o render" continua como quick task futura. A decisão de produto da caixinha antiga de "concluir tarefa" na ficha do cliente (não exige resumo, ao contrário do fluxo novo pela Agenda) foi deliberadamente deixada como está na Fase 16 — dois caminhos de conclusão com regras diferentes, aceito de propósito para não expandir o escopo da fase.

## Constraints

- **Custo**: free tier do Supabase (Postgres + Auth + Storage) + Vercel — objetivo é validar a ideia com custo zero de infraestrutura antes de investir em escala
- **Stack**: Next.js (React/TypeScript) + Supabase — fixado em `CLAUDE.md`, não muda sem discutir antes
- **Autorização**: sempre via Supabase Auth + RLS; nenhuma lógica de permissão "feita à mão" no frontend ou em backend próprio
- **Usuário não-técnico**: decisões técnicas precisam ser explicadas em 1-2 frases sem jargão; mudanças grandes exigem plano prévio em linguagem simples

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cadastro de cliente com mínimo obrigatório (razão social + endereço + responsável) | Reduzir a fricção que hoje trava o preenchimento no CRM pago | ✓ Good |
| Motivo de perda vira uma lista editável pelo supervisor (não texto livre) | Precisa ser agregável no dashboard gerencial | ✓ Good |
| Colunas do funil fixas no MVP | Menos complexidade pra validar a ideia primeiro | ✓ Good |
| Sem notificações ativas no MVP, só destaque visual no kanban | Resolve o esquecimento de atualização sem custo/complexidade de um serviço de notificação | ✓ Good |
| Dashboard gerencial entra no MVP, não fica para depois | Critério de sucesso do usuário inclui informação gerencial completa antes de migrar de vez para o novo sistema | ✓ Good |
| Vendedor edita os próprios clientes; apagar fica restrito ao supervisor | Confirmado explicitamente pelo usuário, resolve a dúvida em aberto sobre permissões de vendedor | ✓ Good |
| Migração de dados do CRM atual passa a ser recorrente via tela de importação (revisão da decisão de v1.0) | O time continua recebendo listas de clientes/leads em planilha (não é só uma migração única); precisa virar funcionalidade permanente | ✓ Good |
| Importação em massa restrita ao Supervisor | Decisão explícita do dono do projeto — Vendedor não tem acesso a essa função | ✓ Good |
| Cliente importado sempre entra em "Aguardando contato" | Simplicidade: planilha não precisa de coluna de etapa, todo cliente novo começa do zero no funil | ✓ Good |
| Exportação segue a mesma regra de visibilidade (RLS) do funil | Reaproveita a autorização já existente, sem lógica de permissão nova | ✓ Good |
| Revisão antes de gravar: planilha é mapeada e cada linha classificada (OK/erro/duplicado) antes de qualquer escrita no banco | Dá ao supervisor uma chance de corrigir a planilha ou decidir pular linhas problemáticas antes do lote virar clientes de verdade | ✓ Good |
| Duplicado é revalidado de novo no momento de confirmar (não confia só na checagem da revisão) | Cobre o caso raro de outro cadastro parecido ter entrado no intervalo entre revisão e confirmação | ✓ Good |
| Linha pulada (erro ou duplicado não importado) não deixa registro permanente no sistema — só aparece no resumo daquela operação | Evita uma tabela nova só pra isso; a planilha original já é o registro, com o supervisor | ✓ Good |
| Gravação em lote via inserção set-based (`INSERT ... ON CONFLICT DO NOTHING`), não um loop linha a linha | Necessário pelo limite de ~10s de execução do Vercel Hobby; garante que uma linha ruim nunca trava o lote inteiro | ✓ Good |
| RPC de importação segue o padrão de `mover_card_funil`: não-security-definer, guard explícito de `is_supervisor()` | Mantém a regra "toda autorização passa pelo RLS" (`CLAUDE.md`), sem lógica de permissão paralela dentro da função | ✓ Good |
| Desativação de membro é soft-delete (`profiles.ativo` + Auth `ban_duration`), nunca apaga a conta | Preserva integridade referencial do histórico (`clientes.responsavel`, `historico.autor_id`) sem quebrar FKs | ✓ Good |
| `desativar_membro_equipe`/`reativar_membro_equipe` são as únicas RPCs `SECURITY DEFINER` do projeto, documentadas como exceção deliberada | Precisam chamar a Auth Admin API via `service_role` para banir/desbanir login, algo que RLS sozinho não alcança | ✓ Good |
| Cidade sempre vem da lista oficial do IBGE, sem opção de texto livre | A lista cobre todos os municípios reais do Brasil; texto livre só reintroduziria o problema de dado inconsistente que a Fase 9 resolveu | ✓ Good |
| Tempo médio por etapa do funil inclui clientes ainda parados nela agora (usa o momento atual como saída provisória) | De propósito, para revelar cards travados — é o objetivo da métrica, não um bug | ✓ Good |
| Ciclo médio em dias (comparativo por vendedor) conta só fechamentos "ganho", nunca "perdido" | "Ciclo de venda" é o tempo até vender, não até desistir — misturar os dois distorceria a métrica | ✓ Good |
| "Ativo" é sinônimo de `status_acompanhamento = 'ganho'` — sem um segundo campo/estado | Evita duas fontes de verdade pra a mesma pergunta ("esse cliente já é ativo?") | ✓ Good |
| `frequencia_visita` é um valor só, guardado uma vez em `clientes` — editar pela ficha ou pela Agenda leva ao mesmo lugar | Nunca dessincroniza; ATV-03 e VIS-01/02 são a mesma coluna vista de dois ângulos | ✓ Good |
| Sem cron/worker de fundo — a próxima data de visita é calculada no momento da escrita (RPC `concluir_visita`), com confirmação síncrona do vendedor | Mantém o custo zero de infraestrutura; nada é agendado silenciosamente | ✓ Good |
| Cálculo de data feito no Postgres (nunca `new Date(string)` no navegador), coluna sempre `date` puro | Primeiro cálculo de data no servidor do projeto — evita o bug clássico de fuso horário (meia-noite UTC vira o dia anterior em São Paulo) | ✓ Good |
| Concluir uma visita é uma RPC atômica única (fecha visita + grava histórico + cria próxima), nunca 3 chamadas do cliente | Falha de rede no meio deixaria o cliente com visita fechada e nenhuma próxima marcada | ✓ Good |
| `resumo` chega ao `historico` pelo trigger `SECURITY DEFINER` já existente, nunca uma policy de INSERT nova | Mantém a trilha de auditoria à prova de adulteração pela API — regra absoluta desde o v1.0 | ✓ Good |
| Frequência de pedidos (ATV-02) virou lista fixa gerenciada pelo Supervisor, não texto livre — decisão do dono do projeto, override do default de texto livre proposto na pesquisa | Evita "mensal"/"Mensal"/"1x por mês" convivendo na mesma base; consistente com o padrão das outras 4 listas editáveis do projeto | ✓ Good |
| Caixinha antiga de "concluir tarefa" na ficha do cliente (sem exigir resumo) foi deixada como está, coexistindo com o fluxo novo pela Agenda (que exige resumo) | Menor risco, sem scope creep na Fase 16; o gatilho já trata a ausência de resumo com um texto padrão no histórico | ✓ Good |
| Renomear um valor de `frequencias_pedido` depois NÃO propaga para clientes que já usam o nome antigo (armazenamento por texto, não por referência) | Evita um ALTER TABLE em `clientes` (que já tem dados reais) só para trocar texto por FK — troca é rara | ✓ Good |
| `atualizar_frequencia_visita_lote` é uma única instrução UPDATE, sem INSERT, restrita a `status_acompanhamento = 'ganho'` — garantido pela forma do SQL, não por disciplina de tela | Torna estruturalmente impossível a planilha de frequências criar um cliente novo | ✓ Good |
| Planilha de frequências em massa trata nome ambíguo (2+ clientes com o mesmo nome normalizado) como erro de linha, nunca grava no cliente errado | Descoberto durante a Fase 17: a normalização de nome (remove acento/caixa/sufixo) pode colidir dois clientes distintos | ✓ Good |
| Exportação do diário sempre usa o escopo total visível por RLS, ignorando o filtro de vendedor ativo na tela da Agenda | Decisão do dono do projeto: exportar é uma ação separada de "tudo que eu posso ver", evita o Supervisor esquecer o filtro ligado e exportar menos do que queria | ✓ Good |

## Evolution

Este documento evolui nas transições de fase e nos marcos do projeto.

**Após cada transição de fase** (via `/gsd-transition`):
1. Requisitos invalidados? → Mover para Out of Scope com o motivo
2. Requisitos validados? → Mover para Validated com a referência da fase
3. Novos requisitos surgiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda está correto? → Atualizar se a realidade mudou

**Após cada marco** (via `/gsd-complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value ainda é a prioridade certa?
3. Business Context ainda reflete a realidade (customer, success metric)?
4. Auditar Out of Scope — os motivos ainda são válidos?
5. Atualizar Context com o estado atual (usuários, feedback, métricas)

---
*Last updated: 2026-08-10 — after v1.3 milestone (Agenda do Vendedor)*
