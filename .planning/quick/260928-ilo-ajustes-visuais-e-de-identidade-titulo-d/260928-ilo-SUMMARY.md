---
phase: quick-260928-ilo
plan: 01
subsystem: ui
tags: [nextjs, tailwind, shadcn, sidebar, dashboard, branding]

requires: []
provides:
  - "Título/descrição da aba do navegador substituídos pelo texto real do produto"
  - "Barra lateral com altura fixa na janela (sticky) em qualquer tela, sem espaço em branco embaixo"
  - "Indicador visual (bolinha sem número) de pendência da Agenda no menu recolhido"
  - "Fundo cinza claro (slate-50) na área logada, cards brancos destacados"
  - "Card 'Taxa de conversão' com borda lateral colorida (padrão dos demais cards)"
  - "Logo real da Raiar no lugar do quadrado azul com 'R' na barra lateral"
  - "Textos/ícones do menu lateral mais claros (slate-100/slate-400)"
affects: [ui, dashboard, layout]

tech-stack:
  added: []
  patterns:
    - "next/image com unoptimized para imagens estáticas pequenas em /public, evitando gasto de cota de otimização da Vercel"
    - "Cor do degradê de fade (ScrollColumnShell) precisa sempre espelhar o bg do <main> pai — documentado com comentário cruzado nos dois arquivos"

key-files:
  created:
    - tests/layout/root-metadata.test.tsx
    - tests/layout/app-sidebar-visual.test.tsx
    - tests/dashboard/ganhos-perdidos-cards.test.tsx
  modified:
    - app/layout.tsx
    - app/(app)/layout.tsx
    - components/layout/AppSidebar.tsx
    - components/clientes/ScrollColumnShell.tsx
    - components/dashboard/GanhosPerdidosCards.tsx
    - tests/agenda/app-sidebar-agenda.test.tsx
    - tests/clientes/kanban-scroll-column.test.tsx
    - tests/funil/app-sidebar-perdidos.test.tsx
    - tests/funil/app-sidebar-encerrados.test.tsx
    - public/raiar-logo.png

key-decisions:
  - "Logo usada inteira (marca escrita completa), sem recorte, porque o arquivo recebido não tem símbolo separado"
  - "Fundo da área logada limitado a slate-50 (não mais escuro) para preservar contraste AA do texto secundário"
  - "Estados ativo/hover/fundo navy da barra lateral não foram tocados — já estavam no caminho da referência"

patterns-established:
  - "Bolinha de pendência sem número em modo recolhido: data-slot=\"agenda-pendente-dot\", ancorada num wrapper relative em volta do ícone (nunca no canto do link)"

requirements-completed: [QUICK-260928-ilo]

