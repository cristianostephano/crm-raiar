---
phase: 24-dia-fixo-na-recorr-ncia-de-visita
plan: 01
subsystem: database
tags: [postgres, plpgsql, supabase, rpc, calendar-math]

# Dependency graph
requires:
  - phase: 23-raz-o-social-opcional-e-trava-do-ganho-ampliada
    provides: mover_card_funil com os 6 guards de transição (etapa, motivo de perda, frequência, CNPJ, razão social, endereço) e razao_social/endereço opcionais
provides:
  - "dia_semana_enum e semana_do_mes_enum (dois tipos enumerados novos)"
  - "clientes.dia_semana_visita / clientes.semana_do_mes_visita (duas colunas opcionais)"
  - "dia_semana_para_dow e nth_dia_semana_do_mes (duas funções auxiliares puras)"
  - "proxima_data_visita reescrita (2 -> 4 parâmetros) com caminho antigo (D-01) preservado e caminho novo de âncora"
  - "agenda_do_vendedor e mover_card_funil passando a âncora do cliente para proxima_data_visita"
affects: [24-02-ficha-do-cliente-select-dia-fixo, 24-03-agenda-secao-sem-dia-fixo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ramificação com o caminho antigo avaliado PRIMEIRO dentro da mesma função (fallback-first), devolvido literal, para nunca quebrar o oráculo de regressão frequencia-visita.test.ts"
    - "Tradução de vocabulário enumerado para número via função nomeada com CASE explícito, nunca pela ordem de declaração do tipo"
    - "Deslocamento modular com zero forçado a virar sete, garantindo data sempre estritamente futura por construção"
    - "'Última ocorrência do mês' contada para trás a partir do último dia do mês, nunca como sinônimo condicional de '4ª'"

key-files:
  created:
    - supabase/migrations/0026_dia_fixo_visita.sql
    - tests/clientes/dia-fixo-visita.test.ts
  modified: []

key-decisions:
  - "D-01 (herdada da Fase 24, reafirmada nesta migration): cliente com frequência mas sem dia fixo, ou com âncora mensal incompleta (dia da semana sem semana do mês), continua recebendo o cálculo antigo de dias corridos — nunca sugestão nula."
  - "'Última' implementada como contagem independente para trás a partir do fim do mês, nunca como '4ª ocorrência, ou 5ª se existir' — outubro/2026 prova a divergência (22 vs 29)."
  - "mover_card_funil passa a LER (não apenas ignorar) as duas colunas de âncora, cobrindo o caso de re-ganho após um cliente voltar de 'ganho' para 'em_andamento' já com dia fixo gravado."
  - "agenda_do_vendedor e mover_card_funil recriados com create or replace (sem drop) — nenhum dos dois mudou o conjunto/contagem de parâmetros de retorno ou de entrada."

requirements-completed: [ANCORA-01, ANCORA-02, ANCORA-03, ANCORA-04]

coverage:
  - id: D1
    description: "Semanal/quinzenal com dia fixo sempre devolve a próxima ocorrência daquele dia da semana, nunca o próprio dia da conclusão"
    requirement: "ANCORA-01"
    verification:
      - kind: integration
        ref: "tests/clientes/dia-fixo-visita.test.ts#Bloco B (5 casos + 7 rótulos de dia da semana)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mensal com semana do mês + dia da semana devolve a ocorrência correta, e 'última' diverge de '4ª' (outubro/2026: 29 vs 22)"
    requirement: "ANCORA-02"
    verification:
      - kind: integration
        ref: "tests/clientes/dia-fixo-visita.test.ts#Bloco C (outubro/2026 22 vs 29, virada dezembro->janeiro)"
        status: pass
    human_judgment: false
  - id: D3
    description: "agenda_do_vendedor e mover_card_funil passam a âncora do cliente para proxima_data_visita, sem recalcular nada por conta própria"
    requirement: "ANCORA-03"
    verification:
      - kind: integration
        ref: "tests/clientes/dia-fixo-visita.test.ts#Bloco F (agenda_do_vendedor e mover_card_funil no re-ganho)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhum dos três modos (semanal, quinzenal, mensal) devolve data igual ou anterior à base"
    requirement: "ANCORA-04"
    verification:
      - kind: integration
        ref: "tests/clientes/dia-fixo-visita.test.ts#Bloco E (nunca-no-passado)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cliente sem dia fixo, ou com âncora mensal incompleta, continua recebendo exatamente o cálculo antigo (D-01)"
    verification:
      - kind: integration
        ref: "tests/clientes/dia-fixo-visita.test.ts#Bloco A e Bloco D"
        status: pass
      - kind: integration
        ref: "tests/clientes/frequencia-visita.test.ts (arquivo não editado, oráculo de regressão)"
        status: unknown
    human_judgment: true
    rationale: "frequencia-visita.test.ts usa signInAs contra as contas semente de vendedor, que estão apagadas (blocker conhecido registrado em STATE.md) — não pôde ser rodado nesta sessão para confirmar verde; a prova de não-regressão veio de dia-fixo-visita.test.ts (Bloco A, mesma forma de chamada de 2 argumentos) mais a garantia mecânica de que o CASE do caminho antigo foi copiado literal (contadores de interval '7 days'/'14 days' = 1 cada, sem duplicação)."

duration: ~15min (Tasks 1-2) + pausa de checkpoint até o dono do projeto aplicar a migration
completed: 2026-08-26
status: complete
---

# Phase 24 Plan 01: Dia Fixo na Recorrência de Visita — Fundação de Banco Summary

**`proxima_data_visita` reescrita de cálculo de offset fixo (2 parâmetros) para busca de dia fixo (4 parâmetros: dia da semana e/ou semana do mês), com os dois chamadores existentes (`agenda_do_vendedor`, `mover_card_funil`) passando a âncora adiante, e o cálculo antigo preservado byte a byte como fallback para quem ainda não definiu dia fixo.**

## Performance

- **Duration:** ~15min de execução ativa (Tasks 1 e 2), mais o intervalo de checkpoint até o dono do projeto rodar `npx supabase@2.111.0 db push`
- **Started:** 2026-08-26T14:06Z (aprox., logo após o plano ser escrito)
- **Completed:** 2026-08-26 (aplicação confirmada pelo dono do projeto)
- **Tasks:** 3/3 (2 auto + 1 checkpoint de ação humana)
- **Files modified:** 2 (ambos novos)

## Accomplishments
- Migration 0026 aplicada em produção: dois tipos enumerados (`dia_semana_enum`, `semana_do_mes_enum`), duas colunas opcionais em `clientes` (`dia_semana_visita`, `semana_do_mes_visita`), duas funções auxiliares puras (`dia_semana_para_dow`, `nth_dia_semana_do_mes`).
- `proxima_data_visita` reescrita como `plpgsql` com dois caminhos: o cálculo antigo (dias corridos), avaliado primeiro e devolvido literal quando a âncora está ausente ou incompleta (D-01); e o cálculo novo de busca de dia fixo para semanal/quinzenal/mensal, sempre estritamente futuro.
- `agenda_do_vendedor` e `mover_card_funil` recriados passando as duas colunas de âncora do cliente para `proxima_data_visita` — a coluna de sugestão da Agenda e a semeadura da primeira visita no ganho agora miram o dia fixo quando ele existe, inclusive no caso de re-ganho após o cliente voltar de "ganho" para "em andamento".
- Teste de integração novo (`tests/clientes/dia-fixo-visita.test.ts`, 28 casos rodados) provando os seis blocos: caminho antigo intacto, semanal/quinzenal com dia fixo (incluindo os sete rótulos de dia da semana), mensal com semana do mês (outubro/2026: "4ª" = 22, "última" = 29), âncora incompleta, nunca-no-passado, e os dois chamadores.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 0026 — âncora de dia fixo, cálculo novo e os dois chamadores** - `9db554c` (feat)
2. **Task 2: Teste de integração do cálculo com dia fixo e da regressão do cálculo antigo** - `a3c43d1` (test)
3. **Task 3: Aplicar a migration 0026 no banco hospedado** - checkpoint de ação humana, executado pelo dono do projeto (sem commit próprio — `npx supabase@2.111.0 db push`)

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified
- `supabase/migrations/0026_dia_fixo_visita.sql` - dois enums, duas colunas, duas funções auxiliares, `proxima_data_visita` reescrita, `agenda_do_vendedor`/`mover_card_funil` recriados
- `tests/clientes/dia-fixo-visita.test.ts` - 28 casos de integração cobrindo ANCORA-01 a 04, autenticando só via `serviceClient()`

## Decisions Made
- **D-01 estendida:** uma âncora mensal pela metade (dia da semana escolhido, semana do mês ainda não) é tratada como âncora ausente — cai no cálculo antigo em vez de devolver sugestão nula à Agenda. Registrado em comentário na migration como extensão deliberada do D-01, não um desvio dele.
- **"Última" nunca é sinônimo de "4ª":** implementada como contagem independente para trás a partir do último dia do mês. Verificado em outubro/2026 (5 quintas: 1, 8, 15, 22, 29) — "4ª" = 22, "última" = 29, sete dias de diferença.
- **`mover_card_funil` lê as duas colunas de âncora mesmo sabendo que quase sempre estarão nulas no primeiro ganho** — o caminho de re-ganho (cliente que já foi "ganho" com âncora definida, voltou para "em andamento", e é remarcado "ganho") é alcançável pelo próprio guard de transição já existente (`v_status_atual is distinct from 'ganho'`), então a leitura é necessária para correção, não defensiva sem propósito.
- **Nenhum drop de função foi necessário para `agenda_do_vendedor`/`mover_card_funil`:** nenhum dos dois mudou a assinatura (mesmas colunas de retorno, mesmos parâmetros) — só `create or replace`, evitando qualquer janela de sobrecarga ambígua.

## Deviations from Plan

None - plan executado exatamente como escrito. Todas as travas mecânicas de verificação do plano (contagens exatas de `raise exception`=6, `is distinct from`=3, `at time zone 'America/Sao_Paulo'`=2, `interval '7 days'`=1, `interval '14 days'`=1, ausência de `isodow`/`now()::date`, tipos/colunas/funções criados exatamente uma vez) passaram sem ajuste.

## Issues Encountered

None. A aplicação da migration (`npx supabase@2.111.0 db push`) foi feita pelo dono do projeto — precedente já estabelecido nas Fases 18, 19, 22 e 23 (o classificador de modo automático do sandbox bloqueia a tentativa do executor de rodar o push).

Resultado dos testes reportado pelo dono do projeto após a aplicação:
- `tests/clientes/dia-fixo-visita.test.ts`: 28/28 verde, incluindo os sete rótulos de dia da semana, outubro/2026 (22 vs 29) e o rollover dezembro→janeiro.
- `tests/clientes/ganho-ficha-completa.test.ts`: 12/12 verde — os seis guards de `mover_card_funil` sobreviveram à recriação.
- `tests/agenda/itens.test.ts`: 66/66 verde (funções puras, não tocadas por este plano).
- `tests/agenda/proxima-data.test.ts`: falhou apenas com "Invalid login credentials" para uma conta seed de vendedor — blocker conhecido e já registrado em STATE.md (contas semente apagadas em 2026-08-19), não uma regressão das funções recriadas por este plano.

## User Setup Required

None - nenhuma configuração de serviço externo. A única ação manual foi a aplicação da migration em produção (Task 3), já concluída pelo dono do projeto.

## Next Phase Readiness
- `clientes.dia_semana_visita` e `clientes.semana_do_mes_visita` existem e estão prontas para o Select da ficha do cliente (Plano 24-02).
- `proxima_data_visita` já aceita e usa a âncora — o Plano 24-02 só precisa gravar as duas colunas, sem tocar em nenhuma função de cálculo.
- A seção nova da Agenda (Plano 24-03) pode se apoiar diretamente em `dia_semana_visita is null` como parte do predicado "sem dia fixo", já que a coluna existe e está coberta pela RLS existente de `clientes`.
- Nenhum bloqueio novo. O blocker pré-existente de contas seed de vendedor apagadas (STATE.md) continua impedindo `tests/agenda/proxima-data.test.ts` e outros ~49 arquivos de rodar via `signInAs` — não é responsabilidade deste plano e não piorou.

---
*Phase: 24-dia-fixo-na-recorr-ncia-de-visita*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: supabase/migrations/0026_dia_fixo_visita.sql
- FOUND: tests/clientes/dia-fixo-visita.test.ts
- FOUND commit: 9db554c
- FOUND commit: a3c43d1
