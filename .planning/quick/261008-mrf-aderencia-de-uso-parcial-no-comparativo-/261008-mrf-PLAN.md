---
phase: quick-261008-mrf
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [QUICK-261008-mrf]
files_modified:
  - supabase/migrations/0052_aderencia_uso_parcial.sql
  - supabase/rollbacks/0052_volta_aderencia_uso.sql
  - tests/dashboard/aderencia-parcial-migracao.test.ts
  - tests/dashboard/aderencia-parcial.test.ts
  - tests/dashboard/aderencia-uso.test.ts
  - lib/aderencia/exibicao.ts
  - lib/supabase/queries/dashboard.ts
  - tests/dashboard/aderencia-exibicao.test.ts
  - tests/dashboard/comparativo-vendedor-table.test.tsx

must_haves:
  truths:
    - "D-01/D-03: no Dashboard do Supervisor (Comparativo por vendedor, coluna Aderência de uso), enquanto a medição tem menos de 28 dias, cada vendedor com pelo menos um dia útil contado aparece como 'NN,N% (parcial)' e, embaixo, 'N de M dias úteis desde DD/MM' (singular 'dia útil' quando M é 1)."
    - "D-01: a conta parcial usa só dias úteis (segunda a sexta) a partir do maior entre o início da medição, a entrada e a reativação do vendedor (regras da 0040); dia anterior ao início da medição nunca entra no denominador nem no numerador; quem usou o sistema em todo dia útil desde o início aparece com 100,0% (parcial) — provado ao vivo."
    - "D-03: vendedor sem nenhum dia útil contado (denominador zero) continua com 'Coletando dados desde DD/MM/AAAA', e sem linha de aderência continua o travessão, exatamente como hoje."
    - "D-02: quando a janela de 28 dias completa (por volta de 25/10/2026) os quatro números de cada vendedor são idênticos aos da 0040 e o '(parcial)' some sozinho — provado ESTRUTURALMENTE (corpo da 0052 = corpo da 0040 + exatamente 3 trocas; com inicio_medicao <= inicio_janela o corte novo do calendário nunca remove dia nenhum e o coletando_desde cai nos mesmos ramos da 0040), sem teste ao vivo gravando dia anterior ao início real da medição."
    - "P-09: nenhum teste ao vivo desta quick task grava acesso com data anterior ao início real da medição (28/09/2026); o arquivo novo lê o menor dia de acessos_diarios antes e depois da semeadura e no fim, e exige que seja sempre o mesmo (caso medicao-intocada); o dono confere com uma leitura só de consulta que o menor dia continua 2026-09-28."
    - "D-04/P-03: entre o dono aplicar a 0052 e a tela nova ser publicada, a tela atual em produção continua mostrando só 'Coletando dados desde ...' — nada quebra e nenhum percentual injusto aparece."
    - "D-03/D-04/P-11: quem vê o quê não muda (Supervisor vê todos; Vendedor e visitante sem login recebem zero linhas, como na 0040); as outras colunas da tabela não mudam."
    - "D-04/D-07/D-08: exatamente UMA migration nova (0052) desde b67aed6aff0ca1b9b6fc6c2744b506f21360e333, mesma assinatura, sem cláusula de elevação de privilégio nem grant/revoke, inventário de 11 funções elevadas intacto, volta atrás em supabase/rollbacks com NAO APLICAR; o dono aprovou e aplicou a 0052 ANTES de qualquer publicação da tela nova."
  artifacts:
    - path: supabase/migrations/0052_aderencia_uso_parcial.sql
      provides: "dashboard_aderencia_uso() recriada com a mesma assinatura: durante a coleta conta só dias úteis desde o início da medição; janela cheia igual à 0040"
      contains: "and (pm.inicio_janela + g.n) >= md.inicio_medicao"
    - path: supabase/rollbacks/0052_volta_aderencia_uso.sql
      provides: "Volta atrás que restaura a conta da 0040, fora de supabase/migrations, cabeçalho NAO APLICAR"
      contains: "NAO APLICAR"
    - path: tests/dashboard/aderencia-parcial-migracao.test.ts
      provides: "Teste estrutural (fs) da 0052 e do arquivo de volta: assinatura igual, corpo = 0040 + 3 trocas, sem elevação, comentários seguros, volta atrás = 0040"
      contains: "corpo-0040-com-tres-trocas"
    - path: tests/dashboard/aderencia-parcial.test.ts
      provides: "Testes ao vivo da regra parcial (modelo de referência), VERMELHOS até o dono aplicar a 0052 enquanto a medição tiver menos de 28 dias; nunca grava acesso antes do início real da medição"
      contains: "medicao-intocada"
    - path: lib/aderencia/exibicao.ts
      provides: "rotuloAderencia com o caso parcial e TEXTO_TOOLTIP_ADERENCIA explicando o parcial"
      contains: "(parcial)"
  key_links:
    - from: "lib/aderencia/exibicao.ts rotuloAderencia"
      to: "colunas coletando_desde, aderencia_pct e dias_uteis da 0052"
      via: "parcial = coletandoDesde preenchido E aderenciaPct não nulo E diasUteis > 0; denominador zero continua no aviso"
      pattern: "\\(parcial\\)"
    - from: "components/dashboard/ComparativoVendedorTable.tsx (NÃO muda)"
      to: "rotuloAderencia() e TEXTO_TOOLTIP_ADERENCIA"
      via: "a célula já mostra principal + detalhe quando coletando é falso; o tooltip já lê a constante"
      pattern: "rotuloAderencia\\("
    - from: "0052 calendario_util"
      to: "medicao.inicio_medicao"
      via: "corte do calendário de dias úteis no início da medição (no-op quando a janela está cheia)"
      pattern: ">= md.inicio_medicao"
    - from: "0052 vendedores"
      to: "is_supervisor()"
      via: "filtro copiado sem mudança da 0040 — Vendedor e visitante recebem zero linhas"
      pattern: "\\(select is_supervisor\\(\\)\\)"
    - from: "tests/dashboard/aderencia-parcial-migracao.test.ts"
      to: "supabase/migrations/0040_dashboard_aderencia_uso.sql"
      via: "corpo da 0040 sem comentários + 3 trocas == corpo da 0052; bloco da volta atrás == bloco da 0040 sem comentários"
      pattern: "corpo-0040-com-tres-trocas"
---

<objective>
Pedido do dono (2026-10-08), para a reunião de 13/10/2026: na tabela "Comparativo por vendedor" do Dashboard (só o Supervisor vê), a coluna "Aderência de uso" deixa de mostrar só "Coletando dados desde 28/09/2026" e passa a mostrar um percentual PARCIAL justo, por exemplo "90,0% (parcial)" com "9 de 10 dias úteis desde 28/09" embaixo.

Explicando sem jargão: (1) a conta é feita no banco; hoje, enquanto o sistema ainda não tem 28 dias de registro, a conta divide pelos 20 dias úteis da janela inteira — inclusive dias em que nada era medido — e por isso o número cru é injusto e fica escondido; (2) a mudança 0052 faz a conta dividir só pelos dias úteis desde o início da medição (ou desde a entrada do vendedor, se ele entrou depois), e o PRÓPRIO dono cola essa mudança no SQL Editor depois de aprovar; (3) a tela passa a mostrar esse número com "(parcial)"; (4) por volta de 25/10/2026, quando completar 28 dias, a conta volta a ser exatamente a de hoje e o "(parcial)" some sozinho. O banco muda ANTES da tela (a tela nova contra o banco antigo mostraria o número injusto como "parcial").

Decisões do dono, numeradas para rastreio:
- D-01: Regra parcial — enquanto inicio_medicao > inicio_janela, o percentual usa só dias úteis (segunda a sexta) a partir do maior entre início da medição, admissão e reativação (regras de admissão/desativação/reativação da 0040 mantidas), NUNCA contando dias antes do início da medição. Numerador inalterado (dias úteis ativos com uso: acessos_diarios + historico dos 4 tipos). O percentual cru de hoje (denominador de 20) NÃO pode ser simplesmente liberado na tela.
- D-02: Quando a janela de 28 dias fecha (hoje >= inicio_medicao + 27, por volta de 25/10/2026), o resultado é IDÊNTICO ao cálculo da 0040 e o "(parcial)" desaparece sozinho.
- D-03: Tela — célula "90,0% (parcial)" e embaixo "9 de 10 dias úteis desde 28/09" (singular "dia útil" quando 1); denominador zero mantém o aviso "Coletando dados desde DD/MM/AAAA" ou o travessão, como hoje; texto do tooltip ajustado explicando o parcial. Não muda quem vê o quê nem as outras colunas. Rótulos em português.
- D-04: Banco — migration NOVA 0052 (nunca editar migration antiga) recriando dashboard_aderencia_uso() com a MESMA assinatura, compatível com o código atual de produção (staging e produção usam UM banco só; banco primeiro). Comentários ASCII dentro de um bloco barra-asterisco (comentário de dois hífens quebra a colagem no SQL Editor). Mesmas cláusulas de segurança/permissão da 0040 (nenhuma: roda como quem chama, sem grant/revoke); nenhuma função nova com privilégio elevado; teste de inventário intacto. Arquivo de volta em supabase/rollbacks (não aplicado automaticamente, cabeçalho NAO APLICAR) restaurando a definição da 0040.
- D-05: Código — lib/aderencia/exibicao.ts (rotuloAderencia e tooltip); lib/supabase/queries/dashboard.ts e components/dashboard/ComparativoVendedorTable.tsx só se necessário.
- D-06: Testes — atualizar DE PROPÓSITO os que afirmam "coletando = só aviso"; testes estruturais novos da 0052; testes ao vivo (no máximo 2 logins, nomes inventados, nunca imprimir dado real) que ficam VERMELHOS até o dono aplicar, incluindo: vendedor com uso em todo dia útil desde o início = 100,0% parcial; denominador zero mantém o aviso; janela cheia = valor idêntico à 0040. NÃO rodar a suíte legada inteira (~49 arquivos vermelhos pré-existentes por contas semente apagadas); só os arquivos afetados. Revisão do checador (2026-10-08, decisão do orquestrador): o item "janela cheia = 0040" é provado ESTRUTURALMENTE (teste corpo-0040-com-tres-trocas + o raciocínio do "Contrato SQL"), NÃO ao vivo — prová-lo ao vivo exigiria gravar um acesso antes do início real da medição no banco de produção, o que mudaria o início da medição do time inteiro se a limpeza falhasse. Testes ao vivo nunca gravam linha em acessos_diarios com data anterior ao menor dia real.
- D-07: Gate final — testes de aderência/dashboard afetados, tsc, eslint --max-warnings 0 nos arquivos tocados, npm run build com o código de saída conferido, guarda de escopo (exatamente 1 migration nova; Agenda e o resto intocados). Commit só local; NENHUM push (o orquestrador publica depois da migration aplicada e do gate verde).
- D-08: O agente NUNCA aplica SQL nem usa db push. Checkpoints do dono (decisão + ação humana) em português simples, como nas quick 261006-gvo e 261006-ncy, com alerta de LGPD: aderência é métrica de uso do sistema POR PESSOA (dado de trabalhador); nenhum dado novo é coletado; recomendar apresentar como "uso do CRM nas primeiras semanas", não como avaliação de desempenho individual. Prazo: pronto para o dono aplicar antes de 13/10/2026.
- D-09: Todo commit do executor termina com a linha "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>". Nunca adicionar .planning/config.json a um commit (está modificado no disco e não faz parte desta tarefa).

