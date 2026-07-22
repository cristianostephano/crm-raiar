# Phase 6: Importação — Upload, Mapeamento e Revisão - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

O Supervisor prepara uma importação de ponta a ponta ANTES de qualquer gravação no banco: baixa um modelo de planilha, envia um arquivo (.xlsx ou .csv), mapeia as colunas do arquivo para os campos do sistema (incluindo qual coluna define o vendedor responsável), e vê uma tela de revisão que classifica cada linha como OK, erro ou possível duplicado. Nada é criado nesta fase — é só pré-visualização/validação; a gravação em massa fica para a Fase 7.

</domain>

<decisions>
## Implementation Decisions

### Formato de arquivo
- **D-01:** Aceita tanto .xlsx quanto .csv na importação (diferente da exportação, que ficou só em .xlsx). Motivo: planilhas de parceiros/feiras chegam em formatos variados, e exigir conversão manual antes de importar contraria o objetivo de baixa fricção.
- Reaproveitar `@e965/xlsx` (já instalado na Fase 5) para .xlsx; adicionar `papaparse` para .csv, conforme já indicado em `.planning/research/STACK.md` (v1.1 Addendum).

### Categoria/produto que não existe no sistema
- **D-02:** Uma linha cuja planilha referencia uma categoria ou produto não cadastrado é marcada como ERRO na revisão (com mensagem clara, ex: "categoria 'X' não existe"). Não há criação automática de categoria/produto durante a importação, e a linha não entra com o campo em branco por omissão silenciosa — o supervisor precisa ou cadastrar a categoria/produto em Configurações antes de confirmar, ou optar por pular essa linha específica.
- Reaproveita as telas de CRUD de categoria/produto já existentes (Fase 3), sem lógica nova de auto-criação.

### Duplicado dentro da própria planilha
- **D-03:** Duas linhas com a mesma razão social DENTRO do mesmo arquivo (não contra o banco) recebem o mesmo tratamento do duplicado-contra-banco: ambas marcadas como "possível duplicado", supervisor decide linha por linha. Não há uma regra separada de "duplicado interno" — é a mesma lógica de comparação de razão social normalizada, aplicada tanto contra o banco quanto dentro do próprio arquivo.

### Como mostrar duplicado na revisão
- **D-04:** Cada linha suspeita mostra um selo "Possível duplicado" citando o nome do cliente parecido (já existente no banco, ou a outra linha do arquivo). O supervisor marca essa linha especificamente como "Importar mesmo assim" ou "Pular" — decisão granular por linha, nunca uma ação em massa automática sobre todos os duplicados de uma vez.

### Claude's Discretion
- Layout exato da tela de mapeamento de colunas (grid, lista, ou tabela) e da tela de revisão (paginação se houver muitas linhas).
- Algoritmo exato de normalização de razão social pra comparação de duplicado (case-insensitive, remoção de acentos/pontuação/sufixos como "Ltda"/"S.A.", etc.) — decisão técnica, sem necessidade de aprovação prévia do usuário.
- Onde os dados parseados/validados ficam entre o upload e a confirmação (fase 7) — decisão técnica de arquitetura.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` — IMP-02, IMP-03, IMP-04, IMP-05, IMP-07, IMP-08, IMP-10 (seção "Import (Importação de Clientes)")
- `.planning/ROADMAP.md` (Phase 6) — objetivo e critérios de sucesso já aprovados

### Pesquisa do marco (v1.1)
- `.planning/research/SUMMARY.md` — síntese geral, ordem de fases sugerida
- `.planning/research/STACK.md` (seção "v1.1 Addendum") — `@e965/xlsx` + `papaparse` para parsing de ambos os formatos; `pg_trgm` como opção de comparação de similaridade no Postgres (não obrigatório — Claude's Discretion acima permite normalização simples em JS/TS também)
- `.planning/research/ARCHITECTURE.md` (seção "v1.1 Additions") — Pattern 5: fluxo de duas fases (validar/pré-visualizar → confirmar/gravar), com parsing client-side
- `.planning/research/PITFALLS.md` (seção "Milestone Addendum: v1.1") — BOM/delimitador de CSV em português (ponto-e-vírgula), limite de execução do Vercel Hobby exigindo processamento em lote, injeção via CSV

### Fase anterior (Exportação — padrões reaproveitáveis)
- `.planning/phases/05-exporta-o-de-clientes/05-01-SUMMARY.md`, `05-02-SUMMARY.md` — `@e965/xlsx` já instalado e aprovado (não precisa de novo checkpoint de legitimidade); padrão de Route Handler já estabelecido em `app/api/clientes/exportar/route.ts`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/validations/cliente.ts` — schema Zod do cadastro de cliente (razão social, endereço, responsável obrigatórios; demais campos opcionais) — a validação de cada linha da planilha deve reaproveitar essas mesmas regras mínimas, não recriar validação nova
- `lib/supabase/queries/clientes.ts` — já tem `getCategoriasAtivas`/`getProdutosAtivos` (helpers de lookup usados no cadastro manual) — reaproveitar para validar se a categoria/produto da planilha existe
- Telas de CRUD das 4 listas editáveis (Fase 3, `/configuracoes`) — onde o supervisor cadastra categoria/produto que faltar, sem precisar de nova tela

### Established Patterns
- RLS via `is_supervisor()` já diferencia Vendedor de Supervisor — a restrição "só Supervisor importa" (IMP-10) deve seguir o mesmo padrão de `mover_card_funil`/`importar_clientes_lote` (RPC não-security-definer com guard explícito), não uma checagem manual isolada
- `@e965/xlsx` já instalado e aprovado na Fase 5 — não precisa de novo checkpoint de legitimidade de pacote nesta fase; só `papaparse` é novo e precisa desse checkpoint

### Integration Points
- Tela de upload/mapeamento/revisão é nova (não existe hoje) — provavelmente uma rota própria ou modal acessível só pelo Supervisor
- Nenhuma escrita no banco nesta fase — os dados validados ficam em memória/estado do formulário até a Fase 7 confirmar

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica — layout exato fica a critério de Claude (ver Claude's Discretion).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase (upload/mapeamento/revisão; gravação é fase 7).

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 6-Importação — Upload, Mapeamento e Revisão*
*Context gathered: 2026-07-22*
