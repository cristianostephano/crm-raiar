# Phase 31: Agenda 2 — Visitas Manuais na Lista - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Nova tela "Agenda 2" (item de menu próprio, logo abaixo de "Agenda"), onde o vendedor anota manualmente quem vai visitar em cada dia — nome de cliente em texto livre (sem vínculo com cadastro), bairro e data — corrige, apaga e marca como concluído os próprios itens. Supervisor vê os itens de todo o time, só leitura, com filtro por vendedor. A Agenda atual (`/agenda`, `agenda_do_vendedor()`) não é tocada nesta fase — tabela nova, RLS nova, tela nova, item de menu novo, isolados do resto do sistema.

Fora do escopo desta fase (fica pra Fase 32): repetição semanal e visão de calendário — Fase 31 entrega só a visão de Lista com item único (sem repetição).

</domain>

<decisions>
## Implementation Decisions

### Formato da lista
- **D-01:** Agrupamento em 3 seções — Atrasado / Hoje / Próximos — mesmo padrão já usado em `AgendaList.tsx`/`agruparAgenda()` na Agenda atual (consistência, reaproveita padrão existente).
- **D-02:** Item pendente com data passada fica destacado visualmente como atrasado — mesmo tratamento (`atrasado={true}`) já usado em `AgendaItemRow`.
- **D-03:** "Próximos" usa o MESMO horizonte de dias já usado na Agenda atual (não muda a constante existente, não fica "sem limite").
- **D-04:** Item concluído continua visível na lista do dia, riscado (`line-through`) — tratamento novo, não existe pattern equivalente em Perdidos/Encerrados (que são telas de estado terminal, não de "concluído").
- **D-05:** Item concluído pode ser desmarcado (volta a pendente) a qualquer momento.
- **D-06:** Item concluído pode ser editado diretamente (nome/bairro/data), sem precisar desmarcar primeiro.
- **D-07:** Criar dois itens "iguais" (mesmo nome + mesma data) não é bloqueado — sistema avisa ("já existe um item parecido nesse dia") mas deixa o vendedor confirmar e criar mesmo assim.
- **D-08:** Dentro do mesmo dia, itens aparecem em ordem de criação (sem campo de horário, sem ordenação alfabética).
- **D-09:** Vendedor pode criar item para data passada (recuperar visita que esqueceu de anotar) — sem trava de "só hoje em diante".
- **D-10:** Estado vazio (vendedor sem nenhum item ainda) mostra mensagem simples de boas-vindas com o botão de criar em destaque — texto exato fica a critério de quem implementar, seguindo o tom já usado no resto do sistema.
- **D-11:** Sem busca/filtro por texto (nome/bairro) dentro da lista nesta fase — volume esperado é baixo por vendedor; reavaliar se o piloto mostrar necessidade real.

### Contador no menu
- **D-12:** "Agenda 2" mostra contador de pendentes no menu, mesmo padrão do item "Agenda" (não fica sem contador como "Perdidos"/"Encerrados").
- **D-13:** Contador conta só os itens pendentes do próprio vendedor logado (atrasados incluídos na mesma contagem — não há contagem separada para atraso).
- **D-14:** No menu recolhido/compacto, "Agenda 2" mostra bolinha sem número quando há pendente — mesmo padrão já usado no item "Agenda" (`data-slot="agenda-pendente-dot"`).
- **D-15:** Ordem final confirmada no menu: Agenda → Agenda 2 → Clientes → Perdidos → Encerrados → Dashboard (empurra os itens seguintes uma posição para baixo). Testes de ordem do menu (`tests/agenda/app-sidebar-agenda.test.tsx` e siblings) precisam de ajuste.

### Permissão do Supervisor
- **D-16:** Supervisor só visualiza os itens da Agenda 2 de todo o time — não cria, não edita, não apaga item (nem o próprio, nem de vendedor) nesta fase. Alterar/apagar fica restrito ao dono do item, garantido pela RLS (menor privilégio).
- **D-17:** Filtro por vendedor do Supervisor segue o mesmo padrão de componente já usado na Agenda atual/Perdidos/Encerrados (seletor "Todos" ou um vendedor específico).
- **D-18:** Filtro do Supervisor abre em "Todos" (time inteiro) por padrão — já que o Supervisor não cria itens próprios, não faz sentido abrir vazio.
- **D-19:** Vendedor desativado: os itens que ele anotou continuam existindo, visíveis ao Supervisor, sem transferência para outro vendedor — mesmo padrão já usado hoje para registros de clientes já fechados (Fase 10/v1.2). Não é cliente, não entra na rotina de transferência da desativação.

