/*
 * Fase 30 Plano 3 - diagnostico temporario, parte 2.
 * O diagnostico anterior (0042) mostrou que auth.uid(), o dia calculado e
 * o exists() de role+ativo estao TODOS corretos por dentro da funcao -
 * ainda assim o INSERT falha com violacao de RLS. Isso sugere que o texto
 * das POLICIES realmente aplicadas no banco pode nao ser identico ao do
 * arquivo local (por exemplo, se algo foi alterado sem querer ao colar no
 * SQL Editor, como aconteceu com os comentarios do 0042). Esta migration
 * so LE (nao altera nada) a definicao das 3 policies de acessos_diarios,
 * exatamente como estao gravadas no banco agora, para eu comparar com o
 * arquivo local (0038). Nao expoe nenhum dado de cliente ou funcionario -
 * so a definicao de regras (metadado de schema), visivel apenas para
 * Supervisor.
 */

drop function if exists diagnostico_policies_acessos_diarios();

create or replace function diagnostico_policies_acessos_diarios()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'policyname', policyname,
        'cmd', cmd,
        'qual', qual,
        'with_check', with_check
      )), '[]'::jsonb)
      from pg_policies
      where tablename = 'acessos_diarios'
    ),
    'function_def', (
      select pg_get_functiondef(oid)
      from pg_proc
      where proname = 'registrar_acesso_diario'
    )
  );
$$;
