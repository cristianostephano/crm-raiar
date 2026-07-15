# Feature Research

**Domain:** B2B sales pipeline CRM (small internal sales team, kanban/funnel-based)
**Researched:** 2026-07-14
**Confidence:** MEDIUM

> Note on method: this research used the built-in WebSearch tool directly (Node.js runtime was unavailable in this environment, so the `gsd-tools` research-plan/research-store/classify-confidence seams could not be invoked). Findings are cross-referenced against multiple independent sources (Pipedrive/HubSpot/Zoho comparison articles, CRM implementation post-mortems, pipeline-aging and audit-trail guides) rather than a single source. No official vendor documentation or curated docs provider (Context7/Ref) was used, so confidence is capped at MEDIUM per the standard hierarchy — treat as directionally reliable, not authoritative.

## Feature Landscape

Everything below is filtered through the project's actual constraint: this is **not** a general-purpose CRM to compete with Pipedrive/HubSpot. It is a purpose-built internal tool for one sales team tracking PJ clients through one fixed funnel, replacing a paid CRM that failed for one specific reason — **data entry friction causes people to stop updating it**. That reframes "table stakes" away from "what does Pipedrive have" and toward "what does this specific team need to not abandon the tool again."

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete, or repeats the failure mode of the tool being replaced.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Kanban board with drag-and-drop stage movement | This is the core interaction model of every pipeline CRM (Pipedrive, HubSpot, Zoho, Capsule) — moving a card across lanes is how reps update status without opening a form | MEDIUM | Already scoped in PROJECT.md (7 fixed stages). Use a proven library (e.g. dnd-kit) rather than hand-rolled drag logic — drag-and-drop UX bugs are a common source of rework |
| Fast client record creation with minimal required fields | Directly named by the user as the reason the old CRM failed ("telas longas, esquecimento"). Industry research confirms over-engineered mandatory fields is a top adoption killer — CRM projects that start with a large mandatory field set see much lower usage after rollout | LOW | Already scoped: razão social + endereço + responsável only, rest filled in later |
| Role-based visibility (rep sees own, supervisor sees all) | Standard in every multi-user CRM; without it, a shared team pipeline becomes unusable or requires manual trust-based discipline | LOW–MEDIUM | Already scoped, enforced via Supabase RLS per project conventions |
| Lost-reason capture on stage-exit | Every competitor CRM (Pipedrive, HubSpot, generic pipeline tools) forces a reason when a deal is marked lost — it is the #1 source of "why are we losing deals" analysis, and without it the loss data in the dashboard is meaningless | LOW | Already scoped as an editable enum, required field on loss |
| Task/to-do list per card with due dates | Table stakes across all pipeline CRMs — a card without actionable next steps is just a static record | LOW | Already scoped (tarefas + data_conclusao) |
| Visual staleness/aging indicator on cards | Confirmed by research: "time-in-stage" and "no activity in N days" are the most common visual cues in modern pipeline boards to combat exactly the silent-neglect failure mode this project is trying to fix | LOW–MEDIUM | Already scoped as a requirement (destaque visual, no active notifications). Simplest implementation: flag any card with no field/status change past a threshold (e.g. days since last update) |
| Free-text notes per card | Universal — every CRM has a notes/description field for context that doesn't fit structured fields | LOW | Already scoped (observação) |
| Search / filter on the client list and/or kanban | **Gap in current scope.** Every pipeline CRM reviewed (Pipedrive, HubSpot, generic kanban boards) treats search/filter (by name, stage, rep, category, product) as baseline — without it, a board with dozens of active PJ clients becomes unusable for a supervisor scanning across the whole team | LOW–MEDIUM | Not currently in PROJECT.md Active requirements. Recommend adding at minimum: filter by responsável (for supervisor), filter by categoria/produto, text search by razão social |
| Basic activity/change history per client | **Gap in current scope.** Standard CRM pattern (Pipedrive, SugarCRM, Dynamics, Zoho all document this): a lightweight timeline of "what changed and when" on a client record — distinct from the single free-text `observação` field. Without it, when a card moves stages or a task closes, there's no record of *when* it happened, which undermines both trust in the data and the dashboard's own conversion-rate/win-rate numbers | MEDIUM | Does not need to be a compliance-grade audit trail (see Anti-Features) — a simple append-only log of stage changes, status changes, and task completions is enough. Can piggyback on Postgres triggers writing to a `historico` table |
| Client record edit history not required beyond above | — | — | Full field-level diffing (before/after values on every field) is audit-trail territory, not needed here — see Anti-Features |

