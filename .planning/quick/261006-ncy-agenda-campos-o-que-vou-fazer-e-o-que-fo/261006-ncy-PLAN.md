---
phase: quick-261006-ncy
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-261006-ncy]
files_modified:
  - supabase/migrations/0051_agenda2_observacoes.sql
  - supabase/rollbacks/0051_volta_agenda2_observacoes.sql
  - tests/agenda2/migracao-agenda2-observacoes.test.ts
  - tests/agenda2/migracao-agenda2.test.ts
  - tests/agenda2/rls-agenda2.test.ts
  - tests/agenda2/rls-agenda2-observacoes.test.ts
  - lib/agenda2/itens.ts
  - lib/validations/agenda2.ts
  - lib/supabase/queries/agenda2.ts
  - app/actions/agenda2.ts
  - tests/agenda2/validacao-agenda2.test.ts
  - tests/agenda2/limites-sincronizados.test.ts
  - tests/agenda2/agenda2-query.test.ts
  - tests/agenda2/agenda2-periodo-query.test.ts
  - tests/agenda2/agenda2-actions.test.ts
  - tests/agenda2/itens.test.ts
  - tests/agenda2/agenda2-apagar-dialog.test.tsx
  - tests/agenda2/agenda2-calendario-dia.test.tsx
  - tests/agenda2/agenda2-calendario-mes.test.tsx
  - tests/agenda2/agenda2-calendario-semana.test.tsx
  - tests/agenda2/agenda2-calendario.test.tsx
  - tests/agenda2/agenda2-calendario-integracao.test.tsx
  - tests/agenda2/agenda2-list.test.tsx
  - tests/agenda2/agenda2-item-form.test.tsx
  - tests/agenda2/agenda2-item-row.test.tsx
  - components/agenda2/Agenda2ItemForm.tsx
  - components/agenda2/Agenda2ConcluirDialog.tsx
  - components/agenda2/Agenda2ItemRow.tsx
  - components/agenda2/Agenda2List.tsx
  - components/agenda2/Agenda2Calendario.tsx
  - tests/agenda2/agenda2-concluir-dialog.test.tsx

must_haves:
  truths:
    - "D-01/D-02: na Agenda (/agenda-2), ao ADICIONAR uma visita o Vendedor vê o campo opcional 'Motivo da visita'; ao EDITAR vê 'Motivo da visita' e 'O que foi feito', já preenchidos com o que estiver salvo; pode salvar com os dois vazios."
    - "D-02: ao clicar em 'Concluir' (Lista, visão Dia ou diálogo do dia aberto pela Semana/Mês) abre uma janela pequena 'Concluir visita' com o campo opcional 'O que foi feito' e os botões 'Concluir' e 'Cancelar'; concluir sem escrever nada funciona; 'Desmarcar' mantém os dois textos."
    - "D-03: numa visita repetida (4, 8 ou 12 semanas) o texto de 'Motivo da visita' vai para TODAS as visitas criadas e 'O que foi feito' nasce vazio em todas; cada visita continua independente."
    - "D-09: o cartão da visita mostra 'Motivo da visita:' e 'O que foi feito:' só quando existem (discretos, no máximo 3 linhas), sem nenhuma linha vazia quando não existem; os chips da Semana e do Mês não mudam; o Supervisor lê os textos e não ganha nenhum botão novo."
    - "D-01/D-04: até 500 caracteres depois de aparar espaços, no banco e na tela; vazio ou só espaços vira vazio (NULL) pela ação; NENHUMA recusa e NENHUM aviso sobre números ou dados pessoais nesses dois campos (regra de nome e bairro inalterada)."
    - "D-04/D-08/D-10: quem decide é o banco — dono escreve os dois textos, Supervisor só lê, outro vendedor e visitante sem login não leem nem alteram; provado ao vivo depois de o dono aplicar a 0051."
    - "D-05/D-08/D-11: exatamente UMA migration nova (0051) desde f7665964ef4c00995a60222699eb19ce8384d85b, nenhuma antiga editada, nenhuma função nova com privilégio elevado (continua 11), Agenda antiga intocada; o dono aprovou e aplicou a 0051 ANTES de qualquer publicação da tela nova (nada foi publicado pelo executor)."
  artifacts:
    - path: supabase/migrations/0051_agenda2_observacoes.sql
      provides: "Duas colunas de texto opcionais (o_que_fazer, o_que_foi_feito) em agenda2_itens com limite de 500 caracteres após aparar"
      contains: "add column if not exists o_que_foi_feito text"
    - path: supabase/rollbacks/0051_volta_agenda2_observacoes.sql
      provides: "Volta atrás (remove as duas colunas), fora de supabase/migrations, cabeçalho NAO APLICAR"
      contains: "NAO APLICAR"
    - path: tests/agenda2/migracao-agenda2-observacoes.test.ts
      provides: "Teste estrutural (fs) da 0051 e do arquivo de volta"
    - path: tests/agenda2/rls-agenda2-observacoes.test.ts
      provides: "Testes ao vivo dos dois textos (7 casos), VERMELHO até o dono aplicar a 0051"
    - path: lib/validations/agenda2.ts
      provides: "AGENDA2_TEXTO_VISITA_MAX = 500 e agenda2TextoVisitaSchema (aparado, vazio vira null, ausente fica ausente)"
      contains: "AGENDA2_TEXTO_VISITA_MAX"
    - path: app/actions/agenda2.ts
      provides: "criar copia o plano para todas as linhas; atualizar grava os textos enviados; concluir(id, resultado?) grava o resultado"
    - path: components/agenda2/Agenda2ConcluirDialog.tsx
      provides: "Janela 'Concluir visita' com 'O que foi feito' opcional, Concluir/Cancelar"
    - path: components/agenda2/Agenda2ItemRow.tsx
      provides: "Mostra os dois textos quando existem, line-clamp-3, sem linha vazia"
  key_links:
    - from: "lib/supabase/queries/agenda2.ts (getAgenda2 e getAgenda2Periodo)"
      to: "colunas o_que_fazer e o_que_foi_feito da 0051"
      via: "select com as duas colunas novas e mapRow para oQueFazer/oQueFoiFeito — por isso a 0051 precisa estar aplicada ANTES de publicar"
      pattern: "o_que_fazer, o_que_foi_feito"
    - from: "components/agenda2/Agenda2List.tsx handleConfirmarConcluir"
      to: "app/actions/agenda2.ts concluirAgenda2Item(id, resultado)"
      via: "Agenda2ConcluirDialog.onConfirmar(texto) -> concluirAgenda2Item(item.id, texto)"
      pattern: "concluirAgenda2Item\\("
    - from: "components/agenda2/Agenda2Calendario.tsx (diálogo do dia)"
      to: "Agenda2List handleAbrirConcluir"
      via: "handleConcluirDoDialogo fecha o diálogo do dia e chama onConcluir(item), que abre a janela de Concluir"
      pattern: "handleConcluirDoDialogo"
    - from: "app/actions/agenda2.ts criarAgenda2Item"
      to: "todas as linhas do lote de repetição"
      via: "cada linha recebe o_que_fazer do parse; o_que_foi_feito nunca entra na criação"
      pattern: "o_que_fazer:"
    - from: "lib/validations/agenda2.ts AGENDA2_TEXTO_VISITA_MAX"
      to: "constraints chk_agenda2_o_que_fazer_tamanho / chk_agenda2_o_que_foi_feito_tamanho (0051)"
      via: "tests/agenda2/limites-sincronizados.test.ts"
      pattern: "<= 500"
    - from: "colunas novas da 0051"
      to: "policies existentes da 0048 (select dono-ou-supervisor; insert/update/delete dono vendedor ativo)"
      via: "RLS por linha cobre as colunas novas sem nenhuma policy nova"
      pattern: "add column if not exists"
---

<objective>
Pedido do dono (2026-10-06): na Agenda (tela /agenda-2, chamada "Agenda" no menu), cada visita ganha dois campos de texto livre OPCIONAIS: "Motivo da visita" (o plano) e "O que foi feito" (o resultado ou o que foi combinado na visita).

Explicando sem jargão: (1) o banco ganha dois "espaços" novos em cada visita, vazios por padrão, com limite de 500 letras — isso é a migration 0051, que o PRÓPRIO dono cola no SQL Editor depois de aprovar; (2) a janela de adicionar visita ganha "Motivo da visita"; a de editar mostra os dois; (3) ao clicar em "Concluir" abre uma janelinha onde dá para anotar "O que foi feito" — ou concluir sem escrever nada; (4) o cartão da visita mostra os textos quando existem. Diferente da tarefa anterior, aqui o banco precisa mudar ANTES de qualquer publicação da tela nova, porque a tela nova pede esses espaços ao banco.

Decisões do dono, numeradas para rastreio:
- D-01: Campos "Motivo da visita" (plano) e "O que foi feito" (resultado). Ambos OPCIONAIS, texto livre, no máximo 500 caracteres depois de aparar espaços (constraint no banco + Zod). Vazio ou só espaços vira NULL.
- D-02: "Motivo da visita" no formulário de criar e no de editar. "O que foi feito" numa janela pequena e opcional que abre ao clicar em "Concluir" (dá para concluir sem escrever nada) e também editável depois no "Editar" (o formulário de editar mostra os DOIS). "Desmarcar" mantém os textos.
- D-03: Visita repetida (4/8/12 semanas): "Motivo da visita" é COPIADO para todas as linhas criadas; "O que foi feito" começa vazio. Cada linha continua independente.
- D-04: Números: o dono decidiu NÃO bloquear e NÃO avisar sobre sequências longas de dígitos nesses dois campos — não aplicar a recusa de 8+ dígitos e não colocar nenhuma dica ou aviso sobre números ou dados pessoais na tela (a regra de nome_cliente e bairro continua igual). Proteções invisíveis de privacidade por padrão aplicadas automaticamente: campos opcionais, limite de 500, sem exportação, nenhum outro dado novo, leitura só do dono e do Supervisor (RLS existente; Supervisor só lê), nenhuma função nova com privilégio elevado (o projeto mantém 11).
- D-05: Banco: migration NOVA 0051_agenda2_observacoes.sql com duas colunas de texto anuláveis (nomes ASCII o_que_fazer e o_que_foi_feito) e check de char_length(btrim(coluna)) <= 500 (nulo permitido). Nunca editar migration antiga. Comentários só em ASCII e só em bloco barra-asterisco (um comentário de dois hífens já quebrou a colagem no SQL Editor); nunca escrever a cláusula literal de elevação de privilégio em comentário.
- D-06: Arquivo de volta supabase/rollbacks/0051_volta_agenda2_observacoes.sql, fora de supabase/migrations, cabeçalho NAO APLICAR, avisando que voltar atrás APAGA os textos escritos.
- D-07: Testes que varrem as migrations atrás do nome da tabela da Agenda 2 (tests/agenda2/migracao-agenda2.test.ts, caso arquivo-unico) são atualizados DE PROPÓSITO para aceitar exatamente este arquivo a mais, com explicação no próprio teste.
- D-08: Ordem de publicação (CRÍTICA — staging e produção usam UM banco só): a tela nova LÊ as colunas novas, então a 0051 é aplicada ANTES de qualquer publicação (tela nova contra banco sem as colunas quebra a Agenda). Colunas novas anuláveis não quebram a tela antiga, então a ordem segura é: dono aplica a migration, depois a tela vai para staging e depois master. O executor nunca aplica SQL, nunca roda db push, nunca faz push. Checkpoint de decisão em português simples com alerta de LGPD + checkpoint de ação humana (dono cola no SQL Editor), antes de os testes ao vivo ficarem verdes. Texto do alerta: texto livre pode receber dados pessoais; fica guardado até o prazo de 1 ano decidido pelo dono (descarte automático AINDA NÃO implementado); sem exportação; o dono decidiu não bloquear números (registrar).
- D-09: Código: tipo Agenda2Item, consultas (getAgenda2, getAgenda2Periodo, listas do select e mapRow), schemas Zod (criar/editar com os dois opcionais; concluir com resultado opcional), Server Actions (criarAgenda2Item copia o plano para todas as linhas do lote; atualizarAgenda2Item grava os dois; concluirAgenda2Item(id, resultado?) grava o resultado quando enviado), componentes: Agenda2ItemForm (plano no criar; os dois no editar; textareas simples; rótulos exatamente "Motivo da visita" / "O que foi feito"), Agenda2ConcluirDialog NOVO (textarea opcional "O que foi feito", botões Concluir/Cancelar) ligado em TODO lugar onde se clica em Concluir, Agenda2ItemRow (mostra os textos quando existem, discreto, poucas linhas, sem linha vazia). Chips do calendário (Semana/Mês) sem mudança. Supervisor vê os textos, só leitura, sem botão novo. A Agenda antiga (app/(app)/agenda, components/agenda, lib/agenda, lib/supabase/queries/agenda.ts, app/actions/agenda.ts) NÃO é tocada.
- D-10: Testes: atualizar DE PROPÓSITO os que afirmam exatamente 8 colunas (migracao-agenda2 e o caso ao vivo lgpd-colunas-minimas) para a lista nova de 10; atualizar limites-sincronizados; teste estrutural novo da migration; testes ao vivo (VERMELHOS até aplicar): dono grava os dois textos; outro vendedor não lê nem altera; Supervisor lê e não altera; mais de 500 recusado; só espaços tratado como desenhado — createTestMember/deleteTestMember, no máximo 2 logins por arquivo, nomes inventados, nada impresso; testes de componente/ação/formulário/diálogo/cartão (lote copia o plano; concluir sem texto funciona; sem linha vazia sem texto).
- D-11: Tarefa final: pasta tests/agenda2, tsc, eslint --max-warnings 0 nos arquivos tocados, npm run build com o código de saída conferido, guarda de escopo contra a base f7665964ef4c00995a60222699eb19ce8384d85b (só arquivos planejados; exatamente uma migration nova; Agenda antiga intocada). Commit só local; sem push.
- D-12: Dono não técnico: SUMMARY e textos de checkpoint em português simples.