coverage:
  - id: D1
    description: "Título da aba mostra 'CRM - Raiar' em vez do texto padrão do create-next-app"
    verification:
      - kind: unit
        ref: "tests/layout/root-metadata.test.tsx#title é exatamente 'CRM - Raiar'"
        status: pass
      - kind: unit
        ref: "tests/layout/root-metadata.test.tsx#description não contém o texto padrão do create-next-app"
        status: pass
    human_judgment: true
    rationale: "O teste unitário prova o valor de metadata.title/description; confirmar que o navegador de fato exibe isso na aba (inclusive /login) depende de abrir o preview, que não pôde ser feito nesta execução (ver seção Checagem no Preview)."
  - id: D2
    description: "Barra lateral ocupa sempre a altura inteira da janela (sticky, sem espaço em branco embaixo) e rola por dentro em telas baixas"
    verification:
      - kind: unit
        ref: "tests/layout/app-sidebar-visual.test.tsx#o <aside> tem sticky, top-0 e h-dvh, e não tem mais h-full"
        status: pass
      - kind: unit
        ref: "tests/layout/app-sidebar-visual.test.tsx#o <nav> tem min-h-0 para poder encolher e rolar por dentro da barra"
        status: pass
    human_judgment: true
    rationale: "As classes CSS corretas estão provadas por teste; o comportamento visual real (altura igual à da janela, parada ao rolar, sem corte) só é confirmável abrindo o app no navegador — não realizado nesta execução."
  - id: D3
    description: "Bolinha sem número no ícone da Agenda quando o menu está recolhido e há pendências; nada no menu expandido"
    verification:
      - kind: unit
        ref: "tests/agenda/app-sidebar-agenda.test.tsx#recolhido com 5 pendentes"
        status: pass
      - kind: unit
        ref: "tests/agenda/app-sidebar-agenda.test.tsx#recolhido com 23 pendentes"
        status: pass
      - kind: unit
        ref: "tests/agenda/app-sidebar-agenda.test.tsx#recolhido com 0 pendentes"
        status: pass
      - kind: unit
        ref: "tests/agenda/app-sidebar-agenda.test.tsx#expandido com 5 pendentes"
        status: pass
    human_judgment: true
    rationale: "O teste prova posição/anel/existência via DOM; se a bolinha aparece 'inteira, sem corte' visualmente sobre o ícone real (não apenas nos limites do jsdom) precisa de confirmação visual no navegador, não feita nesta execução."
  - id: D4
    description: "Fundo cinza bem claro (slate-50) na área logada; degradê do Kanban acompanha o mesmo tom, sem faixa branca"
    verification:
      - kind: unit
        ref: "tests/clientes/kanban-scroll-column.test.tsx#renders a conditional fade sibling outside the scroll div, hidden by default in jsdom"
        status: pass
      - kind: other
        ref: "node -e script no verify da Task 2 confirmando bg-slate-50 em app/(app)/layout.tsx"
        status: pass
    human_judgment: true
    rationale: "Contraste do texto secundário (AA >= 4,5:1) e ausência de faixa branca no pé das colunas do Kanban precisam de medição real no navegador (getComputedStyle), não executável sem sessão de preview nesta execução."
  - id: D5
    description: "Card 'Taxa de conversão' com borda lateral colorida (border-l-primary), igual ao padrão de Ganhos/Perdidos"
    verification:
      - kind: unit
        ref: "tests/dashboard/ganhos-perdidos-cards.test.tsx#todos os 3 cards de número têm borda lateral colorida, cada um com a sua própria cor"
        status: pass
    human_judgment: false
  - id: D6
    description: "Logo real da Raiar no lugar do quadrado azul com 'R', sobre fundo branco, sem distorção, no mesmo espaço 28x28"
    verification:
      - kind: unit
        ref: "tests/layout/app-sidebar-visual.test.tsx#recolhido e expandido: a logo (<img>) aparece num contêiner size-7/rounded-md/bg-white, e o quadrado com 'R' saiu"
        status: pass
    human_judgment: true
    rationale: "O teste prova src/alt/classes via DOM; carregamento real da imagem (naturalWidth 310) e legibilidade da marca em 28px só são confirmáveis olhando o navegador real, não feito nesta execução."
  - id: D7
    description: "Textos/ícones do menu lateral mais claros (slate-100/slate-400), sem mudar fundo/hover/ativo"
    verification:
      - kind: unit
        ref: "tests/layout/app-sidebar-visual.test.tsx#expandido: link inativo (Dashboard) usa text-slate-100"
        status: pass
      - kind: unit
        ref: "tests/layout/app-sidebar-visual.test.tsx#expandido: rótulo de seção, cargo e botão de recolher usam text-slate-400"
        status: pass
      - kind: unit
        ref: "tests/layout/app-sidebar-visual.test.tsx#expandido: o botão 'Sair' usa text-slate-100"
        status: pass
      - kind: unit
        ref: "tests/funil/app-sidebar-perdidos.test.tsx (regressão bg-slate-700 do item ativo)"
        status: pass
      - kind: unit
        ref: "tests/funil/app-sidebar-encerrados.test.tsx (regressão bg-slate-700 do item ativo)"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-09-28
status: complete
---

# Quick Task 260928-ilo: Ajustes Visuais e de Identidade Summary

**Título da aba corrigido, barra lateral com altura fixa na janela, bolinha de pendência da Agenda no menu recolhido, fundo cinza claro na área logada, borda colorida no card "Taxa de conversão", e a logo real da Raiar substituindo o quadrado azul com "R" — só aparência, nenhum dado, permissão ou banco mudou.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-28T16:48:31Z
- **Completed:** 2026-09-28T16:58:18Z
- **Tasks:** 3/3
- **Files modified:** 13 (10 esperados no plano + 2 arquivos de teste ajustados por deviation + 1 arquivo de teste do plano)

## O que mudou, tela por tela (e resultado das checagens)

