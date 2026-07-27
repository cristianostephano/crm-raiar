# Phase 10: Desativação de Membro da Equipe - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

O Supervisor consegue desativar (nunca apagar) um membro da equipe pela tela "Gerenciar equipe", transferindo antes os clientes em andamento desse membro para um substituto escolhido. Um membro desativado não consegue mais entrar no sistema, mas seu nome e histórico continuam intactos e visíveis. O sistema nunca permite ficar sem nenhum Supervisor ativo. É possível reativar um membro desativado depois.

</domain>

<decisions>
## Implementation Decisions

### Autodesativação
- **D-01:** Um Supervisor NÃO pode desativar a própria conta, mesmo havendo outros Supervisores ativos (regra separada da trava do "último Supervisor ativo" — essa é sobre nunca zerar Supervisores, esta é sobre nunca se autodesativar no meio de uma ação).

### Reativação
- **D-02:** É possível reativar um membro desativado depois. A pessoa desativada continua aparecendo na lista "Gerenciar equipe" (com um selo/indicação "Inativo"), e o Supervisor tem uma ação para reativar o acesso dela quando quiser.

### Substituto mesmo sem cliente em andamento
- **D-03:** O fluxo de desativação SEMPRE pede para escolher um vendedor substituto, mesmo quando o vendedor a ser desativado não tem nenhum cliente em andamento pra transferir (só clientes fechados/perdidos) — mantém um único caminho na tela, sem bifurcação condicional.

### Claude's Discretion
- Exato local/gatilho na tela "Gerenciar equipe" (ex: botão "Desativar" por linha, ou um menu de ações "...") e o desenho exato do diálogo de escolha do substituto.
- Nome e assinatura exatos da nova RPC de desativação/reativação, e se desativação e reativação são a mesma RPC com um parâmetro ou duas RPCs separadas.
- Estratégia técnica exata para bloquear o login do membro desativado (ex: `supabase.auth.admin.updateUserById` com `ban_duration`, chamado de uma Server Action com a service_role key) — decisão de implementação, já mapeada em `.planning/research/ARCHITECTURE.md` (v1.2 Additions).
- Se a coluna `profiles.ativo` precisa de uma RPC `security definer` pra ser escrita (dado que `profiles` hoje não tem nenhuma policy de UPDATE pra usuários comuns — ver Code Context) ou se uma nova policy de UPDATE restrita a Supervisor é o caminho certo.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` — EQP-01, EQP-02, EQP-03, EQP-04
- `.planning/ROADMAP.md` (Phase 10) — objetivo e critérios de sucesso já aprovados

### Pesquisa do marco (v1.2)
- `.planning/research/ARCHITECTURE.md` (seção "v1.2 Additions") — `profiles.ativo boolean not null default true` + uma linha a mais em `is_supervisor()` (`and ativo = true`); login-block via Auth Admin API (`ban_duration`) não pode rodar dentro do Postgres, precisa de uma Server Action com service_role key chamada DEPOIS da RPC de reatribuição; nova RPC `desativar_membro_equipe()` segue o padrão não-security-definer de `mover_card_funil`/`importar_clientes_lote`
- `.planning/research/FEATURES.md` (Milestone Addendum: v1.2) — Item 1 é o de maior risco do marco; reatribuição deve ser só de clientes em andamento (D-01 do marco), preservando precisão histórica
- `.planning/research/PITFALLS.md` (Milestone Addendum: v1.2) — pitfall sobre desativação ser um problema de DOIS sistemas (Postgres + Auth), não um só: `ban_duration` só bloqueia logins/refreshes futuros, não revoga um JWT já emitido (residual de até ~1h); pitfall sobre o bug de CTE/RLS do Fase 7 (migration 0006) sendo diretamente relevante pra essa RPC de reatribuição+desativação

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/(app)/equipe/page.tsx` — tela "Gerenciar equipe" atual: lista todos os membros (nome, sobrenome, papel, email), com botão "Convidar" (`InviteUserForm`). Nenhuma ação de desativar/reativar existe hoje — precisa ser adicionada como nova coluna/ação por linha.
- `supabase/migrations/0001_profiles_and_roles.sql` — `profiles` table e `is_supervisor()` (este SIM é `security definer`, deliberadamente, pra evitar recursão de policy — é uma exceção documentada à regra geral de RPCs não-security-definer). `profiles` hoje NÃO tem nenhuma policy de INSERT/UPDATE/DELETE pra usuários comuns — só o trigger `handle_new_user` (também security definer) escreve nela. Isso significa que a nova coluna `ativo` não pode ser atualizada por um UPDATE direto do cliente sem uma RPC ou policy nova.
- `supabase/functions/invite-user/index.ts` — Edge Function existente que já usa a Auth Admin API (para convidar) com a service_role key — é o precedente mais próximo pra "chamar a Auth Admin API a partir do backend" nesta base de código, embora seja uma Edge Function (Deno) e não uma Server Action; vale checar se o padrão de desativação deve seguir o mesmo formato (Edge Function) ou uma Server Action comum (Next.js), conforme o research já mapeou.
- `supabase/migrations/0002_clientes_and_funil.sql` — `mover_card_funil` é o modelo de RPC não-security-definer com guard explícito a seguir para `desativar_membro_equipe`.

### Established Patterns
- Toda nova tabela/coluna sensível precisa de RLS explícita; `profiles` já tem RLS habilitada, então qualquer mudança de escrita precisa passar por uma RPC ou nova policy, nunca um UPDATE direto sem controle.
- Padrão de dois passos (RPC Postgres + chamada separada à Auth Admin API) já estabelecido pela pesquisa do marco para este caso específico — não tentar fazer tudo numa função Postgres só.

### Integration Points
- Nova coluna `profiles.ativo` + ajuste em `is_supervisor()` — impacta toda policy que já depende de `is_supervisor()` (efeito em cadeia esperado e correto, não uma regressão).
- Nova tela/ação dentro de `app/(app)/equipe/page.tsx`.
- Reatribuição de clientes em andamento — só os campos `clientes.responsavel` de clientes com `status_acompanhamento = 'em_andamento'` mudam; clientes `ganho`/`perdido` do vendedor desativado continuam como estão (D-04 do marco, já travado nas decisões do roadmap).

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica além do que já foi decidido no discovery do marco (ver `.planning/PROJECT.md` Key Decisions e `.planning/ROADMAP.md` Fase 10).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 10-Desativação de Membro da Equipe*
*Context gathered: 2026-07-26*
