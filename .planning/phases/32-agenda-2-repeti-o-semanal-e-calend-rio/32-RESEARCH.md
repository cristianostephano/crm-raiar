# Phase 32: Agenda 2 — Repetição Semanal e Calendário - Research

**Researched:** 2026-10-02
**Domain:** Escrita em lote (multi-row insert via PostgREST, protegido por RLS) + visão de Calendário copiada de componente existente, sobre a tabela única `agenda2_itens`. Zero tecnologia nova, zero migration.
**Confidence:** HIGH (quase todo achado vem de leitura direta do código e das migrations do próprio projeto; a atomicidade do insert em lote foi confirmada na documentação oficial do PostgREST; schema/zod e aritmética de datas foram executados em sandbox nesta sessão)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Repetição**
- **D-20:** Ao criar um item, o vendedor escolhe não repetir ou repetir por 4, 8 ou 12 semanas — gera uma ocorrência por semana, sempre no mesmo dia da semana da data escolhida. Gravação em uma única operação, tudo-ou-nada (nunca metade das semanas criada por falha no meio) — já travado no ROADMAP, não é mais gray area.
- **D-21:** Cada ocorrência é independente desde a criação — editar, concluir ou apagar uma não muda nenhuma das outras (requisito AGD2-02, já travado).
- **D-22:** Nenhum identificador de série é guardado ligando as ocorrências geradas. Menos dado numa tabela já sob escrutínio de LGPD (`agenda2_itens`), mais simples, e nada no produto precisa disso hoje.
- **D-23:** Repetição só fica disponível quando a data escolhida é hoje ou futura — diferente da regra de criação avulsa (D-09 da Fase 31, que aceita qualquer data), porque o caso de uso de repetir é planejar visitas futuras, não registrar o passado.
- **D-24:** A opção de repetir aparece só no momento de criar um item novo — editar um item avulso já existente nunca gera novas ocorrências.
- **D-25:** O aviso de possível duplicado (D-07, Fase 31) roda só contra o item original, antes de repetir — não é recalculado para cada uma das N ocorrências futuras geradas.
- **D-26:** Sem indicador visual (ícone ou marca) distinguindo um item criado por repetição de um item avulso — decorre diretamente de D-22 (não há série para indicar) e D-21 (são totalmente independentes).

**Calendário**
- **D-27:** A Agenda 2 ganha Calendário (dia/semana/mês) ao lado da Lista, reaproveitando a MESMA navegação visual e comportamento da Agenda atual (setas, botão "Hoje", semana começando na segunda-feira) — mas como um componente PRÓPRIO copiado (`Agenda2Calendario.tsx` e siblings), nunca tornando `AgendaCalendario.tsx` configurável/compartilhado. Decisão já travada no ROADMAP — mesmo padrão já usado entre Perdidos/Encerrados neste projeto.
- **D-28:** Navegar para uma data passada no calendário da Agenda 2 mostra o que foi concluído naquele dia (mesmo espírito da Agenda atual — "o que eu fiz nesse dia"). Diferente da Lista (que esconde concluídos do dia seguinte em diante, D-04/correção-7 da Fase 31) — o Calendário é uma segunda visão com regra própria de visibilidade.
- **D-29:** Itens concluídos aparecem riscados também no calendário (requisito explícito do ROADMAP para esta fase).
- **D-30:** O Supervisor filtra o calendário da Agenda 2 por vendedor, do mesmo jeito que já filtra a Lista (requisito AGD2-08, mesmo padrão read-only de D-16).

### Claude's Discretion
- Forma exata da query que alimenta o calendário (uma função nova vs. reaproveitar `getAgenda2()` com filtro de período) — já que a Agenda 2 tem UMA fonte de dados só (ao contrário da Agenda atual, que junta pendentes + histórico de duas fontes), a implementação pode ser mais simples que o `AgendaCalendario.tsx` original.
- Nome exato dos novos arquivos/componentes copiados (`Agenda2Calendario.tsx` e siblings), seguindo a convenção já usada em `Agenda2List.tsx`/`Agenda2ItemRow.tsx` da Fase 31.
- Paginação/limite de busca por período visível no calendário (evitar buscar todos os itens de todos os vendedores de uma vez) — mesmo cuidado já aplicado na Fase 21 da Agenda atual.

### Deferred Ideas (OUT OF SCOPE)
- **Identificador de série / "apagar todas as próximas"** — avaliado e explicitamente descartado nesta fase (D-22); revisitar só se um pedido real de usuário surgir.
- **Indicador visual de repetição** — descartado (D-26), decorre de D-22.
- **Adicionar repetição ao editar um item existente** — descartado (D-24); repetir só é possível no momento da criação.

