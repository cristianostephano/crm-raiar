# Requirements: CRM Raiar — Acompanhamento de Vendas

**Defined:** 2026-09-28
**Core Value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.

## v1 Requirements

Requisitos do marco v1.8 (Agenda 2 — Piloto de Visitas Manuais). Piloto deliberado: as duas agendas (atual e nova) convivem até o dono do projeto decidir qual fica de verdade no sistema.

### Agenda 2 (nova)

- [x] **AGD2-01**: Vendedor cria um item manual na Agenda 2, informando nome do cliente (texto livre, sem vínculo com cadastro), bairro e uma data
- [ ] **AGD2-02**: Ao criar o item, o vendedor pode escolher repetir nas próximas 4, 8 ou 12 semanas (mesma data da semana), gerando uma ocorrência independente por semana (cada uma editável/apagável separadamente)
- [x] **AGD2-03**: Vendedor edita um item manual que ele mesmo criou (nome, bairro, data)
- [x] **AGD2-04**: Vendedor apaga um item manual que ele mesmo criou
- [x] **AGD2-05**: Vendedor marca um item manual como concluído; o item continua visível na lista do dia, com indicação visual de concluído (riscado)
- [ ] **AGD2-06**: Agenda 2 aparece como item próprio no menu principal, logo abaixo do item "Agenda" já existente
- [x] **AGD2-07**: Supervisor vê os itens manuais de todos os vendedores, com filtro por vendedor (mesmo padrão já usado na Agenda atual); vendedor vê só os próprios itens
- [ ] **AGD2-08**: Agenda 2 tem visão de Lista e visão de Calendário (dia/semana/mês), reaproveitando o mesmo componente de calendário já usado na Agenda atual

### Ajuste na Agenda atual

- [ ] **AGD-16**: Cliente "ganho" (ativo) para de entrar automaticamente na Agenda atual por frequência de visita/dia fixo — os campos de frequência/dia fixo continuam existindo no cadastro do cliente, só ficam sem uso automático enquanto o piloto roda. Itens de prospecção continuam entrando automaticamente na Agenda atual, sem nenhuma mudança.

## v2 Requirements

Nenhum requisito deferido formalmente neste marco.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Vincular o item manual a um cadastro de cliente real (em vez de texto livre) | Decisão explícita do dono — o piloto testa a agenda mais simples possível primeiro; se ela vencer a comparação, vincular a um cadastro real pode ser considerado depois |
| Remover os campos de frequência/dia fixo do cadastro do cliente | O dono ainda não decidiu qual agenda fica — os campos continuam existindo, só param de alimentar a Agenda automaticamente, até a decisão final |
| Resumo/diário obrigatório ao concluir um item da Agenda 2 | Decisão explícita do dono — a Agenda 2 fica deliberadamente mais leve que a Agenda atual (que já exige resumo); reavaliar se o piloto for adiante |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGD2-01 | Phase 31 | Complete |
| AGD2-02 | Phase 32 | Pending |
| AGD2-03 | Phase 31 | Complete |
| AGD2-04 | Phase 31 | Complete |
| AGD2-05 | Phase 31 | Complete |
| AGD2-06 | Phase 31 | Pending |
| AGD2-07 | Phase 31 | Complete |
| AGD2-08 | Phase 32 | Pending |
| AGD-16 | Phase 33 | Pending |

**Coverage:**

- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-28*
*Last updated: 2026-09-28 after roadmap v1.8 (Phases 31-33)*
