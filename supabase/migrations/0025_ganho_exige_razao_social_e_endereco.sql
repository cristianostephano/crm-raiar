-- Fase 23 Plano 1: mover_card_funil recriada com dois guards novos de
-- transição — razão social (GANHO-01) e endereço completo (GANHO-01/D-04)
-- — exigidos exatamente no momento em que um cliente passa a ser "ganho",
-- sem nunca bloquear retroativamente quem já é "ganho" hoje (GANHO-02).
--
-- A ASSINATURA DA FUNÇÃO NÃO MUDA: continua com os mesmos 7 parâmetros
-- (p_cliente_id, p_nova_etapa, p_novo_status, p_motivo_perda_id,
-- p_nova_posicao, p_frequencia_visita, p_cnpj), mesmos tipos, mesmos
-- valores padrão, mesmo `returns void`. Os dois guards novos leem colunas
-- já gravadas na linha do cliente — razão social e endereço são campos de
-- cadastro, editados em ClienteDetailSheet, nunca digitados no momento do
-- ganho (D-01/D-03) — então nenhum parâmetro novo é necessário. Como a
-- contagem/tipo de parâmetros não muda, o ritual de `drop function if
-- exists <assinatura antiga>` que as migrations 0013/0018/0022 documentam
-- NÃO é necessário aqui — ele só existe para evitar uma sobrecarga
-- ambígua quando a assinatura muda, e este não é o caso. Um `create or
-- replace function` com a MESMA assinatura substitui só o corpo, sem
-- criar sobrecarga nenhuma no PostgREST.
--
-- CUIDADO CRÍTICO: `create or replace function` substitui o corpo INTEIRO
-- da função — os 4 guards antigos (etapa do ganho, motivo de perda,
-- frequência de visita obrigatória, CNPJ obrigatório na transição), o
-- UPDATE com todos os `coalesce`, e o bloco inteiro de semeadura da
-- primeira visita foram recopiados literalmente da migration 0018, sem
-- mudar uma vírgula.
--
-- O que muda, e só isso:
--   1. O `select ... into` que já trazia status_acompanhamento/cnpj passa
--      a trazer também razao_social e os 5 campos de endereço (cep, rua,
--      numero, cidade, estado), na MESMA consulta, nunca em leituras
--      separadas.
--   2. Um booleano derivado (v_endereco_completo), calculado uma vez só,
--      verdadeiro apenas quando os CINCO campos têm conteúdo de verdade
--      (não nulo e, aparado, não vazio) — `complemento` fica de fora de
--      propósito (D-04), sempre foi opcional no modelo de domínio.
--   3. Um guard novo de razão social, bloco `if` próprio.
--   4. Um guard novo de endereço completo, outro bloco `if` próprio,
--      separado do guard de razão social — cada um com sua própria
--      mensagem, para a tela poder dizer ao vendedor qual campo falta.
--   5. Nenhum dos dois guards novos grava nada: o UPDATE continua sem
--      tocar em razao_social nem em nenhum campo de endereço — a função
--      nunca recebeu esses valores como parâmetro e não passa a receber.
--
-- Grandfathering (GANHO-02, D-02): a condição de status atual diferente
-- de 'ganho' é o único mecanismo — e o único — que entrega o
-- grandfathering, exatamente como a migration 0018 já documentou para o
-- CNPJ-02. Removê-la de qualquer um dos dois guards novos torna a trava
-- retroativa e passa a bloquear clientes que já eram "ganho" antes desta
-- versão — proibido.
--
-- A branch de endereço só é alcançável porque a migration 0023 tornou as
-- 5 colunas anuláveis; a de razão social, porque a migration 0024 (deste
-- mesmo plano) tornou razao_social anulável.
--
-- Nenhuma constraint CHECK nova é criada sobre razao_social nem sobre os
-- campos de endereço: a tabela tem linhas "ganho" incompletas em produção
-- e uma exigência retroativa invalidaria essas linhas e abortaria o push
-- inteiro — mesmo motivo, palavra por palavra, que a 0018 registrou para
-- o CNPJ.
--
-- Referência cruzada (T-23-05): `importar_clientes_ativos_lote` (Fase 25)
-- vai fazer INSERT direto em clientes, sem passar por mover_card_funil, e
-- por isso vai precisar copiar estes dois guards verbatim. Sem essa
-- cópia escrita aqui, a importação de ativos vira uma porta dos fundos
-- silenciosa para clientes ganho incompletos.
--
-- A função continua rodando como o chamador (SEM cláusula de elevação de
-- privilégio) — a RLS segue sendo a única fronteira de autorização. Esta
-- fase não adiciona nenhuma exceção nova às 4 já documentadas na
-- STATE.md.
--
-- Source: .planning/phases/23-raz-o-social-opcional-e-trava-do-ganho-ampliada/23-01-PLAN.md
--         supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql (molde literal)
--         supabase/migrations/0024_razao_social_opcional.sql (pré-requisito, mesmo plano)

