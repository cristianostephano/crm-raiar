---
phase: quick-261005-ei4
plan: 01
subsystem: ui-menu
tags: [agenda, menu, piloto, reversivel, lgpd-minimizacao]
requires: []
provides:
  - "Menu com Agenda (tela nova, /agenda-2) no topo; Agenda antiga fora do menu"
  - "Interruptor MOSTRAR_AGENDA_ANTIGA_NO_MENU em components/layout/AppSidebar.tsx"
affects:
  - components/layout/AppSidebar.tsx
  - app/(app)/layout.tsx
  - components/agenda2/Agenda2List.tsx
  - app/actions/agenda2.ts
tech-stack:
  added: []
  patterns: ["interruptor de codigo (constante) para piloto reversivel"]
key-files:
  created: []
  modified:
    - components/layout/AppSidebar.tsx
    - app/(app)/layout.tsx
    - components/agenda2/Agenda2List.tsx
    - app/actions/agenda2.ts
    - tests/agenda/app-sidebar-agenda.test.tsx
    - tests/agenda2/app-sidebar-agenda2.test.tsx
    - tests/funil/app-sidebar-perdidos.test.tsx
    - tests/funil/app-sidebar-encerrados.test.tsx
    - tests/agenda2/app-layout-contagem.test.tsx
    - tests/agenda2/agenda2-list.test.tsx
    - tests/agenda2/agenda2-calendario-integracao.test.tsx
    - tests/agenda2/agenda2-actions.test.ts
key-decisions:
  - "Esconder a Agenda antiga por uma constante de codigo (false), sem apagar nada"
  - "Layout deixa de ler a contagem da Agenda antiga (uma consulta a menos por pagina)"
  - "Nomes internos (arquivos, rotas, funcoes, banco, testes) nao mudam; so o texto visivel"
metrics:
  duration: "~25 min"
  completed: 2026-10-05
status: complete
---

# Quick 261005-ei4: Agenda 2 vira "Agenda" e a antiga fica oculta Summary

O menu de Vendedor e Supervisor passa a mostrar "Agenda" (a tela nova, endereço /agenda-2) no topo, a Agenda antiga sai do menu por um interruptor de uma linha, e o layout deixa de consultar o número da Agenda antiga.

## Para o dono do projeto

1. **A Agenda antiga saiu do menu de todo mundo, mas nada foi apagado.** A tela continua funcionando e abre se alguém digitar o endereço `/agenda` no navegador (ela continua atrás do login e das mesmas regras de acesso de antes).
2. **A tela nova agora aparece como "Agenda" no topo do menu**, antes de Clientes. A ordem para Vendedor e Supervisor ficou: Agenda, Clientes, Perdidos, Encerrados, Dashboard. O número de pendências (menu aberto) e a bolinha (menu fechado) continuam funcionando nela. Dentro da tela, o título, as mensagens de "lista vazia" e a mensagem de erro agora também dizem só "Agenda" (antes diziam "Agenda 2").
3. **Como desfazer.**
   - Para trazer o item da Agenda antiga de volta ao menu: no arquivo `components/layout/AppSidebar.tsx`, trocar `MOSTRAR_AGENDA_ANTIGA_NO_MENU` de `false` para `true`. Isso também devolve o nome "Agenda 2" ao item novo.
   - Para o número (selo) da Agenda antiga voltar também: o caminho mais simples é desfazer este pacote inteiro, ou seja, reverter os 3 commits listados abaixo, porque o layout parou de buscar esse número.
4. **Nada foi publicado ainda.** Os commits estão só na máquina local. O próximo passo, como manda o CLAUDE.md, é enviar para a branch `staging`, conferir o link de teste da Vercel e só depois mandar para `master`.

### Conferência sugerida no link de teste (staging)

Logado como Vendedor e como Supervisor: (1) o menu mostra "Agenda" no topo, com o ícone de caderno com caneta, seguido de Clientes, Perdidos, Encerrados, Dashboard, sem a Agenda antiga; (2) com pendências, o número aparece ao lado de "Agenda" (menu aberto) e a bolinha no ícone (menu fechado); (3) clicar em "Agenda" abre a tela nova com o título "Agenda"; (4) digitar `/agenda` no endereço ainda abre a tela antiga.

## O que mudou (por tarefa)

| Tarefa | Commit | O que foi feito |
|--------|--------|-----------------|
| 1 | 9702368 | Interruptor `MOSTRAR_AGENDA_ANTIGA_NO_MENU` (false) esconde o link `/agenda`; item `/agenda-2` passa a se chamar "Agenda" e vira o primeiro; `agendaCount` virou opcional; testes de menu ajustados |
| 2 | ea422e9 | Layout parou de ler a contagem da Agenda antiga; a contagem nova mantém o try/catch com valor 0 se falhar; testes garantem que a função antiga nunca é chamada |
| 3 | 8b508bd | Título, listas vazias e erro da tela `/agenda-2` dizem "Agenda"; mensagem fixa correspondente em `app/actions/agenda2.ts` trocada junto; testes ajustados |

## Verificação

- Testes: 11 arquivos, 123 testes passando (os 2 arquivos de menu não editados, `tests/layout/app-sidebar-visual.test.tsx` e `tests/importacao/AppSidebar.test.tsx`, continuaram verdes, incluindo a regra de que só o Supervisor vê a seção Administração).
- `npx tsc --noEmit`: limpo. `eslint --max-warnings 0` nos 12 arquivos tocados: limpo. `npm run build`: concluiu (rotas `/agenda` e `/agenda-2` ambas presentes).
- Fluxo vermelho/verde: em cada tarefa os testes foram ajustados primeiro e falharam (18, 2 e 7 falhas respectivamente) antes do código mudar.
- Saída do comando de gates final: `GATES-OK` (nenhum texto visível com o rótulo antigo fora do ramo parado da flag; título `>Agenda</h1>` presente uma vez; `git diff 5b7aeae` vazio em `app/(app)/agenda/`, `components/agenda/`, `lib/agenda/`, `lib/supabase/queries/agenda.ts`, `lib/supabase/queries/agenda2.ts`, `app/actions/agenda.ts` e `supabase/`; `app/(app)/agenda/page.tsx` existe).
- Nenhum push nem merge. `.planning/config.json` (mudança só de fim de linha, anterior a esta tarefa) não foi incluído em nenhum commit.

## Alerta de Conformidade (LGPD)

Nenhuma mudança no tratamento de dado pessoal: nenhum dado novo é criado, lido, exportado ou exposto. A Agenda antiga continua acessível pela URL, atrás do login (guarda do layout) e da mesma RLS do Supabase, sem alteração em migrations, tabelas, policies ou consultas. Houve minimização: o layout deixou de fazer uma leitura ao banco (contagem da Agenda antiga) a cada página carregada, já que esse número não aparece mais. O escopo continua sujeito à avaliação do dono à luz da LGPD.

## Deviations from Plan

None - plan executed exactly as written. (O lint não reclamou da flag: ela foi anotada com tipo `boolean` já na criação, conforme a sugestão do plano, e nenhum ajuste extra foi necessário.)

Observações de execução, sem impacto no resultado: o Git avisa que arquivos de teste tocados passam de LF para CRLF no próximo uso (comportamento normal deste repositório no Windows).

## Known Stubs

None.

## Threat Flags

None - nenhuma superfície nova (sem endpoint, rota, caminho de autenticação ou mudança de schema).

## Self-Check: PASSED

- Commits 9702368, ea422e9 e 8b508bd existem em `git log`.
- Arquivos modificados existem; `app/(app)/agenda/page.tsx` intacto.
