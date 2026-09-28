---
phase: quick-260928-ilo
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260928-ilo]
files_modified:
  - app/layout.tsx
  - components/layout/AppSidebar.tsx
  - tests/layout/root-metadata.test.tsx
  - tests/layout/app-sidebar-visual.test.tsx
  - tests/agenda/app-sidebar-agenda.test.tsx
  - app/(app)/layout.tsx
  - components/clientes/ScrollColumnShell.tsx
  - components/dashboard/GanhosPerdidosCards.tsx
  - tests/clientes/kanban-scroll-column.test.tsx
  - tests/dashboard/ganhos-perdidos-cards.test.tsx
  - public/raiar-logo.png

must_haves:
  truths:
    - "A aba do navegador mostra exatamente 'CRM - Raiar' em qualquer tela (login inclusive) — o texto padrão do Next.js não aparece mais no título nem na descrição."
    - "A barra lateral ocupa sempre a altura inteira da janela: sem espaço em branco embaixo dela em telas altas, e ao rolar uma página longa (Dashboard) ela continua inteira e parada no topo; se o menu não couber numa tela baixa, ele rola por dentro da própria barra."
    - "Com o menu recolhido (só ícones) e pendências na Agenda, aparece uma bolinha pequena SEM número no canto do ícone da Agenda, inteira (sem corte). Com zero pendências não aparece nada. Com o menu expandido, o selo com o número continua exatamente como hoje, e a dica ao passar o foco no modo recolhido continua dizendo 'Agenda (N)' (CONTEXT §Badge da Agenda quando comprimido)."
    - "A área de conteúdo das telas logadas passa a ter fundo cinza bem claro (slate-50), fazendo os cards brancos se destacarem como na referência; o texto secundário continua com contraste AA (>= 4,5:1) e o degradê no pé das colunas do Kanban acompanha o novo fundo (sem faixa branca) (CONTEXT §Alcance da mudança de estética)."
    - "Todos os cards de número do Dashboard têm borda lateral colorida, reaproveitando o padrão já existente (border-l-4): o card 'Taxa de conversão' deixa de ter borda cinza quase invisível e passa a usar a cor primária; Ganhos (verde) e Perdidos (vermelho) não mudam."
    - "O topo da barra lateral mostra a logo real (public/raiar-logo.png) no lugar do quadrado azul com 'R', no MESMO espaço (28x28px), sobre fundo branco, sem distorcer a proporção; o texto 'CRM Raiar' continua ao lado quando o menu está expandido, com a mesma fonte e tamanho (CONTEXT §Logo)."
    - "O fundo navy-ardósia da barra lateral e os estados de passar o mouse/item ativo NÃO mudam (já estão no caminho da referência); só os textos e ícones do menu ficam mais claros e legíveis — nenhum contraste de texto cai."
    - "Nenhum layout, espaçamento, tamanho ou estrutura de card/tela muda; nenhuma dependência nova, migration, RLS, RPC ou Server Action é tocada."
  artifacts:
    - app/layout.tsx
    - components/layout/AppSidebar.tsx
    - app/(app)/layout.tsx
    - components/clientes/ScrollColumnShell.tsx
    - components/dashboard/GanhosPerdidosCards.tsx
    - public/raiar-logo.png
    - tests/layout/root-metadata.test.tsx
    - tests/layout/app-sidebar-visual.test.tsx
    - tests/agenda/app-sidebar-agenda.test.tsx
    - tests/dashboard/ganhos-perdidos-cards.test.tsx
    - tests/clientes/kanban-scroll-column.test.tsx
  key_links:
    - "Causa raiz da barra curta: em app/(app)/layout.tsx o contêiner é uma linha flex que só tem altura MÍNIMA (min-h-screen). Dentro dela, o `h-full` do <aside> (AppSidebar.tsx ~l.171) não tem uma altura definida para calcular e, ao mesmo tempo, desliga o esticamento padrão do flex — então a barra fica só da altura do próprio conteúdo. A correção troca esse `h-full` por `sticky top-0 h-dvh` no próprio <aside> e acrescenta `min-h-0` no <nav>; não se mexe no layout de app/(app)/layout.tsx para isso."
    - "Causa raiz provável do selo sumido no modo recolhido: o indicador atual é posicionado no canto do LINK inteiro (`absolute -top-1 -right-1`, ~l.256), mas o link tem `overflow-hidden rounded-md` — o canto arredondado corta quase todo o círculo, e ele fica longe do ícone (na borda direita do link de 48px). A bolinha nova é ancorada num invólucro `relative` em volta do ÍCONE, dentro da área de preenchimento do link, onde nada corta."
    - "O fundo da área de conteúdo (bg-slate-50 no <main> de app/(app)/layout.tsx) e a cor inicial do degradê de ScrollColumnShell (from-slate-50) PRECISAM ser iguais — o degradê existe para 'desbotar' os cards no pé da coluna do Kanban para a cor da página; se um mudar sem o outro, aparece uma faixa de cor errada no fim de cada coluna. Os dois arquivos ganham um comentário apontando um para o outro."
    - "A bolinha usa bg-primary (mesma cor do selo expandido, para ser lida como o mesmo sinal) com ring-2 ring-slate-900 (a cor do fundo da barra): o anel garante contraste de ~3,4:1 da bolinha contra o que está em volta mesmo quando o item Agenda está ativo (bg-slate-700) — sem o anel cairia para ~2:1."
    - "A logo é um PNG 310x130 (proporção ~2,4:1) de tinta única rgb(37,77,105) sobre fundo transparente. Sobre o slate-900 da barra, essa tinta dá só ~2:1 de contraste (quase invisível); sobre branco dá ~9:1. Por isso o contêiner da logo é branco. É renderizada com next/image + `unoptimized` e src '/raiar-logo.png' (validado no planejamento: em jsdom o <img> sai com src exatamente '/raiar-logo.png')."
    - "Os testes tests/funil/app-sidebar-perdidos.test.tsx e tests/funil/app-sidebar-encerrados.test.tsx exigem `bg-slate-700` no item ativo — por isso os estados ativo/hover da barra NÃO mudam nesta task. tests/clientes/kanban-scroll-column.test.tsx (l.55) exige hoje a classe antiga do degradê e precisa ser atualizado junto com ScrollColumnShell."