### Claude's Discretion
- Texto exato do estado vazio (D-10).
- Ordem dos itens dentro do mesmo dia quando há empate de "ordem de criação" (ex: dois itens no mesmo segundo) — usar `id`/`created_at` como desempate.
- Ícone do item "Agenda 2" no menu.
- Texto exato do aviso de possível duplicado (D-07).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap e requisitos (fonte da verdade do escopo)
- `.planning/ROADMAP.md` §"Phase 31: Agenda 2 — Visitas Manuais na Lista" — goal, success criteria, e as notas (a)-(g) do Discuss (LGPD, formato de lista, contador, Supervisor, vendedor desativado, regras técnicas do projeto).
- `.planning/REQUIREMENTS.md` §"Agenda 2 (nova)" — AGD2-01, AGD2-03 a AGD2-07 (requisitos desta fase; AGD2-02/AGD2-08 são da Fase 32) e §"Out of Scope" (sem vínculo a cadastro real, sem remover campos de frequência/dia fixo, sem resumo/diário obrigatório).
- `.planning/PROJECT.md` §"Current Milestone: v1.8" e §"Key Decisions" — histórico de decisões relacionadas (padrão de listas editáveis, padrão owner-or-supervisor, SECURITY DEFINER como exceção documentada).

### Padrões de código a reaproveitar (achados do scout desta fase)
- `components/layout/AppSidebar.tsx` — `PRINCIPAL_SECTION.links` (array declarativo, ordem = requisito) e o padrão de `badgeCount`/dot compacto usado por "Agenda"; inserir "Agenda 2" logo após a entrada `/agenda`.
- `supabase/migrations/0002_clientes_and_funil.sql` — padrão RLS "dono ou supervisor" (`responsavel = (select auth.uid()) or is_supervisor()`), a ser espelhado para `vendedor_id` na tabela nova da Agenda 2; e padrão de tabela-lista supervisor-CRUD (categorias/produtos/tipos_tarefa/motivos_perda), caso alguma lista editável nova surja no planejamento.
- `components/agenda/AgendaList.tsx` + `lib/agenda/itens.ts` (`agruparAgenda()`, `SECAO_ORDEM`, `tituloSecao()`) — padrão de agrupamento Atrasado/Hoje/Próximos a reaproveitar/espelhar na Agenda 2.
- `components/agenda/AgendaItemRow.tsx` — prop `atrasado` para o destaque visual de atraso.
- `supabase/migrations/0008_desativacao_membro_equipe.sql` + `0039_carimbos_desativacao_reativacao.sql` — como `is_supervisor()` já exige `ativo = true` e como registros de vendedor desativado permanecem visíveis sem transferência automática (exceto clientes em funil ativo).
- `tests/agenda/app-sidebar-agenda.test.tsx` (e siblings `app-sidebar-perdidos.test.tsx`, `app-sidebar-encerrados.test.tsx`, `layout/app-sidebar-visual.test.tsx`) — scaffold de teste a seguir para o novo teste de ordem/badge de "Agenda 2".

