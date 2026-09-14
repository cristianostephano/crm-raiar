---
status: complete
---

# Quick Task 260914-k3g: Unicidade razão social + CNPJ (causa raiz no banco)

## O que foi feito

`clientes.razao_social` tinha uma constraint `unique` desde a migration 0002, fazendo o Postgres recusar silenciosamente qualquer segunda linha com a mesma razão social — mesmo com CNPJ diferente. Confirmado ao vivo: numa importação real de "Clientes Ativos" (1755 linhas), 743 foram puladas como "duplicado" só porque são lojas de rede (Carrefour, Outback Steakhouse) com razão social igual e CNPJ diferente por filial. Este era o mesmo problema de negócio já corrigido na camada de aplicação pela quick task 260914-j8g (aviso da tela), mas a trava real do banco continuava intacta.

**Migration 0030** trocou a regra: razão social + CNPJ juntos, via:
- Remoção dinâmica (por introspecção, nunca nome fixo) da constraint única antiga.
- `razao_social_cnpj_colide(...)` — função pura, única fonte de verdade da regra de colisão (CNPJ nulo de qualquer lado = colide pelo nome; CNPJ presente e diferente = não colide).
- Trigger `SECURITY DEFINER` no caminho manual (`createCliente`/`updateCliente`), preservando o código de erro Postgres `23505` que essas duas Server Actions já capturavam.
- As duas RPCs de importação em massa (`importar_clientes_lote`, `importar_clientes_ativos_lote`) recriadas com pré-filtro (nunca `ON CONFLICT`, já que não sobrou índice único simples pra apontar).

## Bugs encontrados e corrigidos DEPOIS da aplicação de 0030 (mesmo dia)

Só apareceram ao rodar os testes de integração contra o banco real recém-migrado:

- **0031** — `jsonb_to_recordset(...) with ordinality as c(coluna tipo, ...)` não é sintaxe válida do Postgres (erro 42601, "Put the column definition list inside ROWS FROM()"). Quebrou as duas RPCs por completo. Corrigido com `rows from (...) with ordinality as c(...)`.
- **0032** — primeira tentativa de corrigir a classificação de linhas duplicadas dentro do mesmo lote (a chave razão social+CNPJ deixa de ser única entre linhas ORIGINAIS quando há duplicata interna), mas introduziu uma autocolisão nova.
- **0033** — fix definitivo: a classificação da RPC de Ativos nunca mais reconsulta a tabela `clientes` depois do INSERT (a linha recém-gravada estava colidindo consigo mesma na segunda passada). Usa só o resultado já conhecido do INSERT + a checagem de duplicata interna do lote (que não toca a tabela).

## Verificação

- `tests/importacao/unicidade-razao-social-cnpj.test.ts` — 6/6 (3 casos × 2 RPCs: CNPJ igual→colide, CNPJ diferente→não colide, CNPJ ausente de um lado→colide).
- `tests/importacao/importar-ativos-lote.test.ts` — 10/10 (regressão, sem quebra).
- Verificação manual ad-hoc confirmando que o trigger novo preserva `error.code === "23505"` pro cadastro manual (`createCliente`/`updateCliente`).
- `npx tsc --noEmit` — limpo.
- Nenhuma migration 0001-0029 editada — só arquivos novos (0030, 0031, 0032, 0033).
- Verificado por um agente `gsd-verifier` independente: 7/7 must-haves, rodando os testes ele mesmo contra o banco real.

## Commits

- `bc257c6` — migration 0030 (Task 1)
- `b3c7a81` — testes de integração (Task 2)
- `999195d` — migrations 0031/0032/0033 (fixes pós-aplicação)

## Fora de escopo / conhecido

- 15 falhas em `tests/clientes/cliente-actions.test.ts`/`rls-clientes.test.ts` são 100% a conta seed `vendedor.a+test@raiar.local` apagada (gap pré-existente e documentado em STATE.md desde 2026-08-19), sem relação com esta migration.
