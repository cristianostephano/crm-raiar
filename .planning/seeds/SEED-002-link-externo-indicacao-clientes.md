---
id: SEED-002
status: dormant
planted: 2026-09-25
planted_during: v1.7 Ajustes Pós-Teste com o Time de Vendas (definição de escopo, ainda não roteirizado)
trigger_when: quando o dono do projeto quiser escalar a geração de leads além do que os vendedores prospectam manualmente, ou quando parceiros/clientes já ativos pedirem uma forma de indicar novos negócios
scope: large
---

# SEED-002: Link externo de indicação de clientes

Permitir que pessoas de fora da empresa (sem login no sistema) indiquem/cadastrem novos clientes, que entram automaticamente no funil de vendas em "Aguardando contato" — um formulário público de indicação/referência.

## Why This Matters

Hoje todo cliente novo entra no funil só por cadastro manual do vendedor (ou importação em massa pelo Supervisor). Um link externo de indicação abriria um canal a mais de geração de leads — parceiros, feiras, ou mesmo clientes já ativos indicando conhecidos — sem depender só do trabalho manual de prospecção do time. Bate com o "Core Value" do projeto (reduzir fricção de cadastro), só que aplicado a quem está FORA do sistema, não a quem já usa.

## When to Surface

**Trigger:** quando o dono do projeto quiser escalar a geração de leads além do que os vendedores prospectam manualmente, ou quando parceiros/clientes já ativos pedirem uma forma de indicar novos negócios.

Também vale reconsiderar automaticamente se, num futuro marco, o volume de clientes cadastrados manualmente parar de crescer e a geração de leads virar um gargalo relatado pelo time.

## Scope Estimate

**Large** — não é uma tela simples. Envolve pelo menos três frentes que hoje não existem no projeto:

1. **Segurança/RLS:** hoje toda escrita no banco passa por sessão autenticada + RLS (`CLAUDE.md`: "nenhuma lógica de permissão feita à mão"). Um formulário público precisa de um caminho de escrita que funcione SEM login — provavelmente uma Edge Function ou RPC `SECURITY DEFINER` bem escopado, com proteção contra spam/abuso (rate limiting, captcha ou equivalente) — a 5ª exceção `SECURITY DEFINER` do projeto, se vier a existir.
2. **Atribuição de responsável:** quem vira o vendedor responsável pelo cliente indicado — distribuição manual pelo Supervisor depois (fila de "leads externos" a triar?), ou automática por algum critério (rodízio, região, carga de trabalho)? Isso é uma decisão de produto em aberto, não só técnica.
3. **LGPD/privacidade:** coleta de dado pessoal de alguém que nunca criou conta nem deu consentimento dentro da plataforma — precisa de aviso de privacidade no próprio formulário público e cuidado redobrado com o que é coletado e como é armazenado.

## Breadcrumbs

- `app/actions/importacao.ts` / `app/actions/importacaoAtivos.ts` — os dois únicos caminhos hoje que criam clientes em lote sem ser cadastro manual individual; padrão de referência para "como um cliente entra no funil sem ser digitado um por um pelo vendedor", mas ambos exigem sessão de Supervisor autenticado — o oposto do que este seed precisa.
- `supabase/migrations/` — os 4 casos existentes de `SECURITY DEFINER` documentados em `.planning/STATE.md` (`is_supervisor()`, `desativar_membro_equipe`/`reativar_membro_equipe`, `cidades_com_clientes_por_estado`, `clientes_bloqueia_duplicata_razao_social_cnpj`) — nenhum deles lida com escrita vinda de fora do sistema autenticado; este seed abriria um precedente novo.
- `lib/funil/etapas.ts` — todo cliente novo hoje entra em "Aguardando contato" (`ETAPA_KEYS[0]`), mesmo destino que este seed usaria.

## Notes

Capturado durante a conversa de definição do marco v1.7, a pedido explícito do dono do projeto ("não é tão urgente... guardar como ideia futura, fora do escopo deste marco"). Não entra no roteiro atual.
