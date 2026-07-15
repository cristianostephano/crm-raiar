# Phase 1: Autenticação e Papéis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 1-Autenticação e Papéis
**Areas discussed:** Criação de conta, Atribuição de papel, Recuperação de senha, Tela de login/cadastro

---

## Criação de conta

| Option | Description | Selected |
|--------|-------------|----------|
| Supervisor cria a conta | Supervisor cadastra o vendedor e o sistema gera o acesso | ✓ |
| Cadastro aberto | Qualquer pessoa com o link se cadastra sozinha | |

**User's choice:** Supervisor cria a conta

| Option | Description | Selected |
|--------|-------------|----------|
| Convite por e-mail | Sistema manda link pro vendedor definir a própria senha | ✓ |
| Supervisor define senha | Supervisor digita senha provisória e passa por fora | |

**User's choice:** Convite por e-mail

| Option | Description | Selected |
|--------|-------------|----------|
| Cadastro direto no banco | Claude cadastra a primeira conta de Supervisor durante a implementação | ✓ |
| Tela especial de primeiro acesso | Sistema detecta ausência de Supervisor e libera tela dedicada | |

**User's choice:** Cadastro direto no banco

| Option | Description | Selected |
|--------|-------------|----------|
| Fica pra depois | Desativação de acesso não entra nesta fase | ✓ |
| Precisa já nessa fase | Supervisor precisa de botão pra desativar/reativar vendedor | |

**User's choice:** Fica pra depois

---

## Atribuição de papel

| Option | Description | Selected |
|--------|-------------|----------|
| Supervisor escolhe na hora | Campo de papel no formulário de cadastro | ✓ |
| Sempre nasce Vendedor | Virar Supervisor é exceção rara feita no banco | |

**User's choice:** Supervisor escolhe na hora

| Option | Description | Selected |
|--------|-------------|----------|
| Pode ter mais de um | Sistema suporta múltiplos Supervisores desde o início | ✓ |
| Só eu, por enquanto | Não precisa suportar múltiplos supervisores agora | |

**User's choice:** Pode ter mais de um

| Option | Description | Selected |
|--------|-------------|----------|
| Fica pra depois | Troca de papel de usuário existente não entra nesta fase | ✓ |
| Precisa já nessa fase | Supervisor precisa de tela pra trocar papel de alguém | |

**User's choice:** Fica pra depois

---

## Recuperação de senha

| Option | Description | Selected |
|--------|-------------|----------|
| Entra já nessa fase | Fluxo padrão do Supabase Auth, custo baixo de implementar junto | ✓ |
| Fica pra depois | Supervisor redefine manualmente por enquanto | |

**User's choice:** Entra já nessa fase

---

## Tela de login/cadastro

| Option | Description | Selected |
|--------|-------------|----------|
| Simples: email + senha | Tela limpa, sem cadastro visível | ✓ |
| Deixe eu descrever | Usuário descreve em texto livre | |

**User's choice:** Simples: email + senha

| Option | Description | Selected |
|--------|-------------|----------|
| Dentro do sistema, logado | Supervisor cadastra vendedor numa área protegida pós-login | ✓ |
| Deixe eu descrever | Usuário descreve em texto livre | |

**User's choice:** Dentro do sistema, logado

---

## Claude's Discretion

- Layout visual específico da tela de login e da área de gerenciar equipe
- Textos de erro e mensagens de feedback
- Duração exata da sessão / estratégia de refresh de token (segue padrão do `@supabase/ssr`)

## Deferred Ideas

- Desativar/reativar acesso de um usuário pela tela — candidato a fase futura
- Trocar o papel de um usuário existente pela tela — candidato a fase futura
