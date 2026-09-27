---
phase: 30-ader-ncia-de-uso-no-dashboard
plan: 04
subsystem: auth
tags: [nextjs, middleware, server-actions, supabase-rpc, cookies, aderencia-de-uso]

requires:
  - phase: 30-ader-ncia-de-uso-no-dashboard (plano 30-01)
    provides: "RPC registrar_acesso_diario() (migration 0038, ainda não aplicada em produção)"
provides:
  - "lib/aderencia/registroDiario.ts: dia de São Paulo, marcador por cookie e chamada à RPC que nunca lança"
  - "updateSession() estendida: registra abertura de tela uma vez por dia por conta (D-01)"
  - "createCliente/updateCliente/atualizarFrequenciaVisita registrando o dia após sucesso (D-02/D-05)"
affects: [30-05, 30-06, 30-03]

tech-stack:
  added: []
  patterns:
    - "Cookie-gated idempotent daily marker: um cookie barato decide SE chama a RPC; quem decide QUAL dia é gravado é sempre o banco (nunca o navegador)"
    - "Registro best-effort piggyback numa Server Action já existente: aguardado, resultado sempre ignorado, nunca transforma sucesso em erro"

key-files:
  created:
    - lib/aderencia/registroDiario.ts
    - tests/aderencia/registro-diario.test.ts
    - tests/aderencia/middleware-registro.test.ts
    - tests/clientes/registro-acesso-cliente.test.ts
  modified:
    - lib/supabase/middleware.ts
    - app/actions/clientes.ts

key-decisions:
  - "Tipo estrutural mínimo (rpc: (nome) => PromiseLike<{error}>) em vez de importar SupabaseClient de @supabase/supabase-js -- compila sem any e é satisfeito estruturalmente pelo client real do @supabase/ssr"
  - "OPCOES_MARCADOR_ACESSO.maxAge = 48h (não 24h) -- o valor do cookie já carrega o dia; a validade só precisa ultrapassar um dia inteiro para o marcador de ontem parar de bater sozinho"

requirements-completed: []

coverage:
  - id: D1
    description: "Módulo lib/aderencia/registroDiario.ts calcula o dia de São Paulo, decide se precisa registrar por cookie, e chama a RPC sem nunca lançar"
    requirement: ADER-02
    verification:
      - kind: unit
        ref: "tests/aderencia/registro-diario.test.ts (13 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "updateSession() registra o dia de uso em toda abertura de tela autenticada, no máximo uma vez por dia por conta, sem nunca bloquear a requisição em caso de falha"
    requirement: ADER-02
    verification:
      - kind: unit
        ref: "tests/aderencia/middleware-registro.test.ts (8 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "createCliente, updateCliente e atualizarFrequenciaVisita registram o dia de uso após gravação bem-sucedida, sem nunca transformar sucesso em erro"
    requirement: ADER-02
    verification:
      - kind: unit
        ref: "tests/clientes/registro-acesso-cliente.test.ts (6 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A RPC registrar_acesso_diario() do plano 30-01 ainda não está aplicada em produção -- este plano só liga o app a ela, verificação de ponta a ponta contra o banco real fica para o plano 30-03/verificação da fase"
    verification: []
    human_judgment: true
    rationale: "Este plano é 100% testado com dublês por desenho (roda em paralelo com as migrations); a chamada real à RPC só passa a gravar depois do dono aplicar 0038/0039/0040 manualmente (plano 30-03). Confirmação de que o fluxo ponta a ponta funciona contra o banco real exige aquela aplicação, fora do escopo deste plano."

duration: 10min
completed: 2026-09-27
status: complete
---

# Phase 30 Plan 04: Registro de Acesso Diário (Middleware + Server Actions) Summary

**Cookie-gated middleware call + três Server Actions de cliente chamando `registrar_acesso_diario()` (RPC do plano 30-01) sem nunca bloquear a requisição, cobrindo os sinais de "abriu o sistema" (D-01) e "cadastrou/editou cliente" (D-02/D-05) da aderência de uso.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-27T13:34:42-03:00
- **Completed:** 2026-09-27T13:44:07-03:00
- **Tasks:** 3
- **Files modified:** 6 (3 criados, 2 modificados + este SUMMARY)

## Accomplishments

- `lib/aderencia/registroDiario.ts`: módulo puro (sem import só-servidor) com `diaLocalSaoPaulo` (fuso America/Sao_Paulo via `Intl.DateTimeFormat`/`formatToParts`), `valorMarcadorAcesso`/`precisaRegistrarAcesso` (marcador por cookie incluindo dia + conta) e `registrarAcessoDiario` (chama a RPC sem parâmetros, nunca lança).
- `updateSession()` (middleware) estendida: com usuário autenticado e cookie `aderencia_dia` desatualizado (ausente, de outro dia, ou de outra conta), chama o registro e só grava o cookie novo em caso de sucesso — `getUser()` continua sendo chamado exatamente uma vez, `middleware.ts` da raiz intocado.
- `createCliente`, `updateCliente` e `atualizarFrequenciaVisita` (Server Actions de cliente) chamam `registrarAcessoDiario(supabase)` logo depois de toda gravação ter dado certo e antes do primeiro `revalidatePath` do caminho de sucesso — `deleteCliente`, `getClienteDetalhe` e `getFrequenciasPedido` intocados.

