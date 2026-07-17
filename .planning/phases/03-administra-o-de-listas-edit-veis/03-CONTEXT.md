# Phase 3: Administração de Listas Editáveis - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Supervisor cadastra, edita e desativa (nunca apaga de vez) os valores das quatro listas que alimentam o cadastro de clientes e o funil: categoria, produtos consumidos, tipos de tarefa, motivos de perda. As quatro tabelas (`categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda`) já existem desde a Fase 2, com coluna `ativo` para soft-delete e seed inicial. Esta fase constrói só a interface de administração — não cria tabelas novas.

</domain>

<decisions>
## Implementation Decisions

### Layout
- **D-01:** Uma única tela, com abas para as 4 listas (Categoria / Produtos consumidos / Tipos de tarefa / Motivos de perda) — não são 4 páginas separadas.
- **D-02:** A tela fica no menu como "Configurações", visível só para o Supervisor — mesmo padrão de proteção de rota já usado em "Gerenciar equipe" (Fase 1).

### Remover (soft-delete)
- **D-03:** "Remover" um valor sempre desativa (`ativo = false`), nunca apaga a linha do banco. Um valor desativado desaparece das opções para novos cadastros, mas continua aparecendo normalmente para os clientes que já o usam (nada quebra, nenhum dado é perdido).

### Editar
- **D-04:** O Supervisor pode editar o texto de um valor já existente (ex: corrigir um nome digitado errado) diretamente, sem precisar desativar e recriar.

### Claude's Discretion
- Layout visual exato das abas e da lista dentro de cada aba (dentro do design system já estabelecido: shadcn/ui, azul como único destaque).
- Textos de confirmação ao desativar um valor.
- Ordem de exibição dos valores dentro de cada lista (ex: alfabética, ou ordem de criação).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Convenções de backend
- `.claude/Skills/Supabase-conventions/SKILL.md` — RLS para as 4 tabelas de lookup (leitura ampla, escrita restrita a Supervisor via `is_supervisor()`)

### Padrões já estabelecidos
- `.claude/CLAUDE.md` §Technology Stack — shadcn/ui, react-hook-form + zod
- `.planning/phases/01-autentica-o-e-pap-is/01-04-SUMMARY.md` — padrão de tela protegida só-Supervisor ("Gerenciar equipe"), reaproveitar para "Configurações"
- `.planning/phases/02-cadastro-e-gest-o-de-clientes-pj/02-01-SUMMARY.md` — estrutura exata das 4 tabelas de lookup (`categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda`), coluna `ativo`, seed inicial
- `.planning/phases/02-cadastro-e-gest-o-de-clientes-pj/02-07-SUMMARY.md` — `getTiposTarefaAtivos`/`getMotivosPerdaAtivos` (padrão de leitura já usado, esta fase adiciona create/update/deactivate)
- Bug corrigido na Fase 2 (commit `4dbcfc4`): `getCategoriasAtivas`/`getProdutosAtivos` já existem em `lib/supabase/queries/clientes.ts` — reaproveitar essas queries de leitura, só falta write (criar/editar/desativar)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/(app)/equipe/page.tsx` — padrão de tela Supervisor-only a reaproveitar para "Configurações"
- `lib/supabase/queries/clientes.ts` — já tem `getCategoriasAtivas`, `getProdutosAtivos`, `getTiposTarefaAtivos`, `getMotivosPerdaAtivos` (leitura); esta fase precisa de create/update/deactivate para as 4 tabelas
- `components/ui/tabs.tsx` — já instalado (Fase 2), reaproveitar para as abas desta tela

### Established Patterns
- RLS com `is_supervisor()` `SECURITY DEFINER` já estabelecido — aplicar às policies de escrita das 4 tabelas
- Soft-delete via coluna `ativo` já é o padrão (não `DELETE`)

### Integration Points
- Mudanças nessas 4 tabelas devem refletir imediatamente nos dropdowns já existentes em `ClienteQuickCreateForm.tsx` e `ClienteDetailSheet.tsx` (categoria/produtos) e no fluxo de tarefas/perda (`PerdaMotivoDialog.tsx`)

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica fornecida para esta fase — segue o design system já estabelecido.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Administração de Listas Editáveis*
*Context gathered: 2026-07-17*
