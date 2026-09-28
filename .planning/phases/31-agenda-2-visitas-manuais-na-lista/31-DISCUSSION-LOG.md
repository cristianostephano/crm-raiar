# Phase 31: Agenda 2 — Visitas Manuais na Lista - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 31-agenda-2-visitas-manuais-na-lista
**Areas discussed:** Formato da lista, Contador no menu, Permissão do Supervisor

---

## Formato da lista

| Option | Description | Selected |
|--------|-------------|----------|
| Atrasado/Hoje/Próximos | Mesmo padrão já usado na Agenda atual | ✓ |
| Por dia | Mais literal ao pedido, mas padrão novo de tela | |
| Você decide | Deixa a escolha pra Claude | |

**User's choice:** Atrasado/Hoje/Próximos

| Item atrasado destacado? | | |
|---|---|---|
| Sim, mesmo destaque de hoje | ✓ |
| Não, sem destaque especial | |

**User's choice:** Sim, mesmo destaque

| Pode desmarcar item concluído? | | |
|---|---|---|
| Sim, pode desmarcar | ✓ |
| Não, só permite apagar | |

**User's choice:** Sim, pode desmarcar

| Sistema impede item duplicado? | | |
|---|---|---|
| Não valida, permite livremente | |
| Avisa mas permite | ✓ |

**User's choice:** Avisa mas permite

| Ordem dentro do dia | | |
|---|---|---|
| Ordem de criação | ✓ |
| Ordem alfabética (nome) | |
| Você decide | |

**User's choice:** Ordem de criação

| Item pra data passada permitido? | | |
|---|---|---|
| Sim, permite qualquer data | ✓ |
| Não, só hoje em diante | |

**User's choice:** Sim, permite qualquer data

| Editar item já concluído? | | |
|---|---|---|
| Pode editar direto | ✓ |
| Precisa desmarcar primeiro | |

**User's choice:** Pode editar direto

| Estado vazio | | |
|---|---|---|
| Mensagem simples de boas-vindas | ✓ |
| Você decide | |

**User's choice:** Mensagem simples de boas-vindas

| Horizonte de "Próximos" | | |
|---|---|---|
| Mesmo horizonte da Agenda atual | ✓ |
| Sem limite — mostra tudo pendente | |

**User's choice:** Mesmo horizonte da Agenda atual

| Busca/filtro por texto na lista? | | |
|---|---|---|
| Não tem busca nesta fase | ✓ |
| Tem campo de busca simples | |

**User's choice:** Não tem busca nesta fase

**Notes:** Usuário pediu "mais perguntas" repetidas vezes sem conteúdo adicional específico — esclarecido que era pra Claude continuar perguntando, não que o usuário tinha mais pontos a acrescentar. Área fechada sem itens em aberto adicionais.

---

## Contador no menu

| Contador de pendentes ou sem contador? | | |
|---|---|---|
| Sem contador (como Perdidos/Encerrados) | |
| Com contador de pendentes (como Agenda) | ✓ |

**User's choice:** Com contador de pendentes

| Ordem final do menu confirmada? | | |
|---|---|---|
| Sim, Agenda → Agenda 2 → Clientes → Perdidos → Encerrados → Dashboard | ✓ |
| Quero outra ordem | |

**User's choice:** Confirmado

| O que o contador conta? | | |
|---|---|---|
| Só pendentes do próprio vendedor | ✓ |
| Inclui também atrasados (contagem separada) | |

**User's choice:** Só pendentes do próprio vendedor (atrasado já está incluso, sem contagem separada)

| Menu compacto mostra bolinha sem número? | | |
|---|---|---|
| Sim, mesmo padrão da Agenda | ✓ |
| Você decide | |

**User's choice:** Sim, mesmo padrão da Agenda

---

## Permissão do Supervisor

| Supervisor cria item? | | |
|---|---|---|
| Só visualiza (recomendado) | ✓ |
| Pode criar pra si mesmo | |
| Pode criar pra qualquer vendedor | |

**User's choice:** Só visualiza

| Filtro por vendedor segue padrão atual? | | |
|---|---|---|
| Sim, mesmo padrão de hoje | ✓ |
| Você decide | |

**User's choice:** Sim, mesmo padrão de hoje

| Filtro padrão do Supervisor abre em quê? | | |
|---|---|---|
| Abre em "Todos" (todo o time) | ✓ (única opção oferecida, confirmada) |

**User's choice:** Abre em "Todos"

| Vendedor desativado: itens ficam sem transferência? | | |
|---|---|---|
| Sim, tá bom assim | ✓ |
| Quero outro comportamento | |

**User's choice:** Sim, tá bom assim

---

## Claude's Discretion

- Texto exato do estado vazio da lista.
- Desempate de ordem quando dois itens têm o mesmo instante de criação (usar `id`/`created_at`).
- Ícone do item "Agenda 2" no menu.
- Texto exato do aviso de possível duplicado.

## Deferred Ideas

- **Prazo de guarda dos dados do piloto (LGPD)** — área oferecida como opção de discussão ("Prazo de guarda (LGPD)") mas NÃO selecionada pelo usuário entre as áreas a discutir. Registrado como alerta explícito em `31-CONTEXT.md` §`<deferred>` por exigência de política interna de proteção de dados — precisa de decisão do dono antes de produção continuada ou de descarte futuro da Agenda 2.
- **Repetição semanal e Calendário** — pertence à Fase 32, já mapeada no roadmap, não discutida aqui por já estar fora do escopo desta fase.