Escolhas do planejador (discricionárias, documentadas):
- P-01: MESMA assinatura, sem coluna nova. O "parcial" é deduzido na tela: coletandoDesde preenchido E aderenciaPct não nulo E diasUteis > 0. Alternativa rejeitada: uma coluna nova (ex.: um indicador de parcial) mudaria o tipo de retorno, o que obriga remover e recriar a função (foge da preferência "mesma assinatura" e abre um instante sem a função). A ordem banco-primeiro já é o procedimento estabelecido (261006-ncy) e cobre o único risco que a coluna nova evitaria (ver P-04).
- P-02: Semântica das colunas na 0052. dias_uteis, dias_usados e aderencia_pct: durante a coleta, PARCIAIS (só dias úteis desde o início da medição ou entrada/reativação); com a janela cheia, iguais à 0040. coletando_desde: continua preenchido durante TODA a coleta, como na 0040; com denominador > 0 durante a coleta passa a ser o PRIMEIRO dia útil contado daquele vendedor (para quase todos = 28/09, igual ao valor de hoje; para quem entrou ou foi reativado depois, a data dele) — é o "desde" da tela nova; com denominador zero, exatamente o valor da 0040; com a janela cheia, igual à 0040 (nulo, ou entrada/reativação quando o denominador é zero).
- P-03: O que a tela ANTIGA (produção) faz com a 0052, entre aplicar e publicar: a regra dela é "coletandoDesde preenchido = só o aviso". Como o coletando_desde continua preenchido em toda a coleta, ela segue mostrando "Coletando dados desde ..." em todas as linhas; a única diferença visível é a data de quem entrou depois de 28/09 (passa a ser a data de entrada dele). Nada quebra, nenhum percentual aparece. Segura.
- P-04: O que a tela NOVA faria com a 0040 (ordem errada): mostraria o percentual cru injusto (denominador de 20) marcado "(parcial)" — exatamente o que o dono proibiu. Por isso: banco PRIMEIRO; pré-condição conferida na Tarefa 4 (o commit da tela não pode estar em origin/staging nem origin/master); volta atrás na ordem inversa (tela antes, banco depois). Depois de ~25/10 a ordem deixa de importar (as duas contas dão o mesmo número).
- P-05: Corpo da 0052 = código da 0040 SEM as linhas de comentário de dois hífens + exatamente 3 trocas (calendário corta antes do início da medição; agregado guarda o primeiro dia contado; regra do coletando_desde). Toda explicação vai no bloco de comentário do topo; o corpo não tem comentário nenhum. Um teste estrutural aplica as 3 trocas no corpo da 0040 e exige igualdade com o corpo da 0052 — prova de que autorização, eventos, fuso, os 4 tipos, autor não nulo e a fórmula do percentual não mudaram.
- P-06: RotuloAderencia mantém o formato { principal, detalhe, coletando }. Parcial: coletando falso, principal "NN,N% (parcial)", detalhe "N de M dias úteis desde dd/MM" (data do coletandoDesde com parseISO + format "dd/MM"). components/dashboard/ComparativoVendedorTable.tsx NÃO muda: o tooltip vem da constante e a célula já mostra principal + detalhe quando coletando é falso.
- P-07: Texto EXATO do novo TEXTO_TOOLTIP_ADERENCIA: "Dias úteis (segunda a sexta) com uso do sistema nos últimos 28 dias — entrar no sistema, mover etapa, concluir tarefa ou visita, ou cadastrar ou editar cliente. Enquanto a medição ainda não tem 28 dias, o número aparece como (parcial) e conta só os dias úteis desde o início da medição — ou desde a entrada do vendedor no time, se for mais recente."
- P-08: lib/supabase/queries/dashboard.ts muda SÓ comentários (tipo AderenciaUsoRow e mapeamento iguais) para não ficar mentindo sobre o significado de coletandoDesde; os testes do leitor e da ação continuam sem edição.
- P-09: Teste ao vivo novo com modelo de referência em TypeScript (a regra da 0052 sem lacuna de desativação), 5 fixtures descartáveis, exatamente 2 logins (Supervisor e P1), um bloco só. Toda gravação em acessos_diarios passa por um helper que recusa (lança erro) qualquer dia anterior ao menor dia real lido antes de semear; o menor dia é relido depois da semeadura e no fim (caso medicao-intocada) e tem de ser o mesmo. Nenhum caso fecha a janela de propósito (a identidade com a 0040 é estrutural — D-06). O histórico datado antes da medição (caso antes-da-medicao-nao-conta) não mexe no início da medição, que só olha acessos_diarios, e vai embora em cascata com o cliente de fixture.
- P-10: tests/dashboard/aderencia-uso.test.ts: só o caso coletando-desde-coerente muda (ramo "medição recente": V3 e V6 passam a receber o primeiro dia útil desde a própria entrada/reativação), para o arquivo continuar correto com a 0052. Todos os números do arquivo (20/15%/3, 5/2/40%, 10/1/10%, 5/0/0%, denominador zero) continuam valendo SEM edição — conferido na Pesquisa. Este arquivo NÃO é executado nesta quick task: ele grava acessos ANTES do início real da medição (hoje-27 a hoje-21, hoje-13 a hoje-7 e hoje-28), o que fere a regra da D-06 revisada; fica registrado como item adiado (reescrever a semeadura dele ou rodar só com decisão do dono).
- P-12: Ordem das tarefas: a decisão do dono (Tarefa 2) vem ANTES da tela (Tarefa 3), para que um "ajustar" de texto de tela entre direto na Tarefa 3, sem retrabalho. Tarefa 1 (banco e testes, só local) -> Tarefa 2 (decisão) -> Tarefa 3 (tela) -> Tarefa 4 (dono aplica o SQL) -> Tarefa 5 (gate final). Os commits da Tarefa 3 são só locais e NÃO podem ir para staging/master antes da Tarefa 4; a Tarefa 4 confere, imediatamente antes de o dono aplicar, que o commit feat da Tarefa 3 não está em origin/staging nem em origin/master; quem publica é o orquestrador, depois da Tarefa 5.
- P-11: Autorização: o pedido dizia "Vendedor só os próprios"; o código real (0040 + DashboardClient) devolve ZERO linhas ao Vendedor e a tabela só é montada para o Supervisor. Preservado exatamente como está, sem nenhuma mudança.

Purpose: dar ao dono um número de adoção do CRM que já faz sentido nas primeiras semanas, sem mostrar a conta injusta, e sem mexer em quem vê o quê.
Output: migration 0052 + arquivo de volta + testes (estrutural, ao vivo, rótulo, tabela) + rótulo e tooltip ajustados; aplicação feita pelo dono ANTES de publicar; gate final verde.
</objective>

<execution_context>
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Cristiano Stephano/workspace/crm-raiar/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/Supabase-conventions/SKILL.md
@supabase/migrations/0040_dashboard_aderencia_uso.sql
@.planning/quick/261006-ncy-agenda-campos-o-que-vou-fazer-e-o-que-fo/261006-ncy-PLAN.md
</context>

## Pesquisa registrada (verificada lendo o código em 2026-10-08)

**Função atual.** supabase/migrations/0040_dashboard_aderencia_uso.sql: `create or replace function dashboard_aderencia_uso()` sem parâmetros, `returns table (responsavel uuid, dias_usados integer, dias_uteis integer, aderencia_pct numeric, coletando_desde date)`, `language sql stable`, sem cláusula de segurança (roda como quem chama), sem grant/revoke. CTEs: parametros (hoje e inicio_janela = hoje - 27, fuso de São Paulo), medicao (inicio_medicao = menor dia de acessos_diarios do projeto inteiro, ou hoje), vendedores (ativos, filtro `(select is_supervisor())`), calendario_util (28 dias da janela, só isodow < 6), dias_ativos (desde a admissão, fora da lacuna desativação/reativação), eventos (união acessos + historico dos 4 tipos com autor não nulo, corte por instante), agregado (count). coletando_desde = inicio_medicao quando a medição é recente; senão, greatest(admissão, reativação) quando o denominador é zero; senão nulo. O arquivo tem comentários de dois hífens dentro e fora do corpo, alguns com travessão (não ASCII) — por isso o arquivo de volta NÃO pode ser cópia literal: é o bloco da função sem essas linhas.

**Hoje em produção.** A medição começou em 28/09/2026 (segunda). Janela de hoje (quinta 08/10): 11/09 a 08/10. A janela fecha quando hoje - 27 >= 28/09, isto é, domingo 25/10/2026. Na reunião de terça 13/10 haverá 12 dias úteis desde 28/09 (cada dia pesa cerca de 8 pontos). O dia de hoje entra no denominador desde cedo (regra da 0040, mantida para a identidade da D-02).

**Quem lê a função.** Só lib/supabase/queries/dashboard.ts getAderenciaUso() (mapeia as 5 colunas por nome, Number() nos números) → app/actions/dashboard.ts getComparativoVendedorAction() (mesclarAderencia, falha isolada com catch → null) → components/dashboard/ComparativoVendedorTable.tsx (só chama rotuloAderencia; montado só para o Supervisor em DashboardClient). Nada mais no projeto chama a função.

**Testes que afirmam "coletando = só aviso" (mudam de propósito).**
- tests/dashboard/aderencia-exibicao.test.ts: coletando-vence-percentual (vira o caso defensivo coletando-sem-dias-uteis-mantem-aviso) e tooltip-texto (texto novo da P-07).
- tests/dashboard/comparativo-vendedor-table.test.tsx: aderencia-coletando (pct 40, 8 de 20, coletandoDesde preenchido → hoje espera só o aviso) vira aderencia-parcial; caso novo aderencia-coletando-sem-dias-uteis.
- tests/dashboard/aderencia-uso.test.ts (ao vivo): só coletando-desde-coerente, ramo da medição recente (P-10) — editado para continuar correto com a 0052, mas NÃO executado nesta quick task (grava acessos antes do início real da medição).
- NÃO existe teste estrutural da 0040 (o pedido citava um); o teste estrutural novo cobre a 0052 e compara com a 0040.

**Por que os números do aderencia-uso.test.ts continuam valendo com a 0052 (P-10).** As fixtures dele semeiam o acesso mais antigo em diaForaLacunaV4 = primeiro dia útil entre hoje-27 e hoje-21, que vira o início da medição do projeto durante o teste. Se hoje-27 for dia útil, a janela está cheia (regra igual à 0040). Se hoje-27 cair no fim de semana, a medição começa no primeiro dia útil da janela e os dias cortados são só sábado/domingo — os denominadores (20, 5, 10, 5, 0) e numeradores não mudam. Só o coletando_desde de V3 (admitido há 6 dias) e V6 (reativado há 6 dias) muda nesse ramo: passa a ser o primeiro dia útil desde hoje-6 (diaMenos(diasUteisEntre(6, 1)[0])). V1, V2, V4, V7 continuam com o menor dia gravado; V5 (denominador zero) continua com o menor dia gravado (igual à 0040).

**Testes que varrem todas as migrations (precisam continuar verdes sem edição).** tests/agenda2/migracao-agenda2.test.ts: arquivo-unico (arquivos que citam a tabela da Agenda 2 = 0048 e 0051; a 0052 não pode citá-la) e inventario-elevacao-inalterado (regex de definição de função sobre o texto SEM linhas de dois hífens mas COM blocos barra-asterisco; pega a última definição de cada função; a 0052 não pode ter a cláusula de elevação, e o bloco de comentário não pode conter a palavra inglesa de função, para não criar uma definição fantasma). tests/agenda2/migracao-agenda2-observacoes.test.ts (prefixo 0051), tests/clientes/apagar-cliente-migracao.test.ts (0050), tests/agenda/agenda-sem-visitas-migracao.test.ts (0049): só olham os próprios prefixos.

**Início da medição é global e vive em produção.** inicio_medicao = menor dia de acessos_diarios do projeto INTEIRO. Qualquer teste ao vivo que grave um acesso com data anterior a 28/09/2026 muda, enquanto a linha existir, o início da medição de todo o time (e, se a limpeza falhar, para sempre). Por isso (D-06 revisada): o arquivo novo só grava dias maiores ou iguais ao menor dia real, confere esse menor dia antes/depois/no fim, e a identidade com a 0040 na janela cheia é provada pelo teste estrutural, não ao vivo. O aderencia-uso.test.ts antigo (Fase 30) grava dias anteriores de propósito — fica fora da execução desta quick task (P-10). vitest.config está com fileParallelism false (arquivos em série); o arquivo ao vivo novo é rodado isolado na Tarefa 5 (limite de login do Supabase Auth).

## Contrato SQL (texto exato)

