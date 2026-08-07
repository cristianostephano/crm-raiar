# Feature Research

**Domain:** B2B/field-sales CRM — unified agenda/task-list + recurring post-sale visit scheduling
**Researched:** 2026-08-07
**Confidence:** MEDIUM (HIGH where mapped onto this project's already-established patterns; LOW-MEDIUM where drawn from general CRM market research — see Sources)

## Context Recap

This is not a general "CRM agenda features" survey — it's scoped tightly to what v1.3 (Agenda do Vendedor) needs for a **small internal team** (a handful of vendedores + 1 supervisor), **non-technical owner**, **zero-infra-cost** constraint, and a Core Value that explicitly penalizes friction ("cadastro rápido, poucos campos obrigatórios, mínimo de fricção"). Two things already exist and must be reused, not rebuilt: funnel-card `tarefas` (with `tipos_tarefa` enum + `data_conclusao`) and the automatic `historico` change log. Notificações ativas (push/email) and app mobile nativo are already explicitly Out of Scope in `PROJECT.md` — that decision carries forward into this research.

## Feature Landscape

### Table Stakes (Users Expect These)

Features without which the Agenda screen would feel broken or would fail its stated goal ("mostrar o que ele precisa fazer, hoje e nos próximos dias").

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unified "today / overdue / upcoming" list merging prospecção tasks + pós-venda visits | This is the entire premise of the milestone — a vendedor should never have to check two places. Every CRM task-management pattern found (HubSpot task queue, Zoho Tasks, Salesforce Activities) centers on one merged list, not per-source lists | MEDIUM | Reuses existing `cards.tarefas` (via `data_conclusao`); needs a new `visitas`/`agendamentos` table for pós-venda. The "unification" itself is a query/view concern (e.g. a Postgres view `UNION`-ing both sources), not new domain data |
| Overdue/atrasado visual highlighting, grouped by today vs. this week vs. late | Directly extends the pattern already shipped and validated in the kanban ("Cards parados/atrasados ficam visualmente destacados") — the team already expects this signal | LOW | Pure date math with `date-fns`, already in the stack; no new library needed |
| Mark-done flow that requires a short written summary before completion is accepted | Explicit requirement in the milestone scope, and it's the mechanism that turns "did the task" into "here's what happened" — matches the standard CRM pattern of capturing the closing note at the point of closure, not as an afterthought | MEDIUM | **Open dependency question:** does this reuse/extend the existing `historico` table (which already logs etapa/status/task changes automatically) or does it need a new structured table (e.g. `interacoes`)? `historico` today is a system-generated audit log; a user-authored summary is a different kind of record (free text, always present, queryable per client). Recommend a new lightweight table referencing `historico`-style shape (autor, cliente, data, tipo, resumo) rather than overloading the audit log — flag this for the architecture/plan phase |
| Per-client visit/task history ("diary") visible to vendor and supervisor | Explicitly requested in scope; also the natural payoff of forcing a summary at completion — without a viewer, the summary is write-only and the feature has no value | MEDIUM | Read-side query joining completed prospecção tasks + completed visitas, ordered by date, scoped by the same RLS visibility rule already used for `clientes` (vendedor → own; supervisor → all) |
| Setting visit frequency at the moment a card is marked "ganho" | Explicit requirement; it's also the only sane trigger point — asking for a cadence before a deal is won has no meaning, and asking for it later reintroduces a manual step the team would forget (which is exactly the friction this CRM exists to remove) | LOW-MEDIUM | Hooks into the existing "mover card para ganho" flow (likely a small modal/step added to that action, not a separate screen) |
| Editable/cancelable recurrence at any time | Explicit requirement; accounts change (a client pauses orders, a vendor's route changes) — a cadence that can't be adjusted would get abandoned or worked around outside the system, undermining trust in the Agenda | LOW | Simple update on a `frequencia_visita` field per client; no versioning/history needed for the setting itself (the historico of visits already captures what happened over time) |
| Suggested next visit date on completion, with confirm-or-adjust (never silent auto-schedule) | Explicit requirement, and confirmed by research as the dominant CRM pattern: recurring-task engines (Zoho, SuiteCRM, generic recurrence UIs) universally advance to a system-computed next date but leave it editable at the point of completion — a purely silent auto-reschedule was not found as a default pattern anywhere surveyed | LOW-MEDIUM | Pure date math (`date-fns`) off the stored frequency; UI is a pre-filled date field the vendor can accept or change, not a background job |
| Role-scoped visibility on the Agenda itself (vendedor sees own agenda; supervisor sees the whole team's) | Direct continuation of the RLS-driven visibility rule already governing `clientes` and the funil — an agenda that leaked cross-vendor tasks would break the existing security model and user expectations in one move | LOW | No new authorization concept — same RLS pattern (`responsavel = auth.uid()` for vendedor, unrestricted for supervisor), applied to the new `visitas` table and to the query backing the unified list |
| New "ativo" client fields (Nome Fantasia, CNPJ, frequência de pedidos, frequência de visitas), required only once, never at initial cadastro | Explicit requirement, and structurally it's the same pattern already validated for the "cadastro rápido" flow: minimum-required-fields-first, richer fields later — this milestone extends that pattern to a second gate ("ativo") instead of inventing a new one | LOW-MEDIUM | Needs a schema/RLS decision (new nullable columns + a check/trigger enforcing "required when ativo", or a conditional form-level validation backed by a server-side re-check) — flag for architecture research; `frequência de visitas` is very likely the *same underlying value* as the recurrence set at "ganho", not a duplicate field (see Feature Dependencies) |

### Differentiators (Nice, Could Defer)

Features that would make the Agenda meaningfully better but are not required for it to be usable and trustworthy on day one.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Compact weekly strip/mini-calendar alongside the list (not a full calendar app) | Gives a "shape of the week" glance beyond a flat list — useful once a vendor has enough visits to want to see clustering by day | MEDIUM | Genuinely nice-to-have; a flat prioritized list already answers "what do I do today/this week" per the milestone goal. Defer until real usage shows the list alone is insufficient |
| Quick filters on the Agenda (by tipo — prospecção vs. visita; by cliente) | Helps once the list gets long (more clients "ativo" over time) | LOW | Cheap to add later; not needed at MVP team/client volumes (a handful of vendedores, hundreds of clientes at most, per the existing dashboard's scale) |
| Supervisor filter by vendedor on the team-wide agenda view | Mirrors the existing dashboard's per-vendor breakdown; useful for a supervisor scanning the whole team's day | LOW | Low cost since the underlying RLS/query already supports "all clients" for supervisor — this is a UI filter, not new authorization logic |
| Reschedule/snooze a single occurrence without touching the recurring setting | Handles the "client asked to move this one visit, not cancel the cadence" case | MEDIUM | Real value but adds a "single occurrence override vs. series" distinction — exactly the kind of edge case that increases complexity disproportionately for a first release. Confirm/adjust-at-completion already covers the common case (next date wasn't right, fix it when you get there) |
| Item count badge on the "Agenda" nav item (e.g. "Agenda (5)") | Small UX nicety, mirrors patterns like unread-count badges | LOW | Purely cosmetic; easy to add anytime, doesn't unblock or block anything else |
| Full-text search across completion summaries | Useful once the visit-history "diary" accumulates months of entries | LOW-MEDIUM | Defer — Postgres full-text search is cheap to add later on the same table; no reason to build it before there's enough data to search |
| Export of visit/task history (reusing the existing import/export pattern) | Consistent with the CRM's existing export capability | LOW | Natural extension once the underlying table exists; not needed for the Agenda to deliver its core value on day one |

### Anti-Features (Commonly Requested, Often Problematic)

Things that look like natural additions to "an agenda feature" in a generic CRM survey, but would work against this project's actual constraints.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Active notifications (email/push/SMS reminders for due tasks/visits) | Standard in most commercial CRMs and field-sales tools; feels like "what an agenda app should do" | Already explicitly ruled out in `PROJECT.md` Out of Scope, and for good reason here: it requires a notification service (cost, even if marginal, breaks the zero-infra-cost posture) and operational complexity (delivery failures, opt-outs) disproportionate to a handful of internal users who already open the app daily | The same visual "atrasado" highlighting pattern already proven in the kanban, now applied to the Agenda list — the team opens the CRM to work the funil anyway, so in-app visibility is sufficient |
| Full calendar app (drag-to-reschedule across days, multi-day/month views, custom recurrence rules like "every 3rd Tuesday") | Field-sales SFA tools (e.g. Spotio-style products) build genuine route/calendar planning; feels like the "complete" version of an agenda | This project explicitly caps recurrence at weekly/biweekly/monthly/none — anything more expressive is solving a problem this team doesn't have, and a full calendar UI is a large UI/interaction surface (drag-and-drop across a grid, timezone edge cases) for a team whose actual ask is "what do I do today," not "help me plan my month visually" | The prioritized list (today/overdue/upcoming) already satisfies the stated goal; a lightweight weekly strip (see Differentiators) is the ceiling worth considering, not a full calendar |
| Silent/automatic rescheduling of the next visit with no human step | Some recurring-task engines default to "just advance the date" for pure reminders | Explicitly contradicted by the milestone spec ("o vendedor confirma ou ajusta — não automação silenciosa") — and rightly so: order/visit needs shift per client, and a silently-moving date the vendor never sees is exactly the kind of "system decided something without me" friction that erodes trust in a tool the team already resents (the old CRM) | Suggest-and-confirm, as already specified: pre-fill the computed date, require an explicit accept/adjust action |
| Territory/route optimization or geo-mapping of visits | A staple of dedicated field-sales apps (Spotio and similar) | Massive scope/cost mismatch: needs a maps/geocoding API (recurring cost, breaks zero-infra-cost), and this team's actual problem (per `PROJECT.md`) is funil discipline and follow-through, not travel-route efficiency | None needed — not a real gap for this team's stated pain point |
| AI-generated call/visit summaries or auto-transcription | Increasingly common CRM add-on (call recording → AI summary → CRM field) | Requires a paid third-party AI/transcription service and adds a failure-prone dependency for very little gain when the actual requirement is just "a short written summary" a vendor can type in under a minute | A single required short-text field at completion, exactly as scoped — keeps to "mínimo de fricção," no new cost, no new service |
| Value/deal-size-weighted "smart" prioritization scoring (à la Salesforce Einstein-style ranking) | Enterprise CRMs increasingly auto-rank tasks by deal value/probability, not just date | This CRM doesn't track deal monetary value at all (explicitly Out of Scope per `PROJECT.md`: "Valor em R$ / ticket médio... adiado até virar necessidade real") — building a scoring model on top of data that doesn't exist would require inventing new required fields, directly against "poucos campos obrigatórios" | Simple date-based ordering (overdue → today → this week) is sufficient at this team's scale (a handful of vendedores, each with a manageable client list) and matches how the kanban already surfaces urgency (visual stalled/overdue highlighting, not a scoring algorithm) |
| Task delegation/reassignment between vendedores from the Agenda | Some CRMs let managers reassign open tasks across reps | No evidence this team needs it — the existing "reassign on deactivation" flow (v1.2) covers the one real reassignment case (a vendor leaving), and open-ended task delegation adds a permission surface (who can reassign what to whom) with no stated business need | If it comes up later, model it the same way deactivation-transfer was modeled: supervisor-only, RLS-backed, not a general-purpose feature |
| Configurable/custom recurrence patterns beyond weekly/biweekly/monthly/none (e.g. RRULE-style "every N days," specific weekdays) | "More flexible" always sounds better in the abstract | Directly against the explicit milestone scope, and against "mínimo de fricção" — every extra recurrence option is a decision the vendor has to make at "ganho" time, when the goal is a fast, low-friction step, not a scheduling configuration screen | The four fixed options already specified (semanal/quinzenal/mensal/nenhuma) cover the realistic range for a food-distribution B2B relationship cadence |

## Feature Dependencies

```
Agenda unificada (today/overdue/upcoming list)
    └──requires──> Prospecção: existing cards.tarefas (tipos_tarefa, data_conclusao) [already shipped]
    └──requires──> Pós-venda: new visitas/agendamentos table
                       └──requires──> frequência de visita set at "ganho" transition
                                          └──requires──> existing "mover card para ganho" flow [already shipped]

Suggested next visit date on completion
    └──requires──> frequência de visita (stored per client/recurrence)
    └──enhances──> Agenda unificada (keeps the pós-venda stream self-sustaining without manual re-entry)

Conclusão com resumo obrigatório (tasks AND visits)
    └──requires──> new structured summary field/table (recommend: new table, not overloading `historico`)
    └──feeds──> Per-client visit/task "diary" view

Per-client diary view
    └──requires──> Conclusão com resumo obrigatório (both streams)
    └──enhances──> existing client detail view (ClienteDetailSheet)

Campos novos de cliente "ativo" (Nome Fantasia, CNPJ, frequência de pedidos, frequência de visitas)
    └──requires──> a definition of the "ativo" gate/trigger (likely tied to reaching "ganho", to confirm in Discuss)
    └──shares data with──> frequência de visita used by the recurrence engine (same value, not a duplicate — confirm in Discuss/Plan, avoid two sources of truth)

Weekly strip / calendar view (differentiator)
    └──enhances──> Agenda unificada (does not replace the list)

Notificações ativas (anti-feature)
    ╳╳conflicts (already Out of Scope)╳╳ Custo zero de infraestrutura constraint
```

### Dependency Notes

- **Agenda unificada requires both existing `tarefas` and a new `visitas` table:** the milestone's core promise is "no duplicate data entry" for prospecção — this only holds if the unified view is a read-side merge (e.g. a Postgres view/RPC `UNION`-ing two sources), not a data migration of existing tasks into a new shared table. Keep `cards.tarefas` as-is; add `visitas` alongside it.
- **`frequência de visitas` (new client field) likely shares its value with the recurrence set at "ganho":** the milestone text lists them separately ("frequência de pedidos... frequência de visitas") but describes the same underlying concept (visit cadence) twice — once as a field required at "ativo," once as a setting made at "ganho." These are almost certainly the same piece of data surfaced in two places, not two independent settings. Flag explicitly for the Discuss phase to avoid building two fields that can drift out of sync.
- **Conclusão com resumo obrigatório feeds the per-client diary, which is the actual payoff feature for the supervisor:** don't treat the summary field as a minor implementation detail of "mark done" — it's structurally required before the diary/history view (an explicitly requested feature) can exist at all. Sequence accordingly: summary-capture must land before or together with the diary view, never after.
- **Weekly strip/calendar (differentiator) enhances but never replaces the list:** the milestone's own success criterion is "mostrar o que ele precisa fazer, hoje e nos próximos dias" — a list already satisfies this. Don't let calendar-view scope creep into the MVP phase plan.
- **Notificações ativas conflicts with the zero-infra-cost constraint:** already resolved in `PROJECT.md` Out of Scope; re-litigating it inside this milestone would contradict a standing decision without new information.

## MVP Definition

### Launch With (v1.3)

Everything listed under Table Stakes above — this milestone has no meaningful "smaller" version, because the whole point is a *unified* view; shipping only one stream (e.g. prospecção-only) would not deliver the stated goal.

- [ ] Unified today/overdue/upcoming agenda list (both streams) — the entire premise of the milestone
- [ ] Overdue highlighting, reusing the established visual pattern — keeps consistency with the kanban and avoids reinventing a signal that already works
- [ ] Mark-done with required short summary (tasks and visits) — the mechanism that produces the diary; without it the diary has nothing to show
- [ ] Per-client visit/task diary view — the requested payoff for both vendedor and supervisor
- [ ] Frequência de visita set at "ganho," editable/cancelable anytime — required by scope, low complexity, hooks into an existing flow
- [ ] Suggested next-date with confirm/adjust on completion — required by scope; keeps the pós-venda stream self-sustaining
- [ ] Role-scoped visibility (RLS, reusing the existing pattern) — non-negotiable given `CLAUDE.md`'s authorization rule
- [ ] New "ativo"-gated client fields (Nome Fantasia, CNPJ, frequência de pedidos, frequência de visitas) — required by scope; keep them out of the quick-cadastro form

### Add After Validation (v1.x)

- [ ] Quick filters (tipo, cliente, vendedor for supervisor) — add once the list is long enough to need trimming
- [ ] Supervisor per-vendor agenda filter — add once a supervisor actually asks to isolate one vendor's day
- [ ] Item count badge on the nav — cosmetic, add anytime with no dependency risk
- [ ] Export of visit/task history — natural extension of the existing export feature, once the underlying data exists

### Future Consideration (v2+)

- [ ] Compact weekly strip/mini-calendar — only if a flat list proves insufficient once real usage accumulates
- [ ] Single-occurrence reschedule without touching the series — only if the "confirm/adjust at completion" flow proves too coarse in practice
- [ ] Full-text search over summaries — only once the diary has enough history to be worth searching

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Unified agenda list (both streams) | HIGH | MEDIUM | P1 |
| Overdue highlighting | HIGH | LOW | P1 |
| Mark-done with required summary | HIGH | MEDIUM | P1 |
| Per-client diary view | HIGH | MEDIUM | P1 |
| Frequência de visita at "ganho" | HIGH | LOW-MEDIUM | P1 |
| Suggested next-date, confirm/adjust | HIGH | LOW-MEDIUM | P1 |
| Role-scoped visibility (RLS) | HIGH | LOW | P1 |
| New "ativo" client fields | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Quick filters | MEDIUM | LOW | P2 |
| Supervisor per-vendor filter | MEDIUM | LOW | P2 |
| Nav count badge | LOW | LOW | P3 |
| Export visit/task history | LOW-MEDIUM | LOW | P2 |
| Weekly strip/calendar | MEDIUM | MEDIUM | P3 |
| Single-occurrence reschedule | LOW-MEDIUM | MEDIUM | P3 |
| Full-text search over summaries | LOW | LOW-MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.3 launch
- P2: Should have, add once volume/usage justifies it
- P3: Nice to have, revisit only if real usage shows a gap

## Competitor/Pattern Analysis

Not a direct competitor teardown (no named product was evaluated hands-on) — this synthesizes patterns repeatedly observed across mainstream CRM task/activity systems (HubSpot, Salesforce Activities, Zoho CRM Tasks, SuiteCRM recurring tasks) and field-sales cadence guidance, then maps them onto this project's approach.

| Pattern | How mainstream CRMs do it | This project's approach |
|---------|---------------------------|--------------------------|
| Daily prioritization | Weight by deal value/probability/account health (e.g. Salesforce Einstein-style scoring) | Simple date-based ordering (overdue → today → this week) — matches this CRM's existing "visual stalled/overdue" pattern and avoids inventing deal-value data this project deliberately doesn't track |
| Recurrence engine | Configurable rules (daily/weekly/monthly/custom/yearly), edit-one-vs-edit-series options | Fixed four options (semanal/quinzenal/mensal/nenhuma), no series-vs-occurrence distinction at MVP — deliberately narrower to keep the "ganho" step fast |
| Completion → next occurrence | Auto-advance to computed date, editable | Same pattern: suggest, never silently commit — matches spec exactly |
| Reminders | Push/email/SMS as default expectation | Deliberately omitted (Out of Scope) — in-app visual highlighting only, consistent with the zero-infra-cost/no-active-notifications decision already made in v1.0 |
| Notes/summary on completion | Free-text field(s) at the point of closing an activity | Same pattern, single required short-text field — no separate "call log" vs. "task note" split, to keep it to one action |

## Sources

- WebSearch: "B2B CRM agenda task list 'today' prioritized view UX patterns for sales reps" — HubSpot task queue, Salesforce Activities capture, general CRM prioritization-by-deal-value pattern. Confidence: LOW (search synthesis, no primary docs fetched)
- WebSearch: "field sales CRM recurring visit scheduling cadence weekly biweekly monthly best practices" — account segmentation by value/complexity, weekly-lock-in planning pattern. Confidence: LOW
- WebSearch: "CRM activity feed vs calendar view sales rep daily task prioritization design" — calendar-for-when + list-for-what-matters complementary pattern. Confidence: LOW
- WebSearch: "post-sale account management visit cadence CRM feature small sales team" — post-sale cadence baseline (day-1/week-1/month-1 then ongoing), account-level (not contact-level) interaction logging. Confidence: LOW
- WebSearch: "CRM task completion requiring notes visit log call log summary field pattern" — closing-note-at-completion pattern, standard call-log field shapes. Confidence: LOW
- WebSearch: "CRM recurring task auto-suggest next date confirm override UX pattern" — Zoho/SuiteCRM recurring task behavior (auto-advance + editable, occurrence-vs-series choice). Confidence: LOW
- `.planning/PROJECT.md` — this project's own validated requirements, Out of Scope decisions, and Key Decisions (v1.0–v1.2). Confidence: HIGH (primary source, already-shipped and validated by the actual user)

---
*Feature research for: B2B/field-sales CRM agenda + recurring visit scheduling, scoped to CRM Raiar v1.3*
*Researched: 2026-08-07*