Escolhas do planejador (discricionárias, documentadas):
- P-01: Nomes: colunas o_que_fazer e o_que_foi_feito; constraints chk_agenda2_o_que_fazer_tamanho e chk_agenda2_o_que_foi_feito_tamanho; comentário só nas colunas novas (o comentário da tabela da 0048 não muda — evita um arquivo de volta com acentos).
- P-02: Semântica dos textos nas ações: campo AUSENTE = não mexe na coluna; vazio, só espaços ou null = grava NULL; texto = grava aparado. A tela de editar SEMPRE manda os dois; a janela de Concluir SEMPRE manda o que está na caixa. Assim os testes antigos de "editar sem textos" e "concluir/desmarcar" continuam valendo sem edição e provam que Desmarcar não apaga nada.
- P-03: A janela de Concluir abre pré-preenchida com o "O que foi feito" já salvo (o que está na caixa é o que fica salvo — nada some sem a pessoa ver).
- P-04: Concluir dentro do diálogo do dia (Semana/Mês) primeiro FECHA o diálogo do dia e depois abre a janela de Concluir — mesmo precedente de Editar/Apagar (32-06: nunca dois diálogos empilhados). Desmarcar continua agindo ali mesmo. O teste concluir-no-dialogo muda de propósito.
- P-05: O tipo Agenda2Item ganha os dois campos OBRIGATÓRIOS do tipo `string | null` (a consulta sempre preenche); os construtores de item dos testes da pasta tests/agenda2 ganham os dois valores nulos.
- P-06: Cartão: "Motivo da visita:" e "O que foi feito:" em texto pequeno e apagado, no máximo 3 linhas (line-clamp-3), com data-slot para teste.
- P-07: A janela de adicionar/editar ganha altura máxima com rolagem (dois campos de texto em tela de celular).
- P-08: Texto de apoio da janela de Concluir: "Opcional. Você pode concluir sem escrever nada." (não fala de números nem de dados pessoais — D-04).
- P-09: Teste ao vivo com exatamente 2 logins (Vendedor A e Supervisor); o caso "outro vendedor" usa um item do Vendedor B (que nunca faz login) tentado pelo Vendedor A — a policy é a mesma para os dois lados.

Purpose: reduzir esquecimento (plano antes, resultado depois) sem tela longa — os dois campos são opcionais e ficam no fluxo que o vendedor já usa (Adicionar, Concluir, Editar).
Output: migration 0051 + arquivo de volta + testes (estrutural, ao vivo, schema, consultas, ações, formulário, janela de Concluir, cartão, lista, calendário) + tela e ações ajustadas, aplicação feita pelo dono ANTES de publicar, gate final verde.
</objective>

<execution_context>
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/Supabase-conventions/SKILL.md
@.planning/quick/261006-gvo-vendedor-apaga-os-proprios-clientes-em-p/261006-gvo-SUMMARY.md
@.planning/phases/31-agenda-2-visitas-manuais-na-lista/31-03-SUMMARY.md
</context>

## Pesquisa registrada (verificada lendo o código em 2026-10-06)

**Tabela atual.** supabase/migrations/0048_agenda2_itens.sql: 8 colunas (id, vendedor_id, nome_cliente, bairro, data, concluido, criado_em, atualizado_em), 4 constraints, 4 policies (SELECT dono OU is_supervisor(); INSERT/UPDATE/DELETE dono E perfil vendedor ativo) e o gatilho de carimbos BEFORE INSERT OR UPDATE (só mexe em criado_em/atualizado_em). As policies são por LINHA, então valem automaticamente para colunas novas: nenhuma policy nova é necessária. O gatilho não conhece as colunas novas e não precisa mudar. Gravar um texto renova atualizado_em (como qualquer edição hoje) — sem efeito novo na regra de visibilidade da Lista.

**Quem mais lê a tabela.** Só lib/supabase/queries/agenda2.ts (select com lista explícita de colunas, nas duas leituras) e app/actions/agenda2.ts. Nada usa select de todas as colunas no código da aplicação. Por isso: tela ANTIGA + banco com colunas novas = funciona (ignora as colunas; insert sem elas grava NULL). Tela NOVA + banco sem colunas = a leitura falha e a Agenda mostra "Não foi possível carregar sua Agenda" para todo o time. Daí a ordem D-08.

**Testes que varrem migrations.** Só tests/agenda2/migracao-agenda2.test.ts (caso arquivo-unico: nenhum outro arquivo de migration pode citar o nome da tabela da Agenda 2) olha TODAS as migrations atrás desse nome — a 0051 cita a tabela de propósito, então o caso muda (D-07). O caso inventario-elevacao-inalterado também varre todas, mas só procura definições de função; a 0051 não tem nenhuma (e o comentário não pode conter a palavra inglesa de função). tests/clientes/apagar-cliente-migracao.test.ts e tests/agenda/agenda-sem-visitas-migracao.test.ts só olham os próprios prefixos (0050, 0049) — não mudam.

**Testes que afirmam o formato antigo (mudam de propósito).**
- tests/agenda2/migracao-agenda2.test.ts colunas-minimas (8 colunas da 0048) e tests/agenda2/rls-agenda2.test.ts lgpd-colunas-minimas (Object.keys de select de todas as colunas == 8 nomes) -> 10 nomes.
- tests/agenda2/agenda2-periodo-query.test.ts (string exata do select) e agenda2-query.test.ts / agenda2-periodo-query.test.ts (toEqual do item mapeado).
- tests/agenda2/agenda2-actions.test.ts: criar-dono-do-servidor (linha exata do insert) e criar-repete-4 (Object.keys da linha == 4 nomes). Os casos atualizar-ok, atualizar-ignora-repeticao, concluir-ok e desmarcar-ok continuam SEM edição (P-02).
- tests/agenda2/agenda2-item-form.test.tsx: 4 expectativas exatas do payload de criar (linhas ~164, ~457, ~489, ~560) e 2 do payload de editar (~266 e ~507/512).
- tests/agenda2/agenda2-list.test.tsx concluir-recarrega e falha-acao (Concluir agora abre a janela); tests/agenda2/agenda2-calendario.test.tsx concluir-no-dialogo (P-04); tests/agenda2/agenda2-calendario-integracao.test.tsx concluir-no-calendario-recarrega (janela + 2 argumentos).
- Construtores de Agenda2Item (P-05): agenda2-calendario-dia, agenda2-calendario-mes, agenda2-calendario-semana, agenda2-apagar-dialog, agenda2-calendario, agenda2-calendario-integracao, agenda2-list, agenda2-item-form, agenda2-item-row (.tsx) e itens.test.ts. Nenhum outro arquivo do projeto monta Agenda2Item (grep feito); a Agenda antiga usa outro tipo.

**Todos os lugares onde se clica em Concluir.** components/agenda2/Agenda2ItemRow.tsx (o botão) é usado por Agenda2List (Lista) e por Agenda2CalendarioDia, que aparece na visão Dia e no diálogo do dia aberto pela Semana/Mês (Agenda2Calendario). Todos os onConcluir sobem para Agenda2List, que passa a abrir a janela nova (D-09). Semana e Mês só mostram chips, sem botão Concluir.

**Zod v4 (instalado ^4.4.3).** O campo de texto é montado como: string, trim, max(500, mensagem), transform (vazio vira null), nullable, optional — nesta ordem, para que AUSENTE continue ausente (optional curto-circuita antes do transform) e null continue null. Entrada e saída ficam com o mesmo tipo TypeScript (string | null | undefined), então o zodResolver do formulário continua com um tipo só. Os casos sem-campos-extras e descarta-extras de validacao-agenda2.test.ts (Object.keys do resultado) devem continuar verdes SEM edição — prova de que chave ausente não aparece no resultado.

## Contrato SQL (texto exato — o bloco de comentário do topo é descrito na Tarefa 1)

Corpo da migration supabase/migrations/0051_agenda2_observacoes.sql (depois do bloco de comentário):

```sql
alter table agenda2_itens add column if not exists o_que_fazer text;
alter table agenda2_itens add column if not exists o_que_foi_feito text;

alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_fazer_tamanho;
alter table agenda2_itens add constraint chk_agenda2_o_que_fazer_tamanho check (char_length(btrim(o_que_fazer)) <= 500);

alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_foi_feito_tamanho;
alter table agenda2_itens add constraint chk_agenda2_o_que_foi_feito_tamanho check (char_length(btrim(o_que_foi_feito)) <= 500);

comment on column agenda2_itens.o_que_fazer is 'Agenda: o que o vendedor pretende fazer na visita. Texto livre opcional, ate 500 caracteres. Quick task 261006-ncy.';
comment on column agenda2_itens.o_que_foi_feito is 'Agenda: o que foi feito ou combinado na visita. Texto livre opcional, ate 500 caracteres. Quick task 261006-ncy.';
```

Corpo do arquivo de volta supabase/rollbacks/0051_volta_agenda2_observacoes.sql (depois do bloco de comentário):

```sql
alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_fazer_tamanho;
alter table agenda2_itens drop constraint if exists chk_agenda2_o_que_foi_feito_tamanho;
alter table agenda2_itens drop column if exists o_que_fazer;
alter table agenda2_itens drop column if exists o_que_foi_feito;
```

## Interfaces existentes (lidas no código)