Bloco de comentário do topo da 0052 (um único bloco barra-asterisco, só ASCII, português sem acento, nenhuma linha começando com dois hífens, sem a palavra inglesa de função, sem cifrões duplos, sem a cláusula de elevação). Deve dizer: quick task 261008-mrf, decisão do dono de 2026-10-08; aderencia parcial enquanto a medicao tem menos de 28 dias: o calendario de dias uteis comeca no inicio da medicao (nunca conta dia anterior), com as mesmas regras de admissao, desativacao e reativacao da 0040; o numerador nao muda (acessos_diarios + historico dos 4 tipos); com a janela cheia (por volta de 25/10/2026) o resultado e identico ao da 0040; mesma assinatura e mesmas cinco colunas, troca so o corpo, sem remover a funcao antes; semantica das colunas da P-02; o que a tela atual faz com estes valores (P-03: continua so com o aviso, por isso esta mudanca e aplicada ANTES de publicar a tela nova); a funcao continua rodando com as permissoes de quem chama, sem elevacao de privilegio, sem grant e sem revoke, e o filtro de Supervisor nao muda (Vendedor e visitante recebem zero linhas); nenhum dado novo e coletado (so muda a conta — LGPD); volta atras em supabase/rollbacks/0052_volta_aderencia_uso.sql, NAO aplicado automaticamente, primeiro a tela e depois o banco.

Código da 0052 depois do bloco de comentário (montar copiando o código da 0040 sem as linhas de dois hífens e aplicando as 3 trocas abaixo — o resultado deve ser exatamente isto):

```sql
create or replace function dashboard_aderencia_uso()
returns table (
  responsavel uuid,
  dias_usados integer,
  dias_uteis integer,
  aderencia_pct numeric,
  coletando_desde date
)
language sql
stable
as $$
  with parametros as (
    select
      (now() at time zone 'America/Sao_Paulo')::date as hoje,
      (now() at time zone 'America/Sao_Paulo')::date - 27 as inicio_janela
  ),
  medicao as (
    select coalesce((select min(a.dia) from acessos_diarios a), pm.hoje) as inicio_medicao
    from parametros pm
  ),
  vendedores as (
    select
      p.id,
      (p.created_at at time zone 'America/Sao_Paulo')::date as admissao,
      (p.desativado_em at time zone 'America/Sao_Paulo')::date as desativado,
      (p.reativado_em at time zone 'America/Sao_Paulo')::date as reativado
    from profiles p
    where p.role = 'vendedor' and p.ativo = true and (select is_supervisor())
  ),
  calendario_util as (
    select (pm.inicio_janela + g.n) as dia
    from parametros pm, medicao md, generate_series(0, 27) as g(n)
    where extract(isodow from (pm.inicio_janela + g.n)) < 6
      and (pm.inicio_janela + g.n) >= md.inicio_medicao
  ),
  dias_ativos as (
    select v.id as responsavel, cu.dia
    from vendedores v
    join calendario_util cu on cu.dia >= v.admissao
    where not (
      v.reativado is not null
      and cu.dia < v.reativado
      and (v.desativado is null or cu.dia >= v.desativado)
    )
  ),
  eventos as (
    select a.usuario_id, a.dia
    from acessos_diarios a, parametros pm
    where a.dia between pm.inicio_janela and pm.hoje
    union
    select
      h.autor_id as usuario_id,
      (h.criado_em at time zone 'America/Sao_Paulo')::date as dia
    from historico h, parametros pm
    where h.tipo in ('etapa', 'status_acompanhamento', 'tarefa_concluida', 'visita_concluida')
      and h.autor_id is not null
      and h.criado_em >= (pm.inicio_janela::timestamp at time zone 'America/Sao_Paulo')
      and h.criado_em < ((pm.hoje + 1)::timestamp at time zone 'America/Sao_Paulo')
  ),
  agregado as (
    select
      da.responsavel,
      count(*)::integer as dias_uteis,
      count(ev.dia)::integer as dias_usados,
      min(da.dia) as primeiro_dia
    from dias_ativos da
    left join eventos ev on ev.usuario_id = da.responsavel and ev.dia = da.dia
    group by da.responsavel
  )
  select
    v.id as responsavel,
    coalesce(ag.dias_usados, 0) as dias_usados,
    coalesce(ag.dias_uteis, 0) as dias_uteis,
    case
      when coalesce(ag.dias_uteis, 0) = 0 then null
      else round(coalesce(ag.dias_usados, 0)::numeric / ag.dias_uteis * 100, 1)
    end as aderencia_pct,
    case
      when coalesce(ag.dias_uteis, 0) = 0 and md.inicio_medicao > pm.inicio_janela then md.inicio_medicao
      when coalesce(ag.dias_uteis, 0) = 0 then greatest(v.admissao, v.reativado)
      when md.inicio_medicao > pm.inicio_janela then ag.primeiro_dia
      else null
    end as coletando_desde
  from vendedores v
  left join agregado ag on ag.responsavel = v.id
  cross join parametros pm
  cross join medicao md
$$;
```

As 3 trocas (texto normalizado: todo espaço em branco vira um espaço). O teste estrutural guarda estas 6 strings como constantes:
- T1 antigo: `from parametros pm, generate_series(0, 27) as g(n) where extract(isodow from (pm.inicio_janela + g.n)) < 6 )`
- T1 novo: `from parametros pm, medicao md, generate_series(0, 27) as g(n) where extract(isodow from (pm.inicio_janela + g.n)) < 6 and (pm.inicio_janela + g.n) >= md.inicio_medicao )`
- T2 antigo: `count(ev.dia)::integer as dias_usados from dias_ativos da`
- T2 novo: `count(ev.dia)::integer as dias_usados, min(da.dia) as primeiro_dia from dias_ativos da`
- T3 antigo: `case when md.inicio_medicao > pm.inicio_janela then md.inicio_medicao when coalesce(ag.dias_uteis, 0) = 0 then greatest(v.admissao, v.reativado) else null end as coletando_desde`
- T3 novo: `case when coalesce(ag.dias_uteis, 0) = 0 and md.inicio_medicao > pm.inicio_janela then md.inicio_medicao when coalesce(ag.dias_uteis, 0) = 0 then greatest(v.admissao, v.reativado) when md.inicio_medicao > pm.inicio_janela then ag.primeiro_dia else null end as coletando_desde`

Por que a janela cheia dá o mesmo número da 0040 (ESTA é a prova da D-02, estrutural — não existe caso ao vivo para isso): o teste corpo-0040-com-tres-trocas garante que a 0052 é a 0040 com exatamente T1, T2 e T3 e nada mais. Com inicio_medicao <= inicio_janela: T1 acrescenta uma condição sempre verdadeira (todo dia da janela é >= inicio_janela >= inicio_medicao), então o calendário, os dias ativos, o numerador, o denominador e o percentual são os da 0040; T2 só acrescenta uma coluna auxiliar (primeiro_dia) que nenhuma saída usa nesse caso; T3 cai nos mesmos dois ramos da 0040 (entrada/reativação com denominador zero; nulo nos demais), porque o ramo novo exige inicio_medicao > inicio_janela. Com denominador zero, o valor é o da 0040 também durante a coleta. Esse raciocínio vai para o SUMMARY (Tarefa 5).

Arquivo de volta supabase/rollbacks/0052_volta_aderencia_uso.sql: um bloco barra-asterisco ASCII começando com "NAO APLICAR automaticamente.", dizendo que fica fora de supabase/migrations de propósito (o CLI nunca o lê); que é a volta atrás da 0052 (quick 261008-mrf) e restaura a conta da 0040 (denominador dos 20 dias úteis da janela durante a coleta e o aviso de coleta); que nenhum dado é apagado (a 0052 não guarda nada); a ORDEM obrigatória — primeiro reverter o commit feat da Tarefa 3 desta quick task (tela) e publicar, só DEPOIS colar este arquivo no SQL Editor, porque na ordem inversa a tela nova mostraria o número antigo e injusto marcado "(parcial)"; que depois de ~25/10/2026 a ordem deixa de importar; aplicar só se o dono decidir desfazer. Depois do comentário: o bloco da função da 0040, do `create or replace function dashboard_aderencia_uso()` até o `$$;`, com TODAS as linhas de comentário de dois hífens removidas e nada mais alterado.

## Interfaces existentes (lidas no código)

- lib/supabase/queries/dashboard.ts: `export type AderenciaUsoRow = { responsavel: string; diasUsados: number; diasUteis: number; aderenciaPct: number | null; coletandoDesde: string | null }`; `getAderenciaUso(): Promise<AderenciaUsoRow[]>` chama `supabase.rpc("dashboard_aderencia_uso")` e mapeia por nome.
- lib/aderencia/exibicao.ts: `ComparativoVendedorLinha`, `type RotuloAderencia = { principal: string; detalhe: string | null; coletando: boolean }`, `TEXTO_TOOLTIP_ADERENCIA`, `percentFormatter` (pt-BR, 1 casa), `TRAVESSAO`, `rotuloAderencia(aderencia)`, `mesclarAderencia(linhas, aderencias)`; importa `format` e `parseISO` de date-fns e só tipos do módulo de consultas.
- components/dashboard/ComparativoVendedorTable.tsx (NÃO muda): `rotulo.coletando ? <span muted>{principal}</span> : <div flex-col><span>{principal}</span>{detalhe ? <span text-xs muted>{detalhe}</span> : null}</div>`; tooltip com aria-label e conteúdo = TEXTO_TOOLTIP_ADERENCIA.
- tests/dashboard/aderencia-exibicao.test.ts: construtores `buildAderencia(partial)` (padrão diasUsados 0, diasUteis 0, aderenciaPct null, coletandoDesde null) e `buildComparativo(partial)`.
- tests/dashboard/comparativo-vendedor-table.test.tsx: `buildRow`, `aderencia(partial)`, `renderTable()`, `mockedAction`; célula da aderência = `cells[5]`.
- tests/dashboard/aderencia-uso.test.ts: helpers `hojeSaoPaulo`, `diaMenos`, `diaMais`, `diasUteisEntre(nAntigo, nRecente)`, `diaDaSemanaEntre`, `instanteSaoPaulo`, `haDias`, `uniqueRazaoSocial`, `seedCliente`, `seedHistorico`, `definirAdmissao`, `seedAcesso`, `menorDiaGlobal`, `linhasAderencia`, `linhaDe` (não exportados — copiar).
- tests/helpers/supabase-test-clients.ts: `anonClient()`, `serviceClient()`, `signInAs(email, password)`, `createTestMember(role, label)`, `deleteTestMember(id)`, tipo `TestMember`.
- tests/agenda/agenda-sem-visitas-migracao.test.ts: molde do teste estrutural (lerCru, lf, blocoDaFuncao, normaliza, assinatura, corpo, semComentarios, ehAsciiPuro, contaOcorrencias, linhaComecaComDoisHifens, cláusula montada por concatenação).

<tasks>

