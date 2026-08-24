# Feature Research

**Domain:** Sales CRM — bulk import differentiation (prospect vs active customer) + recurring visit cadence with fixed anchor day
**Researched:** 2026-08-24
**Confidence:** MEDIUM (core patterns cross-checked against multiple sources; field-sales-specific nudge-list UX is inferred, not directly verified — see Gaps)

**Scope note:** This file covers only the two NEW capability areas for v1.6 (import split, fixed-anchor cadence). Table-stakes CRM features already shipped (import wizard, Agenda, frequência enum, kanban, dashboard) are intentionally not re-researched — see `.planning/PROJECT.md` "Validated" for what already exists.

## Feature Landscape

### Table Stakes (Users Expect These)

Features a sales team lead would consider "obviously missing" once they've seen any real CRM handle prospecting vs. active accounts, or any calendar app handle recurrence.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Two distinct bulk-import entry points, one per client "stage" (prospect vs. active/won) | Standard CRM pattern: Salesforce splits Lead import (minimal fields: name, company, email) from Contact/Account import (fuller data, tied to an Account). A single "one-size-fits-all" import form is what CRM Raiar already has today and is exactly the redundancy this milestone removes. | LOW | Reuses the existing import wizard pattern (map columns → per-row preview with error/duplicate flags → confirm-to-write) end to end — this is a new spreadsheet type on the same pipeline, not a new pipeline. |
| Minimal-required-fields import for prospects | Early-funnel entities are expected to be captured fast with incomplete data, filled in as the deal progresses — this is the exact "cadastro rápido, poucos campos obrigatórios" value already established for manual cadastro (v1.0) and now extended to import. | LOW | Already partially true today (`razão social + endereço + responsável` minimum) — v1.6 loosens further to Nome Fantasia + Responsável only, matching the "prospect" label change. |
| Full-data-required import for active/won customers | Active customers have a real commercial relationship; a CRM that lets a "won" account exist with missing legal/contact data is a data-quality hole every real CRM guards against at the Contact/Account level (see Salesforce Lead-vs-Contact field split found in research). | MEDIUM | Must enforce the SAME required-field set that the manual "ganho" transition gate enforces (razão social, CNPJ, endereço completo) — this is the highest-risk item in this milestone (see Dependencies below), because the codebase has already been bitten once by an import RPC silently dropping fields the gate expected (`importar_clientes_lote`, Fase 19 — `jsonb_to_recordset` not declaring new keys). |
| Client created via "Active" import lands directly at the end of the funnel (won/ativo), not at "Aguardando contato" | If the point of this import is "this is already a real customer," starting them at stage 1 of a 7-stage prospecting funnel would be actively wrong and would corrupt every funnel/conversion metric on the dashboard (time-in-stage, conversion rate) built in v1.2. | MEDIUM | Needs the SAME transition guard as `mover_card_funil` (CNPJ + razão social + endereço), applied at insert time instead of at a kanban drag — logically the same rule, two different code paths, real drift risk. |
| Duplicate detection on the new import flow | Both existing imports already do per-row duplicate flagging + revalidation at write time; a new import type without this would be a visible regression, not a new capability. | LOW | Pure reuse of the existing duplicate-check logic, no new design needed. |
| Frequência de visita explicitly optional/absent on Active import, surfaced elsewhere as a to-do | The milestone goal explicitly separates "get the customer data in" from "define how often to visit them" — bundling both into one big import step would reintroduce exactly the "long screens that don't get filled" problem this whole CRM exists to solve. | LOW (as an omission) / MEDIUM (as a downstream nudge, see Differentiators) | This is the direct dependency link between the import feature and the Agenda nudge-list feature below. |
| Fixed-day recurrence definition (weekday for weekly/biweekly, Nth-weekday-of-month for monthly) | Confirmed as the de facto standard recurrence mental model — Google Calendar/Outlook offer exactly "Weekly on [day]" and "Monthly on the [Nth] [weekday]" (e.g., "2nd Tuesday"), which is what most people already know from calendar apps. Building anything else (e.g. "every 14 days from last visit," which is what the CURRENT v1.3 implementation does) invites cadence drift — a rep who visits a store 2 days late this month permanently shifts all future suggested dates instead of snapping back to the intended weekday. | MEDIUM | "Nenhuma" (no cadence) stays a valid 4th option, unchanged. Weekly/biweekly need one field (weekday 1-7); monthly needs two (Nth occurrence 1st-4th/last + weekday) — this is the standard RRULE `BYDAY`/`BYSETPOS` shape, no need to invent a new data model. |

