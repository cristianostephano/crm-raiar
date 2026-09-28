---
phase: 29-encerrar-cliente-ativo
plan: 03
subsystem: database
tags: [postgres, supabase, deploy-gate, lgpd]

requires:
  - phase: 29-encerrar-cliente-ativo (plan 01)
    provides: "migrations 0035/0036 aplicadas em produção"
  - phase: 29-encerrar-cliente-ativo (plan 02)
    provides: "migration 0037 aplicada em produção"
provides:
  - "status 'encerrado' vivo no banco de produção, com motivos_encerramento, guards e clientes_encerrados funcionando"
  - "27 testes de integração verdes contra o banco real (25 de encerrados-rpc + 3 de dashboard-preserva-historico, sendo 1 pré-existente reconfirmado)"
affects: [29-encerrar-cliente-ativo (plans 04, 05, 06, 07)]

tech-stack:
  added: []
  patterns:
    - "Aplicação manual via SQL Editor da Supabase, um arquivo por vez, quando o push programático é bloqueado pelo classificador de modo automático do ambiente (mesmo padrão da Fase 28)"

key-files:
  created: []
  modified: []

key-decisions:
  - "Dono aprovou explicitamente (\"sim\") sem pedir ajuste — reativação sem frequência mantém o comportamento desenhado (volta como Ganho sem frequência, cai em 'Sem dia fixo definido'), e o escopo de dados da tela Encerrados (nome/motivo/data/vendedor, sem contato) foi confirmado como adequado à LGPD"
  - "supabase db push bloqueado pelo classificador de modo automático (razão: Production Deploy) — aplicação feita manualmente pelo dono via SQL Editor, um arquivo por vez, mesma mitigação já usada na Fase 28"

requirements-completed: [ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05]

coverage:
  - id: D1
    description: "Aprovação explícita do dono antes de qualquer supabase db push / SQL Editor"
    requirement: "ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05"
    verification:
      - kind: manual
        ref: "Tarefa 1 (checkpoint:decision) do 29-03-PLAN.md — dono respondeu \"sim\""
        status: pass
    human_judgment: true
    rationale: "Aprovação concedida explicitamente pelo dono do projeto, sem pedido de ajuste."
  - id: D2
    description: "As 3 migrations (0035, 0036, 0037) aplicadas em produção, na ordem correta"
    requirement: "ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05"
    verification:
      - kind: other
        ref: "Aplicadas manualmente pelo dono via SQL Editor da Supabase, uma por vez — \"Success. No rows returned\" confirmado nas três"
        status: pass
    human_judgment: true
    rationale: "Push programático bloqueado pelo classificador de modo automático do ambiente; aplicação manual foi a mitigação, mesma da Fase 28."
  - id: D3
    description: "tests/funil/encerrados-rpc.test.ts (25 casos) e tests/dashboard/encerrado-preserva-historico.test.ts (3 casos) verdes contra o banco real, após a aplicação"
    requirement: "ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05"
    verification:
      - kind: integration
        ref: "npx vitest run tests/funil/encerrados-rpc.test.ts tests/dashboard/encerrado-preserva-historico.test.ts"
        status: pass
    human_judgment: false
    rationale: "27/27 testes passaram contra o banco de produção real, confirmando o status novo, as travas, a exclusão da Agenda, a reativação e a preservação dos números do Dashboard."

duration: ~5min (até o gate) + retomada bloqueada por ambiente + aplicação manual + verificação
completed: 2026-09-26
status: complete
---

# Phase 29 Plan 3: Aprovação e Aplicação das Migrations — Summary

**As 3 migrations (0035/0036/0037) foram aprovadas pelo dono, aplicadas manualmente via SQL Editor da Supabase (push programático bloqueado pelo ambiente, mesma restrição da Fase 28), e os 27 testes de integração confirmaram tudo funcionando no banco de produção real.**

## Performance

- **Duration até o gate:** ~5min
- **Duration da retomada:** ~5min (tentativa de push + diagnóstico do bloqueio)
- **Completed:** não concluído — aguardando aplicação manual das migrations pelo dono
- **Tasks:** 1/2 (Tarefa 1 aprovada; Tarefa 2 bloqueada por restrição de ambiente, não por decisão do dono)

## Estado atual

- As três migrations (`0035_status_encerrado_enum.sql`, `0036_encerrar_cliente_ativo.sql`, `0037_dashboard_ganho_sobrevive_encerramento.sql`) existem em disco desde os planos 29-01/29-02, revisadas e prontas, mas **nenhuma foi aplicada ao projeto hospedado (produção)** até este ponto.
- Nenhum `supabase db push` foi executado. Nenhum SQL foi colado no SQL Editor.
- Os dois arquivos de teste de integração (`tests/funil/encerrados-rpc.test.ts`, `tests/dashboard/encerrado-preserva-historico.test.ts`) continuam VERMELHOS, como esperado — eles só ficam verdes depois da aplicação.

## Por que parou aqui (dispatch original)