**Importante:** esta execução rodou num ambiente sem acesso a um navegador/preview real (nenhuma ferramenta de captura de tela disponível para o executor). Todos os itens abaixo foram provados por teste automatizado (rodando de verdade contra o componente renderizado em memória, não um mock solto) — mas a confirmação visual final, olhando o app rodando de verdade num navegador, **ainda precisa ser feita pelo dono do projeto no link de preview da `staging`**, antes de promover para `master` (fluxo de deploy do CLAUDE.md). Lista exata do que conferir:

1. **Aba do navegador (qualquer tela, inclusive /login):** deve mostrar "CRM - Raiar", não mais "Create Next App".
2. **Barra lateral (qualquer tela, especialmente Dashboard rolado até o fim):** a barra deve ocupar exatamente a altura da janela, sem espaço em branco embaixo, e ficar parada (sticky) enquanto a página rola. Numa tela baixa, o menu deve rolar por dentro da própria barra, não estourar a página.
3. **Agenda com o menu recolhido (só ícones) e pendências:** deve aparecer uma bolinha pequena, sem número, colada no canto do ícone da Agenda — inteira, sem corte. Com zero pendências, nada aparece. Passando o mouse sobre o ícone recolhido, a dica continua dizendo "Agenda (N)".
4. **Área de conteúdo (Dashboard, Clientes/Kanban, Agenda, Perdidos, Encerrados, Equipe, Configurações):** fundo cinza bem claro atrás dos cards brancos. Conferir que nenhum texto ficou difícil de ler.
5. **Clientes (Kanban):** o degradê no pé de cada coluna deve "sumir" no fundo cinza claro, sem deixar faixa branca. O cabeçalho cinza de cada coluna vai ficar mais sutil sobre o novo fundo — isso é esperado, não é bug (ver "Efeito no Kanban" abaixo).
6. **Dashboard, cards de número:** "Ganhos" (verde), "Perdidos" (vermelho) e agora também "Taxa de conversão" (cor primária) devem ter uma barrinha colorida do lado esquerdo.
7. **Barra lateral, topo:** no lugar do quadrado azul com "R", deve aparecer a logo da Raiar (marca escrita) sobre um fundo branco, do mesmo tamanho de antes. Conferir se a marca fica legível nesse tamanho pequeno (ver "Divergência da logo" abaixo).
8. **Barra lateral, textos:** ícones e textos dos links, do rótulo "Principal", do cargo "Vendedor"/"Supervisor" e do botão "Sair" devem estar visivelmente mais claros que antes. O fundo escuro (navy) e o item ativo (mais claro, com destaque) não mudam.

Todos os valores medidos "no papel" (classes CSS aplicadas, presença/ausência de elementos, texto acessível dos selos) foram confirmados pelos 44 testes automatizados que passam (ver seção Task Commits). O que falta são as medições que só existem no navegador de verdade: altura do `<aside>` em pixels comparada à da janela, cor computada (`getComputedStyle`) do fundo e do texto secundário para o cálculo de contraste, e o carregamento real da imagem da logo (`naturalWidth`).

## Causa dos dois defeitos da barra (uma frase cada)

- **Barra "curta":** o `<aside>` usava `h-full`, mas o contêiner pai (`app/(app)/layout.tsx`) é uma linha flex com só uma altura MÍNIMA (`min-h-screen`), então não havia altura de referência para o `h-full` calcular — a barra ficava só do tamanho do próprio conteúdo.
- **Selo da Agenda sumindo no menu recolhido:** o indicador antigo ficava no canto do `<Link>` inteiro (`absolute -top-1 -right-1`), mas o link tem `overflow-hidden rounded-md` — o canto arredondado cortava quase todo o círculo, que também ficava longe do ícone.

## Divergência da logo

O CONTEXT descrevia a logo como "símbolo circular estilizado + texto 'ORGÂNICOS RAIAR' abaixo". O arquivo real `public/raiar-logo.png` (310x130px, 5091 bytes) é só a marca escrita: "ORGÂNICOS" em arco em cima e "raiar" embaixo — não existe um símbolo separado para recortar. Como recortar geraria um pedaço sem sentido, a marca inteira foi usada, como está, no espaço de 28x28px que o "R" ocupava, sobre fundo branco (a tinta da logo, rgb(37,77,105), dá só ~2:1 de contraste sobre o navy da barra — quase invisível — e ~9:1 sobre branco). Consequência: nesse tamanho pequeno a marca fica bem reduzida (~24x10px) e o nome "raiar" acaba aparecendo tanto na logo quanto no texto "CRM Raiar" ao lado dela. **Se o dono achar a marca pequena demais ou quiser um ícone só com o símbolo, vai precisar fornecer outro arquivo — isso é um follow-up, não bloqueia esta entrega.**

