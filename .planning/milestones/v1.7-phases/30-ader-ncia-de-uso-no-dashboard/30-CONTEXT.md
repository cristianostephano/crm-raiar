# Phase 30: Aderência de Uso no Dashboard - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Supervisor vê, na tabela comparativa por vendedor do Dashboard, um percentual de "aderência de uso" — quantos dos últimos 28 dias úteis cada vendedor de fato usou o sistema (login OU ação real no funil). Requisitos: ADER-01 a ADER-03.

</domain>

<decisions>
## Implementation Decisions

### O que conta como "usou o sistema naquele dia"
- **D-01:** Contar como "abriu alguma tela do sistema naquele dia" — não um evento de login de verdade do Supabase Auth. Como a sessão do app fica salva por dias, um vendedor que usa todo dia quase nunca "loga" de novo — medir login literal subestimaria drasticamente quem mais usa. Isso exige um mecanismo novo de registro (ver D-04).
- **D-02:** Além da abertura de tela, também conta qualquer ação real já registrada em `historico` — mover etapa, concluir tarefa/visita — **e** cadastro/edição de cliente, que HOJE NÃO fica registrado em `historico` (o gatilho de auditoria só grava troca de etapa/status e conclusões, achado já confirmado na fase de roteirização). Isso é um segundo mecanismo novo a construir ou um novo gatilho de auditoria a estender — decidir na pesquisa qual caminho é mais simples/seguro.
- **D-03:** Um dia conta como usado se **qualquer uma** dessas condições for verdadeira (união, não intersecção): abriu o sistema OU moveu etapa OU concluiu tarefa/visita OU cadastrou/editou cliente.

### Mecanismo técnico de registro (achado real, sem solução pronta ainda)
- **D-04:** Não existe hoje nenhum histórico de "quando o vendedor abriu o sistema" — só `auth.users.last_sign_in_at` (um valor só, sobrescrito a cada acesso, sem histórico). Este é o achado central que a pesquisa precisa resolver: como registrar "abriu o sistema hoje" de forma barata (sem gravar em toda navegação, só uma vez por dia por usuário) — candidatos a investigar: middleware do Next.js com uma tabela nova `acessos_diarios` (ou nome similar) que faz upsert idempotente (chave composta usuário+dia), disparado uma vez por sessão/dia; ou aproveitar alguma extensão do Supabase Auth. A escrita não pode ser cara (rodar em toda requisição autenticada seria caro) — precisa de alguma forma de "só grava se ainda não gravou hoje".
- **D-05:** O mesmo mecanismo (tabela nova, provavelmente) também é o lugar natural para registrar "cadastrou/editou cliente" se optarmos por não estender o gatilho de `historico` — decidir na pesquisa qual dos dois caminhos é mais consistente com o padrão já usado no projeto (trigger `SECURITY DEFINER` existente vs. tabela de eventos nova).

### Dias úteis e período
- **D-06:** "Dia útil" = segunda a sexta-feira, sem excluir feriados nacionais. Simplicidade deliberada — um feriado ocasional não distorce muito uma média de 4 semanas (28 dias corridos, não 28 dias úteis — confirmar essa distinção exata na pesquisa/planejamento: "últimos 28 dias" como janela de calendário, dentro da qual só os dias de semana entram no denominador).
- **D-07:** Vendedor admitido ou desativado no meio da janela de 28 dias: o percentual conta só os dias em que ele estava de fato ativo no time — nunca os 28 dias completos para quem entrou/saiu recentemente. **Achado técnico a resolver na pesquisa:** `profiles.ativo` (migration 0008) é um booleano simples, sem data de quando a desativação aconteceu — não existe hoje uma coluna `desativado_em` ou histórico de mudança desse campo. A pesquisa precisa confirmar se existe algum jeito de descobrir a data de desativação (ex: `historico` de outra tabela, timestamp de auditoria do Supabase Auth `banned_until`/`updated_at`, ou se é necessário adicionar uma coluna nova `desativado_em` a `profiles` nesta fase). Data de admissão já existe (`profiles.created_at`).

