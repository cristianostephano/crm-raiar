---
phase: 16-ficha-do-cliente-ativo-campos-e-di-rio
plan: 03
subsystem: database
tags: [nextjs, server-actions, supabase, rls, zod, vitest]

# Dependency graph
requires:
  - phase: 16-ficha-do-cliente-ativo-campos-e-di-rio (plan 01)
    provides: "colunas nullable clientes.nome_fantasia/cnpj/frequencia_pedidos (migration 0013), tabela frequencias_pedido com RLS read-all/write-supervisor (migration 0016)"
  - phase: 16-ficha-do-cliente-ativo-campos-e-di-rio (plan 02)
    provides: "getFrequenciasPedidoAtivas()/getFrequenciasPedido() — leitor ATIVO-only do vocabulário, explicitamente documentado como NÃO reutilizável pela re-validação deste plano"
provides:
  - "lib/clientes/frequenciaPedido.ts — par puro de funções (frequenciaPedidoValida/frequenciaPedidoCanonica), irmã literal de cidadeValida/cidadeCanonica"
  - "updateClienteSchema com nomeFantasia/cnpj/frequenciaPedidos opcionais; createClienteSchema literalmente intocado"
  - "ClienteDetalhe/getClienteById lendo as três colunas novas do cliente ativo"
  - "updateCliente gravando os três campos com re-validação de vocabulário (catálogo COMPLETO) e gravação condicional à presença no envio"
  - "DiarioEntry + getDiario(clienteId) (lib/supabase/queries/clientes.ts) — leitura própria da trilha de auditoria, filtrada em SQL"
  - "getDiarioAction(clienteId) (app/actions/funil.ts) — Server Action fina, sem checagem de papel"