### Differentiators (Competitive Advantage)

Not universally present in field-sales CRMs (not directly confirmed in named tools like Badger Maps/SPOTIO/Repsly), but directly aligned with this project's Core Value ("visibilidade clara do que está parado").

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Clientes ativos sem frequência definida" section in the Agenda | Turns a silent data gap (a won client nobody scheduled) into a discoverable, non-blocking to-do — same pattern already proven in this codebase for "cards parados/atrasados" (visual highlight, never a gate). Named field-sales tools focus on route/territory coverage and outcome-triggered follow-ups, not specifically a "missing cadence" nudge — this is a genuine (small) differentiator, not an industry-standard feature being copied. | MEDIUM | Pure additive read: query `clientes` where `status_acompanhamento = 'ganho'` and `frequencia_visita is null` (or `frequencia_visita is not null` but fixed-day fields are null, for clients caught mid-migration). No new schema needed for the list itself — reuses the existing `frequencia_visita` nullability from v1.3. Must explicitly NOT block anything — matches the milestone's own framing ("actionable list/reminder, not a blocking gate") and the project's already-established anti-notification stance (visual/list surfacing only, never a blocking modal or an external notification). |
| Next-visit suggestion targets the fixed anchor day, not "days since completion" | A rep who always visits a client "toda segunda" gets a suggested date that's always a Monday, even if the last visit happened on a Wednesday because it was late. This is qualitatively better than pure interval math and is the reason to build fixed-day cadence at all (otherwise the existing v1.3 "add N days" logic is simpler and already works). | MEDIUM-HIGH | Touches `concluir_visita`, which is flagged in Key Decisions as the one place doing server-side date math specifically to avoid the timezone bug (`new Date(string)` in the browser). The new fixed-anchor math (e.g. "next Tuesday from today," or "3rd Thursday of next month") must stay in Postgres for the same reason, and must remain a *suggestion the vendor confirms/adjusts* — this project has an explicit, already-recorded decision against silent automatic rescheduling. |

### Anti-Features (Commonly Requested, Often Problematic)