- lib/agenda2/itens.ts: `export type Agenda2Item = { id; nomeCliente; bairro; data; concluido; atualizadoEm; responsavel: string | null; responsavelNome: string | null }`.
- lib/validations/agenda2.ts: `agenda2ItemSchema` (z.object nomeCliente/bairro/data, usado na EDIÇÃO e como base), `criarAgenda2CriarSchema(hoje)` (extend com repetirSemanas + superRefine; um resolver só para criar e editar no formulário — decisão 32-05), `Agenda2ItemInput`, `Agenda2CriarItemInput = z.input<...>`, `agenda2ItemIdSchema`, constantes AGENDA2_NOME_MAX/AGENDA2_BAIRRO_MAX/AGENDA2_DIGITOS_SEGUIDOS_MAX e mensagens.
- lib/supabase/queries/agenda2.ts: tipo local Agenda2Row, `mapRow`, `getAgenda2(now)` e `getAgenda2Periodo(inicio, fim)` com o select "id, vendedor_id, nome_cliente, bairro, data, concluido, atualizado_em, profiles(nome, sobrenome)"; getAgenda2PendentesCount não muda.
- app/actions/agenda2.ts: `criarAgenda2Item(values)` monta cada linha só com nome_cliente/bairro/data/vendedor_id e grava num único insert(array); `atualizarAgenda2Item(itemId, values)` atualiza nome/bairro/data, nunca concluido; helper interno `definirConcluido(itemId, valor)`; `concluirAgenda2Item(itemId)` e `desmarcarAgenda2Item(itemId)`; mensagens fixas; zero linhas vira `nao_encontrado`.
- components/agenda2/Agenda2ItemForm.tsx: Dialog controlado, `Agenda2ItemFields` com key por modo/item, `defaultValues` por modo, `useForm<Agenda2CriarItemInput>` com `zodResolver(schema)`, campo Repetir só no criar, payload de editar com três campos explícitos, LGPD_HINT sob o nome.
- components/agenda2/Agenda2ApagarDialog.tsx: molde da janela nova (corpo remontado por key `${open}-${item?.id}`, erro role="alert", Cancelar ghost, botão principal, contrato `onConfirmar(): Promise<boolean>`).
- components/agenda2/Agenda2List.tsx: dona de todas as escritas; `handleConcluir(id)` chama a ação direto hoje; renderiza Agenda2ItemForm e Agenda2ApagarDialog só quando não é Supervisor; passa `onConcluir={(item) => handleConcluir(item.id)}` ao Agenda2Calendario.
- components/agenda2/Agenda2Calendario.tsx: `handleEditarDoDialogo`/`handleApagarDoDialogo` fecham o diálogo do dia antes de chamar a tela; o diálogo do dia repassa `onConcluir` direto hoje.
- components/ui/textarea.tsx (`Textarea`), components/ui/label.tsx (`Label`), components/ui/dialog.tsx (`DialogContent` sem altura máxima).
- tests/helpers/supabase-test-clients.ts: `anonClient()`, `serviceClient()`, `signInAs(email, password)`, `createTestMember(role, label)`, `deleteTestMember(id)`, tipo `TestMember`.

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Migration 0051 + arquivo de volta + teste estrutural (verde) + testes de 10 colunas + testes ao vivo (VERMELHOS até a aplicação)</name>
  <files>supabase/migrations/0051_agenda2_observacoes.sql, supabase/rollbacks/0051_volta_agenda2_observacoes.sql, tests/agenda2/migracao-agenda2-observacoes.test.ts, tests/agenda2/migracao-agenda2.test.ts, tests/agenda2/rls-agenda2.test.ts, tests/agenda2/rls-agenda2-observacoes.test.ts</files>
  <read_first>
    - supabase/migrations/0048_agenda2_itens.sql (tabela, constraints com btrim, policies, gatilho)
    - supabase/migrations/0050_vendedor_apaga_cliente_em_prospeccao.sql e supabase/rollbacks/0050_volta_policy_delete_clientes.sql (estilo do cabeçalho ASCII em bloco e do NAO APLICAR)
    - tests/clientes/apagar-cliente-migracao.test.ts (molde do teste estrutural: lf, semComentarios, ehAsciiPuro, linhaComecaComDoisHifens, normaliza, contaOcorrencias, cláusula montada por concatenação)
    - tests/agenda2/migracao-agenda2.test.ts (casos arquivo-unico e colunas-minimas; inventário de 11)
    - tests/agenda2/rls-agenda2.test.ts (linhas 1-140: cabeçalho, fixtures, nomeInventado com timestamp quebrado, hojeSaoPaulo, seedItem; caso lgpd-colunas-minimas nas linhas 203-221)
  </read_first>
  <behavior>
    - Estrutural arquivo-unico: só um arquivo de migration começa com "0051" e é 0051_agenda2_observacoes.sql; o arquivo de volta existe em supabase/rollbacks e não em supabase/migrations.
    - Estrutural duas-colunas-opcionais: SQL sem comentários, normalizado e minúsculo, contém "alter table agenda2_itens add column if not exists o_que_fazer text;" e "alter table agenda2_itens add column if not exists o_que_foi_feito text;"; exatamente 2 "add column"; não contém "not null" nem "default".
    - Estrutural limite-500: contém os dois "drop constraint if exists chk_agenda2_o_que_fazer_tamanho;" / "...o_que_foi_feito_tamanho;" e os dois "add constraint chk_agenda2_o_que_fazer_tamanho check (char_length(btrim(o_que_fazer)) <= 500);" / idem o_que_foi_feito; exatamente 2 "add constraint".
    - Estrutural sem-trava-de-numeros (D-04): SQL sem comentários não contém "[0-9]" nem "regexp".
    - Estrutural so-colunas-sem-regra-nova: SQL sem comentários não contém "policy", "function", "trigger", "grant ", "revoke ", "drop table", "drop column", "truncate", "delete from", "update ", "insert into", "rename", "disable row level security", "$$" nem a cláusula de elevação; contém os dois "comment on column agenda2_itens.o_que_fazer is" / "...o_que_foi_feito is".
    - Estrutural comentarios-seguros: arquivo cru é ASCII puro, nenhuma linha começa com dois hífens, e o texto cru minúsculo não contém a cláusula de elevação, "function" nem "$$".
    - Estrutural arquivo-de-volta: ASCII puro, sem linha com dois hífens, contém "NAO APLICAR" e "APAGA todos os textos"; sem comentários e normalizado contém exatamente as 4 linhas do Contrato SQL (volta atrás); não contém "add column" nem a cláusula de elevação.
    - migracao-agenda2 arquivo-unico (atualizado): o conjunto de migrations cujo texto cru cita a tabela da Agenda 2 é exatamente ["0048_agenda2_itens.sql", "0051_agenda2_observacoes.sql"].
    - migracao-agenda2 colunas-minimas (atualizado): o bloco da 0048 continua com as 8 colunas e sem palavras proibidas; a 0051 (sem comentários) acrescenta exatamente ["o_que_fazer", "o_que_foi_feito"]; total documentado = 10; nenhum dos dois nomes contém palavra proibida.
    - inventario-elevacao-inalterado continua verde SEM edição (11).
    - Ao vivo (VERMELHO até a 0051 existir no banco): dono-grava-os-dois-textos, outro-vendedor-nao-le-nem-altera-os-textos, supervisor-le-os-textos-mas-nao-altera, limite-500-depois-de-aparar, so-espacos-aceito-pelo-banco, sem-texto-continua-valendo, anonimo-nao-le-os-textos; e lgpd-colunas-minimas (rls-agenda2) com as 10 colunas.
  </behavior>
  <action>
