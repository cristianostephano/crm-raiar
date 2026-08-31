---
phase: quick-260831-mod
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-260831-mod]
files_modified:
  - lib/importacao/typesAtivo.ts
  - supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql
  - tests/importacao/ativos-vocabulario.test.ts
  - tests/importacao/annotarLinhaAtivo.test.ts
  - tests/importacao/importar-ativos-lote.test.ts
  - lib/importacao/annotarLinhaAtivo.ts

user_setup:
  - service: supabase
    why: "Aplicar a migration 0029 no projeto hospedado — o executor não roda `supabase db push` sozinho (precedente das Fases 18/19/23: o classificador de modo automático do ambiente bloqueia a tentativa)"
    dashboard_config:
      - task: "Rodar `npx supabase@2.111.0 db push` (CLI pinada em 2.111.0 — 2.112.0+ tem bug conhecido de validação de schema)"
        location: "Terminal local, com o projeto já linkado"

must_haves:
  truths:
    - "Uma linha da planilha 'Importar clientes ativos' sem o campo Contato preenchido não é mais recusada — nem na revisão da tela (annotarLinhaAtivo), nem na gravação em massa (RPC cliente_ativo_pronto_para_ganho, migration 0029). Contato passa a ser opcional, revertendo a decisão original da Fase 25 (ATIVO-01)."
    - "O modelo de planilha baixável ('Baixar modelo') deixa de sufixar o cabeçalho 'Contato' com ' *' — consequência automática de SYSTEM_FIELDS_ATIVO, sem precisar editar buildModeloAtivos."
    - "Um valor de Responsável na planilha contendo só o primeiro nome de um vendedor (ex: 'Leonardo') casa corretamente quando exatamente um vendedor da lista de lookups tem esse primeiro nome, comparado de forma case/acento-insensitive."
    - "Um primeiro nome compartilhado por 2+ vendedores (ex: 'Diego') continua produzindo o erro existente 'não foi encontrado' — nunca escolhe um vendedor por acaso."
    - "Casamento por email exato e por 'nome sobrenome' completo continuam funcionando exatamente como antes (zero regressão)."
    - "A trava geral de 'ganho' via mover_card_funil (fluxo normal do kanban, migrations 0018/0025) não muda em nada — contato nunca fez parte daquele guard, só desta RPC específica de importação em massa."
    - "A importação de Clientes em Prospecção (lib/importacao/annotarLinha.ts) não é tocada por nenhuma das duas mudanças — vocabulário e matching de responsável continuam isolados por decisão da Fase 26."
  artifacts:
    - lib/importacao/typesAtivo.ts
    - supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql
    - lib/importacao/annotarLinhaAtivo.ts
    - tests/importacao/ativos-vocabulario.test.ts
    - tests/importacao/annotarLinhaAtivo.test.ts
    - tests/importacao/importar-ativos-lote.test.ts
  key_links:
    - "SYSTEM_FIELDS_ATIVO (typesAtivo.ts) <-> cliente_ativo_pronto_para_ganho (migration 0029): as duas fontes de obrigatoriedade (tela + banco) precisam concordar exatamente — 8 campos, mesma cardinalidade, nunca subconjunto nem superconjunto (mesma disciplina documentada desde a Fase 25)."
    - "findVendedor (annotarLinhaAtivo.ts) -> normalizeRazaoSocial (dedupe.ts): o casamento novo por primeiro nome reusa a MESMA função de normalização já usada para email/nome completo — nenhuma lógica de comparação paralela nova."
    - "importar_clientes_ativos_lote (migration 0027, já aplicada em produção) -> cliente_ativo_pronto_para_ganho (migration 0029): a RPC de lote continua chamando a função de completude com nove argumentos posicionais nos dois pontos de chamada (filtro da criação e classificação do retorno); a migration 0029 preserva a aridade exatamente para não quebrar essas duas chamadas já gravadas em produção."
---

<objective>
Ajustar a importação de "Clientes Ativos" com base no teste ao vivo real do dono do projeto (1909 linhas reais falharam ao importar): (1) tornar o campo Contato opcional (reversão de decisão travada na Fase 25/ATIVO-01), e (2) aceitar casamento de Responsável por primeiro nome único na planilha de Clientes Ativos.

Purpose: a planilha real da equipe não tem contato/telefone coletado ainda ("os vendedores vão ter que incluir depois"), e só tem o primeiro nome do vendedor na coluna Responsável (ex: "Leonardo", "Edson", "Diego") — as duas travas atuais rejeitavam praticamente toda linha real.

