-- Fase 29 Plano 1: passo 2 de 2 (depois da 0035 já comitada) — tudo que usa
-- o valor 'encerrado' de status_acompanhamento_enum. Aplicado DEPOIS da
-- 0035 já comitada, este arquivo pode usar 'encerrado' livremente em
-- constraint/where/corpo de função sem cair no erro "unsafe use of new
-- value" que a 0035 evita.
--
-- O que este arquivo faz, nesta ordem:
--   1. Tabela motivos_encerramento (7a lista editável) + RLS + seed.
--   2. Coluna clientes.motivo_encerramento_id.
--   3. Duas CHECKs de integridade (motivo obrigatório, só a partir de
--      ganho na etapa final).
--   4. mover_card_funil recriada com o 8o parâmetro (a de 7 parâmetros é
--      removida antes, no mesmo arquivo).
--   5. agenda_do_vendedor recriada filtrando encerrado nas duas metades.
--   6. clientes_encerrados — leitura nova, somente leitura.
--
-- Nenhuma função deste arquivo ganha a cláusula de elevação de privilégio
-- — a RLS de clientes/historico/visitas/tarefas/profiles/
-- motivos_encerramento continua a única fronteira de autorização, e o
-- projeto termina com as mesmas exceções de privilégio elevado já
-- documentadas em STATE.md (nenhuma nova).
--
-- As formas usadas aqui são re-executáveis (`if not exists`, `drop ... if
-- exists` antes de recriar, `on conflict do nothing`) porque este projeto
-- já aplicou migrations recentes manualmente pelo SQL Editor (Fases
-- 18/19/21/28) quando o CLI não pôde ser usado — um push futuro do CLI não
-- pode quebrar se o histórico de migrations do projeto hospedado não
-- registrar essa aplicação manual.
--
-- Source: .planning/phases/29-encerrar-cliente-ativo/29-01-PLAN.md
--         .planning/phases/29-encerrar-cliente-ativo/29-RESEARCH.md
--         supabase/migrations/0002_clientes_and_funil.sql (motivos_perda,
--           clientes, as duas CHECKs de ganho/perdido, gatilho de
--           histórico)
--         supabase/migrations/0022_conclusao_remota_com_motivo.sql (molde
--           mais recente de lista editável)
--         supabase/migrations/0026_dia_fixo_visita.sql (corpos vigentes de
--           agenda_do_vendedor e mover_card_funil, copiados daqui)
--         supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql (por que
--           remover a assinatura antiga antes de recriar com um parâmetro
--           a mais)
--         supabase/migrations/0034_clientes_perdidos.sql (molde da leitura
--           de relatório)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. motivos_encerramento — 7a lista editável, cópia estrutural literal de
--    motivos_perda/motivos_conclusao_remota. Sem coluna de descrição, sem
--    ordem manual.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists motivos_encerramento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table motivos_encerramento enable row level security;

-- Quatro regras de acesso, mesmo molde literal das outras seis listas
-- editáveis: leitura aberta a qualquer autenticado (é ela que alimenta o
-- Select de motivo no diálogo de encerrar), escrita restrita ao
-- Supervisor via is_supervisor(). Restringir a leitura por engano deixaria
-- o Select do Vendedor permanentemente vazio SEM nenhum erro — o mesmo
-- modo de falha silenciosa que a migration 0016 já documentou neste
-- projeto.
drop policy if exists "usuarios autenticados leem motivos_encerramento" on motivos_encerramento;
create policy "usuarios autenticados leem motivos_encerramento"
on motivos_encerramento for select to authenticated using (true);

drop policy if exists "somente supervisor gerencia motivos_encerramento (insert)" on motivos_encerramento;
create policy "somente supervisor gerencia motivos_encerramento (insert)"
on motivos_encerramento for insert to authenticated with check (is_supervisor());

drop policy if exists "somente supervisor gerencia motivos_encerramento (update)" on motivos_encerramento;
create policy "somente supervisor gerencia motivos_encerramento (update)"
on motivos_encerramento for update to authenticated using (is_supervisor()) with check (is_supervisor());

