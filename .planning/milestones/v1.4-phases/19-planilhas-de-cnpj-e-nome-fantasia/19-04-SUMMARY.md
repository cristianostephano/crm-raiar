---
phase: 19-planilhas-de-cnpj-e-nome-fantasia
plan: 04
subsystem: import
tags: [react, next-app-router, vitest, testing-library, lucide-react]

# Dependency graph
requires:
  - phase: 19-planilhas-de-cnpj-e-nome-fantasia (plano 19-03)
    provides: "SYSTEM_FIELDS_CNPJ, buildModeloCnpj(), MappedRowCnpj/ResolvedRowCnpj, ValidatedRowCnpj, validarLoteCnpj(linhas), confirmarLoteCnpj(linhas) — a camada de aplicação inteira que este plano monta em tela"
  - phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio
    provides: "FrequenciaImportWizard.tsx / FrequenciaPreviewTable.tsx / FrequenciaImportSummary.tsx / app/(app)/clientes/importar-frequencias/page.tsx — molde literal do assistente de três passos, da tabela de revisão, do resumo pós-gravação e da rota exclusiva de Supervisor"
provides:
  - "CnpjPreviewTable.tsx — tabela de revisão paginada do passo 3, cinco colunas (linha, razão social da planilha, cliente encontrado do BANCO, CNPJ a gravar, status com motivos), sem coluna de Ação"
  - "CnpjImportSummary.tsx — resumo pós-gravação com contagem de puladas DERIVADA da soma dos grupos de motivos"
  - "CnpjImportWizard.tsx — assistente de três passos ligando FileDropzone/ColumnMappingTable já existentes às duas Server Actions do plano 19-03"
  - "app/(app)/clientes/importar-cnpj/page.tsx — rota exclusiva de Supervisor, duplo redirecionamento"
  - "entrada 'Importar CNPJ' no menu lateral (seção Administração), ícone FileDigit"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terceiro par tela+wizard do fluxo de importação em planilha (Fase 6-7, Fase 17, agora Fase 19): mesma casca de 3 passos, mesmos componentes compartilhados (FileDropzone, ColumnMappingTable) reusados sem edição, sinalizador de carga marcado de forma síncrona ANTES da chamada assíncrona, remapear zera a revisão anterior — nenhum dos dois assistentes irmãos foi aberto para edição"
    - "Vocabulário de status 'ok'/'erro' (sem 'duplicado') não pode ser expresso literalmente em comentário de código nos arquivos que passam por verificação mecânica de regex — comentários explicativos precisam descrever o conceito ('o terceiro valor do vocabulário') em vez de citar a palavra-chave, quando o próprio arquivo é varrido por um script que proíbe essa palavra"

key-files:
  created:
    - components/importacao/CnpjPreviewTable.tsx
    - components/importacao/CnpjImportSummary.tsx
    - components/importacao/CnpjImportWizard.tsx
    - app/(app)/clientes/importar-cnpj/page.tsx
    - tests/importacao/cnpj-preview-table.test.tsx
    - tests/importacao/cnpj-import-summary.test.tsx
  modified:
    - components/layout/AppSidebar.tsx
    - tests/importacao/AppSidebar.test.tsx

key-decisions:
  - "CnpjPreviewTable.tsx comentários reescritos para não conter a palavra literal 'duplicado' (o script de verificação mecânica do próprio plano varre o arquivo por essa palavra para provar que o terceiro estado de status nunca ocorre neste fluxo) — mesma explicação, sem o gatilho do falso positivo"
  - "Ícone FileDigit (lucide-react) escolhido para a entrada 'Importar CNPJ' — distinto de FileUp ('Importar clientes') e RefreshCw ('Importar frequências'), já instalado, sem npm install novo"
  - "Dados de teste do checkpoint humano (4 clientes 'TESTE 19-04 *') semeados diretamente via service-role client (mesmo padrão de serviceClient() usado pelos testes de integração do projeto), nunca através da UI — evita depender de signInWithPassword e do rate-limit conhecido do Supabase Auth; apagados pelo mesmo caminho depois da aprovação"

patterns-established: []

requirements-completed: [IMP-03]