---

<objective>
Cinco ajustes visuais e de identidade achados pelo dono navegando em produção, agrupados em 3 tarefas:

1. **Três defeitos pequenos (Task 1):** título da aba vira "CRM - Raiar"; a barra lateral passa a ocupar a altura inteira da janela; e, com o menu recolhido, a Agenda mostra uma bolinha de "tem pendência" no canto do ícone.
2. **Cores da área de conteúdo e dos cards de número (Task 2):** fundo cinza bem claro atrás das telas logadas (cards brancos se destacam, como na referência) e borda colorida também no card "Taxa de conversão".
3. **Identidade da barra lateral (Task 3):** a logo real da Raiar entra no lugar do quadrado azul com "R", e os textos/ícones do menu ficam mais claros (na referência os ícones são brancos).

Explicando sem jargão: são só mudanças de aparência — nenhuma informação, permissão ou dado muda. A barra lateral hoje "acaba" no meio da tela porque ela só cresce até o tamanho do próprio conteúdo; ela vai passar a ter sempre a altura da janela e ficar parada enquanto a página rola. O numerozinho da Agenda com o menu fechado existia, mas ficava cortado pelo canto arredondado do botão e longe do ícone; ele vira uma bolinha colada no ícone.

**Comparação com a referência (feita no planejamento, como pede o CONTEXT §Alcance da mudança de estética):** a referência tem menu navy escuro com ícones brancos, conteúdo branco/cinza bem claro, cards de número com borda lateral colorida. O CRM hoje tem menu slate-900 (azul-ardósia escuro — já no caminho, NÃO será repintado) com ícones cinza-claro (slate-300 — diferença perceptível, vai clarear), conteúdo branco puro (vai para cinza bem claro, dentro do limite de contraste AA) e cards de número já com borda colorida exceto "Taxa de conversão" (borda cinza — vai para a cor primária). O cabeçalho escuro de tabela da referência NÃO está na lista travada do CONTEXT (fundo, barra lateral, borda dos cards de número) e fica fora desta task (vai como follow-up no SUMMARY).

**Divergência encontrada no arquivo da logo (registrar no SUMMARY):** o CONTEXT descreve a logo como "símbolo circular estilizado + texto 'ORGÂNICOS RAIAR' abaixo". O arquivo real `public/raiar-logo.png` (310x130, 5 KB) é só a marca escrita: "ORGÂNICOS" em arco em cima e "raiar" embaixo — não existe um símbolo separado para recortar. O CONTEXT §Logo permite "recortado ou usado como está"; recortar geraria um pedaço sem sentido, então esta task usa a imagem inteira, como está, no mesmo espaço do "R". Consequência: no espaço de 28px a marca fica pequena (~24x10px) e o nome "raiar" aparece tanto na logo quanto no texto "CRM Raiar" ao lado. Se o dono quiser um ícone só-símbolo, precisa fornecer um arquivo assim — follow-up, não bloqueia esta task.

Purpose: tirar a cara de "projeto de exemplo" (título padrão), corrigir dois defeitos visíveis da barra lateral e aproximar a aparência da referência que o dono mostrou, sem reorganizar nenhuma tela.

Output:
- 3 commits locais (um por task), cada um com testes + implementação.
- Testes novos: título/descrição da aba, altura fixa da barra, bolinha da Agenda, borda do card Taxa de conversão, logo, cores dos textos do menu.
- `public/raiar-logo.png` (hoje não versionado) entra no commit da Task 3.
</objective>

<execution_context>
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/quick/260928-ilo-ajustes-visuais-e-de-identidade-titulo-d/260928-ilo-CONTEXT.md
@app/layout.tsx
@app/(app)/layout.tsx
@components/layout/AppSidebar.tsx
@components/clientes/ScrollColumnShell.tsx
@components/dashboard/GanhosPerdidosCards.tsx
@tests/agenda/app-sidebar-agenda.test.tsx
@tests/clientes/kanban-scroll-column.test.tsx
@tests/dashboard/tempo-ate-fechamento-cards.test.tsx

Achados do planejamento (já verificados, não precisa refazer):