<task type="auto" tdd="true">
  <name>Tarefa 1: Migration 0052 + arquivo de volta + teste estrutural (verde) + testes ao vivo (VERMELHOS até a aplicação)</name>
  <files>supabase/migrations/0052_aderencia_uso_parcial.sql, supabase/rollbacks/0052_volta_aderencia_uso.sql, tests/dashboard/aderencia-parcial-migracao.test.ts, tests/dashboard/aderencia-parcial.test.ts, tests/dashboard/aderencia-uso.test.ts</files>
  <read_first>
    - supabase/migrations/0040_dashboard_aderencia_uso.sql (arquivo inteiro: código a copiar e comentários a NÃO copiar)
    - supabase/migrations/0049_agenda_atual_so_prospeccao.sql e supabase/rollbacks/0049_volta_agenda_do_vendedor.sql (estilo do bloco ASCII, recriação com mesma assinatura e arquivo de volta)
    - tests/agenda/agenda-sem-visitas-migracao.test.ts (molde do teste estrutural)
    - tests/dashboard/aderencia-uso.test.ts (cabeçalho, helpers das linhas 51-207, beforeAll/afterAll, caso coletando-desde-coerente nas linhas 420-439)
    - tests/helpers/supabase-test-clients.ts (assinaturas)
    - Seções "Pesquisa registrada" e "Contrato SQL" deste plano
  </read_first>
  <behavior>
    - Estrutural arquivo-unico: só um arquivo de migration começa com "0052" e é 0052_aderencia_uso_parcial.sql; o arquivo de volta existe em supabase/rollbacks e não está em supabase/migrations.
    - Estrutural mesma-assinatura: a frase de criação aparece exatamente 1 vez na 0052; a 0052 em minúsculas não contém a frase de remoção de função (montada por concatenação de "drop" e " function"); assinatura normalizada da 0052 == da 0040.
    - Estrutural corpo-0040-com-tres-trocas: no corpo da 0040 sem comentários e normalizado cada string "antigo" de T1/T2/T3 aparece exatamente 1 vez; trocando as três pelas "novo" o resultado é IGUAL ao corpo da 0052 sem comentários e normalizado.
    - Estrutural mesma-autorizacao-sem-elevacao: SQL da 0052 sem comentários e minúsculo não contém a cláusula de elevação, "grant ", "revoke ", "insert into", "update ", "delete from", "truncate", "alter table", "drop ", "create table", "policy"; contém "(select is_supervisor())" exatamente 1 vez e "language sql"; a lista de funções criadas é exatamente ["dashboard_aderencia_uso"].
    - Estrutural comentarios-seguros: arquivo cru da 0052 é ASCII puro, nenhuma linha começa com dois hífens, "$$" aparece exatamente 2 vezes, a palavra "function" aparece exatamente 1 vez no texto cru minúsculo (só a frase de criação), não contém a cláusula de elevação nem o nome da tabela da Agenda 2 (montado por concatenação), e contém "261008-mrf" e "supabase/rollbacks/0052_volta_aderencia_uso.sql".
    - Estrutural volta-restaura-0040: arquivo de volta ASCII puro, sem linha de dois hífens, contém "NAO APLICAR", "$$" exatamente 2 vezes, "function" exatamente 1 vez, sem a frase de remoção de função e sem a cláusula; bloco da função da volta sem comentários e normalizado == bloco da função da 0040 sem comentários e normalizado.
    - Inventário (tests/agenda2/migracao-agenda2.test.ts) e os estruturais da 0049/0050/0051 continuam verdes SEM edição.
    - Ao vivo, novo arquivo (VERMELHO contra a 0040 enquanto a medição tiver menos de 28 dias), um bloco só: colunas-contrato, parcial-cem-por-cento, antes-da-medicao-nao-conta, denominador-zero-mantem-aviso, admitido-depois-do-inicio, rls-vendedor-zero-linhas, anonimo-zero-linhas e medicao-intocada (o menor dia de acessos_diarios lido antes de semear é igual ao relido depois da semeadura e ao relido no caso). Nenhuma gravação em acessos_diarios com data anterior ao menor dia real.
    - aderencia-uso.test.ts (NÃO executado nesta quick task — P-10): só coletando-desde-coerente muda (ramo da medição recente); todos os demais casos intocados; nota no cabeçalho.
  </behavior>
  <action>
