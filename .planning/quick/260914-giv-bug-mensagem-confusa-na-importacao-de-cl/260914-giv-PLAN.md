---
phase: quick-260914-giv
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260914-giv]
files_modified:
  - lib/importacao/annotarLinha.ts
  - tests/importacao/annotarLinha.test.ts

must_haves:
  truths:
    - "Na importação de Clientes em Prospecção, uma linha com a coluna Responsável GENUINAMENTE em branco continua mostrando o motivo 'Responsável não informado' — comportamento intocado."
    - "Na mesma importação, uma linha com a coluna Responsável PREENCHIDA mas que não casa com nenhum vendedor cadastrado (nem por email, nem por 'nome sobrenome' completo) passa a mostrar um motivo DIFERENTE, nomeando o valor lido: `Responsável \"X\" não foi encontrado` — nunca mais a frase de campo vazio."
    - "Uma linha com Responsável preenchido e casando (email exato ou nome completo exato) continua status 'ok', sem nenhum motivo de erro — zero regressão no caminho feliz."
    - "lib/importacao/annotarLinhaAtivo.ts (importação de Clientes Ativos) permanece byte-a-byte intocado — é só a referência de padrão já correta, fora de escopo desta correção."
  artifacts:
    - lib/importacao/annotarLinha.ts
    - tests/importacao/annotarLinha.test.ts
  key_links:
    - "RESPONSAVEL_NAO_ENCONTRADO_REASON (nova, annotarLinha.ts) <-> passo 4 de annotarLinha (branch 'preenchido mas sem match'): a nova constante substitui RESPONSAVEL_REASON SOMENTE nesse branch; o passo 5 (required-field check via createImportRowSchema, campo genuinamente vazio) continua usando RESPONSAVEL_REASON sem nenhuma mudança."
---

<objective>
Corrigir a mensagem de erro confusa da importação de "Clientes em Prospecção": hoje uma linha com Responsável PREENCHIDO mas sem correspondência a nenhum vendedor cadastrado mostra a mesma frase "Responsável não informado" usada para campo vazio, confundindo o usuário sobre a causa real do erro (confirmado ao vivo: 231 de 429 linhas reais erraram com essa frase, nenhuma com célula vazia).

Purpose: `lib/importacao/annotarLinhaAtivo.ts` (importação de Clientes Ativos) já resolve exatamente este problema com duas constantes distintas — replicar o mesmo padrão na importação de Prospecção (`annotarLinha.ts`), que ficou para trás.

Output:
- `lib/importacao/annotarLinha.ts`: nova constante `RESPONSAVEL_NAO_ENCONTRADO_REASON`, usada só no branch "preenchido mas sem match" (passo 4); `RESPONSAVEL_REASON` continua reservada ao campo genuinamente vazio (passo 5).
- `tests/importacao/annotarLinha.test.ts`: teste existente ajustado + 3 testes novos cobrindo os três cenários (vazio / preenchido sem match / preenchido com match).
</objective>

<execution_context>
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md

Arquivos-fonte que o executor precisa ler antes de editar:
@lib/importacao/annotarLinha.ts
@tests/importacao/annotarLinha.test.ts

Só para referência do PADRÃO já correto (NÃO editar):
@lib/importacao/annotarLinhaAtivo.ts
</context>

<decisoes_travadas>
- **Escopo estrito a `lib/importacao/annotarLinha.ts` (Prospecção) e `tests/importacao/annotarLinha.test.ts`.** `lib/importacao/annotarLinhaAtivo.ts` (Ativos) já está correto e serve só de referência de padrão — não deve ser tocado nesta task.
- **`RESPONSAVEL_REASON = "Responsável não informado"` continua existindo e continua sendo usada exclusivamente para o caso de campo vazio** (branch do passo 5, required-field check via `createImportRowSchema`). Não renomear nem remover essa constante.
- **Nova constante segue o MESMO padrão de `annotarLinhaAtivo.ts`**: `RESPONSAVEL_NAO_ENCONTRADO_REASON = (valor: string): string => \`Responsável "${valor}" não foi encontrado\``, usada apenas no branch do passo 4 (preenchido, sem match em `findVendedor`).
</decisoes_travadas>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Distinguir mensagem de "não encontrado" da mensagem de "não informado" para Responsável em annotarLinha.ts</name>
  <files>tests/importacao/annotarLinha.test.ts, lib/importacao/annotarLinha.ts</files>
  <behavior>
    - Campo Responsável genuinamente vazio (célula ausente ou só espaço) → `status: "erro"`, motivo exatamente `"Responsável não informado"` (comportamento existente, sem mudança).
    - Campo Responsável preenchido com um valor que não casa com nenhum vendedor de `lookups.vendedores` (nem por email, nem por "nome sobrenome" completo via `findVendedor`) → `status: "erro"`, motivo exatamente `Responsável "X" não foi encontrado` (onde X é o valor lido da célula, já aparado), `resolved.responsavelId` nulo, e a lista de motivos NÃO contém mais `"Responsável não informado"` para essa linha.
    - Campo Responsável preenchido com um valor que casa (email exato ou "nome sobrenome" completo exato) → `status: "ok"`, `resolved.responsavelId` igual ao id do vendedor casado, sem nenhum motivo de erro relacionado a Responsável (regressão do caminho feliz).
  </behavior>
  <action>
