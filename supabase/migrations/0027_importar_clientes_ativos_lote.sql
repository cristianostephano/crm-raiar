-- Fase 25 Plano 1: `importar_clientes_ativos_lote` — a RPC nova que traz a
-- carteira de clientes já ativos de uma vez, cada linha entrando DIRETO em
-- `status_acompanhamento = 'ganho'` / `etapa = 'primeira_venda'`, sem passar
-- pelas 7 etapas do funil nem por `mover_card_funil` (ATIVO-02).
--
-- ─────────────────────────────────────────────────────────────────────────
-- COMENTÁRIO CRUZADO OBRIGATÓRIO (o entregável mais importante deste
-- arquivo, não um enfeite):
--
-- A condição de completude usada aqui (`cliente_ativo_pronto_para_ganho`,
-- objeto 1 abaixo) é uma CÓPIA dos guards de TRANSIÇÃO para "ganho" que
-- vivem em `supabase/migrations/0018_cnpj_obrigatorio_no_ganho.sql` (CNPJ)
-- e `supabase/migrations/0025_ganho_exige_razao_social_e_endereco.sql`
-- (razão social + endereço completo). Esta RPC cria a linha JÁ em "ganho" —
-- por isso não existe aqui o conceito de TRANSIÇÃO nem de ANISTIA de linhas
-- antigas (toda linha aqui é nova, nunca pré-existente): a condição é só de
-- presença, sem o `v_status_atual is distinct from 'ganho'` que faz o
-- grandfathering nas migrations 0018/0025. Qualquer mudança futura nos
-- guards daquelas duas migrations precisa ser refletida AQUI manualmente,
-- porque esta função não chama `mover_card_funil` nem nenhum outro caminho
-- de movimentação de card do funil.
--
-- A condição daqui é ESTRITAMENTE MAIOR que a soma dos guards de 0018 e
-- 0025: aqueles dois cobrem sete campos (CNPJ + razão social + os cinco de
-- endereço: cep/rua/numero/cidade/estado), esta cobre NOVE, somando
-- `responsavel` e `contato`. Os dois campos a mais não vêm de 0018/0025 e
-- sim do caminho de CRIAÇÃO:
--   - `responsavel` porque `clientes.responsavel` é `not null` desde a
--     migration 0002 — o caminho normal (mover_card_funil) nunca precisa
--     checá-la porque lá o cliente JÁ EXISTE e a coluna já está preenchida;
--     aqui a linha está NASCENDO, então a checagem é obrigatória.
--   - `contato` porque ATIVO-01 o nomeia como exigido nesta planilha nova.
-- Escrever isso aqui é o que impede um mantenedor futuro de "alinhar" esta
-- função de volta aos sete campos de 0018/0025 achando que a divergência é
-- um erro de cópia — NÃO É.
--
-- Os nove campos são exatamente os nove que o plano 25-02 marca como
-- obrigatórios em `SYSTEM_FIELDS_ATIVO` (`lib/importacao/typesAtivo.ts`) —
-- a tela e o banco exigem o MESMO conjunto, sem subconjunto nem
-- superconjunto. É essa correspondência que garante que a tela nunca
-- prometa gravar uma linha que o banco vai recusar (nem o contrário).
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- Objeto 1 — cliente_ativo_pronto_para_ganho: função pura (não toca em
-- tabela nenhuma), `immutable`, sem elevação de privilégio, com aridade
-- FIXA de nove parâmetros. É essa aridade fixa que transforma uma
-- divergência futura de campos entre os dois pontos de chamada (filtro da
-- criação e classificação do retorno, ambos no objeto 2 abaixo) em erro de
-- COMPILAÇÃO do SQL, em vez de um bug silencioso de gravação — o motivo
-- mecânico desta função existir, em vez de escrever a mesma expressão
-- booleana duas vezes dentro da RPC.
--
-- Os oito campos de texto usam exatamente a mesma regra de vazio da
-- migration 0025 — `nullif(btrim(x), '') is not null` — que trata "só
-- espaços" como vazio. `p_responsavel` é `uuid`, não texto: a checagem é
-- `p_responsavel is not null`, sem `btrim` (aparar um uuid não compila, e
-- um uuid não tem estado "só espaços").
--
-- `complemento` fica de fora de propósito: sempre foi opcional no modelo
-- de domínio (mesma justificativa da migration 0025).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function cliente_ativo_pronto_para_ganho(
  p_razao_social text,
  p_cnpj text,
  p_cep text,
  p_rua text,
  p_numero text,
  p_cidade text,
  p_estado text,
  p_responsavel uuid,
  p_contato text
)
returns boolean
language sql
immutable
as $$
  select
    nullif(btrim(p_razao_social), '') is not null
    and nullif(btrim(p_cnpj), '') is not null
    and nullif(btrim(p_cep), '') is not null
    and nullif(btrim(p_rua), '') is not null
    and nullif(btrim(p_numero), '') is not null
    and nullif(btrim(p_cidade), '') is not null
    and nullif(btrim(p_estado), '') is not null
    -- responsavel é uuid: sem btrim, sem estado "só espaços". `not null`
    -- desde a migration 0002 na tabela — se esta checagem faltar aqui, uma
    -- linha sem responsável escapa do filtro do objeto 2 e a instrução de
    -- criação levanta violação de restrição, abortando o LOTE INTEIRO
    -- (a pior forma de quebrar ATIVO-03) — ver caso de teste `semresponsavel`.
    and p_responsavel is not null
    -- contato é anulável na tabela: sem esta checagem a linha entraria
    -- calada com contato nulo, falha silenciosa contra ATIVO-01 — ver caso
    -- de teste `semcontato`.
    and nullif(btrim(p_contato), '') is not null;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Objeto 2 — importar_clientes_ativos_lote: nome de função inédito no
