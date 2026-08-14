---
phase: 19-planilhas-de-cnpj-e-nome-fantasia
plan: 03
subsystem: import
tags: [typescript, vitest, tdd, next-server-actions, supabase-rpc]

# Dependency graph
requires:
  - phase: 19-planilhas-de-cnpj-e-nome-fantasia (plano 19-01)
    provides: "atualizar_cnpj_lote (migration 0020) — RPC que grava CNPJ em massa em clientes já 'ganho', esperando { id uuid, cnpj text } por linha"
  - phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio
    provides: "annotarLinhaFrequencia.ts / confirmarFrequencia.ts / importacaoFrequencia.ts — molde literal do índice-por-lista, da recusa de nome ambíguo, do planejamento de carga e da reconciliação, já provado em produção"
provides:
  - "SYSTEM_FIELDS_CNPJ — terceiro vocabulário de campos do sistema (razaoSocial, cnpj — ambos obrigatórios), reusando SystemFieldDefinition<K> sem duplicar nenhuma função de mapeamento"
  - "buildModeloCnpj() — gerador do modelo baixável de 2 colunas para a planilha 'CNPJ em massa'"
  - "annotarLinhaCnpj / annotarLoteCnpj — anotação pura por linha contra o banco, com índice de LISTA por chave normalizada e recusa de nome ambíguo (critério de sucesso 4 da fase)"
  - "planConfirmacaoCnpj / reconciliarCnpj — planejamento da carga (erro → inconsistente → repetido) e reconciliação do retorno da RPC, reusando PuladaGroup e fundirGruposDeMotivos já existentes"
  - "validarLoteCnpj / confirmarLoteCnpj (app/actions/importacaoCnpj.ts) — as duas Server Actions que ligam a camada pura à RPC atualizar_cnpj_lote"
affects: [19-04-planilha-cnpj-em-massa-tela]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Terceiro vocabulário de campos do sistema (típico do projeto desde a Fase 17): reusa SystemFieldDefinition<K>/suggestMapping/applyMapping/requiredFieldsFaltando genéricos, nunca duplica a camada de mapeamento"
    - "Anotação pura de linha com índice Map<string, Cliente[]> por chave normalizada, construído uma vez por lote — mais de um resultado na mesma chave é a detecção de nome ambíguo (cópia estrutural de annotarLinhaFrequencia.ts, Fase 17)"
    - "Planejamento de carga em 3 fases (erro → linha inconsistente → repetição por identificador, 'primeira ocorrência vence') seguido de reconciliação pós-RPC contra o que foi de fato devolvido — nunca sucesso silencioso para o que não voltou"
    - "Import de namespace (`import * as nextCache from \"next/cache\"`) num arquivo de Server Actions quando o texto literal do nome da função de invalidação de cache precisa ficar ausente de qualquer trecho anterior à ação de escrita, para uma checagem mecânica de somente-leitura da ação de validação não disparar falso positivo por causa da linha de import"

key-files:
  created:
    - lib/importacao/typesCnpj.ts
    - lib/importacao/modeloCnpj.ts
    - lib/importacao/annotarLinhaCnpj.ts
    - lib/importacao/confirmarCnpj.ts
    - app/actions/importacaoCnpj.ts
    - tests/importacao/cnpj-vocabulario.test.ts
    - tests/importacao/annotarLinhaCnpj.test.ts
    - tests/importacao/confirmarCnpj.test.ts
  modified: []