1. RED — criar tests/dashboard/aderencia-parcial-migracao.test.ts (ambiente node, só fs/path/vitest) no molde de tests/agenda/agenda-sem-visitas-migracao.test.ts: constantes da pasta de migrations, caminho da 0040, nome/caminho da 0052 e do arquivo de volta em supabase/rollbacks; FRASE_CRIACAO igual à frase de criação de dashboard_aderencia_uso da 0040; cláusula de elevação, frase de remoção de função e nome da tabela da Agenda 2 montados por concatenação (nenhum aparece inteiro no arquivo); constantes T1/T2/T3 (antigo e novo) copiadas ao pé da letra do "Contrato SQL"; helpers copiados do molde. Escrever os 6 casos estruturais do bloco behavior com exatamente estes nomes de it: arquivo-unico, mesma-assinatura, corpo-0040-com-tres-trocas, mesma-autorizacao-sem-elevacao, comentarios-seguros, volta-restaura-0040. Rodar e confirmar que FALHA (arquivos ainda não existem). Commit: `test(quick-261008-mrf): add failing structural test for migration 0052 and rollback file`.
2. GREEN — criar supabase/migrations/0052_aderencia_uso_parcial.sql (per D-01/D-02/D-04, P-02/P-05): primeiro o bloco de comentário descrito no "Contrato SQL", depois o código EXATO do "Contrato SQL" — montar copiando o código da 0040 sem as linhas de comentário e aplicando as 3 trocas; o corpo não leva comentário nenhum; nenhuma cláusula de segurança, nenhum grant/revoke, sem remover a função antes (mesma assinatura). Criar supabase/rollbacks/0052_volta_aderencia_uso.sql (per D-04, P-04) como descrito no "Contrato SQL" (cabeçalho NAO APLICAR com a ordem tela-antes-banco-depois; depois o bloco da função da 0040 sem as linhas de dois hífens). Nunca editar a 0040 nem nenhuma migration antiga. Rodar o teste estrutural até ficar verde, junto com tests/agenda2/migracao-agenda2.test.ts (inventário de 11 SEM edição) e os estruturais da 0049/0050/0051. Commit: `feat(quick-261008-mrf): add migration 0052 (partial adherence while the 28-day window fills) and rollback file`.
3. Testes ao vivo (per D-06 revisada, P-09). Criar tests/dashboard/aderencia-parcial.test.ts no molde de tests/dashboard/aderencia-uso.test.ts. Cabeçalho em comentário: prova a regra parcial da 0052 contra o banco REAL (o projeto de teste é o de produção, com dados reais de funcionários); VERMELHO enquanto a 0052 não for aplicada E a medição tiver menos de 28 dias (até ~25/10/2026) — vermelho ESPERADO e não medido nesta quick task (o arquivo só roda depois da aplicação); depois de ~25/10 os mesmos casos caem sozinhos no ramo de janela cheia do modelo; a identidade com a 0040 na janela cheia é provada pelo teste estrutural, NÃO aqui (D-06 revisada); NUNCA grava em acessos_diarios dia anterior ao menor dia real (o início da medição é global — gravar antes mudaria o início da medição do time inteiro); só fixtures descartáveis (nunca as contas semente antigas); exatamente duas autenticações (Supervisor e P1); nunca imprime nada; toda leitura do Supervisor é filtrada pelos ids de fixture; nomes inventados; não rodar perto da meia-noite de São Paulo. Copiar os helpers de data/semeadura/leitura do aderencia-uso.test.ts. Escrever o modelo de referência esperado(admissaoDia, diasComUso, m): inicioJanela = hoje - 27; coletando = m maior que inicioJanela; calendario = dias úteis (getISODay menor que 6) de max(inicioJanela, m, admissaoDia) até hoje; uteis = tamanho; usados = quantos dias do calendário estão em diasComUso; pct = uteis 0 → null, senão Math.round(1000 * usados / uteis) / 10; coletandoDesde = uteis 0 → (coletando ? m : admissaoDia), senão (coletando ? primeiro dia do calendário : null). Fixtures (createTestMember em paralelo, hookTimeout 60000): P1 "parcial-p1", P2 "parcial-p2", P3 "parcial-p3", P4 "parcial-p4" (vendedores) e supervisor "parcial". beforeAll: ler mAntes = menorDiaGlobal() ANTES de qualquer semeadura (null → erro de pré-condição); criar o helper semearAcessosSeguro(usuarioId, dias) — a ÚNICA forma de gravar em acessos_diarios neste arquivo — que lança erro, sem gravar nada, se algum dia da lista for menor que mAntes; admissões P1/P2 há 60 dias, P3 daqui a 3 dias, P4 há 3 dias (definirAdmissao + haDias — só profiles, nunca acessos); P1: acesso em TODO dia útil de max(mAntes, hoje-27) até hoje (um upsert com a lista, via o helper); P2: um cliente de fixture (razão social inventada) + um historico tipo etapa com autor P2 às 10:00 no primeiro dia útil entre hoje-27 e hoje-21 (historico não mexe no início da medição) e, via o helper, um acesso no dia útil mais recente entre hoje-5 e hoje-1 SÓ se esse dia for maior ou igual a mAntes (senão não semeia e o modelo recebe a lista sem ele); P3 e P4 sem uso; logo depois da semeadura, reler o menor dia e lançar erro de pré-condição se for diferente de mAntes; depois signInAs de P1 e do Supervisor, em sequência. afterAll: apagar os clientes de fixture (historico vai por cascata), apagar acessos_diarios dos 4 ids de vendedor, só DEPOIS deleteTestMember dos 5; por fim reler o menor dia e lançar erro (sem imprimir linha nenhuma) se for diferente de mAntes. O modelo de todos os casos usa m = mAntes. Um único describe (casos com exatamente estes nomes): colunas-contrato (chaves da linha de P1 ordenadas == as 5 colunas); parcial-cem-por-cento (linha de P1 == modelo; pct 100 e usados == uteis; com coletando, coletando_desde == primeiro dia útil desde m e uteis menor que 20 quando houver dia útil da janela antes de m); antes-da-medicao-nao-conta (P2 == modelo; com coletando e o dia do historico antes de m: dias_usados 1 e dias_uteis igual ao de P1); denominador-zero-mantem-aviso (P3: uteis 0, usados 0, pct null, coletando_desde == (coletando ? m : diaMais(3)), nunca nulo); admitido-depois-do-inicio (P4 == modelo; com coletando, coletando_desde == primeiro dia útil desde max(m, hoje-3)); rls-vendedor-zero-linhas (sessão de P1 → zero linhas, sem erro); anonimo-zero-linhas (cliente sem login → erro ou zero linhas, nunca dados); medicao-intocada (último caso: menorDiaGlobal() relido agora é exatamente mAntes — a semeadura não mudou o início da medição do time). NENHUM caso fecha a janela de propósito nem grava acesso antes de mAntes (a identidade com a 0040 na janela cheia é estrutural — D-06 revisada). Comparações numéricas sempre com Number(); datas como texto AAAA-MM-DD; mensagens de falha nunca incluem linhas lidas nem o valor do menor dia real (só "mudou"/"não mudou").
4. Atualizar DE PROPÓSITO tests/dashboard/aderencia-uso.test.ts (per D-06, P-10), sem mexer em nenhum outro caso: no cabeçalho, uma nota curta "Quick 261008-mrf (2026-10-08): a migration 0052 corta o calendário no início da medição; os números deste arquivo não mudam; só o coletando_desde de V3 e V6 no ramo de medição recente passa a ser o primeiro dia útil desde a própria entrada/reativação. ATENÇÃO: este arquivo grava acessos com data anterior ao início real da medição no banco de produção (muda o início da medição do time enquanto as linhas existirem) — não rodar sem decisão do dono". No caso coletando-desde-coerente, ramo m maior que diaMenos(27): V1, V2, V4, V7 e V5 continuam esperando m; V3 e V6 passam a esperar diaMenos(diasUteisEntre(6, 1)[0]); atualizar a frase do it para descrever isso (o prefixo "coletando-desde-coerente:" fica). O ramo da janela completa não muda.
Não executar os dois arquivos ao vivo nesta tarefa (banco de produção, 0052 ainda não aplicada — mesmo procedimento da quick 261006-ncy); só tsc, eslint e a checagem estrutural do verify. Commit: `test(quick-261008-mrf): add live tests for partial adherence (red until 0052 is applied) and update coletando-desde case`. Todo commit com a linha de coautoria da D-09; nunca adicionar .planning/config.json.
  </action>
  <verify>
    <automated>npx vitest run tests/dashboard/aderencia-parcial-migracao.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 tests/dashboard/aderencia-parcial-migracao.test.ts tests/dashboard/aderencia-parcial.test.ts tests/dashboard/aderencia-uso.test.ts && node -e "const fs=require('fs');const s=fs.readFileSync('tests/dashboard/aderencia-parcial.test.ts','utf8');const n=(s.match(/signInAs\(/g)||[]).length;if(n!==2)throw new Error('logins: '+n);if(/console\./.test(s))throw new Error('impressao');if(/SEED_ACCOUNTS/.test(s))throw new Error('contas semente');if(!/createTestMember\(/.test(s)||!/deleteTestMember\(/.test(s))throw new Error('fixtures');for(const c of ['colunas-contrato','parcial-cem-por-cento','antes-da-medicao-nao-conta','denominador-zero-mantem-aviso','admitido-depois-do-inicio','rls-vendedor-zero-linhas','anonimo-zero-linhas','medicao-intocada']){if(!s.includes(c))throw new Error('caso ausente: '+c)}if(!s.includes('semearAcessosSeguro'))throw new Error('helper de semeadura segura ausente');if((s.match(/menorDiaGlobal\(/g)||[]).length<4)throw new Error('menor dia nao relido antes/depois/fim');const u=fs.readFileSync('tests/dashboard/aderencia-uso.test.ts','utf8');if((u.match(/signInAs\(/g)||[]).length!==2)throw new Error('aderencia-uso: logins');if(!u.includes('261008-mrf')||!u.includes('coletando-desde-coerente'))throw new Error('aderencia-uso: nota ou caso ausente');console.log('OK testes ao vivo (estrutura)')" && node -e "const cp=require('child_process');const st=cp.execFileSync('git',['diff','--name-status','b67aed6aff0ca1b9b6fc6c2744b506f21360e333','HEAD','--','supabase/migrations']).toString().split('\n').map(s=>s.trim()).filter(Boolean);if(st.length!==1||st[0]!=='A\tsupabase/migrations/0052_aderencia_uso_parcial.sql')throw new Error('migrations: '+st.join(' | '));console.log('OK uma migration nova')"</automated>
  </verify>
  <acceptance_criteria>
    - Teste estrutural novo: rodada vermelha antes dos arquivos e agora 6/6 verdes; migracao-agenda2 verde com o inventário de 11 sem edição; estruturais da 0049/0050/0051 verdes sem edição.
    - A 0052 segue o "Contrato SQL" ao pé da letra (mesma assinatura, corpo = 0040 + 3 trocas, sem comentário no corpo); cabeçalho ASCII num único bloco, sem linha de dois hífens, sem a cláusula de elevação e sem a palavra inglesa de função.
    - O arquivo de volta reproduz a 0040 (sem os comentários), avisa NAO APLICAR e a ordem (tela primeiro, banco depois).
    - Desde a base b67aed6, supabase/migrations tem exatamente uma linha "A" (a 0052); nenhuma migration antiga editada.
    - Teste ao vivo novo com os 8 casos (incluindo medicao-intocada), exatamente 2 logins, nada impresso, só fixtures; toda gravação em acessos_diarios passa pelo helper que recusa dia anterior ao menor dia real; o menor dia é lido antes, depois da semeadura, no caso medicao-intocada e no fim; nenhum caso fecha a janela de propósito.
    - aderencia-uso.test.ts com só o caso coletando-desde-coerente alterado e a nota de ATENÇÃO no cabeçalho; NENHUM dos dois arquivos ao vivo executado nesta tarefa (o vermelho antes da aplicação é esperado e não é medido).
    - tsc e eslint --max-warnings 0 limpos nos 3 arquivos de teste.
  </acceptance_criteria>
  <done>Mudança no banco escrita (não aplicada) com volta atrás pronta, prova estrutural verde e prova ao vivo pronta para ficar verde quando o dono aplicar a 0052.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Tarefa 2: Aprovação do dono — o que muda, cuidado na reunião, alerta de LGPD, ordem segura (banco PRIMEIRO) e como voltar atrás</name>
  <read_first>
    - supabase/migrations/0052_aderencia_uso_parcial.sql (o que será aplicado)
    - supabase/rollbacks/0052_volta_aderencia_uso.sql (o desfazer)
    - Seção "Pesquisa registrada" deste plano
  </read_first>
  <action>Pausar a execução. Apresentar ao dono do projeto, em linguagem simples (ele não programa — CLAUDE.md), o texto dos blocos decision/context abaixo e só seguir depois de uma resposta explícita (per D-08). Não enviar arquivo para aplicação, não rodar db push, não colar SQL em lugar nenhum antes disso. Ao devolver este checkpoint ao orquestrador com a resposta "aplicar", dizer EXPLICITAMENTE que NADA deve ir para a branch staging nem para master antes de o dono aplicar a 0052 na Tarefa 4 (P-04: a tela nova contra o banco antigo mostraria o número injusto como "(parcial)"). Se o dono escolher "ajustar" com mudança só de texto de tela (por exemplo a palavra "(parcial)", a frase "desde" ou o tooltip): registrar o texto aprovado por ele no SUMMARY e seguir — a tela ainda não foi feita, então o ajuste entra direto na Tarefa 3, sem retrabalho (P-12); a aprovação para aplicar a 0052 continua valendo se ele a tiver dado junto, senão reapresentar só a pergunta de aplicar. Se o ajuste mexer em regra travada (por exemplo, não contar o dia de hoje, mudar a data de início, mostrar para o Vendedor): registrar e devolver ao orquestrador para replanejar, sem implementar — "não contar hoje" quebraria a identidade com a 0040 depois de 25/10 (D-02). A 0052 ainda NÃO está aplicada, então qualquer correção dela, se o orquestrador autorizar, é feita editando a própria 0052 junto com os testes estrutural e ao vivo.</action>
  <decision>Aplicar agora, no banco do sistema, a mudança 0052 que faz a coluna "Aderência de uso" mostrar um percentual parcial (só com os dias desde o início da medição) até completar os 28 dias?</decision>
  <context>
    **Leia primeiro: a mudança no banco vale na hora, para o banco do time inteiro.** O site de teste e o site que a equipe usa guardam os dados no MESMO banco. Desta vez, aplicar o banco ANTES da tela é o caminho seguro (explicado abaixo).

    **O que muda (depois que a tela nova for publicada) — só para o Supervisor, no Dashboard, tabela "Comparativo por vendedor", coluna "Aderência de uso":**
    - Hoje aparece "Coletando dados desde 28/09/2026" para todo mundo.
    - Passa a aparecer, para cada vendedor, algo como "90,0% (parcial)" e, embaixo, "9 de 10 dias úteis desde 28/09".
    - A conta usa só os dias úteis (segunda a sexta) desde 28/09 — ou desde a entrada do vendedor no time, se ele entrou depois. Dias antes do início da medição nunca contam, nem a favor nem contra.
    - O que conta como "usou o sistema" não muda: abrir o sistema, mover etapa, concluir tarefa ou visita, cadastrar ou editar cliente.
    - Quem ainda não tem nenhum dia útil para contar continua com "Coletando dados desde ...".
    - Por volta de 25/10/2026, quando a medição completar 28 dias, o "(parcial)" some sozinho e o número volta a ser o dos últimos 28 dias, exatamente como foi planejado na Fase 30.
    - O ícone de ajuda (?) da coluna ganha uma frase explicando o "(parcial)".
    - Quem vê não muda: só o Supervisor vê essa coluna; o vendedor não vê nada disso. As outras colunas não mudam.

    **Cuidado ao apresentar na reunião de 13/10:** o dia de hoje entra na conta desde cedo — quem ainda não abriu o sistema naquele dia aparece com um dia a menos. Até 13/10 serão cerca de 12 dias úteis, então cada dia pesa uns 8 pontos. Se for olhar o número de manhã, leve isso em conta (ou consulte no fim do dia anterior).

    **Alerta de conformidade (LGPD) — leia com atenção:**
    - A aderência é uma medida de uso do sistema POR PESSOA. É dado pessoal de funcionário.
    - Esta mudança NÃO coleta nenhum dado novo: só muda a conta feita com o que já é registrado desde 28/09 (em que dias cada vendedor usou o sistema). Nada muda no que é guardado, nem por quanto tempo, nem em quem pode ver.
    - Recomendação: apresentar o número como "uso do CRM nas primeiras semanas" (adoção da ferramenta pelo time), e não como avaliação de desempenho individual — o número é parcial, cobre poucos dias, e um único dia sem abrir o sistema muda muito o resultado.
    - Transparência: se o time ainda não sabe que o uso do CRM é medido, vale avisá-los. Essa comunicação é decisão sua (já registrada assim na Fase 30).
    - Avalie o escopo à luz da LGPD; a decisão é sua, como responsável pelos dados.

    **Ordem segura que vamos seguir:**
    1. Você cola e roda a mudança no banco (próxima etapa). O site de hoje continua igual: segue mostrando "Coletando dados desde ..." (para quem entrou depois de 28/09, a data passa a ser a da entrada dele). Nada quebra.
    2. Eu confiro com os testes automáticos contra o banco.
    3. Só então a tela nova vai para o site de teste (staging) para conferência.
    4. Depois disso vai para o site real.
    Por que nessa ordem: se a tela nova fosse publicada antes de o banco mudar, ela mostraria como "(parcial)" o número antigo, que divide pelos 20 dias úteis inteiros — justamente o número injusto que você não quer mostrar.

    **Como voltar atrás, se precisar:** primeiro tirar a tela nova do ar (desfazer a mudança de tela desta quick task e publicar), e SÓ DEPOIS colar o arquivo `supabase/rollbacks/0052_volta_aderencia_uso.sql` no SQL Editor — ele devolve a conta antiga. Nenhum dado é apagado (esta mudança não guarda nada). Na ordem inversa, a tela mostraria o número injusto como "(parcial)". Depois de ~25/10 a ordem deixa de importar (as duas contas dão o mesmo número).

    **Dados reais nos testes:** os testes automáticos rodam no mesmo banco dos dados reais. Eles criam vendedores temporários com nomes inventados, apagam tudo no fim e nunca mostram dados reais. Nenhum teste grava dia anterior ao início real da medição (28/09): os testes conferem, antes e depois, que o início da medição do time continua o mesmo. A garantia de que o número volta a ser exatamente o de hoje quando completar 28 dias é dada por uma conferência do próprio arquivo da mudança (ele é igual ao atual, com só 3 trechos trocados), sem precisar simular nada no banco.

    **Próximo passo depois da sua resposta:** eu preparo a tela (ainda só no computador, sem publicar) já com qualquer ajuste de texto que você pedir aqui; depois mando o arquivo para você colar no SQL Editor.
  </context>
  <options>
    <option id="aplicar">
      <name>Aprovar e aplicar agora</name>
      <pros>O número de uso do CRM fica justo e visível já para a reunião de 13/10; nenhum dado novo é coletado; quem vê não muda; a ordem escolhida não derruba nada; existe volta atrás pronta e sem perda de dados.</pros>
      <cons>Com poucos dias, cada dia pesa muito no percentual (cuidado ao apresentar); é dado de uso por pessoa (LGPD) e pede cuidado na forma de mostrar ao time.</cons>
    </option>
    <option id="ajustar">
      <name>Ajustar antes de aplicar</name>
      <pros>Permite mudar textos da tela agora, ou rever uma regra antes de tocar o banco.</pros>
      <cons>Mudança de regra volta para replanejamento e pode atrasar a entrega para a reunião de 13/10.</cons>
    </option>
  </options>
  <acceptance_criteria>
    - O dono respondeu "aplicar" (ou aprovação explícita equivalente) antes de qualquer envio de arquivo para aplicação, db push ou execução no SQL Editor.
    - O SUMMARY registra a resposta e a ciência de: efeito imediato no banco único, o que muda na tela, o cuidado do dia de hoje na reunião, os pontos do alerta de LGPD (dado de uso por pessoa; nenhum dado novo; apresentar como uso do CRM, não desempenho individual; transparência com o time), a ordem segura com o banco PRIMEIRO e como voltar atrás (tela antes, banco depois, nada apagado).
    - O orquestrador foi avisado de que nada vai para staging/master antes da Tarefa 4; nenhum push pelo executor.
    - Se o dono escolheu "ajustar", o caminho da action foi seguido antes de qualquer aplicação.
  </acceptance_criteria>
  <files>supabase/migrations/0052_aderencia_uso_parcial.sql, supabase/rollbacks/0052_volta_aderencia_uso.sql (só leitura — o que é apresentado ao dono; nenhum arquivo muda neste checkpoint; um "ajustar" de texto de tela é só registrado e entra na Tarefa 3)</files>
  <verify>
    <automated>npx vitest run tests/dashboard/aderencia-parcial-migracao.test.ts && git diff --quiet HEAD -- supabase/migrations/0052_aderencia_uso_parcial.sql supabase/rollbacks/0052_volta_aderencia_uso.sql && echo "OK arquivos apresentados = arquivos testados e commitados"</automated>
    <human-check>
      <test>Resposta explícita do dono ao texto deste checkpoint ("aplicar" ou "ajustar: ...").</test>
      <expected>"aplicar" (ou aprovação equivalente) registrado no SUMMARY com os itens reconhecidos.</expected>
      <why_human>Decisão do dono como responsável pelos dados (LGPD) e pela mudança no banco único.</why_human>
    </human-check>
  </verify>
  <resume-signal>Responda "aplicar" para autorizar a 0052 no banco do sistema, ou "ajustar: ..." descrevendo o que mudar.</resume-signal>
  <done>Decisão explícita do dono registrada, com o alerta de LGPD, o cuidado na reunião, a ordem segura e a volta atrás reconhecidos, e o orquestrador ciente de que não publica nada antes da aplicação.</done>
