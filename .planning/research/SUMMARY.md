# CRM Raiar v1.1 Research Synthesis

v1.1 adds Supervisor-only bulk client import via .xlsx/.csv with column mapping and pre-confirmation review, plus role-scoped client export.

## Three Phase Structure Recommended

1. Export first (Route Handler + CSV sanitization)
2. Import preview second (parse + column-mapping + validation, no DB writes)
3. Import commit last (RPC + confirm action)

## Key Technologies

- @e965/xlsx 0.20.3 (NOT npm xlsx which has CVEs)
- papaparse 5.5.4 (CSV)
- pg_trgm extension (server-side fuzzy dedup)
- No new dev tools (reuse Vitest + Playwright)

## Critical Pitfalls to Prevent

- A1: Fragile razão_social dedup (no CNPJ field)
- A2: pt-BR CSV delimiter mismatch (semicolon vs comma)
- A3: UTF-8 BOM breaking first column header
- A4: CSV injection on export (sanitize formulas)
- A5: Serverless timeout on large batches (batch inserts)
- A6: Partial-import leaving DB inconsistent
- A7: File upload security (size cap + magic bytes)

## Confidence

Overall MEDIUM - library versions HIGH confidence (npm registry), patterns MEDIUM (cross-checked), pitfalls MEDIUM-HIGH (official sources + synthesis)

---

Full details in .planning/research/STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

See these for:
- Complete technology selection rationale
- Feature landscape and dependencies
- Architectural patterns (Pattern 4: bulk RPC, Pattern 5: two-phase import, Pattern 6: export Route Handler)
- Detailed pitfall prevention strategies and cross-phase checkpoints

## Next Steps for Roadmapper

1. Confirm: responsavel assignment strategy (batch-wide vs per-row column mapping)
2. Confirm: CNPJ field timeline (v1.2+ or defer indefinitely)
3. Decide: three-phase order or compress if needed
4. Acquire: real pt-BR Excel export file for testing
5. Plan: security audit gate before Phase 3 ships

---

Synthesis completed 2026-07-22 from v1.0 foundations (already shipped) + v1.1 research (STACK, FEATURES, ARCHITECTURE, PITFALLS)

