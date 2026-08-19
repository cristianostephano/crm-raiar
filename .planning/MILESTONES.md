# Milestones

## v1.5 Calendário na Agenda e Conclusão Remota (Shipped: 2026-08-19)

**Phases completed:** 3 phases, 12 plans, 29 tasks

**Key accomplishments:**

- `lib/agenda/itens.ts` extended with 9 pure calendar functions (Monday-start grid for month/week, pt-BR navigation labels, and timezone-safe string-key day grouping) — the single contract that plans 20-02 through 20-05 build the actual calendar UI against.
- Two new presentational components — a day list that reuses `AgendaItemRow` verbatim (D-05) and a 7-column week grid with reduced item chips carrying the Lista's exact prospecção/visita icon-and-color language, both driven by `bucketDoItem` as the single lateness authority.
- `AgendaCalendarioMes.tsx` — the 7-column/up-to-6-row month grid, with day cells capped at 3 item chips + a "+N mais" indicator, the prospecção/visita chip language reused from `AgendaItemRow`, and the atraso red accent proven to survive the other-month-cell fade — closing the three critical Pitfalls (8, 9, 10) this plan was isolated to test.
- `AgendaCalendarioToolbar` (Variante A: 4-option view switch + date-nav + Hoje + legend) and `AgendaCalendario` (the composition root owning reference date, a single `agruparPorData` computation, and the month-day dialog that reuses the day view verbatim) — the calendar is now a navigable whole outside the screen, with only the Lista wiring left for plan 20-05.
- AgendaList.tsx ganha o alternador Lista/Dia/Semana/Mês (estado `visao`, padrão Lista) compondo `AgendaCalendario` como irmão da Lista, alimentado pelo mesmo `itensFiltrados` já usado pelas seções — a Lista provadamente intacta (zero edição em `agenda-list.test.tsx`) e verificada de ponta a ponta no navegador pelo dono do projeto, fechando a Fase 20 inteira.
- Nova função `agenda_concluidos_do_vendedor(p_inicio, p_fim)` no Postgres/Supabase — leitura complementar e disjunta de `agenda_do_vendedor()`, obrigatoriamente limitada por intervalo, devolvendo a data REAL de conclusão no fuso de São Paulo, sem nenhuma exceção de privilégio elevado nova; aplicada em produção e provada por 22+2 testes de integração contra o banco real.
- `lib/agenda/itens.ts`/`lib/validations/agenda.ts` estendidos com o vocabulário puro de item concluído: `estaAtrasado`/`mesclarAgenda` (nunca pintam trabalho já feito de vermelho) e `intervaloDeHistorico`/`validarIntervaloHistorico` (o período de histórico a pedir, e o teto que a ação de servidor vai impor).
- `AgendaItemRow` + `AgendaCalendarioDia`/`Semana`/`Mes`/`Toolbar` estendidos para renderizar um item já concluído sem oferecer a ação de concluir de novo: botão ausente do documento, marca verde-esmeralda-600 com ícone de conferido somada ao selo de origem, e nenhuma das três visões pinta mais um registro histórico de vermelho.
- `AgendaCalendario.tsx` passa a buscar o histórico (itens já concluídos) do período visível via `getAgendaConcluidosAction`, filtra-o pelo mesmo vendedor que os pendentes já usam, mescla as duas fontes uma única vez e agrupa o resultado — encerrando a Fase 21 com aprovação do dono do projeto no navegador ("tudo certo").
- Migration 0022 aplicada em produção: 6ª lista editável (motivos_conclusao_remota), duas colunas de FK opcionais em tarefas/visitas, as duas RPCs de conclusão estendidas com apagar-antes-de-criar, e os dois gatilhos de auditoria resolvendo o motivo em nome legível no Diário — provado por 24 casos de integração contra o banco real, com zero regressão nos quatro arquivos de conclusão anteriores.
- A 6ª lista editável (`motivos_conclusao_remota`, criada no plano 22-01) agora é administrável pelo Supervisor numa nova aba de Configurações, com a Agenda passando a ser revalidada em toda escrita de lista, e a leitura de catálogo que o plano 22-03 vai consumir já provada contra o banco real com sessão de Vendedor.
- ConcluirItemDialog.tsx ganha a caixa "Não foi presencial" + Select de motivo condicional (válida para tarefa de prospecção E visita), o valor percorre app/actions/agenda.ts até as duas RPCs do plano 22-01, e a verificação humana em duas contas (Supervisor/Vendedor) provou o fluxo de ponta a ponta — fechando a Fase 22 e o marco v1.5 inteiro.

