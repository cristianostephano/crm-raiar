# Deferred Items — Phase 12

Out-of-scope issues discovered during execution that are pre-existing and unrelated to this phase's changes. Not fixed here per the executor scope boundary rule.

## Plan 12-04

Found during `npm run lint` while verifying Task 1 (only `components/dashboard/DashboardClient.tsx` was modified by this plan; the following are pre-existing lint findings in unrelated files):

- `components/clientes/ClienteDetailSheet.tsx:489` — React Compiler warning: `form.watch()` from React Hook Form cannot be memoized safely (`react-hooks/incompatible-library`).
- `components/clientes/EstadoCidadeFields.tsx:95` — `react-hooks/set-state-in-effect` error: `setCidades([])` called synchronously inside a `useEffect` body.
- `components/clientes/FiltersPopover.tsx:151` — `react-hooks/set-state-in-effect` error: `setCidades([])` called synchronously inside a `useEffect` body.
- `tests/importacao/annotarLinha.test.ts:63` — `@typescript-eslint/no-unused-vars` warning: `_razaoSocial` assigned but never used.

None of these files were touched by plan 12-04. Recommend a follow-up cleanup task outside Phase 12.
