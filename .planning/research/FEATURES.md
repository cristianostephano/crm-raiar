# Feature Research

**Domain:** Calendar view + "completed differently than planned" pattern, for a small-team B2B sales CRM (Agenda screen add-on, v1.5)
**Researched:** 2026-08-17
**Confidence:** LOW-MEDIUM (web-synthesis only; no primary docs fetched, cross-checked across 2+ independent sources per claim where noted)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once a "calendar view" is offered at all. Missing these makes the calendar feel broken or half-built, even for a 2-person-owned tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Toggle between list and calendar on the same screen (not a separate page) | Pipedrive, HubSpot, and every SMB CRM surveyed keep list and calendar as two views over the *same* activity data, switched by a button/icon — never a separate module with its own filters/state | LOW | v1.5 scope already frames it this way ("Alternância Lista ↔ Calendário"); reuse existing Agenda query, don't fork it |
| Day / Week / Month modes with date navigation + "Today" shortcut | Universal across every calendar UI (Pipedrive, Google Calendar-style CRMs); users expect prev/next arrows and a one-click return to today | LOW | Already in v1.5 scope |
| Visual distinction by item type (color/icon) | Pipedrive color-codes by activity type so a rep scans a week and instantly knows "that's a call, that's a task" without opening it | LOW | v1.5 already reuses the existing Prospecção(gray)/Ativo-Visita(blue) coding from the list — correctly avoids inventing a second visual language |
| Overflow handling on dense days (month view) | Pipedrive caps visible items and expects a "view more"-style escape hatch once a day gets crowded; without it a busy Monday becomes visually unreadable | LOW-MEDIUM | v1.5 already specifies "até 3 chips + contador '+N', clique abre a lista completa do dia" — matches the standard pattern exactly |
| Calendar items link back to full detail (not just a label) | Users always expect a chip to be clickable/openable, even on a "read-only" calendar | LOW | v1.5 scope: "clique no dia abre a lista completa" — satisfies this at the day level, which is enough at this item volume (no per-item click-through needed on month view is a reasonable trim, see Anti-Features) |
| Free-text "reason"/summary stays mandatory regardless of completion path | Every CRM outcome-taxonomy pattern found (HubSpot call/meeting outcomes) treats the *reason* as a category, separate from a *notes/description* field — both coexist, neither replaces the other | LOW | Matches v1.5 scope exactly: motivo (categoria) + resumo (texto livre) both required, mirroring how this project's existing Agenda already requires resumo |

### Differentiators (Competitive Advantage)

Features that go beyond copy-pasting a generic calendar, aligned with this project's actual core value (low-friction updating + visibility of what's stuck).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| No time-of-day scheduling — items are date-only, not time-slotted | Table-stakes CRMs (Pipedrive) treat the calendar as a scheduling tool for calls/meetings *with specific times*. This project's Agenda items (prospecção tasks, pós-venda visits) never had a time-of-day to begin with — the existing list is date + urgency, not date + time. Skipping time-of-day avoids inventing a concept (appointment time) the domain never had | LOW (removes complexity, doesn't add it) | Correctly already decided in v1.5 scope ("visão de mês em grid... sem arrastar"); this IS the differentiator — a calendar that's honest about "day-granularity, not hour-granularity" instead of copying a generic scheduling calendar |
| "Conclusão remota" as a first-class alternate completion path that still writes the same diary + still triggers next-visit suggestion | Most CRMs treat "outcome" as bolted onto calls/meetings specifically (HubSpot: separate outcome lists *per activity type*, not a universal "how was this done" flag). This project instead layers one binary (presencial vs remoto) + one Supervisor-editable reason list on top of *any* Agenda item type (task or visit), while guaranteeing the downstream effects (diary entry, next-visit-date suggestion for active clients) are identical either way | MEDIUM | This is the actual novel piece — not found as a pre-built pattern anywhere in the research. Complexity is real but contained: it is a completion-time toggle + a 6th editable list, reusing the diary trigger and `concluir_visita` next-date logic already built in v1.3. Not over-engineering — it directly serves "não foi presencial, mas ainda aconteceu" as a real observable outcome for phone-based sales follow-up |
| Reusing the existing `EditableListTab` component pattern for the 6th list ("Motivos de conclusão remota") | Zero new admin-UI paradigm for the Supervisor to learn; consistent with categoria/produtos/tarefas/perda/frequências | LOW | Direct reuse, not new research — flagged here only to confirm it matches the "table stakes for *this* codebase" bar, same as `motivos_perda` (used for lost-deal reason) is the closest existing analog |

