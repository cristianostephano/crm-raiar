# Phase 29: Encerrar Cliente Ativo - Context

**Gathered:** 2026-09-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Cliente ativo (já "Ganho") que parou de comprar pode ser marcado como "Encerrado" pelo próprio vendedor, com motivo obrigatório. Isso tira o cliente da rotina da Agenda mas mantém histórico e diário intactos. Dá pra reativar depois, voltando direto como "Ganho" (sem reprospectar). Requisitos: ENCR-01 a ENCR-05.

</domain>

<decisions>
## Implementation Decisions

### Nome e mecanismo do novo status
- **D-01:** Rótulo exibido é **"Encerrado"** (não "Inativo").
- **D-02 (achado técnico, confirmado por leitura de código):** `status_acompanhamento` é um **enum nativo do Postgres** (`status_acompanhamento_enum`, migration 0002), hoje com 3 valores (`em_andamento`, `perdido`, `ganho`). Adicionar "encerrado" exige `ALTER TYPE status_acompanhamento_enum ADD VALUE 'encerrado'` numa migration nova — não é uma lista editável (diferente de categoria/motivo de perda/etc). Confirmar durante a pesquisa a forma segura de fazer isso (`ALTER TYPE ... ADD VALUE` tem restrições de transação em algumas versões do Postgres — verificar se pode rodar dentro da mesma migration que já usa o tipo, ou se precisa de um passo em duas migrations).
- **D-03:** Mirando o padrão já usado por `perdido` (`chk_perdido_exige_motivo`), o novo status "Encerrado" também precisa de uma trava `CHECK` exigindo motivo preenchido — nova tabela `motivos_encerramento` (7ª lista editável do projeto, mesmo padrão RLS de 4 policies das outras 6: SELECT aberto a `authenticated`, INSERT/UPDATE/DELETE atrás de `is_supervisor()`), nova coluna `motivo_encerramento_id` em `clientes`, novo `CHECK (status_acompanhamento <> 'encerrado' or motivo_encerramento_id is not null)`.
- **D-04:** "Encerrado" só é alcançável a partir de "Ganho" (cliente já precisa ser ativo). Mirar `chk_ganho_somente_etapa_final` — decidir na pesquisa/planejamento se um CHECK equivalente (`status_acompanhamento <> 'encerrado' or etapa = 'primeira_venda'`) faz sentido, já que um cliente encerrado sempre veio de "Ganho" e portanto já está na etapa final.

### Onde a ação de encerrar aparece
- **D-05:** Dentro do Select de Status já existente na ficha do cliente (`ClienteDetailSheet.tsx`), como uma 4ª opção — mesmo lugar de "Em andamento/Ganho/Perdido". Ao escolher "Encerrado", abre o mesmo tipo de diálogo que já existe para "Perdido" (`PerdaMotivoDialog.tsx`), mas pedindo o motivo de encerramento (novo componente análogo, ou o mesmo componente generalizado — decidir no planejamento).
- **D-06:** Vendedor faz isso sozinho, nos próprios clientes, sem depender do Supervisor — mesma regra de RLS de sempre (vendedor só edita os próprios clientes), sem exceção nova.

### Onde encontrar um cliente encerrado para reativar
- **D-07:** Nova tela própria, **mesmo padrão visual e estrutural da tela "Perdidos"** (Fase 28) — reaproveitar ao máximo os componentes já construídos (`PerdidosItemRow.tsx`, `PerdidosPeriodoFilter.tsx`, `PerdidosList.tsx` como moldes diretos, possivelmente generalizáveis em vez de duplicados — decidir no planejamento se vale a pena parametrizar os componentes da Fase 28 para servir às duas telas, ou se cada tela mantém seus próprios componentes-irmãos independentes).
- **D-08:** Mesma regra de visibilidade: vendedor só vê os próprios clientes encerrados, Supervisor vê os de todo o time — via RLS, nunca checagem manual.
- **D-09:** Botão "Reativar" de toque simples, sem diálogo de confirmação — mesmo padrão do "Reabrir" da Fase 28.

### Comportamento ao reativar
- **D-10:** Reativar volta o cliente direto para "Ganho" (não para "Em andamento", nem reprospectando pelas 7 etapas) — ele já era um cliente ativo antes de encerrar.
- **D-11 (achado técnico a confirmar na pesquisa):** O RPC `mover_card_funil` já tem guards que disparam especificamente na TRANSIÇÃO para "ganho" (CNPJ, razão social, endereço completos — migrations 0018/0025), condicionados a "pediu ganho E status atual ainda não é ganho". Reativar de "encerrado" pra "ganho" é uma transição desse tipo — o guard vai disparar de novo. Como o cliente já tinha esses campos preenchidos (era ganho antes de encerrar), o valor efetivo (coalesce do parâmetro com o já gravado) deve deixar passar sem problema — confirmar isso com um teste de integração explícito na pesquisa/planejamento, mesmo padrão do achado equivalente da Fase 28 (reabrir perdido não dispara guard de ganho porque o destino é "em_andamento", não "ganho" — aqui é o oposto, o destino É "ganho", então o guard roda e precisa ser confirmado como inofensivo, não simplesmente assumido).