affects: [16-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-validação de vocabulário dinâmico no servidor segue o molde literal de cidadeValida/cidadeCanonica: par de funções puras (pertencimento + canonicalização), comparação trim+lowercase, vocabulário passado pelo chamador"
    - "Gravação condicional à presença: campos que só existem em parte do formulário (renderização condicional) entram no objeto de UPDATE via espalhamento condicional por chave (`...(campo !== undefined ? {...} : {})`), nunca incondicionalmente — evita apagamento silencioso de dados de outro registro que passa pelo mesmo caminho de escrita"
    - "Diário é uma leitura NOVA e independente do histórico completo (mesma tabela `historico`, filtro de tipo em SQL, nunca client-side) — segue a mesma disciplina de getHistorico/getClientesParaExportacao: sem checagem de papel, sem filtro de dono, RLS parent-gated é a fronteira inteira"

key-files:
  created:
    - lib/clientes/frequenciaPedido.ts
    - tests/clientes/cliente-ativo-campos.test.ts
    - tests/clientes/diario.test.ts
  modified:
    - lib/validations/cliente.ts
    - lib/supabase/queries/clientes.ts
    - app/actions/clientes.ts
    - app/actions/funil.ts

key-decisions:
  - "frequenciaPedidoValida/frequenciaPedidoCanonica comparam por trim+lowercase apenas (sem remoção de acentos/pontuação como normalizeRazaoSocial) — os nomes do vocabulário (Semanal/Quinzenal/Mensal/...) não têm acento, e o plano pediu explicitamente 'aparar espaços das pontas e insensível a caixa', não o tratamento mais agressivo usado para razão social/cidade"
  - "A re-validação em updateCliente lê frequencias_pedido sem filtro de ativo (catálogo COMPLETO) — nunca getFrequenciasPedidoAtivas() do plano 16-02, cujo próprio comentário avisa contra esse reuso"
  - "Gravação condicional implementada com espalhamento condicional (`...(x !== undefined ? {...} : {})`) por campo, não por objeto inteiro — cada um dos três campos é independente: um envio pode trazer só um deles presente"

patterns-established: []

requirements-completed: [ATV-01, ATV-02, DIAR-01]

coverage:
  - id: D1
    description: "Nome fantasia/CNPJ lidos e gravados na ficha (opcionais, sem formato exigido); cadastro rápido permanece literalmente sem conhecê-los"
    requirement: ATV-01
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-ativo-campos.test.ts — casos 'cadastro' e 'edicao'"
        status: pass
      - kind: integration
        ref: "tests/clientes/cliente-ativo-campos.test.ts — casos 'colunas', 'legado', 'alheio' (banco real, sessões reais)"
        status: pass
      - kind: other
        ref: "node structural verification script (Task 1 <verify> block) + npx tsc --noEmit + npm run lint"
        status: pass
    human_judgment: false
  - id: D2
    description: "Frequência de pedidos re-validada no servidor contra o vocabulário do banco (catálogo completo), gravada no formato canônico"
    requirement: ATV-02
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-ativo-campos.test.ts — casos 'vocabulario' e 'canonico'"
        status: pass
      - kind: other
        ref: "node structural verification script (Task 1 <verify> block) — confirma re-validação usa catálogo completo, não filtrado por ativo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Diário: leitura própria (getDiario/getDiarioAction) filtrada em SQL aos dois tipos de conclusão, ordenada da mais recente para a mais antiga, com autor nulo quando não resolver"
    requirement: DIAR-01
    verification:
      - kind: integration
        ref: "tests/clientes/diario.test.ts — casos 'filtro', 'ordem', 'autor', 'autornulo', 'resumo', 'vazio' (banco real, sessões reais)"
        status: pass
      - kind: other
        ref: "node structural verification script (Task 2 <verify> block) — confirma filtro SQL, ordenação, zero escrita, zero checagem de papel"
        status: pass
    human_judgment: false
  - id: D4
    description: "Critério de sucesso 4: Vendedor lê o diário só dos próprios clientes, Supervisor lê o de qualquer um, anônimo não lê nada — sem checagem de papel escrita à mão"
    requirement: DIAR-01
    verification:
      - kind: integration
        ref: "tests/clientes/diario.test.ts — casos 'vendedor', 'supervisor', 'anonimo' (banco real, três identidades)"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-08-09
status: complete
---

# Phase 16 Plan 3: Camada de Dados do Cliente Ativo e do Diário Summary

**Os três campos do cliente ativo (nome fantasia/CNPJ/frequência de pedidos) indo e voltando entre ficha e banco com gravação condicional à presença, mais a consulta própria do Diário filtrada em SQL — provados por 32 testes de integração contra o banco real.**

## Performance

- **Duration:** ~45min
- **Tasks:** 2/2 (ambas `type="auto"`)
- **Files modified:** 7 (4 modificados, 3 novos)

## Accomplishments

- `lib/clientes/frequenciaPedido.ts` (novo) — par puro de funções `frequenciaPedidoValida`/`frequenciaPedidoCanonica`, irmã literal de `cidadeValida`/`cidadeCanonica`: pertencimento tolerante a caixa/espaços e canonicalização contra um vocabulário passado pelo chamador. É a fronteira real do ATV-02, já que `clientes.frequencia_pedidos` é texto simples sem chave estrangeira (decisão D2).
- `lib/validations/cliente.ts` — `updateClienteSchema` ganhou `nomeFantasia`/`cnpj`/`frequenciaPedidos` como opcionais, sem `.min()`/`.regex()` (CNPJ fora de escopo de validação de formato); `createClienteSchema` permanece literalmente intocado, com comentário registrando o mecanismo por trás do critério de sucesso 1.
- `lib/supabase/queries/clientes.ts` — `ClienteDetalhe`/`ClienteDetalheRow`/`getClienteById` passam a ler as três colunas novas, todas anuláveis, repassadas sem transformação. `DiarioEntry` + `getDiario(clienteId)` (nova) leem a trilha de auditoria filtrando `tipo` em `.in(...)` dentro do SQL, ordenando `criado_em` decrescente, com autor resolvido via embed de `profiles` ou nulo quando não houver.
- `app/actions/clientes.ts` — `updateCliente` re-valida `frequenciaPedidos` contra o catálogo COMPLETO (ativos + inativos) de `frequencias_pedido` (nunca `getFrequenciasPedidoAtivas()` do plano 16-02), grava o nome canônico, e inclui as três colunas novas no objeto de `.update()` **apenas quando presentes no envio já validado** — a peça mais importante do plano, que impede que salvar a ficha de um cliente não-ganho apague em silêncio os dados de um cliente ganho.
- `app/actions/funil.ts` — `getDiarioAction(clienteId)` (nova), envelope fino idêntico a `getHistoricoAction`: checa usuário autenticado, sem checagem de papel.
- `tests/clientes/cliente-ativo-campos.test.ts` (novo, 18 casos) e `tests/clientes/diario.test.ts` (novo, 14 casos) — 32 testes, todos verdes contra o projeto Supabase hospedado real.

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Nome fantasia, CNPJ e frequência de pedidos indo e voltando da ficha** - `e00ffe9` (feat)
2. **Task 2: Consulta do diário e sua Server Action** - `75f2488` (feat)

**Plan metadata:** commit deste SUMMARY.md (ver hash no retorno da task de execução)

## Files Created/Modified

- `lib/clientes/frequenciaPedido.ts` - par puro `frequenciaPedidoValida`/`frequenciaPedidoCanonica`, irmã de `cidadeValida.ts`
- `lib/validations/cliente.ts` - `updateClienteSchema` +3 campos opcionais; `createClienteSchema` inalterado
- `lib/supabase/queries/clientes.ts` - `ClienteDetalhe`/`getClienteById` +3 colunas; `DiarioEntry`+`getDiario` novos
- `app/actions/clientes.ts` - `updateCliente` com re-validação de vocabulário + gravação condicional à presença
- `app/actions/funil.ts` - `getDiarioAction` novo
- `tests/clientes/cliente-ativo-campos.test.ts` - teste novo (18 casos)
- `tests/clientes/diario.test.ts` - teste novo (14 casos)

## Decisions Made

- `frequenciaPedidoValida`/`frequenciaPedidoCanonica` comparam por trim+lowercase (não a normalização mais agressiva de `normalizeRazaoSocial`, que remove acentos/pontuação/sufixos societários) — o vocabulário de frequência de pedidos não tem acentos, e o plano pediu explicitamente a tolerância mais simples.
- A re-validação de `updateCliente` lê `frequencias_pedido` sem `.eq("ativo", true)` — catálogo completo, de propósito, para não travar a edição de um cliente que já guardou um valor desde então desativado (T-16-20).
- Gravação condicional implementada com espalhamento condicional por campo (`...(campo !== undefined ? {...} : {})`), não por objeto inteiro — cada um dos três campos entra/sai do UPDATE de forma independente.

## Deviations from Plan

None - plan executado exatamente como escrito. Nenhuma correção automática (Regras 1-3) foi necessária além de dois ajustes de redação em comentários (ver "Issues Encountered" abaixo, que não são deviations de comportamento, apenas de texto de comentário para não colidir com os checks estruturais do próprio plano); nenhuma decisão arquitetural (Regra 4) surgiu durante a execução.

## Issues Encountered

- O check estrutural do Task 1 recusa a string literal `"use client"`/`"use server"` e `supabase` (minúsculo) em qualquer lugar de `lib/clientes/frequenciaPedido.ts`, como prova mecânica de que o módulo é puro. O comentário inicial (espelhando literalmente o texto de `cidadeValida.ts`, que contém essas mesmas substrings dentro da própria frase "sem 'use client'/'use server'") disparou o check por engano — reescrito para "sem diretiva de cliente/servidor" e sem o caminho `lib/supabase/...` grafado por extenso. Comportamento do módulo não mudou, só o texto do comentário.
- No teste de integração do Diário, comparar `criado_em` (string ISO enviada na semeadura) por igualdade estrita contra o valor devolvido pelo Postgres falhou — o banco re-serializa `timestamptz` com offset/precisão diferentes da string original. Corrigido casando as entradas semeadas pelo texto único de `descricao` (sentinela) em vez do carimbo de data.

## User Setup Required

None - nenhuma configuração externa manual necessária. `.env.local` e `supabase/.temp/` foram copiados do checkout principal do repositório só para viabilizar a execução dos testes de integração neste worktree (gitignored em ambos os lugares, nunca commitados).

## Next Phase Readiness

- Camada de dados completa e testada contra o banco real — o plano 16-04 (tela) só consome: `ClienteDetalhe` já traz `nomeFantasia`/`cnpj`/`frequenciaPedidos`; `updateCliente` já aceita e grava os três com segurança; `getDiarioAction(clienteId)` já devolve a lista pronta (ordem e filtro definidos na consulta, a tela não reordena nem deriva do histórico).
- Contrato para 16-04: a tela SEMPRE deve enviar os três campos do cliente ativo preenchidos a partir do que foi lido do cliente, mesmo quando não os renderiza (cliente não-ganho) — é a primeira linha de defesa contra perda de dado; a gravação condicional deste plano é a segunda linha, para qualquer outro chamador presente ou futuro. As duas convivem, nenhuma substitui a outra.
- **ATV-01/ATV-02/DIAR-01 permanecem intencionalmente NÃO marcados como completos em `.planning/REQUIREMENTS.md`** por este plano — nenhum dos campos/seções está wired na UI visível da ficha ainda (isso é o plano 16-04). O array `requirements-completed` no frontmatter deste SUMMARY segue a convenção do template (copia `requirements` do PLAN.md verbatim), mas não deve ser confundido com o requisito estar entregue ponta a ponta.
- Nenhuma migration, nenhuma dependência npm nova, nenhuma regra de acesso nova neste plano.
- Nenhum bloqueio conhecido para o plano 16-04.

---
*Phase: 16-ficha-do-cliente-ativo-campos-e-di-rio*
*Completed: 2026-08-09*
