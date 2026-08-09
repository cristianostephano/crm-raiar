---
phase: 15-conclus-o-com-resumo-e-pr-xima-visita
plan: 01
subsystem: database
tags: [postgres, supabase, rls, plpgsql, rpc, vitest, trigger]

# Dependency graph
requires:
  - phase: 13-cliente-ativo-e-frequ-ncia-de-visita
    provides: "visitas (com resumo), frequencia_visita_enum, proxima_data_visita — reusados sem redefinicao"
  - phase: 14-agenda-unificada
    provides: "agenda_do_vendedor() — corpo base recriado com 2 colunas a mais"
provides:
  - "tarefas.resumo (coluna nova, nullable) + chk_tarefas_resumo_tamanho/chk_visitas_resumo_tamanho (10..500, NOT VALID + validacao best-effort)"
  - "tarefas_before_update_historico() recriada — leva o resumo do vendedor a descricao do historico quando presente"
  - "visitas_after_update_historico() + trg_visitas_after_update_historico — gatilho novo, mesma categoria SECURITY DEFINER ja existente"
  - "concluir_tarefa_prospeccao(p_tarefa_id uuid, p_resumo text) — RPC atomica, sem elevacao de privilegio"
  - "concluir_visita(p_visita_id uuid, p_resumo text, p_proxima_data date default null) — RPC atomica, sem elevacao de privilegio"
  - "agenda_do_vendedor() recriada com 10 colunas de saida (as 8 anteriores + frequencia_visita + proxima_data_sugerida)"