(Decisões D-01..D-19 da Fase 31 continuam valendo — ver `31-CONTEXT.md`. O ROADMAP trava ainda: gravação direta de várias linhas numa só chamada, sem RPC e sem `SECURITY DEFINER` novo; calendário da Agenda atual e seus 7 testes em `tests/agenda/agenda-calendario*.test.tsx` ficam INTOCADOS.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGD2-02 | Ao criar o item, o vendedor pode escolher repetir nas próximas 4, 8 ou 12 semanas (mesma data da semana), gerando uma ocorrência independente por semana (cada uma editável/apagável separadamente) | Pattern 1 (`gerarDatasSemanais` com `parseISO`/`addWeeks`/`chaveDoDia`), Pattern 2 (`.insert(linhas[])` único, atômico, protegido pela RLS 0048 já existente), Pattern 3 (schema de criação separado com `repetirSemanas` 0/4/8/12 + regra D-23 com "hoje" em São Paulo), Pattern 4 (seletor só no modo criar). Ver Open Question 1 sobre "4 semanas = 4 ou 5 linhas". |
| AGD2-08 | Agenda 2 tem visão de Lista e visão de Calendário (dia/semana/mês), reaproveitando o mesmo componente de calendário já usado na Agenda atual | Pattern 5 (query por período), Pattern 6 (componentes copiados e o que muda), Pattern 7 (integração em `Agenda2List`). **Nota:** o texto do requisito diz "reaproveitando o mesmo componente"; a decisão travada D-27 diz COPIAR. Tratar "reaproveitar" como "mesmo visual/comportamento" (Open Question 6). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extraídas de `./CLAUDE.md` e `./.claude/CLAUDE.md` (mesma autoridade das decisões travadas):

- **Stack fixa:** Next.js (React/TypeScript) + Supabase; sem backend Node separado. Nenhuma dependência/serviço externo novo sem explicar custo; objetivo free tier. Esta fase não instala nada.
- **Autorização só via Supabase Auth + RLS** — nenhuma lógica de permissão "à mão" no frontend ou Server Action. Esconder botão para Supervisor é só reflexo visual.
- **TypeScript estrito, sem `any` sem justificativa em comentário.** Componentes em PascalCase, hooks com prefixo `use`.
- **Toda tabela nova com RLS + policies; migrations versionadas; nunca alterar migration já aplicada.** Esta fase NÃO cria tabela nem coluna nem migration (D-22).
- **Toda funcionalidade nova precisa de pelo menos um teste automatizado; tarefa só é concluída com testes passando.**
- **Fluxo GSD obrigatório;** aprovação humana explícita em Discuss/Plan antes de Execute.
- **Fluxo de deploy:** push só para `staging` → validar Preview Deployment da Vercel → só então `master`. Nunca direto em `master` (o repositório tem `origin/staging`).
- **Usuário não-técnico:** explicações em 1-2 frases sem jargão; erros descritos pelo sintoma observável.
- **Skill `Supabase-conventions`:** RLS primeiro; RPC só para cálculo/cascata; Edge Function só para algo externo. Aqui RLS pura resolve tudo — nenhuma RPC, nenhuma Edge Function.
- **Commits pequenos, um por tarefa do plano.**

## Summary

A fase tem duas metades independentes que só se encontram na tela `Agenda2List`. A metade da **repetição** é pequena: um schema de criação que estende o schema da Fase 31 com `repetirSemanas` (0/4/8/12), uma função pura que gera as datas com `parseISO` + `addWeeks` + `chaveDoDia`, e a Server Action `criarAgenda2Item` passando a montar um array de linhas e fazer **um único** `.insert(linhas)`. A atomicidade vem do PostgREST (um insert em lote vira UM comando `INSERT` no banco — se qualquer linha violar uma constraint ou a RLS `with check`, nenhuma linha é gravada) e a autorização continua sendo a RLS da migration 0048, que já cobre o caso por linha. Nada de migration, RPC ou `SECURITY DEFINER`. Achei duas armadilhas reais: (a) a regra D-23 ("data >= hoje") calculada no servidor com `new Date()` erraria entre 21h e 24h de Brasília, porque a Vercel roda em UTC — usar `diaLocalSaoPaulo()` que já existe em `lib/aderencia/registroDiario.ts`; (b) o schema `agenda2ItemSchema` é compartilhado com a edição, então `repetirSemanas` NÃO pode entrar nele (D-24) — criar um schema de criação separado.

A metade do **calendário** deve ser uma cópia de 5 componentes (`Agenda2Calendario`, `...Dia`, `...Mes`, `...Semana`, `...Toolbar`) alimentada por uma **query nova por período** (`getAgenda2Periodo(inicio, fim)` + `getAgenda2PeriodoAction`), e NÃO por `getAgenda2()`. `getAgenda2()` não serve porque (1) esconde concluídos de dias passados (corte `.or(...)` folgado de 48h, pensado para a Lista) — o que quebraria D-28 — e (2) devolve TODOS os pendentes futuros sem limite de período. A query nova filtra `data` entre o primeiro e o último dia visível (`gte`/`lte`), usa o mesmo `buscarPaginado` (o PostgREST corta leituras em 1000 linhas; um mês do time inteiro pode passar disso) e reaproveita `mapRow`. O validador `validarIntervaloHistorico` da Fase 21 (teto 45 dias, cobre a grade de 42) pode ser importado como está. Como a Agenda 2 tem uma fonte só, somem do original o segundo fetch (`getAgendaConcluidosAction`), `mesclarAgenda`, `intervaloDeHistorico` e o `onOpenCliente`; ficam o estado `referencia`, o diálogo do dia e a navegação. Diferente do original, o cartão do dia/diálogo deve ser o `Agenda2ItemRow` (com Editar/Apagar/Concluir/Desmarcar para o dono), então o calendário recebe os handlers e um `reloadKey` da `Agenda2List`, que continua sendo a única dona das escritas e do formulário.

**Primary recommendation:** Pure lib primeiro (`lib/agenda2/repeticao.ts`, funções de calendário em `lib/agenda2/itens.ts`, schema de criação) → Server Action com um único `.insert(array)` + query por período → formulário com seletor só no modo criar → 5 componentes de calendário copiados → integração em `Agenda2List` com guarda explícita de que `components/agenda`, `lib/agenda`, `app/actions/agenda.ts` e `tests/agenda` saem da fase sem diff.

> **Alerta LGPD (instrução organizacional):** cada envio do formulário passa a poder gravar até 12 linhas com nome de cliente (texto livre, pode identificar pessoa física) + bairro + data, formando uma **agenda futura de deslocamento do vendedor** de até 12 semanas — mais revelador da rotina do funcionário do que um item avulso. O escopo já aprovado (8 colunas, sem série, D-22) minimiza isso e esta pesquisa não propõe nenhuma coluna nova; mas o **prazo de guarda (1 ano, decidido pelo dono em 2026-10-01) continua sem descarte automático implementado**, e o padrão do formulário deve ser "Não repetir" (privacidade por padrão). Recomenda-se que o dono avalie esse ponto ao aprovar o plano; esta pesquisa não altera o escopo.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Quem pode inserir/ver linhas (inclusive em lote) | Database (RLS 0048, já existente) | — | `with check` é avaliado por linha: lote com uma linha de outro dono, ou de Supervisor/desativado, falha inteiro. Nenhuma policy nova. |
| Atomicidade "tudo ou nada" das N ocorrências | Database (um único `INSERT`) | API (uma chamada `.insert(array)`) | Um comando SQL é atômico por construção; N chamadas separadas NÃO seriam. |
| Geração das datas semanais | API/Backend (Server Action) + lib pura | Browser (mesma função para pré-visualizar, opcional) | Fonte única `gerarDatasSemanais`; o servidor nunca confia em datas vindas da tela — só na data-base e em `repetirSemanas`. |
| Regra D-23 (repetir só se data >= hoje) | API/Backend (autoridade) | Browser (desabilita o seletor) | "Hoje" em `America/Sao_Paulo` calculado no servidor; a tela só espelha para UX. |
| Validação de `repetirSemanas` (0/4/8/12) e teto de linhas | API/Backend (zod na Server Action) | Browser (mesmo schema via `zodResolver`) | Endpoint público: sem lista fechada, alguém pediria 10.000 semanas. |
| Query do calendário por período | API/Backend (Server Action → `getAgenda2Periodo`) | Database (RLS escopa; `gte/lte` em `data`) | Só o período visível trafega (free tier); RLS decide quais linhas aparecem. |
| Navegação/estado do calendário (`referencia`, diálogo do dia) | Browser/Client | — | Estado de UI puro, copiado do original. |
| Filtro por vendedor do Supervisor (calendário) | Browser/Client (`filtrarPorVendedor`) | Database (RLS já liberou o time) | Estreitamento local sobre o que a RLS liberou — nunca permissão (mesma regra de D-17/D-30). |
| Escritas a partir do calendário (concluir/editar/apagar) | API (Server Actions da Fase 31, inalteradas) | Database (RLS owner-only) | Reuso literal; calendário só chama handlers da Lista. |

## Standard Stack

### Core
Nenhuma dependência nova. Tudo já instalado e em uso (versões lidas de `package.json` e do `.claude/CLAUDE.md`) `[VERIFIED: package.json local]`:

| Library | Version | Purpose nesta fase | Why Standard (neste projeto) |
|---------|---------|---------|--------------|
| `date-fns` | `^4.4.0` | `parseISO`, `addWeeks`, `format` (via `chaveDoDia`) para gerar as datas semanais; grade/rótulos do calendário já em `lib/agenda/itens.ts` | Já é a disciplina de datas do projeto; `addWeeks` usa aritmética de calendário local (seguro contra horário de verão/virada de ano — verificado em sandbox nesta sessão, ver Code Examples) |
| `zod` | `^4.4.3` | Schema de criação com `repetirSemanas` (`.extend` + `.superRefine`) | Mesmo molde de `lib/validations/agenda2.ts`; `.extend()` e `.superRefine()` verificados em sandbox com este mesmo zod |
| `react-hook-form` + `@hookform/resolvers` | `^7.81.0` / `^5.4.0` | Campo "Repetir" no formulário existente | Já usados em `Agenda2ItemForm.tsx` |
| `@supabase/supabase-js` / `@supabase/ssr` | `^2.110.5` / `^0.12.3` | `.insert([...])` em lote e `.gte()/.lte()` na leitura por período | Já em uso |

### Supporting
Nenhuma. Especificamente **não instalar**: biblioteca de calendário (FullCalendar, react-big-calendar etc.) — decisão D-27 é copiar o componente caseiro; nem lib de recorrência (`rrule`) — a regra é "mesmo dia da semana, N semanas", uma linha de `addWeeks`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `.insert(linhas[])` direto | RPC PL/pgSQL `criar_agenda2_repetido()` | Travado pelo ROADMAP (nota c): na v1.7 a RLS não se aplicou corretamente a uma escrita dentro de função chamada pela API (migration 0047). Insert direto já é atômico e protegido pela RLS normal. Rejeitado. |
| Query nova `getAgenda2Periodo` | `getAgenda2()` com parâmetro de período | `getAgenda2()` tem o corte `.or(concluido=false, data>=ontem, atualizado_em>=48h)` que existe para a LISTA; mexer nele arrisca regressão da Fase 31 (testes `agenda2-query.test.ts` fixam esse `.or`). Função separada, cada uma com uma regra de visibilidade (Lista x Calendário, D-28). |
| Série (`serie_id`) para facilitar "apagar próximas" | — | Descartado (D-22). Não propor. |

**Installation:**
```bash
# Nenhuma instalação nova necessária — todas as dependências já estão em package.json.
```

**Version verification:** nenhum pacote novo; versões lidas de `package.json` `[VERIFIED: package.json local]`.

## Package Legitimacy Audit

> Esta fase **não instala nenhum pacote novo**. Todas as bibliotecas usadas já constam em `package.json` e foram aprovadas em fases anteriores. Nenhuma chamada ao seam `package-legitimacy check` necessária.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | Nenhum pacote novo nesta fase |

**Packages removed due to [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** nenhum.

## Architecture Patterns

### System Architecture Diagram

```
CRIAR COM REPETIÇÃO
Vendedor (browser) ── Agenda2ItemForm (modo "criar": nome, bairro, data, Repetir 0|4|8|12)
   │   seletor desabilitado e zerado se data < hoje(SP)  (UX; D-23)
   ▼
Server Action criarAgenda2Item(values)
   │  1. auth.getUser() → user.id            (dono SEMPRE da sessão)
   │  2. hoje = diaLocalSaoPaulo(new Date())
   │  3. criarSchema(hoje).safeParse(values) → rejeita repetirSemanas ∉ {0,4,8,12}
   │                                           e repetirSemanas>0 com data<hoje (D-23)
   │  4. datas = gerarDatasSemanais(data, repetirSemanas)   parseISO + addWeeks + chaveDoDia
   │  5. linhas = datas.map(d => ({nome_cliente, bairro, data: d, vendedor_id: user.id}))
   ▼
supabase.from("agenda2_itens").insert(linhas)      ← UMA chamada = UM INSERT no Postgres
   │   RLS "vendedor ativo cria os proprios itens" + CHECKs 0048 + trigger de carimbos, POR LINHA
   ├─ qualquer linha falha ──► NENHUMA linha gravada ──► { error: salvar_falhou } (mensagem fixa)
   └─ todas ok ──► revalidatePath("/agenda-2") ──► { data: true } ──► form: onSalvo() → reloadKey++

VER NO CALENDÁRIO
Agenda2List (dona de: visao, vendedorFiltroId, reloadKey, form, handlers de escrita)
   │ visao ≠ "lista"
   ▼
Agenda2Calendario (dono de: referencia, diaDialogo, fetch do período)
   │  intervalo = primeiro..último dia VISÍVEL (grade do mês / 7 dias / 1 dia)
   │  effect deps = [inicio, fim, reloadKey]  (textos, nunca objetos Date)
   ▼
Server Action getAgenda2PeriodoAction(inicio, fim)
   │  auth + validarIntervaloHistorico(inicio, fim)  (formato, inicio<=fim, <=45 dias)
   ▼
getAgenda2Periodo(inicio, fim) ── buscarPaginado( select(...).gte("data",inicio).lte("data",fim)
   │                                               .order(data, criado_em, id).range() )
   │  RLS escopa: vendedor = só os seus; Supervisor = time inteiro
   ▼
Agenda2Item[] ── filtrarPorVendedor(itens, vendedorFiltroId) ── agruparPorDataAgenda2 (UMA vez)
   ├─► Mês:   células com chips (nome riscado se concluído, borda vermelha se atrasado)
   ├─► Semana: 7 colunas; chip clicável → abre diálogo do dia
   └─► Dia / diálogo do dia: Agenda2ItemRow (Editar/Apagar/Concluir/Desmarcar p/ dono; somente leitura p/ Supervisor)
```

### Recommended Project Structure
```
lib/
├── agenda2/
│   ├── itens.ts              # EXISTENTE — acrescentar: estaAtrasadoAgenda2, agruparPorDataAgenda2,
│   │                         #   itensDoDiaAgenda2, dividirCelulaAgenda2, intervaloVisivelAgenda2
│   └── repeticao.ts          # NOVO — REPETIR_SEMANAS_VALORES, gerarDatasSemanais, (puro, sem next/*)
├── validations/agenda2.ts    # EXISTENTE — acrescentar schema de CRIAÇÃO (factory com `hoje`); NÃO tocar agenda2ItemSchema
└── supabase/queries/agenda2.ts   # EXISTENTE — acrescentar getAgenda2Periodo (mesmo arquivo, reaproveita mapRow)

app/actions/agenda2.ts        # EXISTENTE — criarAgenda2Item (array) + getAgenda2PeriodoAction

components/agenda2/
├── Agenda2List.tsx           # EXISTENTE — acrescentar `visao`, monta <Agenda2Calendario>
├── Agenda2ItemForm.tsx       # EXISTENTE — seletor "Repetir" só em modo "criar"
├── Agenda2Calendario.tsx     # NOVO — cópia adaptada de AgendaCalendario.tsx
├── Agenda2CalendarioToolbar.tsx   # NOVO — cópia (legenda trocada)
├── Agenda2CalendarioDia.tsx  # NOVO — cópia (usa Agenda2ItemRow)
├── Agenda2CalendarioMes.tsx  # NOVO — cópia (chip novo)
└── Agenda2CalendarioSemana.tsx    # NOVO — cópia (chip novo)

tests/agenda2/                # novos arquivos (ver Validation Architecture)
```
**Intocados (guarda de fim de fase):** `components/agenda/**`, `lib/agenda/itens.ts`, `app/actions/agenda.ts`, `lib/supabase/queries/agenda.ts`, `tests/agenda/**`, `supabase/migrations/**`.

### Pattern 1: Datas semanais sem bug de fuso (pergunta 2)

**What:** Função pura que recebe a data-base `YYYY-MM-DD` e devolve as datas, sempre com `parseISO` (data local) → `addWeeks` → `chaveDoDia` (`format(..., "yyyy-MM-dd")`). Nunca `new Date("2026-10-05")` (interpreta em UTC e no Brasil vira o dia anterior), nunca somar milissegundos (`+ 7*86400000`).
**When to use:** única fonte das datas das ocorrências (Server Action e, se quiser, uma pré-visualização na tela).
**Verified:** executado em sandbox nesta sessão com `TZ` indefinido e `TZ=America/New_York` (cruza o fim do horário de verão americano de 01/11/2026 e a virada de ano): `2026-10-30,2026-11-06,…,2027-01-01,2027-01-08,2027-01-15` — idêntico nos dois fusos, sempre a mesma sexta-feira `[VERIFIED: execução local node + date-fns 4.4]`.

```typescript
// lib/agenda2/repeticao.ts — puro: sem next/*, sem supabase (importável por Client Component)
import { addWeeks, parseISO } from "date-fns"

import { chaveDoDia } from "@/lib/agenda/itens"

/** FONTE ÚNICA da lista fechada de repetições (0 = não repetir). */
export const REPETIR_SEMANAS_VALORES = [0, 4, 8, 12] as const
export type RepetirSemanas = (typeof REPETIR_SEMANAS_VALORES)[number]

/**
 * Datas das ocorrências, a primeira sempre a data escolhida. `semanas === 0`
 * → só a própria data. Interpretação adotada (ver Open Question 1): "repetir
 * por N semanas" = N ocorrências NO TOTAL, incluindo a data escolhida
 * (deslocamentos 0..N-1). Se o dono preferir "a data escolhida + N seguintes",
 * a ÚNICA mudança é `length: semanas + 1`.
 */
export function gerarDatasSemanais(
  dataBase: string,
  semanas: RepetirSemanas
): string[] {
  const total = semanas === 0 ? 1 : semanas
  const base = parseISO(dataBase)

  return Array.from({ length: total }, (_, i) => chaveDoDia(addWeeks(base, i)))
}
```

### Pattern 2: Insert em lote atômico, payload só de campos validados (pergunta 2)

**What:** `criarAgenda2Item` monta `linhas[]` só com `nome_cliente`/`bairro`/`data` (do parse) + `vendedor_id: user.id` e faz **uma** chamada `.insert(linhas)`. Sem `.select()` (não precisa devolver linhas: menos egress e não depende da policy de SELECT).
**Atomicidade:** a documentação do PostgREST afirma que o insert em lote "uses a single INSERT statement on the back-end" `[CITED: docs.postgrest.org/en/stable/references/api/tables_views.html]`; um único comando `INSERT` do Postgres é atômico (todas as linhas ou nenhuma), inclusive quando uma linha viola um `CHECK`/RLS `with check`. A doc do supabase-js confirma a forma `.insert([{...},{...}])` `[CITED: supabase.com/docs/reference/javascript/insert]`.
**Limite de linhas:** o teto (12) é garantido pela lista fechada do zod (`0|4|8|12`) — não por "validar depois". As policies da 0048 são avaliadas por linha (INSERT policy tem um `exists` em `profiles`: 12 execuções, desprezível). O trigger `agenda2_itens_carimbos` roda por linha; todas as linhas do lote recebem o mesmo `now()` (mesma transação) — irrelevante, pois cada ocorrência cai num dia diferente (D-08 só ordena itens do MESMO dia).
**Forma do payload:** todos os objetos com as MESMAS chaves (supabase-js deriva o parâmetro `columns` das chaves do lote).

```typescript
// app/actions/agenda2.ts (trecho) — substitui o insert de objeto único da Fase 31
import { diaLocalSaoPaulo } from "@/lib/aderencia/registroDiario"
import { gerarDatasSemanais } from "@/lib/agenda2/repeticao"
import { criarAgenda2CriarSchema, type Agenda2CriarItemInput } from "@/lib/validations/agenda2"

export async function criarAgenda2Item(
  values: Agenda2CriarItemInput
): Promise<Agenda2MutationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { code: "unauthenticated", message: MSG_SESSAO_EXPIRADA } }

  // "hoje" no fuso de SÃO PAULO — a Vercel roda em UTC (ver Pitfall 2).
  const hoje = diaLocalSaoPaulo(new Date())
  const parsed = criarAgenda2CriarSchema(hoje).safeParse(values)
  if (!parsed.success) return { error: { code: "validacao", message: MSG_SALVAR_FALHOU } }

  const datas = gerarDatasSemanais(parsed.data.data, parsed.data.repetirSemanas ?? 0)
  const linhas = datas.map((data) => ({
    nome_cliente: parsed.data.nomeCliente,
    bairro: parsed.data.bairro,
    data,
    vendedor_id: user.id, // NUNCA da tela
  }))

  const { error } = await supabase.from("agenda2_itens").insert(linhas) // UM comando = tudo ou nada
  if (error) return { error: { code: "salvar_falhou", message: MSG_SALVAR_FALHOU } }

  revalidatePath("/agenda-2")
  return { data: true }
}
```
**Compatibilidade com a Fase 31:** os testes de `tests/agenda2/agenda2-actions.test.ts` que hoje afirmam `insertSpy` chamado com UM objeto (linhas ~246-266, "criar-dono-do-servidor" e a de aparar espaços) passam a receber um array de 1 elemento — atualizar essas asserções (`toHaveBeenCalledWith([{...}])`). Alternativa de menor blast radius: `linhas.length === 1 ? linhas[0] : linhas` — desaconselhada (dois caminhos de código no ponto mais sensível).

### Pattern 3: Schema de criação separado (pergunta 2)

**What:** NÃO acrescentar `repetirSemanas` a `agenda2ItemSchema` — ele também valida a EDIÇÃO (`atualizarAgenda2Item`), e D-24 proíbe repetir ao editar. Criar uma factory que estende o schema existente. Como o schema de criação precisa de "hoje" para a regra D-23, ele recebe `hoje: string` por parâmetro (puro e testável; sem relógio escondido).
**Detalhes verificados em sandbox:** `agenda2ItemSchema.extend({...})` funciona (o schema atual não tem refinamento no nível do objeto, só nos campos); `.superRefine` adiciona o erro em `path: ["repetirSemanas"]`; chaves extras (`vendedorId`, `concluido`) continuam sendo descartadas `[VERIFIED: execução local zod 4.4]`.
**Tipagem com `react-hook-form`:** usar `.optional()` e NÃO `.default(0)` — `.default` faz tipos de entrada e saída divergirem e o `zodResolver` reclama no `useForm<...>`. `undefined` é tratado como `0` na Server Action (mantém compatíveis os testes da Fase 31 que chamam `criarAgenda2Item` só com 3 campos).

```typescript
// lib/validations/agenda2.ts (acrescentar)
import { REPETIR_SEMANAS_VALORES } from "@/lib/agenda2/repeticao"

export const AGENDA2_MSG_REPETIR_INVALIDO = "Escolha uma opção de repetição válida."
export const AGENDA2_MSG_REPETIR_PASSADO =
  "A repetição só vale para hoje ou datas futuras."

/** `hoje` = AAAA-MM-DD em America/Sao_Paulo (injetado — nunca `new Date()` aqui). */
export function criarAgenda2CriarSchema(hoje: string) {
  return agenda2ItemSchema
    .extend({
      repetirSemanas: z
        .union([z.literal(0), z.literal(4), z.literal(8), z.literal(12)], {
          error: AGENDA2_MSG_REPETIR_INVALIDO,
        })
        .optional(),
    })
    .superRefine((v, ctx) => {
      // Comparação de TEXTO AAAA-MM-DD (imune a fuso, convenção do projeto).
      if ((v.repetirSemanas ?? 0) > 0 && v.data < hoje) {
        ctx.addIssue({ code: "custom", path: ["repetirSemanas"], message: AGENDA2_MSG_REPETIR_PASSADO })
      }
    })
}
export type Agenda2CriarItemInput = z.input<ReturnType<typeof criarAgenda2CriarSchema>>
```
(Manter `REPETIR_SEMANAS_VALORES` como fonte única: o literal-union acima deve espelhá-lo; um teste de sincronia, no molde de `limites-sincronizados.test.ts`, evita divergência.)

### Pattern 4: Seletor "Repetir" só no modo criar (pergunta 3)

**What:** em `Agenda2ItemFields`, renderizar o campo "Repetir" apenas `modo === "criar"` (D-24). Padrão "Não repetir" (privacidade por padrão). Usar o `Select` base-ui já usado na Lista (com prop `items` para o rótulo; `"0"|"4"|"8"|"12"` como strings → converter com `Number()` no `onValueChange`).
- O seletor fica desabilitado (e o valor volta a `0` via `form.setValue("repetirSemanas", 0)`) quando `data` está vazia ou `data < hoje` — com texto de apoio "A repetição só vale para hoje ou datas futuras." (D-23). Fazer o reset no `onSelect` do calendário de data, não em `useEffect`.
- Rótulos devem dizer o total para evitar a ambiguidade de Open Question 1: "Não repetir", "Por 4 semanas (4 visitas, incluindo esta)", etc.
- `resolver`: `modo === "criar" ? zodResolver(criarAgenda2CriarSchema(hoje)) : zodResolver(agenda2ItemSchema)` (o `hoje` vem de `diaLocalSaoPaulo(new Date())` calculado uma vez por montagem do formulário).
- Tipo do formulário: `Agenda2ItemInput & { repetirSemanas?: RepetirSemanas }`. Em modo editar, chamar `atualizarAgenda2Item(id, { nomeCliente, bairro, data })` sem `repetirSemanas` (defesa em profundidade: o schema da edição também o descartaria).
- **Duplicado (D-25):** `existeItemParecido(itensExistentes, values, ...)` só lê `nomeCliente` e `data` — rodar exatamente como hoje, contra a data ORIGINAL; nenhuma mudança na lógica. `valoresIguais(snapshot, atuais)` continua comparando só nome/bairro/data (mudar o seletor de repetição não descarta o aviso, e isso é o desejado). Ajustar apenas o tipo de `avisoPara` (agora aceita o campo extra).
- O texto do aviso (`textoAviso`) cita a data original (`dd/MM`) — manter; não gerar aviso por ocorrência futura.

### Pattern 5: Query por período para o calendário (pergunta 1)

**What:** função nova no mesmo arquivo `lib/supabase/queries/agenda2.ts`, reaproveitando `mapRow`, `buscarPaginado` e o mesmo `select`.
**Por que não `getAgenda2()`:** (1) o corte `.or("concluido.eq.false,data.gte.<ontem>,atualizado_em.gte.<48h>")` esconde concluídos de dias passados — o que D-28 manda MOSTRAR; (2) devolve todos os pendentes futuros sem limite (com repetição de 12 semanas, a Lista já cresce; o calendário só precisa do período visível); (3) alterá-lo arrisca os testes da Fase 31 que fixam esse `.or`. O ROADMAP (nota e) e o CONTEXT (Claude's Discretion) pedem busca só do período visível.
**Semântica D-28 adotada:** o item aparece na célula da sua `data` (data da visita), pendente ou concluído. Uma visita concluída de um dia passado continua na célula daquele dia, riscada = "o que foi feito naquele dia". Não existe coluna de "data de conclusão" (e criar uma contraria a minimização/D-22). Ver Open Question 2.
**Volume/egress:** o PostgREST devolve no máximo 1000 linhas por requisição (o próprio `paginacao.ts` documenta o bug); um mês do time inteiro de um Supervisor pode passar disso → usar `buscarPaginado`, com `order` estável terminando em `id`. Linha ~150 bytes (sem `criado_em`); mesmo 1.500 linhas ≈ 225 KB por navegação, desprezível frente aos 5 GB/mês do free tier `[ASSUMED]`. Índice atual `(vendedor_id, data)` serve o vendedor; para o Supervisor (OR com `is_supervisor()`) o volume do piloto torna varredura irrelevante `[ASSUMED]` — **nenhuma migration/índice novo**.

```typescript
// lib/supabase/queries/agenda2.ts (acrescentar)
export async function getAgenda2Periodo(
  inicio: string, // AAAA-MM-DD, primeiro dia visível
  fim: string     // AAAA-MM-DD, último dia visível
): Promise<Agenda2Item[]> {
  const supabase = await createClient()

  const rows = await buscarPaginado<Agenda2Row>(async (a, b) => {
    const { data, error } = await supabase
      .from("agenda2_itens")
      .select("id, vendedor_id, nome_cliente, bairro, data, concluido, atualizado_em, profiles(nome, sobrenome)")
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: true })
      .order("criado_em", { ascending: true })
      .order("id", { ascending: true })
      .range(a, b)
    return { data: data as unknown as Agenda2Row[] | null, error }
  })

  if (rows === null) throw new Error("Falha ao carregar o calendário da Agenda 2: leitura paginada incompleta")
  return rows.map((row) => mapRow(row))
}
```
```typescript
// app/actions/agenda2.ts (acrescentar) — mesmo molde de getAgendaConcluidosAction
import { validarIntervaloHistorico } from "@/lib/validations/agenda" // IMPORT de leitura; arquivo não é editado

export async function getAgenda2PeriodoAction(inicio: string, fim: string): Promise<GetAgenda2Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { code: "unauthenticated", message: MSG_SESSAO_EXPIRADA } }

  const v = validarIntervaloHistorico(inicio, fim) // formato, inicio<=fim, <=45 dias (cobre a grade de 42)
  if (!v.valido) return { error: { code: "validacao", message: MSG_CARREGAR_FALHOU } }

  try {
    return { data: await getAgenda2Periodo(v.inicio, v.fim) }
  } catch {
    return { error: { code: "fetch_falhou", message: MSG_CARREGAR_FALHOU } }
  }
}
```
Sem `revalidatePath` (leitura pura, chamada do navegador). Sem checagem de papel e sem `.rpc(` — a RLS escopa. Sem `.eq("vendedor_id", …)` (o filtro por vendedor do Supervisor continua sendo estreitamento local sobre o que a RLS liberou; filtrar no servidor reduziria egress mas criaria uma segunda fronteira a testar — não necessário no piloto).

### Pattern 6: O que copiar como está e o que muda (pergunta 4)

| Arquivo original | Copiar como está | Muda na cópia `Agenda2*` |
|---|---|---|
| `AgendaCalendario.tsx` | `referencia` (`useState(now)`), `diaDialogo`, `modo = visao==="lista" ? null : visao`, `rotulo`, `handleAnterior/Proximo/Hoje` (`navegarData`, `rotuloDoPeriodo`), o `Dialog` do dia, a técnica de extrair o intervalo em DOIS TEXTOS para as dependências do `useEffect` | **Remove:** `getAgendaConcluidosAction`, `intervaloDeHistorico`, `mesclarAgenda`, `concluidos`/`historicoFalhou`, `onOpenCliente`, `onConcluirItem`. **Troca:** a busca por `getAgenda2PeriodoAction(inicio, fim)` com intervalo VISÍVEL COMPLETO (`intervaloVisivelAgenda2`: não apara "hoje/futuro" como o original, que só buscava passado) e deps `[inicio, fim, reloadKey]`. **Adiciona:** props `reloadKey`, `vendedorFiltroId` (aplica `filtrarPorVendedor` sobre o resultado, `useMemo`), `podeAlterar`, `salvandoId`, `onEditar/onApagar/onConcluir/onDesmarcar` repassados ao cartão do dia; estado de carregando (Skeleton) e de erro com "Tentar novamente"; texto de erro "Não foi possível carregar o calendário deste período." |
| `AgendaCalendarioToolbar.tsx` | Estrutura inteira (setas, rótulo, "Hoje", seletor Lista/Dia/Semana/Mês com `aria-pressed`, toolbar sempre montada mesmo na Lista) | Legenda: remover "Prospecção"/"Visita"; manter "Atrasado" (vermelho) e "Concluído" (verde), e acrescentar "Pendente" (cor primária). `import type { AgendaVisao }` de `lib/agenda/itens` pode ser mantido (só tipo). |
| `AgendaCalendarioDia.tsx` | Estrutura (lista de itens do dia, vazio tracejado) | Cartão = `Agenda2ItemRow` (não `AgendaItemRow`), `key={item.id}` (não `itemId`), `atrasado={estaAtrasadoAgenda2(item, now)}`; texto vazio "Nada pendente para este dia." → "Nenhuma visita neste dia." (agora mostra concluídos também). Mesmo componente na visão de dia E dentro do diálogo do dia. |
| `AgendaCalendarioMes.tsx` | Grade (`diasDaGradeDoMes`, `rotulosDosDiasDaSemana`, `isSameMonth`, `isSameDay`), `MonthDayCell` (célula inteira clicável, `role="button"`, teclado Enter/Espaço, `aria-label`, "+N mais"), Pitfall 9 (três perguntas independentes: mês visível / atrasado / concluído) | `MonthItemChip`: sem ícones de origem; mostra `nomeCliente`; concluído → `line-through` + `text-muted-foreground` + borda esmeralda (D-29; o original usava só opacidade + ícone, sem riscar); atrasado → borda vermelha; pendente → borda primária. `itensDoDia`/`dividirCelula`/`estaAtrasado` passam a ser as versões `Agenda2` (tipos). `key={item.id}`. |
| `AgendaCalendarioSemana.tsx` | 7 colunas via `diasDaSemana`, cabeçalho do dia, destaque de hoje | `WeekItemChip`: linha 1 = `nomeCliente` (riscado se concluído), linha 2 = `bairro` (no lugar de `titulo`); sem ícone de origem. O clique no chip **abre o diálogo do dia** (novo `onSelecionarDia(dia)`), pois não há ficha de cliente para abrir e o chip não tem ações — o diálogo mostra o `Agenda2ItemRow` completo. Manter `role="button"`, `tabIndex`, Enter/Espaço. |

**Funções puras a acrescentar em `lib/agenda2/itens.ts`** (cópias tipadas, ~30 linhas, porque as originais em `lib/agenda/itens.ts` exigem `AgendaItem` — `origem`, `clienteId`, `razaoSocial` — e esse arquivo não pode ser editado nesta fase):
- `estaAtrasadoAgenda2(item, now)` → `!item.concluido && bucketDoItem(item.data, now) === "atrasado"` (decisão de dia continua em `bucketDoItem`, importada — nunca reimplementada).
- `agruparPorDataAgenda2(itens)`, `itensDoDiaAgenda2(porData, dia)`, `dividirCelulaAgenda2(itens, max)` — mesmos corpos, tipo `Agenda2Item`; chave do mapa = `item.data` VERBATIM (texto com texto, sem converter), `chaveDoDia` importada.
- `intervaloVisivelAgenda2(referencia, modo)` → `{ inicio, fim }` com `chaveDoDia` do primeiro/último de `diasDaGradeDoMes` / `diasDaSemana` / `[referencia]` (metade inicial de `intervaloDeHistorico`, sem o aparo de "ontem").

**Importar direto de `lib/agenda/itens.ts` (já genéricas/puras, sem editar):** `diasDaGradeDoMes`, `diasDaSemana`, `rotulosDosDiasDaSemana`, `navegarData`, `rotuloDoPeriodo`, `chaveDoDia`, `INICIO_DA_SEMANA`, `MAX_ITENS_NA_CELULA`, `bucketDoItem`, `filtrarPorVendedor<T extends {responsavel}>`, tipos `AgendaVisao`/`CalendarioModo`/`AgendaBucket`.

### Pattern 7: Integração em `Agenda2List` (dona das escritas)

- Novo estado `const [visao, setVisao] = useState<AgendaVisao>("lista")` (padrão Lista, como na Agenda atual — D-01 da Fase 20).
- Renderizar `<Agenda2Calendario visao onVisaoChange itens... />` **sempre montado** (a toolbar é o único caminho de volta ao Calendário, igual ao original) acima do bloco da Lista; o bloco atual (seções Atrasado/Hoje/Próximos e os estados vazios) só renderiza com `visao === "lista"`. Os estados vazios/CTA da Lista não devem aparecer na visão de calendário.
- Passar ao calendário: `reloadKey`, `vendedorFiltroId`, `showResponsavel`, `podeAlterar={!isSupervisor}`, `salvandoId`, e os handlers que a Lista já tem (`handleEditar`, `handleAbrirApagar`, `handleConcluir`, `handleDesmarcar`). Todas as escritas continuam chamando `handleRecarregar()` (`reloadKey++`), que re-dispara tanto a leitura da Lista quanto a do calendário. O formulário (`Agenda2ItemForm`) e o `Agenda2ApagarDialog` continuam montados UMA vez na Lista — o botão "Adicionar visita" do cabeçalho funciona nas duas visões.
- A leitura da Lista (`getAgenda2Action`) continua rodando a cada `reloadKey` mesmo na visão de calendário: ela alimenta `itensExistentes` (aviso de duplicado D-07/D-25) e as opções do filtro do Supervisor (`vendedoresDaAgenda2`). Não otimizar.
- O filtro de vendedor do Supervisor (mesmo `Select`, mesmo `vendedorFiltroId`) vale nas duas visões; no calendário é aplicado com `filtrarPorVendedor` sobre o resultado do período (D-30).

### Anti-Patterns to Avoid
- **Editar `AgendaCalendario*.tsx`, `lib/agenda/itens.ts` ou `tests/agenda/**`** (nem "só para generalizar um tipo"): o critério de sucesso 5 e a decisão D-27 exigem diff zero na Agenda atual. Cópia, não abstração.
- **Alimentar o calendário com `getAgenda2()`** (esconde concluídos passados; sem limite de período).
- **N chamadas `.insert()` em laço / `Promise.all`:** perde a atomicidade (D-20).
- **`new Date("YYYY-MM-DD")` ou aritmética de milissegundos** para datas (bug de fuso já pago uma vez no projeto).
- **`repetirSemanas` dentro de `agenda2ItemSchema`** (vazaria para a edição, violando D-24).
- **Confiar em `new Date()` do servidor para "hoje"** (UTC; ver Pitfall 2).
- **Colocar `referencia`/`now` (objetos `Date` recriados a cada render) nas dependências do `useEffect` do fetch** (tempestade de requisições, T-21-13 da Fase 21).
- **RPC/`SECURITY DEFINER`/coluna de série/migration** para a repetição (travado).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Somar semanas a uma data | Soma de milissegundos / `new Date(str)` | `parseISO` + `addWeeks` + `chaveDoDia` | Aritmética de calendário local; verificado cruzando horário de verão e virada de ano |
| "Hoje" do ponto de vista do vendedor no servidor | `new Date().toISOString().slice(0,10)` (UTC) | `diaLocalSaoPaulo(agora)` de `lib/aderencia/registroDiario.ts` (puro, `Intl.DateTimeFormat` + `formatToParts`) | Entre 21h e 24h em Brasília o UTC já é "amanhã" |
| Validar intervalo pedido pelo navegador | Checagem própria de datas | `validarIntervaloHistorico` (`lib/validations/agenda.ts`, teto 45 dias) | Já testada na Fase 21; cobre a grade de mês (42 dias) |
| Leitura > 1000 linhas | `.range()` solto / confiar no default | `buscarPaginado` (`lib/supabase/queries/paginacao.ts`) | O PostgREST trunca em 1000 em silêncio |
| Estreitar por vendedor | `.filter()` novo | `filtrarPorVendedor<T>` | Autoridade única, já genérica |
| Classificar atrasado/hoje/próximos | Nova comparação de datas | `bucketDoItem` | Autoridade única do projeto |
| Grade do mês/semana, rótulos, navegação | Cálculo de calendário novo | `diasDaGradeDoMes`/`diasDaSemana`/`navegarData`/`rotuloDoPeriodo` | Evita desalinhamento entre mês e semana (Pitfall 8 da Fase 20) |
| Atomicidade do lote | RPC com transação, ou "rollback" manual por delete | Um único `.insert(array)` | Já é uma instrução atômica; rollback manual seria não-atômico |
| Ligar ocorrências | `serie_id` | — (D-22) | Decisão travada, minimização LGPD |

**Key insight:** o risco desta fase é de disciplina, não de tecnologia — copiar o calendário sem importar acidentalmente lógica da Agenda atual (e sem editá-la), e não "otimizar" a repetição para um RPC ou uma coluna extra.

## Common Pitfalls

### Pitfall 1: Datas com `new Date(string)` ou soma de milissegundos
**What goes wrong:** ocorrências caem num dia deslocado (violando o critério de sucesso 1: "nunca num dia deslocado").
**Why:** `new Date("2026-10-05")` é meia-noite UTC = 21h do dia anterior em Brasília; somar `7*24*3600*1000` quebra no horário de verão.
**How to avoid:** `gerarDatasSemanais` (Pattern 1) como única fonte. Teste: para cada data gerada, `parseISO(d).getDay() === parseISO(base).getDay()`.
**Warning signs:** uma ocorrência com weekday diferente da primeira; 2026-10-30 → 2026-11-05 em vez de 2026-11-06.

### Pitfall 2: "Hoje" calculado em UTC no servidor (regra D-23)
**What goes wrong:** das 21h às 24h em Brasília, o vendedor escolhe a data de hoje com repetição e o servidor (UTC, "amanhã") rejeita com "repetição só vale para hoje ou futuras", ou o contrário perto da meia-noite.
**Why:** Server Actions rodam na Vercel em UTC; `bucketDoItem` na tela usa o relógio do navegador, mas a regra D-23 é validada no servidor.
**How to avoid:** `diaLocalSaoPaulo(new Date())` tanto na Server Action quanto no formulário (mesma função → UX e servidor concordam). Teste com `vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-03T01:30:00Z"))` (= 22:30 de 02/10 em SP) e `data = "2026-10-02"` com `repetirSemanas = 4` → aceito.
**Warning signs:** relatos de erro só à noite.

### Pitfall 3: Usar `getAgenda2()` para o calendário
**What goes wrong:** ao navegar para o passado o calendário não mostra concluídos antigos (viola D-28), e para o futuro baixa todos os pendentes (viola o cuidado de volume).
**How to avoid:** `getAgenda2Periodo` (Pattern 5). Teste: item concluído há 10 dias aparece no calendário (mock devolve) e a query usa `.gte/.lte`, sem `.or`.

### Pitfall 4: Corte silencioso em 1000 linhas
**What goes wrong:** Supervisor, mês cheio, vê dias faltando sem erro.
**How to avoid:** `buscarPaginado` + `order` terminando em `id`. Teste de query: `rangeSpy` chamado 2x quando a 1ª página vem com 1000 linhas.

### Pitfall 5: Dependências do efeito com objetos `Date`
**What goes wrong:** `referencia`/`now = new Date()` recriados a cada render → fetch a cada render.
**How to avoid:** derivar `inicio`/`fim` como textos e usar só eles (+ `reloadKey`) como dependências, como o original faz (comentário T-21-13). Teste: re-render sem mudar período → `getAgenda2PeriodoAction` chamada 1 vez.

### Pitfall 6: Resposta atrasada sobrescrevendo período novo
**What goes wrong:** usuário navega rápido; a resposta do mês anterior chega depois e mostra dados errados.
**How to avoid:** guarda `cancelled` no cleanup do efeito (padrão já usado em `Agenda2List`/`AgendaCalendario`). Teste com duas promises resolvidas em ordem invertida.

### Pitfall 7: `repetirSemanas` vazando para a edição
**What goes wrong:** editar um item com payload manipulado gera... nada (o update ignora), mas o schema aceitaria o campo e confundiria o contrato; ou, pior, alguém adiciona lógica de repetição no update.
**How to avoid:** schema de criação separado (Pattern 3); `atualizarAgenda2Item` continua com `agenda2ItemSchema`; teste: `atualizarAgenda2Item` com `repetirSemanas: 4` não faz `insert` e o `update` recebe só os 3 campos.

### Pitfall 8: Clique duplo / resposta perdida gera 2 lotes
**What goes wrong:** sem série (D-22) não há idempotência: duplo clique ou "erro de rede mas o banco gravou" faz o vendedor reenviar e criar 2×N itens.
**How to avoid:** o botão do formulário já fica `disabled` com `isSubmitting` (manter); em erro no modo criar, chamar `onSalvo()` (apenas recarrega a Lista, sem fechar o formulário) para que o aviso de duplicado (D-07) detecte o item original no reenvio. Não adicionar chave de idempotência (exigiria coluna — contra D-22).

### Pitfall 9: Chip da semana sem ação
**What goes wrong:** copiar `WeekItemChip` com `onOpen` para uma ficha que não existe deixa o chip clicável sem efeito (ou chamando função errada).
**How to avoid:** chip da semana abre o diálogo do dia (Pattern 6), que contém o `Agenda2ItemRow` com as ações.

### Pitfall 10: Testes de RLS em lote contra o banco real
**What goes wrong:** (a) usar contas semente (apagadas em 2026-08-19); (b) nome de fixture com 8+ dígitos seguidos é recusado pela constraint `chk_agenda2_*_sem_documento` (`Date.now()` puro tem 13 dígitos); (c) mais de 2 logins por arquivo; (d) Supervisor baixar itens reais de outros vendedores.
**How to avoid:** `createTestMember`/`deleteTestMember` (confirmado em `tests/helpers/supabase-test-clients.ts` e usado em `tests/agenda2/rls-agenda2.test.ts`), copiar o helper local `nomeInventado` (timestamp quebrado em grupos de 3 dígitos com "x") e o `hojeSaoPaulo`, filtrar TODA leitura do Supervisor pelos ids das fixtures, limpar em `afterAll` com `serviceClient()`.

### Pitfall 11: Lista "Próximos dias" e contador do menu crescem com a repetição
**What goes wrong:** uma repetição de 12 semanas adiciona 12 linhas em "Próximos dias" e +12 no contador de pendentes do menu (`getAgenda2PendentesCount` conta TODO pendente do dono, inclusive futuro).
**Note:** é consistente com a Fase 31 (D-03 "sem corte de dias"; D-13 "conta os pendentes") e o selo continua igual à soma das seções — não é bug. Sinalizar ao dono no checkpoint (Open Question 5); não mudar sem decisão.

## Code Examples

### Teste das datas (verificado em sandbox nesta sessão)
```typescript
// tests/agenda2/repeticao.test.ts
import { parseISO } from "date-fns"
import { describe, expect, it } from "vitest"
import { gerarDatasSemanais } from "@/lib/agenda2/repeticao"

describe("gerarDatasSemanais", () => {
  it("12 semanas atravessam virada de ano e horário de verão sem deslocar o dia", () => {
    const datas = gerarDatasSemanais("2026-10-30", 12)
    expect(datas).toHaveLength(12)
    expect(datas[0]).toBe("2026-10-30")
    expect(datas[2]).toBe("2026-11-13")
    expect(datas[11]).toBe("2027-01-15")
    const dow = parseISO("2026-10-30").getDay()
    for (const d of datas) expect(parseISO(d).getDay()).toBe(dow)
  })
  it("0 = só a data escolhida", () => {
    expect(gerarDatasSemanais("2026-10-05", 0)).toEqual(["2026-10-05"])
  })
})
```

### Teste de ação com lote (mock no molde de `agenda2-actions.test.ts`)
```typescript
it("criar com repetição: UMA chamada de insert com N linhas, dono da sessão", async () => {
  insertSpy.mockResolvedValueOnce({ error: null })
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T15:00:00Z"))

  await criarAgenda2Item({ nomeCliente: "Mercado Bom Preço", bairro: "Centro", data: "2026-10-05", repetirSemanas: 4, vendedorId: "outro" } as never)

  expect(insertSpy).toHaveBeenCalledTimes(1) // atômico: nunca N chamadas
  const linhas = insertSpy.mock.calls[0][0] as { data: string; vendedor_id: string }[]
  expect(linhas.map((l) => l.data)).toEqual(["2026-10-05","2026-10-12","2026-10-19","2026-10-26"])
  expect(new Set(linhas.map((l) => l.vendedor_id))).toEqual(new Set(["u1"]))
  vi.useRealTimers()
})
```

### Teste de integração contra o banco real (esboço — `tests/agenda2/rls-agenda2-repeticao.test.ts`)
```typescript
// fixtures: createTestMember("vendedor","agenda2-rep-a"/"-b"), createTestMember("supervisor","agenda2-rep"); 2 logins (A e Supervisor)
it("lote de 12 grava 12 linhas do dono, uma por semana", async () => {
  const nome = nomeInventado("lote-12")
  const linhas = datas12.map((data) => ({ vendedor_id: vendedorA.id, nome_cliente: nome, bairro: "Centro", data }))
  const { error } = await clientA.from("agenda2_itens").insert(linhas)
  expect(error).toBeNull()
  const { data } = await serviceClient().from("agenda2_itens").select("data").eq("nome_cliente", nome).order("data")
  expect(data).toHaveLength(12)
})
it("tudo-ou-nada: 11 válidas + 1 violando CHECK => 0 linhas", async () => {
  const nome = nomeInventado("lote-quebrado")
  const linhas = datas12.map((data, i) => ({ vendedor_id: vendedorA.id, nome_cliente: nome, bairro: i === 11 ? "b".repeat(61) : "Centro", data }))
  const { error } = await clientA.from("agenda2_itens").insert(linhas)
  expect(error).not.toBeNull()
  const { data } = await serviceClient().from("agenda2_itens").select("id").eq("nome_cliente", nome)
  expect(data ?? []).toHaveLength(0)
})
it("tudo-ou-nada pela RLS: 1 linha com vendedor_id de B derruba o lote", /* idem, espera 0 linhas */)
it("Supervisor não insere lote", /* espera erro e 0 linhas */)
it("leitura por período: vendedor A só vê os seus; Supervisor vê A e B (filtrando por ids de fixture)", /* gte/lte */)
```

### Efeito de busca do calendário (esqueleto)
```tsx
// components/agenda2/Agenda2Calendario.tsx (trecho)
const modo: CalendarioModo | null = visao === "lista" ? null : visao
const intervalo = modo === null ? null : intervaloVisivelAgenda2(referencia, modo)
const inicio = intervalo?.inicio ?? null // TEXTOS, nunca o objeto
const fim = intervalo?.fim ?? null

useEffect(() => {
  if (inicio === null || fim === null) return // Lista: nada a buscar
  let cancelled = false
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setEstado({ status: "carregando" })
  getAgenda2PeriodoAction(inicio, fim).then((r) => {
    if (cancelled) return
    setEstado(r.error ? { status: "erro" } : { status: "pronto", itens: r.data })
  })
  return () => { cancelled = true }
}, [inicio, fim, reloadKey])

const filtrados = useMemo(() => filtrarPorVendedor(itens, vendedorFiltroId), [itens, vendedorFiltroId])
const porData = useMemo(() => agruparPorDataAgenda2(filtrados), [filtrados]) // UMA vez; mesmo mapa p/ mês e semana
```

## State of the Art

Não aplicável (não há versão anterior da Agenda 2 a comparar). Única observação de postura: esta é a primeira escrita em lote (`.insert(array)`) em código de PRODUÇÃO do projeto — o precedente existente é só de seeds de teste (`tests/clientes/filtro-prospeccao-postgrest.test.ts:91`) e da importação em massa de clientes (v1.1, por outro caminho).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Repetir por N semanas" = N ocorrências NO TOTAL, incluindo a data escolhida (deslocamentos 0..N-1, máx. 12 linhas). Alternativa: a data escolhida + N seguintes (N+1 linhas, máx. 13). O texto de AGD2-02 ("nas próximas 4, 8 ou 12 semanas") é ambíguo; D-20/ROADMAP ("por N semanas… uma ocorrência por semana") favorece a leitura adotada | Pattern 1 / Open Question 1 | Vendedor recebe uma visita a mais ou a menos do que esperava. Mitigação: rótulo do seletor mostra o total ("4 visitas, incluindo esta"); troca é uma linha (`length`) |
| A2 | D-28: o item concluído é mostrado na célula da sua `data` (data da visita), não numa "data de conclusão" (não existe coluna; criar uma contraria D-22/minimização) | Pattern 5 / Open Question 2 | Se o dono entende "concluído naquele dia" como o dia em que clicou Concluir, uma visita planejada para segunda e marcada na quarta aparece na segunda, não na quarta |
| A3 | Calendário permite ao dono editar/apagar/concluir/desmarcar (via diálogo/visão de dia com `Agenda2ItemRow`), espelhando o original que tem "Concluir" na visão de dia; o CONTEXT não detalha | Pattern 6/7 / Open Question 3 | Se o dono quiser calendário só-leitura, remover handlers (mais simples) |
| A4 | Chip da visão de semana abre o diálogo do dia (comportamento novo, pois não há ficha) | Pattern 6 | Pequeno desvio de UX em relação ao original; baixo risco |
| A5 | "Hoje" para D-23 = dia de `America/Sao_Paulo` (equipe e dono no Brasil) | Pitfall 2 | Se houvesse usuário em outro fuso, a regra usaria o dia de SP — aceitável para o piloto |
| A6 | Volume do piloto não exige índice novo em `data` nem filtro de vendedor no servidor; ≈150 B/linha, ≤ ~225 KB por navegação mesmo para o time inteiro | Pattern 5 | Se o volume crescer, adicionar migration de índice/filtro server-side numa fase própria |
| A7 | Fornecer `repetirSemanas` `optional` (não `.default(0)`) evita descompasso de tipos com `zodResolver`/`react-hook-form` | Pattern 3 | Se o typecheck reclamar, ajustar tipos do formulário; sem impacto de comportamento |

## Open Questions

1. **"Repetir por 4 semanas" são 4 visitas no total ou a visita escolhida + 4?**
   - What we know: REQUIREMENTS/PROJECT dizem "nas próximas X semanas"; D-20 e ROADMAP dizem "por N semanas… uma ocorrência por semana"; D-25 fala em "N ocorrências futuras geradas".
   - What's unclear: se a data escolhida conta como a 1ª das N ou é a "semana 0".
   - Recommendation: adotar N no total (máx. 12 linhas) e **mostrar o total no rótulo do seletor**; levar a confirmação ao dono no checkpoint de aprovação do plano (custo de trocar = 1 linha em `gerarDatasSemanais`).

2. **"O que foi concluído naquele dia" (D-28): pela data da visita ou pelo dia em que foi marcado?**
   - What we know: só existe `data` (visita) e `atualizado_em` (qualquer alteração, não só concluir).
   - Recommendation: pela `data` da visita (concluído = riscado na própria célula). Confirmar com o dono; usar `atualizado_em` seria impreciso (editar também o move) e criar coluna nova contraria D-22.

3. **O calendário permite agir (editar/apagar/concluir) ou é só visão?** Recomendação: permite, reaproveitando `Agenda2ItemRow` (mesma decisão do original para "Concluir"); Supervisor sempre só leitura (D-16/D-30).

4. **Reenvio após falha de rede** (Pitfall 8): aceitar apenas a mitigação de UI (desabilitar botão + recarregar a Lista em erro) ou o dono quer algo mais forte? Mais forte exigiria coluna (contra D-22). Recomendação: só a mitigação de UI.

5. **Contador do menu e "Próximos dias" crescem N itens a cada repetição** (consistente com D-03/D-13). Se o dono quiser que o selo conte só "até hoje", é mudança em `getAgenda2PendentesCount` (+ teste da Fase 31) — fora desta fase salvo decisão explícita.

6. **Texto de AGD2-08 ("reaproveitando o mesmo componente de calendário")** conflita literalmente com D-27 (copiar). Recomendação: ao concluir a fase, ajustar a redação em REQUIREMENTS para "mesmo visual e comportamento", para o verificador não marcar falso gap.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest/Next | ✓ | v24.21.0 | — |
| npm | scripts | ✓ | 11.19.0 | — |
| `.env.local` (credenciais Supabase) | testes de RLS contra banco real | ✓ (arquivo presente) | — | Sem ele, só os testes unitários/de componente rodam |
| Supabase hospedado (projeto único = produção) | `rls-agenda2-repeticao.test.ts` | ✓ (já usado pela Fase 31) | — | — |
| Vitest | `npm test` | ✓ | `^4.1.10` | — |
| Branch `staging` no GitHub / Vercel Preview | Fluxo de deploy do projeto | ✓ (`origin/staging` existe) | — | — |
| Supabase CLI (`db push`) | — | não necessário: **esta fase não tem migration** | — | — |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** nenhuma.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (`*.test.ts` em ambiente node; `*.test.tsx` em jsdom via `environmentMatchGlobs`); Testing Library |
| Config file | `vitest.config.ts` (`fileParallelism: false` — suítes serializadas contra o banco real) |
| Quick run command | `npx vitest run tests/agenda2` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGD2-02 | Datas semanais: mesmo dia da semana, vira ano/horário de verão, 0 = 1 data | unit | `npx vitest run tests/agenda2/repeticao.test.ts` | ❌ Wave 0 |
| AGD2-02 | Schema de criação: aceita só 0/4/8/12; recusa 5, "4", 1000; recusa repetir com data < hoje; aceita data = hoje; chaves extras descartadas; sincronia com `REPETIR_SEMANAS_VALORES` | unit | `npx vitest run tests/agenda2/validacao-agenda2.test.ts` (estender) | ⚠️ existe, estender |
| AGD2-02 | Server Action: UMA chamada `insert` com N linhas; `vendedor_id` da sessão; regra D-23 com relógio fake em SP (22:30 locais = dia seguinte em UTC); erro → `salvar_falhou` sem `revalidatePath`; edição ignora `repetirSemanas`; asserções de insert único da Fase 31 atualizadas para array | unit (mock) | `npx vitest run tests/agenda2/agenda2-actions.test.ts` | ⚠️ existe, estender/ajustar |
| AGD2-02 | Lote real: 12 linhas do dono; atomicidade (CHECK quebra o lote → 0 linhas); RLS por linha (linha de outro dono derruba o lote); Supervisor/desativado não inserem lote; cada ocorrência editável/apagável/concluível sozinha | integration (banco real) | `npx vitest run tests/agenda2/rls-agenda2-repeticao.test.ts` | ❌ Wave 0 |
| AGD2-02 | Formulário: seletor só em "criar" (não em "editar"); padrão "Não repetir"; desabilitado/zerado com data passada; envia `repetirSemanas`; aviso de duplicado roda 1 vez contra a data original | component | `npx vitest run tests/agenda2/agenda2-item-form.test.tsx` | ⚠️ existe, estender |
| AGD2-08 | Funções puras do calendário (`agruparPorDataAgenda2`, `itensDoDiaAgenda2`, `dividirCelulaAgenda2`, `intervaloVisivelAgenda2`, `estaAtrasadoAgenda2`) | unit | `npx vitest run tests/agenda2/itens.test.ts` | ⚠️ existe, estender |
| AGD2-08 | Query por período: `.gte/.lte`, sem `.or`, ordem data/criado_em/id, pagina quando 1000, erro → throw; Action valida intervalo (45 dias) e devolve erro fixo | unit (mock) | `npx vitest run tests/agenda2/agenda2-periodo-query.test.ts` | ❌ Wave 0 |
| AGD2-08 | Container: busca 1× por período (não por re-render), refaz com `reloadKey`, descarta resposta atrasada, estado de erro/retry, navegação setas/"Hoje", semana começa na segunda, Lista = nenhuma busca | component | `npx vitest run tests/agenda2/agenda2-calendario.test.tsx` | ❌ Wave 0 (espelha `agenda-calendario.test.tsx` + `agenda-calendario-historico.test.tsx`) |
| AGD2-08 | Visões: mês (células, "+N mais", concluído riscado `line-through`, atrasado vermelho, borda do mês vizinho), semana (chip abre diálogo), dia (`Agenda2ItemRow`, concluídos visíveis, vazio) | component | `npx vitest run tests/agenda2/agenda2-calendario-mes.test.tsx tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario-dia.test.tsx tests/agenda2/agenda2-calendario-toolbar.test.tsx` | ❌ Wave 0 (espelham os 4 arquivos de `tests/agenda`) |
| AGD2-08 | Integração `Agenda2List`: alterna Lista/Calendário, Supervisor filtra por vendedor nas duas visões, concluir no calendário recarrega e risca, Supervisor sem botões de escrita | component | `npx vitest run tests/agenda2/agenda2-calendario-integracao.test.tsx tests/agenda2/agenda2-list.test.tsx` | ❌ Wave 0 / ⚠️ existe |
| Critério 5 (Agenda atual idêntica) | `components/agenda`, `lib/agenda`, `app/actions/agenda.ts`, `lib/supabase/queries/agenda.ts`, `tests/agenda`, `supabase/migrations` sem diff | structural | `git diff --stat <commit-base-da-fase>..HEAD -- components/agenda lib/agenda app/actions/agenda.ts lib/supabase/queries/agenda.ts tests/agenda supabase/migrations` (esperado: vazio) + `npx vitest run tests/agenda` verde | ❌ Wave 0 (passo de verificação) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/agenda2`
- **Per wave merge:** `npx vitest run tests/agenda2 tests/agenda tests/layout`
- **Phase gate:** `npm test` completo verde antes de `/gsd-verify-work`; depois push para `staging`, conferir o Preview da Vercel e só então `master` (regra do CLAUDE.md)

### Wave 0 Gaps
- [ ] `tests/agenda2/repeticao.test.ts` — AGD2-02 (datas)
- [ ] `tests/agenda2/rls-agenda2-repeticao.test.ts` — AGD2-02 (lote real; fixtures descartáveis, máx. 2 logins)
- [ ] `tests/agenda2/agenda2-periodo-query.test.ts` — AGD2-08 (query/Action; o mock de builder existente não tem `gte/lte`, definir o próprio)
- [ ] `tests/agenda2/agenda2-calendario{,-dia,-mes,-semana,-toolbar,-integracao}.test.tsx` — AGD2-08 (espelham os 7 de `tests/agenda`, sem tocá-los; `NOW` fixo como `new Date("2026-08-14T10:00:00")` — construtor com hora, hora local)
- [ ] Ajuste de asserções de `insertSpy` (objeto → array) em `tests/agenda2/agenda2-actions.test.ts`
- [ ] Nenhum framework novo a instalar

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não (sem mudança) | Supabase Auth existente |
| V3 Session Management | não | `@supabase/ssr` existente |
| V4 Access Control | **sim** | RLS 0048 (por linha, também em lote); `vendedor_id` sempre da sessão; Supervisor só leitura |
| V5 Input Validation | **sim** | zod na Server Action: lista fechada `0|4|8|12`, datas ISO válidas, regra D-23, intervalo ≤ 45 dias; `CHECK` do banco como retaguarda |
| V8 Data Protection / V11 Business Logic | **sim** | Teto de linhas por envio (12) pela lista fechada; padrão "Não repetir"; sem coluna nova; sem exportação |
| V6 Cryptography | não | — |

### Known Threat Patterns for Next.js Server Actions + Supabase RLS (lote/calendário)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Payload manipulado com `repetirSemanas = 10000` (amplificação de escrita/inchaço de dados) | DoS / Tampering | Lista fechada (`z.union` de literais) validada NO servidor; nunca "número livre" |
| Lote com uma linha de `vendedor_id` alheio misturada | Spoofing / Tampering | Payload montado só com `user.id`; `with check` da RLS por linha derruba o lote inteiro (teste de integração) |
| Supervisor (ou vendedor desativado) tentando inserir lote | Elevation of Privilege | Policy de INSERT da 0048 (`role='vendedor' and ativo=true`) — sem mudança; teste |
| Intervalo gigante em `getAgenda2PeriodoAction` (egress) | DoS / Info Disclosure | `validarIntervaloHistorico` (≤ 45 dias) + RLS escopa linhas; resposta com mensagem fixa |
| Mensagem de erro do banco vazando para a tela | Information Disclosure | Mensagens fixas (padrão da Fase 31, T-31-21) |
| Reenvio/duplo clique criando 2×N linhas | Tampering (integridade) | Botão desabilitado em `isSubmitting`; recarregar Lista em erro; sem idempotência por coluna (D-22) |
| Texto livre com dado pessoal extra (CPF/telefone) replicado N vezes | LGPD (fora do STRIDE) | Schema/constraints da 0048 já recusam 8+ dígitos e limitam tamanho; dica de tela "Nome Fantasia" continua |

**Alerta de conformidade (LGPD):** a repetição multiplica dado pessoal (nome do cliente + bairro + data) e cria uma agenda futura de deslocamento de funcionário de até 12 semanas. O escopo já aprovado (8 colunas, sem identificador de série) é o mínimo possível e esta fase não adiciona colunas, exportação ou nenhum novo dado; o **prazo de guarda de 1 ano (decisão do dono, 2026-10-01) ainda não tem descarte implementado** — vale o dono avaliar quando isso vira prioridade, especialmente porque a Agenda 2 agora tende a ter mais linhas por vendedor. Esta pesquisa não altera o escopo.

## Sources

### Primary (HIGH confidence)
- Código do projeto lido diretamente: `components/agenda/AgendaCalendario*.tsx` (5 arquivos), `components/agenda/AgendaList.tsx`, `components/agenda2/*`, `lib/agenda/itens.ts`, `lib/agenda2/itens.ts`, `lib/validations/agenda2.ts`, `lib/validations/agenda.ts` (`validarIntervaloHistorico`), `lib/supabase/queries/{agenda,agenda2,paginacao}.ts`, `app/actions/{agenda,agenda2}.ts`, `app/(app)/agenda-2/page.tsx`, `lib/aderencia/registroDiario.ts` (`diaLocalSaoPaulo`), `supabase/migrations/0048_agenda2_itens.sql`
- Testes lidos como molde: `tests/agenda2/{rls-agenda2,agenda2-actions,agenda2-query,agenda2-item-form,agenda2-list}.test.ts(x)`, `tests/agenda/agenda-calendario-historico.test.tsx`, `tests/helpers/supabase-test-clients.ts` (confirma `createTestMember`/`deleteTestMember`; contas semente apagadas em 2026-08-19), `vitest.config.ts`
- Planejamento: `32-CONTEXT.md`, `32-DISCUSSION-LOG.md`, `31-CONTEXT.md`, `31-RESEARCH.md`, `31-VALIDATION.md`, `REQUIREMENTS.md`, `ROADMAP.md` (Fase 32), `.claude/skills/Supabase-conventions/SKILL.md`, `CLAUDE.md` (2)
- Sandbox executado nesta sessão (node v24.21.0, zod 4.4, date-fns 4.4): `.extend()` + `.superRefine()` + remoção de chaves extras; `addWeeks` cruzando horário de verão (`TZ=America/New_York`) e virada de ano

### Secondary (MEDIUM confidence)
- PostgREST docs, Tables and Views (bulk insert "uses a single INSERT statement on the back-end"): https://docs.postgrest.org/en/stable/references/api/tables_views.html — `[CITED]`
- Supabase JS reference, insert (forma `.insert([...])`; linhas não são devolvidas por padrão): https://supabase.com/docs/reference/javascript/insert — `[CITED]`

### Tertiary (LOW confidence)
- Estimativas de volume/egress e ausência de necessidade de índice (A6) — raciocínio, não medição.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma dependência nova; versões do `package.json` local
- Architecture: HIGH — padrões e arquivos lidos do próprio código; atomicidade confirmada na doc oficial do PostgREST
- Pitfalls: HIGH — cada um com causa raiz em código real (UTC x SP, corte do `getAgenda2`, limite de 1000, deps do efeito, constraint de 8 dígitos)
- Interpretação de requisitos (A1, A2, A3): MEDIUM — ambiguidades reais de produto, listadas em Open Questions

**Research date:** 2026-10-02
**Valid until:** estável (sem dependência de versões externas); revisar só se `lib/agenda/itens.ts`, `AgendaCalendario*.tsx`, `lib/agenda2/itens.ts` ou a migration 0048 mudarem antes da execução.
