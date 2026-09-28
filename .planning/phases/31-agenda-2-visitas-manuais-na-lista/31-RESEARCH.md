# Phase 31: Agenda 2 — Visitas Manuais na Lista - Research

**Researched:** 2026-09-28
**Domain:** Nova tabela Supabase (RLS-only CRUD) + tela Next.js isolada (Server Actions + Server Component + Client Component), reaproveitando 100% de padrões já provados neste codebase. Zero tecnologia nova.
**Confidence:** HIGH (todo achado vem de leitura direta do código-fonte e das migrations já aplicadas deste projeto — não é síntese de terceiros)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Formato da lista**
- D-01: Agrupamento em 3 seções — Atrasado / Hoje / Próximos — mesmo padrão já usado em `AgendaList.tsx`/`agruparAgenda()` na Agenda atual.
- D-02: Item pendente com data passada fica destacado visualmente como atrasado — mesmo tratamento (`atrasado={true}`) já usado em `AgendaItemRow`.
- D-03: "Próximos" usa o MESMO horizonte de dias já usado na Agenda atual (não muda a constante existente, não fica "sem limite").
- D-04: Item concluído continua visível na lista do dia, riscado (`line-through`) — tratamento novo, não existe pattern equivalente em Perdidos/Encerrados.
- D-05: Item concluído pode ser desmarcado (volta a pendente) a qualquer momento.
- D-06: Item concluído pode ser editado diretamente (nome/bairro/data), sem precisar desmarcar primeiro.
- D-07: Criar dois itens "iguais" (mesmo nome + mesma data) não é bloqueado — sistema avisa ("já existe um item parecido nesse dia") mas deixa o vendedor confirmar e criar mesmo assim.
- D-08: Dentro do mesmo dia, itens aparecem em ordem de criação (sem campo de horário, sem ordenação alfabética).
- D-09: Vendedor pode criar item para data passada (recuperar visita que esqueceu de anotar) — sem trava de "só hoje em diante".
- D-10: Estado vazio mostra mensagem simples de boas-vindas com o botão de criar em destaque — texto exato fica a critério de quem implementar.
- D-11: Sem busca/filtro por texto (nome/bairro) dentro da lista nesta fase.

**Contador no menu**
- D-12: "Agenda 2" mostra contador de pendentes no menu, mesmo padrão do item "Agenda".
- D-13: Contador conta só os itens pendentes do próprio vendedor logado (atrasados incluídos na mesma contagem).
- D-14: No menu recolhido/compacto, "Agenda 2" mostra bolinha sem número quando há pendente — mesmo padrão `data-slot="agenda-pendente-dot"`.
- D-15: Ordem final confirmada no menu: Agenda → Agenda 2 → Clientes → Perdidos → Encerrados → Dashboard. Testes de ordem do menu precisam de ajuste.

**Permissão do Supervisor**
- D-16: Supervisor só visualiza os itens da Agenda 2 de todo o time — não cria, não edita, não apaga item (nem o próprio, nem de vendedor) nesta fase.
- D-17: Filtro por vendedor do Supervisor segue o mesmo padrão de componente já usado na Agenda atual/Perdidos/Encerrados.
- D-18: Filtro do Supervisor abre em "Todos" (time inteiro) por padrão.
- D-19: Vendedor desativado: os itens continuam existindo, visíveis ao Supervisor, sem transferência para outro vendedor.

### Claude's Discretion
- Texto exato do estado vazio (D-10).
- Ordem dos itens dentro do mesmo dia quando há empate de "ordem de criação" — usar `id`/`created_at` como desempate.
- Ícone do item "Agenda 2" no menu.
- Texto exato do aviso de possível duplicado (D-07).

### Deferred Ideas (OUT OF SCOPE)
- Repetição semanal (4/8/12 semanas) e visão de Calendário — Fase 32 (AGD2-02, AGD2-08).
- Prazo de guarda dos dados do piloto (LGPD) — **em aberto, não decidido pelo dono**. Ver `## Assumptions Log` e `## Open Questions` abaixo — esta fase NÃO deve implementar descarte automático sem confirmação explícita do dono.
- Vincular item da Agenda 2 a um cadastro de cliente real — Out of Scope explícito em `REQUIREMENTS.md`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGD2-01 | Vendedor cria item manual (nome livre, bairro, data) | Tabela nova `agenda2_itens` + RLS INSERT owner-only + Server Action + form React Hook Form/Zod (ver `## Architecture Patterns` Pattern 1 e 4) |
| AGD2-03 | Vendedor edita item que ele mesmo criou | RLS UPDATE owner-only (sem OR supervisor) + Server Action `atualizarAgenda2Item` (Pattern 1) |
| AGD2-04 | Vendedor apaga item que ele mesmo criou | RLS DELETE owner-only (sem OR supervisor) + Server Action `apagarAgenda2Item` (Pattern 1) |
| AGD2-05 | Vendedor marca item como concluído; continua visível riscado | Coluna `concluido boolean`, `.update({ concluido })` direto (sem RPC — Pattern 2), estilo `line-through` novo em `Agenda2ItemRow` (Pattern 5) |
| AGD2-06 | Item "Agenda 2" no menu, logo abaixo de "Agenda" | `AppSidebar.tsx` `PRINCIPAL_SECTION.links` (Pattern 6) + segunda contagem em `app/(app)/layout.tsx` (Pitfall 2) |
| AGD2-07 | Supervisor vê itens de todo o time com filtro por vendedor; vendedor só vê os próprios | RLS SELECT dono-ou-supervisor (Pattern 1) + reuso de `filtrarPorVendedor<T>` genérico (Pattern 3) |
</phase_requirements>

## Summary

Esta fase não introduz nenhuma tecnologia nova — é 100% recombinação de padrões já provados e em produção neste mesmo codebase (Next.js 16 App Router + Server Actions + `@supabase/ssr`, React Hook Form + Zod, RLS como única fronteira de autorização). O trabalho de pesquisa real aqui não é "qual biblioteca usar", é "qual policy shape exata" e "qual arquivo espelhar byte-a-byte" — por isso a maior parte deste documento aponta para arquivos concretos do próprio repositório.

O achado mais importante, que diverge do padrão "dono ou supervisor" já usado em `clientes` (migration `0002_clientes_and_funil.sql`): a RLS desta tabela precisa ser **mais restritiva**, não mais permissiva. D-16 exige que o Supervisor tenha SOMENTE leitura — nunca insert/update/delete, nem sobre itens próprios hipotéticos. Isso significa que a policy de INSERT/UPDATE/DELETE não pode ser só "dono" (`vendedor_id = auth.uid()`), porque um Supervisor tecnicamente também tem um `auth.uid()` e poderia inserir uma linha com `vendedor_id` apontando para si mesmo. A policy correta precisa somar `and not is_supervisor()` — detalhado no Pattern 1 abaixo. Esta é a resposta à pergunta de pesquisa nº 1 do pedido.