- Linha de base medida em 2026-09-28: `npx vitest run tests/agenda/app-sidebar-agenda.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/importacao/AppSidebar.test.tsx tests/dashboard/tempo-ate-fechamento-cards.test.tsx` = 5 arquivos, 29 testes, todos passando. `npx tsc --noEmit` limpo. `npx eslint --max-warnings 0` limpo (zero avisos) em app/layout.tsx, app/(app)/layout.tsx, components/layout/AppSidebar.tsx, components/dashboard/GanhosPerdidosCards.tsx, components/clientes/ScrollColumnShell.tsx e tests/agenda/app-sidebar-agenda.test.tsx — então `--max-warnings 0` é um gate válido (qualquer aviso novo, como função que ficou sem uso, é culpa desta task).
- Protótipo rodado no planejamento (arquivo temporário já apagado): (a) importar `@/app/layout` num teste funciona desde que `next/font/google` seja mockado com `vi.mock` devolvendo funções `Geist` e `Geist_Mono` que retornam `{ variable, className }` — o import do globals.css não atrapalha; (b) `next/image` com `unoptimized`, `src="/raiar-logo.png"`, `width={310}`, `height={130}` renderiza em jsdom um <img> com atributo src exatamente "/raiar-logo.png".
- Não há precedente de `next/image` nem de `<img>` no projeto. Escolha desta task (CONTEXT §Logo permite os dois): `next/image` com `unoptimized` — evita o aviso de lint `@next/next/no-img-element` (que quebraria o gate `--max-warnings 0`) sem precisar de comentário de supressão, e não consome a cota gratuita de otimização de imagens da Vercel (o PNG tem 5 KB, não precisa ser otimizado). Nenhuma mudança em next.config.
- Cores medidas: tinta da logo rgb(37,77,105) (#254D69), fundo transparente, área útil de x 0-309 / y 12-117. Contrastes aproximados (WCAG): tinta da logo sobre slate-900 ~2:1, sobre branco ~9:1; slate-500 sobre slate-900 ~3,7:1 (hoje, abaixo de AA para texto pequeno), slate-400 sobre slate-900 ~6,8:1; slate-300 sobre slate-900 ~12:1, slate-100 sobre slate-900 ~16:1; `--muted-foreground` (oklch 0.556 0 0) sobre branco ~4,73:1, sobre slate-50 ~4,52:1 (passa AA), sobre slate-100 ~4,3:1 (reprovaria — por isso slate-50 e nada mais escuro); `--primary` sobre slate-900 ~3,4:1, sobre slate-700 ~2:1.
- `ScrollColumnShell` só é usado pelo Kanban (components/clientes/KanbanBoard.tsx); as colunas do Kanban ficam direto sobre o fundo da página (sem card), por isso o degradê delas precisa acompanhar o novo fundo. O cabeçalho de cada coluna usa `bg-secondary` (cinza #f5f5f5): sobre slate-50 ele fica mais sutil, mas o texto continua com o mesmo contraste — NÃO restilizar o cabeçalho nesta task (fora do escopo travado de "só cores" na lista do CONTEXT); só registrar no SUMMARY com a observação do preview.
- As telas de login/recuperação de senha ficam fora de app/(app)/ e continuam com fundo branco (o novo fundo é só no <main> da área logada).
- `app/favicon.ico` é o ícone padrão do projeto inicial (commit a31a02b) e `<html lang="en">` em app/layout.tsx está em inglês — os dois são "identidade", mas NÃO foram pedidos: não mexer, registrar como follow-up no SUMMARY.
- Skill `supabase-conventions` não se aplica: nenhuma tabela, RLS, RPC, Edge Function ou migration.

**Privacidade / LGPD (alerta obrigatório da organização):** esta task não cria nem altera nenhum tratamento de dado pessoal — é só aparência. O único ponto de contato com dado pessoal é a checagem visual no preview: as telas logadas mostram dados reais de clientes (nomes, contatos, telefones, e-mails; razão social de MEI contém nome de pessoa física) e o nome do usuário logado no rodapé da barra. Regras para o executor: (1) screenshots de telas logadas ficam SÓ no scratchpad da sessão — nunca commitadas, nunca coladas no SUMMARY (descrever o que viu em texto, sem copiar nomes/contatos de clientes); (2) NÃO digitar nem reaproveitar credenciais encontradas no repositório — existe uma senha da conta do dono gravada em tests/e2e/session-persistence.spec.ts; se precisar de sessão logada, tratar como "auth gate": pedir ao dono para entrar pela própria janela do preview, preferindo uma conta de vendedor (vê menos dados que o supervisor); se não houver como logar, pular a checagem visual logada e registrar no SUMMARY que ela fica para o link de preview da `staging` (fluxo de deploy do CLAUDE.md). A senha gravada no teste e2e é um problema pré-existente de segurança, fora desta task — vai para o SUMMARY como recomendação ao dono.

**Checagem no preview (vale para as 3 tasks):** subir o servidor de desenvolvimento pela ferramenta de preview do projeto (configuração "dev" em .claude/launch.json). Se houver sessão logada disponível (ver regras acima), tirar ANTES da Task 1 os screenshots "antes": barra recolhida em /agenda, barra expandida, /dashboard no topo e rolado até o fim, /clientes (Kanban). Cada task abaixo lista as checagens "depois" específicas dela.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Título da aba "CRM - Raiar", barra lateral na altura inteira da janela e bolinha da Agenda no menu recolhido</name>
  <files>app/layout.tsx, components/layout/AppSidebar.tsx, tests/layout/root-metadata.test.tsx, tests/layout/app-sidebar-visual.test.tsx, tests/agenda/app-sidebar-agenda.test.tsx</files>
  <behavior>
    - metadata.title de app/layout.tsx é exatamente "CRM - Raiar"
    - metadata.description não contém (sem diferenciar maiúsculas) "create next app"
    - O <aside> da AppSidebar tem as classes sticky, top-0 e h-dvh, e NÃO tem h-full; o <nav> tem min-h-0
    - Menu recolhido (estado inicial) com agendaCount 5: existe exatamente um elemento [data-slot="agenda-pendente-dot"], dentro do link href="/agenda", com texto vazio (sem número); o elemento pai da bolinha contém o <svg> do ícone (ancorada no ícone, não no link)
    - Menu recolhido com agendaCount 23: a bolinha existe, texto vazio; o HTML não contém "9+" nem ">23<"
    - Menu recolhido com agendaCount 0: nenhuma bolinha
    - Menu expandido com agendaCount 5: nenhuma bolinha; o selo com aria-label "Agenda, 5 itens pendentes" e texto "5" continua existindo (comportamento de hoje)
    - Casos atuais que continuam valendo sem mudança: ordem Agenda > Clientes > Dashboard, zero sem "Agenda (0)", só um selo no menu inteiro
  </behavior>
  <action>
Ordem TDD: primeiro os testes (passo 1), rodar e ver falhar, depois a implementação (passos 2-4), depois checagem no preview (passo 5) e um único commit (passo 6).

1. Testes:
   - Criar `tests/layout/root-metadata.test.tsx` (primeira linha `// @vitest-environment jsdom`, mesmo estilo dos testes de componente: imports de vitest, sem ponto e vírgula). Mockar `next/font/google` com `vi.mock` devolvendo `Geist` e `Geist_Mono` como funções que retornam `{ variable: "--font-geist-sans", className: "geist" }` / `{ variable: "--font-geist-mono", className: "geist-mono" }` (sem esse mock o import quebra fora do compilador do Next). Importar `metadata` de `@/app/layout` e cobrir os 2 primeiros itens do `<behavior>`.
   - Criar `tests/layout/app-sidebar-visual.test.tsx` copiando de tests/agenda/app-sidebar-agenda.test.tsx o cabeçalho jsdom, os dois `vi.mock` (`next/navigation` com `usePathname: () => "/clientes"` e `@/lib/supabase/client`) e o helper que renderiza `AppSidebar` dentro de `TooltipProvider` (fullName "Ana Souza", roleLabel "Vendedor", role "vendedor", initials "AS"). Nesta task ele cobre só o item do `<aside>`/`<nav>` do `<behavior>` (buscar com `container.querySelector("aside")` e `container.querySelector("nav")`, usar `toHaveClass`). As Tasks 2 e 3 não mexem neste arquivo, só a Task 3 acrescenta casos.
   - Em `tests/agenda/app-sidebar-agenda.test.tsx`: substituir os casos "recolhido" (l.92-102) e "limite" (l.104-111) pelos casos de bolinha do `<behavior>` (recolhido com 5, recolhido com 23, recolhido com 0, expandido com 5 sem bolinha), buscando a bolinha por `[data-slot="agenda-pendente-dot"]` e o link por `container.querySelector('a[href="/agenda"]')`. Atualizar o comentário de cabeçalho (l.14, item "recolhido/limite") para descrever a bolinha sem número (quick 260928-ilo, CONTEXT §Badge da Agenda quando comprimido). Não mexer nos outros 4 casos.
   - Rodar os 3 arquivos: precisam FALHAR nos casos novos (título, classes do aside/nav, bolinha) e passar nos casos antigos mantidos.

2. `app/layout.tsx`: trocar `title` para exatamente "CRM - Raiar" (hífen com espaços dos dois lados, como o dono pediu) e `description` para "CRM de acompanhamento de vendas da Raiar Orgânicos" (discrição do planejador: a descrição padrão também é texto de projeto de exemplo e aparece quando o link é compartilhado). Não mexer em fontes, `lang`, classes do html/body nem no TooltipProvider.

3. `components/layout/AppSidebar.tsx`, altura da barra (CONTEXT §Claude's Discretion, causa raiz em key_links): no `className` do `<aside>`, trocar `h-full` por `sticky top-0 h-dvh` (o resto da lista de classes igual). No `<nav>`, acrescentar `min-h-0` ao lado de `flex-1 overflow-y-auto` para ele poder encolher e rolar por dentro numa tela baixa. Não mexer em app/(app)/layout.tsx nesta task.

4. `components/layout/AppSidebar.tsx`, bolinha da Agenda (CONTEXT §Badge da Agenda quando comprimido — bolinha sem número, só no modo recolhido; expandido não muda):
   - Remover o `<span>` numérico do modo recolhido que hoje é filho direto do `<Link>` (l.253-260, posicionado com `absolute -top-1 -right-1`), a função auxiliar que limitava o número exibido a dois caracteres (l.96-102, incluindo o JSDoc dela — ela fica sem uso e o gate `--max-warnings 0` do eslint falha se sobrar) e a entrada condicional que acrescentava `relative` ao Link no modo recolhido com selo (l.230). Ajustar o comentário das l.226-228 para falar só do `justify-between`.
   - A renderização do ícone passa a ter três casos: (a) expandido com selo = invólucro atual com ícone + rótulo (igual hoje); (b) recolhido com selo = um `<span>` com `relative inline-flex flex-shrink-0` envolvendo o `<Icon className="size-[18px] flex-shrink-0" />` e, logo depois dele, a bolinha: `<span aria-hidden="true" data-slot="agenda-pendente-dot">` vazio com as classes `absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-slate-900`; (c) qualquer outro caso = o `<Icon>` sozinho, como hoje.
   - Escrever um comentário curto acima do caso (b) explicando: a bolinha fica presa ao ícone (e não ao canto do link, onde `overflow-hidden rounded-md` a cortava — era por isso que "sumia"); `bg-primary` é a mesma cor do selo expandido; o anel na cor do fundo da barra mantém o contraste mesmo com o item ativo; sem número por decisão do dono (quick 260928-ilo); o número continua no selo expandido e na dica do modo recolhido.
   - NÃO mudar: o selo expandido (`Badge`, classes, aria-label), o texto da dica do Tooltip (continua "Agenda (N)" quando há pendências, só o rótulo quando não há), a regra `badgeCount > 0`, a lista/ordem das seções, a checagem `role === "supervisor"`, nem nenhuma cor da barra (cores são da Task 3).

5. Checagem no preview (ver regras de LGPD e login no `<context>`): em /login, `document.title` deve ser "CRM - Raiar". Com sessão logada: numa janela alta (ex.: 1280x1200) em /agenda e em /dashboard, `document.querySelector("aside").getBoundingClientRect().height` igual a `window.innerHeight` (tolerância 1px); em /dashboard, depois de `window.scrollTo(0, document.body.scrollHeight)`, o `top` do retângulo do aside é 0 e a altura continua igual à da janela; com o mouse fora da barra (recolhida) e pendências > 0, o retângulo da bolinha `[data-slot="agenda-pendente-dot"]` fica inteiro dentro do retângulo do link da Agenda (sem corte). Screenshot "depois" da barra recolhida e de /dashboard rolado até o fim (só no scratchpad). Registrar no SUMMARY se a causa raiz do selo sumido foi confirmada visualmente no "antes".

6. Rodar o verify. Commit só dos 5 arquivos desta task (caminhos explícitos no `git add`, sem `git add .`), mensagem `fix(quick-260928-ilo): titulo da aba, barra lateral na altura da janela e bolinha da Agenda recolhida`, terminando com a linha de atribuição exigida pelo ambiente. Sem push.
  </action>
  <verify>
    <automated>cd "C:/Users/Cristiano Stephano/workspace/crm-raiar" && npx vitest run tests/layout/root-metadata.test.tsx tests/layout/app-sidebar-visual.test.tsx tests/agenda/app-sidebar-agenda.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/importacao/AppSidebar.test.tsx && npx eslint --max-warnings 0 app/layout.tsx components/layout/AppSidebar.tsx tests/layout/root-metadata.test.tsx tests/layout/app-sidebar-visual.test.tsx tests/agenda/app-sidebar-agenda.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
    - Os 6 arquivos de teste do verify passam (os 4 arquivos de sidebar existentes continuam verdes; os casos antigos de "indicador circular" e "9+" foram substituídos pelos de bolinha).
    - eslint com zero avisos nos 5 arquivos e `tsc --noEmit` limpo.
    - app/layout.tsx tem title "CRM - Raiar" e a nova descrição; AppSidebar.tsx tem o <aside> com sticky/top-0/h-dvh, o <nav> com min-h-0 e a bolinha com data-slot="agenda-pendente-dot" dentro do invólucro do ícone.
    - Checagem no preview feita (ou registrada como pendente para o link da staging, se não houve sessão logada), com os valores medidos anotados para o SUMMARY.
    - Um commit `fix(quick-260928-ilo): ...` contendo exatamente os 5 arquivos da task; nenhum push.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fundo cinza bem claro na área de conteúdo e borda colorida no card "Taxa de conversão"</name>
  <files>app/(app)/layout.tsx, components/clientes/ScrollColumnShell.tsx, components/dashboard/GanhosPerdidosCards.tsx, tests/clientes/kanban-scroll-column.test.tsx, tests/dashboard/ganhos-perdidos-cards.test.tsx</files>
  <behavior>
    - GanhosPerdidosCards com dados { ganho: 3, perdido: 1 }: o card que contém o rótulo "Taxa de conversão" tem border-l-4 e border-l-primary; o card de "Ganhos" continua border-l-green-600; o de "Perdidos" continua border-l-destructive; nenhum elemento renderizado tem a classe border-l-border
    - ScrollColumnShell: o elemento do degradê (aria-hidden) tem a classe from-slate-50 (antes: from-background); o resto do caso atual (pointer-events-none, fora da div de rolagem, opacity-0 em jsdom) continua valendo
  </behavior>
  <action>
Implementa a parte "fundo" e "cards de número" do CONTEXT §Alcance da mudança de estética — só cores, sem mudar tamanho, espaçamento, estrutura ou ordem de nada.

1. Testes primeiro:
   - Criar `tests/dashboard/ganhos-perdidos-cards.test.tsx` seguindo o padrão de tests/dashboard/tempo-ate-fechamento-cards.test.tsx: jsdom, `vi.mock("@/app/actions/dashboard", ...)` com `getGanhosPerdidosAction: vi.fn()`, `vi.mocked(...)` com `mockResolvedValue({ data: [{ status: "ganho", total: 3 }, { status: "perdido", total: 1 }] })`, renderizar `<GanhosPerdidosCards inicio={new Date("2026-09-01T00:00:00Z")} fim={new Date("2026-09-30T23:59:59Z")} />`, esperar `findByText("Taxa de conversão")` e cobrir o primeiro item do `<behavior>` usando `closest(".border-l-4")` a partir de cada rótulo. Nome do describe em português, como os vizinhos.
   - Em `tests/clientes/kanban-scroll-column.test.tsx` l.55: trocar a classe esperada do degradê para `from-slate-50`. Não mexer no resto do arquivo.
   - Rodar os 2 arquivos: devem falhar exatamente nesses pontos.

2. `app/(app)/layout.tsx`: acrescentar `bg-slate-50` no `className` do `<main>` (fica `flex flex-1 flex-col overflow-x-hidden bg-slate-50`). Acima do `<main>`, comentário curto: fundo cinza bem claro da área logada para os cards brancos se destacarem (referência visual do dono, quick 260928-ilo); slate-50 é o tom mais escuro que ainda mantém o texto secundário (`text-muted-foreground`) em ~4,5:1 (AA) — não escurecer; o degradê de components/clientes/ScrollColumnShell.tsx usa a mesma cor e precisa mudar junto. Não mexer no <div> de fora, na busca de perfil, na contagem da Agenda nem nas props da AppSidebar.

3. `components/clientes/ScrollColumnShell.tsx`: no degradê (l.63), trocar `from-background` por `from-slate-50`, mantendo todas as outras classes e a lógica de opacidade. Acrescentar ao JSDoc do componente uma frase: a cor inicial do degradê precisa ser igual ao fundo do <main> em app/(app)/layout.tsx (bg-slate-50 desde a quick 260928-ilo), senão aparece uma faixa de cor errada no pé de cada coluna do Kanban.

4. `components/dashboard/GanhosPerdidosCards.tsx` (l.141): no card "Taxa de conversão", trocar `border-l-border` por `border-l-primary` — o mesmo padrão `border-l-4` colorido que Ganhos/Perdidos e os cards de "Média de dias até ganho/perdido" já usam (CONTEXT §Alcance: reaproveitar o padrão existente, não inventar estilo; `--primary` é token existente). Não mexer nos outros dois cards, nos estados de carregando/erro, no tamanho do número (36px) nem no texto.

5. NÃO alterar: tokens em app/globals.css (mudar `--background` global afetaria botões, calendário e as telas de login), o cabeçalho das colunas do Kanban (`bg-secondary` em KanbanBoard.tsx), tabelas, nenhum outro componente.

6. Checagem no preview (regras de LGPD/login no `<context>`): com sessão logada, `getComputedStyle(document.querySelector("main")).backgroundColor` deve ser a cor do slate-50 (o Tailwind v4 pode devolver em oklch, ~oklch(0.984 0.003 247.858)); medir no navegador a cor de um texto `text-muted-foreground` que fique direto sobre o fundo (ex.: subtítulo/estado vazio de alguma tela) e confirmar contraste >= 4,5:1 contra o fundo medido — se der abaixo, PARAR e relatar (não improvisar outra cor). Screenshots "depois" (só no scratchpad) de /dashboard (cards de número, incluindo Taxa de conversão com borda azul), /clientes (pé das colunas do Kanban: o degradê deve sumir no fundo, sem faixa branca; anotar como ficou o cabeçalho cinza das colunas) e uma olhada rápida em /agenda, /perdidos, /encerrados, /equipe e /configuracoes para confirmar que nenhuma área ficou ilegível.

7. Rodar o verify. Commit só dos 5 arquivos desta task (caminhos explícitos; lembrar das aspas em "app/(app)/layout.tsx"), mensagem `style(quick-260928-ilo): fundo cinza claro na area logada e borda colorida na Taxa de conversao`, com a linha de atribuição. Sem push.
  </action>
  <verify>
    <automated>cd "C:/Users/Cristiano Stephano/workspace/crm-raiar" && node -e "const fs=require('fs');const l=fs.readFileSync('app/(app)/layout.tsx','utf8');const s=fs.readFileSync('components/clientes/ScrollColumnShell.tsx','utf8');const g=fs.readFileSync('components/dashboard/GanhosPerdidosCards.tsx','utf8');const ok=/<main className=\"[^\"]*bg-slate-50/.test(l)&&s.includes('from-slate-50')&&g.includes('border-l-4 border-l-primary');console.log(ok?'CORES OK':'CORES FALHOU');process.exit(ok?0:1)" && npx vitest run tests/dashboard/ganhos-perdidos-cards.test.tsx tests/dashboard/tempo-ate-fechamento-cards.test.tsx tests/clientes/kanban-scroll-column.test.tsx && npx eslint --max-warnings 0 "app/(app)/layout.tsx" components/clientes/ScrollColumnShell.tsx components/dashboard/GanhosPerdidosCards.tsx tests/clientes/kanban-scroll-column.test.tsx tests/dashboard/ganhos-perdidos-cards.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
    - O script imprime "CORES OK": <main> com bg-slate-50, degradê com from-slate-50, Taxa de conversão com border-l-4 border-l-primary.
    - Os 3 arquivos de teste passam; eslint com zero avisos nos 5 arquivos; `tsc --noEmit` limpo.
    - app/globals.css, KanbanBoard.tsx e qualquer outro componente continuam intocados (`git diff --name-only HEAD~1 HEAD` lista só os 5 arquivos da task).
    - Contraste do texto secundário sobre o novo fundo medido >= 4,5:1 no preview (ou registrado como pendente para a staging se não houve sessão logada).
    - Um commit `style(quick-260928-ilo): ...` com os 5 arquivos; nenhum push.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Logo real no topo da barra lateral e textos do menu mais claros</name>
  <files>components/layout/AppSidebar.tsx, tests/layout/app-sidebar-visual.test.tsx, public/raiar-logo.png</files>
  <behavior>
    - Recolhido e expandido: existe um <img> com alt "Logo Raiar Orgânicos" e atributo src exatamente "/raiar-logo.png"; o elemento pai dele tem as classes size-7, rounded-md e bg-white
    - Recolhido e expandido: não existe nenhum elemento com o texto exato "R" (o quadrado com a inicial saiu)
    - Expandido: o texto "CRM Raiar" continua aparecendo, com as mesmas classes de hoje (text-lg font-bold text-white); recolhido: "CRM Raiar" não aparece (igual hoje)
    - Expandido, com a rota atual /clientes: o link inativo "Dashboard" tem text-slate-100 (não text-slate-300); o link ativo "Clientes" continua com bg-slate-700 e text-white
    - Expandido: o rótulo de seção "Principal", o cargo "Vendedor" e o botão de recolher (aria-label "Recolher menu") têm text-slate-400 (não text-slate-500); o botão "Sair" tem text-slate-100
  </behavior>
  <action>
Implementa o CONTEXT §Logo e a parte "barra lateral" do CONTEXT §Alcance da mudança de estética. O fundo da barra (bg-slate-900), as bordas (border-slate-800), o hover (hover:bg-slate-800) e o item ativo (bg-slate-700 font-medium text-white) NÃO mudam — já estão no caminho da referência, e dois testes existentes dependem do bg-slate-700.

1. Testes primeiro, acrescentando casos em `tests/layout/app-sidebar-visual.test.tsx` (criado na Task 1; usar o helper de expandir por `fireEvent.click` no botão "Expandir menu", como em tests/agenda/app-sidebar-agenda.test.tsx) para todos os itens do `<behavior>`. Para os links, usar `screen.getByRole("link", { name: "Dashboard" })` com o menu expandido e checar `className`; para rótulos, `screen.getByText("Principal")` / `getByText("Vendedor")`. Rodar: devem falhar nos casos novos.

2. Logo (CONTEXT §Logo) em `components/layout/AppSidebar.tsx`, na linha da marca (l.175-183):
   - Importar `Image` de `next/image`.
   - Trocar o `<div>` com a letra "R" (l.176-178) por um contêiner `<div>` com `flex size-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5` — mesmo tamanho (28x28), mesma posição e mesmo arredondamento do quadrado de hoje — contendo `<Image src="/raiar-logo.png" alt="Logo Raiar Orgânicos" width={310} height={130} unoptimized className="h-auto w-full object-contain" />`. Proporção preservada pelo `object-contain` + `h-auto`; nada de esticar para preencher o quadrado.
   - Fundo branco porque a tinta da logo (rgb 37,77,105) dá só ~2:1 de contraste sobre o slate-900 da barra (quase invisível) e ~9:1 sobre branco. O CONTEXT pede testar as duas opções no preview: se houver sessão logada, trocar temporariamente `bg-white` pela cor da barra, tirar um screenshot de cada (scratchpad), voltar para `bg-white` e registrar a comparação no SUMMARY. A versão final commitada é `bg-white`.
   - Comentário curto acima do contêiner: o arquivo é a marca escrita inteira (não há símbolo separado para recortar), usado como está no espaço do antigo "R" (quick 260928-ilo); next/image com `unoptimized` para não gastar a cota de otimização de imagens da Vercel com um PNG de 5 KB e sem precisar suprimir a regra de lint de <img>.
   - O `<span>` "CRM Raiar" ao lado, o botão de recolher e a condição `!compact` ficam como estão (fonte e tamanho do texto não mudam).
   - Atualizar o JSDoc do componente (l.126-132): ele diz que só a escala slate + `--primary` são usadas; acrescentar que o topo mostra a logo da Raiar sobre fundo branco e que os textos do menu foram clareados na quick 260928-ilo.

3. Textos e ícones do menu (referência: ícones brancos; só clarear, nunca escurecer):
   - Links (l.224): `text-slate-300` vira `text-slate-100` (ícones herdam a cor do texto). Manter `hover:bg-slate-800 hover:text-white` e o trecho do item ativo exatamente como estão — o `cn`/tailwind-merge faz o `text-white` do ativo prevalecer.
   - Rótulo de seção (l.205), botão de recolher (l.189) e cargo no rodapé (l.297): `text-slate-500` vira `text-slate-400` (de ~3,7:1, abaixo de AA para texto pequeno, para ~6,8:1).
   - Botão Sair (l.307): `text-slate-300` vira `text-slate-100`, mantendo `hover:bg-slate-800 hover:text-white`.
   - Não mexer no círculo de iniciais do rodapé (`bg-primary`), no selo expandido nem na bolinha da Task 1.

4. `public/raiar-logo.png` já está no disco (fornecido pelo dono, hoje não versionado): NÃO editar, redimensionar nem recortar o arquivo — só incluí-lo no commit desta task.

5. Checagem no preview (regras de LGPD/login no `<context>`): com sessão logada, o `<img>` da logo tem `naturalWidth` 310 (carregou, não está quebrado) e a razão largura/altura renderizada fica perto de 2,4 (sem distorção), dentro do quadrado de 28px; screenshots "depois" da barra recolhida e expandida (scratchpad). Anotar no SUMMARY se a marca ficou legível nesse tamanho.

6. Rodar o verify (inclui de novo os 4 testes de sidebar existentes). Commit de `components/layout/AppSidebar.tsx`, `tests/layout/app-sidebar-visual.test.tsx` e `public/raiar-logo.png` (caminhos explícitos), mensagem `feat(quick-260928-ilo): logo da Raiar na barra lateral e textos do menu mais claros`, com a linha de atribuição. Sem push.
  </action>
  <verify>
    <automated>cd "C:/Users/Cristiano Stephano/workspace/crm-raiar" && npx vitest run tests/layout/app-sidebar-visual.test.tsx tests/layout/root-metadata.test.tsx tests/agenda/app-sidebar-agenda.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/importacao/AppSidebar.test.tsx && npx eslint --max-warnings 0 components/layout/AppSidebar.tsx tests/layout/app-sidebar-visual.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>
    - Os 6 arquivos de teste do verify passam; eslint com zero avisos; `tsc --noEmit` limpo.
    - AppSidebar.tsx importa next/image, mostra a logo num contêiner size-7 rounded-md bg-white e não tem mais o quadrado com "R"; fundo, bordas, hover e item ativo da barra iguais aos de antes.
    - `git ls-files public/raiar-logo.png` devolve o caminho (arquivo versionado) e o arquivo tem os mesmos 5091 bytes de antes.
    - Um commit `feat(quick-260928-ilo): ...` com os 3 arquivos; nenhum push.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| banco (RLS) -> tela | Os dados chegam às telas já filtrados pelo RLS; esta task muda só classes de cor, a logo e o título — nenhuma leitura, escrita ou regra de acesso muda. |
| navegador de verificação -> arquivos da sessão | Screenshots de telas logadas mostram dados reais de clientes e do usuário logado. |
| repositório git | Commits, testes e SUMMARY ficam versionados e visíveis a quem acessa o repositório. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ilo-01 | Information Disclosure | screenshots/observações do preview (Tasks 1-3) | medium | mitigate | Screenshots de telas logadas só no scratchpad da sessão, nunca commitados nem colados no SUMMARY; o SUMMARY descreve o que foi visto em texto, sem nomes, contatos ou razão social de clientes (LGPD). Preferir conta de vendedor (vê só os próprios clientes). |
| T-ilo-02 | Spoofing | login no preview | medium | mitigate | O executor não digita nem reaproveita credenciais do repositório (há uma senha da conta do dono em tests/e2e/session-persistence.spec.ts); sessão logada só via o próprio dono entrando na janela do preview (auth gate) ou a checagem fica para o link da staging. |
| T-ilo-03 | Elevation of Privilege | AppSidebar (seções do menu) | low | mitigate | A checagem `role === "supervisor"` e a lista de seções não são tocadas (Task 1 passo 4, Task 3); os testes de sidebar existentes (perdidos, encerrados, importacao, agenda) rodam no verify de duas tasks. O menu é só reflexo visual — o RLS continua sendo a barreira real. |
| T-ilo-04 | Tampering | next/image + public/raiar-logo.png | low | accept | Imagem local estática servida de /public, `unoptimized`, sem domínio remoto nem mudança em next.config; o arquivo não é modificado (tamanho conferido no done da Task 3). |
| T-ilo-05 | Tampering | dependências | low | accept | Nenhum pacote novo é instalado (next/image já vem com o Next.js); sem npm install nesta task. |
| T-ilo-06 | Information Disclosure | tests/e2e/session-persistence.spec.ts (pré-existente) | high | transfer | Senha da conta do dono gravada no código versionado — fora do escopo desta task, não é alterada aqui. Transferido ao dono via SUMMARY: recomendar trocar essa senha e passar o teste a ler e-mail/senha de variável de ambiente fora do git. |
</threat_model>

<verification>
- Os três verifies das tasks passam em sequência; no fim, rodar uma vez o conjunto completo tocado: `npx vitest run tests/layout tests/agenda/app-sidebar-agenda.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/importacao/AppSidebar.test.tsx tests/dashboard/ganhos-perdidos-cards.test.tsx tests/dashboard/tempo-ate-fechamento-cards.test.tsx tests/clientes/kanban-scroll-column.test.tsx` — tudo verde.
- `npx tsc --noEmit` limpo; `npx eslint --max-warnings 0` limpo nos arquivos tocados.
- `git diff --name-only HEAD~3 HEAD` lista exatamente os 11 arquivos de `files_modified` e nada em supabase/, app/globals.css, app/actions/, lib/ ou outros componentes.
- 3 commits locais (fix, style, feat), nenhum push para staging/master.
- Checagens do preview registradas no SUMMARY (ou marcadas como pendentes para o link da staging, com a lista exata do que conferir).
</verification>

<success_criteria>
- A aba mostra "CRM - Raiar"; a barra lateral tem sempre a altura da janela e fica parada ao rolar; com o menu recolhido e pendências, a bolinha aparece inteira no canto do ícone da Agenda.
- A área logada tem fundo cinza bem claro com texto secundário ainda em AA, o Kanban não ganhou faixa branca no pé das colunas, e todos os cards de número do Dashboard têm borda lateral colorida.
- A logo da Raiar ocupa o lugar do "R" sem distorção e com contraste; textos do menu mais claros; nada de layout, tamanho, dado, permissão ou banco mudou.
- Testes automatizados cobrindo cada item, todos verdes; commits pequenos (um por task).
</success_criteria>

<output>
Criar `.planning/quick/260928-ilo-ajustes-visuais-e-de-identidade-titulo-d/260928-ilo-SUMMARY.md` ao terminar. Além do formato padrão, o SUMMARY DEVE conter, em linguagem simples para o dono do projeto:

1. **O que mudou, tela por tela**, e o resultado das checagens do preview (valores medidos: altura da barra x altura da janela, posição da bolinha, cor do fundo, contraste do texto secundário, carregamento da logo) — ou, se não houve sessão logada, a lista exata do que o dono deve conferir no link de preview da `staging` antes de ir para `master`.
2. **Causa dos dois defeitos da barra**, em uma frase cada (altura mínima sem altura definida; selo cortado pelo canto arredondado do botão).
3. **Divergência da logo:** o arquivo recebido é só a marca escrita ("ORGÂNICOS" + "raiar"), sem símbolo separado; foi usado inteiro, no espaço de 28px, sobre fundo branco (comparação com o fundo navy anotada). Se o dono quiser um ícone só-símbolo ou achar a marca pequena demais, ele precisa fornecer outro arquivo — follow-up.
4. **Efeito no Kanban:** como ficou o cabeçalho cinza das colunas sobre o novo fundo (mais sutil); se o dono achar que sumiu demais, é um ajuste de follow-up.
5. **Follow-ups de identidade não pedidos (não feitos):** ícone da aba ainda é o padrão do projeto inicial (app/favicon.ico); `<html lang="en">` deveria ser `pt-BR` (hoje o Chrome pode oferecer "traduzir do inglês" e leitores de tela leem com pronúncia em inglês); cabeçalho de tabela navy da referência ficou fora do escopo travado (só cores de fundo, barra lateral e cards de número).
6. **Recomendação de segurança (pré-existente, fora do escopo):** tests/e2e/session-persistence.spec.ts tem a senha da conta do dono gravada no código versionado — recomendar trocar a senha e mover e-mail/senha do teste para variável de ambiente fora do git.
7. **LGPD:** confirmar que nenhum screenshot de tela logada foi commitado ou colado no SUMMARY.
8. **Publicação:** só commits locais; staging -> link de teste -> master fica para quando o dono pedir (fluxo de deploy do CLAUDE.md).
</output>