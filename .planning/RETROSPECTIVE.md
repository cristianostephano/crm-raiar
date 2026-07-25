# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v1.1 | 72+ (tests/importacao/*, incluindo 3 casos de integração contra RLS real) | Não medido formalmente | `@e965/xlsx`, `papaparse` (ambos avaliados por legitimidade antes da instalação) |

### Top Lessons (Verified Across Milestones)

1. Fechar cada marco formalmente antes de iniciar o próximo evita perda de registro histórico (v1.1 pagou esse custo ao fechar o v1.0 tardiamente).