</task>

<task type="auto" tdd="true">
  <name>Tarefa 3: Rótulo "(parcial)" e tooltip na tela + testes de rótulo e de tabela (componente intocado; commits só locais)</name>
  <files>lib/aderencia/exibicao.ts, lib/supabase/queries/dashboard.ts, tests/dashboard/aderencia-exibicao.test.ts, tests/dashboard/comparativo-vendedor-table.test.tsx</files>
  <read_first>
    - Resposta do dono no checkpoint da Tarefa 2 (registrada no SUMMARY em andamento): se ele pediu ajuste SÓ de texto de tela, é aqui que o ajuste entra
    - lib/aderencia/exibicao.ts (arquivo inteiro)
    - tests/dashboard/aderencia-exibicao.test.ts (arquivo inteiro)
    - tests/dashboard/comparativo-vendedor-table.test.tsx (linhas 1-66 e 193-308)
    - lib/supabase/queries/dashboard.ts (linhas 276-320)
    - components/dashboard/ComparativoVendedorTable.tsx (linhas 174-221, só leitura — este arquivo NÃO muda)
  </read_first>
  <behavior>
    - parcial-noventa: { coletandoDesde "2026-09-28", aderenciaPct 90, diasUsados 9, diasUteis 10 } → { principal "90,0% (parcial)", detalhe "9 de 10 dias úteis desde 28/09", coletando false }.
    - parcial-cem: { coletandoDesde "2026-09-28", aderenciaPct 100, diasUsados 9, diasUteis 9 } → principal "100,0% (parcial)", detalhe "9 de 9 dias úteis desde 28/09".
    - parcial-singular: { coletandoDesde "2026-10-08", aderenciaPct 100, diasUsados 1, diasUteis 1 } → detalhe "1 de 1 dia útil desde 08/10".
    - parcial-zero-por-cento: { coletandoDesde "2026-09-28", aderenciaPct 0, diasUsados 0, diasUteis 3 } → principal "0,0% (parcial)", detalhe "0 de 3 dias úteis desde 28/09".
    - parcial-nunca-multiplica: aderenciaPct 85 com coletandoDesde → "85,0% (parcial)", nunca "8.500,0%".
    - parcial-data-sem-fuso: coletandoDesde "2026-10-01" → detalhe termina com "desde 01/10" (lido com parseISO, nunca o construtor nativo).
    - coletando-sem-dias-uteis-mantem-aviso (substitui coletando-vence-percentual): { coletandoDesde "2026-09-27", aderenciaPct 50, diasUteis 0 } → principal "Coletando dados desde 27/09/2026", sem "%", detalhe null, coletando true (linha inconsistente nunca mostra percentual sem denominador).
    - Continuam SEM edição: nulo-vira-travessao, coletando-com-data, denominador-zero-mesmo-texto, percentual-decimal, singular, pct-nulo-defensivo e os 3 casos de mesclarAderencia. percentual-ja-em-pontos ganha só duas asserções a mais: principal sem "parcial" e detalhe sem "desde" (janela cheia sem marcação).
    - tooltip-texto: TEXTO_TOOLTIP_ADERENCIA é exatamente o texto da P-07 (ou o texto ajustado pelo dono na Tarefa 2).
    - Tabela aderencia-parcial (substitui aderencia-coletando): { aderenciaPct 90, diasUsados 9, diasUteis 10, coletandoDesde "2026-09-28" } → célula contém "90,0% (parcial)" e "9 de 10 dias úteis desde 28/09" e não contém "Coletando".
    - Tabela aderencia-coletando-sem-dias-uteis (novo): { aderenciaPct null, diasUsados 0, diasUteis 0, coletandoDesde "2026-09-28" } → célula contém "Coletando dados desde 28/09/2026" e não contém "%".
    - Tabela: todos os outros casos (inclusive coluna-aderencia-cabecalho com o rótulo acessível vindo da constante, e descricao-menciona-28-dias) continuam verdes SEM edição.
    - Dependência: tests/dashboard/comparativo-vendedor-action.test.ts e tests/dashboard/aderencia-uso-reader.test.ts (com dublês, sem banco) dependem do tipo AderenciaUsoRow e de mesclarAderencia, que moram nos arquivos tocados — por isso rodam no verify desta tarefa e têm de continuar verdes SEM edição.
  </behavior>
  <action>
0. Se o dono pediu na Tarefa 2 um ajuste SÓ de texto de tela (a palavra "(parcial)", a frase "desde" ou o tooltip), usar o texto aprovado por ele no lugar do texto da P-06/P-07, nos testes e no código, e registrar no SUMMARY (per P-12 — é por isso que a decisão vem antes desta tarefa). Ajuste de regra nunca chega aqui (volta ao orquestrador na Tarefa 2).
1. RED — tests/dashboard/aderencia-exibicao.test.ts: escrever os casos novos do behavior com exatamente esses nomes de it; trocar DE PROPÓSITO coletando-vence-percentual por coletando-sem-dias-uteis-mantem-aviso (comentário de uma linha: "Quick 261008-mrf: com dias úteis contados o percentual parcial aparece; sem dias úteis, o aviso continua"); acrescentar as duas asserções de janela cheia em percentual-ja-em-pontos; atualizar tooltip-texto para o texto exato da P-07 (ou o ajustado); atualizar a nota do cabeçalho citando a 0052. tests/dashboard/comparativo-vendedor-table.test.tsx: trocar DE PROPÓSITO aderencia-coletando por aderencia-parcial e acrescentar aderencia-coletando-sem-dias-uteis, como no behavior; nenhum outro caso muda. Rodar os dois arquivos e confirmar que FALHAM. Commit: `test(quick-261008-mrf): add failing tests for partial adherence label and tooltip`.
2. GREEN — lib/aderencia/exibicao.ts (per D-03, P-06/P-07): TEXTO_TOOLTIP_ADERENCIA passa a ser exatamente o texto da P-07 (ou o ajustado). Em rotuloAderencia, a ordem das regras fica: (1) nulo → travessão; (2) NOVO caso parcial — coletandoDesde preenchido E aderenciaPct não nulo E diasUteis maior que zero → principal = percentual formatado (mesmo percentFormatter, nunca multiplicado) + "% (parcial)", detalhe = "N de M" + unidade (singular "dia útil" quando diasUteis é 1, senão "dias úteis") + " desde " + data do coletandoDesde em "dd/MM" (format + parseISO), coletando false; (3) coletandoDesde preenchido → aviso "Coletando dados desde DD/MM/AAAA" como hoje; (4) aderenciaPct nulo → travessão; (5) senão → percentual cheio como hoje. Extrair a escolha da unidade num helper interno pequeno usado pelos casos (2) e (5). Formato do tipo RotuloAderencia NÃO muda. Atualizar o JSDoc do topo e o de rotuloAderencia: quem decide se é parcial é o banco (0052) — enquanto a medição tem menos de 28 dias, coletando_desde vem preenchido e os números já vêm parciais; com denominador zero o aviso continua; o módulo continua sem calcular data nenhuma. lib/supabase/queries/dashboard.ts (per P-08, SÓ comentários): os comentários de AderenciaUsoRow passam a dizer que, durante a coleta (coletandoDesde preenchido e diasUteis maior que zero), diasUteis/diasUsados/aderenciaPct já vêm PARCIAIS desde a data de coletandoDesde (primeiro dia útil contado do vendedor, migration 0052); coletandoDesde preenchido com diasUteis zero = só o aviso; nulo = janela cheia de 28 dias; o JSDoc de getAderenciaUso cita as migrations 0040 e 0052. Tipo, select/rpc e mapeamento ficam idênticos. NÃO tocar em components/dashboard/ComparativoVendedorTable.tsx nem em app/actions/dashboard.ts; se algum teste ou o tsc exigir mudança neles, PARAR e reportar. Rodar o verify até ficar verde (inclui os testes de ação e de leitor — ver Dependência no behavior). Commit: `feat(quick-261008-mrf): partial adherence label and tooltip in the vendedor comparison table`. Todo commit com a linha de coautoria da D-09; nunca adicionar .planning/config.json.
3. Os commits desta tarefa são SÓ locais (per P-04/P-12): NÃO enviar para staging nem para master antes de o dono aplicar a 0052 na Tarefa 4 — a tela nova contra o banco antigo mostraria o número injusto como "(parcial)". A Tarefa 4 confere, imediatamente antes da aplicação, que o commit feat desta tarefa não está em origin/staging nem em origin/master; quem publica é o orquestrador, só depois da Tarefa 5.
  </action>
  <verify>
    <automated>npx vitest run tests/dashboard/aderencia-exibicao.test.ts tests/dashboard/comparativo-vendedor-table.test.tsx tests/dashboard/aderencia-uso-reader.test.ts tests/dashboard/comparativo-vendedor-action.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 lib/aderencia/exibicao.ts lib/supabase/queries/dashboard.ts tests/dashboard/aderencia-exibicao.test.ts tests/dashboard/comparativo-vendedor-table.test.tsx && git diff --quiet b67aed6aff0ca1b9b6fc6c2744b506f21360e333 -- components/dashboard/ComparativoVendedorTable.tsx app/actions/dashboard.ts && echo "OK componente e acao intocados"</automated>
  </verify>
  <acceptance_criteria>
    - Rodada vermelha registrada e agora tudo verde; aderencia-uso-reader e comparativo-vendedor-action verdes SEM edição.
    - Parcial mostra "NN,N% (parcial)" e "N de M dias úteis desde dd/MM" (singular correto); denominador zero e coletandoDesde preenchido continuam no aviso; janela cheia continua sem "(parcial)" e sem "desde".
    - Tooltip exatamente o texto da P-07 (ou o ajustado pelo dono na Tarefa 2, registrado); o rótulo acessível da tabela muda junto, sem editar o componente.
    - lib/supabase/queries/dashboard.ts com diferença só em comentários; ComparativoVendedorTable.tsx e app/actions/dashboard.ts idênticos à base.
    - tsc e eslint --max-warnings 0 limpos nos 4 arquivos.
    - Nenhum push; os commits test/feat desta tarefa ficam só locais até o fim da Tarefa 5.
  </acceptance_criteria>
  <done>A tabela do Supervisor sabe mostrar o percentual parcial com a frase "desde dd/MM", mantendo o aviso para quem não tem dia útil contado — provado por testes de rótulo e de tela, ainda só no computador.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Tarefa 4: [BLOCKING] Dono aplica a 0052 pelo SQL Editor da Supabase (ANTES de qualquer publicação da tela nova)</name>
  <read_first>
    - .planning/STATE.md, seção Blockers/Concerns (o push de schema pelo executor não é usado; aplicação manual pelo dono, mesmo caminho das Fases 27-33 e das quick 261006-gvo/261006-ncy)
  </read_first>
  <action>Pré-condição da ordem segura (per D-08, P-04/P-12), conferida IMEDIATAMENTE antes de enviar o arquivo ao dono: rodar `git fetch origin` e conferir, com `git merge-base --is-ancestor <hash do commit feat da Tarefa 3> origin/staging` e o mesmo contra origin/master, que a mudança de tela ainda NÃO está publicada (os dois comandos devem devolver "não é ancestral") — é o comando automatizado do verify. O executor nunca faz push; quem publica é o orquestrador, só depois da Tarefa 5. Se estiver publicada em algum dos dois, avisar o orquestrador e o dono na hora, em linguagem simples, que aquele site está mostrando o número antigo marcado "(parcial)" até a 0052 ser aplicada, e seguir com a aplicação (ela é a correção). Enviar ao dono o arquivo supabase/migrations/0052_aderencia_uso_parcial.sql pela ferramenta de envio de arquivo ao usuário; se a ferramenta não estiver disponível, informar o caminho absoluto do arquivo. NÃO enviar o arquivo de volta para aplicação. Não tentar db push nem qualquer contorno (nada de gerar credencial, extrair token ou chamar API de gerenciamento) — per D-08. Passar ao dono as instruções do bloco how-to-verify e aguardar a confirmação.</action>
  <what-built>Um arquivo de mudança no banco (0052), aprovado na Tarefa 2, pronto para colar no SQL Editor. A tela nova está só no computador (commits locais), sem afetar nenhum site.</what-built>
  <how-to-verify>
    1. Abrir o SQL Editor do projeto: https://supabase.com/dashboard/project/afbiwgbqkogsrhxjshkk/sql/new
    2. Colar o conteúdo COMPLETO de `0052_aderencia_uso_parcial.sql` (o comentário do topo pode ir junto, é seguro), clicar em "Run" e esperar "Success. No rows returned".
    3. Se aparecer qualquer erro, copiar a mensagem e mandar aqui antes de tentar de novo.
    4. NÃO colar o arquivo `0052_volta_aderencia_uso.sql` — ele só serve se um dia você quiser desfazer.
    5. (Opcional) Abrir o site atual como Supervisor e ver que a coluna "Aderência de uso" continua mostrando "Coletando dados desde ..." — é o esperado até a tela nova ser publicada.
  </how-to-verify>
  <files>supabase/migrations/0052_aderencia_uso_parcial.sql (só leitura — enviado ao dono para colar no SQL Editor; nenhum arquivo do projeto muda neste checkpoint)</files>
  <verify>
    <automated>git fetch origin && H=$(git log --format=%H -n 1 --grep="feat(quick-261008-mrf): partial adherence label") && test -n "$H" && ! git merge-base --is-ancestor "$H" origin/staging && ! git merge-base --is-ancestor "$H" origin/master && echo "OK tela nova ainda nao publicada (pre-condicao da ordem segura)"</automated>
    <human-check>
      <test>O dono cola a 0052 no SQL Editor e informa o resultado.</test>
      <expected>"Success. No rows returned" confirmado pelo dono ("aplicado"); o arquivo de volta não foi colado.</expected>
      <why_human>O executor nunca aplica SQL no banco de produção (D-08); só o dono aplica, pelo SQL Editor.</why_human>
    </human-check>
  </verify>
  <resume-signal>Responda "aplicado" depois de ver "Success", ou cole a mensagem de erro.</resume-signal>
  <acceptance_criteria>
    - A pré-condição foi conferida imediatamente antes de enviar o arquivo (commit feat da Tarefa 3 NÃO contido em origin/staging nem em origin/master), ou o aviso foi dado; o executor não fez push.
    - O dono confirmou "Success" na 0052 (registrado no SUMMARY, com o caminho: SQL Editor, pelo dono); o arquivo de volta não foi aplicado.
    - Nenhuma tentativa de db push ou contorno pelo executor.
    - O SUMMARY sugere ao dono, como passo opcional, `supabase migration repair --status applied 0052` (a 0052 é re-executável — mesma assinatura, só troca o corpo — então um push futuro não quebra mesmo sem o repair).
  </acceptance_criteria>
  <done>A 0052 está aplicada no banco, confirmada pelo dono, antes de qualquer publicação da tela nova.</done>
