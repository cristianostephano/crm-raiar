# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.2 — Gestão de Equipe, Análises de Funil e Filtros

**Shipped:** 2026-08-06
**Phases:** 5 | **Plans:** 22 | **Sessions:** ~1 longa sessão (com pelo menos uma interrupção por limite de uso semanal)

### What Was Built
- Kanban: cada uma das 7 colunas ganhou altura fixa e rolagem própria (`ScrollColumnShell`), sem quebrar o drag-and-drop/auto-scroll do dnd-kit.
- Estado/Cidade estruturados em cadastro, edição, filtro e importação — lista fixa de 27 UFs + lista oficial de municípios do IBGE em cascata, substituindo texto livre.
- Desativação de membro da equipe: transferência dos clientes em andamento para um substituto, trava contra desativar o último Supervisor, corte de acesso via Supabase Auth `ban_duration`, histórico e números fechados preservados.
- Funil de conversão detalhado no Dashboard (por etapa: quantidade, % avançou, perdidos, tempo médio parado) + tempo médio até ganho/perdido, separados.
- Comparativo por vendedor no Dashboard (Supervisor-only): conversão, negócios iniciados/ganhos, ciclo médio em dias (ganho-only).

### What Worked
- Verificação manual real no navegador ao final de cada fase continuou pegando o que testes automatizados não alcançam — inclusive um bug real de produção (ver abaixo).
- Testes de integração contra o banco real (não mockado) seguem pegando bugs de RLS/PL/pgSQL que testes mockados não pegariam — reforça a lição já registrada em v1.1.
- `gsd-ui-checker` pegou uma inconsistência real entre UI-SPEC e o código-fonte real em 3 fases seguidas (8, 11, 12) — todas relacionadas a valores de estilo citados de cabeça em vez de lidos do componente de referência.
- O planejador (`gsd-planner`) pegou um bug de percentual (`formatConversao` renderizando 0.625 como "0,6%" em vez de "62,5%") ainda na fase de planejamento, antes de qualquer código ser escrito.

### What Was Inefficient
- **Colisão de numeração de migration**: Fase 10 e Fase 11 rodaram em paralelo (worktrees separados) e cada uma nomeou sua migration `0008_*.sql` de forma independente. Só foi pega porque o orquestrador desconfiou de um "up to date" bom demais do `supabase db push --dry-run` e checou manualmente com `migration list`. Exigiu renumerar a Fase 11 para `0009` e reconciliar histórico local/remoto no meio da execução.
- **Bug de produção descoberto só na checagem humana ao vivo**: `dashboard_funil_detalhado()` (Fase 11) podia mostrar `avancou_pct` acima de 100% porque o drag-and-drop não-adjacente do kanban permite pular etapas; a CTE original contava "avançou" a partir do maior estágio já alcançado, sem exigir que o cliente tivesse realmente passado pela etapa. Corrigido com uma migration corretiva (`0010`) escrita e verificada pelo próprio orquestrador, fora do fluxo normal de executor.
- **Arquivos VERIFICATION.md sem o prefixo do número de fase**: as Fases 10, 11 e 12 salvaram seus relatórios como `VERIFICATION.md` em vez de `NN-VERIFICATION.md`. O conteúdo estava correto (status `passed` nas três), mas a ferramenta de fechamento de marco (`init.manager`) não os reconhecia e reportava as três fases como sem verificação — só descoberto ao rodar `/gsd-complete-milestone`, exigindo renomear os três arquivos manualmente antes de prosseguir.
- Lista de "accomplishments" gerada automaticamente pelo `milestone.complete` veio granular demais (uma linha por plano, 21 itens) e incluiu uma linha de ruído puxada de um resumo de worktree ("Restored .env.local") — precisou de edição manual para virar 5 itens de verdade, um por fase.
- Sandbox do Claude Code bloqueou `supabase link`/`supabase db push` repetidamente (executores de subagente e, ocasionalmente, o próprio orquestrador) — resolvido na maioria das vezes com uma nova tentativa do orquestrador; só uma vez precisou que o usuário rodasse o comando manualmente.