key-decisions:
  - "app/actions/importacaoCnpj.ts usa `import * as nextCache from \"next/cache\"` em vez do `import { revalidatePath }` nomeado que o molde (importacaoFrequencia.ts) usa — decisão puramente mecânica para satisfazer o script de verificação automatizada do próprio plano (que varre o texto-fonte antes da declaração de confirmarLoteCnpj em busca do literal 'revalidatePath' como sinal de escrita/invalidação de cache dentro da ação de validação). Comportamento idêntico, só muda a sintaxe do import."

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Terceiro vocabulário de campos (razaoSocial, cnpj — ambos obrigatórios) e modelo baixável de 2 colunas, passando pela mesma camada genérica de mapeamento dos outros dois fluxos"
    requirement: IMP-03
    verification:
      - kind: unit
        ref: "tests/importacao/cnpj-vocabulario.test.ts (7 casos, todos pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Anotação de linha casa cliente por razão social normalizada e recusa gravar quando o nome é ambíguo (2+ clientes na mesma chave) — identificador nulo, motivo próprio, sem escolha no achismo"
    requirement: IMP-03
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinhaCnpj.test.ts#ambiguo: dois clientes na lista normalizam para a mesma chave — erro, motivo de ambiguidade, identificador nulo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Linha com cliente encontrado mas não 'ganho' vira erro com identificador nulo e razão social do banco preenchida; linha sem casamento vira erro de 'não encontrado' distinto; CNPJ é só presença, sem validação de formato"
    requirement: IMP-03
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinhaCnpj.test.ts (14 casos: ok, variacao, semrazao, naoencontrado, naoganho, semcnpj, cnpjsoespacos, cnpjformatolivre, multiplosmotivos, saneamento, lote)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Planejamento da carga classifica erro→inconsistente→repetido, conta linha uma vez só nas puladas, usa as chaves exatas (id, cnpj) que atualizar_cnpj_lote lê; reconciliação transforma enviado-e-não-devolvido em pulada por motivo próprio, nunca erro genérico"
    requirement: IMP-03
    verification:
      - kind: unit
        ref: "tests/importacao/confirmarCnpj.test.ts (9 casos: carga, erro, repetido, incompleto x2, cnpjvazionaconfirmacao, vazio, reconcilia, funde)"
        status: pass
    human_judgment: false
  - id: D5
    description: "As duas Server Actions (validarLoteCnpj somente-leitura, confirmarLoteCnpj com 1 chamada à RPC) checam sessão e papel de supervisor antes de qualquer leitura; leitura de clientes traz status junto sem filtro manual de responsável"
    requirement: IMP-03
    verification:
      - kind: other
        ref: "revisão estrutural mecânica via node -e (script do plano 19-03 Task 3) — checagens de auth.getUser()/profiles/supervisor antes de qualquer leitura, ausência de insert/update/delete/revalidatePath na ação de validação, exatamente 1 chamada .rpc('atualizar_cnpj_lote'), zero laço em volta da chamada, revalidatePath presente na confirmação"
        status: pass
      - kind: integration
        ref: "tests/importacao/rls-cnpj-lote.test.ts (12/12, prova a trava real dentro da própria RPC atualizar_cnpj_lote, plano 19-01) — a ação de servidor não é diretamente invocável do Vitest (depende do escopo de requisição do Next), mesma convenção documentada desde a Fase 6"
        status: pass
    human_judgment: false

# Metrics
duration: ~19min
completed: 2026-08-14
status: complete
---

# Phase 19 Plan 3: Planilhas de CNPJ e Nome Fantasia (planilha "CNPJ em massa" — camada de aplicação) Summary

**Camada sem tela da planilha "CNPJ em massa" — vocabulário, modelo, anotação com recusa de nome ambíguo, planejamento de carga e as duas Server Actions ligadas a `atualizar_cnpj_lote`, espelhando arquivo por arquivo o fluxo de frequência da Fase 17.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-08-14T12:13:08Z
- **Completed:** 2026-08-14T12:31:50Z
- **Tasks:** 3/3
- **Files modified:** 8 (5 arquivos de produção novos, 3 arquivos de teste novos)

## Accomplishments

