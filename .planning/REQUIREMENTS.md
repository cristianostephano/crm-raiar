# Requirements: CRM Raiar — Acompanhamento de Vendas

**Defined:** 2026-09-25
**Core Value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.

## v1 Requirements

Requisitos do marco v1.7 (Ajustes Pós-Teste com o Time de Vendas). Cada um mapeia para uma fase do roteiro.

### Relatório de Perdidos

- [x] **PERD-01**: Cliente marcado como "Perdido" sai das 7 colunas do funil de prospecção (mesmo padrão já usado para "Ganho")
- [x] **PERD-02**: Vendedor/Supervisor visualiza uma tela "Perdidos" com motivo da perda, data e vendedor responsável
- [x] **PERD-03**: Vendedor vê só os próprios clientes perdidos; Supervisor vê os de todo o time
- [x] **PERD-04**: Tela de Perdidos tem filtro por período (data em que foi marcado como perdido)
- [x] **PERD-05**: Vendedor reabre um cliente perdido direto na lista (botão de toque simples), voltando o status para "Em andamento"

### Kanban (correção)

- [ ] **KAN-03**: Card do Kanban com filtro de vendedor ativo mostra as mesmas informações (categoria, vendedor, cidade/estado, ícones) e não corta nomes — idêntico ao card sem filtro

### Agenda (correção)

- [x] **AGD-15**: Seção "Sem dia fixo definido" da Agenda mostra o nome do cliente junto do nome do vendedor responsável

### Encerrar Cliente Ativo

- [x] **ENCR-01**: Vendedor marca um cliente ativo como "Inativo/Encerrado" quando ele para de comprar
- [x] **ENCR-02**: Marcar como Inativo/Encerrado exige informar um motivo
- [x] **ENCR-03**: Cliente Inativo/Encerrado sai da rotina da Agenda mas mantém histórico e diário intactos
- [x] **ENCR-04**: Vendedor encerra os próprios clientes ativos sem depender do Supervisor
- [x] **ENCR-05**: Vendedor reativa um cliente Inativo/Encerrado, voltando à rotina normal da Agenda

### Aderência de Uso

- [ ] **ADER-01**: Supervisor visualiza, na tabela comparativa por vendedor do Dashboard, um percentual de aderência de uso de cada vendedor
- [ ] **ADER-02**: Um dia conta como "usado" quando o vendedor faz login OU realiza qualquer ação real no funil (mover etapa, completar tarefa/visita, cadastrar/editar cliente) naquele dia
- [ ] **ADER-03**: A métrica de aderência é uma média móvel dos últimos 28 dias (4 semanas), contando dias usados sobre dias úteis do período

## v2 Requirements

Nenhum requisito deferido formalmente neste marco — ver `.planning/seeds/SEED-002-link-externo-indicacao-clientes.md` para a ideia de link externo de indicação de clientes, guardada como semente (não como requisito v2 tradicional).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Link externo de indicação de clientes (sem login) | Complexidade de segurança/LGPD/distribuição de responsável exige planejamento próprio — guardado como SEED-002 para um marco futuro, a pedido explícito do dono do projeto |
| Registrar histórico de login detalhado como funcionalidade visível ao usuário | É um meio técnico para ADER-01/02, não um requisito do usuário em si — tratado como dependência de implementação, não como requisito próprio |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERD-01 | Phase 28 | Complete |
| PERD-02 | Phase 28 | Complete |
| PERD-03 | Phase 28 | Complete |
| PERD-04 | Phase 28 | Complete |
| PERD-05 | Phase 28 | Complete |
| KAN-03 | Phase 27 | Pending |
| AGD-15 | Phase 27 | Complete |
| ENCR-01 | Phase 29 | Complete |
| ENCR-02 | Phase 29 | Complete |
| ENCR-03 | Phase 29 | Complete |
| ENCR-04 | Phase 29 | Complete |
| ENCR-05 | Phase 29 | Complete |
| ADER-01 | Phase 30 | Pending |
| ADER-02 | Phase 30 | Pending |
| ADER-03 | Phase 30 | Pending |

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 15 ✓
- Unmapped: 0

---
*Requirements defined: 2026-09-25*
*Last updated: 2026-09-25 after roadmap creation (marco v1.7 — Fases 27-30)*