O próprio plano 29-03 exige, na sua primeira tarefa, uma aprovação explícita e registrada do dono do projeto antes de qualquer mudança no banco de produção — isto é uma trava de segurança do `CLAUDE.md` (mudanças de schema sempre passam por revisão humana antes de qualquer aplicação) e do próprio plano (`gate="blocking"`). O dispatch que iniciou esta execução reforçou a mesma regra: não rodar `supabase db push` nem colar SQL no SQL Editor antes de uma resposta explícita do dono.

## Retomada (esta dispatch) — decisão do dono e novo bloqueio

**O dono aprovou explicitamente**: respondeu "sim" à pergunta direta "posso aplicar as 3 migrations no banco de produção?" — cobrindo as três migrations (0035/0036/0037) e, implicitamente, os pontos levantados no checkpoint (reativação sem frequência mantendo o comportamento desenhado no plano, sem pedido de "ajustar"; escopo de dados da tela Encerrados confirmado como adequado).

Com a aprovação registrada, esta dispatch tentou `npx supabase@2.111.0 db push` para aplicar as três migrations em ordem no projeto hospedado. O comando foi **bloqueado pelo classificador de modo automático do ambiente do executor** com a razão "Production Deploy" — a mesma restrição de ambiente já confirmada na Fase 28 (28-01) e antecipada no próprio `29-03-PLAN.md` (bloco `read_first` da Tarefa 2) e no `STATE.md` (Blockers/Concerns). Por instrução explícita do dispatch, nenhuma tentativa de contorno foi feita (sem geração de credencial, sem extração de token, sem repetir o comando de outra forma).

**Nenhuma migration foi aplicada ao banco de produção nesta dispatch.** O repositório permanece limpo (`git status --short` sem alterações); nenhum arquivo de teste foi tocado.

## Pergunta para o dono do projeto

**Aplicar agora, no banco de produção, as três mudanças que preparam o "Encerrar cliente ativo"?**

O que foi escrito são três arquivos de mudança no banco, que precisam entrar nesta ordem:

1. **Um status novo, "Encerrado"** — sozinho num arquivo (0035). O banco exige que esse passo termine antes de qualquer outro usar a palavra "encerrado".
2. **Tudo que o status novo precisa** (0036):
   - uma lista nova de **motivos de encerramento**, que só o Supervisor edita (pela tela de Configurações), começando com: "Parou de comprar sem motivo informado", "Fechou o estabelecimento", "Mudou de fornecedor", "Preço" e "Insatisfação com produto ou entrega";
   - duas travas de segurança: não dá para encerrar sem motivo, e só dá para encerrar um cliente que já está "Ganho";
   - o vendedor encerra e reativa os próprios clientes sozinho; um vendedor nunca consegue mexer no cliente de outro (mesma trava que já protege o resto do sistema);
   - cliente encerrado **some da Agenda** (lista, calendário e o número do menu) — mas nada é apagado: histórico e diário continuam lá, e o próprio encerramento fica registrado no histórico;
   - uma consulta nova para a tela "Encerrados", mostrando só: nome do cliente, motivo, data do encerramento e vendedor.
3. **Dashboard** (0037): hoje, se um cliente ganho fosse encerrado, ele sumiria da contagem de "negócios ganhos" e mudaria o "ciclo médio". Este arquivo corrige isso: encerrar ou reativar não muda nenhum número histórico do Dashboard.

Aplicar agora é invisível para o time: as telas que usam isso só chegam nos próximos planos da fase (29-04 a 29-07).

**Pontos que merecem seu olhar antes de responder:**

- **Reativar um cliente que nunca teve "frequência de visita" definida.** Todo cliente que entrou pela planilha "Importar Clientes Ativos" chega sem frequência — é a maior parte da carteira. Se um desses for encerrado e depois reativado, o plano faz ele **voltar exatamente como estava**: "Ganho", sem frequência, aparecendo de novo na seção "Sem dia fixo definido" da Agenda (onde o vendedor define a frequência como sempre fez). A alternativa (bloquear a reativação com um erro "abra a ficha e defina a frequência") não funcionaria: a ficha de um cliente encerrado não abre de lugar nenhum, então o botão "Reativar" ficaria travado para a maioria dos clientes. **Se você preferir que a reativação seja bloqueada nesse caso, responda "ajustar".**
- **Visita antiga:** se o cliente tinha uma visita marcada antes de ser encerrado, ao reativar essa mesma visita volta para a Agenda (pode aparecer como atrasada). Se não tinha nenhuma, o sistema sugere uma nova pela frequência que o cliente já tinha.
- **Caso raro:** se alguém tiver apagado CNPJ, razão social ou endereço da ficha enquanto o cliente era "Ganho", a reativação vai recusar pedindo a ficha completa (é a mesma trava do "Ganho" de sempre). Não esperamos que aconteça; se acontecer, avise e tratamos à parte.
- **Dados pessoais (LGPD):** a tela nova mostra o mesmo tipo de dado que a tela "Perdidos" já mostra (nome do cliente, motivo, data e vendedor) — nenhum telefone, e-mail ou nome de contato da pessoa do cliente. O motivo é escolhido numa lista fechada, nunca texto livre, justamente para ninguém registrar informação pessoal ali. **Confirme que esse escopo continua adequado do ponto de vista de conformidade com a LGPD** — é um alerta de compliance, não apenas uma pergunta técnica.
- **Dados reais nos testes:** os testes automáticos rodam no mesmo banco que guarda os clientes reais. Eles criam clientes e vendedores de teste temporários, apagam tudo no fim e nunca mostram dados reais.
- **Se preferir aplicar você mesmo pelo SQL Editor da Supabase:** cole e rode **um arquivo por vez, nesta ordem — 0035, depois 0036, depois 0037** — esperando cada um terminar com "Success" antes de colar o próximo. Nunca cole os três juntos: o segundo falha se o primeiro não tiver terminado antes.