1. RED — criar tests/agenda2/migracao-agenda2-observacoes.test.ts (ambiente node, só fs/path/vitest), no molde de tests/clientes/apagar-cliente-migracao.test.ts: constantes da pasta de migrations, nome/caminho da 0051, nome/caminho do arquivo de volta em supabase/rollbacks; cláusula de elevação montada juntando as duas palavras com um espaço (a string inteira nunca aparece no arquivo); helpers lf, semComentarios (remove blocos barra-asterisco e linhas cujo trim começa com dois hífens), ehAsciiPuro, linhaComecaComDoisHifens, normaliza, contaOcorrencias. Escrever os 7 casos estruturais do bloco behavior com exatamente esses nomes de it. Rodar e confirmar que FALHA (arquivos ainda não existem). Commit: `test(quick-261006-ncy): add failing structural test for migration 0051 and rollback file`.
2. GREEN — criar supabase/migrations/0051_agenda2_observacoes.sql (per D-05): primeiro UM bloco de comentário barra-asterisco, só ASCII, sem linha começando com dois hífens, em português sem acento, dizendo: quick task 261006-ncy; decisão do dono de 2026-10-06 (duas colunas de texto livre OPCIONAIS: o_que_fazer = o que o vendedor vai fazer na visita; o_que_foi_feito = o que foi feito ou combinado; ate 500 caracteres depois de aparar espacos; vazio vira NULL na aplicacao); excecao consciente a minimizacao da 0048, que nao tinha observacao livre — decisao do dono com alerta de LGPD registrado no SUMMARY; o dono decidiu NAO recusar sequencias longas de digitos nestes dois campos (a regra de nome_cliente e bairro continua igual); nenhuma policy muda — as policies da 0048 sao por linha e ja cobrem as colunas novas (dono le e escreve, Supervisor so le, outro vendedor nao ve); o gatilho de carimbos nao muda; colunas anulaveis: linhas existentes ficam com NULL e a tela atual continua funcionando, por isso esta mudanca e aplicada ANTES de publicar a tela nova; o prazo de guarda de 1 ano decidido em 2026-10-01 vale tambem para estes textos, descarte automatico ainda nao implementado e nenhum descarte aqui; nenhuma rotina nova e nenhuma clausula de elevacao de privilegio; re-executavel (add column if not exists e drop constraint if exists antes de cada add constraint); volta atras em supabase/rollbacks/0051_volta_agenda2_observacoes.sql, NAO aplicado automaticamente, e voltar atras APAGA os textos. O comentário NÃO pode conter a palavra inglesa de função, a cláusula de elevação nem cifrões duplos. Depois do comentário, o corpo EXATO do "Contrato SQL" (migration). Criar supabase/rollbacks/0051_volta_agenda2_observacoes.sql (per D-06): bloco de comentário ASCII começando com "NAO APLICAR automaticamente.", dizendo que fica fora de supabase/migrations de propósito; que é a volta atrás da 0051; a frase exata "ATENCAO: APAGA todos os textos ja escritos em Motivo da visita e O que foi feito, sem volta."; e a ORDEM obrigatória: primeiro publicar a versão da tela SEM os campos (reverter os commits feat das Tarefas 2 e 3 desta quick task e publicar), só DEPOIS colar este arquivo no SQL Editor — senão a Agenda para de carregar para todo o time; depois o corpo EXATO do "Contrato SQL" (volta atrás). Nunca editar a 0048 nem nenhuma migration antiga. Rodar o teste estrutural até ficar verde.
3. Atualizar tests/agenda2/migracao-agenda2.test.ts (per D-07/D-10), sem mexer em nenhum outro caso: no cabeçalho, uma nota curta "Quick 261006-ncy (2026-10-06): a migration 0051 acrescenta, por decisão do dono, duas colunas de texto opcionais; arquivo-unico passa a aceitar exatamente 0048 e 0051 como os únicos arquivos que citam a tabela, e colunas-minimas confere 8 colunas da 0048 + 2 da 0051 = 10". arquivo-unico: manter a checagem do prefixo 0048 e trocar o laço por: lista dos arquivos .sql cujo texto cru minúsculo contém o nome da tabela == exatamente os dois nomes do behavior. colunas-minimas: manter as asserções da 0048 e acrescentar a leitura da 0051 sem comentários (blocos e linhas de dois hífens), extrair todos os nomes depois de "add column if not exists", afirmar a lista exata das 2 colunas novas, afirmar uma constante local com as 10 colunas (8 + 2, comprimento 10) e que nenhuma das 2 novas contém palavra proibida. Rodar o arquivo inteiro: 13 casos verdes, inclusive inventario-elevacao-inalterado SEM edição. Commit: `feat(quick-261006-ncy): add migration 0051 (agenda2 o que vou fazer / o que foi feito) and rollback file`.
4. Testes ao vivo (per D-10): em tests/agenda2/rls-agenda2.test.ts mudar SÓ o caso lgpd-colunas-minimas para a lista ordenada de 10 nomes (atualizado_em, bairro, concluido, criado_em, data, id, nome_cliente, o_que_fazer, o_que_foi_feito, vendedor_id) com um comentário de uma linha citando a 0051 e a decisão do dono de 2026-10-06. Criar tests/agenda2/rls-agenda2-observacoes.test.ts no molde de rls-agenda2.test.ts. Cabeçalho em comentário: prova as colunas da 0051 contra o banco REAL (o projeto de teste é o de produção); VERMELHO até o dono aplicar a 0051; só fixtures descartáveis (nunca as contas semente antigas); exatamente duas autenticações (Vendedor A e Supervisor; Vendedor B nunca faz login, o anônimo usa o cliente sem login — P-09); nunca imprime nada; toda leitura de conferência é pelo cliente de serviço filtrando pelos ids de fixture; nomes e textos inventados. beforeAll: createTestMember para vendedor "obs-a", vendedor "obs-b" e supervisor "obs"; signInAs só de A e do Supervisor. Copiar nomeInventado (timestamp quebrado a cada 3 dígitos com a letra x) e hojeSaoPaulo; o arquivo inteiro não pode ter nenhum literal com 8 ou mais dígitos seguidos; textos de fixture só com letras (ex.: "Teste levar amostras", "Teste pedido combinado"). Helper de semeadura pelo cliente de serviço com vendedor_id, nome inventado, bairro "Bairro Teste", data de hoje e os textos opcionais. afterAll: apagar pelo cliente de serviço todo item com vendedor_id nos três ids de fixture e só DEPOIS deleteTestMember dos três. Casos: (1) dono-grava-os-dois-textos: A insere o próprio item com o_que_fazer (pedindo select("id").single()); A atualiza concluido true + o_que_foi_feito (select("id") devolve 1 linha); A atualiza só concluido false (desmarcar, 1 linha); pelo serviço, o_que_fazer e o_que_foi_feito continuam iguais e concluido é false. (2) outro-vendedor-nao-le-nem-altera-os-textos: item de B semeado com os dois textos; A lê por id -> lista vazia; A tenta atualizar o_que_foi_feito -> 0 linhas; pelo serviço, nada mudou. (3) supervisor-le-os-textos-mas-nao-altera: item de A semeado com os dois textos; Supervisor lê "id, o_que_fazer, o_que_foi_feito" por id -> 1 linha com os textos iguais; Supervisor tenta atualizar o_que_fazer -> 0 linhas; pelo serviço, nada mudou. (4) limite-500-depois-de-aparar: A insere com o_que_fazer de 501 letras -> erro; com o_que_foi_feito de 501 letras -> erro; com os dois de 500 letras -> sem erro; com o_que_fazer de 500 letras cercado por dois espaços de cada lado -> sem erro (a regra apara antes de contar). (5) so-espacos-aceito-pelo-banco: A insere o_que_fazer só com espaços -> sem erro, e pelo serviço o valor gravado é o mesmo texto de espaços (o banco só limita o tamanho; quem transforma em vazio é a ação, provado em agenda2-actions.test.ts). (6) sem-texto-continua-valendo: A insere sem as duas chaves (como a tela antiga faz) -> sem erro; pelo serviço os dois valores são null. (7) anonimo-nao-le-os-textos: item de A semeado com textos; o cliente anônimo lê por id -> nenhuma linha (aceitar erro ou lista vazia). Não executar estes arquivos nesta tarefa (banco de produção, 0051 ainda não aplicada — mesmo procedimento do 31-01 e da quick 261006-gvo); só tsc, eslint e a checagem estrutural do verify. Commit: `test(quick-261006-ncy): add live RLS tests for the two agenda texts and update 10-column cases`.
  </action>
  <verify>
    <automated>npx vitest run tests/agenda2/migracao-agenda2-observacoes.test.ts tests/agenda2/migracao-agenda2.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 tests/agenda2/migracao-agenda2-observacoes.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/rls-agenda2.test.ts tests/agenda2/rls-agenda2-observacoes.test.ts && node -e "const fs=require('fs');const s=fs.readFileSync('tests/agenda2/rls-agenda2-observacoes.test.ts','utf8');const n=(s.match(/signInAs\(/g)||[]).length;if(n!==2)throw new Error('logins: '+n);if(/console\./.test(s))throw new Error('impressao');if(/SEED_ACCOUNTS/.test(s))throw new Error('contas semente');if(!/createTestMember\(/.test(s)||!/deleteTestMember\(/.test(s))throw new Error('fixtures');if(/[0-9]{8,}/.test(s))throw new Error('8+ digitos');for(const c of ['dono-grava-os-dois-textos','outro-vendedor-nao-le-nem-altera-os-textos','supervisor-le-os-textos-mas-nao-altera','limite-500-depois-de-aparar','so-espacos-aceito-pelo-banco','sem-texto-continua-valendo','anonimo-nao-le-os-textos']){if(!s.includes(c))throw new Error('caso ausente: '+c)}const r=fs.readFileSync('tests/agenda2/rls-agenda2.test.ts','utf8');if(!r.includes('\"o_que_fazer\"')||!r.includes('\"o_que_foi_feito\"'))throw new Error('lgpd-colunas-minimas sem as 10 colunas');console.log('OK testes ao vivo (estrutura)')" && node -e "const cp=require('child_process');const st=cp.execFileSync('git',['diff','--name-status','f7665964ef4c00995a60222699eb19ce8384d85b','HEAD','--','supabase/migrations']).toString().split('\n').map(s=>s.trim()).filter(Boolean);if(st.length!==1||st[0]!=='A\tsupabase/migrations/0051_agenda2_observacoes.sql')throw new Error('migrations: '+st.join(' | '));console.log('OK uma migration nova')"</automated>
  </verify>
  <acceptance_criteria>
    - Teste estrutural novo: rodada vermelha antes dos arquivos e agora 7/7 verdes; migracao-agenda2 13/13 verde (inventário de 11 sem edição); os estruturais da 0049 e da 0050 verdes sem edição.
    - A 0051 e o arquivo de volta seguem o "Contrato SQL" ao pé da letra; cabeçalhos ASCII, só em bloco, sem a cláusula de elevação; o de volta avisa que APAGA os textos e a ordem (tela primeiro, banco depois).
    - Desde a base, supabase/migrations tem exatamente uma linha "A" (a 0051); nenhuma migration antiga editada.
    - Teste ao vivo novo com os 7 casos, exatamente 2 logins, nada impresso, só fixtures, nenhum literal de 8+ dígitos; lgpd-colunas-minimas com 10 nomes; NENHUM dos dois executado nesta tarefa.
    - tsc e eslint --max-warnings 0 limpos nos 4 arquivos de teste.
  </acceptance_criteria>
  <done>Mudança no banco escrita (não aplicada) com volta atrás pronta, prova estrutural verde e prova ao vivo pronta para ficar verde quando o dono aplicar a 0051.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 2: Tipo, schema, consultas e ações com os dois textos + testes (tela ainda sem mudança)</name>
  <files>lib/agenda2/itens.ts, lib/validations/agenda2.ts, lib/supabase/queries/agenda2.ts, app/actions/agenda2.ts, tests/agenda2/validacao-agenda2.test.ts, tests/agenda2/limites-sincronizados.test.ts, tests/agenda2/agenda2-query.test.ts, tests/agenda2/agenda2-periodo-query.test.ts, tests/agenda2/agenda2-actions.test.ts, tests/agenda2/itens.test.ts, tests/agenda2/agenda2-apagar-dialog.test.tsx, tests/agenda2/agenda2-calendario-dia.test.tsx, tests/agenda2/agenda2-calendario-mes.test.tsx, tests/agenda2/agenda2-calendario-semana.test.tsx, tests/agenda2/agenda2-calendario.test.tsx, tests/agenda2/agenda2-calendario-integracao.test.tsx, tests/agenda2/agenda2-list.test.tsx, tests/agenda2/agenda2-item-form.test.tsx, tests/agenda2/agenda2-item-row.test.tsx, components/agenda2/Agenda2ItemForm.tsx (só a chamada do useForm, e só se o tsc exigir)</files>
  <read_first>
    - lib/validations/agenda2.ts, lib/agenda2/itens.ts (linhas 41-57), lib/supabase/queries/agenda2.ts, app/actions/agenda2.ts (arquivos inteiros)
    - tests/agenda2/validacao-agenda2.test.ts (linhas 1-40, 201-218, 336-355), tests/agenda2/limites-sincronizados.test.ts
    - tests/agenda2/agenda2-query.test.ts (linhas 80-186) e tests/agenda2/agenda2-periodo-query.test.ts (linhas 60-130)
    - tests/agenda2/agenda2-actions.test.ts (linhas 1-130 e 320-672)
  </read_first>
  <behavior>
    - Schema agenda2TextoVisitaSchema: undefined -> undefined; null -> null; "" -> null; "   " -> null; "  Levar catálogo  " -> "Levar catálogo"; 500 letras aceito; 501 recusado com AGENDA2_MSG_TEXTO_VISITA_LONGO; um texto com 11 dígitos seguidos (montado com repeat, nunca literal) é ACEITO (D-04).
    - agenda2ItemSchema e criarAgenda2CriarSchema aceitam oQueFazer e oQueFoiFeito opcionais; sem-campos-extras e descarta-extras continuam verdes SEM edição.
    - limites textos-sincronizados: a 0051 contém as duas constraints com "<= " + AGENDA2_TEXTO_VISITA_MAX; o schema aceita MAX e recusa MAX + 1.
    - Consultas: select das duas leituras = "id, vendedor_id, nome_cliente, bairro, data, concluido, atualizado_em, o_que_fazer, o_que_foi_feito, profiles(nome, sobrenome)" (sem criado_em); mapRow devolve oQueFazer/oQueFoiFeito (texto ou null).
    - Ação criar-copia-o-plano-no-lote: repetirSemanas 4 + oQueFazer "Levar amostras" -> UM insert com 4 linhas, cada uma com o_que_fazer "Levar amostras" e chaves exatamente bairro, data, nome_cliente, o_que_fazer, vendedor_id (oQueFoiFeito enviado pela tela é ignorado).
    - Ação criar-plano-aparado-e-vazio: "  Levar catálogo  " grava aparado; "   " e ausente gravam o_que_fazer null.
    - Ação criar-plano-longo: 501 caracteres -> validacao e nenhum insert.
    - Ação atualizar-com-textos: os dois enviados -> update com nome/bairro/data + o_que_fazer + o_que_foi_feito (aparados; só espaços vira null); atualizar-ok e atualizar-ignora-repeticao continuam SEM edição (campo ausente não entra no update).
    - Ação atualizar-texto-longo: 501 -> validacao e nenhum update.
    - Ação concluir-com-resultado: concluir(id, "  Pedido fechado  ") -> update exatamente { concluido: true, o_que_foi_feito: "Pedido fechado" }.
    - Ação concluir-sem-texto: concluir(id, "") e concluir(id, "   ") -> update { concluido: true, o_que_foi_feito: null }; concluir-ok (sem segundo argumento -> { concluido: true }) e desmarcar-ok ({ concluido: false }) continuam SEM edição.
    - Ação concluir-resultado-longo: 501 -> validacao e nenhum update.
  </behavior>
  <action>