coverage:
  - id: D1
    description: "Tabela de revisão do passo 3 (5 colunas, cliente encontrado lido do banco, linha de nome ambíguo vira erro legível e não conta entre as prontas, paginação, estado vazio)"
    requirement: IMP-03
    verification:
      - kind: unit
        ref: "tests/importacao/cnpj-preview-table.test.tsx (9 casos, todos pass, incluindo o caso 'ambiguo')"
        status: pass
    human_judgment: false
  - id: D2
    description: "Resumo pós-gravação deriva a contagem de puladas da soma dos grupos de motivos"
    requirement: IMP-03
    verification:
      - kind: unit
        ref: "tests/importacao/cnpj-import-summary.test.tsx (4 casos, todos pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Assistente de três passos, rota exclusiva de Supervisor (duplo redirecionamento) e entrada de menu — sinalizador de gravação síncrono antes da chamada, remapear zera a revisão anterior"
    requirement: IMP-03
    verification:
      - kind: unit
        ref: "tests/importacao/AppSidebar.test.tsx (8 casos, todos pass)"
        status: pass
      - kind: other
        ref: "verificação mecânica via node -e (script do plano, Task 2) — posição de setConfirming(true) antes da chamada, setValidatedRows(null) na remapeação, duplo redirecionamento + checagem de papel, ícone distinto, ordem do menu preservada"
        status: pass
      - kind: e2e
        ref: "npx next build — rota /clientes/importar-cnpj compila sem erro"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fluxo completo de ponta a ponta no navegador: entrada no menu por papel, bloqueio de Vendedor por URL direta, modelo de planilha, mapeamento sugerido, revisão linha a linha (incluindo o par de nome ambíguo), gravação sem duplo clique, resumo, CNPJ persistido só no cliente certo, nenhum cliente novo criado, e as colunas CNPJ/Nome Fantasia disponíveis na planilha de importar clientes"
    requirement: IMP-03
    verification:
      - kind: manual_procedural
        ref: "Task 3 do plano — roteiro de 10 passos, aprovado pelo dono do projeto no navegador ('funcionou ok')"
        status: pass
    human_judgment: true
    rationale: "Confirmação visual de que o casamento por nome, o erro de ambiguidade e a persistência do CNPJ no cliente certo são compreensíveis e corretos aos olhos do dono do projeto (não-técnico) — exatamente o tipo de julgamento que a automação não substitui, por isso o plano exigiu um checkpoint humano bloqueante em vez de auto-aprovação."

# Metrics
duration: ~55min
completed: 2026-08-14
status: complete
---

# Phase 19 Plan 4: Planilhas de CNPJ e Nome Fantasia (tela "CNPJ em massa") Summary

**Assistente de três passos, tabela de revisão com casamento por nome visível, resumo pós-gravação, rota exclusiva de Supervisor e entrada de menu — montados por cima das Server Actions do plano 19-03, no mesmo molde do fluxo de frequência (Fase 17); verificado de ponta a ponta no navegador pelo dono do projeto, incluindo o caso de nome ambíguo.**

## Performance

- **Duration:** ~55 min (incluindo pausa para verificação humana no navegador)
- **Started:** 2026-08-14T12:32:00Z
- **Completed:** 2026-08-14T13:32:39Z
- **Tasks:** 3/3
- **Files modified:** 8 (6 arquivos de produção novos/modificados, 2 arquivos de teste novos, 1 arquivo de teste modificado)

## Accomplishments

- `components/importacao/CnpjPreviewTable.tsx` — tabela de revisão paginada do passo 3, irmã estrutural de `FrequenciaPreviewTable.tsx`: cinco colunas (linha, razão social da planilha, cliente encontrado — lido do BANCO, nunca da planilha —, CNPJ a gravar, status com motivos), reusando `statusBorderClass`/`summaryCounts` sem modificação, sem coluna de Ação (este fluxo nunca tem o terceiro valor do vocabulário de status).
- `components/importacao/CnpjImportSummary.tsx` — resumo pós-gravação, irmã estrutural de `FrequenciaImportSummary.tsx`: contagem de puladas DERIVADA da soma dos grupos de motivos recebidos, nunca uma propriedade separada.
- `components/importacao/CnpjImportWizard.tsx` — assistente de três passos, cópia estrutural de `FrequenciaImportWizard.tsx`, servindo `SYSTEM_FIELDS_CNPJ` e chamando `validarLoteCnpj`/`confirmarLoteCnpj` do plano 19-03; sinalizador de gravação em voo marcado de forma síncrona ANTES da chamada assíncrona (dois cliques rápidos não gravam duas vezes), e continuar do passo 2 zera a revisão anterior.
- `app/(app)/clientes/importar-cnpj/page.tsx` — rota exclusiva de Supervisor com o mesmo duplo redirecionamento das outras duas telas de importação (sem sessão → `/login`, papel diferente de supervisor → `/`).
- `components/layout/AppSidebar.tsx` — entrada "Importar CNPJ" na seção Administração, logo depois de "Importar frequências", com o ícone `FileDigit` (distinto de todos os outros ícones já usados no menu).
- 21 testes unitários novos/estendidos (3 arquivos: `cnpj-preview-table.test.tsx` com 9 casos incluindo o caso obrigatório de nome ambíguo, `cnpj-import-summary.test.tsx` com 4 casos, `AppSidebar.test.tsx` estendido com 3 casos novos), todos verdes.
- Verificação humana no navegador (Task 3) aprovada pelo dono do projeto: fluxo completo de ponta a ponta, incluindo o par de clientes com nome ambíguo, confirmando que a linha vira erro legível e nenhum CNPJ é gravado no cliente errado.
- Nenhum dos dois assistentes de importação já existentes (clientes, frequência), a zona de envio de arquivo, a tabela de mapeamento nem os auxiliares de revisão compartilhados foram editados — confirmado mecanicamente pelo script de verificação do plano.