### Sair da rotina da Agenda
- **D-12:** Cliente "Encerrado" some da Agenda (para de gerar lembrete de visita) e some da seção "Sem dia fixo definido" — confirmar na pesquisa exatamente quais leituras hoje filtram por `status_acompanhamento = 'ganho'` (já confirmado: `getClientesSemDiaFixo` em `lib/supabase/queries/agenda.ts` linha ~201 já filtra só por `'ganho'`, então um cliente "encerrado" já sai dali automaticamente, sem mudança). Confirmar `agenda_do_vendedor()` (RPC) da mesma forma — a pesquisa deve ler a definição da função na migration correspondente.
- **D-13:** Kanban de prospecção — "Encerrado" também deve sair das 7 colunas, mesmo tratamento que "Ganho" e "Perdido" já recebem (`lib/funil/prospeccao.ts`, Fases anteriores/Fase 28) — estender o conjunto `STATUS_FORA_DA_PROSPECCAO_LISTA` de 2 para 3 valores.

### Claude's Discretion
- Nome exato do componente de diálogo de motivo de encerramento (novo, ou generalização do `PerdaMotivoDialog`).
- Se os componentes da tela de Perdidos (Fase 28) são generalizados/parametrizados para reaproveitar na tela de Encerrados, ou duplicados como componentes irmãos — decisão técnica de arquitetura, sem impacto de produto.
- Nome/ícone do menu para a nova tela ("Encerrados"?), seguindo o mesmo padrão do item "Perdidos" (sem contador, mesmo nível de menu).

</decisions>

<canonical_refs>
## Canonical References

### Padrão "sai da rotina" já em produção (Fase 28, referência direta)
- `lib/funil/prospeccao.ts` — módulo a estender de 2 para 3 status excluídos (D-13)
- `.planning/phases/28-relat-rio-de-perdidos/` — PLAN/SUMMARY completos da fase irmã, molde estrutural direto pra esta fase inteira (migration+RLS, camada de dados, tela)
- `components/perdidos/PerdidosItemRow.tsx`, `PerdidosPeriodoFilter.tsx`, `PerdidosList.tsx`, `app/(app)/perdidos/page.tsx` — componentes-molde pra tela de Encerrados (D-07)
- `supabase/migrations/0034_clientes_perdidos.sql` — molde de RPC somente-leitura, sem security definer, RLS como fronteira (o mesmo padrão vale pra uma futura `clientes_encerrados`)

### Enum e constraints existentes (fundação técnica, D-02/D-03/D-04)
- `supabase/migrations/0002_clientes_and_funil.sql` — `status_acompanhamento_enum` (linha ~38), `chk_ganho_somente_etapa_final`/`chk_perdido_exige_motivo` (linha ~128-131), tabela `motivos_perda` (padrão de lista editável a espelhar para `motivos_encerramento`)
- `supabase/migrations/0018_cnpj_obrigatorio_ganho.sql` (ou equivalente) + `0025_...` — guards de "ganho" no `mover_card_funil` (D-11)

### Motivo de perda (componente/fluxo já existente a espelhar)
- `components/clientes/PerdaMotivoDialog.tsx` — molde de diálogo de motivo obrigatório (D-05)
- `lib/supabase/queries/clientes.ts` (linha ~783+) — catálogo de motivos de perda ativo, molde pra catálogo de motivos de encerramento

### Agenda (pontos de exclusão a confirmar, D-12)
- `lib/supabase/queries/agenda.ts` — `getClientesSemDiaFixo()` (linha ~201, já filtra só `'ganho'`, sem mudança necessária)
- RPC `agenda_do_vendedor()` — confirmar definição exata na migration correspondente durante a pesquisa

No external specs — requisitos totalmente capturados nas decisões acima e em `.planning/REQUIREMENTS.md` (ENCR-01..05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Toda a Fase 28 inteira é o molde estrutural desta fase — migration+RLS (28-01), regra de exclusão do Kanban (28-02), camada de dados paginada (28-03), tela com filtro/busca/ação de um toque (28-04).
- `marcarStatus`/`mover_card_funil` já existem e já suportam qualquer transição de status — D-10/D-11 usam o mecanismo existente, nunca uma lógica paralela (mesmo princípio D-08 da Fase 28).

### Established Patterns
- Toda lista editável nova (aqui, `motivos_encerramento`) segue as 4 policies de RLS já usadas pelas outras 6 listas do projeto.
- Toda leitura nova de relatório é `language sql stable`, sem `security definer`, RLS como única fronteira.

### Integration Points
- `lib/funil/prospeccao.ts` (D-13) e as leituras da Agenda (D-12) são os dois pontos de integração que precisam ser tocados pra "Encerrado" desaparecer da rotina, mirando exatamente os mesmos dois pontos que "Perdido" tocou na Fase 28.

</code_context>

<specifics>
## Specific Ideas

Reaproveitar ao máximo o padrão visual e estrutural da Fase 28 (Perdidos) — não inventar um design novo.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — a discussão ficou dentro do escopo da fase (ENCR-01..05).

</deferred>

---

*Phase: 29-Encerrar Cliente Ativo*
*Context gathered: 2026-09-26*