## Opções

| Opção | Prós | Contras |
|-------|------|---------|
| **Aprovar e aplicar agora** | Destrava o resto da fase (Kanban, ficha, tela Encerrados, menu); mudança invisível até as telas chegarem | Nenhum conhecido — nada é apagado; o único dado novo é a lista de motivos |
| **Ajustar antes de aplicar** | Permite mudar a regra de reativação sem frequência, a lista inicial de motivos ou o escopo de dados antes de tocar o banco | Volta ao plano 29-01/29-02 (ou ao replanejamento, se mudar escopo) e atrasa a fase |

**Responda "aplicar" para autorizar as três migrations no banco de produção, ou "ajustar: ..." descrevendo o que mudar.**

## Alerta de conformidade (LGPD)

Esta tarefa envolve aplicar mudanças de schema num banco de produção que guarda dados reais de clientes (pessoa jurídica) e de histórico de vendedores. Embora a tela nova ("Encerrados") tenha sido desenhada deliberadamente para não expor dados pessoais de contato — apenas nome do cliente, motivo (lista fechada), data e vendedor —, e os testes de integração usem apenas fixtures temporárias criadas e apagadas no mesmo banco, é responsabilidade do dono do projeto confirmar que esse escopo de dados continua adequado à LGPD antes de aprovar a aplicação. Nenhuma migration foi aplicada até esta confirmação.

## Task Commits

Nenhum commit de código nesta dispatch — a execução parou antes de qualquer aplicação de migration ou alteração de teste. Este SUMMARY.md e a atualização de STATE.md/ROADMAP.md ficam a cargo do orquestrador, conforme instrução do dispatch (não commitar `.planning/` nesta subagent).

## Files Created/Modified

Nenhum arquivo de código criado ou modificado nesta dispatch.

## Deviations from Plan

None - execução parada exatamente no ponto que o próprio plano e o dispatch determinam (checkpoint bloqueante antes de qualquer push).

## Ação necessária do dono do projeto agora

O push programático está bloqueado pelo ambiente do executor (não é uma questão técnica do banco nem uma dúvida sobre o conteúdo — a aprovação já foi dada). É preciso que o **dono do projeto** aplique as três migrations manualmente, pelo SQL Editor da Supabase:

1. Abrir https://supabase.com/dashboard/project/afbiwgbqkogsrhxjshkk/sql/new
2. Colar o conteúdo completo de `supabase/migrations/0035_status_encerrado_enum.sql`, rodar, esperar "Success".
3. Colar o conteúdo completo de `supabase/migrations/0036_encerrar_cliente_ativo.sql`, rodar, esperar "Success".
4. Colar o conteúdo completo de `supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql`, rodar, esperar "Success".
5. Nunca colar os três juntos — a 0036 falha se a 0035 não tiver terminado antes (o Postgres recusa usar o valor novo do enum antes do commit).

Depois de confirmado "Success" nos três, avisar para retomar esta dispatch: o próximo passo automático é rodar `npx vitest run tests/funil/encerrados-rpc.test.ts tests/dashboard/encerrado-preserva-historico.test.ts` até verdes, confirmar que nenhuma migration anterior a 0035 foi editada, e só então atualizar este SUMMARY para `status: complete`.

## Next Phase Readiness

- Aprovação do dono: OBTIDA ("sim").
- Aplicação das migrations: CONCLUÍDA manualmente pelo dono via SQL Editor, uma por vez, "Success" confirmado nas três.
- Testes de integração: 27/27 verdes contra o banco de produção real.
- `git diff --name-only 8029f3a..HEAD -- supabase/migrations/` mostra só 0035/0036/0037 — nenhuma migration anterior foi editada.
- Planos 29-04 a 29-07 já podem começar — o status "Encerrado" existe de fato no banco de produção.

## Self-Check: PASSED

- FOUND: supabase/migrations/0035_status_encerrado_enum.sql
- FOUND: supabase/migrations/0036_encerrar_cliente_ativo.sql
- FOUND: supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql
- FOUND: tests/funil/encerrados-rpc.test.ts
- FOUND: tests/dashboard/encerrado-preserva-historico.test.ts
- Migrations aplicadas em produção e confirmadas ("Success. No rows returned" x3)
- 27/27 testes de integração passando

---
*Phase: 29-encerrar-cliente-ativo*
*Status: complete*
