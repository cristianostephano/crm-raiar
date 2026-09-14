---
phase: quick-260914-ng5
verified: 2026-09-14T17:20:00Z
status: human_needed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Abrir o Kanban em produção/staging e conferir a contagem na etapa '1ª venda concluída'"
    expected: "Mostra 1752 (ou o total real atual de clientes ganhos/primeira_venda), não mais '571'"
    why_human: "Depende do banco de produção ter de fato >1000 linhas na tabela `clientes` — não há ambiente local com esse volume de dados para reproduzir o truncamento real do PostgREST; o próprio plano (item 4 de <verification>) já lista isso como verificação manual não bloqueante"
  - test: "Abrir a Agenda em produção/staging e conferir a contagem em 'Sem dia fixo definido'"
    expected: "Mostra ~1752 (o total real), não mais o teto artificial '(1000)'"
    why_human: "Mesma razão do item acima — comportamento só observável contra o banco de produção real"
---

# Quick Task 260914-ng5: Bug de escala na tabela `clientes` (paginação PostgREST) Verification Report

**Task Goal:** Corrigir o corte de 1000 linhas do PostgREST em 5 pontos que leem a tabela `clientes` sem paginação — getClientesAgrupadosPorEtapa (Kanban), getClientesSemDiaFixo (Agenda), checagem de duplicado x2 em importacao.ts, checagem de duplicado x2 em importacaoAtivos.ts, e getClientesParaExportacao (só caminho sem ids). Reaproveita o padrão já existente em getTodasCidades() via um paginador genérico `buscarPaginado`.

