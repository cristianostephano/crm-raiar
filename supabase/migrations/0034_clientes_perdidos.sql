-- Phase 28 Plan 1: Relatório de Perdidos — leitura nova, somente leitura,
-- que responde "quais clientes estão perdidos hoje, com qual motivo, desde
-- quando e de qual vendedor" (PERD-02/PERD-03/PERD-04).
--
-- Esta é a ÚNICA função criada por este arquivo. Ela nasce SEM a cláusula
-- de elevação de privilégio (nenhum "security definer"), exatamente como
-- toda função `dashboard_*` (migration 0003) e `mover_card_funil`
-- (migration 0002) — a RLS de `clientes`/`historico`/`profiles`/
-- `motivos_perda` continua sendo a ÚNICA fronteira de autorização (D-10).
-- É proibido escrever no corpo desta função qualquer checagem de papel
-- (nada de is_supervisor()/auth.uid()) ou filtro de dono — quem chama só
-- enxerga o que a RLS já deixaria enxergar em qualquer outro SELECT.
--
-- A data de perda vem do `historico`, NUNCA de `clientes.etapa_alterada_em`
-- (D-11): marcar como perdido não muda a etapa, então essa coluna fica
-- velha e não serve como data de perda. A fonte certa é o registro mais
-- recente de troca de status para "perdido" — o mesmo dado que
-- `dashboard_ganhos_perdidos` (migration 0003) já usa para "ganhos x
-- perdidos".
--
-- Partir de `clientes` (não de `historico`) com uma junção lateral pela
-- esquerda garante que TODO cliente perdido hoje apareça nesta leitura,
-- mesmo no caso anômalo em que não exista nenhuma linha de histórico para
-- ele (por exemplo, um cliente inserido já perdido direto no banco) — a
-- data cai na última atualização do cliente (atualizado_em) como reserva,
-- em vez de o cliente ficar inalcançável tanto no Kanban quanto nesta tela.
--
-- O cruzamento com o status ATUAL do cliente (c.status_acompanhamento =
-- 'perdido') é o que faz um cliente reaberto (D-08/D-09) sumir sozinho
-- desta leitura na próxima recarga, sem nenhuma lógica extra.
--
-- A função devolve só 7 colunas: nenhuma delas é dado de contato da pessoa
-- do cliente (telefone, e-mail, nome do contato) — esses dados continuam
-- só na ficha (critério 2 da fase, LGPD).
create or replace function clientes_perdidos(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid,
  razao_social text,
  nome_fantasia text,
  motivo_perda_nome text,
  perdido_em timestamptz,
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
    mp.nome as motivo_perda_nome,
    coalesce(h.criado_em, c.atualizado_em) as perdido_em,
    c.responsavel,
    nullif(trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as responsavel_nome
  from clientes c
  left join lateral (
    select h2.criado_em
    from historico h2
    where h2.cliente_id = c.id
      and h2.tipo = 'status_acompanhamento'
      and h2.descricao ilike '%"perdido"%'
    order by h2.criado_em desc
    limit 1
  ) h on true
  left join motivos_perda mp on mp.id = c.motivo_perda_id
  left join profiles p on p.id = c.responsavel
  where c.status_acompanhamento = 'perdido'
    and (p_inicio is null or coalesce(h.criado_em, c.atualizado_em) >= p_inicio)
    and (p_fim is null or coalesce(h.criado_em, c.atualizado_em) < p_fim)
  order by 5 desc, 1 asc;
$$;

-- Lembrete: NÃO adicionar "security definer" a esta função. Ela precisa
-- continuar rodando como o chamador para a RLS já existente continuar
-- sendo a única fronteira de autorização (D-10, T-28-01).