## Efeito no Kanban

O cabeçalho cinza de cada coluna do Kanban usa uma cor de fundo (`bg-secondary`) que, sobre o novo fundo cinza claro da página, fica visualmente mais sutil (menos contraste entre o cabeçalho e o fundo ao redor) — o texto do cabeçalho continua com o mesmo contraste de antes, só a "moldura" ficou mais discreta. Isso ficou fora do escopo travado desta tarefa (só cores de fundo, barra lateral e cards de número — não o cabeçalho das colunas). **Se o dono achar que o cabeçalho "sumiu" demais depois de ver no preview, é um ajuste de follow-up, não um bug desta entrega.**

## Follow-ups de identidade não pedidos (não feitos)

- **Ícone da aba do navegador** (`app/favicon.ico`) ainda é o ícone padrão do projeto inicial do Next.js — não foi trocado porque não estava na lista de pedidos.
- **`<html lang="en">`** em `app/layout.tsx` deveria provavelmente ser `pt-BR` — hoje o Chrome pode oferecer "traduzir do inglês" e leitores de tela leem o conteúdo com pronúncia em inglês. Não alterado porque não foi pedido.
- **Cabeçalho de tabela navy** (como na referência mostrada pelo dono) ficou fora do escopo travado desta tarefa, que cobriu só cores de fundo, barra lateral e cards de número.

## Recomendação de segurança (pré-existente, fora do escopo desta tarefa)

`tests/e2e/session-persistence.spec.ts` tem a senha da conta do dono do projeto gravada diretamente no código versionado no git. Esta tarefa **não usou nem digitou** essa senha em nenhum momento (regra de segurança seguida à risca). Recomendação para o dono: trocar essa senha o quanto antes e mover e-mail/senha do teste para uma variável de ambiente que fique fora do git (arquivo `.env` não versionado), para que credenciais reais não fiquem visíveis a quem tiver acesso ao histórico do repositório.

## LGPD

Nenhum screenshot de tela logada foi tirado, commitado ou colado neste SUMMARY — o ambiente de execução não tinha acesso a um navegador/preview real, então a checagem visual logada nem chegou a ser tentada (não houve risco de exposição de dados de clientes). Nenhuma credencial do repositório foi usada. Todas as mudanças desta tarefa são só de aparência (classes CSS, título da aba, uma imagem estática) — nenhum tratamento de dado pessoal foi criado, lido ou alterado.

## Publicação

Só commits locais (3 commits, um por task: `fix`, `style`, `feat`), nenhum push. Como de costume no fluxo de deploy deste projeto: quando o dono quiser publicar, o próximo passo é empurrar para a branch `staging` no GitHub, abrir o link de preview que a Vercel gera automaticamente, e usar a lista de checagens acima (`O que mudou, tela por tela`) para confirmar visualmente antes de promover para `master`.

## Task Commits

Cada task foi commitada individualmente:

1. **Task 1: Título da aba, barra lateral na altura da janela e bolinha da Agenda recolhida** - `2131f85` (fix)
2. **Task 2: Fundo cinza claro na área logada e borda colorida no card "Taxa de conversão"** - `6159b2f` (style)
3. **Task 3: Logo da Raiar na barra lateral e textos do menu mais claros** - `e1df418` (feat)

## Files Created/Modified

- `app/layout.tsx` - title "CRM - Raiar" e nova description
- `app/(app)/layout.tsx` - `<main>` ganha `bg-slate-50`
- `components/layout/AppSidebar.tsx` - `<aside>` sticky/top-0/h-dvh, `<nav>` min-h-0, bolinha de pendência da Agenda, logo real via next/image, textos mais claros
- `components/clientes/ScrollColumnShell.tsx` - degradê do pé das colunas acompanha `from-slate-50`
- `components/dashboard/GanhosPerdidosCards.tsx` - card "Taxa de conversão" ganha `border-l-primary`
- `public/raiar-logo.png` - logo versionada pela primeira vez (5091 bytes, já fornecida pelo dono)
- `tests/layout/root-metadata.test.tsx` (novo) - metadata.title/description
- `tests/layout/app-sidebar-visual.test.tsx` (novo) - altura da barra, logo, cores do menu
- `tests/dashboard/ganhos-perdidos-cards.test.tsx` (novo) - borda colorida dos 3 cards
- `tests/agenda/app-sidebar-agenda.test.tsx` - casos de bolinha substituindo o indicador numérico antigo
- `tests/clientes/kanban-scroll-column.test.tsx` - degradê espera `from-slate-50`
- `tests/funil/app-sidebar-perdidos.test.tsx` - seletor do indicador atualizado (deviation, ver abaixo)
- `tests/funil/app-sidebar-encerrados.test.tsx` - seletor do indicador atualizado (deviation, ver abaixo)

