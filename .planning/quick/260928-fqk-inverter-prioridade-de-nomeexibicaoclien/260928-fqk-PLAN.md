---
phase: quick-260928-fqk
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260928-fqk]
files_modified:
  - tests/clientes/nome-exibicao.test.ts
  - tests/agenda/sem-dia-fixo.test.tsx
  - lib/clientes/nomeExibicao.ts

must_haves:
  truths:
    - "Um cliente com Nome Fantasia E razão social preenchidos aparece pelo NOME FANTASIA em toda tela que usa nomeExibicaoCliente() — card do funil (ClienteCard), ficha (ClienteDetailSheet: título, diálogo de apagar, diálogo de encerrar), Agenda 'sem dia fixo' (AgendaSemDiaFixo), linhas de Perdidos e de Encerrados — sem nenhuma dessas telas ter sido editada."
    - "Um cliente com Nome Fantasia nulo, indefinido, vazio ou só com espaços aparece pela razão social (quando ela estiver preenchida)."
    - "Um cliente sem nenhum dos dois (nulo/indefinido/só espaços nos dois) continua aparecendo como 'Sem nome' — ROTULO_SEM_NOME não muda de valor nem de nome."
    - "A assinatura da função continua exatamente nomeExibicaoCliente(razaoSocial, nomeFantasia) — mesma ordem de PARÂMETROS; só a ordem de PRIORIDADE (a ordem dos dois if) foi invertida. Nenhum call site, componente, lib de lista, migration ou banco foi tocado."
    - "Os 12 arquivos de teste que dependem do nome exibido (lista na Task 2) passam verdes depois da mudança, incluindo os casos novos que provam a nova prioridade."
  artifacts:
    - lib/clientes/nomeExibicao.ts
    - tests/clientes/nome-exibicao.test.ts
    - tests/agenda/sem-dia-fixo.test.tsx
  key_links:
    - "Todas as 14 chamadas de nomeExibicaoCliente() no código (components/clientes/ClienteCard.tsx x2, components/clientes/KanbanBoard.tsx x3, components/clientes/ClienteDetailSheet.tsx x3, components/agenda/AgendaSemDiaFixo.tsx x2, components/perdidos/PerdidosItemRow.tsx, components/encerrados/EncerradosItemRow.tsx, lib/perdidos/lista.ts, lib/encerrados/lista.ts) passam os argumentos POSICIONALMENTE como (razão social, Nome Fantasia). Por isso a mudança é só a ordem dos dois if no corpo — trocar a ordem dos parâmetros na assinatura desfaria a inversão silenciosamente em todas elas sem nenhum erro de tipo (os dois parâmetros têm o mesmo tipo)."
    - "isAusente() continua sendo a única regra de 'ausente' para OS DOIS campos (nulo, indefinido, string vazia, só espaços) — é o que garante que um Nome Fantasia só com espaços cai para a razão social, em vez de exibir um título em branco."
    - "Busca e ordenação também leem o nome exibido: busca do Kanban (KanbanBoard.tsx ~l.362), ordenação 'A-Z' do Kanban (sortClientes, ~l.106-112), filtrarPerdidosPorNome (lib/perdidos/lista.ts) e filtrarEncerradosPorNome (lib/encerrados/lista.ts). Elas passam a usar Nome Fantasia primeiro automaticamente — efeito colateral esperado, NÃO corrigido nesta task (fora do escopo travado), mas obrigatoriamente registrado no SUMMARY."
---

<objective>
Inverter a ordem de prioridade de `nomeExibicaoCliente()` (lib/clientes/nomeExibicao.ts), a autoridade única do nome exibido de um cliente em qualquer tela.

Hoje: razão social quando preenchida; senão Nome Fantasia; senão "Sem nome".
Depois: **Nome Fantasia quando preenchido; senão razão social quando preenchida; senão "Sem nome"** (`ROTULO_SEM_NOME` continua igual).

Explicando sem jargão: existe um único lugar no sistema que decide "qual nome mostrar" para um cliente. Hoje ele prefere a razão social; depois desta task ele passa a preferir o Nome Fantasia. Como todas as telas (funil, ficha, Agenda, Perdidos, Encerrados) perguntam a esse mesmo lugar, todas mudam juntas sem precisar mexer em nenhuma delas.

