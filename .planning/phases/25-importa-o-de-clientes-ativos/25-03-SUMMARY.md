---
phase: 25-importa-o-de-clientes-ativos
plan: 03
subsystem: importacao
tags: [react, nextjs, server-actions, vitest, playwright, importacao]

requires:
  - phase: 25-importa-o-de-clientes-ativos
    provides: "Plano 25-01 — RPC importar_clientes_ativos_lote (migration 0027) em produção; Plano 25-02 — SYSTEM_FIELDS_ATIVO, buildModeloAtivos, annotarLoteAtivos, validarLoteAtivos/confirmarLoteAtivos"

provides:
  - "Tela completa 'Importar Clientes Ativos': AtivoImportWizard (assistente de 3 passos), AtivoPreviewTable (revisão com coluna de CNPJ), AtivoImportSummary (conclusão com aviso fixo de frequência)"
  - "Rota /clientes/importar-ativos protegida por duplo redirecionamento (sem sessão -> /login, papel != supervisor -> /)"
  - "Entrada nova de menu 'Importar Clientes Ativos' (ícone BadgeCheck) na seção Administração, após as três entradas de importação existentes"

affects: [26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu]

tech-stack:
  added: []
  patterns:
    - "AtivoImportWizard segue o molde de ImportWizard.tsx (não CnpjImportWizard.tsx), porque este fluxo CRIA clientes com decisão por linha de duplicado; SYSTEM_FIELDS_ATIVO reusa o mesmo tipo SystemField de types.ts, então nenhuma chamada genérica (suggestMapping/applyMapping/requiredFieldsFaltando/ColumnMappingTable) precisou de anotação de tipo explícita como o fluxo de CNPJ (SystemFieldCnpj) precisou"
    - "Quinto vocabulário de campos consumido pela mesma camada de mapeamento genérica (ColumnMappingTable/suggestMapping/applyMapping/requiredFieldsFaltando) desde a Fase 17 — nenhuma função nova criada para servir a tela"

key-files:
  created:
    - components/importacao/AtivoPreviewTable.tsx
    - components/importacao/AtivoImportSummary.tsx
    - components/importacao/AtivoImportWizard.tsx
    - app/(app)/clientes/importar-ativos/page.tsx
    - tests/importacao/ativo-preview-table.test.tsx
    - tests/importacao/ativo-import-summary.test.tsx
  modified:
    - components/layout/AppSidebar.tsx
    - tests/importacao/AppSidebar.test.tsx

key-decisions:
  - "Fechamento com verificação PARCIAL do checkpoint humano — o dono do projeto/coordenador confirmou diretamente no navegador os blocos 1 (menu + acesso) e 2 (lista de 9 colunas obrigatórias contra a planilha real Listagem_Clientes_por_Vendedor.xlsx, sem necessidade de mudança) do checkpoint da Task 3. Os blocos 3-7 (upload real dos 4 cenários, cliente entrar como ganho, elo com a Agenda, bloqueio de rota para Vendedor, telas antigas intactas) não puderam ser testados nesta sessão — automação de navegador não conseguiu completar upload em input de arquivo, e o dono do projeto não estava disponível para o teste manual. Decisão explícita do coordenador: fechar a Fase 25 agora, documentando os blocos pendentes como human_judgment aberto no coverage abaixo, mesmo padrão já aceito na Fase 8 (verificação drag-and-drop ao vivo adiada por limitação de renderização da sessão)."
  - "BadgeCheck (selo com marca de conferido) escolhido para o ícone da entrada nova de menu — distinto de FileUp/RefreshCw/FileDigit já usados nas três importações irmãs, carregando a ideia de cliente já fechado (ganho)"
  - "AtivoImportSummary usa PuladaGroup de lib/importacao/confirmar.ts (mesmo tipo que CnpjImportSummary já usa) em vez de um tipo de propriedade local — confirmarLoteAtivos já devolve esse formato, sem necessidade de conversão"

patterns-established: []

requirements-completed: [ATIVO-01, ATIVO-02, ATIVO-03, ATIVO-04]

