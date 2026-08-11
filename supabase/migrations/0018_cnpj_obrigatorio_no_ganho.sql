-- Phase 18 Plan 1: fundação de banco do marco v1.4 (CNPJ Obrigatório no
-- Ganho) — mover_card_funil recriado com o 7º parâmetro p_cnpj e um guard
-- que exige CNPJ não-vazio EXATAMENTE no momento em que um cliente passa a
-- ser "ganho" (CNPJ-01), sem nunca bloquear retroativamente quem já é
-- "ganho" hoje sem CNPJ (CNPJ-02).
--
-- Esta migration NÃO muda estrutura de tabela nenhuma — nenhuma coluna
-- nova, nenhuma constraint de obrigatoriedade ou de validação sobre
-- clientes.cnpj. A coluna já existe (nullable) desde a 0013 e continua
-- deliberadamente permissiva: a tabela tem linhas "ganho" em produção sem
-- CNPJ, e uma obrigatoriedade retroativa via NOT NULL/CHECK invalidaria
-- essas linhas e abortaria o `supabase db push` (Pitfall 3 — mesmo motivo
-- que levou frequencia_visita a nascer permissiva na 0013).
--
-- O guard novo é condicionado à TRANSIÇÃO para ganho (status atual
-- DIFERENTE de 'ganho' e o novo status sendo 'ganho'), nunca ao ESTADO
-- "é ganho". É essa condição — e só ela — que entrega o grandfathering do
-- CNPJ-02: nenhum cliente já "ganho" hoje é bloqueado, nem numa chamada de
-- arrastar card nem numa chamada que reafirme p_novo_status = 'ganho'.
--
-- A função continua rodando como o chamador (SEM cláusula de elevação de
-- privilégio) — a RLS segue sendo a única fronteira de autorização. Este
-- marco NÃO adiciona nenhuma exceção nova de privilégio elevado às três já
-- documentadas no projeto (is_supervisor, desativar/reativar_membro_equipe,
-- e cidades_com_clientes_por_estado — ver STATE.md).
--
-- Nenhuma validação de formato ou de dígito verificador de CNPJ existe nem
-- deve ser adicionada aqui — decisão de escopo explícita do dono do
-- projeto (D-2). O sistema exige só presença (não-vazio, aparado), nunca
-- formato.
--
-- Source: .planning/phases/18-cnpj-obrigat-rio-no-ganho/18-01-PLAN.md
--         supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql
--           (molde literal do guard/UPDATE/semeadura de visita)
--         .planning/STATE.md (Blockers: "Grandfathering (Fase 18)")

-- ─────────────────────────────────────────────────────────────────────────
-- mover_card_funil recriado com o 7º parâmetro p_cnpj.
-- ATENÇÃO: no Postgres, create (or replace) function com um número
-- diferente de parâmetros NÃO substitui a função — cria uma SOBRECARGA.
-- Se as duas assinaturas coexistirem, toda chamada existente do app
-- (moverCard, marcarStatus) passa a falhar por ambiguidade no PostgREST —
-- é exatamente o risco que a Fase 13 já documentou ao ir de 5 para 6
-- parâmetros. Por isso o drop explícito da assinatura antiga de SEIS
-- parâmetros ANTES do create de sete, na mesma transação da migration (sem
-- janela em que a função não exista). Nenhuma view/trigger depende desta
-- função, então o drop é seguro.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists mover_card_funil(uuid, etapa_funil, status_acompanhamento_enum, uuid, numeric, frequencia_visita_enum);

