---
phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas
plan: 04
subsystem: ui
tags: [react, typescript, nextjs, server-actions, supabase, date-fns, agenda, calendar]

requires:
  - phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas
    provides: "agenda_concluidos_do_vendedor(p_inicio, p_fim) no banco (21-01); estaAtrasado/mesclarAgenda/intervaloDeHistorico/validarIntervaloHistorico puros (21-02); tratamento visual de item.concluido nos cinco componentes de apresentação (21-03)"
provides:
  - "getAgendaConcluidos(inicio, fim) — leitor tipado que reusa o mapRow único de getAgenda(), marcando cada linha concluido: true"
  - "getAgendaConcluidosAction(inicio, fim) — ação de servidor com guarda de intervalo (validarIntervaloHistorico) aplicada ANTES de qualquer ida ao banco"
  - "AgendaCalendario com a propriedade vendedorFiltroId, buscando o histórico do período visível, filtrando-o e mesclando-o com os pendentes uma única vez"
  - "AgendaList repassando vendedorFiltroId ao calendário — única alteração no arquivo"
  - "Fase 21 (AGD-13) encerrada: calendário mostra o que já foi feito em datas passadas, aprovado pelo dono do projeto no navegador"
affects: []

tech-stack:
  added: []
  patterns:
    - "Efeito de busca com dependências em DOIS TEXTOS de intervalo (nunca o objeto nem a data de referência) — o mesmo padrão de comparação-por-string que bucketDoItem/agruparPorData já usam para evitar o bug de fuso, aplicado agora à identidade de dependência de useEffect"
    - "Segunda fonte de dado filtrada pela MESMA função de filtro (filtrarPorVendedor) aplicada à primeira, dentro do componente que a busca — nunca uma segunda autoridade de filtro"
    - "Reversão deliberada e documentada de uma regra de fase anterior (T-20-10, 'sem leitura de dado neste componente'), escopada a uma única responsabilidade nova, com o comentário de cabeçalho atualizado explicando o porquê"

key-files:
  created:
    - tests/agenda/agenda-calendario-historico.test.tsx
  modified:
    - lib/supabase/queries/agenda.ts
    - app/actions/agenda.ts
    - components/agenda/AgendaCalendario.tsx
    - components/agenda/AgendaList.tsx
    - tests/agenda/agenda-calendario.test.tsx
    - tests/agenda/agenda-list.test.tsx
    - tests/agenda/agenda-calendario-integracao.test.tsx

key-decisions:
  - "AgendaCalendario.tsx passa a ser dona de uma segunda leitura (o histórico limitado ao período visível), revertendo de propósito a regra 'sem leitura de dado' que a Fase 20 escreveu no cabeçalho do arquivo — decisão travada no bloco <reversao_deliberada> do plano, já que só este componente possui o estado de período visível (referência + modo) necessário para calcular o intervalo"
  - "O efeito de busca depende de dois textos de intervalo (início/fim), nunca do objeto de intervalo nem da data de referência/now — os dois últimos são recriados a cada render e transformariam navegação normal numa enxurrada de pedidos ao servidor (T-21-13)"
  - "O filtro de vendedor é aplicado dentro do contêiner também sobre o histórico buscado, com a MESMA função filtrarPorVendedor que a tela já aplica aos pendentes — nunca uma segunda autoridade de filtro (T-21-14)"
  - "vendedorFiltroId é opcional com padrão null (não obrigatório) para que tests/agenda/agenda-calendario.test.tsx (herdado da Fase 20) não precisasse de nenhuma edição além do dublê de módulo — só a única alteração permitida no arquivo"

requirements-completed: [AGD-13]

