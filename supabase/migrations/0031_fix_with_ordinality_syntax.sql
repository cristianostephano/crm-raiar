-- Fix de sintaxe da migration 0030 (aplicada, nunca editada — arquivo novo,
-- mesmo padrão já usado nas migrations 0004→0005→0006 para bugs sucessivos
-- nesta mesma família de RPCs de importação em massa).
--
-- `jsonb_to_recordset(...) with ordinality as c(coluna tipo, ...)` NÃO é
-- sintaxe válida do Postgres — WITH ORDINALITY não pode ser combinado com
-- uma lista de definição de colunas direto numa função de conjunto. O
-- próprio Postgres devolve o hint exato ao tentar: "Put the column
-- definition list inside ROWS FROM()." Confirmado ao vivo: as duas RPCs
-- recriadas pela 0030 (`importar_clientes_lote`, `importar_clientes_ativos_lote`)
-- ficaram 100% quebradas (erro 42601 em toda chamada) — pego pelos 6 testes
-- de integração novos (`tests/importacao/unicidade-razao-social-cnpj.test.ts`)
-- antes de qualquer uso real em produção.
--
-- Forma correta: envolver a função de conjunto em `rows from (...)` com a
-- lista de colunas ali dentro (sem a coluna de ordinalidade), e `with
-- ordinality as c(...)` por fora só nomeia as colunas (sem tipo, o tipo já
-- veio do `rows from`) mais a coluna extra de ordinalidade ao final.
--
-- Único ponto de mudança em cada RPC: a cláusula `from` da CTE `candidatos`.
-- TODO o resto de cada função é copiado byte-a-byte de 0030 (mesma lógica,
-- mesmos comentários de raciocínio já registrados lá — não repetidos aqui
-- para não duplicar; consultar 0030 para o histórico completo da decisão).
create or replace function importar_clientes_lote(p_clientes jsonb)
returns table(razao_social text, id uuid, status text)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_ids uuid[];
  v_razoes text[];
  v_cnpjs text[];
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem importar clientes em massa';
  end if;

  with candidatos as (
    select
      c.razao_social, c.cep, c.rua, c.numero, c.complemento, c.cidade, c.estado,
      c.responsavel, c.categoria_id, c.contato, c.telefone, c.email, c.numero_de_lojas,
      c.cnpj, c.nome_fantasia, c.linha
    -- `rows from (...)` carrega a lista de colunas; `with ordinality as
    -- c(...)` por fora só nomeia as colunas (sem tipo) mais `linha` ao final
    -- — única forma válida de combinar função de conjunto + ordinalidade.
    from rows from (
      jsonb_to_recordset(p_clientes) as (
        razao_social text, cep text, rua text, numero text, complemento text,
        cidade text, estado text, responsavel uuid, categoria_id uuid,
        contato text, telefone text, email text, numero_de_lojas int,
        cnpj text, nome_fantasia text
      )
    ) with ordinality as c(
      razao_social, cep, rua, numero, complemento, cidade, estado,
      responsavel, categoria_id, contato, telefone, email, numero_de_lojas,
      cnpj, nome_fantasia, linha
    )
  ),
  aptos as (
    select cand.*
      from candidatos cand
     where not exists (
             select 1 from clientes existente
              where razao_social_cnpj_colide(existente.razao_social, existente.cnpj, cand.razao_social, cand.cnpj)
           )
       and not exists (
             select 1 from candidatos anterior
              where anterior.linha < cand.linha
                and razao_social_cnpj_colide(anterior.razao_social, anterior.cnpj, cand.razao_social, cand.cnpj)
           )
  ),
  inseridos as (
    insert into clientes (
      razao_social, cep, rua, numero, complemento, cidade, estado,
      responsavel, categoria_id, contato, telefone, email, numero_de_lojas,
      cnpj, nome_fantasia
    )
    select
      aptos.razao_social, aptos.cep, aptos.rua, aptos.numero, aptos.complemento, aptos.cidade, aptos.estado,
      aptos.responsavel, aptos.categoria_id, aptos.contato, aptos.telefone, aptos.email, aptos.numero_de_lojas,
      aptos.cnpj, aptos.nome_fantasia
    from aptos
    returning clientes.id, clientes.razao_social, clientes.cnpj
  )
  select array_agg(inseridos.id), array_agg(inseridos.razao_social), array_agg(inseridos.cnpj)
  into v_ids, v_razoes, v_cnpjs
  from inseridos;

  insert into cliente_produtos (cliente_id, produto_id)
  select t.cliente_id, pid::uuid
  from unnest(v_ids, v_razoes, v_cnpjs) as t(cliente_id, razao_social, cnpj)
  join jsonb_to_recordset(p_clientes) as r(razao_social text, cnpj text, produto_ids jsonb)
    on r.razao_social = t.razao_social and r.cnpj is not distinct from t.cnpj
  cross join lateral jsonb_array_elements_text(coalesce(r.produto_ids, '[]'::jsonb)) as pid
  on conflict do nothing;

  return query
  select t.razao_social, t.cliente_id, 'inserido'::text as status
  from unnest(v_ids, v_razoes) as t(cliente_id, razao_social);