create function mover_card_funil(
  p_cliente_id uuid,
  p_nova_etapa etapa_funil,
  p_novo_status status_acompanhamento_enum default null,
  p_motivo_perda_id uuid default null,
  p_nova_posicao numeric default null,
  p_frequencia_visita frequencia_visita_enum default null,
  p_cnpj text default null
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
begin
  if p_novo_status = 'ganho' and p_nova_etapa <> 'primeira_venda' then
    raise exception 'Só é possível marcar como ganho na etapa "1ª venda concluída"';
  end if;

  if p_novo_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório ao marcar um cliente como perdido';
  end if;

  -- Guard existente (VIS-01): frequência de visita obrigatória ao ganho —
  -- copiado literalmente da 0013, sem mudar uma vírgula da mensagem.
  if p_novo_status = 'ganho' and p_frequencia_visita is null then
    raise exception 'Frequência de visita é obrigatória ao marcar um cliente como ganho';
  end if;

  -- Leitura do estado atual (novidade): esta leitura passa pela RLS igual
  -- ao UPDATE abaixo (a função não eleva privilégio), então para um cliente
  -- que o chamador não enxerga ela não devolve linha — e é por isso que o
  -- guard de CNPJ abaixo só dispara quando a linha foi encontrada: sem
  -- linha, o UPDATE afeta zero linhas de qualquer jeito e o comportamento
  -- silencioso de hoje para chamada cross-vendedor fica preservado (há um
  -- teste de RLS — rls-visitas.test.ts caso "rpc" — que depende disso).
  select status_acompanhamento, cnpj
    into v_status_atual, v_cnpj_gravado
    from clientes
   where id = p_cliente_id;
  v_encontrado := found;

  -- Cálculo do CNPJ efetivo: um valor só de espaços em branco conta como
  -- vazio (não dá para enganar a trava com espaço), e um cliente que já tem
  -- CNPJ gravado na ficha não precisa reenviá-lo para virar ganho.
  v_cnpj_efetivo := coalesce(nullif(btrim(p_cnpj), ''), nullif(btrim(v_cnpj_gravado), ''));

  -- Guard novo (CNPJ-01 + CNPJ-02): levanta exceção quando, e SOMENTE
  -- quando, as quatro condições valerem juntas — a transição está pedindo
  -- ganho, a linha foi encontrada, o status ATUAL do cliente é diferente de
  -- 'ganho' (is distinct from cobre também status nulo/ausente), e o CNPJ
  -- efetivo é vazio. A terceira condição é o coração do CNPJ-02: se ela for
  -- removida, a trava vira retroativa e passa a bloquear os clientes que já
  -- estavam 'ganho' antes desta versão — exatamente o que o dono do projeto
  -- proibiu (grandfathering).
  if p_novo_status = 'ganho'
     and v_encontrado
     and v_status_atual is distinct from 'ganho'
     and v_cnpj_efetivo is null then
    raise exception 'CNPJ é obrigatório para marcar um cliente como ganho';
  end if;

  update clientes
  set etapa = p_nova_etapa,
      status_acompanhamento = coalesce(p_novo_status, status_acompanhamento),
      motivo_perda_id = coalesce(p_motivo_perda_id, motivo_perda_id),
      posicao = coalesce(p_nova_posicao, posicao),
      frequencia_visita = coalesce(p_frequencia_visita, frequencia_visita),
      -- Mesma forma de motivo_perda_id/frequencia_visita: uma chamada de
      -- arrastar card, que não manda CNPJ, JAMAIS apaga o valor já gravado.
      cnpj = coalesce(nullif(btrim(p_cnpj), ''), cnpj)
  where id = p_cliente_id;

  get diagnostics v_row_count = row_count;

  -- Semeadura da primeira visita: só quando o ganho realmente aconteceu
  -- (row_count > 0 — se a RLS não deixou o chamador alterar aquele
  -- cliente, nada é semeado, o que impede um vendedor de criar visita no
  -- cliente de outro), a frequência escolhida produz uma data (nenhuma
  -- devolve nulo), e ainda não existe uma visita pendente daquele cliente
  -- (idempotência: remarcar ganho não duplica a pendente).
  if p_novo_status = 'ganho' and v_row_count > 0 then
    -- A base do cálculo tem que ser o dia corrente no fuso de São Paulo,
    -- nunca a data crua do servidor (o banco roda em UTC e, depois das
    -- 21h no horário local, o dia já teria virado o seguinte — Pitfall 1).
    v_proxima_data := proxima_data_visita((now() at time zone 'America/Sao_Paulo')::date, p_frequencia_visita);

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