---

## v1.4 CNPJ Obrigatório no Ganho (Shipped: 2026-08-14)

**Phases completed:** 2 phases, 6 plans, 17 tasks

**Key accomplishments:**

- `mover_card_funil` recriada com o 7º parâmetro `p_cnpj`, exigindo CNPJ apenas na transição para "ganho" e preservando intocados os clientes já "ganho" sem CNPJ — migration 0018 aplicada em produção.
- Diálogo de ganho (`GanhoFrequenciaDialog`) ganha campo CNPJ ao lado da frequência de visita, `marcarStatus` repassa `p_cnpj` na mesma chamada de RPC, e `ClienteDetailSheet` sincroniza o CNPJ recém-informado de volta no formulário para sobreviver a um "Salvar alterações" seguinte.
- `importar_clientes_lote` recriada para gravar `cnpj`/`nome_fantasia`, e nova RPC `atualizar_cnpj_lote` para regularizar em massa o CNPJ de clientes já "ganho" — migrations 0019 e 0020 aplicadas em produção.
- CNPJ e Nome Fantasia atravessam a cadeia inteira do assistente "Importar clientes" já existente — vocabulário, modelo baixável, sugestão automática de coluna, Select de mapeamento, linha resolvida e carga da chamada em lote — sem tocar em nenhuma validação de formato.
- Camada sem tela da planilha "CNPJ em massa" — vocabulário, modelo, anotação com recusa de nome ambíguo, planejamento de carga e as duas Server Actions ligadas a `atualizar_cnpj_lote`, espelhando arquivo por arquivo o fluxo de frequência da Fase 17.
- Assistente de três passos, tabela de revisão com casamento por nome visível, resumo pós-gravação, rota exclusiva de Supervisor e entrada de menu — montados por cima das Server Actions do plano 19-03, no mesmo molde do fluxo de frequência (Fase 17); verificado de ponta a ponta no navegador pelo dono do projeto, incluindo o caso de nome ambíguo.

---

## v1.3 Agenda do Vendedor (Shipped: 2026-08-10)

**Phases completed:** 5 phases, 19 plans, 50 tasks

**Key accomplishments:**