Escrever/ajustar os testes ANTES da implementação (RED), rodar `npx vitest run tests/importacao/annotarLinha.test.ts` e confirmar que o teste ajustado falha pelo motivo certo (mensagem antiga ainda sendo produzida), depois implementar (GREEN).

**`tests/importacao/annotarLinha.test.ts` (RED):**
- No teste existente `"flags a responsável not found in lookups as erro (IMP-04)"` (linha ~221, usa `responsavel: "ninguem@raiar.local"`), trocar a asserção `expect(result.reasons).toContain("Responsável não informado")` por `expect(result.reasons).toContain('Responsável "ninguem@raiar.local" não foi encontrado')`, e adicionar `expect(result.reasons).not.toContain("Responsável não informado")` logo abaixo, para travar a distinção (não basta a frase nova aparecer, a frase antiga precisa desaparecer desse caso).
- Adicionar um teste novo, próximo ao teste `"flags a row with Nome Fantasia filled but Responsável blank as erro"` (linha ~136), cobrindo explicitamente o caso (a) campo vazio: reaproveitar o mesmo corpo de linha já usado nesse teste (Responsável ausente) e confirmar `reasons` contém exatamente `"Responsável não informado"` e NÃO contém nenhuma variação de "não foi encontrado" — pode ser uma asserção adicional dentro do teste existente, já que ele já cobre o cenário, ou um teste dedicado curto se preferir isolar; escolha a forma que não duplique cobertura.
- Confirmar que os testes já existentes `"resolves responsável by exact email"` (linha ~232) e `"resolves responsável by normalized full name"` (linha ~242) já cobrem o caso (c) campo preenchido com match — não precisam de mudança, mas rode-os junto para confirmar que continuam verdes depois da mudança na Task (regressão do caminho feliz).

**`lib/importacao/annotarLinha.ts` (GREEN):**
- Logo abaixo da constante `RESPONSAVEL_REASON` (linha ~78), adicionar uma nova constante seguindo o mesmo padrão de `lib/importacao/annotarLinhaAtivo.ts`:
  `const RESPONSAVEL_NAO_ENCONTRADO_REASON = (valor: string): string => \`Responsável "${valor}" não foi encontrado\``
  com um comentário explicativo adaptado do arquivo de referência: distinto do motivo de campo em branco (`RESPONSAVEL_REASON`, usado no required-field check do passo 5) — um responsável PREENCHIDO que não casa com nenhum vendedor é um problema diferente do campo vazio, e confundir os dois na mesma frase é exatamente o bug desta correção (planilha real: 231 de 429 linhas reais erraram com a frase de campo vazio, nenhuma com célula vazia de fato).
  Não usar a frase de campo vazio como texto literal dentro do comentário explicativo — descreva o conceito em prosa ("a frase reservada ao campo em branco") em vez de citar a string entre aspas, para não confundir qualquer checagem automática de contagem de string no arquivo.