coverage:
  - id: D1
    description: "Entrada de menu 'Importar Clientes Ativos' aparece para o Supervisor, com rota e ícone corretos, depois das três entradas de importação existentes; some para o Vendedor"
    verification:
      - kind: unit
        ref: "tests/importacao/AppSidebar.test.tsx#ativossupervisor"
        status: pass
      - kind: unit
        ref: "tests/importacao/AppSidebar.test.tsx#ativosvendedor"
        status: pass
      - kind: unit
        ref: "tests/importacao/AppSidebar.test.tsx#ativosordem"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint Task 3, bloco 1 — confirmado diretamente no navegador pelo coordenador (entrada nova visível, ícone distinto, três antigas intactas, rota abre o assistente)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O assistente de 3 passos (Enviar planilha / Mapear colunas / Revisar) abre normalmente na rota /clientes/importar-ativos para o Supervisor"
    verification:
      - kind: manual_procedural
        ref: "Checkpoint Task 3, bloco 1 — confirmado diretamente no navegador pelo coordenador (wizard de 3 passos carrega)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O modelo de planilha tem 16 colunas com exatamente as 9 obrigatórias (Razão social, CNPJ, CEP, Rua, Número, Cidade, Estado, Responsável, Contato) batendo com a planilha real da equipe (Listagem_Clientes_por_Vendedor.xlsx)"
    requirement: "ATIVO-01"
    verification:
      - kind: unit
        ref: "tests/importacao/ativos-vocabulario.test.ts#obrigatorios"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint Task 3, bloco 2 — dono do projeto inspecionou a planilha real da equipe nesta sessão e confirmou que as 9 colunas obrigatórias já existem nela, sem necessidade de ajuste"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fluxo completo de upload -> mapeamento -> revisão mostra corretamente OK/erro (com motivo)/possível duplicado para um lote misto de 4 linhas, e confirmar grava só as linhas decididas (ATIVO-01/ATIVO-03/ATIVO-04 exercidos através da UI real, não só em teste unitário)"
    requirement: "ATIVO-03"
    verification: []
    human_judgment: true
    rationale: "Checkpoint Task 3, bloco 3, não verificado nesta sessão — a automação de navegador não conseguiu completar o upload de arquivo (bloqueio de segurança do navegador em inputs de tipo file) e o dono do projeto não estava disponível para o teste manual com a planilha de 4 cenários já preparada. A lógica subjacente (anotação por linha, detecção de duplicado, reconciliação de confirmação) já está coberta por 24 testes unitários no plano 25-02 (annotarLinhaAtivo.test.ts/confirmarAtivo.test.ts) e pelos 15 testes novos deste plano nos componentes de revisão/conclusão — o que falta é a prova de que as peças se encaixam corretamente na tela real. Pendente de teste manual de ponta a ponta assim que o dono do projeto tiver tempo."
  - id: D5
    description: "Cliente importado aparece na última coluna do funil ('1ª venda concluída'), marcado como ganho, com os dados da planilha na ficha (ATIVO-02 exercido através da UI real)"
    requirement: "ATIVO-02"
    verification: []
    human_judgment: true
    rationale: "Checkpoint Task 3, bloco 4, não verificado nesta sessão pelo mesmo motivo do D4 (upload não concluído). A RPC importar_clientes_ativos_lote já prova esse comportamento com 10 testes de integração contra o banco real (plano 25-01, importar-ativos-lote.test.ts) — falta a confirmação visual de que a tela de clientes reflete isso corretamente. Pendente de teste manual de ponta a ponta assim que o dono do projeto tiver tempo."
  - id: D6
    description: "Cliente importado aparece na seção 'Sem dia fixo definido' da Agenda (elo declarado com a Fase 24)"
    verification: []
    human_judgment: true
    rationale: "Checkpoint Task 3, bloco 5, não verificado nesta sessão pelo mesmo motivo do D4. Nenhum teste automatizado cobre este elo entre fases diretamente pela tela; depende do cliente importado existir de fato, o que depende do upload manual pendente. Pendente de teste manual de ponta a ponta assim que o dono do projeto tiver tempo."
  - id: D7
    description: "Vendedor não vê a entrada de menu nem consegue abrir a rota /clientes/importar-ativos diretamente (redirecionado para a tela inicial)"
    verification:
      - kind: unit
        ref: "tests/importacao/AppSidebar.test.tsx#ativosvendedor"
        status: pass
    human_judgment: true
    rationale: "A metade 'esconder do menu' está provada por teste automatizado (pass acima). A metade 'redirecionamento ao digitar a rota direto' (checkpoint Task 3, bloco 6) não foi verificada nesta sessão — não existe e2e dedicado para esta rota nova (só as rotas antigas têm importar-guard.spec.ts/importar-frequencias-guard.spec.ts), e o teste manual do bloco 6 não foi executado. A trava real (RPC + checagem de papel nas Server Actions + redirecionamento no componente de servidor) segue o mesmo padrão de três camadas já provado nas telas irmãs, mas sem prova direta nesta tela. Pendente de teste manual assim que o dono do projeto tiver tempo."
  - id: D8
    description: "As três telas antigas de importação (Importar clientes, Importar CNPJ, Importar frequências) continuam abrindo normalmente para o Supervisor, sem regressão desta fase"
    verification:
      - kind: e2e
        ref: "tests/e2e/importar-guard.spec.ts#Supervisor navigating to /clientes/importar sees the import wizard"
        status: pass
      - kind: e2e
        ref: "tests/e2e/importar-frequencias-guard.spec.ts#supervisor navigating to /clientes/importar-frequencias sees the import wizard"
        status: pass
    human_judgment: false
    rationale: "Os dois cenários de Vendedor destes mesmos specs (redirecionamento) falharam por causa do bloqueio pré-existente de contas semente apagadas (signInWithPassword: Invalid login credentials para vendedor.a+test@raiar.local), documentado em STATE.md desde 2026-08-19 — falha de login, não de comportamento das telas; nenhum dos dois arquivos de spec foi tocado por este plano. Os dois cenários de Supervisor (que não dependem da conta de Vendedor) provam que as telas antigas seguem intactas."

