-- Phase 30 Plan 3 — diagnóstico temporário (0041 não resolveu o bug).
--
-- 0041 trocou o corpo por IF EXISTS(...) THEN INSERT ... VALUES(...) e o
-- mesmo erro 42501 continuou. Isso descarta a hipótese de que a FORMA da
-- instrução (SELECT sem FROM vs VALUES) era a causa: mesmo um INSERT
-- simples, de dentro de uma função plpgsql chamada via .rpc(), viola a
-- policy — enquanto o MESMO insert, feito direto pelo cliente (sem
-- função), passa.
--
-- Este arquivo troca temporariamente o retorno da função de `void` para
-- `jsonb`, SEM fazer nenhum INSERT ainda — só devolve o que a função
-- enxerga (auth.uid(), o dia calculado, e o resultado do exists() de
-- role/ativo) para eu confirmar exatamente o que difere entre os dois
-- contextos, antes de escrever a correção definitiva na próxima migration.
-- Não guarda nem expõe nada além do que o próprio chamador já sabe sobre
-- si mesmo (LGPD: nenhum dado de terceiro é lido ou devolvido aqui).
--
-- Este arquivo é uma etapa de diagnóstico, não a correção final — a
-- próxima migration (0043) vai restaurar `registrar_acesso_diario()` com
-- `returns void` e o comportamento real, já usando o que for aprendido
-- aqui.
--
-- Nenhuma policy de 0038 muda. Nenhuma cláusula de elevação de privilégio.

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
