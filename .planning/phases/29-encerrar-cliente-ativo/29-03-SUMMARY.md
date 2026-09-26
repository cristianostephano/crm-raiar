---
phase: 29-encerrar-cliente-ativo
plan: 03
subsystem: database
tags: [postgres, supabase, deploy-gate, lgpd]

requires:
  - phase: 29-encerrar-cliente-ativo (plan 01)
    provides: "migrations 0035/0036 em disco, ainda não aplicadas em produção"
  - phase: 29-encerrar-cliente-ativo (plan 02)
    provides: "migration 0037 em disco, ainda não aplicada em produção"
provides: []
affects: [29-encerrar-cliente-ativo (plans 04, 05, 06, 07)]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions: []

requirements-completed: []

coverage:
  - id: D1
    description: "Aprovação explícita do dono antes de qualquer supabase db push / SQL Editor"
    requirement: "ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05"
    verification:
      - kind: manual
        ref: "Tarefa 1 (checkpoint:decision) do 29-03-PLAN.md"
        status: pending
    human_judgment: true
    rationale: "Execução parada no gate bloqueante da Tarefa 1, por instrução explícita do dispatch e do próprio plano — nenhuma migration foi aplicada, nenhum teste foi rodado ainda."

duration: ~5min (até o gate)
completed: 2026-09-26
status: checkpoint
---

# Phase 29 Plan 3: Aprovação e Aplicação das Migrations — Summary (parcial, aguardando decisão)

**Execução parada na Tarefa 1 (checkpoint bloqueante): aguardando aprovação explícita do dono do projeto para aplicar as migrations 0035, 0036 e 0037 em produção. Nenhum comando de banco foi executado.**

## Performance

- **Duration até o gate:** ~5min
- **Completed:** não concluído — parado no checkpoint
- **Tasks:** 0/2 (Tarefa 1 é o próprio checkpoint; Tarefa 2 depende da resposta)

## Estado atual

- As três migrations (`0035_status_encerrado_enum.sql`, `0036_encerrar_cliente_ativo.sql`, `0037_dashboard_ganho_sobrevive_encerramento.sql`) existem em disco desde os planos 29-01/29-02, revisadas e prontas, mas **nenhuma foi aplicada ao projeto hospedado (produção)** até este ponto.
- Nenhum `supabase db push` foi executado. Nenhum SQL foi colado no SQL Editor.
- Os dois arquivos de teste de integração (`tests/funil/encerrados-rpc.test.ts`, `tests/dashboard/encerrado-preserva-historico.test.ts`) continuam VERMELHOS, como esperado — eles só ficam verdes depois da aplicação.

## Por que parou aqui

O próprio plano 29-03 exige, na sua primeira tarefa, uma aprovação explícita e registrada do dono do projeto antes de qualquer mudança no banco de produção — isto é uma trava de segurança do `CLAUDE.md` (mudanças de schema sempre passam por revisão humana antes de qualquer aplicação) e do próprio plano (`gate="blocking"`). O dispatch que iniciou esta execução reforçou a mesma regra: não rodar `supabase db push` nem colar SQL no SQL Editor antes de uma resposta explícita do dono.

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

## Next Phase Readiness

- Assim que o dono responder "aplicar" (ou um ajuste explícito), uma nova dispatch/continuação deve: (1) registrar a resposta aqui; (2) tentar `supabase db push` (CLI 2.111.0) e, se o classificador de modo automático bloquear o push, parar e pedir aplicação manual pelo SQL Editor na ordem 0035 → 0036 → 0037 (mesmo caminho usado na Fase 28); (3) rodar `tests/funil/encerrados-rpc.test.ts` e `tests/dashboard/encerrado-preserva-historico.test.ts` até verdes; (4) atualizar este SUMMARY para `status: complete`.
- Nenhuma migration foi tocada; nenhum teste foi alterado.

## Self-Check: PASSED

- FOUND: supabase/migrations/0035_status_encerrado_enum.sql
- FOUND: supabase/migrations/0036_encerrar_cliente_ativo.sql
- FOUND: supabase/migrations/0037_dashboard_ganho_sobrevive_encerramento.sql
- FOUND: tests/funil/encerrados-rpc.test.ts
- FOUND: tests/dashboard/encerrado-preserva-historico.test.ts
- Nenhum commit novo foi criado nesta dispatch (esperado — execução parou antes da Tarefa 2)

---
*Phase: 29-encerrar-cliente-ativo*
*Status: aguardando decisão do dono do projeto*
