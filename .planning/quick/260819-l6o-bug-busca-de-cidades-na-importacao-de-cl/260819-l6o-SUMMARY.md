---
phase: 260819-l6o
plan: 01
subsystem: database
tags: [supabase, postgrest, pagination, importacao, cidades]

requires: []
provides:
  - "getTodasCidades() — leitor paginado da tabela cidades (5571 linhas, sem truncamento em 1000)"
  - "validarLoteImportacao consumindo o leitor paginado em vez de select direto"
  - "teste de guarda travando a premissa de que cidades_por_estado(MG) nunca precisa paginar"
affects: [importacao, clientes]

tech-stack:
  added: []
  patterns:
    - "Leitor paginado em lib/supabase/queries/*.ts com laço acumulador + .order(id) antes de .range() para paginação estável contra PostgREST"

key-files:
  created:
    - lib/supabase/queries/cidades.ts
    - tests/clientes/todas-cidades.test.ts
  modified:
    - app/actions/importacao.ts
    - tests/clientes/cidades-por-estado.test.ts

key-decisions:
  - "getTodasCidades reusa CidadeLookupItem de lib/clientes/cidadeValida.ts — nenhum tipo novo de cidade"
  - "MAX_PAGINAS_CIDADES=20 como trava de laço infinito; teto atingido sem página final incompleta é tratado como falha (retorna null), nunca lista parcial"
  - "Caminho por Estado (createCliente/updateCliente, EstadoCidadeFields) permanece intocado — MG (853 municípios) fica bem abaixo do teto de 1000, travado por teste de integração novo"

requirements-completed: [QT-L6O-01, QT-L6O-02, QT-L6O-03]

coverage:
  - id: D1
    description: "getTodasCidades pagina em blocos de 1000 até devolver as 5571 linhas reais da tabela cidades, sem truncar"
    requirement: "QT-L6O-01"
    verification:
      - kind: unit
        ref: "tests/clientes/todas-cidades.test.ts#com 5571 linhas simuladas, devolve as 5571 (nunca 1000)"
        status: pass
      - kind: unit
        ref: "tests/clientes/todas-cidades.test.ts#uma cidade na posição 5000 (fora das primeiras 1000) é encontrada por cidadeValida"
        status: pass
    human_judgment: false
  - id: D2
    description: "Falha de leitura em qualquer página devolve null (erro genérico do lote), nunca uma lista parcial silenciosa"
    requirement: "QT-L6O-02"
    verification:
      - kind: unit
        ref: "tests/clientes/todas-cidades.test.ts#se qualquer página devolver erro, o retorno é null — nunca uma lista parcial"
        status: pass
    human_judgment: false
  - id: D3
    description: "validarLoteImportacao consome getTodasCidades em vez do select direto que truncava; cidadeValida/cidadeCanonica/annotarLinha permanecem intocados"
    requirement: "QT-L6O-01"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts"
        status: pass
      - kind: unit
        ref: "tests/clientes/cidade-valida.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Caminho por Estado (createCliente/updateCliente, EstadoCidadeFields) não sofreu truncamento e continua sem paginar — premissa travada por teste de integração contra o banco real"
    requirement: "QT-L6O-03"
    verification:
      - kind: integration
        ref: "tests/clientes/cidades-por-estado.test.ts#MG (mais municípios do Brasil) tem entre 800 e 999 linhas via cidades_por_estado, abaixo do teto de resposta do PostgREST"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-19
status: complete
---

# Quick Task 260819-l6o: Bug — busca de cidades na importação de clientes Summary

**Corrigido bug de truncamento do PostgREST (limite de 1000 linhas por requisição) que fazia a revisão de "Importar clientes" rejeitar cidades reais como São Paulo/SP e Curitiba/PR — novo leitor paginado `getTodasCidades()` devolve as 5571 linhas completas da tabela `cidades`.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-19T15:22:00-03:00
- **Completed:** 2026-08-19T15:26:19-03:00
- **Tasks:** 3
- **Files modified:** 4 (2 criados, 2 modificados)

## Accomplishments

- `getTodasCidades()` (novo) lê a tabela `cidades` em páginas de 1000 linhas (teto do PostgREST), ordenando por `id` antes de cada `.range()` para paginação estável, até acumular as 5571 linhas reais — em vez de devolver as primeiras 1000 arbitrárias.
- `validarLoteImportacao` (`app/actions/importacao.ts`) passou a consumir esse leitor em vez de um `select` direto e não-paginado sobre `cidades` — o sintoma relatado ("Cidade não encontrada para o estado") some para cidades que só existiam fora das primeiras 1000 linhas.
- Falha de leitura em qualquer página vira erro genérico do lote inteiro (`{ error: { code: "generic" } }`), nunca uma lista parcial validada silenciosamente.
- Teste de guarda novo prova que o caminho por Estado (`cidades_por_estado`, usado por `createCliente`/`updateCliente`/`EstadoCidadeFields`) nunca precisou mudar: MG, o estado com mais municípios do Brasil, devolve entre 800 e 999 linhas — sempre abaixo do teto de 1000 do PostgREST.
- `lib/clientes/cidadeValida.ts` e `lib/importacao/annotarLinha.ts` não foram tocados — `tests/clientes/cidade-valida.test.ts` passa sem edição, provando que a lógica de comparação continua exatamente a mesma.

