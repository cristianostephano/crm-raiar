# Phase 32: Agenda 2 — Repetição Semanal e Calendário - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

O vendedor cria um item da Agenda 2 já repetido por 4, 8 ou 12 semanas de uma vez (mesmo dia da semana da data escolhida, cada ocorrência independente). A Agenda 2 ganha uma segunda visão — Calendário (dia/semana/mês), com a mesma navegação já usada na Agenda atual. O calendário da Agenda atual sai desta fase idêntico ao de hoje.

</domain>

<decisions>
## Implementation Decisions

### Repetição
- **D-20:** Ao criar um item, o vendedor escolhe não repetir ou repetir por 4, 8 ou 12 semanas — gera uma ocorrência por semana, sempre no mesmo dia da semana da data escolhida. Gravação em uma única operação, tudo-ou-nada (nunca metade das semanas criada por falha no meio) — já travado no ROADMAP, não é mais gray area.
- **D-21:** Cada ocorrência é independente desde a criação — editar, concluir ou apagar uma não muda nenhuma das outras (requisito AGD2-02, já travado).
- **D-22:** Nenhum identificador de série é guardado ligando as ocorrências geradas. Menos dado numa tabela já sob escrutínio de LGPD (`agenda2_itens`), mais simples, e nada no produto precisa disso hoje.
- **D-23:** Repetição só fica disponível quando a data escolhida é hoje ou futura — diferente da regra de criação avulsa (D-09 da Fase 31, que aceita qualquer data), porque o caso de uso de repetir é planejar visitas futuras, não registrar o passado.
- **D-24:** A opção de repetir aparece só no momento de criar um item novo — editar um item avulso já existente nunca gera novas ocorrências.
- **D-25:** O aviso de possível duplicado (D-07, Fase 31) roda só contra o item original, antes de repetir — não é recalculado para cada uma das N ocorrências futuras geradas.
- **D-26:** Sem indicador visual (ícone ou marca) distinguindo um item criado por repetição de um item avulso — decorre diretamente de D-22 (não há série para indicar) e D-21 (são totalmente independentes).

### Calendário
- **D-27:** A Agenda 2 ganha Calendário (dia/semana/mês) ao lado da Lista, reaproveitando a MESMA navegação visual e comportamento da Agenda atual (setas, botão "Hoje", semana começando na segunda-feira) — mas como um componente PRÓPRIO copiado (`Agenda2Calendario.tsx` e siblings), nunca tornando `AgendaCalendario.tsx` configurável/compartilhado. Decisão já travada no ROADMAP — mesmo padrão já usado entre Perdidos/Encerrados neste projeto.
- **D-28:** Navegar para uma data passada no calendário da Agenda 2 mostra o que foi concluído naquele dia (mesmo espírito da Agenda atual — "o que eu fiz nesse dia"). Diferente da Lista (que esconde concluídos do dia seguinte em diante, D-04/correção-7 da Fase 31) — o Calendário é uma segunda visão com regra própria de visibilidade.
- **D-29:** Itens concluídos aparecem riscados também no calendário (requisito explícito do ROADMAP para esta fase).
- **D-30:** O Supervisor filtra o calendário da Agenda 2 por vendedor, do mesmo jeito que já filtra a Lista (requisito AGD2-08, mesmo padrão read-only de D-16).

### Claude's Discretion
- Forma exata da query que alimenta o calendário (uma função nova vs. reaproveitar `getAgenda2()` com filtro de período) — já que a Agenda 2 tem UMA fonte de dados só (ao contrário da Agenda atual, que junta pendentes + histórico de duas fontes), a implementação pode ser mais simples que o `AgendaCalendario.tsx` original.
- Nome exato dos novos arquivos/componentes copiados (`Agenda2Calendario.tsx` e siblings), seguindo a convenção já usada em `Agenda2List.tsx`/`Agenda2ItemRow.tsx` da Fase 31.
- Paginação/limite de busca por período visível no calendário (evitar buscar todos os itens de todos os vendedores de uma vez) — mesmo cuidado já aplicado na Fase 21 da Agenda atual.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap e requisitos (fonte da verdade do escopo)
- `.planning/ROADMAP.md` §"Phase 32: Agenda 2 — Repetição Semanal e Calendário" — goal, success criteria, e notas (a)-(e) do Discuss/pesquisa (decisão travada de copiar o componente de calendário, repetição tudo-ou-nada, gravação direta sem RPC, vínculo entre ocorrências, volume).
- `.planning/REQUIREMENTS.md` §"Agenda 2 (nova)" — AGD2-02 (repetição) e AGD2-08 (Lista/Calendário), requisitos desta fase.
- `.planning/phases/31-agenda-2-visitas-manuais-na-lista/31-CONTEXT.md` — todas as 19 decisões da Fase 31 (D-01 a D-19), especialmente D-01/D-02/D-03 (agrupamento Atrasado/Hoje/Próximos, sem corte de dias) e D-04 (concluído some do dia seguinte na Lista — NÃO se aplica ao calendário desta fase, ver D-28 acima).

