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


---

# Milestone Addendum: v1.2 Gestão de Equipe, Análises de Funil e Filtros

**Domain:** Small-team B2B sales CRM (funil/kanban) — targeted additions for milestone v1.2
**Researched:** 2026-07-25
**Confidence:** MEDIUM overall — codebase-specific findings are HIGH confidence (read directly from `supabase/migrations/*.sql` and `components/clientes/*`); comparable-tool behavior (Pipedrive/HubSpot patterns) is LOW-confidence web synthesis per the `classify-confidence` seam, though cross-checked across multiple independent sources (Pipedrive's own support docs + HubSpot's own support docs + HubSpot community threads agreeing with each other)

> Note: This file was fully rewritten for milestone v1.2 (Gestão de Equipe, Análises de Funil e Filtros). It supersedes the prior v1.1 FEATURES.md content (bulk import/export feature landscape), which is preserved in git history and in `.planning/archive/` if the milestone-completion workflow has run. This research covers ONLY the v1.2 additions.

This is not a general domain survey — v1.2 is six targeted additions to an already-shipped CRM. Every finding below is scoped to how each feature interacts with the **existing** data model: `profiles` (role enum, no `ativo` column yet), `clientes` (the funnel card itself — `etapa_funil` enum, `status_acompanhamento_enum`, `responsavel uuid not null references profiles(id)`, no `on delete` clause), `historico` (auto-populated audit trail, `autor_id references profiles(id)`, no `on delete` clause), and the three dashboard RPCs already shipped in `0003_dashboard_aggregates.sql` (`dashboard_clientes_por_etapa`, `dashboard_ganhos_perdidos`, `dashboard_desempenho_vendedor`).

## Feature Landscape

### Table Stakes vs Differentiator — Quick Categorization