Output:
- `lib/importacao/typesAtivo.ts`: Contato vira `required: false`, comentário de justificativa atualizado documentando a reversão (sem apagar o histórico da decisão original).
- `supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql`: `cliente_ativo_pronto_para_ganho` para de exigir contato na checagem de completude, aridade preservada.
- `lib/importacao/annotarLinhaAtivo.ts`: `findVendedor` ganha um terceiro critério de casamento — primeiro nome único — só para a importação de Ativos.
- Testes atualizados/novos provando os dois comportamentos e a ausência de regressão.
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
@lib/importacao/typesAtivo.ts
@lib/importacao/annotarLinhaAtivo.ts
@lib/importacao/dedupe.ts
@supabase/migrations/0027_importar_clientes_ativos_lote.sql
@supabase/migrations/0025_ganho_exige_razao_social_e_endereco.sql
@tests/importacao/ativos-vocabulario.test.ts
@tests/importacao/annotarLinhaAtivo.test.ts
@tests/importacao/importar-ativos-lote.test.ts

Só para referência de ISOLAMENTO (NÃO editar):
@lib/importacao/annotarLinha.ts
</context>

<decisoes_travadas>
Estas decisões vêm do dono do projeto e **não devem ser reabertas** durante a execução:

- **D-01 — Contato deixa de ser obrigatório na importação de Clientes Ativos.** Reversão explícita da decisão original da Fase 25 (ATIVO-01, confirmada no checkpoint humano do plano 25-03). Motivo: a planilha real ainda não tem esse dado coletado; os vendedores vão preencher depois, individualmente, na ficha do cliente. O campo `contato` continua existindo no vocabulário e continua sendo GRAVADO quando a planilha traz um valor — só deixa de BLOQUEAR a linha quando vem em branco. `telefone` já era opcional e não muda.
- **D-02 — Escopo do casamento por primeiro nome é SOMENTE `lib/importacao/annotarLinhaAtivo.ts` (Clientes Ativos).** `lib/importacao/annotarLinha.ts` (Prospecção) **não muda** nesta task — vocabulários e fluxos deliberadamente separados desde a Fase 26. Qualquer mudança lá fica para uma tarefa futura caso o dono peça.
- **D-03 — Ambiguidade de primeiro nome permanece erro.** Quando 2+ vendedores da lista de lookups têm o mesmo primeiro nome, a linha continua com o erro atual pedindo nome completo ou email — nunca resolve por acaso escolhendo um dos dois.
</decisoes_travadas>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Contato vira opcional — vocabulário (typesAtivo.ts) + migration 0029 + testes</name>
  <files>lib/importacao/typesAtivo.ts, supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql, tests/importacao/ativos-vocabulario.test.ts, tests/importacao/annotarLinhaAtivo.test.ts, tests/importacao/importar-ativos-lote.test.ts</files>
  <behavior>
    - `SYSTEM_FIELDS_ATIVO` tem exatamente 8 definições `required: true` (era 9); a entrada `contato` não tem mais `campoFaltandoReason`.
    - Uma linha de `annotarLinhaAtivo` com todos os campos obrigatórios preenchidos MENOS contato resulta em `status: "ok"`, `reasons: []`, e `resolved.contato` nulo.
    - Uma linha com três obrigatórios em branco (cnpj, numero, cidade — não mais contato) continua acumulando os três motivos correspondentes, sem repetição.
    - Na RPC `cliente_ativo_pronto_para_ganho` (migration 0029): uma linha com contato nulo passa na condição de completude e é gravada (`status: "inserido"`), com a coluna `contato` do cliente criado vindo nula.
    - A aridade da função `cliente_ativo_pronto_para_ganho` continua em nove parâmetros — `importar_clientes_ativos_lote` (migration 0027, já aplicada) não precisa de nenhuma mudança.
  </behavior>
  <action>
Escrever/ajustar os testes ANTES da implementação (RED), rodar, ver falhar nos pontos aplicáveis (o teste de integração da RPC fica vermelho até a Task 3 aplicar a migration — isso é esperado, não é falha desta task), depois implementar (GREEN).

