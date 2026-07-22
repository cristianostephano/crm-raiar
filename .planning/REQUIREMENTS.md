# Requirements: CRM Raiar — Acompanhamento de Vendas

**Defined:** 2026-07-14
**Core Value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível

## v1 Requirements

### Authentication (Autenticação e Papéis)

- [x] **AUTH-01**: Usuário faz login via Supabase Auth com email e senha
- [x] **AUTH-02**: Cadastro de usuário com email, nome, sobrenome, senha, celular
- [x] **AUTH-03**: Sistema distingue dois papéis — Supervisor e Vendedor — com permissões diferentes
- [x] **AUTH-04**: Sessão do usuário persiste entre acessos (não precisa logar toda hora)

### Client (Cadastro de Cliente PJ)

- [x] **CLI-01**: Vendedor cadastra cliente PJ com no mínimo razão social, endereço e responsável
- [x] **CLI-02**: Demais campos (categoria, contato, telefone, email, produtos consumidos, número de lojas) podem ser preenchidos depois, conforme a negociação avança
- [x] **CLI-03**: Supervisor pode cadastrar cliente e atribuir a um vendedor específico
- [x] **CLI-04**: Vendedor visualiza e edita apenas os próprios clientes (responsável = usuário logado)
- [x] **CLI-05**: Supervisor visualiza, edita e apaga todos os clientes de todos os vendedores
- [x] **CLI-06**: Vendedor pode editar os próprios clientes, mas não apagar (apagar é restrito ao supervisor)
- [x] **CLI-07**: Busca e filtro na lista de clientes (por vendedor, categoria, produto, texto livre por razão social)

### Funnel (Funil de Vendas / Kanban)

- [x] **FUN-01**: Cada cliente tem um card no funil, com 7 etapas fixas (Aguardando contato → 1ª venda concluída)
- [x] **FUN-02**: Vendedor move os próprios cards entre etapas
- [x] **FUN-03**: Supervisor move qualquer card entre etapas
- [x] **FUN-04**: Card tem status_acompanhamento: em andamento, perdido, ou ganho
- [x] **FUN-05**: Status "ganho" só é permitido quando o card está na etapa "1ª venda concluída"
- [x] **FUN-06**: Ao marcar um card como perdido, o motivo da perda é obrigatório
- [x] **FUN-07**: Card tem campo de observação em texto livre
- [x] **FUN-08**: Card tem lista de tarefas, cada uma com sua própria data de conclusão
- [x] **FUN-09**: Cards parados/atrasados ficam visualmente destacados no kanban ao abrir a tela
- [x] **FUN-10**: Histórico automático de mudanças por cliente (etapa, status, tarefas concluídas) com data/hora

### Admin (Listas Editáveis)

- [x] **ADM-01**: Supervisor cadastra/edita/remove categorias de cliente
- [x] **ADM-02**: Supervisor cadastra/edita/remove produtos consumidos
- [x] **ADM-03**: Supervisor cadastra/edita/remove tipos de tarefa
- [x] **ADM-04**: Supervisor cadastra/edita/remove motivos de perda

### Dashboard

- [x] **DSH-01**: Dashboard mostra clientes por etapa do funil
- [x] **DSH-02**: Dashboard mostra ganhos x perdidos num período
- [x] **DSH-03**: Dashboard mostra desempenho por vendedor
- [x] **DSH-04**: Dashboard mostra taxa de conversão
- [x] **DSH-05**: Dashboard mostra prospecções por produto e por categoria
- [x] **DSH-06**: Vendedor vê uma versão do dashboard só com os próprios números
- [x] **DSH-07**: Supervisor vê o dashboard completo, com todos os vendedores

## v1.1 Requirements

Milestone v1.1 — Importação em massa de clientes via planilha + exportação da lista de clientes.

### Import (Importação de Clientes)

- [ ] **IMP-01**: Supervisor importa clientes em massa via planilha (.xlsx/.csv)
- [ ] **IMP-02**: Sistema disponibiliza modelo de planilha para download (vazio + linha de exemplo) com as colunas esperadas
- [ ] **IMP-03**: Supervisor mapeia colunas da planilha para os campos do sistema, com opção de "não importar" por coluna
- [ ] **IMP-04**: Planilha define o vendedor responsável de cada cliente através de uma coluna própria
- [ ] **IMP-05**: Sistema valida cada linha usando as mesmas regras mínimas do cadastro manual (razão social, endereço, responsável obrigatórios)
- [ ] **IMP-06**: Linha com erro é excluída da importação sem travar as demais linhas válidas da planilha
- [ ] **IMP-07**: Sistema sinaliza possíveis duplicados (comparando razão social) antes de confirmar, sem bloquear ou mesclar automaticamente — decisão final é do supervisor
- [ ] **IMP-08**: Tela de revisão mostra o status de cada linha (OK / erro / possível duplicado) antes da confirmação final da importação
- [ ] **IMP-09**: Cliente importado sempre entra na etapa "Aguardando contato" do funil
- [ ] **IMP-10**: Importação em massa é restrita ao Supervisor — Vendedor não tem acesso a essa função

### Export (Exportação de Clientes)

