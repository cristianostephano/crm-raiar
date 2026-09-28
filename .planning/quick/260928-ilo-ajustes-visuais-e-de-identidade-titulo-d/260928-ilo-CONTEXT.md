# Quick Task 260928-ilo: Ajustes Visuais e de Identidade - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Task Boundary

Ajustes visuais e de identidade no CRM Raiar, achados pelo dono do projeto navegando em produção:

1. Título da aba do navegador está com o valor padrão do Next.js ("Create Next App"), precisa virar "CRM - Raiar".
2. A barra lateral (sidebar) do menu principal não desce até o final da altura da tela — sobra um espaço em branco embaixo dela em telas mais altas.
3. O contador (badge) de itens pendentes da Agenda, ao lado do ícone no menu, some quando a barra lateral está comprimida (só ícones) — só aparece quando está expandida com texto.
4. Mudança de estética: cores de fundo, cores do menu lateral e o estilo dos cards de número (tipo os do Dashboard) — inspirado num painel de vendas de referência que o dono mostrou (fundo escuro navy no menu lateral, cards com número grande em destaque e borda lateral colorida, tabela limpa com cabeçalho escuro).
5. Trocar o ícone atual "R" (círculo azul, avatar de iniciais) no topo da barra lateral pela logo real da empresa, mantendo o texto "CRM Raiar" ao lado.

</domain>

<decisions>
## Implementation Decisions

### Badge da Agenda quando comprimido
- Quando o menu está comprimido (só ícones) e há itens pendentes na Agenda, mostrar uma bolinha pequena (dot indicator) no canto do ícone — sem número, só um sinal visual de "tem algo pendente". Mesmo padrão comum de apps mobile. O número completo continua aparecendo normalmente quando o menu está expandido (comportamento atual não muda nesse caso).

### Alcance da mudança de estética
- Só cores nesta tarefa — ajustar cores de fundo, cores da barra lateral e cor de borda/destaque dos cards de número, para se aproximar da referência visual do dono (fundo escuro navy no menu lateral; cards com borda lateral colorida). NÃO reorganizar layout, espaçamento, tamanho ou estrutura de nenhum card ou tela nesta tarefa — isso fica para uma rodada futura, se o dono quiser depois de ver o resultado só de cores.
- A barra lateral do CRM já é escura (navy) hoje — o planejador deve comparar o tom atual com a referência e ajustar SÓ SE houver diferença perceptível, não repintar algo que já está no caminho certo. Idem para os cards de número do Dashboard, que já têm uma borda lateral colorida em alguns lugares (ex: "Média de dias até ganho/perdido") — usar esse padrão já existente como base para os demais cards de número, em vez de inventar um estilo novo.
- Nenhuma mudança de cor pode reduzir contraste de texto abaixo do padrão de acessibilidade já usado no projeto (nada de texto de baixo contraste).

### Logo (ícone "R" → logo real)
- Arquivo da logo já recebido e salvo em `public/raiar-logo.png` (PNG, fundo transparente, símbolo circular estilizado + texto "ORGÂNICOS RAIAR" abaixo — a logo em si já contém o nome da marca por extenso, então o ícone da sidebar deve mostrar SÓ o símbolo/desenho, recortado ou usado como está, sem duplicar texto).
- Manter o texto "CRM Raiar" ao lado do ícone na sidebar, sem alterar fonte/tamanho — só o quadrado/círculo azul com "R" muda para a imagem `public/raiar-logo.png`.
- A logo deve caber no mesmo espaço que o ícone "R" ocupa hoje (canto superior esquerdo da barra lateral, atualmente um quadrado azul arredondado ~40x40px) — usar `next/image` (padrão já usado no projeto, se houver precedente) ou uma tag `img` simples com `object-fit: contain`, preservando a proporção da logo sem distorcer. Fundo do contêiner pode continuar com um fundo sólido (branco ou o navy da sidebar) por trás da logo se ela tiver partes transparentes que precisem de contraste — decisão visual do executor, testar as duas opções via preview local antes de decidir.

### Claude's Discretion
- Causa raiz exata do bug da sidebar não descer até o fim da tela (provavelmente `min-height`/`height` fixo vs `100vh`/`100dvh`, ou um flex container sem `flex-1`/`h-full` em algum ancestral) — investigar e corrigir da forma mais simples e correta, sem reescrever a estrutura de layout inteira.
- Tom exato de cor (valores hex) para a mudança de estética — usar os tokens de cor já existentes no projeto (Tailwind + shadcn/ui, ver `app/globals.css`/tema) sempre que possível, em vez de inventar cores novas soltas.

</decisions>

<specifics>
## Specific Ideas

Painel de referência mostrado pelo dono (print de outro sistema interno da empresa, não do CRM): menu lateral com fundo azul-marinho escuro e ícones brancos; área de conteúdo com fundo branco/cinza bem claro; cards de KPI com número grande em destaque e uma borda lateral colorida (laranja, no exemplo); tabela com cabeçalho azul-marinho escuro e texto branco, linhas zebradas leves.

</specifics>

<canonical_refs>
## Canonical References

Nenhuma spec externa — decisões capturadas acima. Ver `app/globals.css` e os componentes shadcn/ui já usados no projeto (`components/ui/`) para os tokens de cor existentes antes de introduzir cores novas.

</canonical_refs>