- Migration 0013 aplicada em produção: enum de frequência de visita, 4 colunas nullable em `clientes`, tabela `visitas` com RLS 4-policy parent-gated, `proxima_data_visita` (immutable, clamp de fim de mês) e `mover_card_funil` recriado com guard de frequência obrigatória ao ganho + seed atômico/idempotente da primeira visita.
- Marcar um cliente como "Ganho" agora abre um diálogo pedindo a frequência de visita antes de gravar qualquer coisa — a mesma cadência que a Fase 13-01 passou a exigir no banco.
- Server Action `atualizarFrequenciaVisita` (ordinary `clientes` UPDATE, never the funil RPC) plus a standing "Frequência de visita" Select in `ClienteDetailSheet`'s Funil section, saving immediately with no confirmation step — closes VIS-02/VIS-04/ATV-03 for the phase.
- RPC `agenda_do_vendedor()` — `union all` de tarefas de prospecção pendentes com visitas pendentes, `language sql stable`, sem elevação de privilégio — mais o índice `idx_tarefas_data_conclusao`, aplicados em produção com aprovação humana e 19/19 testes de integração verdes.
- Autoridade única de bucketing atrasado/hoje/próximos (`lib/agenda/itens.ts`, testada RED→GREEN com `date-fns`) mais o leitor tipado de `agenda_do_vendedor()` e a Server Action de leitura, ambos sem filtro manual de dono e com a mesma fonte para a lista e a contagem do selo.
- Rota `/agenda` (Server Component protegido) renderizando `AgendaList`: leitura única via `getAgendaAction()`, três seções fixas Atrasado/Hoje/Próximos dias, filtro de Vendedor para o Supervisor, e `AgendaItemRow` com selo de origem e o mesmo destaque de atraso (border-l-4 border-l-red-500 + TriangleAlert âmbar) que o kanban já usa — verificado contra dados reais no navegador.
- Item "Agenda" inserido como primeiro da seção Principal do menu (acima de Clientes e Dashboard), com selo de contagem nas formas expandida (Badge + aria-label) e recolhida (indicador circular capado em 9+), lido uma única vez por carregamento a partir da mesma fonte que alimenta a tela e tolerante a falha no layout raiz.
- Migration 0015 aplicada em produção: coluna `resumo` em `tarefas`, gatilhos de auditoria estendidos, RPCs atômicas `concluir_tarefa_prospeccao`/`concluir_visita` sem elevação de privilégio, e `agenda_do_vendedor()` recriada com `frequencia_visita` + `proxima_data_sugerida` calculadas no banco.
- Esquema de validação do resumo com dono único (10-500 caracteres), função pura de decisão de cadência, item de agenda estendido com frequência/data sugerida vindas prontas do banco, e duas Server Actions (`concluirTarefaProspeccao`/`concluirVisita`) que só chamam as RPCs do Plano 15-01.
- `ConcluirItemDialog` — janela única de conclusão parametrizada por origem (prospecção/visita), com resumo obrigatório contado em tempo real e próxima data pré-preenchida do banco (nunca recalculada no navegador); botão "Concluir" na linha da Agenda com interrupção de propagação; `AgendaList` roteando para a Server Action correta e recarregando no sucesso.
- Tabela `frequencias_pedido` — a 5ª lista editável do projeto — criada em produção com RLS de 4 regras (leitura aberta, escrita só Supervisor) e conjunto inicial de 6 valores, provada nos dois sentidos contra o banco real.
- Quinta aba de lista editável em Configurações (CRUD herdado, zero componente novo) + leitor de catálogo ativo (`getFrequenciasPedidoAtivas`/`getFrequenciasPedido`) provado por 10 testes de integração contra o banco real.
- Os três campos do cliente ativo (nome fantasia/CNPJ/frequência de pedidos) indo e voltando entre ficha e banco com gravação condicional à presença, mais a consulta própria do Diário filtrada em SQL — provados por 32 testes de integração contra o banco real.
- Três campos condicionais (Nome fantasia/CNPJ/Frequência de pedidos) e uma seção "Diário" de leitura pura, ambos wireados em `ClienteDetailSheet.tsx` sem piorar a supressão de lint documentada do arquivo — fecha o marco v1.3 inteiro.
- Migration 0017 aplicada em produção: RPC `atualizar_frequencia_visita_lote` — uma única instrução UPDATE, não-security-definer, que grava a frequência de visita de vários clientes "ganho" de uma vez, estruturalmente incapaz de criar cliente ou de agendar visita.
- Parameter-less `getDiarioParaExportacao()` + `buildDiarioWorkbook()` + `/api/agenda/exportar-diario` deliver a role-scoped, formula-injection-safe .xlsx export of the diário, wired to a new "Exportar meu diário"/"Exportar diário do time" button on the Agenda screen.
- Generalização retrocompatível da camada de mapeamento de colunas (D4) + anotação pura por linha (encontrado/apto/frequência) + planejamento/reconciliação da gravação + duas Server Actions que chamam `atualizar_frequencia_visita_lote` numa única chamada por lote — todas as três lacunas do fluxo (D4, L1 ambiguidade, L2 repetição) fechadas e testadas.
- ColumnMappingTable generalizado por parâmetro opcional (D4, retrocompatível por construção) + FrequenciaPreviewTable (5 colunas, sem estado de decisão) + FrequenciaImportSummary (contagem de puladas derivada) — as três peças apresentacionais puras que o assistente do plano 17-05 vai encaixar.
- FrequenciaImportWizard.tsx (assistente de 3 passos, reusando FileDropzone/ColumnMappingTable sem modificar o fluxo de clientes) + rota `/clientes/importar-frequencias` exclusiva do Supervisor + entrada no menu + teste e2e de bloqueio por papel — IMP-01 completo, checkpoint humano final do marco v1.3 aprovado.

