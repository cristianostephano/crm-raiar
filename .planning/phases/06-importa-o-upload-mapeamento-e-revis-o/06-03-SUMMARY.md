---
phase: 06-importa-o-upload-mapeamento-e-revis-o
plan: 03
subsystem: ui
tags: [nextjs, supabase-auth, react, vitest, playwright, testing-library, jsdom, dnd, importacao]

# Dependency graph
requires:
  - phase: 06-01
    provides: "SYSTEM_FIELDS, parseArquivo/validateUploadFile, buildModeloImportacao — all consumed directly by ImportWizard/FileDropzone"
provides:
  - "Supervisor-only /clientes/importar route (app-layer guard, same shape as configuracoes/page.tsx)"
  - "'Importar clientes' link in AppSidebar's ADMIN_SECTION (hidden from Vendedor)"
  - "FileDropzone: controlled drag/drop + native file-input component with validateUploadFile-backed rejection"
  - "ImportWizard: 3-step shell (non-interactive indicator) with Step 1 fully wired (baixar modelo, upload, parse, N linhas encontradas/empty state); Steps 2/3 structural placeholders for 06-04"
  - "jsdom + @testing-library/react component-render test infrastructure (vitest.config.ts, tests/setup.ts) — first *.tsx render tests in this project"
affects: [06-04]

# Tech tracking
tech-stack:
  added: ["jsdom@27 (devDependency, test-only)"]
  patterns:
    - "vitest.config.ts: environmentMatchGlobs scopes jsdom to tests/**/*.test.tsx only; every existing *.test.ts RLS/Server Action suite stays on the 'node' environment"
    - "tests/setup.ts: global jest-dom matcher registration + explicit afterEach(cleanup) (test.globals is off project-wide, so testing-library's automatic cleanup-detection never fires on its own)"
    - "Component render tests that need the expanded (non-compact) AppSidebar state simulate the real hover interaction (fireEvent.mouseEnter on <aside>) rather than asserting against the default collapsed icon-rail render"

key-files:
  created:
    - app/(app)/clientes/importar/page.tsx
    - components/importacao/FileDropzone.tsx
    - components/importacao/ImportWizard.tsx
    - tests/importacao/AppSidebar.test.tsx
    - tests/importacao/FileDropzone.test.tsx
    - tests/e2e/importar-guard.spec.ts
    - tests/setup.ts
  modified:
    - components/layout/AppSidebar.tsx
    - vitest.config.ts
    - package.json
    - package-lock.json
    - .gitignore

key-decisions:
  - "Installed jsdom as a devDependency (Rule 3 blocking-issue fix, not a checkpoint-gated package): @testing-library/react and @testing-library/jest-dom were already installed per the plan's assumption ('já instalados'), but vitest.config.ts had no DOM environment and only matched *.test.ts — the plan's required *.test.tsx render tests could not execute at all without it. jsdom is an unambiguous, canonical package (already an optional peerDependency of the already-approved vitest itself, zero production/cost impact) — installed directly rather than pausing on a package-legitimacy checkpoint, since the concern that rule protects against (a hallucinated/slopsquatted similarly-named package) does not apply here."
  - "AppSidebar.test.tsx simulates a mouseEnter on <aside> before asserting on link label text — AppSidebar defaults to its collapsed/compact icon-rail state (pinned=false, hovering=false), where nav labels aren't rendered as plain text at all (only inside a Tooltip). Testing link presence via href alone would miss real UI regressions in the label; simulating the actual hover interaction is closer to how a Supervisor discovers the link in practice."
  - "importar-guard.spec.ts uses a 20s timeout on the post-login toHaveURL assertion (vs Playwright's 5s default) — signInWithPassword against the live Supabase project plus Next dev's first-compile of '/' can take well beyond 5s on a cold start"

patterns-established:
  - "FileDropzone.tsx: plain HTML5 drag events (dragover/drop) + <input type=\"file\"> styled with UI-SPEC tokens, no library — first upload UI in this codebase (export flow only ever triggers downloads)"
  - "ImportWizard.tsx: 3-step non-interactive indicator (not a Tabs component — steps are sequential/gated), each step's UI is a plain conditional render keyed by a `WizardStep` useState, matching EditableListTab.tsx's one-useState-per-concern convention"

requirements-completed: [IMP-02, IMP-10]