coverage:
  - id: D1
    description: "Navegar para um período passado do calendário busca o histórico do banco (getAgendaConcluidos/getAgendaConcluidosAction) e mescla com os pendentes, mostrando o item concluído no dia certo"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-historico.test.tsx#AgendaCalendario — histórico do período visível (AGD-13, Fase 21) > os itens concluídos recebidos aparecem na grade no dia da conclusão"
        status: pass
    human_judgment: false
  - id: D2
    description: "A guarda de intervalo (validarIntervaloHistorico) é aplicada na ação de servidor ANTES de qualquer ida ao banco, e a busca no contêiner nunca dispara sem período (Lista) nem quando nada estritamente passado está visível"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-historico.test.tsx#AgendaCalendario — histórico do período visível (AGD-13, Fase 21) > visão Lista: nenhuma busca de histórico acontece"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-historico.test.tsx#AgendaCalendario — histórico do período visível (AGD-13, Fase 21) > hoje: nada estritamente passado visível, nenhuma busca"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-historico.test.tsx#AgendaCalendario — histórico do período visível (AGD-13, Fase 21) > um mês passado (o mês em curso, que contém dias antes de hoje) dispara exatamente uma busca, com o intervalo exato"
        status: pass
    human_judgment: false
  - id: D3
    description: "Navegar para outro período dispara uma nova busca com o intervalo novo; um re-render sem mudança de período não dispara busca duplicada (dependências de efeito são texto, não objeto)"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-historico.test.tsx#AgendaCalendario — histórico do período visível (AGD-13, Fase 21) > navegar para outro período dispara exatamente uma busca nova, com o intervalo novo"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-historico.test.tsx#AgendaCalendario — histórico do período visível (AGD-13, Fase 21) > re-render sem mudança de período não dispara busca nova (dependências são texto, não objeto)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O filtro de vendedor estreita também os itens concluídos, sem exigir uma segunda busca"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-historico.test.tsx#AgendaCalendario — histórico do período visível (AGD-13, Fase 21) > trocar o vendedor filtrado estreita também os concluídos"
        status: pass
    human_judgment: false
  - id: D5
    description: "Uma falha ao carregar o histórico mantém os pendentes visíveis e mostra um aviso curto, sem derrubar a tela"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-historico.test.tsx#AgendaCalendario — histórico do período visível (AGD-13, Fase 21) > uma resposta de erro mantém os pendentes visíveis e mostra o aviso"
        status: pass
    human_judgment: false
  - id: D6
    description: "A Lista, a contagem do selo do menu e os testes herdados da Fase 20 (agenda-list, agenda-calendario-integracao) continuam com o mesmo comportamento — prova negativa"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-list.test.tsx (diff de 1 linha — só o dublê da função nova; zero caso editado)"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-integracao.test.tsx (diff de 1 linha — só o dublê; zero caso editado; 8 casos verdes)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Verificação humana no navegador: os cinco critérios de sucesso do ROADMAP da Fase 21 confirmados a olho pelo dono do projeto (roteiro de 12 passos)"
    verification: []
    human_judgment: true
    rationale: "Julgamento visual/funcional no navegador real — item concluído distinto, sem botão de concluir, abre a ficha do cliente, dia sem atividade aparece vazio sem erro, navegação imediata. Não automatizável por teste unitário; conduzido com dados semeados via service-role client (ZZ-TESTE 21-04 *, apagados após a aprovação) e aprovado pelo dono do projeto: 'tudo certo'."

duration: ~25min
completed: 2026-08-18
status: complete
---

# Phase 21 Plan 04: Fiação do histórico no calendário + verificação humana Summary

**`AgendaCalendario.tsx` passa a buscar o histórico (itens já concluídos) do período visível via `getAgendaConcluidosAction`, filtra-o pelo mesmo vendedor que os pendentes já usam, mescla as duas fontes uma única vez e agrupa o resultado — encerrando a Fase 21 com aprovação do dono do projeto no navegador ("tudo certo").**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-18
- **Tasks:** 3/3
- **Files modified:** 7 (1 criado — teste novo; 6 modificados)

## Accomplishments

- `lib/supabase/queries/agenda.ts` ganha `getAgendaConcluidos(inicio, fim)`, reusando o mesmo `mapRow` de `getAgenda()` e marcando cada item `concluido: true` — o único lugar do projeto que faz essa marcação
- `app/actions/agenda.ts` ganha `getAgendaConcluidosAction(inicio, fim)`, que confere sessão e aplica `validarIntervaloHistorico` ANTES de qualquer ida ao banco (guarda de recurso, não de autorização), sem revalidar rota (leitura pura)
- `AgendaCalendario.tsx` ganha a propriedade `vendedorFiltroId` e passa a buscar o histórico do período visível (`intervaloDeHistorico`), com o efeito dependendo só de dois textos de intervalo — nunca do objeto nem da data de referência, que são recriados a cada render (T-21-13). O histórico é filtrado pela mesma `filtrarPorVendedor` que os pendentes já usam e mesclado uma única vez (`mesclarAgenda`) antes do agrupamento por data
- Uma falha na busca do histórico mostra um aviso curto ("Não foi possível carregar o histórico deste período.") sem derrubar a grade de pendentes
- `AgendaList.tsx` repassa `vendedorFiltroId` ao calendário — única alteração permitida no arquivo, diff de 7 linhas
- `tests/agenda/agenda-list.test.tsx` e `tests/agenda/agenda-calendario-integracao.test.tsx` (herdados da Fase 20) recebem cada um exatamente uma linha nova (o dublê da função nova) — zero caso ou asserção editados, prova negativa preservada
- `tests/agenda/agenda-calendario-historico.test.tsx` (novo) — 12 casos cobrindo as não-buscas (Lista, hoje, amanhã, semana/mês futuros), a busca exata de um período passado (intervalo conferido, não só contagem), a nova busca ao navegar, a ausência de busca duplicada num re-render sem mudança de período, o merge visível na grade, o filtro de vendedor sobre a segunda fonte, e o caminho de erro
- Verificação humana no navegador conduzida com dados reais semeados via service-role client (5 clientes `ZZ-TESTE 21-04 *`: tarefa concluída, visita concluída, um dia com pendente+concluído juntos, e um item de Vendedor B) — **aprovada pelo dono do projeto: "tudo certo"**
- `AGD-13` marcado completo em `REQUIREMENTS.md` — Fase 21 encerrada