Patterns that look appealing for this exact milestone but would violate constraints or decisions this project has already made.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Making "Importar Clientes Ativos" an upsert (update-if-exists) | Feels natural once you're importing "real" customers — teams often want to re-upload a corrected sheet | Explicitly out of scope already (v1.1 decision: "Importação como atualização de cliente existente... fica para uma versão futura"); scope creep risk is high here specifically because Active-import customers are more likely to already half-exist from a prior Prospecting import | Keep both new/renamed imports create-only, same as today; duplicate detection already flags likely-existing rows so the Supervisor can skip them and edit manually |
| Blocking cadence definition at the moment of "ganho" (a 3rd required field alongside CNPJ + endereço) | Feels consistent with the CNPJ-at-ganho pattern (v1.4) — "why not require frequência too?" | The milestone brief is explicit that this must be a reminder list, not a gate — and the project has a standing decision (VIS-04, v1.3) to grandfather/never force frequency retroactively; forcing it at ganho time contradicts "vendor confirms, never automatic/forced" and would re-add friction this CRM exists to remove | Keep frequência (and its fixed day) fully separate from the ganho gate; surface it only via the new Agenda nudge section |
| Free-text or open-ended cadence description ("toda segunda de manhã", "primeira semana do mês") | Faster to type, feels flexible | Reintroduces exactly the "mensal / Mensal / 1x por mês" inconsistency this project explicitly avoided for `frequencia_pedidos` (a lesser field) by using a managed list instead of free text — an unstructured cadence can't drive the automatic next-date suggestion at all | Structured pickers only: weekday enum (1-7) for weekly/biweekly, ordinal (1st-4th/last) + weekday for monthly — same shape as standard calendar-app recurrence UI |
| Auto-advancing the next visit date silently when a fixed-day cadence is defined | Seems like the whole point of "fixed day" — why not just schedule it automatically? | Directly contradicts an existing, explicit project decision: "Reagendamento/troca automática e silenciosa da próxima visita — contradiz a decisão de sempre pedir confirmação do vendedor" (v1.3) | Server computes the suggested fixed-anchor date; vendor always confirms/adjusts before it's written, exactly like today's interval-based suggestion |
| Route optimization / clustering visits by geography when defining fixed days | Tempting since "fixed day" scheduling is adjacent to route planning in most field-sales tools researched (Badger Maps, SPOTIO, Repsly all lead with route/territory features) | Already explicitly out of scope (v1.3): "fora do problema real do time (disciplina de funil, não deslocamento); exigiria serviço pago" | Fixed day is purely a scheduling anchor per client, no geographic reasoning, no paid mapping service |
| Remembering the column mapping between "Importar Clientes em Prospecção" and "Importar Clientes Ativos" as if they were the same mapping | Both are spreadsheet imports of clients, so a user might expect shared/remembered mapping | Already explicitly out of scope for imports in general (v1.1): each spreadsheet is mapped from zero; the two flows also have genuinely different required columns, so a shared mapping would be actively misleading | Two independent, from-scratch mapping screens, reusing the same wizard component but with different required-field validation per flow |

## Feature Dependencies

```
[Importar Clientes Ativos]
    └──requires──> [Existing import wizard pipeline] (map → preview → confirm, v1.1)
    └──requires──> [Expanded "ganho" gate rules made a single source of truth]
                       └──shared-by──> [mover_card_funil guard] (kanban drag path, v1.4)

[Importar Clientes em Prospecção] (renamed "Importar clientes")
    └──requires──> [Existing import wizard pipeline] (v1.1) — required-field set loosened, not rebuilt

[Remove "Importar CNPJ" / "Importar frequências" menu items]
    └──requires──> [Importar Clientes Ativos] shipped and covering their use case first (sequencing, not code dependency)

["Clientes ativos sem frequência definida" Agenda section]
    └──requires──> [frequencia_visita nullable column] (already exists, v1.3)
    └──enhances──> [Agenda] (existing unified list, v1.3)

[Fixed-day cadence definition UI]
    └──requires──> [New fixed-day columns on `clientes`] (weekday / ordinal+weekday — new in v1.6)
    └──requires──> [frequencia_visita enum] (already exists, v1.3) — fixed day is metadata ON TOP of the existing frequency choice, not a replacement of it

[Next-visit suggestion targets fixed anchor]
    └──requires──> [Fixed-day cadence definition UI] (a client needs a fixed day before this logic can run)
    └──requires──> [concluir_visita RPC] (existing, v1.3) — rewritten, not replaced
    └──conflicts-if-missing──> clients with `frequencia_visita` set but no fixed day yet (migration-period gap, must fall back to today's interval logic or be flagged as also "missing cadence")
```

### Dependency Notes

