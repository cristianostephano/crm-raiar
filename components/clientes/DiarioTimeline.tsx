import { format, parseISO } from "date-fns"
import { ClipboardCheck, Repeat } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { DiarioEntry } from "@/lib/supabase/queries/clientes"

/**
 * Read-only "Diário" timeline (DIAR-01) — irmão estrutural de
 * HistoricoTimeline.tsx: nenhum controle de escrita em lugar nenhum, porque
 * a trilha de auditoria (`historico`) é escrita exclusivamente pelos
 * gatilhos SECURITY DEFINER do banco (T-02-25) e não tem permissão de
 * escrita para a aplicação — um botão aqui seria a primeira trinca nessa
 * garantia. A ordenação vem PRONTA da consulta getDiario() (mais recente
 * primeiro, plano 16-03); este componente nunca reordena a lista recebida.
 */
export function DiarioTimeline({ entries }: { entries: DiarioEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma visita ou tarefa concluída ainda.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-col gap-1.5 rounded-lg border p-3"
        >
          <div className="flex items-center justify-between gap-2">
            {entry.tipo === "tarefa_concluida" ? (
              <Badge variant="outline" className="shrink-0">
                <ClipboardCheck />
                Prospecção
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                <Repeat />
                Visita
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {format(parseISO(entry.criadoEm), "dd/MM/yyyy HH:mm")}
            </span>
          </div>
          {/* Sem caso especial entre um resumo escrito pelo vendedor e o
              texto genérico gravado pelo caminho antigo da caixinha de
              concluir tarefa (decisão D1, 16-UI-SPEC.md) — descricao é
              sempre renderizada verbatim, sem aviso de "resumo faltando". */}
          <p className="text-sm">{entry.descricao}</p>
          <p className="text-xs text-muted-foreground">
            {entry.autorNome ?? "Autor não identificado"}
          </p>
        </li>
      ))}
    </ol>
  )
}
