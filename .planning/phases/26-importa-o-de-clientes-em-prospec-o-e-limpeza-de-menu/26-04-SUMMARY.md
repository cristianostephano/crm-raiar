---
phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu
plan: 04
subsystem: ui
tags: [nextjs, react, vitest, menu, kanban]

# Dependency graph
requires:
  - phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu (plano 01)
    provides: "atualizar_cnpj_lote e atualizar_frequencia_visita_lote ja removidas do banco — pre-condicao para apagar as telas/rotas/acoes com seguranca"
  - phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu (plano 02)
    provides: "razao_social opcional na planilha de prospeccao, nula (nunca vazia) de ponta a ponta — a causa raiz do titulo em branco que a Task 3 fecha"
provides:
  - "Menu Administracao renomeado e limpo: 4 entradas (Gerenciar equipe, Configuracoes, Importar Clientes em Prospeccao, Importar Clientes Ativos)"
  - "29 arquivos das telas Importar CNPJ e Importar frequencias removidos por completo (codigo, rota, testes)"
  - "lib/clientes/nomeExibicao.ts — autoridade unica do nome exibido de um cliente (razao social -> Nome Fantasia -> rotulo de ausencia)"
affects: []

tech-stack:
  added: []
  patterns:
    - "nomeExibicaoCliente segue o mesmo molde de rotuloCidadeEstado (modulo puro, sem Supabase, tolerante a nulo/espaco em branco) — mesma familia de rotulo de ausencia (Sem cidade/Sem estado/Sem nome)"

key-files:
  created:
    - lib/clientes/nomeExibicao.ts
    - tests/clientes/nome-exibicao.test.ts
  modified:
    - components/layout/AppSidebar.tsx
    - app/(app)/clientes/importar/page.tsx
    - app/(app)/clientes/importar-ativos/page.tsx
    - tests/importacao/AppSidebar.test.tsx
    - tests/e2e/importar-guard.spec.ts
    - tests/importacao/mapping.test.ts
    - tests/importacao/column-mapping-table.test.tsx
    - components/clientes/ClienteCard.tsx
    - components/clientes/KanbanBoard.tsx
    - components/clientes/ClienteDetailSheet.tsx
    - lib/supabase/queries/clientes.ts

key-decisions:
  - "Os dois testes de infraestrutura generica de mapeamento (mapping.test.ts, column-mapping-table.test.tsx) pararam de importar SYSTEM_FIELDS_FREQUENCIA (apagado) e passaram a declarar uma lista de campos LOCAL (CAMPOS_TESTE), tipada pela mesma interface generica — preserva exatamente a mesma prova (Select/suggestMapping respeitam a lista recebida) sem depender de nenhum arquivo removido"
  - "razao_social continua tipado como string (nao string | null) em ClienteListItem/ClienteRow/ClienteDetalhe de proposito — mudar o tipo se propagaria para PerdaMotivoDialog/GanhoFrequenciaDialog (fora do escopo deste plano); em vez disso, todo ponto de EXIBICAO (titulo do cartao, ordenacao AZ, busca por texto, titulo da ficha, confirmacao de exclusao) passou a rotear por nomeExibicaoCliente(), que tolera o valor nulo real independente do que o tipo declara"
  - "toFormValues() do ClienteDetailSheet cai para razaoSocial ?? \"\" (mesma convencao dos demais campos opcionais) para o campo de EDICAO nunca virar um Input nao-controlado quando o cliente carregado nao tiver razao social — o rotulo de exibicao (titulo/exclusao) e a UNICA responsabilidade de nomeExibicaoCliente, o campo de formulario continua mostrando o valor real"
  - "nome_fantasia acrescentado ao select() e aos tipos ClienteListItem/ClienteRow de getClientesAgrupadosPorEtapa (repasse de coluna ja existente em clientes, nao consulta nova) — e o unico jeito do cartao do funil e a ordenacao/busca terem acesso ao Nome Fantasia"

requirements-completed: [PROSP-01, MENU-01, MENU-02, PROSP-02]

