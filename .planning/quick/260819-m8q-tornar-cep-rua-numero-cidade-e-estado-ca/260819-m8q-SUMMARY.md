---
phase: quick-260819-m8q
plan: 01
subsystem: database
tags: [zod, postgres, supabase, rls-adjacent-validation, nextjs-server-actions]

requires: []
provides:
  - Migration 0023: cep/rua/numero/cidade/estado on `clientes` are nullable; chk_estado_valido unchanged (nulo already passes a Postgres CHECK)
  - Importação em massa accepts blank address (5 fields), writing NULL never empty string
  - lib/clientes/rotuloLocalizacao.ts as the single authority for "Sem cidade"/"Sem estado" display labels
  - FiltersPopover "Sem estado"/"Sem cidade" filter options, never hiding an addressless cliente
  - updateClienteSchema (edit ficha) accepts blank address (D-06); createClienteSchema (cadastro manual) unchanged
affects: [importacao, clientes, filtros, ficha-de-edicao]

tech-stack:
  added: []
  patterns:
    - "Nullable-address invariant: annotarLinha/confirmar/updateCliente all convert blank -> null before it reaches Postgres, never empty string (chk_estado_valido rejects '' but accepts null)"
    - "Single-authority absence labels: rotuloLocalizacao.ts owns 'Sem cidade'/'Sem estado', consumed by ClienteCard, FiltersPopover, and (implicitly) the ficha via the same nullable types"

key-files:
  created:
    - supabase/migrations/0023_endereco_opcional_na_importacao.sql
    - lib/clientes/rotuloLocalizacao.ts
    - tests/clientes/endereco-opcional.test.ts
    - tests/clientes/rotulo-localizacao.test.ts
    - tests/clientes/endereco-opcional-edicao.test.ts
  modified:
    - lib/importacao/types.ts
    - lib/validations/importacao.ts
    - lib/importacao/annotarLinha.ts
    - lib/importacao/confirmar.ts
    - lib/supabase/queries/clientes.ts
    - components/clientes/ClienteCard.tsx
    - components/clientes/KanbanBoard.tsx
    - components/clientes/ClienteDetailSheet.tsx
    - components/clientes/FiltersPopover.tsx
    - lib/validations/cliente.ts
    - app/actions/clientes.ts
    - components/clientes/EstadoCidadeFields.tsx
    - tests/importacao/annotarLinha.test.ts
    - tests/importacao/confirmar.test.ts
    - tests/clientes/filters-popover.test.tsx

key-decisions:
  - "createClienteSchema (cadastro manual) left byte-identical on purpose (D-01) — only updateClienteSchema (ficha de edição) was loosened (D-06); the asymmetry is intentional, not a drift"
  - "chk_estado_valido needed zero changes: a Postgres CHECK evaluates NULL as unknown (never false), so it already accepted null; empty string still evaluates false and is still rejected — that's the trap importação/edição must dodge by writing null, never ''"
  - "updateCliente's cidade×estado cross-check (cidades_por_estado + cidadeValida) now runs ONLY when both fields are filled — an empty pair isn't incoherent, it's just absent"

patterns-established:
  - "rotuloLocalizacao.ts is the single source of truth for 'Sem cidade'/'Sem estado' — never write that text by hand in a second component"
  - "FiltersPopover's ESTADO_AUSENTE/CIDADE_AUSENTE sentinels follow the existing SEM_FILTRO double-underscore convention and are exported for direct test use"

requirements-completed: [QUICK-260819-m8q]

