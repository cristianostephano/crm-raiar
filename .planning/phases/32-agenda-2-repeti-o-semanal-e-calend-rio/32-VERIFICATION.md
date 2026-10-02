---
phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
verified: 2026-10-02T14:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 1
override_note: "Dono do projeto escolheu explicitamente publicar direto em produção (2026-10-02, resposta 'Direto em produção'), sem a conferência visual opcional no navegador (seletor Repetir e calendário). Todos os 5 critérios automatizáveis foram verificados; só a checagem visual humana ficou de fora por decisão do dono. Descarte automático de 1 ano (LGPD) continua sem implementação."
human_verification:
  - test: "Abrir /agenda2 no navegador (de preferencia no link de preview da staging) como Vendedor, clicar em 'Adicionar visita', escolher uma data de hoje ou futura e abrir o seletor 'Repetir'"
    expected: "Seletor mostra 'Nao repetir' (padrao), 'Por 4 semanas (4 visitas, incluindo esta)', 8 e 12; com data passada ou vazia o seletor fica desabilitado com a dica; ao salvar com 4 semanas aparecem 4 visitas no mesmo dia da semana"
    why_human: "Sensacao/legibilidade do seletor e aparencia real no navegador; a logica ja e provada por testes automaticos e pelo teste contra banco real"
  - test: "Alternar Lista / Dia / Semana / Mes no calendario da Agenda 2, usar setas e botao 'Hoje', navegar para um dia passado com item concluido, e logar como Supervisor filtrando por vendedor"
    expected: "Visual e comportamento iguais aos do calendario da Agenda atual; semana comeca na segunda; concluido aparece riscado; filtro do Supervisor estreita o calendario"
    why_human: "Aparencia visual e fluidez de navegacao nao sao verificaveis por grep/testes de unidade. O dono pode optar por pular."
---

# Phase 32: Agenda 2 - Repeticao Semanal e Calendario - Relatorio de Verificacao

**Phase Goal:** O vendedor planeja as proximas semanas da Agenda 2 de uma vez (item ja repetido por 4, 8 ou 12 semanas) e enxerga a Agenda 2 tambem em calendario de dia, semana e mes, com a mesma navegacao da Agenda atual.
**Verified:** 2026-10-02
**Status:** human_needed (todos os criterios automatizaveis passam; restam apenas conferencias visuais opcionais)
**Re-verification:** Nao - verificacao inicial

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria = contrato)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ao criar, escolhe nao repetir ou 4/8/12 semanas; sistema cria de uma vez uma ocorrencia por semana, sempre no mesmo dia da semana | VERIFIED | `lib/agenda2/repeticao.ts`: `REPETIR_SEMANAS_VALORES=[0,4,8,12]`; `gerarDatasSemanais` usa `parseISO -> addWeeks -> chaveDoDia` (sem `new Date(texto)`, sem aritmetica de ms). `app/actions/agenda2.ts` `criarAgenda2Item`: `criarAgenda2CriarSchema(hoje)` + `datas.map(...)` + UM `supabase.from("agenda2_itens").insert(linhas)` (array, sem laco, sem RPC). Form `Agenda2ItemForm.tsx` tem o Select "Repetir" so em `modo === "criar"`, padrao 0. Teste real `lote-12-grava` passou. |
| 2 | Cada ocorrencia e independente (editar/concluir/apagar uma nao afeta as outras) | VERIFIED | Nenhuma coluna de serie (sem migration nova, tabela inalterada, D-22); cada linha e inserida como item comum. Teste contra banco real `ocorrencias-independentes` passou. |
| 3 | Agenda 2 alterna Lista/Calendario (dia/semana/mes), setas, "Hoje", semana na segunda, mesmo comportamento da Agenda atual; concluidos riscados no calendario | VERIFIED (visual: ver Human Verification) | `Agenda2List.tsx` monta `Agenda2Calendario` (Lista e visao padrao); `Agenda2CalendarioToolbar.tsx` tem Lista/Dia/Semana/Mes, anterior/proximo/Hoje; navegacao via `navegarData`/`rotuloDoPeriodo` importados de `lib/agenda/itens.ts` (semana via `INICIO_DA_SEMANA`/`weekStartsOn`); `line-through` para `item.concluido` em Mes, Semana e Dia (via `Agenda2ItemRow`). Leitura por periodo `getAgenda2Periodo` (gte/lte em `data`, sem corte de concluidos passados, D-28) alimentada por `getAgenda2PeriodoAction` com `validarIntervaloHistorico`. |
| 4 | Supervisor filtra o calendario por vendedor como na Lista | VERIFIED | `Agenda2List` passa `vendedorFiltroId` ao `Agenda2Calendario`, que aplica `filtrarPorVendedor` (estreitamento local sobre o que a RLS liberou, D-30); `podeAlterar={!isSupervisor}`. Teste real `periodo-escopo` + `lote-supervisor-recusado` passaram (Supervisor le o time, nao grava). |
| 5 | Calendario da Agenda atual identico ao de hoje | VERIFIED | `git diff --name-only 1502a931cd71824ca9da90abce70720bc1171dd4 -- components/agenda lib/agenda lib/validations/agenda.ts app/actions/agenda.ts lib/supabase/queries/agenda.ts "app/(app)/agenda" tests/agenda supabase/migrations` executado por mim: saida VAZIA (exit 0). Nenhum arquivo em `components/agenda2`, `lib/agenda2`, `app/actions/agenda2.ts`, `lib/validations/agenda2.ts` importa `components/agenda/*` nem `app/actions/agenda` (grep vazio); so funcoes puras de `lib/agenda/itens.ts`. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified: atomicidade e independencia sao comportamentais e foram provadas por teste contra banco real)