-- banco, então NÃO é preciso apagar assinatura antiga antes de criar — o
-- ritual de apagar-antes-de-criar (0013/0018/0022/0026) só existe para
-- evitar sobrecarga ambígua quando uma assinatura já existente muda de
-- contagem/tipo de parâmetro, e não é o caso aqui.
--
-- Pragma #variable_conflict use_column: `razao_social` é ao mesmo tempo
-- coluna e variável de saída — sem o pragma a cláusula ON CONFLICT fica
-- ambígua (SQLSTATE 42702, erro já documentado na migration 0005). Sem
-- elevação de privilégio: continua rodando como o chamador, mesma postura
-- de `importar_clientes_lote` — a RLS de `clientes`/`cliente_produtos`
-- continua sendo a fronteira de autorização.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function importar_clientes_ativos_lote(p_clientes jsonb)
returns table(razao_social text, id uuid, status text)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_ids uuid[];
  v_razoes text[];
begin
  -- Única condição que aborta o LOTE INTEIRO — toda outra recusa é por
  -- linha. `is_supervisor()` é a única trava de papel dentro desta função;
  -- ela roda como o chamador (sem elevação de privilégio), então a regra de
  -- leitura de `clientes` continua sendo a segunda barreira.
  if not is_supervisor() then
    raise exception 'Somente supervisores podem importar clientes ativos em massa';
  end if;

  -- ───────────────────────────────────────────────────────────────────────
  -- FORMA OBRIGATÓRIA DESTA INSTRUÇÃO — é isto que fecha o risco de
  -- restrição not null (T-25-07):
  --
  -- A cláusula de filtro (`where cliente_ativo_pronto_para_ganho(...)`)
  -- fica pendurada na MESMA cláusula de seleção que alimenta a criação,
  -- lendo o MESMO alias `r`, cuja lista de colunas é declarada UMA VEZ SÓ
  -- (o `jsonb_to_recordset(...) as r(...)` logo abaixo). Uma linha reprovada
  -- no filtro nunca chega a ser uma linha CANDIDATA à criação — ela é
  -- descartada pela própria seleção, antes de existir como linha a gravar.
  -- Não é uma checagem "antes" da gravação: é a MESMA passada. Consequência:
  -- é estruturalmente impossível uma linha sem `responsavel` alcançar a
  -- coluna `not null` e abortar o lote, e essa garantia não depende de
  -- teste nenhum — o caso `semresponsavel` (tests/importacao/importar-
  -- ativos-lote.test.ts) existe para PROVAR a garantia, não para criá-la.
  --
  -- PROIBIDO, e o motivo:
  --   (a) validar numa passada e gravar em outra — duas leituras
  --       independentes de jsonb_to_recordset no caminho de escrita, ainda
  --       que com o mesmo texto de filtro, reintroduzem a possibilidade de
  --       as duas listas de colunas divergirem numa manutenção futura, que
  --       é exatamente como `responsavel` e `contato` ficariam de fora de
  --       novo;
  --   (b) filtrar por uma lista de colunas mais estreita que a lista que a
  --       criação insere — o filtro tem que enxergar a linha INTEIRA que
  --       vai ser gravada;
  --   (c) trocar o filtro por um bloco de exceção em volta da criação
  --       (exception when not_null_violation) — uma exceção de restrição
  --       aborta a INSTRUÇÃO inteira, não a linha; pegá-la ainda perderia
  --       todas as linhas boas do lote.
  --
  -- Lista de colunas do jsonb_to_recordset idêntica à da migration 0019
  -- (razao_social, cep, rua, numero, complemento, cidade, estado,
  -- responsavel uuid, categoria_id uuid, contato, telefone, email,
  -- numero_de_lojas int, cnpj, nome_fantasia) — `responsavel uuid` e
  -- `contato text` JÁ estavam nela desde a 0019, então o filtro novo não
  -- precisa declarar coluna nenhuma a mais.
  --
  -- Only muda em relação à 0019: (a) a lista de colunas da criação ganha
  -- `etapa` e `status_acompanhamento`; (b) a lista de valores ganha as
  -- constantes `'primeira_venda'::etapa_funil` e
  -- `'ganho'::status_acompanhamento_enum` — é isto que entrega ATIVO-02;
  -- (c) a cláusula de filtro nova. A cláusula de conflito continua sendo
  -- por razao_social, sem fazer nada (ON CONFLICT DO NOTHING) — uma razão
  -- social já existente é classificada como 'duplicado' na leitura de
  -- retorno abaixo.
  -- ───────────────────────────────────────────────────────────────────────
  with inseridos as (
    insert into clientes (
      razao_social, cep, rua, numero, complemento, cidade, estado,
      responsavel, categoria_id, contato, telefone, email, numero_de_lojas,
      cnpj, nome_fantasia, etapa, status_acompanhamento
    )
    select
      r.razao_social, r.cep, r.rua, r.numero, r.complemento, r.cidade, r.estado,
      r.responsavel, r.categoria_id, r.contato, r.telefone, r.email, r.numero_de_lojas,
      r.cnpj, r.nome_fantasia,
      'primeira_venda'::etapa_funil,
      'ganho'::status_acompanhamento_enum
    from jsonb_to_recordset(p_clientes) as r(
      razao_social text, cep text, rua text, numero text, complemento text,
      cidade text, estado text, responsavel uuid, categoria_id uuid,
      contato text, telefone text, email text, numero_de_lojas int,
      cnpj text, nome_fantasia text
    )
    where cliente_ativo_pronto_para_ganho(
      r.razao_social, r.cnpj, r.cep, r.rua, r.numero, r.cidade, r.estado,
      r.responsavel, r.contato
    )
    on conflict (razao_social) do nothing
    returning clientes.id, clientes.razao_social
  )
  select array_agg(inseridos.id), array_agg(inseridos.razao_social)
  into v_ids, v_razoes
  from inseridos;

  -- Segunda instrução, SEQUENCIAL e separada — o conserto de visibilidade
  -- documentado na migration 0006, NÃO pode ser desfeito. Reencadear as
  -- duas gravações numa instrução só (duas CTEs de escrita) ressuscita a
  -- recusa da regra de leitura de `cliente_produtos` (RLS parent-EXISTS)
  -- em toda importação que traga produtos. Byte a byte igual à 0019.
  insert into cliente_produtos (cliente_id, produto_id)
  select t.cliente_id, pid::uuid
  from unnest(v_ids, v_razoes) as t(cliente_id, razao_social)
  join jsonb_to_recordset(p_clientes) as r(razao_social text, produto_ids jsonb)
    on r.razao_social = t.razao_social
  cross join lateral jsonb_array_elements_text(coalesce(r.produto_ids, '[]'::jsonb)) as pid
  on conflict do nothing;

  -- ───────────────────────────────────────────────────────────────────────
  -- Retorno: diferente da 0019 (que só devolve o que entrou), esta função
  -- devolve UMA linha por linha de ENTRADA — é isto que permite à camada
  -- TypeScript explicar cada linha pulada sem adivinhar (ATIVO-03).
  --
  -- Esta segunda leitura de jsonb_to_recordset é de LEITURA PURA — não
  -- grava nada, então não carrega o risco de restrição da instrução acima
  -- e pode em teoria declarar uma lista mais estreita — MAS não pode
  -- declarar uma lista mais estreita que os NOVE argumentos da função de
  -- completude: se faltar `responsavel` ou `contato` aqui, a chamada de
  -- `cliente_ativo_pronto_para_ganho` não compila (aridade fixa) — e é
  -- justamente esse erro de compilação, e não um teste, que impede as duas
  -- classificações (filtro da criação x classificação do retorno) de
  -- divergirem.
  --
  -- Classificação, em ordem:
  --   - identificador casado nos vetores capturados acima -> 'inserido';
  --   - senão, cliente_ativo_pronto_para_ganho(...) verdadeiro para a linha
  --     -> 'duplicado' (passou na completude mas foi recusada pelo ON
  --     CONFLICT — já existia uma razão social igual);
  --   - senão -> 'incompleto'. Identificador nulo nos dois casos de recusa.
  --     Uma linha sem responsável cai neste ramo final, nunca em
  --     'duplicado', porque a mesma função de completude que reprovou o
  --     filtro da criação reprova aqui também.
  -- ───────────────────────────────────────────────────────────────────────
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
  left join unnest(v_ids, v_razoes) as ins(id, razao_social)
    on ins.razao_social = r.razao_social;

  -- Nenhuma constraint CHECK nova sobre `clientes`, nenhum gatilho novo:
  -- `clientes` já tem gatilhos só de ALTERAÇÃO, então uma criação de linha
  -- não escreve no diário de auditoria. DELIBERADO (T-25-06, aceito): os
  -- gráficos de ganhos/perdidos do painel leem a data do evento de mudança
  -- de situação no diário (`historico.criado_em`) — semear eventos com a
  -- data de HOJE faria a importação da carteira HISTÓRICA aparecer como um
  -- pico de centenas de "ganhos hoje", o que seria falso. Além disso, o
  -- diário não tem policy de criação para usuário nenhum, só gatilhos
  -- elevados escrevem nele — criar uma seria uma exceção nova, proibida
  -- neste marco.
  --
  -- Nenhuma visita é semeada e `frequencia_visita` nunca é preenchida:
  -- frequência de visita está fora desta planilha por decisão travada
  -- (ATIVO-01). O cliente importado nasce sem frequência e, por isso,
  -- aparece na seção "Sem dia fixo definido" da Agenda (Fase 24) —
  -- comportamento esperado.
end;
$$;