coverage:
  - id: D1
    description: "Entrada de menu e titulo da tela de prospeccao renomeados para 'Importar Clientes em Prospecção'; rotulo antigo comprovadamente ausente do DOM"
    requirement: "PROSP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/AppSidebar.test.tsx (11 casos, incluindo assercao negativa do rotulo antigo)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/importar-guard.spec.ts (asserção de heading atualizada — não executado nesta sessão, blocker de credenciais semente pré-existente em STATE.md)"
        status: unknown
    human_judgment: false
  - id: D2
    description: "Importar CNPJ e Importar frequencias removidas por completo (29 arquivos: 14 CNPJ + 15 frequencias) — zero referencia solta, projeto compila e constroi"
    requirement: "MENU-01"
    verification:
      - kind: unit
        ref: "grep dirigido por rota/import removido (0 ocorrencias); npx tsc --noEmit; npm run build (rotas /clientes/importar-cnpj e /clientes/importar-frequencias ausentes da lista gerada)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mesma remocao completa cobre Importar frequencias; cobertura de 'secao Administracao inteira escondida do Vendedor' preservada num caso sobrevivente"
    requirement: "MENU-02"
    verification:
      - kind: unit
        ref: "tests/importacao/AppSidebar.test.tsx (caso 'ativosvendedor' assume a asserção de Gerenciar equipe/Configurações escondidas)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cliente sem razao social exibe o Nome Fantasia no cartao do funil e no titulo da ficha; continua encontravel pela busca por texto"
    requirement: "PROSP-02"
    verification:
      - kind: unit
        ref: "tests/clientes/nome-exibicao.test.ts (7 casos: razao social presente, nulo, indefinido, so espaco, ambos ausentes, tolerancia a excecao)"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 4) — dono do projeto seedou um cliente de teste (sem razão social, Nome Fantasia 'Padaria do Zé') e confirmou os 9 passos do roteiro no navegador"
        status: pass
    human_judgment: true
    rationale: "Verificação visual real no navegador (menu, rotas 404, título do cartão/ficha, busca) exige julgamento humano — automação de upload/click já documentada como não confiável nesta sessão (Fases 24/25/26); dono do projeto executou e aprovou diretamente."

# Metrics
duration: "~50min (Tasks 1-3, execução automática) + checkpoint humano aprovado pelo dono do projeto"
completed: 2026-08-27
status: complete
---

# Phase 26 Plan 4: Limpeza de menu e nome exibido sem razão social Summary

**Menu Administração renomeado e reduzido a 4 entradas (PROSP-01/MENU-01/MENU-02: "Importar CNPJ" e "Importar frequências" removidas por completo, 29 arquivos), e `nomeExibicaoCliente()` fecha a regressão visível de título em branco para clientes de prospecção sem razão social (PROSP-02), com fallback para Nome Fantasia no cartão do funil e na ficha.**

## Performance

- **Duration:** ~50min (Tasks 1-3, execução automática) + pausa de checkpoint até aprovação do dono do projeto
- **Started:** 2026-08-27 (após 26-03)
- **Completed:** 2026-08-27
- **Tasks:** 4 (3 auto/tdd + 1 checkpoint human-verify)
- **Files modified:** 15 (2 criados, 13 modificados) + 29 removidos

## Accomplishments

- `components/layout/AppSidebar.tsx` e `app/(app)/clientes/importar/page.tsx`: rótulo de menu e título da tela travados em "Importar Clientes em Prospecção" (PROSP-01); comentários de diferenciação de ícone atualizados; teste novo prova que o rótulo antigo não é mais renderizado
- 29 arquivos das telas "Importar CNPJ" e "Importar frequências" removidos por completo — tela, rota, ação de servidor, módulos puros e testes de cada planilha (MENU-01/MENU-02); as duas RPCs correspondentes já haviam sido removidas do banco no plano 26-01
- `tests/importacao/mapping.test.ts` e `column-mapping-table.test.tsx`: infraestrutura genérica de mapeamento passa a usar uma lista de campos declarada localmente (`CAMPOS_TESTE`), preservando a prova de que `suggestMapping`/`ColumnMappingTable` respeitam a lista de campos recebida, sem depender do vocabulário de frequências apagado
- `lib/clientes/nomeExibicao.ts` (novo, TDD): `nomeExibicaoCliente(razaoSocial, nomeFantasia)` — razão social quando preenchida, senão Nome Fantasia, senão o rótulo único `"Sem nome"`; tolera nulo/indefinido/espaço em branco nos dois argumentos
- `lib/supabase/queries/clientes.ts`, `ClienteCard.tsx`, `KanbanBoard.tsx`, `ClienteDetailSheet.tsx`: `nome_fantasia` repassado até o cartão do funil; título e dica de texto do cartão, ordenação "A-Z", busca por texto, título da ficha e texto de confirmação de exclusão passam a usar `nomeExibicaoCliente()` em vez de razão social crua

## Task Commits

Each task was committed atomically:

1. **Task 1: PROSP-01 — renomear a planilha de prospecção** - `a7e6c55` (feat)
2. **Task 2: MENU-01/MENU-02 — remover Importar CNPJ e Importar frequências** - `e1072c3` (feat)
3. **Task 3: Nome exibido de um cliente sem razão social** - `a78935d` (test, RED) → `1544c59` (feat, GREEN — módulo puro) → `2e7669c` (feat — wiring no cartão/ficha)
4. **Task 4: Checkpoint humano** - sem commit de código; aprovado pelo dono do projeto com um cliente de teste seedado/removido fora deste repositório

**Plan metadata commit:** (a ser criado neste commit final)

