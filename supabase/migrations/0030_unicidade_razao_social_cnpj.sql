-- Quick task 260914-k3g: corrige a causa raiz de um bug de schema real,
-- confirmado ao vivo. `clientes.razao_social` nasceu `text not null unique`
-- na migration 0002 (`clientes_razao_social_key`, linha 107) e a migration
-- 0024 preservou explicitamente essa unicidade (só a obrigatoriedade de
-- valor caiu). Essa constraint faz o Postgres recusar SILENCIOSAMENTE
-- qualquer segunda linha com a mesma razão social — mesmo com CNPJ
-- diferente — via `on conflict (razao_social) do nothing` nas duas RPCs de
-- importação em massa (`importar_clientes_lote`, `importar_clientes_ativos_lote`).
-- Numa importação real de "Clientes Ativos", 743 de 1755 linhas foram
-- puladas como "duplicado" só porque são lojas de rede (Carrefour, Outback)
-- com razão social igual e CNPJ diferente por filial.
--
-- Este é o MESMO problema de negócio já corrigido na camada de aplicação
-- pela quick task 260914-j8g (`lib/importacao/dedupe.ts` — só mudou o AVISO
-- da tela de revisão). Esta migration corrige a trava REAL, no banco.
--
-- Regra de negócio confirmada pelo dono do projeto (mesma regra de
-- 260914-j8g, agora também no banco):
--   - razão social igual + CNPJ igual (ambos presentes)   -> continua colidindo
--   - razão social igual + CNPJ diferente (ambos presentes) -> NÃO colide mais
--     (o bug real corrigido aqui)
--   - razão social igual + CNPJ ausente em um ou nos dois lados -> continua
--     colidindo pelo nome (sem CNPJ não há como desambiguar)
--
-- Por que um TRIGGER, e não só dois índices únicos parciais: a regra
-- "colide quando CNPJ ausente de QUALQUER lado" faz o CNPJ nulo se comportar
-- como um "coringa" que colide com QUALQUER outro CNPJ (inclusive CNPJs
-- diferentes entre si) do mesmo razão social — isso NÃO é uma relação de
-- equivalência transitiva (A nulo colide com B="111" e com C="222", mas B e
-- C não colidem entre si), então não é representável por nenhuma combinação
-- de índices únicos parciais (índices exigem uma chave fixa comparável por
-- linha; não existe chave que "colida com tudo"). A única forma correta é
-- uma checagem cruzada (EXISTS) — daqui o trigger.
--
-- Por que o trigger precisa levantar ERRCODE 23505 (nunca "pular" a linha
-- em silêncio): `app/actions/clientes.ts` (`createCliente` e
-- `updateCliente`, comentário "D-06") já captura `error.code === "23505"` e
-- mapeia para `{ code: "duplicate_razao_social" }` — comportamento coberto
-- por `tests/clientes/cliente-actions.test.ts` e
-- `tests/clientes/rls-clientes.test.ts`. Um trigger que retornasse `NULL`
-- (pular a linha) faria esses dois inserts "terem sucesso" sem gravar nada,
-- quebrando a UX de erro sem gerar nenhum sinal. Por isso o trigger
-- `RAISE EXCEPTION` com `USING ERRCODE = '23505'` — mesmo código, ZERO
-- mudança de código TypeScript.
--
-- Por que as RPCs de importação NÃO podem simplesmente confiar no trigger
-- (pré-filtro é obrigatório): uma exceção levantada por um trigger
-- `BEFORE INSERT` dentro de um `INSERT` de múltiplas linhas aborta a
-- INSTRUÇÃO INTEIRA (não só a linha), e `ON CONFLICT DO NOTHING` NÃO
-- intercepta exceções de trigger (só violações de constraint/índice real).
-- Se uma RPC deixasse uma linha colidente chegar ao INSERT, ela derrubaria o
-- LOTE INTEIRO — exatamente o que os Pitfalls A5/A6 (documentados desde a
-- migration 0004) proíbem. Por isso as duas RPCs pré-filtram candidatos
-- ANTES do INSERT: (a) contra a tabela (`NOT EXISTS` usando
-- `razao_social_cnpj_colide`) e (b) contra linhas ANTERIORES do MESMO lote,
-- usando `jsonb_to_recordset(...) WITH ORDINALITY` para numerar as linhas
-- na ordem de entrada e comparar só contra ordinais menores (evita que duas
-- linhas idênticas do mesmo lote se auto-excluam mutuamente, e evita que um
-- "vizinho" nulo do lote aborte o lote inteiro). Com o pré-filtro correto,
-- nenhuma linha que chega ao INSERT pode disparar o trigger — ele vira um
-- backstop morto para o caminho de lote (proposital, defesa em
-- profundidade) e o mecanismo ATIVO para o caminho manual
-- (createCliente/updateCliente/qualquer INSERT direto).
--
-- Nenhuma linha hoje em produção pode violar a regra nova: a regra antiga
-- (razão social sozinha) já era estritamente mais restritiva que a nova
-- (que exige TAMBÉM CNPJ igual ou ausente), então não existe cenário de
-- dado legado que precise de exceção retroativa (grandfathering) — esta
-- migration não valida nem limpa dados existentes.
--
-- NEW file — nunca editar 0001-0029, que já estão aplicadas em produção
-- (regra do CLAUDE.md / Pitfall 11 do projeto).
--
-- Source: .planning/quick/260914-k3g-bug-de-schema-clientes-razao-social-tem-/260914-k3g-PLAN.md
--         supabase/migrations/0002_clientes_and_funil.sql (constraint original, linha 107)
--         supabase/migrations/0024_razao_social_opcional.sql (preserva a unicidade)
--         supabase/migrations/0019_importar_clientes_lote_cnpj_nome_fantasia.sql (molde da RPC 1)
--         supabase/migrations/0027_importar_clientes_ativos_lote.sql (molde da RPC 2)
--         supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql (idioma nullif(btrim(x), ''))
--         lib/importacao/dedupe.ts (mesma regra, camada de app)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Remoção dinâmica da constraint antiga de unicidade em razao_social.
--
-- NUNCA um `drop constraint if exists` com nome fixo aqui: mascararia
-- silenciosamente um nome errado e deixaria a trava antiga viva ao lado das
-- novas. O nome esperado hoje é `clientes_razao_social_key` (confirmado por
-- grep em todo `supabase/migrations/` — nenhuma migration entre 0002 e 0029
-- renomeia, dropa ou recria essa constraint), mas o nome real é descoberto
-- por introspecção em tempo de aplicação: lê o `attnum` de `razao_social`
-- em `pg_attribute` (filtrando `attisdropped = false`), procura em
-- `pg_constraint` uma unique constraint (`contype = 'u'`) em `clientes`
-- cujo `conkey` seja EXATAMENTE `array[attnum]` (constraint de coluna
-- única, não composta), e só executa o DROP se encontrar exatamente uma.
-- Se encontrar zero ou mais de uma, aborta a migration inteira com uma
-- exceção explicando que a suposição não bateu e que é preciso investigar
-- manualmente antes de prosseguir.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_attnum smallint;
  v_constraint_names text[];
  v_constraint_name text;
