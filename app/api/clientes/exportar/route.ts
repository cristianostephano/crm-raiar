import { type NextRequest, NextResponse } from "next/server"

import { buildClientesWorkbook } from "@/lib/clientes/exportacao"
import { getClientesParaExportacao } from "@/lib/supabase/queries/clientes"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/clientes/exportar (EXP-01/EXP-02/EXP-03, D-01/D-04/D-05) — the
 * one sanctioned use of `app/api/` in this codebase (ARCHITECTURE.md
 * Pattern 6): a Route Handler exists here only because a real file download
 * needs Content-Disposition/Content-Type headers, which a Server Action
 * cannot set. `runtime = "nodejs"` is required because @e965/xlsx needs Node
 * Buffer APIs (STACK.md v1.1 Addendum) — this must never run on Edge.
 *
 * This route sits outside app/(app)/layout.tsx's auth guard, so it re-checks
 * auth itself (mirrors the redirect("/login") gate in
 * app/(app)/clientes/page.tsx, adapted to a 401 NextResponse since this is a
 * fetch target, not a navigated page — no redirect makes sense here).
 *
 * `ids` in the request body is NEVER an authorization input (T-05-03): it is
 * passed straight through to getClientesParaExportacao, whose RLS scoping is
 * the real boundary. Any id the caller cannot see simply returns 0 rows for
 * it — the same non-revealing posture as getClienteById. There is
 * deliberately no manual role/is_supervisor() branch anywhere in this file.
 *
 * `escopoTudo` (quick task 260915-ls7) also is NOT an authorization input:
 * "tudo" means "tudo que ESTE usuário já enxerga", because
 * getClientesParaExportacao(null) is scoped by RLS in either code path — a
 * Vendedor receives only their own clientes, with or without the flag.
 */
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    )
  }

  const escopoTudo = (body as { escopoTudo?: unknown } | null)?.escopoTudo === true

  let idsParaExportar: string[] | null

  if (escopoTudo) {
    idsParaExportar = null
  } else {
    const ids = (body as { ids?: unknown } | null)?.ids

    const isStringArray =
      Array.isArray(ids) && ids.every((id) => typeof id === "string")

    if (!isStringArray) {
      return NextResponse.json(
        { error: "`ids` deve ser uma lista de strings." },
        { status: 400 }
      )
    }

    idsParaExportar = ids
  }

  try {
    const clientes = await getClientesParaExportacao(idsParaExportar)
    const workbook = buildClientesWorkbook(clientes)
    const filename = `clientes_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao gerar exportação."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
