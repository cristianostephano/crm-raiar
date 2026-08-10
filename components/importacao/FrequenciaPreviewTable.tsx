"use client"

import { useEffect, useState } from "react"

import type { ValidatedRowFrequencia } from "@/app/actions/importacaoFrequencia"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FREQUENCIA_VISITA_LABELS } from "@/lib/funil/frequencia"
import { statusBorderClass, summaryCounts } from "@/lib/importacao/preview"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

/** Só os dois rótulos que se aplicam a este fluxo — este vocabulário nunca
 * tem o estado "duplicado" (não há coluna de Ação, não há decisão por
 * linha). */
const STATUS_LABEL: Record<ValidatedRowFrequencia["status"], string> = {
  ok: "OK",
  erro: "Erro",
}

const EMPTY_HEADING = "Nenhuma linha encontrada nesta planilha"
const EMPTY_BODY =
  "Verifique se o arquivo tem dados abaixo da linha de cabeçalho e tente enviar novamente."

/**
 * Step 3's paginated review table for the frequência-de-visita import (Fase
 * 17, IMP-01) — irmão estrutural de ImportPreviewTable.tsx: mesmo
 * PAGE_SIZE, mesmo efeito de reinício de paginação, mesmo estado vazio,
 * mesma barra de paginação. A cor de borda por situação e a contagem de
 * resumo vêm de lib/importacao/preview.ts SEM MODIFICAÇÃO — este fluxo é um
 * subconjunto estrito ("ok"/"erro", nunca "duplicado") daquele vocabulário
 * de status, então a chave "duplicado" daquele mapa simplesmente nunca é
 * usada aqui.
 *
 * Sem propriedade de decisão por linha e sem função de mudança de decisão:
 * este fluxo não tem estado de decisão (não existe "possível duplicado"
 * aqui) — por isso não existe coluna de Ação. Ela não está escondida, ela
 * não é montada.
 */
export function FrequenciaPreviewTable({
  linhas,
}: {
  linhas: ValidatedRowFrequencia[]
}) {
  const [page, setPage] = useState(0)

  // Uma nova rodada de validarLoteFrequencia produz um array `linhas` novo —
  // reinicia a paginação para o Supervisor sempre começar revisando da
  // página 1.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0)
  }, [linhas])

  // A contagem de resumo também devolve `duplicados` (sempre 0 aqui, já que
  // o status "duplicado" nunca ocorre neste fluxo) — só `total`/`ok`/`erros`
  // aparecem na linha de resumo, o número de duplicados simplesmente não é
  // usado.
  const counts = summaryCounts(linhas)
  const totalPages = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE))
  const pageRows = linhas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (linhas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <p className="text-base font-semibold">{EMPTY_HEADING}</p>
        <p className="max-w-md text-sm text-muted-foreground">{EMPTY_BODY}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground">
        {counts.total} linhas no total — {counts.ok} prontas para atualizar ·{" "}
        {counts.erros} com erro
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Linha</TableHead>
            <TableHead>Razão social (na planilha)</TableHead>
            <TableHead>Cliente encontrado</TableHead>
            <TableHead>Nova frequência</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((linha) => (
            <TableRow
              key={linha.row}
              className={cn(statusBorderClass(linha.status))}
            >
              <TableCell>{linha.row + 1}</TableCell>
              <TableCell className="font-medium">
                {linha.resolved.razaoSocial || "—"}
              </TableCell>
              <TableCell>
                {/* Esta coluna existe justamente para o Supervisor confirmar
                 * visualmente que o casamento foi o certo — por isso ela
                 * mostra a razão social lida do BANCO
                 * (resolved.clienteEncontradoRazaoSocial), nunca a célula da
                 * planilha ao lado. */}
                {linha.resolved.clienteEncontradoRazaoSocial ?? "—"}
              </TableCell>
              <TableCell>
                {linha.resolved.frequenciaVisita
                  ? FREQUENCIA_VISITA_LABELS[linha.resolved.frequenciaVisita]
                  : "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="w-fit">
                    {STATUS_LABEL[linha.status]}
                  </Badge>
                  {linha.reasons.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {linha.reasons.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() =>
                setPage((current) => Math.min(totalPages - 1, current + 1))
              }
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
