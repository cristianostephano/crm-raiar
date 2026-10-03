# Phase 33: Agenda Atual sem Visitas Automáticas de Clientes Ativos - Research

**Researched:** 2026-10-03
**Domain:** Mudança de corpo de uma função SQL de leitura (Postgres/Supabase, SECURITY INVOKER) + remoção de uma seção de tela (Next.js/React) + reorganização de testes. Zero tecnologia nova.
**Confidence:** HIGH (tudo verificado lendo o código/migrations reais; 3 pontos menores marcados [ASSUMED])

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-32:** A seção "Sem dia fixo definido" (`getClientesSemDiaFixo()` em `lib/supabase/queries/agenda.ts` + `components/agenda/AgendaSemDiaFixo.tsx`, ligada em `AgendaList.tsx`) SAI da Agenda atual durante o piloto. O vendedor deixa de ser cobrado por definir frequência/dia fixo, que não alimenta mais nada. Reversível: volta se o dono mantiver a Agenda atual. (Decidido pelo dono em 2026-10-03.)
- **D-33:** O histórico de visitas já concluídas continua aparecendo no calendário da Agenda atual em datas passadas (`agenda_concluidos_do_vendedor()`, Fase 21) e no Diário de cada cliente. É o que foi feito de verdade, não uma entrada automática; nada que já foi registrado some.
- **D-34:** As visitas continuam sendo CRIADAS no banco em silêncio (`mover_card_funil` cria a primeira ao marcar ganho; `concluir_visita` cria a próxima), só deixam de ser LIDAS pela Agenda. Nenhuma função de escrita é alterada, em particular NÃO se mexe em `mover_card_funil`, a função mais crítica do funil. Consequência aceita: se o dono voltar à Agenda atual, visitas acumuladas podem reaparecer atrasadas de uma vez. Nenhuma visita existente é apagada.
- **D-35:** A caixinha de "ganho" continua pedindo a frequência de visita (a trava no banco, "Frequência de visita é obrigatória ao marcar um cliente como ganho", fica como está). Não se mexe na trava de ganho nem em seus testes das v1.3/v1.4/v1.6.
- **D-36:** Tarefas de prospecção pendentes de um cliente já ganho continuam aparecendo na Agenda atual (a metade de prospecção de `agenda_do_vendedor()` não muda — requisito explícito).
- **D-37:** Frequência de visita e dia fixo continuam visíveis e editáveis na ficha do cliente ativo, com os mesmos valores de antes.

### Claude's Discretion
- Forma exata de esconder a metade "visitas" de `agenda_do_vendedor()`: migration NOVA (nunca editar uma antiga) com as mesmas colunas de retorno (só o corpo muda, sem criar sobrecarga ambígua de função), registrando o corpo original para uma migration de volta (ROADMAP nota f).
- Como separar os testes: os que esperam visitas na Agenda atual mudam de propósito; os de prospecção devem passar SEM edição (oráculo de regressão) — ROADMAP nota g.

### Deferred Ideas (OUT OF SCOPE)
- Parar de criar visitas em silêncio e afrouxar a trava de frequência no ganho — descartados para o piloto (D-34/D-35); revisitar só se o dono decidir manter a Agenda 2 de vez e remover o modelo automático.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGD-16 | Cliente "ganho" (ativo) para de entrar automaticamente na Agenda atual por frequência/dia fixo; campos continuam no cadastro; prospecção continua igual | Migration 0049 recria `agenda_do_vendedor()` só com a metade de prospecção (Pattern 1); remoção da fiação de "Sem dia fixo" em `AgendaList.tsx` (Pattern 2); contador do menu muda sozinho (confirmado, Q6); testes separados em "mudam de propósito" x "oráculo de regressão" (Test Map) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Stack fixa (Next.js/TypeScript + Supabase); sem backend Node separado; autorização só por Supabase Auth + RLS.
- Migrations sempre NOVAS e versionadas em `/supabase/migrations`; nunca editar/sobrescrever migration aplicada; schema nunca pelo dashboard sem migration correspondente.
- TypeScript estrito, sem `any` sem justificativa; commits pequenos (um por tarefa do plano).
- Toda funcionalidade nova precisa de pelo menos um teste automatizado; tarefa só conclui com testes passando.
- Sem novas dependências/serviços externos (custo zero) — esta fase não adiciona nenhuma.
- Deploy: tudo vai primeiro para `staging` (Preview da Vercel), é testado, e só depois para `master`; nunca push direto em `master`.
- Usuário não-técnico: explicar em linguagem simples; mudanças grandes com plano prévio; aprovação humana explícita antes do Execute (o dono cola a migration no SQL Editor).
- GSD: edições só dentro de um fluxo GSD; `.planning` mantido pelo GSD.
- Projeto termina com as mesmas 11 funções com elevação de privilégio (nenhuma nova) — protegido por teste.
- LGPD (diretriz organizacional): alertar sobre dado pessoal em processos/testes; privacidade por design/default (ver Security Domain).

## Summary

A Agenda atual lê clientes ativos por DOIS caminhos, ambos verificados no código. (1) A metade "visitas" do `union all` dentro de `agenda_do_vendedor()` — versão vigente na migration `0036_encerrar_cliente_ativo.sql` (seção 5), a ÚNICA migration posterior à 0026 que a redefine (0037-0048 foram lidas por grep: nenhuma a toca). Essa mesma função alimenta a Lista, os pendentes do Calendário (`getAgenda()` → `getAgendaAction()` → `AgendaList`) e o selo do menu (`getAgendaPendentesCount()` faz `rpc("agenda_do_vendedor", undefined, {count:"exact", head:true})` no layout) — portanto mudar o corpo cobre os três de uma vez, sem nenhuma mudança de código no contador. (2) A seção "Sem dia fixo definido", que é um SELECT plano em `clientes` (não passa pela RPC) ligado em `AgendaList.tsx` (estado + `useEffect` + `filtrarPorVendedor` + JSX), e precisa sair por mudança de front-end separada.