### Padrões de código a reaproveitar (achados do scout desta fase)
- `components/agenda/AgendaCalendario.tsx` + siblings (`AgendaCalendarioDia.tsx`, `AgendaCalendarioMes.tsx`, `AgendaCalendarioSemana.tsx`, `AgendaCalendarioToolbar.tsx`) — padrão de props (`visao`, `onVisaoChange`, `itens`, `now`), estado local de navegação (`referencia`), e uso de `navegarData`/`rotuloDoPeriodo`/`chaveDoDia` de `lib/agenda/itens.ts`. COPIAR, nunca tornar configurável (decisão travada).
- `lib/agenda/itens.ts` — `navegarData` (usa `addDays`/`addWeeks`/`addMonths` do date-fns), `chaveDoDia` (`format(dia, "yyyy-MM-dd")`), `parseISO` para ler datas do banco sem bug de fuso. Reaproveitar `addWeeks(parseISO(dataBase), n)` + `chaveDoDia(...)` para calcular as datas das ocorrências repetidas — nunca `new Date(string)` nem aritmética crua de timestamp.
- `lib/agenda2/itens.ts`, `lib/supabase/queries/agenda2.ts`, `app/actions/agenda2.ts`, `supabase/migrations/0048_agenda2_itens.sql` (Fase 31) — tipo `Agenda2Item`, funções de leitura/escrita existentes, formato da tabela (8 colunas, sem conceito de série).
- Precedente de insert multi-linha (`.insert([...])` com array) usado hoje só em test seeds (ex: `tests/clientes/filtro-prospeccao-postgrest.test.ts:91`) — confirma que o PostgREST aceita essa forma sem RPC; Fase 32 seria o primeiro uso em código de produção.
- `tests/agenda/agenda-calendario*.test.tsx` (7 arquivos) — INTOCADOS, só para referência de padrão de teste ao criar os testes da cópia nova.

### LGPD (obrigatório considerar no planejamento)
- A tabela `agenda2_itens` já está sob minimização de dados aprovada na Fase 31 (ver `31-01-SUMMARY.md` e o header da migration 0048). Esta fase NÃO adiciona nenhuma coluna nova (D-22 decide não guardar identificador de série) — nenhuma re-análise de LGPD é necessária além do que já foi aprovado.
- Prazo de guarda dos dados da Agenda 2 (1 ano, decidido pelo dono em 2026-10-01 na UAT da Fase 31) continua sem implementação de descarte automático — fora do escopo desta fase, mas vale lembrar o dono se isso virar prioridade.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/agenda/itens.ts`: `navegarData`, `chaveDoDia`, `rotuloDoPeriodo`, `parseISO` — funções puras de data a IMPORTAR, nunca reimplementar.
- `Agenda2Item` (Fase 31, `lib/agenda2/itens.ts`): tipo já pronto para alimentar o calendário sem mudança de shape.

### Established Patterns
- Padrão "cópia de componente, não abstração compartilhada" já usado 2x neste projeto (Perdidos/Encerrados na v1.7, Agenda2List/AgendaList na Fase 31) — Fase 32 é a terceira aplicação do mesmo padrão, desta vez para o calendário.
- Gravação em lote via `.insert([array])` direto (sem RPC, sem `SECURITY DEFINER`) é o caminho preferido neste projeto desde a v1.1 (importação de clientes) — mesma disciplina se aplica à repetição semanal.

### Integration Points
- Calendário da Agenda 2 é uma segunda visão sobre a MESMA fonte de dados da Lista (`getAgenda2()` ou equivalente com filtro de período) — nunca uma fonte paralela, mesmo princípio já usado na Agenda atual (Fase 20, Key Decision registrada em PROJECT.md).
- Nenhuma integração com `agenda_do_vendedor()`, `AgendaCalendario.tsx` ou qualquer código da Agenda atual — fase isolada, mesma disciplina da Fase 31.

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência específica adicional além do que já está detalhado no ROADMAP.md (notas a-e) e nas decisões acima.

</specifics>

<deferred>
## Deferred Ideas

- **Identificador de série / "apagar todas as próximas"** — avaliado e explicitamente descartado nesta fase (D-22); revisitar só se um pedido real de usuário surgir.
- **Indicador visual de repetição** — descartado (D-26), decorre de D-22.
- **Adicionar repetição ao editar um item existente** — descartado (D-24); repetir só é possível no momento da criação.

</deferred>

---

*Phase: 32-Agenda 2 — Repetição Semanal e Calendário*
*Context gathered: 2026-10-01*
