# Phase 9: Filtros de Estado e Cidade Estruturados - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Estado e Cidade deixam de ser texto livre e viram listas estruturadas em todo lugar que aparecem: cadastro de cliente, edição de cliente, filtro da lista de clientes, e mapeamento de colunas na importação por planilha. Estado é uma lista fixa das 27 siglas de UF brasileiras. Cidade é uma lista completa e oficial de municípios (IBGE), filtrada dinamicamente pelo Estado já escolhido — não uma lista derivada dos clientes já cadastrados (isso impediria cadastrar o primeiro cliente de uma cidade nova). No filtro de clientes, Estado aparece antes de Cidade.

</domain>

<decisions>
## Implementation Decisions

### Dados já cadastrados
- **D-01:** Os clientes hoje no sistema são todos de teste e serão apagados pelo dono do projeto de qualquer forma — a migração/normalização de registros antigos com Estado em formato inconsistente (nome por extenso, digitação diferente) deve usar a abordagem mais simples possível (ex: normalização por correspondência exata/case-insensitive), sem investir em correspondência aproximada (fuzzy match) ou fluxo de revisão manual. Não é uma prioridade de qualidade de dados nesta fase.

### Cidade antes de Estado
- **D-02 (Claude's Discretion, decidido por mim dado o baixo risco):** O campo Cidade fica desabilitado até o Estado ser escolhido — padrão comum de filtro em cascata, evita uma lista de 5000+ municípios aparecer sem contexto.

### Claude's Discretion
- Comportamento exato de registros legados cujo Estado não corresponde a nenhuma das 27 siglas após a normalização simples (D-01) — como são dados de teste que serão apagados, tratar da forma mais simples tecnicamente (ex: deixar o valor como está até o usuário reabrir/salvar o registro, sem bloquear acesso).
- Componente de UI exato para a busca de Cidade (mais de 5000 municípios) — precisa ser pesquisável (combobox com filtro por digitação), não um `<select>` simples de rolagem longa.
- Fonte exata dos dados de municípios do IBGE e formato de carregamento (tabela `cidades` seedada via migration, conforme sugerido pela pesquisa do marco).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pesquisa do marco (v1.2)
- `.planning/research/ARCHITECTURE.md` (seção "v1.2 Additions") — Estado é constante de frontend (sem objeto no banco); Cidade precisa de uma tabela de referência nova (`cidades`, seedada com dados do IBGE) + RPC `cidades_por_estado()` — explicitamente NÃO um `SELECT DISTINCT` sobre `clientes.cidade` existente, porque isso perpetuaria a inconsistência atual e bloquearia cadastrar clientes em cidades novas
- `.planning/research/STACK.md` (Milestone Addendum: v1.2) — Cidade/Estado cascata precisa de um componente combobox pesquisável; projeto usa preset shadcn "base-nova" (Base UI, não Radix/cmdk) — `shadcn add combobox` copia o arquivo certo pro preset atual, zero dependência nova
- `.planning/research/PITFALLS.md` (Milestone Addendum: v1.2) — pitfall sobre migrar uma coluna Estado de texto livre com dados inconsistentes existentes sem quebrar/esconder silenciosamente registros que não batem com nenhum dos 27 valores válidos; recomenda o padrão Postgres `NOT VALID` + backfill + `VALIDATE CONSTRAINT` em vez de uma constraint rígida que falha direto contra dados já existentes

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` — LOC-01, LOC-02, LOC-03, LOC-04
- `.planning/ROADMAP.md` (Phase 9) — objetivo e critérios de sucesso já aprovados

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/clientes/FiltersPopover.tsx` — filtro atual de Cidade é um `<Input>` texto livre (linha ~256-263) e Estado já é um `<Select>` (linha ~268-286), mas populado a partir de `estadoOptions: string[]` derivado dinamicamente dos clientes já carregados (`KanbanBoard.tsx`, memo `estadoOptions`) — essa fonte dinâmica precisa ser substituída pela lista fixa de 27 siglas.
- `lib/validations/cliente.ts` — schema Zod atual: `cidade: z.string().min(1, ...)` e `estado: z.string().min(1, ...)` como texto livre em dois lugares (create e update schemas, linhas ~31-32 e ~83-84) — precisam virar validação contra os valores estruturados.
- `components/clientes/ClienteQuickCreateForm.tsx` e `components/clientes/ClienteDetailSheet.tsx` — os dois formulários (criação rápida e edição) que hoje renderizam Cidade/Estado como `<Input>` de texto livre (via `FormField`/`FormLabel` do react-hook-form), precisam virar os novos controles estruturados.
- Não existe autofill de CEP (nenhuma integração tipo ViaCEP) — Cidade/Estado são preenchidos manualmente hoje, sem nenhuma lógica de preenchimento automático a desfazer/preservar.
- `components/ui/select.tsx` já existe (usado pelo filtro de Estado atual); `components/ui/combobox.tsx` ainda NÃO existe — precisa ser adicionado via `shadcn add combobox` antes de ser usado no seletor de Cidade.

### Established Patterns
- Todo campo de formulário usa `react-hook-form` + `zod` (via `zodResolver`) — os novos campos estruturados devem seguir o mesmo padrão, não uma validação paralela.
- A importação por planilha (`lib/importacao/annotarLinha.ts`, Fase 6) hoje aceita Estado/Cidade como texto livre vindo da planilha — precisa ser atualizada pra validar contra a mesma lista de UFs/cidades usada no resto do sistema, sem duplicar a lógica.

### Integration Points
- Nova tabela `cidades` (seedada com dados do IBGE) + RPC `cidades_por_estado()` — a única peça nova de schema desta fase.
- `FiltersPopover.tsx`, `ClienteQuickCreateForm.tsx`, `ClienteDetailSheet.tsx`, e a validação de importação (`annotarLinha.ts`) todos passam a consumir a mesma fonte estruturada de Estado (constante fixa) e Cidade (RPC).

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica além do que já foi decidido no discovery do marco (Estado antes de Cidade, ambos como listas — ver `.planning/PROJECT.md` Key Decisions e `.planning/ROADMAP.md` Fase 9).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 9-Filtros de Estado e Cidade Estruturados*
*Context gathered: 2026-07-26*