drop policy if exists "somente supervisor gerencia motivos_encerramento (delete)" on motivos_encerramento;
create policy "somente supervisor gerencia motivos_encerramento (delete)"
on motivos_encerramento for delete to authenticated using (is_supervisor());

-- Conjunto inicial de valores — starter set só para o campo de escolha
-- nunca aparecer vazio no primeiro uso; o Supervisor edita pela aba de
-- Configurações (plano 29-05). Vocabulário fechado (lista editável, não
-- texto livre) de propósito: um motivo em texto livre convidaria a
-- registrar informação pessoal sensível sobre a pessoa do cliente, risco
-- de proteção de dados já sinalizado em STATE.md para a Fase 30.
insert into motivos_encerramento (nome) values
  ('Parou de comprar sem motivo informado'),
  ('Fechou o estabelecimento'),
  ('Mudou de fornecedor'),
  ('Preço'),
  ('Insatisfação com produto ou entrega')
on conflict (nome) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Coluna nova em clientes. Nunca é limpa ao reativar (mesmo precedente
--    de motivo_perda_id) — o motivo do último encerramento fica visível na
--    ficha mesmo depois de o cliente voltar a ser ganho.
-- ─────────────────────────────────────────────────────────────────────────
alter table clientes
  add column if not exists motivo_encerramento_id uuid references motivos_encerramento(id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Duas travas de integridade, espelho literal de
--    chk_perdido_exige_motivo / chk_ganho_somente_etapa_final (migration
--    0002). Nenhuma linha existente é 'encerrado' hoje, então a validação
--    é instantânea.
-- ─────────────────────────────────────────────────────────────────────────
alter table clientes drop constraint if exists chk_encerrado_exige_motivo;
alter table clientes add constraint chk_encerrado_exige_motivo
  check (status_acompanhamento <> 'encerrado' or motivo_encerramento_id is not null);

alter table clientes drop constraint if exists chk_encerrado_somente_etapa_final;
alter table clientes add constraint chk_encerrado_somente_etapa_final
  check (status_acompanhamento <> 'encerrado' or etapa = 'primeira_venda');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. mover_card_funil — a contagem de parâmetros muda de 7 para 8, então a
--    assinatura antiga precisa ser removida ANTES da criação da nova, no
--    mesmo arquivo (mesmo ritual documentado nas migrations 0013/0018/
--    0022/0026), senão as duas coexistiriam como sobrecarga ambígua e toda
--    chamada existente do app passaria a falhar no PostgREST.
--
--    Corpo copiado da 0026 com estas mudanças, e só estas:
--      a. Dois guards novos logo depois dos dois guards iniciais (etapa do
--         ganho, motivo de perda): etapa exigida para encerrar, motivo de
--         encerramento obrigatório.
--      b. O guard de frequência obrigatória (VIS-01) sai de onde estava e
--         passa para logo DEPOIS da leitura do estado atual, com a
--         condição nova "v_status_atual is distinct from 'encerrado'" —
--         reativar um cliente que virou ganho sem frequência (ex.: import
--         de Ativos) restaura o estado anterior em vez de travar; o
--         primeiro ganho de verdade continua exigindo frequência.
--      c. Um guard novo logo depois do guard de frequência: só é possível
--         encerrar quem já está como ganho.
--      d. Os guards de CNPJ/razão social/endereço ficam IDÊNTICOS — ainda
--         condicionados a "v_status_atual is distinct from 'ganho'",
--         então disparam também na reativação (D-11) e passam pelos
--         valores já gravados (nunca redigitados no diálogo de reativar).
--      e. motivo_encerramento_id ganha um coalesce no UPDATE, junto dos
--         demais — nunca é limpo por uma chamada que não o envia.
--      f. O bloco de semeadura da primeira visita fica idêntico — com
--         frequência nula a data é nula e nada é semeado; com visita
--         pendente já existente nada é duplicado, a antiga reaparece na
--         Agenda ao reativar.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists mover_card_funil(uuid, etapa_funil, status_acompanhamento_enum, uuid, numeric, frequencia_visita_enum, text);

create or replace function mover_card_funil(
  p_cliente_id uuid,
  p_nova_etapa etapa_funil,
  p_novo_status status_acompanhamento_enum default null,
  p_motivo_perda_id uuid default null,
  p_nova_posicao numeric default null,
  p_frequencia_visita frequencia_visita_enum default null,
  p_cnpj text default null,
  p_motivo_encerramento_id uuid default null
)
returns void
language plpgsql
as $$
declare
  v_row_count int;
  v_proxima_data date;
  v_status_atual status_acompanhamento_enum;
  v_cnpj_gravado text;
  v_encontrado boolean;
  v_cnpj_efetivo text;
  v_razao_social_gravada text;
  v_cep_gravado text;
  v_rua_gravado text;
  v_numero_gravado text;
  v_cidade_gravado text;
  v_estado_gravado text;
  v_endereco_completo boolean;
  v_dia_semana_gravado dia_semana_enum;
  v_semana_do_mes_gravado semana_do_mes_enum;
begin
  if p_novo_status = 'ganho' and p_nova_etapa <> 'primeira_venda' then
    raise exception 'Só é possível marcar como ganho na etapa "1ª venda concluída"';
  end if;

  if p_novo_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório ao marcar um cliente como perdido';
  end if;

  -- Guard novo (D-04): só é possível encerrar a partir da etapa final —
  -- mesmo formato do guard de ganho acima.
  if p_novo_status = 'encerrado' and p_nova_etapa <> 'primeira_venda' then
    raise exception 'Só é possível encerrar um cliente na etapa "1ª venda concluída"';
  end if;

  -- Guard novo (D-03/ENCR-02): motivo de encerramento obrigatório, mesmo
  -- formato do guard de motivo de perda acima.
  if p_novo_status = 'encerrado' and p_motivo_encerramento_id is null then
    raise exception 'Motivo de encerramento é obrigatório ao encerrar um cliente';
  end if;

  -- Leitura do estado atual — mesma consulta da 0026, nenhuma coluna a
  -- mais nem a menos. Passa pela RLS igual ao update abaixo (a função não
  -- eleva privilégio), então para um cliente que o chamador não enxerga
  -- ela não devolve linha — os guards abaixo checam v_encontrado,
  -- preservando o comportamento silencioso de hoje para chamada
  -- cross-vendedor.
  select status_acompanhamento, cnpj, razao_social, cep, rua, numero, cidade, estado,
         dia_semana_visita, semana_do_mes_visita
    into v_status_atual, v_cnpj_gravado, v_razao_social_gravada, v_cep_gravado,
         v_rua_gravado, v_numero_gravado, v_cidade_gravado, v_estado_gravado,
         v_dia_semana_gravado, v_semana_do_mes_gravado
    from clientes
   where id = p_cliente_id;
  v_encontrado := found;

  -- Guard existente (VIS-01), MOVIDO para depois da leitura acima (Fase
  -- 29): reativar um cliente cujo estado ANTERIOR ao encerramento era
  -- "ganho sem frequência" (ex.: todo cliente vindo de "Importar Clientes
  -- Ativos", migration 0027) restaura esse mesmo estado em vez de travar —
  -- a condição nova "v_status_atual is distinct from 'encerrado'" é o que
  -- faz essa exceção existir SOMENTE na reativação. O primeiro ganho de
  -- verdade (status atual nulo ou em_andamento) continua exigindo
  -- frequência, mensagem idêntica à de sempre. Para um cliente fora da RLS
  -- (não encontrado) o status lido é nulo, distinto de 'encerrado', e o
  -- guard continua disparando como hoje.
  if p_novo_status = 'ganho'
     and p_frequencia_visita is null
     and v_status_atual is distinct from 'encerrado' then
    raise exception 'Frequência de visita é obrigatória ao marcar um cliente como ganho';
  end if;

  -- Guard novo (D-04): só é possível encerrar quem já está como ganho —
  -- 'encerrado' também é aceito aqui (idempotência: encerrar de novo quem
  -- já está encerrado não é bloqueado por este guard específico).
  if p_novo_status = 'encerrado'
     and v_encontrado
     and v_status_atual not in ('ganho', 'encerrado') then
    raise exception 'Só é possível encerrar um cliente que já está como ganho';
  end if;

  -- Cálculo do CNPJ efetivo: um valor só de espaços em branco conta como
  -- vazio (não dá para enganar a trava com espaço), e um cliente que já
  -- tem CNPJ gravado na ficha não precisa reenviá-lo para virar ganho.
  v_cnpj_efetivo := coalesce(nullif(btrim(p_cnpj), ''), nullif(btrim(v_cnpj_gravado), ''));

  -- Endereço completo = os cinco campos que a migration 0023 tornou
  -- anuláveis, todos com conteúdo de verdade — não nulo e, aparado, não
  -- vazio. Complemento fica de fora de propósito: sempre foi opcional.
  v_endereco_completo :=
    nullif(btrim(v_cep_gravado), '') is not null
    and nullif(btrim(v_rua_gravado), '') is not null
    and nullif(btrim(v_numero_gravado), '') is not null
    and nullif(btrim(v_cidade_gravado), '') is not null
    and nullif(btrim(v_estado_gravado), '') is not null;

  -- Guard existente (CNPJ-01 + CNPJ-02): IDÊNTICO à 0026 — continua
  -- condicionado a v_status_atual is distinct from 'ganho', então dispara
  -- também na reativação (D-11) e passa pelo CNPJ já gravado.
  if p_novo_status = 'ganho'
     and v_encontrado
     and v_status_atual is distinct from 'ganho'
     and v_cnpj_efetivo is null then
    raise exception 'CNPJ é obrigatório para marcar um cliente como ganho';
  end if;

  -- Guard existente (GANHO-01 + GANHO-02): IDÊNTICO à 0026 — razão social
  -- obrigatória na transição para ganho, inclusive na reativação (D-11).
  if p_novo_status = 'ganho'
     and v_encontrado
     and v_status_atual is distinct from 'ganho'
     and nullif(btrim(v_razao_social_gravada), '') is null then
    raise exception 'Razão social é obrigatória para marcar um cliente como ganho. Complete a ficha do cliente antes.';
  end if;

  -- Guard existente (GANHO-01 + GANHO-02): IDÊNTICO à 0026 — endereço
  -- completo obrigatório na transição para ganho, inclusive na reativação
  -- (D-11).
  if p_novo_status = 'ganho'
     and v_encontrado
     and v_status_atual is distinct from 'ganho'
     and not v_endereco_completo then
    raise exception 'Endereço completo (CEP, rua, número, cidade e estado) é obrigatório para marcar um cliente como ganho. Complete a ficha do cliente antes.';
  end if;

  update clientes
  set etapa = p_nova_etapa,
      status_acompanhamento = coalesce(p_novo_status, status_acompanhamento),
      motivo_perda_id = coalesce(p_motivo_perda_id, motivo_perda_id),
      posicao = coalesce(p_nova_posicao, posicao),
      frequencia_visita = coalesce(p_frequencia_visita, frequencia_visita),
      cnpj = coalesce(nullif(btrim(p_cnpj), ''), cnpj),
      -- Novo (Fase 29): nunca limpo por uma chamada que não o envia, mesmo
      -- precedente de motivo_perda_id/cnpj acima.
      motivo_encerramento_id = coalesce(p_motivo_encerramento_id, motivo_encerramento_id)
  where id = p_cliente_id;

  get diagnostics v_row_count = row_count;

  -- Semeadura da primeira visita — bloco IDÊNTICO à 0026. Ao reativar um
  -- cliente com frequência (D-10), este bloco tanto reaproveita uma visita
  -- pendente já existente (ela nunca sumiu — só deixou de aparecer na
  -- Agenda enquanto o cliente estava encerrado) quanto semeia uma nova
  -- quando não havia nenhuma pendente.
  if p_novo_status = 'ganho' and v_row_count > 0 then
    v_proxima_data := proxima_data_visita(
      (now() at time zone 'America/Sao_Paulo')::date,
      p_frequencia_visita,
      v_dia_semana_gravado,
      v_semana_do_mes_gravado
    );

    if v_proxima_data is not null and not exists (
      select 1 from visitas v
      where v.cliente_id = p_cliente_id
        and v.data_realizada is null
    ) then
      insert into visitas (cliente_id, data_prevista, criado_por)
      values (p_cliente_id, v_proxima_data, (select auth.uid()));
    end if;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. agenda_do_vendedor — mesmas dez colunas de retorno, mesmos nomes/
--    ordem/tipos da 0026 (create or replace troca só o corpo, sem criar
--    sobrecarga nenhuma no PostgREST). Corpo copiado da 0026 acrescentando
--    "and c.status_acompanhamento <> 'encerrado'" ao where das DUAS
--    metades do union all — é isso que tira o cliente encerrado da Lista,
--    do Calendário (pendentes) e do contador do menu, que leem esta mesma
--    função. O histórico de concluídos (agenda_concluidos_do_vendedor,
--    Fase 21) não muda de propósito — histórico continua intacto
--    (ENCR-03).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function agenda_do_vendedor()
returns table (
  origem text,
  item_id uuid,
  cliente_id uuid,
  razao_social text,
  responsavel uuid,
  responsavel_nome text,
  titulo text,
  data date,
  frequencia_visita frequencia_visita_enum,
  proxima_data_sugerida date
)
language sql
stable
as $$
  select
    'prospeccao'::text as origem,
    t.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    tt.nome as titulo,
    t.data_conclusao as data,
    null::frequencia_visita_enum as frequencia_visita,
    null::date as proxima_data_sugerida
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  left join profiles p on p.id = c.responsavel
  where t.concluida = false
    and t.data_conclusao is not null
    and c.status_acompanhamento <> 'encerrado'
  union all
  select
    'visita'::text as origem,
    v.id as item_id,
    c.id as cliente_id,
    c.razao_social,
    c.responsavel,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as responsavel_nome,
    'Visita'::text as titulo,
    v.data_prevista as data,
    c.frequencia_visita,
    proxima_data_visita(
      (now() at time zone 'America/Sao_Paulo')::date,
      c.frequencia_visita,
      c.dia_semana_visita,
      c.semana_do_mes_visita
    ) as proxima_data_sugerida
  from visitas v
  join clientes c on c.id = v.cliente_id
  left join profiles p on p.id = c.responsavel
  where v.data_realizada is null
    and c.status_acompanhamento <> 'encerrado'
  order by 8, 4;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. clientes_encerrados — leitura nova, somente leitura, cópia estrutural
--    de clientes_perdidos (0034) com as trocas do contrato de Encerrados
--    (D-07/D-08). Nenhuma checagem de papel, nenhum filtro de dono, nenhum
--    campo além das sete colunas combinadas — nada de meio de comunicação
--    com a pessoa do cliente (proteção de dados).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function clientes_encerrados(
  p_inicio timestamptz default null,
  p_fim timestamptz default null
)
returns table (
  cliente_id uuid,
  razao_social text,
  nome_fantasia text,
  motivo_encerramento_nome text,
  encerrado_em timestamptz,
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
    me.nome as motivo_encerramento_nome,
    coalesce(h.criado_em, c.atualizado_em) as encerrado_em,
    c.responsavel,
    nullif(trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') as responsavel_nome
  from clientes c
  left join lateral (
    select h2.criado_em
    from historico h2
    where h2.cliente_id = c.id
      and h2.tipo = 'status_acompanhamento'
      and h2.descricao ilike '%"encerrado"%'
    order by h2.criado_em desc
    limit 1
  ) h on true
  left join motivos_encerramento me on me.id = c.motivo_encerramento_id
  left join profiles p on p.id = c.responsavel
  where c.status_acompanhamento = 'encerrado'
    and (p_inicio is null or coalesce(h.criado_em, c.atualizado_em) >= p_inicio)
    and (p_fim is null or coalesce(h.criado_em, c.atualizado_em) < p_fim)
  order by 5 desc, 1 asc;
$$;

-- Lembrete final: NENHUMA função deste arquivo pode ganhar a cláusula de
-- elevação de privilégio. A RLS já existente continua sendo a única
-- fronteira de autorização de tudo que este arquivo cria.
