"use client"

import { format, parseISO } from "date-fns"
import { RotateCcw } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { nomeExibicaoCliente } from "@/lib/clientes/nomeExibicao"
import { MOTIVO_PERDA_AUSENTE, type ClientePerdido } from "@/lib/perdidos/lista"

/**
 * Linha de um cliente perdido (D-04, UI-SPEC seções 1-2). Componente de
 * apresentação puro, molde estrutural de components/agenda/AgendaItemRow.tsx
 * e components/clientes/ClienteCard.tsx (`EtapaArrowButton`), mas SEM abrir
 * ficha ao clicar na linha (D-04) — a única ação desta linha é "Reabrir"
 * (D-05, sem confirmação).
 *
 * Critério 2 da fase (LGPD): esta linha mostra só nome exibido, motivo da
 * perda, data e — quando showResponsavel — o nome do vendedor responsável.
 * Nenhum dado de contato (telefone/e-mail/contato da pessoa do cliente)
 * aparece aqui nem em nenhum outro lugar desta tela.
 */
export function PerdidosItemRow({
  cliente,
  showResponsavel,
  reabrindo,
  onReabrir,
}: {
  cliente: ClientePerdido
  showResponsavel: boolean
  reabrindo: boolean
  onReabrir: (clienteId: string) => void
}) {
  const nome = nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)

  // A data do banco JAMAIS pode ser convertida com o construtor de data cru
  // do JavaScript a partir da string (Pitfall 1, lib/agenda/itens.ts) —
  // `parseISO` trata a string como instante ISO real.
  const dataFormatada = format(parseISO(cliente.perdidoEm), "dd/MM/yyyy")

  return (
    <Card size="sm" className="gap-1.5">
      <CardHeader className="grid-cols-[1fr_auto] items-start gap-2 px-3">
        <CardTitle
          className="truncate text-base leading-tight font-semibold"
          title={nome}
        >
          {nome}
        </CardTitle>
        <button
          type="button"
          aria-label={`Reabrir ${nome}`}
          title="Reabrir"
          disabled={reabrindo}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation()
            onReabrir(cliente.clienteId)
          }}
        >
          <RotateCcw className="size-[18px]" aria-hidden="true" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-3">
        <p className="text-sm text-muted-foreground">
          {cliente.motivoPerdaNome ?? MOTIVO_PERDA_AUSENTE}
        </p>
        <p className="text-sm text-muted-foreground">
          {`Perdido em ${dataFormatada}`}
        </p>
        {showResponsavel && cliente.responsavelNome ? (
          <p className="truncate text-sm text-muted-foreground">
            {cliente.responsavelNome}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
