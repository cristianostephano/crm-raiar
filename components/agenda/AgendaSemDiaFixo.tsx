"use client"

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  MOTIVO_SEM_DIA_FIXO_LABELS,
  motivoSemDiaFixo,
  type ClienteSemDiaFixo,
} from "@/lib/agenda/itens"
import { cn } from "@/lib/utils"

/**
 * Mesmas classes utilitárias que `components/ui/card.tsx#Card` (`size="sm"`)
 * já aplica ao `<div>` que ele desenha — copiadas aqui de propósito, e não
 * reusadas via o componente `Card`, porque cada item desta seção precisa ser
 * um `<button>` de verdade (D-03: funciona por teclado nativamente, sem
 * `onKeyDown` próprio), e `Card` só desenha `<div>`.
 */
const CARD_SM_CLASSNAME =
  "group/card flex w-full flex-col gap-1.5 overflow-hidden rounded-xl bg-card py-3 text-left text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(3)]"

/**
 * Seção da Lista da Agenda (AGENDA-01, Fase 24, Plano 24-03): lembra o
 * vendedor de quem, entre os clientes ativos, ainda não tem dia fixo de
 * visita definido — cobrindo os dois casos (nunca teve frequência, ou já tem
 * frequência mas falta o dia fixo).
 *
 * Componente de apresentação puro: recebe a lista já pronta e já estreitada
 * por vendedor (AgendaList.tsx é quem decide o estreitamento, reusando
 * `filtrarPorVendedor` de `lib/agenda/itens.ts`) — este componente NÃO busca
 * dado, NÃO filtra, NÃO ordena e NÃO decide quem entra na lista. Quem decide
 * quem entra é sempre a consulta (`getClientesSemDiaFixo`); este componente
 * só explica, por linha, qual dos dois motivos é (`motivoSemDiaFixo`) e
 * devolve o clique.
 *
 * Lista vazia devolve nada (nem título, nem moldura, nem a linha de
 * explicação): um lembrete sem ninguém a lembrar é ruído.
 *
 * Molde visual: `AgendaItemRow.tsx` (mesmo `Card size="sm"`, mesmo
 * espaçamento/moldura/tamanho de fonte de título e corpo), sem copiar o
 * componente inteiro — este item não tem data, selo de origem nem botão de
 * concluir, que não se aplicam aqui. Nenhum campo de edição na própria
 * linha (D-02/D-03): clicar leva à ficha, onde o dia fixo se define.
 */
export function AgendaSemDiaFixo({
  clientes,
  showResponsavel,
  onOpenCliente,
}: {
  clientes: ClienteSemDiaFixo[]
  showResponsavel: boolean
  onOpenCliente: (clienteId: string) => void
}) {
  if (clientes.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {`Sem dia fixo definido (${clientes.length})`}
      </h2>
      <p className="text-sm text-muted-foreground">
        Esses clientes ativos ainda não têm um dia fixo de visita. A próxima
        visita continua sendo sugerida contando os dias a partir da conclusão.
      </p>
      <div className="flex flex-col gap-2">
        {clientes.map((cliente) => (
          <button
            key={cliente.clienteId}
            type="button"
            onClick={() => onOpenCliente(cliente.clienteId)}
            className={cn(CARD_SM_CLASSNAME, "cursor-pointer")}
          >
            <CardHeader className="px-3">
              <CardTitle
                className="truncate text-base leading-tight font-semibold"
                title={cliente.razaoSocial}
              >
                {cliente.razaoSocial}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 px-3">
              <p className="text-sm text-muted-foreground">
                {MOTIVO_SEM_DIA_FIXO_LABELS[motivoSemDiaFixo(cliente)]}
              </p>
              {showResponsavel && cliente.responsavelNome ? (
                <p className="truncate text-sm text-muted-foreground">
                  {cliente.responsavelNome}
                </p>
              ) : null}
            </CardContent>
          </button>
        ))}
      </div>
    </div>
  )
}
