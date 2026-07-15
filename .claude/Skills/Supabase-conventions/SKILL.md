---
name: supabase-conventions
description: Convenções de backend com Supabase para este projeto — quando usar RLS, RPC (PL/pgSQL) ou Edge Function, e como estruturar migrations. Use sempre que a tarefa envolver criar/alterar tabelas, políticas de acesso, regras de negócio no banco, ou qualquer lógica de servidor.
---

# Convenções de backend — Supabase

Este projeto não tem backend Node.js separado. Antes de criar qualquer lógica nova, decida onde ela mora usando esta ordem:

1. **RLS (Row Level Security)** — para regra de "quem pode ver/alterar o quê". Sempre a primeira opção para autorização.
2. **Function PL/pgSQL + RPC** — para regra de negócio que só depende de dados já dentro do Postgres (cálculos, updates em cascata, validações complexas).
3. **Edge Function (Deno/TS)** — só quando a lógica precisa de algo externo: chamar API de terceiro, usar uma secret key, processar webhook, enviar e-mail.

Não crie Edge Function para algo que RLS ou uma function no banco já resolvem — isso é o erro mais comum que aumenta custo e complexidade sem necessidade.

## Regras de tabela

- Toda tabela nova: `alter table <nome> enable row level security;` é obrigatório antes de qualquer policy.
- Nunca deixar uma tabela sem nenhuma policy (isso bloqueia todo acesso via API, então é sempre necessário criar as policies junto).
- Nomeie policies descrevendo a regra em português simples, ex: `"usuarios veem apenas contatos da propria organizacao"`.

## Migrations

- Toda alteração de schema vira uma migration versionada em `/supabase/migrations`, nunca uma alteração direta via dashboard.
- Uma migration por mudança lógica (não acumular várias mudanças não relacionadas em uma migration só).

## RPC — exemplo de padrão esperado

```sql
create or replace function nome_da_acao(param_id uuid)
returns void as $$
begin
  -- validações e updates aqui
end;
$$ language plpgsql security definer;
```

Chamada do frontend:
```typescript
await supabase.rpc('nome_da_acao', { param_id: id })
```

## Edge Function — exemplo de padrão esperado

```typescript
// supabase/functions/<nome>/index.ts
Deno.serve(async (req) => {
  const body = await req.json()
  // lógica que precisa de algo externo
  return new Response(JSON.stringify({ ok: true }))
})
```

Chamada do frontend:
```typescript
await supabase.functions.invoke('<nome>', { body: {...} })
```