### Decisoes travadas (CONTEXT) conferidas no codigo

| Decisao | Status | Evidencia |
|---------|--------|-----------|
| D-31: N semanas = N visitas no total | HONRADA | `gerarDatasSemanais`: `total = semanas === 0 ? 1 : semanas`; `Array.from({length: total}, (_, i) => addWeeks(base, i))` -> i=0 e a propria data; 4 -> 4 datas, 12 -> 12 (nunca 13). `repeticao.test.ts` confere `toHaveLength(12)`; rotulo "Por N semanas (N visitas, incluindo esta)". |
| D-20 tudo-ou-nada, sem RPC | HONRADA | Um unico `.insert(linhas)`; testes reais `lote-atomico-check` e `lote-atomico-rls` passaram. |
| D-22 sem identificador de serie | HONRADA | Linha montada so com nome_cliente, bairro, data, vendedor_id. Sem migration/coluna. |
| D-23 repeticao so de hoje em diante | HONRADA | `repeticaoPermitida` + `superRefine` no schema (servidor, "hoje" de Sao Paulo via `diaLocalSaoPaulo`) e seletor desabilitado na tela. |
| D-24 repetir so ao criar | HONRADA | Campo so em `modo === "criar"`; payload de edicao com 3 campos explicitos. |
| D-25 duplicado so contra o original | HONRADA | `existeItemParecido` roda uma vez no submit contra a data original. |
| D-26 sem indicador visual | HONRADA | Nenhum icone/marca de repeticao nos componentes. |
| D-27 copia propria, sem tornar `AgendaCalendario` configuravel | HONRADA | Cinco componentes `Agenda2Calendario*` proprios; `components/agenda` sem diff. |
| D-28 passado mostra concluidos | HONRADA | `getAgenda2Periodo` sem corte `.or`; contêiner sem `itensDaListaAgenda2`. |
| D-29 riscado no calendario | HONRADA | `line-through` em Mes/Semana/Dia. |
| D-30 filtro do Supervisor | HONRADA | ver Truth 4. |

### Required Artifacts

| Artifact | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `lib/agenda2/repeticao.ts` | lista 0/4/8/12, datas, regra hoje | VERIFIED | Substantivo, importado por schema, action e form |
| `lib/validations/agenda2.ts` | `criarAgenda2CriarSchema(hoje)` | VERIFIED | `agenda2ItemSchema` inalterado (edicao), criacao separada |
| `app/actions/agenda2.ts` | criar em lote + `getAgenda2PeriodoAction` | VERIFIED | Usadas por Form e Calendario |
| `lib/supabase/queries/agenda2.ts` | `getAgenda2Periodo` | VERIFIED | Paginada, sem filtro de dono (RLS escopa) |
| `lib/agenda2/itens.ts` | copias tipadas + `intervaloVisivelAgenda2` | VERIFIED | Importa so funcoes puras da Agenda atual |
| `components/agenda2/Agenda2Calendario{,Dia,Mes,Semana,Toolbar}.tsx` | calendario proprio | VERIFIED | 295/69/210/161/120 linhas, wired em `Agenda2List` |
| `components/agenda2/Agenda2ItemForm.tsx` | campo Repetir so ao criar | VERIFIED | `onRecarregar` em falha (Pitfall 8) |
| `components/agenda2/Agenda2List.tsx` | Lista + Calendario | VERIFIED | `Agenda2Calendario` sempre montado; Lista so quando `visao === "lista"` |
| `tests/agenda2/*` (14 arquivos novos/alterados) | cobertura | VERIFIED | 22 arquivos / 277 testes passam |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| Agenda2ItemForm | criarAgenda2Item | `repetirSemanas` no payload de criacao | WIRED |
| criarAgenda2Item | gerarDatasSemanais | `datas.map` -> um `.insert(linhas)` | WIRED |
| Agenda2List | Agenda2Calendario | props `visao`, `reloadKey`, `vendedorFiltroId`, handlers | WIRED |
| Agenda2Calendario | getAgenda2PeriodoAction -> getAgenda2Periodo | efeito com dependencias `inicio`/`fim` (dois textos) | WIRED |
| Agenda2Calendario | lib/agenda/itens (navegarData, rotuloDoPeriodo, filtrarPorVendedor) | import de funcoes puras | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Variavel | Fonte | Dados reais | Status |
|----------|----------|-------|-------------|--------|
| Agenda2Calendario | `carregado.itens` | `getAgenda2PeriodoAction` -> `supabase.from("agenda2_itens").select(...).gte/lte` | Sim (query real; teste `periodo-escopo` contra banco) | FLOWING |
| Agenda2List (Lista) | `state.itens` | `getAgenda2Action` -> `getAgenda2` | Sim | FLOWING |

