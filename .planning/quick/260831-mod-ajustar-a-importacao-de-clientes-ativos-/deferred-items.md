# Deferred Items — quick-260831-mod

## rls-importar-lote.test.ts — 8 testes falhando por credencial de usuário de teste inválida

**Encontrado durante:** verificação geral do plano (item 3 da seção `<verification>`).

**Sintoma:** `npx vitest run tests/importacao/rls-importar-lote.test.ts` falha em 8/8 casos que dependem de `signInAs("vendedor.a+test@raiar.local")` com `Invalid login credentials`. O único teste que não depende de login de vendedor (`is_supervisor() returns true for a supervisor-role caller`) passa normalmente.

**Por que é fora de escopo:** este arquivo de teste e `tests/helpers/supabase-test-clients.ts` não foram tocados por nenhuma das duas mudanças desta task (contato opcional / casamento por primeiro nome). O último commit que alterou esses arquivos é de fases muito anteriores (07-01, 10-02, 19-01). A falha é de infraestrutura de teste — a conta `vendedor.a+test@raiar.local` no projeto Supabase hospedado parece ter senha/estado inválido (possivelmente rotacionada ou removida em alguma limpeza de dados de teste) — não uma regressão introduzida por este plano.

**Ação tomada:** nenhuma correção aplicada (fora do escopo desta task, por `SCOPE BOUNDARY`). Recomenda-se investigar a fixture de usuários de teste do projeto hospedado (`tests/helpers/supabase-test-clients.ts` / seed de `vendedor.a+test@raiar.local`) em uma tarefa futura dedicada.

**Não bloqueia** as mudanças desta task: `annotarLinha.ts` (Prospecção) permanece intocado (D-02), e a RPC irmã `importar_clientes_lote` não foi alterada por este plano.