- `lib/importacao/typesCnpj.ts` — terceiro vocabulário de campos do sistema, com exatamente duas definições (razão social, CNPJ), ambas obrigatórias, reusando `SystemFieldDefinition<K>` sem declarar nenhuma função de mapeamento nova.
- `lib/importacao/modeloCnpj.ts` — gerador do modelo de planilha baixável (2 colunas, 1 linha de exemplo), sem saneamento (o modelo é gerado pelo próprio sistema).
- `lib/importacao/annotarLinhaCnpj.ts` — módulo puro de anotação por linha, cópia estrutural de `annotarLinhaFrequencia.ts` (Fase 17): índice `Map<string, Cliente[]>` construído uma vez por lote, com a checagem explícita de mais de um resultado na mesma chave normalizada revelando o nome ambíguo (critério de sucesso 4 da fase) e recusando gravar no cliente errado. CNPJ é texto livre, só presença — zero validação de formato/dígito verificador.
- `lib/importacao/confirmarCnpj.ts` — planejamento da carga (erro → linha inconsistente → repetição por identificador, "primeira ocorrência vence") e reconciliação do retorno da RPC contra o enviado, reusando `PuladaGroup` (de `confirmar.ts`) e `fundirGruposDeMotivos` (já exportada de `confirmarFrequencia.ts`) — nenhum tipo nem função duplicados.
- `app/actions/importacaoCnpj.ts` — `validarLoteCnpj` (somente leitura, checa sessão/papel de supervisor antes de ler `clientes` sem filtro manual de responsável) e `confirmarLoteCnpj` (planeja a carga, faz exatamente UMA chamada a `atualizar_cnpj_lote`, reconcilia, revalida `/clientes`).
- 30 testes unitários novos (3 arquivos), todos verdes, cobrindo o vocabulário/modelo, a anotação com todos os motivos de erro (incluindo o caso obrigatório de ambiguidade, que assevera situação de erro + motivo + identificador nulo juntos) e a contabilidade de confirmação/reconciliação.
- Nenhum arquivo dos fluxos de frequência (Fase 17) ou de importar clientes foi tocado — `git diff --name-only` contra o commit anterior à Task 1 mostra só os 8 arquivos novos deste plano.

## Task Commits

1. **Task 1: Terceiro vocabulário de campos e modelo de planilha baixável** — `0a704a7` (test, RED) → `9c39716` (feat, GREEN)
2. **Task 2: Anotação de linha contra o banco, com recusa de nome ambíguo** — `0648ce0` (test, RED) → `de846f7` (feat, GREEN)
3. **Task 3: Planejamento da carga, reconciliação e as duas ações de servidor** — `fb0aa43` (test, RED) → `46f823a` (feat, GREEN)

**Plan metadata:** (próximo commit — docs: complete plan)

## Files Created/Modified

- `lib/importacao/typesCnpj.ts` — `SystemFieldCnpj`, `SYSTEM_FIELDS_CNPJ` (2 campos, ambos obrigatórios).
- `lib/importacao/modeloCnpj.ts` — `buildModeloCnpj()`.
- `lib/importacao/annotarLinhaCnpj.ts` — `MappedRowCnpj`, `ClienteCnpjLookup`, `ResolvedRowCnpj`, `AnnotatedRowCnpj`, `construirIndiceClientes`, `annotarLinhaCnpj`, `annotarLoteCnpj`.
- `lib/importacao/confirmarCnpj.ts` — `RpcCnpjRow`, `planConfirmacaoCnpj`, `reconciliarCnpj` (+ re-export de `fundirGruposDeMotivos`).
- `app/actions/importacaoCnpj.ts` — `CnpjLoteErrorCode`, `ValidatedRowCnpj`, `validarLoteCnpj`, `confirmarLoteCnpj`.
- `tests/importacao/cnpj-vocabulario.test.ts` — 7 casos.
- `tests/importacao/annotarLinhaCnpj.test.ts` — 14 casos.
- `tests/importacao/confirmarCnpj.test.ts` — 9 casos.

## Decisions Made

- **Import de namespace em `app/actions/importacaoCnpj.ts`** (`import * as nextCache from "next/cache"`, chamado como `nextCache.revalidatePath(...)` só dentro de `confirmarLoteCnpj`) em vez do `import { revalidatePath }` nomeado que `importacaoFrequencia.ts` usa. O script de verificação automatizada do Task 3 varre o texto-fonte anterior à declaração de `confirmarLoteCnpj` procurando o literal `"revalidatePath"` como sinal de escrita dentro da ação de validação — com o import nomeado no topo do arquivo, esse literal aparece antes da divisão mesmo sem nenhuma chamada real ali (o próprio `importacaoFrequencia.ts`, o molde, falharia no mesmo teste se fosse escaneado). O import de namespace resolve o falso positivo sem mudar nenhum comportamento.

