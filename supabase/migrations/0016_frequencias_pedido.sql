-- Phase 16 Plan 1: quinta lista editável do projeto — "Frequência de
-- pedidos" — irmã estrutural literal de categorias/produtos_consumidos/
-- tipos_tarefa/motivos_perda (todas nascidas na migration
-- 0002_clientes_and_funil.sql). Nasce porque o contrato de interface desta
-- fase (16-UI-SPEC.md, seção D2) trocou a frequência de pedidos de texto
-- livre para escolha de lista fechada gerenciada pelo Supervisor — e uma
-- lista gerenciável, neste projeto, é sempre uma tabela própria, nunca um
-- valor fixo no código (CLAUDE.md, e o padrão já usado nas outras quatro
-- listas).
--
-- clientes.frequencia_pedidos (coluna criada na migration
-- 0013_cliente_ativo_e_frequencia_visita.sql) CONTINUA guardando o nome
-- escolhido como texto simples. Este arquivo NÃO adiciona chave
-- estrangeira nem qualquer restrição nova a essa coluna, e NÃO toca na
-- tabela clientes de nenhuma outra forma — é a decisão de desenho D2, que
-- evita um ALTER TABLE em produção sobre uma tabela que já tem dados reais
-- (Pitfall 3).
--
-- Este arquivo também não cria, recria nem redefine nenhuma função — as
-- três regras de escrita abaixo reusam is_supervisor()
-- (0001_profiles_and_roles.sql), a única autoridade de papel do projeto.
-- Nenhuma exceção nova de privilégio elevado é introduzida (o projeto
-- continua com as três já documentadas em STATE.md).
--
-- Source: .planning/phases/16-ficha-do-cliente-ativo-campos-e-di-rio/16-01-PLAN.md
--         .planning/phases/16-ficha-do-cliente-ativo-campos-e-di-rio/16-UI-SPEC.md (seção D2)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tabela frequencias_pedido — cópia estrutural literal das quatro
--    listas irmãs (mesma forma id/nome/ativo/created_at). A coluna `ativo`
--    é o mecanismo de desativação suave já usado pelas outras listas:
--    tirar um valor de circulação nunca é apagar a linha, para que um
--    cliente que já tenha esse nome guardado (em clientes.frequencia_pedidos,
--    como texto) continue funcionando normalmente.
-- ─────────────────────────────────────────────────────────────────────────
create table frequencias_pedido (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Row Level Security — obrigatória antes de qualquer regra de acesso.
-- ─────────────────────────────────────────────────────────────────────────
alter table frequencias_pedido enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Quatro regras de acesso, uma por operação — mesmo padrão literal das
--    quatro listas irmãs. Leitura aberta a qualquer autenticado: é o que
--    alimenta o campo de escolha na ficha do cliente para o Vendedor.
--    Restringi-la ao Supervisor por engano deixaria o campo
--    permanentemente vazio para todo Vendedor, sem dar erro nenhum — é o
--    modo de falha silenciosa mais caro desta migration. As três regras de
--    escrita passam por is_supervisor(), nunca por comparação de papel à
--    mão nem consulta direta à tabela de perfis.
-- ─────────────────────────────────────────────────────────────────────────
create policy "usuarios autenticados leem frequencias_pedido"
on frequencias_pedido for select to authenticated using (true);

create policy "somente supervisor gerencia frequencias_pedido (insert)"
on frequencias_pedido for insert to authenticated with check (is_supervisor());

create policy "somente supervisor gerencia frequencias_pedido (update)"
on frequencias_pedido for update to authenticated using (is_supervisor()) with check (is_supervisor());

create policy "somente supervisor gerencia frequencias_pedido (delete)"
on frequencias_pedido for delete to authenticated using (is_supervisor());

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Conjunto inicial de valores — starter set only, adequado a um
--    distribuidor de alimentos. O Supervisor edita/adiciona/desativa pela
--    tela de Configurações (próximo plano, 16-02) sem precisar de migration
--    nova; este conjunto existe só para o campo na ficha do cliente nunca
--    aparecer vazio no primeiro uso.
-- ─────────────────────────────────────────────────────────────────────────
insert into frequencias_pedido (nome) values
  ('Semanal'),
  ('Quinzenal'),
  ('Mensal'),
  ('Bimestral'),
  ('Trimestral'),
  ('Esporádica');
