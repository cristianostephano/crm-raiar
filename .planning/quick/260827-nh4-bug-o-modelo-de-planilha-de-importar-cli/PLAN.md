---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/importacao/modeloAtivo.ts
  - tests/importacao/ativos-vocabulario.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "O modelo de planilha 'Importar Clientes Ativos' baixado pelo usuário marca cada campo obrigatório (incluindo CNPJ) com o sufixo visível ' *' no cabeçalho, igual ao modelo de 'Importar Clientes em Prospecção'."
    - "Um modelo de ativos baixado, preenchido e reenviado continua sendo mapeado automaticamente pelo suggestMapping, sem exigir remapeamento manual por causa do asterisco."
  artifacts:
    - "lib/importacao/modeloAtivo.ts — buildModeloAtivos usa REQUIRED_MARKER para sufixar labels de campos required:true"
    - "tests/importacao/ativos-vocabulario.test.ts — asserção de cabeçalho cobre o sufixo required, incluindo CNPJ"
  key_links:
    - "SYSTEM_FIELDS_ATIVO (lib/importacao/typesAtivo.ts, required:true em 9 campos) -> buildModeloAtivos (lib/importacao/modeloAtivo.ts, gera headers) -> suggestMapping (lib/importacao/mapping.ts, normalizeHeader descarta o sufixo ao comparar)"
---

<objective>
Corrigir `buildModeloAtivos` (lib/importacao/modeloAtivo.ts) para marcar cabeçalhos de campos obrigatórios com o sufixo " *", espelhando exatamente o padrão que `buildModeloImportacao` (lib/importacao/modelo.ts) já usa desde a Fase 26. Hoje o modelo de "Importar Clientes Ativos" não sinaliza nenhum campo obrigatório (incluindo CNPJ) — o vocabulário (`SYSTEM_FIELDS_ATIVO`) já marca 9 campos como `required:true`, só o gerador da planilha nunca ganhou o mesmo tratamento visual.

Purpose: sem o asterisco, quem baixa o modelo de ativos não sabe quais colunas são obrigatórias até a validação recusar a linha — a mesma dor que a Fase 26 já resolveu para o modelo de prospecção.
Output: `buildModeloAtivos` gerando cabeçalhos sufixados para os 9 campos obrigatórios; teste automatizado cobrindo o comportamento; nenhuma mudança de comportamento em `mapping.ts` (apenas confirmação de que a normalização já é segura).
</objective>