A mudança de banco é pequena e de baixo risco: uma migration NOVA `0049` com `create or replace function agenda_do_vendedor()` de assinatura e `returns table(...)` idênticos (10 colunas, mesma ordem e tipos) e corpo igual ao da 0036 SEM o `union all` da metade `visitas`. Com assinatura idêntica NÃO se usa `drop function` (documentação PostgreSQL: `CREATE OR REPLACE` só proíbe mudar nome/tipos de argumento/tipo de retorno; dono e permissões são preservados) — a lição do `drop function if exists` registrada no STATE/PROJECT vale só quando a assinatura muda. O corpo original (0036) vai para um arquivo de volta FORA de `supabase/migrations/` (para o CLI nunca aplicá-lo sozinho).

O principal achado que o planner precisa saber: a maioria dos testes de integração "de agenda" depende das contas semente `SEED_ACCOUNTS`, apagadas em 2026-08-19 (STATE.md, Deferred Items) — estão VERMELHOS hoje independentemente desta fase (`agenda-rpc`, `concluir-rpc`, `rls-agenda`, `frequencia-visita`, `agenda-concluidos-rpc`...). Os únicos testes ao vivo que rodam VERDES hoje e que esperam visitas na Agenda são `tests/funil/encerrados-rpc.test.ts` (2 casos, usa `createTestMember`) e `tests/clientes/dia-fixo-visita.test.ts` (Bloco F, usa só `serviceClient`) — esses MUDAM de propósito. O oráculo de regressão da prospecção que realmente roda hoje é o conjunto de testes de tela/unitários (jsdom/fs, sem banco) + um arquivo ao vivo NOVO baseado em `createTestMember` (1 login), que fica VERMELHO até o dono aplicar a 0049 no SQL Editor (padrão das Fases 29/31).

**Primary recommendation:** Plano A = migration `0049` (corpo só com prospecção, comentários em bloco `/* */`, ASCII) + arquivo de volta em `supabase/rollbacks/` + teste estrutural verde + teste ao vivo novo vermelho-até-aplicar + edição dos 2 testes ao vivo que rodam hoje; Plano B (paralelo, arquivos disjuntos) = tirar só a FIAÇÃO de "Sem dia fixo" de `AgendaList.tsx` mantendo componente/consulta/ação/testes dormentes (reversível), mais 2 textos de tela que ficariam falsos; Plano C = checkpoint do dono (aplicar 0049 no SQL Editor) → testes ao vivo verdes → staging → verificar preview → master.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Quais itens pendentes entram na Agenda (prospecção sim, visita não) | Database (função SQL `agenda_do_vendedor()`) | — | Única leitura que alimenta Lista + Calendário (pendentes) + contador; mudar aqui garante que os três concordem [VERIFIED: lib/supabase/queries/agenda.ts] |
| Escopo por vendedor/supervisor da Agenda | Database (RLS + função SECURITY INVOKER) | — | Nenhuma mudança; função continua sem elevação de privilégio [VERIFIED: 0036] |
| Selo do menu (contador) | API/Backend (Server Component `app/(app)/layout.tsx`) | Database | Lê a MESMA RPC com `count:exact, head:true`; muda sozinho [VERIFIED: layout.tsx + agenda.ts] |
| Seção "Sem dia fixo definido" | Browser/Client (`AgendaList.tsx`) | API (Server Action) + Database (SELECT plano em `clientes`) | Segunda leitura independente da RPC; precisa sair por mudança de front-end |
| Histórico de concluídos no calendário | Database (`agenda_concluidos_do_vendedor`) | Browser/Client | NÃO muda (D-33) |
| Criação silenciosa de visitas | Database (`mover_card_funil`, `concluir_visita`) | — | NÃO muda (D-34/D-35) |
| Volta atrás (rollback) | Arquivo SQL aplicado manualmente pelo dono | Git (reverter commit de front-end) | Sem Docker/CLI local; aplicação de schema é sempre manual no SQL Editor [CITED: 31-03-SUMMARY.md] |

## Standard Stack

### Core
Nenhuma biblioteca nova. Tudo já instalado e em uso neste codebase.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Postgres/Supabase (SQL puro, `language sql stable`, SECURITY INVOKER) | — | Corpo novo de `agenda_do_vendedor()` | Mesma forma das migrations 0014/0015/0026/0036 |
| vitest | ^4.1.10 [VERIFIED: package.json] | Testes unitários, de tela (jsdom) e ao vivo | Já é o runner do projeto (`npm test` = `vitest run`) |
| @testing-library/react | já instalado | Teste de tela de `AgendaList` | Já usado em `tests/agenda/agenda-list.test.tsx` |
| @supabase/supabase-js | já instalado | Teste ao vivo (`rpc`, `createTestMember`) | Helper `tests/helpers/supabase-test-clients.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` / `node:path` | built-in | Teste ESTRUTURAL da migration 0049 e do arquivo de volta (sem banco) | Mesmo molde de `tests/agenda2/migracao-agenda2.test.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Remover a metade `visitas` inteira | Manter a metade mas filtrar `c.status_acompanhamento <> 'ganho'` | Filtro por status deixaria aparecer visita pendente de cliente que foi ganho e depois voltou a "em andamento" no Kanban; o critério 1 pede "nenhuma visita pendente ... gerada por frequência ou dia fixo". Remover a metade é mais simples, mais fácil de provar (`origem='visita'` nunca volta) e o volta-atrás é o mesmo. **Usar remoção total.** |
| Migration de volta dentro de `supabase/migrations/` | Arquivo fora da pasta | Dentro da pasta o `supabase db push` do CLI a aplicaria em ordem e desfaria a mudança. **Colocar em `supabase/rollbacks/`.** |

**Installation:** nenhuma. `npm install` NÃO é necessário nesta fase.

## Package Legitimacy Audit

Esta fase não instala nenhum pacote externo. Auditoria não aplicável.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
HOJE
 Banco: tarefas --+                      (metade "prospeccao")
                  +--> agenda_do_vendedor() --+--> getAgenda() ---------> AgendaList (Lista + Calendario pendentes)
 Banco: visitas --+   (metade "visita")       +--> getAgendaPendentesCount() --> layout --> AppSidebar (selo)
 Banco: clientes ---> getClientesSemDiaFixo() ---> getClientesSemDiaFixoAction() ---> AgendaList ---> AgendaSemDiaFixo
 Banco: visitas (data_realizada) --> agenda_concluidos_do_vendedor() --> Calendario (historico, datas passadas)

DEPOIS (Fase 33)
 Banco: tarefas --> agenda_do_vendedor() [so prospeccao] --+--> getAgenda() ---> AgendaList (Lista + Calendario)
                                                           +--> getAgendaPendentesCount() --> selo (cai sozinho)
 Banco: visitas -- continua sendo ESCRITA (mover_card_funil / concluir_visita), nunca mais LIDA pelos pendentes
 Banco: clientes --X-- (leitura desligada: AgendaList deixa de chamar getClientesSemDiaFixoAction)
 Banco: visitas (data_realizada) --> agenda_concluidos_do_vendedor() --> Calendario historico  (INALTERADO, D-33)
 Ficha do cliente: frequencia/dia fixo visiveis e editaveis (INALTERADO, D-37)
```

