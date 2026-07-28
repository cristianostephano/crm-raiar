# Deferred Items — Phase 11

Out-of-scope findings surfaced during execution but not fixed (per executor scope boundary — only issues directly caused by the current task's changes are auto-fixed).

## From 11-05 (Task 1: DashboardClient.tsx integration)

`npm run lint` reports 2 pre-existing errors unrelated to this plan's changes (`components/dashboard/DashboardClient.tsx`, `FunilDetalhadoTable.tsx`, `TempoAteFechamentoCards.tsx` are clean when linted in isolation):

- `components/clientes/ClienteDetailSheet.tsx:489` — `react-hooks/incompatible-library` on `form.watch()` usage.
- `components/clientes/EstadoCidadeFields.tsx:95` — `react-hooks/set-state-in-effect` on `setCidades([])`.
- `components/clientes/FiltersPopover.tsx:151` — `react-hooks/set-state-in-effect` on `setCidades([])`.

None of these files are touched by 11-05. Not fixed here — logged for a future phase/cleanup pass.