**Verified:** 2026-09-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Kanban mostra contagem real via `getClientesAgrupadosPorEtapa` paginado (não mais truncado em 1000) | ✓ VERIFIED | `lib/supabase/queries/clientes.ts:264-289` — chamada a `buscarPaginado<ClienteRow>` com `.order("posicao").order("id")` + `.range()`; lança erro se `buscarPaginado` devolver `null` (nunca lista parcial). Lógica de paginação em si provada com dataset simulado de 2181 itens (mesmo total real citado no plano) em `tests/clientes/paginacao.test.ts`. Contagem exata de produção (1752) é comportamento runtime — ver item de verificação humana |
| 2 | Agenda "Sem dia fixo" mostra contagem real via `getClientesSemDiaFixo` paginado | ✓ VERIFIED | `lib/supabase/queries/agenda.ts:182-217` — `buscarPaginado<ClienteSemDiaFixoRow>` com `.order("razao_social").order("id")` + `.range()`. Testes de integração que exercitam esta função (`tests/agenda/agenda-list.test.tsx`, `tests/agenda/agenda-calendario-integracao.test.tsx`) passam: 20/20 |
| 3 | Checagem de duplicado das 2 telas de importação compara contra TODOS os clientes cadastrados (4 pontos de leitura) | ✓ VERIFIED | `app/actions/importacao.ts:62-85` (`buscarClientesExistentesParaDedupe`, usada em `validarLoteImportacao` linha 149 e `confirmarLoteImportacao` linha 326) e `app/actions/importacaoAtivos.ts:62-85` (`buscarClientesExistentesCnpjParaDedupe`, usada em `validarLoteAtivos` linha 135 e `confirmarLoteAtivos` linha 262) — 4/4 pontos confirmados, todos via `buscarPaginado` com `.order("id")` |
| 4 | Exportação sem ids devolve todos os clientes; caminho com ids continua sem paginação | ✓ VERIFIED | `lib/supabase/queries/clientes.ts:436-482` — caminho `ids && ids.length > 0` intacto (`.in("id", ids)`, sem `.range()`, linhas 443-456); caminho sem ids usa `buscarPaginado` com `.order("id")` (linhas 457-482) |
| 5 | Nenhuma assinatura pública, formato de retorno ou postura de RLS muda | ✓ VERIFIED | Todas as 5 funções mantêm assinatura (`Promise<ClientesAgrupadosPorEtapa>`, `Promise<ClienteSemDiaFixo[]>`, `Promise<ClienteExportRow[]>`, `ValidateLoteResult`/`ConfirmarLoteResult`, `ValidarLoteAtivosResult`/`ConfirmarLoteAtivosResult`) e mensagens de erro-base idênticas às anteriores; nenhuma linha de checagem de `is_supervisor`/sessão foi movida ou alterada |
| 6 | Nenhuma leitura falhando no meio do caminho devolve lista parcial disfarçada de completa | ✓ VERIFIED | `buscarPaginado` devolve `null` em qualquer erro de página (`lib/supabase/queries/paginacao.ts:70`) ou quando o teto de páginas é atingido sem página curta (linha 80); testado explicitamente em 2 dos 7 casos de `tests/clientes/paginacao.test.ts` ("erro → null" e "teto de páginas sem página curta → null"); todos os 5 call sites tratam `null` lançando exceção (nunca seguem em frente com lista vazia como se fosse completa) |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/supabase/queries/paginacao.ts` | Paginador genérico `buscarPaginado` + `TAMANHO_PAGINA_PADRAO` + `MAX_PAGINAS_PADRAO` | ✓ VERIFIED | Existe, exporta os 3 símbolos, laço `for` idêntico ao padrão de `getTodasCidades`, cabeçalho de comentário explica o bug e o padrão espelhado |
| `tests/clientes/paginacao.test.ts` | 6+ testes de unidade cobrindo os comportamentos do `<behavior>` | ✓ VERIFIED | 7 testes, todos passando (`npx vitest run` confirmado nesta verificação: 7 passed) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/supabase/queries/clientes.ts` (2 funções) | `buscarPaginado` | import + chamada | ✓ WIRED | 3 ocorrências de `buscarPaginado` no arquivo (1 import + 2 chamadas), 4 ocorrências de `.order("id"` |
| `lib/supabase/queries/agenda.ts` | `buscarPaginado` | import + chamada | ✓ WIRED | 2 ocorrências (1 import + 1 chamada), 2 `.order("id"` (uma é comentário, uma é código) |
| `app/actions/importacao.ts` | `buscarPaginado` via `buscarClientesExistentesParaDedupe` | import + wrapper local reusado 2x | ✓ WIRED | 2 ocorrências de `buscarPaginado`; texto de seleção `"razao_social, nome_fantasia, cnpj"` aparece exatamente 1 vez (centralizado no wrapper, não duplicado nos 2 call sites) |
| `app/actions/importacaoAtivos.ts` | `buscarPaginado` via `buscarClientesExistentesCnpjParaDedupe` | import + wrapper local reusado 2x | ✓ WIRED | 2 ocorrências de `buscarPaginado`; texto de seleção `"razao_social, cnpj"` aparece exatamente 1 vez |
| `getClientesParaExportacao` caminho com `ids` | `.in("id", ids)` (sem paginação) | inalterado | ✓ WIRED | Confirmado presente e sem `.range()` nas linhas 443-456 |
| Nenhum dos 5 call sites reimplementa o laço `.range()` na mão | `buscarPaginado` é a única implementação do laço | grep negativo | ✓ VERIFIED | Nenhuma ocorrência de um laço `for`/`.range()` manual fora de `paginacao.ts` e `cidades.ts` (a referência intocada) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Paginador une múltiplas páginas / para corretamente / propaga erro como `null` / respeita teto de páginas | `npx vitest run tests/clientes/paginacao.test.ts` | 7/7 passed | ✓ PASS |
| Compilação TypeScript sem erro após as 4 mudanças de aplicação | `npx tsc --noEmit` | Saída vazia (sucesso) | ✓ PASS |
| `getClientesSemDiaFixo` (Agenda) segue funcionando corretamente sob teste de integração | `npx vitest run tests/agenda/agenda-list.test.tsx tests/agenda/agenda-calendario-integracao.test.tsx` | 20/20 passed | ✓ PASS |
| Suítes RLS de exportação/importação (best-effort, per item 3 de `<verification>` do plano) | `npx vitest run tests/clientes/rls-exportacao.test.ts` | 8 failed / 1 passed — `signInAs(...) failed: Invalid login credentials` | ? SKIP (limitação de ambiente pré-existente, não regressão — ver abaixo) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | Nenhum `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` encontrado nos 6 arquivos tocados pela fase (o único match de "TODO" em `clientes.ts:110` é a palavra portuguesa "todo cliente", não um marcador de dívida) | — | Nenhum |

