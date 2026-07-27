# Phase 10: Desativação de Membro da Equipe - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 10-Desativação de Membro da Equipe
**Areas discussed:** Supervisor pode se autodesativar?, Dá pra reativar depois?, Vendedor sem cliente em andamento

---

## Supervisor pode se autodesativar?

| Option | Description | Selected |
|--------|-------------|----------|
| Não permitir | Bloqueia a pessoa de desativar a própria conta, mesmo que sobre outro Supervisor | ✓ |
| Permitir normalmente | Segue a mesma regra de qualquer outro membro | |

**User's choice:** Não permitir

---

## Dá pra reativar depois?

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, quero poder reativar | Pessoa desativada continua na lista com selo "Inativo", Supervisor pode reativar | ✓ |
| Não precisa por enquanto | Ação sem volta nesta primeira versão | |

**User's choice:** Sim, quero poder reativar

---

## Vendedor sem cliente em andamento

| Option | Description | Selected |
|--------|-------------|----------|
| Não, pula direto pra desativação | Sem nada pra transferir, não pede substituto | |
| Sim, sempre pede um substituto | Mantém o mesmo fluxo em todos os casos | ✓ |

**User's choice:** Sim, sempre pede um substituto

---

## Claude's Discretion

- Local/gatilho exato na tela "Gerenciar equipe" e desenho do diálogo de escolha do substituto.
- Nome/assinatura da RPC de desativação/reativação (uma RPC com parâmetro, ou duas separadas).
- Estratégia técnica exata pra bloquear login (Auth Admin API via Server Action vs Edge Function).
- Se `profiles.ativo` precisa de RPC security definer ou uma policy de UPDATE nova.

## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.
