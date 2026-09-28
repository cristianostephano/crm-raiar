---
quick_id: 260928-js0
status: complete
completed: 2026-09-28
---

# Quick Task 260928-js0: Logo na Sidebar — Summary

**A logo da sidebar passou por 3 rodadas de ajuste no mesmo dia, a pedido do dono, até chegar no resultado final: a logo transparente original, com a tinta convertida de navy para branco (preservando o canal alfa), maior, ocupando o lugar que antes era do texto "CRM Raiar" quando o menu está expandido — sem nenhuma caixa/moldura, se misturando perfeitamente com o fundo da sidebar, igual à referência que o dono mostrou de outro painel interno da empresa. Verificado ao vivo no navegador em cada rodada.**

## Histórico das 3 rodadas

1. **Rodada 1** — logo com fundo branco (`raiar-logo.png`, enviada primeiro), ícone pequeno (`size-7`) no lugar do antigo "R", texto "CRM Raiar" mantido ao lado.
2. **Rodada 2** — dono mandou uma versão com fundo navy sólido (`raiar-logo-navy.png`) pra combinar com a sidebar; ícone aumentado (`size-9`); depois, no mesmo dia, pedido pra logo GRANDE substituir o texto "CRM Raiar" por completo quando expandido (`h-12`), igual a referência.
3. **Rodada 3 (final)** — dono percebeu que a versão com retângulo navy sólido ainda deixava uma leve costura contra o slate-900 real da sidebar ("não ficou"), e pediu pra usar a logo transparente original com a tinta convertida pra branco. Conversão feita com `sharp` (script descartável em `scripts/`, não commitado) a partir do arquivo original enviado pelo dono: RGB de cada pixel setado pra 255/255/255, canal alfa preservado, upscale 3x pra manter nitidez no tamanho maior. Resultado: `public/raiar-logo-white.png`, único arquivo de logo em uso agora.

## Estado final

- `components/layout/AppSidebar.tsx`:
  - Recolhido: logo pequena (`size-10`, ~40px), sem caixa/moldura.
  - Expandido: logo grande (`h-14`), sem contêiner, no lugar do texto "CRM Raiar" (removido — a logo já traz o nome da marca).
  - Botão de recolher/expandir posicionado no canto do cabeçalho, sem competir com a logo.
- `tests/layout/app-sidebar-visual.test.tsx`: casos para recolhido (logo pequena, `size-10`, sem `bg-white`/`rounded-md`) e expandido (logo grande `h-14`, sem `size-10`, sem texto "CRM Raiar").
- `public/raiar-logo.png` e `public/raiar-logo-navy.png` (versões intermediárias) removidas. `public/raiar-logo-white.png` é a única em uso.

## Testes

`npx vitest run tests/layout/app-sidebar-visual.test.tsx tests/layout/root-metadata.test.tsx tests/agenda/app-sidebar-agenda.test.tsx tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/importacao/AppSidebar.test.tsx` → 6 arquivos, 35 testes, todos verdes.
`npx tsc --noEmit` e `npx eslint --max-warnings 0` limpos.

## Verificação visual

Feita pelo orquestrador, ao vivo, com contas de teste descartáveis (apagadas depois), nas 3 rodadas. A rodada final foi confirmada pelo próprio dono ("perfeito") olhando a versão local antes do envio pra produção.

## Deviations

Nenhuma — as 3 rodadas foram pedidos sucessivos do dono após ver cada resultado, tratadas como continuação do mesmo quick task (mesmo trecho de código, mesmo dia).

## Self-Check: PASSED

- FOUND: components/layout/AppSidebar.tsx (modificado, estado final)
- FOUND: public/raiar-logo-white.png
- FOUND: tests/layout/app-sidebar-visual.test.tsx (atualizado pras 3 rodadas)
- 35/35 testes passando
- Verificação visual confirmada nas 3 rodadas, incluindo aprovação direta do dono
