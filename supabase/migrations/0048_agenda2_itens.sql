-- Phase 31 Plan 1: tabela agenda2_itens + RLS assimetrica (dono escreve,
-- Supervisor so le) + gatilho de carimbos do servidor.
--
-- Finalidade (Agenda 2 do piloto v1.8 — AGD2-01/03/04/05/07): o vendedor
-- anota a mao um item de visita (nome livre do cliente, bairro, data),
-- corrige ou apaga o que anotou e marca o que ja fez; o Supervisor
-- acompanha a Agenda 2 de todo o time, so leitura (D-16).
--
-- LGPD: o item guarda dado pessoal do cliente (o nome livre pode ser de
-- uma pessoa fisica, MEI ou contato) e do funcionario (revela a rotina de
-- deslocamento do vendedor). Por isso esta tabela guarda SO as 8 colunas
-- abaixo — nenhum telefone, endereco completo, observacao livre ou
-- localizacao — com limite de tamanho (120/60 caracteres apos aparar
-- espacos) e recusa de qualquer sequencia de 8 ou mais digitos (formato de
-- CPF/CNPJ/telefone/CEP), aplicada tanto no banco (constraints abaixo)
-- quanto na tela (lib/validations/agenda2.ts, plano 31-02 — mesma regra).
--
-- Dono sempre o usuario da sessao (vendedor_id = auth.uid() nas tres
-- policies de escrita) e carimbos sempre do servidor (gatilho
-- agenda2_itens_carimbos() abaixo) — nada disso vem da tela.
--
-- RLS assimetrica (D-16): o dono (vendedor ATIVO, nao so "nao
-- supervisor" — ver correcao 1 do plano) cria, edita e apaga os proprios
-- itens; o Supervisor NUNCA cria, edita ou apaga nenhum item (nem o
-- proprio), so le o time inteiro (AGD2-07).
--
-- Conta apagada leva os itens junto (on delete cascade); conta so
-- DESATIVADA continua com os itens existindo e visiveis ao Supervisor,
-- sem transferencia para outro vendedor (D-19).
--
-- Nenhuma funcao deste arquivo ganha clausula de elevacao de privilegio —
-- o gatilho de carimbos so toca a propria linha que o INSERT/UPDATE do
-- usuario ja esta gravando, entao nao precisa (e nao pode) rodar com
-- privilegio elevado. Este projeto termina esta fase com as MESMAS 11
-- funcoes com elevacao de privilegio documentadas hoje (nenhuma nova).
--
-- Prazo de guarda dos itens do piloto (LGPD) AINDA NAO foi definido pelo
-- dono do projeto — por isso este arquivo NAO contem nenhum descarte
-- automatico. Decisao pendente, sinalizada ao dono no checkpoint do
-- plano 31-03.
--
-- Source: .planning/phases/31-agenda-2-visitas-manuais-na-lista/31-CONTEXT.md
--         .planning/phases/31-agenda-2-visitas-manuais-na-lista/31-RESEARCH.md
--           (Pattern 1, Pattern 2)
--         .planning/phases/31-agenda-2-visitas-manuais-na-lista/31-01-PLAN.md
--           (bloco conflitos_resolvidos, itens 1-5 e 8)
--         supabase/migrations/0002_clientes_and_funil.sql (policies
--           "dono ou supervisor", clientes_before_update())
--         supabase/migrations/0008_desativacao_membro_equipe.sql
--           (is_supervisor() exigindo ativo = true)
--         supabase/migrations/0015_conclusao_com_resumo.sql (constraint de
--           tamanho com btrim + char_length)
--         supabase/migrations/0038_acessos_diarios.sql (tom de cabecalho,
--           forma re-executavel drop policy if exists antes de cada
--           create policy)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabela agenda2_itens — EXATAMENTE 8 colunas (LGPD, minimizacao).
--    Nenhuma restricao sobre a coluna `data`: data passada e permitida
--    (D-09, recuperar visita que o vendedor esqueceu de anotar).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists agenda2_itens (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references profiles(id) on delete cascade,
  nome_cliente text not null,
  bairro text not null,
  data date not null,
  concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint chk_agenda2_nome_cliente_tamanho check (char_length(btrim(nome_cliente)) between 1 and 120),
  constraint chk_agenda2_bairro_tamanho check (char_length(btrim(bairro)) between 1 and 60),
  constraint chk_agenda2_nome_cliente_sem_documento check (regexp_replace(nome_cliente, '[./[:space:]-]', '', 'g') !~ '[0-9]{8,}'),
  constraint chk_agenda2_bairro_sem_documento check (regexp_replace(bairro, '[./[:space:]-]', '', 'g') !~ '[0-9]{8,}')
);

comment on table agenda2_itens is 'Agenda 2 (piloto v1.8): visita anotada à mão pelo vendedor. Guarda só nome livre do cliente, bairro, data, concluído, dono e carimbos de criação/alteração — sem telefone, endereço completo, observação ou localização. Prazo de guarda ainda não definido pelo dono (sem descarte automático).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Indice de apoio a leitura ordenada por vendedor/data.
-- ─────────────────────────────────────────────────────────────────────────
create index if not exists idx_agenda2_itens_vendedor_data on agenda2_itens (vendedor_id, data);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RLS assimetrica — 4 policies. SELECT: dono OU supervisor (AGD2-07).
--    INSERT/UPDATE/DELETE: dono E vendedor ATIVO, nunca Supervisor
--    (D-16 + correcao 1 do plano 31-01 — is_supervisor() sozinho nao basta
--    porque um vendedor DESATIVADO com sessao ainda valida nao satisfaz
--    "nao supervisor" e continuaria gravando).
-- ─────────────────────────────────────────────────────────────────────────
alter table agenda2_itens enable row level security;

drop policy if exists "vendedor ve os proprios itens da agenda2, supervisor ve todos" on agenda2_itens;
create policy "vendedor ve os proprios itens da agenda2, supervisor ve todos"
on agenda2_itens for select to authenticated
using (
  vendedor_id = (select auth.uid())
  or (select is_supervisor())
);
-- AGD2-07; D-19: item de vendedor desativado continua visivel ao Supervisor.

drop policy if exists "vendedor ativo cria os proprios itens da agenda2" on agenda2_itens;
create policy "vendedor ativo cria os proprios itens da agenda2"
on agenda2_itens for insert to authenticated
with check (
  vendedor_id = (select auth.uid())
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
  )
);
-- D-16 + correcao 1.