## Task Commits

1. **Task 1: Leitor tipado da leitura histórica e ação de servidor com guarda de intervalo** - `d553279` (feat)
2. **Task 2: O calendário busca o histórico do período visível, aplica o filtro e mescla uma vez só**
   - `1b87396` (test) — casos falhando de `agenda-calendario-historico.test.tsx` + dublê acrescentado a `agenda-calendario.test.tsx`
   - `ee08773` (feat) — implementação em `AgendaCalendario.tsx`
3. **Task 3: Fiação na tela, provas negativas da Fase 20 e verificação humana no navegador** - `41e61b2` (feat) — sem commit adicional para a verificação humana em si (checagem de regressão + roteiro no navegador, dados semeados/apagados via script fora do controle de versão)

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/supabase/queries/agenda.ts` - `getAgendaConcluidos(inicio, fim)` acrescentada; `getAgenda`/`getAgendaPendentesCount` intocadas
- `app/actions/agenda.ts` - `AgendaConcluidosErrorCode`/`GetAgendaConcluidosResult`/`getAgendaConcluidosAction` acrescentados ao final; `getAgendaAction`/`concluirTarefaProspeccao`/`concluirVisita` intocadas
- `components/agenda/AgendaCalendario.tsx` - propriedade `vendedorFiltroId`, dois estados novos (`concluidos`/`historicoFalhou`), efeito de busca por intervalo, filtro + mescla + agrupamento únicos, aviso de falha, comentário de cabeçalho reescrito (ver `<reversao_deliberada>`)
- `components/agenda/AgendaList.tsx` - repasse de `vendedorFiltroId={vendedorFiltroId}` ao `AgendaCalendario`; nada mais mudou
- `tests/agenda/agenda-calendario-historico.test.tsx` - **novo**, 12 casos
- `tests/agenda/agenda-calendario.test.tsx` - dublê de `app/actions/agenda` acrescentado no topo; nenhum caso editado
- `tests/agenda/agenda-list.test.tsx` - 1 linha acrescentada ao dublê existente (`getAgendaConcluidosAction`)
- `tests/agenda/agenda-calendario-integracao.test.tsx` - 1 linha acrescentada ao dublê existente

## Decisions Made

- `AgendaCalendario.tsx` passa a ser dona de uma segunda leitura (o histórico), revertendo de propósito a regra "sem leitura de dado" que a Fase 20 escreveu no cabeçalho — só este componente possui o estado de período visível necessário para calcular o intervalo; subir a busca para a tela exigiria subir também `referencia`/`modo`, reabrindo a fiação que a Fase 20 já entregou e que o dono do projeto já verificou (proibido por D-01)
- Dependências do efeito de busca: dois textos de intervalo (início/fim), nunca o objeto nem a data de referência/now — ambos recriados a cada render, o que causaria uma enxurrada de pedidos ao servidor a cada navegação (T-21-13)
- Filtro de vendedor aplicado ao histórico DENTRO do contêiner, com a mesma `filtrarPorVendedor` que a tela já aplica aos pendentes — nunca uma segunda autoridade de filtro (T-21-14)
- `vendedorFiltroId` opcional com padrão `null`, para que `tests/agenda/agenda-calendario.test.tsx` (herdado da Fase 20, que não passa essa propriedade) continuasse tipando e passando sem nenhuma edição além do dublê de módulo

## Deviations from Plan

### Auto-fixed Issues

Nenhuma — plano executado como escrito, sem bugs, funcionalidade ausente crítica, ou bloqueio que exigisse as Regras 1-3.

### Nota sobre o script de verificação automática do Task 3

A checagem estrutural do Task 3 embutida no plano conta ocorrências textuais de `getAgendaAction(` (com parênteses) no arquivo inteiro, incluindo comentários de documentação — não só chamadas de função reais. `components/agenda/AgendaList.tsx` já tinha, ANTES deste plano (desde a Fase 14), uma frase de comentário no cabeçalho do arquivo mencionando `` `getAgendaAction()` `` em prosa, além da chamada real dentro do `useEffect`. Isso faz o regex do script contar 2 ocorrências e falhar, mesmo com a invariante real (uma única chamada de busca de pendentes) preservada e não tocada por este plano — confirmado manualmente com `grep -n "getAgendaAction()"`, que mostra a linha de comentário (55) e a chamada real (124), e com `git diff` mostrando que a seção do comentário nunca foi tocada. O plano restringe explicitamente este arquivo a "só o repasse da propriedade nova" — editar o comentário para escapar do regex sairia desse escopo declarado, então o comentário foi deixado como estava e esta divergência do script (não do código) é documentada aqui em vez de corrigida. Todas as demais checagens estruturais do Task 3 passaram sem ressalva.

---

**Total deviations:** 0 auto-fixes de código; 1 nota documentando um falso positivo no próprio script de verificação do plano (comentário de prosa pré-existente contando como "chamada").
**Impact on plan:** Nenhum impacto funcional — a invariante real (busca de pendentes única) foi confirmada manualmente e por todos os testes. Nenhum escopo além do declarado foi tocado.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo neste plano.

## Bateria de testes

`npx tsc --noEmit`, `npx eslint .` e `npx next build` limpos (18 rotas geradas, incluindo `/agenda`).

`npx vitest run tests/agenda/` não fecha numa tacada só por causa do rate-limit conhecido de `signInWithPassword` do Supabase Auth (documentado em STATE.md > Blockers/Concerns) — mesma convenção das Fases 13/18/19/20/21-01. Rodados em duas levas:

| Arquivo(s) | Resultado |
|---|---|
| 14 arquivos `.tsx`/`.ts` sem dependência de rede (todos os componentes/pure functions da agenda) | 219/219 passed |
| `tests/agenda/agenda-concluidos-rpc.test.ts` (isolado) | 11/11 passed |
| `tests/agenda/agenda-rpc.test.ts` (isolado, D-03 — sem edição) | 11/11 passed |
| `tests/agenda/concluir-rpc.test.ts` (isolado) | 16/16 passed |
| `tests/agenda/rls-agenda.test.ts` (isolado) | 10/10 passed |
| `tests/agenda/rls-conclusao.test.ts` (isolado) | 8/8 passed |

**Total: 275/275 testes verdes em `tests/agenda/`.**

## Verificação Humana

Roteiro de 12 passos conduzido pelo dono do projeto em `http://localhost:3000/agenda`, com dados reais semeados via service-role client (5 clientes `ZZ-TESTE 21-04 *`: tarefa concluída em 05/08, visita concluída em 10/08, um dia (12/08) com um item pendente e um concluído juntos, e um item concluído de Vendedor B em 07/08 para testar o filtro do Supervisor). Nenhum dado semeado pela UI — evita o rate-limit conhecido de login. Todos os 5 clientes apagados via o mesmo script após a aprovação.

**Resultado: aprovado pelo dono do projeto — "tudo certo".** Cobriu os cinco critérios de sucesso do ROADMAP da Fase 21: (1) datas passadas mostram o que foi concluído, nas três visões; (2) item concluído visualmente distinto, sem ação de concluir de novo, abre a ficha do cliente; (3) Lista e selo do menu inalterados; (4) filtro de vendedor do Supervisor manda nas duas fontes; (5) navegação continua imediata, hoje/futuro só pendentes, dia sem atividade aparece vazio sem erro.

## Next Phase Readiness

- **Fase 21 (AGD-13) encerrada.** As quatro camadas (banco → puro → visual → fiação) fecham a promessa do calendário: navegar para uma data passada mostra o que já foi feito, sem que nada da Fase 20 tenha mudado de comportamento.
- `getAgendaConcluidos`/`getAgendaConcluidosAction`/`vendedorFiltroId` publicados e estáveis — qualquer fase futura que precise do histórico do calendário tem esses três pontos de entrada prontos, sem precisar reimplementar a busca ou o filtro.
- Nenhum bloqueio conhecido para a Fase 22 (Conclusão Remota com Motivo), que é a próxima da v1.5 — Fase 22 não depende de nada deste plano além do que já estava publicado pelas Fases 14/15.
- Defeito conhecido e já registrado (Fase 20, `deferred-items.md`): o Select de filtro de vendedor perde a seleção em recargas — continua fora de escopo, não tocado por este plano.

---
*Phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas*
*Completed: 2026-08-18*

## Self-Check: PASSED

All 8 created/modified files found on disk; all 4 task commit hashes (d553279, 1b87396, ee08773, 41e61b2) found in git log.
