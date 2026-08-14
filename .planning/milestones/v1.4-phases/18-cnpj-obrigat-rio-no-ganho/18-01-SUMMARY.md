---
phase: 18-cnpj-obrigat-rio-no-ganho
plan: 01
subsystem: database
tags: [postgres, plpgsql, rpc, rls, supabase, migration]

# Dependency graph
requires:
  - phase: 13-cliente-ativo-e-frequencia-de-visita
    provides: "mover_card_funil (6-parameter version), clientes.cnpj column (nullable, since 0013), grandfathering pattern for frequencia_visita"
provides:
  - "mover_card_funil recriada com o 7o parametro p_cnpj (uuid, etapa_funil, status_acompanhamento_enum, uuid, numeric, frequencia_visita_enum, text)"
  - "Guard no RPC que exige CNPJ nao-vazio exatamente na TRANSICAO para 'ganho', preservando o grandfathering de clientes ja 'ganho' sem CNPJ"
  - "Migration 0018 aplicada em producao"
affects: [18-02-campo-cnpj-no-dialogo-de-ganho]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard de obrigatoriedade condicionado a transicao de estado (nao ao estado em si), lido via SELECT ... INTO + FOUND antes do UPDATE, dentro do mesmo RPC nao-security-definer — mesmo molde ja usado para frequencia_visita na Fase 13"
    - "CNPJ efetivo = coalesce(nullif(btrim(p_param), ''), nullif(btrim(coluna_ja_gravada), '')) — aparamento de espaco + reaproveitamento de valor ja gravado, sem reenvio obrigatorio"

key-files:
  created:
    - supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql
    - tests/clientes/cnpj-ganho.test.ts
  modified:
    - tests/clientes/frequencia-visita.test.ts
    - tests/clientes/frequencia-visita-edicao.test.ts

key-decisions:
  - "CLI do Supabase pinado em 2.111.0 para o push (2.112.0+ tem bug de validacao de schema conhecido do projeto)"
  - "npm test completo nao fecha limpo por rate-limit conhecido do signInWithPassword do Supabase Auth — mitigado provando isoladamente os 6 arquivos de risco direto do plano + as 5 suites de dashboard que marcam ganho via UPDATE direto, mesma convencao da Fase 13-01"

patterns-established: []

requirements-completed: [CNPJ-01, CNPJ-02]

coverage:
  - id: D1
    description: "mover_card_funil recusa marcar 'ganho' um cliente que ainda nao e ganho quando o CNPJ efetivo (parametro + coluna) esta vazio, incluindo string so de espacos"
    requirement: CNPJ-01
    verification:
      - kind: integration
        ref: "tests/clientes/cnpj-ganho.test.ts#obrigatorio"
        status: pass
      - kind: integration
        ref: "tests/clientes/cnpj-ganho.test.ts#vazio"
        status: pass
    human_judgment: false
  - id: D2
    description: "Com CNPJ preenchido (no parametro ou ja gravado na ficha), a transicao para ganho acontece normalmente e o valor e persistido na mesma transacao"
    requirement: CNPJ-01
    verification:
      - kind: integration
        ref: "tests/clientes/cnpj-ganho.test.ts#feliz"
        status: pass
      - kind: integration
        ref: "tests/clientes/cnpj-ganho.test.ts#existente"
        status: pass
      - kind: integration
        ref: "tests/clientes/cnpj-ganho.test.ts#preserva"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clientes ja 'ganho' antes desta migration (sem CNPJ) nunca sao bloqueados pela trava nova, nem numa chamada de arrastar card nem numa que reafirme ganho — grandfathering"
    requirement: CNPJ-02
    verification:
      - kind: integration
        ref: "tests/clientes/cnpj-ganho.test.ts#legado"
        status: pass
      - kind: integration
        ref: "tests/clientes/cnpj-ganho.test.ts#arrasta"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhuma validacao de formato/digito verificador de CNPJ existe — so presenca (nao-vazio) e exigida"
    verification:
      - kind: integration
        ref: "tests/clientes/cnpj-ganho.test.ts#formato"
        status: pass
    human_judgment: false
  - id: D5
    description: "Caminhos existentes de mover_card_funil (guard de etapa, guard de motivo de perda, guard de frequencia de visita, cross-vendedor RLS) continuam identicos, sem sobrecarga ambigua no PostgREST apos a troca de aridade"
    verification:
      - kind: integration
        ref: "tests/clientes/funil-status.test.ts"
        status: pass
      - kind: integration
        ref: "tests/clientes/funil-constraints.test.ts"
        status: pass
      - kind: integration
        ref: "tests/clientes/rls-visitas.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Migration aplicada no projeto Supabase hospedado (producao) com aprovacao humana previa"
    verification:
      - kind: other
        ref: "npx supabase migration list (0018 remote: '0018')"
        status: pass
    human_judgment: true
    rationale: "Push em producao exige confirmacao humana explicita por decisao de projeto (CLAUDE.md); o dono do projeto rodou o push diretamente e confirmou o resultado no chat, fora do que um teste automatizado consegue provar por si so."