drop policy if exists "vendedor ativo edita os proprios itens da agenda2" on agenda2_itens;
create policy "vendedor ativo edita os proprios itens da agenda2"
on agenda2_itens for update to authenticated
using (
  vendedor_id = (select auth.uid())
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
  )
)
with check (
  vendedor_id = (select auth.uid())
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
  )
);
-- D-16 + correcao 1: o with check tambem impede transferir o item para
-- outro vendedor (o novo vendedor_id continua tendo que ser o usuario).

drop policy if exists "vendedor ativo apaga os proprios itens da agenda2" on agenda2_itens;
create policy "vendedor ativo apaga os proprios itens da agenda2"
on agenda2_itens for delete to authenticated
using (
  vendedor_id = (select auth.uid())
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
  )
);
-- D-16 + correcao 1.

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Carimbos sempre do servidor — correcao 3 do plano 31-01. Um gatilho
--    so, BEFORE INSERT OR UPDATE: no INSERT forca criado_em/atualizado_em
--    para now(); no UPDATE mantem criado_em antigo e renova atualizado_em.
--    So toca a propria linha que o comando do usuario ja esta gravando,
--    por isso NAO precisa (e NAO pode) ganhar clausula de elevacao de
--    privilegio.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function agenda2_itens_carimbos()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.atualizado_em := now();
  else
    new.criado_em := old.criado_em;
    new.atualizado_em := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agenda2_itens_carimbos on agenda2_itens;
create trigger trg_agenda2_itens_carimbos
  before insert or update on agenda2_itens
  for each row execute function agenda2_itens_carimbos();

-- ─────────────────────────────────────────────────────────────────────────
-- Nenhuma funcao deste arquivo pode ganhar clausula de elevacao de
-- privilegio — nem agora, nem em revisao futura — e nenhum descarte
-- automatico existe aqui (prazo de guarda ainda pendente de decisao do
-- dono do projeto).
-- ─────────────────────────────────────────────────────────────────────────