**`lib/importacao/typesAtivo.ts`:**
<!-- planner-discipline-allow: campoFaltandoReason -->
- Na entrada `{ key: "contato", label: "Contato", required: true, campoFaltandoReason: "Contato não informado" }` (dentro do array `SYSTEM_FIELDS_ATIVO`), trocar `required: true` por `required: false` e remover a linha `campoFaltandoReason` inteira — fica igual ao formato de `nomeFantasia`/`telefone` (`{ key: "contato", label: "Contato", required: false }`). Não mudar a posição do campo no array (a ordem determina a ordem das colunas do modelo e é coberta por teste).
- Reescrever o bloco de comentário "JUSTIFICATIVA DE CADA FRONTEIRA DE OBRIGATORIEDADE" (linhas ~22-61): trocar "Os 9 obrigatórios desta lista (razaoSocial, cnpj, cep, rua, numero, cidade, estado, responsavel, contato)" por "Os 8 obrigatórios desta lista (razaoSocial, cnpj, cep, rua, numero, cidade, estado, responsavel)", e referenciar que a condição de completude do banco (agora na migration 0029) foi ajustada junto. Substituir o bullet que hoje começa com "Contato: nomeado literalmente no requisito ATIVO-01..." por um bullet que preserva a citação ao requisito ATIVO-01 e ao checkpoint do plano 25-03 (não apagar o histórico), e documenta explicitamente que essa exigência foi REVERTIDA na quick task 260831-mod (2026-08-31), por decisão do dono depois do teste ao vivo com a planilha real da equipe (1909 linhas): a base ainda não tem contato/telefone coletado, os vendedores preenchem depois na ficha do cliente. Deixar claro que o campo continua existindo e sendo gravado quando vier preenchido — só deixou de bloquear a linha vazia. Não usar as strings literais `required: true` ou `required: false` dentro do comentário (descreva em prosa: "obrigatório"/"opcional") para não confundir a checagem automática de contagem que roda sobre o código, não sobre o comentário.

**`supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql`** (arquivo NOVO — nunca editar 0001-0028, já aplicadas):
- Cabeçalho em comentário explicando: (a) o motivo da reversão (mesmo texto de contexto do item anterior); (b) que o ESCOPO é estrito ao CORPO de `cliente_ativo_pronto_para_ganho` — a assinatura continua com os MESMOS nove parâmetros (`p_razao_social text, p_cnpj text, p_cep text, p_rua text, p_numero text, p_cidade text, p_estado text, p_responsavel uuid, p_contato text`), mesmo `returns boolean`, porque `importar_clientes_ativos_lote` (migration 0027, já aplicada em produção) chama esta função com nove argumentos posicionais em DOIS pontos (filtro da criação e classificação do retorno) e não pode ser tocada; (c) que por isso um `create or replace function` com a mesma assinatura basta, sem o ritual de `drop function if exists`; (d) que foi confirmado por grep que `cliente_ativo_pronto_para_ganho` só é chamada dentro de `importar_clientes_ativos_lote` (mesmo arquivo 0027, dois pontos), nenhum outro caminho depende desta condição; (e) que isso NÃO afeta `mover_card_funil` (migrations 0018/0025, caminho normal do kanban) — aquela função nunca checou contato, os guards de lá são CNPJ, frequência de visita e razão social/endereço; esta checagem sempre viveu só nesta RPC de importação em massa.
- `create or replace function cliente_ativo_pronto_para_ganho(...)` com a mesma assinatura de nove parâmetros da migration 0027, `language sql immutable`, corpo idêntico ao da 0027 EXCETO que a condição `and nullif(btrim(p_contato), '') is not null` é removida do final do `select` (a condição termina em `and p_responsavel is not null`). Adicionar um comentário no lugar onde a condição de contato existia, explicando que o parâmetro de contato continua sendo recebido (aridade preservada) mas não participa mais da checagem — evitar escrever o nome do parâmetro em qualquer comentário do arquivo (refira-se a ele em prosa como "o parâmetro de contato" ou "o nono argumento"), porque o gate de verificação abaixo conta ocorrências exatas do nome do parâmetro fora de comentário.

**`tests/importacao/ativos-vocabulario.test.ts`:**
- Em `REQUIRED_KEYS`, remover a entrada `"contato"` (sobram 8 chaves).
- No teste `"obrigatorios: exatamente 9 definicoes sao required..."`, trocar a descrição para citar 8 (e mencionar que contato foi revertido nesta quick task) e trocar `expect(required).toHaveLength(9)` por `toHaveLength(8)`.
- No teste `"obrigatoriosfaltando: ... devolve as 9; ... devolve vazio"`, trocar o texto da descrição para "as 8" (o corpo do teste já lê de `REQUIRED_KEYS`, não precisa mudar lógica).
- Não mexer nos testes de `modelo` (já são parametrizados sobre `SYSTEM_FIELDS_ATIVO`, se ajustam sozinhos).

