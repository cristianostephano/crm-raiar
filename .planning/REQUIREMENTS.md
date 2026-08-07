# Requirements: CRM Raiar — Acompanhamento de Vendas

**Defined:** 2026-08-07
**Core Value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.

## v1 Requirements

Requisitos do marco v1.3 (Agenda do Vendedor). Cada um mapeia para uma fase do roadmap.

### Agenda (AGD)

- [ ] **AGD-01**: Vendedor vê uma agenda única com tarefas de prospecção e visitas de pós-venda juntas, ordenada por atrasado → hoje → próximos dias
- [ ] **AGD-02**: Item de menu "Agenda" aparece no topo do menu principal, acima de "Clientes"
- [ ] **AGD-03**: Itens atrasados ficam destacados visualmente (mesmo padrão já usado no kanban)
- [ ] **AGD-04**: Vendedor vê só a própria agenda; Supervisor vê a agenda de todo o time
- [ ] **AGD-05**: Supervisor pode filtrar a agenda do time por vendedor
- [ ] **AGD-06**: Item de menu "Agenda" mostra a contagem de itens pendentes (ex.: "Agenda (5)")

### Visitas / Recorrência (VIS)

- [ ] **VIS-01**: Ao mover um card para "ganho", o vendedor define a frequência de visita (semanal/quinzenal/mensal/nenhuma)
- [ ] **VIS-02**: A frequência de visita pode ser editada ou cancelada a qualquer momento
- [ ] **VIS-03**: Ao concluir uma visita, o sistema sugere a próxima data com base na frequência — o vendedor confirma ou ajusta, nunca é automático e silencioso
- [ ] **VIS-04**: Clientes já "ganho" antes do lançamento da Agenda começam sem frequência definida (nada é suposto automaticamente)

### Conclusão (CONC)

- [ ] **CONC-01**: Ao concluir uma tarefa de prospecção ou uma visita, o vendedor escreve um resumo curto (1-2 frases) antes da conclusão ser aceita

### Diário do Cliente (DIAR)

- [ ] **DIAR-01**: Cada cliente tem um histórico de visitas/tarefas concluídas (resumo + data + autor), visível ao vendedor responsável e ao Supervisor

### Cliente Ativo (ATV)

- [ ] **ATV-01**: Cliente "ativo" (= status ganho) passa a aceitar Nome Fantasia e CNPJ no cadastro — nunca exigidos no cadastro inicial rápido
- [ ] **ATV-02**: Cadastro de cliente ativo aceita frequência de pedidos (só informativo, sem alerta automático)
- [ ] **ATV-03**: Frequência de visitas é o mesmo valor no cadastro e na recorrência da agenda — editar um atualiza o outro, nunca dessincroniza

### Importação / Exportação (IMP)

- [ ] **IMP-01**: Supervisor define a frequência de visita para vários clientes "ganho" de uma vez, via upload de planilha (reaproveita o padrão de importação já existente)
- [ ] **IMP-02**: Vendedor/Supervisor exporta o histórico de visitas/tarefas concluídas, reaproveitando o padrão de exportação já existente

## v2 Requirements

Deferido para marcos futuros — não faz parte do roteiro atual.

### Agenda avançada

- **AGDX-01**: Faixa/mini-calendário semanal ao lado da lista (visão de "formato da semana")
- **AGDX-02**: Reagendar uma única ocorrência sem mexer na recorrência da série
- **AGDX-03**: Busca de texto completo nos resumos de conclusão

## Out of Scope

Explicitamente excluído deste marco. Documentado pra prevenir scope creep.

| Feature | Reason |
|---------|--------|
| Notificações ativas (email/push/SMS) para tarefas/visitas atrasadas | Já excluído desde o v1.0; quebra o custo zero de infraestrutura e é desnecessário já que o time abre o CRM todo dia — o destaque visual (AGD-03) já resolve |
| Calendário completo (arrastar entre dias, visão de mês, recorrência customizável) | O objetivo é "o que fazer hoje/essa semana", não planejamento visual de agenda; uma lista já resolve, e as 4 opções fixas de frequência (semanal/quinzenal/mensal/nenhuma) cobrem o caso real |
| Reagendamento/troca automática e silenciosa da próxima visita | Contradiz a decisão explícita de sempre pedir confirmação do vendedor (VIS-03) |
| Otimização de rota / mapeamento geográfico de visitas | Fora do problema real do time (disciplina de funil, não eficiência de deslocamento); exigiria serviço pago de mapa/geocodificação |
| Resumo de visita gerado por IA / transcrição automática | Exigiria serviço pago de terceiros; um campo de texto curto obrigatório já resolve com custo zero |
| Priorização "inteligente" por valor do negócio | O CRM não rastreia valor monetário de cliente (decisão já registrada no v1.2); ordenação simples por data (atrasado → hoje → semana) já é suficiente na escala do time |
| Reatribuição de tarefas entre vendedores pela Agenda | Sem necessidade demonstrada; o único caso real de reatribuição (vendedor desativado) já foi resolvido no v1.2 |
| Opções de recorrência configuráveis além de semanal/quinzenal/mensal/nenhuma | Mais opções = mais decisão no momento do "ganho", contra o valor central de mínima fricção |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**

- v1 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 ⚠️

---
*Requirements defined: 2026-08-07*
*Last updated: 2026-08-07 after initial definition*
