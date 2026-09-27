/*
 * Fase 30 Plano 3 - diagnostico temporario (0041 nao resolveu o bug 42501).
 * Troca o retorno de registrar_acesso_diario() de void para jsonb, sem
 * fazer nenhum INSERT, so para inspecionar o que a funcao enxerga por
 * dentro (auth.uid(), o dia calculado, o resultado do exists de
 * role+ativo). Nao guarda nem expoe nada alem do que o proprio chamador
 * ja sabe sobre si mesmo. Etapa de diagnostico, nao a correcao final - a
 * proxima migration restaura o retorno void com o comportamento real.
 * Nenhuma policy de 0038 muda. Nenhuma clausula de elevacao de privilegio.
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
begin
  v_uid := auth.uid();
  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;

  v_existe_ativo := exists (
    select 1 from profiles p
    where p.id = v_uid and p.role = 'vendedor' and p.ativo = true
  );

  return jsonb_build_object(
    'v_uid', v_uid,
    'v_hoje', v_hoje,
    'v_existe_ativo', v_existe_ativo,
    'current_user', current_user,
    'session_user', session_user
  );
end;
$$;