O segundo achado de maior risco de regressão silenciosa: a contagem do menu (D-13, "só os itens pendentes do próprio vendedor logado") **não pode confiar apenas na RLS** para se auto-limitar, porque a policy de SELECT desta tabela é deliberadamente ampla (dono OU supervisor). Se a query de contagem for um `count: 'exact', head: true` sem `.eq('vendedor_id', user.id)` explícito — copiando `getAgendaPendentesCount()` literalmente —, um Supervisor logado veria a contagem do TIME INTEIRO no próprio selo do menu, o que contradiz D-13. A query de contagem precisa filtrar por `vendedor_id = auth.uid()` explicitamente no código, mesmo a RLS já permitindo mais. Isso é diferente de `agenda_do_vendedor()`, que já embute esse filtro dentro da própria função SQL (migration `0014_agenda_do_vendedor.sql`) — a Agenda 2 não tem uma função equivalente, é leitura direta de tabela, então o filtro precisa estar explícito na chamada.

Confirmado com o skill `Supabase-conventions` e com o precedente de `acessos_diarios` (Fase 30) e `registrar_acesso_diario()`: RLS pura, sem RPC e sem `SECURITY DEFINER`, é suficiente para todo o CRUD desta fase — não há cálculo, cascata nem validação cruzada com outra tabela que justifique um RPC. A única função nova recomendada é um trigger simples e NÃO-`SECURITY DEFINER` para manter `atualizado_em` (mesmo papel de `clientes_before_update()`), que não conta como exceção de privilégio elevado porque não faz nada que o próprio UPDATE do usuário já não pudesse fazer.

Zero dependência nova: `react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns` já estão instalados e são exatamente o que uma tela de formulário + lista precisa. `@dnd-kit` (também já instalado) não é usado nesta fase — não há arrastar-e-soltar na Agenda 2 Lista.

**Primary recommendation:** Tabela nova `agenda2_itens` com RLS 4-policy assimétrica (SELECT dono-ou-supervisor; INSERT/UPDATE/DELETE dono-e-não-supervisor), zero RPC, zero `SECURITY DEFINER` novo; tela Client Component espelhando `AgendaList.tsx`/`AgendaItemRow.tsx` linha a linha, com verificação de duplicado 100% client-side sobre os itens já carregados (sem round-trip extra ao banco).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Autorização (quem vê/edita/apaga um item) | Database (RLS) | — | `CLAUDE.md`/skill `Supabase-conventions`: RLS é sempre a fronteira real, nunca lógica de UI. Nenhuma exceção nesta fase. |
| CRUD de item (criar/editar/apagar/concluir) | API/Backend (Server Actions) | Database | Server Action valida com Zod e chama `supabase.from("agenda2_itens")` direto — sem RPC, sem Edge Function (RPC/PL-pgSQL só entraria se houvesse cálculo/cascata, o que não é o caso). |
| Agrupamento Atrasado/Hoje/Próximos | Browser/Client (funções puras) | — | `bucketDoItem()`/`AgendaBucket` já vivem em `lib/agenda/itens.ts` como função pura sem `next/*`; reaproveitar a função, não recriar a lógica de fuso horário (Pitfall 1 documentado no próprio arquivo). |
| Aviso de possível duplicado (D-07) | Browser/Client | — | Checagem sobre a lista já carregada em memória — nenhuma ida ao servidor extra, nenhuma trava real (é só um aviso, nunca bloqueio). |
| Contador do menu | Frontend Server (Server Component, `app/(app)/layout.tsx`) | Database | Mesmo padrão de `getAgendaPendentesCount()`: leitura no Server Component do layout, filtro explícito por `vendedor_id = auth.uid()` (não confiar só na RLS ampla). |
| Visibilidade do Supervisor sobre o time | Database (RLS) | Browser/Client (filtro local) | RLS decide QUEM aparece na consulta; o Select de filtro por vendedor (`vendedorFiltroId`) é um estreitamento local sobre o que a RLS já liberou, nunca uma segunda fronteira de permissão. |

## Standard Stack

### Core
Nenhuma dependência nova. Todas as bibliotecas usadas por esta fase já estão instaladas e em uso ativo neste mesmo codebase:

| Library | Version (confirmado em `package.json`) | Purpose nesta fase | Why Standard (neste projeto) |
|---------|---------|---------|--------------|
| `react-hook-form` | `^7.81.0` | Formulário de criar/editar item (nome, bairro, data) | Já é o padrão de todo formulário do projeto (`ClienteQuickCreateForm.tsx`) |
| `zod` | `^4.4.3` | Schema único client+server (`lib/validations/agenda2.ts`) | Mesmo padrão de `lib/validations/cliente.ts`/`lib/validations/agenda.ts` — Server Action nunca confia só na validação do cliente |
| `@hookform/resolvers` | `^5.4.0` | Ponte `zodResolver` entre os dois acima | Já confirmado compatível com zod v4 neste projeto |
| `date-fns` (+ `date-fns/locale/ptBR`) | `^4.4.0` | Formatar data exibida, comparar dia de calendário | `bucketDoItem()` já usa `parseISO`/`differenceInCalendarDays` — mesma disciplina de nunca usar `new Date(string)` cru (Pitfall de fuso já documentado) |
| `@supabase/ssr` | `^0.12.3` | Cliente Supabase em Server Component/Server Action | Já é o único caminho de sessão no App Router deste projeto |

### Supporting
Nenhuma biblioteca de suporte nova é necessária. Especificamente **não é necessário**:
- `@dnd-kit/*` — sem arrastar-e-soltar na Lista (isso só existiria numa futura visão de Calendário/Fase 32, se algum dia precisar).
- Nenhum componente de "AlertDialog"/confirmação modal novo (não existe `components/ui/alert-dialog.tsx` neste projeto) — D-07 é resolvido inteiramente com estado local + banner inline (mesmo padrão `role="alert"` já usado em `ClienteQuickCreateForm.tsx`/`AgendaList.tsx`), sem instalar um primitivo Radix/Base UI novo.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RLS pura + `.update()`/`.insert()` direto | RPC PL/pgSQL dedicado (`criar_agenda2_item`, `concluir_agenda2_item`) | Só faria sentido se houvesse validação cruzada com outra tabela ou cálculo (não há). Um RPC aqui seria complexidade sem ganho — o skill `Supabase-conventions` recomenda explicitamente RLS como primeira opção. |
| Checagem de duplicado 100% client-side (sobre lista já carregada) | Nova Server Action `verificarDuplicataAgenda2()` fazendo uma query extra ao banco | A lista completa do vendedor já está em memória no componente (mesmo padrão `AgendaList.tsx`) — uma query extra por tecla/submit seria uma ida ao banco redundante para um aviso não-bloqueante. |

**Installation:**
```bash
# Nenhuma instalação nova necessária — todas as dependências já estão em package.json.
```

**Version verification:** Nenhum pacote novo é instalado nesta fase; as versões acima foram lidas diretamente de `package.json` (fonte de verdade local, não npm registry) — `[VERIFIED: package.json local]`.

## Package Legitimacy Audit