duration: ~45min (Tasks 1-2) + pausa de checkpoint (verificação parcial, blocos 3-7 pendentes)
completed: 2026-08-26
status: complete
---

# Phase 25 Plan 03: Tela de Importação de Clientes Ativos Summary

**Assistente de 3 passos "Importar Clientes Ativos" (upload, mapeamento com SYSTEM_FIELDS_ATIVO, revisão com coluna de CNPJ e decisão por linha em duplicado, conclusão com aviso fixo de frequência), rota protegida e entrada nova no menu — fechando ATIVO-01..04 na interface, com verificação de checkpoint parcial (blocos 1-2 confirmados, blocos 3-7 pendentes de teste manual).**

## Performance

- **Duration:** ~45min de execução ativa (Tasks 1-2) + pausa de checkpoint com verificação parcial
- **Tasks:** 2/3 tasks de código completas + 1 checkpoint humano parcialmente resolvido (fechado por decisão do coordenador)
- **Files modified:** 8 (6 criados, 2 editados)

## Accomplishments

- `AtivoPreviewTable.tsx` — cópia estrutural de `ImportPreviewTable.tsx` com uma coluna a mais (CNPJ) entre razão social e cidade/estado; mesma fatia de 50 linhas por página, mesmo estado vazio, mesma decisão por linha como propriedade controlada (o componente lê `decisions` e reporta via `onDecisionChange`, nunca guarda estado próprio).
- `AtivoImportSummary.tsx` — cópia estrutural de `ImportSummary.tsx` com rótulo de "clientes ATIVOS importados" e um bloco de aviso FIXO (sempre visível, nunca condicional) explicando que a planilha não define frequência de visita e que os clientes importados vão aparecer em "Sem dia fixo definido" na Agenda — o elo declarado com a Fase 24.
- `AtivoImportWizard.tsx` — cópia estrutural de `ImportWizard.tsx` (o molde com decisão por linha em duplicado, não o de CNPJ), servindo `SYSTEM_FIELDS_ATIVO` para `suggestMapping`/`applyMapping`/`requiredFieldsFaltando`/`ColumnMappingTable`, chamando `validarLoteAtivos`/`confirmarLoteAtivos` (plano 25-02), e usando `AtivoPreviewTable`/`AtivoImportSummary` (Task 1) nos passos 3 e de conclusão.
- `app/(app)/clientes/importar-ativos/page.tsx` — rota exclusiva do Supervisor, duplo redirecionamento (sem sessão -> `/login`, papel != supervisor -> `/`), mesma disciplina das três telas irmãs.
- `AppSidebar.tsx` — entrada nova "Importar Clientes Ativos" (ícone `BadgeCheck`) ao final da seção Administração, depois das três entradas de importação já existentes, sem tocar em nenhuma delas.
- 15 novos casos de teste (8 em `AtivoPreviewTable`/`AtivoImportSummary` + 3 em `AppSidebar.test.tsx`, além dos 4 existentes de `AppSidebar.test.tsx` que continuam intactos) — todos verdes, junto com `tests/importacao/import-summary.test.tsx` (importação antiga) sem edição.
- `npx tsc --noEmit` e `npm run lint` sem erro nem aviso novo.
- Regressão das telas antigas confirmada por e2e: os cenários de Supervisor de `importar-guard.spec.ts`/`importar-frequencias-guard.spec.ts` passam sem edição.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tabela de revisão e tela de conclusão da importação de ativos** - `49588ed` (feat)
2. **Task 2: Assistente de 3 passos, rota protegida e entrada nova no menu** - `f009420` (feat)
3. **Task 3: Checkpoint humano — verificação de ponta a ponta** - sem commit de código (verificação parcial; fechado por decisão do coordenador, ver Deviations)