- [ ] **EXP-01**: Vendedor exporta a lista dos próprios clientes
- [ ] **EXP-02**: Supervisor exporta a lista de todos os clientes
- [ ] **EXP-03**: Exportação respeita os filtros aplicados na tela (categoria, vendedor, produto, texto livre)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Client

- **CLI-V2-01**: Autocomplete de CEP no cadastro de endereço (reduz digitação)

### Funnel

- **FUN-V2-01**: Ações em lote no kanban (ex: reatribuir vários clientes de uma vez para outro vendedor)

### Import

- **IMP-V2-01**: Adicionar campo CNPJ ao cadastro de cliente, permitindo detecção automática de duplicado com alta confiança — só se a comparação por razão social se mostrar um problema real na prática
- **IMP-V2-02**: Lembrar/reaproveitar mapeamento de colunas entre importações do mesmo parceiro recorrente
- **IMP-V2-03**: Opção de "importar como atualização" para duplicados sinalizados (hoje só pula ou importa mesmo assim)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Notificações ativas (email, push) de tarefas atrasadas | Destaque visual no kanban já resolve o esquecimento no MVP, sem custo/complexidade de um serviço de notificação |
| Colunas do funil editáveis por permissão | As 7 etapas ficam fixas no código no MVP, pra reduzir complexidade e validar a ideia primeiro |
| App mobile nativo | Web responsivo é suficiente para o MVP |
| Integrações externas (email, calendário, WhatsApp, sync com o CRM pago atual) | Cada integração é uma dependência externa e custo novo; não é o objetivo da migração |
| Auditoria completa / trilha de compliance | Overkill para um time de 2 papéis sem exigência regulatória; o histórico leve (FUN-10) já cobre "quando isso mudou" |
| Automação de marketing / e-mail em sequência | O time trabalha com prospecção manual (tarefas), não com fluxo de marketing/inbound |
| Valor de negócio / forecasting ponderado por probabilidade | Não faz parte do modelo de negócio descrito — o funil acompanha a primeira venda, não valor recorrente |
| Permissões granulares por campo | Duas permissões claras (dono do registro + papel) já resolvem; permissão por campo é fonte comum de bugs de RLS e difícil de manter por um operador não-técnico |
| Vendedor fazer importação em massa | Restrito ao Supervisor por decisão explícita do dono do projeto (v1.1) |
| Background job/fila para importações muito grandes | Só necessário se arquivos reais começarem a estourar o limite de tempo do free tier — não é o caso hoje |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| CLI-01 | Phase 2 | Complete |
| CLI-02 | Phase 2 | Complete |
| CLI-03 | Phase 2 | Complete |
| CLI-04 | Phase 2 | Complete |
| CLI-05 | Phase 2 | Complete |
| CLI-06 | Phase 2 | Complete |
| CLI-07 | Phase 2 | Complete |
| FUN-01 | Phase 2 | Complete |
| FUN-02 | Phase 2 | Complete |
| FUN-03 | Phase 2 | Complete |
| FUN-04 | Phase 2 | Complete |
| FUN-05 | Phase 2 | Complete |
| FUN-06 | Phase 2 | Complete |
| FUN-07 | Phase 2 | Complete |
| FUN-08 | Phase 2 | Complete |
| FUN-09 | Phase 2 | Complete |
| FUN-10 | Phase 2 | Complete |
| ADM-01 | Phase 3 | Complete |
| ADM-02 | Phase 3 | Complete |
| ADM-03 | Phase 3 | Complete |
| ADM-04 | Phase 3 | Complete |
| DSH-01 | Phase 4 | Complete |
| DSH-02 | Phase 4 | Complete |
| DSH-03 | Phase 4 | Complete |
| DSH-04 | Phase 4 | Complete |
| DSH-05 | Phase 4 | Complete |
| DSH-06 | Phase 4 | Complete |
| DSH-07 | Phase 4 | Complete |
| EXP-01 | Phase 5 | Pending |
| EXP-02 | Phase 5 | Pending |
| EXP-03 | Phase 5 | Pending |
| IMP-02 | Phase 6 | Pending |
| IMP-03 | Phase 6 | Pending |
| IMP-04 | Phase 6 | Pending |
| IMP-05 | Phase 6 | Pending |
| IMP-07 | Phase 6 | Pending |
| IMP-08 | Phase 6 | Pending |
| IMP-10 | Phase 6 | Pending |
| IMP-01 | Phase 7 | Pending |
| IMP-06 | Phase 7 | Pending |
| IMP-09 | Phase 7 | Pending |

**Coverage (v1.0):**

- v1 requirements: 32 total
- Mapped to phases: 32/32 ✓
- Unmapped: 0 ✓

**Coverage (v1.1):**

- v1.1 requirements: 13 total (IMP-01..10 + EXP-01..03)
- Mapped to phases: 13/13 ✓
- Unmapped: 0 ✓
- Distribution: Phase 5 (Export) = 3 · Phase 6 (Import preview) = 7 · Phase 7 (Import commit) = 3

---
*Requirements defined: 2026-07-14 (v1)*
*Last updated: 2026-07-22 after creating the v1.1 roadmap (Phases 5-7) — Import/Export requirements mapped, coverage 13/13*
