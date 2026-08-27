# Phase 24: Dia Fixo na Recorrência de Visita - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A recorrência de visita de um cliente ativo passa a ter um dia fixo (dia da semana para semanal/quinzenal; semana do mês + dia da semana para mensal). A sugestão de próxima visita ao concluir passa a mirar esse dia fixo, nunca conta dias corridos a partir da conclusão. A Agenda ganha uma seção lembrando o vendedor de quem ainda não definiu o dia fixo.

</domain>

<decisions>
## Implementation Decisions

### Cliente sem dia fixo ainda (D-01)
- **D-01:** Um cliente ativo com frequência já definida mas SEM dia fixo (estado em que TODO cliente ativo hoje se encontra, já que dia fixo é conceito novo deste marco) continua recebendo a sugestão de próxima visita pelo cálculo ANTIGO (contagem de dias corridos a partir da conclusão) até o vendedor definir o dia fixo. O comportamento novo (mirar o dia fixo) só passa a valer depois que o dia fixo existir para aquele cliente. `proxima_data_visita` precisa dos dois caminhos: com âncora (dia fixo) e sem âncora (fallback = comportamento atual, intocado).

### Onde definir o dia fixo (D-02)
- **D-02:** O dia fixo se define num ÚNICO lugar: ao lado do Select de frequência de visita que já existe na ficha do cliente (mesmo componente que hoje só tem o Select de frequência). O aviso da Agenda (D-03) é apenas um atalho/link que leva direto pra essa mesma ficha — não existe um formulário duplicado ou paralelo dentro da Agenda.

### Aviso da Agenda (D-03)
- **D-03:** A Lista da Agenda (não o Calendário) ganha uma seção própria (ex: "Sem dia fixo definido") listando os clientes ativos que ainda não têm dia fixo — inclui quem nunca teve frequência definida E quem já tem frequência mas falta só o dia fixo (AGENDA-01 já cobre os dois casos). Cada item da lista, ao ser clicado, leva direto pra ficha do cliente (D-02) — não existe input inline na própria linha do aviso.

### Recalcular ao definir o dia fixo pela primeira vez (D-04)
- **D-04:** Se um cliente já tem uma próxima visita marcada (calculada pelo jeito antigo) e o vendedor define o dia fixo agora, a data JÁ marcada NÃO muda retroativamente — ela continua valendo como está. O dia fixo só passa a reger o cálculo da visita SEGUINTE, depois que a atual for concluída. Isso evita mudar de surpresa um compromisso que o vendedor já tinha combinado com o cliente.

### Claude's Discretion
- Exato texto/rótulo da seção nova na Agenda ("Sem dia fixo definido" é só um exemplo do dono, não um texto travado).
- Layout exato do Select de dia fixo/semana do mês na ficha do cliente (ao lado do Select de frequência existente vs. abaixo dele, etc.) — segue o padrão visual já usado na mesma seção.
- Algoritmo exato de "próxima ocorrência do dia fixo" em PL/pgSQL (a pesquisa do marco já mapeou o idioma comum — `date_trunc` + aritmética modular) — implementação de detalhe, não decisão de produto.
- Nomenclatura exata das colunas/enums novos em `clientes` (dia da semana, semana do mês) — segue convenção já estabelecida no projeto (nomes em português, minúsculo, snake_case).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pesquisa do marco v1.6
- `.planning/research/SUMMARY.md` — Fase 24 mapeada como "Nth-weekday-of-month PL/pgSQL algorithm... genuinely new calendar math"; recomenda `date_trunc` + aritmética modular, sem biblioteca nova (RRULE/cron rejeitados)
- `.planning/research/ARCHITECTURE.md` — Capability 3 (âncora de dia fixo): duas colunas nullable novas em `clientes` (não uma tabela nova), `proxima_data_visita` precisa de reescrita genuína (não só um parâmetro), todo chamador (`mover_card_funil`, `agenda_do_vendedor`) precisa ser tocado na mesma migration
- `.planning/research/PITFALLS.md` — Pitfall 3: "5ª ocorrência" pode não existir na maioria dos meses (já resolvido nos requisitos: opções ficam 1ª/2ª/3ª/4ª/Última, nunca 5ª — ver REQUIREMENTS.md Out of Scope); nunca sugerir data no passado; disciplina de timezone São Paulo já estabelecida por `bucketDoItem`/migration 0021 deve ser preservada

### Requisitos e decisões já travadas no marco
- `.planning/REQUIREMENTS.md` — ANCORA-01/02/03/04, AGENDA-01 (requisitos desta fase); Out of Scope confirma "1ª/2ª/3ª/4ª/Última" (nunca "5ª") e "sem planilha em massa para dia fixo"
- `.planning/PROJECT.md` Key Decisions — padrão de cálculo de data sempre no Postgres, nunca no navegador; `frequencia_visita` é um valor só (nunca duplicado entre ficha/Agenda)

### Precedentes de código a espelhar
- `supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql` — `proxima_data_visita()` atual (cálculo de offset fixo + clamp de fim de mês) — autoridade única a ser estendida, nunca duplicada
- `supabase/migrations/0021_agenda_concluidos_do_vendedor.sql` — disciplina de timezone São Paulo (`at time zone 'America/Sao_Paulo'`) a preservar no novo cálculo

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/agenda/itens.ts` — autoridade única de bucketing/agrupamento da Agenda; a nova seção "sem dia fixo" é uma extensão pura aqui, não uma segunda autoridade
- Select de frequência de visita já existente na ficha do cliente (`ClienteDetailSheet.tsx` / componente da seção Funil) — o dia fixo entra ao lado dele, mesmo padrão visual

### Established Patterns
- `proxima_data_visita()` é a autoridade ÚNICA de "próxima data de visita" (lição do Pitfall 1, v1.3) — a reescrita desta fase estende essa função, nunca cria uma segunda função paralela
- Toda seção nova da Agenda segue o padrão de leitura simples (SELECT direto, sem RPC nova) quando não há escrita em massa nem união complexa de tabelas — igual ao precedente de AGENDA-01 mapeado na pesquisa de arquitetura

### Integration Points
- `mover_card_funil` (seed da primeira visita ao marcar "ganho") e `agenda_do_vendedor()` (leitura de pendentes) precisam ser tocados na mesma migration que reescreve `proxima_data_visita`, pela mesma disciplina de "chamador único, nunca duplicar a lógica"

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica levantada nesta discussão — a fase segue o padrão visual já estabelecido (Select ao lado de Select, seção de lista igual às já existentes na Agenda).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma ideia fora de escopo surgiu durante esta discussão — as 4 áreas discutidas ficaram inteiramente dentro do domínio da Fase 24 (ANCORA-01..04, AGENDA-01).

### Reviewed Todos (not folded)
None — discussão não encontrou todos pendentes relacionados a esta fase.

</deferred>

---

*Phase: 24-dia-fixo-na-recorr-ncia-de-visita*
*Context gathered: 2026-08-26*