### Differentiators (Competitive Advantage)

Not "competitive" in a market sense (this is internal-only, no revenue model) — but these are the features that make this purpose-built tool worth switching to instead of just using a cheaper generic CRM.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Prospecção por produto e por categoria no dashboard | Generic CRMs (Pipedrive/HubSpot/Zoho) don't have a native concept of "products consumed" as a dimension for pipeline analysis — this is domain-specific to a food-service/varejo B2B distributor and directly supports business decisions (which product line needs more prospecting) | MEDIUM | Already scoped. This is the single most "not available off the shelf" feature in the whole spec — worth protecting scope around it rather than trimming it |
| Editable enums (categoria, produtos, tipos de tarefa, motivo de perda) without needing a developer | Generic CRMs either hardcode these behind expensive admin tiers or require code changes; letting the supervisor self-serve list maintenance is a genuine friction reducer for a non-technical-adjacent operation | LOW–MEDIUM | Already scoped. Straightforward CRUD tables + RLS restricted to supervisor role |
| Minimal-friction PJ-specific fields (razão social, CEP/endereço structure, número de lojas) | Generic CRMs model "company" generically; a PJ-first, Brazil-specific address/company shape (CEP lookup, razão social) removes friction that a US-centric generic CRM (HubSpot, Pipedrive) would introduce | LOW | Already scoped. Consider CEP autocomplete (ViaCEP or similar free API) as a fast-follow — reduces typing without adding real complexity |
| Rep-scoped dashboard ("vejo só meus números") alongside supervisor's team-wide view | Most CRM dashboards default to admin-only or require paid tiers to segment by user; giving reps their own performance view without extra cost is a lightweight motivator (gamification-adjacent) that a free/cheap generic tool often doesn't offer cleanly at small scale | LOW–MEDIUM | Already scoped |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a small internal tool with a zero-infra-cost constraint and a non-technical operator.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Active notifications (email/push/SMS for overdue tasks) | Feels like the "complete" version of the staleness-highlight feature | Requires a notification service (cost, complexity, deliverability issues) — directly against the zero-infra-cost constraint; already explicitly out of scope | Visual highlight on kanban open (already scoped) — team checks the board daily anyway per current workflow |
| Compliance-grade audit trail (immutable log, before/after on every field, retention policy) | "Track every change" sounds like good practice, and shows up in every enterprise CRM audit-trail article | Massive overkill for a 2-role internal tool with no regulatory/compliance driver; adds schema complexity and storage for a team of a handful of people who don't need forensic-level history | Lightweight activity/change log (see Table Stakes) — enough to answer "when did this move" without building a compliance system |
| Marketing automation / email sequences / drip campaigns | Every general-purpose CRM (HubSpot, Zoho) bundles this, so it "feels" like a CRM should have it | This tool tracks an existing sales-team-driven funnel with manual outreach (visitas, mensagens) — not inbound/marketing-qualified-lead flow. Building this is a different product | None needed — tarefas (Visitar, Mandar mensagem) already cover the manual-outreach model this team actually uses |
| Native mobile app | Reps are "in the field" in B2B sales, so mobile feels essential | Already explicitly out of scope; web responsive via Next.js covers phone/tablet use without a second codebase or app-store distribution overhead | Responsive web UI (already scoped) |
| Configurable/multiple pipelines or per-user custom stages | Generic CRMs (Zoho especially) sell configurability as a feature | Directly against the explicit decision to keep the 7 stages fixed for MVP — configurability adds a settings UI, migration complexity, and analysis complexity (dashboard would need to handle N different funnels) for a team that has exactly one funnel today | Fixed 7-stage funnel (already scoped as Out of Scope for editability) |
| Third-party integrations (email sync, calendar sync, WhatsApp/telephony integration) | Competitor CRMs differentiate heavily on integration breadth | Each integration is a new external dependency, cost surface, and failure mode — directly against the zero-infra-cost validation goal; also not requested by the user | Manual task logging (Visitar, Mandar mensagem) is sufficient for the MVP; revisit only if usage proves the manual step is the actual friction point |
| Spreadsheet import UI | Seems useful for any future onboarding of new clients in bulk | Already explicitly out of scope — the one-time migration is a database-level operation, not a recurring product feature; building a robust CSV-import UI (validation, dedup, error handling) is disproportionate effort for a one-time need | One-time SQL-level import from the exported data (already decided) |
| Deal/revenue value field with forecasting, weighted pipeline value | Extremely common in general sales CRMs (expected revenue × probability by stage) | Not part of the current business model description — the funnel tracks first-sale acquisition, not deal value/recurring revenue; adding forecasting math for the wrong metric creates a dashboard that answers a question nobody's asking | Keep dashboard metrics scoped to what's decided: stage counts, win/loss, conversion rate, rep performance, prospecção by product/category |
| Granular per-field permission rules (e.g. some fields editable by rep, others supervisor-only) | Feels more "secure"/correct as the team scales | Two roles with clear boundaries (own-record edit vs. all-record edit/delete) is already decided and sufficient; field-level permission matrices are a common source of RLS policy bugs and are hard for a non-technical operator to reason about later | Row-level (whose record) + role-level (Vendedor/Supervisor) permissions only, per current decisions |

