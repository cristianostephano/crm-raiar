# Phase 33: Agenda Atual sem Visitas Automáticas de Clientes Ativos - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Durante o piloto, a Agenda atual passa a mostrar só o que vem da prospecção. Clientes ativos ("ganho") deixam de aparecer lá sozinhos por frequência de visita ou dia fixo — na Lista, nos pendentes do Calendário e no contador do menu, sempre concordando entre si. Nada é apagado do cadastro, para ser possível voltar atrás se o dono escolher manter a Agenda atual. A prospecção continua exatamente como hoje.

</domain>

<decisions>
## Implementation Decisions

- **D-32:** A seção "Sem dia fixo definido" (`getClientesSemDiaFixo()` em `lib/supabase/queries/agenda.ts` + `components/agenda/AgendaSemDiaFixo.tsx`, ligada em `AgendaList.tsx`) SAI da Agenda atual durante o piloto. O vendedor deixa de ser cobrado por definir frequência/dia fixo, que não alimenta mais nada. Reversível: volta se o dono mantiver a Agenda atual. (Decidido pelo dono em 2026-10-03.)
- **D-33:** O histórico de visitas já concluídas continua aparecendo no calendário da Agenda atual em datas passadas (`agenda_concluidos_do_vendedor()`, Fase 21) e no Diário de cada cliente. É o que foi feito de verdade, não uma entrada automática; nada que já foi registrado some.
- **D-34:** As visitas continuam sendo CRIADAS no banco em silêncio (`mover_card_funil` cria a primeira ao marcar ganho; `concluir_visita` cria a próxima), só deixam de ser LIDAS pela Agenda. Nenhuma função de escrita é alterada, em particular NÃO se mexe em `mover_card_funil`, a função mais crítica do funil. Consequência aceita: se o dono voltar à Agenda atual, visitas acumuladas podem reaparecer atrasadas de uma vez. Nenhuma visita existente é apagada.
- **D-35:** A caixinha de "ganho" continua pedindo a frequência de visita (a trava no banco, "Frequência de visita é obrigatória ao marcar um cliente como ganho", fica como está). Não se mexe na trava de ganho nem em seus testes das v1.3/v1.4/v1.6.
- **D-36:** Tarefas de prospecção pendentes de um cliente já ganho continuam aparecendo na Agenda atual (a metade de prospecção de `agenda_do_vendedor()` não muda — requisito explícito).
- **D-37:** Frequência de visita e dia fixo continuam visíveis e editáveis na ficha do cliente ativo, com os mesmos valores de antes.

### Claude's Discretion
- Forma exata de esconder a metade "visitas" de `agenda_do_vendedor()`: migration NOVA (nunca editar uma antiga) com as mesmas colunas de retorno (só o corpo muda, sem criar sobrecarga ambígua de função), registrando o corpo original para uma migration de volta (ROADMAP nota f).
- Como separar os testes: os que esperam visitas na Agenda atual mudam de propósito; os de prospecção devem passar SEM edição (oráculo de regressão) — ROADMAP nota g.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` §"Phase 33" — goal, 5 critérios de sucesso e notas (a)-(g) com os dois caminhos de leitura (RPC `agenda_do_vendedor()` e seção "Sem dia fixo definido"), reversibilidade e testes.
- `.planning/REQUIREMENTS.md` — AGD-16.
- `supabase/migrations/0036*` (versão mais recente de `agenda_do_vendedor()` segundo o ROADMAP) e as migrations que a antecedem — corpo atual a ser reproduzido sem a metade de visitas.
- `lib/supabase/queries/agenda.ts` (`getAgendaPendentesCount`, `getClientesSemDiaFixo`), `components/agenda/AgendaList.tsx`, `components/agenda/AgendaSemDiaFixo.tsx`, `components/layout/AppSidebar.tsx` (contador) — pontos de leitura afetados.
- `tests/agenda/*` e `tests/clientes/frequencia-visita.test.ts` — testes existentes; separar os que mudam de propósito dos de prospecção.
- Fases 31 e 32 (Agenda 2): isoladas desta; não tocar `components/agenda2`, `lib/agenda2`, tabela `agenda2_itens`.

### LGPD
Esta fase não coleta nem guarda dado novo. Visitas continuam sendo criadas escondidas (D-34); isso não adiciona dado pessoal além do que já existia. Prazo de guarda de 1 ano da Agenda 2 segue sem descarte automático (fora desta fase).

</canonical_refs>

<code_context>
## Existing Code Insights

- Mudança de comportamento numa leitura já em produção e usada todo dia: priorizar prova de que a prospecção não mudou (mesmas datas, ordem, destaque de atraso, conclusão com resumo, contador).
- Padrão do projeto: migration nova, nunca editar migration aplicada; função recriada com a mesma assinatura; aprovação do dono antes de aplicar em produção (o dono cola o SQL no editor do Supabase, como na Fase 31).

</code_context>

<specifics>
## Specific Ideas

Nenhuma além do ROADMAP e das decisões acima.

</specifics>

<deferred>
## Deferred Ideas

- Parar de criar visitas em silêncio e afrouxar a trava de frequência no ganho — descartados para o piloto (D-34/D-35); revisitar só se o dono decidir manter a Agenda 2 de vez e remover o modelo automático.

</deferred>

---

*Phase: 33-Agenda Atual sem Visitas Automáticas de Clientes Ativos*
*Context gathered: 2026-10-03*
