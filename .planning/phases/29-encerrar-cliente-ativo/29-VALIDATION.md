---
phase: 29
slug: encerrar-cliente-ativo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-26
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (já configurado; `tests/funil/` já existe desde a Fase 28) |
| **Config file** | `vitest.config.ts` (existente, sem mudança necessária) |
| **Quick run command** | `npx vitest run tests/funil/encerrados-rpc.test.ts tests/funil/reativar-guard.test.ts` |
| **Full suite command** | `npx vitest run tests/funil/` (mesma pasta usada por Perdidos — inclui o arquivo de integração real) |
| **Estimated runtime** | ~30-45s (integração contra Supabase real) |

---

## Sampling Rate

- **Per task commit:** `npx vitest run tests/funil/<arquivo-da-tarefa>`
- **Per plan wave:** `npx vitest run tests/funil/` completo
- **Phase gate:** Suite completa verde + `npx tsc --noEmit` + `npx eslint` antes de `/gsd-verify-work`

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-W0 | 01 | 0 | ENCR-01, ENCR-02 | — | ALTER TYPE isolado em migration própria | manual review | `git diff` da migration 0035 mostra só o ADD VALUE | ❌ W0 | ⬜ pending |
| 29-01-01 | 01 | 1 | ENCR-01, ENCR-02, ENCR-03 | T-29-01 | Sem security definer, RLS única fronteira | integration | `npx vitest run tests/funil/encerrados-rpc.test.ts` | ❌ W0 — novo | ⬜ pending |
| 29-02-01 | 02 | 1 | ENCR-05 | T-29-02 | Guard de frequência usa valor efetivo, não cru | unit + integration | `npx vitest run tests/funil/reativar-guard.test.ts` | ❌ W0 — novo | ⬜ pending |
| 29-02-02 | 02 | 1 | ENCR-04 | T-29-03 | Reativar/encerrar cliente alheio afeta 0 linhas | integration | `npx vitest run tests/funil/encerrados-rpc.test.ts` | ❌ W0 | ⬜ pending |
| 29-03-01 | 03 | 2 | ENCR-01, ENCR-04 | — | N/A | integration | mesmo arquivo de dados da fase (molde 28-03) | ❌ W0 | ⬜ pending |
| 29-04-01 | 04 | 3 | ENCR-01..05 | — | N/A | render/e2e-lite | testes de componente (molde 28-04) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/funil/encerrados-rpc.test.ts` — novo, molde `tests/funil/perdidos-rpc.test.ts`, cobrindo ENCR-01/02/03/04
- [ ] `tests/funil/reativar-guard.test.ts` — novo, cobre especificamente o Pitfall 1 (frequência efetiva) achado pela pesquisa
- [ ] Demais arquivos de teste da camada de dados e da tela seguem os moldes 1:1 já usados pela Fase 28 — nenhuma infraestrutura de teste nova necessária (`tests/helpers/supabase-test-clients.ts` já cobre fixtures descartáveis)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reativar um cliente encerrado sem frequência de visita nunca definida (cliente antigo, pré-Fase-13) | ENCR-05 (edge case) | Cenário de dado legado real, difícil de simular com certeza absoluta em fixture | Verificar manualmente com um cliente ganho antigo real (se existir na base) — confirmar que o erro acionável aparece em vez de quebrar silenciosamente |
| Visual da tela "Encerrados" em celular/tablet | ENCR-01/02 | Confirmação visual/toque em dispositivo real | Abrir o novo item de menu, conferir leitura e toque do botão "Reativar" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify ou dependência de Wave 0
- [ ] Sampling continuity: nenhum bloco de 3 tarefas seguidas sem verificação automatizada
- [ ] Wave 0 cobre todas as referências MISSING
- [ ] Sem flags de watch-mode
- [ ] Latência de feedback < 45s
- [ ] `nyquist_compliant: true` no frontmatter (pendente da distribuição de tarefas do planner)

**Approval:** pending