create or replace function mover_card_funil(
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
  v_razao_social_gravada text;
  v_cep_gravado text;
  v_rua_gravado text;
  v_numero_gravado text;
  v_cidade_gravado text;
  v_estado_gravado text;
  v_endereco_completo boolean;
begin
  if p_novo_status = 'ganho' and p_nova_etapa <> 'primeira_venda' then
    raise exception 'Só é possível marcar como ganho na etapa "1ª venda concluída"';
  end if;

  if p_novo_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório ao marcar um cliente como perdido';
  end if;

  -- Guard existente (VIS-01): frequência de visita obrigatória ao ganho —
  -- copiado literalmente da 0013/0018, sem mudar uma vírgula da mensagem.
  if p_novo_status = 'ganho' and p_frequencia_visita is null then
    raise exception 'Frequência de visita é obrigatória ao marcar um cliente como ganho';
  end if;

  -- Leitura do estado atual, agora mais larga: além de status/cnpj (0018),
  -- traz razão social e os 5 campos de endereço na MESMA consulta — nunca
  -- em leituras separadas. Passa pela RLS igual ao UPDATE abaixo (a
  -- função não eleva privilégio), então para um cliente que o chamador
  -- não enxerga ela não devolve linha — por isso os guards abaixo checam
  -- v_encontrado, preservando o comportamento silencioso de hoje para
  -- chamada cross-vendedor (rls-visitas.test.ts, caso "rpc").
  select status_acompanhamento, cnpj, razao_social, cep, rua, numero, cidade, estado
    into v_status_atual, v_cnpj_gravado, v_razao_social_gravada, v_cep_gravado,
         v_rua_gravado, v_numero_gravado, v_cidade_gravado, v_estado_gravado
    from clientes
   where id = p_cliente_id;
  v_encontrado := found;

  -- Cálculo do CNPJ efetivo: um valor só de espaços em branco conta como
  -- vazio (não dá para enganar a trava com espaço), e um cliente que já
  -- tem CNPJ gravado na ficha não precisa reenviá-lo para virar ganho.
  v_cnpj_efetivo := coalesce(nullif(btrim(p_cnpj), ''), nullif(btrim(v_cnpj_gravado), ''));

  -- Endereço completo (D-04) = os CINCO campos que a migration 0023
  -- tornou anuláveis (cep, rua, numero, cidade, estado) todos com
  -- conteúdo de verdade — não nulo E, aparado, não vazio. `complemento`
  -- fica de fora de propósito: sempre foi opcional no modelo de domínio.
  -- Calculado uma vez só, como uma expressão só, nunca como cinco `if`
  -- espalhados pelo corpo da função.
  v_endereco_completo :=
    nullif(btrim(v_cep_gravado), '') is not null
    and nullif(btrim(v_rua_gravado), '') is not null
    and nullif(btrim(v_numero_gravado), '') is not null
    and nullif(btrim(v_cidade_gravado), '') is not null
    and nullif(btrim(v_estado_gravado), '') is not null;

  -- Guard existente (CNPJ-01 + CNPJ-02): levanta exceção quando, e
  -- SOMENTE quando, as quatro condições valerem juntas — a transição está
  -- pedindo ganho, a linha foi encontrada, o status ATUAL do cliente é
  -- diferente do valor 'ganho' (cobre também status nulo/ausente), e o
  -- CNPJ efetivo é vazio. A terceira condição é o coração do CNPJ-02: se
  -- ela for removida, a trava vira retroativa e passa a bloquear os
  -- clientes que já estavam 'ganho' antes desta versão — proibido
  -- (grandfathering).
  if p_novo_status = 'ganho'
     and v_encontrado
     and v_status_atual is distinct from 'ganho'
     and v_cnpj_efetivo is null then
    raise exception 'CNPJ é obrigatório para marcar um cliente como ganho';
  end if;

  -- Guard novo (GANHO-01 + GANHO-02): razão social obrigatória na
  -- TRANSIÇÃO para ganho, mesma forma de três condições somadas do guard
  -- de CNPJ acima, mais a razão social gravada estando vazia (nula ou só
  -- espaços). Bloco separado do guard de endereço abaixo — mesma
  -- disciplina que já faz o guard de frequência (0013) e o de CNPJ (0018)
  -- conviverem como blocos independentes — para a tela poder dizer ao
  -- vendedor qual campo especificamente está faltando.
  if p_novo_status = 'ganho'
     and v_encontrado
     and v_status_atual is distinct from 'ganho'
     and nullif(btrim(v_razao_social_gravada), '') is null then
    raise exception 'Razão social é obrigatória para marcar um cliente como ganho. Complete a ficha do cliente antes.';
  end if;

  -- Guard novo (GANHO-01 + GANHO-02): endereço completo obrigatório na
  -- TRANSIÇÃO para ganho, mesmas três condições de transição do guard
  -- acima, mais not v_endereco_completo.
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
