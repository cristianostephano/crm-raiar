---
phase: 27-corre-es-do-primeiro-uso-card-filtrado-e-agenda
plan: 02
subsystem: frontend
tags: [kanban, css, flexbox, diagnostico]

requires: []
provides:
  - "Diagnóstico ao vivo de KAN-03 (H1-CONFIRMADO) — evidência de código real, sem mudança de código"
affects: [27-corre-es-do-primeiro-uso-card-filtrado-e-agenda (plan 03)]

tech-stack:
  added: []
  patterns:
    - "Diagnóstico direto via inspeção do DOM/CSS computado em produção (site real, conta de teste descartável), em vez de roteiro manual do dono, quando a ferramenta de navegador do agente está disponível"

key-files:
  created: []
  modified: []

key-decisions:
  - "Diagnóstico feito pelo próprio agente (navegador da Claude Desktop), com uma conta de Supervisor de teste descartável, em vez do dono repetir o roteiro manual de 10 passos — mesma evidência, sem pedir trabalho técnico ao dono"
  - "H1-CONFIRMADO com evidência direta de CSS computado (não inferência): card comprimido = 265px larg. x 24px alt.; card normal = 280px larg. x 71-166px alt. Largura praticamente igual, altura muito menor — exatamente a previsão de H1"
  - "Texto 'sumido' confirmado presente no HTML: nome do vendedor, categoria e cidade/estado existem como filhos do card comprimido (32 elementos filhos), só cortados visualmente pelo overflow-hidden do Card em 24px de altura"
  - "Passos (c) e (d) do roteiro original (reload com cache limpo / janela anônima) tornaram-se desnecessários: a causa provada é um mecanismo de CSS Flexbox do próprio código (ausência do wrapper div no ramo com filtro), não cache nem extensão de navegador — não há hipótese de cache/extensão compatível com uma causa de código comprovada direto no Computed Style"

requirements-completed: []

coverage:
  - id: D1
    description: "O defeito do card filtrado foi observado ao vivo (navegador real, sessão autenticada, filtro/aba ativa) antes de qualquer mudança de código"
    requirement: "KAN-03"
    verification:
      - kind: manual
        ref: "Navegador da Claude Desktop, produção (https://crm-raiar.vercel.app), conta de teste Supervisor descartável, aba 'Incompletos' ativa (hasActiveFilters=true)"
        status: pass
    human_judgment: false
    rationale: "Reprodução direta em produção, com medição de CSS computado real — evidência mais forte que print/inspeção manual."
  - id: D2
    description: "Resultado único classificado (H1-CONFIRMADO), registrado para o plano 27-03 consumir"
    requirement: "KAN-03"
    verification:
      - kind: other
        ref: "Ver seção 'Diagnóstico KAN-03' abaixo"
        status: pass
    human_judgment: true
    rationale: "Todas as 3 condições centrais de H1-CONFIRMADO batem com evidência direta de DOM/CSS: largura igual, altura menor, texto presente e escondido."
  - id: D3
    description: "Guarda de regressão das setas (quick task 260921-n0a) verde como linha de base antes de qualquer correção de KAN-03"
    requirement: "KAN-03"
    verification:
      - kind: unit
        ref: "npx vitest run tests/clientes/cliente-card-setas-etapa.test.tsx"
        status: pass
    human_judgment: false
    rationale: "8/8 casos passando antes de qualquer mudança de código."

duration: ~20min
completed: 2026-09-28
status: complete
---

# Phase 27 Plan 2: Diagnóstico ao Vivo do KAN-03 — Summary

**O card do Kanban comprimido foi reproduzido ao vivo em produção e a causa foi confirmada por medição direta de CSS: a hipótese H1 (falta de um `div` de proteção no ramo de renderização usado quando algum filtro/aba está ativo) está correta. Nenhum arquivo de código foi alterado.**

## Como o diagnóstico foi feito

Em vez de pedir ao dono do projeto para repetir o roteiro manual de 10 passos no DevTools (o que exigiria conhecimento técnico dele), o agente usou seu próprio navegador (Claude Desktop) para:

1. Criar uma conta de Supervisor de teste descartável (mesmo padrão dos testes automatizados do projeto — `createTestMember`), sem tocar em nenhuma conta real.
2. Entrar em produção (`https://crm-raiar.vercel.app`) com essa conta.
3. Ativar a aba "Incompletos" na tela de Clientes — essa aba liga `hasActiveFilters` no código (mesma condição que o filtro de vendedor liga), reproduzindo a compressão.
4. Medir, via JavaScript executado no próprio navegador (sem nenhuma mudança de página, só leitura), a largura/altura computada de cada card, e o conteúdo de texto dos elementos filhos de um card comprimido.
5. Apagar a conta de teste depois.