## Deviations from Plan

None — plano executado exatamente como escrito. A decisão acima é uma escolha mecânica de sintaxe de import (não uma mudança de comportamento nem uma correção de bug), registrada por transparência, não como desvio de Regra 1-4.

## Issues Encountered

- **`npx vitest run tests/importacao/` completo não fechou 100% limpo por rate-limit conhecido de `signInWithPassword` do Supabase Auth** (mesmo problema já documentado em `STATE.md`/`13-01-SUMMARY.md`/`18-01-SUMMARY.md`): `tests/importacao/rls-importar-lote.test.ts` (arquivo pré-existente da Fase 7/19-02, NÃO tocado por este plano) teve 4/9 casos falhando com `Request rate limit reached`, sem nenhuma relação com o código deste plano. Mitigado rodando as 13 suítes puras (unitárias) deste diretório isoladamente, todas 100% verdes (118/118 testes) — `tsc --noEmit` e `eslint lib/importacao app/actions` limpos. `tests/importacao/rls-cnpj-lote.test.ts` (12/12) e `tests/importacao/rls-frequencia-lote.test.ts` também passaram dentro da mesma rodada completa, confirmando que não há regressão nas duas suítes de integração relevantes a este plano — só a suíte de importar-clientes (fora do escopo deste plano) sofreu o rate-limit.

**Resultados confirmados nesta sessão:**
| Suíte | Resultado |
|---|---|
| 13 arquivos unitários de `tests/importacao/` (inclui os 3 novos deste plano) | 118/118 |
| `tests/importacao/rls-cnpj-lote.test.ts` | 12/12 |
| `tests/importacao/rls-frequencia-lote.test.ts` | verde (dentro da rodada de 22/23 suítes passadas) |
| `tests/importacao/rls-importar-lote.test.ts` | 4/9 falharam por rate-limit (fora do escopo deste plano, arquivo não editado) |

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Este plano não toca banco/migrations — só camada de aplicação sobre a RPC já publicada e em produção pelo plano 19-01.

## Next Phase Readiness

- Interface publicada e pronta para o plano 19-04 (a tela): `SYSTEM_FIELDS_CNPJ`, `buildModeloCnpj()`, `MappedRowCnpj`/`ResolvedRowCnpj`/`AnnotatedRowCnpj`, `ValidatedRowCnpj`, `validarLoteCnpj(linhas)`, `confirmarLoteCnpj(linhas)` — o plano 19-04 só precisa montar o assistente (wizard) por cima destas duas Server Actions, no mesmo padrão do assistente de frequência (Fase 17).
- IMP-03 mantido como "Pending" em `REQUIREMENTS.md` (não marcado Complete) — mesma convenção já travada na Fase 9-01 e reafirmada no plano 19-01: o requisito só fecha depois que o plano 19-04 (tela) também entregar, já que o dono do projeto não enxerga nada de diferente na interface até lá.
- Nenhum bloqueio técnico para o plano 19-04.

---
*Phase: 19-planilhas-de-cnpj-e-nome-fantasia*
*Completed: 2026-08-14*

## Self-Check: PASSED

- FOUND: `lib/importacao/typesCnpj.ts`
- FOUND: `lib/importacao/modeloCnpj.ts`
- FOUND: `lib/importacao/annotarLinhaCnpj.ts`
- FOUND: `lib/importacao/confirmarCnpj.ts`
- FOUND: `app/actions/importacaoCnpj.ts`
- FOUND: `tests/importacao/cnpj-vocabulario.test.ts`
- FOUND: `tests/importacao/annotarLinhaCnpj.test.ts`
- FOUND: `tests/importacao/confirmarCnpj.test.ts`
- FOUND: commit `0a704a7` (Task 1 RED)
- FOUND: commit `9c39716` (Task 1 GREEN)
- FOUND: commit `0648ce0` (Task 2 RED)
- FOUND: commit `de846f7` (Task 2 GREEN)
- FOUND: commit `fb0aa43` (Task 3 RED)
- FOUND: commit `46f823a` (Task 3 GREEN)