---

## v1.2 Gestão de Equipe, Análises de Funil e Filtros (Shipped: 2026-08-06)

**Phases completed:** 5 phases, 22 plans, 52 tasks

**Key accomplishments:**

- Kanban: cada uma das 7 colunas do funil agora tem altura fixa e rolagem própria (ScrollColumnShell), com o drag-and-drop de cards continuando a funcionar corretamente durante o auto-scroll.
- Estado e Cidade estruturados: cadastro, edição, filtro e importação por planilha agora usam uma lista fixa das 27 UFs e a lista oficial de municípios do IBGE (cascata Estado -> Cidade), substituindo os campos de texto livre anteriores.
- Desativação de membro da equipe: o Supervisor pode desativar um vendedor com segurança - os clientes em andamento são transferidos a um substituto escolhido, o histórico e os números fechados (ganho/perdido) continuam intactos, o membro perde acesso ao sistema, e o sistema nunca permite ficar sem nenhum Supervisor ativo.
- Funil de conversão detalhado no Dashboard: nova tabela por etapa (quantidade, % que avançou, perdidos, tempo médio parado) e cartões com o tempo médio até "ganho" e até "perdido", respeitando a mesma regra de visibilidade por papel do Dashboard.
- Comparativo por vendedor no Dashboard: nova tabela, visível só para o Supervisor, comparando taxa de conversão, negócios iniciados, negócios ganhos e ciclo médio em dias entre os vendedores ativos.

---

## v1.1 Importação e Exportação de Clientes (Shipped: 2026-07-25)

**Phases completed:** 3 phases, 9 plans, 20 tasks

**Key accomplishments:**

- `getClientesParaExportacao(ids?: string[] | null)`
- `POST /api/clientes/exportar`
- Client-side .xlsx/.csv parser (papaparse + @e965/xlsx) with pt-BR semicolon/BOM support, canonical SYSTEM_FIELDS vocabulary, and the IMP-02 downloadable model spreadsheet — all pure, unit-tested, no UI or database yet.
- Pure dedup/validation engine (normalizeRazaoSocial + findDuplicates + annotarLinha) plus the read-only `validarLoteImportacao` Server Action that gates the import feature to Supervisor-only and never writes to the database — the entire testable core of IMP-04/IMP-05/IMP-07/IMP-10.
- Supervisor-only `/clientes/importar` route with app-layer redirect guard, the "Importar clientes" sidebar link scoped to ADMIN_SECTION, and a fully wired Step 1 of the import wizard (download model, drag/drop upload, client-side parse, "N linhas encontradas"/empty state) — built on top of 06-01's parser/model modules, with Steps 2/3 left as structural placeholders for 06-04.
- Column-mapping Step 2 (auto-suggest + "não importar" + required-field warning) and paginated review Step 3 (OK/erro/possível duplicado per row, Importar/Pular decision on duplicates, zero database writes) — completing the entire Fase 6 import wizard end-to-end.
- Supervisor-only, set-based `importar_clientes_lote(p_clientes jsonb)` RPC live on the Supabase project — bulk-inserts clientes at `aguardando_contato` plus their produtos, with `ON CONFLICT DO NOTHING` as the duplicate backstop, proven by a 3-case integration test against the real RLS policies.
- Pure `planConfirmacao`/`reconcileImportados` accounting helper (8 unit tests, RED-then-GREEN) plus `confirmarLoteImportacao` Server Action — Supervisor-gated, D-02 confirm-time re-dedup, single `importar_clientes_lote` RPC call, `{ importados, puladas }` result with zero persistence of skipped rows.
- Wired ImportWizard's "Confirmar importação" button to the real `confirmarLoteImportacao` write path, added the `ImportSummary` D-01 post-confirmation screen, and got human sign-off on a real bulk import against the live Supabase project — completing Phase 7 and the v1.1 milestone's only write phase.

---