## Feature Dependencies

```
Kanban board (7 fixed stages)
    └──requires──> Client record (PJ) with responsável field
                       └──requires──> Auth + roles (Supabase Auth, Vendedor/Supervisor)

Role-based visibility (own vs all clients)
    └──requires──> Auth + roles
    └──requires──> RLS policies keyed on responsável = auth.uid()

status_acompanhamento = "ganho"
    └──requires──> Card currently in stage "1ª venda concluída" (state-dependent constraint)

status_acompanhamento = "perdido"
    └──requires──> motivo_perda selected from editable enum list

Dashboard metrics (conversion, win/loss, rep performance, prospecção por produto/categoria)
    └──requires──> Kanban board + status_acompanhamento + motivo_perda + produtos_consumidos populated
                       └──requires──> Editable enums (categoria, produtos_consumidos, motivo_perda) seeded before first use

Editable enums CRUD (categoria, produtos, tarefas, motivo_perda)
    └──requires──> Role-based permissions (Supervisor-only write)

Visual staleness highlight on kanban
    └──requires──> Timestamp of last meaningful update per card (stage change, task completion, or field edit)

Activity/change history per client (recommended addition)
    └──enhances──> Visual staleness highlight (same underlying "last updated" data, surfaced as a readable log)
    └──enhances──> Dashboard trust (auditable basis for "when did this convert")

Search/filter on kanban or client list (recommended addition)
    └──enhances──> Role-based visibility (supervisor needs to narrow a full-team view down to something scannable)

Active notifications ──conflicts──> Zero-infra-cost constraint
Configurable pipelines ──conflicts──> Fixed 7-stage decision
Compliance audit trail ──conflicts──> Small-team scale / non-technical operator maintainability
```

### Dependency Notes

- **Dashboard metrics require the editable enums to be seeded first:** conversion/prospecção-by-product numbers are meaningless until `categoria` and `produtos_consumidos` have real values, and `motivo_perda` needs at least a starter list before the first card can be marked lost. This means enum CRUD (or at minimum enum seed data) must ship in or before the phase that ships loss-tracking and the dashboard.
- **"Ganho" is a state-dependent business rule, not a free toggle:** the funnel stage and the win/loss status are two different fields that must be validated together (a card can only become "ganho" while in the last column). This needs to be enforced server-side (RPC or trigger/check constraint), not just in the UI, per the Supabase-conventions skill (never do authorization/business-rule enforcement only in the frontend).
- **Activity/change log enhances two already-scoped features rather than adding new UI surface:** the same "last updated at" data that powers the staleness highlight can be exposed as a per-client timeline with near-zero extra schema (one `historico` table, populated by a trigger or by the same mutation that updates stage/status). Recommend bundling this with the kanban/stage-movement phase rather than treating it as a separate feature.
- **Search/filter enhances role-based visibility, not a separate epic:** for the supervisor's "vê todos os clientes" view, an unfiltered list of every client from every rep is close to useless past a small handful of active deals. This should ship alongside (or very shortly after) the supervisor's full-visibility kanban, not be deferred to a later milestone.

## MVP Definition

### Launch With (v1)

This matches PROJECT.md's already-decided Active requirements, plus the two gaps flagged above.