- No passo 4 (bloco `// 4. Responsável (vendedor)`, linha ~164-176), no branch `else` (quando `findVendedor` não encontra match), trocar `reasons.push(RESPONSAVEL_REASON)` por `reasons.push(RESPONSAVEL_NAO_ENCONTRADO_REASON(responsavelValor))`. Atualizar o comentário do bloco (linhas 164-166) para não afirmar mais que o branch preenchido-sem-match produz "uma entrada duplicada de 'Responsável não informado'" — em vez disso, explicar que ele produz um motivo PRÓPRIO e distinto (`RESPONSAVEL_NAO_ENCONTRADO_REASON`), enquanto o campo vazio continua sendo tratado só pelo required-field check do passo 5 (mantendo a frase original `RESPONSAVEL_REASON`).
- No passo 5 (bloco `if (!parsed.success)`, linha ~219-228), NÃO alterar o branch `field === "responsavel"` — continua usando `reasons.push(RESPONSAVEL_REASON)`, exatamente como hoje, porque esse branch só dispara quando `sanitized.responsavel` está genuinamente ausente/vazio (validado pelo zod schema `createImportRowSchema`).
- Não alterar nenhuma outra função ou branch do arquivo (categoria, produtos, estado, cidade, cnpj, nomeFantasia, razaoSocial) além do necessário para esta distinção.
- **Não editar `lib/importacao/annotarLinhaAtivo.ts` sob nenhuma circunstância nesta task.**
  </action>
  <verify>
    <automated>npx vitest run tests/importacao/annotarLinha.test.ts</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>npx eslint lib/importacao/annotarLinha.ts tests/importacao/annotarLinha.test.ts</automated>
    <automated>git diff --stat -- lib/importacao/annotarLinhaAtivo.ts</automated>
    <expected>(saída vazia — nenhuma linha alterada)</expected>
  </verify>
  <done>annotarLinha.ts distingue os dois casos de Responsável com constantes próprias (RESPONSAVEL_REASON só para campo vazio, RESPONSAVEL_NAO_ENCONTRADO_REASON para preenchido-sem-match); o teste existente que cobria o caso preenchido-sem-match foi corrigido para a nova mensagem, um teste cobrindo explicitamente o caso de campo vazio confirma que a frase antiga permanece isolada a esse cenário, os testes de caminho feliz (email exato, nome completo exato) continuam verdes, e lib/importacao/annotarLinhaAtivo.ts permanece sem nenhuma linha alterada.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| planilha do vendedor/supervisor → `annotarLinha` (preview de importação) | conteúdo de célula não confiável (valor de Responsável) atravessa aqui; já saneado por `sanitizeCell` antes de chegar nesta lógica — mudança desta task é só de TEXTO de mensagem de erro, não introduz novo caminho de dado não saneado |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-GIV-01 | Information Disclosure | `RESPONSAVEL_NAO_ENCONTRADO_REASON` (annotarLinha.ts) | low | accept | A nova mensagem ecoa de volta o valor exato digitado na célula de Responsável (ex: nome de uma pessoa) na tela de preview de importação — já visível pelo mesmo usuário que digitou a planilha (vendedor/supervisor autenticado, RLS-scoped), sem alcance a terceiros; mesmo padrão já aceito e em produção em `annotarLinhaAtivo.ts` desde a quick task 260831-mod |
| T-GIV-SC | Tampering | npm/pip/cargo installs | low | accept | Esta task não instala nenhum pacote novo — só edita um arquivo TypeScript existente e seu teste |
</threat_model>

<verification>
1. `npx vitest run tests/importacao/annotarLinha.test.ts` — VERDE, incluindo o teste corrigido e os testes de caminho feliz.
2. `npx vitest run tests/importacao/confirmar.test.ts tests/importacao/prospeccao-vocabulario.test.ts` — VERDE (provam que nada mais no fluxo de Prospecção que consome `ResolvedRow`/`annotarLinha` quebrou).
3. `npx vitest run tests/importacao/annotarLinhaAtivo.test.ts` — VERDE, sem nenhuma mudança de comportamento (prova de isolamento entre os dois fluxos).
4. `npx tsc --noEmit` e `npx eslint` limpos.
5. `git diff --stat -- lib/importacao/annotarLinhaAtivo.ts` sem saída (arquivo de referência intocado).

Se algum teste divergir do esperado, corrigir a IMPLEMENTAÇÃO quando a divergência for de comportamento exigido pelas decisões travadas, e o TESTE quando for detalhe de forma não exigido. Nunca reintroduzir a frase de campo vazio no branch de "preenchido mas sem match".
</verification>

<success_criteria>
- [ ] Campo Responsável vazio continua produzindo "Responsável não informado"
- [ ] Campo Responsável preenchido sem match produz `Responsável "X" não foi encontrado`, nunca mais a frase de campo vazio
- [ ] Campo Responsável preenchido com match (email exato ou nome completo exato) continua status "ok", sem regressão
- [ ] `lib/importacao/annotarLinhaAtivo.ts` permanece byte-a-byte intocado
- [ ] `npx tsc --noEmit` e `npx eslint` limpos
</success_criteria>

<output>
Create `.planning/quick/260914-giv-bug-mensagem-confusa-na-importacao-de-cl/260914-giv-SUMMARY.md` when done, registrando:
- o comportamento anterior confuso e a evidência real (231/429 linhas, planilha real do dono);
- a nova constante `RESPONSAVEL_NAO_ENCONTRADO_REASON` e a distinção mantida com `RESPONSAVEL_REASON`;
- confirmação de que `lib/importacao/annotarLinhaAtivo.ts` não foi tocado.
</output>