> Esta fase **não instala nenhum pacote novo**. Todas as bibliotecas usadas (`react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns`, `@supabase/ssr`) já constam em `package.json` e já foram auditadas/aprovadas em fases anteriores deste mesmo projeto (ver `.claude/CLAUDE.md` §Technology Stack, que já documenta a auditoria original). Nenhuma chamada ao seam `package-legitimacy check` é necessária.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | Nenhum pacote novo nesta fase |

**Packages removed due to [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** nenhum.

## Architecture Patterns

### System Architecture Diagram

```
Vendedor (browser)
   │
   │ 1. Abre "Agenda 2" (novo item de menu, AppSidebar.tsx)
   ▼
Server Component (app/(app)/agenda-2/page.tsx)
   │  - lê sessão + role (mesmo padrão de app/(app)/agenda/page.tsx)
   │  - passa isSupervisor + vendedorOptions para o Client Component
   ▼
Client Component (components/agenda2/Agenda2List.tsx)
   │  - fetch-on-mount via Server Action getAgenda2Action()
   │  - agrupa em Atrasado/Hoje/Próximos (bucketDoItem, reaproveitado)
   │  - filtro por vendedor (Supervisor) via Select, estreitamento local
   │
   ├──▶ Criar/Editar item (Agenda2ItemForm.tsx, react-hook-form + zod)
   │        │  - checagem de duplicado 100% sobre a lista já em memória
   │        │  - "Criar mesmo assim" confirma e segue
   │        ▼
   │    Server Action (app/actions/agenda2.ts)
   │        │  - re-valida com o MESMO schema zod (defesa em profundidade)
   │        │  - NUNCA aceita vendedor_id do cliente — sempre auth.getUser().id
   │        ▼
   │    supabase.from("agenda2_itens").insert/update/delete(...)
   │        │
   │        ▼
   │    RLS do Postgres decide o que passa (única fronteira real)
   │
   └──▶ Concluir/Desmarcar (toggle direto, sem RPC)
            ▼
        supabase.from("agenda2_itens").update({ concluido })

Supervisor (browser)
   │
   ▼
Mesma tela, mesmo Server Action de LEITURA — RLS libera todas as linhas
do time; RLS de escrita bloqueia insert/update/delete (D-16), reforçado
por "not is_supervisor()" na policy (não confiar só na ausência de
botões na UI).
```

### Recommended Project Structure
```
supabase/migrations/
└── 0048_agenda2_itens.sql          # tabela + RLS + trigger atualizado_em (único arquivo, mesma disciplina de 0002/0038)

lib/
├── validations/agenda2.ts          # zod schema compartilhado (create + update)
├── agenda2/itens.ts                # funções puras: reaproveita bucketDoItem, tipo Agenda2Item, agrupamento local
└── supabase/queries/agenda2.ts     # getAgenda2(), getAgenda2PendentesCount() — leitura direta de tabela, sem RPC

app/
├── actions/agenda2.ts              # Server Actions: criar/editar/apagar/concluir/desmarcar
└── (app)/agenda-2/page.tsx         # Server Component (auth guard + props), espelha app/(app)/agenda/page.tsx

components/agenda2/
├── Agenda2List.tsx                 # Client Component dono do fetch + agrupamento + filtro (espelha AgendaList.tsx)
├── Agenda2ItemRow.tsx              # linha apresentacional, com line-through quando concluído (espelha AgendaItemRow.tsx)
└── Agenda2ItemForm.tsx             # Dialog de criar/editar com aviso de duplicado (espelha ClienteQuickCreateForm.tsx)

tests/agenda2/
├── rls-agenda2.test.ts             # espelha tests/agenda/rls-agenda.test.ts / tests/clientes/rls-clientes.test.ts
├── agenda2-list.test.tsx           # espelha tests/agenda/agenda-list.test.tsx
├── agenda2-item-row.test.tsx       # espelha tests/agenda/agenda-item-row.test.tsx
└── itens.test.ts                   # testa o agrupamento local + bucketDoItem reaproveitado

tests/layout/ e tests/agenda/app-sidebar-*.test.tsx  # AJUSTAR ordem (D-15) + badge "Agenda 2" (novo teste espelhando app-sidebar-agenda.test.tsx)
```

### Pattern 1: RLS assimétrica — dono pode tudo, Supervisor só lê (a pergunta de pesquisa nº 1)

**What:** Diferente do padrão "dono ou supervisor" de `clientes` (onde o Supervisor também tem UPDATE/DELETE completos), a Agenda 2 exige que o Supervisor NUNCA escreva — nem no próprio hipotético item. Isso exige `and not is_supervisor()` nas policies de escrita, não apenas a ausência da cláusula `or is_supervisor()`.

**When to use:** Sempre que uma tabela precisar do padrão "dono escreve, uma segunda role só lê tudo" — este é o primeiro caso deste tipo no projeto (todas as tabelas anteriores ou dão CRUD completo ao Supervisor, ou são somente-leitura para todo mundo como `historico`/`cidades`).

**Example:**
```sql
-- Source: espelha a estrutura de supabase/migrations/0002_clientes_and_funil.sql
-- (policy "vendedor ve os proprios clientes, supervisor ve todos") e
-- supabase/migrations/0038_acessos_diarios.sql (policy só-Supervisor-lê),
-- combinando os dois padrões já existentes neste projeto — nenhum dos dois
-- sozinho resolve D-16.

alter table agenda2_itens enable row level security;

-- SELECT: dono OU supervisor (igual ao padrão de clientes) — AGD2-07.
create policy "vendedor ve os proprios itens da agenda2, supervisor ve todos"
on agenda2_itens for select to authenticated
using (vendedor_id = (select auth.uid()) or (select is_supervisor()));

-- INSERT: só o próprio dono, e o dono NÃO pode ser um supervisor logado
-- (D-16 — Supervisor não cria nem o próprio item nesta fase).
create policy "vendedor cria os proprios itens da agenda2"
on agenda2_itens for insert to authenticated
with check (
  vendedor_id = (select auth.uid())
  and not (select is_supervisor())
);

-- UPDATE: só o próprio dono, nunca o Supervisor — SEM cláusula "or
-- is_supervisor()" (diferente de clientes de propósito, D-16).
create policy "vendedor edita os proprios itens da agenda2"
on agenda2_itens for update to authenticated
using (
  vendedor_id = (select auth.uid())
  and not (select is_supervisor())
)
with check (
  vendedor_id = (select auth.uid())
  and not (select is_supervisor())
);

-- DELETE: mesma regra do UPDATE.
create policy "vendedor apaga os proprios itens da agenda2"
on agenda2_itens for delete to authenticated
using (
  vendedor_id = (select auth.uid())
  and not (select is_supervisor())
);
```

**Nota sobre um caso de borda não coberto pelo CONTEXT.md:** se um vendedor for promovido a Supervisor no meio do piloto, `is_supervisor()` passa a retornar `true` para ele, e os itens que ele mesmo criou como vendedor ficam **congelados** (visíveis, mas não mais editáveis/apagáveis/concluíveis por ele) — mesmo efeito colateral que a condição acima produz por construção. Isso não foi discutido explicitamente em D-19 (que só cobre desativação, não promoção). Ver `## Open Questions`.

### Pattern 2: Sem RPC, sem `SECURITY DEFINER` novo (pergunta de pesquisa nº 2)

**What:** Toda escrita (criar, editar, apagar, concluir, desmarcar) é uma chamada direta `supabase.from("agenda2_itens").insert/update/delete(...)` a partir da Server Action — nunca um `supabase.rpc(...)`.

**When to use:** Sempre que a regra de negócio for inteiramente expressável como "quem pode tocar nesta linha" (autorização pura) sem cálculo, sem cascata para outra tabela e sem necessidade de bypass de RLS. É exatamente o critério que o skill `Supabase-conventions` define para preferir RLS pura sobre RPC.

**Example:**
```typescript
// Source: espelha app/actions/agenda.ts (concluirTarefaProspeccao), mas
// SEM chamar supabase.rpc() — aqui não há RPC porque não há cálculo nem
// cascata de histórico (Agenda 2 é deliberadamente mais leve, D-04/nota
// do ROADMAP: "sem exportação", sem trilha de auditoria em historico).
"use server"

export async function concluirAgenda2Item(itemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { code: "unauthenticated", message: "Sessão expirada." } }

  const { error } = await supabase
    .from("agenda2_itens")
    .update({ concluido: true })
    .eq("id", itemId) // RLS (owner-only) decide se isso afeta 0 ou 1 linha

  if (error) {
    return { error: { code: "salvar_falhou", message: "Não foi possível salvar. Tente novamente." } }
  }

  revalidatePath("/agenda-2")
  return { data: true }
}
```

**Trigger `atualizado_em` (não conta como exceção nova):**
```sql
-- Source: espelha clientes_before_update() de
-- supabase/migrations/0002_clientes_and_funil.sql, mas SEM security
-- definer — este trigger só toca a própria linha que o UPDATE já está
-- alterando, nenhuma elevação de privilégio é necessária.
create or replace function agenda2_itens_before_update()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_agenda2_itens_before_update
  before update on agenda2_itens
  for each row execute function agenda2_itens_before_update();
```

### Pattern 3: Reaproveitar `bucketDoItem`/`filtrarPorVendedor`, nunca reimplementar

**What:** `lib/agenda/itens.ts` declara explicitamente, no próprio cabeçalho, que é "a ÚNICA autoridade" para a decisão atrasado/hoje/próximos e que "nenhum outro arquivo duplica esta decisão". A função `bucketDoItem(data: string, now?: Date): AgendaBucket` já é genérica o bastante (recebe uma string de data crua, não o tipo `AgendaItem` inteiro) para ser importada diretamente por um `lib/agenda2/itens.ts` novo, sem duplicar a lógica sensível a fuso horário (`parseISO`, nunca `new Date(string)` — Pitfall já documentado no próprio arquivo).

De forma semelhante, `filtrarPorVendedor<T extends { responsavel: string | null }>` (generalizada na Fase 24 justamente para este tipo de reuso) pode ser importada e reutilizada **sem alteração alguma**, desde que o tipo `Agenda2Item` mapeie o dono da linha (coluna `vendedor_id`) para um campo chamado `responsavel: string | null` na camada TypeScript — mesmo truque de nomenclatura que já existe entre `clientes.responsavel` e os outros tipos que a função já aceita.

`agruparAgenda()` e `vendedoresDaAgenda()`, ao contrário, são tipadas especificamente para `AgendaItem[]` (exigem campos como `origem`/`clienteId`/`razaoSocial` que não existem na Agenda 2) — **não são diretamente reutilizáveis**. A opção mais barata é escrever uma versão local de ~10 linhas em `lib/agenda2/itens.ts` que usa `bucketDoItem` internamente (nunca reimplementando a comparação de datas), e uma versão local de `vendedoresDaAgenda` (mesmo corpo, tipo diferente) — ou generalizar as duas com genéricos, seguindo o mesmo precedente que a Fase 24 já estabeleceu para `filtrarPorVendedor`. Qualquer uma das duas opções é aceitável; a única regra não-negociável é que a comparação de data em si (`bucketDoItem`) nunca seja duplicada.

**Example:**
```typescript
// lib/agenda2/itens.ts — NOVO arquivo, mas reaproveita bucketDoItem em vez
// de reimplementar a lógica de fuso horário.
import { bucketDoItem, type AgendaBucket } from "@/lib/agenda/itens"

export type Agenda2Item = {
  id: string
  nomeCliente: string
  bairro: string
  data: string // YYYY-MM-DD, mesmo formato ISO curto do resto do projeto
  concluido: boolean
  criadoEm: string
  responsavel: string | null      // nome do campo escolhido de propósito
  responsavelNome: string | null  // para reusar filtrarPorVendedor<T> sem alteração
}

export type Agenda2Agrupada = Record<AgendaBucket, Agenda2Item[]>

export function agruparAgenda2(
  itens: Agenda2Item[],
  now: Date = new Date()
): Agenda2Agrupada {
  const agrupado: Agenda2Agrupada = { atrasado: [], hoje: [], proximos: [] }
  for (const item of itens) {
    agrupado[bucketDoItem(item.data, now)].push(item)
  }
  return agrupado
}
```

### Pattern 4: Server Actions — mesma forma de `app/actions/clientes.ts`/`agenda.ts` (pergunta de pesquisa nº 4)

**What:** Toda escrita passa por uma Server Action em `"use server"`, que (a) chama `createClient()` de `lib/supabase/server.ts`, (b) confirma `auth.getUser()`, (c) revalida com o MESMO schema zod usado no formulário (defesa em profundidade — "Server Action é endpoint público"), (d) NUNCA aceita `vendedor_id` vindo do cliente — sempre `user.id` lido no servidor, (e) devolve uma união discriminada `{ data } | { error: { code, message } }`, (f) chama `revalidatePath("/agenda-2")` no sucesso.

**Example:**
```typescript
// Source: espelha exatamente app/actions/clientes.ts (createCliente) e
// app/actions/agenda.ts (concluirTarefaProspeccao) — mesma forma.
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAgenda2ItemSchema, type CreateAgenda2ItemInput } from "@/lib/validations/agenda2"

export async function criarAgenda2Item(values: CreateAgenda2ItemInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { code: "unauthenticated", message: "Sessão expirada." } }

  const parsed = createAgenda2ItemSchema.safeParse(values)
  if (!parsed.success) {
    return { error: { code: "validacao", message: "Verifique os campos." } }
  }

  const { error } = await supabase.from("agenda2_itens").insert({
    nome_cliente: parsed.data.nomeCliente,
    bairro: parsed.data.bairro,
    data: parsed.data.data,
    vendedor_id: user.id, // NUNCA aceito do formulário — sempre o usuário logado
  })

  if (error) {
    return { error: { code: "salvar_falhou", message: "Não foi possível salvar. Tente novamente." } }
  }

  revalidatePath("/agenda-2")
  return { data: true }
}
```

### Pattern 5: "Concluído riscado" — tratamento visual novo (D-04)

**What:** `AgendaItemRow.tsx` (Agenda atual) já tem um tratamento de "concluído" — mas é `opacity-60` + badge "Concluído" com ícone, **sem** `line-through`. D-04 pede explicitamente riscado (`line-through`), que é um tratamento visualmente diferente e precisa ser adicionado como algo novo em `Agenda2ItemRow.tsx`, não apenas copiado do componente existente.

**Example:**
```tsx
// components/agenda2/Agenda2ItemRow.tsx (trecho)
<CardTitle
  className={cn(
    "truncate text-base leading-tight font-semibold",
    item.concluido && "text-muted-foreground line-through"
  )}
>
  {item.nomeCliente}
</CardTitle>
```

### Pattern 6: Item de menu + segunda contagem (AGD2-06/D-12..D-15)

**What:** `PRINCIPAL_SECTION.links` em `AppSidebar.tsx` é um array declarativo onde a ORDEM É o requisito (mesmo comentário de cabeçalho já documenta isso para "Agenda"). Inserir `{ href: "/agenda-2", label: "Agenda 2", icon: <escolha livre>, badgeCount }` logo depois da entrada `/agenda`, e ANTES de `/clientes` (D-15). `AppSidebarProps` ganha uma segunda prop (`agenda2Count: number`), com o MESMO tratamento tolerante a falha (`try { } catch { agenda2Count = 0 }`) já usado para `agendaCount` em `app/(app)/layout.tsx` — um erro na Agenda 2 não pode derrubar o menu inteiro.

**Example:**
```typescript
// lib/supabase/queries/agenda2.ts
// AGD2-06/D-13: filtro EXPLÍCITO por vendedor_id, mesmo a RLS de SELECT
// sendo mais ampla (dono ou supervisor) — sem este .eq(), um Supervisor
// logado veria a contagem do TIME INTEIRO no próprio selo do menu.
export async function getAgenda2PendentesCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from("agenda2_itens")
    .select("*", { count: "exact", head: true })
    .eq("vendedor_id", user.id)
    .eq("concluido", false)

  if (error) throw new Error(`Falha ao carregar a Agenda 2: ${error.message}`)
  return count ?? 0
}
```

### Anti-Patterns to Avoid
- **Copiar a policy de SELECT para INSERT/UPDATE/DELETE:** o padrão "dono ou supervisor" de `clientes` NÃO se aplica à escrita desta tabela — ver Pattern 1. Copiar sem adaptar recria CRUD completo para o Supervisor, violando D-16 silenciosamente (o erro só aparece num teste de RLS específico, nunca na UI, já que a UI nem mostra os botões para o Supervisor).
- **Confiar só na RLS para a contagem do menu:** ver Pattern 6 — precisa do `.eq("vendedor_id", user.id)` explícito, porque a RLS de leitura é intencionalmente mais ampla que "dono".
- **Reimplementar `bucketDoItem`:** qualquer nova comparação de data usando `new Date(string)` cru reintroduz o bug de fuso horário já documentado (Pitfall 1 de `lib/agenda/itens.ts`) — sempre `parseISO` ou, melhor ainda, reaproveitar a função pronta.
- **Criar um `AlertDialog`/confirmação modal nova para o aviso de duplicado:** não existe esse primitivo neste projeto; instalar um novo componente Radix/Base UI só para um aviso não-bloqueante (D-07) é desproporcional — usar o padrão de banner inline já estabelecido.
- **Um segundo arquivo de RLS/policy para a mesma tabela:** seguir a disciplina de "uma migration por mudança lógica" mas com TODAS as policies da tabela nova no MESMO arquivo (mesma disciplina de `0002`/`0038`) — nunca dividir RLS enable + policies entre migrations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Classificação atrasado/hoje/próximos | Uma segunda função de comparação de data | `bucketDoItem()` importado de `lib/agenda/itens.ts` | Já é a autoridade única documentada no projeto; reimplementar reabre o bug de fuso horário já corrigido uma vez |
| Estreitamento por vendedor (filtro do Supervisor) | Um novo `.filter()` ad-hoc no componente | `filtrarPorVendedor<T>` importado de `lib/agenda/itens.ts` (já genérico desde a Fase 24) | Já foi generalizada exatamente para este tipo de reuso entre Agenda/AGENDA-01; reimplementar cria uma segunda regra que pode divergir |
| Autorização "quem pode ver/editar" | Checagem de role no componente React ou na Server Action | RLS (Pattern 1) | `CLAUDE.md` proíbe explicitamente "implementar autenticação/autorização por conta própria"; a Server Action é só UX, a RLS é a fronteira real |
| Confirmação de "duplicado, criar mesmo assim" | Um dialog modal novo com biblioteca de confirmação | Estado local + banner inline (mesmo padrão `role="alert"` já usado no projeto) | Zero dependência nova, e o padrão já é bem entendido neste codebase |

**Key insight:** Este projeto já tem uma disciplina forte de "uma função pura, uma vez, reaproveitada" (`bucketDoItem`, `filtrarPorVendedor`, `nomeExibicaoCliente`) — o risco real nesta fase não é técnico, é de **disciplina**: é fácil e rápido copiar-colar `AgendaList.tsx` inteiro num arquivo novo e reimplementar a lógica de data ali dentro "só para simplificar". Isso recriaria exatamente o pitfall de fuso horário que o projeto já pagou o preço de corrigir uma vez.

## Common Pitfalls

### Pitfall 1: RLS "dono ou supervisor" copiada sem adaptação
**What goes wrong:** Copiar literalmente as 4 policies de `clientes` (onde Supervisor tem CRUD completo) para `agenda2_itens` — a tabela fica funcionalmente correta em todos os testes manuais de vendedor, mas o Supervisor consegue editar/apagar itens de qualquer vendedor via API, violando D-16 silenciosamente.
**Why it happens:** É o único precedente de RLS "dono + role privilegiada" que o projeto tem até agora; copiar é o caminho de menor resistência.
**How to avoid:** Usar exatamente o Pattern 1 acima — `and not is_supervisor()` nas 3 policies de escrita.
**Warning signs:** Um teste de RLS que faz login como Supervisor e tenta `update`/`delete` num item de um vendedor DEVE falhar (0 linhas afetadas) — se passar, a policy está errada.

### Pitfall 2: Contador do menu "vaza" a contagem do time para o Supervisor
**What goes wrong:** Copiar `getAgendaPendentesCount()` (que confia inteiramente na RLS porque `agenda_do_vendedor()` já embute o filtro por usuário dentro da própria função SQL) sem adicionar `.eq("vendedor_id", user.id)` na nova query de contagem. Como a RLS de SELECT desta tabela é mais ampla, o Supervisor veria o total do time inteiro no próprio selo.
**Why it happens:** `agenda_do_vendedor()` e a leitura direta de tabela têm superfícies de segurança diferentes — uma é uma função que já pré-filtra, a outra é uma tabela cuja RLS pré-filtra menos.
**How to avoid:** Ver Pattern 6 — filtro explícito no código, mesmo a RLS permitindo mais.
**Warning signs:** Logar como Supervisor com vários vendedores tendo itens pendentes e comparar o número do selo com "0" esperado (Supervisor nunca cria itens).

### Pitfall 3: Contagem no menu incluindo itens já concluídos
**What goes wrong:** Esquecer o `.eq("concluido", false)` na query de contagem, inflando o selo com itens que já foram riscados.
**Why it happens:** D-13 diz "conta só os itens pendentes" mas não deixa óbvio que "pendente" = "não concluído" precisa ser um filtro explícito nesta tabela nova (na Agenda atual, "pendente" é implícito porque `agenda_do_vendedor()` já filtra `concluida = false`/`data_realizada is null` dentro do SQL).
**How to avoid:** Sempre incluir `.eq("concluido", false)` na contagem (ver Pattern 6).
**Warning signs:** O contador do menu não bate com o total das 3 seções (Atrasado+Hoje+Próximos) visível na tela.

### Pitfall 4: Reordenar itens do mesmo dia por engano
**What goes wrong:** D-08 exige ordem de criação, sem horário e sem alfabética. Se a query SQL não tiver `order by criado_em asc` explícito, o Postgres pode devolver em qualquer ordem física de armazenamento, e qualquer `.sort()` adicionado no lado do cliente (por exemplo, um `Array.prototype.sort` "só para garantir") criaria uma segunda autoridade de ordenação — mesmo anti-padrão que `agruparAgenda()` já documenta evitar para a Agenda atual.
**Why it happens:** É tentador "ordenar por garantia" no frontend.
**How to avoid:** `order by criado_em asc, id asc` (desempate por `id`, conforme "Claude's Discretion" do CONTEXT.md) direto na query SQL/`select()`, e nenhuma chamada de `.sort()` em nenhum lugar do código de apresentação.
**Warning signs:** A ordem visual muda entre dois carregamentos da mesma página sem nenhuma escrita nova.

### Pitfall 5: Vendedor "concluído mas editável" quebrando o botão de concluir
**What goes wrong:** D-06 exige que um item concluído continue editável (nome/bairro/data) sem precisar desmarcar. Se o componente `Agenda2ItemForm.tsx` for espelhado ingenuamente de `ConcluirItemDialog.tsx`/`AgendaItemRow.tsx` (que ocultam ações quando concluído — ver o comentário de cabeçalho de `AgendaItemRow.tsx`, item (a): "o botão Concluir deixa de ser RENDERIZADO"), o botão "Editar" pode ser ocultado por engano do mesmo jeito que o botão "Concluir" já é.
**Why it happens:** Copiar a lógica condicional `concluido ? null : <Button>` do componente vizinho sem diferenciar qual ação (editar vs. concluir) deve continuar disponível.
**How to avoid:** Só o botão "Concluir" desaparece quando `concluido === true` (substituído por "Desmarcar", D-05); o botão "Editar" NUNCA desaparece, independentemente do estado.
**Warning signs:** Teste manual: marcar um item como concluído e tentar editar o nome — se o botão de editar sumir, é regressão de D-06.

## Code Examples

### Migration completa (esqueleto)
```sql
-- Source: mistura os padrões de supabase/migrations/0002_clientes_and_funil.sql
-- (estrutura de tabela + índice) e 0038_acessos_diarios.sql (tom de
-- comentário de cabeçalho sobre LGPD/minimização de dados), adaptado para
-- a assimetria de RLS do Pattern 1.
create table agenda2_itens (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references profiles(id),
  nome_cliente varchar(120) not null,
  bairro varchar(60) not null,
  data date not null,
  concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table agenda2_itens is 'Agenda 2 (piloto v1.8): item manual de visita anotado pelo vendedor. Minimização LGPD (nota a do ROADMAP Fase 31): só nome livre, bairro, data, concluído, dono e carimbos — sem telefone, endereço completo, observação livre ou localização.';

create index idx_agenda2_itens_vendedor_id on agenda2_itens (vendedor_id);

-- RLS + policies: ver Pattern 1 acima (bloco completo)
-- Trigger atualizado_em: ver Pattern 2 acima
```

### Zod schema compartilhado
```typescript
// lib/validations/agenda2.ts
// Source: espelha lib/validations/cliente.ts (schema compartilhado
// client+server). Limites de tamanho (120/60) são recomendação desta
// pesquisa (ver Assumptions Log — [ASSUMED], nenhum número exato foi
// travado com o dono, só a EXISTÊNCIA do limite, por LGPD).
import { z } from "zod"

export const createAgenda2ItemSchema = z.object({
  nomeCliente: z.string().trim().min(1, "Informe o nome do cliente.").max(120),
  bairro: z.string().trim().min(1, "Informe o bairro.").max(60),
  data: z.string().min(1, "Informe a data."), // YYYY-MM-DD, mesmo formato do resto do projeto
})
export type CreateAgenda2ItemInput = z.infer<typeof createAgenda2ItemSchema>
```

## State of the Art

Não aplicável — este projeto não tem uma versão anterior da Agenda 2 para comparar "antes/depois". A única mudança de postura é interna ao próprio projeto: é a primeira vez que uma tabela usa o padrão "dono escreve, uma role só lê" (ver Pattern 1) — todas as tabelas anteriores ou dão CRUD completo a duas roles (`clientes`), ou são somente-leitura para todo mundo (`historico`, `cidades`), ou somente-leitura para uma única role (`acessos_diarios`, ninguém lê exceto Supervisor). Este é um terceiro formato de RLS, novo para o projeto, mas não novo para a tecnologia (Postgres RLS suporta isso nativamente desde sempre).

**Nota lateral encontrada durante a pesquisa, fora do escopo desta fase:** a migration `0038_acessos_diarios.sql` declara explicitamente "Nenhuma funcao deste arquivo pode ganhar clausula de elevacao de privilegio (SECURITY DEFINER)", mas a migration `0047_correcao_final_registrar_acesso_diario.sql` (mais recente) redefine `registrar_acesso_diario()` **com** `security definer`, contradizendo o próprio comentário de 0038. Isso não é assunto desta fase (não mexe em `acessos_diarios`/Fase 30) e não deve ser corrigido aqui, mas é relevante para a reconciliação da contagem de exceções abaixo — reportar ao dono do projeto como um item de dívida técnica separado, se desejado.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Limites de tamanho recomendados: `varchar(120)` para nome do cliente, `varchar(60)` para bairro | Code Examples / Architecture Patterns | O dono do projeto travou a EXISTÊNCIA de um limite (nota LGPD do ROADMAP), mas não o número exato. Se um vendedor precisar de um nome de cliente maior que 120 caracteres (razão social muito longa + observação embutida), o insert falharia com erro de tamanho — baixo risco dado que "Nome Fantasia" é a recomendação de preenchimento (nota do ROADMAP), tipicamente curto |
| A2 | Nome da tabela `agenda2_itens` e rota `/agenda-2` | Recommended Project Structure | Escolha de nomenclatura livre (não há decisão travada no CONTEXT.md) — risco baixo, é só convenção interna, fácil de renomear antes da migration ir para produção |
| A3 | Contagem de exceções `SECURITY DEFINER` hoje em produção é 11, não 6 (conforme o roadmap citava) — contagem obtida por grep manual nas migrations aplicadas, resolvendo a divergência que o scout desta fase já havia sinalizado no CONTEXT.md | State of the Art / Common Pitfalls | Se a contagem real for diferente por causa de alguma migration de correção que não redefiniu uma função anterior (não verificado contra o banco de produção real, só contra os arquivos de migration), a Fase 31 continua terminando com o MESMO número de exceções antes/depois (zero novas) — o risco é só de relatório impreciso, não de comportamento |
| A4 | Um vendedor promovido a Supervisor no meio do piloto perde a capacidade de editar/apagar/concluir os próprios itens antigos da Agenda 2 (efeito colateral do `not is_supervisor()` do Pattern 1) | Architecture Patterns Pattern 1 | Baixo risco funcional (RLS continua correta e segura), mas pode surpreender o dono do projeto se acontecer sem aviso — ver Open Questions |

**Se esta tabela estivesse vazia:** não está — 4 itens acima precisam de confirmação ou, no mínimo, ciência do dono do projeto antes/durante a execução.

## Open Questions

1. **Vendedor promovido a Supervisor durante o piloto — o que acontece com os itens antigos da Agenda 2 dele?**
   - What we know: `is_supervisor()` passaria a retornar `true`; pelo Pattern 1, ele perderia a capacidade de editar/apagar/concluir os próprios itens (ficam congelados, só visíveis).
   - What's unclear: se esse comportamento é aceitável ou se o dono esperaria que os itens continuassem editáveis por ele mesmo depois da promoção.
   - Recommendation: seguir o Pattern 1 como está (é o comportamento mais seguro e consistente com D-16), mas mencionar explicitamente ao dono do projeto durante o Discuss/Plan — é um caso de borda raro (promoção durante o piloto), não um bloqueador.

2. **Prazo de guarda dos dados do piloto (LGPD) — já sinalizado como em aberto no CONTEXT.md.**
   - What we know: o dono optou por não decidir isso nesta rodada; a recomendação por padrão (Privacidade por Design) seria um descarte por prazo determinado, espelhando `acessos_diarios` (35 dias), mas isso NÃO foi confirmado.
   - What's unclear: qual prazo, e se a limpeza automática (se houver) roda embutida em alguma escrita futura (Agenda 2 não tem uma chamada de "toda vez que abre a tela" natural como `registrar_acesso_diario()`) ou fica manual/Supervisor-only.
   - Recommendation: **não implementar nenhum descarte automático nesta fase.** Isso é uma decisão de produto que precisa de confirmação explícita do dono antes de qualquer código de expiração — alinhado com a instrução organizacional de sempre alertar sobre tratamento de dados pessoais e LGPD antes de avançar.

3. **Ícone do item "Agenda 2" no menu (Claude's Discretion, D-icon).**
   - What we know: precisa ser visualmente distinto de `ListChecks` (Agenda), `Users` (Clientes), `Archive` (Perdidos), `PauseCircle` (Encerrados) — mesmo critério que já levou a rejeitar `XCircle` para Perdidos.
   - What's unclear: nenhuma preferência do dono foi registrada.
   - Recommendation: um ícone de "nota"/"clipboard" simples do `lucide-react` já usado no projeto (ex.: `NotebookPen` ou `ClipboardList` — ambos já existem na biblioteca `lucide-react` instalada, nenhuma importação nova) — decisão de baixo risco, o planner/executor pode escolher.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime do projeto (Next.js/Vitest) | ✓ | v24.21.0 | — |
| npm | Scripts do projeto | ✓ | 11.19.0 | — |
| Supabase CLI (via `npx supabase`) | `supabase db push` da migration nova, testes de integração contra Postgres real | ✓ | 2.118.0 (via npx, não fixado em `package.json`) | — |
| Vitest | `npm test` — testes de RLS/unitários/componente | ✓ | `^4.1.10` (já em `package.json`) | — |
| Playwright | `npm run test:e2e` (não obrigatório para esta fase — nenhum fluxo E2E novo é exigido pelos critérios de sucesso) | ✓ | `^1.61.1` | — |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** nenhuma.

**Nota:** `STATE.md` registra que a versão `2.112.0` do Supabase CLI teve um bug de validação de schema em `link`/API keys durante a Fase 13, exigindo pin em `2.111.0` para aquele `db push` específico. A versão atual resolvida via `npx` é `2.118.0` — se o `supabase db push` desta fase falhar de forma parecida, considerar fixar uma versão como `devDependency` (mesmo precedente já documentado).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (unit/component/integração-RLS) + Playwright `^1.61.1` (E2E, não exigido nesta fase) |
| Config file | `vitest.config.ts` (raiz do projeto) |
| Quick run command | `npx vitest run tests/agenda2` (depois de criado) |
| Full suite command | `npm test` (= `vitest run`, suíte completa) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGD2-01 | Vendedor cria item manual | integration (RLS insert) + component (form) | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/agenda2-item-form.test.tsx` | ❌ Wave 0 |
| AGD2-03 | Vendedor edita item próprio | integration (RLS update owner-only) | `npx vitest run tests/agenda2/rls-agenda2.test.ts` | ❌ Wave 0 |
| AGD2-04 | Vendedor apaga item próprio | integration (RLS delete owner-only) | `npx vitest run tests/agenda2/rls-agenda2.test.ts` | ❌ Wave 0 |
| AGD2-05 | Concluir/desmarcar, riscado visível | component (`Agenda2ItemRow` renderiza `line-through`) | `npx vitest run tests/agenda2/agenda2-item-row.test.tsx` | ❌ Wave 0 |
| AGD2-06 | Item "Agenda 2" no menu, contador | component (`AppSidebar`) | `npx vitest run tests/agenda/app-sidebar-agenda.test.tsx tests/layout` | ⚠️ Existe, precisa AJUSTE (ordem D-15) + extensão (novo selo) |
| AGD2-07 | Supervisor vê time, filtro por vendedor; vendedor só vê os próprios | integration (RLS cross-vendedor) + component (filtro Select) | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/agenda2-list.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/agenda2` (+ `tests/agenda/app-sidebar-agenda.test.tsx` quando a tarefa tocar o menu)
- **Per wave merge:** `npm test` (suíte completa — a suíte de RLS já tem múltiplos arquivos que criam/apagam via `serviceClient()`, então precisa rodar contra um Supabase real, mesmo padrão de todo o projeto até aqui)
- **Phase gate:** Suíte completa verde antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/agenda2/rls-agenda2.test.ts` — cobre AGD2-01/03/04/07, espelhando `tests/clientes/rls-clientes.test.ts` (usa `SEED_ACCOUNTS`, `signInAs`, `serviceClient` de `tests/helpers/supabase-test-clients.ts` — já existentes, nenhum helper novo necessário)
- [ ] `tests/agenda2/agenda2-item-row.test.tsx` — cobre AGD2-05 (line-through, desmarcar), espelhando `tests/agenda/agenda-item-row.test.tsx`
- [ ] `tests/agenda2/agenda2-list.test.tsx` — cobre agrupamento (D-01) e filtro por vendedor (AGD2-07), espelhando `tests/agenda/agenda-list.test.tsx`
- [ ] `tests/agenda2/itens.test.ts` — cobre o agrupamento local + reuso de `bucketDoItem`, espelhando `tests/agenda/itens.test.ts`
- [ ] Ajuste em `tests/agenda/app-sidebar-agenda.test.tsx` (e siblings `app-sidebar-perdidos.test.tsx`, `app-sidebar-encerrados.test.tsx`, `layout/app-sidebar-visual.test.tsx`) — nova ordem D-15 (Agenda, Agenda 2, Clientes, Perdidos, Encerrados, Dashboard)
- [ ] Nenhum framework novo a instalar — Vitest + `@testing-library/react` (jsdom) já cobrem tudo.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não (sem mudança de fluxo de auth) | Supabase Auth já existente, sem alteração |
| V3 Session Management | não | `@supabase/ssr` já gerencia cookies, sem alteração |
| V4 Access Control | **sim** | RLS assimétrica dono/Supervisor (Pattern 1) — única fronteira real |
| V5 Input Validation | **sim** | Zod (`lib/validations/agenda2.ts`) client+server + `varchar(n)` no Postgres como backstop de tamanho |
| V6 Cryptography | não | Nenhum dado sensível criptografado especificamente (nome/bairro não são segredo, mas são dado pessoal — ver LGPD) |

### Known Threat Patterns for este stack (Next.js Server Actions + Supabase RLS)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vendedor tenta inserir/atualizar linha com `vendedor_id` de outro usuário (payload manipulado direto na Server Action) | Tampering / Spoofing | Server Action NUNCA aceita `vendedor_id` do cliente — sempre `auth.getUser().id` (Pattern 4); RLS `with check` reforça mesmo que a Server Action tivesse um bug |
| Supervisor chama `.update()`/`.delete()` direto via API (bypassando a UI, que nem mostra os botões) tentando editar/apagar item de um vendedor | Elevation of Privilege | `not is_supervisor()` nas policies de escrita (Pattern 1) — a UI não é a fronteira, a RLS é |
| Vendedor B consulta `agenda2_itens` direto via API tentando ver itens do Vendedor A | Information Disclosure | RLS de SELECT (`vendedor_id = auth.uid() or is_supervisor()`) — vendedor comum nunca satisfaz a condição para linha alheia |
| Supervisor lê a contagem de pendentes do próprio menu e ela reflete o time inteiro (vazamento não-intencional de agregado, não de linha individual) | Information Disclosure (leve — é uma contagem, não dado individual) | Filtro explícito `.eq("vendedor_id", user.id)` na query de contagem (Pattern 6/Pitfall 2), independente da RLS |
| Campo de texto livre (`nome_cliente`) usado para armazenar dado pessoal além do previsto (telefone, CPF, endereço completo digitado no campo de nome) | dado pessoal fora do escopo minimizado (LGPD, não-STRIDE) | Limite de tamanho (`varchar`) reduz o espaço para inserir informação excessiva, mas não impede; a dica de tela "use o Nome Fantasia" (já decidida no ROADMAP) é a mitigação de produto, não técnica — mencionar ao dono que isso é orientação, não trava |

**Alerta de conformidade (LGPD) — reforço da instrução organizacional:** esta tabela armazena nome de cliente (pode identificar pessoa física em pequenos negócios PJ) + bairro (localização aproximada) + rotina de deslocamento implícita de um funcionário (vendedor) associada a datas. Isso é dado pessoal tanto do cliente quanto do funcionário. A fase já nasce com minimização de campos travada (nota do ROADMAP), mas **o prazo de retenção continua em aberto** (ver Open Questions #2) — recomenda-se fortemente que o dono do projeto confirme uma política de retenção antes desta funcionalidade ir para uso real continuado em produção, e que a migration em si só seja aplicada em produção após aprovação explícita (já é regra não-negociável do ROADMAP desta fase).

## Sources

### Primary (HIGH confidence)
- `.planning/phases/31-agenda-2-visitas-manuais-na-lista/31-CONTEXT.md` — decisões travadas (D-01 a D-19), canonical refs
- `.planning/REQUIREMENTS.md` §"Agenda 2 (nova)" — AGD2-01/03-07, Out of Scope
- `.claude/skills/Supabase-conventions/SKILL.md` — ordem RLS > RPC > Edge Function
- `supabase/migrations/0001_profiles_and_roles.sql`, `0002_clientes_and_funil.sql`, `0008_desativacao_membro_equipe.sql`, `0038_acessos_diarios.sql`, `0039_carimbos_desativacao_reativacao.sql`, `0047_correcao_final_registrar_acesso_diario.sql` — lidos diretamente para confirmar padrões de RLS/trigger/SECURITY DEFINER
- `components/layout/AppSidebar.tsx`, `app/(app)/layout.tsx`, `lib/agenda/itens.ts`, `components/agenda/AgendaList.tsx`, `components/agenda/AgendaItemRow.tsx`, `app/actions/agenda.ts`, `lib/supabase/queries/agenda.ts` — lidos diretamente para confirmar padrões a reaproveitar
- `components/clientes/ClienteQuickCreateForm.tsx`, `lib/validations/cliente.ts` — padrão de formulário react-hook-form + zod
- `tests/agenda/app-sidebar-agenda.test.tsx`, `tests/clientes/rls-clientes.test.ts`, `tests/helpers/supabase-test-clients.ts` — padrão de teste a espelhar
- `package.json` — versões instaladas confirmadas localmente (nenhuma consulta a registry externo necessária, nenhuma dependência nova)
- Grep direto em `supabase/migrations/*.sql` — contagem real de funções `SECURITY DEFINER` distintas hoje em vigor (11, não 6 — reconcilia a divergência sinalizada em `31-CONTEXT.md`)

### Secondary (MEDIUM confidence)
- Nenhuma — toda a pesquisa desta fase foi feita por leitura direta do código-fonte do próprio projeto, sem necessidade de busca externa (zero tecnologia nova).

### Tertiary (LOW confidence)
- Nenhuma.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero dependência nova, todas as versões lidas de `package.json` local
- Architecture: HIGH — todos os padrões (RLS, Server Actions, componentes) lidos diretamente do código já em produção deste mesmo projeto
- Pitfalls: HIGH — cada pitfall listado tem uma causa raiz identificada em código real (não é especulação), incluindo o achado da contradição entre `0038`/`0047`

**Research date:** 2026-09-28
**Valid until:** Esta pesquisa não expira por passagem de tempo (não depende de versões de biblioteca externas mudando) — só fica desatualizada se `lib/agenda/itens.ts`, `AppSidebar.tsx` ou o esquema de RLS de `clientes`/`acessos_diarios` forem refatorados antes desta fase ser executada.
