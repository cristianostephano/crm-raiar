---
phase: quick-260928-fqk
plan: 01
subsystem: ui
tags: [typescript, vitest, nome-exibicao, funil, agenda]

# Dependency graph
requires:
  - phase: 26-02
    provides: "razão social opcional no cadastro/importação (PROSP-02), motivo original de nomeExibicaoCliente() existir"
provides:
  - "nomeExibicaoCliente() com prioridade invertida: Nome Fantasia primeiro, razão social em segundo, ROTULO_SEM_NOME por último"
  - "5 casos novos de teste unitário cobrindo a nova prioridade, incluindo um caso de regressão com dado fictício (padrão de razão social de MEI)"
affects: [funil, agenda, perdidos, encerrados]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Autoridade única (lib/clientes/nomeExibicao.ts) continua sendo o único ponto de mudança para afetar todas as telas consumidoras — nenhuma tela foi tocada"

key-files:
  created: []
  modified:
    - lib/clientes/nomeExibicao.ts
    - tests/clientes/nome-exibicao.test.ts
    - tests/agenda/sem-dia-fixo.test.tsx

key-decisions:
  - "Ordem dos dois `if` invertida (Nome Fantasia primeiro); ordem dos PARÂMETROS da função mantida (razaoSocial, nomeFantasia) de propósito, para não desfazer a inversão silenciosamente nas 14 chamadas existentes no código"
  - "Nenhuma tela, lib de lista, migration ou banco alterado — mudança concentrada só na autoridade única"

patterns-established: []

requirements-completed: [QUICK-260928-fqk]

coverage:
  - id: D1
    description: "nomeExibicaoCliente() prioriza Nome Fantasia sobre razão social quando os dois estão preenchidos, incluindo o caso de regressão fictício do padrão de MEI"
    requirement: "QUICK-260928-fqk"
    verification:
      - kind: unit
        ref: "tests/clientes/nome-exibicao.test.ts#nomeExibicaoCliente"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cliente sem Nome Fantasia (nulo/indefinido/vazio/só espaços) continua caindo para a razão social; sem nenhum dos dois, continua 'Sem nome'"
    requirement: "QUICK-260928-fqk"
    verification:
      - kind: unit
        ref: "tests/clientes/nome-exibicao.test.ts#nomeExibicaoCliente"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tela da Agenda 'sem dia fixo' mostra o Nome Fantasia (não a razão social) quando os dois estão preenchidos, sem a razão social vazar para a tela"
    requirement: "QUICK-260928-fqk"
    verification:
      - kind: unit
        ref: "tests/agenda/sem-dia-fixo.test.tsx#AgendaSemDiaFixo — nome exibido (AGD-15)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhuma tela consumidora (ClienteCard, KanbanBoard, ClienteDetailSheet, PerdidosItemRow, EncerradosItemRow, lib/perdidos/lista.ts, lib/encerrados/lista.ts) foi editada — a suíte dependente inteira (12 arquivos) continua verde"
    requirement: "QUICK-260928-fqk"
    verification:
      - kind: unit
        ref: "npx vitest run (12 arquivos dependentes) — 149 testes"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-09-28
status: complete
---

# Quick Task 260928-fqk: Inverter prioridade de nomeExibicaoCliente() Summary

**`nomeExibicaoCliente()` passa a priorizar o Nome Fantasia sobre a razão social em todas as telas do CRM (funil, ficha, Agenda, Perdidos, Encerrados), sem editar nenhuma delas — só o único ponto de autoridade que decide o nome exibido.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-28
- **Tasks:** 2/2
- **Files modified:** 3 (lib/clientes/nomeExibicao.ts, tests/clientes/nome-exibicao.test.ts, tests/agenda/sem-dia-fixo.test.tsx)

## Accomplishments

- Inverteu a ordem dos dois `if` de `nomeExibicaoCliente()`: Nome Fantasia vence quando os dois estão preenchidos; razão social continua como segunda opção; `ROTULO_SEM_NOME` ("Sem nome") continua igual quando nenhum dos dois está preenchido.
- Assinatura da função (ordem dos parâmetros `razaoSocial, nomeFantasia`) mantida intacta de propósito — as 14 chamadas existentes no código continuam corretas sem qualquer edição.
- Testes reescritos primeiro (RED), depois a implementação (GREEN): suíte dependente inteira (12 arquivos, 149 testes) passou verde, `tsc --noEmit` e `eslint` limpos nos 3 arquivos da task.

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Reescrever os testes para a nova prioridade (RED)** — `ea2ce1e` (test)
2. **Task 2: Inverter a prioridade em nomeExibicaoCliente() e rodar a suíte dependente (GREEN)** — `91c0bef` (feat)

_Nenhum commit de plano/metadados incluído aqui — o orquestrador cuida do commit de docs separadamente._

## Files Created/Modified