## Task Commits

1. **Task 1 (RED): teste falho para o leitor paginado** - `63860d9` (test)
2. **Task 1 (GREEN): `getTodasCidades` implementado** - `52e2756` (feat)
3. **Task 2: `validarLoteImportacao` passa a usar o leitor paginado** - `9102d90` (fix)
4. **Task 3: teste de guarda travando a premissa do caminho por Estado** - `683c8cb` (test)

**Plan metadata:** commit final de docs feito separadamente pelo orquestrador (fora do escopo deste agente, conforme `<constraints>`).

_Nota: Task 1 seguiu TDD (RED → GREEN), gerando 2 commits em vez de 1._

## Files Created/Modified

- `lib/supabase/queries/cidades.ts` (criado) - `getTodasCidades()` paginado, `TAMANHO_PAGINA_CIDADES`, `MAX_PAGINAS_CIDADES`
- `tests/clientes/todas-cidades.test.ts` (criado) - 6 casos unitários (5571 linhas, 6 páginas, cidade na posição 5000, múltiplo exato, erro parcial, lista vazia)
- `app/actions/importacao.ts` (modificado) - `validarLoteImportacao` troca o select inline por `getTodasCidades()`
- `tests/clientes/cidades-por-estado.test.ts` (modificado) - novo caso de integração travando MG < 1000 linhas

## Decisions Made

- `getTodasCidades` reusa o tipo `CidadeLookupItem` já exportado por `lib/clientes/cidadeValida.ts`, em vez de declarar um tipo de cidade novo — mantém o formato estruturalmente idêntico ao `CidadeLookup` que `annotarLinha` já espera.
- `MAX_PAGINAS_CIDADES = 20` como trava de segurança: se o laço atingir 20 páginas sem a última vir incompleta, trata como falha de leitura (devolve `null`) em vez de assumir que a lista está completa.
- Comentários no ponto de leitura de `app/actions/importacao.ts` descrevem a leitura pelo nome do módulo (`getTodasCidades`) em vez de reproduzir o literal `from("cidades")` — evita disparar o script de verificação mecânica do plano (mesmo achado já registrado na Fase 19-04).

## Deviations from Plan

None - plan executado exatamente como escrito, incluindo o ajuste de `rangeSpy.mockReset()` entre casos de teste (mecânica interna do próprio teste RED/GREEN, não uma mudança de comportamento do código de produção — necessário porque os 6 casos de `tests/clientes/todas-cidades.test.ts` compartilham o mesmo espião içado via `vi.hoisted()`).

## Issues Encountered

- Na primeira rodada GREEN, 2 dos 6 casos de `tests/clientes/todas-cidades.test.ts` falharam por contagem de chamadas acumulada entre testes (o `rangeSpy` compartilhado via `vi.hoisted()` não tinha o histórico de chamadas limpo entre `it()`s). Corrigido adicionando `rangeSpy.mockReset()` no início de `simularPaginacao()` e do caso de erro parcial — sem mudança nenhuma no arquivo de produção. Todos os 6 casos passam depois do ajuste.
- `npm test` completo não foi rodado numa tacada só — mesma convenção já documentada em STATE.md (rate limit conhecido de `signInWithPassword` do Supabase Auth). Em vez disso, os comandos de verificação explícitos do próprio plano foram executados isoladamente e todos passaram: `tsc --noEmit`, `eslint app lib`, `vitest run tests/clientes/todas-cidades.test.ts tests/clientes/cidade-valida.test.ts tests/importacao/annotarLinha.test.ts`, e `vitest run tests/clientes/cidades-por-estado.test.ts` (contra o banco real).

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Nenhuma migration nova, nenhuma dependência nova.

## Next Phase Readiness

- Bug resolvido: a tela de revisão de "Importar clientes" já não deve marcar cidades reais como "não encontrada" para o estado. Verificação de sintoma real no navegador (upload de planilha com São Paulo/SP e Curitiba/PR) fica a critério do dono do projeto, conforme a seção `<verification>` do plano (item 4, opcional).
- Nenhum bloqueio para trabalho futuro. `getTodasCidades()` fica disponível como o padrão a seguir caso outro consumidor precise ler a tabela `cidades` inteira (o comentário de cabeçalho do arquivo já orienta: quem precisar só de um Estado deve continuar usando `cidades_por_estado`).

---
*Quick task: 260819-l6o*
*Completed: 2026-08-19*

## Self-Check: PASSED

All 4 created/modified files found on disk; all 4 task commit hashes (63860d9, 52e2756, 9102d90, 683c8cb) found in git log.