### Patterns Established
- RPCs de leitura para o dashboard seguem `SECURITY INVOKER` sem exceção — as únicas duas `SECURITY DEFINER` do projeto inteiro (`desativar_membro_equipe`/`reativar_membro_equipe`) são documentadas como exceção deliberada, porque precisam chamar a Auth Admin API via `service_role`.
- Reconstrução de duração por etapa a partir do `historico` (entrada sintética + `LEAD()` + `COALESCE` de três vias) virou um padrão reutilizável entre Fase 11 e Fase 12.
- Fixtures descartáveis (`createTestMember`/`deleteTestMember`) em vez de contas seed compartilhadas — necessário para contagens determinísticas em testes de integração que dependem de estado exato.
- Sempre reler o SQL de uma migration linha a linha antes de aprovar o push, mesmo quando o executor já relatou sucesso — pegou o bug do `avancou_pct` antes que ele fosse considerado "fase pronta".

### Key Lessons
1. Ao rodar fases em paralelo (worktrees), nomear migrations por convenção fixa ligada ao número da fase (ou checar `ls supabase/migrations/` no momento da execução, nunca confiar em um número decidido durante o planejamento) evita colisões de numeração.
2. Nomear artefatos de verificação sempre com o prefixo do número de fase (`NN-VERIFICATION.md`) — um nome "quase certo" engana a ferramenta de fechamento de marco mesmo com o conteúdo perfeito.
3. "Testes passando" não prova comportamento correto quando a lógica depende de dados reais de uso (o bug de `avancou_pct` só apareceu com dados reais de um kanban com drag não-adjacente) — a checagem humana ao vivo continua sendo a rede de segurança que pega esse tipo de coisa.
4. Accomplishments gerados automaticamente por ferramenta a partir de `provides:` de cada plano tendem a vir granulares e ocasionalmente ruidosos — sempre revisar e condensar antes de aceitar no `MILESTONES.md`.

### Cost Observations
- Model mix: majoritariamente sonnet (planner/executor/verifier), plan-checker/ui-checker em modelos mais baratos para verificação estrutural.
- Rate-limit do Supabase Auth ("Request rate limit reached") apareceu repetidamente entre as três fases por volume acumulado de sign-ins de verificação na mesma sessão — tratado consistentemente como ruído de infraestrutura de free-tier, não regressão de código, depois de confirmado por reruns isolados dos arquivos de teste específicos.
- Nenhum retrabalho de funcionalidade foi necessário — os dois problemas reais encontrados (colisão de migration, bug de `avancou_pct`) foram ambos corrigidos dentro da própria sessão de execução, antes do fechamento do marco.

---

## Milestone: v1.1 — Importação e Exportação de Clientes

**Shipped:** 2026-07-25
**Phases:** 3 | **Plans:** 9 | **Sessions:** ~2-3 (spanning multiple usage-limit resets)

### What Was Built
- Exportação da lista de clientes para planilha (.xlsx), respeitando RLS (Vendedor exporta só os próprios, Supervisor exporta todos) e os filtros já aplicados na tela.
- Fluxo completo de importação em 3 telas: upload (.xlsx/.csv com detecção pt-BR de BOM/separador), mapeamento de colunas para os campos do sistema, e revisão linha a linha (OK/erro/possível duplicado) — tudo sem gravar nada no banco.
- A única escrita nova do marco: uma RPC `importar_clientes_lote` (não-security-definer, guard explícito de Supervisor, inserção set-based com `ON CONFLICT DO NOTHING`) que grava o lote inteiro de uma vez, sem que uma linha ruim trave as boas, sempre entrando na etapa "Aguardando contato".
- Tela de resumo pós-confirmação ("X importados, Y pulados" com motivos).

