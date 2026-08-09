---
phase: 16-ficha-do-cliente-ativo-campos-e-di-rio
plan: 04
subsystem: ui
tags: [nextjs, react-hook-form, shadcn, base-ui, vitest]

# Dependency graph
requires:
  - phase: 16-ficha-do-cliente-ativo-campos-e-di-rio (plan 02)
    provides: "getFrequenciasPedido() — leitor ATIVO-only do vocabulário de frequência de pedidos, alimenta o Select da ficha"
  - phase: 16-ficha-do-cliente-ativo-campos-e-di-rio (plan 03)
    provides: "ClienteDetalhe.nomeFantasia/cnpj/frequenciaPedidos, updateClienteSchema com os três campos, updateCliente com gravação condicional, getDiario()/getDiarioAction()"
provides:
  - "components/clientes/DiarioTimeline.tsx — componente de leitura pura do diário, irmão estrutural de HistoricoTimeline"
  - "Três campos condicionais (Nome fantasia/CNPJ/Frequência de pedidos) na ficha do cliente, renderizados só quando statusAcompanhamento === 'ganho', salvos pelo botão 'Salvar alterações' existente"
  - "Seção 'Diário' na ficha do cliente, abaixo de 'Histórico', para qualquer status, recarregada nos mesmos pontos em que o histórico já é"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Campo condicional ao status 'ganho' dentro do formulário react-hook-form segue o molde literal do bloco de Frequência de visita já existente: mesma expressão de condição, valores sempre presentes no formulário (mesmo quando não renderizados) para que salvar um cliente não-ganho nunca apague o dado já guardado"
    - "Recarga de uma segunda trilha derivada da mesma tabela historico (Diário) é uma função irmã (refreshDiario) chamada nos MESMOS pontos que a função já existente (refreshHistorico), nunca um filtro client-side sobre o array já carregado"
    - "Estado por-cliente (diario) entra no bloco de reset de fechamento do Sheet como uma linha a mais; estado de catálogo global (frequenciasPedido) fica fora desse bloco, mesmo precedente já usado por tiposTarefa"

key-files:
  created:
    - components/clientes/DiarioTimeline.tsx
    - tests/clientes/diario-timeline.test.tsx
  modified:
    - components/clientes/ClienteDetailSheet.tsx

key-decisions:
  - "D1 (UI-SPEC, carregado do checkpoint da Fase 15): a caixinha de concluir tarefa dentro da própria ficha continua sem pedir resumo — o Diário renderiza o texto genérico gravado pelo trigger ('Tarefa marcada como concluída') igual a um resumo real, sem aviso de 'faltando resumo' e sem caso especial. Confirmado ao vivo pelo dono no checkpoint humano contra o cliente-fixture Padaria Teste Ltda."
  - "Frequência de pedidos é campo comum de react-hook-form, salvo só pelo botão 'Salvar alterações' — deliberadamente SEM escrita imediata dedicada, ao contrário da Frequência de VISITA (que salva na hora via atualizarFrequenciaVisita). Comentário no código alerta sobre a proximidade dos dois nomes."
  - "Estado de vocabulário vazio da Frequência de pedidos usa o mesmo tratamento textual que o bloco de Produtos consumidos já usa ('Nenhuma frequência cadastrada ainda.') em vez de renderizar um Select sem opções."

patterns-established: []

requirements-completed: [ATV-01, ATV-02, DIAR-01]

