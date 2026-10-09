"use client"

import type { KeyboardEvent } from "react"
import { format, parseISO } from "date-fns"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { nomeExibicaoCliente } from "@/lib/clientes/nomeExibicao"
import { DATA_GANHO_AUSENTE, type ClienteGanho } from "@/lib/ganhos/lista"

/**
 * Linha de um cliente ganho (quick 261008-rxw). Componente de apresentação
 * puro. A linha inteira é clicável e abre a ficha do cliente (molde de
 * components/agenda/AgendaItemRow.tsx: papel button, foco por teclado, Enter
 * e espaço). Nenhum botão dentro da linha, nenhum motivo, nenhum "Reabrir".
 *
 * LGPD: mostra só nome exibido, a data do ganho e — quando showResponsavel —
 * o nome do vendedor. Nenhum dado de contato (telefone/e-mail/contato da
 * pessoa do cliente) aparece aqui nem em nenhum outro lugar desta tela.
 */
export function GanhosItemRow({
  cliente,
  showResponsavel,
  onAbrir,
}: {
  cliente: ClienteGanho
  showResponsavel: boolean
  onAbrir: (clienteId: string) => void
}) {
  const nome = nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)

  // A data do banco ("AAAA-MM-DD") JAMAIS pode ser convertida com o construtor
  // de data cru do JavaScript a partir da string: seria lida em fuso zero e,
  // no horário de São Paulo, mostraria o dia anterior. `parseISO` trata a
  // string como data local.
  const textoData = cliente.ganhoEm
    ? `Ganho em ${format(parseISO(cliente.ganhoEm), "dd/MM/yyyy")}`
    : DATA_GANHO_AUSENTE

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onAbrir(cliente.clienteId)
    }
  }

  return (
    <Card
      size="sm"
      role="button"
      tabIndex={0}
      aria-label={`Abrir ficha de ${nome}`}
      onClick={() => onAbrir(cliente.clienteId)}
      onKeyDown={handleKeyDown}
      className="cursor-pointer gap-1.5"
    >
      <CardHeader className="items-start gap-2 px-3">
        <CardTitle
          className="truncate text-base leading-tight font-semibold"
          title={nome}
        >
          {nome}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-3">
        <p className="text-sm text-muted-foreground">{textoData}</p>
        {showResponsavel && cliente.responsavelNome ? (
          <p className="truncate text-sm text-muted-foreground">
            {cliente.responsavelNome}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
