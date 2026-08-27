---
phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu
plan: 02
subsystem: importacao
tags: [zod, vocabulario, dedupe, postgres-null-semantics]

# Dependency graph
requires:
  - phase: 23-raz-o-social-opcional-e-trava-do-ganho-ampliada
    provides: "razao_social nulavel em clientes (migration 0024) — pre-condicao para este plano tornar o campo opcional na importacao"
provides:
  - "SYSTEM_FIELDS/createImportRowSchema/annotarLinha concordando: nomeFantasia + responsavel sao os unicos obrigatorios da planilha de prospeccao (PROSP-02)"
  - "razaoSocial nula (nunca texto vazio) de ponta a ponta em ResolvedRow/RpcClienteRow (Bug A fechado)"
  - "findDuplicates tolerante a nulo + chave de reserva por Nome Fantasia (Bug B fechado)"
affects: [26-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chave de reserva com espaco de nomes explicito (RAZAO_SOCIAL_NAMESPACE/NOME_FANTASIA_NAMESPACE) para nunca colidir duas chaves normalizadas de origens diferentes"
    - "Padrao 'aparado ou nulo' (nunca texto vazio) para campo opcional que grava em coluna com restricao de unicidade"

key-files:
  created:
    - tests/importacao/prospeccao-vocabulario.test.ts
  modified:
    - lib/importacao/types.ts
    - lib/validations/importacao.ts
    - lib/importacao/annotarLinha.ts
    - lib/importacao/modelo.ts
    - lib/importacao/dedupe.ts
    - lib/importacao/confirmar.ts
    - lib/importacao/confirmarAtivo.ts
    - app/actions/importacao.ts
    - tests/importacao/mapping.test.ts
    - tests/importacao/annotarLinha.test.ts
    - tests/importacao/modelo.test.ts
    - tests/importacao/dedupe.test.ts
    - tests/importacao/confirmar.test.ts
    - tests/importacao/ativos-vocabulario.test.ts

key-decisions:
  - "razaoSocial trocou de required:true para required:false em SYSTEM_FIELDS; nomeFantasia trocou de required:false para required:true — as tres superficies (SYSTEM_FIELDS, createImportRowSchema, ramo literal de mensagens em annotarLinha) mudadas no mesmo commit (Task 1)"
  - "razaoSocial em ResolvedRow e razao_social em RpcClienteRow viraram string | null (nunca string vazia) seguindo o mesmo padrao ja usado por cnpj/nomeFantasia/cep/rua/numero neste arquivo"
  - "Chave de reserva de dedupe usa Nome Fantasia SOMENTE quando razao social normaliza para vazio, num espaco de nomes (namespace) separado do de razao social, para nunca colidir duas empresas cuja razao social de uma seja igual ao Nome Fantasia de outra"
  - "reconcileImportados conta linhas de razao social nula por PRESENCA no conjunto devolvido (nao por indice/consumo), porque nulos nunca conflitam na restricao de unicidade — toda linha nula enviada e sempre gravada, entao a garantia e por construcao, nao por contagem"
  - "Teste de naoregride pre-existente em ativos-vocabulario.test.ts (Fase 25) atualizado para esperar nomeFantasia+responsavel como obrigatorios de SYSTEM_FIELDS, acompanhando a mudanca intencional deste plano (Rule 1 — nao e uma regressao, e a mesma invariante de cardinalidade com a lista nova)"

requirements-completed: [PROSP-02, PROSP-03]

coverage:
  - id: D1
    description: "Linha so com Nome Fantasia + Responsavel e aceita (situacao ok, zero motivos); linha sem Nome Fantasia e recusada com frase propria mesmo com razao social preenchida"
    requirement: "PROSP-02"
    verification:
      - kind: automated
        ref: "tests/importacao/prospeccao-vocabulario.test.ts, tests/importacao/annotarLinha.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Razao social em branco/so espaco resolve para valor NULO (nunca texto vazio) em ResolvedRow e chega assim ate RpcClienteRow; conciliacao conta corretamente multiplas linhas nulas no mesmo lote (Bug A)"
    requirement: "PROSP-02"
    verification:
      - kind: automated
        ref: "tests/importacao/annotarLinha.test.ts, tests/importacao/confirmar.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "normalizeRazaoSocial tolera nulo/indefinido sem estourar; findDuplicates aceita nulos na lista de existentes e reconhece duas linhas sem razao social com o mesmo Nome Fantasia como possivel duplicado (Bug B + chave de reserva)"
    requirement: "PROSP-02"
    verification:
      - kind: automated
        ref: "tests/importacao/dedupe.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Modelo de planilha marca colunas obrigatorias com sufixo visivel e todo cabecalho gerado continua sendo remapeado automaticamente ao ser reenviado"
    requirement: "PROSP-02"
    verification:
      - kind: automated
        ref: "tests/importacao/modelo.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Instrucao de gravacao de importar_clientes_lote nao define etapa nem status_acompanhamento (cliente importado continua nascendo em Aguardando contato); nenhuma migration editada por este plano"
    requirement: "PROSP-03"
    verification:
      - kind: other
        ref: "sed -n '/insert into clientes/,/on conflict/p' supabase/migrations/0019_importar_clientes_lote_cnpj_nome_fantasia.sql | grep -ciE '\\betapa\\b|status_acompanhamento' -> 0; git diff --stat sem nenhuma migration"
        status: pass
    human_judgment: false

# Metrics
duration: ~30min
completed: 2026-08-27
status: complete
---

# Phase 26 Plan 2: Vocabulário da planilha de prospecção + Bugs A/B Summary

**A planilha de prospecção agora só exige Nome Fantasia e Responsável — razão social virou opcional e, quando ausente, resolve para valor NULO (nunca texto vazio) em toda a cadeia até a gravação, fechando os dois defeitos reais que uma implementação ingênua de PROSP-02 dispararia: falso positivo de duplicado (Bug A) e estouro da validação do lote inteiro assim que qualquer cliente do banco tiver razão social nula (Bug B).**

## Performance

- **Duration:** ~30min
- **Started:** 2026-08-27T02:00:00Z (aprox.)
- **Completed:** 2026-08-27T02:14:00Z
- **Tasks:** 3 (todas auto/tdd, sem checkpoint)
- **Files modified:** 14 (13 modificados + 1 criado)

## Accomplishments

- `SYSTEM_FIELDS`, `createImportRowSchema` e o ramo literal de mensagens de `annotarLinha.ts` trocados no mesmo commit: `nomeFantasia` + `responsavel` são agora os únicos campos obrigatórios da planilha de prospecção; `razaoSocial` virou opcional
- Novo teste `tests/importacao/prospeccao-vocabulario.test.ts` provando mecanicamente a invariante de obrigatoriedade, espelhando `ativos-vocabulario.test.ts` (Fase 25)
- `buildModeloImportacao` marca visualmente cada coluna obrigatória com o sufixo " *" (constante única, `REQUIRED_MARKER`), e um teste de ida-e-volta prova que todo cabeçalho gerado continua batendo com `suggestMapping`
- `normalizeRazaoSocial` tolera nulo/indefinido sem estourar (Bug B); `findDuplicates` ganhou um terceiro parâmetro opcional (`existentesNomesFantasia`) e uma chave de reserva por Nome Fantasia, em espaço de nomes separado do de razão social, reconhecendo duas linhas sem razão social e com o mesmo Nome Fantasia como possível duplicado uma da outra
- `ResolvedRow.razaoSocial` e `RpcClienteRow.razao_social` viraram nuláveis, seguindo o padrão "aparado ou nulo" já usado por cnpj/nomeFantasia/endereço; `planConfirmacao` passa a levar o Nome Fantasia de cada candidato para a revalidação D-02; `reconcileImportados` conta corretamente múltiplas linhas de razão social nula no mesmo lote (Bug A fechado)
- `confirmarAtivo.ts` e `app/actions/importacao.ts` ajustados só de tipo (sem mudança de comportamento) para acompanhar a nulabilidade nova
- Descoberto durante a verificação ampla (fora do escopo literal das tasks, mas causado diretamente pela Task 1): o teste de "não-regressão" pré-existente em `ativos-vocabulario.test.ts` (Fase 25) esperava a lista antiga de obrigatórios de `SYSTEM_FIELDS` — corrigido para esperar `nomeFantasia` + `responsavel`

## Task Commits

Each task was committed atomically:

1. **Task 1: Trocar a obrigatoriedade — Nome Fantasia entra, razão social sai** - `ec5018d` (feat)
2. **Task 2: Modelo de planilha marca obrigatórios + dedupe tolerante a nulo com chave de reserva** - `a402de7` (feat)
3. **Task 3: Razão social em branco vira valor nulo de ponta a ponta (Bug A)** - `5dc1eb7` (fix)
4. **Fix (Rule 1, descoberto na verificação ampla): invariante de naoregride em ativos-vocabulario.test.ts** - `f85991e` (fix)

**Plan metadata commit:** (a ser criado neste commit final)

## Files Created/Modified

- `lib/importacao/types.ts` - `SYSTEM_FIELDS`: `razaoSocial` vira opcional, `nomeFantasia` vira obrigatório
- `lib/validations/importacao.ts` - `createImportRowSchema`: acrescenta `nomeFantasia` obrigatório, `razaoSocial` vira opcional
- `lib/importacao/annotarLinha.ts` - ramo de mensagens trocado para `nomeFantasia`; `ResolvedRow.razaoSocial` nulável, resolução segue padrão "aparado ou nulo"
- `lib/importacao/modelo.ts` - cabeçalho de campo obrigatório ganha sufixo " *" (`REQUIRED_MARKER`)
- `lib/importacao/dedupe.ts` - `normalizeRazaoSocial` tolera nulo/indefinido; `findDuplicates` ganha chave de reserva por Nome Fantasia com namespace próprio
- `lib/importacao/confirmar.ts` - `RpcClienteRow.razao_social` nulável; `planConfirmacao` leva Nome Fantasia para a revalidação D-02; `reconcileImportados` conta múltiplas linhas nulas por presença
- `lib/importacao/confirmarAtivo.ts` - ajuste mínimo de tipo (queda para texto vazio ao registrar em `importados`)
- `app/actions/importacao.ts` - `ConfirmarLoteResult.importados[].razaoSocial` nulável; `returnedRazoes` tolera nulo
- `tests/importacao/prospeccao-vocabulario.test.ts` - novo, invariante mecânica do vocabulário
- `tests/importacao/mapping.test.ts` - casos de `requiredFieldsFaltando` ajustados para `nomeFantasia`
- `tests/importacao/annotarLinha.test.ts` - casos de obrigatoriedade invertidos/acrescentados + casos de razão social nula
- `tests/importacao/modelo.test.ts` - asserção de cabeçalho com marca + teste de ida-e-volta com `suggestMapping`
- `tests/importacao/dedupe.test.ts` - casos de nulo/indefinido + chave de reserva por Nome Fantasia
- `tests/importacao/confirmar.test.ts` - casos de múltiplas linhas de razão social nula em `planConfirmacao`/`reconcileImportados`
- `tests/importacao/ativos-vocabulario.test.ts` - invariante de naoregride atualizada (Rule 1, ver Deviations)

## Decisions Made

- As três superfícies independentes de obrigatoriedade (`SYSTEM_FIELDS`, `createImportRowSchema`, ramo literal de `annotarLinha`) foram trocadas no MESMO commit (Task 1) — mexer em uma sem as outras produziria uma tela que promete uma regra e um servidor que aplica outra (Pitfall 1 da pesquisa)
- Razão social nula e razão social em branco são a MESMA coisa para o usuário e coisas DIFERENTES para o Postgres — `ResolvedRow.razaoSocial`/`RpcClienteRow.razao_social` seguem o mesmo padrão "aparado ou nulo" já usado por cnpj/nomeFantasia/endereço, nunca texto vazio
- Chave de reserva de dedupe usa espaço de nomes explícito (`rs:`/`nf:`) para que uma razão social nunca colida com um Nome Fantasia de texto igual, de origem diferente
- `reconcileImportados` conta linhas nulas por presença no conjunto devolvido, não por índice/consumo — correto porque nulos nunca conflitam na restrição de unicidade, então toda linha nula enviada é sempre gravada (garantia por construção)
- Nenhuma migration tocada, nenhum arquivo do fluxo de clientes ativos (`typesAtivo.ts`, `annotarLinhaAtivo.ts`, `modeloAtivo.ts`) tocado — conferido mecanicamente no bloco de verificação do plano

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste de não-regressão pré-existente quebrado pela mudança intencional da Task 1**
- **Found during:** verificação ampla (`npx vitest run tests/importacao/`), fora das 4 suítes que as tasks listam explicitamente para verificação
- **Issue:** `tests/importacao/ativos-vocabulario.test.ts` (Fase 25) tinha um teste `naoregride` que esperava `SYSTEM_FIELDS` continuar com `razaoSocial` + `responsavel` como únicos obrigatórios — exatamente o par que a Task 1 deste plano muda de propósito para `nomeFantasia` + `responsavel`
- **Fix:** atualizada a lista esperada no teste para `["nomeFantasia", "responsavel"]`, com comentário explicando que a invariante de cardinalidade (2 obrigatórios) continua protegida, só a lista específica mudou
- **Files modified:** `tests/importacao/ativos-vocabulario.test.ts`
- **Commit:** `f85991e`

## Issues Encountered

Nenhum bloqueio. Os testes de integração ao vivo (`tests/importacao/rls-dedup-read.test.ts`, `tests/importacao/rls-importar-lote.test.ts`) falharam com `Invalid login credentials` ao rodar a suíte completa de `tests/importacao/` — confirmado como falha pré-existente e não-regressão: as contas semente (`vendedor.a+test@raiar.local`) estão apagadas do projeto de teste ao vivo, mesmo blocker já documentado em `.planning/STATE.md` antes deste plano começar. Nenhum arquivo tocado por este plano depende dessas contas; as 4 suítes que o plano pede para verificar isoladamente (`annotarLinha`, `confirmar`, `confirmarAtivo`, `dedupe`, `modelo`, `mapping`, `prospeccao-vocabulario`) são todas puras (sem Supabase) e passaram 100%.

## User Setup Required

Nenhuma configuração de serviço externo necessária. Este plano não instala pacotes, não toca em migrations e não requer nenhuma ação do dono do projeto.

## Next Phase Readiness

- A planilha de prospecção agora aceita o dado mínimo real do fluxo de negócio (Nome Fantasia + Responsável), sem os dois defeitos silenciosos que uma implementação ingênua criaria
- `findDuplicates` já expõe o terceiro parâmetro (`existentesNomesFantasia`) e a chave de reserva por Nome Fantasia que o plano 26-03 vai efetivamente conectar (passar a lista real de Nomes Fantasia existentes do banco para `validarLoteImportacao`/`confirmarLoteImportacao`) — este plano deixou a API pronta, sem quebrar as três chamadas existentes
- Nenhum bloqueio identificado para o plano 26-03

---
*Phase: 26-importa-o-de-clientes-em-prospec-o-e-limpeza-de-menu*
*Completed: 2026-08-27*

## Self-Check: PASSED

- FOUND: lib/importacao/types.ts
- FOUND: lib/validations/importacao.ts
- FOUND: lib/importacao/annotarLinha.ts
- FOUND: lib/importacao/modelo.ts
- FOUND: lib/importacao/dedupe.ts
- FOUND: lib/importacao/confirmar.ts
- FOUND: lib/importacao/confirmarAtivo.ts
- FOUND: app/actions/importacao.ts
- FOUND: tests/importacao/prospeccao-vocabulario.test.ts
- FOUND: tests/importacao/mapping.test.ts
- FOUND: tests/importacao/annotarLinha.test.ts
- FOUND: tests/importacao/modelo.test.ts
- FOUND: tests/importacao/dedupe.test.ts
- FOUND: tests/importacao/confirmar.test.ts
- FOUND: tests/importacao/ativos-vocabulario.test.ts
- FOUND commit: ec5018d
- FOUND commit: a402de7
- FOUND commit: 5dc1eb7
- FOUND commit: f85991e
