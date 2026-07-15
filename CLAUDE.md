# CRM — Contexto do Projeto

Este é um CRM de **acompanhamento de vendas** (funil/kanban), em fase de MVP, com objetivo de validar a ideia com custo zero de infraestrutura antes de qualquer investimento em escala.

## Stack (não mudar sem discutir antes)

- **Frontend:** React (via Next.js) — TypeScript
- **Persistência, Auth e API:** Supabase (Postgres + Auth + RLS + Storage)
- **Lógica de backend adicional (se necessário):** Supabase Edge Functions (Deno/TS)
- **Deploy:** Vercel (frontend) + Supabase Cloud (free tier)

**Não existe backend Node.js separado neste projeto.** As convenções completas de como estruturar lógica no Supabase (RLS x RPC x Edge Function) estão na skill `supabase-conventions` — ela carrega automaticamente sempre que a tarefa envolver banco de dados, então não precisa repetir aqui.

## Quem sou eu (contexto do usuário)

Quem está pilotando este projeto **não sabe programar**. Isso muda como você deve trabalhar:

- Nunca assuma conhecimento técnico prévio nas explicações dadas a ele.
- Nunca faça mudanças grandes sem antes apresentar um plano em linguagem simples.
- Sempre que possível, explique o "porquê" de uma decisão técnica em 1-2 frases, sem jargão.
- Se algo der errado, explique o erro em termos de sintoma observável ("o formulário não salva") antes de entrar em detalhes técnicos.

## Fluxo de trabalho obrigatório (SDD via GSD)

Este projeto usa o **GSD (Get Shit Done)** para orquestrar o Spec-Driven Development — não faça brainstorm, spec e implementação soltos na conversa principal, use os comandos do GSD:

- `/gsd-new-project` — para começar uma feature nova do zero: gera perguntas, pesquisa, requisitos e roadmap antes de qualquer código.
- `/gsd-onboard` ou `/gsd-map-codebase` — para quando já existe código no projeto e uma feature nova precisa se encaixar nele.

O GSD já roda o loop **Discuss → Plan → Execute → Verify → Ship** com subagents em contexto isolado a cada fase, e mantém o estado do projeto entre sessões sozinho (`PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `CONTEXT.md` dentro de `.planning/`). Não crie um sistema paralelo de specs/status — é redundante com o que o GSD já mantém.

Continue exigindo aprovação humana explícita na etapa de Discuss/Plan antes de deixar a etapa de Execute rodar.

## Estrutura de pastas

```
/app                # rotas e páginas Next.js
/components          # componentes React reutilizáveis
/lib/supabase        # client Supabase, queries
/supabase/migrations # migrations SQL versionadas
/supabase/functions  # edge functions
/.planning           # estado do projeto mantido pelo GSD (não editar manualmente)
/tests               # testes automatizados
```

## Convenções de código

- TypeScript estrito habilitado, sem `any` sem justificativa em comentário.
- Componentes React em PascalCase, hooks customizados prefixados com `use`.
- Toda tabela nova no Supabase precisa vir com RLS habilitada e policies explícitas — nunca deixar tabela aberta.
- Migrations sempre versionadas em `/supabase/migrations`, nunca alterar schema direto pelo dashboard sem depois gerar a migration correspondente.
- Commits pequenos e descritivos, um por tarefa do plano.

## Testes

- Toda funcionalidade nova precisa de pelo menos um teste automatizado antes de ser considerada concluída.
- Não marcar uma tarefa como concluída no plano sem os testes passando.

## O que NÃO fazer

- Não introduzir novas dependências/serviços externos sem antes explicar o motivo e o impacto no custo (o objetivo é manter tudo em free tier).
- Não fazer deploy direto em produção sem passar por uma etapa de revisão.
- Não deletar ou sobrescrever migrations já aplicadas — sempre criar uma nova migration para alterações de schema.
- Não implementar autenticação/autorização "por conta própria" — sempre usar Supabase Auth + RLS.

## Domínio do CRM (MVP)

Mapeado a partir do fluxo atual do negócio (wireframe em Excalidraw). Isso é o ponto de partida para a discussão do GSD — não é uma spec fechada, ainda tem decisões em aberto marcadas abaixo.

### Usuários e permissões

- Campos: `email`, `nome`, `sobrenome`, `senha`, `celular`.
- Auth via Supabase Auth.
- Dois papéis (roles): **Supervisor** (gestor) e **Vendedor**.
- Regras de permissão definidas:
  - **Supervisor**: vê todos os clientes (de todos os vendedores); único papel que pode cadastrar, editar e apagar os valores dos enums editáveis (categoria, produtos consumidos, tipos de tarefa).
  - **Vendedor**: pode cadastrar clientes; só vê os próprios clientes (`responsavel = usuário logado`); não tem acesso ao CRUD dos enums.
- ⚠️ Ainda em aberto: vendedor pode editar/apagar os próprios clientes, ou só cadastrar e visualizar? Assumir que pode editar os próprios até decidirem o contrário — é o padrão mais comum nesse tipo de fluxo, mas confirmar na etapa de Discuss do GSD antes de travar a RLS policy de update/delete.

### Cliente

Cliente é sempre **PJ** (pessoa jurídica):
- `razao_social`
- `endereco` (CEP, rua, número, complemento)
- `categoria` — **enum editável por permissão**: valores iniciais `FS` (Food Service), `VT` (Varejo tradicional), `AS` (Auto serviço)
- `contato`, `telefone`, `email`
- `responsavel` — vendedor responsável pelo cliente (referência a `users`)
- `produtos_consumidos` — **enum editável por permissão**, multi-valor: valores iniciais `casca`, `pasteurizado`, `óleo`
- `numero_de_lojas` (opcional, caso o cliente tenha mais de uma loja)

### Funil de vendas (kanban)

Cada cliente tem um card no funil. Colunas do kanban (estágio atual):
1. Aguardando contato
2. Conversa realizada com comprador(a)
3. Aguardando data para reunião inicial
4. Aguardando feedback da reunião
5. Aguardando aprovação final do cliente/comitê
6. Em cadastro de produto
7. 1ª venda concluída

Cada card carrega:
- Referência ao cliente
- `status_acompanhamento`: em andamento, perdido, ou ganho (ganho só é possível quando o card chega em "1ª venda concluída")
- `observacao` (texto livre)
- `tarefas` — **enum editável por permissão** (ex: Visitar, Mandar mensagem), cada tarefa com sua própria `data_conclusao`

### Enums editáveis (CRUD por permissão)

Estes três campos não são valores fixos no código — são tabelas próprias que usuários com permissão podem adicionar/editar via UI: **categoria do cliente**, **produtos consumidos**, e **tipos de tarefa**. Precisam de tabela própria no Postgres (não `check constraint` fixo), justamente para permitir esse CRUD sem precisar de migration a cada novo valor.

⚠️ Em aberto: as colunas do kanban (estágios do funil) também deveriam ser editáveis por permissão, ou ficam fixas no MVP? Não foi marcado como CRUD no mapeamento original — assumir fixas até decidirem o contrário na etapa de Discuss.