### What Worked
- Verificação manual real no navegador ao final de cada fase (não só os testes automatizados) pegou detalhes que só apareceriam em uso real — e nas 3 fases desse marco, o fluxo bateu com o esperado de primeira.
- O padrão de plan-checker independente antes de cada execução (não só o próprio planner se auto-validando) segurou a qualidade sem custar muito tempo.
- Isolar cada fase em waves sequenciais com dependências claras (upload → confirmação → gravação) evitou qualquer necessidade de retrabalho entre fases.
- O teste de integração do RPC (Fase 7) rodando contra o banco real — não mockado — pegou dois bugs reais de PL/pgSQL antes de qualquer humano ver a tela (shadowing de variável no `ON CONFLICT`, e uma CTE que quebrava a visibilidade de RLS entre dois inserts encadeados).

### What Was Inefficient
- Sessão interrompida por limite de uso 3 vezes (Wave 2 da Fase 6, planejamento da Fase 7 duas vezes) — cada vez exigiu checar `git log`/filesystem manualmente pra confirmar se era seguro retomar ou re-despachar do zero. Nenhum trabalho foi perdido, mas consumiu tempo de verificação.
- Isolamento por git worktree (`isolation="worktree"`) funcionou de forma inconsistente: às vezes materializava de verdade (Fase 7), às vezes não (a maior parte da Fase 6) — exigindo checagem manual a cada wave pra saber se precisava de merge ou já estava tudo no branch principal.
- As pastas de documentação das Fases 1-4 (v1.0) foram apagadas antes de um `/gsd-complete-milestone` formal ter rodado pra elas — só foi descoberto no fechamento do v1.1, quando a ferramenta de fechamento bloqueou por "fases sem pasta". Ideal seria ter fechado o v1.0 formalmente antes de começar o v1.1.
- Um checkbox desatualizado no ROADMAP.md (Fase 1 marcada como incompleta mesmo já tendo sido finalizada dias antes) também só foi pego no fechamento do marco, não durante o trabalho normal.

### Patterns Established
- Toda RPC de escrita nova segue o padrão de `mover_card_funil`: não-security-definer, guard explícito de papel, nunca `security definer` — mantém o RLS como única fonte de autorização.
- Inserção em lote é sempre set-based (`INSERT ... SELECT ... FROM jsonb_to_recordset(...) ON CONFLICT DO NOTHING`), nunca um loop linha a linha com captura de exceção — necessário pelo limite de ~10s do Vercel Hobby, e evita que uma linha ruim trave o lote inteiro.
- Fluxos de múltiplos passos (upload → mapear → revisar → confirmar) primeiro validam e mostram tudo na tela sem gravar nada, e só fazem a escrita real no último passo, depois de revalidar o que pode ter mudado entre a revisão e a confirmação.
- Após cada fase de execução, checagem manual real no navegador (login como o papel certo, ação de ponta a ponta) antes de considerar a fase pronta — não só os testes automatizados.

### Key Lessons
1. Rodar `/gsd-complete-milestone` logo que um marco realmente termina, antes de começar o próximo — evita que as pastas de fase sumam do disco sem o registro histórico correspondente.
2. Quando `isolation="worktree"` é solicitado mas não se sabe se vai materializar de fato neste ambiente, sempre checar `git worktree list` e `git log` após cada wave antes de assumir onde o trabalho está.
3. Testes de integração contra o banco real (não mockado) valem o custo extra de tempo — pegaram bugs de RLS/PL/pgSQL que um teste mockado nunca pegaria.

### Cost Observations
- Model mix: majoritariamente sonnet (planner/executor/verifier), com plan-checker em haiku (mais barato, adequado pra verificação estrutural).
- Sessões: múltiplas, com pelo menos 3 interrupções por limite de uso recuperadas sem perda de trabalho.
- Notável: nenhum retrabalho de código foi necessário neste marco — todos os gaps encontrados no fechamento foram de documentação/registro (ROADMAP desatualizado, pastas de fase apagadas), não de funcionalidade.