1. RED — testes primeiro. validacao-agenda2.test.ts: novo describe "agenda2TextoVisitaSchema" com os casos do behavior (importar a constante, a mensagem e o schema novos) e um caso em agenda2ItemSchema/criarAgenda2CriarSchema aceitando os dois textos. limites-sincronizados.test.ts: novo caso textos-sincronizados lendo supabase/migrations/0051_agenda2_observacoes.sql e uma linha no cabeçalho citando a 0051. agenda2-query.test.ts e agenda2-periodo-query.test.ts: fakeRow ganha o_que_fazer null e o_que_foi_feito null; os toEqual do item mapeado ganham oQueFazer null e oQueFoiFeito null; a lista de colunas afirma as duas novas (periodo: string exata do behavior; query: toContain das duas e continua sem criado_em); um caso novo de mapeamento com os dois textos preenchidos. agenda2-actions.test.ts: atualizar DE PROPÓSITO criar-dono-do-servidor (a linha esperada ganha o_que_fazer null; acrescentar oQueFoiFeito "Teste tentativa" aos extras e continuar esperando a linha sem essa chave) e criar-repete-4 (Object.keys == as 5 chaves do behavior, com oQueFazer "Levar amostras" em todas as linhas); escrever os casos novos do behavior; NÃO editar atualizar-ok, atualizar-ignora-repeticao, concluir-ok nem desmarcar-ok. Construtores (P-05): nos 10 arquivos de teste com função que monta Agenda2Item (agenda2-apagar-dialog, agenda2-calendario-dia, agenda2-calendario-mes, agenda2-calendario-semana, agenda2-calendario, agenda2-calendario-integracao, agenda2-list, agenda2-item-form, agenda2-item-row e itens.test.ts) acrescentar só oQueFazer: null e oQueFoiFeito: null no objeto padrão — nada mais. Rodar validacao, limites, query, periodo e actions e confirmar que FALHAM. Commit: `test(quick-261006-ncy): add failing tests for agenda texts in schema, queries and actions`.
2. GREEN — lib/validations/agenda2.ts (per D-01/D-04): AGENDA2_TEXTO_VISITA_MAX = 500 com JSDoc "FONTE ÚNICA — espelha chk_agenda2_o_que_fazer_tamanho e chk_agenda2_o_que_foi_feito_tamanho (migration 0051)"; AGENDA2_MSG_TEXTO_VISITA_LONGO = "Use no máximo 500 caracteres."; agenda2TextoVisitaSchema montado na ordem descrita na Pesquisa (string, trim, max com a mensagem, transform vazio -> null, nullable, optional), com JSDoc: opcional; AUSENTE = a ação não mexe na coluna; vazio, só espaços ou null = grava NULL; texto = grava aparado; SEM recusa de sequência de dígitos e SEM dica na tela, por decisão do dono de 2026-10-06 (diferente de nome e bairro). agenda2ItemSchema ganha oQueFazer e oQueFoiFeito com esse schema (o criar herda pelo extend — um resolver só, decisão 32-05); atualizar o JSDoc do topo do arquivo citando a 0051. Se o tsc reclamar do tipo do resolver em components/agenda2/Agenda2ItemForm.tsx por diferença entre entrada e saída do schema, NÃO trocar o schema: ajustar já nesta tarefa SÓ a chamada do useForm desse arquivo para os três genéricos (entrada, contexto, saída do schema) e registrar no SUMMARY — nenhuma outra mudança nesse arquivo antes da Tarefa 3. lib/agenda2/itens.ts: Agenda2Item ganha oQueFazer: string | null e oQueFoiFeito: string | null, cada um com JSDoc de uma linha (D-09/P-05). lib/supabase/queries/agenda2.ts: Agenda2Row ganha o_que_fazer e o_que_foi_feito (string | null); as DUAS leituras usam o select exato do behavior; mapRow mapeia com ?? null; atualizar o JSDoc (as duas colunas vêm da 0051 e precisam existir no banco antes de publicar; continuam sem criado_em). app/actions/agenda2.ts (per D-03/D-09, P-02): criarAgenda2Item acrescenta o_que_fazer (o valor do parse, ou null) a CADA linha do lote e nunca grava o_que_foi_feito; atualizarAgenda2Item monta o objeto do update com nome/bairro/data e acrescenta o_que_fazer e/ou o_que_foi_feito só quando o valor do parse não é undefined (nunca concluido); concluirAgenda2Item(itemId, resultado?: string | null): sem segundo argumento faz exatamente o que faz hoje; com ele, valida com agenda2TextoVisitaSchema junto com o id (falha -> validacao, nada gravado) e grava concluido true + o_que_foi_feito (texto aparado ou null) no MESMO update — estender o helper definirConcluido com um terceiro parâmetro opcional de colunas extras; desmarcarAgenda2Item não muda (mantém os textos, D-02). Atualizar os JSDoc das três ações e do topo do arquivo (plano copiado para todas as linhas; resultado nasce vazio; ausente não mexe; desmarcar mantém). Nenhuma checagem de papel nova, nenhuma chamada de função do banco. Se o tsc apontar algum OUTRO arquivo montando Agenda2Item fora da lista, PARAR e reportar (não tocar a Agenda antiga). Rodar os testes do verify até ficarem verdes — a tela ainda não muda nesta tarefa, então formulário, lista e calendário continuam verdes como estão. Commit: `feat(quick-261006-ncy): agenda texts in schema, queries and actions (plan copied to every repeated visit)`.
  </action>
  <verify>
    <automated>npx vitest run tests/agenda2/validacao-agenda2.test.ts tests/agenda2/limites-sincronizados.test.ts tests/agenda2/agenda2-query.test.ts tests/agenda2/agenda2-periodo-query.test.ts tests/agenda2/agenda2-actions.test.ts tests/agenda2/itens.test.ts tests/agenda2/repeticao.test.ts tests/agenda2/agenda2-apagar-dialog.test.tsx tests/agenda2/agenda2-calendario-dia.test.tsx tests/agenda2/agenda2-calendario-mes.test.tsx tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario-toolbar.test.tsx tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx tests/agenda2/agenda2-list.test.tsx tests/agenda2/agenda2-item-form.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/app-layout-contagem.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 lib/agenda2/itens.ts lib/validations/agenda2.ts lib/supabase/queries/agenda2.ts app/actions/agenda2.ts tests/agenda2/validacao-agenda2.test.ts tests/agenda2/limites-sincronizados.test.ts tests/agenda2/agenda2-query.test.ts tests/agenda2/agenda2-periodo-query.test.ts tests/agenda2/agenda2-actions.test.ts tests/agenda2/itens.test.ts tests/agenda2/agenda2-apagar-dialog.test.tsx tests/agenda2/agenda2-calendario-dia.test.tsx tests/agenda2/agenda2-calendario-mes.test.tsx tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx tests/agenda2/agenda2-list.test.tsx tests/agenda2/agenda2-item-form.test.tsx tests/agenda2/agenda2-item-row.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada e agora tudo verde; atualizar-ok, atualizar-ignora-repeticao, concluir-ok, desmarcar-ok, sem-campos-extras e descarta-extras verdes SEM edição.
    - O lote de repetição grava o mesmo o_que_fazer em todas as linhas e nunca o_que_foi_feito; ausente não entra no update; vazio vira null; 501 é recusado antes de qualquer ida ao banco.
    - Nenhuma recusa ou mensagem sobre dígitos nos dois textos; a regra de nome e bairro intacta.
    - Construtores de teste só ganharam os dois nulos; nenhum arquivo da Agenda antiga tocado.
    - tsc e eslint --max-warnings 0 limpos.
  </acceptance_criteria>
  <done>Os dados das visitas carregam e gravam os dois textos do jeito decidido, provado por testes, com a tela ainda igual.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 3: Tela — campos no formulário, janela "Concluir visita", textos no cartão e Concluir ligado em todos os lugares + testes</name>
  <files>components/agenda2/Agenda2ItemForm.tsx, components/agenda2/Agenda2ConcluirDialog.tsx, components/agenda2/Agenda2ItemRow.tsx, components/agenda2/Agenda2List.tsx, components/agenda2/Agenda2Calendario.tsx, tests/agenda2/agenda2-concluir-dialog.test.tsx, tests/agenda2/agenda2-item-form.test.tsx, tests/agenda2/agenda2-item-row.test.tsx, tests/agenda2/agenda2-list.test.tsx, tests/agenda2/agenda2-calendario.test.tsx, tests/agenda2/agenda2-calendario-integracao.test.tsx</files>
  <read_first>
    - components/agenda2/Agenda2ItemForm.tsx, Agenda2ApagarDialog.tsx, Agenda2ItemRow.tsx, Agenda2List.tsx, Agenda2Calendario.tsx (arquivos inteiros)
    - tests/agenda2/agenda2-apagar-dialog.test.tsx (molde do teste da janela nova)
    - tests/agenda2/agenda2-item-form.test.tsx (linhas 1-175, 236-316, 398-566), tests/agenda2/agenda2-item-row.test.tsx (linhas 1-60)
    - tests/agenda2/agenda2-list.test.tsx (linhas 1-100, 262-383), tests/agenda2/agenda2-calendario.test.tsx (linhas 380-422), tests/agenda2/agenda2-calendario-integracao.test.tsx (linhas 236-276)
  </read_first>
  <behavior>
    - Formulário criar: tem a caixa "Motivo da visita" (getByLabelText) e NÃO tem "O que foi feito"; enviar sem texto chama criarAgenda2Item com oQueFazer null; com "Levar catálogo" envia oQueFazer "Levar catálogo" junto com repetirSemanas.
    - Formulário editar: as duas caixas aparecem pré-preenchidas com o texto do item; o payload de editar tem exatamente as chaves nomeCliente, bairro, data, oQueFazer, oQueFoiFeito (nesta ordem).
    - Formulário limite: 501 caracteres em "Motivo da visita" mostra "Use no máximo 500 caracteres." e não chama a ação.
    - Formulário sem-aviso-de-numeros (D-04): com 11 dígitos seguidos (montados com repeat) em "Motivo da visita" o envio acontece e nenhum texto da tela casa com /n[úu]mero/i.
    - Janela titulo-e-campo: título "Concluir visita", linha "Visita de <nome> em <dd/MM>.", rótulo "O que foi feito", texto "Opcional. Você pode concluir sem escrever nada.", botões "Cancelar" e "Concluir".
    - Janela concluir-sem-texto: Concluir com a caixa vazia chama onConfirmar("") uma vez e fecha (onOpenChange(false)).
    - Janela concluir-com-texto: digitar "Pedido fechado" e Concluir chama onConfirmar("Pedido fechado").
    - Janela prefill (P-03): item com oQueFoiFeito "Já anotado" abre com a caixa com esse texto.
    - Janela cancelar: não chama onConfirmar e fecha.
    - Janela falha: onConfirmar devolve false -> alerta "Não foi possível salvar. Tente novamente.", continua aberta e o texto digitado continua na caixa.
    - Janela salvando: enquanto onConfirmar não responde, o botão mostra "Concluindo..." e os dois botões ficam desabilitados.
    - Cartão mostra-os-textos: com os dois textos, aparecem "Motivo da visita:" e "O que foi feito:" com os textos, em elementos com data-slot agenda2-o-que-fazer / agenda2-o-que-foi-feito e classe line-clamp-3.
    - Cartão sem-texto-sem-linha: com os dois null, nenhum elemento com esses data-slot e nenhum texto "Motivo da visita"/"O que foi feito".
    - Cartão supervisor-ve-textos: podeAlterar false mostra os textos e nenhum botão.
    - Lista concluir-recarrega (atualizado): Concluir no cartão abre a janela; Concluir na janela chama concluirAgenda2Item(id, "") uma vez e recarrega.
    - Lista concluir-com-resultado: digitar na janela e confirmar chama concluirAgenda2Item(id, "Pedido fechado").
    - Lista concluir-cancelar: Cancelar na janela não chama a ação.
    - Lista falha-acao (atualizado): ação com erro mostra o alerta genérico dentro da janela.
    - Calendário concluir-fecha-dialogo-desmarcar-fica (substitui concluir-no-dialogo, P-04): no diálogo do dia, Desmarcar chama onDesmarcar(feito) e o diálogo continua aberto; depois Concluir chama onConcluir(item12) e o diálogo do dia fecha.
    - Integração concluir-no-calendario-recarrega (atualizado): Concluir no diálogo do dia abre "Concluir visita"; Concluir nela chama a ação uma vez com (id que começa com "item-", "") e relê Lista e período.
  </behavior>
  <action>