end;
$$;

create or replace function importar_clientes_ativos_lote(p_clientes jsonb)
returns table(razao_social text, id uuid, status text)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_ids uuid[];
  v_razoes text[];
  v_cnpjs text[];
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem importar clientes ativos em massa';
  end if;

  with candidatos as (
    select
      c.razao_social, c.cep, c.rua, c.numero, c.complemento, c.cidade, c.estado,
      c.responsavel, c.categoria_id, c.contato, c.telefone, c.email, c.numero_de_lojas,
      c.cnpj, c.nome_fantasia, c.linha
    -- Mesma técnica corrigida acima: `rows from (...)` + `with ordinality`.
    from rows from (
      jsonb_to_recordset(p_clientes) as (
        razao_social text, cep text, rua text, numero text, complemento text,
        cidade text, estado text, responsavel uuid, categoria_id uuid,
        contato text, telefone text, email text, numero_de_lojas int,
        cnpj text, nome_fantasia text
      )
    ) with ordinality as c(
      razao_social, cep, rua, numero, complemento, cidade, estado,
      responsavel, categoria_id, contato, telefone, email, numero_de_lojas,
      cnpj, nome_fantasia, linha
    )
  ),
  aptos as (
    -- cliente_ativo_pronto_para_ganho é a MESMA função de completude do
    -- filtro de criação e da classificação de retorno abaixo — aridade
    -- fixa de nove parâmetros (0027), inalterada por esta migration.
    select cand.*
      from candidatos cand
     where cliente_ativo_pronto_para_ganho(
             cand.razao_social, cand.cnpj, cand.cep, cand.rua, cand.numero, cand.cidade, cand.estado,
             cand.responsavel, cand.contato
           )
       and not exists (
             select 1 from clientes existente
              where razao_social_cnpj_colide(existente.razao_social, existente.cnpj, cand.razao_social, cand.cnpj)
           )
       and not exists (
             select 1 from candidatos anterior
              where anterior.linha < cand.linha
                and razao_social_cnpj_colide(anterior.razao_social, anterior.cnpj, cand.razao_social, cand.cnpj)
           )
  ),
  inseridos as (
    insert into clientes (
      razao_social, cep, rua, numero, complemento, cidade, estado,
      responsavel, categoria_id, contato, telefone, email, numero_de_lojas,
      cnpj, nome_fantasia, etapa, status_acompanhamento
    )
    select
      aptos.razao_social, aptos.cep, aptos.rua, aptos.numero, aptos.complemento, aptos.cidade, aptos.estado,
      aptos.responsavel, aptos.categoria_id, aptos.contato, aptos.telefone, aptos.email, aptos.numero_de_lojas,
      aptos.cnpj, aptos.nome_fantasia,
      'primeira_venda'::etapa_funil,
      'ganho'::status_acompanhamento_enum
    from aptos
    returning clientes.id, clientes.razao_social, clientes.cnpj
  )
  select array_agg(inseridos.id), array_agg(inseridos.razao_social), array_agg(inseridos.cnpj)
  into v_ids, v_razoes, v_cnpjs
  from inseridos;

  insert into cliente_produtos (cliente_id, produto_id)
  select t.cliente_id, pid::uuid
  from unnest(v_ids, v_razoes, v_cnpjs) as t(cliente_id, razao_social, cnpj)
  join jsonb_to_recordset(p_clientes) as r(razao_social text, cnpj text, produto_ids jsonb)
    on r.razao_social = t.razao_social and r.cnpj is not distinct from t.cnpj
  cross join lateral jsonb_array_elements_text(coalesce(r.produto_ids, '[]'::jsonb)) as pid
  on conflict do nothing;

  return query
  select
    r.razao_social,
    ins.id,
    case
      when ins.id is not null then 'inserido'
      when cliente_ativo_pronto_para_ganho(
        r.razao_social, r.cnpj, r.cep, r.rua, r.numero, r.cidade, r.estado,
        r.responsavel, r.contato
      ) then 'duplicado'
      else 'incompleto'
    end::text as status
  from jsonb_to_recordset(p_clientes) as r(
    razao_social text, cnpj text, cep text, rua text, numero text,
    cidade text, estado text, responsavel uuid, contato text
  )
  left join unnest(v_ids, v_razoes, v_cnpjs) as ins(id, razao_social, cnpj)
    on ins.razao_social = r.razao_social and ins.cnpj is not distinct from r.cnpj;

  -- Nenhuma constraint CHECK nova sobre clientes, nenhum gatilho de
  -- histórico novo, nenhuma visita semeada — inalterado em relação a 0027
  -- (ver comentário original em 0027 para o raciocínio completo).
end;
$$;