- [ ] PJ client CRUD with minimal-required-field creation flow — core value proposition, directly fixes the reason the old CRM was abandoned
- [ ] 7-stage fixed kanban with drag-and-drop — the funnel visualization is the product
- [ ] Role-based visibility + edit/delete permissions (Vendedor vs Supervisor) — required for multi-user use from day one
- [ ] status_acompanhamento (em andamento / perdido / ganho) with stage-dependent "ganho" rule — needed for the dashboard to mean anything
- [ ] motivo_perda required on loss — same reason
- [ ] Tarefas per card with due dates — table stakes, already the team's working model (Visitar, Mandar mensagem)
- [ ] Visual staleness highlight on kanban — directly targets the "esquecimento" failure mode
- [ ] 4 editable enum CRUDs (categoria, produtos_consumidos, tipos de tarefa, motivo_perda), supervisor-only — required before dashboard numbers mean anything
- [ ] Dashboard (funil por etapa, ganhos x perdidos, desempenho por vendedor, conversão, prospecção por produto/categoria), rep-scoped and supervisor-scoped views — explicit success criterion, decided to be in MVP not deferred
- [ ] **Search/filter on client list/kanban** (by responsável, categoria, produto, texto livre por razão social) — recommend adding to MVP scope; without it the supervisor's "ver todos" view degrades fast
- [ ] **Lightweight activity/change log per client** (stage changes, status changes, task completions with timestamps) — recommend adding to MVP scope; low incremental cost given it reuses the staleness-highlight data model, and protects the dashboard's own credibility

### Add After Validation (v1.x)

- [ ] CEP autocomplete on address entry — trigger: if manual CEP typing turns out to be a real friction point once real usage data exists
- [ ] Basic CSV export of client list — trigger: if the team needs to hand data to someone outside the tool (accounting, ad hoc reporting) before a v2 decision is made
- [ ] Bulk actions on kanban (e.g. reassign multiple clients to a rep) — trigger: only if the team's re-assignment volume becomes a real recurring task, not a one-off

### Future Consideration (v2+)

- [ ] Configurable pipeline stages — defer until there's evidence the fixed 7-stage funnel doesn't fit an evolving process (explicitly decided as fixed for MVP)
- [ ] Email/calendar/WhatsApp integration — defer until manual task logging is proven insufficient; adds cost/complexity against the zero-infra goal
- [ ] Active notifications — defer until visual highlighting is proven insufficient (explicitly out of scope for MVP)
- [ ] Deal value / weighted pipeline forecasting — defer until the business model includes recurring/variable deal value tracking as a stated need

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PJ client CRUD, minimal required fields | HIGH | LOW | P1 |
| 7-stage kanban, drag-and-drop | HIGH | MEDIUM | P1 |
| Role-based visibility + permissions | HIGH | MEDIUM | P1 |
| status_acompanhamento + motivo_perda | HIGH | LOW | P1 |
| Tarefas per card | HIGH | LOW | P1 |
| Visual staleness highlight | HIGH | LOW–MEDIUM | P1 |
| Editable enums CRUD (4 lists) | HIGH | LOW–MEDIUM | P1 |
| Dashboard (all 5 metrics decided) | HIGH | MEDIUM–HIGH | P1 |
| Search/filter on client list/kanban | HIGH | LOW–MEDIUM | P1 (recommend promoting from gap to MVP) |
| Activity/change log per client | MEDIUM–HIGH | MEDIUM | P1 (recommend promoting from gap to MVP) |
| CEP autocomplete | MEDIUM | LOW | P2 |
| CSV export | LOW–MEDIUM | LOW | P2 |
| Bulk reassignment | LOW | MEDIUM | P3 |
| Configurable pipeline stages | LOW (no evidence of need yet) | HIGH | P3 |
| Integrations (email/calendar/WhatsApp) | MEDIUM (unproven) | HIGH | P3 |
| Active notifications | LOW (explicitly deferred) | MEDIUM–HIGH | P3 |
| Deal value/forecasting | LOW (not part of business model) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

For context only — this is not a competitive product, but comparing against the incumbent (the paid CRM being replaced) and the category leaders clarifies what "good enough" looks like.