Motivo de negócio (vai para o SUMMARY, não vira código): 45 clientes reais em produção têm a razão social começando com um número em formato de documento seguido de um nome de pessoa (padrão típico de razão social de MEI: raiz do CNPJ + nome completo do titular). A política de segurança corporativa (DLP) do computador de um usuário mascara esse padrão e o nome do cliente some da tela dele. Os 45 já têm Nome Fantasia preenchido. O dono do projeto decidiu explicitamente aplicar a troca para TODOS os clientes (não uma correção pontual só para os 45), porque prefere o Nome Fantasia como nome principal de exibição em geral.

Purpose: devolver o nome do cliente à tela do usuário afetado pelo DLP e alinhar a exibição à preferência do dono (Nome Fantasia como nome principal), com a mudança concentrada num único ponto já projetado para isso.

Output:
- Testes atualizados para a nova prioridade (commit de teste, RED).
- `nomeExibicaoCliente()` com os dois `if` na nova ordem + JSDoc atualizado (commit de implementação, GREEN).
- Suíte dependente inteira verde, tsc e eslint limpos.
</objective>

<execution_context>
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@lib/clientes/nomeExibicao.ts
@tests/clientes/nome-exibicao.test.ts
@tests/agenda/sem-dia-fixo.test.tsx

Achados do planejamento (já verificados, não precisa refazer a busca):