## Decisions Made

- Logo usada por inteiro, sem recorte, sobre fundo branco (ver "Divergência da logo" acima) — decisão de planejamento confirmada na execução ao ler o arquivo real.
- Fundo da área logada limitado a `slate-50` (não um cinza mais escuro), para manter o contraste do texto secundário em >= 4,5:1 (AA) — não medido no navegador nesta execução (ver coverage D4), mas o valor escolhido é o mesmo já validado no planejamento.
- Nenhuma cor do fundo navy, bordas, hover ou item ativo da barra lateral foi tocada — já estavam no caminho da referência visual do dono.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dois testes pré-existentes quebrariam com o redesenho da bolinha da Agenda**
- **Found during:** Task 1 (RED phase, antes da implementação)
- **Issue:** `tests/funil/app-sidebar-perdidos.test.tsx` e `tests/funil/app-sidebar-encerrados.test.tsx` tinham um caso ("recolhido-sem-contador") que buscava o indicador de pendência pelo seletor CSS antigo `.absolute.-top-1.-right-1`. O plano mandava trocar exatamente essas classes de posição (para `-top-0.5 -right-0.5`, classes novas da bolinha), o que faria esse caso passar a encontrar zero elementos e falhar — apesar de não estarem na lista `files_modified` da Task 1, e não terem sido citados no `key_links` do plano (que só menciona a dependência de `bg-slate-700`).
- **Fix:** Atualizado o seletor dos dois testes de `.absolute.-top-1.-right-1` para `[data-slot="agenda-pendente-dot"]` (o novo atributo estável que a Task 1 já usa nos outros testes), mantendo a mesma asserção ("existe exatamente 1 indicador").
- **Files modified:** `tests/funil/app-sidebar-perdidos.test.tsx`, `tests/funil/app-sidebar-encerrados.test.tsx`
- **Verification:** Os dois arquivos continuam 100% verdes depois da mudança de implementação (rodados no verify da Task 1 e no conjunto completo da Task 3).
- **Committed in:** `2131f85` (commit da Task 1)

---

**Total deviations:** 1 auto-fixed (1 bug pré-existente de teste acoplado a detalhe de implementação)
**Impact on plan:** Necessário para não quebrar o conjunto de testes existente; escopo idêntico ao já previsto pelo plano para `tests/agenda/app-sidebar-agenda.test.tsx` (mesma troca de seletor), só que em dois arquivos que o plano não havia listado. Sem scope creep — nenhuma outra mudança nesses dois arquivos.

## Issues Encountered

Nenhum bloqueio técnico. A única limitação foi de ambiente: o executor não teve acesso a um navegador/preview real nesta execução (nenhuma ferramenta de captura de tela ou de driver de navegador disponível), então todas as checagens visuais "no preview" descritas no plano ficaram documentadas como pendentes para o dono conferir no link de preview da `staging` (ver seção "O que mudou, tela por tela" acima) — comportamento já previsto pelo próprio plano para o caso de não haver sessão logada disponível.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- As 3 tasks estão prontas e testadas; falta só a confirmação visual do dono no link de preview da `staging` antes de promover para `master`.
- Follow-ups não bloqueantes registrados acima: ícone da aba (favicon), `<html lang>` em português, cabeçalho de tabela navy da referência, tamanho/legibilidade da logo, cabeçalho do Kanban mais sutil, e a recomendação de segurança sobre a senha gravada no teste e2e.

## Self-Check: PASSED

All 13 files listed in "Files Created/Modified" confirmed present on disk; all 3 task commit hashes (`2131f85`, `6159b2f`, `e1df418`) confirmed present in `git log`.

---
*Phase: quick-260928-ilo*
*Completed: 2026-09-28*