begin
  select attnum
    into v_attnum
    from pg_attribute
   where attrelid = 'clientes'::regclass
     and attname = 'razao_social'
     and not attisdropped;

  if v_attnum is null then
    raise exception 'Migration 0030: coluna clientes.razao_social não encontrada — abortando (não é seguro prosseguir com uma suposição errada sobre o schema).';
  end if;

  select array_agg(conname)
    into v_constraint_names
    from pg_constraint
   where conrelid = 'clientes'::regclass
     and contype = 'u'
     and conkey = array[v_attnum];

  if v_constraint_names is null or array_length(v_constraint_names, 1) is null then
    raise exception 'Migration 0030: nenhuma unique constraint de coluna única encontrada em clientes.razao_social (esperado: clientes_razao_social_key, da migration 0002). Investigar manualmente antes de prosseguir — não seguir com um DROP CONSTRAINT chutado.';
  elsif array_length(v_constraint_names, 1) > 1 then
    raise exception 'Migration 0030: encontradas % unique constraints de coluna única em clientes.razao_social (%), esperava exatamente 1. Investigar manualmente antes de prosseguir.',
      array_length(v_constraint_names, 1), array_to_string(v_constraint_names, ', ');
  end if;

  v_constraint_name := v_constraint_names[1];
  execute format('alter table clientes drop constraint %I', v_constraint_name);