- Único teste direto da função: `tests/clientes/nome-exibicao.test.ts` (6 casos). Só o PRIMEIRO caso (linhas 15-19, os dois preenchidos esperando a razão social) contradiz a nova ordem. Os casos de razão social nula/indefinida/só espaços com Nome Fantasia preenchido continuam verdadeiros na ordem nova, mas hoje não existe NENHUM caso cobrindo "Nome Fantasia ausente cai para a razão social" — precisam ser criados.
- Único teste indireto que quebra: `tests/agenda/sem-dia-fixo.test.tsx`, linhas 140-159 ("razão social preenchida: aparece pela razão social, e o title é igual") — fixture com `razaoSocial: "Padaria Central Ltda"` e `nomeFantasia: "Padaria Central"`, esperando o texto e o `title` "Padaria Central Ltda".
- Todos os outros testes que renderizam ou buscam pelo nome exibido usam fixtures com `nomeFantasia: null`, `nomeFantasia: ""` (ausente) ou `razaoSocial: null` — o resultado é idêntico nas duas ordens. Conferidos: tests/funil/perdidos-item-row, encerrados-item-row, perdidos-lista, encerrados-lista, perdidos-list, encerrados-list; tests/clientes/cliente-card-setas-etapa, kanban-card-filtrado, cliente-detail-sheet-encerrar; tests/agenda/agenda-list. Os testes de RPC/query (tests/funil/*-rpc.test.ts, *-query.test.ts, tests/agenda/clientes-sem-dia-fixo-query.test.ts) só verificam colunas cruas vindas do banco, nunca o nome exibido. Nenhum teste Playwright (*.spec.ts) menciona Nome Fantasia. Os testes de tests/importacao/* não importam nomeExibicao.
- Linha de base medida no planejamento (2026-09-28): os 12 arquivos da lista da Task 2 passam todos — 12 arquivos, 144 testes, ~70 s. Qualquer falha depois da mudança fora dos 2 arquivos editados é regressão real, não ruído pré-existente.
- Skill `supabase-conventions` não se aplica: mudança de função TypeScript pura, sem tabela, RLS, RPC nem migration.
- `.planning/RETROSPECTIVE.md` já está modificado no working tree ANTES desta task (não é desta task) — NÃO incluir em nenhum commit; sempre fazer `git add` com os caminhos explícitos dos arquivos da task.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Reescrever os testes para a nova prioridade (RED)</name>
  <files>tests/clientes/nome-exibicao.test.ts, tests/agenda/sem-dia-fixo.test.tsx</files>
  <behavior>
    - nomeExibicaoCliente("Distribuidora ABC", "ABC Alimentos") devolve "ABC Alimentos" (os dois preenchidos: Nome Fantasia vence)
    - nomeExibicaoCliente("Distribuidora ABC", null) devolve "Distribuidora ABC"
    - nomeExibicaoCliente("Distribuidora ABC", undefined) devolve "Distribuidora ABC"
    - nomeExibicaoCliente("Distribuidora ABC", "") devolve "Distribuidora ABC"
    - nomeExibicaoCliente("Distribuidora ABC", "   ") devolve "Distribuidora ABC" (Nome Fantasia só com espaços conta como ausente)
    - nomeExibicaoCliente(null, "ABC Alimentos") e nomeExibicaoCliente("   ", "ABC Alimentos") continuam devolvendo "ABC Alimentos"
    - Caso de regressão do motivo da task, com dado 100% FICTÍCIO: razão social no formato "número de documento + nome de pessoa" (usar exatamente "00.000.000 FULANO DE TAL") com Nome Fantasia "Mercearia Exemplo" devolve "Mercearia Exemplo"
    - Os dois ausentes continuam devolvendo ROTULO_SEM_NOME; nulo/indefinido nos dois continua sem estourar (casos atuais das linhas 35-44 mantidos como estão)
    - AgendaSemDiaFixo com razaoSocial "Padaria Central Ltda" + nomeFantasia "Padaria Central" mostra "Padaria Central" com title "Padaria Central", e o texto "Padaria Central Ltda" NÃO aparece na tela
  </behavior>
  <action>
Esta task só mexe em testes; a função ainda NÃO é alterada (isso é a Task 2). O objetivo é deixar os testes descrevendo a nova regra e provar que eles falham contra o código atual.

1. Em `tests/clientes/nome-exibicao.test.ts`:
   - Substituir o primeiro caso (linhas 15-19, os dois preenchidos esperando "Distribuidora ABC") por um caso com os mesmos argumentos que espera "ABC Alimentos", com nome de teste descrevendo que o Nome Fantasia vence quando os dois estão preenchidos.
   - Adicionar quatro casos novos de queda para a razão social quando o Nome Fantasia está ausente: nulo, indefinido, string vazia e só espaços — todos com razão social "Distribuidora ABC" e esperando "Distribuidora ABC".
   - Manter os três casos atuais de razão social nula/indefinida/só espaços com Nome Fantasia preenchido (linhas 21-33) — continuam válidos. Pode ajustar o texto do `it` para não falar mais em "falls back", já que agora o Nome Fantasia é a primeira escolha e não uma queda (ex.: "shows the Nome Fantasia when razão social is null").
   - Adicionar o caso de regressão do motivo da task com os valores fictícios exatos do `<behavior>` ("00.000.000 FULANO DE TAL" / "Mercearia Exemplo"). LGPD: NUNCA copiar para teste, commit ou SUMMARY qualquer razão social, número de documento ou nome real de cliente de produção — só valores obviamente inventados como estes.
   - Manter intactos os casos de ausência dos dois (ROTULO_SEM_NOME) e de "não estoura" (linhas 35-44).
   - Atualizar o comentário de bloco das linhas 8-12 acrescentando uma frase dizendo que a prioridade foi invertida na quick task 260928-fqk (Nome Fantasia primeiro, depois razão social, depois ROTULO_SEM_NOME).
   - Manter o estilo atual do arquivo: imports de vitest e de "../../lib/clientes/nomeExibicao", `describe("nomeExibicaoCliente", ...)`, nomes de teste em inglês com termos de domínio em português, sem ponto e vírgula.

2. Em `tests/agenda/sem-dia-fixo.test.tsx`, no `describe("AgendaSemDiaFixo — nome exibido (AGD-15)")`:
   - Reescrever SÓ o primeiro caso (linhas 140-159). Mesma fixture (`razaoSocial: "Padaria Central Ltda"`, `nomeFantasia: "Padaria Central"`), nome de teste passa a dizer que com os dois preenchidos a linha aparece pelo Nome Fantasia e o title é igual; `screen.getByText("Padaria Central")` precisa existir e ter atributo `title` "Padaria Central"; acrescentar `expect(screen.queryByText("Padaria Central Ltda")).not.toBeInTheDocument()` — o `getByText` do Testing Library casa texto EXATO por padrão, então "Padaria Central" não casa com "Padaria Central Ltda", e o `queryByText` prova que a razão social não vazou para a tela.
   - Os outros casos do mesmo describe (razão nula, razão só espaços, os dois ausentes, clique pela linha) continuam corretos na ordem nova — não mexer neles.
   - Opcional: acrescentar ao comentário de bloco das linhas 132-138 uma frase citando a quick task 260928-fqk (Nome Fantasia passou a vir primeiro).

3. Rodar os dois arquivos e confirmar o RED: o comando precisa sair com falha, e as ÚNICAS falhas devem ser os casos que dependem da nova ordem com os dois campos preenchidos — o caso "os dois preenchidos" de nome-exibicao, o caso de regressão fictício "00.000.000 FULANO DE TAL", e o primeiro caso do describe AGD-15 de sem-dia-fixo (3 falhas). Os casos novos de "Nome Fantasia ausente cai para a razão social" PASSAM já contra o código atual (na ordem antiga a razão social preenchida já vence) — isso é esperado e correto, eles existem para travar o comportamento depois da inversão. Se falhar qualquer outro caso, parar e investigar antes de seguir.

4. Commit só dos dois arquivos de teste (caminhos explícitos no `git add`), mensagem no formato `test(quick-260928-fqk): testes da nova prioridade do nome exibido (Nome Fantasia primeiro)`, terminando com a linha de atribuição exigida pelo ambiente.
  </action>
  <verify>
    <automated>cd "C:/Users/Cristiano Stephano/workspace/crm-raiar" && npx vitest run tests/clientes/nome-exibicao.test.ts tests/agenda/sem-dia-fixo.test.tsx; test $? -ne 0 && echo "RED OK (esperado falhar: exatamente 3 testes)"</automated>
  </verify>
  <done>
    - Os dois arquivos de teste descrevem a nova regra (Nome Fantasia, depois razão social, depois ROTULO_SEM_NOME).
    - `grep -c "Mercearia Exemplo" tests/clientes/nome-exibicao.test.ts` é pelo menos 1 e `grep -c 'queryByText("Padaria Central Ltda")' tests/agenda/sem-dia-fixo.test.tsx` é 1.
    - Contra o código ainda não alterado, o vitest reporta exatamente 3 testes falhando (os listados no passo 3) e todos os demais passando.
    - Um commit `test(quick-260928-fqk): ...` contendo só esses 2 arquivos; `.planning/RETROSPECTIVE.md` continua fora do commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Inverter a prioridade em nomeExibicaoCliente() e rodar a suíte dependente (GREEN)</name>
  <files>lib/clientes/nomeExibicao.ts</files>
  <behavior>
    - Todos os casos escritos na Task 1 passam
    - Os 12 arquivos de teste dependentes do nome exibido continuam verdes (144 testes na linha de base + os casos novos da Task 1)
  </behavior>
  <action>
1. Em `lib/clientes/nomeExibicao.ts`, dentro de `nomeExibicaoCliente`, trocar APENAS a ordem das duas linhas `if` (hoje linhas 35 e 36): a verificação de `nomeFantasia` passa a vir primeiro (devolvendo `nomeFantasia as string`) e a de `razaoSocial` em segundo (devolvendo `razaoSocial as string`); `return ROTULO_SEM_NOME` continua por último.
   - NÃO mudar a assinatura: os parâmetros continuam na ordem `razaoSocial`, `nomeFantasia`, ambos `string | null | undefined`, retorno `string`. Todas as 14 chamadas no código passam os valores por posição nessa ordem; trocar os parâmetros desfaria a inversão em todas as telas sem nenhum erro de TypeScript.
   - NÃO alterar `isAusente()`, `ROTULO_SEM_NOME` (nome, valor "Sem nome", export) nem o comentário de cabeçalho do arquivo (linhas 1-16, que continua correto: autoridade única, módulo puro, razão social opcional desde a Fase 26).
   - NÃO adicionar trim, normalização ou qualquer tratamento novo no valor devolvido — o valor sai exatamente como entrou, igual a hoje.

2. Reescrever o JSDoc da função (hoje linhas 25-30) para descrever a nova ordem, em português, no mesmo tom do arquivo: devolve o Nome Fantasia quando preenchido; senão a razão social quando preenchida; senão o rótulo único de ausência (`ROTULO_SEM_NOME`); texto só com espaços conta como ausente nos dois campos; tolera nulo/indefinido nos dois argumentos sem estourar. Acrescentar uma frase de histórico: a prioridade foi invertida na quick task 260928-fqk (2026-09-28), por decisão do dono do projeto de usar o Nome Fantasia como nome principal de exibição para todos os clientes — antes, a razão social vinha primeiro. Acrescentar uma frase avisando que a ordem dos parâmetros continua (razão social, Nome Fantasia) de propósito e não deve ser trocada. NÃO colocar no JSDoc o exemplo do padrão de documento, o episódio do DLP nem nenhum dado de cliente — isso fica só no SUMMARY.

3. NÃO editar nenhum outro arquivo de código (escopo travado pelo pedido): nem componentes (ClienteCard, KanbanBoard, ClienteDetailSheet, AgendaSemDiaFixo, PerdidosItemRow, EncerradosItemRow), nem lib/perdidos/lista.ts, lib/encerrados/lista.ts, lib/agenda/itens.ts, lib/supabase/queries/clientes.ts, nem nada em supabase/. Alguns desses arquivos têm comentários que descrevem a ordem antiga — eles NÃO são corrigidos aqui; são listados no SUMMARY como follow-up (ver `<output>`).

4. Rodar os dois arquivos da Task 1 (precisam passar), depois a suíte dependente completa (12 arquivos, ~70 s — usar timeout de pelo menos 5 minutos no comando), depois `npx tsc --noEmit` e `npx eslint` nos 3 arquivos da task. Só commitar com tudo verde.

5. Commit só de `lib/clientes/nomeExibicao.ts` (caminho explícito no `git add`), mensagem no formato `feat(quick-260928-fqk): nome exibido do cliente passa a priorizar o Nome Fantasia`, terminando com a linha de atribuição exigida pelo ambiente. NÃO fazer push para `staging` nem para `master` — só commit local (regra do projeto neste momento; a publicação passa pelo fluxo staging -> preview -> master do CLAUDE.md, fora desta task).
  </action>
  <verify>
    <automated>cd "C:/Users/Cristiano Stephano/workspace/crm-raiar" && node -e "const s=require('fs').readFileSync('lib/clientes/nomeExibicao.ts','utf8');const nf=s.indexOf('if (!isAusente(nomeFantasia))');const rs=s.indexOf('if (!isAusente(razaoSocial))');const pr=s.indexOf('razaoSocial: string | null | undefined');const pn=s.indexOf('nomeFantasia: string | null | undefined');const ok=nf>0&&rs>nf&&pr>0&&pn>pr&&s.includes('export const ROTULO_SEM_NOME = \"Sem nome\"')&&s.includes('return !valor || valor.trim() === \"\"');console.log(ok?'ESTRUTURA OK':'ESTRUTURA FALHOU');process.exit(ok?0:1)" && npx vitest run tests/clientes/nome-exibicao.test.ts tests/agenda/sem-dia-fixo.test.tsx tests/funil/perdidos-item-row.test.tsx tests/funil/encerrados-item-row.test.tsx tests/funil/perdidos-lista.test.ts tests/funil/encerrados-lista.test.ts tests/funil/perdidos-list.test.tsx tests/funil/encerrados-list.test.tsx tests/clientes/cliente-card-setas-etapa.test.tsx tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/cliente-detail-sheet-encerrar.test.tsx tests/agenda/agenda-list.test.tsx && npx tsc --noEmit && npx eslint lib/clientes/nomeExibicao.ts tests/clientes/nome-exibicao.test.ts tests/agenda/sem-dia-fixo.test.tsx</automated>
  </verify>
  <done>
    - O script de estrutura imprime "ESTRUTURA OK": o `if` de nomeFantasia vem antes do de razaoSocial, a ordem dos parâmetros é (razaoSocial, nomeFantasia), `ROTULO_SEM_NOME = "Sem nome"` e o corpo de `isAusente` estão intactos.
    - Os 12 arquivos de teste passam (12 arquivos; 144 testes da linha de base + os novos da Task 1), `tsc --noEmit` sem erro, eslint sem erro nos 3 arquivos.
    - `git diff --name-only HEAD~2 HEAD` lista exatamente os 3 arquivos da task (lib/clientes/nomeExibicao.ts, tests/clientes/nome-exibicao.test.ts, tests/agenda/sem-dia-fixo.test.tsx) e nada em components/, app/, supabase/ ou nos outros arquivos de lib/.
    - Nenhum `git push` foi executado nesta task: os 2 commits (test + feat) existem só no repositório local.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| banco (RLS) -> tela | Os dados do cliente chegam à tela já filtrados pelo RLS; esta task só muda QUAL dos dois campos já recebidos é exibido primeiro. Nenhuma fronteira de autorização nova ou alterada. |
| código/testes/commits -> repositório git | Fixtures, mensagens de commit e SUMMARY ficam versionados e visíveis a quem acessa o repositório. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fqk-01 | Information Disclosure | tests/clientes/nome-exibicao.test.ts, commits, 260928-fqk-SUMMARY.md | medium | mitigate | O caso de regressão usa só valores fictícios ("00.000.000 FULANO DE TAL" / "Mercearia Exemplo"). O SUMMARY cita apenas a quantidade (45 clientes) e o padrão em abstrato — nunca razão social, número de documento ou nome de titular reais de produção (LGPD: razão social de MEI contém o nome completo de uma pessoa física). |
| T-fqk-02 | Information Disclosure | exibição do nome do cliente em todas as telas | low | accept | A mudança REDUZ exposição de dado pessoal na tela: para clientes com Nome Fantasia, a razão social (que em MEI contém nome de pessoa + raiz de documento) deixa de ser o título exibido. Ela continua visível no campo editável da ficha, que é o lugar legítimo de consulta/edição — fora do escopo desta task. |
| T-fqk-03 | Elevation of Privilege | RLS / Server Actions / RPC | low | accept | Nada de RLS, policy, RPC, Server Action ou migration é tocado (gate de escopo na Task 2). A função é de apresentação pura, sem papel em autorização. |
| T-fqk-04 | Tampering | lib/clientes/nomeExibicao.ts (ordem dos parâmetros) | medium | mitigate | Trocar a ordem dos parâmetros em vez da ordem dos `if` desfaria a mudança em todas as 14 chamadas sem erro de tipo. O script de estrutura da Task 2 falha se a ordem dos parâmetros mudar ou se a ordem dos `if` não estiver invertida. |
</threat_model>

<verification>
- `npx vitest run` nos 12 arquivos dependentes: tudo verde (linha de base 144 testes + os novos da Task 1).
- Script de estrutura da Task 2: "ESTRUTURA OK".
- `npx tsc --noEmit` e `npx eslint` nos 3 arquivos: limpos.
- `git diff --name-only HEAD~2 HEAD`: exatamente os 3 arquivos da task; nenhuma migration, nenhum componente, nenhum outro arquivo de lib/.
- 2 commits locais (test + feat), sem push; `.planning/RETROSPECTIVE.md` fora dos dois commits.
</verification>

<success_criteria>
- Cliente com os dois nomes preenchidos aparece pelo Nome Fantasia; sem Nome Fantasia, pela razão social; sem nenhum, "Sem nome" — provado por teste unitário direto e pelo teste de tela da Agenda.
- Nenhuma tela, lib de lista, migration ou banco alterado; a mudança chega às telas só por serem consumidoras da autoridade única.
- Suíte dependente verde; commits pequenos (um por task); nada publicado em staging/master.
</success_criteria>

<output>
Criar `.planning/quick/260928-fqk-inverter-prioridade-de-nomeexibicaoclien/260928-fqk-SUMMARY.md` ao terminar. Além do formato padrão, o SUMMARY DEVE conter, em linguagem simples para o dono do projeto:

1. **Motivo de negócio:** 45 clientes reais com razão social começando por um número em formato de documento seguido de nome de pessoa, mascarada pelo DLP corporativo no computador de um usuário (nome sumindo da tela); todos os 45 já têm Nome Fantasia; decisão explícita do dono de aplicar a troca para TODOS os clientes por preferir o Nome Fantasia como nome principal. Citar só a quantidade e o padrão em abstrato — nenhum valor real (LGPD).
2. **Observação sobre a origem dos 45 (para o dono avaliar, sem ação nesta task):** o formato "XX.XXX.XXX NOME COMPLETO" é o padrão oficial de razão social de MEI (raiz do CNPJ + nome do titular), então provavelmente NÃO é defeito de importação e esses registros não devem ser "limpos" no banco sem confirmar antes. Como contém nome completo de pessoa física, é dado pessoal sob a LGPD — a troca para Nome Fantasia reduz a exposição desse dado na tela.
3. **Efeito colateral esperado (não corrigido, fora do escopo):** a busca e a ordenação "A-Z" do Kanban e a busca das telas de Perdidos e Encerrados seguem o nome exibido. Para um cliente com os dois nomes preenchidos, digitar a razão social na busca deixa de encontrá-lo (é preciso digitar o Nome Fantasia), e a ordem alfabética do Kanban muda. Sugerir follow-up opcional: busca que case por qualquer um dos dois nomes.
4. **Comentários desatualizados deixados de propósito (escopo travado), para um follow-up de documentação:** components/clientes/KanbanBoard.tsx (~l.94 e ~l.358, "razão social, com queda para Nome Fantasia"), lib/perdidos/lista.ts (~l.152), lib/encerrados/lista.ts (~l.158); e, de forma mais branda ("quando razão social vier nula"), components/clientes/ClienteCard.tsx (~l.33-35), lib/supabase/queries/clientes.ts (~l.27-28), lib/agenda/itens.ts (~l.514).
5. **Publicação:** só commits locais; a ida para `staging` -> link de teste -> `master` fica para o fluxo de deploy do CLAUDE.md, quando o dono pedir.
</output>