### Behavioral Spot-Checks (executados por mim)

| Comportamento | Comando | Resultado | Status |
|---------------|---------|-----------|--------|
| Suite da fase | `npx vitest run tests/agenda2` | 22 arquivos, 277 testes passaram | PASS |
| Banco real (atomicidade, RLS por linha, independencia, escopo) | `npx vitest run tests/agenda2/rls-agenda2-repeticao.test.ts --reporter=verbose` | 7/7 passaram (lote-12-grava, lote-atomico-check, lote-atomico-rls, lote-supervisor-recusado, lote-desativado-recusado, ocorrencias-independentes, periodo-escopo), ~300-960 ms cada (ida real ao banco, nao skip) | PASS |
| Tipos | `npx tsc --noEmit` | sem erros | PASS |
| SC5 guarda git | `git diff --name-only 1502a931... -- <Agenda atual + migrations>` | vazio | PASS |

### Probe Execution

Step 7c: SKIPPED (a fase nao declara probes `probe-*.sh`).

### Sem migration / coluna / SECURITY DEFINER novos

- `git diff --name-status 1502a931... HEAD -- supabase` : vazio. Ultima migration continua `0048_agenda2_itens.sql` (da Fase 31).
- `git diff 1502a931... HEAD -- . ':!.planning' | grep -i "security definer"` : sem resultado.
- `package.json` / `package-lock.json` sem diff (zero dependencia nova).

### Requirements Coverage

| Requisito | Plano(s) | Descricao | Status | Evidencia |
|-----------|----------|-----------|--------|-----------|
| AGD2-02 | 32-01, 32-03, 32-05 | Repetir 4/8/12 semanas, ocorrencias independentes | SATISFIED | Truths 1 e 2; REQUIREMENTS.md marca Complete |
| AGD2-08 | 32-02, 32-04, 32-06, 32-07 | Lista e Calendario (dia/semana/mes) | SATISFIED | Truths 3, 4 e 5; REQUIREMENTS.md marca Complete |

IDs orfaos: nenhum. REQUIREMENTS.md mapeia para a Fase 32 exatamente AGD2-02 e AGD2-08, ambos reivindicados pelos planos.
Nota de texto: AGD2-08 diz "reaproveitando o mesmo componente"; a decisao travada (ROADMAP nota a / D-27) e COPIAR o componente. A intencao (mesma navegacao e comportamento) esta atendida; a divergencia literal e deliberada e documentada.

### Anti-Patterns Found

Nenhum. Grep por TBD/FIXME/XXX nos arquivos da fase: vazio. Nenhum stub, retorno vazio ou prop hardcoded vazia nos fluxos de dados do calendario.

### Observacoes (informativas, nao bloqueiam)

- `.planning/config.json` aparece modificado no working tree (pre-existente, fora do escopo da fase).
- Prazo de guarda (1 ano) dos dados da Agenda 2 segue sem descarte automatico: fora de escopo declarado no CONTEXT; lembrar o dono.
- LGPD: a fase nao adiciona coluna nem dado novo (D-22); o lote grava os mesmos 4 campos ja aprovados na Fase 31, dono sempre definido pelo servidor. Cada repeticao cria agenda futura de deslocamento do vendedor, mitigado pelo padrao "Nao repetir" (privacidade por padrao) e limite fechado de 12 linhas por envio.

### Human Verification Required

Apenas conferencias visuais; o dono pode optar por pular (ver frontmatter): (1) sensacao do seletor "Repetir" no formulario; (2) aparencia/navegacao do calendario Dia/Semana/Mes e filtro do Supervisor. A regra de negocio por tras de ambos ja esta provada por testes automaticos e pelo teste contra banco real.

### Gaps Summary

Nenhum gap. O objetivo da fase foi alcancado no codigo: repeticao tudo-ou-nada com N visitas no total (D-31), ocorrencias independentes sem identificador de serie, calendario proprio da Agenda 2 com leitura por periodo e filtro do Supervisor, e a Agenda atual sem nenhuma alteracao (guarda git vazia).

---

_Verified: 2026-10-02_
_Verifier: Claude (gsd-verifier)_
