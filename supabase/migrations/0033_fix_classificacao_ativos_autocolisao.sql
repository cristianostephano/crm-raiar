-- Fix de lógica na migration 0032 (nunca editada — arquivo novo, mesmo
-- padrão 0004→0005→0006/0031/0032). A migration 0032 corrigiu a ambiguidade
-- de (razão social, CNPJ) na classificação recomputando `candidatos` +
-- `aptos` de novo DEPOIS do INSERT já ter acontecido — mas isso introduziu
-- um bug NOVO, mais sutil: a recomputação de `aptos` inclui de novo a
-- checagem `not exists (select 1 from clientes existente where colide(...))`,
-- e nesse ponto o cliente que ACABOU de ser inserido pela primeira CTE já
-- está visível na tabela `clientes` (mesma transação) — então a linha
-- vencedora colide CONSIGO MESMA nessa segunda passada, `aptos` fica vazio,
-- e a linha corretamente inserida volta classificada como "duplicado" com
-- id nulo. Confirmado ao vivo isolando a chamada com uma função de teste
-- temporária: as duas linhas de um lote "mesmocnpj" voltavam "duplicado",
-- nenhuma "inserido", mesmo com exatamente 1 linha fisicamente gravada em
-- `clientes`.
--
-- Fix: a classificação NUNCA mais reconsulta `clientes` depois do INSERT.
-- Em vez de recomputar a colisão contra a tabela, ela usa diretamente o
-- resultado JÁ CONHECIDO do INSERT (`v_razoes`/`v_cnpjs`, os pares que
-- realmente foram gravados) — combinado com a MESMA checagem de duplicata
-- INTERNA do lote (`candidatos anterior`, que não toca a tabela e por isso
-- não sofre autocolisão). Uma linha é "a vencedora" (a que recebe o id) se
-- e somente se: (a) seu par (razão social, CNPJ) está entre os pares
-- realmente inseridos, E (b) nenhuma linha ANTERIOR do lote colide com ela
-- (garantindo que, entre duas linhas duplicadas do lote que POR ACASO
-- casem com o mesmo par inserido, só a primeira ocorrência leva o crédito —
-- exatamente a mesma que o pré-filtro original escolheu para ser inserida).
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
  with candidatos as (
    select
      c.razao_social, c.cep, c.rua, c.numero, c.complemento, c.cidade, c.estado,
      c.responsavel, c.categoria_id, c.contato, c.telefone, c.email, c.numero_de_lojas,
      c.cnpj, c.nome_fantasia, c.linha
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
  -- NUNCA reconsulta `clientes` aqui (causa raiz desta migration) — usa
  -- só o resultado já conhecido do INSERT (v_razoes/v_cnpjs) mais a
  -- checagem de duplicata interna do lote, que não toca a tabela.
  vencedores as (
    select cand.linha
      from candidatos cand
     where exists (
             select 1 from unnest(v_razoes, v_cnpjs) as ins(razao_social, cnpj)
              where ins.razao_social is not distinct from cand.razao_social
                and ins.cnpj is not distinct from cand.cnpj
           )
       and not exists (
             select 1 from candidatos anterior
              where anterior.linha < cand.linha
                and razao_social_cnpj_colide(anterior.razao_social, anterior.cnpj, cand.razao_social, cand.cnpj)
           )
  )
  select
    cand.razao_social,
    ins.id,
    case
      when venc.linha is not null then 'inserido'
      when cliente_ativo_pronto_para_ganho(
        cand.razao_social, cand.cnpj, cand.cep, cand.rua, cand.numero, cand.cidade, cand.estado,
        cand.responsavel, cand.contato
      ) then 'duplicado'
      else 'incompleto'
    end::text as status
  from candidatos cand
  left join vencedores venc on venc.linha = cand.linha
  left join unnest(v_ids, v_razoes, v_cnpjs) as ins(id, razao_social, cnpj)
    on venc.linha is not null
   and ins.razao_social is not distinct from cand.razao_social
   and ins.cnpj is not distinct from cand.cnpj
  order by cand.linha;
end;
$$;
