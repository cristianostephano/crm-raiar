-- Fase 24 Plano 1: dia fixo na recorrência de visita — dois tipos
-- enumerados novos (dia da semana e semana do mês), duas colunas opcionais
-- em `clientes`, duas funções auxiliares puras de calendário, a reescrita
-- de `proxima_data_visita` com os dois caminhos (âncora presente ou
-- ausente) e os dois chamadores existentes (`agenda_do_vendedor`,
-- `mover_card_funil`) passando a âncora adiante.
--
-- D-01 (decisão travada da Fase 24): um cliente ativo com frequência
-- definida mas SEM dia fixo continua recebendo a sugestão pelo cálculo
-- ANTIGO (dias corridos a partir da conclusão) — o caminho antigo é
-- avaliado PRIMEIRO dentro de `proxima_data_visita` e devolvido literal,
-- sem mudar uma vírgula em relação à migration 0013. Uma âncora mensal
-- pela metade (dia da semana escolhido, semana do mês ainda não) também
-- cai nesse caminho — do contrário a sugestão viraria nula.
--
-- Armadilha travada: o Postgres tem dois campos de extração de dia da
-- semana — um começa no domingo em zero (o usado aqui, em todos os
-- pontos) e o outro segue a convenção internacional começando na segunda
-- em um. Misturar os dois desloca todo resultado em um dia, sem erro
-- nenhum. Este arquivo usa exclusivamente o primeiro.
--
-- Pitfall de fuso (já documentado pelo projeto): a base de data dos dois
-- chamadores continua sendo o dia corrente no fuso de São Paulo, nunca a
-- data crua do servidor — depois das 21h locais o dia já teria virado o
-- seguinte no UTC em que o banco roda.
--
-- `proxima_data_visita` muda a contagem de parâmetros de 2 para 4, então a
-- assinatura antiga é removida ANTES da criação da nova, no mesmo arquivo
-- — o mesmo ritual que as migrations 0013/0018/0022 documentam. Sem isso
-- as duas assinaturas coexistiriam como sobrecarga ambígua e toda chamada
-- existente do app passaria a falhar no PostgREST.
--
-- Nenhuma exceção nova de privilégio elevado é criada: as três funções
-- deste arquivo continuam rodando como o chamador, sem cláusula de
-- elevação — o projeto continua com exatamente as quatro exceções já
-- documentadas na STATE.md. Nenhuma policy nova é criada: as duas colunas
-- novas vivem em `clientes`, já coberta pelas quatro policies da migration
-- 0002 (vendedor lê/edita as próprias linhas, supervisor todas). Nenhuma
-- linha existente de `visitas` é atualizada por esta migration — uma
-- próxima visita já marcada continua exatamente como está (D-04).
--
-- Source: .planning/phases/24-dia-fixo-na-recorr-ncia-de-visita/24-01-PLAN.md
--         .planning/phases/24-dia-fixo-na-recorr-ncia-de-visita/24-RESEARCH.md
--         supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql (proxima_data_visita original)
--         supabase/migrations/0015_conclusao_com_resumo.sql (corpo atual de agenda_do_vendedor)
--         supabase/migrations/0025_ganho_exige_razao_social_e_endereco.sql (corpo atual de mover_card_funil)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Dois tipos enumerados novos.
--
--    `dia_semana_enum` e `semana_do_mes_enum` compartilham por acaso os
--    rótulos 'segunda' e 'quarta' com significados diferentes (dia da
--    semana x ordem da semana no mês). Por serem tipos distintos, o
--    Postgres nunca confunde os dois — mas quem lê o SQL pode, então todo
--    parâmetro carrega o tipo no nome (p_dia_semana x p_semana_do_mes).
-- ─────────────────────────────────────────────────────────────────────────
create type dia_semana_enum as enum (
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado'
);

