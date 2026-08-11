-- Phase 19 Plan 1: importar_clientes_lote passa a aceitar e gravar cnpj e
-- nome_fantasia (IMP-01/IMP-02) — hoje essas duas chaves, se vierem no
-- objeto de uma linha do lote, são IGNORADAS silenciosamente pela função,
-- porque nenhuma das duas existe na lista de colunas do jsonb_to_recordset
-- nem na lista de colunas/valores da instrução de criação em clientes.
--
-- 0004/0005/0006 (predecessoras desta função) já estão aplicadas no
-- projeto hospedado e, por regra do CLAUDE.md, nunca são editadas em
-- lugar — esta é uma NOVA migration que redefine a mesma função de novo,
-- copiando 0006 byte a byte e mudando EXATAMENTE três lugares: a lista de
-- colunas do jsonb_to_recordset, a lista de colunas da instrução de
-- criação em clientes, e a lista de valores selecionados. As duas colunas
-- novas (`cnpj text`, `nome_fantasia text`) já existem em `clientes` desde
-- a migration 0013 e continuam opcionais (nullable) — nenhuma mudança de
-- estrutura de tabela acontece aqui.
--
-- Tudo o mais permanece idêntico a 0006: o pragma #variable_conflict
-- use_column, o guard is_supervisor() com a mesma mensagem, a cláusula
-- ON CONFLICT (razao_social) DO NOTHING, a captura dos ids/razões em
-- arrays de PL/pgSQL, e a separação em DUAS instruções sequenciais
-- (clientes primeiro, cliente_produtos depois) — esse é o conserto de
-- visibilidade de RLS documentado em 0006 e NÃO pode ser desfeito:
-- reencadear como duas CTEs de escrita numa instrução só ressuscita o
-- erro 42501 em toda importação que traga produtos.
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
      responsavel, categoria_id, contato, telefone, email, numero_de_lojas,
      cnpj, nome_fantasia
    )
    select
      r.razao_social, r.cep, r.rua, r.numero, r.complemento, r.cidade, r.estado,
      r.responsavel, r.categoria_id, r.contato, r.telefone, r.email, r.numero_de_lojas,
      r.cnpj, r.nome_fantasia
    from jsonb_to_recordset(p_clientes) as r(
      razao_social text, cep text, rua text, numero text, complemento text,
      cidade text, estado text, responsavel uuid, categoria_id uuid,
      contato text, telefone text, email text, numero_de_lojas int,
      cnpj text, nome_fantasia text
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
