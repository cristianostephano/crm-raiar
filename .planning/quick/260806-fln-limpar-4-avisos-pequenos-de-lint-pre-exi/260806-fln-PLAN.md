---
phase: 260806-fln
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - eslint.config.mjs
  - components/clientes/ClienteDetailSheet.tsx
  - components/clientes/EstadoCidadeFields.tsx
  - components/clientes/FiltersPopover.tsx
  - tests/importacao/annotarLinha.test.ts
autonomous: true
requirements: [LINT-00, LINT-01, LINT-02, LINT-03]

must_haves:
  truths:
    - "`npm run lint` termina com 0 problemas (0 erros, 0 avisos) em todo o repositório"
    - "`npx tsc --noEmit` continua limpo (sai com código 0, sem output)"
    - "Nenhum arquivo de teste que passava antes passa a falhar — o conjunto de arquivos com falha em `npm test` continua contido na lista de testes dependentes de Supabase ao vivo documentada abaixo"
    - "O comportamento visível ao usuário do formulário de cliente, do cascade Estado→Cidade e do popover de filtros permanece idêntico: Cidade continua desabilitada sem Estado, continua listando as cidades do Estado escolhido, e a lista de produtos consumidos continua reagindo às marcações"
  artifacts:
    - eslint.config.mjs
    - components/clientes/ClienteDetailSheet.tsx
    - components/clientes/EstadoCidadeFields.tsx
    - components/clientes/FiltersPopover.tsx
    - tests/importacao/annotarLinha.test.ts
  key_links:
    - "EstadoCidadeFields e FiltersPopover continuam alimentando `<Combobox items={...}>` com a lista de cidades — agora por um valor derivado do estado selecionado, não por um `useState` limpo dentro do efeito"
    - "ClienteDetailSheet continua repassando `form.watch` como prop para EstadoCidadeFields (linha ~610) — só a LEITURA reativa local de `produtoIds` (linha 489) muda para `useWatch`"
    - "`produtoIds` é `z.array(z.string()).optional()` em lib/validations/cliente.ts, então o fallback `?? []` continua sendo necessário"
---

<objective>
Limpar os 4 avisos/erros de lint pré-existentes herdados das Fases 11 e 12, sem mudar nada do comportamento em execução.

Em linguagem simples: o `npm run lint` é o "corretor ortográfico" do código. Hoje ele acusa 4 problemas antigos em telas que já funcionam. Nada quebrou por causa deles, mas enquanto o corretor não fica no zero, é difícil perceber um problema NOVO no meio do ruído. Esta tarefa zera o corretor.

Os 4 achados (confirmados rodando `npm run lint` em 2026-08-06, exatamente onde `deferred-items.md` das Fases 11 e 12 registrou):

| # | Arquivo | Linha | Regra |
|---|---------|-------|-------|
| 1 | `components/clientes/ClienteDetailSheet.tsx` | 489 | `react-hooks/incompatible-library` (erro) |
| 2 | `components/clientes/EstadoCidadeFields.tsx` | 95 | `react-hooks/set-state-in-effect` (erro) |
| 3 | `components/clientes/FiltersPopover.tsx` | 151 | `react-hooks/set-state-in-effect` (erro) |
| 4 | `tests/importacao/annotarLinha.test.ts` | 63 | `@typescript-eslint/no-unused-vars` (aviso) |

**Descoberta feita durante o planejamento (pré-requisito, Task 1):** hoje `npm run lint` reporta **603 problemas**, não 4. Os outros 599 vêm de `.claude/gsd-core/bin/*.cjs` e de `.claude/worktrees/` (cópias inteiras do código-fonte que o GSD instalou no repositório, não rastreadas pelo git). Sem excluir `.claude/**` do ESLint, é impossível atingir o critério "npm run lint passa limpo" — e qualquer futuro erro real do projeto fica invisível no meio do ruído. Task 1 resolve isso com uma linha em `eslint.config.mjs`.