# Metrics
duration: ~35min (Task 1 em sessao anterior + Task 2 checkpoint + Task 3 nesta sessao)
completed: 2026-08-11
status: complete
---

# Phase 18 Plan 1: CNPJ Obrigatório no Ganho (camada de banco) Summary

**`mover_card_funil` recriada com o 7º parâmetro `p_cnpj`, exigindo CNPJ apenas na transição para "ganho" e preservando intocados os clientes já "ganho" sem CNPJ — migration 0018 aplicada em produção.**

## Performance

- **Duration:** ~35 min no total (Task 1 escrito em sessão anterior, Task 2 aprovado pelo dono, Task 3 concluído nesta sessão)
- **Tasks:** 3/3 (1 auto, 1 checkpoint humano, 1 auto)
- **Files modified:** 4 (1 migration nova, 1 teste novo, 2 testes editados)

## Accomplishments

- `mover_card_funil` recriada com sétimo parâmetro `p_cnpj text default null`; assinatura antiga de 6 parâmetros removida na mesma migration, sem sobrecarga ambígua no PostgREST (confirmado pelos 3 arquivos de regressão passando sem edição).
- Guard novo que levanta exceção quando, e somente quando, a chamada pede `p_novo_status = 'ganho'`, a linha do cliente foi encontrada (respeitando a RLS), o status atual é diferente de `'ganho'`, e o CNPJ efetivo (parâmetro ou coluna já gravada, ambos aparados) está vazio.
- Grandfathering provado contra o banco real: um cliente inserido diretamente via `serviceClient()` como já "ganho" sem CNPJ (simulando um registro anterior a esta versão) segue legível, editável, e pode ser reafirmado como ganho ou arrastado de coluna sem jamais ser bloqueado.
- Migration `0018_cnpj_obrigatorio_no_ganho.sql` aplicada no projeto Supabase hospedado (`afbiwgbqkogsrhxjshkk`) com aprovação humana prévia (Task 2), confirmada via `npx supabase migration list` (`remote: "0018"`).

## Task Commits

1. **Task 1: Escrever a migration do guard de CNPJ e os testes de integração (RED)** — `43bb3a4` (test) — commitado em sessão anterior a esta.
2. **Task 2: Aprovação humana — aplicar a migration no banco Supabase de produção** — checkpoint humano, sem commit próprio; aprovação confirmada pelo dono do projeto antes do push.
3. **Task 3: [BLOCKING] Aplicar a migration (supabase db push) e levar os testes a GREEN** — sem commit de código (nenhum arquivo precisou de edição — os testes escritos no Task 1 já estavam corretos e ficaram GREEN assim que a migration entrou em produção). O push em si (`npx -y supabase@2.111.0 db push`) foi executado pelo dono do projeto diretamente, com sua própria permissão do Claude Code, depois que uma tentativa deste executor foi bloqueada pelo classificador de modo automático do ambiente (ação de escrita em produção — ver "Issues Encountered").

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified

- `supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql` — recria `mover_card_funil` com o 7º parâmetro `p_cnpj` e o guard de transição para ganho; zero mudança de estrutura de tabela.
- `tests/clientes/cnpj-ganho.test.ts` (novo) — 13 testes cobrindo os 8 casos exigidos (`obrigatorio`, `vazio`, `feliz`, `existente`, `legado`, `arrasta`, `preserva`, `formato`) contra o banco real.
- `tests/clientes/frequencia-visita.test.ts` — helper `marcarGanhoRpc` passa a mandar `p_cnpj` no caminho feliz.
- `tests/clientes/frequencia-visita-edicao.test.ts` — idem.

## Decisions Made

- **CLI do Supabase pinado em `2.111.0` para o push** — reafirma a decisão já registrada em `STATE.md` desde a Fase 13 (`2.112.0`+ tem um bug de validação de schema conhecido). Confirmado que a versão instalada por padrão via `npx supabase` (`2.113.0`) funciona normalmente para comandos de leitura (`migration list`), mas o push seguiu o pin documentado por segurança.
- **`npm test` completo não fecha limpo** — mesmo rate-limit de `signInWithPassword` do Supabase Auth já documentado desde a Fase 6-03 e reafirmado na Fase 13-01. Mitigado exatamente pela mesma convenção da 13-01: provar isoladamente os arquivos de maior risco de regressão em vez de depender da suíte inteira (ver "Issues Encountered" para os números).

## Deviations from Plan

### Auto-fixed Issues