- **`Importar Clientes Ativos` requires a single source of truth for the "ganho" gate rules:** Today the gate (CNPJ, and after v1.6 also razão social + endereço completo) lives inside `mover_card_funil`. If the new import RPC re-implements the same rule as a separate check, the two will eventually drift — this exact failure mode already happened once in this codebase (`importar_clientes_lote` not declaring `cnpj`/`nome_fantasia` in v1.4's `jsonb_to_recordset`, silently dropping data). Treat this as the single highest-risk dependency in the milestone.
- **Fixed-day cadence enhances, not replaces, `frequencia_visita`:** The existing enum (semanal/quinzenal/mensal/nenhuma) stays the primary field; fixed day (weekday, or ordinal+weekday for monthly) is additional metadata that only makes sense when frequency ≠ "nenhuma." Validation should make the fixed-day fields required exactly when frequency requires them, and null otherwise.
- **The Agenda nudge section and the next-visit-suggestion rewrite are two different pieces of work that share the same underlying gap (clients without a fixed day):** the nudge list is a read-only query; the suggestion rewrite is a write-path change to `concluir_visita`. They can, in principle, ship independently, but the nudge list is what makes the fixed-day requirement usable in practice — without it, vendors have no way to discover which of their existing "ganho" clients (pre-v1.6, already have a `frequencia_visita` but no fixed day) need updating.
- **Menu cleanup conflicts if sequenced first:** removing "Importar CNPJ"/"Importar frequências" before "Importar Clientes Ativos" is fully working and adopted would leave Supervisors with no way to regularize existing "ganho" clients missing CNPJ or frequência — those two spreadsheets exist specifically for that backfill use case, and Active-customer import (a create-only flow) doesn't cover editing an already-existing client.

## MVP Definition

### Launch With (v1.6)

Exactly what's already scoped in `.planning/PROJECT.md` under "Target features" — nothing more.

- [ ] "Importar Clientes Ativos" spreadsheet — creates client already `ganho`, full data required (razão social, CNPJ, endereço completo, responsável), frequência excluded — essential because this is the actual milestone goal (two clear import doors)
- [ ] "Importar clientes" renamed to "Importar Clientes em Prospecção", required narrowed to Nome Fantasia + Responsável — essential to make the two doors symmetric and honestly labeled
- [ ] "Ganho" gate expanded to also require razão social + endereço completo (currently only CNPJ + frequência) — essential so the manual "mark as ganho" path and the new Active import enforce the identical rule
- [ ] Remove "Importar CNPJ" and "Importar frequências" menu items — essential to actually remove the redundancy the milestone names as its goal (sequence AFTER Active import is proven, per Dependency Notes)
- [ ] Agenda section: "clientes ativos sem frequência definida" — essential; this is what makes omitting frequência from the Active import actually safe (nothing gets silently forgotten)
- [ ] Fixed-day cadence definition (weekday for weekly/biweekly, Nth-weekday for monthly) — essential; this is the concrete mechanism the Agenda section points a vendor toward
- [ ] Next-visit suggestion computed from the fixed anchor day instead of calendar-day interval — essential; without this, "fixed day" is just metadata that doesn't change any actual behavior

### Add After Validation (v1.6.x / v1.7)

- [ ] Extend "frequências em massa" spreadsheet (existing, v1.3) to also accept the fixed-day columns — trigger: if Supervisors ask to backfill fixed days for many existing "ganho" clients at once instead of one-by-one via the Agenda nudge
- [ ] Downloadable example/template spreadsheet for the two new import flows — trigger: if Supervisors report column-mapping confusion between the two flows in practice

### Future Consideration (v2+)

- [ ] Import as update (upsert) for Active customers — defer: already explicitly out of scope project-wide since v1.1, no new signal to revisit it this milestone
- [ ] Remembered column mapping across repeated imports — defer: already explicitly out of scope since v1.1
- [ ] Notification (email/push) when a "sem frequência" list grows past a threshold — defer: contradicts the project's standing no-active-notifications decision (v1.0); the in-app Agenda list already exists as the "no cost, no new service" alternative

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Importar Clientes Ativos (full-data import) | HIGH | MEDIUM | P1 |
| Importar Clientes em Prospecção (renamed, narrowed required fields) | HIGH | LOW | P1 |
| Expanded "ganho" gate (razão social + endereço) | HIGH | LOW-MEDIUM | P1 |
| Menu cleanup (remove 2 redundant spreadsheets) | MEDIUM | LOW | P1 |
| Agenda: "sem frequência definida" section | HIGH | MEDIUM | P1 |
| Fixed-day cadence definition UI | HIGH | MEDIUM | P1 |
| Next-visit suggestion via fixed anchor | HIGH | MEDIUM-HIGH | P1 |
| Bulk fixed-day backfill via spreadsheet | MEDIUM | LOW (mirrors existing pattern) | P2 |
| Import template/example download | LOW-MEDIUM | LOW | P3 |

**Priority key:**
- P1: Must have — this is the entire stated scope of v1.6
- P2: Should have, natural follow-up once the P1 items are in production and used
- P3: Nice to have, only if real confusion is reported

## Competitor Feature Analysis

| Feature | Salesforce (Lead vs Contact) | Google Calendar / Outlook (recurrence) | Field-sales tools (Badger Maps / SPOTIO / Repsly) | Our Approach |
|---------|-------------------------------|------------------------------------------|----------------------------------------------------|--------------|
| Split import by client stage | Yes — Lead (minimal) vs Contact/Account (full, requires account link) | N/A | N/A | Same split, applied to "prospecção" vs "ativo/ganho" — matches this project's own funnel vocabulary instead of borrowing "lead/contact" terminology |
| Fixed-day recurrence definition | N/A | Yes — "Weekly on [day]", "Monthly on the [Nth] [weekday]" is the standard mental model | Not confirmed as a distinct feature (these tools emphasize route/territory, not cadence definition) | Adopt the calendar-app mental model (weekday picker; ordinal+weekday picker for monthly) since it's already familiar to any user of Google/Outlook calendars, rather than inventing new UI language |
| "Missing schedule" nudge list | N/A (Salesforce has generic list views/reports, not a dedicated nudge) | N/A | Not confirmed | Build as a section within the existing Agenda list (reuses an already-shipped, already-understood UI surface) rather than a new screen |
| Auto-scheduling / silent rescheduling | N/A | N/A (recurrence there IS meant to be automatic — different context, personal calendar) | Some tools offer automated follow-up reminders triggered by visit outcomes | Explicitly rejected for this project — vendor confirmation is a standing decision (v1.3), not something borrowed from a competitor gap |

## Sources

- WebSearch: "CRM bulk import prospects vs active customers different required fields" — Salesforce Lead-vs-Contact field-split pattern, cross-checked against Outreach/Zoho/Sage import docs. Confidence: MEDIUM (verified provider tier, general web synthesis)
- WebSearch: "sales CRM lead import minimal fields vs customer import full data best practice" — general import best-practice synthesis (Method, Odoo, Microsoft Dynamics import docs). Confidence: LOW (unverified web synthesis)
- WebSearch: "field sales CRM recurring visit schedule weekly biweekly monthly fixed day of week UX" — field-visit planning guides (Skedulo, Creatio "cyclic tasks," general field-sales blogs). Confidence: LOW
- WebSearch: "recurring event day of week / Nth weekday scheduling UI pattern" — Microsoft Graph (Outlook) recurrence docs, Google Calendar guide, MUI Scheduler docs — cross-checked, all describe the same "Weekly on [day]" / "Monthly on the [Nth] [weekday]" model. Confidence: MEDIUM (verified provider tier, consistent across independent sources)
- WebSearch: "SPOTIO Badger Maps Repsly account visit frequency reminder list rep dashboard" — no direct confirmation of a "missing cadence" nudge feature in these named tools; treated as an inferred, not verified, pattern. Confidence: LOW
- WebSearch: "CRM accounts without visit schedule/cadence defined actionable list not blocking gate" — general sales-cadence/ABM content, not directly on point; did not surface a specific product pattern. Confidence: LOW
- `.planning/PROJECT.md` — existing shipped features, Key Decisions (esp. the `importar_clientes_lote` drift incident, the `mover_card_funil` guard pattern, the "always vendor-confirmed, never automatic" cadence decision, and the server-side-date-math rule) — Confidence: HIGH (primary project source of record)

---
*Feature research for: sales CRM bulk import differentiation + recurring visit cadence with fixed anchor day*
*Researched: 2026-08-24*