## Task Commits

Cada tarefa seguiu RED → GREEN (TDD):

1. **Tarefa 1: lib/aderencia/registroDiario.ts**
   - `7d33358` test(30-04): teste RED de registroDiario
   - `824a47a` feat(30-04): lib/aderencia/registroDiario.ts
2. **Tarefa 2: updateSession() registra o dia**
   - `01783bd` test(30-04): teste RED de updateSession registrando o dia de uso
   - `8956374` feat(30-04): updateSession registra o dia de uso
3. **Tarefa 3: Server Actions de cliente registram o dia**
   - `cf9c4c6` test(30-04): teste RED de createCliente/updateCliente/atualizarFrequenciaVisita
   - `7d34536` feat(30-04): cadastrar/editar cliente e editar frequencia de visita registram o dia

_Nenhuma tarefa teve commit de REFACTOR — o GREEN de cada uma já saiu no formato final descrito no plano._

## Files Created/Modified

- `lib/aderencia/registroDiario.ts` - novo módulo: dia de São Paulo, marcador por cookie, chamada à RPC que nunca lança
- `tests/aderencia/registro-diario.test.ts` - 13 casos (12 do plano + verificação do nome fixo do cookie)
- `lib/supabase/middleware.ts` - `updateSession()` estendida com o registro diário por cookie (D-01/D-04/D-10)
- `tests/aderencia/middleware-registro.test.ts` - 8 casos, dublê de `@supabase/ssr` inteiro, relógio congelado
- `app/actions/clientes.ts` - `createCliente`/`updateCliente`/`atualizarFrequenciaVisita` chamando `registrarAcessoDiario` (D-02/D-05)
- `tests/clientes/registro-acesso-cliente.test.ts` - 6 casos, dublê de `@/lib/supabase/server` e `next/cache`

## Decisions Made

- Tipo do parâmetro de `registrarAcessoDiario` é um shape estrutural mínimo (`{ rpc: (nome) => PromiseLike<{error}> }`), não o `SupabaseClient` importado de `@supabase/supabase-js` — compila sem `any`, e o client real (usado no middleware e nas Server Actions) satisfaz esse shape estruturalmente (confirmado por `tsc --noEmit` limpo em todo o projeto).
- `OPCOES_MARCADOR_ACESSO.maxAge` = 48h, não 24h — o valor do cookie já carrega o dia (`AAAA-MM-DD.conta`); a validade só precisa ultrapassar um dia inteiro para o marcador de ontem parar de bater sozinho na comparação (`precisaRegistrarAcesso`), e a folga evita qualquer aperto de fronteira de fuso.
- Chamada de cookie no middleware feita imediatamente antes do `return`, usando a variável `response` no estado em que ela estiver depois do `getUser()` (o `setAll` do `@supabase/ssr` pode tê-la reatribuído) — nunca uma segunda instância de `NextResponse`.

## Deviations from Plan

None — plano executado exatamente como escrito, com um único ajuste textual sem impacto funcional: o comentário de cabeçalho de `lib/aderencia/registroDiario.ts` inicialmente citava literalmente `"next/headers"`/`"server-only"`/`"@/lib/supabase/server"` como exemplos do que o módulo não pode importar, o que colidia com o próprio script de verificação do plano (que varre o arquivo procurando essas strings como sinal de import proibido). Reescrito para descrever a mesma restrição sem repetir os literais — nenhuma mudança de comportamento, só de texto do comentário.

## Issues Encountered

None.

## Known Stubs

None — os três pontos de gravação (middleware + 3 Server Actions) estão todos conectados à mesma função `registrarAcessoDiario`, e a chamada real à RPC só passa a gravar de fato depois que o dono aplicar as migrations 0038/0039/0040 (plano 30-03) — isso é o próprio desenho da fase (paralelismo entre app e schema), não um stub deixado para trás.

## User Setup Required

None diretamente deste plano. Lembrete (já registrado nos planos 30-01/30-02): a RPC `registrar_acesso_diario()` (migration 0038) ainda precisa ser aplicada manualmente pelo SQL Editor do Supabase (plano 30-03) para este código passar a gravar de verdade em produção — até lá, o registro é uma chamada real à RPC que ainda não existe no banco (e por isso, com o design de "nunca lançar" já testado aqui, simplesmente devolve falha silenciosa sem quebrar nada, exatamente o comportamento coberto pelos casos `falha-nao-bloqueia`/`excecao-nao-bloqueia`/`registro-falho-nao-muda-resultado`).

## Next Phase Readiness

- App-side wiring completo: middleware e as 3 Server Actions de cliente já chamam a RPC do 30-01, prontos para o dia em que ela existir no banco.
- Aguarda o plano 30-03 (aplicação manual das migrations 0038/0039/0040) para o registro passar a gravar de fato e a leitura do Dashboard (30-02) ter dados reais para agregar.
- ADER-01/ADER-02/ADER-03 permanecem Pending em REQUIREMENTS.md por instrução explícita — só fecham quando o último plano contribuinte (30-06, a coluna da UI) terminar.

---
*Phase: 30-ader-ncia-de-uso-no-dashboard*
*Completed: 2026-09-27*