**`tests/importacao/annotarLinhaAtivo.test.ts`** (só a parte de contato nesta task — a parte de `findVendedor`/primeiro nome é a Task 2):
- No teste `"multiplosmotivos"`, trocar `delete rest.contato` por `delete rest.cidade`, e trocar `fieldReason("contato")` por `fieldReason("cidade")` no array esperado (mantém 3 motivos, sem repetição).
- Adicionar um teste novo logo depois, provando o comportamento revertido: uma linha com `baseRow()` menos `contato` (via `delete`) produz `status: "ok"`, `reasons: []`, e `result.resolved.contato` estritamente nulo. Nomear o teste citando "revertido, quick task 260831-mod" para rastreabilidade.
- Não mexer no teste `"sanitizacao"` (usa contato preenchido com valor malicioso; continua válido independente de obrigatoriedade).

**`tests/importacao/importar-ativos-lote.test.ts`:**
- Substituir o teste `"semcontato: linha com contato em branco (só espaços) é devolvida como incompleto e não é gravada"` por um teste novo provando o comportamento OPOSTO: uma linha completa (via `linhaCompleta`) com override `{ contato: null }` é aceita — `data![0].status` é `"inserido"`, `data![0].id` truthy (empurrar para `createdClienteIds`), e a leitura de volta via `lerClientePorRazaoSocial` mostra `contato` nulo. Atualizar o comentário que precede o teste antigo (hoje explica por que a cobertura de contato vazio existia) para explicar a reversão: contato é anulável na tabela e AGORA é aceito de propósito nesta RPC — a cobertura prova que uma linha com contato ausente não é mais barrada. Nomear o teste algo como `"contatoopcional (revertido, quick task 260831-mod): linha com contato nulo é aceita e gravada normalmente"`.
- Não mexer em nenhum outro teste do arquivo (lotecompleto, semfrequencia, loteMisto, retornoclassificado, somenteespacos, semresponsavel, duplicado, produtos, naosupervisor) — todos usam `linhaCompleta` com contato preenchido por padrão e continuam válidos sem alteração.
  </action>
  <verify>
    <automated>npx vitest run tests/importacao/ativos-vocabulario.test.ts tests/importacao/annotarLinhaAtivo.test.ts</automated>
    <automated>grep -vE '^\s*(\*|/)' lib/importacao/typesAtivo.ts | grep -c 'required: true'</automated>
    <expected>8</expected>
    <automated>grep -A2 'key: "contato"' lib/importacao/typesAtivo.ts | grep -c 'campoFaltandoReason'</automated>
    <expected>0</expected>
    <automated>test -f supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql &amp;&amp; echo OK</automated>
    <automated>grep -vE '^\s*--' supabase/migrations/0029_contato_opcional_na_importacao_de_ativos.sql | grep -c 'contato'</automated>
    <expected>1</expected>
    <automated>npx tsc --noEmit</automated>
    <note>`npx vitest run tests/importacao/importar-ativos-lote.test.ts` fica VERMELHO nesta task (a função ainda não existe com o corpo novo no banco hospedado) — vira verde só depois da Task 3. Não tratar como falha aqui.</note>
  </verify>
  <done>SYSTEM_FIELDS_ATIVO tem 8 obrigatórios (contato fora), o comentário de justificativa documenta a reversão sem apagar o histórico original, a migration 0029 existe alterando só o corpo de cliente_ativo_pronto_para_ganho (aridade intacta — exatamente 1 ocorrência de "contato" fora de comentário no arquivo, correspondendo ao parâmetro), e os testes puros (vocabulário + annotarLinhaAtivo) provam o novo comportamento sem regressão nos demais casos.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Casamento de Responsável por primeiro nome único (annotarLinhaAtivo.ts)</name>
  <files>lib/importacao/annotarLinhaAtivo.ts, tests/importacao/annotarLinhaAtivo.test.ts</files>
  <behavior>
    - `findVendedor` (dentro de `annotarLinhaAtivo.ts`) casa por email exato (já existe), depois por "nome sobrenome" exato (já existe), e AGORA, como terceiro critério, por primeiro nome (campo `nome` do lookup) normalizado via `normalizeRazaoSocial` — só quando exatamente 1 vendedor da lista tiver aquele primeiro nome.
    - Um valor de responsável igual ao primeiro nome de exatamente 1 vendedor (ex: "Leonardo") resolve para o `id` daquele vendedor, inclusive com variação de maiúsculas/minúsculas (ex: "leonardo").
    - Um valor de responsável igual ao primeiro nome de 2+ vendedores (ex: "Diego", compartilhado por dois vendedores fabricados no teste) NÃO resolve nenhum dos dois — produz o mesmo motivo de erro `Responsável "Diego" não foi encontrado` já existente, com `resolved.responsavelId` nulo.
    - Casamento por "nome sobrenome" completo exato (ex: "Bruno Lima") continua funcionando sem depender do novo critério.
    - `lib/importacao/annotarLinha.ts` (Prospecção) permanece byte-a-byte intocado (D-02).
  </behavior>
  <action>