---

## Milestone: v1.3 — Agenda do Vendedor

**Shipped:** 2026-08-10
**Phases:** 5 | **Plans:** 19 | **Sessions:** ~1 sessão contínua longa (múltiplas interrupções por limite de uso, todas recuperadas sem perda de trabalho)

### What Was Built
- Cliente "ganho" define frequência de visita (semanal/quinzenal/mensal/nenhuma) no momento da conversão, com semeadura atômica/idempotente da primeira visita, editável depois na ficha (Fase 13).
- Tela "Agenda" unificando tarefas de prospecção e visitas de pós-venda numa lista só, ordenada atrasado→hoje→próximos dias, com filtro de vendedor (Supervisor) e contador no menu (Fase 14).
- Concluir um item da agenda exige resumo curto (10-500 caracteres); concluir uma visita sugere a próxima data (calculada no Postgres, nunca no navegador) que o vendedor confirma ou ajusta (Fase 15).
- Ficha do cliente ganha Nome Fantasia, CNPJ, frequência de pedidos (5ª lista editável do projeto) e um Diário de visitas/tarefas concluídas (Fase 16).
- Supervisor define frequência de visita em massa via planilha (reaproveitando o assistente de importação da v1.1); Vendedor/Supervisor exportam o diário como planilha (Fase 17).

### What Worked
- Verificação humana ao vivo no navegador, feita pessoalmente em todo checkpoint (não delegada), continuou sendo a rede de segurança real — pegou nada de errado desta vez, mas confirmou positivamente comportamentos de risco (data de virada de mês, isolamento de diálogo, histórico sem prefixo) que só um teste automatizado não provaria com a mesma confiança.
- Planejadores de fase leram o código-fonte real (não só a spec) e encontraram 3 lacunas genuínas não previstas na pesquisa/UI-SPEC antes de qualquer linha de implementação: nome de cliente ambíguo na planilha de frequências (Fase 17), cliente repetido na mesma planilha (Fase 17), e o prop `fields` faltando no sketch original do `ColumnMappingTable` genérico (Fase 17).
- Pesquisadores de UI, ao não terem a ferramenta de pergunta interativa disponível em seu contexto isolado, documentaram decisões-padrão explícitas e sinalizadas em vez de travar silenciosamente — o orquestrador conseguiu revisar e confirmar/reverter cada uma no checkpoint seguinte (ex.: frequência de pedidos virou lista fixa em vez do texto livre default, por decisão explícita do dono).
- RLS como única fronteira de autorização se manteve sem exceção nova em 5 migrations (0013-0017) — o projeto continua com as mesmas 4 exceções `SECURITY DEFINER` documentadas desde o v1.2.

### What Was Inefficient
- **Push de migration bloqueado pelo classificador de modo automático do harness**: em 3 fases (14, 15, 16, 17), o comando `supabase db push` foi bloqueado tanto para o subagente executor quanto, na primeira tentativa, para o próprio orquestrador — resolvido rodando o comando manualmente a partir da pasta certa do worktree (o erro real na maioria das vezes era rodar no checkout principal em vez do worktree, não o bloqueio em si).
- **Perda de isolamento de worktree em pleno meio de execução** (Fase 16, plano 16-04): uma interrupção por limite de sessão fez o worktree do subagente desaparecer do disco entre um commit e outro; o commit da Task 1 acabou pousando direto no `master` (na base certa, sem divergência) — resolvido continuando a execução das tasks restantes diretamente no checkout principal, sem recriar isolamento para o único plano restante da fase.
- **Ferramenta de automação de navegador falhando em clicar em elementos reais** (recorrente em várias fases): cliques via `ref` simples não registravam em cards do Kanban/Agenda envolvidos por `dnd-kit`, mas um clique programático (`dispatchEvent` de `pointerdown`/`pointerup` seguido de `.click()`) sempre funcionou — confirmado repetidas vezes como peculiaridade do ambiente de automação, nunca um bug real de código, comparando com o comportamento idêntico em componentes já em produção e não tocados na fase.
- Um falso positivo não corrigível na regex de verificação mecânica de uma task (Fase 17-05) — o padrão que proíbe reusar `ImportSummary` também casava dentro de `FrequenciaImportSummary`, o componente que a própria task pedia para criar; confirmado manualmente que nenhuma peça real do fluxo de clientes foi reusada.

