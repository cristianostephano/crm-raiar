-- Phase 2 Plan 1: clientes + funil data model — enums, lookup tables,
-- clientes (1:1 "clientes row IS the funnel card"), cliente_produtos join,
-- tarefas, historico, mover_card_funil RPC, auto-history/timestamp triggers,
-- RLS + business-rule CHECK constraints on every new table.
--
-- Single migration file on purpose, mirroring 0001's whole-file discipline
-- (Pitfall 1 — RLS enable + policy must not be split across migrations).
-- NEW file, never an edit to 0001 (Pitfall 11 — once pushed, any further
-- change is a NEW migration file).
--
-- Data-model decision: a `clientes` row IS the funnel card — etapa,
-- status_acompanhamento, motivo_perda_id, observacao, and card ordering
-- (posicao) live directly on clientes (1:1 model), per
-- .planning/research/ARCHITECTURE.md ("a clientes row IS the funnel card
-- ... there is no separate opportunity/deal entity in the MVP") and
-- CLAUDE.md's domain wording "cada cliente tem um card no funil" (singular).
--
-- Source: .planning/phases/02-cadastro-e-gest-o-de-clientes-pj/02-01-PLAN.md
--         .planning/research/ARCHITECTURE.md (Pattern 1 role helper,
--           Pattern 3 mover_card_funil RPC)
--         .planning/research/PITFALLS.md (Pitfall 3 per-table policies,
--           Pitfall 4 wrapped auth.uid() + indexes, Pitfall 8 soft-delete
--           `ativo` on lookup tables)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────
create type etapa_funil as enum (
  'aguardando_contato',
  'conversa_comprador',
  'aguardando_data_reuniao',
  'aguardando_feedback',
  'aguardando_aprovacao',
  'em_cadastro_produto',
  'primeira_venda'
);

create type status_acompanhamento_enum as enum (
  'em_andamento',
  'perdido',
  'ganho'
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Editable-list lookup tables (categoria, produtos_consumidos,
--    tipos_tarefa, motivos_perda) — real tables, not CHECK constraints, so
--    a Supervisor can CRUD them without a migration per new value. Soft
--    delete via `ativo` (Pitfall 8) — Phase 3 builds the CRUD UI on top of
--    the RLS policies already defined here.
-- ─────────────────────────────────────────────────────────────────────────
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table produtos_consumidos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table tipos_tarefa (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table motivos_perda (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed initial values from CLAUDE.md's domain mapping.
insert into categorias (nome) values
  ('Food Service'),
  ('Varejo tradicional'),
  ('Auto serviço');

insert into produtos_consumidos (nome) values
  ('Casca'),
  ('Pasteurizado'),
  ('Óleo');

insert into tipos_tarefa (nome) values
  ('Visitar'),
  ('Mandar mensagem');

-- Starter set only — editable by the Supervisor via the Phase 3 admin CRUD
-- screens built on top of the RLS policies already defined below.
insert into motivos_perda (nome) values
  ('Preço'),
  ('Sem interesse'),
  ('Concorrência'),
  ('Sem retorno');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. clientes — the funnel card (1:1 model, see header comment)
-- ─────────────────────────────────────────────────────────────────────────
create table clientes (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null unique,
  cep text not null,
  rua text not null,
  numero text not null,
  complemento text,
  cidade text not null,
  estado text not null,
  responsavel uuid not null references profiles(id),
  categoria_id uuid references categorias(id),
  contato text,
  telefone text,
  email text,
  numero_de_lojas int,
  etapa etapa_funil not null default 'aguardando_contato',
  status_acompanhamento status_acompanhamento_enum not null default 'em_andamento',
  motivo_perda_id uuid references motivos_perda(id),
  observacao text,
  posicao numeric not null default extract(epoch from now()),
  etapa_alterada_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint chk_ganho_somente_etapa_final
    check (status_acompanhamento <> 'ganho' or etapa = 'primeira_venda'),
  constraint chk_perdido_exige_motivo
    check (status_acompanhamento <> 'perdido' or motivo_perda_id is not null)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. cliente_produtos — multi-value produtos_consumidos join
-- ─────────────────────────────────────────────────────────────────────────
create table cliente_produtos (
  cliente_id uuid not null references clientes(id) on delete cascade,
  produto_id uuid not null references produtos_consumidos(id),
  primary key (cliente_id, produto_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. tarefas (FUN-08)
-- ─────────────────────────────────────────────────────────────────────────
create table tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo_tarefa_id uuid not null references tipos_tarefa(id),
  data_conclusao date,
  concluida boolean not null default false,
  concluida_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. historico (FUN-10) — auto-populated only, no user INSERT policy
-- ─────────────────────────────────────────────────────────────────────────
create table historico (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  autor_id uuid references profiles(id),
  criado_em timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Row Level Security — enable on every new table (Pitfall 1)
-- ─────────────────────────────────────────────────────────────────────────
alter table categorias enable row level security;
alter table produtos_consumidos enable row level security;
alter table tipos_tarefa enable row level security;
alter table motivos_perda enable row level security;
alter table clientes enable row level security;
alter table cliente_produtos enable row level security;
alter table tarefas enable row level security;
alter table historico enable row level security;

-- --- clientes -------------------------------------------------------------
-- responsavel sees own rows, supervisor sees all (T-02-01 / CLI-04/CLI-05).
create policy "vendedor ve os proprios clientes, supervisor ve todos"
on clientes for select
to authenticated
using (responsavel = (select auth.uid()) or is_supervisor());

-- Any authenticated user can cadastrar a cliente, but only for themselves
-- (or a supervisor cadastrando em nome de qualquer vendedor) — CLI-03.
create policy "usuarios cadastram clientes para si (ou supervisor para qualquer um)"
on clientes for insert
to authenticated
with check (responsavel = (select auth.uid()) or is_supervisor());

-- WITH CHECK blocks a vendedor reassigning responsavel to another user
-- (T-02-02 / Pitfall "Looks Done But Isn't" checklist item).
create policy "vendedor edita os proprios clientes, supervisor edita todos"
on clientes for update
to authenticated
using (responsavel = (select auth.uid()) or is_supervisor())
with check (is_supervisor() or responsavel = (select auth.uid()));

-- Delete is Supervisor-only (T-02-04 / CLI-05/CLI-06).
create policy "somente supervisor apaga clientes"
on clientes for delete
to authenticated
using (is_supervisor());

-- --- lookup tables (categorias, produtos_consumidos, tipos_tarefa,
--     motivos_perda) — read-open to every authenticated user (used to
--     populate dropdowns), write restricted to Supervisor.
create policy "usuarios autenticados leem categorias"
on categorias for select to authenticated using (true);
create policy "somente supervisor gerencia categorias (insert)"
on categorias for insert to authenticated with check (is_supervisor());
create policy "somente supervisor gerencia categorias (update)"
on categorias for update to authenticated using (is_supervisor()) with check (is_supervisor());
create policy "somente supervisor gerencia categorias (delete)"
on categorias for delete to authenticated using (is_supervisor());

create policy "usuarios autenticados leem produtos_consumidos"
on produtos_consumidos for select to authenticated using (true);
create policy "somente supervisor gerencia produtos_consumidos (insert)"
on produtos_consumidos for insert to authenticated with check (is_supervisor());
create policy "somente supervisor gerencia produtos_consumidos (update)"
on produtos_consumidos for update to authenticated using (is_supervisor()) with check (is_supervisor());
create policy "somente supervisor gerencia produtos_consumidos (delete)"
on produtos_consumidos for delete to authenticated using (is_supervisor());

create policy "usuarios autenticados leem tipos_tarefa"
on tipos_tarefa for select to authenticated using (true);
create policy "somente supervisor gerencia tipos_tarefa (insert)"
on tipos_tarefa for insert to authenticated with check (is_supervisor());
create policy "somente supervisor gerencia tipos_tarefa (update)"
on tipos_tarefa for update to authenticated using (is_supervisor()) with check (is_supervisor());
create policy "somente supervisor gerencia tipos_tarefa (delete)"
on tipos_tarefa for delete to authenticated using (is_supervisor());

create policy "usuarios autenticados leem motivos_perda"
on motivos_perda for select to authenticated using (true);
create policy "somente supervisor gerencia motivos_perda (insert)"
on motivos_perda for insert to authenticated with check (is_supervisor());
create policy "somente supervisor gerencia motivos_perda (update)"
on motivos_perda for update to authenticated using (is_supervisor()) with check (is_supervisor());
create policy "somente supervisor gerencia motivos_perda (delete)"
on motivos_perda for delete to authenticated using (is_supervisor());

-- --- cliente_produtos / tarefas — RLS on the parent table does NOT
--     protect these joined tables (Pitfall 3 / T-02-05); each gets its own
--     EXISTS-on-parent gate.
create policy "acesso a cliente_produtos gated pelo cliente pai (select)"
on cliente_produtos for select to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = cliente_produtos.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);
create policy "acesso a cliente_produtos gated pelo cliente pai (insert)"
on cliente_produtos for insert to authenticated
with check (
  exists (
    select 1 from clientes c
    where c.id = cliente_produtos.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);
create policy "acesso a cliente_produtos gated pelo cliente pai (update)"
on cliente_produtos for update to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = cliente_produtos.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
)
with check (
  exists (
    select 1 from clientes c
    where c.id = cliente_produtos.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);
create policy "acesso a cliente_produtos gated pelo cliente pai (delete)"
on cliente_produtos for delete to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = cliente_produtos.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);

create policy "acesso a tarefas gated pelo cliente pai (select)"
on tarefas for select to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = tarefas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);
create policy "acesso a tarefas gated pelo cliente pai (insert)"
on tarefas for insert to authenticated
with check (
  exists (
    select 1 from clientes c
    where c.id = tarefas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);
create policy "acesso a tarefas gated pelo cliente pai (update)"
on tarefas for update to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = tarefas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
)
with check (
  exists (
    select 1 from clientes c
    where c.id = tarefas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);
create policy "acesso a tarefas gated pelo cliente pai (delete)"
on tarefas for delete to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = tarefas.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);

-- --- historico — read-only via the same parent gate; deliberately NO user
--     insert policy, only the SECURITY DEFINER triggers below write it.
create policy "acesso a historico gated pelo cliente pai (select)"
on historico for select to authenticated
using (
  exists (
    select 1 from clientes c
    where c.id = historico.cliente_id
      and (c.responsavel = (select auth.uid()) or is_supervisor())
  )
);

-- ─────────────────────────────────────────────────────────────────────────
-- 8. mover_card_funil RPC — friendly single-call path for the drag handler.
--    NOT security definer: runs as the calling user, so RLS still applies
--    to the UPDATE inside it (a vendedor moving a client they don't own
--    simply affects 0 rows). The CHECK constraints in clientes are the
--    real guarantee; this RPC raises a readable exception earlier.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function mover_card_funil(
  p_cliente_id uuid,
  p_nova_etapa etapa_funil,
  p_novo_status status_acompanhamento_enum default null,
  p_motivo_perda_id uuid default null,
  p_nova_posicao numeric default null
)
returns void
language plpgsql
as $$
begin
  if p_novo_status = 'ganho' and p_nova_etapa <> 'primeira_venda' then
    raise exception 'Só é possível marcar como ganho na etapa "1ª venda concluída"';
  end if;

  if p_novo_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório ao marcar um cliente como perdido';
  end if;

  update clientes
  set etapa = p_nova_etapa,
      status_acompanhamento = coalesce(p_novo_status, status_acompanhamento),
      motivo_perda_id = coalesce(p_motivo_perda_id, motivo_perda_id),
      posicao = coalesce(p_nova_posicao, posicao)
  where id = p_cliente_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Triggers — SECURITY DEFINER so they can write historico despite its
--    no-user-insert policy.
-- ─────────────────────────────────────────────────────────────────────────

-- BEFORE UPDATE: keeps etapa_alterada_em/atualizado_em in sync.
create or replace function clientes_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.etapa is distinct from old.etapa then
    new.etapa_alterada_em := now();
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_clientes_before_update
  before update on clientes
  for each row execute function clientes_before_update();

-- AFTER UPDATE: writes a historico row whenever etapa or
-- status_acompanhamento changes (FUN-10).
create or replace function clientes_after_update_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.etapa is distinct from old.etapa then
    insert into historico (cliente_id, tipo, descricao, autor_id)
    values (
      new.id,
      'etapa',
      format('Etapa alterada para "%s"', new.etapa::text),
      (select auth.uid())
    );
  end if;

  if new.status_acompanhamento is distinct from old.status_acompanhamento then
    insert into historico (cliente_id, tipo, descricao, autor_id)
    values (
      new.id,
      'status_acompanhamento',
      format('Status alterado para "%s"', new.status_acompanhamento::text),
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;

create trigger trg_clientes_after_update_historico
  after update on clientes
  for each row execute function clientes_after_update_historico();

-- BEFORE UPDATE on tarefas: writes a historico row when a task flips from
-- not-concluida to concluida, and stamps concluida_em (FUN-10). BEFORE (not
-- AFTER) because it needs to mutate NEW.concluida_em before the row is
-- written.
create or replace function tarefas_before_update_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.concluida = false and new.concluida = true then
    new.concluida_em := now();
    insert into historico (cliente_id, tipo, descricao, autor_id)
    values (
      new.cliente_id,
      'tarefa_concluida',
      'Tarefa marcada como concluída',
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;

create trigger trg_tarefas_before_update_historico
  before update on tarefas
  for each row execute function tarefas_before_update_historico();

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Indexes (Pitfall 4/7)
-- ─────────────────────────────────────────────────────────────────────────
create index idx_clientes_responsavel on clientes (responsavel);
create index idx_clientes_etapa on clientes (etapa);
create index idx_clientes_status_acompanhamento on clientes (status_acompanhamento);
create index idx_clientes_categoria_id on clientes (categoria_id);
create index idx_tarefas_cliente_id on tarefas (cliente_id);
create index idx_historico_cliente_id on historico (cliente_id);
create index idx_cliente_produtos_cliente_id on cliente_produtos (cliente_id);