coverage:
  - id: D1
    description: "DiarioTimeline.tsx — componente de leitura pura, zero controle de escrita, copy e formato de data exatos do contrato, dois selos reusados verbatim de AgendaItemRow"
    requirement: DIAR-01
    verification:
      - kind: unit
        ref: "tests/clientes/diario-timeline.test.tsx — 8 casos (vazio/prospeccao/visita/data/resumo/autor/autornulo/ordem)"
        status: pass
      - kind: other
        ref: "node -e check estrutural do plano (Task 1): zero onClick/onChange/onSubmit/Button/useState/useEffect, zero new Date(), zero .sort(), zero createClient/supabase no componente"
        status: pass
    human_judgment: false
  - id: D2
    description: "Três campos condicionais (Nome fantasia/CNPJ/Frequência de pedidos) aparecem só em cliente ganho, nunca no cadastro rápido, e são salvos pelo caminho de gravação existente sem escrita imediata"
    requirement: ATV-01
    verification:
      - kind: other
        ref: "node -e check estrutural do plano (Task 2): git diff vazio para ClienteQuickCreateForm.tsx/HistoricoTimeline.tsx/KanbanBoard.tsx/ClienteCard.tsx/migrations; copy exata; posição entre numeroDeLojas e Funil; 2 supressões de lint; 1 useEffect"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3), passos 3-4, 7, 12, 14 — confirmado pelo dono ao vivo no navegador contra Padaria Teste Ltda (não-ganho): os três campos não aparecem"
        status: pass
    human_judgment: true
    rationale: "Preenchimento/salvamento dos três campos num cliente GANHO real não foi exercitado ao vivo pelo dono (evitou alterar o status do único cliente-fixture disponível) — cobertura desse caminho específico apoiada em revisão de código da condicional + nos 40 testes automatizados já verdes de 16-01/16-02/16-03 (cliente-ativo-campos.test.ts, frequencias-pedido-catalogo.test.ts, rls-frequencias-pedido.test.ts), não em observação visual direta do salvamento."
  - id: D3
    description: "Frequência de pedidos é Select alimentado pelo vocabulário do Supervisor, com texto de apoio sempre visível e sem efeito colateral na Agenda"
    requirement: ATV-02
    verification:
      - kind: other
        ref: "node -e check estrutural do plano (Task 2): items explícito no Select (frequenciasPedido.map), ausência de atualizarFrequenciaPedidos/salvarFrequenciaPedidos"
        status: pass
    human_judgment: true
    rationale: "'Nada aparece na Agenda por causa da frequência de pedidos' e 'a frase de apoio fica sempre visível' são julgamentos visuais que só o checkpoint humano prova — não incluídos no roteiro ao vivo do dono desta rodada (ele focou no Diário), permanecem cobertos pela leitura de código do handler (sem chamada de escrita dedicada) e pelo texto fixo no JSX."
  - id: D4
    description: "Seção Diário renderiza para qualquer cliente (não só ganho), aparece depois do Histórico que continua intacto, mostra entradas reais com selo/data/autor mais recente primeiro, e se atualiza sem fechar a gaveta"
    requirement: DIAR-01
    verification:
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3) — dono abriu Padaria Teste Ltda (em andamento, não-ganho) ao vivo e confirmou: Diário aparece após Histórico; 3 entradas corretas (1 resumo real de visita + 2 legadas com texto genérico), ordenadas mais recente primeiro; nenhum evento de mudança de etapa/status vazou para o Diário"
        status: pass
    human_judgment: true
    rationale: "Confirmação visual direta contra dado real de produção — não substituível por teste automatizado."

# Metrics
duration: ~35min (esta continuação — Task 1 foi commitado numa tentativa anterior com worktree interrompido)
completed: 2026-08-09
status: complete
---

# Phase 16 Plan 04: Ficha do Cliente Ativo — Campos e Diário (Tela) Summary

**Três campos condicionais (Nome fantasia/CNPJ/Frequência de pedidos) e uma seção "Diário" de leitura pura, ambos wireados em `ClienteDetailSheet.tsx` sem piorar a supressão de lint documentada do arquivo — fecha o marco v1.3 inteiro.**

## Performance

- **Duration:** ~35 min (Task 2 + Task 3 desta continuação; Task 1 foi executado e commitado numa sessão anterior interrompida)
- **Completed:** 2026-08-09
- **Tasks:** 3/3 (Task 1 verificado como já correto e reaproveitado; Task 2 executado nesta sessão; Task 3 checkpoint humano aprovado)
- **Files modified:** 3 (`components/clientes/DiarioTimeline.tsx` novo, `tests/clientes/diario-timeline.test.tsx` novo — ambos do Task 1 já commitado — e `components/clientes/ClienteDetailSheet.tsx` modificado nesta sessão)

## Accomplishments