Escrever/ajustar os testes ANTES da implementação (RED), rodar, ver falhar, depois implementar (GREEN).

**`tests/importacao/annotarLinhaAtivo.test.ts`:**
- Estender o array `lookups.vendedores` (top-level, fora dos blocos `it`) com três entradas novas, preservando as duas existentes (`vendedor-1`/Ana Souza, `vendedor-2`/Bruno Lima):
  - `{ id: "vendedor-3", nome: "Leonardo", sobrenome: "Martins", email: "leonardo@raiar.local" }`
  - `{ id: "vendedor-4", nome: "Diego", sobrenome: "Fernandes", email: "diego.fernandes@raiar.local" }`
  - `{ id: "vendedor-5", nome: "Diego", sobrenome: "Ramos", email: "diego.ramos@raiar.local" }`
- Adicionar três testes novos no describe `"annotarLinhaAtivo"`, depois dos testes da Task 1:
  1. `"primeironomeunico"`: chamar `annotarLinhaAtivo` com `{ ...baseRow(), responsavel: "Leonardo" }` e esperar `status: "ok"` e `resolved.responsavelId === "vendedor-3"`; repetir com `responsavel: "leonardo"` (minúsculo) esperando o mesmo resultado — prova a insensibilidade a maiúsculas/minúsculas herdada de `normalizeRazaoSocial`.
  2. `"primeironomeambiguo"`: chamar com `{ ...baseRow(), responsavel: "Diego" }` e esperar `status: "erro"`, `reasons` igual a `['Responsável "Diego" não foi encontrado']`, `resolved.responsavelId` nulo — prova que ambiguidade nunca resolve por acaso (D-03).
  3. `"responsavelnomecompleto"` (regressão): chamar com `{ ...baseRow(), responsavel: "Bruno Lima" }` e esperar `status: "ok"` e `resolved.responsavelId === "vendedor-2"` — prova que o casamento por nome completo exato não foi quebrado pela adição do critério novo.

