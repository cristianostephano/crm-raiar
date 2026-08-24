# CRM Raiar — Acompanhamento de Vendas

## What This Is

Um CRM de acompanhamento de vendas (funil/kanban) para substituir um CRM pago de custo elevado. Vendedores cadastram e trabalham clientes PJ ao longo de um funil de 7 etapas, do primeiro contato até a primeira venda concluída; um supervisor acompanha todos os clientes do time, tem um dashboard gerencial, e pode importar clientes em massa via planilha ou exportar a lista que enxerga. A partir do v1.3, o sistema também cuida do pós-venda: cliente "ganho" entra numa rotina de visitas recorrentes, e uma Agenda única junta tarefas de prospecção e visitas de pós-venda numa lista só, ordenada por urgência — com conclusão registrada (resumo + data + autor), diário por cliente, e planilhas para operar a frequência de visita e a exportação do diário em escala. A partir do v1.4, CNPJ passa a ser exigido no exato momento em que um cliente vira "ganho" — travado no banco, não só na tela — sem afetar quem já é "ganho" sem CNPJ nem o cadastro rápido anterior ao "ganho"; duas planilhas (CNPJ+Nome Fantasia na importação de clientes novos, e "CNPJ em massa" pra regularizar quem já é ganho) dão ao Supervisor os dois caminhos de preenchimento em escala. A partir do v1.5, a Agenda ganha uma segunda forma de visualização — um calendário de dia/semana/mês, navegável, mostrando também o que já foi concluído em datas passadas — ao lado da lista original; e concluir um item deixa de pressupor visita presencial: o vendedor pode marcar que não foi presencial e escolher o motivo de uma lista editável pelo Supervisor, sem perder nada do que a conclusão normal já faz (diário, sugestão de próxima visita). Construído com custo zero de infraestrutura, pra validar a ideia antes de qualquer investimento em escala.

## Core Value

O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado — porque hoje o preenchimento no CRM pago é ruim (telas longas, esquecimento) e isso é o motivo real de trocar de ferramenta.

## Business Context

- **Customer**: equipe interna de vendas (vendedores + supervisor) — uso interno, não é um produto vendido a terceiros
- **Revenue model**: nenhum — o retorno é econômico (deixar de pagar pelo CRM atual)
- **Success metric**: time passa a usar o funil no dia a dia e o sistema cobre as necessidades gerenciais (incluindo dashboard) a ponto de o CRM pago poder ser cancelado
- **Strategy notes**: —

## Current State

**Shipped:** v1.0 MVP (Autenticação, Cadastro + Funil, Administração de Listas, Dashboard Gerencial), v1.1 Importação e Exportação de Clientes (2026-07-25), v1.2 Gestão de Equipe, Análises de Funil e Filtros (2026-08-06), v1.3 Agenda do Vendedor (2026-08-10), v1.4 CNPJ Obrigatório no Ganho (2026-08-14), e v1.5 Calendário na Agenda e Conclusão Remota (2026-08-19).

O CRM está em uso — login/papéis, cadastro e funil kanban completos, dashboard gerencial, importação/exportação em massa de clientes, o Supervisor consegue desativar um membro da equipe com segurança (transferindo os clientes em andamento), o dashboard mostra onde o funil trava (por etapa e por vendedor), os filtros de Estado/Cidade são listas estruturadas confiáveis, o sistema cobre o pós-venda (cliente "ganho" define uma frequência de visita, uma Agenda única junta o que precisa ser feito, concluir exige um resumo curto que vira diário por cliente, e o diário pode ser exportado), CNPJ é exigido no banco no momento do "ganho" — com clientes antigos preservados e duas planilhas para lidar com o campo em escala — e agora a Agenda tem uma segunda visualização (calendário de dia/semana/mês, incluindo o que já foi feito em datas passadas) além da lista, e concluir um item aceita ser marcado como não-presencial com um motivo categorizado.

## Current Milestone: v1.6 Importação de Clientes Ativos e Prospecção Separadas

**Goal:** Dar duas portas claras de importação em massa (cliente ativo x prospecção), tirar do menu as duas planilhas avulsas que ficaram redundantes, e fazer a Agenda lembrar o vendedor de definir a frequência (com dia fixo) de clientes ativos que ainda não têm uma.