### Recommended Project Structure
```
supabase/
├── migrations/0049_agenda_atual_so_prospeccao.sql     # NOVA - nunca editar 0036
└── rollbacks/0049_volta_agenda_do_vendedor.sql         # NOVA pasta - corpo original da 0036, NAO aplicado
components/agenda/AgendaList.tsx                        # editado: sai a fiacao de "Sem dia fixo"
components/agenda/AgendaSemDiaFixo.tsx                  # MANTIDO dormente (reversibilidade)
lib/supabase/queries/agenda.ts                          # MANTIDO (getClientesSemDiaFixo dormente)
app/actions/agenda.ts                                   # MANTIDO (getClientesSemDiaFixoAction dormente)
tests/agenda/agenda-sem-visitas-migracao.test.ts        # NOVO, estrutural, VERDE hoje (fs)
tests/agenda/agenda-sem-visitas-automaticas.test.ts     # NOVO, ao vivo, VERMELHO ate aplicar
```

### Pattern 1: `create or replace` com assinatura idêntica, corpo só de prospecção
**What:** nova migration recria a função com o mesmo nome, mesmos 0 argumentos e exatamente o mesmo `returns table (...)` da 0036; só o corpo perde o `union all` da metade `visitas`.
**When to use:** sempre que só o corpo muda. Não há `drop function` (assinatura não muda → nenhuma sobrecarga é criada). Dono/permissões são preservados pelo Postgres [CITED: postgresql.org/docs/current/sql-createfunction.html].
**Example (corpo EXATO a escrever — copiado da 0036 seção 5, primeira metade apenas):**
```sql
/* Fase 33: agenda_do_vendedor devolve so a metade de prospeccao. ... (comentario em bloco, ASCII) */
create or replace function agenda_do_vendedor()
returns table (
  origem text,
  item_id uuid,
  cliente_id uuid,
  razao_social text,
  responsavel uuid,
  responsavel_nome text,
  titulo text,
  data date,
  frequencia_visita frequencia_visita_enum,
  proxima_data_sugerida date
)
language sql
stable
as $$
  select
    'prospeccao'::text as origem,
    t.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    tt.nome as titulo,
    t.data_conclusao as data,
    null::frequencia_visita_enum as frequencia_visita,
    null::date as proxima_data_sugerida
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  left join profiles p on p.id = c.responsavel
  where t.concluida = false
    and t.data_conclusao is not null
    and c.status_acompanhamento <> 'encerrado'
  order by 8, 4;
$$;
```
// Source: supabase/migrations/0036_encerrar_cliente_ativo.sql linhas 334-391 (corpo vigente) [VERIFIED: leitura direta]

Detalhes que mantêm a prospecção idêntica: `order by 8, 4` (posições = `data`, `razao_social`) continua válido sem o `union all` (posições da lista de saída do SELECT); os casts `null::frequencia_visita_enum` / `null::date` ficam (as colunas continuam existindo no contrato, sempre nulas para prospecção); o filtro `<> 'encerrado'` (Fase 29) fica. O desempate de empate total em (data, razao_social) é o mesmo não-determinístico de hoje — não introduzir `item_id` no `order by` (mudaria a ordem observável; "mesma ordem" é critério de sucesso).

### Pattern 2: tirar a FIAÇÃO, manter as peças dormentes (reversível)
**What:** em `components/agenda/AgendaList.tsx` remover: import de `getClientesSemDiaFixoAction` (linha 10), import de `AgendaSemDiaFixo` (14), `type ClienteSemDiaFixo` (34), o `useState` `clientesSemDiaFixo` (138-140), o segundo `useEffect` (175-190), `clientesSemDiaFixoFiltrados` (199-202) e o JSX `<AgendaSemDiaFixo .../>` com seu comentário (428-437), além de atualizar o parágrafo do cabeçalho do componente (94-103, descreve a Fase 24). `AgendaSemDiaFixo.tsx`, `getClientesSemDiaFixo`, `getClientesSemDiaFixoAction`, `ClienteSemDiaFixo`/`motivoSemDiaFixo`/`MOTIVO_SEM_DIA_FIXO_LABELS` e seus testes FICAM, com uma nota de "dormente durante o piloto (Fase 33, D-32)" no cabeçalho do componente e da consulta.
**Por quê (regra "sem código morto" x reversibilidade):** D-32 diz literalmente "Reversível: volta se o dono mantiver a Agenda atual". Reverter = recolocar ~25 linhas em `AgendaList.tsx` (ou reverter o commit). Apagar o componente + consulta + ação + 3 arquivos de teste (~600 linhas) tornaria a volta um refazer completo. Deixar dormente não tem custo de execução: sem a chamada, a leitura paginada de ~2000 clientes (quick task 260914-ng5) deixa de acontecer a cada abertura da Agenda. A limpeza definitiva fica registrada como item adiado: "apagar o conjunto dormente quando o dono confirmar a Agenda 2 como definitiva" (mesma condição do Deferred Ideas).
**Observação de segurança:** `getClientesSemDiaFixoAction` continua exportada ("use server" = endpoint público), mas é leitura sob RLS de `clientes` com checagem de sessão — nenhuma exposição nova; apenas não é mais chamada.