- `DiarioTimeline.tsx` — componente de leitura pura, sem nenhum controle de escrita, reusando exatamente os selos "Prospecção"/"Visita" de `AgendaItemRow.tsx` e o formato de data de `HistoricoTimeline.tsx`; 8/8 testes de renderização verdes.
- Ficha do cliente (`ClienteDetailSheet.tsx`) ganhou os três campos condicionais ao status "ganho" (Nome fantasia, CNPJ, Frequência de pedidos), preservando o cadastro rápido literalmente intocado.
- Nova seção "Diário" logo abaixo de "Histórico", alimentada por `getDiarioAction`, recarregada nos mesmos pontos em que o histórico já é (conclusão de status, conclusão de tarefa pela caixinha).
- O arquivo mais delicado do codebase saiu da fase com exatamente as mesmas 2 supressões de lint e 1 único `useEffect` de antes — nenhum débito novo.
- Checkpoint humano aprovado com verificação ao vivo do Diário contra dado real de produção (cliente "Padaria Teste Ltda").
- ATV-01, ATV-02 e DIAR-01 marcados completos em `REQUIREMENTS.md` — fecham o marco v1.3 inteiro (Fases 13-16 concluídas; só a Fase 17 resta).

## Task Commits

1. **Task 1: Componente de leitura do diário** — `eddfeac` (feat) — commitado numa sessão anterior (worktree interrompido), verificado como correto no início desta continuação, não refeito.
2. **Task 2: Os três campos condicionais e a seção Diário na ficha do cliente** — `6be40dc` (feat)
3. **Task 3: Verificação humana no navegador** — checkpoint aprovado pelo dono do projeto, sem commit de código (só a aprovação).

**Plan metadata:** commit deste SUMMARY (docs)

## Files Created/Modified

- `components/clientes/DiarioTimeline.tsx` — componente de leitura do diário (Task 1, sessão anterior)
- `tests/clientes/diario-timeline.test.tsx` — 8 testes de renderização (Task 1, sessão anterior)
- `components/clientes/ClienteDetailSheet.tsx` — três campos condicionais + seção Diário + duas buscas independentes + `refreshDiario()` (Task 2, esta sessão)

## Decisions Made

- Ver `key-decisions` no frontmatter: D1 (caixinha de concluir tarefa sem resumo, confirmada ao vivo), postura de escrita não-imediata da frequência de pedidos, e tratamento textual do vocabulário vazio.
- Nenhuma mudança de rótulo foi pedida pelo dono no ponto #1 do checkpoint (nomes "Frequência de pedidos" vs "Frequência de visita") — aprovado como está.

## Deviations from Plan

None — plano executado exatamente como escrito. Task 1 já estava commitado (`eddfeac`) por uma tentativa anterior com worktree interrompido; verificado como correto (tsc/lint/vitest 8/8 verdes) antes de prosseguir para o Task 2, sem refazer o trabalho.

## Issues Encountered

- Uma iteração de correção: o texto de apoio da Frequência de pedidos (`Informação de apoio — não gera alerta, cobrança ou tarefa na Agenda.`) foi digitado inicialmente quebrado em duas linhas no JSX, o que preservava a renderização visual (JSX colapsa espaço em branco) mas fazia o check mecânico de string literal falhar por não encontrar a substring exata no código-fonte. Corrigido para uma linha única antes do commit — nenhum impacto no comportamento em tela, só no código-fonte.

## User Setup Required

None — nenhuma configuração externa necessária.

## Next Phase Readiness

- Fase 16 completa. Marco v1.3 (Agenda do Vendedor) com 4 das 5 fases concluídas — só a Fase 17 (Planilhas — Frequência em Massa e Exportação do Diário) resta.
- IMP-01 (definição de frequência de visita em massa) e IMP-02 (exportação do diário) seguem como escopo explícito da Fase 17, não tocados aqui.
- Débito aberto, não piorado: a supressão de lint documentada em `ClienteDetailSheet.tsx` (`react-hooks/set-state-in-effect`) continua suprimida, não corrigida — ver `.planning/STATE.md` Deferred Items.

---
*Phase: 16-ficha-do-cliente-ativo-campos-e-di-rio*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: components/clientes/DiarioTimeline.tsx
- FOUND: tests/clientes/diario-timeline.test.tsx
- FOUND: components/clientes/ClienteDetailSheet.tsx
- FOUND: .planning/phases/16-ficha-do-cliente-ativo-campos-e-di-rio/16-04-SUMMARY.md
- FOUND commit: eddfeac
- FOUND commit: 6be40dc
