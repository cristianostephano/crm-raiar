-- Phase 7 Plan 1: fix importar_clientes_lote's PL/pgSQL variable-conflict
-- bug — discovered by the Task 3 integration test.
--
-- 0004 (this migration's predecessor) is already applied to the live
-- project, so per CLAUDE.md/Pitfall 11 it is never edited in place; this
-- NEW migration redefines the same function (`create or replace function`)
-- with the fix instead.
--
-- Bug: importar_clientes_lote returns table(razao_social text, id uuid,
-- status text) — the RETURNS TABLE clause implicitly declares
-- "razao_social" as a PL/pgSQL OUT-parameter variable, scoped to the whole
-- function body. Postgres's plpgsql compiler then reports "column
-- reference \"razao_social\" is ambiguous" (SQLSTATE 42702) on
-- `on conflict (razao_social) do nothing`, because the ON CONFLICT target
-- column list is one of the documented tricky cases where PL/pgSQL's
-- variable-vs-column name resolution applies even though the identifier
-- isn't a normal value expression.
--
-- Fix: add the `#variable_conflict use_column` compiler pragma as the
-- first line of the function body. This tells PL/pgSQL to always prefer a
-- table/column reference over a same-named PL/pgSQL variable whenever both
-- are possible — safe here because the function never reads the
-- razao_social/id/status OUT variables directly, it only builds the result
-- set via `return query`, so there is no legitimate need for the variable
-- reading to ever win. Documented in the official PL/pgSQL manual,
-- "Variable Substitution" section.
create or replace function importar_clientes_lote(p_clientes jsonb)
returns table(razao_social text, id uuid, status text)
language plpgsql
as $$
#variable_conflict use_column
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
