# Feature Research

**Domain:** CRM internal tool — bulk client import (spreadsheet) and client list export
**Researched:** 2026-07-22
**Confidence:** LOW-MEDIUM (web-synthesis only; no primary vendor docs directly fetched — see Sources)

> Note: This file was fully rewritten for milestone v1.1 (Importação e Exportação de Clientes). It supersedes the prior v1.0 FEATURES.md content (kanban/funnel feature landscape), which is preserved in git history and in `.planning/archive/` if the milestone-completion workflow has run. This research covers ONLY the v1.1 additions.

## Scope Note

This research covers ONLY the v1.1 milestone additions: Supervisor-only recurring bulk import via .xlsx/.csv with column mapping and pre-confirmation duplicate/error review, and role-scoped client list export. It assumes the existing v1.0 schema and RLS model (already built) as given, and calls out explicitly where the **absence of a CNPJ/tax-ID field** in the current client schema changes what's achievable.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any "import a spreadsheet of records" flow. Missing these makes the import feature feel broken or dangerous to use on a recurring basis (this is NOT a one-time migration tool — the Supervisor will run this repeatedly with feira/partner lists).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Downloadable import template (.xlsx/.csv) | Users copying data from partner/feira lists need to know exactly which columns the system expects before they start reformatting a spreadsheet by hand | LOW | Ship as a static file generated from the same Zod schema/column list used for validation, so template and validator never drift apart. Best practice from research: provide both an empty header-only version and a version with one filled example row — avoids users accidentally re-importing the sample row (LOW confidence, web-synthesis) |
| Column mapping screen (header → field) | Real-world spreadsheets from different partners/feiras will never have identical column names/order to the system's fields; forcing an exact header match would make the "recurring use" requirement unusable | MEDIUM | Match by column **label** the user selects, not by column position — this is what makes the template tolerant of reordered/renamed columns. Auto-suggest a mapping when header text closely matches a known field name (e.g. "Razão Social", "Nome da Empresa" → `razao_social`), but always let the Supervisor confirm/override every column, including marking a column as "não importar" |
| Pre-confirmation review screen (errors + duplicates) | The milestone spec explicitly requires "mostrar erros/duplicados antes de confirmar" — users need to see *what will happen* before committing, especially for a bulk operation that's hard to undo cleanly | MEDIUM | Render a preview table: row number, mapped values, and a status per row (OK / needs attention: missing required field, possible duplicate). Do the validation and duplicate-check pass server-side (Server Action) before showing this screen, not just client-side |
| Row-level partial-failure handling (skip bad rows, don't block the whole file) | Research consistently shows this is now the expected default for spreadsheet import tools — an all-or-nothing rejection over one bad row in a 200-row feira list is exactly the "telas ruins, muita fricção" experience this whole CRM project exists to replace | MEDIUM | Confirmed via research (LOW confidence, cross-referenced across 2 independent sources): modern pattern is "ingest valid rows, skip + report invalid rows with a specific reason per row," not the legacy "reject entire file on first error." Recommend: rows failing required-field validation are excluded from the import and listed with a reason; rows that pass validation but look like possible duplicates are held for an explicit per-row decision (import as new / skip / leave to a later phase) rather than auto-skipped |
| Required-field validation matching the existing minimum-cadastro rule | v1.0 already established "cadastro rápido, mínimo obrigatório = razão social + endereço + responsável" for manual entry — import must not silently create clients that violate that same minimum, or the funnel fills with unusable half-empty cards | LOW | Reuse the existing Zod schema used for the manual cadastro form as the single source of truth for what's "required" in the mapping/validation step |
| Assigning `responsavel` (vendedor) per imported client | Every client in this CRM has an owning vendedor for RLS visibility — an imported client with no `responsavel` would be invisible to any vendedor and awkward to fix later at scale | MEDIUM | Since this import is Supervisor-only, the mapping screen needs either (a) a spreadsheet column mapped to vendedor (matched by name/email against existing users) or (b) a single "assign all imported clients to vendedor X" selector for the whole batch. Given feira/partner lists are unlikely to already carry a vendedor column, (b) is the simpler default; support (a) only if a column is actually present. This is a **decision needed before planning**, not something to leave implicit |
| Fixed landing stage ("Aguardando contato") for all imported clients | Already decided in PROJECT.md — removes the need for a "which funnel stage" column/decision in the mapping screen entirely | LOW | No mapping needed for funnel stage; simplifies the template (one less required column) |
| Export respecting the same visibility rule as the funnel (RLS-scoped) | Already decided in PROJECT.md; also confirmed as standard SaaS practice — export must never leak rows a user couldn't already see on screen | LOW-MEDIUM | Build the export query as a server-side read using the *same* RLS-backed query/view already used for the client list (not a new unscoped query), so Vendedor exports only own clients and Supervisor exports all, automatically, with zero new permission logic |
| CSV/Excel encoding and formatting correctness (accents, CNPJ-like numeric strings not truncated, headers on row 1) | Data is Brazilian Portuguese with accented characters (razão social, endereço) — a mis-encoded export (mojibake) or Excel auto-formatting a numeric-looking string (e.g. CEP "01310-000") is a classic recurring complaint that erodes trust in the whole feature | LOW | Use UTF-8 with BOM for CSV exports opened in Excel on Windows (common gotcha with accented PT-BR text); when generating .xlsx directly, this isn't an issue since it isn't plain text |

### Differentiators (Competitive Advantage)

Not required for the milestone to be considered done, but meaningfully reduce friction for the Supervisor doing recurring imports — aligned with the project's Core Value (minimize friction, keep the funnel accurate).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Remembering column mapping between import sessions | Since imports are recurring (not one-time), if the Supervisor gets spreadsheets from the same 2-3 recurring partners, remembering "last time these headers mapped to these fields" saves re-mapping every time | LOW-MEDIUM | Simple: store last-used mapping (by matching header set) in a small table or even browser localStorage; skip if it adds scope risk this milestone |
| "Import as update" path for rows that match an existing client (not just skip/create) | Multi-source research shows this is a common expectation once volumes grow — instead of only flagging a duplicate and skipping it, letting the Supervisor choose to update the existing client's fields from the new row | MEDIUM-HIGH | Explicitly flag as a candidate for a LATER milestone, not v1.1: it interacts with history/audit tracking (already built in v1.0 — "histórico automático de mudanças") and needs its own UX for field-level conflict resolution. Recommend v1.1 duplicate handling = flag + let user choose "skip this row" or "import anyway as a new client," not merge/update |
| Batch metadata/tagging on import (e.g. "origem: Feira X, 2026-07") | Helps distinguish freshly-imported clients from organically-cadastrados ones later, useful for the dashboard/reporting the Supervisor already relies on | LOW | Could piggyback on the existing `observacao` free-text field on the card rather than a new schema field — keeps this out of schema-change territory |
| Export column selection / filtered export (matching current list filters) | v1.0 already has search/filter on the client list (vendedor, categoria, produto, texto livre) — letting export respect the *currently applied filter*, not just full RLS scope, is a natural small extension | LOW | Cheap to add since the filter query already exists; export becomes "download what I'm looking at right now" |

### Anti-Features (Commonly Requested, Often Problematic)

Features that look reasonable to add to an import/export feature but would add real risk or complexity disproportionate to this MVP milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Automatic silent merge/update of "duplicate" clients during import | Feels efficient — "just update the existing record instead of asking" | Silent merges are exactly how CRM data quality erodes: a partner's feira list might have stale/wrong data that would overwrite good data already in a client's card, with no audit trail of what changed or why. Also interacts badly with the existing `historico automático` if not designed carefully | Always require an explicit Supervisor decision per flagged duplicate (or per-batch policy chosen up front), never a silent overwrite |
| Fuzzy/automatic tax-ID-based deduplication | Research shows tax ID (CNPJ) is the gold-standard dedup key in B2B — tempting to "just add it" to solve duplicate detection cleanly | **The current schema has no CNPJ/tax-ID field at all.** Adding one is a schema change (new column, likely unique-ish index, RLS/migration work) that wasn't scoped for this milestone, and retroactively backfilling CNPJ for all existing clients is its own project, not a side effect of an import feature | For v1.1, dedupe on **razão social** (normalized: case-insensitive, trimmed, common suffix variants like "LTDA"/"S.A." treated loosely) as a best-effort "possible duplicate" flag — treat every match as a *candidate for human review*, never an automatic block or automatic merge, precisely because name-only matching has real false-positive/false-negative rates. Flag adding a CNPJ field as a good candidate for a **future milestone** if duplicate detection quality becomes a real pain point |
| Full two-way sync/integration with the old paid CRM via import | Since the team already receives spreadsheets from that CRM, "why not just sync automatically" is a natural ask | Explicitly out of scope per PROJECT.md ("Integração contínua (sync/API) com o CRM pago atual") — the goal is to replace it, and a live sync reintroduces the exact ongoing cost/complexity this MVP is trying to avoid | One-off manual export-from-old-CRM → import-into-new-CRM via the same spreadsheet flow being built here; no live integration |
| Letting Vendedor use bulk import too | Feels like a small permission tweak once the Supervisor-only version exists | Explicit decision already made in PROJECT.md — restricted to Supervisor this version, "decisão explícita do dono do projeto." Also, a Vendedor-scoped import would need its own visibility/assignment rules (can a vendedor assign imported clients to someone else?) that haven't been discussed | Keep Supervisor-only for v1.1; revisit only if the Supervisor reports it's a bottleneck |
| Real-time progress/streaming UI for huge imports (progress bar, background job queue) | Feels necessary for "enterprise-grade" bulk import | At free-tier data volumes (hundreds of clientes, not tens of thousands per PROJECT.md constraints) and feira/partner list sizes (likely dozens to low hundreds of rows), a synchronous request/response with a spinner is enough; a background job queue would need infrastructure (a queue, worker) that breaks the zero-infra-cost constraint | Handle the whole import (parse → validate → dedupe-check → confirm → write) as a single Server Action call; only revisit if real usage shows files large enough to hit request timeouts |
| Accepting arbitrary file formats (PDF tables, Google Sheets links, images of spreadsheets) | Partners might send data in any format they have on hand | Massively expands parsing complexity and attack surface for very little marginal benefit — CLAUDE.md already scopes this to "planilha (Excel/CSV)" | Support .xlsx and .csv only, as scoped; ask the Supervisor to save/export other formats to one of those two before importing |

## Feature Dependencies

```
Downloadable import template
    └──requires──> Fixed schema of importable fields (already exists from v1.0 cadastro)

Column mapping screen
    └──requires──> Downloadable import template (defines the field vocabulary the mapping targets)

Pre-confirmation review screen (errors + duplicates)
    └──requires──> Column mapping screen (need mapped values before validating/checking dupes)
    └──requires──> Duplicate-detection rule (razão social match, this milestone)

Row-level partial-failure handling
    └──requires──> Pre-confirmation review screen (surfaces which rows fail, before commit)

Assigning responsavel per imported client
    └──requires──> Column mapping screen (either a mapped column or a single batch-wide selector)

Fixed landing stage "Aguardando contato"
    └──enhances──> Column mapping screen (removes one required column/decision entirely)

RLS-scoped export
    └──requires──> Existing RLS policies from v1.0 (already built — no new permission logic needed)

Export column/filter selection (differentiator)
    └──enhances──> RLS-scoped export (reuses existing list-filter query)

Import-as-update / merge duplicates (deferred)
    └──conflicts──> Silent/automatic dedup merge (anti-feature) — if ever built, must remain an explicit per-row human decision, never automatic

CNPJ-based dedup (deferred, future milestone)
    └──requires──> New `cnpj`/tax-ID column + migration (schema change, not in this milestone's scope)
```

### Dependency Notes

- **Pre-confirmation review requires Column mapping**: you cannot validate or flag duplicates against system fields until raw spreadsheet columns are mapped to those fields — mapping must be a prior step (and prior phase, if split across phases in the roadmap).
- **Row-level partial-failure handling requires the review screen**: skip-vs-import decisions need somewhere to be surfaced and (for duplicates) explicitly confirmed by the Supervisor — this can't be a silent background behavior per the "anti-features" analysis above.
- **Assigning `responsavel` requires a decision, not just code**: this is a genuine open question not yet answered in PROJECT.md (batch-wide assignment vs. per-row column) and should be raised explicitly in the Discuss phase before planning the import feature, since it changes both the mapping screen's shape and the template's column list.
- **CNPJ-based dedup conflicts with this milestone's scope**: it requires a schema/migration change not currently planned; flagged as a natural v1.2+ candidate rather than something to sneak into v1.1's import work.
- **Export column/filter selection enhances but does not require** rebuilding RLS logic — it's a UI layer on top of the query that already respects visibility rules.

## MVP Definition

### Launch With (v1.1 — this milestone)

- [ ] Downloadable .xlsx/.csv template (empty + one sample row) matching the existing client cadastro fields — needed so Supervisor spreadsheets can be prepared consistently
- [ ] Column mapping screen matching by header label with manual override, "não importar" option per column — needed because real partner/feira spreadsheets won't match the template header-for-header
- [ ] Server-side validation reusing the existing minimum-required-fields rule from manual cadastro — needed to keep import-created clients as usable as manually-created ones
- [ ] Duplicate flagging by normalized razão social match, surfaced (not blocked) before confirmation — needed per explicit milestone requirement ("mostrar duplicados antes de confirmar"), acknowledging name-only matching's known limitations
- [ ] Pre-confirmation review screen showing per-row status (OK / error / possible duplicate) with reasons — needed per explicit milestone requirement
- [ ] Row-level skip on validation failure (bad rows excluded, good rows still import) rather than all-or-nothing — matches the "mínimo de fricção" Core Value and modern import UX norms
- [ ] Explicit decision + UI for assigning `responsavel` to imported clients (batch-wide selector as the simple default) — needed because every client requires an owning vendedor for RLS to work
- [ ] All imported clients land in "Aguardando contato" (already decided, no mapping work needed) — reduces template/mapping surface
- [ ] RLS-scoped client list export (Vendedor = own clients only, Supervisor = all) — needed per explicit milestone requirement, and cheap since it reuses existing RLS

### Add After Validation (v1.x)

- [ ] Remembering/reusing column mappings across import sessions for the same recurring partner spreadsheet — add once real usage shows the Supervisor re-mapping the same headers repeatedly
- [ ] "Import as update" option for flagged duplicates (instead of only skip/import-anyway) — add once the Supervisor reports genuinely needing to refresh existing client data via re-import, and only alongside a clear field-level conflict UI
- [ ] Export respecting the currently-applied list filters (not just full RLS scope) — small, cheap addition once the base export ships and is validated
- [ ] Batch-level import metadata/tagging (source, date) reusing the existing `observacao` field — add if the Supervisor wants to distinguish imported vs. manually-cadastrado clients later

### Future Consideration (v2+)

- [ ] Adding a CNPJ/tax-ID field to the client schema, enabling high-confidence automatic deduplication — defer until duplicate false-positive/false-negative rate on razão-social matching becomes a real, reported pain point; this is a schema change with migration and RLS implications, not an import-feature tweak
- [ ] Background job/queue for very large imports with progress UI — defer unless real files start hitting request timeouts at free-tier hosting limits
- [ ] Vendedor-level bulk import — explicitly deferred by project owner decision; revisit only if raised again

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Downloadable import template | HIGH | LOW | P1 |
| Column mapping screen | HIGH | MEDIUM | P1 |
| Pre-confirmation review (errors + duplicates) | HIGH | MEDIUM | P1 |
| Row-level partial-failure handling | HIGH | MEDIUM | P1 |
| Responsavel assignment on import | HIGH | MEDIUM | P1 |
| Fixed landing stage | MEDIUM | LOW | P1 (already decided) |
| RLS-scoped export | HIGH | LOW-MEDIUM | P1 |
| Remembered column mappings | MEDIUM | LOW-MEDIUM | P2 |
| Filtered export (matches list filters) | MEDIUM | LOW | P2 |
| Import-as-update for duplicates | MEDIUM | HIGH | P3 |
| Batch import tagging/metadata | LOW-MEDIUM | LOW | P3 |
| CNPJ field + automatic high-confidence dedup | HIGH (long-term) | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add when possible after validation
- P3: Nice to have, future consideration

## Competitor / Reference Pattern Analysis

No direct competitor products were evaluated (this is an internal tool replacing a named paid CRM, not a market entrant); instead, general CRM/data-tool import-export conventions were used as the reference pattern, since row-for-row competitor UX review wasn't the goal.

| Pattern | How well-known CRM/data-import tools handle it | Our approach |
|---------|--------------------------------------------------|--------------|
| Column mapping | Match by header label with manual override and auto-suggestion (seen across HubSpot-style and generic CSV-import-wizard products) | Same: label-based mapping with override, per PROJECT.md's explicit "tela de mapear colunas" requirement |
| Duplicate handling | Ranges from strict unique-identifier matching (when a tax ID/email exists) to multi-field fuzzy matching with confidence tiers | Given no CNPJ field exists yet, use razão-social-based flagging as a "candidate for review," explicitly not an automatic block — closer to the "medium-confidence, route to human" tier described in general dedup research |
| Partial failure | Increasingly "skip and report bad rows" instead of all-or-nothing (modern pattern); some legacy tools still reject the whole file | Adopt skip-and-report — aligns with this project's Core Value of minimizing friction |
| Export scoping | Best-practice is exports must never exceed what the same user could see on-screen | Directly reuse existing v1.0 RLS-backed client list query for export — no new permission logic, per PROJECT.md's own stated decision |

## Sources

- WebSearch: "CRM bulk spreadsheet import UX best practices column mapping duplicate detection" — synthesized from Dynamics 365, HubSpot, and general CSV-import-wizard guidance articles. Confidence: LOW (web synthesis, no primary docs fetched)
- WebSearch: "CSV import wizard partial failure handling skip invalid rows vs block entire import UX pattern" — CSVBox, Dromo, Oracle B2C Service docs referenced. Confidence: LOW
- WebSearch: "deduplication key company name vs tax id import matching best practices B2B data import" — Insycle, Datamondial, Crustdata articles. Confidence: LOW
- WebSearch: "downloadable CSV import template best practices required vs optional columns example row" — Dromo, CSVBox, NetSuite/Sage Intacct import docs. Confidence: LOW
- WebSearch: "export CSV Excel row-level access control scoped export best practices SaaS" — Salesforce/Power BI/SAP export-guidance articles. Confidence: LOW
- WebSearch: "SheetJS xlsx npm parsing CSV Excel Next.js Server Action best practices 2026" and "react csv export library client-side generate xlsx download 2026" — library landscape confirmation for STACK.md cross-reference. Confidence: LOW
- `.planning/PROJECT.md` — authoritative source for this milestone's explicit scope, decisions already made (Supervisor-only import, fixed landing stage, RLS-scoped export), and Out of Scope items. Confidence: HIGH (primary internal source)
- `.claude/CLAUDE.md` and `.claude/gsd-core`-generated STACK.md — confirms existing schema has no CNPJ/tax-ID field, confirms existing RLS/role model and existing cadastro validation rules to reuse. Confidence: HIGH (primary internal source)

**Note on overall confidence:** all external findings here are LOW confidence per this project's source hierarchy (WebSearch synthesis, not primary vendor documentation or cross-verified against an authoritative source). The patterns found are broadly consistent across multiple independent searches (not contradictory), which is a mild positive signal, but none should be treated as authoritative — they inform sensible defaults, not hard requirements. The internal-source findings (schema, existing decisions) are HIGH confidence since they come directly from this project's own planning documents.

---
*Feature research for: CRM internal tool — bulk import/export milestone (v1.1)*
*Researched: 2026-07-22*