coverage:
  - id: D1
    description: "Migration 0023 makes cep/rua/numero/cidade/estado nullable on clientes; chk_estado_valido still rejects empty string, accepts null"
    verification:
      - kind: integration
        ref: "tests/clientes/endereco-opcional.test.ts (3 tests, run against hosted DB after migration applied)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Importação em massa accepts a row with the 5 endereço fields blank, resolves them to null (never ''), and the row still lands in rowsToInsert; prior error reasons (razão social, responsável, UF inválida, cidade inexistente) unchanged"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts, tests/importacao/confirmar.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Card, ficha (read layer), export, and filter render 'Sem cidade'/'Sem estado' for a null cidade/estado, never null/undefined text, and never hide the cliente when no filter is active"
    verification:
      - kind: unit
        ref: "tests/clientes/rotulo-localizacao.test.ts, tests/clientes/filters-popover.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Filtro de Estado/Cidade has 'Sem estado'/'Sem cidade' options that find exactly the clientes missing that field; RPC de cidades never called for the ausência sentinel"
    verification:
      - kind: unit
        ref: "tests/clientes/filters-popover.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "updateClienteSchema accepts blank address and still rejects an invalid UF sigla; createClienteSchema is unchanged and still requires all 5 fields; updateCliente writes null (never '') and only cross-checks cidade×estado when both are present"
    verification:
      - kind: unit
        ref: "tests/clientes/endereco-opcional-edicao.test.ts, tests/clientes/cliente-actions.test.ts (schema-only subset)"
        status: pass
      - kind: integration
        ref: "tests/clientes/endereco-opcional-edicao.test.ts (DB block: UPDATE null accepted, UPDATE '' rejected)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Manual browser walkthrough (import with blank address, cadastro manual still blocked, card shows Sem cidade/Sem estado, filter finds them, ficha saves without address, ficha still rejects invalid state, filling in address later updates the card)"
    verification: []
    human_judgment: true
    rationale: "Requires interacting with the real UI (kanban, import wizard, filters popover, edit sheet) as both Supervisor and Vendedor accounts — the plan's own <verification> section defers this to the project owner"

duration: ~24min (Tasks 1, 3-5; excludes the external pause while the migration was applied to the hosted DB)
completed: 2026-08-19
status: complete
---

# Quick Task 260819-m8q: Endereço Opcional na Importação e na Ficha de Edição Summary

**Tornou CEP/Rua/Número/Cidade/Estado opcionais na importação em massa e na ficha de edição de clientes (gravando NULL, nunca texto vazio), mantendo-os obrigatórios só no cadastro manual — migration 0023 + camada de importação + rótulos "Sem cidade"/"Sem estado" + filtro + updateClienteSchema/updateCliente.**

## Performance

- **Duration:** ~24 min de execução ativa (Tasks 1, 3, 4, 5), mais uma pausa externa enquanto o dono do projeto aplicava a migration no banco hospedado (Task 2, checkpoint humano)
- **Tasks:** 5/5 completas (1 auto, 1 checkpoint humano, 3 auto/tdd)
- **Files modified:** 15 modificados + 5 criados = 20 arquivos

## Accomplishments

- Migration 0023 tornou `cep`/`rua`/`numero`/`cidade`/`estado` anuláveis em `clientes`, sem tocar em `chk_estado_valido` (um CHECK do Postgres já aceita nulo; texto vazio continua recusado)
- Camada de importação (`SYSTEM_FIELDS`, `createImportRowSchema`, `annotarLinha`, `confirmar`) passou a aceitar as 5 células de endereço em branco e a gravar NULO — nunca texto vazio — mantendo intactos os motivos de erro anteriores (razão social, responsável, UF inválida, cidade inexistente)
- Novo módulo `lib/clientes/rotuloLocalizacao.ts` é a autoridade única dos rótulos "Sem cidade"/"Sem estado"; card, filtro e tipos de leitura (`ClienteListItem`/`ClienteDetalhe`/`ClienteExportRow`) passaram a tratar cidade/estado como anuláveis sem nunca esconder o cliente nem imprimir `null`/`undefined`
- `FiltersPopover` ganhou as sentinelas `ESTADO_AUSENTE`/`CIDADE_AUSENTE` (opções "Sem estado"/"Sem cidade"), com guarda para nunca chamar a RPC de cidades para a sentinela de ausência
- `updateClienteSchema` (ficha de edição) afrouxado para aceitar endereço em branco (D-06) — `createClienteSchema` (cadastro manual) permanece byte-a-byte igual (D-01) — e `updateCliente` passou a gravar nulo nos 5 campos em branco e só cruzar cidade×estado quando os dois vêm preenchidos

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0023 — as 5 colunas de endereço viram anuláveis em `clientes`** - `0f71de1` (feat)
2. **Task 2: Aplicar a migration 0023 no banco hospedado** - checkpoint humano, sem commit de código (o dono aplicou via `npx supabase@2.111.0 db push` e confirmou os 3 testes de `endereco-opcional.test.ts` verdes)
3. **Task 3: Camada de importação aceita as 5 células em branco e grava valor nulo** - `f70c276` (feat, tdd)
4. **Task 4: Lista, ficha, exportação e filtro tratam cidade/estado nulos com rótulo próprio** - `99cb320` (feat, tdd)
5. **Task 5: A ficha de edição aceita endereço em branco e grava nulo (D-06)** - `4d248cb` (feat, tdd)