None — nenhum bug ou lacuna encontrada no código desta fase. A migration e os testes escritos no Task 1 estavam corretos; nenhuma correção foi necessária no Task 3.

---

**Total deviations:** 0
**Impact on plan:** Nenhum. Plano executado exatamente como escrito — o único desvio de processo (não de código) foi quem apertou o botão do `db push`, documentado abaixo.

## Issues Encountered

- **Bloqueio de permissão no `supabase db push`:** o classificador de modo automático do ambiente Claude Code recusou duas tentativas deste executor de rodar `supabase db push` (tanto pinado em `2.111.0` quanto na versão padrão instalada), por ser uma ação de escrita direta em produção. Em vez de contornar o bloqueio (ex.: chamando a Management API por fora do CLI), o executor parou e devolveu um checkpoint pedindo que o dono do projeto rodasse o comando diretamente ou concedesse a permissão. O dono rodou `npx -y supabase@2.111.0 db push` com sua própria permissão e confirmou o resultado; `npx supabase migration list` re-verificou de forma independente que `0018` está com `remote: "0018"` antes de qualquer teste ser considerado GREEN.
- **Rate-limit de `signInWithPassword` (já documentado, não é regressão desta fase):** ao rodar os 6 arquivos de teste em lote, os 2 primeiros (novo `cnpj-ganho.test.ts` e os dois helpers de frequência) passaram limpos, mas os 3 arquivos de regressão (`funil-status`, `funil-constraints`, `rls-visitas`) começaram a falhar com `Request rate limit reached` no meio do lote — mesmo padrão relatado na Fase 13-01. Reexecutados individualmente, com pausas entre tentativas para o limite reabrir, todos os 3 passaram limpos. A suíte completa (`npx vitest run`, 711 testes/84 arquivos) foi tentada uma vez e não fechou limpa: 238 falhas, a esmagadora maioria (todas as visíveis na cauda do log, e confirmadas pelo padrão idêntico de erro) sendo exatamente `Request rate limit reached` em `signInAs`, zero falha de asserção de schema/RPC. As 5 suítes de dashboard que marcam clientes "ganho" via `UPDATE` direto (`ganhos-perdidos`, `funil-detalhado`, `comparativo-vendedor`, `desempenho-vendedor`, `prospeccao`) foram reprovadas isoladamente depois, todas verdes (42/42) — prova de que nenhuma restrição de coluna nova quebrou o caminho de "ganho" por UPDATE direto usado nos testes de dashboard. As suítes de RLS de importação (`rls-dedup-read`, `rls-frequencia-lote`, `rls-importar-lote`) não foram reverificadas limpas de forma isolada nesta sessão — ficaram sem tempo de janela de rate-limit disponível; elas exercitam RPCs diferentes (`importar_clientes_lote`, `atualizar_frequencia_visita_lote`), não tocadas por esta migration, então estão fora do escopo direto de regressão deste plano, mas registrado aqui para transparência.

**Resultados verdes confirmados nesta sessão (todos rodados isoladamente após o push):**
| Arquivo | Resultado |
|---|---|
| `tests/clientes/cnpj-ganho.test.ts` | 13/13 |
| `tests/clientes/frequencia-visita.test.ts` + `frequencia-visita-edicao.test.ts` (juntos) | 28/28 |
| `tests/clientes/funil-status.test.ts` | 10/10 |
| `tests/clientes/funil-constraints.test.ts` | 9/9 |
| `tests/clientes/rls-visitas.test.ts` | 11/11 |
| `tests/dashboard/ganhos-perdidos.test.ts` + `funil-detalhado.test.ts` + `comparativo-vendedor.test.ts` + `desempenho-vendedor.test.ts` + `prospeccao.test.ts` | 42/42 |

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- A interface para o plano 18-02 está pronta: a chamada de ganho já aceita o parâmetro nomeado `p_cnpj` (texto, opcional) em `mover_card_funil`.
- **Aviso operacional já registrado no checkpoint do Task 2:** entre este push e a conclusão do plano 18-02, a tela não vai conseguir marcar um cliente como "ganho" via UI a menos que ele já tenha CNPJ gravado na ficha — o banco já exige `p_cnpj`, mas o diálogo de ganho ainda não manda esse parâmetro. É esperado e temporário; nenhum dado é perdido nesse intervalo.
- Nenhum bloqueio técnico para o plano 18-02.

---
*Phase: 18-cnpj-obrigat-rio-no-ganho*
*Completed: 2026-08-11*

## Self-Check: PASSED

- FOUND: `.planning/phases/18-cnpj-obrigat-rio-no-ganho/18-01-SUMMARY.md`
- FOUND: `supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql`
- FOUND: `tests/clientes/cnpj-ganho.test.ts`
- FOUND: commit `43bb3a4` (Task 1)