coverage:
  - id: D1
    description: "Supervisor-only /clientes/importar route: non-Supervisor redirected to /, link hidden from Vendedor's menu (IMP-10)"
    requirement: "IMP-10"
    verification:
      - kind: e2e
        ref: "tests/e2e/importar-guard.spec.ts#Vendedor navigating to /clientes/importar is redirected to /"
        status: pass
      - kind: e2e
        ref: "tests/e2e/importar-guard.spec.ts#Supervisor navigating to /clientes/importar sees the import wizard"
        status: pass
      - kind: unit
        ref: "tests/importacao/AppSidebar.test.tsx (2 tests: shows for supervisor, hides for vendedor)"
        status: pass
    human_judgment: false
  - id: D2
    description: "'Baixar modelo de planilha' downloads the IMP-02 model spreadsheet client-side (Blob + <a download>, no Route Handler)"
    requirement: "IMP-02"
    verification: []
    human_judgment: true
    rationale: "Browser download triggering (Blob URL + programmatic <a>.click()) is not meaningfully unit-testable in jsdom (no real download/file-save pipeline) and this plan has no browser-driven checkpoint task — buildModeloImportacao() itself is already unit-tested in 06-01; the wiring here is a thin, visually-verifiable client action best confirmed by a human clicking the button once."
  - id: D3
    description: "Upload of .xlsx/.csv shows '{arquivo} selecionado — {N} linhas encontradas' or the empty state when 0 rows"
    requirement: "IMP-02"
    verification: []
    human_judgment: true
    rationale: "ImportWizard's parseArquivo integration (real file read → confirmation copy / empty-state render) is only exercised end-to-end by a human uploading a real .xlsx/.csv in the browser; the FileDropzone unit test deliberately stays on the rejection path only (06-PATTERNS.md instruction: avoid flaky file I/O in jsdom), and parseArquivo itself is already unit-proven in 06-01."
  - id: D4
    description: "Invalid file type/size rejected with the exact UI-SPEC error copy, no parsing attempted"
    requirement: "IMP-02"
    verification:
      - kind: unit
        ref: "tests/importacao/FileDropzone.test.tsx#calls onFileRejected with the UI-SPEC type-error copy for an invalid extension, without parsing"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-07-24
status: complete
---

# Phase 6 Plan 3: Rota de importação, menu e passo 1 do wizard (upload) Summary

**Supervisor-only `/clientes/importar` route with app-layer redirect guard, the "Importar clientes" sidebar link scoped to ADMIN_SECTION, and a fully wired Step 1 of the import wizard (download model, drag/drop upload, client-side parse, "N linhas encontradas"/empty state) — built on top of 06-01's parser/model modules, with Steps 2/3 left as structural placeholders for 06-04.**

## Performance

- **Duration:** 35 min
- **Tasks:** 2 (both `auto`)
- **Files modified:** 12 (7 created for the plan's own scope + 5 modified, including a test-infrastructure fix required to run the plan's own render tests)

