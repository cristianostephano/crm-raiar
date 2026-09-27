/*
 * Fase 30 Plano 3 - diagnostico temporario, parte 4.
 * Nao mexe em acessos_diarios nem em nenhuma policy real. Cria uma tabela
 * SEPARADA, so para teste, com a mesma forma de regra (usuario + dia +
 * exists de profiles), para eu confirmar, sem qualquer risco a seguranca
 * real, se o EXISTS que consulta profiles dentro do WITH CHECK e o que
 * quebra quando chamado via funcao. Tabela e funcao de teste - apagadas
 * ao final desta investigacao (proxima migration reverte).
 */

create table if not exists diagnostico_temp_rls (
  usuario_id uuid not null,
  dia date not null,
  primary key (usuario_id, dia)
);

alter table diagnostico_temp_rls enable row level security;

drop policy if exists "diag insert" on diagnostico_temp_rls;
create policy "diag insert"
on diagnostico_temp_rls for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and dia = (now() at time zone 'America/Sao_Paulo')::date
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid()) and p.role = 'vendedor' and p.ativo = true
  )
);

drop function if exists diagnostico_insert_temp();
create or replace function diagnostico_insert_temp()
returns jsonb
language plpgsql
as $$
declare
  v_uid uuid;
  v_hoje date;
  v_insert_ok boolean := false;
  v_erro_sqlstate text := null;
  v_erro_mensagem text := null;
begin
  v_uid := auth.uid();
  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;

  begin
    insert into diagnostico_temp_rls (usuario_id, dia) values (v_uid, v_hoje)
    on conflict (usuario_id, dia) do nothing;
    v_insert_ok := true;
  exception when others then
    get stacked diagnostics v_erro_sqlstate = returned_sqlstate;
    v_erro_mensagem := sqlerrm;
  end;

  return jsonb_build_object(
    'v_insert_ok', v_insert_ok,
    'v_erro_sqlstate', v_erro_sqlstate,
    'v_erro_mensagem', v_erro_mensagem
  );
end;
$$;
