import { NextResponse } from "next/server"

import { buildDiarioWorkbook } from "@/lib/clientes/exportacaoDiario"
import { getDiarioParaExportacao } from "@/lib/supabase/queries/clientes"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/agenda/exportar-diario (IMP-02, D2/D3) — irmã estrutural de
 * app/api/clientes/exportar/route.ts: uma Route Handler existe aqui só
 * porque um download de verdade precisa dos cabeçalhos Content-Disposition/
 * Content-Type, que uma Server Action não consegue definir. `runtime =
 * "nodejs"` é obrigatório porque `@e965/xlsx` precisa das APIs de Buffer do
 * Node (mesmo motivo da rota irmã) — isto nunca pode rodar em Edge.
 *
 * Esta rota fica fora da guarda de sessão de app/(app)/layout.tsx, então
 * re-checa a autenticação ela mesma, devolvendo 401 (mesma postura da rota
 * irmã, adaptada para fetch em vez de navegação).
 *
 * D3 — implementação literal: esta rota NÃO lê corpo da requisição e NÃO
 * aceita parâmetro nenhum (nem query string, nem JSON). Como não existe
 * parâmetro, não existe caminho pelo qual o filtro de vendedor da tela de
 * Agenda possa atravessar para o servidor, nem pelo qual um chamador possa
 * tentar ampliar o escopo do que baixa. O escopo é sempre "tudo o que a
 * regra de leitura de `historico` (migration 0002) deixa este usuário ver".
 *
 * Zero checagem de papel dentro desta rota — exatamente como a rota irmã:
 * qualquer ramo de papel aqui moveria a fronteira de autorização para fora
 * da regra de linha de `historico`, que já entrega a visibilidade certa
 * (própria x todo o time) de graça.
 */
export const runtime = "nodejs"

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  try {
    const linhas = await getDiarioParaExportacao()
    const workbook = buildDiarioWorkbook(linhas)
    const filename = `diario_${new Date().toISOString().slice(0, 10)}.xlsx`

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
