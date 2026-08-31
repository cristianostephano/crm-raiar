---
phase: quick
plan: 01
subsystem: infra
tags: [nextjs, server-actions, config, importacao]

requires: []
provides:
  - "next.config.ts com experimental.serverActions.bodySizeLimit configurado em 10mb, com comentário explicando causa raiz e teto real de produção"
affects: [importacao-ativos, importacao-prospeccao]

tech-stack:
  added: []
  patterns:
    - "Config comment pattern: ao aumentar limites de infraestrutura do Next.js, documentar no próprio arquivo o motivo (payload real) e o teto físico real (limite da plataforma de deploy), para prevenir que alguém suba o valor além do necessário no futuro"

key-files:
  created: []
  modified:
    - "next.config.ts"

key-decisions:
  - "bodySizeLimit definido como \"10mb\" — folga confortável acima do lote real testado (1909 linhas) e ainda abaixo do teto de payload de Serverless Function da Vercel (~4.5MB), então nunca seria o gargalo em produção"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "next.config.ts define experimental.serverActions.bodySizeLimit acima do default de 1MB do Next.js, corrigindo o erro de limite de corpo ao confirmar importação de planilhas grandes"
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Mudança de configuração pura, sem teste automatizado dedicado (conforme instrução do usuário/plano). A confirmação final de que o erro de 1MB não ocorre mais requer reimportar a planilha real de ~1909 linhas pela UI — passo manual opcional descrito no plano."

duration: 5min
completed: 2026-08-31
status: complete
---

# Quick Task 260831-oax: Corrigir limite de payload das Server Actions de importação Summary

**next.config.ts agora define `experimental.serverActions.bodySizeLimit: "10mb"`, corrigindo o erro "Body exceeded 1 MB limit" ao confirmar importação de planilhas grandes de Clientes Ativos**

## Performance

- **Duration:** ~5 min
- **Tasks:** 1 completada
- **Files modified:** 1

## Accomplishments
- `next.config.ts` passa a configurar `experimental.serverActions.bodySizeLimit: "10mb"`, acima do default de 1MB do Next.js
- Comentário no próprio arquivo explica a causa raiz (o lote inteiro de linhas da planilha vai como argumento das Server Actions `validarLoteAtivos`/`confirmarLoteAtivos` e `validarLoteImportacao`/`confirmarLoteImportacao`) e o teto real de produção (limite de payload de Serverless Function da Vercel, ~4.5MB) — para que ninguém suba o valor além do necessário no futuro achando que resolveria algo em produção

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Configurar bodySizeLimit das Server Actions em next.config.ts** - `28432cc` (fix)

## Files Created/Modified
- `next.config.ts` - Adiciona bloco `experimental.serverActions.bodySizeLimit: "10mb"` com comentário explicativo da causa raiz e do teto de produção

## Decisions Made
- Valor escolhido: `"10mb"` (string, forma legível do tipo `SizeLimit` do Next.js) — confortavelmente acima do lote real testado (1909 linhas) e abaixo do teto físico de payload de Serverless Function da Vercel (~4.5MB), então o limite de produção continua sendo a plataforma, não este arquivo

## Deviations from Plan

None - plano executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required
None - mudança isolada a `next.config.ts`, sem configuração externa necessária.

## Next Phase Readiness
- Correção pronta para verificação manual opcional: reimportar a planilha real de ~1909 linhas de "Clientes Ativos" pela UI e confirmar que a tela de confirmação não retorna mais o erro de limite de corpo da requisição.
- Nenhuma mudança em `app/actions/importacaoAtivos.ts` ou `app/actions/importacao.ts` — conforme exigido pelo critério de sucesso do plano.

---
*Phase: quick (260831-oax)*
*Completed: 2026-08-31*

## Self-Check: PASSED
- FOUND: next.config.ts
- FOUND: .planning/quick/260831-oax-bug-server-action-de-importacao-de-clien/260831-oax-SUMMARY.md
- FOUND: commit 28432cc