1. RED — criar tests/agenda2/agenda2-concluir-dialog.test.tsx (jsdom) no molde de agenda2-apagar-dialog.test.tsx, com os casos de janela do behavior. Em agenda2-item-form.test.tsx: atualizar DE PROPÓSITO as 4 expectativas exatas de criar (acrescentar oQueFazer: null) e as 2 de editar (acrescentar oQueFazer: null e oQueFoiFeito: null; a lista de Object.keys passa a ter as 5 chaves na ordem do behavior), e escrever os casos de formulário do behavior. Em agenda2-item-row.test.tsx os 3 casos de cartão. Em agenda2-list.test.tsx atualizar concluir-recarrega e falha-acao (usar within do diálogo "Concluir visita" para achar o segundo botão Concluir e o alerta) e escrever concluir-com-resultado e concluir-cancelar. Em agenda2-calendario.test.tsx trocar concluir-no-dialogo pelo caso concluir-fecha-dialogo-desmarcar-fica (Desmarcar ANTES de Concluir, porque Concluir fecha o diálogo). Em agenda2-calendario-integracao.test.tsx atualizar concluir-no-calendario-recarrega. Rodar e confirmar que FALHAM. Commit: `test(quick-261006-ncy): add failing tests for agenda text fields, concluir dialog and card`.
2. GREEN — components/agenda2/Agenda2ConcluirDialog.tsx NOVO (per D-02/D-09, P-03/P-08), "use client", mesma estrutura de Agenda2ApagarDialog: props open, onOpenChange, item (Agenda2Item ou null), onConfirmar(resultado: string) => Promise<boolean>; corpo remontado por key `${open}-${item?.id ?? "none"}`; estado local texto (começa com item.oQueFoiFeito ou vazio), salvando e erro; DialogTitle "Concluir visita"; linha "Visita de {nomeCliente} em {dd/MM}." (format + parseISO, nunca o construtor cru de data); Label "O que foi feito" ligado por htmlFor a um Textarea (rows 3, maxLength AGENDA2_TEXTO_VISITA_MAX); texto pequeno "Opcional. Você pode concluir sem escrever nada."; erro em role="alert" com "Não foi possível salvar. Tente novamente."; DialogFooter com Cancelar (ghost, fecha sem chamar) e Concluir (padrão; "Concluindo..." enquanto salva; os dois desabilitados enquanto salva); Concluir manda o texto CRU da caixa (a ação apara e transforma vazio em null); true fecha, false mostra o erro e mantém a caixa. JSDoc: não chama ação, quem chama é a Agenda2List; nenhuma dica sobre números ou dados pessoais por decisão do dono (D-04).
3. GREEN — components/agenda2/Agenda2ItemForm.tsx (per D-01/D-02/D-04, P-07): importar Textarea e AGENDA2_TEXTO_VISITA_MAX; defaultValues de criar ganham oQueFazer ""; de editar ganham oQueFazer e oQueFoiFeito com o valor do item (ou ""); depois do bloco Repetir, campo "Motivo da visita" (os dois modos) e, só em editar, campo "O que foi feito" — FormItem/FormLabel com o rótulo EXATO, FormControl com Textarea (rows 3, maxLength do limite, autoComplete off, value com fallback para "" e os demais props do field), FormMessage, e NENHUM FormDescription nesses dois campos; payload de criar = nome, bairro, data, repetirSemanas (ou 0) e oQueFazer (ou null); payload de editar = nomeCliente, bairro, data, oQueFazer (ou null), oQueFoiFeito (ou null), nesta ordem; o aviso de duplicado continua comparando só nome/bairro/data; DialogContent ganha max-h-[90dvh] e overflow-y-auto; se o tsc reclamar do resolver, passar ao useForm os três genéricos (entrada, contexto, saída do schema); atualizar o JSDoc (os dois textos, plano copiado pelo servidor para todas as visitas repetidas, resultado só no editar e na janela de Concluir, sem dica nova por decisão do dono).
4. GREEN — components/agenda2/Agenda2ItemRow.tsx (per D-09, P-06): depois do nome do responsável e antes dos botões, dois parágrafos condicionais (só quando o texto existe — nunca elemento vazio): data-slot "agenda2-o-que-fazer" com "Motivo da visita:" em destaque leve seguido do texto, e data-slot "agenda2-o-que-foi-feito" com "O que foi feito:" seguido do texto; classes text-sm text-muted-foreground line-clamp-3 whitespace-pre-line break-words; mostrado também quando podeAlterar é false (Supervisor lê). Texto sempre renderizado como texto React (nunca HTML cru). Atualizar o JSDoc.
5. GREEN — components/agenda2/Agenda2List.tsx (per D-02/D-09): trocar handleConcluir por: estados concluirItem e concluirAberto; handleAbrirConcluir(item) abre a janela; handleConfirmarConcluir(resultado): Promise<boolean> marca salvandoId, chama concluirAgenda2Item(item.id, resultado), erro -> false, sucesso -> handleRecarregar e true, exceção -> false, finally limpa salvandoId; o cartão da Lista e o Agenda2Calendario passam a usar handleAbrirConcluir; renderizar Agenda2ConcluirDialog dentro do mesmo bloco que só existe para quem não é Supervisor; Desmarcar continua direto. components/agenda2/Agenda2Calendario.tsx (P-04): novo handleConcluirDoDialogo(item) que fecha o diálogo do dia e chama onConcluir(item), usado SÓ no Agenda2CalendarioDia do diálogo do dia (a visão Dia continua repassando onConcluir); atualizar o comentário "Editar/Apagar PRIMEIRO fecham..." para incluir Concluir e dizer que Desmarcar age ali mesmo. Agenda2CalendarioDia, Semana e Mês NÃO mudam. Rodar o verify até ficar verde. Commit: `feat(quick-261006-ncy): agenda text fields in form, concluir dialog and card`.
Não tocar em nada da Agenda antiga nem no Manual.
  </action>
  <verify>
    <automated>npx vitest run tests/agenda2/agenda2-concluir-dialog.test.tsx tests/agenda2/agenda2-item-form.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-list.test.tsx tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx tests/agenda2/agenda2-calendario-dia.test.tsx tests/agenda2/agenda2-calendario-mes.test.tsx tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario-toolbar.test.tsx tests/agenda2/agenda2-apagar-dialog.test.tsx tests/agenda2/agenda2-actions.test.ts tests/agenda2/validacao-agenda2.test.ts tests/agenda2/itens.test.ts tests/agenda2/app-layout-contagem.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx && npx tsc --noEmit && npx eslint --max-warnings 0 components/agenda2/Agenda2ItemForm.tsx components/agenda2/Agenda2ConcluirDialog.tsx components/agenda2/Agenda2ItemRow.tsx components/agenda2/Agenda2List.tsx components/agenda2/Agenda2Calendario.tsx tests/agenda2/agenda2-concluir-dialog.test.tsx tests/agenda2/agenda2-item-form.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-list.test.tsx tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada e agora tudo verde, inclusive Dia/Semana/Mês, toolbar e apagar sem nenhuma edição nesta tarefa.
    - Rótulos exatos "Motivo da visita" e "O que foi feito"; nenhuma dica ou aviso novo sobre números ou dados pessoais; a dica antiga do nome continua igual.
    - Todo Concluir (Lista, visão Dia, diálogo do dia) passa pela janela "Concluir visita"; concluir sem texto funciona; Desmarcar continua direto e não apaga texto.
    - Cartão sem linha vazia quando não há texto; Supervisor vê os textos e nenhum botão novo; chips de Semana/Mês intocados.
    - tsc e eslint --max-warnings 0 limpos nos 11 arquivos.
  </acceptance_criteria>
  <done>O vendedor anota o plano ao criar, o resultado ao concluir (ou depois, no editar), e vê os dois no cartão — tudo provado por testes de tela.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Tarefa 4: Aprovação do dono — o que muda, alerta de LGPD, ordem segura (banco PRIMEIRO) e como voltar atrás</name>
  <read_first>
    - supabase/migrations/0051_agenda2_observacoes.sql (o que será aplicado)
    - supabase/rollbacks/0051_volta_agenda2_observacoes.sql (o desfazer)
    - Seção "Pesquisa registrada" deste plano
  </read_first>
  <action>Pausar a execução. Apresentar ao dono do projeto, em linguagem simples (ele não programa — CLAUDE.md), o texto dos blocos decision/context abaixo e só seguir depois de uma resposta explícita (per D-08/D-12). Não enviar arquivo para aplicação, não rodar supabase db push, não colar SQL em lugar nenhum antes disso. Ao devolver este checkpoint ao orquestrador com a resposta "aplicar", dizer EXPLICITAMENTE que NADA deve ir para a branch staging nem para master antes de o dono aplicar a 0051 na Tarefa 5 — aqui a ordem é a INVERSA da quick 261006-gvo (lá a tela foi antes; aqui a tela nova quebra a Agenda se for antes). Se o dono escolher "ajustar" com mudança só de texto de tela (rótulo, texto de apoio): tratar nos arquivos da Tarefa 3, rodar o verify da Tarefa 3, registrar no SUMMARY e reapresentar. Se o ajuste mexer em decisão travada (por exemplo, voltar a bloquear números, mudar o limite, criar aviso, mudar quem lê): registrar e devolver ao orquestrador para replanejar, sem implementar. A 0051 ainda NÃO está aplicada, então qualquer correção dela, se o orquestrador autorizar, é feita editando a própria 0051 junto com os testes estrutural e ao vivo.</action>
  <decision>Aplicar agora, no banco do sistema, a mudança 0051 que cria os campos "Motivo da visita" e "O que foi feito" nas visitas da Agenda?</decision>
  <context>
    **Leia primeiro: a mudança no banco vale na hora, para o banco do time inteiro.** O site de teste e o site que a equipe usa guardam os dados no MESMO banco. Mas, desta vez, aplicar o banco ANTES é o caminho seguro (explicado abaixo).

    **O que muda para o time (depois que a tela nova for publicada):**
    - Ao adicionar uma visita aparece o campo "Motivo da visita" (opcional).
    - Ao clicar em "Concluir" abre uma janelinha com o campo "O que foi feito" (opcional) e os botões "Concluir" e "Cancelar". Dá para concluir sem escrever nada.
    - Ao editar uma visita aparecem os dois campos, já com o que estiver escrito.
    - Visita repetida (4, 8 ou 12 semanas): o "Motivo da visita" vai igual para todas; o "O que foi feito" começa vazio em cada uma.
    - "Desmarcar" não apaga nada do que foi escrito.
    - O cartão da visita mostra os textos quando existem (no máximo 3 linhas). Semana e Mês continuam iguais.
    - O vendedor vê só os textos das visitas dele. O Supervisor lê os textos de todos, mas não altera nada. Ninguém mais vê.
    - Limite de 500 letras em cada campo. Os textos não entram em nenhuma exportação.

    **Alerta de conformidade (LGPD) — leia com atenção:**
    - Campo de texto livre pode receber dados pessoais (por exemplo, nome ou telefone de alguém, ou comentários sobre uma pessoa). Isso vale para estes dois campos.
    - Os textos ficam guardados junto com a visita, dentro do prazo de 1 ano que você decidiu em 2026-10-01 — mas o descarte automático depois de 1 ano AINDA NÃO foi implementado (continua pendente, agora valendo também para estes textos).
    - Os textos não vão para nenhuma exportação.
    - Você decidiu NÃO bloquear números e NÃO mostrar aviso na tela nesses dois campos — essa decisão fica registrada no resumo da tarefa. (No nome do cliente e no bairro a trava de números continua igual.)
    - Proteções aplicadas automaticamente: campos opcionais, limite de 500 letras, leitura só pelo dono da visita e pelo Supervisor (que não altera), nenhum outro dado novo, nenhuma permissão especial nova no banco.
    - Recomendação: avalie o escopo à luz da LGPD e, se fizer sentido, oriente o time (fora do sistema) a anotar só o que é do trabalho — o que fazer e o que foi combinado. A decisão é sua, como responsável pelos dados.

    **Ordem segura que vamos seguir (diferente da última vez):**
    1. Você cola e roda a mudança no banco (próxima etapa). O site de hoje continua funcionando normalmente, porque ele não usa os campos novos (ficam vazios).
    2. Eu confiro com os testes automáticos contra o banco.
    3. Só então a tela nova vai para o site de teste (staging) para você conferir.
    4. Depois disso vai para o site real.
    Por que nessa ordem: a tela nova pede esses campos ao banco. Se ela fosse publicada antes do banco mudar, a Agenda pararia de carregar para todo o time.

    **Como voltar atrás, se precisar:** primeiro tirar a tela nova do ar (desfazer as mudanças desta tarefa e publicar), e SÓ DEPOIS colar o arquivo `supabase/rollbacks/0051_volta_agenda2_observacoes.sql` no SQL Editor. Atenção: voltar atrás APAGA todos os textos já escritos nesses campos, sem volta. Na ordem inversa a Agenda para de carregar.

    **Dados reais nos testes:** os testes automáticos rodam no mesmo banco dos dados reais. Eles criam vendedores e visitas temporários com nomes e textos inventados, apagam tudo no fim e nunca mostram dados reais.
  </context>
  <options>
    <option id="aplicar">
      <name>Aprovar e aplicar agora</name>
      <pros>O vendedor passa a anotar o plano e o resultado de cada visita sem tela nova nem campo obrigatório; o Supervisor acompanha lendo; a ordem escolhida não derruba nada; existe volta atrás pronta.</pros>
      <cons>Texto livre pode receber dados pessoais (você decidiu não bloquear números); o descarte automático de 1 ano ainda não existe; voltar atrás apaga os textos.</cons>
    </option>
    <option id="ajustar">
      <name>Ajustar antes de aplicar</name>
      <pros>Permite mudar textos da tela agora, ou rever uma decisão (limite, trava de números, aviso) antes de tocar o banco.</pros>
      <cons>Mudança de decisão volta para replanejamento e atrasa a entrega.</cons>
    </option>
  </options>
  <acceptance_criteria>
    - O dono respondeu "aplicar" (ou aprovação explícita equivalente) antes de qualquer envio de arquivo para aplicação, supabase db push ou execução no SQL Editor.
    - O SUMMARY registra a resposta e a ciência de: efeito imediato no banco único, o que muda para o time, os 4 pontos do alerta de LGPD (dados pessoais em texto livre, prazo de 1 ano sem descarte automático, sem exportação, decisão de não bloquear números), a ordem segura com o banco PRIMEIRO e como voltar atrás (tela antes, banco depois, textos apagados).
    - O orquestrador foi avisado de que nada vai para staging/master antes da Tarefa 5; nenhum push pelo executor.
    - Se o dono escolheu "ajustar", o caminho da action foi seguido antes de qualquer aplicação.
  </acceptance_criteria>
  <resume-signal>Responda "aplicar" para autorizar a 0051 no banco do sistema, ou "ajustar: ..." descrevendo o que mudar.</resume-signal>
  <done>Decisão explícita do dono registrada, com o alerta de LGPD, a ordem segura e a volta atrás reconhecidos, e o orquestrador ciente de que não publica nada antes da aplicação.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Tarefa 5: [BLOCKING] Dono aplica a 0051 pelo SQL Editor da Supabase (ANTES de qualquer publicação da tela nova)</name>
  <read_first>
    - .planning/phases/31-agenda-2-visitas-manuais-na-lista/31-03-SUMMARY.md (mesmo caminho manual da 0048, já usado com sucesso)
    - .planning/STATE.md, Blockers/Concerns (o push de schema pelo executor é bloqueado neste ambiente)
  </read_first>
  <action>Pré-condição da ordem segura (per D-08): rodar `git fetch origin` e conferir, com `git merge-base --is-ancestor <hash do commit feat da Tarefa 2> origin/staging` e o mesmo contra origin/master, que a mudança de código que LÊ as colunas novas ainda NÃO está publicada (os dois comandos devem devolver "não é ancestral"). Se estiver publicada em algum dos dois, avisar o orquestrador e o dono na hora, em linguagem simples, que a Agenda daquele site está sem carregar até a 0051 ser aplicada, e seguir com a aplicação (ela é a correção). Enviar ao dono o arquivo supabase/migrations/0051_agenda2_observacoes.sql pela ferramenta de envio de arquivo ao usuário (mesmo caminho das Fases 27-33 e da quick 261006-gvo); se a ferramenta não estiver disponível, informar o caminho absoluto do arquivo. NÃO enviar o arquivo de volta para aplicação. Não tentar supabase db push nem qualquer contorno do bloqueio do ambiente (nada de gerar credencial, extrair token ou chamar API de gerenciamento) — per D-08. Passar ao dono as instruções do bloco how-to-verify e aguardar a confirmação.</action>
  <what-built>Um arquivo de mudança no banco (0051), aprovado na Tarefa 4, pronto para colar no SQL Editor. A tela nova está só no computador (commits locais), sem afetar nenhum site.</what-built>
  <how-to-verify>
    1. Abrir o SQL Editor do projeto: https://supabase.com/dashboard/project/afbiwgbqkogsrhxjshkk/sql/new
    2. Colar o conteúdo COMPLETO de `0051_agenda2_observacoes.sql` (o comentário do topo pode ir junto, é seguro; se preferir, cole só as linhas de comando abaixo dele), clicar em "Run" e esperar "Success. No rows returned".
    3. Se aparecer qualquer erro, copiar a mensagem e mandar aqui antes de tentar de novo.
    4. NÃO colar o arquivo `0051_volta_agenda2_observacoes.sql` — ele só serve se um dia você quiser desfazer (e apaga os textos).
  </how-to-verify>
  <resume-signal>Responda "aplicado" depois de ver "Success", ou cole a mensagem de erro.</resume-signal>
  <acceptance_criteria>
    - A pré-condição foi conferida (commit feat da Tarefa 2 NÃO contido em origin/staging nem em origin/master) antes de enviar o arquivo, ou o aviso de site sem carregar foi dado; o executor não fez push.
    - O dono confirmou "Success" na 0051 (registrado no SUMMARY, com o caminho: SQL Editor, pelo dono); o arquivo de volta não foi aplicado.
    - Nenhuma tentativa de supabase db push ou contorno pelo executor.
    - O SUMMARY sugere ao dono, como passo opcional, `supabase migration repair --status applied 0051` (a 0051 é re-executável, então um push futuro não quebra mesmo sem o repair).
  </acceptance_criteria>
  <done>A 0051 está aplicada no banco, confirmada pelo dono, antes de qualquer publicação da tela nova.</done>
