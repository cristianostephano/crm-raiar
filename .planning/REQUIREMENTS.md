# Requirements: CRM Raiar — Acompanhamento de Vendas

**Defined:** 2026-08-24
**Core Value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.

## v1 Requirements

Requisitos do marco v1.6. Cada um mapeia para uma fase do roadmap.

### Importar Clientes Ativos

- [ ] **ATIVO-01**: Supervisor importa clientes ativos em massa via nova planilha "Importar Clientes Ativos", que exige todos os dados do cliente (razão social, CNPJ, endereço completo, responsável, contato, etc.) — só a frequência de visita fica de fora
- [ ] **ATIVO-02**: Cliente importado por essa planilha entra direto no status "ganho" (ativo), sem passar pelas 7 etapas do funil
- [ ] **ATIVO-03**: Linha com dado obrigatório faltando vira erro daquela linha (mesmo padrão de revisão antes de gravar já usado nas outras importações) — nunca trava o lote inteiro
- [ ] **ATIVO-04**: Duplicado é detectado na importação de ativos com a mesma lógica já usada nas outras importações

### Importar Clientes em Prospecção

- [ ] **PROSP-01**: "Importar clientes" é renomeada para "Importar Clientes em Prospecção" no menu
- [ ] **PROSP-02**: Planilha de prospecção exige só Nome Fantasia + Responsável; razão social e os demais campos (endereço, CNPJ, etc.) ficam opcionais, preenchidos aos poucos
- [ ] **PROSP-03**: Cliente importado por essa planilha entra na primeira etapa do funil ("Aguardando contato"), como já acontece hoje

### Trava do "Ganho"

- [x] **GANHO-01**: Ao tentar marcar um cliente como "ganho" faltando razão social ou endereço completo, o sistema bloqueia e orienta o vendedor a completar a ficha do cliente antes
- [x] **GANHO-02**: A trava de razão social/endereço no "ganho" é só de TRANSIÇÃO, nunca retroativa — clientes já "ganho" antes deste marco, mesmo sem esses dados completos, continuam funcionando normalmente (mesmo padrão de grandfathering do CNPJ-02, v1.4)
- [x] **GANHO-03**: A caixinha de marcar "ganho" continua pedindo só CNPJ + frequência — não cresce para um formulário maior

### Dia Fixo (Recorrência de Visita)

- [ ] **ANCORA-01**: Ao definir frequência de visita semanal ou quinzenal de um cliente ativo, o vendedor também escolhe um dia fixo da semana
- [ ] **ANCORA-02**: Ao definir frequência mensal, o vendedor escolhe a semana do mês (1ª/2ª/3ª/4ª/Última) + o dia da semana
- [ ] **ANCORA-03**: Ao concluir uma visita, a sugestão de próxima data mira sempre o dia fixo definido — nunca conta dias corridos a partir da data de conclusão
- [ ] **ANCORA-04**: O sistema nunca sugere uma data de visita no passado

### Agenda

- [ ] **AGENDA-01**: Vendedor vê na Agenda quais dos seus clientes ativos ainda não têm dia fixo definido — inclui quem nunca teve frequência definida E quem já tinha frequência mas ainda não tem o dia fixo (conceito novo deste marco)

### Menu

- [ ] **MENU-01**: "Importar CNPJ" é removida do sistema por completo (código, rota, testes)
- [ ] **MENU-02**: "Importar frequências" é removida do sistema por completo (código, rota, testes)

## v2 Requirements

Nenhum item deferido identificado nesta rodada — escopo do marco definido em conversa direta com o dono do projeto, sem pesquisa de features geral apontando diferenciadores extras fora do que já foi capturado acima.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Editar cliente ativo já existente em massa (planilha de update) | A nova planilha só cria clientes novos, nunca atualiza — mesma decisão já tomada em v1.1 (importação nunca é upsert) |
| Planilha em massa para dia fixo/frequência | Dono do projeto confirmou que não precisa de planilha para isso — dia fixo se define individualmente, pela ficha do cliente ou pela Agenda |
| Semana do mês "5ª" (quinta ocorrência) | Não existe na maioria dos meses; opções ficam limitadas a 1ª/2ª/3ª/4ª/Última, mesmo padrão do Google Calendar/Outlook |
| Reagendamento automático e silencioso da próxima visita | Contradiz decisão já travada em v1.3 — vendedor sempre confirma a sugestão |
| Seed automático de primeira visita ao importar cliente ativo sem frequência | Frequência é deliberadamente omitida da importação de ativos; a primeira visita só é criada quando o vendedor definir a frequência/dia fixo depois, pela ficha ou Agenda |
| Caixinha de "ganho" crescer para formulário completo | Decisão explícita do dono — preferiu manter a caixinha pequena e bloquear com orientação para completar na ficha |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ATIVO-01 | Phase 25 | Pending |
| ATIVO-02 | Phase 25 | Pending |
| ATIVO-03 | Phase 25 | Pending |
| ATIVO-04 | Phase 25 | Pending |
| PROSP-01 | Phase 26 | Pending |
| PROSP-02 | Phase 26 | Pending |
| PROSP-03 | Phase 26 | Pending |
| GANHO-01 | Phase 23 | Complete |
| GANHO-02 | Phase 23 | Complete |
| GANHO-03 | Phase 23 | Complete |
| ANCORA-01 | Phase 24 | Pending |
| ANCORA-02 | Phase 24 | Pending |
| ANCORA-03 | Phase 24 | Pending |
| ANCORA-04 | Phase 24 | Pending |
| AGENDA-01 | Phase 24 | Pending |
| MENU-01 | Phase 26 | Pending |
| MENU-02 | Phase 26 | Pending |

**Coverage:**

- v1 requirements: 17 total
- Mapped to phases: 17 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-08-24*
*Last updated: 2026-08-24 after roadmap creation (Phases 23-26)*