**Plan metadata:** (a ser preenchido pelo commit final desta etapa)

## Files Created/Modified

- `components/importacao/AtivoPreviewTable.tsx` - tabela de revisão do passo 3, com coluna de CNPJ e decisão por linha controlada
- `components/importacao/AtivoImportSummary.tsx` - tela de conclusão com aviso fixo sobre frequência de visita
- `components/importacao/AtivoImportWizard.tsx` - assistente de 3 passos servindo `SYSTEM_FIELDS_ATIVO` e as Server Actions de ativos
- `app/(app)/clientes/importar-ativos/page.tsx` - rota exclusiva do Supervisor
- `components/layout/AppSidebar.tsx` - entrada nova de menu (ícone `BadgeCheck`)
- `tests/importacao/ativo-preview-table.test.tsx` - 8 casos cobrindo colunas, resumo, motivos, ação por status, decisão controlada, estado vazio e paginação
- `tests/importacao/ativo-import-summary.test.tsx` - 7 casos cobrindo contagens, título, motivos, aviso fixo e botões
- `tests/importacao/AppSidebar.test.tsx` - 3 casos novos (visibilidade Supervisor/Vendedor, ordem) somados aos 8 já existentes

## Decisions Made

- **Fechamento com verificação parcial do checkpoint:** ver `key-decisions` no frontmatter e a seção "Deviations from Plan" abaixo — decisão explícita do coordenador de fechar a Fase 25 agora, documentando os blocos 3-7 do checkpoint como pendência de teste manual.
- **`BadgeCheck` para o ícone da entrada nova de menu** — distinto dos três já usados, carregando a ideia de cliente já fechado (ganho).
- **`AtivoImportWizard` segue o molde de `ImportWizard.tsx`, não `CnpjImportWizard.tsx`** — este fluxo cria clientes com decisão por linha de duplicado, diferente do fluxo de CNPJ que só atualiza. `SYSTEM_FIELDS_ATIVO` reusa o mesmo tipo `SystemField` de `types.ts` (ao contrário de `SYSTEM_FIELDS_CNPJ`, que introduz `SystemFieldCnpj`), então nenhuma chamada genérica precisou de anotação de tipo explícita — mais simples que o molde de CNPJ neste ponto específico.

## Deviations from Plan

### Checkpoint fechado com verificação parcial (decisão do coordenador, fora das Regras 1-4 de auto-fix)

O checkpoint humano da Task 3 pede 7 blocos de verificação. Nesta sessão:

- **Bloco 1 (menu e acesso):** confirmado diretamente no navegador pelo coordenador — PASS.
- **Bloco 2 (lista de 9 colunas obrigatórias contra a planilha real da equipe):** confirmado diretamente pelo dono do projeto, que já havia inspecionado `Listagem_Clientes_por_Vendedor.xlsx` nesta sessão — as 9 colunas batem, nenhuma mudança necessária — PASS.
- **Blocos 3-7 (upload real com os 4 cenários, cliente entrar como ganho, elo com a Agenda, bloqueio de rota para Vendedor, telas antigas intactas):** NÃO verificados nesta sessão. A automação de navegador não conseguiu completar o upload de arquivo (bloqueio de segurança do navegador em inputs de tipo `file`); uma planilha de teste com os 4 cenários foi preparada e entregue ao dono do projeto para teste manual, mas ele não estava disponível no momento.