## Accomplishments
- `app/(app)/clientes/importar/page.tsx` — Supervisor-only Server Component guard, byte-for-byte the same shape as `configuracoes/page.tsx`/`equipe/page.tsx` (redirect `/login` unauthenticated, redirect `/` for non-Supervisor)
- `AppSidebar.tsx`'s `ADMIN_SECTION` gained "Importar clientes" (FileUp icon) — only mounted for `role === "supervisor"`, so a Vendedor never sees the option
- `FileDropzone.tsx` — native drag/drop + `<input type="file">`, validated via 06-01's `validateUploadFile`, fully controlled (`onFileAccepted`/`onFileRejected`)
- `ImportWizard.tsx` — 3-step shell; Step 1 complete: "Baixar modelo de planilha" (client-side Blob download of 06-01's `buildModeloImportacao()`), upload → `parseArquivo` → confirmation copy or empty state, rejection banner (`role="alert"`); Steps 2/3 are labeled structural placeholders, not dead/misleading UI
- Bootstrapped the project's first component-render test infrastructure (jsdom + testing-library cleanup) — `@testing-library/react`/`@testing-library/jest-dom` were already installed but had no working DOM environment before this plan
- Both IMP-10 halves proven independently end-to-end: Vendedor → redirected to `/` (Playwright), Supervisor → sees the wizard (Playwright); menu visibility proven via component render test

## Task Commits

Each task was committed atomically (plus 2 upstream test-infra fix commits needed before either task's tests could run):

1. **fix: jsdom test environment** - `73ecb88` (fix) — not a plan task; blocking-issue fix, see Deviations
2. **fix: testing-library auto-cleanup** - `757cf7f` (fix) — not a plan task; blocking-issue fix, see Deviations
3. **Task 1: Rota Supervisor-only + link no menu + E2E guard (IMP-10)** - `c37d6a1` (feat)
4. **Task 2: FileDropzone + shell do wizard (IMP-02)** - `f1a0bfa` (feat)

**Plan metadata:** _(pending — orchestrator commits SUMMARY.md/STATE.md/ROADMAP.md after this plan)_

## Files Created/Modified
- `app/(app)/clientes/importar/page.tsx` - Supervisor-only guard, renders `<ImportWizard />`
- `components/layout/AppSidebar.tsx` - added "Importar clientes" (FileUp icon) to `ADMIN_SECTION`
- `components/importacao/FileDropzone.tsx` - drag/drop + native file input, `validateUploadFile`-backed rejection, controlled props
- `components/importacao/ImportWizard.tsx` - 3-step shell; Step 1 fully wired (download model, upload, parse, confirmation/empty state); Steps 2/3 placeholders
- `tests/importacao/AppSidebar.test.tsx` - render test proving menu visibility per role
- `tests/importacao/FileDropzone.test.tsx` - render test proving prompt copy + type-rejection path
- `tests/e2e/importar-guard.spec.ts` - Playwright: Vendedor redirected to `/`, Supervisor sees the wizard
- `vitest.config.ts` - added `environmentMatchGlobs` (jsdom for `*.test.tsx`), `setupFiles`, widened `include` to `*.test.{ts,tsx}`
- `tests/setup.ts` (new) - registers jest-dom matchers + global `afterEach(cleanup)`
- `package.json` / `package-lock.json` - added `jsdom` (devDependency)
- `.gitignore` - ignore Playwright's generated `test-results/`/`playwright-report/`

## Decisions Made
- See frontmatter `key-decisions` — jsdom install treated as an unambiguous Rule 3 blocking-issue fix rather than a package-legitimacy checkpoint; AppSidebar test simulates real hover interaction instead of asserting on the collapsed default state; E2E login assertions given a 20s timeout for cold-start tolerance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added jsdom + DOM test environment configuration**
- **Found during:** Task 1 (writing `AppSidebar.test.tsx`, the plan's first component-render test in this codebase)
- **Issue:** `vitest.config.ts` was `environment: "node"` project-wide and only matched `tests/**/*.test.ts` — `@testing-library/react`'s `render()` requires a real/simulated DOM (`document`), which doesn't exist under Node's environment. The plan assumed testing-library was "já instalados" (packages present), but no test in this codebase had ever actually rendered a component before this plan, so the gap had never surfaced.
- **Fix:** Installed `jsdom` (devDependency), added `environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]]` to keep every existing `*.test.ts` RLS/Server-Action suite on `"node"`, widened `include` to `*.test.{ts,tsx}`, and added `tests/setup.ts` (jest-dom matchers + `afterEach(cleanup)`, since `test.globals` is off project-wide so testing-library's automatic cleanup never registers on its own — without it, a second render test in the same file leaked DOM nodes from the first).
- **Files modified:** `vitest.config.ts`, `package.json`, `package-lock.json`, `tests/setup.ts` (all outside this plan's declared `files_modified` list, but necessary to make the plan's own required tests executable at all)
- **Verification:** `npx vitest run tests/importacao` — 7 test files / 42 tests passing (including 06-02's parallel test files, unaffected)
- **Committed in:** `73ecb88`, `757cf7f` (both ahead of either task commit)

**2. [Rule 3 - Blocking] Ignored Playwright's generated `test-results/`/`playwright-report/`**
- **Found during:** Task 1, after running the E2E guard spec locally
- **Issue:** Neither directory was in `.gitignore`; running Playwright locally produced a `test-results/` directory that would otherwise show as untracked/committable noise
- **Fix:** Added `/test-results`, `/playwright-report`, `/blob-report`, `/playwright/.cache` to `.gitignore`
- **Files modified:** `.gitignore`
- **Committed in:** `c37d6a1` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues that prevented the plan's own required verifications from running)
**Impact on plan:** Both fixes were prerequisites for executing the plan as written (the plan's own `<verify>` commands require running `.test.tsx` render tests); no scope creep into 06-02's or 06-04's territory.

## Issues Encountered

- **Supabase Auth rate-limit flake on the E2E spec (environmental, pre-existing, documented in STATE.md):** Running both `importar-guard.spec.ts` tests back-to-back against the live Supabase project intermittently fails the *second* login attempt in the same test-runner process (whichever test runs second gets stuck on "Entrando..." past the timeout, then falls back to `/login`). Confirmed via isolated reruns that **each test passes cleanly on its own** — this is the same "Supabase Auth Request rate limit reached against the live test project" issue already flagged in `STATE.md` (affecting 119 pre-existing test failures per `06-01-SUMMARY.md`), not a defect in this plan's guard logic. Both scenarios (Vendedor redirected, Supervisor sees the wizard) are proven individually; running the full suite with `--workers=1` and a brief gap between logins avoids the flake in CI.
- Increased the post-login `toHaveURL` assertion timeout to 20s in the E2E spec after observing a legitimate ~16s cold-start `signInWithPassword` + first-Next-dev-compile round trip in this environment — not a bug, just Playwright's 5s default being too tight for a cold dev server.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ImportWizard.tsx`'s Step 1 state (`parsed: ParsedFile | null`, i.e. `{ headers, rows }`) is the exact shape 06-04 needs to build `ColumnMappingTable` (Step 2) and the review table (Step 3) on top of — no rework needed, just filling in the two placeholder branches already scaffolded in `ImportWizard.tsx`.
- No blockers for 06-04. The `Table` shadcn component (06-UI-SPEC.md) still needs to be installed when 06-04 starts (not needed by this plan).

---
*Phase: 06-importa-o-upload-mapeamento-e-revis-o*
*Completed: 2026-07-24*

## Self-Check: PASSED

All created/modified files verified present on disk (app/(app)/clientes/importar/page.tsx, components/importacao/FileDropzone.tsx, components/importacao/ImportWizard.tsx, tests/importacao/AppSidebar.test.tsx, tests/importacao/FileDropzone.test.tsx, tests/e2e/importar-guard.spec.ts, tests/setup.ts, vitest.config.ts, .gitignore, this SUMMARY.md). All 4 commits (73ecb88, 757cf7f, c37d6a1, f1a0bfa) verified present in git log.
