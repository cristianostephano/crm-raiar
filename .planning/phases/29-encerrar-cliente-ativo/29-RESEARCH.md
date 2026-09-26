# Phase 29: Encerrar Cliente Ativo - Research

**Researched:** 2026-09-26
**Domain:** Postgres enum evolution + RPC guard interaction (Supabase) + Next.js Server Component/Action reporting screen (reusing Phase 28's "Perdidos" pattern)
**Confidence:** HIGH (all core claims verified by reading the actual migrations/code in this repo, not assumed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Rótulo exibido é "Encerrado" (não "Inativo").
- **D-02:** `status_acompanhamento` é um enum nativo do Postgres (`status_acompanhamento_enum`, migration 0002), hoje com 3 valores. Adicionar "encerrado" exige `ALTER TYPE status_acompanhamento_enum ADD VALUE 'encerrado'` numa migration nova. Confirmar a forma segura de fazer isso.
- **D-03:** Nova tabela `motivos_encerramento` (7ª lista editável, mesmo padrão RLS de 4 policies), nova coluna `motivo_encerramento_id` em `clientes`, novo `CHECK (status_acompanhamento <> 'encerrado' or motivo_encerramento_id is not null)`.
- **D-04:** "Encerrado" só é alcançável a partir de "Ganho". Mirar `chk_ganho_somente_etapa_final` — decidir se um CHECK equivalente faz sentido.
- **D-05:** Dentro do Select de Status já existente na ficha (`ClienteDetailSheet.tsx`), 4ª opção. Ao escolher "Encerrado", abre diálogo de motivo (novo componente análogo a `PerdaMotivoDialog.tsx`, ou o mesmo generalizado — decidir no planejamento).
- **D-06:** Vendedor faz isso sozinho, nos próprios clientes, mesma regra de RLS de sempre.
- **D-07:** Nova tela própria, mesmo padrão visual/estrutural da tela "Perdidos" (Fase 28) — reaproveitar ao máximo `PerdidosItemRow.tsx`/`PerdidosPeriodoFilter.tsx`/`PerdidosList.tsx` como moldes diretos, possivelmente generalizáveis em vez de duplicados — decidir no planejamento.
- **D-08:** Mesma regra de visibilidade: vendedor só vê os próprios clientes encerrados, Supervisor vê os de todo o time — via RLS, nunca checagem manual.
- **D-09:** Botão "Reativar" de toque simples, sem diálogo de confirmação — mesmo padrão do "Reabrir" da Fase 28.
- **D-10:** Reativar volta o cliente direto para "Ganho" (não "Em andamento", nem reprospectando).
- **D-11 (achado técnico a confirmar):** O RPC `mover_card_funil` tem guards de CNPJ/razão social/endereço na transição para "ganho", condicionados a "status atual != ganho". Reativar de "encerrado" pra "ganho" é uma transição desse tipo — o guard vai disparar de novo. Confirmar que o valor efetivo (já preenchido) deixa passar sem problema.
- **D-12:** Cliente "Encerrado" some da Agenda e da seção "Sem dia fixo definido". `getClientesSemDiaFixo` já filtra só por `'ganho'` (sem mudança necessária). Confirmar `agenda_do_vendedor()` da mesma forma.
- **D-13:** Kanban de prospecção — "Encerrado" também deve sair das 7 colunas, estendendo `STATUS_FORA_DA_PROSPECCAO_LISTA` de 2 para 3 valores.

### Claude's Discretion
- Nome exato do componente de diálogo de motivo de encerramento (novo, ou generalização do `PerdaMotivoDialog`).
- Se os componentes da tela de Perdidos (Fase 28) são generalizados/parametrizados para reaproveitar na tela de Encerrados, ou duplicados como componentes irmãos.
- Nome/ícone do menu para a nova tela ("Encerrados"?), seguindo o mesmo padrão do item "Perdidos".

### Deferred Ideas (OUT OF SCOPE)
Nenhuma — a discussão ficou dentro do escopo da fase (ENCR-01..05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENCR-01 | Vendedor marca um cliente ativo como "Inativo/Encerrado" quando ele para de comprar | D-02/D-03/D-04/D-05 findings below: exact enum-migration split, new CHECK constraints, Select wiring in `ClienteDetailSheet.tsx` mirroring the "ganho" tooltip-disable pattern |
| ENCR-02 | Marcar como Inativo/Encerrado exige informar um motivo | D-03 findings: `motivos_encerramento` table pattern (mirrors `motivos_perda` exactly), dialog reuse analysis (Investigation Point 5) |
| ENCR-03 | Cliente Inativo/Encerrado sai da rotina da Agenda mas mantém histórico e diário intactos | D-12 findings: `getClientesSemDiaFixo` needs no change; `agenda_do_vendedor()` DOES need a new migration (critical finding — see Pitfall 3); `historico`/Diário triggers need zero changes |
| ENCR-04 | Vendedor encerra os próprios clientes ativos sem depender do Supervisor | D-06/D-08: same RLS as every other status transition, no new policy |
| ENCR-05 | Vendedor reativa um cliente Inativo/Encerrado, voltando à rotina normal da Agenda | D-09/D-10/D-11: reactivation flow, and the **critical, previously-unflagged finding** about the frequência guard (Pitfall 1) that blocks a silent one-tap "Reativar" unless `marcarStatus` is extended |
</phase_requirements>

## Summary

This phase is structurally a near-identical sibling of Phase 28 (Relatório de Perdidos): a new terminal-ish `status_acompanhamento` value, a lookup table for the mandatory reason, a report screen filtered by role via RLS, and a one-tap reversal button. The plan should follow the exact same 4-plan shape (schema+RLS → Kanban exclusion rule → data layer → screen) that Phase 28 already proved end-to-end in this codebase.

Two things make this phase **not** a copy-paste of Phase 28, and both are load-bearing for the plan:

1. **The enum migration must be split across two files, in this exact order, with nothing else in the first file.** PostgreSQL forbids using a newly-added enum value (in a comparison, a CHECK constraint, a `WHERE` clause, or a function body) inside the same transaction that added it via `ALTER TYPE ... ADD VALUE`. Supabase CLI applies each migration file in its own transaction, sequentially — so migration N (`ALTER TYPE status_acompanhamento_enum ADD VALUE 'encerrado';`, nothing else) followed by migration N+1 (everything that uses the literal `'encerrado'`) is safe and needs no manual two-step deploy. This is confirmed both by Supabase's own documentation and by observing that `supabase db diff` itself auto-splits exactly this kind of change into two migration files when it detects the conflict. **[VERIFIED: supabase.com/docs — Managing Enums in Postgres]**

2. **Reactivating "encerrado" → "ganho" will hit an *unconditional* guard in `mover_card_funil` that Phase 28's reactivation (perdido → em_andamento) never touched, and the current app code has no fallback for it.** Unlike the CNPJ/razão-social/endereço guards (which are correctly grandfathered — they only fire `and v_status_atual is distinct from 'ganho'` AND check the *effective* value, i.e. `coalesce(parameter, already-stored-value)`), the frequência de visita guard is checked **before** any row is even read and is **not** conditioned on the current status and does **not** fall back to the stored value:
   ```sql
   if p_novo_status = 'ganho' and p_frequencia_visita is null then
     raise exception 'Frequência de visita é obrigatória ao marcar um cliente como ganho';
   end if;
   ```
   `marcarStatus()` (app/actions/funil.ts) has an identical pre-check (`isFrequenciaVisita(frequenciaVisita)`) that runs *before* even calling the RPC. A one-tap "Reativar" button that calls `marcarStatus(clienteId, "ganho")` the same way Phase 28's "Reabrir" calls `marcarStatus(clienteId, "em_andamento")` will **fail every single time** with "Selecione a frequência de visita antes de confirmar." — because nothing supplies `frequenciaVisita`, and D-09 explicitly forbids showing a dialog to ask for it again. **This is the single most important technical finding in this document** and directly determines whether ENCR-05/D-09/D-10 are even implementable as specified. See Pitfall 1 for the verified, minimal fix. **[VERIFIED: read `supabase/migrations/0026_dia_fixo_visita.sql` lines 396-398 and `app/actions/funil.ts` lines 193-203 directly]**

**Primary recommendation:** Follow Phase 28's exact 4-plan shape, but (a) split the enum-add migration from everything else that references the literal `'encerrado'`, and (b) extend `marcarStatus()` to compute an *effective* frequência de visita (parameter, falling back to the cliente's already-stored `frequencia_visita`) exactly the way it already computes `cnpjEfetivo` — this is a small, precedented change, not new architecture — before wiring the "Reativar" button.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Novo valor de enum + CHECK constraints + tabela `motivos_encerramento` | Database / Storage | — | Puro schema Postgres; RLS já é a fronteira de autorização do projeto inteiro |
| Guard "Encerrado só a partir de Ganho" + guard de reativação (frequência efetiva) | API / Backend (RPC `mover_card_funil`, PL/pgSQL) | Frontend Server (Server Action `marcarStatus`, pré-checagem cortesia) | Mesmo padrão dual já usado por CNPJ/razão social/endereço: o RPC é o backstop real, a Server Action é a mensagem amigável |
| Leitura `clientes_encerrados(p_inicio, p_fim)` (relatório) | Database / Storage (função SQL `stable`, sem `security definer`) | API / Backend (Server Action `getClientesEncerradosAction`) | Espelha `clientes_perdidos` (migration 0034) — RLS decide as linhas, a função só filtra por status/período |
| Exclusão do Kanban de prospecção | Frontend Server (`lib/funil/prospeccao.ts`, consumido por `getClientesAgrupadosPorEtapa`) | — | Regra de EXIBIÇÃO, não de autorização (mesmo módulo já estendido na Fase 28) |
| Exclusão da Agenda (`agenda_do_vendedor`) | Database / Storage (função SQL) | — | O filtro precisa estar DENTRO da função porque ela já faz o `union all`/`join` — não dá para filtrar depois no navegador sem reescrever a leitura |
| Tela `/encerrados`, diálogo de motivo, item de menu | Browser / Client (Client Components) + Frontend Server (rota protegida) | — | Mesmo padrão exato de `/perdidos` (Fase 28) |

## Project Constraints (from CLAUDE.md)

- **Stack fixo:** Next.js (App Router, Server Actions) + Supabase (Postgres/Auth/RLS/Storage). Nenhum backend Node.js separado. Esta fase não introduz nenhuma dependência nova — zero pacotes npm.
- **RLS é a única fronteira de autorização** — nunca lógica de permissão "feita à mão" no frontend ou em backend próprio. Toda leitura/escrita nova desta fase deve rodar `SECURITY INVOKER` (sem cláusula), exatamente como `mover_card_funil`, `clientes_perdidos` e todo `dashboard_*` já fazem.
  - **Nota de conflito com a skill `supabase-conventions`:** o exemplo genérico da skill (`SKILL.md`) mostra um RPC de exemplo com `security definer`. Isso **não** deve ser seguido neste projeto — o padrão real, estabelecido e verificado em 6+ migrations (0002, 0003, 0025, 0026, 0034), é o oposto: nenhuma função nova ganha `security definer` a menos que ela precise escrever em `historico` (as únicas 4-5 exceções documentadas em `.planning/STATE.md`, todas já existentes, nenhuma nova prevista aqui).
- **Toda tabela nova precisa vir com RLS habilitada e policies explícitas** — `motivos_encerramento` deve nascer com as mesmas 4 policies que as outras 6 listas editáveis do projeto já usam.
- **Migrations sempre versionadas, nunca alteração direta pelo dashboard, nunca editar uma migration já aplicada** — próximo número disponível é `0035` (0034 já aplicada em produção, migration 0035 em diante livre).
- **Toda funcionalidade nova precisa de pelo menos um teste automatizado antes de ser considerada concluída** — mesma disciplina de 28-01..28-04 (testes de integração contra o banco real para a migration/RPC, testes com mock para a Server Action/tela).
- **Deploy:** nenhuma mudança vai direto para `master` — sempre `staging` → link de teste da Vercel → aprovação → `master`, exatamente como a Fase 28 fez.
- **Usuário não-técnico:** qualquer checkpoint de aprovação (aplicar migration em produção) precisa de linguagem simples, sem jargão, no molde exato do checkpoint da Tarefa 2 do plano 28-01.

## Standard Stack

Nenhuma biblioteca nova. Esta fase reaproveita 100% do stack já instalado e aprovado (ver `.claude/CLAUDE.md` "Technology Stack"): Next.js Server Actions, Supabase (`supabase-js`/`@supabase/ssr`), shadcn/ui (`Card`, `Select`, `Dialog`, `Popover`, `Calendar`), `lucide-react`, `date-fns`, Vitest, Playwright (não usado nas Fases 28/29 por decisão prática, mas disponível).

**Version verification:** N/A — zero `npm install` nesta fase.

## Package Legitimacy Audit

**N/A.** Esta fase não instala nenhum pacote novo. Nenhuma verificação de registry necessária.

## Architecture Patterns

### System Architecture Diagram

```
Vendedor abre a ficha do cliente (ClienteDetailSheet)
        │
        ▼
  Select "Status" ganha a 4ª opção "Encerrado"
  (desabilitada com tooltip quando status atual != "ganho",
   mesmo padrão já usado pela opção "Ganho" com ETAPA_FINAL)
        │  escolhe "Encerrado"
        ▼
  Diálogo de motivo obrigatório (novo componente,
  molde de PerdaMotivoDialog) ── busca motivos_encerramento ativos
        │  confirma com motivoEncerramentoId
        ▼
  marcarStatus(clienteId, "encerrado", motivoEncerramentoId)
        │
        ▼
  RPC mover_card_funil (RLS aplica no UPDATE)
        │  guard: encerrado exige motivo (CHECK + pré-checagem)
        │  guard: encerrado só a partir de ganho (CHECK + pré-checagem)
        ▼
  clientes.status_acompanhamento = 'encerrado'
        │
        ├──► trigger clientes_after_update_historico grava
        │     "Status alterado para \"encerrado\"" (automático, sem mudança)
        │
        ├──► lib/funil/prospeccao.ts (D-13): cliente já não aparecia
        │     (estava "ganho"); continua fora das 7 colunas
        │
        └──► agenda_do_vendedor() (migration nova): cliente some da
              Agenda mesmo tendo uma "visita" pendente aberta antes
              de encerrar (achado crítico — ver Pitfall 3)

Tela /encerrados (mesmo molde de /perdidos, Fase 28)
        │
        ▼
  getClientesEncerradosAction(intervalo) ──► clientes_encerrados(p_inicio, p_fim)
        │  (SECURITY INVOKER, RLS escopa por papel — Vendedor só os próprios)
        ▼
  Lista com nome/motivo/data/vendedor, botão "Reativar" (toque único)
        │
        ▼
  marcarStatus(clienteId, "ganho", undefined, frequenciaEfetiva)
        │  frequenciaEfetiva = frequência já gravada no cliente
        │  (achado crítico — ver Pitfall 1: SEM este fallback o botão
        │   falha 100% das vezes)
        ▼
  RPC mover_card_funil: guard de CNPJ/razão social/endereço passam
  (valores já gravados desde o "ganho" anterior — coalesce cobre isso)
        │
        ▼
  clientes.status_acompanhamento = 'ganho' de novo
        │
        └──► reaparece na Agenda (visita pendente antiga OU nova,
              conforme a data já calculada) e some da tela /encerrados
              pela releitura (mesmo D-09 da Fase 28)
```

### Recommended Project Structure

```
supabase/migrations/
├── 0035_status_encerrado_enum.sql       # SÓ o ALTER TYPE ADD VALUE — nada mais
└── 0036_encerrar_cliente_ativo.sql      # tabela, coluna, CHECKs, mover_card_funil,
                                          # agenda_do_vendedor, clientes_encerrados

lib/
├── funil/prospeccao.ts                  # estendido: 2 → 3 status (D-13)
├── funil/frequencia.ts                  # sem mudança de vocabulário; consumido
│                                        # pelo fallback de frequência efetiva
└── encerrados/lista.ts                  # NOVO, molde exato de lib/perdidos/lista.ts

lib/supabase/queries/
└── encerrados.ts                        # NOVO, molde exato de perdidos.ts

app/actions/
├── funil.ts                             # marcarStatus ESTENDIDO (frequência efetiva)
└── encerrados.ts                        # NOVO, molde exato de perdidos.ts

components/
├── clientes/
│   ├── ClienteDetailSheet.tsx            # STATUS_OPTIONS ganha "encerrado"
│   └── EncerramentoMotivoDialog.tsx       # NOVO, sibling de PerdaMotivoDialog.tsx
├── encerrados/                           # NOVO diretório, sibling de components/perdidos/
│   ├── EncerradosItemRow.tsx
│   ├── EncerradosPeriodoFilter.tsx
│   └── EncerradosList.tsx
└── layout/AppSidebar.tsx                 # + item "Encerrados", ícone PauseCircle

app/(app)/encerrados/page.tsx              # NOVO, molde exato de app/(app)/perdidos/page.tsx

tests/funil/                               # mesma pasta que a Fase 28 já usa
├── encerrados-rpc.test.ts                 # integração (molde: perdidos-rpc.test.ts)
├── encerrados-lista.test.ts               # unitário (molde: perdidos-lista.test.ts)
├── encerrados-query.test.ts               # unitário/mock (molde: perdidos-query.test.ts)
├── encerrados-item-row.test.tsx
├── encerrados-periodo-filter.test.tsx
├── encerrados-list.test.tsx
├── app-sidebar-encerrados.test.tsx
└── reativar-guard.test.ts                 # NOVO — prova o achado do Pitfall 1
```

### Pattern 1: Enum extension split across exactly two migration files
**What:** `ALTER TYPE status_acompanhamento_enum ADD VALUE 'encerrado';` must be the **entire** content of its migration file (comments are fine; no other statement). Every other statement that references the literal `'encerrado'` — the new CHECK constraints, `mover_card_funil`'s new guard, `agenda_do_vendedor`'s new filter, and the new `clientes_encerrados` read function — goes in the **next** migration file.
**When to use:** Any time this project adds a value to an existing native enum type (this is the first time it happens since migration 0002 created the enum — `frequencia_visita_enum`, `dia_semana_enum` etc. were all created fresh with every value present from day one, never extended).
**Example:**
```sql
-- 0035_status_encerrado_enum.sql — nothing else in this file.
-- Comentário explicando por que este arquivo não pode conter mais nada:
-- o Postgres proíbe usar um valor de enum recém-adicionado (em comparação,
-- CHECK constraint, WHERE, ou corpo de função) na MESMA transação que o
-- criou. O Supabase CLI aplica cada arquivo de migration na sua própria
-- transação — por isso basta que este ALTER seja um arquivo próprio,
-- aplicado ANTES do arquivo seguinte, no mesmo `supabase db push`.
alter type status_acompanhamento_enum add value 'encerrado';
```
```sql
-- 0036_encerrar_cliente_ativo.sql — aplicado DEPOIS de 0035 já ter
-- comitado; pode usar 'encerrado' livremente em CHECK, WHERE, PL/pgSQL.
create table motivos_encerramento ( ... );  -- mesmo molde de motivos_perda
alter table clientes add column motivo_encerramento_id uuid references motivos_encerramento(id);
alter table clientes add constraint chk_encerrado_exige_motivo
  check (status_acompanhamento <> 'encerrado' or motivo_encerramento_id is not null);
alter table clientes add constraint chk_encerrado_somente_etapa_final
  check (status_acompanhamento <> 'encerrado' or etapa = 'primeira_venda');
-- ... create or replace function mover_card_funil(...) com o guard novo
-- ... create or replace function agenda_do_vendedor() com o filtro novo
-- ... create or replace function clientes_encerrados(p_inicio, p_fim) (nova leitura)
```
**[VERIFIED: supabase.com/docs/guides/database/postgres/enums — "Adding Enum Values Safely"]**

### Pattern 2: "Effective value" guard fallback (already established by CNPJ/razão social/endereço, must be extended to frequência)
**What:** `mover_card_funil`'s CNPJ/razão-social/endereço guards use `v_status_atual is distinct from 'ganho'` (only fire on a genuine transition) AND compute an *effective* value (`coalesce(parameter, already-stored)`) — this is what makes reactivating a grandfathered "ganho" client safe. The frequência guard does neither. `marcarStatus()`'s pre-checks mirror this same asymmetry on the TypeScript side.
**When to use:** Phase 29's reactivation flow (D-09/D-10/D-11) requires extending BOTH the RPC's frequência guard (optional, for full defense-in-depth) and, at minimum, `marcarStatus()`'s pre-check and its parameter passed to the RPC — this is where the actual fix must land, since the RPC's current unconditional check would need its OWN migration to change (mirroring the CNPJ guard's own transition-conditioned form is the correct end-state, but the **minimum viable fix that unblocks ENCR-05 without a DB migration risk** is computing the effective frequency in `marcarStatus()` before calling the RPC, exactly like `cnpjEfetivo` already does).
**Example:**
```typescript
// Source: app/actions/funil.ts, existing cnpjEfetivo pattern (lines 205-224),
// extended for frequência (Phase 29 fix):
const { data: cliente } = await supabase
  .from("clientes")
  .select(
    "etapa, status_acompanhamento, cnpj, razao_social, cep, rua, numero, cidade, estado, frequencia_visita"
  )
  .eq("id", clienteId)
  .single()

const frequenciaEfetiva = isFrequenciaVisita(frequenciaVisita)
  ? frequenciaVisita
  : cliente.frequencia_visita

if (novoStatus === "ganho" && !isFrequenciaVisita(frequenciaEfetiva)) {
  return { error: { code: "frequencia_obrigatoria", message: "..." } }
}

// ... pass p_frequencia_visita: novoStatus === "ganho" ? frequenciaEfetiva : null
```
**Edge case to flag as an Open Question:** a client that was "ganho" before migration 0013 (VIS-04 grandfathering — "clientes já ganho antes do marco ficam SEM frequência") and then got "encerrado" has `frequencia_visita = null` and no way to supply one via a no-dialog one-tap button. This is rare (data-dependent) but must have a defined behavior — see Open Questions.

### Anti-Patterns to Avoid
- **Adding `security definer` to any new function** — contradicts this project's single established pattern (RLS is the only authorization boundary); would also contradict the generic `supabase-conventions` skill example, which is not this project's actual convention (see Project Constraints note above).
- **Filtering "encerrado" out of the Agenda in the browser/TypeScript layer instead of inside `agenda_do_vendedor()`** — the function already does a `union all` across two heterogeneous sources before the app ever sees the rows; filtering after the fact would require restructuring the read shape, whereas adding one `and c.status_acompanhamento <> 'encerrado'` clause to each branch's `where` is a one-line change in a function the project already owns.
- **Turning `lib/funil/prospeccao.ts`'s display rule into an RLS policy** — explicitly forbidden by that module's own header comment; it's a display concern, not authorization.
- **Parametrizing `PerdidosItemRow`/`PerdidosPeriodoFilter`/`PerdidosList` to serve both screens** — see Don't Hand-Roll and Pitfall 4 below for the concrete recommendation (duplicate as siblings).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Motivo obrigatório catalog CRUD | Uma tabela ad-hoc sem RLS, ou um enum fixo no código | Tabela `motivos_encerramento` com as mesmas 4 policies das outras 6 listas editáveis (`categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda`, `frequencias_pedido`, `motivos_conclusao_remota`) | Já é o 7º caso idêntico no projeto — zero decisão nova de design, só copiar o molde de `motivos_perda` (migration 0002) |
| Escopo por papel (Vendedor vê só os seus, Supervisor vê todos) | Checagem de `role`/`responsavel` dentro da função de leitura | Função `SECURITY INVOKER` (sem cláusula), deixando a RLS de `clientes` decidir | Já provado 11x por teste de integração real em `clientes_perdidos` (migration 0034) — o mesmo padrão exato resolve `clientes_encerrados` |
| Reativação (voltar para "ganho") | Uma Server Action nova/paralela que faz `UPDATE clientes` direto | `marcarStatus(clienteId, "ganho", ...)` — o mesmo mecanismo que qualquer outra troca de status já usa | D-08 exige explicitamente reusar o mecanismo existente; um caminho paralelo bypassaria os guards de CNPJ/razão social/endereço que hoje são a garantia real de ficha completa |
| Botão "Reativar" com spinner/otimismo | Remoção otimista da linha antes da confirmação do servidor | Releitura (mesmo `reloadKey` bump de `PerdidosList.tsx`) | D-09 e o precedente de Fase 28: a linha some pela releitura, nunca por remoção otimista — evita divergência entre tela e banco se a chamada falhar |

**Key insight:** Este domínio (funil de vendas com estados terminais reversíveis) já tem TODOS os mecanismos que a Fase 29 precisa construídos e provados na Fase 28 e nas fases de "ganho" (13/18/23/25). O trabalho real desta fase é (a) estender esses mecanismos por mais um valor de enum com a sequência de migration correta, e (b) fechar a lacuna do guard de frequência que nenhuma fase anterior precisou fechar porque nenhuma reativação anterior mirava "ganho".

## Common Pitfalls

### Pitfall 1: A reativação de um toque falha 100% das vezes sem o fallback de frequência (achado crítico)
**What goes wrong:** Um botão "Reativar" que chama `marcarStatus(clienteId, "ganho")` sem frequência — do jeito que "Reabrir" da Fase 28 chama `marcarStatus(clienteId, "em_andamento")` sem nada a mais — recebe imediatamente o erro "Selecione a frequência de visita antes de confirmar." e nunca chega a tocar o RPC.
**Why it happens:** O guard de frequência (`mover_card_funil`, criado na migration 0013, nunca alterado) é o único dos guards de "ganho" que NÃO segue o padrão de "efetivo/grandfathering" que CNPJ (0018), razão social e endereço (0025) seguem — ele checa só o parâmetro recebido, sem olhar o valor já gravado, e sem checar se é uma transição genuína. `marcarStatus()` replica exatamente essa assimetria do lado TypeScript.
**How to avoid:** Estender `marcarStatus()` para computar uma frequência EFETIVA (`frequenciaVisita ?? cliente.frequencia_visita`, precisando adicionar `frequencia_visita` ao `select` já existente) e usar esse valor efetivo tanto na pré-checagem quanto no parâmetro `p_frequencia_visita` do RPC — mesmo padrão exato de `cnpjEfetivo`. Isso NÃO exige nenhuma mudança de schema nem de RPC; é uma mudança isolada em `app/actions/funil.ts`.
**Warning signs:** Qualquer teste de integração que chame `marcarStatus(clienteId, "ganho")` sem frequência explícita, num cliente que JÁ tem `frequencia_visita` gravada, deve passar — se falhar com `frequencia_obrigatoria`, o fallback não foi implementado. Recomendo que o plano exija um teste de integração explícito com esse nome exato (`reativar-sem-repetir-frequencia` ou similar).

### Pitfall 2: `ALTER TYPE ... ADD VALUE` na mesma migration que a usa quebra o push inteiro
**What goes wrong:** Se a mesma migration que faz `ALTER TYPE status_acompanhamento_enum ADD VALUE 'encerrado'` também cria a CHECK constraint `check (status_acompanhamento <> 'encerrado' or ...)` ou qualquer `WHERE status_acompanhamento = 'encerrado'`, o Postgres recusa com "unsafe use of new value of enum type" — e, como o Supabase CLI aplica cada arquivo dentro de uma transação, o arquivo inteiro falha e nada daquela migration é aplicado.
**Why it happens:** Um valor de enum recém-adicionado só fica "seguro" para uso (comparação, CHECK, corpo de função) depois que a transação que o criou COMITAR — nunca dentro da mesma transação.
**How to avoid:** Ver Pattern 1 acima — dois arquivos, nesta ordem, no mesmo `supabase db push`.
**Warning signs:** Erro do Postgres contendo literalmente "unsafe use of new value" durante `supabase db push`.

### Pitfall 3: `agenda_do_vendedor()` NÃO filtra por status hoje — um cliente encerrado com visita pendente continua aparecendo na Agenda
**What goes wrong:** Lendo o corpo atual de `agenda_do_vendedor()` (migration 0026, a versão vigente em produção), nenhuma das duas metades do `union all` filtra por `status_acompanhamento`. A metade "visita" só filtra `v.data_realizada is null`; a metade "prospeccao" só filtra `t.concluida = false and t.data_conclusao is not null`. Um cliente que estava "ganho" com uma visita pendente (`data_realizada is null`) e é marcado "encerrado" CONTINUA aparecendo na Agenda até essa visita ser concluída ou ter sua data trocada manualmente — violando ENCR-03/D-12 diretamente.
**Why it happens:** A função nunca precisou excluir nenhum status antes — "ganho" nunca saiu da Agenda (ele É a razão de existir da seção "visita"), e "perdido"/"em_andamento" normalmente não têm visitas pendentes por não terem passado pelo "ganho" ainda. "Encerrado" é o primeiro status que precisa sumir da Agenda TENDO JÁ TIDO visitas/tarefas pendentes reais.
**How to avoid:** A migration 0036 (pós-enum) precisa recriar `agenda_do_vendedor()` (mesmas 10 colunas de retorno, `create or replace`, sem mudar assinatura) acrescentando `and c.status_acompanhamento <> 'encerrado'` ao `where` de AMBAS as metades do `union all` — não só a da visita. (A metade "prospeccao"/tarefas tecnicamente já podia ter esse mesmo problema para clientes "ganho" com uma tarefa antiga aberta — isso é um comportamento pré-existente fora do escopo desta fase, mas a mesma cláusula nova cobre "encerrado" nas duas metades por simetria e não introduz regressão.)
**Warning signs:** Um teste de integração que marca um cliente "ganho" com visita pendente como "encerrado" e confere que ele não aparece mais em `agenda_do_vendedor()` — se esse teste não existir no plano, a lacuna passa despercebida (a UI da Agenda simplesmente mostraria o cliente errado, sem erro nenhum).

### Pitfall 4: Componentes da tela de Perdidos não são genuinamente parametrizáveis sem acoplar as duas fases
**What goes wrong:** Tentar generalizar `PerdidosItemRow`/`PerdidosPeriodoFilter`/`PerdidosList` para servir as duas telas parece "menos código" à primeira vista, mas cada um tem pelo menos uma diferença de comportamento real: `PerdidosItemRow` sempre mostra "Perdido em" e nunca frequência; a reativação de Encerrados precisa de um parâmetro a mais (frequência efetiva, Pitfall 1) que "Reabrir" nunca precisou; `PerdidosPeriodoFilter` já importa `PERIODO_PRESETS_PERDIDOS`/`PeriodoPresetPerdidos` diretamente (não como prop) — está "local à fase" por decisão explícita do próprio plano 28-04 ("componente local da fase", nenhum import de `lib/dashboard`/`components/dashboard`).
**Why it happens:** A Fase 28 já enfrentou essa exata decisão (generalizar `PeriodoFilter.tsx` do Dashboard vs. copiar) e escolheu copiar — é precedente direto e recente no mesmo repositório.
**How to avoid:** Duplicar como componentes-irmãos em `components/encerrados/` (mesma pasta-espelho de `components/perdidos/`), com seu próprio módulo puro `lib/encerrados/lista.ts` (mirror de `lib/perdidos/lista.ts`, com `PeriodoPresetEncerrados`/`PERIODO_PRESETS_ENCERRADOS` próprios). Isso é a recomendação concreta para o "Claude's Discretion" do CONTEXT.md — não um menu de opções.
**Warning signs:** Se o plano importar qualquer símbolo de `components/perdidos/` ou `lib/perdidos/` dentro do código de produção de Encerrados (fora de comentário citando o molde), é sinal de acoplamento indevido entre as duas fases.

### Pitfall 5: Esquecer o guard "encerrado só a partir de ganho" deixa a integridade só na UI
**What goes wrong:** Se a única trava for o Select desabilitado em `ClienteDetailSheet.tsx` (mesmo padrão do tooltip do "Ganho"), um cliente poderia, em teoria, ser encerrado fora da etapa final por qualquer chamada direta ao RPC (teste, script, bug futuro) — CLAUDE.md exige que autorização/integridade nunca dependam só do frontend.
**How to avoid:** Adicionar `chk_encerrado_somente_etapa_final` (mirror direto de `chk_ganho_somente_etapa_final`) e um guard cedo em `mover_card_funil` (mirror do guard de "ganho", mesma forma: `if p_novo_status = 'encerrado' and p_nova_etapa <> 'primeira_venda' then raise exception ...`). Isso é sempre alcançável na prática (só clientes "ganho" — que por invariante já estão em `primeira_venda` — podem virar "encerrado"), então o guard nunca deve disparar em uso normal; ele existe como backstop, exatamente como o guard de "ganho" existe hoje.

## Code Examples

### Guard de "ganho" existente — mirror direto para o novo guard de "encerrado" e para a checagem no Select
```sql
-- Source: supabase/migrations/0026_dia_fixo_visita.sql, linhas 385-387 (mover_card_funil vigente)
if p_novo_status = 'ganho' and p_nova_etapa <> 'primeira_venda' then
  raise exception 'Só é possível marcar como ganho na etapa "1ª venda concluída"';
end if;
```

### Guard efetivo (grandfathering) já usado para CNPJ — molde para a frequência (Pitfall 1)
```sql
-- Source: supabase/migrations/0026_dia_fixo_visita.sql, linhas 417-420, 442-447
v_cnpj_efetivo := coalesce(nullif(btrim(p_cnpj), ''), nullif(btrim(v_cnpj_gravado), ''));
...
if p_novo_status = 'ganho'
   and v_encontrado
   and v_status_atual is distinct from 'ganho'
   and v_cnpj_efetivo is null then
  raise exception 'CNPJ é obrigatório para marcar um cliente como ganho';
end if;
```

### Select com opção desabilitada + tooltip — molde exato para "Encerrado" desabilitado quando status != "ganho"
```tsx
// Source: components/clientes/ClienteDetailSheet.tsx, linhas 1119-1154
<SelectItem
  key={option.value}
  value={option.value}
  disabled={option.value === "ganho" && cliente.etapa !== ETAPA_FINAL}
>
  ...
  {option.value === "ganho" && cliente.etapa !== ETAPA_FINAL ? (
    <Tooltip>...</Tooltip>
  ) : null}
</SelectItem>
```

### Leitura report-style SECURITY INVOKER já provada em produção — molde direto para `clientes_encerrados`
```sql
-- Source: supabase/migrations/0034_clientes_perdidos.sql (via 28-01-PLAN.md's <interfaces> block)
create or replace function clientes_perdidos(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid, razao_social text, nome_fantasia text,
  motivo_perda_nome text, perdido_em timestamptz,
  responsavel uuid, responsavel_nome text
)
language sql stable
as $$ ... $$;
-- Sem security definer; RLS de clientes/historico/motivos_perda/profiles é
-- a única fronteira. clientes_encerrados(p_inicio, p_fim) troca só a fonte
-- do "quando" (histórico do status 'encerrado' em vez de 'perdido') e o
-- filtro (status_acompanhamento = 'encerrado'), mesmo left join lateral.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — não há abordagem antiga para "encerrar" um cliente ativo neste projeto | Novo status terminal reversível, seguindo o mesmo molde que "perdido" já usa desde o MVP | Fase 29 (este marco) | Primeiro caso do projeto de reativação que aterrissa em "ganho" em vez de "em_andamento" — por isso o guard de frequência (Pitfall 1) nunca havia sido testado nesse sentido antes |

**Deprecated/outdated:** Nenhum.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `lucide-react` exporta um ícone chamado `PauseCircle` adequado para "Encerrados" no menu | Code Examples / recomendação de ícone (ver corpo do documento — Investigation Point 6) | Baixo — só troca o nome do ícone importado; se não existir, `CircleOff`/`UserMinus` são substitutos igualmente válidos e o build falharia imediatamente no `tsc`/import, sem risco de produção |
| A2 | Nenhum cliente "ganho" hoje em produção tem `frequencia_visita` nula ao mesmo tempo em que poderia ser marcado "encerrado" e depois reativado sem um caminho de exceção — tratado como Open Question, não como fato | Pattern 2 / Pitfall 1 (edge case) | Médio — se houver clientes grandfathered (VIS-04) no conjunto real que um vendedor tente encerrar e depois reativar, a reativação de um toque falhará para esses casos específicos até a Tarefa de plano definir o comportamento de fallback |

**Se esta tabela parecer curta:** é porque quase todo o restante deste documento foi verificado lendo o código/migrations reais deste repositório (marcado `[VERIFIED: ...]` inline), não presumido.

## Open Questions

1. **Edge case: reativar um "encerrado" cujo `frequencia_visita` é nulo (grandfathering VIS-04 — cliente "ganho" antes da Fase 13, encerrado sem nunca ter tido frequência definida)**
   - What we know: `marcarStatus`'s fallback (Pitfall 1/Pattern 2) resolve o caso comum (frequência já gravada). O guard da RPC continua exigindo um valor não nulo.
   - What's unclear: se esse toque único deve (a) falhar com uma mensagem específica orientando abrir a ficha e definir a frequência antes, ou (b) a tela de Encerrados oferecer uma exceção pontual (ex.: abrir `GanhoFrequenciaDialog` só nesse caso raro, quebrando D-09 só para esse caminho).
   - Recommendation: tratar como (a) — erro específico e acionável (`frequencia_obrigatoria`, mensagem "Este cliente nunca teve uma frequência de visita definida. Abra a ficha dele para definir uma frequência antes de reativar."), mantendo D-09 intacto no caminho comum e evitando um `checkpoint:human-verify` bloqueante para um caso de dado legado raro. Confirmar com o dono do projeto se esse comportamento é aceitável durante o Discuss/Plan, já que ele não foi coberto pelo CONTEXT.md.

2. **`motivo_encerramento_id` permanece na linha depois de reativar (nunca é limpo) — igual ao precedente de `motivo_perda_id` após reabrir um perdido**
   - What we know: `mover_card_funil` sempre usa `coalesce(p_motivo_x_id, motivo_x_id)`, nunca zera. Isso já é o comportamento aceito para `motivo_perda_id` desde a Fase 28 (nenhuma reclamação, nenhum teste exigindo limpeza).
   - What's unclear: se o dono do projeto espera ver esse "motivo antigo" em algum lugar da UI depois de reativado (ele não deveria aparecer em lugar nenhum, já que só a ficha atual mostra status "ganho" e a tela de Encerrados só lista quem está `status_acompanhamento = 'encerrado'` agora).
   - Recommendation: não tratar como bug — replicar o precedente exato sem pedir confirmação nova, a menos que o Discuss levante o ponto explicitamente.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `supabase db push` para migrations 0035/0036 | Presumido ✓ (já usado em toda fase anterior) | Confirmar pin exato em `.planning/STATE.md` no momento do plano (histórico: `2.111.0` foi fixado por um bug de validação de schema na `2.112.0`; pode já ter mudado) | Se o classificador de modo automático bloquear `db push` (padrão já registrado nas Fases 18/19/21/28), o dono aplica manualmente pelo SQL Editor do Supabase — mesmo checkpoint humano da Tarefa 2 do plano 28-01 |
| Banco de produção (mesmo projeto Supabase usado pelos testes de integração) | Testes de integração novos (`encerrados-rpc.test.ts`) | ✓ (mesmo projeto já usado pelas Fases 13-28) | — | Nenhum — é o único ambiente de teste deste projeto (sem instância local separada para os testes de integração, mesma convenção já aceita nas fases anteriores) |

**Missing dependencies with no fallback:** Nenhuma.
**Missing dependencies with fallback:** Nenhuma além do já documentado (bloqueio do `db push` automático, com aplicação manual como caminho já testado).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (já configurado; `tests/funil/` já existe desde a Fase 28) |
| Config file | `vitest.config.ts` (existente, sem mudança necessária) |
| Quick run command | `npx vitest run tests/funil/encerrados-*.test.ts` |
| Full suite command | `npx vitest run tests/funil/` (mesma pasta usada por Perdidos — inclui o arquivo de integração real) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENCR-01 | Cliente "ganho" pode virar "encerrado" com motivo; bloqueado se não estiver "ganho" | integration (RPC real) | `npx vitest run tests/funil/encerrados-rpc.test.ts` | ❌ criar (molde: `tests/funil/perdidos-rpc.test.ts`) |
| ENCR-02 | `chk_encerrado_exige_motivo` bloqueia sem `motivo_encerramento_id` | integration (RPC real) | mesmo arquivo acima | ❌ criar |
| ENCR-03 | Cliente encerrado some de `agenda_do_vendedor()` mesmo com visita pendente aberta antes de encerrar | integration (RPC real) — **caso crítico, ver Pitfall 3** | mesmo arquivo acima, caso dedicado | ❌ criar |
| ENCR-04 | Vendedor de outro dono não consegue encerrar/reativar cliente alheio | integration (RPC real, RLS) | mesmo arquivo acima | ❌ criar |
| ENCR-05 | Reativar (toque único) sem repetir frequência quando ela já está gravada | integration (RPC real) — **caso crítico, ver Pitfall 1** | mesmo arquivo acima, caso dedicado | ❌ criar |
| ENCR-05 | `marcarStatus` calcula frequência efetiva e passa adiante ao RPC | unit (mock) | `npx vitest run tests/funil/reativar-guard.test.ts` (ou incluído em `app/actions/funil.test.ts` se existir) | ❌ criar |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/funil/<arquivo-da-tarefa>`
- **Per wave merge:** `npx vitest run tests/funil/` completo
- **Phase gate:** Suite completa verde + `npx tsc --noEmit` + `npx eslint` antes de `/gsd-verify-work`

### Wave 0 Gaps
- Nenhum arquivo de teste novo pré-existe — todos os 8 arquivos listados na "Recommended Project Structure" precisam ser criados durante a execução, seguindo os moldes 1:1 já usados pela Fase 28 (nenhuma infraestrutura de teste nova necessária: `tests/helpers/supabase-test-clients.ts` já cobre fixtures descartáveis).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | não (sem mudança de auth) | Supabase Auth existente, sem alteração |
| V3 Session Management | não | Sem alteração |
| V4 Access Control | **sim** | RLS existente em `clientes`/`historico`; 4 policies novas em `motivos_encerramento` (mesmo molde das outras 6 listas); `SECURITY INVOKER` em toda função nova (`clientes_encerrados`, `mover_card_funil` recriado, `agenda_do_vendedor` recriado) |
| V5 Input Validation | **sim** | Período (`p_inicio`/`p_fim`) validado no Server Action antes de qualquer chamada ao banco, mesmo molde de `validarPeriodoPerdidos`; motivo obrigatório validado tanto na pré-checagem (UX) quanto na CHECK constraint (backstop real) |
| V6 Cryptography | não | Sem dado sensível novo além do já coberto pela ficha do cliente |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Elevação de privilégio via função de leitura nova (`clientes_encerrados`) | Elevation of Privilege | `SECURITY INVOKER` (sem cláusula), zero checagem de papel/dono no corpo — RLS de `clientes` decide as linhas, provado por teste positivo (Supervisor) e negativo (Vendedor de outro dono), mesmo padrão de `clientes_perdidos` |
| Vazamento de dado pessoal (LGPD) na tela/leitura nova | Information Disclosure | Mesma disciplina da Fase 28: a leitura devolve só nome/motivo/data/vendedor — nenhum campo de contato (telefone/e-mail/contato) do cliente. Gate de grep sem comentários replicado (já provado eficaz na Fase 28) |
| Reativar/encerrar cliente de outro vendedor | Tampering | Nenhum código novo de autorização — o `UPDATE` de `mover_card_funil` continua passando pela mesma RLS; um `clienteId` alheio afeta 0 linhas, mesmo comportamento já provado pelo caso `reabrir-outro-vendedor` da Fase 28, a replicar como `reativar-outro-vendedor`/`encerrar-outro-vendedor` |
| Contornar o guard de frequência mudando o valor no navegador | Tampering | O valor "efetivo" nunca é aceito cru do navegador sem re-validação — `isFrequenciaVisita()` continua sendo o type guard aplicado ao valor final antes de ir para o RPC, e o CHECK/guard do RPC continua sendo o backstop real |
| `ALTER TYPE` mal-migrado deixando o banco de produção num estado parcialmente aplicado | Tampering / Denial of Service | Migration 0035 contém SOMENTE o `ADD VALUE` — se ela falhar, nada mais foi tocado; a migration 0036 só roda depois que 0035 já comitou, dentro do mesmo `db push` sequencial, sem exigir dois deploys separados |

⚠️ **Nota de conformidade (LGPD/segurança da informação):** esta fase cria uma nova tela de relatório (`/encerrados`) e um novo fluxo que grava/expõe dados pessoais associados a um cliente (nome, motivo, data, vendedor responsável) — mesmo perfil de dado já tratado na Fase 28 ("Perdidos"), sem nenhum campo de contato novo. Como o projeto já trata LGPD com seriedade (CLAUDE.md/diretriz organizacional), reforço explícito ao dono do projeto: **antes de aprovar o checkpoint de aplicação da migration em produção, confirme que o mesmo escopo mínimo de dados (nome do cliente, motivo, data, vendedor) já aceito na Fase 28 continua adequado para esta nova tela — nenhum campo adicional de dado pessoal do cliente ou do vendedor deve ser exposto sem essa confirmação explícita.**

## Sources

### Primary (HIGH confidence — lido diretamente neste repositório)
- `supabase/migrations/0002_clientes_and_funil.sql` — enum original, `chk_ganho_somente_etapa_final`, `chk_perdido_exige_motivo`, `motivos_perda` (molde de lista editável), `mover_card_funil` original, triggers de histórico
- `supabase/migrations/0026_dia_fixo_visita.sql` — versão VIGENTE de `mover_card_funil` (todos os guards, inclusive o de frequência não-grandfathered) e de `agenda_do_vendedor()` (confirma ausência de filtro por status)
- `app/actions/funil.ts` — `marcarStatus`/`moverCard` completos, incluindo o pré-check de frequência e o padrão `cnpjEfetivo`
- `components/clientes/ClienteDetailSheet.tsx` — `STATUS_OPTIONS`, `handleStatusSelect`, padrão de Select desabilitado com tooltip
- `components/clientes/PerdaMotivoDialog.tsx` — estrutura completa do diálogo de motivo a espelhar
- `components/layout/AppSidebar.tsx` — ícones já importados, `PRINCIPAL_SECTION` atual (Archive já em uso para Perdidos)
- `lib/funil/prospeccao.ts`, `lib/funil/frequencia.ts`, `lib/funil/fichaParaGanho.ts` — módulos puros existentes e seus contratos
- `lib/supabase/queries/agenda.ts` (linhas 180-220) — confirma `getClientesSemDiaFixo` já filtra só `'ganho'`
- `lib/supabase/queries/clientes.ts` — `getMotivosPerdaAtivos`/`getTiposTarefaAtivos`/`getMotivosConclusaoRemotaAtivos` (molde de catálogo)
- `app/actions/listas.ts` — `ListaTabela` union (7ª entrada necessária)
- `app/actions/tarefas.ts` — confirma que `tarefas` não tem restrição de status na criação (nota lateral do Pitfall 3)
- `.planning/phases/28-relat-rio-de-perdidos/28-01-PLAN.md`, `28-01-SUMMARY.md`, `28-02-PLAN.md`, `28-02-SUMMARY.md`, `28-03-PLAN.md`, `28-03-SUMMARY.md`, `28-04-PLAN.md`, `28-04-SUMMARY.md` — molde estrutural direto da fase inteira
- `supabase/config.toml` — `major_version = 17` (Postgres)
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`

### Secondary (MEDIUM confidence)
- [Managing Enums in Postgres — Supabase Docs](https://supabase.com/docs/guides/database/postgres/enums) — confirma o padrão de dois-arquivos para `ADD VALUE` seguido de uso
- WebSearch: "supabase CLI db push single transaction all migrations or one transaction per file" — cruzado com o comportamento observado (`db diff` já auto-split esse tipo de mudança em dois arquivos), reforçando que cada migration roda isolada

### Tertiary (LOW confidence)
- Nome do ícone `PauseCircle` para o menu (ver Assumptions Log A1) — escolha de design, não verificada contra a versão exata de `lucide-react` instalada

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — zero pacotes novos
- Architecture (migration split, guard interaction): HIGH — verificado lendo o SQL/TS real deste repositório, não presumido
- Reactivation guard finding (Pitfall 1): HIGH — a lógica foi lida linha a linha em `0026_dia_fixo_visita.sql` e `app/actions/funil.ts`
- Component reuse recommendation (Pitfall 4): MEDIUM — é uma recomendação de design apoiada em precedente direto do mesmo repositório, não uma regra absoluta
- Ícone sugerido: LOW — nome de ícone não verificado contra a versão instalada de `lucide-react`

**Research date:** 2026-09-26
**Valid until:** Estável enquanto `mover_card_funil`/`agenda_do_vendedor` não forem alteradas por outra fase antes da 29 rodar — reconferir o número da última migration (`0034` no momento desta pesquisa) e o pin do Supabase CLI em `.planning/STATE.md` no início do planejamento, caso outra fase tenha sido executada entretanto.
