# Phase 1: Autenticação e Papéis - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Todo usuário do time consegue se cadastrar (via convite do Supervisor) e entrar no sistema com segurança, e a distinção entre Supervisor e Vendedor já está em vigor no banco de dados (via RLS) — a base de autorização que toda fase seguinte depende para existir. Cobre: login, convite/criação de conta, recuperação de senha, e a aplicação do papel (Supervisor/Vendedor) em todo o sistema.

</domain>

<decisions>
## Implementation Decisions

### Criação de conta
- **D-01:** Não existe auto-cadastro aberto. O Supervisor cadastra o vendedor (nome, sobrenome, email, celular) de dentro do sistema, já logado — não é uma tela fora do login.
- **D-02:** Ao criar a conta, o sistema envia um convite por e-mail (fluxo padrão do Supabase Auth) para o vendedor definir a própria senha. O Supervisor nunca sabe a senha de ninguém.
- **D-03:** O primeiro Supervisor (o usuário/dono do projeto) é cadastrado diretamente no banco durante a implementação desta fase — não precisa de tela especial de "primeiro acesso". Claude deve pedir o email a ser usado quando for implementar este passo.
- **D-04 [informational]:** Desativar o acesso de um vendedor que saiu do time fica fora de escopo nesta fase — se precisar, é feito diretamente no banco por enquanto. Candidato a fase futura se virar necessidade recorrente. Also listed under Deferred Ideas below; no plan task expected.

### Atribuição de papel
- **D-05:** No formulário de cadastro de usuário, o Supervisor escolhe explicitamente o papel (Supervisor ou Vendedor) — não há um papel padrão implícito.
- **D-06:** O sistema deve suportar mais de um Supervisor desde o início (não travar a lógica assumindo supervisor único).
- **D-07:** Trocar o papel de um usuário já existente (ex: vendedor promovido a supervisor) fica fora de escopo nesta fase — ajuste feito diretamente no banco se acontecer.

### Recuperação de senha
- **D-08:** "Esqueci minha senha" entra nesta fase, usando o fluxo padrão do Supabase Auth (link por e-mail para redefinir).

### Tela de login e gestão de equipe
- **D-09:** Tela de login simples: campos de email e senha, mais o link "esqueci minha senha". Sem opção de auto-cadastro visível.
- **D-10:** O cadastro de novos vendedores/supervisores acontece dentro do sistema, numa área de "gerenciar equipe" acessível só a quem está logado como Supervisor — não é uma tela pública.

### Claude's Discretion
- Layout visual específico da tela de login e da área de gerenciar equipe (Claude decide, dentro do design system já escolhido em `.claude/CLAUDE.md` — shadcn/ui + Tailwind v4).
- Textos de erro e mensagens de feedback.
- Duração exata da sessão / estratégia de refresh de token — usar o padrão do `@supabase/ssr`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Convenções de backend (RLS/RPC/Edge Functions)
- `.claude/Skills/Supabase-conventions/SKILL.md` — como estruturar RLS, RPC e Edge Functions neste projeto; obrigatório para qualquer lógica de autorização/papéis

### Stack e bibliotecas já decididas
- `.claude/CLAUDE.md` §Technology Stack — `@supabase/ssr` para sessão (não usar `@supabase/auth-helpers-nextjs`, deprecado), `react-hook-form` + `zod` para formulários, shadcn/ui para os componentes de UI

### Pesquisa de domínio
- `.planning/research/ARCHITECTURE.md` — padrão de `SECURITY DEFINER` (`is_supervisor()`) para evitar recursão em policies de RLS; é o padrão a seguir para checar papel dentro de policies
- `.planning/research/PITFALLS.md` — pitfalls de RLS (vazamento silencioso, `auth.uid()` sem wrap em `(SELECT auth.uid())`, testar só como Supervisor nunca revela vazamento de Vendedor)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum ainda — projeto está no esqueleto padrão do `create-next-app` (Next.js 16, App Router, Tailwind v4), sem componentes de auth, formulários ou dados ainda implementados.

### Established Patterns
- Nenhum padrão de código estabelecido ainda — esta é a primeira fase de implementação real do projeto.

### Integration Points
- N/A — não há dependência de fases anteriores (Fase 1 é a fundação).

</code_context>

<specifics>
## Specific Ideas

- O fluxo de convite por e-mail deve ser o padrão nativo do Supabase Auth (não construir um sistema de convite customizado).
- "Gerenciar equipe" é o nome de trabalho da área onde o Supervisor cadastra vendedores/supervisores — pode virar um nome de tela diferente na implementação, mas o conceito (área protegida, só Supervisor, dentro do sistema logado) está fixado.

</specifics>

<deferred>
## Deferred Ideas

- Desativar/reativar acesso de um usuário pela tela — fora de escopo nesta fase (D-04). Candidato a fase futura.
- Trocar o papel de um usuário existente pela tela — fora de escopo nesta fase (D-07). Candidato a fase futura.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Autenticação e Papéis*
*Context gathered: 2026-07-14*
