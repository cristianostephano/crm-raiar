---
id: SEED-001
status: dormant
planted: 2026-07-25
planted_during: v1.2 discussion (discuss-milestone conversation, before roadmap)
trigger_when: next milestone after v1.2 ships (Marco B, explicitly split out for size)
scope: large
---

# SEED-001: Agenda do vendedor (prospecção + pós-venda, agendada e sinalizada)

## Why This Matters

Levantado pelo dono do projeto durante a discussão do marco v1.2: hoje as tarefas de
prospecção vivem soltas dentro de cada card do funil, sem uma visão unificada de "o
que eu preciso fazer hoje/essa semana". E não existe nenhum conceito de relacionamento
pós-venda — quando um cliente vira "ganho", o card só fica parado, sem rotina de visita.
O dono do projeto quer uma agenda única que resolva as duas coisas.

Foi deliberadamente separado do marco v1.2 (Gestão de Equipe, Análises de Funil e
Filtros) por tamanho — é uma peça bem maior que as outras 5 do marco v1.2, com um
conceito de domínio novo (cliente "ativo" pós-funil) e mecânica própria (recorrência,
sugestão de próxima data, histórico de resumos).

## When to Surface

**Trigger:** assim que o marco v1.2 for encerrado — este é o próximo marco natural
(Marco B da mesma conversa de discovery).

Este seed deve aparecer automaticamente na próxima `/gsd-new-milestone`.

## Scope Estimate

**Large** — provavelmente 3-5 fases: extensão do modelo de cliente (campos de "ativo"),
mecânica de recorrência de visita, tela de agenda (novo item de menu, nível principal,
acima de "Clientes"), fluxo de conclusão+resumo, histórico de visitas por cliente.

## Domain Notes (captured verbatim from discovery — do not re-derive, just re-verify against code state at design time)

**Duas frentes, uma agenda só:**
- **Frente 1 — Prospecção:** as tarefas que já existem hoje nos cards do funil (ex:
  "Visitar", "Mandar mensagem", enum `tipos_tarefa`) entram **automaticamente** na
  agenda — sem cadastro duplicado, sem nova entidade.
- **Frente 2 — Pós-venda:** clientes que já venceram o funil ("ganho") entram numa
  rotina de visitas recorrentes.
- Cada item da agenda aparece **sinalizado visualmente** (prospecção vs cliente ativo).

**Navegação:** item próprio no menu principal, no topo, **acima de "Clientes"** — não
uma aba dentro da tela de clientes/funil.

**Recorrência (frente 2):**
- Ao marcar o card como "ganho", o vendedor define a frequência de visita: semanal,
  quinzenal, mensal, ou N/A (sem visita recorrente).
- Editável/cancelável depois, a qualquer momento (ex: cliente pediu pra reduzir a
  frequência, ou parou de comprar).
- Ao concluir uma visita, o sistema **sugere** a próxima data com base na frequência
  (ex: visitou numa sexta, frequência semanal → sugere a sexta seguinte) — o vendedor
  confirma ou ajusta, não é 100% automático/silencioso.

**Conclusão + resumo (vale nas DUAS frentes):**
- Ao marcar uma tarefa de prospecção OU uma visita pós-venda como feita, o vendedor
  escreve um resumo breve do que aconteceu.
- Esses resumos ficam guardados e visíveis depois como um histórico de visitas por
  cliente (tipo um "diário") — tanto pro vendedor quanto pro supervisor.
- Pode reaproveitar o mecanismo de `historico` já existente (`supabase/migrations/0002_clientes_and_funil.sql`,
  tabela `historico`, hoje só populada por triggers automáticos com `descricao` em
  texto livre) — ou precisar de um campo estruturado novo se o "resumo" precisar ser
  mais rico que uma descrição de linha única. Avaliar no research/planning da fase.

**Campos novos de "cliente ativo" (só exigidos quando o cliente vira ativo — NUNCA
obrigatório em prospecção, mantendo o cadastro inicial rápido):**
- Nome Fantasia (novo — hoje só existe `razao_social`)
- CNPJ (novo — não existe nenhum campo de documento hoje)
- Endereço, Contato, Telefone (já existem no cadastro)
- Frequência de pedidos: 2x/semana, 3x/semana, semanal, quinzenal, ou mensal —
  **só informativo por enquanto, sem alerta automático** (o sistema não tem como saber
  se o pedido realmente aconteceu, já que pedidos não são registrados no CRM)
- Frequência de visitas: semanal, quinzenal, mensal, ou N/A — é a mesma frequência de
  recorrência da frente 2 acima, não é um campo duplicado
- Segmento — **é a mesma coisa que a `categorias` (FS/VT/AS) que já existe**, sem
  campo novo, apenas reaproveitar

## Breadcrumbs

- `supabase/migrations/0002_clientes_and_funil.sql` — tabelas `clientes`, `tarefas`,
  `historico`, `tipos_tarefa` (enum editável) — base pra tudo isso
- `lib/validations/cliente.ts` — schema atual de cadastro de cliente, onde os novos
  campos condicionais ("só quando ativo") vão precisar de uma lógica diferente do
  schema mínimo atual
- `components/layout/AppSidebar.tsx` — onde o novo item de menu "Agenda" entra, acima
  do link de "Clientes"
- `.planning/PROJECT.md` — Key Decisions do marco v1.1/v1.2 pra manter o padrão de
  "cadastro rápido, poucos campos obrigatórios" (CLAUDE.md Core Value) mesmo com os
  campos novos de cliente ativo

## Notes

Capturado durante uma sessão de discovery longa (discuss-milestone) que também gerou
o marco v1.2. O dono do projeto mandou 3 imagens de referência de outra ferramenta
durante essa mesma conversa (funil detalhado por etapa, tabela comparativa por
vendedor, kanban com scroll) — essas viraram parte do v1.2, não deste seed. Este seed
cobre only a Agenda.