-- Vocabulário fechado de propósito em 1ª/2ª/3ª/4ª/Última: as quatro
-- primeiras ocorrências de qualquer dia da semana existem em todo mês, sem
-- exceção; só a quinta pode faltar, e ela não entra no vocabulário.
create type semana_do_mes_enum as enum (
  'primeira',
  'segunda',
  'terceira',
  'quarta',
  'ultima'
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Duas colunas novas em `clientes`, ambas OPCIONAIS — mesmo motivo da
--    migration 0013: a tabela já tem clientes ganho em produção e nenhum
--    deles tem dia fixo (o conceito nasce agora); uma exigência
--    retroativa abortaria a aplicação da migration. Nenhuma constraint de
--    validação nova. Nenhuma policy nova é criada aqui: as duas colunas
--    vivem em `clientes`, já coberta pelas quatro policies da migration
--    0002 (vendedor lê/edita as próprias linhas, supervisor todas).
-- ─────────────────────────────────────────────────────────────────────────
alter table clientes
  add column dia_semana_visita dia_semana_enum,
  add column semana_do_mes_visita semana_do_mes_enum;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. dia_semana_para_dow — única tradução do vocabulário para número em
--    todo o projeto. Derivar o número a partir da ordem de declaração do
--    tipo enumerado é proibido — a ordem interna não é um índice público.
--    Convenção numérica: a mesma que o Postgres usa ao extrair o dia da
--    semana de uma data com o campo que começa no domingo (zero) — nunca
--    o campo que segue a convenção internacional começando na segunda.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function dia_semana_para_dow(p_dia dia_semana_enum)
returns int
language sql
immutable
as $$
  select case p_dia
    when 'domingo' then 0
    when 'segunda' then 1
    when 'terca'   then 2
    when 'quarta'  then 3
    when 'quinta'  then 4
    when 'sexta'   then 5
    when 'sabado'  then 6
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. nth_dia_semana_do_mes — recebe ano e mês como inteiros (não uma
--    data), justamente para poder ser chamada duas vezes (o mês da base e
--    o mês seguinte) sem redescobrir limites de mês.
--
--    'última' NUNCA é escrita como "a quarta ocorrência, ou a quinta se
--    existir" — é contada PARA TRÁS a partir do último dia do mês, o que é
--    correto em 100% dos meses e não precisa de checagem de existência
--    nenhuma. Caso concreto: em outubro de 2026 a quinta-feira cai nos
--    dias 1, 8, 15, 22 e 29 — a "4ª quinta" é dia 22 e a "última quinta" é
--    dia 29, sete dias de diferença.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function nth_dia_semana_do_mes(
  p_ano int,
  p_mes int,
  p_dow int,
  p_semana semana_do_mes_enum
)
returns date
language sql
immutable
as $$
  with limites as (
    select
      make_date(p_ano, p_mes, 1) as primeiro_dia,
      (make_date(p_ano, p_mes, 1) + interval '1 month - 1 day')::date as ultimo_dia
  ),
  ocorrencias as (
    select
      primeiro_dia + (((p_dow - extract(dow from primeiro_dia)::int) + 7) % 7) as primeira_ocorrencia,
      ultimo_dia
    from limites
  )
  select case p_semana
    when 'primeira' then primeira_ocorrencia
    when 'segunda'  then primeira_ocorrencia + 7
    when 'terceira' then primeira_ocorrencia + 14
    when 'quarta'   then primeira_ocorrencia + 21
    when 'ultima'   then ultimo_dia - (((extract(dow from ultimo_dia)::int - p_dow) + 7) % 7)
  end
  from ocorrencias;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. proxima_data_visita reescrita — a contagem de parâmetros muda de 2
--    para 4: a assinatura antiga precisa ser removida ANTES da criação da
--    nova, no mesmo arquivo, senão as duas coexistem como sobrecarga
--    ambígua e toda chamada existente do app passa a falhar. Os dois
--    parâmetros novos entram no fim, ambos sem valor padrão informado nas
--    chamadas antigas de dois argumentos.
--
--    Troca deliberada de `language sql` para `language plpgsql`: a
--    ramificação com variáveis nomeadas não cabe mais numa expressão só.
--    Continua `returns date` e `immutable`.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists proxima_data_visita(date, frequencia_visita_enum);

create function proxima_data_visita(
  p_base date,
  p_frequencia frequencia_visita_enum,
  p_dia_semana dia_semana_enum default null,
  p_semana_do_mes semana_do_mes_enum default null
)
returns date
language plpgsql
immutable
as $$
declare
  v_dow int;
  v_offset int;
  v_candidata date;
  v_ano int;
  v_mes int;
begin
  -- Caminho antigo (D-01), avaliado PRIMEIRO. Cobre duas condições: o dia
  -- da semana não foi informado, OU a frequência é mensal e a semana do
  -- mês ainda não foi informada — uma âncora mensal pela metade se
  -- comporta como âncora ausente, para nunca devolver sugestão nula à
  -- Agenda enquanto o dia fixo não estiver completo. Devolução idêntica,
  -- vírgula por vírgula, à migration 0013.
  if p_dia_semana is null or (p_frequencia = 'mensal' and p_semana_do_mes is null) then
    return case p_frequencia
      when 'semanal' then (p_base + interval '7 days')::date
      when 'quinzenal' then (p_base + interval '14 days')::date
      when 'mensal' then (p_base + interval '1 month')::date
      else null
    end;
  end if;

  if p_frequencia is null or p_frequencia = 'nenhuma' then
    return null;
  end if;

  v_dow := dia_semana_para_dow(p_dia_semana);

  if p_frequencia in ('semanal', 'quinzenal') then
    -- Deslocamento sempre entre 1 e 7 (zero vira sete): a data devolvida
    -- é sempre estritamente maior que a base, por construção — a mesma
    -- garantia que o cálculo antigo tinha de graça ao somar um intervalo
    -- positivo a uma data. Quinzenal soma mais 7 dias ao resultado
    -- semanal: pula uma ocorrência e cai na seguinte.
    v_offset := ((v_dow - extract(dow from p_base)::int) + 7) % 7;
    if v_offset = 0 then
      v_offset := 7;
    end if;
    v_candidata := p_base + v_offset;

    if p_frequencia = 'quinzenal' then
      v_candidata := v_candidata + 7;
    end if;

    return v_candidata;
  end if;

  -- Ramo mensal — o único que precisa da checagem explícita de "não pode
  -- ser hoje nem antes": nos ramos semanal/quinzenal essa garantia já vem
  -- do deslocamento nunca ser zero. Se a candidata do mês da base já
  -- passou ou cai exatamente na base, avança um mês (dezembro tratado
  -- explicitamente).
  v_ano := extract(year from p_base)::int;
  v_mes := extract(month from p_base)::int;
  v_candidata := nth_dia_semana_do_mes(v_ano, v_mes, v_dow, p_semana_do_mes);

  if v_candidata <= p_base then
    if v_mes = 12 then
      v_ano := v_ano + 1;
      v_mes := 1;
    else
      v_mes := v_mes + 1;
    end if;
    v_candidata := nth_dia_semana_do_mes(v_ano, v_mes, v_dow, p_semana_do_mes);
  end if;

  return v_candidata;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Os dois chamadores existentes passam a âncora adiante.
-- ─────────────────────────────────────────────────────────────────────────

-- 6a. agenda_do_vendedor — o conjunto de colunas de retorno NÃO muda (as
--     mesmas dez colunas, mesmos nomes, mesma ordem), então a remoção
--     prévia que a migration 0015 precisou fazer para esta função não é
--     necessária aqui: create or replace troca só o corpo, sem criar
--     sobrecarga nenhuma no PostgREST. Corpo copiado da migration 0015
--     sem outra alteração — as duas metades da união, todos os junções e
--     filtros, mesma ordenação por posição (8, depois 4). A única mudança
--     real: a chamada de proxima_data_visita passa a receber também as
--     duas colunas novas do cliente.
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
    -- Coluna não se aplica a prospecção — cast explícito para o tipo do
    -- enum, senão o union all abaixo recusa por tipos incompatíveis entre
    -- as duas metades.
    null::frequencia_visita_enum as frequencia_visita,
    null::date as proxima_data_sugerida
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  left join profiles p on p.id = c.responsavel
  where t.concluida = false
    and t.data_conclusao is not null
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
    -- A tela recebe a data já calculada pelo banco e nunca refaz a conta —
    -- a autoridade do cálculo continua sendo uma só no projeto inteiro.
    -- Agora passa também dia_semana_visita e semana_do_mes_visita do
    -- cliente, para a sugestão mirar o dia fixo quando ele existir.
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
  -- Ordenação decidida aqui e em nenhum outro lugar: posição 8 = data,
  -- posição 4 = razão social como desempate. As colunas de retorno não
  -- mudaram de posição em relação à 0015.
  order by 8, 4;
$$;
-- No `security definer` — não adicionar.

-- 6b. mover_card_funil — a assinatura NÃO muda: continua com os mesmos 7
--     parâmetros da migration 0025 (mesmos nomes, tipos, valores padrão,
--     `returns void`), então nada precisa ser removido antes. Corpo
--     recopiado da 0025 sem mudar uma vírgula: os seis guards (etapa do
--     ganho, motivo de perda, frequência obrigatória, CNPJ efetivo na
--     transição, razão social na transição, endereço completo na
--     transição), o cálculo do CNPJ efetivo, o booleano de endereço
--     completo, o update com todos os coalesce, e o bloco inteiro de
--     semeadura da primeira visita.
--
--     Mudam DUAS coisas, e só elas:
--       1. A leitura de estado atual passa a trazer também
--          dia_semana_visita e semana_do_mes_visita, na MESMA consulta,
--          em duas variáveis novas (v_dia_semana_gravado e
--          v_semana_do_mes_gravado).
--       2. A chamada de proxima_data_visita dentro do bloco de semeadura
--          passa essas duas variáveis como terceiro e quarto argumentos.
--
--     Por quê: um cliente que já era ganho (com dia fixo definido),
--     voltou para em andamento e é marcado como ganho de novo chega neste
--     bloco com as duas colunas já preenchidas — e a primeira visita
--     precisa cair no dia fixo, não sete dias à frente. O próprio guard de
--     transição abaixo prova que esse caminho é alcançável.
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
  v_dia_semana_gravado dia_semana_enum;
  v_semana_do_mes_gravado semana_do_mes_enum;
begin
  if p_novo_status = 'ganho' and p_nova_etapa <> 'primeira_venda' then
    raise exception 'Só é possível marcar como ganho na etapa "1ª venda concluída"';
  end if;

  if p_novo_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório ao marcar um cliente como perdido';
  end if;

  -- Guard existente (VIS-01): frequência de visita obrigatória ao ganho —
  -- copiado literalmente da 0013/0018/0025, sem mudar uma vírgula da
  -- mensagem.
  if p_novo_status = 'ganho' and p_frequencia_visita is null then
    raise exception 'Frequência de visita é obrigatória ao marcar um cliente como ganho';
  end if;

  -- Leitura do estado atual, agora mais larga (Fase 24): além de
  -- status/cnpj/razão social/endereço (0018/0025), traz também
  -- dia_semana_visita e semana_do_mes_visita na MESMA consulta — nunca em
  -- leituras separadas. Passa pela RLS igual ao update abaixo (a função
  -- não eleva privilégio), então para um cliente que o chamador não
  -- enxerga ela não devolve linha — por isso os guards abaixo checam
  -- v_encontrado, preservando o comportamento silencioso de hoje para
  -- chamada cross-vendedor.
  select status_acompanhamento, cnpj, razao_social, cep, rua, numero, cidade, estado,
         dia_semana_visita, semana_do_mes_visita
    into v_status_atual, v_cnpj_gravado, v_razao_social_gravada, v_cep_gravado,
         v_rua_gravado, v_numero_gravado, v_cidade_gravado, v_estado_gravado,
         v_dia_semana_gravado, v_semana_do_mes_gravado
    from clientes
   where id = p_cliente_id;
  v_encontrado := found;

  -- Cálculo do CNPJ efetivo: um valor só de espaços em branco conta como
  -- vazio (não dá para enganar a trava com espaço), e um cliente que já
  -- tem CNPJ gravado na ficha não precisa reenviá-lo para virar ganho.
  v_cnpj_efetivo := coalesce(nullif(btrim(p_cnpj), ''), nullif(btrim(v_cnpj_gravado), ''));

  -- Endereço completo = os CINCO campos que a migration 0023 tornou
  -- anuláveis (cep, rua, numero, cidade, estado) todos com conteúdo de
  -- verdade — não nulo e, aparado, não vazio. `complemento` fica de fora
  -- de propósito: sempre foi opcional no modelo de domínio. Calculado uma
  -- vez só, como uma expressão só, nunca como cinco `if` espalhados pelo
  -- corpo da função.
  v_endereco_completo :=
    nullif(btrim(v_cep_gravado), '') is not null
    and nullif(btrim(v_rua_gravado), '') is not null
    and nullif(btrim(v_numero_gravado), '') is not null
    and nullif(btrim(v_cidade_gravado), '') is not null
    and nullif(btrim(v_estado_gravado), '') is not null;

  -- Guard existente (CNPJ-01 + CNPJ-02): dispara quando, e SOMENTE quando,
  -- as quatro condições valerem juntas — a transição está pedindo ganho, a
  -- linha foi encontrada, o status atual do cliente é diferente de
  -- 'ganho' (cobre também status nulo/ausente), e o CNPJ efetivo é vazio.
  -- A terceira condição é o coração do CNPJ-02: se ela for removida, a
  -- trava vira retroativa e passa a bloquear os clientes que já estavam
  -- 'ganho' antes desta versão — proibido (grandfathering).
  if p_novo_status = 'ganho'
     and v_encontrado
     and v_status_atual is distinct from 'ganho'
     and v_cnpj_efetivo is null then
    raise exception 'CNPJ é obrigatório para marcar um cliente como ganho';
  end if;

  -- Guard existente (GANHO-01 + GANHO-02): razão social obrigatória na
  -- transição para ganho, mesma forma de três condições somadas do guard
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

  -- Guard existente (GANHO-01 + GANHO-02): endereço completo obrigatório
  -- na transição para ganho, mesmas três condições de transição do guard
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
    -- 21h no horário local, o dia já teria virado o seguinte). Passa
    -- também as duas colunas de âncora já gravadas no cliente (Fase 24) —
    -- quase sempre nulas no primeiro ganho, mas preenchidas no caso de
    -- re-ganho após ter voltado para em andamento.
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