</task>

<task type="auto">
  <name>Tarefa 6: [BLOCKING] Testes ao vivo a VERDE contra o banco real + gate final + guarda de escopo</name>
  <files>tests/agenda2/rls-agenda2-observacoes.test.ts</files>
  <read_first>
    - tests/agenda2/rls-agenda2-observacoes.test.ts
    - supabase/migrations/0051_agenda2_observacoes.sql (aplicada)
    - .planning/STATE.md, Blockers/Concerns (limite de tentativas de login do Supabase Auth)
  </read_first>
  <action>
1. Rodar a guarda de escopo (primeiro comando do verify, base f7665964ef4c00995a60222699eb19ce8384d85b, per D-11) e depois `npx vitest run tests/agenda2/rls-agenda2-observacoes.test.ts` até ficar verde. Se um caso falhar por comportamento do banco (por exemplo, o Supervisor conseguir alterar, outro vendedor conseguir ler, ou 501 ser aceito), PARAR e reportar ao orquestrador: a correção vira migration NOVA (0052 em diante) com nova aprovação do dono pelo mesmo caminho das Tarefas 4-5 — nunca edição da 0051 aplicada nem do arquivo de volta, e nunca uma função nova com privilégio elevado. Se falhar por erro do próprio teste, corrigir o teste sem afrouxar nenhuma asserção de D-01/D-04/D-10 (nenhum caso pode passar a aceitar leitura ou alteração que a regra proíbe) e registrar. Se o limite de login impedir a rodada, esperar e repetir o arquivo isolado (convenção das Fases 13/18/19), registrando. Nunca imprimir linhas lidas durante o diagnóstico (dados reais, LGPD).
2. Rodar o verify completo (a pasta tests/agenda2 inteira inclui rls-agenda2.test.ts com o caso de 10 colunas e rls-agenda2-repeticao.test.ts; se o limite de login derrubar algum arquivo ao vivo na rodada da pasta, rodar esse arquivo isolado depois de esperar e registrar).
3. Registrar no SUMMARY, em português simples (D-12): (a) resposta do dono e tudo o que ele reconheceu na Tarefa 4; (b) pré-condição conferida (nada publicado antes) e aplicação pelo dono (Tarefa 5); (c) resultado dos testes ao vivo (7 casos novos + 20 do rls-agenda2 com as 10 colunas + repetição) e do gate (número de arquivos/testes, tsc, eslint, BUILD_EXIT); (d) o que mudou para o time, em linguagem de tela; (e) alerta de LGPD e a decisão registrada (texto livre pode receber dado pessoal; prazo de 1 ano sem descarte automático; sem exportação; dono decidiu não bloquear números nem avisar na tela; proteções invisíveis aplicadas; inventário de 11 intacto); (f) testes mudados DE PROPÓSITO e por quê (arquivo-unico, colunas-minimas, lgpd-colunas-minimas, payloads exatos de criar/editar, linhas do insert, concluir pela janela, concluir no diálogo do dia fecha o diálogo, construtores com dois nulos); (g) itens adiados: descarte automático de 1 ano (agora também dos textos), Manual do Vendedor (não tocado), passo opcional `supabase migration repair --status applied 0051`; (h) conferência humana do Preview da staging pendente (bloco human-check) e instrução ao orquestrador: AGORA (banco aplicado + gate verde) enviar os commits para staging, conferir o Preview, e só depois levar para master; (i) como voltar atrás: primeiro reverter os commits feat das Tarefas 2 e 3 e publicar; só depois colar supabase/rollbacks/0051_volta_agenda2_observacoes.sql (APAGA os textos; na ordem inversa a Agenda para de carregar).
Commit `test(quick-261006-ncy): ...` só se o teste ao vivo precisou de correção; caso contrário, nenhum commit de código nesta tarefa. Não fazer push.
  </action>
  <verify>
    <automated>node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString();const base='f7665964ef4c00995a60222699eb19ce8384d85b';console.log('BASE='+g(['rev-parse',base]).trim());const ok=new Set(['supabase/migrations/0051_agenda2_observacoes.sql','supabase/rollbacks/0051_volta_agenda2_observacoes.sql','tests/agenda2/migracao-agenda2-observacoes.test.ts','tests/agenda2/migracao-agenda2.test.ts','tests/agenda2/rls-agenda2.test.ts','tests/agenda2/rls-agenda2-observacoes.test.ts','lib/agenda2/itens.ts','lib/validations/agenda2.ts','lib/supabase/queries/agenda2.ts','app/actions/agenda2.ts','tests/agenda2/validacao-agenda2.test.ts','tests/agenda2/limites-sincronizados.test.ts','tests/agenda2/agenda2-query.test.ts','tests/agenda2/agenda2-periodo-query.test.ts','tests/agenda2/agenda2-actions.test.ts','tests/agenda2/itens.test.ts','tests/agenda2/agenda2-apagar-dialog.test.tsx','tests/agenda2/agenda2-calendario-dia.test.tsx','tests/agenda2/agenda2-calendario-mes.test.tsx','tests/agenda2/agenda2-calendario-semana.test.tsx','tests/agenda2/agenda2-calendario.test.tsx','tests/agenda2/agenda2-calendario-integracao.test.tsx','tests/agenda2/agenda2-list.test.tsx','tests/agenda2/agenda2-item-form.test.tsx','tests/agenda2/agenda2-item-row.test.tsx','components/agenda2/Agenda2ItemForm.tsx','components/agenda2/Agenda2ConcluirDialog.tsx','components/agenda2/Agenda2ItemRow.tsx','components/agenda2/Agenda2List.tsx','components/agenda2/Agenda2Calendario.tsx','tests/agenda2/agenda2-concluir-dialog.test.tsx']);const permitido=f=>f.startsWith('.planning/')||ok.has(f);const mudados=g(['diff','--name-only',base,'HEAD']).split('\n').map(s=>s.trim()).filter(Boolean);const sujos=g(['status','--porcelain']).split('\n').filter(Boolean).filter(l=>!l.startsWith('??')).map(l=>l.slice(3).trim());const fora=mudados.concat(sujos).filter(f=>!permitido(f));if(fora.length)throw new Error('fora do escopo: '+fora.join(', '));const mig=g(['diff','--name-status',base,'HEAD','--','supabase/migrations']).split('\n').map(s=>s.trim()).filter(Boolean);if(mig.length!==1||mig[0]!=='A\tsupabase/migrations/0051_agenda2_observacoes.sql')throw new Error('migrations: '+mig.join(' | '));console.log('OK escopo 261006-ncy')" && npx vitest run tests/agenda2 tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 lib/agenda2/itens.ts lib/validations/agenda2.ts lib/supabase/queries/agenda2.ts app/actions/agenda2.ts components/agenda2/Agenda2ItemForm.tsx components/agenda2/Agenda2ConcluirDialog.tsx components/agenda2/Agenda2ItemRow.tsx components/agenda2/Agenda2List.tsx components/agenda2/Agenda2Calendario.tsx tests/agenda2/migracao-agenda2-observacoes.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/rls-agenda2.test.ts tests/agenda2/rls-agenda2-observacoes.test.ts tests/agenda2/validacao-agenda2.test.ts tests/agenda2/limites-sincronizados.test.ts tests/agenda2/agenda2-query.test.ts tests/agenda2/agenda2-periodo-query.test.ts tests/agenda2/agenda2-actions.test.ts tests/agenda2/itens.test.ts tests/agenda2/agenda2-apagar-dialog.test.tsx tests/agenda2/agenda2-calendario-dia.test.tsx tests/agenda2/agenda2-calendario-mes.test.tsx tests/agenda2/agenda2-calendario-semana.test.tsx tests/agenda2/agenda2-calendario.test.tsx tests/agenda2/agenda2-calendario-integracao.test.tsx tests/agenda2/agenda2-list.test.tsx tests/agenda2/agenda2-item-form.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-concluir-dialog.test.tsx && (npm run build; code=$?; echo "BUILD_EXIT=$code"; exit $code)</automated>
    <human-check>
      <test>Depois que o orquestrador enviar os commits para a branch staging, abrir o link de Preview da staging na Vercel (projeto RAIAR; exige login na Vercel) e entrar como um vendedor: (1) Adicionar visita com nome inventado (ex.: "Teste Campos Preview"), preencher "Motivo da visita" e escolher repetir 4 semanas — as 4 visitas mostram o mesmo "Motivo da visita:" no cartão; (2) clicar em "Concluir" numa delas — abre "Concluir visita"; escrever algo em "O que foi feito" e concluir — o cartão mostra "O que foi feito:"; (3) concluir outra sem escrever nada — funciona; (4) Editar uma visita — aparecem os dois campos preenchidos; (5) Desmarcar — os textos continuam; (6) na Semana e no Mês, abrir um dia e clicar em Concluir — o diálogo do dia fecha e abre "Concluir visita". Depois entrar como Supervisor: os textos aparecem nos cartões, sem nenhum botão novo. No fim, apagar as visitas de teste.</test>
      <expected>Campos opcionais funcionando em criar, concluir e editar; plano copiado nas repetições; resultado só onde foi escrito; Desmarcar não apaga; Supervisor só lê; Semana/Mês iguais.</expected>
      <why_human>Conferência visual no site publicado de teste antes de levar para produção (CLAUDE.md, Fluxo de Deploy); os testes automáticos não abrem o Preview da Vercel.</why_human>
    </human-check>
  </verify>
  <acceptance_criteria>
    - tests/agenda2/rls-agenda2-observacoes.test.ts verde por inteiro (7 casos) contra o banco real; rls-agenda2.test.ts verde com a lista de 10 colunas; rls-agenda2-repeticao.test.ts verde.
    - Gate verde: pasta tests/agenda2 inteira + estruturais da 0049/0050; tsc; eslint --max-warnings 0 nos arquivos tocados; BUILD_EXIT=0 impresso.
    - Guarda de escopo OK desde f7665964ef4c00995a60222699eb19ce8384d85b: só os 31 arquivos planejados (mais .planning/); supabase/migrations com exatamente uma linha "A" (a 0051); Agenda antiga intocada.
    - Nenhuma asserção de D-01/D-04/D-10 afrouxada; qualquer correção de teste ou migration nova registrada no SUMMARY.
    - SUMMARY com os itens (a)-(i) da action; nenhum push pelo executor.
  </acceptance_criteria>
  <done>Os dois campos existem no banco e estão provados contra ele, a tela nova está pronta (commits locais) para ir ao staging, e o pacote inteiro está dentro do escopo combinado.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador (Vendedor/Supervisor) -> PostgREST/Postgres | Leitura e escrita de agenda2_itens (incluindo os dois textos) atravessam aqui; só a RLS da 0048 decide |