_Note: cada task "tdd" seguiu o ciclo escrever-teste-antes → implementar → verde, mas foi commitada como um único commit `feat` por task (todos os arquivos, incluindo os de teste, entraram no mesmo commit por task) — não RED/GREEN/REFACTOR separados, já que o plano não marcou as tasks com `tdd="true"` como plano-inteiro em modo TDD estrito de commits sequenciais._

**Plan metadata:** (a ser commitado pelo orquestrador junto com STATE.md/ROADMAP.md)

## Files Created/Modified

- `supabase/migrations/0023_endereco_opcional_na_importacao.sql` - 5 `alter column ... drop not null`; comentário explicando por que `chk_estado_valido` não precisa mudar
- `tests/clientes/endereco-opcional.test.ts` - 3 testes de integração contra o banco real (nulo aceito, `''` recusado, campos independentes)
- `lib/clientes/rotuloLocalizacao.ts` - `rotuloCidadeEstado()`, autoridade única de "Sem cidade"/"Sem estado"
- `tests/clientes/rotulo-localizacao.test.ts` - 7 testes cobrindo os 4 quadrantes de ausência + espaço-em-branco tratado como ausente
- `tests/clientes/endereco-opcional-edicao.test.ts` - schema (createClienteSchema/updateClienteSchema) + banco (UPDATE nulo aceito, UPDATE `''` recusado)
- `lib/importacao/types.ts` - só `razaoSocial`/`responsavel` continuam `required: true`
- `lib/validations/importacao.ts` - os 5 campos de endereço viram opcionais em `createImportRowSchema`; `ENDERECO_FIELDS` removido (sem consumidor)
- `lib/importacao/annotarLinha.ts` - `ResolvedRow` anulável nos 5 campos; motivo de endereço faltando removido; valor aparado→nulo (nunca `''`)
- `lib/importacao/confirmar.ts` - `RpcClienteRow` anulável nos 5 campos
- `lib/supabase/queries/clientes.ts` - `ClienteListItem`/`ClienteDetalhe`/`ClienteExportRow` (e as `Row` cruas correspondentes) anuláveis nos campos de endereço
- `components/clientes/ClienteCard.tsx` - lê `rotuloCidadeEstado()` em vez de montar o par cru
- `components/clientes/KanbanBoard.tsx` - `handleClienteSaved` grava nulo (nunca `''`) em cidade/estado
- `components/clientes/ClienteDetailSheet.tsx` - `toFormValues`/`defaultValues` acompanham a união `"" | Uf`
- `components/clientes/FiltersPopover.tsx` - sentinelas `ESTADO_AUSENTE`/`CIDADE_AUSENTE`; `clienteAtendeFiltros` com os dois ramos de ausência; guarda de UF antes da RPC
- `lib/validations/cliente.ts` - só o bloco `updateClienteSchema` mudou (D-01/D-06)
- `app/actions/clientes.ts` - só `updateCliente` mudou; checagem cruzada condicional; grava nulo
- `components/clientes/EstadoCidadeFields.tsx` - só comentário de cabeçalho reescrito (sem mudança de comportamento)
- `tests/importacao/annotarLinha.test.ts`, `tests/importacao/confirmar.test.ts`, `tests/clientes/filters-popover.test.tsx` - casos novos cobrindo o comportamento acima

## Decisions Made