end
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Índice comum (não único) em razao_social — mantém a performance de
--    busca agora que o índice implícito da constraint sumiu. A tabela tem
--    centenas de clientes hoje, mas o Postgres precisa de algum índice para
--    as buscas do trigger e das duas RPCs abaixo não virarem sequential
--    scan conforme a base cresce.
-- ─────────────────────────────────────────────────────────────────────────
create index idx_clientes_razao_social on clientes (razao_social);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. razao_social_cnpj_colide — função pura, ÚNICA fonte de verdade da
--    regra de colisão. Reusada pelo trigger do cadastro manual E pelo
--    pré-filtro das duas RPCs de importação abaixo. Se só um dos pontos
--    usar esta função, o comportamento diverge silenciosamente entre as
--    portas de escrita — por isso nenhum outro objeto deste arquivo
--    reimplementa esta lógica, todos só chamam esta função.
--
-- Comparação de razão social: string crua, exata — nunca normalizar
-- acento/caixa aqui, mesma postura da constraint original (que nunca
-- normalizou nada, só comparava string crua).
--
-- Comparação de CNPJ: por TEXTO EXATO aparado (`nullif(btrim(x), '')`),
-- nunca por dígitos normalizados — mesma postura de "banco = match exato,
-- app = comparação tolerante" que razao_social já tinha. Um CNPJ ausente
-- (nulo ou só espaços) de QUALQUER um dos dois lados faz a função devolver
-- verdadeiro (colide) — é essa cláusula que preserva o comportamento antigo
-- para linhas sem CNPJ.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function razao_social_cnpj_colide(
  p_razao_social_a text,
  p_cnpj_a text,
  p_razao_social_b text,
  p_cnpj_b text
)
returns boolean
language sql
immutable
as $$
  select
    p_razao_social_a is not null
    and p_razao_social_b is not null
    and p_razao_social_a = p_razao_social_b
    and (
      nullif(btrim(p_cnpj_a), '') is null
      or nullif(btrim(p_cnpj_b), '') is null
      or nullif(btrim(p_cnpj_a), '') = nullif(btrim(p_cnpj_b), '')
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Trigger do caminho manual/genérico — substitui a constraint antiga
--    para qualquer INSERT/UPDATE direto em clientes (createCliente,
--    updateCliente, e qualquer futuro caminho de escrita direto).
--
-- SECURITY DEFINER é obrigatório aqui: sem elevação, a checagem correria
-- com a RLS do chamador ("vendedor ve os proprios clientes, supervisor ve
-- todos", migration 0002), então um Vendedor só enxergaria os PRÓPRIOS
-- clientes na comparação e poderia criar uma razão social+CNPJ que já
-- existe sob outro Vendedor sem nunca ver o erro — quebrando a unicidade
-- GLOBAL que a constraint antiga garantia de graça (constraints não passam
-- por RLS). Esta é a 5ª exceção de privilégio elevado documentada no
-- projeto (junto de is_supervisor, desativar/reativar_membro_equipe,
-- cidades_com_clientes_por_estado e os gatilhos de histórico de 0002).
--
-- A mensagem de erro NUNCA cita o vendedor dono do registro existente —
-- mesma postura não-reveladora já documentada em app/actions/clientes.ts
-- (comentário D-06) para duplicate_razao_social.
--
-- `before insert or update of razao_social, cnpj` (não `before insert or
-- update` sozinho): o `of razao_social, cnpj` só dispara quando uma dessas
-- duas colunas está na lista de SET de um UPDATE — evita custo em updates
-- que não tocam nelas (ex. mover_card_funil chamado sem CNPJ novo).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function clientes_bloqueia_duplicata_razao_social_cnpj()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from clientes c
     where c.id <> new.id
       and razao_social_cnpj_colide(c.razao_social, c.cnpj, new.razao_social, new.cnpj)
  ) then
    raise exception 'Já existe um cliente com esta razão social e CNPJ' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_clientes_bloqueia_duplicata_razao_social_cnpj on clientes;

create trigger trg_clientes_bloqueia_duplicata_razao_social_cnpj
  before insert or update of razao_social, cnpj on clientes
  for each row execute function clientes_bloqueia_duplicata_razao_social_cnpj();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. importar_clientes_lote — recriada (mesma assinatura de 0019:
--    `returns table(razao_social text, id uuid, status text)`).
--
-- Nem esta função nem a RPC do objeto 6 precisam mais de `ON CONFLICT`: não
-- sobrou nenhum índice único que o alvo `(razao_social)` pudesse
-- referenciar (a constraint foi removida no objeto 1), e o pré-filtro
-- `NOT EXISTS` / `WITH ORDINALITY` abaixo já garante que só linhas
-- não-colidentes chegam ao INSERT — nenhuma linha que chega ao INSERT pode
-- disparar o trigger do objeto 4 (defesa em profundidade, backstop morto
-- para o caminho de lote).
--
-- Estrutura em três CTEs:
--   - candidatos: lê o JSON com WITH ORDINALITY, numerando cada linha na
--     ordem de entrada (`linha`).
--   - aptos: candidatos que NÃO colidem com nenhuma linha JÁ existente na
--     tabela E NÃO colidem com nenhuma linha ANTERIOR do mesmo lote
--     (ordinal menor) — evita que duas linhas idênticas do lote se
--     auto-excluam mutuamente, e evita que um "vizinho" nulo do lote aborte
--     o lote inteiro.
--   - inseridos: o INSERT, selecionando de `aptos` (nunca direto de
--     jsonb_to_recordset), sem ON CONFLICT.
--
-- Segunda instrução (cliente_produtos) continua SEQUENCIAL e separada — o
-- conserto de visibilidade documentado na migration 0006, NUNCA pode ser
-- desfeito. A correlação passa a ser por (razao_social, cnpj) com
-- `is not distinct from` no CNPJ (NULL-safe): depois desta migration, DUAS
-- linhas inseridas podem legitimamente compartilhar a MESMA razão social
-- (CNPJ diferente — o cenário Carrefour/Outback). O JOIN antigo
-- (`r.razao_social = t.razao_social`) casaria CADA linha inserida contra AS
-- DUAS linhas de origem que compartilham aquele nome, multiplicando
-- produtos errados entre lojas diferentes da mesma rede.
-- ─────────────────────────────────────────────────────────────────────────
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
    -- `with ordinality` acrescenta a coluna extra `linha` ao final da lista
    -- de colunas do próprio jsonb_to_recordset — uma ÚNICA leitura do JSON,
    -- nunca duas leituras casadas por join (o que seria um produto
    -- cartesiano sem chave de correlação real).
    from jsonb_to_recordset(p_clientes) with ordinality as c(
      razao_social text, cep text, rua text, numero text, complemento text,
      cidade text, estado text, responsavel uuid, categoria_id uuid,
      contato text, telefone text, email text, numero_de_lojas int,
      cnpj text, nome_fantasia text, linha bigint
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

-- ─────────────────────────────────────────────────────────────────────────
-- 6. importar_clientes_ativos_lote — recriada (mesma assinatura de 0027).
--    MESMA restruturação em três CTEs do objeto 5, com uma diferença: a CTE
--    `aptos` combina, na MESMA condição `where` (nunca em passadas
--    separadas — mandatório por 0027), o filtro de completude EXISTENTE
--    (`cliente_ativo_pronto_para_ganho`, inalterado desde 0027/0029) E as
--    duas condições novas de não-colisão (contra a tabela e contra
--    `candidatos` anteriores, mesma forma do objeto 5).
--
-- `cliente_ativo_pronto_para_ganho` continua com sua aridade fixa de nove
-- parâmetros (inalterada) — nenhuma mudança nesta função neste arquivo.
--
-- `inseridos` ganha `cnpj` no `returning` e em `v_cnpjs`. A inserção de
-- cliente_produtos recebe a MESMA correção de JOIN por (razao_social, cnpj)
-- com `is not distinct from` do objeto 5, pelo mesmo motivo (produtos
-- cruzados entre lojas da mesma rede com CNPJ diferente).
--
-- O RETURN QUERY de classificação (inserido/duplicado/incompleto) precisa
-- do MESMO ajuste: o `left join unnest(...)` passa a casar por
-- (razao_social, cnpj) com `is not distinct from` — a lógica do `case`
-- (inserido/duplicado/incompleto) NÃO muda, só a chave de correlação do
-- JOIN. Todos os comentários cruzados obrigatórios já existentes em 0027
-- (referências a 0018/0025, à aridade fixa de cliente_ativo_pronto_para_ganho,
-- à ausência de gatilho de histórico e de semeadura de visita) continuam
-- valendo e não são repetidos aqui para não duplicar o arquivo 0027 —
-- consultar 0027 para o raciocínio completo dessas partes inalteradas.
-- ─────────────────────────────────────────────────────────────────────────
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
    -- Mesma técnica do objeto 5: uma única leitura via `with ordinality`,
    -- nunca duas leituras casadas por join.
    from jsonb_to_recordset(p_clientes) with ordinality as c(
      razao_social text, cep text, rua text, numero text, complemento text,
      cidade text, estado text, responsavel uuid, categoria_id uuid,
      contato text, telefone text, email text, numero_de_lojas int,
      cnpj text, nome_fantasia text, linha bigint
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
