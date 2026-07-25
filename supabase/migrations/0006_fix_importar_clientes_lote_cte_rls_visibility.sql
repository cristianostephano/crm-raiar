-- Phase 7 Plan 1: fix importar_clientes_lote's CTE/RLS-visibility bug —
-- discovered by the Task 3 integration test after 0005's fix for the
-- variable-conflict bug.
--
-- 0004/0005 (this migration's predecessors) are already applied to the
-- live project, so per CLAUDE.md/Pitfall 11 they are never edited in
-- place; this NEW migration redefines the same function again with the
-- fix instead.
--
-- Bug: the previous version chained both the clientes INSERT and the
-- cliente_produtos INSERT as data-modifying CTEs inside a single WITH
-- statement. Postgres executes every CTE of one WITH statement against
-- the SAME command snapshot — a later CTE that plainly re-scans the
-- underlying "clientes" table (which is exactly what cliente_produtos'
-- RLS policy's `exists (select 1 from clientes c where ...)` check does)
-- cannot see rows written by an earlier CTE of that same statement (it
-- only sees them through the earlier CTE's own name, e.g. `inseridos`,
-- not by re-querying the real table). Result: the parent-EXISTS RLS
-- policy on cliente_produtos always evaluated to false for freshly
-- inserted clientes, raising "new row violates row-level security policy
-- for table cliente_produtos" (SQLSTATE 42501) on every import that
-- included produtos.
--
-- Fix: split the import into two sequential, still fully set-based SQL
-- statements (never a row-by-row loop with per-row exception handling —
-- Pitfall A5/A6 still holds). The clientes INSERT runs first, as its own
-- statement, and its (id, razao_social) result is captured into two
-- PL/pgSQL arrays via array_agg from a *read-only* CTE — not chained
-- further into another data-modifying CTE. Once that statement completes,
-- its effects are a fully committed part of the transaction's visible
-- state for every later statement, so the second statement (the
-- cliente_produtos INSERT, driven by unnest()-ing the captured arrays
-- rejoined to p_clientes by razao_social) sees the new clientes rows
-- normally and the RLS EXISTS check passes for the caller's own rows.
create or replace function importar_clientes_lote(p_clientes jsonb)
returns table(razao_social text, id uuid, status text)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_ids uuid[];
  v_razoes text[];
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem importar clientes em massa';
  end if;

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
  )
  select array_agg(inseridos.id), array_agg(inseridos.razao_social)
  into v_ids, v_razoes
  from inseridos;

  insert into cliente_produtos (cliente_id, produto_id)
  select t.cliente_id, pid::uuid
  from unnest(v_ids, v_razoes) as t(cliente_id, razao_social)
  join jsonb_to_recordset(p_clientes) as r(razao_social text, produto_ids jsonb)
    on r.razao_social = t.razao_social
  cross join lateral jsonb_array_elements_text(coalesce(r.produto_ids, '[]'::jsonb)) as pid
  on conflict do nothing;

  return query
  select t.razao_social, t.cliente_id, 'inserido'::text as status
  from unnest(v_ids, v_razoes) as t(cliente_id, razao_social);
end;
$$;