Purpose: devolver ao `npm run lint` a função de portão confiável de qualidade para as próximas fases.
Output: 5 arquivos alterados, `npm run lint` em 0 problemas, sem nenhuma mudança de comportamento em execução.
</objective>

<execution_context>
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Arquivos alterados
@eslint.config.mjs
@components/clientes/ClienteDetailSheet.tsx
@components/clientes/EstadoCidadeFields.tsx
@components/clientes/FiltersPopover.tsx
@tests/importacao/annotarLinha.test.ts

# Testes que provam que o comportamento não mudou
@tests/clientes/estado-cidade-fields.test.tsx
@tests/clientes/filters-popover.test.tsx
@tests/importacao/annotarLinha.test.ts

# Origem dos achados
@.planning/phases/11-funil-de-convers-o-detalhado/deferred-items.md
@.planning/phases/12-comparativo-por-vendedor/deferred-items.md
</context>

<baseline>
Medido em 2026-08-06 imediatamente antes deste plano. Use como referência para provar ausência de regressão.

**Lint (`npm run lint`):** 603 problemas (476 erros, 127 avisos). Excluindo `.claude/**`: exatamente 4 problemas (2 erros, 2 avisos), um por arquivo da tabela do objetivo.

**TypeScript (`npx tsc --noEmit`):** limpo, sai com código 0 e sem output.

**Testes (`npm test`, suíte completa):** 52 arquivos — 30 passam, 22 falham. **Todas as 22 falhas são ambientais**, não de código: são testes que fazem login real contra o projeto Supabase hospedado e batem no rate limit do Auth (`Request rate limit reached`). Lista completa dos 22 arquivos dependentes de Supabase ao vivo:

```
tests/auth/invite.test.ts
tests/auth/login.test.ts
tests/auth/password-reset.test.ts
tests/auth/rls-roles.test.ts
tests/clientes/cliente-actions.test.ts
tests/clientes/estado-constraint.test.ts
tests/clientes/funil-constraints.test.ts
tests/clientes/funil-status.test.ts
tests/clientes/rls-clientes.test.ts
tests/clientes/update-delete.test.ts
tests/configuracoes/rls-listas.test.ts
tests/dashboard/clientes-por-etapa.test.ts
tests/dashboard/desempenho-vendedor.test.ts
tests/dashboard/funil-detalhado.test.ts
tests/dashboard/ganhos-perdidos.test.ts
tests/dashboard/prospeccao.test.ts
tests/dashboard/rls-dashboard.test.ts
tests/equipe/reassignment.test.ts
tests/equipe/rls-desativar-membro.test.ts
tests/equipe/schema-desativacao.test.ts
tests/importacao/rls-dedup-read.test.ts
tests/importacao/rls-importar-lote.test.ts
```

**Os 3 arquivos de teste relevantes a este plano passam hoje** (22 testes, ~7s, sem rede):
`tests/clientes/estado-cidade-fields.test.tsx`, `tests/clientes/filters-popover.test.tsx`, `tests/importacao/annotarLinha.test.ts`.

**Regra do portão final:** "sem regressão" significa que o conjunto de arquivos com falha em `npm test` continua sendo um SUBCONJUNTO da lista de 22 acima. Se qualquer arquivo FORA dessa lista falhar, é regressão real deste plano e precisa ser corrigido antes de commitar.
</baseline>

<tasks>