- `lib/clientes/nomeExibicao.ts` - Autoridade única do nome exibido; ordem dos `if` invertida (Nome Fantasia primeiro), JSDoc atualizado com o histórico da mudança
- `tests/clientes/nome-exibicao.test.ts` - Casos reescritos/adicionados para a nova prioridade, incluindo um caso de regressão com dado fictício
- `tests/agenda/sem-dia-fixo.test.tsx` - Caso "os dois preenchidos" do describe AGD-15 reescrito para provar que a tela mostra o Nome Fantasia e não deixa a razão social vazar

## Decisions Made

- Trocar só a ordem dos dois `if` (não a ordem dos parâmetros da função) — trocar os parâmetros teria o mesmo efeito visual só neste teste, mas desfaria a inversão silenciosamente nas 14 chamadas reais do código, já que os dois parâmetros têm o mesmo tipo (`string | null | undefined`) e o TypeScript não acusaria erro nenhum.
- Escopo travado nesta task: nenhuma tela, componente, lib de lista, migration ou banco foi tocado — a mudança chega a todas as telas só por elas consumirem a mesma função.

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered

None.

## Motivo de negócio (linguagem simples, para o dono do projeto)

45 clientes reais em produção têm a razão social começando com um número em formato de documento seguido do nome de uma pessoa (padrão típico de razão social de MEI: raiz do CNPJ + nome completo do titular). A política de segurança (DLP) do computador de um usuário do time detecta esse padrão e mascara o texto — o nome do cliente literalmente some da tela dele. Os 45 já têm o Nome Fantasia preenchido. Você (dono do projeto) decidiu aplicar a troca para **todos** os clientes, não só para corrigir esses 45 — porque prefere o Nome Fantasia como nome principal de exibição em geral. Nenhum valor real desses 45 clientes foi copiado para teste, commit ou este documento — só a contagem e o padrão em termos abstratos, por exigência da LGPD (a razão social de um MEI carrega o nome completo de uma pessoa física, que é dado pessoal).

## Observação sobre a origem dos 45 (para você avaliar, sem ação nesta task)

O formato "número de documento + nome completo" é o jeito **oficial** de uma razão social de MEI ser formada (raiz do CNPJ + nome do titular) — ou seja, muito provavelmente **não é um erro de importação ou de digitação**. Recomendo não "limpar" esses registros no banco sem confirmar antes que isso é realmente desejado. Como esse formato contém o nome completo de uma pessoa física, ele é dado pessoal sob a LGPD; a troca feita nesta task para priorizar o Nome Fantasia **reduz** a exposição desse dado na tela (a razão social deixa de ser o texto em destaque, mas continua disponível no campo editável da ficha do cliente, que é o lugar correto para consulta/edição).

## Efeito colateral esperado (não corrigido, fora do escopo desta task)

A busca e a ordenação alfabética ("A-Z") do Kanban, além da busca das telas de Perdidos e Encerrados, usam o mesmo nome exibido. Depois desta mudança, para um cliente que tem os dois nomes preenchidos:
- Digitar a razão social na busca **não encontra mais** esse cliente — é preciso digitar o Nome Fantasia.
- A ordem alfabética do Kanban muda, porque agora ordena pelo Nome Fantasia quando ele existe.

Isso é esperado e não é um bug desta task. Sugestão de melhoria futura (opcional, não decidido): fazer a busca casar tanto pela razão social quanto pelo Nome Fantasia, para nenhum dos dois "sumir" da busca.

## Comentários desatualizados deixados de propósito (escopo travado), para um follow-up de documentação

Estes arquivos têm comentários que ainda descrevem a ordem antiga ("razão social, com queda para Nome Fantasia") e não foram tocados nesta task, por estarem fora do escopo travado do pedido:
- `components/clientes/KanbanBoard.tsx` (~linha 94 e ~linha 358)
- `lib/perdidos/lista.ts` (~linha 152)
- `lib/encerrados/lista.ts` (~linha 158)
- De forma mais branda ("quando razão social vier nula"): `components/clientes/ClienteCard.tsx` (~linhas 33-35), `lib/supabase/queries/clientes.ts` (~linhas 27-28), `lib/agenda/itens.ts` (~linha 514)

Nenhum desses comentários afeta o comportamento do sistema — é só texto explicativo desatualizado, recomendado corrigir num follow-up de documentação leve.

## Publicação

Só commits locais nesta task (`ea2ce1e` e `91c0bef`). Nenhum `git push` foi feito. A publicação segue o fluxo obrigatório do projeto: `staging` -> link de teste da Vercel -> `master`, só quando você pedir.

## Next Phase Readiness

Sem bloqueios. A mudança está isolada em `lib/clientes/nomeExibicao.ts` e nos dois arquivos de teste; nenhuma outra tela precisa de trabalho adicional para refletir a nova prioridade.

## Self-Check: PASSED

- FOUND: lib/clientes/nomeExibicao.ts
- FOUND: tests/clientes/nome-exibicao.test.ts
- FOUND: tests/agenda/sem-dia-fixo.test.tsx
- FOUND: .planning/quick/260928-fqk-inverter-prioridade-de-nomeexibicaoclien/260928-fqk-SUMMARY.md
- FOUND commit: ea2ce1e
- FOUND commit: 91c0bef

---
*Quick task: 260928-fqk*
*Completed: 2026-09-28*
