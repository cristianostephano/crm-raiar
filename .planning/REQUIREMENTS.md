# Requirements: CRM Raiar — Acompanhamento de Vendas

**Defined:** 2026-08-10
**Core Value:** O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado.

## v1 Requirements

Requisitos do marco v1.4 — CNPJ Obrigatório no Ganho.

### CNPJ Obrigatório

- [x] **CNPJ-01**: Ao mover um card para "ganho", o sistema exige CNPJ preenchido — validação no RPC `mover_card_funil` (banco), não só na tela
- [x] **CNPJ-02**: Clientes que já são "ganho" sem CNPJ continuam funcionando normalmente (Agenda, ficha, diário) sem qualquer bloqueio, até serem regularizados

### Planilhas

- [x] **IMP-01**: Planilha "Importar clientes" (clientes novos, v1.1) ganha CNPJ como coluna opcional
- [x] **IMP-02**: Planilha "Importar clientes" (clientes novos, v1.1) ganha Nome Fantasia como coluna opcional
- [ ] **IMP-03**: Supervisor sobe uma nova planilha "CNPJ em massa" (Razão Social + CNPJ) para regularizar clientes já "ganho" hoje — casamento por nome (mesmo padrão de `atualizar_frequencia_visita_lote`, Fase 17), nome ambíguo vira erro de linha, estruturalmente incapaz de criar cliente novo

## v2 Requirements

Nenhum item deferido identificado neste marco.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Validação de formato/dígito verificador de CNPJ | Fora do pedido original — o campo vira obrigatório (não vazio) no "ganho", mas o formato não é validado nesta versão; mesma postura adotada para CNPJ opcional em v1.3 |
| Detecção de duplicado por CNPJ na importação de clientes novos | CNPJ continua opcional em clientes novos (só entra depois, no "ganho"); duplicado continua comparado por razão social, sem mudança |
| CNPJ obrigatório retroativamente (bloquear clientes já "ganho" sem CNPJ) | Decisão explícita do dono do projeto — grandfathering, mesmo padrão de VIS-04 (frequência de visita) da Fase 13 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CNPJ-01 | Phase 18 | Complete |
| CNPJ-02 | Phase 18 | Complete |
| IMP-01 | Phase 19 | Complete |
| IMP-02 | Phase 19 | Complete |
| IMP-03 | Phase 19 | Pending |

**Coverage:**

- v1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-10*
*Last updated: 2026-08-10 after roadmap creation (Phases 18-19)*