<execution_context>
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@lib/importacao/modelo.ts
@lib/importacao/modeloAtivo.ts
@lib/importacao/typesAtivo.ts
@lib/importacao/mapping.ts
@tests/importacao/modelo.test.ts
@tests/importacao/ativos-vocabulario.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Sufixar cabeçalhos obrigatórios em buildModeloAtivos</name>
  <files>lib/importacao/modeloAtivo.ts, tests/importacao/ativos-vocabulario.test.ts</files>
  <behavior>
    - `readRows(buildModeloAtivos())[0]` deve ser igual a `SYSTEM_FIELDS_ATIVO.map((f) => f.required ? \`${f.label} *\` : f.label)` — não mais igual a `SYSTEM_FIELDS_ATIVO.map((f) => f.label)` puro (a asserção atual do teste "modelo: buildModeloAtivos gera 16 colunas..." em tests/importacao/ativos-vocabulario.test.ts fica desatualizada e precisa ser corrigida para refletir o novo comportamento correto).
    - O cabeçalho de "CNPJ" (campo `required:true` em SYSTEM_FIELDS_ATIVO) deve sair como "CNPJ *".
    - O cabeçalho de "Nome Fantasia" (campo `required:false`) deve permanecer sem sufixo, "Nome Fantasia".
    - Cada cabeçalho gerado, quando passado por `suggestMapping(header, SYSTEM_FIELDS_ATIVO)`, deve continuar resolvendo para a `key` correta do campo correspondente (round-trip), provando que o asterisco não quebra o auto-mapeamento de um modelo baixado/preenchido/reenviado.
  </behavior>
  <action>
    Em `lib/importacao/modeloAtivo.ts`: declare a mesma constante `const REQUIRED_MARKER = " *"` que existe em `lib/importacao/modelo.ts` (linha 30), com o mesmo comentário de justificativa de segurança citando `suggestMapping`/`normalizeHeader` (copie a explicação de por que o sufixo é seguro — o cabeçalho normalizado descarta espaço e asterisco antes de comparar contra o label). Altere a linha `const headers = SYSTEM_FIELDS_ATIVO.map((field) => field.label)` (linha 42 atual) para o mesmo padrão condicional de `buildModeloImportacao`: `field.required ? \`${field.label}${REQUIRED_MARKER}\` : field.label`. Não altere `EXAMPLE_VALUES`, a ordem dos campos, nem a lógica de geração do workbook (`aoa_to_sheet`/`book_new`/`book_append_sheet`/`XLSX.write`) — a mudança é isolada à linha que constrói `headers`. Atualize o comentário de topo do arquivo (linhas 6-20) para mencionar o novo comportamento de sufixo required, do mesmo jeito que o comentário de `modelo.ts` documenta a Fase 26 — sem repetir literalmente o texto do comentário de `modelo.ts` palavra por palavra, apenas a mesma ideia adaptada a este arquivo.

    Em `tests/importacao/ativos-vocabulario.test.ts`: corrija a asserção `expect(rows[0]).toEqual(SYSTEM_FIELDS_ATIVO.map((f) => f.label))` (linha 104 atual, dentro do teste "modelo: buildModeloAtivos gera 16 colunas...") para `expect(rows[0]).toEqual(SYSTEM_FIELDS_ATIVO.map((f) => f.required ? \`${f.label} *\` : f.label))` — essa asserção hoje passa com o bug (nenhum sufixo) e precisa ser corrigida para validar o comportamento certo, senão o teste existente continuaria "verde" mesmo com o bug presente. Adicione dois novos testes no mesmo `describe("SYSTEM_FIELDS_ATIVO", ...)`: (1) um teste específico que verifica que o cabeçalho de CNPJ sai como `"CNPJ *"` (o caso relatado pelo usuário) buscando o índice de `cnpj` em `SYSTEM_FIELDS_ATIVO` e comparando `rows[0][índice]`; (2) um teste de round-trip que, para cada cabeçalho de `rows[0]`, chama `suggestMapping(header, SYSTEM_FIELDS_ATIVO)` e confere que o resultado bate com a `key` do campo na mesma posição — mesmo padrão do teste "round-trips every generated header back to its SYSTEM_FIELDS key via suggestMapping" em `tests/importacao/modelo.test.ts`.

    Não modifique `lib/importacao/mapping.ts` nem `lib/importacao/typesAtivo.ts` — apenas leia-os para confirmar (via os testes acima) que a normalização de `suggestMapping`/`normalizeHeader` já descarta o sufixo " *" ao comparar contra o label, sem exigir nenhuma mudança nesses dois arquivos.
  </action>
  <verify>
    <automated>npx vitest run tests/importacao/ativos-vocabulario.test.ts tests/importacao/modelo.test.ts tests/importacao/mapping.test.ts</automated>
  </verify>
  <done>
    `buildModeloAtivos()` gera "CNPJ *" e sufixa todos os 9 cabeçalhos required de SYSTEM_FIELDS_ATIVO com " *"; os 7 cabeçalhos opcionais permanecem sem sufixo; todos os testes de tests/importacao/ativos-vocabulario.test.ts, tests/importacao/modelo.test.ts e tests/importacao/mapping.test.ts passam; nenhuma mudança de comportamento em mapping.ts ou typesAtivo.ts.
  </done>
</task>

</tasks>

<verification>
Rodar a suíte completa de importação para garantir que nada mais dependia do formato antigo do cabeçalho de ativos:

```bash
npx vitest run tests/importacao/
```

Confirmar manualmente (opcional, não bloqueante): baixar o modelo de "Importar Clientes Ativos" pela UI (`AtivoImportWizard`) e abrir no Excel/LibreOffice — o cabeçalho de CNPJ, Razão social, CEP, Rua, Número, Cidade, Estado, Contato e Responsável (vendedor) deve mostrar " *" ao final do texto.
</verification>

<success_criteria>
- `buildModeloAtivos` sufixa exatamente os 9 campos `required:true` de `SYSTEM_FIELDS_ATIVO` com " *", nenhum a mais nenhum a menos.
- O teste que antes validava (incorretamente) cabeçalhos sem sufixo foi corrigido para validar o comportamento certo.
- Testes novos cobrem especificamente o caso CNPJ e o round-trip via `suggestMapping`.
- `mapping.ts` e `typesAtivo.ts` permanecem intocados.
</success_criteria>

<output>
Create `.planning/quick/260827-nh4-bug-o-modelo-de-planilha-de-importar-cli/SUMMARY.md` when done
</output>