</task>

<task type="auto">
  <name>Tarefa 5: [BLOCKING] Testes ao vivo a VERDE contra o banco real + gate final + guarda de escopo + SUMMARY</name>
  <files>tests/dashboard/aderencia-parcial.test.ts (só se precisar de correção do próprio teste)</files>
  <read_first>
    - tests/dashboard/aderencia-parcial.test.ts
    - supabase/migrations/0052_aderencia_uso_parcial.sql (aplicada)
    - .planning/STATE.md, Blockers/Concerns (limite de tentativas de login do Supabase Auth; ~49 arquivos vermelhos pré-existentes por contas semente apagadas — NÃO rodar a suíte inteira)
  </read_first>
  <action>
1. Rodar a guarda de escopo (primeiro comando do verify, base b67aed6aff0ca1b9b6fc6c2744b506f21360e333, per D-07) e depois, isolado, `npx vitest run tests/dashboard/aderencia-parcial.test.ts` até ficar verde. NÃO rodar tests/dashboard/aderencia-uso.test.ts (P-10: grava acessos antes do início real da medição no banco de produção). Registrar em que ramo o arquivo novo rodou (medição recente ou janela cheia) — antes de ~25/10/2026 tem de ter rodado no ramo da medição recente; se a aplicação tiver acontecido depois disso, registrar que o ramo parcial não pôde mais ser exercitado ao vivo. Se medicao-intocada falhar ou o beforeAll/afterAll acusar que o menor dia mudou, PARAR na hora e avisar o orquestrador e o dono em linguagem simples (o início da medição do time pode ter mudado) — conferir pelo cliente de serviço, sem imprimir linhas, se sobrou acesso de fixture e apagá-lo. Se um caso falhar por comportamento do banco (por exemplo, P1 sem 100% no ramo da medição recente, dia antes da medição contado, denominador zero sem aviso, Vendedor recebendo linhas), PARAR e reportar ao orquestrador: a correção vira migration NOVA (0053 em diante) com nova aprovação do dono pelo mesmo caminho das Tarefas 2 e 4 — nunca edição da 0052 aplicada nem do arquivo de volta, e nunca uma função nova com privilégio elevado. Se falhar por erro do próprio teste (por exemplo, conta de dia útil no modelo), corrigir o teste sem afrouxar nenhuma asserção de D-01/D-02/D-03 nem a guarda do menor dia, e registrar. Se o limite de login impedir a rodada, esperar e repetir o arquivo isolado (convenção das Fases 13/18/19), registrando. Nunca imprimir linhas lidas durante o diagnóstico (dados reais, LGPD).
2. Rodar o verify completo (o arquivo ao vivo novo de novo, isolado, mais estruturais, rótulo, tabela, leitor, ação, tsc, eslint e build).
3. Registrar no SUMMARY, em português simples: (a) resposta do dono e tudo o que ele reconheceu na Tarefa 2 (incluindo ajuste de texto, se houve, e onde entrou na Tarefa 3); (b) pré-condição conferida imediatamente antes da aplicação e aplicação pelo dono (Tarefa 4); (c) resultado do teste ao vivo novo (8 casos, com o ramo em que rodou) e do gate (arquivos/testes, tsc, eslint, BUILD_EXIT); dizer que o VERMELHO antes da aplicação era esperado e NÃO foi medido (os arquivos ao vivo só rodaram depois da aplicação, de propósito); (d) a prova da D-02 é ESTRUTURAL e não ao vivo, com o raciocínio do "Contrato SQL" em palavras simples (a mudança é a conta antiga com 3 trechos trocados; com 28 dias completos o corte novo não tira dia nenhum, então o número volta a ser exatamente o de antes) e o motivo (provar ao vivo exigiria gravar um dia anterior à medição no banco de produção); (e) o que mudou na tela, em linguagem de tela, e o cuidado do dia de hoje na reunião; (f) alerta de LGPD (dado de uso por pessoa; nenhum dado novo; quem vê não mudou; recomendação de apresentar como uso do CRM nas primeiras semanas; transparência com o time; inventário de 11 intacto); (g) testes mudados DE PROPÓSITO e por quê (coletando-vence-percentual, tooltip-texto, aderencia-coletando, coletando-desde-coerente no ramo da medição recente) e que aderencia-uso.test.ts NÃO foi executado (P-10); (h) semântica das colunas (P-02) e o que a tela antiga fez entre a aplicação e a publicação (P-03); (i) conferência só de leitura para o dono, no SQL Editor: rodar `select min(dia) from acessos_diarios;` — o resultado tem de continuar 2026-09-28 (se vier outra data, avisar antes de qualquer outra coisa); (j) itens adiados: passo opcional `supabase migration repair --status applied 0052`; reescrever a semeadura do aderencia-uso.test.ts para nunca gravar antes do início real da medição (ou rodá-lo só com decisão do dono); nenhuma mudança no componente da tabela; (k) conferência humana do Preview da staging pendente (bloco human-check) e instrução ao orquestrador: AGORA (banco aplicado + gate verde) enviar os commits para staging, conferir o Preview, e só depois levar para master; (l) como voltar atrás: primeiro reverter o commit feat da Tarefa 3 e publicar; só depois colar supabase/rollbacks/0052_volta_aderencia_uso.sql (nada é apagado; na ordem inversa a tela mostraria o número injusto como "(parcial)"); (m) linha de coautoria usada nos commits: "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" (D-09).
Commit `test(quick-261008-mrf): ...` só se algum teste ao vivo precisou de correção (com a linha de coautoria da D-09, sem .planning/config.json); caso contrário, nenhum commit de código nesta tarefa. Não fazer push.
  </action>
  <verify>
    <automated>node -e "const cp=require('child_process');const g=a=>cp.execFileSync('git',a).toString();const base='b67aed6aff0ca1b9b6fc6c2744b506f21360e333';console.log('BASE='+g(['rev-parse',base]).trim());const ok=new Set(['supabase/migrations/0052_aderencia_uso_parcial.sql','supabase/rollbacks/0052_volta_aderencia_uso.sql','tests/dashboard/aderencia-parcial-migracao.test.ts','tests/dashboard/aderencia-parcial.test.ts','tests/dashboard/aderencia-uso.test.ts','lib/aderencia/exibicao.ts','lib/supabase/queries/dashboard.ts','tests/dashboard/aderencia-exibicao.test.ts','tests/dashboard/comparativo-vendedor-table.test.tsx']);const permitido=f=>f.startsWith('.planning/')||ok.has(f);const mudados=g(['diff','--name-only',base,'HEAD']).split('\n').map(s=>s.trim()).filter(Boolean);const sujos=g(['status','--porcelain']).split('\n').filter(Boolean).filter(l=>!l.startsWith('??')).map(l=>l.slice(3).trim());const fora=mudados.concat(sujos).filter(f=>!permitido(f));if(fora.length)throw new Error('fora do escopo: '+fora.join(', '));const mig=g(['diff','--name-status',base,'HEAD','--','supabase/migrations']).split('\n').map(s=>s.trim()).filter(Boolean);if(mig.length!==1||mig[0]!=='A\tsupabase/migrations/0052_aderencia_uso_parcial.sql')throw new Error('migrations: '+mig.join(' | '));const rb=g(['diff','--name-status',base,'HEAD','--','supabase/rollbacks']).split('\n').map(s=>s.trim()).filter(Boolean);if(rb.length!==1||rb[0]!=='A\tsupabase/rollbacks/0052_volta_aderencia_uso.sql')throw new Error('rollbacks: '+rb.join(' | '));console.log('OK escopo 261008-mrf')" && npx vitest run tests/dashboard/aderencia-parcial.test.ts && npx vitest run tests/dashboard/aderencia-parcial-migracao.test.ts tests/dashboard/aderencia-exibicao.test.ts tests/dashboard/comparativo-vendedor-table.test.tsx tests/dashboard/aderencia-uso-reader.test.ts tests/dashboard/comparativo-vendedor-action.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/migracao-agenda2-observacoes.test.ts tests/clientes/apagar-cliente-migracao.test.ts tests/agenda/agenda-sem-visitas-migracao.test.ts && npx tsc --noEmit && npx eslint --max-warnings 0 lib/aderencia/exibicao.ts lib/supabase/queries/dashboard.ts tests/dashboard/aderencia-parcial-migracao.test.ts tests/dashboard/aderencia-parcial.test.ts tests/dashboard/aderencia-uso.test.ts tests/dashboard/aderencia-exibicao.test.ts tests/dashboard/comparativo-vendedor-table.test.tsx && (npm run build; code=$?; echo "BUILD_EXIT=$code"; exit $code)</automated>
    <human-check>
      <test>Depois que o orquestrador enviar os commits para a branch staging, abrir o link de Preview da staging na Vercel (projeto RAIAR; exige login na Vercel) e entrar como Supervisor: (1) no Dashboard, tabela "Comparativo por vendedor", a coluna "Aderência de uso" mostra para cada vendedor algo como "NN,N% (parcial)" com "N de M dias úteis desde 28/09" embaixo (ou a data de entrada de quem entrou depois); (2) passar o mouse no ícone (?) da coluna — o texto explica o "(parcial)"; (3) as outras colunas (taxa de conversão, negócios, ciclo médio) estão iguais às do site real; (4) entrar como um vendedor — o Dashboard dele continua sem a tabela de comparativo. Não fotografar nem compartilhar a tela fora da empresa (dado de uso por pessoa).</test>
      <expected>Percentual parcial com a frase "desde dd/MM" para quem tem dia útil contado; aviso "Coletando dados desde ..." só para quem não tem; tooltip novo; nada mais muda; vendedor continua sem ver a tabela.</expected>
      <why_human>Conferência visual no site publicado de teste antes de levar para produção (CLAUDE.md, Fluxo de Deploy); os testes automáticos não abrem o Preview da Vercel.</why_human>
    </human-check>
  </verify>
  <acceptance_criteria>
    - tests/dashboard/aderencia-parcial.test.ts verde por inteiro (8 casos, incluindo medicao-intocada) contra o banco real, com o ramo registrado; tests/dashboard/aderencia-uso.test.ts NÃO executado (P-10), registrado como item adiado.
    - Nenhuma linha de acessos_diarios gravada com data anterior ao início real da medição; o SUMMARY traz a conferência só de leitura para o dono (`select min(dia) from acessos_diarios;` = 2026-09-28).
    - Gate verde: estruturais (0052 + inventário + 0049/0050/0051), rótulo, tabela, leitor, ação; tsc; eslint --max-warnings 0 nos 7 arquivos de código/teste tocados; BUILD_EXIT=0 impresso.
    - Guarda de escopo OK desde b67aed6: só os 9 arquivos planejados (mais .planning/); supabase/migrations com exatamente uma linha "A" (a 0052); supabase/rollbacks com exatamente uma linha "A" (a volta da 0052); Agenda, componente da tabela e ações intocados.
    - Nenhuma asserção de D-01/D-02/D-03 afrouxada; qualquer correção de teste ou migration nova registrada no SUMMARY.
    - SUMMARY com os itens (a)-(m) da action; nenhum push pelo executor.
  </acceptance_criteria>
  <done>A conta parcial está no banco e provada contra ele, a tela nova está pronta (commits locais) para ir ao staging, e o pacote inteiro está dentro do escopo combinado.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navegador (Supervisor/Vendedor/visitante) -> PostgREST -> dashboard_aderencia_uso() | Leitura agregada por pessoa; a função roda como quem chama e só o filtro de Supervisor + RLS decidem quem recebe linhas |
