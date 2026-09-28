# Phase 28: Relatório de Perdidos - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Cliente marcado como "Perdido" para de ocupar espaço no funil de prospecção (as 7 colunas do Kanban) e passa a ter uma tela própria, "Perdidos", onde cada vendedor vê os próprios (Supervisor vê os de todo o time), filtra por período, e reabre um cliente com um toque, voltando-o pro funil como "Em andamento". Requisitos: PERD-01 a PERD-05.

</domain>

<decisions>
## Implementation Decisions

### Onde o controle aparece
- **D-01:** Item novo no menu principal (`PRINCIPAL_SECTION` de `components/layout/AppSidebar.tsx`), no mesmo nível de Agenda/Clientes/Dashboard — não uma aba dentro de Clientes.
- **D-02:** O item do menu mostra só o rótulo "Perdidos", **sem contador** (diferente do padrão da Agenda, que mostra contagem de pendências) — decisão explícita do dono: perdido não é uma pendência urgente, um número ali soaria como alarme à toa.
- **D-03 (Claude's Discretion):** Ícone do menu — escolher um `lucide-react` já usado no projeto que não colida com os já usados (`ListChecks` Agenda, `Users` Clientes, `LayoutDashboard` Dashboard, `UsersRound`/`Settings`/`FileUp`/`BadgeCheck` na seção Administração). Sugestão: `Archive` ou `XCircle` — confirmar durante o planejamento pela leitura do conjunto de ícones já importado no arquivo.

### Estilo visual da lista
- **D-04:** Lista simples, uma linha por cliente — reaproveitar o estilo visual já estabelecido em `components/agenda/AgendaSemDiaFixo.tsx`/`AgendaItemRow.tsx` (mesmo `Card size="sm"`, mesmo espaçamento), NÃO o card do Kanban. Cada linha mostra: nome do cliente (via `nomeExibicaoCliente()`, mesma regra de fallback pro Nome Fantasia), motivo da perda, data em que foi perdido, vendedor responsável (só quando `showResponsavel`, mesmo padrão do resto do sistema), e um botão "Reabrir" de toque simples (mesmo tamanho/formato dos botões de ação rápida já usados no `ClienteCard`, `size-11`).
- **D-05:** Reabrir aplica na hora, sem diálogo de confirmação — mesmo padrão de UX já usado nas setas de etapa (quick task 260921-n0a) e no restante do projeto: ações reversíveis não pedem confirmação.

### Regra de visibilidade (mudança técnica no módulo existente)
- **D-06:** `lib/funil/prospeccao.ts` precisa mudar de "um status só" (`STATUS_FORA_DA_PROSPECCAO = "ganho"`) para um CONJUNTO de dois status (`"ganho"` e `"perdido"`) que saem das 7 colunas. Isso muda a assinatura de `apareceNaProspeccao()` de comparação simples para checagem de pertencimento num Set/array. O comentário de cabeçalho do módulo ("Cliente perdido continua aparecendo normalmente") precisa ser atualizado/corrigido nesta fase — está desatualizado a partir de agora. Mesmo espírito da migração já feita pra "ganho" (quick task 260915-ls7): regra de EXIBIÇÃO no Kanban, nunca de autorização (RLS continua a fronteira real).
- **D-07:** A mesma armadilha de exportação que a 260915-ls7 resolveu com a flag `escopoTudo` precisa ser respeitada aqui: "Exportar todos" não pode silenciosamente parar de trazer os clientes perdidos só porque eles saíram do Kanban visualmente.

### Reabrir um cliente perdido
- **D-08:** Reabrir muda `status_acompanhamento` de volta para `"em_andamento"`, usando o mesmo mecanismo de escrita que já existe (`marcarStatus`/`mover_card_funil` — nunca uma lógica paralela, mesmo princípio D-04 da Fase 27). Isso automaticamente faz o cliente voltar a aparecer no Kanban (D-06 acima), na etapa em que ele já estava quando foi perdido (etapa não muda ao reabrir, só o status).
- **D-09 (Claude's Discretion):** Após reabrir, a linha some da tela de Perdidos (o cliente deixou de ser perdido) — comportamento natural da própria consulta ser refeita, sem necessidade de lógica extra de remoção de linha.

### Visibilidade e filtro
- **D-10:** Vendedor vê só os próprios clientes perdidos; Supervisor vê os de todo o time — mesma regra de RLS já usada em todo o resto do sistema (Kanban, Agenda), sem exceção nova (confirmado explicitamente pelo dono do projeto).
- **D-11:** Filtro por período = data em que o cliente foi marcado como perdido (`etapa_alterada_em` ou equivalente já usado pelo histórico — confirmar durante planejamento/pesquisa qual coluna already registra essa data com precisão, possivelmente via `historico`).

### Claude's Discretion
- Layout exato da página (título, posição do filtro de período, se tem busca por nome também).
- Se o filtro de período tem um padrão (ex: "últimos 90 dias") ou mostra tudo por padrão — decidir durante planejamento, sem nova pergunta ao usuário.

</decisions>

<canonical_refs>
## Canonical References

### Padrão "sai do Kanban" já em produção (referência direta a replicar)
- `lib/funil/prospeccao.ts` — módulo a estender (D-06)
- `.planning/quick/260915-ls7-cliente-ganho-deve-sumir-do-kanban-de-pr/` — SUMMARY/PLAN da mudança irmã já shippada, mesmo padrão de mudança
- `app/api/clientes/exportar/route.ts` + `KanbanBoard.tsx` (flag `escopoTudo`) — mecanismo de exportação a preservar (D-07)

### Padrão visual "lista simples" a reaproveitar
- `components/agenda/AgendaSemDiaFixo.tsx` — molde de linha/card a copiar (D-04)
- `components/agenda/AgendaItemRow.tsx` — outro molde de referência, já usado pela Agenda

### Motivo de perda (lista editável já existente)
- `components/clientes/PerdaMotivoDialog.tsx` — fluxo já existente de marcar como perdido com motivo obrigatório
- `lib/supabase/queries/clientes.ts` (linha ~783+) — catálogo de motivos de perda ativo, e o `motivo_perda_id`/`motivoPerdaId` já presente no tipo de cliente

### Menu
- `components/layout/AppSidebar.tsx` — `PRINCIPAL_SECTION` (linhas 69-76), onde o novo item entra (D-01/D-02/D-03)

### Nome de exibição (já estabelecido, reaproveitar sem duplicar)
- `lib/clientes/nomeExibicao.ts` — `nomeExibicaoCliente()`, mesma função usada na Fase 27

No external specs — requisitos totalmente capturados nas decisões acima e em `.planning/REQUIREMENTS.md` (PERD-01..05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nomeExibicaoCliente()`, `rotuloCidadeEstado()` (se período/localização entrar na lista futuramente) — já testados e usados em 3+ lugares.
- Padrão de botão de ação rápida `size-11` já estabelecido em `ClienteCard.tsx`'s `QuickActionIcon`/`EtapaArrowButton` — reaproveitar pro botão "Reabrir".

### Established Patterns
- Toda leitura scoped por papel (vendedor só os próprios, Supervisor todos) já é feita via RLS no Postgres, nunca checagem manual no código — `getClientesAgrupadosPorEtapa`/`getClientesSemDiaFixo` são os moldes diretos.
- Toda mudança de status/etapa passa por `marcarStatus`/`moverCard` → RPC `mover_card_funil`, nunca update direto — D-08 segue esse padrão.

### Integration Points
- `lib/funil/prospeccao.ts`'s mudança (D-06) afeta diretamente `getClientesAgrupadosPorEtapa` (o único consumidor hoje) — qualquer novo consumidor (a nova consulta de Perdidos) é um consumidor NOVO e SEPARADO, não deve reusar a mesma função de agrupamento por etapa do Kanban.

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual nova — reaproveitar exatamente o estilo já estabelecido na Agenda (D-04).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — a discussão ficou dentro do escopo da fase (PERD-01..05).

</deferred>

---

*Phase: 28-Relatório de Perdidos*
*Context gathered: 2026-09-25*
