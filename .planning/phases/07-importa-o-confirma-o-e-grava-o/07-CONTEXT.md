# Phase 7: Importação — Confirmação e Gravação - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

O Supervisor confirma a importação já revisada (Fase 6) e os clientes das linhas válidas entram no sistema de uma só vez, cada um já na etapa "Aguardando contato" do funil — sem que uma linha com erro, ou um duplicado que o supervisor optou por pular, trave o restante do lote. É a única fase de escrita do marco v1.1: onde vive a nova RPC de inserção em lote.

</domain>

<decisions>
## Implementation Decisions

### O que acontece depois de confirmar
- **D-01:** Ao confirmar, o supervisor vê uma tela de resumo ("X clientes importados, Y linhas puladas", com os motivos) antes de sair — não é redirecionado direto pra lista de clientes sem essa confirmação visual. A tela de resumo tem um botão "Ver clientes" que leva pro funil.

### Revalidação no momento de confirmar
- **D-02:** O sistema roda a mesma checagem de duplicado da Fase 6 de novo, na hora de confirmar — não confia cegamente na revisão feita anteriormente. Isso cobre o caso raro de alguém ter cadastrado um cliente parecido no intervalo entre a revisão e a confirmação. Reaproveita a mesma função `findDuplicates`/`normalizeRazaoSocial` da Fase 6 (`lib/importacao/dedupe.ts`), sem lógica nova.
- Uma linha que passou como "OK" na revisão mas na revalidação aparece como duplicado novo deve ser tratada como erro/pulada nesta gravação (não trava o lote inteiro) — o resumo final deve refletir isso claramente pro supervisor.

### Linhas puladas
- **D-03:** Linhas puladas (erro ou duplicado não importado) não deixam registro permanente no sistema — não há tabela nova só para isso. Elas aparecem apenas na tela de resumo desta própria operação (contagem + motivos) e depois desaparecem; a planilha original continua com o supervisor caso precise reprocessar.

### Claude's Discretion
- Layout exato da tela de resumo (lista detalhada por linha vs. só contagem agregada).
- Nome e assinatura exatos da RPC de inserção em lote (`importar_clientes_lote` já foi sugerido pela pesquisa de arquitetura do marco — usar esse nome salvo bom motivo técnico em contrário).
- Estratégia exata de "uma linha ruim não trava o lote" no nível SQL (inserção linha a linha com captura de erro vs. inserção em lote com filtragem prévia) — decisão técnica de implementação.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` — IMP-01, IMP-06, IMP-09 (seção "Import (Importação de Clientes)")
- `.planning/ROADMAP.md` (Phase 7) — objetivo e critérios de sucesso já aprovados

### Pesquisa do marco (v1.1)
- `.planning/research/ARCHITECTURE.md` (seção "v1.1 Additions") — Pattern 4: nova RPC `importar_clientes_lote(p_clientes jsonb)`, deliberadamente NÃO security-definer (espelha `mover_card_funil`), checa `is_supervisor()` explicitamente, usa `INSERT ... SELECT * FROM jsonb_to_recordset(...) ON CONFLICT DO NOTHING RETURNING ...` (inserção em lote via set, evitando o anti-padrão de loop plpgsql com exceção por linha)
- `.planning/research/PITFALLS.md` (seção "Milestone Addendum: v1.1") — A5 (limite de execução do Vercel Hobby ~10s, exige inserção em lote/batelada, não linha a linha via loop) e A6 (falha parcial de importação precisa de tratamento explícito, não é o comportamento padrão do Postgres)

### Fase anterior (Importação — preview, padrões reaproveitáveis)
- `.planning/phases/06-importa-o-upload-mapeamento-e-revis-o/06-CONTEXT.md`, `06-02-SUMMARY.md`, `06-04-SUMMARY.md` — `validarLoteImportacao` (Server Action read-only), `lib/importacao/dedupe.ts` (`normalizeRazaoSocial`/`findDuplicates`), `annotarLinha`, `ImportPreviewTable.tsx`/`ImportWizard.tsx` (onde o botão "Confirmar importação" hoje é um no-op documentado, esperando esta fase)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/importacao/dedupe.ts` — `normalizeRazaoSocial`/`findDuplicates`, já usado na Fase 6, deve ser reaproveitado para a revalidação (D-02)
- `app/actions/importacao.ts` — `validarLoteImportacao` (Fase 6) já existe; a nova ação de confirmação pode reaproveitar sua estrutura de checagem de `is_supervisor()` e leitura RLS-scoped
- `components/importacao/ImportWizard.tsx` — botão "Confirmar importação" já existe como no-op documentado (comentário citando "escopo Fase 7") — só precisa trocar o `onClick`
- `supabase/migrations/` — padrão de `mover_card_funil` (RPC não-security-definer, guard explícito) é o modelo a seguir para a nova `importar_clientes_lote`

### Established Patterns
- RLS via `is_supervisor()` já diferencia Vendedor de Supervisor — a nova RPC deve seguir o mesmo padrão de outras RPCs do projeto (não security definer, guard explícito), não uma checagem manual isolada
- Todo cliente novo sempre nasce em "Aguardando contato" (mesma regra de cadastro manual) — IMP-09

### Integration Points
- Nova RPC de gravação em lote (única escrita nova do marco v1.1)
- Novo Server Action de confirmação, que revalida (D-02) e então chama a RPC
- `ImportWizard.tsx` ganha um passo/tela de resumo pós-confirmação (D-01)

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica — a tela de resumo fica a critério de Claude (ver Claude's Discretion).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase (confirmação e gravação; o resto já foi feito na Fase 6).

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 7-Importação — Confirmação e Gravação*
*Context gathered: 2026-07-24*
