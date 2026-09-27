-- Phase 30 Plan 3 (correção pós-aplicação): registrar_acesso_diario() falhava
-- com "new row violates row-level security policy for table acessos_diarios"
-- (42501) para um vendedor ativo real, mesmo com role/ativo corretos.
--
-- Diagnóstico (scripts/diag-30-rls.mjs, rodado contra o banco de produção
-- com um vendedor fixture descartável, nunca com dados reais):
--   1. auth.uid() do cliente autenticado bate com profiles.id — OK.
--   2. profiles.role = 'vendedor' e profiles.ativo = true — OK.
--   3. Um INSERT direto na tabela (INSERT ... VALUES, mesmo usuario_id e
--      mesmo dia de hoje, pelo mesmo cliente autenticado) passa a RLS sem
--      erro algum.
--   4. A MESMA operação, feita de dentro da função original (que usava
--      `INSERT ... SELECT (select auth.uid()), ... WHERE EXISTS (...)`, uma
--      SELECT sem FROM filtrada por WHERE), falha com a violação de RLS.
--
-- Isso isola o problema na FORMA da instrução INSERT dentro da função — o
-- padrão "INSERT ... SELECT ... WHERE EXISTS" (potencialmente multi-linha)
-- aciona um caminho de reescrita de RLS diferente do "INSERT ... VALUES"
-- (linha única) que a Correção 3 do 30-01-PLAN.md já usa hoje. Correção
-- aqui: computar `auth.uid()` e o dia uma única vez em variáveis locais e
-- usar `IF EXISTS (...) THEN INSERT ... VALUES (...) END IF` — mesma regra
-- de negócio (D-04/D-10, só vendedor ativo grava, só o dia de hoje), só que
-- pela forma de INSERT já comprovada acima como compatível com a RLS.
--
-- Nenhuma policy de supabase/migrations/0038_acessos_diarios.sql muda —
-- só o corpo da função. RLS continua a ÚNICA fronteira de autorização
-- (nenhuma cláusula de elevação de privilégio adicionada).
--
-- Correção após aplicação (nunca edita 0038/0039/0040 já aplicadas — regra
-- do 30-03-PLAN.md, Tarefa 3).
--
-- Source: .planning/phases/30-ader-ncia-de-uso-no-dashboard/30-03-PLAN.md
--           (Tarefa 3)
--         scripts/diag-30-rls.mjs (diagnóstico, roda contra fixture
--           descartável, nunca imprime dado real)

create or replace function registrar_acesso_diario()
returns void
language plpgsql
as $$
declare
  v_uid uuid;
  v_hoje date;
begin
  v_uid := auth.uid();
  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;

  -- D-04: idempotente — duas chamadas no mesmo dia deixam uma linha só, sem
  -- erro. Correção 3 (mantida): só grava quando o chamador é vendedor
  -- ativo; chamador anônimo, Supervisor, ou vendedor inativo não grava
  -- nada, sem lançar exceção.
  if exists (
    select 1 from profiles p
    where p.id = v_uid and p.role = 'vendedor' and p.ativo = true
  ) then
    insert into acessos_diarios (usuario_id, dia)
    values (v_uid, v_hoje)
    on conflict (usuario_id, dia) do nothing;
  end if;

  -- D-11: descarte de linhas com mais de 35 dias, sem filtro de usuário —
  -- quem decide o que pode ser apagado é a policy de DELETE (0038,
  -- correção 1). Efetivo somente quando quem chama é Supervisor.
  delete from acessos_diarios
  where dia < v_hoje - 35;
end;
$$;

-- Nenhuma função deste arquivo pode ganhar cláusula de elevação de
-- privilégio (SECURITY DEFINER) — nem agora, nem em revisão futura. A RLS
-- de 0038 continua a única fronteira de autorização desta tabela.
