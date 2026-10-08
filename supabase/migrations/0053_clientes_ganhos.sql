/*
  Quick task 261008-rxw - decisao do dono de 2026-10-08.
  Aba "Ganhos" no menu: lista dos clientes ganhos.

  O que esta migration cria: uma leitura nova, SOMENTE LEITURA,
  clientes_ganhos(p_inicio, p_fim). Ela responde "quais clientes estao
  ganhos hoje, desde quando e de qual vendedor". E irma da leitura
  clientes_perdidos (0034) e tem o mesmo desenho.

  Quem ve o que: a leitura roda com as permissoes de quem chama, sem
  elevacao de privilegio, sem grant e sem revoke, sem checagem de papel e
  sem filtro de dono no corpo. A RLS de clientes, historico e profiles e a
  UNICA fronteira: o Vendedor recebe so os proprios clientes e o Supervisor
  recebe todos.

  Data do ganho (coluna ganho_em): e o registro mais recente de troca de
  status para "ganho" no historico (cliente encerrado e reativado conta a
  reativacao). Quando esse registro nao existe - cliente cadastrado ja como
  ganho, por exemplo pela planilha de Clientes Ativos - vale a data de
  CADASTRO do cliente, nunca a da ultima edicao, que mudaria a cada edicao
  da ficha. Esta e uma diferenca deliberada em relacao a 0034. Efeito
  visivel: os clientes de uma mesma importacao aparecem todos com a mesma
  data (a da importacao).

  Colunas minimas (LGPD): cliente_id, razao_social, nome_fantasia, ganho_em,
  responsavel, responsavel_nome. Nenhum meio de contato com a pessoa do
  cliente: esses dados continuam so na ficha. Nada e gravado e nenhum dado
  novo e coletado.

  Ordem de aplicacao: aplicar ANTES de publicar a tela Ganhos. O site atual
  nao usa esta leitura, entao aplicar nao muda nada no site de hoje.

  Volta atras: supabase/rollbacks/0053_volta_clientes_ganhos.sql, que NAO e
  aplicado automaticamente. Ordem obrigatoria: primeiro a tela, depois o
  banco.
*/

create or replace function clientes_ganhos(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid,
  razao_social text,
  nome_fantasia text,
  ganho_em timestamptz,
  responsavel uuid,
  responsavel_nome text
)
language sql
stable
as $$
  select
    c.id as cliente_id,
    c.razao_social,
    c.nome_fantasia,
    coalesce(h.criado_em, c.criado_em) as ganho_em,
    c.responsavel,
    nullif(trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as responsavel_nome
  from clientes c
  left join lateral (
    select h2.criado_em
    from historico h2
    where h2.cliente_id = c.id
      and h2.tipo = 'status_acompanhamento'
      and h2.descricao ilike '%"ganho"%'
    order by h2.criado_em desc
    limit 1
  ) h on true
  left join profiles p on p.id = c.responsavel
  where c.status_acompanhamento = 'ganho'
    and (p_inicio is null or coalesce(h.criado_em, c.criado_em) >= p_inicio)
    and (p_fim is null or coalesce(h.criado_em, c.criado_em) < p_fim)
  order by 4 desc, 1 asc;
$$;