**`lib/importacao/annotarLinhaAtivo.ts`:**
- Em `findVendedor` (função interna do arquivo, não confundir com a homônima de `annotarLinha.ts`), depois do `return vendedores.find(...)` que casa por "nome sobrenome" (retornando se achar), adicionar o critério novo: normalizar o `valor` recebido com `normalizeRazaoSocial` uma vez, filtrar `vendedores` onde `normalizeRazaoSocial(v.nome)` seja igual a esse valor normalizado, e retornar o único resultado SE E SOMENTE SE o filtro tiver exatamente 1 elemento — caso contrário (0 ou 2+) devolver `undefined`, deixando o chamador (`annotarLinhaAtivo`, mais abaixo no arquivo) produzir o motivo `RESPONSAVEL_NAO_ENCONTRADO_REASON` como já faz hoje.
- Adicionar um comentário curto acima da função (ou no novo trecho) documentando: (a) a decisão D-02 — este critério existe SOMENTE aqui, `lib/importacao/annotarLinha.ts` (Prospecção) não ganha o mesmo tratamento nesta task; (b) a decisão D-03 — ambiguidade (2+ vendedores com o mesmo primeiro nome) nunca resolve sozinha, é erro por design, não um bug a corrigir depois.
- Não tocar em nenhuma outra função do arquivo (`findByNome`, `sanitizeRow`, `splitProdutos`, `annotarLinhaAtivo`, `annotarLoteAtivos`) além do necessário para este critério novo dentro de `findVendedor`.
- **Não editar `lib/importacao/annotarLinha.ts` sob nenhuma circunstância nesta task** — é o arquivo irmão da importação de Prospecção, fora de escopo por D-02.
  </action>
  <verify>
    <automated>npx vitest run tests/importacao/annotarLinhaAtivo.test.ts</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>npx eslint lib/importacao/annotarLinhaAtivo.ts</automated>
    <automated>git diff --stat -- lib/importacao/annotarLinha.ts</automated>
    <expected>(saída vazia — nenhuma linha alterada)</expected>
  </verify>
  <done>findVendedor em annotarLinhaAtivo.ts casa por primeiro nome único como terceiro critério, depois de email e nome completo; ambiguidade de primeiro nome continua produzindo o erro de não encontrado; os três testes novos e todos os testes pré-existentes do arquivo passam; lib/importacao/annotarLinha.ts permanece sem nenhuma linha alterada.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: Checkpoint — dono do projeto aplica a migration 0029 no banco hospedado</name>
  <action>Pausar a execução e pedir ao dono do projeto que aplique a migration 0029 com o CLI do Supabase pinado em 2.111.0. O executor NÃO deve tentar rodar o comando de push sozinho — nas Fases 18/19/23 a tentativa foi bloqueada pelo classificador de modo automático do ambiente. Depois do sinal de retomada, rodar a suíte de integração afetada e tratar qualquer divergência conforme a seção de verificação geral do plano.</action>
  <what-built>Migration `0029_contato_opcional_na_importacao_de_ativos.sql` escrita e commitada (altera só o corpo de `cliente_ativo_pronto_para_ganho`, aridade preservada), e `tests/importacao/importar-ativos-lote.test.ts` já atualizado com o caso `contatoopcional` provando o comportamento novo. O teste está VERMELHO de propósito: o corpo novo da função ainda não existe no banco hospedado.</what-built>
  <how-to-verify>
1. Confirme que o Supabase CLI está pinado em `2.111.0` (versões 2.112.0+ têm um problema conhecido de validação de esquema que já derrubou pushes deste projeto antes).
2. No terminal, na raiz do projeto, rode: `npx supabase@2.111.0 db push`
3. Confira na saída que apenas `0029_contato_opcional_na_importacao_de_ativos.sql` foi aplicada (as 28 anteriores já estão no banco).
4. Se o push falhar, cole a mensagem de erro aqui — não tente contornar aplicando SQL pelo painel do Supabase, porque a migration versionada deixaria de refletir o banco.
5. Depois do push, rode `npx vitest run tests/importacao/importar-ativos-lote.test.ts` — esperado: todos os casos passando, incluindo o novo `contatoopcional`.

Por que você e não o assistente: nas Fases 18, 19 e 23 a tentativa do assistente de rodar este comando foi bloqueada pelo classificador de modo automático do ambiente. O padrão do projeto passou a ser você rodar o push.
  </how-to-verify>
  <resume-signal>Digite "aplicada" (com o resultado do teste) quando o push terminar sem erro, ou cole a mensagem de erro.</resume-signal>
  <verify>
    <automated>npx vitest run tests/importacao/importar-ativos-lote.test.ts</automated>
  </verify>
  <done>A migration 0029 aparece como aplicada na saída do push, e todos os casos de tests/importacao/importar-ativos-lote.test.ts passam, incluindo o novo caso contatoopcional.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| planilha do Supervisor → `annotarLinhaAtivo` → `importar_clientes_ativos_lote` | conteúdo de célula não confiável atravessa aqui; já saneado por `sanitizeCell`, e a RPC é guardada por `is_supervisor()` (guard intocado nesta task) |
