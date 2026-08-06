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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — (not retrospected; shipped before this document existed) | 4 | — |
| v1.1 | ~2-3 | 3 | Primeira retrospectiva formal; verificação manual no navegador ao final de cada fase virou padrão consistente |
| v1.2 | ~1 (com interrupção por limite de uso) | 5 | Fases rodando em paralelo via worktree (8/9, e depois 10/11) virou padrão — trouxe junto o risco novo de colisão de numeração de migration, agora documentado como lição |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v1.1 | 72+ (tests/importacao/*, incluindo 3 casos de integração contra RLS real) | Não medido formalmente | `@e965/xlsx`, `papaparse` (ambos avaliados por legitimidade antes da instalação) |
| v1.2 | Suite completa passando (falhas remanescentes isoladas a rate-limit de Auth do free-tier, não regressão); novos arquivos de integração em `tests/equipe/*` e `tests/dashboard/*` | Não medido formalmente | Nenhuma dependência nova — v1.2 foi só RPCs/migrations + componentes reaproveitando a stack já instalada |

### Top Lessons (Verified Across Milestones)

1. Fechar cada marco formalmente antes de iniciar o próximo evita perda de registro histórico (v1.1 pagou esse custo ao fechar o v1.0 tardiamente).
2. Testes de integração contra o banco real (não mockado) seguem sendo a forma mais confiável de pegar bugs de RLS/PL/pgSQL — confirmado de novo em v1.2.
3. Verificação humana ao vivo no navegador continua pegando bugs que nenhum teste automatizado alcança (v1.1: nenhum caso; v1.2: o bug de `avancou_pct` acima de 100%) — vale manter como gate obrigatório de toda fase de UI/dashboard.