<task type="auto">
  <name>Task 1: Excluir .claude/** do ESLint para devolver um baseline de lint utilizável</name>
  <files>eslint.config.mjs</files>
  <action>
    Adicionar `".claude/**"` ao array já existente dentro da chamada `globalIgnores([...])` em `eslint.config.mjs`, logo após as entradas atuais (`.next/**`, `out/**`, `build/**`, `next-env.d.ts`).

    Acrescentar um comentário de uma linha acima da nova entrada explicando o motivo em português: `.claude/` guarda a instalação do GSD (scripts `.cjs` em CommonJS) e worktrees de agentes que contêm cópias inteiras do código-fonte — nenhum dos dois é código do produto, e lintá-los produz centenas de falsos positivos (`@typescript-eslint/no-require-imports`) além de duplicar os achados do app.

    NÃO alterar mais nada no arquivo: não mudar as regras herdadas de `eslint-config-next`, não adicionar overrides de regra, não desabilitar nenhuma regra. O objetivo aqui é só reduzir o ESCOPO de arquivos analisados, nunca afrouxar critério sobre código do produto. Em particular: não adicionar `varsIgnorePattern` nem `ignoreRestSiblings` — o achado #4 será corrigido no código do teste (Task 4), não silenciado por configuração.
  </action>
  <verify>
    <automated>npm run lint 2>&1 | grep -q "4 problems (2 errors, 2 warnings)"</automated>
    <automated>npm run lint 2>&1 | grep -c "gsd-core\|worktrees"</automated>
  </verify>
  <done>
    `npm run lint` reporta exatamente 4 problemas (2 erros, 2 avisos), todos nos 4 arquivos listados no objetivo. A segunda verificação retorna 0 (nenhuma linha do relatório vem de `.claude/`). Os 4 achados originais continuam sendo reportados — esta task não corrige nenhum deles, só remove o ruído em volta.
  </done>
</task>

<task type="auto">
  <name>Task 2: Trocar a leitura reativa form.watch por useWatch em ClienteDetailSheet</name>
  <files>components/clientes/ClienteDetailSheet.tsx</files>
  <action>
    O React Compiler não consegue memoizar com segurança o retorno de `form.watch(...)` do react-hook-form quando ele é chamado direto no corpo do componente — daí o erro `react-hooks/incompatible-library` na linha 489. A API equivalente e compatível é o hook `useWatch`, do próprio react-hook-form, que assina o mesmo campo e re-renderiza nas mesmas mudanças.

    Alterações:

    1. No import da linha 7, acrescentar `useWatch` ao lado de `useForm`: `import { useForm, useWatch } from "react-hook-form"`.
    2. Na linha 489, substituir a leitura reativa de `produtoIds` por `useWatch`, passando `control: form.control` e `name: "produtoIds"`, e **preservando o fallback `?? []` exatamente como está hoje** — `produtoIds` é `z.array(z.string()).optional()` em `lib/validations/cliente.ts`, ou seja, o valor pode ser `undefined` e o `?? []` continua carregando peso real. O único consumidor é a linha ~755 (`produtoIds.includes(produto.id)`), que não muda.

    Restrições explícitas (violar qualquer uma é mudança de comportamento, não hygiene):

    - NÃO mexer na linha ~610, onde `form.watch` é repassado como PROP (`watch={form.watch}`) para `EstadoCidadeFields`. Passar a referência não dispara a regra; só a chamada local dispara. `EstadoCidadeFields` recebe esse `watch` tipado como `UseFormWatch<TFieldValues>` e continua funcionando igual.
    - NÃO trocar `form.getValues("produtoIds")` da linha ~434 — `getValues` é leitura pontual dentro de um handler, não é reativa, e não é sinalizada por nenhuma regra.
    - A chamada de `useWatch` precisa ficar no nível superior do corpo do componente e sem condicional. A linha 489 já está nessa posição (não existe nenhum `return` antecipado entre os hooks do início do componente e o `return` do JSX na linha 491), então basta substituir a linha no lugar.
  </action>
  <verify>
    <automated>npx eslint components/clientes/ClienteDetailSheet.tsx</automated>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
    `npx eslint components/clientes/ClienteDetailSheet.tsx` sai com código 0 e sem nenhum output (o erro `react-hooks/incompatible-library` sumiu e nenhum novo apareceu). `npx tsc --noEmit` continua limpo. `produtoIds` continua tipado como `string[] | undefined` antes do `?? []`, e a prop `watch` para `EstadoCidadeFields` segue intacta.
  </done>
</task>

<task type="auto">
  <name>Task 3: Derivar a lista de cidades em vez de limpá-la dentro do useEffect (EstadoCidadeFields + FiltersPopover)</name>
  <files>components/clientes/EstadoCidadeFields.tsx, components/clientes/FiltersPopover.tsx</files>
  <action>
    Os dois componentes têm o mesmo padrão e o mesmo erro `react-hooks/set-state-in-effect`: dentro do corpo do `useEffect`, quando não há Estado escolhido, o estado `cidades` é zerado de forma síncrona. O React Compiler sinaliza isso porque um `setState` síncrono no corpo do efeito provoca render em cascata.

    A correção é a mesma nos dois: **parar de ARMAZENAR o vazio e passar a DERIVÁ-LO**. O efeito passa a apenas retornar cedo quando não há Estado (sem tocar no estado do React), e a lista efetivamente entregue ao `<Combobox items={...}>` vira um valor calculado no render: se há Estado, a lista carregada; se não há, um array vazio.

    **`components/clientes/EstadoCidadeFields.tsx`** (efeito nas linhas 93-111):

    - No `if (!estado) { ... }` do início do efeito, remover a linha que zera o estado, deixando apenas o `return` (early return puro). Todo o resto do efeito — `let cancelled`, o `createClient().rpc("cidades_por_estado", { p_uf: estado })`, o `.then` com a guarda `if (!cancelled)`, o cleanup que marca `cancelled = true`, e o array de dependências `[estado]` — fica **byte a byte igual**.
    - Logo depois do bloco do `useEffect`, declarar uma constante derivada (sugestão de nome: `cidadesVisiveis`) que vale a lista carregada quando `estado` é truthy e um array vazio caso contrário.
    - Trocar `items={cidades}` por `items={cidadesVisiveis}` no `<Combobox>` (linha ~137). Esse é o ÚNICO lugar que consome `cidades` neste arquivo — confirme com uma busca antes de considerar a task pronta.
    - Não mexer em `disabled={!estado}` (nem no `<Combobox>` nem no `<ComboboxInput>`), nem nos três placeholders do Copywriting Contract, nem no cascade reset de `cidade` dentro do `onValueChange` do Select de Estado.

    **`components/clientes/FiltersPopover.tsx`** (efeito nas linhas 149-163):

    - Mesma cirurgia, com `draft.estado` no lugar de `estado`: remover do `if (!draft.estado) { ... }` a linha que zera o estado, deixando só o `return`; manter `cancelled`, o RPC, a guarda e o cleanup idênticos; dependência continua `[draft.estado]`.
    - Declarar a mesma constante derivada logo após o efeito, condicionada a `draft.estado`.
    - Trocar `items={cidades}` por `items={cidadesVisiveis}` no `<Combobox>` (linha ~323) — de novo, o único consumidor.
    - Não mexer em `handleOpenChange`, `handleApply`, `handleClear`, `FILTROS_VAZIOS`, `contarFiltrosAtivos`, `clienteAtendeFiltros`, no cascade `cidade: ""` do `onValueChange` do Select de Estado, nem no `SEM_FILTRO`.

    **Comentário a escrever nos dois arquivos** (2-3 linhas, em português, acima da constante derivada): explicar que a lista exibida é derivada do Estado selecionado em vez de guardada, porque zerar o estado do React dentro do corpo do efeito dispara render em cascata (regra `react-hooks/set-state-in-effect`); derivar produz exatamente o mesmo resultado renderizado. Escreva o comentário descrevendo o conceito — não cole no comentário o trecho de código antigo que está sendo removido.

    **Nota de preservação de comportamento (analisada no planejamento, aceita conscientemente):** em regime permanente o resultado renderizado é idêntico — sem Estado, a lista entregue ao Combobox é vazia e o Combobox está desabilitado, exatamente como hoje. A única diferença é uma janela transitória de poucas centenas de milissegundos no FiltersPopover: ao ir de "Todos os estados" para uma UF, a lista da UF anterior pode aparecer até o RPC responder, em vez de aparecer vazia. Essa mesma janela transitória JÁ existe hoje ao trocar direto de uma UF para outra (o código atual também não limpa nesse caminho), portanto não é uma classe nova de comportamento. Não tente "melhorar" isso neste plano — qualquer tentativa de eliminar a janela (por exemplo indexar a lista carregada pela UF de origem) muda o comportamento do caminho comum UF→UF e sai do escopo de hygiene.
  </action>
  <verify>
    <automated>npx eslint components/clientes/EstadoCidadeFields.tsx components/clientes/FiltersPopover.tsx</automated>
    <automated>npx vitest run tests/clientes/estado-cidade-fields.test.tsx tests/clientes/filters-popover.test.tsx</automated>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
    O ESLint sai com código 0 e sem output para os dois arquivos (os dois erros `react-hooks/set-state-in-effect` sumiram, nenhum aviso novo — em especial nenhum `no-unused-vars` sobre o estado `cidades`, que continua sendo consumido através da constante derivada). Os dois arquivos de teste passam sem alteração nos próprios testes (22 testes verdes no total junto com os demais do comando). `npx tsc --noEmit` limpo.
  </done>
</task>

<task type="auto">
  <name>Task 4: Remover a variável não usada do teste annotarLinha</name>
  <files>tests/importacao/annotarLinha.test.ts</files>
  <action>
    Na linha 63, o teste "rejects a row missing a required field, pointing at the field" usa o idioma de desestruturação-com-rest para construir uma linha SEM o campo `razaoSocial`. A variável intermediária resultante nunca é lida, e o `@typescript-eslint/no-unused-vars` de `eslint-config-next` a reporta mesmo com o prefixo `_` (confirmado no planejamento: o prefixo não é ignorado por esta configuração, e nenhum `varsIgnorePattern` deve ser adicionado — ver Task 1).

    Substituir a desestruturação por uma cópia do objeto seguida da remoção explícita da chave:

    - Declarar uma constante (sugestão: `rest`) tipada como `Record<string, unknown>` recebendo o spread de `baseRow()`.
    - Remover a chave `razaoSocial` dessa cópia com o operador `delete`.
    - Passar essa constante para `createImportRowSchema.safeParse(...)`, exatamente como o teste já faz hoje.

    Por que essa forma e não outra: o `delete` remove a chave de verdade, então o objeto entregue ao Zod é idêntico ao que a desestruturação produzia — o teste continua exercitando "campo ausente", não "campo presente com valor undefined", que é um caminho de validação diferente. O tipo `Record<string, unknown>` é necessário porque o retorno de `baseRow()` tem `razaoSocial` como propriedade obrigatória e o TypeScript não permite `delete` em propriedade obrigatória; `safeParse` aceita `unknown`, então não há perda de segurança de tipo na chamada.

    NÃO alterar as três asserções seguintes (`expect(result.success).toBe(false)` e o `if (!result.success)` com a checagem de `result.error.issues`), nem `baseRow()`, nem qualquer outro teste do arquivo, nem `lib/validations/importacao.ts`, nem `lib/importacao/annotarLinha.ts`.
  </action>
  <verify>
    <automated>npx eslint tests/importacao/annotarLinha.test.ts</automated>
    <automated>npx vitest run tests/importacao/annotarLinha.test.ts</automated>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
    O ESLint sai com código 0 e sem output para o arquivo. Os testes de `annotarLinha.test.ts` continuam todos verdes, incluindo o teste alterado, que segue falhando a validação apontando para o caminho `razaoSocial`. `npx tsc --noEmit` limpo.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

Nenhuma. Este plano não toca em autenticação, autorização, RLS, migrations, Server Actions, entrada de usuário, nem em qualquer fronteira cliente→servidor. Todas as mudanças são internas a componentes já existentes, a um arquivo de teste e à configuração do linter.

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fln-01 | Tampering | `eslint.config.mjs` — excluir caminhos do lint pode mascarar problemas reais no código do produto | low | mitigate | O ignore é restrito a `.claude/**` (instalação do GSD + worktrees de agente, nada de código do produto). Task 1 proíbe explicitamente afrouxar qualquer regra ou adicionar `varsIgnorePattern`/`ignoreRestSiblings`; o achado #4 é corrigido no código (Task 4), não silenciado. O portão final exige `npm run lint` em 0 problemas sobre `app/`, `components/`, `lib/`, `tests/`. |
| T-fln-SC | Tampering | Instalação de pacotes npm/pip/cargo | low | accept | Nenhum pacote é instalado ou atualizado por este plano (`package.json` não está em `files_modified`). Nada a auditar. |
</threat_model>

<verification>
Portão final, rodado uma vez depois das 4 tasks, antes do commit final:

1. **Lint limpo em todo o repositório:**
   ```
   npm run lint
   ```
   Precisa sair com código 0 e SEM nenhum problema listado. Se sobrar qualquer coisa, o plano não está pronto.

2. **TypeScript limpo:**
   ```
   npx tsc --noEmit
   ```
   Precisa sair com código 0 e sem output (igual ao baseline).

3. **Suíte completa de testes, comparada ao baseline:**
   ```
   npm test
   ```
   Espera-se que os testes dependentes de Supabase ao vivo continuem falhando por rate limit do Auth (`Request rate limit reached`) — isso é ambiental e já acontecia antes deste plano. O critério é de SUBCONJUNTO, não de zero falhas:

   - Extraia a lista de arquivos com falha do output.
   - Cada arquivo com falha PRECISA estar na lista de 22 arquivos documentada em `<baseline>`.
   - Se QUALQUER arquivo fora daquela lista falhar, é regressão real deste plano: corrija antes de commitar, não registre como falha ambiental.
   - Registre no SUMMARY quantos arquivos falharam e confirme explicitamente que o conjunto está contido no baseline.

4. **Conferência de escopo (leitura do diff, sem comando):** `git diff --stat` precisa listar exatamente 5 arquivos — `eslint.config.mjs`, os 3 componentes/testes das Tasks 2-4 e nada mais. Nenhum arquivo de migration, nenhuma Server Action, nenhum `package.json`.
</verification>

<success_criteria>
- `npm run lint` termina em 0 problemas (era 603 antes, sendo 4 de código do produto).
- `npx tsc --noEmit` continua limpo.
- Os 3 arquivos de teste relevantes (`estado-cidade-fields.test.tsx`, `filters-popover.test.tsx`, `annotarLinha.test.ts`) continuam verdes, sem que os próprios testes tenham sido alterados para acomodar as mudanças (exceto o corpo do teste da Task 4, que é o alvo declarado).
- Nenhum arquivo de teste fora da lista de 22 dependentes de Supabase ao vivo falha em `npm test`.
- O diff tem exatamente 5 arquivos e nenhuma regra de lint foi afrouxada.
- 4 commits atômicos, um por task, no padrão do projeto (ex.: `chore(lint): ...` / `fix(lint): ...`).
</success_criteria>

<output>
Criar `.planning/quick/260806-fln-limpar-4-avisos-pequenos-de-lint-pre-exi/260806-fln-SUMMARY.md` ao terminar, registrando:
- o antes/depois da contagem do lint (603 → 0),
- a contagem de arquivos com falha em `npm test` e a confirmação de que o conjunto está contido no baseline de 22,
- a nota sobre a janela transitória do FiltersPopover descrita na Task 3, para que fique rastreável se alguém a observar depois.
</output>
