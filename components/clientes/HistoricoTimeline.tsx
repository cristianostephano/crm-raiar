import { format, parseISO } from "date-fns"

import type { HistoricoEntry } from "@/lib/supabase/queries/clientes"

/**
 * Read-only, automatic histórico timeline (FUN-10) — no write controls
 * anywhere in this component (T-02-25: only the 02-01 SECURITY DEFINER
 * triggers ever populate `historico`). Deliberately plain per the UI-SPEC
 * ("no color coding, no icons — kept deliberately plain since it's an
 * automatic, non-interactive log"), newest entries first (the caller —
 * getHistorico — already orders by criado_em descending).
 */
export function HistoricoTimeline({ entries }: { entries: HistoricoEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum evento registrado ainda.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="text-sm">
          <span className="text-muted-foreground">
            {format(parseISO(entry.criadoEm), "dd/MM/yyyy HH:mm")}
          </span>{" "}
          — {entry.descricao}
        </li>
      ))}
    </ol>
  )
}