| executor/dono -> banco de produção | Mudança de função com efeito imediato no banco único; só com aprovação explícita e aplicação pelo dono |
| commits locais -> branch staging -> branch master | Tela nova lê a semântica nova; publicar antes da 0052 mostraria o número injusto como "(parcial)"; Preview usa o mesmo banco da produção |
| dono (controlador) -> vendedores (titulares) | Métrica de uso do sistema por pessoa apresentada em reunião |
| suíte de testes -> banco de produção | Fixtures temporárias no projeto que guarda dados reais; o início da medição é global (menor dia de acessos_diarios), então qualquer acesso gravado antes dele afetaria o time inteiro |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mrf-01 | Information Disclosure | Vendedor ou visitante lendo a aderência de colegas | high | mitigate | Filtro `(select is_supervisor())` copiado sem mudança (prova estrutural corpo-0040-com-tres-trocas e mesma-autorizacao-sem-elevacao); casos ao vivo rls-vendedor-zero-linhas e anonimo-zero-linhas |
| T-mrf-02 | Elevation of Privilege | função recriada com privilégio elevado ou permissão nova | high | mitigate | Estrutural: sem a cláusula de elevação, sem grant/revoke, assinatura igual à 0040; inventário de 11 em migracao-agenda2 sem edição; guarda de escopo exige só a linha "A" da 0052 |
| T-mrf-03 | Tampering (integridade da métrica) | tela nova publicada antes da 0052 mostrando o percentual cru injusto como "(parcial)" | high | mitigate | P-04/P-12: commits da Tarefa 3 só locais; checkpoint de decisão (Tarefa 2) avisa o orquestrador; pré-condição da Tarefa 4, imediatamente antes da aplicação, confere que o commit feat da Tarefa 3 não está em origin/staging nem origin/master; o orquestrador só publica depois da Tarefa 5; volta atrás na ordem inversa documentada no arquivo de volta e no SUMMARY |
| T-mrf-04 | Information Disclosure (LGPD) | uso da métrica de uso por pessoa como avaliação individual de desempenho | medium | transfer | Decisão do dono como controlador: alerta na Tarefa 2 (dado de funcionário, nenhum dado novo, apresentar como uso do CRM nas primeiras semanas, transparência com o time); quem vê não muda (só Supervisor); registrado no SUMMARY |
| T-mrf-05 | Tampering | edição de migration antiga ou corpo divergente da 0040 fora das 3 trocas | medium | mitigate | Teste estrutural compara 0040 + 3 trocas com a 0052 e o bloco da volta com a 0040; guarda de escopo (uma migration nova, nenhuma antiga alterada) |
| T-mrf-06 | Tampering | aplicação em produção sem revisão | high | mitigate | Checkpoint bloqueante da Tarefa 2 antes de qualquer envio/aplicação; dono aplica pelo SQL Editor; executor nunca aplica, nunca faz push nem db push |
| T-mrf-07 | Denial of Service | comentário de dois hífens ou caractere não ASCII quebrando a colagem no SQL Editor | low | mitigate | Estrutural comentarios-seguros e volta-restaura-0040 (ASCII puro, nenhuma linha de dois hífens, exatamente 2 cifrões duplos) |
| T-mrf-08 | Information Disclosure (LGPD) | testes ao vivo no banco real | medium | mitigate | Fixtures descartáveis com nomes inventados, 2 logins, leituras filtradas por ids de fixture, nada impresso, limpeza de clientes/acessos antes de apagar os membros |
| T-mrf-09 | Tampering (integridade da métrica do time) | teste ao vivo gravando acesso antes do início real da medição e mudando o início da medição de todo o time (para sempre, se a limpeza falhar) | high | mitigate | Revisão do checador: o caso que fechava a janela ao vivo foi REMOVIDO; a identidade com a 0040 na janela cheia é provada estruturalmente (corpo-0040-com-tres-trocas + raciocínio do Contrato SQL); toda gravação do arquivo novo passa por semearAcessosSeguro (recusa dia anterior ao menor dia real); menor dia relido depois da semeadura, no caso medicao-intocada e no afterAll; aderencia-uso.test.ts (que grava antes) NÃO é executado nesta quick task (P-10); o dono confere `select min(dia) from acessos_diarios;` = 2026-09-28 |
| T-mrf-10 | Denial of Service | custo extra da função | low | accept | Uma junção a mais com uma linha (medicao) e um min() no agregado; volume de 15 vendedores x 20 dias |
</threat_model>

<source_audit>
SOURCE  | ID   | Item | Tarefa | Status
------- | ---- | ---- | ------ | ------
GOAL    | —    | Aderência de uso parcial e justa no Comparativo por vendedor para a reunião de 13/10 | 1, 3, 4, 5 | COVERED
REQ     | QUICK-261008-mrf | Pedido do dono de 2026-10-08 | 1-5 | COVERED
CONTEXT | D-01 | Calendário desde max(início da medição, admissão, reativação); nunca antes da medição; numerador inalterado; cru de 20 nunca liberado | 1 (0052 T1/T2, casos ao vivo parcial-cem-por-cento e antes-da-medicao-nao-conta), 3 (só mostra parcial com dados da 0052) | COVERED
CONTEXT | D-02 | Janela cheia idêntica à 0040; "(parcial)" some sozinho | 1 (prova ESTRUTURAL corpo-0040-com-tres-trocas + raciocínio do Contrato SQL; o caso ao vivo que fechava a janela foi removido por exigir gravar antes da medição — revisão do checador), 3 (percentual-ja-em-pontos sem "parcial"), 5 (raciocínio registrado no SUMMARY) | COVERED
CONTEXT | D-03 | "90,0% (parcial)" + "N de M dias úteis desde dd/MM"; singular; denominador zero mantém aviso/travessão; tooltip; quem vê e outras colunas iguais | 3, 1 (denominador-zero-mantem-aviso, rls-vendedor-zero-linhas) | COVERED
CONTEXT | D-04 | Migration nova 0052, mesma assinatura, compatível com produção, ASCII em bloco, mesmas cláusulas, sem função elevada nova, inventário intacto, volta atrás NAO APLICAR | 1, 2, 4 | COVERED
CONTEXT | D-05 | exibicao.ts; dashboard.ts e componente só se necessário | 3 (dashboard.ts só comentários; componente intocado, P-06/P-08) | COVERED
CONTEXT | D-06 | Testes atualizados de propósito; estruturais 0052; ao vivo vermelhos até aplicar (100% parcial, denominador zero); janela cheia = 0040 provada estruturalmente; nenhum acesso gravado antes do início real da medição (medicao-intocada); sem suíte legada | 1, 3, 5 | COVERED
CONTEXT | D-07 | Gate (testes afetados, tsc, eslint, build com exit code, guarda de escopo); commit local; sem push | 5 | COVERED
CONTEXT | D-08 | Agente nunca aplica SQL; checkpoints de decisão + ação humana em português simples com alerta LGPD; pronto antes de 13/10 | 2, 4 | COVERED
CONTEXT | D-09 | Linha de coautoria nos commits; .planning/config.json fora dos commits | 1, 3, 5 | COVERED
</source_audit>

<verification>
- Tarefa 1: estrutural vermelho -> verde (6 casos, incluindo a prova estrutural da D-02); inventário de 11 e estruturais 0049/0050/0051 sem edição; uma migration nova; ao vivo escrito (com a guarda do menor dia) e não executado; aderencia-uso só com o caso coletando-desde-coerente alterado e a nota de ATENÇÃO.
- Tarefa 2: aprovação explícita com LGPD, cuidado na reunião, ordem com banco primeiro e volta atrás reconhecidos; ajuste de texto (se houver) registrado para a Tarefa 3; orquestrador avisado para não publicar.
- Tarefa 3: rótulo e tabela vermelho -> verde (com o ajuste de texto do dono, se houver); leitor e ação sem edição; componente e ações idênticos à base; dashboard.ts só comentários; commits só locais.
- Tarefa 4: nada publicado conferido imediatamente antes; dono aplica a 0052 no SQL Editor com "Success"; volta atrás não aplicada.
- Tarefa 5: 8 casos ao vivo novos verdes (ramo registrado; menor dia intocado); aderencia-uso não executado (P-10); gate (estruturais, rótulo, tabela, leitor, ação, tsc, eslint --max-warnings 0, BUILD_EXIT=0) verde; guarda de escopo OK; conferência do menor dia para o dono no SUMMARY; Preview pendente para depois do envio à staging.
</verification>

<success_criteria>
- O Supervisor vê "NN,N% (parcial)" e "N de M dias úteis desde dd/MM" para cada vendedor com dia útil contado, calculado só desde o início da medição (ou entrada/reativação); quem não tem dia útil contado continua com o aviso; o tooltip explica o parcial.
- Quem usou o sistema em todo dia útil desde o início aparece com 100,0% (parcial); dia anterior à medição nunca conta; com a janela cheia o número é idêntico ao da 0040 e o "(parcial)" some sozinho.
- Exatamente uma migration nova, mesma assinatura, sem permissão nova nem função elevada nova; nenhuma migration antiga editada; Agenda, componente da tabela e ações intocados; volta atrás pronta com a ordem certa documentada.
- O dono aprovou (com o alerta de LGPD) e aplicou a 0052 ANTES de qualquer publicação; testes ao vivo verdes depois disso.
</success_criteria>

<output>
Criar `.planning/quick/261008-mrf-aderencia-de-uso-parcial-no-comparativo-/261008-mrf-SUMMARY.md` com os itens (a)-(m) da Tarefa 5, os hashes dos commits, o BASE impresso pela guarda e as notas para o dono em linguagem simples.
Não fazer push. Ordem para o orquestrador: NADA vai para staging antes de o dono aplicar a 0052 (Tarefa 4) e o gate da Tarefa 5 ficar verde; depois disso, staging -> conferência do Preview -> master (CLAUDE.md, "Fluxo de Deploy").
</output>