### Anti-Features (Commonly Requested, Often Problematic)

Features that look like natural extensions of "add a calendar" but are the wrong move at this project's scale (a handful of vendedores, low weekly volume, non-technical single owner, core value = minimum friction).

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Drag-and-drop rescheduling on the calendar (Pipedrive-style) | "If I can see it on a calendar, I should be able to drag it to another day" — this is Pipedrive's actual default behavior | Adds real complexity (drag state, optimistic update, collision/undo handling) for a rescheduling need that doesn't clearly exist yet — today's Agenda has no manual "move date" affordance at all, only completion-driven date changes (frequência-based next-visit). Building drag-to-reschedule here would be inventing a new capability, not porting an existing one | v1.5 scope already correctly excludes this ("só visualização, sem arrastar"); if rescheduling-by-hand becomes a real ask later, it's a separate, explicitly-scoped feature request, not a calendar-view side effect |
| Time-of-day / hour-slot scheduling (turning tasks/visits into timed appointments) | Natural next step once you have day/week/month — "why not let me also pick 2pm?" | The domain has never tracked time-of-day (`data_conclusao` is a date, not a timestamp); adding it means a new field, new validation, new UI, and no clear demand — nothing in the existing Agenda, diary, or frequência-visita logic operates on time | Keep items date-only on the calendar, exactly as scoped; if a rep needs to remember "call at 2pm," that's a personal-calendar concern outside this CRM's stated problem (funil discipline, not scheduling) |
| Free-text reason instead of, or in addition to a long custom list, for "conclusão remota" | Feels flexible — "let the vendedor just type why" | Contradicts the project's own established pattern: `motivos_perda` (deal-lost reason) is already a Supervisor-editable enum specifically *because* it needs to be dashboard-aggregable — the exact same logic applies to "why was this remote" (Supervisor likely wants to know "how many completions were phone-only vs in-person" as a metric later) | Categorized list (as already scoped), resumo field absorbs anything list values can't capture — same division of labor as motivo/resumo already used for lost-deal and now completion |
| A generic "activity outcome" system that unifies call outcomes, meeting outcomes, task outcomes, and remote-completion reasons into one big configurable taxonomy (HubSpot-style, per-activity-type outcome lists) | HubSpot's own pattern — outcomes vary by activity type, with per-type admin config | Massive over-engineering for a 2-role, single-supervisor tool with ~5-7 total editable lists today; this project has exactly one completion-reason need right now (remote vs presencial) — building a generalized "outcome type system" to serve a single concrete use case adds abstraction with no second consumer | One flat Supervisor-editable list ("Motivos de conclusão remota") scoped only to the remote-completion checkbox, exactly as already decided in v1.5 |
| Per-item click-through / detail view directly from month-view chips | Feels like it "should" work since day-view and week-view already reuse the existing card | Month view is deliberately a density-first overview (up to 3 chips + "+N"); wiring full detail interactions at that zoom level either forces tiny unreadable click targets or a redundant second detail modal that duplicates the day-drill-down already scoped | Click the day cell to open that day's full list (already scoped) — one level of indirection is enough at this data volume (handful of vendedores, low weekly volume) |
| Notifications/reminders tied to calendar items (e.g. "remind me the day before") | A calendar naturally suggests "notify me about this" | Explicitly already out of scope project-wide ("Notificações ativas... destaque visual no kanban já resolve") — a calendar view doesn't change that reasoning; visual highlighting (already used for atrasado items) does the same job without a notification service/cost | Keep the existing atrasado visual-highlight convention; extend it into calendar chips (e.g. red outline on chip) instead of adding notifications |
| Recurrence editing/creation from the calendar (e.g. "set this visit to repeat every 2 weeks" via a calendar UI) | Calendars conventionally support recurring-event creation | Recurrence already exists as `frequencia_visita`, configured on the client record, not per-calendar-event; re-exposing it as calendar-native recurrence would create two places to edit the same fact and risks desync — explicitly the failure mode this project has avoided before ("frequência de visita... sempre o mesmo valor entre ficha e agenda") | Calendar view stays read-only/display-only for recurrence; frequência editing stays where it already lives (ficha do cliente / Agenda's existing frequency control) |

## Feature Dependencies

```
Calendar view (day/week/month)
    └──requires──> Existing Agenda unified list (already built, v1.3)
    └──requires──> Existing urgency/status color coding (Prospecção/Ativo-Visita, already built)

Month-view chip overflow ("+N")
    └──requires──> Day-drill-down (click day → full list)

Conclusão remota (checkbox + motivo list)
    └──requires──> Existing ConcluirItemDialog.tsx (resumo field, already built)
    └──requires──> New 6th editable list ("Motivos de conclusão remota")
                       └──requires──> Existing EditableListTab component pattern (already built)
    └──requires──> Existing diário trigger (historico table, already built)
    └──requires──> Existing concluir_visita next-date suggestion logic (already built, v1.3, frequência-based)

Conclusão remota ──enhances──> Diário (adds a "how" dimension to each entry, not just "what/when")

Calendar view ──conflicts with──> Drag-and-drop rescheduling (explicitly excluded — view-only, no interaction beyond click/navigate)
Conclusão remota ──conflicts with──> Time-of-day tracking (remote/presencial is orthogonal to timing, no new time field needed)
```

### Dependency Notes

- **Calendar view requires the existing Agenda list:** the calendar is a second projection over the same `agenda_do_vendedor()` data (tasks + visits, urgency-ranked), not a new data source — this keeps RLS/visibility rules (vendedor sees own, supervisor sees team) automatically correct with no new authorization surface.
- **Month-view "+N" requires day-drill-down:** without a way to see the full list for an overloaded day, the "+3 more" chip is a dead end. This is why v1.5 scoped both together rather than "+N" alone.
- **Conclusão remota requires the existing `ConcluirItemDialog.tsx` and diary trigger, not new ones:** the whole point (per the milestone framing) is that remote completion is "conta como conclusão normal" — it must flow through the exact same resumo-required, diary-writing, atomic-next-visit-date path that already exists, with the motivo/checkbox as an additive field, not a parallel completion mechanism. Building a second completion path here would reintroduce the exact inconsistency already flagged as accepted tech debt for the older "conclude from ficha" button (Fase 16) — worth avoiding a third variant.
- **Conclusão remota requires a new 6th editable list, following the `EditableListTab` pattern:** matches the existing `motivos_perda` precedent (categorized reason, Supervisor-managed, dashboard-aggregable later) rather than free text.
- **Calendar view conflicts with drag-and-drop:** deliberately, per v1.5 scope — including it here to make explicit that this is a scope boundary, not an oversight, so it doesn't creep back in during planning.

## MVP Definition

### Launch With (v1.5)

Minimum viable slice — matches what's already scoped in PROJECT.md; nothing additional identified as missing table-stakes.

- [ ] List ↔ Calendar toggle, day/week/month modes, date nav + "Hoje" — core ask, no calendar tool is credible without this
- [ ] Month grid with chips (≤3 + "+N" counter), click-day → full day list — standard density handling, already right-sized
- [ ] Week view (7 columns) and day view (reuses existing list card) — minimum to cover the 3 named modes without inventing new card UI
- [ ] Same Prospecção/Ativo-Visita color coding as list — zero new visual vocabulary
- [ ] View-only calendar (no drag) — correctly avoids inventing a rescheduling feature that doesn't exist elsewhere in the app
- [ ] "Não foi presencial" toggle + motivo dropdown (6th editable list) in the existing completion dialog — the actual point of the milestone
- [ ] Remote completion writes to diário and triggers next-visit-date suggestion identically to in-person completion — non-negotiable per milestone framing ("conta como conclusão normal")
- [ ] Resumo stays mandatory in both completion paths — preserves the one behavior rule that already exists project-wide

### Add After Validation (v1.x)

Only reachable if real usage surfaces a need — not implied by current research.

- [ ] Filter calendar by vendedor (Supervisor view) — likely wanted eventually (list view already has this per-vendedor filter for Supervisor), but not explicitly in v1.5 scope; add if Supervisor asks for it once using the calendar day-to-day
- [ ] Dashboard metric on remote vs presencial completion rate — natural follow-on now that `motivo` is a categorized, aggregable field (mirrors how `motivos_perda` eventually likely feeds dashboard-style reporting), but no such requirement exists yet

### Future Consideration (v2+)

Explicitly not warranted at current scale/maturity — matches the project's own established "Out of Scope" reasoning style.

- [ ] Drag-and-drop rescheduling from calendar — would need a real manual-reschedule use case to justify the complexity; none observed
- [ ] Time-of-day / appointment scheduling — the domain (funil discipline, not calendar booking) has never needed this; matches existing "Calendário completo... fica fora" reasoning already in PROJECT.md's Out of Scope for v1.3
- [ ] Generalized outcome-taxonomy system (per-activity-type outcome lists, HubSpot-style) — one flat list solves the one real need (remote vs presencial); no second use case to justify abstraction yet

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| List ↔ Calendar toggle + 3 modes + nav | HIGH | MEDIUM | P1 |
| Month grid with overflow + day drill-down | HIGH | MEDIUM | P1 |
| Week/day views reusing existing card | MEDIUM | LOW | P1 |
| Conclusão remota toggle + motivo list + dialog change | HIGH | MEDIUM | P1 |
| Remote completion → diário + next-visit-date parity with in-person | HIGH | LOW (reuses existing RPC path) | P1 |
| Calendar filter by vendedor (Supervisor) | MEDIUM | LOW | P2 |
| Dashboard metric on remote vs presencial rate | LOW-MEDIUM | LOW | P3 |
| Drag-and-drop reschedule | LOW (no demonstrated need) | HIGH | P3 / defer indefinitely |
| Time-of-day scheduling | LOW (domain mismatch) | HIGH | Not planned |

**Priority key:**
- P1: Must have for v1.5 launch (== current PROJECT.md scope)
- P2: Should have, add when possible (small, low-risk additions)
- P3: Nice to have, future consideration only if demand appears

## Competitor Feature Analysis

| Feature | Pipedrive | HubSpot | This Project's Approach (v1.5) |
|---------|-----------|---------|----------------------------------|
| Calendar granularity | Day/week/month, full drag-and-drop scheduling with specific times | Timed calendar synced to meetings/calls | Day/week/month, date-only (no time-of-day), view-only — deliberately simpler, matches the domain (tasks/visits were never time-stamped) |
| Multi-type display on calendar | Color-coded chips by activity type, filterable by type | Similar activity-type color coding | Same idea, reuses existing 2-category (Prospecção/Ativo-Visita) coding already in the list — narrower and simpler since this project has 2 categories, not N configurable activity types |
| Overflow on busy days | Not explicitly documented in sources found | Not explicitly documented in sources found | Explicit "+N" chip + click-to-expand — matches general calendar-UI convention (verified independently, not vendor-specific) |
| "Completed differently than planned" outcome | Not modeled as a distinct concept — calls/meetings each get their own outcome dropdown, no cross-cutting "in person vs not" flag | Same — per-activity-type custom outcome lists (up to 30 values), immutable once created for reporting integrity | Single Supervisor-editable list scoped specifically to "conclusão remota," layered onto the existing unified completion dialog for both task types (prospecção + visita) — narrower scope than HubSpot's generalized system, appropriately so for this project's size |
| Outcome-list editability | Not found in sources (Pipedrive activity types are configurable, but no explicit "outcome reason" list surfaced) | Admin-managed, immutable-once-saved outcomes (can delete, not edit) | Follows this project's own existing `motivos_perda`/`EditableListTab` convention (Supervisor CRUD) rather than importing HubSpot's immutability rule — worth a explicit product decision at Discuss-phase whether renamed/deleted motivos should behave like `frequencias_pedido` (rename doesn't propagate to past records, already decided pattern) since that's the more consistent in-house precedent than HubSpot's approach |

## Sources

- WebSearch: "Pipedrive calendar view activities month week day all-day tasks" — pipedrive.com/en/features/activity-calendar, support.pipedrive.com/en/article/calendar-view — vendor-documented feature descriptions (day/week/month toggle, color-coding by type, drag-to-reschedule, type filters, 500-item cap). Confidence: LOW (web-search synthesis, not a fetched primary doc)
- WebSearch: "CRM mark activity done outcome dropdown 'no show' 'call instead'" — knowledge.hubspot.com/calling/create-custom-call-and-meeting-outcomes, community.hubspot.com threads — HubSpot's admin-configurable, per-activity-type outcome list pattern (up to 30 values, immutable once saved). Confidence: LOW
- WebSearch: "CRM activity feed list view vs calendar view when to use small sales team" — general vendor/blog synthesis (Pipedrive, OpenCRM, Snapforce, You Don't Need a CRM) converging on "list = oversight/work queue, calendar = scheduling/coordination." Confidence: LOW (no single authoritative source, but convergent across independent vendors)
- WebSearch: "HubSpot custom meeting outcome types call outcome list editable admin" — knowledge.hubspot.com, insidea.com — confirms admin location (Settings > Objects > Activities), 30-value cap, immutability-after-save rule. Confidence: LOW
- Internal: `.planning/PROJECT.md` (v1.5 milestone scope, existing v1.0-v1.4 requirements and Out of Scope log) — read directly, treated as ground truth for what already exists vs what's newly proposed. Confidence: HIGH (primary project source, not web-derived)

---
*Feature research for: small-team B2B sales CRM — Agenda calendar view + remote-completion pattern (v1.5)*
*Researched: 2026-08-17*