### Patterns Established
- Toda fase com migration nova segue o mesmo roteiro: checkpoint humano com explicação em português simples do que a migration faz e não faz → aprovação → push feito pelo orquestrador (não pelo subagente) → testes rodados até GREEN → SUMMARY.md.
- `frequencia_visita`/`frequencia_pedidos` seguem a mesma regra: um valor único guardado em `clientes`, nunca duplicado entre tela e recorrência — qualquer fase nova que tocar cadência de cliente deve reusar a coluna existente, nunca criar uma segunda fonte de verdade.
- Cálculo de data sempre no Postgres (nunca `new Date(string)` no navegador) — regra herdada da Fase 15 e reaplicada sem exceção nas Fases 16/17.
- RPCs de escrita em massa (padrão: `atualizar_frequencia_visita_lote`) seguem o mesmo molde de `importar_clientes_lote`: instrução única set-based, guard explícito de papel, nunca `SECURITY DEFINER`, e — quando a operação é só de atualização — estruturalmente incapazes de criar linha nova (garantido pela forma do SQL, verificado mecanicamente por contagem de instruções).
- Verificação pessoal em produção sempre que possível (login com a conta real do Supervisor, dados reais de clientes de teste) em vez de só aceitar a palavra do subagente — inclusive reproduzindo bugs suspeitos comparando com componentes não tocados na fase antes de concluir se é regressão ou ambiente.

### Key Lessons
1. Um bloqueio de segurança do harness em ação de escrita em produção (`supabase db push`) não é um bug — é a proteção funcionando; a resposta certa é rodar a ação manualmente, com aprovação explícita do dono, nunca tentar contornar por outro caminho (ex.: API administrativa direta).
2. Quando um subagente perde isolamento de worktree em pleno meio de plano (por interrupção de sessão), a recuperação mais segura costuma ser continuar diretamente no checkout principal para o restante daquele plano específico, não recriar um worktree novo — desde que o HEAD já esteja exatamente na base esperada, sem divergência.
3. Cliques de automação de navegador em elementos envolvidos por bibliotecas de drag-and-drop (`dnd-kit`) são pouco confiáveis via evento sintético simples; `pointerdown`+`pointerup`+`click` programático é o fallback que sempre funcionou neste projeto.
4. Pesquisadores/planejadores sem acesso à ferramenta de pergunta interativa devem documentar decisões-padrão como *decisões explícitas sinalizadas para revisão*, nunca como fato consumado — permite ao orquestrador confirmar ou reverter no checkpoint seguinte sem re-fazer o trabalho.
5. Ler o código-fonte real do fluxo análogo (não só a spec ou a pesquisa) antes de planejar continua sendo o que revela lacunas genuínas (ambiguidade de nome, duplicata de linha, prop faltando) antes que virem bugs em produção.

### Cost Observations
- Model mix: planner em opus, executor/researcher em sonnet, plan-checker/ui-checker em haiku — mesmo padrão de v1.2, mantido estável.
- Rate-limit do Supabase Auth apareceu de novo (mesmo padrão de v1.2/v1.1) — mitigado com re-execução isolada dos arquivos de teste específicos após um período de espera, nunca tratado como regressão de código.
- Nenhum retrabalho de funcionalidade foi necessário — todos os desvios encontrados (3 lacunas de planejamento, 1 perda de isolamento de worktree, falsos positivos de verificação mecânica) foram absorvidos dentro da própria execução da fase, sem reabrir trabalho já fechado.

