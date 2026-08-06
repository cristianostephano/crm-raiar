# Milestones

## v1.2 Gestão de Equipe, Análises de Funil e Filtros (Shipped: 2026-08-06)

**Phases completed:** 5 phases, 22 plans, 52 tasks

**Key accomplishments:**

- Kanban: cada uma das 7 colunas do funil agora tem altura fixa e rolagem própria (ScrollColumnShell), com o drag-and-drop de cards continuando a funcionar corretamente durante o auto-scroll.
- Estado e Cidade estruturados: cadastro, edição, filtro e importação por planilha agora usam uma lista fixa das 27 UFs e a lista oficial de municípios do IBGE (cascata Estado -> Cidade), substituindo os campos de texto livre anteriores.
- Desativação de membro da equipe: o Supervisor pode desativar um vendedor com segurança - os clientes em andamento são transferidos a um substituto escolhido, o histórico e os números fechados (ganho/perdido) continuam intactos, o membro perde acesso ao sistema, e o sistema nunca permite ficar sem nenhum Supervisor ativo.
- Funil de conversão detalhado no Dashboard: nova tabela por etapa (quantidade, % que avançou, perdidos, tempo médio parado) e cartões com o tempo médio até "ganho" e até "perdido", respeitando a mesma regra de visibilidade por papel do Dashboard.
- Comparativo por vendedor no Dashboard: nova tabela, visível só para o Supervisor, comparando taxa de conversão, negócios iniciados, negócios ganhos e ciclo médio em dias entre os vendedores ativos.

---

## v1.1 Importação e Exportação de Clientes (Shipped: 2026-07-25)

**Phases completed:** 3 phases, 9 plans, 20 tasks

**Key accomplishments:**

- `getClientesParaExportacao(ids?: string[] | null)`
- `POST /api/clientes/exportar`
- Client-side .xlsx/.csv parser (papaparse + @e965/xlsx) with pt-BR semicolon/BOM support, canonical SYSTEM_FIELDS vocabulary, and the IMP-02 downloadable model spreadsheet — all pure, unit-tested, no UI or database yet.
- Pure dedup/validation engine (normalizeRazaoSocial + findDuplicates + annotarLinha) plus the read-only `validarLoteImportacao` Server Action that gates the import feature to Supervisor-only and never writes to the database — the entire testable core of IMP-04/IMP-05/IMP-07/IMP-10.
- Supervisor-only `/clientes/importar` route with app-layer redirect guard, the "Importar clientes" sidebar link scoped to ADMIN_SECTION, and a fully wired Step 1 of the import wizard (download model, drag/drop upload, client-side parse, "N linhas encontradas"/empty state) — built on top of 06-01's parser/model modules, with Steps 2/3 left as structural placeholders for 06-04.
- Column-mapping Step 2 (auto-suggest + "não importar" + required-field warning) and paginated review Step 3 (OK/erro/possível duplicado per row, Importar/Pular decision on duplicates, zero database writes) — completing the entire Fase 6 import wizard end-to-end.
- Supervisor-only, set-based `importar_clientes_lote(p_clientes jsonb)` RPC live on the Supabase project — bulk-inserts clientes at `aguardando_contato` plus their produtos, with `ON CONFLICT DO NOTHING` as the duplicate backstop, proven by a 3-case integration test against the real RLS policies.
- Pure `planConfirmacao`/`reconcileImportados` accounting helper (8 unit tests, RED-then-GREEN) plus `confirmarLoteImportacao` Server Action — Supervisor-gated, D-02 confirm-time re-dedup, single `importar_clientes_lote` RPC call, `{ importados, puladas }` result with zero persistence of skipped rows.
- Wired ImportWizard's "Confirmar importação" button to the real `confirmarLoteImportacao` write path, added the `ImportSummary` D-01 post-confirmation screen, and got human sign-off on a real bulk import against the live Supabase project — completing Phase 7 and the v1.1 milestone's only write phase.

---