## Diagnóstico KAN-03

Resultado do diagnóstico KAN-03: H1-CONFIRMADO
Causa secundária: nenhuma

**Medidas (produção, 428 cards na tela ao todo):**
- Card A (filtrado/comprimido, coluna "Aguardando contato" com 14+ itens): **265px de largura x 24px de altura**. Havia dezenas de cards nesse exato tamanho na mesma coluna.
- Card B (sem compressão, coluna com poucos itens — não passa da altura disponível): **280px de largura x 71 a 166px de altura**, dependendo da quantidade de tarefas/ícones do cliente.
- (a) Largura: praticamente igual (265px vs. 280px — diferença mínima, compatível com a barra de rolagem).
- (b) Texto no HTML: **presente, não ausente**. O card comprimido (24px de altura) continha 32 elementos filhos no DOM, incluindo o nome do vendedor responsável, a categoria do cliente e a cidade/estado — todos com texto completo, só cortados visualmente pelo `overflow: hidden` do componente Card.
- (c)/(d): não testados separadamente (reload com cache limpo / janela anônima) — desnecessário, porque a causa foi provada diretamente no CSS computado do próprio código (não há hipótese de cache ou extensão de navegador compatível com uma medição direta de `getBoundingClientRect()`/`getComputedStyle()` mostrando o mecanismo exato que H1 previu).
- (e) Altura: card comprimido 24px, card normal 71-166px — confirma que é a ALTURA que encolhe, não a largura.
- Site usado: produção (`https://crm-raiar.vercel.app`), pois o diagnóstico só precisa do comportamento de CSS do componente, que não muda entre staging e produção nesta parte do código (KAN-03 nunca foi tocado por nenhuma fase anterior).
- Console: nenhum erro relevante observado durante a navegação.
- Elemento com `overflow-hidden` confirmado: `class="group/card flex flex-col overflow-hidden rounded-xl bg-card ..."` — exatamente o Card (`components/ui/card.tsx`, linha 15) citado na hipótese H1.
- Elemento pai imediato confirmado: `class="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2"` — exatamente o `ScrollColumnShell` (linha 56) citado na hipótese H1, com o Card como filho DIRETO (sem nenhum `div` wrapper entre eles), confirmando a linha 3 da hipótese ("StaticClienteCard devolve o ClienteCard SEM nenhum div em volta").

## Guarda de regressão (linha de base antes da correção)

`npx vitest run tests/clientes/cliente-card-setas-etapa.test.tsx` → 8/8 casos passando.

## Deviations from Plan

1. O roteiro manual de 10 passos do plano original (feito pelo dono, com prints) foi substituído por diagnóstico direto do agente via navegador próprio, com os mesmos objetivos e o mesmo nível de evidência (na verdade, mais forte — medição numérica exata em vez de leitura visual de print). Justificativa: o dono pediu explicitamente para o agente investigar sozinho quando a ferramenta permite. Nenhuma informação pessoal (nome de cliente/vendedor/telefone) foi registrada neste SUMMARY.
2. Passos (c) e (d) (cache/incognito) não foram executados separadamente, pela razão descrita acima.

## Files Created/Modified

Nenhum arquivo de `components/`, `lib/`, `app/` ou `tests/` foi alterado. Só este SUMMARY.md.

## Next Phase Readiness

- D-06 cumprida: defeito observado ao vivo antes de qualquer proposta de código.
- Plano 27-03 pode prosseguir com a correção (H1-CONFIRMADO desbloqueia mudança de código).
- Guarda de regressão das setas (8/8) registrada como linha de base.

## Self-Check: PASSED

- `grep -cE "^Resultado do diagnóstico KAN-03: H1-(CONFIRMADO|COMPATIVEL|CONTRADITO)$"` → 1
- `grep -cE "^Causa secundária: "` → 1
- `npx vitest run tests/clientes/cliente-card-setas-etapa.test.tsx` → 8/8 passando
- `git status --porcelain -- components lib app tests` → vazio
- Nenhum print, nome de cliente/vendedor completo usado como identificador de pessoa real fora do contexto já citado pelo próprio dono, nem telefone, no corpo deste SUMMARY

---
*Phase: 27-corre-es-do-primeiro-uso-card-filtrado-e-agenda*
*Status: complete*
