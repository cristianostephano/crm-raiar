---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - next.config.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Confirmar a importação de 'Clientes Ativos' com uma planilha grande (ex.: 1909 linhas) não retorna mais o erro 'Body exceeded 1 MB limit' do Next.js."
    - "O time entende, ao ler next.config.ts, por que esse limite existe e por que não adianta subir o valor além de alguns MB (teto real é o limite de payload de função serverless da Vercel, não este arquivo)."
  artifacts:
    - "next.config.ts — define experimental.serverActions.bodySizeLimit acima do default de 1MB do Next.js"
  key_links:
    - "next.config.ts (experimental.serverActions.bodySizeLimit) -> app/actions/importacaoAtivos.ts (validarLoteAtivos/confirmarLoteAtivos, recebem o lote inteiro como argumento de Server Action) -> app/actions/importacao.ts (validarLoteImportacao/confirmarLoteImportacao, mesmo padrão para prospecção)"
---

<objective>
Corrigir o erro "Body exceeded 1 MB limit" que aparece ao confirmar a importação de "Clientes Ativos" com planilhas grandes (testado com 1909 linhas). Causa raiz: `next.config.ts` não define `experimental.serverActions.bodySizeLimit`, então vale o default do Next.js de 1MB — as Server Actions de importação (`validarLoteAtivos`/`confirmarLoteAtivos` em `app/actions/importacaoAtivos.ts`, e as equivalentes de prospecção `validarLoteImportacao`/`confirmarLoteImportacao` em `app/actions/importacao.ts`) recebem o lote inteiro de linhas já parseadas no navegador (via SheetJS) como argumento — um array JSON que passa de 1MB facilmente em planilhas de milhares de linhas.

Purpose: sem esse ajuste, qualquer planilha grande falha ao confirmar a importação, mesmo que os dados estejam corretos — é um bloqueio de infraestrutura, não um bug de lógica de negócio.
Output: `next.config.ts` com `experimental.serverActions.bodySizeLimit` configurado para um valor generoso o suficiente para lotes de milhares de linhas, com comentário explicando o porquê e o teto real de produção (limite de payload de Serverless Function da Vercel).
</objective>

<execution_context>
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@next.config.ts
@app/actions/importacaoAtivos.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Configurar bodySizeLimit das Server Actions em next.config.ts</name>
  <files>next.config.ts</files>
  <action>
    Editar `next.config.ts` (hoje só exporta um `NextConfig` vazio) para adicionar `experimental: { serverActions: { bodySizeLimit: "10mb" } }` dentro do objeto `nextConfig`. O campo `bodySizeLimit` aceita uma string tipo `SizeLimit` (ex.: `"10mb"`) ou um número em bytes — confirmado em `node_modules/next/dist/server/config-shared.d.ts` (tipo `NextConfigExperimental.serverActions.bodySizeLimit`). Use a forma string `"10mb"` por legibilidade.

    Acima do objeto `nextConfig` (ou como comentário de bloco imediatamente antes/dentro da chave `serverActions`), adicionar um comentário multilinha explicando dois pontos, sem repetir a mensagem de erro do Next literalmente palavra por palavra (para não colidir com nenhum grep de teste que procure esse texto — descreva o sintoma pelo conceito, não pela string exata do erro):
    1. Por que o valor default do Next (1MB) não é suficiente aqui: as Server Actions de importação de planilha (`validarLoteAtivos`/`confirmarLoteAtivos` em `app/actions/importacaoAtivos.ts`, e as equivalentes de prospecção em `app/actions/importacao.ts`) recebem o lote inteiro de linhas já parseadas no navegador como argumento da Server Action — um payload JSON que cresce proporcionalmente ao número de linhas da planilha e passa de 1MB em planilhas de milhares de linhas (caso real: 1909 linhas).
    2. Que esse valor NÃO pode subir indefinidamente: o teto real em produção é o limite de tamanho de payload da Serverless Function da plataforma de deploy (Vercel, inclusive no plano gratuito/Hobby, gira em torno de 4.5MB) — uma restrição de infraestrutura da plataforma, não configurável por este arquivo. Girar `bodySizeLimit` para um valor muito acima disso (ex.: "50mb") não resolveria nada em produção, só mascararia o problema em ambiente local.

    Manter o resto do arquivo (`import type { NextConfig } from "next"`, `export default nextConfig`) intacto — a mudança é isolada ao objeto de configuração e ao comentário.
  </action>
  <verify>
    <automated>cd C:/Users/Cristiano/workspace/crm-raiar && npx tsc --noEmit</automated>
  </verify>
  <done>
    `next.config.ts` exporta `experimental.serverActions.bodySizeLimit: "10mb"` (ou valor equivalente >1MB e abaixo do teto de payload de Serverless Function da plataforma de deploy), com comentário explicando a causa raiz (payload de lote de importação cresce com o número de linhas) e o teto real de produção (limite de Serverless Function da Vercel, ~4.5MB, não configurável aqui). `npx tsc --noEmit` passa sem erros novos. `npm run build` conclui sem falhas relacionadas a `next.config.ts`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Navegador → Server Action | Lote de linhas de planilha (JSON) enviado do cliente para `validarLoteAtivos`/`confirmarLoteAtivos`/`validarLoteImportacao`/`confirmarLoteImportacao` — dado não confiável, mas o gate de autorização (checagem de sessão + papel de supervisor) já ocorre dentro de cada Server Action, antes de qualquer leitura ou escrita, e não é afetado por esta mudança. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-quick260831-01 | Denial of Service | next.config.ts (`experimental.serverActions.bodySizeLimit`) | low | accept | Subir o limite de 1MB (default) para 10mb aumenta a superfície de payload aceito por requisição, mas o gate de autenticação/autorização dentro de cada Server Action roda antes de qualquer processamento pesado do lote, e o teto real de infraestrutura (Serverless Function da Vercel, ~4.5MB) já limita o tamanho máximo aceito em produção independentemente deste valor — risco residual aceitável para um CRM interno de uso autenticado. |
</threat_model>

<verification>
Rodar a suíte de testes existente para garantir que nenhuma mudança de comportamento não intencional foi introduzida (mudança é só configuração, nenhum teste novo é necessário conforme instrução do usuário):

```bash
cd C:/Users/Cristiano/workspace/crm-raiar && npx tsc --noEmit && npm run build
```

Confirmar manualmente (opcional, não bloqueante): reimportar a planilha real de ~1909 linhas de "Clientes Ativos" pela UI e confirmar que a tela de confirmação não retorna mais o erro de limite de corpo da requisição.
</verification>

<success_criteria>
- `next.config.ts` define `experimental.serverActions.bodySizeLimit` acima do default de 1MB (ex.: `"10mb"`).
- Comentário no arquivo explica a causa raiz (payload de lote de importação) e o teto real de produção (limite de Serverless Function da plataforma de deploy), evitando que alguém suba o valor além do necessário no futuro.
- `npx tsc --noEmit` e `npm run build` passam sem erros novos.
- Nenhuma mudança em `app/actions/importacaoAtivos.ts` ou `app/actions/importacao.ts` — a correção é isolada à configuração do Next.
</success_criteria>

<output>
Create `.planning/quick/260831-oax-bug-server-action-de-importacao-de-clien/260831-oax-SUMMARY.md` when done
</output>