affects: [15-02-server-actions-e-validacao, 15-03-dialogo-de-conclusao, 16-ficha-cliente-diario, 17-planilhas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC de escrita atomica em 3 tabelas (visitas + historico via trigger + visitas de novo) dentro de uma unica funcao plpgsql, nunca 3 chamadas do cliente (Pitfall 2)"
    - "Guard de negocio (obrigatoriedade de resumo, obrigatoriedade de data quando ha frequencia) vive no corpo da RPC, nunca no schema — schema fica permissivo (nullable) para nao quebrar dado legado"
    - "Falha fechada por RLS: update ... where id = ? and (ainda pendente) seguido de get diagnostics row_count = 0 cobre id inexistente + ja concluido + cliente alheio, sem nenhuma checagem de papel escrita a mao"
    - "Coluna de sugestao calculada dentro da propria consulta de leitura (agenda_do_vendedor), reusando a funcao pura de calculo — nunca uma segunda copia da conta no navegador"

key-files:
  created:
    - supabase/migrations/0015_conclusao_com_resumo.sql
    - tests/agenda/proxima-data.test.ts
    - tests/agenda/concluir-rpc.test.ts
    - tests/agenda/rls-conclusao.test.ts
  modified: []

key-decisions:
  - "Ponto de decisao do checkpoint #1 (caixinha antiga de concluir tarefa na ficha do cliente, sem pedir resumo): dono do projeto confirmou manter como esta por agora — nao bloqueada nesta fase, tratamento fica para a Fase 16 (reforma da ficha do cliente). Ate la, existe um caminho paralelo pela ficha do cliente que conclui tarefa sem resumo; a exigencia do CONC-01 vale para quem conclui pela tela da Agenda (15-03)."
  - "Ponto de decisao do checkpoint #2 (texto do historico): dono confirmou SEM prefixo — o resumo entra puro na coluna descricao do historico, nao 'Visita concluida: <resumo>'. Registrado aqui porque e irreversivel para linhas ja gravadas."
  - "Ponto de decisao do checkpoint #3 (data no passado): dono confirmou que datas passadas sao aceitas para a proxima visita (registro com atraso e intencional) — a RPC nao valida p_proxima_data >= hoje."
  - "Requisitos CONC-01/VIS-03 permanecem 'Pending' em REQUIREMENTS.md apos este plano — mesma convencao do 09-01-SUMMARY.md (LOC-01/02/04): a camada de banco esta completa e provada, mas o comportamento do usuario final so fica completo depois de 15-02 (server actions/validacao) e 15-03 (dialogo). Nao marcar Complete prematuramente."
  - "Supabase CLI pinado em 2.111.0 para o push desta migration, mesmo pin registrado desde a Fase 13 (`npx supabase` sem versao resolve para 2.112.0, que tem bug de validacao de schema)."

patterns-established:
  - "concluir_tarefa_prospeccao/concluir_visita sao os UNICOS caminhos de conclusao permitidos daqui em diante — nenhum plano futuro pode escrever direto em tarefas/visitas para concluir, nem escrever na tabela historico."

requirements-completed: []

coverage:
  - id: D1
    description: "Coluna tarefas.resumo (nullable) + constraints de tamanho 10..500 em tarefas e visitas, aplicadas NOT VALID + validacao best-effort (padrao da migration 0007)"
    verification:
      - kind: integration
        ref: "tests/agenda/concluir-rpc.test.ts#resumocurto/resumovazio/resumolongo: resumo fora do intervalo e recusado sem efeito colateral"
        status: pass
    human_judgment: false
  - id: D2
    description: "concluir_tarefa_prospeccao e concluir_visita — RPCs atomicas sem elevacao de privilegio, falham fechado por RLS quando o item nao pertence ao chamador"
    requirement: "CONC-01"
    verification:
      - kind: integration
        ref: "tests/agenda/concluir-rpc.test.ts#tarefa/visita/duplicada"
        status: pass
      - kind: integration
        ref: "tests/agenda/rls-conclusao.test.ts#vendedor: Vendedor B nao conclui item alheio, nada muda"
        status: pass
      - kind: integration
        ref: "tests/agenda/rls-conclusao.test.ts#supervisor: Supervisor conclui e vira autor no historico"
        status: pass
      - kind: integration
        ref: "tests/agenda/rls-conclusao.test.ts#anonimo: sessao anonima nao muda nada"
        status: pass
    human_judgment: false
  - id: D3
    description: "Resumo chega ao historico do cliente exclusivamente pelo gatilho de auditoria (tarefas_before_update_historico recriada + visitas_after_update_historico nova), com autor e data — zero policy de escrita nova em historico, zero insert direto fora dos dois gatilhos"
    requirement: "CONC-01"
    verification:
      - kind: integration
        ref: "tests/agenda/concluir-rpc.test.ts#historico: descricao identica ao resumo, autor e data preenchidos para tarefa e visita"
        status: pass
      - kind: other
        ref: "check estrutural do Task 1 (node -e): exatamente 2 inserts em historico (um por gatilho), zero create policy, zero referencia a historico no corpo das 3 funcoes chamaveis pelo app"
        status: pass
    human_judgment: false
  - id: D4
    description: "concluir_visita fecha a visita atual, grava resumo, e cria a proxima visita com a data EXATA confirmada (nunca recalculada) numa unica transacao atomica"
    requirement: "VIS-03"
    verification:
      - kind: integration
        ref: "tests/agenda/concluir-rpc.test.ts#visita: proxima visita criada com a data enviada, nao a sugerida"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cliente com frequencia 'nenhuma' ou legado sem frequencia definida: conclui a visita normalmente e nenhuma proxima e criada, mesmo enviando data — a leitura da frequencia acontece dentro da RPC, nunca confia no parametro do navegador"
    requirement: "VIS-03"
    verification:
      - kind: integration
        ref: "tests/agenda/concluir-rpc.test.ts#nenhuma / #semfrequencia"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cliente com frequencia real e sem data confirmada: a conclusao e recusada (falha alta, nunca um pulo silencioso da proxima visita)"
    requirement: "VIS-03"
    verification:
      - kind: integration
        ref: "tests/agenda/concluir-rpc.test.ts#semdata"
        status: pass
    human_judgment: false
  - id: D7
    description: "agenda_do_vendedor() recriada (drop + create, exatamente 1 drop) com 10 colunas de saida — frequencia_visita e proxima_data_sugerida calculadas no banco via proxima_data_visita (autoridade unica, nao redefinida), mesma RLS/mesma ordenacao/mesmos filtros de pendencia da 0014"
    requirement: "VIS-03"
    verification:
      - kind: integration
        ref: "tests/agenda/concluir-rpc.test.ts#sugerida: coluna coerente para visita (mensal = +1 mes), vazia para prospeccao"
        status: pass
      - kind: integration
        ref: "tests/agenda/agenda-rpc.test.ts + tests/agenda/rls-agenda.test.ts: 19/19 verdes pos-recriacao, sem regressao de formato/ordenacao/RLS"
        status: pass
    human_judgment: false
  - id: D8
    description: "Matematica de fim de mes (Pitfall 1): mensal a partir de 31/jan cai em 28/fev (ano comum) e 29/fev (bissexto); proxima_data_visita da Fase 13 nao foi redefinida, apenas chamada"
    verification:
      - kind: integration
        ref: "tests/agenda/proxima-data.test.ts (5/5: mensal, bissexto, semanal, quinzenal, nenhuma)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Migration 0015 aplicada no projeto Supabase hospedado (producao) via supabase db push, com aprovacao humana previa no checkpoint bloqueante do Task 2 (3 pontos de decisao respondidos explicitamente pelo dono)"
    verification:
      - kind: manual_procedural
        ref: "checkpoint Task 2 aprovado pelo dono do projeto; push executado pelo orquestrador (fora deste worktree, por restricao do classificador de seguranca do harness) — saida {\"upToDate\":false,\"dryRun\":false,\"migrations\":[\"0015_conclusao_com_resumo.sql\"],\"message\":\"Finished supabase db push.\"} sem erros; confirmado indiretamente pelos 34 testes novos rodando GREEN contra o banco real logo em seguida"
        status: pass
    human_judgment: true
    rationale: "Aplicacao em producao ja teve aprovacao humana explicita no checkpoint bloqueante do Task 2, incluindo os 3 pontos de decisao de produto — registrado aqui so para rastreabilidade, nao e um novo pedido de julgamento."

# Metrics
duration: ~35min
completed: 2026-08-09
status: complete
---

# Phase 15 Plan 1: Camada de Banco (Conclusão com Resumo e Próxima Visita) Summary

**Migration 0015 aplicada em produção: coluna `resumo` em `tarefas`, gatilhos de auditoria estendidos, RPCs atômicas `concluir_tarefa_prospeccao`/`concluir_visita` sem elevação de privilégio, e `agenda_do_vendedor()` recriada com `frequencia_visita` + `proxima_data_sugerida` calculadas no banco.**

## Performance

- **Duration:** ~35 min (Task 1 + checkpoint humano + Task 3, incluindo um retry isolado de `tests/clientes/rls-visitas.test.ts` por rate-limit de Auth já documentado)
- **Started:** 2026-08-09T01:38:00Z (aprox.)
- **Completed:** 2026-08-09T02:07:00Z
- **Tasks:** 3 (Task 1 auto, Task 2 checkpoint humano, Task 3 auto)
- **Files modified:** 4 (1 migration + 3 arquivos de teste)

## Accomplishments
- Migration `0015_conclusao_com_resumo.sql` escrita e aplicada no projeto Supabase hospedado (produção), com aprovação humana prévia no checkpoint bloqueante do Task 2
- `tarefas.resumo` (nullable) + `chk_tarefas_resumo_tamanho`/`chk_visitas_resumo_tamanho` (10..500 caracteres, `NOT VALID` + validação best-effort), mesmo padrão da migration 0007
- `tarefas_before_update_historico()` recriada e `visitas_after_update_historico()` nova (+ gatilho `trg_visitas_after_update_historico`) — o resumo do vendedor chega ao histórico do cliente automaticamente, sem prefixo, com autor e data; o caminho antigo (concluir tarefa pela ficha do cliente, sem resumo) continua funcionando com o texto genérico de fallback
- `concluir_tarefa_prospeccao(uuid, text)` e `concluir_visita(uuid, text, date)` — as duas únicas RPCs de conclusão do projeto, atômicas, SEM cláusula de elevação de privilégio; falham fechado por RLS (não por checagem de papel escrita à mão) quando o item não pertence ao chamador
- `agenda_do_vendedor()` recriada (drop + create explícito, exatamente 1 drop) com as 8 colunas anteriores + `frequencia_visita` + `proxima_data_sugerida`, calculadas reusando `proxima_data_visita` da Fase 13 — autoridade única do cálculo de data continua sendo uma só no projeto
- Regra de negócio "cliente sem cadência não gera próxima visita" e "cliente com cadência real precisa de data confirmada" impostas dentro da RPC, lendo a frequência da própria tabela `clientes` — nunca confiando no parâmetro do navegador
- 3 arquivos de teste novos, 34/34 testes GREEN contra o banco real: `proxima-data.test.ts` (5), `concluir-rpc.test.ts` (18), `rls-conclusao.test.ts` (3) — mais alguns casos auxiliares
- Regressão: `agenda-rpc.test.ts` + `rls-agenda.test.ts` (19/19), `funil-status.test.ts` + `frequencia-visita.test.ts` (27/27), `funil-constraints.test.ts` (9/9, isolado), `rls-visitas.test.ts` (11/11, isolado após cooldown de rate-limit) — **100% verde, zero regressão**

## Task Commits

Each task was committed atomically:

1. **Task 1: Escrever a migration da conclusão e os três arquivos de teste de integração (RED)** - `0bb4a00` (feat)
2. **Task 2: Aprovação humana — checkpoint** - sem commit de código (aprovação registrada; 3 pontos de decisão respondidos pelo dono)
3. **Task 3: Aplicar a migration (supabase db push) e levar os testes a GREEN** - sem commit de código novo (push é operação de infraestrutura executada pelo orquestrador fora deste worktree, por restrição do classificador de segurança do harness sobre push de produção rodado por subagente; migration já commitada no Task 1)

**Plan metadata:** commit deste SUMMARY.md (docs)

## Files Created/Modified
- `supabase/migrations/0015_conclusao_com_resumo.sql` - coluna `tarefas.resumo`, 2 constraints de tamanho, gatilho de tarefas recriado, gatilho de visitas novo, `concluir_tarefa_prospeccao`, `concluir_visita`, `agenda_do_vendedor()` recriada (10 colunas)
- `tests/agenda/proxima-data.test.ts` - matemática de fim de mês (mensal/bissexto/semanal/quinzenal/nenhuma) contra `proxima_data_visita`
- `tests/agenda/concluir-rpc.test.ts` - obrigatoriedade do resumo, atomicidade, histórico, próxima visita com data exata, guarda de "nenhuma"/sem frequência, falha alta sem data, colunas de sugestão, idempotência
- `tests/agenda/rls-conclusao.test.ts` - autorização cruzada das duas RPCs de conclusão (vendedor alheio recusado, supervisor autorizado e vira autor, anônimo recusado)

## Decisions Made

**Os 3 pontos de decisão do checkpoint do Task 2, respondidos explicitamente pelo dono do projeto:**

1. **Caixinha antiga de concluir tarefa na ficha do cliente (sem pedir resumo):** fica como está por agora. Esta fase não bloqueia esse caminho — ele continua concluindo tarefas sem exigir resumo. O tratamento definitivo fica para a Fase 16 (reforma da ficha do cliente). Até lá, existe conscientemente um caminho paralelo de conclusão sem resumo; a obrigatoriedade do CONC-01 vale para quem conclui pela tela da Agenda (Plano 15-03).
2. **Texto do histórico:** sem prefixo — o resumo escrito pelo vendedor entra puro na coluna `descricao` do histórico (não "Visita concluída: ..."). Decisão irreversível para linhas já gravadas a partir de agora.
3. **Data no passado para a próxima visita:** permitida — registrar uma visita com atraso (escolhendo uma data já passada para a próxima) é intencional; a RPC não valida `p_proxima_data >= hoje`.

Um quarto ponto do checkpoint (cliente sem frequência de visita não gera próxima visita) já estava descrito no `what-built` original e não gerou objeção — comportamento confirmado como esperado, sem mudança.

**Outras decisões técnicas:**
- Supabase CLI pinado em `2.111.0` para este push (mesmo pin da Fase 13 — `npx supabase` sem versão resolve para `2.112.0`, que tem bug de validação de schema em link/API keys).
- `REQUIREMENTS.md` mantém CONC-01/VIS-03 como "Pending" após este plano — mesma convenção já usada em `09-01-SUMMARY.md` para LOC-01/02/04: a camada de banco está completa e provada, mas o comportamento do usuário final só fica completo depois de 15-02 (server actions/validação compartilhada) e 15-03 (diálogo `ConcluirItemDialog`).

## Deviations from Plan

None - plan executado exatamente como escrito. O SQL da migration segue a estrutura numerada do plano (banner → coluna → constraints → gatilho de tarefas recriado → gatilho de visitas novo → `concluir_tarefa_prospeccao` → `concluir_visita` → `agenda_do_vendedor` recriada), e todo o check estrutural mecânico do Task 1 (extração de blocos de função por regex, contagem de inserts em `historico`, contagem de drops, ausência de `security definer`/`is_supervisor`/`historico` no corpo das 3 funções chamáveis pelo app) passou na primeira tentativa.

## Issues Encountered

**Rate limit de `signInWithPassword` na suíte de regressão (mesmo blocker documentado desde a Fase 6-03/13-01) — não é regressão desta migration.**

Ao rodar a regressão em um único lote (`funil-status` + `funil-constraints` + `rls-visitas` + `frequencia-visita`), 12 dos 47 testes falharam com `Error: signInAs(...) failed: Request rate limit reached` — 100% das falhas com essa mensagem exata, zero falha de asserção de schema/RPC. `tests/clientes/rls-visitas.test.ts` chama `signInAs` dentro de cada `it()` (padrão pré-existente da Fase 13, fora do escopo deste plano para refatorar), o que consome cota de login mais rápido que os arquivos mais novos que logam uma vez em `beforeAll`.

**Mitigação:** isolado cada arquivo problemático em execução própria — `funil-constraints.test.ts` sozinho passou 9/9 de primeira; `rls-visitas.test.ts` sozinho ainda bateu rate limit (7/11 falharam, mesma causa), então aguardei um cooldown (~2min) antes de reexecutar isolado, e todos os 11 casos passaram limpos. Resultado final: **47/47 testes de regressão verdes**, cobrindo especificamente as áreas de risco desta migration (RLS de `visitas`, constraints de `tarefas`/funil, `agenda_do_vendedor()` recriada, `frequencia_visita`).

## User Setup Required

None - nenhuma configuração de serviço externo necessária além do que já estava documentado (Supabase CLI já linkado ao projeto, `.env.local` já presente). O orquestrador precisou copiar `supabase/.temp` e `.env.local` do checkout principal para este worktree antes do push (arquivos ausentes por padrão em worktrees novos) — nenhuma ação nova do dono do projeto foi necessária.

## Next Phase Readiness

- A camada de banco da Conclusão com Resumo e Próxima Visita está pronta e em produção: `concluir_tarefa_prospeccao`, `concluir_visita` e `agenda_do_vendedor()` (10 colunas) já podem ser consumidos pelo frontend.
- **Contrato para os Planos 15-02/15-03 (conforme `artifacts_produced` do plano):** as duas RPCs acima são os ÚNICOS caminhos de conclusão permitidos — nenhum plano futuro pode escrever direto em `tarefas`/`visitas` para concluir, nem escrever na tabela `historico`. Limites do resumo travados no banco em 10..500 caracteres (o Plano 15-02 deve espelhar exatamente esses números no schema de validação compartilhado). A coluna `proxima_data_sugerida` já vem calculada — o Plano 15-03 nunca deve refazer essa conta no navegador.
- **Aviso operacional herdado do checkpoint:** a caixinha de concluir tarefa direto pela ficha do cliente continua funcionando sem exigir resumo — decisão consciente do dono, revisitar na Fase 16.
- Planos 15-02 (server actions + validação compartilhada) e 15-03 (`ConcluirItemDialog` na tela da Agenda) podem começar — ambos dependem só do que este plano entregou.

---
*Phase: 15-conclus-o-com-resumo-e-pr-xima-visita*
*Completed: 2026-08-09*
