# Phase 24: Dia Fixo na Recorrência de Visita - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 24-dia-fixo-na-recorrência-de-visita
**Areas discussed:** Cliente sem dia fixo ainda, Onde definir o dia fixo, Como a Agenda avisa, Recalcular ao definir pela primeira vez

---

## Cliente sem dia fixo ainda

| Option | Description | Selected |
|--------|-------------|----------|
| Continua como hoje: conta dias a partir da conclusão | Nada muda pra esse cliente até o vendedor definir o dia fixo; comportamento novo só vale depois que o dia fixo existir | ✓ |
| Trava a conclusão de visita até definir o dia fixo | Vendedor é obrigado a definir o dia fixo antes de conseguir concluir a próxima visita | |

**User's choice:** Continua como hoje (fallback pro cálculo antigo)
**Notes:** Nenhuma nota adicional.

---

## Onde definir o dia fixo

| Option | Description | Selected |
|--------|-------------|----------|
| Nos dois lugares, mesma tela | Select de frequência na ficha ganha o dia fixo do lado; aviso da Agenda é só um atalho pra essa mesma ficha | ✓ |
| Só na ficha do cliente | Aviso da Agenda é só lista informativa, sem link direto | |
| Só pela Agenda, formulário próprio ali mesmo | Mini-formulário embutido direto na linha do aviso | |

**User's choice:** Nos dois lugares, mesma tela (ficha do cliente é o único formulário; Agenda só linka pra lá)
**Notes:** Nenhuma nota adicional.

---

## Como a Agenda avisa quem falta dia fixo

| Option | Description | Selected |
|--------|-------------|----------|
| Seção própria no topo da Lista | Seção nova antes/depois de Atrasado/Hoje/Próximos, listando os clientes, cada um levando pra ficha ao clicar | ✓ |
| Só um contador/selo no menu, sem lista | Número no menu, sem lista dedicada | |
| Aparece só no Calendário, não na Lista | Fica restrito à visão de calendário | |

**User's choice:** Seção própria na Lista
**Notes:** Nenhuma nota adicional.

---

## Recalcular a próxima visita ao definir o dia fixo pela primeira vez

| Option | Description | Selected |
|--------|-------------|----------|
| Só a partir da próxima conclusão | A visita já marcada continua na data original; dia fixo só rege a visita seguinte | ✓ |
| Recalcula na hora pro novo dia fixo | A visita já marcada muda imediatamente pra próxima ocorrência do dia fixo escolhido | |

**User's choice:** Só a partir da próxima conclusão
**Notes:** Evita mudar de surpresa um compromisso já combinado com o cliente.

---

## Claude's Discretion

- Texto/rótulo exato da seção nova na Agenda
- Layout exato do Select de dia fixo/semana do mês na ficha (ao lado vs. abaixo do Select de frequência)
- Algoritmo exato de "próxima ocorrência do dia fixo" em PL/pgSQL
- Nomenclatura exata das colunas/enums novos em `clientes`

## Deferred Ideas

Nenhuma — as 4 áreas discutidas ficaram inteiramente dentro do escopo da Fase 24.