**Target features:**
- Nova planilha "Importar Clientes Ativos": cria cliente já em status ativo/ganho, exige todos os dados (razão social, CNPJ, endereço completo, responsável, etc.), só a frequência de visita fica de fora
- "Importar clientes" renomeada para "Importar Clientes em Prospecção": obrigatório passa a ser só Nome Fantasia + Responsável; razão social e o resto ficam opcionais, preenchidos aos poucos
- Trava de "ganho" ampliada: hoje só exige CNPJ + frequência; passa a exigir também razão social + endereço completo antes de deixar marcar como ganho
- Menu: "Importar CNPJ" e "Importar frequências" saem (redundantes com a nova importação de ativos)
- Agenda: nova seção mostrando clientes ativos sem frequência definida; definir a frequência inclui escolher um dia fixo (dia da semana pra semanal/quinzenal, semana do mês pra mensal); sugestão de próxima visita ao concluir passa a mirar esse dia fixo, não mais contar dias corridos a partir da conclusão

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
- ✓ Ao mover um card para "ganho", o sistema exige CNPJ preenchido — validado no RPC `mover_card_funil` (banco), não só na tela — v1.4
- ✓ Clientes que já são "ganho" sem CNPJ continuam funcionando normalmente (Agenda, ficha, diário) sem qualquer bloqueio, até serem regularizados — v1.4
- ✓ Planilha "Importar clientes" ganha CNPJ como coluna opcional — v1.4
- ✓ Planilha "Importar clientes" ganha Nome Fantasia como coluna opcional — v1.4
- ✓ Supervisor sobe uma planilha "CNPJ em massa" (Razão Social + CNPJ) para regularizar clientes já "ganho" hoje, casando por nome, nome ambíguo vira erro de linha — v1.4
- ✓ Vendedor alterna entre Lista e Calendário na tela da Agenda — v1.5
- ✓ Calendário tem 3 modos (dia/semana/mês), navegação de data e botão "Hoje"; semana começa na segunda-feira — v1.5
- ✓ Visão de mês mostra até 3 itens por dia + contador "+N"; clicar no dia abre a lista completa daquele dia — v1.5
- ✓ Visão de semana mostra 7 colunas (uma por dia); visão de dia reaproveita o card da lista — v1.5
- ✓ Cada item no calendário mantém a mesma sinalização visual Prospecção/Ativo já usada na lista — v1.5
- ✓ Calendário mostra também itens já concluídos ao navegar para datas passadas, sem baixar o histórico inteiro de uma vez; a Lista continua mostrando só pendente — v1.5
- ✓ Supervisor filtra o calendário por vendedor, igual já funciona na Lista — v1.5
- ✓ Ao concluir um item da Agenda (tarefa ou visita), vendedor pode marcar que não foi presencial e escolher um motivo de uma lista — v1.5
- ✓ Motivos de conclusão remota formam uma 6ª lista editável pelo Supervisor — v1.5
- ✓ Conclusão remota conta como conclusão normal — entra no diário, e visita de cliente ativo ainda sugere a próxima data pela frequência — v1.5
- ✓ O motivo escolhido aparece como texto legível no Diário do cliente, junto do resumo — v1.5

### Active

Nada capturado ainda — próximo marco a definir via `/gsd-new-milestone`.

### Out of Scope