O coordenador decidiu explicitamente fechar a Fase 25 agora com essa verificação parcial, apoiado em: (a) os 26 testes automatizados novos deste plano (15) mais os já existentes de `import-summary.test.tsx` (11 tratados na Task 1) passando; (b) a garantia mecânica já conferida (RPC em produção desde o plano 25-01, vocabulário de campos obrigatórios idêntico entre tela e banco desde o plano 25-02, menu e rota funcionando); (c) precedente já aceito no próprio projeto (Fase 8, verificação de drag-and-drop ao vivo adiada por limitação de sessão, documentada como lacuna residual). Os blocos pendentes estão registrados no bloco `coverage` acima como `human_judgment: true`, cada um com `rationale` explicando o que falta e por quê — ficam como pendência de teste manual de ponta a ponta assim que o dono do projeto tiver tempo, não como bug conhecido.

Nenhum código foi alterado por esta decisão — é puramente uma decisão de processo sobre como fechar o checkpoint, não uma Regra 1-4 de auto-fix.

## Issues Encountered

- `npx vitest run tests/importacao/` mostrou 33 falhas em 4 arquivos pré-existentes (`rls-cnpj-lote.test.ts`, `rls-dedup-read.test.ts`, `rls-frequencia-lote.test.ts`, `rls-importar-lote.test.ts`) — mesma pendência já registrada em STATE.md (contas semente `vendedor.a+test@raiar.local` apagadas em 2026-08-19). Nenhum dos quatro arquivos foi tocado por este plano; fora de escopo, bloqueio herdado, não regressão.
- `npx playwright test tests/e2e/importar-guard.spec.ts tests/e2e/importar-frequencias-guard.spec.ts` — os 2 cenários de Supervisor passaram (provando que as telas antigas seguem intactas); os 2 cenários de Vendedor falharam pelo mesmo motivo acima (login do Vendedor de teste falha antes mesmo de chegar na asserção de redirecionamento) — mesmo bloqueio herdado, não regressão.

## User Setup Required

None além do teste manual pendente — ver "Deviations from Plan" acima e os itens `human_judgment: true` no `coverage`. Assim que o dono do projeto tiver tempo, rodar os blocos 3-7 do checkpoint da Task 3 (texto completo no `25-03-PLAN.md`) com a planilha de teste de 4 cenários já preparada.

## Next Phase Readiness

- Fase 25 (ATIVO-01..04) fechada nas 3 camadas: banco (plano 25-01), lógica pura + Server Actions (plano 25-02) e interface (este plano). `REQUIREMENTS.md` marca os quatro requisitos como Completos.
- Fase 26 (Importação de Clientes em Prospecção e Limpeza de Menu) pode prosseguir — ela depende desta fase provar que a nova planilha de Ativos substitui o caso de uso antes de remover as telas antigas de "Importar CNPJ"/"Importar frequências" (MENU-01/MENU-02). Como o teste manual de ponta a ponta (blocos 3-7) ainda está pendente, recomenda-se completá-lo antes de iniciar a remoção das telas antigas na Fase 26 — a remoção é irreversível sem uma migration de reversão, enquanto o teste manual pendente é rápido e de baixo custo.
- Nenhum bloqueio novo de código. A pendência é exclusivamente de verificação manual (blocos 3-7 do checkpoint) e a pendência pré-existente das contas semente apagadas, ambas já documentadas.

---
*Phase: 25-importa-o-de-clientes-ativos*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: components/importacao/AtivoPreviewTable.tsx
- FOUND: components/importacao/AtivoImportSummary.tsx
- FOUND: components/importacao/AtivoImportWizard.tsx
- FOUND: app/(app)/clientes/importar-ativos/page.tsx
- FOUND: tests/importacao/ativo-preview-table.test.tsx
- FOUND: tests/importacao/ativo-import-summary.test.tsx
- FOUND: commit 49588ed (feat, Task 1)
- FOUND: commit f009420 (feat, Task 2)