_TDD Gate Compliance: `test(...)` (a78935d) antes de `feat(...)` (1544c59) confirmado no git log — RED/GREEN respeitado._

## Files Created/Modified

- `lib/clientes/nomeExibicao.ts` - módulo novo, autoridade única do nome exibido de um cliente
- `tests/clientes/nome-exibicao.test.ts` - 7 casos cobrindo as três quedas + tolerância a nulo
- `components/layout/AppSidebar.tsx` - rótulo renomeado (Task 1); duas entradas removidas, ícones/comentários limpos (Task 2)
- `app/(app)/clientes/importar/page.tsx` - título da tela renomeado
- `app/(app)/clientes/importar-ativos/page.tsx` - comentário de cabeçalho deixa de citar a rota removida como precedente
- `tests/importacao/AppSidebar.test.tsx` - casos renomeados/reancorados; 6 casos das entradas removidas trocados por 1 caso negativo; cobertura de seção-inteira-escondida preservada
- `tests/e2e/importar-guard.spec.ts` - asserção de heading atualizada
- `tests/importacao/mapping.test.ts` / `column-mapping-table.test.tsx` - lista de campos local (`CAMPOS_TESTE`) substitui o import do vocabulário apagado
- `components/clientes/ClienteCard.tsx` - `nomeFantasia` na forma `ClienteCardData`; título/tooltip via `nomeExibicaoCliente`
- `components/clientes/KanbanBoard.tsx` - `toCardData`/`handleClienteSaved` repassam `nomeFantasia`; ordenação AZ e busca por texto usam o nome exibido
- `components/clientes/ClienteDetailSheet.tsx` - título do cabeçalho e confirmação de exclusão via `nomeExibicaoCliente`; `toFormValues` cai para `""` na razão social nula
- `lib/supabase/queries/clientes.ts` - `nome_fantasia` no select/tipo de `getClientesAgrupadosPorEtapa`

## Decisions Made

- `razao_social` permanece tipado `string` (não `string | null`) em `ClienteListItem`/`ClienteRow`/`ClienteDetalhe` — mudar o tipo se propagaria para `PerdaMotivoDialog`/`GanhoFrequenciaDialog` (fora do escopo travado deste plano, que lista só 2 pontos de exibição). Em vez disso, todo ponto que EXIBE o nome passou a rotear por `nomeExibicaoCliente()`, que trata corretamente o valor nulo real em tempo de execução independentemente do que o tipo declara
- `toFormValues()` cai para `razaoSocial ?? ""` — mesma convenção já usada pelos demais campos opcionais (cep/rua/numero/cidade/estado) — para o campo de EDIÇÃO da ficha nunca virar um Input não-controlado; o rótulo de exibição (título/exclusão) é responsabilidade exclusiva de `nomeExibicaoCliente`, nunca do campo de formulário
- `nome_fantasia` acrescentado ao `select()` de `getClientesAgrupadosPorEtapa` (repasse de coluna já existente em `clientes` desde a Fase 13, não consulta nova) — sem isso o cartão do funil não teria de onde tirar o Nome Fantasia
- Rótulo de ausência único (`ROTULO_SEM_NOME = "Sem nome"`) na mesma família de `"Sem cidade"`/`"Sem estado"` já aceita pelo dono do projeto

## Deviations from Plan

None - plano executado exatamente como escrito. O checkpoint humano (Task 4) foi fechado pelo dono do projeto seedando e removendo um cliente de teste próprio (razão social nula, Nome Fantasia "Padaria do Zé") para suprir a pendência real deixada pelo checkpoint do plano 26-03 (upload de planilha real ainda não testado) — método equivalente ao roteiro original, mesmo resultado exigido.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Fase 26 concluída: PROSP-01, PROSP-02, MENU-01 e MENU-02 fechados e confirmados no navegador pelo dono do projeto
- Marco v1.6 (Importação de Clientes Ativos e Prospecção Separadas) concluído por completo — este é o último plano da última fase
- Pendência real registrada (não bloqueante): teste de upload de planilha real de prospecção com arquivo `.xlsx`/`.csv` genuíno (passos 4-9 do roteiro original do plano 26-03) ainda não foi feito com um arquivo de verdade — a verificação até aqui usou um cliente seedado diretamente no banco. Recomendado fazer esse teste de upload real na primeira oportunidade de uso normal do sistema.
- Nenhum bloqueio identificado para o encerramento do marco

---
*Phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu*
*Completed: 2026-08-27*

## Self-Check: PASSED

- FOUND: lib/clientes/nomeExibicao.ts
- FOUND: tests/clientes/nome-exibicao.test.ts
- FOUND: .planning/phases/26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu/26-04-SUMMARY.md
- FOUND commit: a7e6c55
- FOUND commit: e1072c3
- FOUND commit: a78935d
- FOUND commit: 1544c59
- FOUND commit: 2e7669c