| Feature | Pipedrive (category leader, pipeline-first) | HubSpot Free/Starter (category leader, all-in-one) | Our Approach (CRM Raiar) |
|---------|--------------------------------------------|------------------------------------------------------|---------------------------|
| Pipeline visualization | Visual pipeline is the entire interface; drag-and-drop is the primary interaction | One free pipeline on free tier, more on paid tiers | Single fixed 7-stage pipeline, matches actual current process — no configurability needed at this scale |
| Required fields on create | Configurable per org, can be minimal | Configurable | Deliberately minimal-by-default (razão social + endereço + responsável), the explicit fix for the incumbent tool's failure mode |
| Lost-reason tracking | Built-in "lost reason" modal on drag-to-lost | Built-in deal-lost properties | Same pattern, via required editable enum |
| Activity/task reminders | Built-in activity reminders, can escalate to notifications | Built-in task queues and reminders | Visual-only highlighting, no active notification (deliberate cost/complexity tradeoff) |
| Custom fields / product taxonomy | Generic custom fields, no domain-specific product taxonomy | Generic custom fields/properties | Domain-specific `produtos_consumidos` + `categoria` enums feeding directly into dashboard — this is the genuine differentiator vs. any generic CRM |
| Dashboard/reporting | Goal-tracking dashboards, deal reports, some free-tier limits | Reporting dashboards, limited on free tier | Purpose-built 5-metric dashboard scoped exactly to this team's stated success criteria, both rep-level and supervisor-level views, no paywall since self-hosted on Supabase free tier |
| Multi-user permissions | Role/team permissions on paid tiers only | Role/team permissions on paid tiers only | Two clean roles (Vendedor/Supervisor) enforced via RLS at zero marginal cost — this is where a generic CRM would normally require an upgrade to a paid seat tier |
| Cost at this team's scale | ~$14+/user/month (Essential tier) once past free trial limits | Free tier caps at 2 users / 1 pipeline; paid tiers needed beyond that | $0 infrastructure cost (Supabase + Vercel free tier), which is the entire point of the migration |

## Sources

- [Zoho vs. Pipedrive: Which is the best CRM for team productivity?](https://blog.hubspot.com/sales/zoho-vs-pipedrive-team-productivity) — MEDIUM confidence (vendor-adjacent comparison content)
- [Salesforce vs Zoho vs HubSpot vs Pipedrive – The Best CRM for 2026](https://blog.salesflare.com/compare-salesforce-zoho-hubspot-pipedrive) — MEDIUM confidence
- [HubSpot vs Pipedrive vs Zoho: Best CRM for Growing Teams in 2026](https://meetergo.com/en/magazine/hubspot-vs-pipedrive-vs-zoho-crm-growing-teams) — MEDIUM confidence
- [Kanban Board — PipelineCRM Help](https://help.pipelinecrm.com/articles/238265-kanban-board) — MEDIUM confidence (product documentation, single vendor)
- [9 Reasons You Should Choose a Kanban Board for Better Workflow Control in CRM](https://msdynamicsworld.com/blog/9-reasons-you-should-choose-kanban-board-better-workflow-control-crm) — MEDIUM confidence
- [CRM Implementation Mistakes To Avoid](https://gain.io/blog/crm-implementation-mistakes) — MEDIUM confidence, cross-referenced against multiple similar articles on over-engineering/scope creep
- [Why CRM Implementations Go Over Budget: The 4-Phase Scope Creep Framework](https://www.hyphadev.io/blog/why-crm-implementations-go-over-budget) — MEDIUM confidence
- [Historical Summary vs. Activity Stream vs. Audit Log — SugarCRM Support](https://support.sugarcrm.com/Knowledge_Base/User_Interface/Historical_Summary_vs._Activity_Stream_vs._Change_Log/) — MEDIUM-HIGH confidence (official vendor support documentation)
- [Building Audit Trails in Your CRM: A Guide for Compliance-Focused Organizations](https://vantagepoint.io/blog/sf/building-audit-trails-crm-compliance-guide) — MEDIUM confidence
- [Sales pipeline aging: how to identify stalled deals — Outreach](https://www.outreach.ai/resources/blog/sales-pipeline-ageing) — MEDIUM confidence
- [5 Metrics to Track Deal Aging in Sales Pipelines](https://aisdr.shop/articles/metrics-track-deal-aging-sales-pipelines) — MEDIUM confidence
- [Sales Team Performance Dashboard Examples and Reporting Templates — Coupler.io](https://www.coupler.io/dashboard-examples/sales-team-performance-dashboard) — MEDIUM confidence
- [CRM Dashboards For Sales And Customer Insights](https://gain.io/blog/crm-dashboards) — MEDIUM confidence
- `.planning/PROJECT.md` — HIGH confidence (primary source: user-validated decisions and explicit Out of Scope list for this project)

**Method caveat:** the `gsd-tools` research-plan/research-store/classify-confidence seams were unavailable (no Node.js runtime on PATH in this session), so this research relied on direct WebSearch calls rather than the cached, provider-routed pipeline. Confidence tags above are applied manually per the standard hierarchy (official vendor docs > cross-referenced blog/comparison content > single unverified source) and should be treated as indicative, not seam-verified.

---
*Feature research for: B2B sales pipeline CRM, internal tool, small team*
*Researched: 2026-07-14*