## Task Commits

1. **Task 1: Tabela de revisão e tela de resumo** — `260c454` (test, RED) → `70cf285` (feat, GREEN)
2. **Task 2: Assistente de três passos, rota exclusiva de Supervisor e entrada no menu** — `93beec8` (feat)
3. **Task 3: Verificação humana no navegador** — checkpoint aprovado pelo dono do projeto ("funcionou ok"), sem commit de código associado

**Plan metadata:** (próximo commit — docs: complete plan)

## Files Created/Modified

- `components/importacao/CnpjPreviewTable.tsx` — tabela de revisão do passo 3.
- `components/importacao/CnpjImportSummary.tsx` — tela de resumo pós-gravação.
- `components/importacao/CnpjImportWizard.tsx` — assistente de três passos.
- `app/(app)/clientes/importar-cnpj/page.tsx` — rota exclusiva de Supervisor.
- `components/layout/AppSidebar.tsx` — entrada de menu nova (`FileDigit`).
- `tests/importacao/cnpj-preview-table.test.tsx` — 9 casos.
- `tests/importacao/cnpj-import-summary.test.tsx` — 4 casos.
- `tests/importacao/AppSidebar.test.tsx` — 3 casos novos (8 no total).

## Decisions Made

- **Comentários de `CnpjPreviewTable.tsx` reescritos para não citar a palavra "duplicado" literalmente** — o próprio script de verificação mecânica do plano (Task 1) varre o arquivo por essa palavra para confirmar que o terceiro valor do vocabulário de status nunca ocorre neste fluxo; copiar o comentário do molde de frequência ao pé da letra teria disparado um falso positivo nessa mesma checagem. Comportamento idêntico, só a redação do comentário mudou.
- **`FileDigit` (lucide-react, já instalado) como ícone da entrada "Importar CNPJ"** — distinto de `FileUp` ("Importar clientes") e `RefreshCw` ("Importar frequências"); nenhuma instalação de pacote novo.
- **Dados de teste do checkpoint humano semeados via service-role client, não pela UI** — dois clientes "TESTE 19-04 Ambiguo Ltda"/"TESTE 19-04 AMBIGUO" (mesma chave normalizada, um com sufixo societário e caixa diferente, o outro sem), um cliente "ganho" com CNPJ antigo para testar a atualização, e um cliente "não ganho" para testar o motivo de inaptidão — todos apagados pelo mesmo caminho (service role, `delete().like('razao_social', 'TESTE 19-04%')`) depois da aprovação do dono do projeto. Evitou depender de `signInWithPassword` e do rate-limit conhecido do Supabase Auth só para montar o cenário.

## Deviations from Plan

None — plano executado exatamente como escrito. A reescrita do comentário acima é ajuste mecânico de redação para passar na verificação do próprio plano, não uma mudança de comportamento (Regra 1-4 não se aplica).

## Issues Encountered

- `npx vitest run tests/importacao/` completo não fechou 100% limpo pelo mesmo rate-limit conhecido de `signInWithPassword` do Supabase Auth já documentado em `STATE.md`/`13-01-SUMMARY.md`/`18-01-SUMMARY.md`/`19-03-SUMMARY.md`: `tests/importacao/rls-dedup-read.test.ts` (arquivo pré-existente, NÃO tocado por este plano) teve 4/9 casos falhando com `Request rate limit reached`. Sem relação com o código deste plano — as 24 outras suítes do diretório (195/199 testes) passaram, incluindo as 3 novas/estendidas deste plano.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Este plano não toca banco/migrations — só a camada de tela sobre as Server Actions já publicadas pelo plano 19-03.

## Next Phase Readiness

- IMP-03 completo — o requisito só dependia deste plano (a camada de tela), e a verificação humana confirmou os cinco critérios de sucesso da Fase 19 nos olhos do dono do projeto.
- **Fase 19 completa (3/3 → 4/4 plans) e marco v1.4 (CNPJ Obrigatório no Ganho) completo** — Fases 18 e 19 eram as duas únicas do marco.
- Nenhum bloqueio técnico para o próximo marco.

---
*Phase: 19-planilhas-de-cnpj-e-nome-fantasia*
*Completed: 2026-08-14*

## Self-Check: PASSED

- FOUND: `components/importacao/CnpjPreviewTable.tsx`
- FOUND: `components/importacao/CnpjImportSummary.tsx`
- FOUND: `components/importacao/CnpjImportWizard.tsx`
- FOUND: `app/(app)/clientes/importar-cnpj/page.tsx`
- FOUND: `tests/importacao/cnpj-preview-table.test.tsx`
- FOUND: `tests/importacao/cnpj-import-summary.test.tsx`
- FOUND: commit `260c454` (Task 1 RED)
- FOUND: commit `70cf285` (Task 1 GREEN)
- FOUND: commit `93beec8` (Task 2)
