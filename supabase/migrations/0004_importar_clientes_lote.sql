-- Phase 7 Plan 1: importar_clientes_lote RPC — the single write path of
-- milestone v1.1's bulk import feature. Bulk-inserts validated clientes
-- (already parsed/mapped/reviewed client-side and re-validated server-side
-- by confirmarLoteImportacao, Plan 07-02) in one set-based statement, plus
-- their produtos_consumidos into the cliente_produtos join table.
--
-- Single migration file on purpose, mirroring 0002's whole-file discipline.
-- NEW file, never an edit to 0001/0002/0003 (Pitfall 11 — once pushed, any
-- further change is a NEW migration file).
--
-- RPC shape mirrors mover_card_funil (0002, section 8) exactly: it runs as
-- the caller so the clientes INSERT RLS policy from 0002
-- ("usuarios cadastram clientes para si (ou supervisor para qualquer um)")
-- still applies to every row inserted here — this function adds no new
-- table-level authorization, only the feature-level Supervisor gate below.
-- Duplicate handling is a single set-based INSERT ... ON CONFLICT DO
-- NOTHING (never a plpgsql loop with per-row exception handling), per
-- Pitfall A5 (Vercel Hobby ~10s execution limit — batch, not row-by-row)
-- and Pitfall A6 (partial-import failure must never silently corrupt or
-- abort the whole batch).
--
-- Source: .planning/phases/07-importa-o-confirma-o-e-grava-o/07-01-PLAN.md
--         .planning/research/ARCHITECTURE.md (v1.1 Additions, Pattern 4)
--         .planning/phases/07-importa-o-confirma-o-e-grava-o/07-PATTERNS.md

-- ─────────────────────────────────────────────────────────────────────────
-- importar_clientes_lote — Supervisor-only bulk insert.
--
-- Feature-level gate: only a Supervisor may call this RPC at all (checked
-- explicitly, first statement, before any DML — mirrors mover_card_funil's
-- "raise exception before touching the table" discipline). This is a
-- business/feature rule, not a row-visibility predicate, so it lives here
-- rather than as a new/changed clientes policy (see ARCHITECTURE.md
-- Pattern 4 for the full "why not a new RLS policy" reasoning).
--
-- etapa is never named in the INSERT column list — every imported cliente
-- lands at the clientes.etapa column default ('aguardando_contato', set in
-- 0002) automatically, so IMP-09 holds structurally, not by convention.
--
-- produto_ids (from each row's mapped produtos_consumidos selections) are
-- inserted into cliente_produtos in a second set-based CTE, correlated to
-- the newly-inserted clientes rows by the unique razao_social — dropping
-- produtoIds silently would be real data loss for a supervisor who mapped
-- a produtos column (07-PATTERNS.md).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function importar_clientes_lote(p_clientes jsonb)
returns table(razao_social text, id uuid, status text)
language plpgsql
as $$
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem importar clientes em massa';
  end if;

  return query
  with inseridos as (
    insert into clientes (
      razao_social, cep, rua, numero, complemento, cidade, estado,
      responsavel, categoria_id, contato, telefone, email, numero_de_lojas
    )
    select
      r.razao_social, r.cep, r.rua, r.numero, r.complemento, r.cidade, r.estado,
      r.responsavel, r.categoria_id, r.contato, r.telefone, r.email, r.numero_de_lojas
    from jsonb_to_recordset(p_clientes) as r(
      razao_social text, cep text, rua text, numero text, complemento text,
      cidade text, estado text, responsavel uuid, categoria_id uuid,
      contato text, telefone text, email text, numero_de_lojas int
    )
    on conflict (razao_social) do nothing
    returning clientes.id, clientes.razao_social
  ),
  produtos_inseridos as (
    insert into cliente_produtos (cliente_id, produto_id)
    select i.id, pid::uuid
    from inseridos i
    join jsonb_to_recordset(p_clientes) as r(razao_social text, produto_ids jsonb)
      on r.razao_social = i.razao_social
    cross join lateral jsonb_array_elements_text(coalesce(r.produto_ids, '[]'::jsonb)) as pid
    on conflict do nothing
    returning 1
  )
  select i.razao_social, i.id, 'inserido'::text as status
  from inseridos i;
end;
$$;