- Notificações ativas (email, push) de tarefas atrasadas — destaque visual no kanban já resolve o problema de esquecimento, sem custo/complexidade de um serviço de notificação
- Colunas do funil editáveis por permissão — as 7 etapas ficam fixas no código, pra reduzir complexidade
- App mobile nativo — web responsivo é suficiente
- Integração contínua (sync/API) com o CRM pago atual — o objetivo é substituí-lo, não integrar com ele
- Importação em massa pelo Vendedor — restrita ao Supervisor, decisão explícita do dono do projeto, confirmada e implementada em v1.1
- Validação de formato/dígito verificador de CNPJ — nunca implementada, em nenhum ponto do sistema (importação v1.1, obrigatoriedade no "ganho" v1.4, planilhas v1.4); o sistema só confere presença, nunca formato — adiar para v2 se vier a ser necessário
- CNPJ obrigatório retroativamente — clientes já "ganho" sem CNPJ nunca são bloqueados; grandfathering deliberado (v1.4), mesmo padrão de VIS-04 (frequência de visita, v1.3)
- Lembrar o mapeamento de colunas entre importações — cada planilha é mapeada do zero por enquanto (v1.1); útil se o volume de importações recorrentes crescer
- Importação como atualização de cliente existente — v1.1 só cria clientes novos; atualizar em massa fica para uma versão futura, se necessário
- Valor em R$ / ticket médio por negócio — o CRM não rastreia valor monetário de cliente hoje; adiado até virar necessidade real (v1.2 só trouxe métricas de tempo/conversão)
- Filtro de período (últimos 30/90 dias etc.) no funil de conversão detalhado — v1.2 mostra só o total geral desde sempre; filtro de data fica pra quando for pedido
- Apagar conta do membro desativado por completo — quebraria FKs de histórico (`clientes.responsavel`, `historico.autor_id`); desativação (soft, via `profiles.ativo` + Auth `ban_duration`) preserva integridade — v1.2
- Cadastro de cidades fora da lista oficial IBGE — a lista oficial cobre todos os municípios brasileiros reais; não há necessidade de entrada livre — v1.2
- ~~Calendário completo na Agenda~~ — motivo original invalidado: o time sentiu falta de visão de mês/semana no dia a dia, então o v1.5 entregou um calendário navegável (dia/semana/mês) ao lado da lista. Continua fora de escopo, por decisão explícita: arrastar item entre dias, grade de horas do dia, e mini-calendário lateral de navegação (testado no sketch 003 Variante B e descartado) — v1.3 → revisto em v1.5
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
- **Estado do código pós-v1.5**: Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS), sem backend Node separado. v1.3 adicionou: enum `frequencia_visita_enum` + 4 colunas nullable em `clientes` (nome_fantasia/cnpj/frequencia_pedidos/frequencia_visita), tabela `visitas` (RLS parent-gated, espelha `tarefas`), coluna `resumo` em `tarefas`, `mover_card_funil` estendido (6 parâmetros), RPC `agenda_do_vendedor()` (SECURITY INVOKER, une tarefas+visitas pendentes), RPCs atômicas `concluir_tarefa_prospeccao`/`concluir_visita` (SECURITY INVOKER), tabela `frequencias_pedido` (5ª lista editável do projeto), e RPC `atualizar_frequencia_visita_lote` (SECURITY INVOKER, escrita em massa). v1.4 adicionou 3 migrations (0018-0020): `mover_card_funil` estendido de novo (7 parâmetros, `p_cnpj`) com guard de transição; `importar_clientes_lote` recriada para gravar `cnpj`/`nome_fantasia`; e a nova RPC `atualizar_cnpj_lote`. v1.5 adicionou 2 migrations (0021-0022): RPC nova `agenda_concluidos_do_vendedor(p_inicio, p_fim)` (SECURITY INVOKER, complementar a `agenda_do_vendedor()`, bounded por período, timezone São Paulo) para o calendário mostrar itens concluídos em datas passadas; e a tabela `motivos_conclusao_remota` (6ª lista editável do projeto) + colunas FK opcionais em `tarefas`/`visitas` + `concluir_tarefa_prospeccao`/`concluir_visita` recriadas com um 3º/4º parâmetro (`p_motivo_conclusao_remota_id`, drop-before-create) + os dois gatilhos de auditoria (`tarefas_before_update_historico`/`visitas_after_update_historico`) resolvendo essa FK em texto legível no Diário — primeira vez no projeto que um gatilho resolve uma FK de lista editável em texto. O projeto continua com exatamente 4 exceções `SECURITY DEFINER` documentadas: `is_supervisor()`, `desativar_membro_equipe`/`reativar_membro_equipe`, `cidades_com_clientes_por_estado()` — nenhuma nova desde a v1.2, apesar de 10 migrations novas entre v1.3 e v1.5 (0013-0022).
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
| Guard de CNPJ obrigatório é de TRANSIÇÃO pra "ganho", nunca de estado — três condições juntas (pediu ganho + status atual ainda não é ganho + CNPJ efetivo vazio) | É o mecanismo literal que garante o grandfathering (CNPJ-02); condicionar só ao estado bloquearia clientes legados | ✓ Good |
| CNPJ efetivo no guard é `coalesce(nullif(btrim(p_cnpj),''), nullif(btrim(cnpj_já_gravado),''))` | Quem já preencheu a ficha não precisa redigitar no diálogo de ganho; espaço em branco não engana a trava | ✓ Good |
| Sem validação de formato/dígito verificador de CNPJ em lugar nenhum do sistema — só presença é exigida | Fora do pedido original; mesma postura já usada quando CNPJ era opcional (v1.3) | ✓ Good |
| `importar_clientes_lote` precisou de migration própria pra aceitar `cnpj`/`nome_fantasia` — achado do planejamento da Fase 19, não estava no escopo original | O `jsonb_to_recordset` da função não declarava essas chaves; sem a migration, a planilha teria "sucesso" na tela mas o dado sumiria em silêncio | ✓ Good |
| `atualizar_cnpj_lote` espelha `atualizar_frequencia_visita_lote` (Fase 17) arquivo por arquivo — mesma estrutura de UPDATE único, guard de `status_acompanhamento='ganho'`, sem SECURITY DEFINER | Reaproveita um padrão já provado em produção em vez de desenhar um novo | ✓ Good |
| Planilha "CNPJ em massa" reaproveita a recusa de nome ambíguo já corrigida na Fase 17 (2+ clientes com nome normalizado igual vira erro de linha) | Mesmo risco estrutural (normalização de nome pode colidir clientes distintos), correção já provada, não precisa ser redescoberta | ✓ Good |
| Diálogo de "ganho" sincroniza o CNPJ recém-informado de volta no `ClienteDetailSheet` (form state, não só o registro em memória) | Bug real encontrado no planejamento: sem isso, editar outro campo e salvar logo após o ganho apagaria o CNPJ que acabou de ser exigido | ✓ Good |
| Calendário é uma segunda visão sobre os mesmos dados da Lista (mesmo fetch, mesmo filtro), nunca uma fonte de dado paralela | Evita duas verdades divergentes; a Lista continua provadamente intocada (testes sem edição) | ✓ Good |
| Semana sempre começa na segunda-feira, numa única constante compartilhada pelas 3 visões | `date-fns`'s `startOfWeek`/`endOfWeek` não derivam isso do locale — dois lugares com literais diferentes fariam mês e semana discordarem | ✓ Good |
| Zero biblioteca nova pro calendário — grade montada à mão com `date-fns` + CSS Grid + shadcn/ui já instalados; `react-day-picker` (já instalado) não foi estendido pra visão de mês | Confirmado por pesquisa: um date-picker de mês único não serve bem pra grade de eventos com múltiplos itens por dia | ✓ Good |
| Itens concluídos em datas passadas vêm de uma RPC nova e complementar (`agenda_concluidos_do_vendedor`), sempre limitada por período — nunca uma alteração em `agenda_do_vendedor()` | Evita baixar o histórico inteiro do vendedor de uma vez (custo/performance no free tier) e preserva `agenda_do_vendedor()`/Lista intocadas | ✓ Good |
| Data de um item concluído no calendário é a data REAL de conclusão (`concluida_em`/`data_realizada`, convertida pro fuso de São Paulo), nunca a data original prevista | "O que eu fiz nesse dia" só faz sentido com a data real — usar a data prevista colocaria o item no dia errado | ✓ Good |
| Motivo de conclusão remota é uma 6ª lista editável pelo Supervisor (mesmo padrão de motivo de perda), não texto livre | Decisão do dono do projeto — permite agregação/relatório futuro, evita "por telefone"/"Por Telefone"/"telefone" convivendo | ✓ Good |
| Presença da FK de motivo é o próprio sinal de "foi remoto" — sem coluna booleana separada | Mesmo padrão de `motivo_perda_id`; evita duas fontes de verdade pra mesma pergunta | ✓ Good |
| Gatilhos de histórico (`tarefas_before_update_historico`/`visitas_after_update_historico`) resolvem a FK do motivo em texto legível (`[Nome do motivo] resumo`) antes de gravar no Diário | Primeira vez neste projeto que um gatilho resolve uma FK de lista editável em texto — motivo de perda nunca fez isso; nunca grava o identificador cru | ✓ Good |
| Mudança de assinatura de RPC (parâmetro novo em `concluir_tarefa_prospeccao`/`concluir_visita`) sempre via `drop function if exists <assinatura antiga>` antes do `create function`, nunca `create or replace` sozinho | Mesma lição já registrada na v1.4 (`mover_card_funil`) — `create or replace` com contagem de parâmetros diferente cria sobrecarga ambígua | ✓ Good |

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
*Last updated: 2026-08-19 — after v1.5 milestone (Calendário na Agenda e Conclusão Remota)*