- **createClienteSchema intocado, updateClienteSchema afrouxado (D-01/D-06):** a assimetria entre cadastrar e editar é intencional — o cadastro manual continua exigindo os 5 campos porque o vendedor tem a informação na mão; a edição precisa acompanhar a importação para não travar quem só quer corrigir um telefone num cliente importado sem endereço.
- **`chk_estado_valido` não mudou:** um CHECK do Postgres avalia nulo como "desconhecido" (nunca falso), então já aceitava nulo antes desta task; texto vazio continua avaliando falso e sendo recusado. Essa é a trava que obriga tanto a importação quanto `updateCliente` a converterem "em branco" em nulo, nunca em `''`, antes de gravar.
- **`updateCliente` só cruza cidade×estado quando os dois vêm preenchidos:** com qualquer um em branco não há nada a cruzar — `cidadeValida` devolveria falso para texto vazio e recusaria o salvamento com o mesmo bloqueio que D-06 pede para tirar. Consistente com a importação: os campos são independentes entre si.
- **Módulo único (`rotuloLocalizacao.ts`) para "Sem cidade"/"Sem estado":** evita que card e filtro divirjam sobre o texto de ausência.
- **Sentinelas do filtro (`ESTADO_AUSENTE`/`CIDADE_AUSENTE`) exportadas:** seguem a convenção de nome de `SEM_FILTRO` já existente no arquivo, e foram exportadas especificamente para os testes poderem exercitar o mesmo valor que a UI envia, evitando string mágica duplicada no teste.

## Deviations from Plan

None - plan executado exatamente como escrito, incluindo o checkpoint humano da Task 2 (migration aplicada pelo dono do projeto via `npx supabase@2.111.0 db push`, confirmado com os 3 testes de `endereco-opcional.test.ts` passando antes de retomar as Tasks 3-5).

## Issues Encountered

- **Rate limit conhecido de `signInWithPassword` (pré-existente, documentado em STATE.md Blockers):** ao rodar o verify da Task 5 (`cliente-actions.test.ts`, `update-delete.test.ts`, `cliente-ativo-campos.test.ts`), 22 testes falharam com "Invalid login credentials" para a conta seed `vendedor.a+test@raiar.local`. Confirmado como pré-existente e não-causado por esta task: `tests/auth/rls-roles.test.ts` (arquivo não tocado nesta task) falha com o EXATO mesmo erro quando rodado isoladamente. Todos os testes puramente de schema (sem `signInAs`) passaram — 12/18 em `cliente-actions.test.ts`, 13/13 no novo `endereco-opcional-edicao.test.ts`. Nenhuma ação necessária; mesma convenção já registrada nas Fases 13/18/19 (provar isoladamente os arquivos de maior risco em vez de depender de `npm test` inteiro limpo numa tacada).

## User Setup Required

None - nenhuma configuração de serviço externo necessária. A única ação manual foi a Task 2 (aplicar a migration no banco hospedado), já concluída pelo dono do projeto durante a execução deste plano.

## Next Phase Readiness

- O comportamento está completo e testado por unidade/integração nas camadas de banco, importação, leitura, exibição, filtro e edição.
- **Verificação manual no navegador ainda pendente** (seção `<verification>` do plano, 8 passos) — o dono do projeto precisa confirmar visualmente: importação com endereço em branco, cadastro manual continua exigindo, card mostra "Sem cidade/Sem estado", filtro encontra esses clientes (nas duas contas Supervisor/Vendedor), ficha salva sem endereço, ficha ainda recusa estado inválido, e preencher o endereço depois atualiza o card.
- **Fora de escopo, registrado no plano (D-06):** não há como esvaziar pela interface um campo Estado já preenchido na ficha — o `<Select>` de Estado não tem item de "limpar". Se o dono quiser essa opção, é uma decisão/task separada.

## Self-Check: PASSED

All 18 files listed in "Files Created/Modified" (plus this SUMMARY.md) confirmed present on disk; all 4 task commit hashes (`0f71de1`, `f70c276`, `99cb320`, `4d248cb`) confirmed in `git log --oneline --all`.

---
*Quick task: 260819-m8q*
*Completed: 2026-08-19*
