"use client"

import { format, parseISO } from "date-fns"
import { RotateCcw } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { nomeExibicaoCliente } from "@/lib/clientes/nomeExibicao"
import {
  MOTIVO_ENCERRAMENTO_AUSENTE,
  type ClienteEncerrado,
} from "@/lib/encerrados/lista"

/**
 * Linha de um cliente encerrado (D-07, D-09, UI-SPEC). Componente de
 * apresentação puro, componente IRMÃO de components/perdidos/PerdidosItemRow.tsx
 * (Fase 28) — mesmo molde estrutural, sem nenhum import cruzado (Pitfall 4).
 * A única ação desta linha é "Reativar" (D-09, sem confirmação).
 *
 * Critério 4 da fase (LGPD): esta linha mostra só nome exibido, motivo do
 * encerramento, data e — quando showResponsavel — o nome do vendedor
 * responsável. Nenhum dado de contato (telefone/e-mail/contato da pessoa do
 * cliente) aparece aqui nem em nenhum outro lugar desta tela.
 */
export function EncerradosItemRow({
  cliente,
  showResponsavel,
  reativando,
  onReativar,
}: {
  cliente: ClienteEncerrado
  showResponsavel: boolean
  reativando: boolean
  onReativar: (clienteId: string) => void
}) {
  const nome = nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)

  // A data do banco JAMAIS pode ser convertida com o construtor de data cru
  // do JavaScript a partir da string (Pitfall 1, lib/agenda/itens.ts) —
  // `parseISO` trata a string como instante ISO real.
  const dataFormatada = format(parseISO(cliente.encerradoEm), "dd/MM/yyyy")

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
          aria-label={`Reativar ${nome}`}
          title="Reativar"
          disabled={reativando}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation()
            onReativar(cliente.clienteId)
          }}
        >
          <RotateCcw className="size-[18px]" aria-hidden="true" />
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-3">
        <p className="text-sm text-muted-foreground">
          {cliente.motivoEncerramentoNome ?? MOTIVO_ENCERRAMENTO_AUSENTE}
        </p>
        <p className="text-sm text-muted-foreground">
          {`Encerrado em ${dataFormatada}`}
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
