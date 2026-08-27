"use client"

import { CircleCheck, Info, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { PuladaGroup } from "@/lib/importacao/confirmar"

type AtivoImportSummaryProps = {
  importadosCount: number
  puladas: PuladaGroup[]
  onVerClientes: () => void
  onImportarOutra: () => void
}

const integerFormatter = new Intl.NumberFormat("pt-BR")

const FREQUENCIA_AVISO =
  "Esta planilha não define a frequência de visita. Os clientes importados entram como ativos, sem recorrência definida, e vão aparecer na seção \"Sem dia fixo definido\" da Agenda até alguém definir uma frequência para cada um."

/**
 * Tela de conclusão do assistente "Importar clientes ativos" (Fase 25 Plano
 * 3, ATIVO-01..04) — cópia estrutural de `ImportSummary.tsx`: mesma grade de
 * dois cartões, mesmo formatador de inteiro, e o mesmo tamanho de destaque
 * numérico de 20px (`text-xl`) já usado nas telas irmãs (o tamanho maior é
 * uma exceção travada só para os cartões do painel, não vale aqui).
 *
 * Diferenças deliberadas: o primeiro cartão fala de clientes ATIVOS
 * importados (para o Supervisor não confundir com a importação de
 * prospecção), o cabeçalho fala em importação de clientes ativos concluída,
 * e um bloco de aviso FIXO — sempre visível, nunca condicional — explica em
 * linguagem simples que esta planilha não define a frequência de visita.
 * Este aviso é o elo declarado entre esta fase e a Fase 24 (Agenda) e não
 * pode ser omitido.
 */
export function AtivoImportSummary({
  importadosCount,
  puladas,
  onVerClientes,
  onImportarOutra,
}: AtivoImportSummaryProps) {
  const puladasCount = puladas.reduce((sum, p) => sum + p.quantidade, 0)

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">
        Importação de clientes ativos concluída
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-green-600">
          <CardContent className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CircleCheck className="size-4 text-muted-foreground" />
              Clientes ativos importados
            </div>
            <p className="text-xl leading-[1.2] font-semibold text-foreground">
              {integerFormatter.format(importadosCount)}
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

      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
      >
        <Info className="mt-0.5 size-4 flex-shrink-0" />
        <p>{FREQUENCIA_AVISO}</p>
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
        <Button type="button" variant="outline" onClick={onImportarOutra}>
          Importar outra planilha
        </Button>
      </div>
    </div>
  )
}