| formulário/janela (UI) -> Server Actions da Agenda | Texto livre de entrada não confiável; o servidor revalida (Zod) e monta cada linha só com campos conhecidos |
| executor/dono -> banco de produção | Mudança de schema com efeito imediato; só com aprovação explícita e aplicação pelo dono |
| commits locais -> branch staging -> branch master | Tela nova lê colunas novas: publicar antes da 0051 derruba a Agenda; Preview usa o mesmo banco da produção |
| dono (controlador) -> pessoas citadas nos textos e vendedores (titulares) | Texto livre pode registrar dado pessoal |
| suíte de testes -> banco de produção | Fixtures temporárias no projeto que guarda dados reais |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ncy-01 | Information Disclosure | outro vendedor ou visitante lendo os textos | high | mitigate | Policy de SELECT da 0048 (dono OU is_supervisor()) vale para as colunas novas; casos ao vivo outro-vendedor-nao-le-nem-altera-os-textos e anonimo-nao-le-os-textos |
| T-ncy-02 | Tampering | outro vendedor ou Supervisor alterando os textos | high | mitigate | Policy de UPDATE da 0048 (dono E vendedor ativo); casos ao vivo outro-vendedor e supervisor-le-os-textos-mas-nao-altera (0 linhas, nada muda) |
| T-ncy-03 | Information Disclosure (LGPD) | dado pessoal digitado em texto livre | medium | transfer | Decisão do dono como controlador (D-04/D-08): sem trava nem aviso de números, registrada no SUMMARY; alerta explícito na Tarefa 4 com os 4 pontos; proteções invisíveis aplicadas (opcional, 500, leitura só dono + Supervisor, sem exportação, nenhum outro dado novo) |
| T-ncy-04 | Information Disclosure (LGPD) | retenção dos textos além do prazo de 1 ano | medium | accept | Descarte automático já era pendência do dono desde 2026-10-01; continua fora deste escopo; reapresentado no checkpoint e registrado como item adiado |
| T-ncy-05 | Tampering | tela mandando o_que_foi_feito na criação ou campos extras | low | mitigate | criarAgenda2Item monta cada linha só com nome/bairro/data/o_que_fazer/vendedor_id da sessão; teste criar-dono-do-servidor e criar-repete-4 (chaves exatas) |
| T-ncy-06 | Denial of Service | texto enorme ou lote grande | low | mitigate | Constraint <= 500 após aparar no banco + Zod no servidor e na tela + maxLength; lote limitado a 12 linhas (Fase 32); teste ao vivo limite-500-depois-de-aparar e testes de ação de 501 |
| T-ncy-07 | Denial of Service | publicar a tela nova antes da 0051 (banco único) | high | mitigate | D-08: checkpoint de decisão avisa o orquestrador para não publicar; pré-condição na Tarefa 5 confere que o commit feat da Tarefa 2 não está em origin/staging nem origin/master; volta atrás com ordem inversa documentada (tela antes, banco depois) |
| T-ncy-08 | Elevation of Privilege | função nova com privilégio elevado ou edição de migration antiga | high | mitigate | Teste estrutural (sem rotina, sem policy, sem gatilho, sem grant, sem cláusula); inventário de 11 em migracao-agenda2 sem edição; guarda de escopo exige só a linha "A" da 0051 |
| T-ncy-09 | Tampering | aplicação em produção sem revisão | high | mitigate | Checkpoint bloqueante da Tarefa 4 antes de qualquer envio/aplicação; dono aplica pelo SQL Editor; executor nunca aplica, nunca faz push nem db push |
| T-ncy-10 | Information Disclosure (LGPD) | testes ao vivo no banco real | medium | mitigate | Fixtures descartáveis, nomes e textos inventados sem 8+ dígitos, 2 logins, conferências só por id de fixture, nada impresso, limpeza antes de apagar os membros |
| T-ncy-11 | Tampering | texto livre renderizado como HTML (injeção na tela) | low | mitigate | Textos sempre renderizados como texto React no cartão e na janela, nunca HTML cru |
| T-ncy-12 | Repudiation | voltar atrás apaga os textos | low | accept | Documentado no arquivo de volta, no checkpoint e no SUMMARY; arquivo de volta nunca aplicado automaticamente |
</threat_model>

<source_audit>
SOURCE  | ID   | Item | Tarefa | Status
------- | ---- | ---- | ------ | ------
GOAL    | —    | Dois campos opcionais "Motivo da visita" e "O que foi feito" em cada visita da Agenda | 1, 2, 3, 6 | COVERED
REQ     | QUICK-261006-ncy | Pedido do dono | 1-6 | COVERED
CONTEXT | D-01 | Opcionais, 500 após aparar (banco + Zod), vazio vira NULL | 1 (constraint), 2 (schema/ação), 3 (tela) | COVERED
CONTEXT | D-02 | Onde preencher: criar, editar (os dois), janela de Concluir; Desmarcar mantém | 2 (ações), 3 (form, janela, lista, calendário) | COVERED
CONTEXT | D-03 | Repetição copia o plano; resultado vazio; linhas independentes | 2 (criarAgenda2Item + teste do lote) | COVERED
CONTEXT | D-04 | Sem trava/aviso de números; proteções invisíveis; 11 funções | 1 (sem-trava-de-numeros, inventário), 2 (schema aceita dígitos), 3 (sem dica), 4 (alerta) | COVERED
CONTEXT | D-05 | Migration nova 0051, ASCII em bloco, sem cláusula literal | 1 | COVERED
CONTEXT | D-06 | Arquivo de volta NAO APLICAR, avisa que apaga os textos | 1 | COVERED
CONTEXT | D-07 | arquivo-unico atualizado de propósito | 1 | COVERED
CONTEXT | D-08 | Banco antes de publicar; checkpoints decisão + ação humana; alerta LGPD com 4 pontos | 4, 5, 6 | COVERED
CONTEXT | D-09 | Tipo, consultas, schemas, ações, componentes, janela em todo Concluir, cartão, chips intactos, Supervisor só lê, Agenda antiga intocada | 2, 3, 6 (guarda) | COVERED
CONTEXT | D-10 | Testes 8->10 colunas, limites, estrutural, ao vivo, tela/ação/form/janela/cartão | 1, 2, 3, 6 | COVERED
CONTEXT | D-11 | Gate final + guarda de escopo + sem push | 6 | COVERED
CONTEXT | D-12 | Português simples no SUMMARY e checkpoints | 4, 5, 6 | COVERED
</source_audit>

<verification>
- Tarefa 1: estrutural vermelho -> verde; migracao-agenda2 com 10 colunas e arquivo-unico (0048 + 0051), inventário de 11 intacto; uma migration nova; ao vivo escrito e não executado.
- Tarefa 2: schema/consultas/ações vermelho -> verde; testes antigos de editar/concluir/desmarcar sem edição; tela ainda igual e verde.
- Tarefa 3: formulário, janela, cartão, lista e calendário vermelho -> verde; Dia/Semana/Mês/apagar sem edição.
- Tarefa 4: aprovação explícita com LGPD (4 pontos), ordem com banco primeiro e volta atrás reconhecidos; orquestrador avisado para não publicar.
- Tarefa 5: nada publicado conferido; dono aplica a 0051 no SQL Editor com "Success"; volta atrás não aplicada.
- Tarefa 6: 7 casos ao vivo + 10 colunas verdes; gate (tests/agenda2, tsc, eslint --max-warnings 0, BUILD_EXIT=0) verde; guarda de escopo OK; Preview pendente para depois do envio à staging.
</verification>

<success_criteria>
- O Vendedor anota "Motivo da visita" ao criar (copiado em todas as repetições), "O que foi feito" ao concluir (opcional) ou ao editar; Desmarcar não apaga; o cartão mostra os textos sem linha vazia; o Supervisor só lê.
- Limite de 500 no banco e na tela; nenhuma trava ou aviso de números nesses campos, por decisão registrada do dono.
- Exatamente uma migration nova; nenhuma função nova com privilégio elevado; nenhuma migration antiga editada; Agenda antiga intocada; volta atrás pronta e com a ordem certa documentada.
- O dono aprovou e aplicou a 0051 ANTES de qualquer publicação; testes ao vivo verdes depois disso.
</success_criteria>

<output>
Criar `.planning/quick/261006-ncy-agenda-campos-o-que-vou-fazer-e-o-que-fo/261006-ncy-SUMMARY.md` com os itens (a)-(i) da Tarefa 6, os hashes dos commits, o BASE impresso pela guarda e as notas para o dono em linguagem simples.
Não fazer push. Ordem para o orquestrador: NADA vai para staging antes de o dono aplicar a 0051 (Tarefa 5) e o gate da Tarefa 6 ficar verde; depois disso, staging -> conferência do Preview -> master (CLAUDE.md, "Fluxo de Deploy").
</output>