| # | Feature | Category | Why |
|---|---------|----------|-----|
| 1 | Deactivate team member + forced reassignment + last-Supervisor guard | **Table stakes** | Every SaaS CRM with roles (Pipedrive, HubSpot, monday.com) offers exactly this triad — deactivate, force-reassign owned records, block removing the last admin. Missing it is a glaring gap once a team member ever leaves |
| 2 | Detailed per-stage funnel chart (count / %-advance / drop-off / avg time-in-stage) | **Table stakes for a paid-CRM replacement** (this milestone's explicit goal), differentiator relative to a bare MVP | v1.0 already ships a "clientes por etapa" bar chart (a snapshot); this is the deeper Pipedrive/HubSpot-style "funnel report" the team is used to from the tool being replaced |
| 3 | Avg days-to-win / avg days-to-loss KPIs | **Table stakes**, cheap extension of #2 | Standard "deal age at close" metric in every sales dashboard; low marginal cost because it reuses the same historico-reconstruction query shape already proven in `dashboard_ganhos_perdidos` |
| 4 | Per-vendedor leaderboard/comparison table (Supervisor-only, no money) | **Table stakes**, extension of an existing RPC | `dashboard_desempenho_vendedor` already groups ganho/perdido by `responsavel` — this item adds columns (conversão, iniciados, ciclo médio) onto a pattern that already exists |
| 5 | Kanban column fixed-height independent scroll | **Table stakes / bug fix** | Every kanban tool (Trello, Jira, Pipedrive board view) scrolls columns internally; an infinitely-tall page with 200-300 cards is a known usability failure, not a competitive differentiator |
| 6 | Estado (UF select) before Cidade, Cidade cascading from Estado | **Table stakes / data-quality fix** | Free-text state/city fields are a classic "looks fine with 10 rows, breaks at 200" trap; UF-then-cidade is the standard Brazilian address-form pattern |

None of the six are differentiators in the sense of "sets this CRM apart from competitors" — they close gaps relative to the paid tool being replaced, or fix bugs in what already shipped. That changes how they should be prioritized: none can be safely deferred to "add after validation" the way a brand-new differentiator could, since the milestone's whole premise (`PROJECT.md`) is that these are the specific gaps blocking cancellation of the paid CRM.

---

### Item 1 — Deactivate team member (reassign clients, last-Supervisor guard)

**Standard behavior (Pipedrive/HubSpot, cross-checked):** On deactivation, the admin UI shows a summary of everything the user owns (deals/contacts/activities) and **requires** picking a replacement owner as part of the deactivation flow — it's not a separate optional cleanup step. Pipedrive explicitly documents a "manage items assigned to deactivated users" screen for stragglers. Both tools warn against blindly reassigning **closed/historical** items along with open ones, because it skews reporting attribution for the new owner.

**Complexity: MEDIUM-HIGH.** This is the only one of the six that touches auth, RLS, and cross-row data integrity simultaneously.

**Edge cases specific to this app's schema:**
- `profiles` has **no `ativo` column today** — needs a new migration. The exact soft-delete convention already exists on `categorias`/`produtos_consumidos`/`tipos_tarefa`/`motivos_perda` (`ativo boolean not null default true`) — reuse that pattern rather than inventing a new one.
- `clientes.responsavel uuid not null references profiles(id)` has **no `on delete` clause** (default RESTRICT), and so does `historico.autor_id references profiles(id)`. This means: (a) hard-deleting a `profiles` row is structurally blocked by FK integrity the moment that person has ever owned a cliente or authored a historico row — soft-delete via `ativo=false` is not just a UX preference here, it's close to the only option that doesn't fight the schema; (b) the milestone's "deactivated user keeps appearing correctly attributed in historical records" requirement is satisfied close to automatically, since `historico.autor_id` keeps pointing at the still-existing (just inactive) profiles row.
- `is_supervisor()` (the SECURITY DEFINER helper every RLS policy in the app depends on) currently checks only `role = 'supervisor'`, **not** `ativo`. It must be extended to `role = 'supervisor' and ativo = true`, or a deactivated Supervisor's still-valid session keeps every write permission until they happen to log out.
- Flipping the DB flag does **not** invalidate an already-issued Supabase Auth session/JWT. Two options to resolve in the Discuss phase: (a) RLS + middleware gate only — every policy that already checks role also checks `ativo`, and a server-side check redirects an `ativo=false` session to a "conta desativada" screen; cheapest, no new Edge Function. (b) Also call `auth.admin` (mirroring `supabase/functions/invite-user/index.ts`'s existing service-role pattern) to kill the session immediately. Recommend (a) as sufficient for MVP — RLS is already the app's enforced authorization boundary per `CLAUDE.md`, and (b) only becomes necessary if "instant logout" turns into a real requirement.
- The last-active-Supervisor guard is a **cross-row invariant** (`count(*) from profiles where role='supervisor' and ativo=true` must stay > 0 after the flip) — this can't be expressed as a single-row CHECK constraint; it needs to live inside the deactivation RPC as an explicit guard, the same class of decision the `supabase-conventions` skill already flags for RLS-vs-RPC-vs-CHECK. "A Supervisor can deactivate another Supervisor" means the guard counts every active supervisor, not just excludes the target from a self-only check.
- The "transfer to" picker in the UI must exclude both the user being deactivated and any already-inactive users — only active team members are valid reassignment targets.
- **Tarefas have no separate owner field** — `tarefas` only has `cliente_id`, no vendedor column. "In-flight tasks assigned implicitly via the client" resolve automatically the moment `clientes.responsavel` is reassigned; this needs zero new code, it's a direct consequence of the existing 1:1 clientes-is-the-funnel-card model. Same is true for `cliente_produtos` and `historico` access — every RLS policy on those tables is gated through `EXISTS (... clientes c WHERE c.responsavel = auth.uid() OR is_supervisor())`, so reassigning the parent `clientes.responsavel` transfers access to all child rows for free.

**Flag for Discuss phase — the one open product decision that has a real downstream cost:** should bulk reassignment during deactivation move **all** of that vendedor's clientes (including already `ganho`/`perdido` ones) to the new owner, or **only** the still-`em_andamento` ones? Pipedrive's own guidance explicitly warns against reassigning closed deals — doing so here would retroactively change who "owns" a won/lost deal for dashboard purposes, because `dashboard_desempenho_vendedor` (and the new Item 4 leaderboard) group by `clientes.responsavel`, which has no separate "who worked this deal historically" field once reassigned. Recommend reassigning **only** `status_acompanhamento = 'em_andamento'` clientes; leave `ganho`/`perdido` clientes pointed at the (now-inactive) original vendedor so Items 3/4's historical numbers stay accurate — see the direct dependency noted in Item 4 below.

**Anti-features to avoid:** hard-deleting the `auth.users`/`profiles` row (blocked by FK integrity anyway, and destroys the audit trail); silently reassigning closed clientes to the successor (see above).

---

### Item 2 — Detailed funnel/pipeline conversion chart

**Standard behavior:** Waterfall/funnel-style chart, one bar per stage, with count + conversion % to the next stage. HubSpot/Pipedrive both frame this as a "funnel report."

**Complexity: MEDIUM.** No new tables needed (reuses `historico`), but the query logic is meaningfully more involved than the existing `dashboard_clientes_por_etapa` snapshot.

**Key modeling decision specific to this schema:** because a `clientes` row IS the funnel card (no separate opportunity/deal entity, only one live `etapa` column), "how many deals reached stage N" has two very different possible definitions:
- **(a) Current snapshot** — `count(*) where etapa = N` (already exists as `dashboard_clientes_por_etapa`). This alone cannot produce "% advancing to next stage" — it only tells you where things sit *today*.
- **(b) All-time "ever reached this stage"** — reconstructed from `historico` rows where `tipo = 'etapa'` (already recorded, `descricao` follows the fixed format `Etapa alterada para "%s"` written only by `clientes_after_update_historico()`, matched with the same ILIKE-on-fixed-format-string technique `dashboard_ganhos_perdidos` already uses). This is the correct basis for a real funnel — (a) alone undercounts every stage a cliente has since moved past.

**Skip-stage handling (verified — HubSpot's own community consensus):** a deal that jumps directly from stage 2 to stage 5 is "invisible" in reports that only count direct N→N+1 transition events — a stage 2→3 conversion report would wrongly show 0% for that deal. Recommendation for this app: define "advanced past stage N" as *"clientes.etapa's ordinal position > N, OR historico shows it ever reached ordinal > N"* — NOT "historico shows a direct N→N+1 transition." This is the specific bug HubSpot's own community flags and it's avoidable here because `etapa_funil` is an ordered enum, so ordinal comparison is cheap.

**Backward-move handling:** `mover_card_funil` has **no constraint preventing a card from regressing** to an earlier etapa (only the `ganho`/`primeira_venda` and `perdido`/`motivo_perda_id` CHECK constraints exist) — a card genuinely can move backward. For "avg time-in-stage," use consecutive pairs of `historico` 'etapa' rows (a `LEAD()` window per cliente, ordered by `criado_em`, duration = next row's `criado_em` minus this row's, bucketed by the etapa the interval started in). If a cliente visits stage N twice (regressed then re-advanced), recommend **summing** both visits' durations rather than keeping only the latest — that's the operationally meaningful "how long has this deal actually sat at stage N in total" number, and it's the simpler query.

**Still-open cards in the average:** for the CURRENT stage (no "next" historico row yet), duration = `now() - etapa_alterada_em` (already a column on `clientes`, no historico join needed for this tail case). Recommend **including** this in-progress duration in the average rather than only counting fully-completed visits — excluding it creates survivorship bias (the slowest-moving cards are exactly the ones still sitting there, and would be silently dropped from "avg time in stage"). This mirrors how the existing FUN-09 "cards parados" highlight already computes `diasParado()` off the same `etapa_alterada_em` column for still-open cards — same convention, no new concept.

**Drop-off attribution:** `motivo_perda_id`/`status_acompanhamento='perdido'` are recorded on the current row only, and a card is frozen once perdido (no further moves happen per the existing workflow) — so "drop-off at stage N" = `count(*) where status_acompanhamento='perdido' group by etapa`, a plain query against `clientes` with no historico reconstruction needed. Only the stage-to-stage advance and time-in-stage metrics need the harder historico-based math.

**Genuine simplification:** the milestone explicitly excludes a date-range filter for this chart (`PROJECT.md` Out of Scope) — every query here can be an unbounded `WHERE` with no `p_inicio`/`p_fim` params, unlike `dashboard_ganhos_perdidos`/`dashboard_desempenho_vendedor`/`dashboard_prospeccao_por_*`, which all take a period. Less surface area than the existing dashboard RPCs, not more.

---

### Item 3 — Avg days-to-win / avg days-to-loss (separate KPIs)

**Standard behavior:** "average deal age at close" = close date − created date, computed only over closed deals (won or lost), never blended with still-open ones.

**Complexity: LOW-MEDIUM** — this is a near-direct variant of an *already-tested* query, not new design. Start date = `clientes.criado_em`. End date is **not** a column on `clientes` — it requires the same `distinct on (cliente_id) ... where tipo='status_acompanhamento' and descricao ilike '%"ganho"%'/'%"perdido"%' order by criado_em desc` reconstruction already proven correct in `0003_dashboard_aggregates.sql`'s `dashboard_ganhos_perdidos`.

**Edge cases:**
- The milestone requires the two KPIs "separadamente, não combinada" — implement as two independent AVG() branches (or one function returning two columns), never a blended "avg days to close."
- A cliente can flip status more than once (`em_andamento → perdido → em_andamento → ganho` is explicitly allowed by the schema, and `dashboard_ganhos_perdidos`'s own comment calls out the double-counting risk this creates) — reuse the SAME guard `0003` already implements: only count a historico status-change event if `clientes.status_acompanhamento` today still matches that event's status. Direct reuse of an established, already-tested pattern, not new design risk.

---

### Item 4 — Per-vendedor leaderboard/comparison table (Supervisor-only, no money)

**Standard behavior (cross-checked):** keep leaderboards to a small number of headline metrics — literature explicitly warns that overcomplicating with a single weighted/composite score kills the motivational effect; show raw metrics side by side instead. One source flags that for teams under ~5 reps, granular win-rate-style rep comparisons can read as awkward rather than motivating — worth surfacing to the project owner as a framing/tone note (e.g., present as "visão geral do time" rather than a ranked scoreboard, default sort by name not by rank) but **not** a reason to drop a feature the milestone explicitly requires.

**Complexity: LOW-MEDIUM** — `dashboard_desempenho_vendedor` already groups ganho/perdido by `responsavel`; this item adds columns onto the same query, it isn't new territory:
- **"Deals started"** = `count(*) where responsavel = X` (all-time, no historico needed — plain count).
- **"Deals won"** already exists in the current RPC's shape.
- **"Avg sales cycle length"** = the same LEAD()/historico-diff math as Item 3, grouped by `responsavel` instead of globally. Needs one product decision: won-only (the classic "sales cycle length" definition) vs. won+lost combined — recommend **won-only**, keeping days-to-loss as Item 3's separate KPI rather than conflating the two here.
- **No monetary columns** is trivially satisfied — the schema has **no** value/R$ field on `clientes` at all, so this isn't a restraint decision, it's structurally impossible without a new column. Reinforces it's correctly out of scope, not an oversight.

**Direct cross-item dependency (the one the downstream consumer specifically asked about):** this item's historical accuracy depends entirely on how **Item 1**'s reassignment scope is decided. If Item 1 reassigns *all* of a departed vendedor's clientes (including closed ones) to their successor, the successor's leaderboard row silently absorbs historical wins/losses/cycle-length they never actually worked, and the departed vendedor's historical contribution disappears from the leaderboard entirely — the exact mistake Pipedrive's own documentation warns against. Item 1's recommendation (reassign only `em_andamento` clientes, leave closed ones pointed at the inactive original vendedor) is what keeps this item's numbers correct. **Sequencing implication:** Item 1's reassignment-scope decision should be locked before Item 4 is planned in detail, since Item 4's query design assumes one answer or the other.

---

### Item 5 — Kanban column independent scroll, fixed height

**Standard behavior:** board container height = viewport minus header; each column is a fixed/capped-height flex column; column header (title + count badge) stays pinned, only the card list scrolls internally (`overflow-y-auto`) — never the whole page. Every mainstream kanban tool (Trello, Jira, Pipedrive's own board view) works this way.

**Complexity: LOW** — this is a CSS/layout fix to `components/clientes/KanbanBoard.tsx`, not new business logic. The current bug is precise and already located: the board wrapper is `flex flex-1 gap-4 overflow-x-auto pb-2` (horizontal scroll only, no vertical cap), and each column's card-list div is `flex min-h-10 flex-col gap-2` with **no max-height or overflow set** — that's the literal source of the infinite-page bug, present identically in both the drag-enabled (`DndContext`/`DroppableColumn`) and the drag-disabled/filtered-view render branches of this component (two code paths need the same fix, not one).

**Edge cases specific to the existing implementation:**
- `@dnd-kit`'s `useDroppable`/`useSortable` need to keep working with an internally-scrolling container. dnd-kit supports auto-scroll on scrollable containers, but the current `DndContext` has no explicit scroll-container configuration — worth a specific verification step during implementation so dragging a card near the bottom edge of a long column auto-scrolls *that column*, not the page (or fails to scroll at all).
- The fixed-height wrapper needs to go on the **outer** column div (header + list together), with `overflow-y-auto` scoped specifically to the card-list div — so the sticky header with its count badge stays visible while scrolling through 200-300 cards, rather than scrolling away with the list.
- Both empty-state messages ("Nenhum cliente nesta etapa" and the global "Nenhum cliente encontrado com esses filtros") need to still render sensibly inside a now-fixed-height column.

**No dependency on any other item** — safe to build and ship in isolation, in parallel with anything else in the milestone.

---

### Item 6 — Estado (UF select) before Cidade, Cidade cascading from Estado

**Standard behavior (cross-checked):** UF is a fixed 27-item select (26 states + DF) keyed by the 2-letter abbreviation; cidade options are then filtered by the chosen UF. Community Brazilian datasets (e.g. IBGE municipality-to-UF mappings) exist as static offline JSON, avoiding a live external API — which matches this project's zero-infra-cost / no-new-external-service constraint.

**Complexity: MEDIUM** — touches four surfaces: cadastro form, edição (detail sheet) form, `FiltersPopover.tsx`, and the import wizard's column mapping/validation.

**Edge cases specific to this schema:**
- `clientes.estado`/`clientes.cidade` are currently plain `text not null` columns with **no enum or FK constraint** (`0002_clientes_and_funil.sql`). Enforcing "fixed 27-item UF list" purely in the frontend (a zod enum) leaves the RPC/import path unprotected; adding a Postgres CHECK constraint on `estado` would mirror the discipline already used for `chk_ganho_somente_etapa_final`/`chk_perdido_exige_motivo` and close that gap — worth raising as a scope question for Discuss.
- **The real hidden cost of this item:** existing production `clientes` rows were entered as free text and may already contain non-standard values (lowercase, full state names instead of "SP", typos). A CHECK constraint cannot be safely added until those rows are audited/cleaned, or it will either fail to apply or the existing bad rows will violate it silently depending on how the migration is written. This is the single biggest edge case in the whole milestone and should be flagged explicitly in Discuss/Plan for Item 6, likely as its own small data-cleanup step sequenced early (more free-text drift accumulates every day the fix is delayed).
- `estadoOptions` in `KanbanBoard.tsx` today is **derived from the already-loaded card set** (`Set` of distinct `estado` values actually present, per the file's own comment explaining there's "no separate full-catalog lookup table for estado"). Once estado becomes a fixed enum, this derivation can be **deleted entirely** in favor of a static 27-item constant — a genuine simplification, not just a swap.
- Cidade becoming "a select whose options are dynamically derived from the selected Estado's **existing client records**" (the milestone's own wording — not the full ~5,570-municipality IBGE dataset) means no new lookup table is needed: a plain `DISTINCT cidade WHERE estado = X` derivation over `clientes`, matching the same "derived from own data" pattern already used for `estadoOptions` and `vendedorOptions` in `KanbanBoard.tsx` today. Must handle the **zero-options case** (a UF with no clientes registered yet — e.g., the first cliente ever in a brand-new state) with either a free-text fallback for cidade or a clear "digite a cidade" affordance; a cascading select with zero options is a dead end for first-time cadastro in a new state.
- `FiltersPopover.tsx` currently renders Cidade (free-text `Input`) **before** Estado (`Select`) — the milestone's reordering is a JSX prop-order change in an existing component, not new state shape (`ClienteFiltros` already has both fields).
- **Import path:** `importar_clientes_lote` (migrations 0004-0006) currently accepts estado/cidade as whatever free text the spreadsheet contains. Bringing UF validation to import means either (a) validating each row's estado against the fixed list during the existing OK/erro/duplicado row-classification review screen already built in v1.1, reusing that UI rather than building new error handling, or (b) leaving import lenient and only enforcing the fixed list in manual cadastro/edição. Recommend (a) for consistency — if the CHECK constraint above is added, the RPC's INSERT would reject bad rows regardless, so import-time validation is really about surfacing that error nicely in the existing review screen instead of a generic bulk failure.

**No dependency on Items 1-5** — independent of the team-management and dashboard work.

---

## Feature Dependencies

```
Item 1 (deactivate + reassign)
    └──produces a scope decision that──> Item 4 (leaderboard)
         (reassign only em_andamento clientes, keep closed ones on the
          original — now inactive — responsavel, so Item 4's historical
          numbers stay accurate)

Item 2 (funnel chart: per-stage historico duration math)
    └──shares underlying query shape with──> Item 3 (days-to-win/loss)
                                          └──> Item 4 (avg cycle length column)
    (all three differ only in GROUP BY dimension — by etapa, globally, or
     by responsavel — over the same historico enter/exit-event math;
     recommend one shared SQL helper/CTE rather than three one-off queries)

Item 5 (kanban column scroll) ──independent── no shared code with any other item
Item 6 (estado/cidade cascade) ──independent── no shared code with any other item,
    but has its own internal soft-dependency: a data-cleanup/audit pass over
    existing free-text estado values should happen before a CHECK constraint
    is added
```

### Dependency Notes

- **Item 1 → Item 4:** the leaderboard's "deals won/lost" and "avg cycle length" columns are computed by grouping on `clientes.responsavel`. If Item 1's deactivation RPC reassigns *closed* clientes along with open ones, Item 4's historical numbers for both the departed and the inheriting vendedor become wrong the moment a deactivation happens. This should be locked as a decision in Item 1's plan before Item 4 is planned in detail.
- **Items 2/3/4 share duration math:** all three need "how long did this cliente spend between two historico events" computed from `historico` rows filtered/paired by `criado_em`. Building this once (e.g. a `stage_durations` or `status_durations` SQL view/CTE parameterized by grouping dimension) avoids three near-duplicate window-function queries and keeps the "sum both visits if a card regressed and came back" rule consistent across all three metrics rather than accidentally diverging.
- **Items 5 and 6 are safe to sequence anywhere** relative to 1-4, including in parallel — no shared files, no shared query logic, no shared schema changes.

## MVP Definition

This milestone has no traditional "MVP vs. defer" split — all six items are the committed scope of v1.2 per `PROJECT.md`. The relevant boundary is what's explicitly already excluded:

### In Scope for v1.2 (all six, no partial-ship split recommended)

- [ ] Item 1 — Deactivate team member with forced reassignment + last-Supervisor guard — essential: this is the only item touching auth/RLS, highest complexity, should be planned and built first so Item 4's grouping logic isn't built against a moving target
- [ ] Item 6 — Estado/Cidade cascading filter — the data-cleanup sub-step benefits from starting early (more drift accumulates daily)
- [ ] Item 2 — Detailed funnel chart — build the shared historico-duration query helper here first
- [ ] Item 3 — Days-to-win/loss KPIs — reuses Item 2's helper
- [ ] Item 4 — Vendedor leaderboard — reuses Item 2's helper, and needs Item 1's reassignment-scope decision locked first
- [ ] Item 5 — Kanban column scroll fix — fully independent, can slot in anywhere, good candidate for a quick early win

### Explicitly Out of Scope (already decided in `PROJECT.md`, reconfirmed here as correct)

- [ ] Date-range filter on the funnel chart — all-time totals only for v1.2; genuinely simplifies Item 2's query shape (no period params, unlike the existing `dashboard_ganhos_perdidos`/`desempenho_vendedor`/`prospeccao_*` RPCs)
- [ ] Monetary/deal-value columns anywhere in the leaderboard or funnel — structurally impossible without a new column on `clientes`; correctly out of scope, not an oversight
- [ ] Full IBGE municipality dataset for Cidade — the milestone's own "derive from existing client records" framing already avoids this; importing the full ~5,570-municipality dataset would be unnecessary complexity for a filter that only needs to reflect this app's own data

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Item 1 — Deactivate team member | HIGH | HIGH (auth + RLS + cross-row invariant) | P1 |
| Item 2 — Detailed funnel chart | HIGH | MEDIUM (new historico-reconstruction logic) | P1 |
| Item 3 — Days-to-win/loss KPIs | MEDIUM | LOW (reuses tested query shape) | P1 |
| Item 4 — Vendedor leaderboard | HIGH (Supervisor-only) | LOW-MEDIUM (extends existing RPC) | P1 |
| Item 5 — Kanban column scroll | HIGH (daily-use pain point at 200+ cards) | LOW (CSS/layout only) | P1 |
| Item 6 — Estado/Cidade cascade | MEDIUM | MEDIUM (4 surfaces + data cleanup) | P1 |

All six are P1 — this reflects the milestone's own framing (a fixed, committed scope), not a ranking exercise. The matrix's real value here is the **cost** column, which should inform phase ordering: Item 1 is the highest-cost/highest-risk item (touches auth) and should not be left for last if Item 4 depends on its decisions; Item 5 is the cheapest and safest to build first or in parallel as a confidence-building win.

## Anti-Features (Cross-Cutting)

| Anti-Feature | Why It Seems Appealing | Why Problematic Here | Alternative |
|--------------|------------------------|------------------------|-------------|
| Hard-delete of a deactivated user's `auth.users`/`profiles` row | "Removed" sounds cleaner than "deactivated" | Blocked by FK integrity (`clientes.responsavel`, `historico.autor_id` both `references profiles(id)` with no cascade), and destroys the audit trail the milestone explicitly requires | Soft-delete via `ativo boolean`, the same convention already used for `categorias`/`produtos_consumidos`/`tipos_tarefa`/`motivos_perda` |
| Reassigning a departed vendedor's **closed** (ganho/perdido) clientes to their successor | Simpler than partial reassignment — "just move everything" | Retroactively corrupts Item 3/4's historical accuracy; the successor's dashboard absorbs deals they never worked, and the departed vendedor's real historical contribution vanishes — the exact mistake Pipedrive's own docs warn against | Reassign only `status_acompanhamento = 'em_andamento'` clientes; leave closed ones on the original (now-inactive) responsavel |
| A single weighted/composite "score" ranking vendedores on the leaderboard | Feels more "gamified"/decisive than raw numbers | Web research explicitly warns overcomplicating with weighted scores kills the motivational effect, and for a small team it risks reading as demotivating rather than useful | Show raw metrics side by side (conversão, iniciados, ganhos, ciclo médio); default sort by name, not rank |
| Full IBGE municipality dataset bundled for the Cidade select | "Complete and always correct" | Unnecessary size/complexity for a milestone that explicitly wants Cidade derived from the app's own existing client records, not a canonical geographic database | Derive Cidade options via `DISTINCT cidade WHERE estado = X` over `clientes`, same pattern already used for `estadoOptions`/`vendedorOptions` |
| Date-range filter on the new funnel chart | "Every other dashboard chart in this app already has one" | Explicitly out of scope for v1.2 per `PROJECT.md`; adding it now duplicates the period-param plumbing of the existing `dashboard_ganhos_perdidos`/`desempenho_vendedor` RPCs for a feature nobody asked for yet | All-time totals only; revisit if/when actually requested |
| Live external geocoding/IBGE API call for cascading Estado→Cidade | Always up to date | Breaks the zero-infra-cost constraint (new external dependency, new failure mode, egress cost) for a filter that only needs the app's own data | Static 27-item UF list bundled in the repo + Cidade derived from existing rows, no network call |

## Sources

- **Codebase (HIGH confidence, read directly):** `supabase/migrations/0001_profiles_and_roles.sql`, `0002_clientes_and_funil.sql`, `0003_dashboard_aggregates.sql`; `supabase/functions/invite-user/index.ts`; `app/(app)/equipe/page.tsx`; `components/clientes/KanbanBoard.tsx`; `components/clientes/FiltersPopover.tsx`; `.planning/PROJECT.md`
- WebSearch: "Pipedrive HubSpot deactivate remove sales rep user reassign owner of open deals best practice" — Pipedrive's own support docs (support.pipedrive.com, multiple articles) + HubSpot's own knowledge base (knowledge.hubspot.com), agreeing independently on the "force reassignment, don't touch closed deals" pattern. Confidence: LOW per the classify-confidence seam's default for `websearch`, though cross-checked across two vendors' own documentation
- WebSearch: "CRM sales funnel conversion report handling deal that skipped a stage or moved backward stage history" — HubSpot Community threads (community.hubspot.com, multiple independent threads reaching the same conclusion about skipped-stage reports). Confidence: LOW
- WebSearch: "sales rep leaderboard comparison table metrics small team CRM win rate average sales cycle length" — synthesis across monday.com, close.com, prospeo.io sales-metrics articles. Confidence: LOW
- WebSearch: "cascading state city select dropdown Brazil UF IBGE pattern form filter" — general pattern confirmation (Drupal.org, Budibase docs, Oracle docs on IBGE codes, a Brazilian community `municipios-brasileiros` dataset repo). Confidence: LOW

---
*Feature research for: CRM Raiar v1.2 — Gestão de Equipe, Análises de Funil e Filtros*
*Researched: 2026-07-25*