---

## Milestone: v1.4 — CNPJ Obrigatório no Ganho

**Shipped:** 2026-08-14
**Phases:** 2 | **Plans:** 6 | **Sessions:** ~1 sessão longa (múltiplas interrupções por limite de sessão/semanal, todas recuperadas sem perda de trabalho)

### What Was Built
- `mover_card_funil` estendido com o 7º parâmetro `p_cnpj`: exigir CNPJ passa a valer só na transição pra "ganho" (nunca retroativo), migration 0018 em produção (Fase 18).
- Diálogo de ganho (`GanhoFrequenciaDialog`) ganha campo CNPJ ao lado da frequência de visita; `ClienteDetailSheet` sincroniza o valor recém-informado de volta no formulário — corrige um bug real encontrado no planejamento (o salvamento seguinte apagaria o CNPJ que acabou de ser exigido) (Fase 18).
- `importar_clientes_lote` recriada para gravar `cnpj`/`nome_fantasia` (antes descartados em silêncio) e CNPJ/Nome Fantasia atravessam toda a cadeia do assistente "Importar clientes" já existente (Fase 19).
- Nova RPC `atualizar_cnpj_lote` e planilha "CNPJ em massa" completa (vocabulário, anotação com recusa de nome ambíguo, assistente de três passos, rota exclusiva de Supervisor, menu) — espelha o padrão de "Frequência em Massa" da Fase 17 arquivo por arquivo (Fase 19).

### What Worked
- Pular discuss-phase e research nas duas fases (decisão do dono do projeto, confirmada via pergunta explícita antes de cada planejamento) foi a escolha certa: o escopo já estava fechado pela conversa e o precedente no código (Fase 13 pra guard de transição, Fase 17 pra planilha em massa) era forte o suficiente pra não precisar de investigação nova.
- Grep no código antes de escrever o brief do planejador (em vez de deixar o planner descobrir do zero) trouxe o precedente exato — arquivos, assinatura de RPC, guard de status — direto pro contexto do agente, o que ajudou o planejador a encontrar sozinho a lacuna real da Fase 19 (ver "What Was Inefficient").
- Verificação humana ao vivo no navegador, feita pessoalmente pelo dono do projeto em cada checkpoint, continuou sendo a rede de segurança real — incluindo testar deliberadamente o caso de nome ambíguo com dados semeados no banco antes do teste.
- RLS/RPC como única fronteira de autorização se manteve sem exceção nova em 3 migrations (0018-0020) — o projeto continua com as mesmas 4 exceções `SECURITY DEFINER` documentadas desde o v1.2.

### What Was Inefficient
- **Push de migration bloqueado pelo classificador de modo automático do harness**: em ambas as fases (18-01, 19-01), o comando `supabase db push` foi recusado para o subagente executor — resolvido, como em v1.3, rodando o comando diretamente pelo orquestrador com aprovação explícita do dono, nunca contornado.
- **Lacuna real encontrada só no planejamento da Fase 19**: o brief inicial assumia que sub-escopo A (CNPJ/Nome Fantasia na importação de clientes novos) não precisava de mudança de RPC — mas `importar_clientes_lote` não declarava essas duas chaves no `jsonb_to_recordset`, então a planilha teria "sucesso" na tela e o dado sumiria em silêncio. O planejador encontrou isso lendo o código-fonte real da função em vez de confiar no brief, e a correção (uma migration a mais, dividida em duas na mesma fase pra economizar checkpoints) ficou registrada no próprio PLAN.md.
- **Duas quedas de sessão por limite** (uma de sessão, uma semanal) interromperam execução de plano no meio — em ambos os casos nenhum commit tinha sido feito ainda no ponto da queda, então o reinício foi limpo (sem estado parcial pra reconciliar), só uma repetição do `Agent()` de execução.
- Pausa deliberada do usuário no meio de um checkpoint de verificação ("marcar pendente, já retorno") — tratada como uma pausa legítima, não como reprovação; a sessão retomou do mesmo ponto exato (dados de teste ainda no banco, servidor religado) sem precisar re-executar nada.