### LGPD (obrigatório considerar no planejamento e na migration)
- `.planning/ROADMAP.md` §Phase 31 nota (a) — minimização de dados já travada: só nome (texto livre), bairro, data, concluído, dono, carimbos de criação/alteração; sem telefone/endereço completo/observação livre/localização; limite de tamanho nos dois campos de texto; dica na tela orientando usar Nome Fantasia; dono sempre definido pelo servidor; sem exportação da Agenda 2 nesta fase.
- `.planning/ROADMAP.md` §Phase 31 nota (b) — prazo de guarda do piloto (o que fazer com os itens quando o piloto acabar) ficou **em aberto, não discutido nesta sessão por escolha do dono** — precisa ser decidido antes de produção ou de um marco futuro que descarte a Agenda 2. Ver aviso na seção `<deferred>`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppSidebar.tsx`: array `PRINCIPAL_SECTION.links` — inserir entrada nova aqui, sem tocar em lógica de badge das outras.
- `agruparAgenda()`/`SECAO_ORDEM`/`tituloSecao()` (`lib/agenda/itens.ts`): mesma lógica de bucket Atrasado/Hoje/Próximos, adaptar para a fonte de dados nova (Agenda 2 tem uma única tabela/fonte — mais simples que a Agenda atual, que junta tarefas + visitas).
- `AgendaItemRow.tsx`: prop `atrasado` reaproveitável; precisa de um tratamento visual NOVO para "concluído" (riscado) — não existe em nenhum componente hoje (Perdidos/Encerrados são estado terminal, não "concluído/riscado").

### Established Patterns
- RLS "dono ou supervisor": `vendedor_id = (select auth.uid()) or is_supervisor()` para SELECT; INSERT com `vendedor_id = (select auth.uid())` (nunca aceito da tela); UPDATE/DELETE restritos ao dono (Supervisor não edita/apaga por decisão desta fase — D-16 é mais restritivo que o padrão "dono ou supervisor" já usado em `clientes`, propositalmente).
- `is_supervisor()` já exige `profiles.ativo = true` — cascata automática pra RLS sem trabalho extra.
- Nenhuma exceção `SECURITY DEFINER` nova é esperada nesta fase — a tabela é simples (INSERT/UPDATE/DELETE diretos, sem lógica de transição como `mover_card_funil`), então RLS normal deve bastar. **Contagem atual de exceções documentadas**: o roadmap cita "6" mas o scout desta fase encontrou 11 funções distintas com `SECURITY DEFINER` no histórico de migrations — o planejamento deve reconferir a contagem real (provavelmente contra `STATE.md`/documentação de exceções) antes de assumir "6" como baseline, e continuar a disciplina de "zero exceção nova" independente do número exato.

### Integration Points
- Menu (`AppSidebar.tsx`) e seu provedor de contagem (`app/(app)/layout.tsx`, hoje só busca `getAgendaPendentesCount()`) precisam de uma segunda função de contagem equivalente para a Agenda 2, sem misturar com a contagem da Agenda atual.
- Nova tabela e nova tela são isoladas — não há integração com `clientes`, `funil`, `agenda_do_vendedor()` nesta fase (ver `.planning/ROADMAP.md` §Phase 31 "Depends on").

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência específica adicional além do que já está detalhado no ROADMAP.md (notas a-g) e nas decisões acima.

</specifics>

<deferred>
## Deferred Ideas

- **Repetição semanal (4/8/12 semanas) e visão de Calendário** — pertence à Fase 32 (AGD2-02, AGD2-08), já mapeada no roadmap. Fase 31 entrega só item único em Lista.
- **Prazo de guarda dos dados do piloto (LGPD)** — o dono optou por não discutir agora quando quais das 4 áreas de discussão priorizar. **Alerta para o dono do projeto**: como os itens guardam nome (pode ser pessoa física) + bairro + rotina de deslocamento de um vendedor, é uma decisão de retenção de dados pessoais que precisa ser tomada antes de: (1) esta fase ir para produção de fato com uso real continuado, ou (2) um marco futuro decidir descartar a Agenda 2 (nesse caso, o que fazer com os dados já coletados). Recomendação por padrão (Privacidade por Design): tratar como piloto de prazo determinado e reavaliar retenção quando o dono decidir qual agenda fica — mesmo espírito do descarte de 35 dias já usado em `acessos_diarios` (v1.7), mas isso NÃO foi confirmado pelo dono e não deve ser implementado como automático sem essa confirmação explícita.
- **Vincular item da Agenda 2 a um cadastro de cliente real** — já registrado como Out of Scope explícito em `REQUIREMENTS.md`, possível consideração futura se a Agenda 2 vencer o piloto.

</deferred>

---

*Phase: 31-Agenda 2 — Visitas Manuais na Lista*
*Context gathered: 2026-09-28*