### Pattern 3: arquivo de volta fora de `supabase/migrations/`
**What:** `supabase/rollbacks/0049_volta_agenda_do_vendedor.sql` contém `create or replace function agenda_do_vendedor()` com o corpo da 0036 (as duas metades) copiado byte a byte (incluindo `and c.status_acompanhamento <> 'encerrado'` nas duas), com cabeçalho em bloco `/* */`: "NAO APLICAR automaticamente; so se o dono decidir manter a Agenda atual; visitas acumuladas durante o piloto reaparecem atrasadas de uma vez (D-34)". Assinatura idêntica → também sem `drop function`.
**Teste que prova a volta sem aplicar:** teste estrutural compara o bloco `create or replace function agenda_do_vendedor() ... $$;` do arquivo de volta com o da 0036 (após remover linhas `--` e normalizar espaços) e exige igualdade.

### Anti-Patterns to Avoid
- **Editar a 0036 (ou qualquer migration aplicada):** proibido (CLAUDE.md). Sempre 0049 nova.
- **`drop function if exists agenda_do_vendedor()` por "segurança":** desnecessário e perigoso (derruba a função por instantes; some o dono/permissões); só vale quando a assinatura muda.
- **Comentário `--` e acentos na migration:** ao colar no SQL Editor, `--` virou `–` (erro 42601) na 0042 [VERIFIED: git b3ea9e2]. Usar `/* ... */` e ASCII puro (sem acentos) na 0049 e no arquivo de volta.
- **Escrever a string literal da cláusula de elevação de privilégio em qualquer comentário da 0049:** `tests/agenda2/migracao-agenda2.test.ts` (`inventario-elevacao-inalterado`) varre TODAS as migrations com regex e só remove linhas `--`; um comentário em bloco com a expressão contaria como nova função com elevação e quebraria o inventário de 11. Escrever "sem elevacao de privilegio" por extenso, nunca o literal. Também não colocar texto parecido com `create function x(` nem `$$;` dentro do comentário.
- **Apagar/alterar `visitas` ou funções de escrita para "limpar":** viola D-34.
- **Reordenar/filtrar no cliente para compensar:** a ordenação e o filtro continuam só no SQL (disciplina de `lib/agenda/itens.ts`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contador do menu coerente com a Lista | Uma contagem própria em outra tabela | O `getAgendaPendentesCount()` existente (mesma RPC) | Já é a garantia de concordância; mudar o corpo da função basta [VERIFIED] |
| Contas de teste | Voltar a usar `SEED_ACCOUNTS` | `createTestMember`/`deleteTestMember` (`tests/helpers/supabase-test-clients.ts`) | Contas semente foram apagadas; fixture descartável é o padrão das Fases 28-32 |
| Provar "volta atrás idêntica" | Conferência visual do SQL | Teste estrutural `fs` comparando corpo do rollback com o da 0036 | Barato, verde hoje, sem banco |
| Aplicar a migration | `supabase db push` / script do agente | Dono cola no SQL Editor (checkpoint:human-action) | Sem Docker local; único ambiente é produção; padrão das Fases 13/18/19/28/29/30/31 |

**Key insight:** a fase é "tirar", não "construir". O maior risco não é técnico e sim de prova: demonstrar que a prospecção ficou idêntica. A melhor prova é por construção (a metade de prospecção na 0049 é textualmente igual à da 0036, verificada por teste estrutural) mais um teste ao vivo de comportamento.

## Runtime State Inventory (dados que ficam no lugar — D-34)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `visitas` com `data_realizada is null` (visitas pendentes de clientes ativos) continuam no banco e continuam sendo criadas por `mover_card_funil`/`concluir_visita`; `clientes.frequencia_visita`, `dia_semana_visita`, `semana_do_mes_visita` intocados | Nenhuma migração de dados. Apenas NÃO apagar. Quantidade real não medida (evitar ler dado real) |
| Live service config | None — verified: nenhuma configuração externa referencia a função | None |
| OS-registered state | None — verified: sem tarefa agendada/cron ligada à Agenda | None |
| Secrets/env vars | None — nenhuma chave nova | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: O selo do menu vai cair de uma vez e o dono pode estranhar
**What goes wrong:** vendedores com muitos clientes ativos têm hoje muitas visitas pendentes/atrasadas somadas ao selo; após aplicar a 0049 o número cai drasticamente (só tarefas de prospecção).
**How to avoid:** avisar o dono no checkpoint de aplicação (em linguagem simples) que a queda é esperada; o critério de sucesso 1 exige que Lista, Calendário e selo concordem, não que o número seja igual ao de antes.

### Pitfall 2: Testes ao vivo "verdes" que não provam nada porque dependem de `SEED_ACCOUNTS`
**What goes wrong:** `tests/agenda/agenda-rpc.test.ts`, `rls-agenda.test.ts`, `concluir-rpc.test.ts`, `tests/clientes/frequencia-visita.test.ts` e outros importam `SEED_ACCOUNTS` (contas apagadas) e falham no `beforeAll` hoje — não são "oráculo" executável.
**How to avoid:** o oráculo executável da prospecção = (a) teste estrutural da 0049 (prospecção textualmente idêntica à 0036), (b) arquivo ao vivo NOVO com `createTestMember`, (c) suite de tela/unitária (161 testes verdes hoje nos 10 arquivos listados no Validation Architecture). Os arquivos dependentes de semente continuam "sem edição" onde só testam prospecção (`rls-agenda`, casos `pendente/semdata/contagem` de `agenda-rpc`), mas o planner NÃO deve contá-los como prova.

### Pitfall 3: Staging e produção compartilham o MESMO banco
**What goes wrong:** o projeto Supabase é único (produção; sem Docker local) [CITED: 31-03-SUMMARY.md]. A branch `staging`/Preview da Vercel aponta para o mesmo banco; no momento em que o dono cola a 0049, a produção JÁ muda, antes do merge em `master`.
**How to avoid:** sequência segura — (1) front-end para `staging`; (2) dono aplica a 0049; (3) agente testa o link de preview + testes ao vivo verdes; (4) merge em `master`. Os dois estados intermediários são inofensivos (banco novo + tela antiga mostra a seção "Sem dia fixo" mas sem visitas; tela nova + banco antigo mostra visitas mas sem a seção). Deixar o arquivo de volta pronto antes de aplicar.

### Pitfall 4: Textos de tela que passam a ser falsos
**What goes wrong:** (a) `components/importacao/AtivoImportSummary.tsx` linha 19 diz que os ativos importados "vão aparecer na seção 'Sem dia fixo definido' da Agenda até alguém definir uma frequência" e `tests/importacao/ativo-import-summary.test.tsx` linhas 77-82 afirmam esse texto; (b) `app/(app)/clientes/page.tsx` linhas 84-86: "Clientes já ganhos aparecem na Agenda"; (c) `AgendaList.tsx` linha 451: "Nenhuma tarefa de prospecção ou visita pendente"; (d) `ClienteDetailSheet.tsx` ~1318-1322 ("a próxima visita continua sendo sugerida contando os dias...") — esta última está na ficha (D-37: mesmos valores/mesma ficha), ver Open Questions.
**How to avoid:** corrigir (a) e (b) e (c) na mesma fase com teste ajustado "de propósito"; (d) decisão do dono. Comentários de código desatualizados (`app/actions/clientes.ts:552-555`, `lib/importacao/typesAtivo.ts:55-56`, cabeçalhos de `AgendaList.tsx`) devem ser atualizados no mesmo commit.

### Pitfall 5: Filtro de vendedor do Supervisor encolhe
**What goes wrong:** `vendedoresDaAgenda(itens)` deriva as opções dos itens carregados; vendedor que só tinha visitas pendentes deixa de aparecer no Select do Supervisor.
**How to avoid:** é consequência esperada e coerente (o filtro nunca oferece quem não tem item); registrar no verify/UAT, sem código.

### Pitfall 6: Inventário de elevação de privilégio
**What goes wrong:** ver Anti-Patterns (literal em comentário). O inventário esperado continua 11 funções.
**How to avoid:** teste existente `inventario-elevacao-inalterado` deve continuar verde SEM edição — ele é a prova de "zero função nova com elevação".

### Pitfall 7: Teste ao vivo imprimindo/baixando dado real
**What goes wrong:** `agenda_do_vendedor` chamada com `serviceClient()` devolve TODOS os itens pendentes reais (razão social de clientes reais — dado pessoal/comercial).
**How to avoid:** nunca imprimir leitura; para asserções globais usar `count: "exact", head: true` + filtro `.eq("origem","visita")` (devolve só número); para o resto filtrar por ids de fixture; nomes inventados.

## Code Examples

### Teste estrutural da 0049 (verde hoje, sem banco) — o que afirmar
```typescript
// Source: molde de tests/agenda2/migracao-agenda2.test.ts (fs + stripSqlComments); arquivo novo
// tests/agenda/agenda-sem-visitas-migracao.test.ts
// 1. arquivo unico com prefixo 0049 e nome 0049_agenda_atual_so_prospeccao.sql
// 2. contem "create or replace function agenda_do_vendedor()" e NAO contem "drop function"
// 3. bloco "returns table (...)" da 0049 === bloco da 0036 (mesmas 10 colunas, ordem e tipos)  -> sem sobrecarga
// 4. NAO contem "from visitas", "union", "proxima_data_visita(" no corpo
// 5. primeira metade (select ... where ... <> 'encerrado') da 0049 === primeira metade da 0036 (normalizando espacos)
//    -> prova por construcao que a prospeccao e identica; "order by 8, 4;" presente
// 6. sem a clausula de elevacao (montada por concatenacao, como no teste existente) e sem "grant "
// 7. arquivo de volta existe em supabase/rollbacks/, fora de supabase/migrations/, e seu bloco da funcao === bloco da 0036
```

### Teste ao vivo novo (RED até aplicar a 0049) — esqueleto
```typescript
// Source: molde de tests/funil/encerrados-rpc.test.ts (createTestMember, seedGanho, seedVisitaPendente, limpeza de clientes antes de deleteTestMember)
// tests/agenda/agenda-sem-visitas-automaticas.test.ts   (1 vendedor fixture, 1 signInAs; vitest ja roda com fileParallelism: false)
// L1 sem-visita-global: serviceClient().rpc("agenda_do_vendedor", undefined, {count:"exact", head:true}).eq("origem","visita") -> count 0   [ASSUMED combinacao filtro+count; confirmar na 1a execucao]
// L2 ganho-vencido-nao-aparece: cliente ganho (etapa primeira_venda, frequencia semanal, dia fixo) + visita pendente com data de ONTEM + tarefa aberta de HOJE no mesmo cliente
//      -> vendedorA.rpc("agenda_do_vendedor") traz a tarefa (D-36) e NAO traz a visita; a visita continua na tabela visitas com data_realizada null (nada apagado, D-34)
// L3 prospeccao-identica: 3 tarefas (ontem, hoje, +10 dias) em clientes de razao social distinta -> ordem por data asc; colunas: origem 'prospeccao', titulo = nome do tipo,
//      frequencia_visita null, proxima_data_sugerida null, responsavel e responsavel_nome preenchidos; tarefa de cliente encerrado continua de fora
// L4 contador-igual-lista: count exact/head do vendedorA === full.length === numero de tarefas semeadas (RLS isola o fixture)
// L5 concluir-visita-silencioso: vendedorA.rpc("concluir_visita", {p_visita_id, p_resumo: "<texto realista, mesmo padrao de concluir-rpc.test.ts>", p_proxima_data}) ok;
//      visitas passa a ter 1 concluida + 1 pendente nova (criacao silenciosa, D-34); agenda_do_vendedor continua sem linhas de visita;
//      agenda_concluidos_do_vendedor(p_inicio, p_fim) devolve a visita concluida com origem 'visita' (D-33); historico tem linha 'visita_concluida' (Diario)
// L6 ganho-continua-exigindo-frequencia: mover_card_funil p_novo_status 'ganho' sem frequencia -> erro "Frequência de visita é obrigatória" (D-35)  [ja coberto por encerrados-rpc 'ganho-sem-frequencia-continua-bloqueado'; nao duplicar se o planner preferir]
```

### Edição de propósito nos testes ao vivo que RODAM hoje
```typescript
// tests/funil/encerrados-rpc.test.ts
//  - "agenda-some" (linhas 500-531): antes expectativa 2 linhas / count 2 (visita + tarefa). Depois: 1 linha (so a tarefa) / count 1 antes de encerrar; 0 / 0 depois (encerrar continua tirando a tarefa).
//  - "reativar-volta-agenda" (743-764): antes esperava 1 linha origem 'visita' na agenda apos reativar. Depois: 0 linhas de visita na agenda E visitasPendentesDoCliente(id).length === 1 com o MESMO id (a idempotencia da reativacao agora e provada na tabela, nao na Agenda).
// tests/clientes/dia-fixo-visita.test.ts
//  - "Bloco F - agenda_do_vendedor mira o dia fixo ..." (368-406): usa serviceClient e le proxima_data_sugerida da linha de visita -> deixa de existir linha. Reescrever para: a visita pendente semeada NAO aparece em agenda_do_vendedor; (a regra do dia fixo continua provada pelos Blocos A-E de proxima_data_visita e pelo "Bloco F - mover_card_funil semeia a primeira visita no dia fixo", que ficam SEM edicao).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Agenda atual = prospecção + visitas automáticas + seção "Sem dia fixo" | Agenda atual = só prospecção; visitas manuais vivem na Agenda 2 | Fase 33 (piloto v1.8) | Selo e Lista caem; criação de visitas continua escondida |

**Deprecated/outdated (durante o piloto):** conjunto dormente `AgendaSemDiaFixo` + `getClientesSemDiaFixo` + `getClientesSemDiaFixoAction` + tipos/rótulos `ClienteSemDiaFixo`; ramo `origem: "visita"` de `ConcluirItemDialog`/`concluirVisita` na Lista (inalcançável por itens pendentes, mas o histórico concluído no calendário ainda usa `origem: "visita"` — NÃO remover o tipo `AgendaOrigem`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `rpc(...,{count:"exact",head:true}).eq("origem","visita")` combina filtro e contagem exata nesta versão do supabase-js/PostgREST | Code Examples (L1) | Teste L1 falha por motivo técnico, não de regra; fallback: `rpc(...).eq("origem","visita").limit(1)` e esperar array vazio |
| A2 | `concluir_visita` com `p_proxima_data` válido para frequência `semanal`/`mensal` aceita data futura qualquer (como em `concluir-rpc.test.ts`, "2026-12-25") | Code Examples (L5) | Ajustar a data do fixture; sem impacto de produção |
| A3 | Existem visitas pendentes reais de clientes ativos em produção (por isso o selo cairá); quantidade não medida de propósito | Pitfall 1 | Se não houver, a queda não aparece — sem impacto |
| A4 | O CLI do Supabase não registrou as migrations manuais (padrão das Fases 28-31): aplicação segue manual; `supabase migration repair` é opcional | Pattern 3 / Plano C | Nenhum — formas re-executáveis (`create or replace`) não quebram um push futuro |

## Open Questions

1. **Corrigir os textos de tela que ficam falsos (Pitfall 4)?**
   - What we know: `AtivoImportSummary` (importação de ativos) promete uma seção que não existirá mais — erro visível ao Supervisor. `clientes/page.tsx` e o vazio da Lista falam em "ganhos aparecem na Agenda"/"visita pendente".
   - What's unclear: o texto da ficha (`ClienteDetailSheet` ~1318, "próxima visita continua sendo sugerida...") pertence ao D-37 ("mesmos valores") — mexer na ficha é decisão do dono.
   - Recommendation: o planner inclui (a) `AtivoImportSummary` + seu teste, (b) `clientes/page.tsx`, (c) texto do vazio da Lista (sem alterar o título "Sua agenda está em dia", que os testes assertam); deixa (d) fora e registra como item adiado/pergunta ao dono no checkpoint.

2. **Local do arquivo de volta.**
   - Recommendation: `supabase/rollbacks/0049_volta_agenda_do_vendedor.sql` (pasta nova, fora do caminho do CLI). Alternativa aceitável: anexo da própria fase (`.planning/phases/33-.../`). Escolher uma e citar o caminho no checkpoint do dono; o corpo também vai no resumo da fase para o dono colar sem abrir arquivos.

3. **Testes dependentes de `SEED_ACCOUNTS` que mudam de propósito (`agenda-rpc`, `concluir-rpc`).**
   - Recommendation: editar as asserções de visita mesmo estando vermelhas hoje (para não deixar mentira no repositório quando as contas voltarem): `agenda-rpc` casos `origem` (visita deixa de existir; manter só a tarefa), `cliente` (`toHaveLength(2)` → 1), `ordem` (retirar `ontemVisita` da ordem esperada); `concluir-rpc` casos `visita` (linha 376 `toContain(pendentes[0].id)` → `not.toContain`) e `sugerida` (a linha de visita deixa de existir; manter só a asserção de prospecção nula). Não é possível executá-los hoje — marcar no SUMMARY como "editado, não executável até a decisão das contas semente".

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest/Next | ✓ | v24.21.0 | — |
| vitest | todos os testes | ✓ | 4.1.10 | — |
| `.env.local` (credenciais do projeto Supabase) | testes ao vivo | ✓ (arquivo presente; conteúdo não lido) | — | — |
| Supabase SQL Editor (aplicação manual pelo dono) | aplicar 0049 | ✓ (ação humana) | — | Nenhum — agente nunca aplica |
| Supabase CLI / Docker local | `db push` | ✗ (projeto único de produção, sem Docker) [CITED: 31-03-SUMMARY.md] | — | SQL Editor manual |
| Vercel Preview da branch `staging` | validação do front-end | ✓ (regra de deploy do CLAUDE.md) | — | — |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** CLI/Docker → aplicação manual (padrão).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (`environment: node`; `tests/**/*.test.tsx` em jsdom; `fileParallelism: false`) |
| Config file | `vitest.config.ts` (carrega `.env.local`) |
| Quick run command | `npx vitest run tests/agenda/agenda-list.test.tsx tests/agenda/agenda-sem-visitas-migracao.test.ts tests/importacao/ativo-import-summary.test.tsx` |
| Full suite command | `npx vitest run` — ATENÇÃO: ~49 arquivos vermelhos por `SEED_ACCOUNTS` apagadas (STATE.md, Deferred Items); o portão da fase é a LISTA abaixo, não a suite inteira |

Baseline verificado nesta pesquisa (2026-10-03): 10 arquivos / 161 testes VERDES — `agenda-list.test.tsx`, `sem-dia-fixo.test.tsx`, `itens.test.ts`, `clientes-sem-dia-fixo-query.test.ts`, `ativo-import-summary.test.tsx`, `app-sidebar-agenda.test.tsx`, `agenda-calendario-integracao.test.tsx`, `migracao-agenda2.test.ts`, `agenda-item-row.test.tsx`, `concluir-item-dialog.test.tsx` (≈61 s).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGD-16 (crit. 1) | 0049 só tem prospecção, mesma assinatura/colunas, sem `drop`, sem elevação | estrutural (fs) | `npx vitest run tests/agenda/agenda-sem-visitas-migracao.test.ts` | ❌ Wave 0 |
| AGD-16 (crit. 1) | Nenhuma linha `origem='visita'` na RPC; ganho com visita vencida não aparece; contador = lista | ao vivo | `npx vitest run tests/agenda/agenda-sem-visitas-automaticas.test.ts` | ❌ Wave 0 (VERMELHO até aplicar) |
| AGD-16 (crit. 2) | Prospecção idêntica (ordem, colunas, atraso, conclusão com resumo, contador) | estrutural + ao vivo L3/L4 + tela inalterada | idem + `npx vitest run tests/agenda/agenda-list.test.tsx tests/agenda/agenda-item-row.test.tsx tests/agenda/concluir-item-dialog.test.tsx tests/agenda/itens.test.ts` | parte ❌ (novos), parte ✅ |
| AGD-16 (crit. 3) | "Sem dia fixo" não aparece e a ação nem é chamada | tela (jsdom) | `npx vitest run tests/agenda/agenda-list.test.tsx` | ✅ (caso "aviso de dia fixo" muda de propósito) |
| AGD-16 (crit. 4) | Frequência/dia fixo seguem na ficha; nada apagado; ganho ainda exige frequência | ao vivo (existentes, sem edição) | `npx vitest run tests/clientes/dia-fixo-visita.test.ts tests/funil/encerrados-rpc.test.ts` + L2/L5 | ✅ |
| AGD-16 (crit. 5) | Visita concluída segue no calendário (histórico) e no Diário | ao vivo L5 | ver L5 | ❌ Wave 0 |
| (regressão) | Inventário de 11 funções com elevação inalterado | estrutural existente | `npx vitest run tests/agenda2/migracao-agenda2.test.ts` | ✅ sem edição |
| (regressão) | Selo do menu continua vindo de `getAgendaPendentesCount` | tela | `npx vitest run tests/agenda/app-sidebar-agenda.test.tsx tests/agenda2/app-layout-contagem.test.tsx` | ✅ sem edição |

### Quais testes MUDAM de propósito x quais PASSAM SEM EDIÇÃO
**Mudam de propósito (todos no mesmo plano da migration, ficam VERMELHOS até aplicar quando ao vivo):**
- `tests/funil/encerrados-rpc.test.ts` — casos `agenda-some` e `reativar-volta-agenda` (roda hoje, `createTestMember`).
- `tests/clientes/dia-fixo-visita.test.ts` — "Bloco F - agenda_do_vendedor mira o dia fixo ..." (roda hoje, só `serviceClient`).
- `tests/agenda/agenda-rpc.test.ts` — casos `origem`, `cliente`, `ordem` (não executável hoje: sementes).
- `tests/agenda/concluir-rpc.test.ts` — casos `visita` (linha 376) e `sugerida` (não executável hoje).
- `tests/agenda/agenda-list.test.tsx` — caso "aviso de dia fixo (AGENDA-01)": passa a afirmar que a seção NÃO aparece mesmo que a ação devolvesse clientes, e que `getClientesSemDiaFixoAction` não é chamada. Também remover do arquivo o `mockedSemDiaFixo` e a entrada do `vi.mock` (limpeza; as demais ~10 casos seguem verdes sem edição de lógica — incluindo os de `origem: "visita"`, porque a tela mantém o ramo de visita).
- `tests/importacao/ativo-import-summary.test.tsx` — caso `conclusaoaviso` (linhas 77-82), se o texto de `AtivoImportSummary` for corrigido (Open Question 1).

**Passam SEM EDIÇÃO (oráculo de regressão):**
- Tela/unitário (rodam hoje): `tests/agenda/agenda-item-row.test.tsx`, `concluir-item-dialog.test.tsx`, `itens.test.ts`, `agenda-calendario*.test.tsx` (7 arquivos, incluindo `agenda-calendario-integracao.test.tsx`, cujo `vi.mock` ainda lista `getClientesSemDiaFixoAction` — inofensivo, deixar), `app-sidebar-agenda.test.tsx`, `tests/agenda2/app-layout-contagem.test.tsx`, `sem-dia-fixo.test.tsx` e `clientes-sem-dia-fixo-query.test.ts` (componente/consulta dormentes continuam testados), `tests/agenda2/migracao-agenda2.test.ts`.
- Ao vivo que rodam hoje e devem continuar verdes: `dia-fixo-visita.test.ts` (Blocos A-E e o Bloco F de `mover_card_funil` — prova D-34 "visita continua sendo criada"), `encerrados-rpc.test.ts` demais casos, em especial `ganho-sem-frequencia-continua-bloqueado` (prova D-35 sem tocar na trava) e `reativar-semeia-visita`.
- Dependentes de sementes (hoje vermelhos, não editar): `tests/clientes/frequencia-visita.test.ts` (oráculo declarado da trava de ganho, D-35 — nem uma linha), `tests/agenda/rls-agenda.test.ts`, `agenda-concluidos-rpc.test.ts`, `rls-conclusao.test.ts`, `conclusao-remota-rpc.test.ts`, `proxima-data.test.ts` (função pura, sem agenda_do_vendedor real).

### Sampling Rate
- **Per task commit:** o comando rápido acima (≈30 s).
- **Per wave merge:** lista do baseline (10 arquivos) + `agenda-sem-visitas-migracao.test.ts`.
- **Phase gate (após o dono aplicar a 0049):** lista do baseline + `agenda-sem-visitas-automaticas.test.ts` + `dia-fixo-visita.test.ts` + `encerrados-rpc.test.ts` + `agenda2/migracao-agenda2.test.ts` verdes, e verificação do link de preview da `staging` antes de `master`. NÃO exigir a suite inteira (vermelha por sementes, pré-existente).

### Wave 0 Gaps
- [ ] `tests/agenda/agenda-sem-visitas-migracao.test.ts` — estrutural (0049 + arquivo de volta).
- [ ] `tests/agenda/agenda-sem-visitas-automaticas.test.ts` — ao vivo (L1-L5), 1 login, 1 fixture, nomes inventados SEM sequência de 8+ dígitos corridos (precaução herdada da Fase 31; clientes aceitam, mas manter a disciplina), nunca imprimir leitura, limpar clientes antes de `deleteTestMember`.
- [ ] Framework: nenhuma instalação.

## Security Domain

### Applicable ASVS Categories (nível 1, `security_enforcement` ativo)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (nada novo) | Supabase Auth existente |
| V3 Session Management | no | `@supabase/ssr` existente |
| V4 Access Control | yes | Função continua SECURITY INVOKER + RLS de `clientes/tarefas/profiles` como única fronteira; 0049 não adiciona elevação de privilégio nem `grant`; inventário de 11 protegido por teste existente |
| V5 Input Validation | no (a função não tem parâmetros; nenhuma entrada nova) | — |
| V6 Cryptography | no | — |
| V8 Data Protection / LGPD | yes | ver alerta LGPD abaixo |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Elevação de privilégio acidental ao recriar função | Elevation of Privilege | `create or replace` sem a cláusula de elevação; teste estrutural + inventário existente |
| Rollback aplicado por engano pelo CLI | Tampering | Arquivo de volta fora de `supabase/migrations/`; header "NAO APLICAR" |
| Teste ao vivo expondo dado real no terminal/logs | Information Disclosure | Contagens/filtros por id de fixture; nada impresso; nomes inventados |
| Apagar visitas/histórico por "limpeza" | Tampering / Repudiation | D-34: nenhuma escrita/delete; teste L2/L5 prova que linhas continuam |

### Alerta LGPD (orientação organizacional — para o dono avaliar o escopo)
- Esta fase NÃO coleta nem cria dado pessoal novo e reduz levemente a exposição na tela (menos linhas de clientes ativos na Agenda). Porém: (1) as visitas pendentes de clientes ativos continuam acumulando em silêncio no banco (D-34) — é dado já existente, mas passa a ficar retido sem uso visível durante o piloto; o prazo de guarda segue sem política definida (já sinalizado em CONTEXT/Fase 31) — vale o dono decidir uma política de retenção antes de manter o piloto por muito tempo. (2) Os testes ao vivo rodam contra o banco de produção com dados reais: usar apenas fixtures inventadas, filtrar toda leitura por ids de fixture e nunca imprimir linhas lidas; a chamada com `serviceClient()` devolve itens reais de todos os vendedores. (3) Privacidade por design/default: manter a minimização — a fase não adiciona colunas, não amplia leituras e desliga uma leitura paginada de ~2000 clientes a cada abertura da Agenda.

## Sources

### Primary (HIGH confidence)
- Código/migrations lidos diretamente: `supabase/migrations/0036_encerrar_cliente_ativo.sql` (corpo vigente), `0021_agenda_concluidos_do_vendedor.sql`, `0048_agenda2_itens.sql` (cabeçalho), grep de `function agenda_*` em todas as migrations (só 0014, 0015, 0026, 0036 definem/recriam `agenda_do_vendedor`).
- `lib/supabase/queries/agenda.ts`, `lib/agenda/itens.ts`, `app/actions/agenda.ts`, `components/agenda/AgendaList.tsx`, `AgendaSemDiaFixo.tsx`, `app/(app)/layout.tsx`, `app/actions/clientes.ts`, `components/importacao/AtivoImportSummary.tsx`, `app/(app)/clientes/page.tsx`.
- Testes lidos: `tests/agenda/agenda-rpc.test.ts`, `rls-agenda.test.ts`, `concluir-rpc.test.ts`, `agenda-list.test.tsx`, `itens.test.ts` (600-706), `tests/funil/encerrados-rpc.test.ts`, `tests/clientes/dia-fixo-visita.test.ts`, `tests/agenda2/migracao-agenda2.test.ts`, `tests/helpers/supabase-test-clients.ts`, `vitest.config.ts`.
- Execução real nesta sessão: baseline vitest dos 10 arquivos (161 testes verdes).
- git `b3ea9e2` (lição de comentários `--` ao colar no SQL Editor).
- `.planning/STATE.md` (contas semente apagadas; inventário SECURITY DEFINER; lição do `drop function`), `.planning/phases/31-.../31-03-SUMMARY.md` (aplicação manual pelo SQL Editor; sem Docker).

### Secondary (MEDIUM confidence)
- [CITED: postgresql.org/docs/current/sql-createfunction.html] — regras de `CREATE OR REPLACE FUNCTION` (não muda nome/tipos de argumento/tipo de retorno; dono e permissões preservados).
- [CITED: supabase.com/docs/reference/javascript/rpc] — filtros (`.eq`) encadeados em `rpc()` de função que retorna conjunto.

### Tertiary (LOW confidence)
- Combinação filtro + `count:"exact", head:true` em `rpc()` (A1) — a confirmar na primeira execução.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma biblioteca nova; tudo existente e lido.
- Architecture: HIGH — função, caminhos de leitura e contador confirmados no código.
- Pitfalls: HIGH — baseados em lições registradas (git/STATE) e leitura direta dos testes; A1-A4 menores.

**Research date:** 2026-10-03
**Valid until:** 2026-11-02 (código estável; revalidar se as Fases 31/32 forem alteradas ou se as contas semente forem recriadas)
