-- Fix de lógica na migration 0030 (nunca editada — arquivo novo, mesmo
-- padrão 0004→0005→0006/0031). Bug encontrado pelos testes de integração
-- (`tests/importacao/unicidade-razao-social-cnpj.test.ts`, caso "mesmocnpj"
-- de `importar_clientes_ativos_lote`): quando duas linhas do MESMO lote
-- compartilham razão social + CNPJ (cenário "linha duplicada dentro do
-- próprio lote"), a query final de classificação (`return query`) casava
-- CADA UMA das duas linhas originais contra o ÚNICO cliente realmente
-- inserido — porque o `left join unnest(v_ids, v_razoes, v_cnpjs) ...  on
-- ins.razao_social = r.razao_social and ins.cnpj is not distinct from
-- r.cnpj` usa (razão social, CNPJ) como chave, e essa chave NÃO é única
-- entre as linhas ORIGINAIS do lote quando há duplicata interna — só é
-- única dentro do conjunto de linhas realmente inseridas (`aptos`/`ins`).
-- Resultado: as duas linhas voltavam com status "inserido" e o MESMO id,
-- em vez de uma "inserido" e a outra "duplicado".
--
-- O pré-filtro de inserção (`aptos`, objeto 6 de 0030) já está CORRETO —
-- confirmado isolando a CTE `aptos` numa função de depuração temporária
-- contra o banco real: a linha 2 (duplicata posterior) já chegava com
-- `colide_anterior = true` e por isso nunca era inserida. O bug estava
-- SÓ na consulta de classificação, que recalcula a lista original inteira
-- (incluindo a linha descartada) e não tinha como saber QUAL das duas
-- linhas colidentes foi a vencedora.
--
-- Fix: a consulta de classificação agora recalcula `candidatos` e `aptos`
-- de novo (mesma lógica, puro SELECT, sem efeito colateral — já é prática
-- deste arquivo recalcular `jsonb_to_recordset` mais de uma vez ao longo da
-- função) e casa cada `candidatos` original contra `aptos` por `linha`
-- (chave exata, nunca ambígua — `aptos` tem no máximo uma linha por
-- combinação razão social+CNPJ, por construção do próprio pré-filtro). Só
-- quando a linha É a vencedora (`apto.linha = cand.linha`) o id do cliente
-- inserido é anexado; todas as outras linhas (inclusive as que perderam por
-- serem duplicata interna) ficam com id nulo e caem no `case` de
-- duplicado/incompleto normalmente.
--
-- `importar_clientes_lote` (a RPC irmã de Prospecção) NÃO tem este bug: sua
-- query final só devolve as linhas efetivamente inseridas
-- (`select ... from unnest(v_ids, v_razoes)`), nunca tenta reclassificar o
-- lote inteiro — por isso não precisa de nenhuma mudança aqui.
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
  aptos as (
    -- Recomputada de propósito: precisamos saber qual `linha` original
    -- venceu o pré-filtro pra casar id só com a linha certa (nunca por
    -- razão social+CNPJ sozinhos, que deixam de ser únicos quando há
    -- duplicata interna no próprio lote — a causa raiz do bug desta
    -- migration).
    select cand.linha
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
  )
  select
    cand.razao_social,
    ins.id,
    case
      when apto.linha is not null then 'inserido'
      when cliente_ativo_pronto_para_ganho(
        cand.razao_social, cand.cnpj, cand.cep, cand.rua, cand.numero, cand.cidade, cand.estado,
        cand.responsavel, cand.contato
      ) then 'duplicado'
      else 'incompleto'
    end::text as status
  from candidatos cand
  left join aptos apto on apto.linha = cand.linha
  left join unnest(v_ids, v_razoes, v_cnpjs) as ins(id, razao_social, cnpj)
    on apto.linha is not null
   and ins.razao_social is not distinct from cand.razao_social
   and ins.cnpj is not distinct from cand.cnpj
  order by cand.linha;
end;
$$;