### Onde aparece
- **D-08 (já travado desde a definição do marco):** Só o Supervisor vê essa coluna — nem a coluna nem os dados por trás aparecem pra um Vendedor. Nova coluna na tabela comparativa por vendedor já existente (`ComparativoVendedorTable.tsx` / RPC `dashboard_comparativo_vendedor()`, migration 0011).
- **D-09:** Enquanto a janela de 28 dias ainda não está completa (ex: nos primeiros dias depois desta fase ir pra produção, já que a métrica só começa a contar a partir do dia do lançamento), o Dashboard precisa deixar isso claro em vez de mostrar um percentual artificialmente baixo — decidir o texto/indicador exato no planejamento (ex: "Coletando dados desde X" em vez do %, ou um aviso ao lado do número).

### Privacidade e retenção (LGPD)
- **D-10:** O registro de uso diário guarda **só quem e qual dia** — nunca horário, IP, aparelho ou localização. O dia é carimbado pelo servidor (nunca aceito cru do navegador).
- **D-11:** Prazo de guarda: só os últimos ~35 dias (margem sobre os 28 necessários), com descarte automático do resto — minimização de dado pessoal (LGPD). A pesquisa precisa propor o mecanismo de limpeza (ex: uma função agendada, ou um `DELETE` condicionado embutido na própria leitura/escrita, já que o projeto não tem cron/worker de fundo — mesma restrição de "custo zero de infraestrutura" já respeitada em todo o projeto).
- **D-12 (fora do escopo de código, responsabilidade do dono do projeto):** O dono decidiu que o time de vendas deve ser avisado de que o uso do sistema passa a ser medido. Isso é uma decisão de comunicação com os funcionários, não uma tarefa de implementação desta fase — não criar nenhum aviso/banner no próprio sistema para isso a menos que seja pedido explicitamente depois.

### Claude's Discretion
- Nome exato da tabela/mecanismo de registro de acesso diário.
- Texto exato do indicador "janela ainda incompleta" (D-09).
- Se o cadastro/edição de cliente é registrado estendendo o gatilho de `historico` existente ou via a tabela nova de acesso — decisão técnica sem impacto de produto, resolver na pesquisa.

</decisions>

<canonical_refs>
## Canonical References

### Tabela comparativa por vendedor (onde a coluna nova entra)
- `supabase/migrations/0011_dashboard_comparativo_vendedor.sql` — RPC `dashboard_comparativo_vendedor()`, `language sql stable`, sem `security definer`, molde de convenção de toda função `dashboard_*`
- `components/dashboard/ComparativoVendedorTable.tsx` — tabela visível só ao Supervisor
- `lib/supabase/queries/dashboard.ts`, `app/actions/dashboard.ts` — camada de leitura existente

### Equipe e desativação (D-07)
- `supabase/migrations/0008_desativacao_membro_equipe.sql` — onde `profiles.ativo` foi criado; verificar se existe qualquer registro de QUANDO a desativação aconteceu
- `profiles.created_at` — data de admissão, já existe, confirmado nesta sessão

### Histórico de auditoria existente (D-02/D-05)
- Gatilhos `SECURITY DEFINER` que já escrevem em `historico` (troca de etapa/status, conclusão de tarefa/visita) — ponto de partida se optarmos por estender em vez de criar mecanismo paralelo

No external specs — requisitos totalmente capturados nas decisões acima e em `.planning/REQUIREMENTS.md` (ADER-01..03).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dashboard_comparativo_vendedor()` já filtra por vendedor ativo e já é o padrão de "uma linha por vendedor" a estender com a coluna nova.
- Nenhuma dependência de cron/worker de fundo em todo o projeto (decisão de arquitetura já estabelecida desde a Fase 13) — qualquer limpeza de dado antigo (D-11) precisa seguir esse mesmo princípio.

### Established Patterns
- Toda função `dashboard_*` é `SECURITY INVOKER` por omissão, RLS como única fronteira.
- Toda tabela nova segue o padrão de RLS explícito, nunca aberta.

### Integration Points
- Se o mecanismo de registro de acesso diário for um middleware, ele precisa ser leve o bastante para não pesar em toda requisição autenticada — provavelmente um upsert condicional (só grava se ainda não tem registro do dia).

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica — a coluna nova entra na tabela comparativa já existente, sem mudança de layout maior.

</specifics>

<deferred>
## Deferred Ideas

- Comunicação ao time sobre a métrica de uso (D-12) — fora do escopo de código, responsabilidade do dono do projeto.

</deferred>

---

*Phase: 30-Aderência de Uso no Dashboard*
*Context gathered: 2026-09-27*