### Patterns Established
- Toda fase com migration nova continua seguindo o mesmo roteiro do v1.3: checkpoint humano com explicação em português simples do que a migration faz e não faz → aprovação → push feito pelo orquestrador (não pelo subagente) → testes rodados até GREEN → SUMMARY.md.
- Guard de "campo obrigatório a partir de X" (CNPJ no ganho, como frequência de visita antes dele) é sempre condicionado à TRANSIÇÃO, nunca ao estado — três condições AND (pediu o novo estado + estado atual ainda não é esse + campo vazio) é o mecanismo literal que garante grandfathering; remover a condição do meio transforma a trava em retroativa.
- RPCs de escrita em massa continuam seguindo o molde de `atualizar_frequencia_visita_lote`: UPDATE único set-based, guard de papel explícito, nunca `SECURITY DEFINER`, estruturalmente incapaz de criar linha nova, e recusa de nome ambíguo (2+ clientes com nome normalizado igual) como erro de linha em vez de adivinhar.
- Quando uma fase estende uma função existente que já é usada por um fluxo de tela com diálogo de confirmação (ex. o diálogo de "ganho"), verificar explicitamente se o valor recém-gravado precisa ser sincronizado de volta no estado do formulário que segue montado na tela — é exatamente o tipo de bug que só aparece numa sequência de duas ações do usuário, não numa ação isolada.

### Key Lessons
1. Ler o código-fonte real da função que será estendida (não confiar no brief nem na spec) antes de planejar continua sendo o que revela lacunas genuínas — confirmado de novo em v1.4 (a chave `cnpj`/`nome_fantasia` faltando no recordset de `importar_clientes_lote`), mesma lição da v1.3.
2. Pular discuss-phase/research quando o escopo já está resolvido na conversa e o precedente no código é forte é uma economia real, não um atalho arriscado — mas só funciona se alguém (o orquestrador) já verificou o precedente antes de perguntar ao usuário se pode pular.
3. Uma queda de sessão por limite de uso, quando acontece ANTES do primeiro commit de um plano, não deixa estado sujo pra reconciliar — vale checar `git log`/`git status` antes de decidir como retomar, em vez de assumir que precisa de recuperação complexa.
4. Quando o usuário pede pra pausar um checkpoint ("volto depois"), a sessão deve preservar o ambiente de teste (dados semeados, servidor) exatamente como estava, pra retomar sem re-trabalho quando ele voltar.

