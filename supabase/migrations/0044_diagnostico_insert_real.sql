/*
 * Fase 30 Plano 3 - diagnostico temporario, parte 3.
 * 0042 confirmou que auth.uid()/dia/exists calculados dentro da funcao
 * batem exatamente com o que a policy (0043) exige. Mesmo assim o INSERT
 * falha. Esta versao tenta o INSERT de verdade, dentro de um bloco
 * EXCEPTION, e devolve o SQLSTATE e a mensagem completa do erro (sem
 * nenhum dado de terceiro) para eu ver exatamente o que o Postgres
 * reclama, em vez de adivinhar. Se o INSERT funcionar desta vez, a linha
 * fica gravada de verdade (mesmo comportamento real da funcao) - segura,
 * porque quem chama isso e sempre uma conta de teste descartavel, apagada
 * logo em seguida (cascata FK ja existente).
 */

drop function if exists registrar_acesso_diario();

create or replace function registrar_acesso_diario()
returns jsonb
language plpgsql
as $$
declare
  v_uid uuid;
  v_hoje date;
  v_existe_ativo boolean;
  v_insert_ok boolean := false;
  v_erro_sqlstate text := null;
  v_erro_mensagem text := null;
begin
  v_uid := auth.uid();
  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;

  v_existe_ativo := exists (
    select 1 from profiles p
    where p.id = v_uid and p.role = 'vendedor' and p.ativo = true
  );

  if v_existe_ativo then
    begin
      insert into acessos_diarios (usuario_id, dia)
      values (v_uid, v_hoje)
      on conflict (usuario_id, dia) do nothing;
      v_insert_ok := true;
    exception when others then
      get stacked diagnostics v_erro_sqlstate = returned_sqlstate;
      v_erro_mensagem := sqlerrm;
    end;
  end if;

  delete from acessos_diarios
  where dia < v_hoje - 35;

  return jsonb_build_object(
    'v_uid', v_uid,
    'v_hoje', v_hoje,
    'v_existe_ativo', v_existe_ativo,
    'v_insert_ok', v_insert_ok,
    'v_erro_sqlstate', v_erro_sqlstate,
    'v_erro_mensagem', v_erro_mensagem
  );
end;
$$;
