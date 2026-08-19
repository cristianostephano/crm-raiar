# Requirements: CRM Raiar — Acompanhamento de Vendas

**Defined:** 2026-08-14
**Core Value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.

## v1 Requirements

Requisitos do marco v1.5 — Calendário na Agenda e Conclusão Remota.

### Agenda em Calendário

- [x] **AGD-07**: Vendedor alterna entre Lista e Calendário na tela da Agenda
- [x] **AGD-08**: Calendário tem 3 modos (dia/semana/mês), navegação de data e botão "Hoje"; semana começa na segunda-feira
- [x] **AGD-09**: Visão de mês mostra até 3 itens por dia + contador "+N"; clicar no dia abre a lista completa daquele dia
- [x] **AGD-10**: Visão de semana mostra 7 colunas (uma por dia) com os itens de cada dia
- [x] **AGD-11**: Visão de dia mostra os itens daquele dia em formato de lista, igual ao card já usado hoje
- [x] **AGD-12**: Cada item no calendário mantém a mesma sinalização visual Prospecção/Ativo já usada na lista
- [x] **AGD-13**: Calendário mostra também itens já concluídos ao navegar para datas passadas (a Lista continua mostrando só pendente, sem mudança)
- [x] **AGD-14**: Supervisor filtra o calendário por vendedor, igual já funciona na Lista hoje

### Conclusão Remota

- [x] **CONC-02**: Ao concluir um item da Agenda (tarefa de prospecção ou visita), vendedor pode marcar que não foi presencial e escolher um motivo de uma lista
- [x] **CONC-03**: Motivos de conclusão remota formam uma 6ª lista editável pelo Supervisor (mesmo padrão de categoria/produtos/motivos de perda)
- [x] **CONC-04**: Conclusão remota conta como conclusão normal — entra no diário do cliente, e para visita de cliente ativo, ainda sugere a próxima data pela frequência
- [x] **CONC-05**: O motivo escolhido aparece como texto no Diário do cliente, junto do resumo

## v2 Requirements

Nenhum item deferido identificado neste marco.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Arrastar item pra outro dia no calendário | Decisão explícita do dono do projeto — calendário é só visualização; pra mudar a data, continua abrindo o item normalmente |
| Mini-calendário lateral de navegação rápida | Testado no sketch 003 (Variante B) e descartado — a Variante A (barra simples) já atende, sem a complexidade extra |
| Grade de horários (hora do dia) nas visões de dia/semana | Itens da Agenda nunca tiveram hora do dia, só data — inventar esse conceito agora seria escopo novo, não um "port" de funcionalidade existente |
| Motivo de conclusão remota como texto livre | Decisão explícita do dono do projeto — lista fixa editável pelo Supervisor, mesmo padrão do motivo de perda, permite agregação/relatório futuro |
| Validação de formato ou lista fixa imutável para motivos de conclusão remota já usados | Segue o mesmo padrão já usado em `frequencias_pedido` (renomear não propaga) — sem necessidade de trava adicional |

## Traceability

Preenchido durante a criação do roadmap (2026-08-17).

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGD-07 | Phase 20 | Complete |
| AGD-08 | Phase 20 | Complete |
| AGD-09 | Phase 20 | Complete |
| AGD-10 | Phase 20 | Complete |
| AGD-11 | Phase 20 | Complete |
| AGD-12 | Phase 20 | Complete |
| AGD-13 | Phase 21 | Complete |
| AGD-14 | Phase 20 | Complete |
| CONC-02 | Phase 22 | Complete |
| CONC-03 | Phase 22 | Complete |
| CONC-04 | Phase 22 | Complete |
| CONC-05 | Phase 22 | Complete |

**Coverage:**

- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

**Por fase:**

| Phase | Requisitos | Total |
|-------|------------|-------|
| Phase 20 — Calendário da Agenda — Mês, Semana e Dia | AGD-07, AGD-08, AGD-09, AGD-10, AGD-11, AGD-12, AGD-14 | 7 |
| Phase 21 — Calendário — O Que Já Foi Feito em Datas Passadas | AGD-13 | 1 |
| Phase 22 — Conclusão Remota com Motivo | CONC-02, CONC-03, CONC-04, CONC-05 | 4 |

---
*Requirements defined: 2026-08-14*
*Last updated: 2026-08-17 — traceability preenchida na criação do roadmap v1.5 (Fases 20-22)*