### Cost Observations
- Model mix: planner em opus, executor/researcher em sonnet, plan-checker/verifier em haiku/sonnet — mesmo padrão de v1.2/v1.3, mantido estável.
- Duas quedas por limite de uso (sessão + semanal) no meio da execução — ambas recuperadas sem retrabalho porque nenhum commit tinha acontecido ainda no ponto da interrupção.
- Nenhum retrabalho de funcionalidade foi necessário — a única lacuna de planejamento encontrada (RPC de importação não gravava as duas colunas novas) foi corrigida dentro do próprio ciclo de planejamento da Fase 19, antes de qualquer execução.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — (not retrospected; shipped before this document existed) | 4 | — |
| v1.1 | ~2-3 | 3 | Primeira retrospectiva formal; verificação manual no navegador ao final de cada fase virou padrão consistente |
| v1.2 | ~1 (com interrupção por limite de uso) | 5 | Fases rodando em paralelo via worktree (8/9, e depois 10/11) virou padrão — trouxe junto o risco novo de colisão de numeração de migration, agora documentado como lição |
| v1.3 | ~1 sessão contínua longa (múltiplas interrupções por limite recuperadas) | 5 | Verificação pessoal ao vivo em TODO checkpoint (não delegada) virou disciplina consistente; primeira vez que o bloqueio de segurança do harness em `supabase db push` apareceu — resolvido com push manual do orquestrador, nunca contornado |
| v1.4 | ~1 sessão longa (2 quedas por limite recuperadas, mais uma pausa deliberada do usuário no meio de um checkpoint) | 2 | Primeiro marco a pular discuss-phase/research deliberadamente nas duas fases (escopo já resolvido em conversa + precedente forte no código, confirmado via pergunta explícita); primeiro marco pequeno o suficiente (2 fases) pra caber inteiro numa sessão só, incluindo fechamento |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v1.1 | 72+ (tests/importacao/*, incluindo 3 casos de integração contra RLS real) | Não medido formalmente | `@e965/xlsx`, `papaparse` (ambos avaliados por legitimidade antes da instalação) |
| v1.2 | Suite completa passando (falhas remanescentes isoladas a rate-limit de Auth do free-tier, não regressão); novos arquivos de integração em `tests/equipe/*` e `tests/dashboard/*` | Não medido formalmente | Nenhuma dependência nova — v1.2 foi só RPCs/migrations + componentes reaproveitando a stack já instalada |
| v1.3 | Centenas de casos novos across `tests/agenda/*`, `tests/clientes/*`, `tests/configuracoes/*`, `tests/importacao/*` (RLS/integração contra o banco real em todas as fases com migration) | Não medido formalmente | Nenhuma dependência nova — v1.3 reaproveitou `@e965/xlsx` (v1.1) e toda a stack já instalada |
| v1.4 | Dezenas de casos novos em `tests/clientes/cnpj-ganho.test.ts`, `tests/importacao/rls-cnpj-lote.test.ts`, `tests/importacao/annotarLinhaCnpj.test.ts`/`confirmarCnpj.test.ts` (integração contra o banco real, incluindo caso de nome ambíguo); zero regressão nos arquivos que não deveriam ser tocados (`funil-status`, `funil-constraints`, `rls-visitas`, `rls-frequencia-lote`) | Não medido formalmente | Nenhuma dependência nova — v1.4 reaproveitou toda a stack já instalada |

### Top Lessons (Verified Across Milestones)

1. Fechar cada marco formalmente antes de iniciar o próximo evita perda de registro histórico (v1.1 pagou esse custo ao fechar o v1.0 tardiamente).
2. Testes de integração contra o banco real (não mockado) seguem sendo a forma mais confiável de pegar bugs de RLS/PL/pgSQL — confirmado de novo em v1.2, v1.3 e v1.4.
3. Verificação humana ao vivo no navegador continua pegando bugs que nenhum teste automatizado alcança (v1.1: nenhum caso; v1.2: o bug de `avancou_pct` acima de 100%; v1.3: nenhum bug real, mas confirmou comportamentos de risco; v1.4: nenhum bug real, mas provou o caso de nome ambíguo com dados reais) — vale manter como gate obrigatório de toda fase de UI/dashboard.
4. Ler o código-fonte real do fluxo análogo antes de planejar (não só a spec/pesquisa) revela lacunas genuínas antes que virem bugs — confirmado repetidamente em v1.3 (ambiguidade de nome, duplicata de linha, prop faltando) e de novo em v1.4 (RPC de importação não gravava as colunas novas).
5. Um bloqueio de segurança do harness em `supabase db push` não é um bug — é a proteção funcionando; a resposta certa é sempre rodar a ação manualmente com aprovação explícita do dono, nunca contornar por outro caminho — confirmado em v1.3 e de novo em v1.4 (duas vezes na mesma sessão).
6. Quando o escopo de uma fase pequena já foi resolvido em conversa e existe precedente forte no código, pular discuss-phase/research é uma economia real — mas só depois de o orquestrador verificar o precedente por conta própria (grep/leitura direta) antes de perguntar ao usuário se pode pular (v1.4).