| `cliente_ativo_pronto_para_ganho` (função pura, sem elevação de privilégio) | condição de completude que decide o que entra direto como "ganho" — fronteira de integridade de dado, não de autorização |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-MOD-01 | Tampering | `cliente_ativo_pronto_para_ganho` (migration 0029) | medium | mitigate | Afrouxar a condição de completude (remover a checagem de contato) reduz uma garantia de integridade de dado no banco. Mitigado preservando a aridade da função (nenhuma mudança de assinatura, nenhuma superfície nova) e mantendo as outras 8 checagens intactas; a mudança espelha exatamente a reversão em `SYSTEM_FIELDS_ATIVO`, então tela e banco continuam concordando (nenhuma divergência nova entre os dois pontos de obrigatoriedade) |
| T-MOD-02 | Tampering | `findVendedor` (annotarLinhaAtivo.ts) | low | accept | Casamento por primeiro nome amplia a superfície de correspondência, mas só resolve quando exatamente 1 vendedor casa (D-03) — ambiguidade nunca resolve por acaso, preservando a garantia de que o cliente nunca é atribuído ao vendedor errado por engano |
| T-MOD-03 | Elevation of Privilege | `importar_clientes_ativos_lote` (guard `is_supervisor`) | low | accept | Nenhuma mudança nesta trava nesta task; a RPC continua exigindo Supervisor, a migration 0029 não toca nesse guard |
| T-MOD-SC | Tampering | instalações npm/pip/cargo | low | accept | Esta task não instala nenhum pacote novo. Se o executor concluir que algum pacote é necessário, deve PARAR e reportar — instalação exige checkpoint humano bloqueante de legitimidade |
</threat_model>

<verification>
Depois das 3 tasks:

1. `npx vitest run tests/importacao/ativos-vocabulario.test.ts tests/importacao/annotarLinhaAtivo.test.ts tests/importacao/importar-ativos-lote.test.ts` — VERDE, todos os casos.
2. `npx vitest run tests/clientes/ganho-ficha-completa.test.ts` — VERDE (prova que os guards de "ganho" da Fase 23 no caminho normal do kanban continuam intactos, sem relação com a mudança de contato).
3. `npx vitest run tests/importacao/rls-importar-lote.test.ts` — VERDE (prova que a RPC irmã `importar_clientes_lote`, usada pela importação antiga/prospecção, continua intacta).
4. `npx tsc --noEmit` e `npx eslint` limpos.
5. `git diff --stat -- lib/importacao/annotarLinha.ts` sem saída (D-02: Prospecção intocada).

Se algum teste divergir do esperado, corrigir a IMPLEMENTAÇÃO quando a divergência for de comportamento exigido pelas decisões travadas (D-01/D-02/D-03), e o TESTE quando for detalhe de forma não exigido. Nunca afrouxar um caso de teste que prova recusa de linha ambígua de responsável, nem reintroduzir a obrigatoriedade de contato.
</verification>

<success_criteria>
- [ ] `SYSTEM_FIELDS_ATIVO` tem exatamente 8 campos obrigatórios (contato fora); comentário de justificativa documenta a reversão sem apagar o histórico da decisão original da Fase 25
- [ ] `cliente_ativo_pronto_para_ganho` (migration 0029, aplicada no banco hospedado) não exige mais contato na condição de completude; aridade de 9 parâmetros preservada, `importar_clientes_ativos_lote` (0027) intocada
- [ ] Uma linha sem contato é aceita na revisão da tela (`status: "ok"`) e gravada na RPC (`status: "inserido"`, coluna contato nula)
- [ ] `findVendedor` em `annotarLinhaAtivo.ts` casa por primeiro nome único quando exatamente 1 vendedor da lista tem esse primeiro nome
- [ ] Primeiro nome ambíguo (2+ vendedores) continua produzindo o erro "não foi encontrado", nunca resolve por acaso
- [ ] Casamento por email exato e por nome completo exato continuam funcionando sem regressão
- [ ] `lib/importacao/annotarLinha.ts` (Prospecção) permanece byte-a-byte intocado
- [ ] `npx tsc --noEmit` e `npx eslint` limpos
</success_criteria>

<output>
Ao terminar, criar `.planning/quick/260831-mod-ajustar-a-importacao-de-clientes-ativos-/260831-mod-SUMMARY.md` registrando:
- a reversão de D-01 (ATIVO-01) e o motivo real que a motivou (planilha real sem contato/telefone coletado, 1909 linhas testadas ao vivo);
- que a migration 0029 alterou só o CORPO de `cliente_ativo_pronto_para_ganho`, preservando a assinatura de 9 parâmetros para não quebrar as chamadas já gravadas em `importar_clientes_ativos_lote` (migration 0027, aplicada);
- o novo critério de `findVendedor` (primeiro nome único) e a decisão D-03 de nunca resolver ambiguidade por acaso;
- a confirmação explícita de que `lib/importacao/annotarLinha.ts` (Prospecção) não foi tocado (D-02);
- o resultado do checkpoint de push da migration 0029 (Task 3).
</output>
