"use client"

import { CircleCheck, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { PuladaGroup } from "@/lib/importacao/confirmar"

type FrequenciaImportSummaryProps = {
  atualizadosCount: number
  puladas: PuladaGroup[]
  onVerClientes: () => void
  onEnviarOutra: () => void
}

const integerFormatter = new Intl.NumberFormat("pt-BR")

/**
 * Tela de resumo pós-gravação da importação de frequências (Fase 17,
 * IMP-01) — irmã estrutural de ImportSummary.tsx: mesma grade de dois
 * cartões (bordas verde/âmbar, mesmos ícones), mesmo formatador de inteiro,
 * mesmo tamanho de exibição de 20px (`text-xl`) das duas contagens — o
 * mesmo waiver deliberado que 07-UI-SPEC.md já travou para esta forma de
 * resumo, nunca o tamanho de 36px do dashboard gerencial. Copy e botões são
 * os deste fluxo (o segundo botão reinicia o assistente, não fala em
 * "importar").
 *
 * A contagem de linhas puladas é DERIVADA somando as quantidades dos grupos
 * recebidos — nunca uma propriedade separada. Dois números independentes
 * (um recebido, um derivado) poderiam divergir entre si; um único número
 * derivado nunca discorda de si mesmo.
 */
export function FrequenciaImportSummary({
  atualizadosCount,
  puladas,
  onVerClientes,
  onEnviarOutra,
}: FrequenciaImportSummaryProps) {
  const puladasCount = puladas.reduce((sum, p) => sum + p.quantidade, 0)

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Atualização concluída</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-green-600">
          <CardContent className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CircleCheck className="size-4 text-muted-foreground" />
              Clientes atualizados
            </div>
            <p className="text-xl leading-[1.2] font-semibold text-foreground">
              {integerFormatter.format(atualizadosCount)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <TriangleAlert className="size-4 text-muted-foreground" />
              Linhas puladas
            </div>
            <p className="text-xl leading-[1.2] font-semibold text-foreground">
              {integerFormatter.format(puladasCount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {puladas.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Motivos das linhas puladas</h3>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {puladas.map((grupo) => (
              <li key={grupo.motivo}>
                {grupo.motivo} — {grupo.quantidade} linha
                {grupo.quantidade === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" onClick={onVerClientes}>
          Ver clientes
        </Button>
        <Button type="button" variant="outline" onClick={onEnviarOutra}>
          Enviar outra planilha
        </Button>
      </div>
    </div>
  )
}