### Requirements Coverage

Não aplicável — quick task sem `.planning/REQUIREMENTS.md` (convenção do projeto para tarefas rápidas via `/gsd-quick`).

### Human Verification Required

### 1. Contagem real do Kanban em produção/staging

**Test:** Abrir o quadro Kanban logado como Supervisor e olhar a coluna "1ª venda concluída"
**Expected:** Mostra 1752 (ou o total real atual de clientes com `status_acompanhamento = 'ganho'` e `etapa = 'primeira_venda'`), nunca mais "571"
**Why human:** O comportamento de truncamento do PostgREST só se manifesta contra o banco de produção real, que tem mais de 1000 linhas na tabela `clientes` — nenhum ambiente de teste local disponível reproduz esse volume. A lógica de paginação em si já está provada por testes de unidade com um dataset simulado de 2181 itens (o mesmo número citado no plano), mas a contagem exata em produção é uma verificação de comportamento observável, não de código. O próprio plano já lista isso como item 4 de `<verification>`, "não bloqueante"

### 2. Contagem real da Agenda em produção/staging

**Test:** Abrir a Agenda e olhar a seção "Sem dia fixo definido"
**Expected:** Mostra ~1752 (o total real), nunca mais o teto artificial "(1000)"
**Why human:** Mesma razão do item acima — comportamento só observável contra o banco de produção real

### Gaps Summary

Nenhum gap encontrado. As 6 truths do must_haves, os 2 artefatos, e os 6 key links do plano foram verificados diretamente no código (não apenas na narrativa da SUMMARY):

- `lib/supabase/queries/paginacao.ts` existe e implementa exatamente o laço descrito no plano, espelhando `getTodasCidades` de forma genérica.
- `tests/clientes/paginacao.test.ts` roda 7/7 verde, cobrindo os 6 comportamentos exigidos (união de páginas, parada em página curta, múltiplo exato, erro→null, lista vazia, teto de páginas→null) mais um caso extra de opções customizadas.
- Os 5 pontos de leitura (Kanban, Agenda, exportação sem ids, e as 4 checagens de duplicado das 2 importações) foram lidos linha a linha e confirmados usando `buscarPaginado` com `.order("id", ...)` como desempate — nenhum reimplementa o laço de paginação na mão.
- O caminho `.in("id", ids)` de `getClientesParaExportacao` permanece intacto, sem `.range()`.
- `npx tsc --noEmit` (rodado nesta verificação, não apenas citado na SUMMARY) compila sem nenhum erro.
- `npx vitest run tests/clientes/paginacao.test.ts` (rodado nesta verificação) passa 7/7.
- As falhas em `tests/clientes/rls-exportacao.test.ts` (e, por extensão, as demais suítes RLS de importação citadas na SUMMARY) foram confirmadas como causadas por `signInAs(...) failed: Invalid login credentials` — uma limitação de ambiente já documentada em `.planning/STATE.md` (linha 338: contas seed `vendedor.a+test@raiar.local`/`vendedor.b+test@raiar.local` foram deliberadamente apagadas na quick task 260819-l6o, decisão de recriação ainda em aberto desde 2026-08-19). Não é uma regressão introduzida por esta fase.

O único item que não pôde ser confirmado programaticamente é a contagem exata em produção (1752/~1752), porque depende do volume real do banco vivo — o próprio plano já classificou essa checagem como manual e não bloqueante. Por isso o status desta verificação é `human_needed` em vez de `passed`: todo o código e todos os testes automatizados confirmam a correção, mas o "prova final" de que o Kanban e a Agenda realmente exibem os números corretos em produção exige uma checagem visual humana.

---

_Verified: 2026-09-14T17:20:00Z_
_Verifier: Claude (gsd-verifier)_
