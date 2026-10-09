/*
  Quick task 261008-rxw - decisoes do dono de 2026-10-08 (revisada no mesmo
  dia: a data do ganho e um campo real). Aba "Ganhos" no menu: lista dos
  clientes ganhos, com a data real do ganho.

  O que esta migration faz:

  (1) Coluna nova clientes.ganho_em, data opcional: a "data real do ganho".

  (2) Preenchimento automatico: quando o status do cliente passa a ganho e a
  coluna esta vazia, ela recebe a data de hoje em Sao Paulo. Nunca
  sobrescreve uma data existente. Nao roda em cadastro direto, entao cliente
  importado ja ganho (planilha de Clientes Ativos) fica sem data ate alguem
  preencher na ficha. A regra roda com as permissoes de quem faz a
  alteracao, sem elevacao de privilegio, e so escreve na propria linha
  alterada.

  (3) Preenchimento unico desta aplicacao: clientes ganhos sem data recebem
  a data (Sao Paulo) do registro mais recente de troca de status para ganho
  no historico. Sem registro, ficam sem data. Efeito colateral conhecido: a
  data de ultima atualizacao desses clientes passa a ser a hora da
  aplicacao.

  (4) Leitura clientes_ganhos(p_inicio, p_fim): quais clientes estao ganhos
  hoje, a data do ganho e o vendedor. 6 colunas minimas, nenhum meio de
  contato com a pessoa do cliente (LGPD). Roda com as permissoes de quem
  chama, sem elevacao, sem checagem de papel: a RLS de clientes e profiles
  decide (Vendedor so os proprios, Supervisor todos). O periodo e convertido
  para data de Sao Paulo, com fim exclusivo. Cliente sem data so aparece sem
  recorte de periodo ("Tudo"). Ordem pela data do ganho, mais recente
  primeiro, sem data por ultimo. A versao rascunho desta leitura (mesmos
  parametros), se existir, e removida antes, para a colagem nunca falhar.
  Nenhuma permissao nova, nenhuma regra de acesso nova.

  (5) ORDEM: aplicar ANTES de publicar o codigo novo, que le esta coluna em
  TODA ficha de cliente. O codigo atual continua funcionando com a coluna
  nova.

  (6) Volta atras em supabase/rollbacks/0053_volta_clientes_ganhos.sql, que
  NAO e aplicado automaticamente e APAGA as datas preenchidas. Primeiro o
  codigo, depois o banco.
*/

alter table clientes add column if not exists ganho_em date;

create or replace function clientes_preenche_ganho_em()
returns trigger
language plpgsql
as $$
begin
  new.ganho_em := (now() at time zone 'America/Sao_Paulo')::date;
  return new;
end;
$$;

drop trigger if exists trg_clientes_preenche_ganho_em on clientes;

create trigger trg_clientes_preenche_ganho_em
  before update on clientes
  for each row
  when (
    new.status_acompanhamento = 'ganho'
    and old.status_acompanhamento is distinct from new.status_acompanhamento
    and new.ganho_em is null
  )
  execute function clientes_preenche_ganho_em();

update clientes c
set ganho_em = (h.ultimo_ganho at time zone 'America/Sao_Paulo')::date
from (
  select h2.cliente_id, max(h2.criado_em) as ultimo_ganho
  from historico h2
  where h2.tipo = 'status_acompanhamento'
    and h2.descricao ilike '%"ganho"%'
  group by h2.cliente_id
) h
where h.cliente_id = c.id
  and c.status_acompanhamento = 'ganho'
  and c.ganho_em is null;

drop function if exists clientes_ganhos(timestamptz, timestamptz);

create or replace function clientes_ganhos(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid,
  razao_social text,
  nome_fantasia text,
  ganho_em date,
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
    c.ganho_em,
    c.responsavel,
    nullif(trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as responsavel_nome
  from clientes c
  left join profiles p on p.id = c.responsavel
  where c.status_acompanhamento = 'ganho'
    and (p_inicio is null or c.ganho_em >= (p_inicio at time zone 'America/Sao_Paulo')::date)
    and (p_fim is null or c.ganho_em < (p_fim at time zone 'America/Sao_Paulo')::date)
  order by 4 desc nulls last, 1 asc;
$$;
