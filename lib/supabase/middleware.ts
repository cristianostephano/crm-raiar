import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import {
  MARCADOR_ACESSO_COOKIE,
  OPCOES_MARCADOR_ACESSO,
  diaLocalSaoPaulo,
  precisaRegistrarAcesso,
  registrarAcessoDiario,
  valorMarcadorAcesso,
} from "@/lib/aderencia/registroDiario"

/**
 * Refreshes the Supabase session cookie on every request. Its main
 * responsibility continues to not branch on role or perform any
 * authorization; RLS (database) and app/(app)/layout.tsx (redirect UX) are
 * the real boundaries.
 *
 * Calls `auth.getUser()`, which revalidates against Supabase's servers on
 * every call. Deliberately avoids the cookie-only session read, which can
 * return a stale/unrefreshed session (ASVS V3, RESEARCH.md Anti-Patterns,
 * threat T-01-07).
 *
 * Fase 30 (D-01/D-04/D-10): também registra "abriu o sistema hoje", uma vez
 * por dia por conta — um cookie barato (`aderencia_dia`) decide SE vale a
 * pena chamar `registrar_acesso_diario()` (migration 0038, plano 30-01); o
 * banco é quem decide QUAL dia é gravado e QUEM tem permissão de gravar
 * (RLS) — este módulo não checa papel nenhum. Uma falha ou exceção nesse
 * registro nunca bloqueia nem redireciona a requisição (T-30-22, ameaça de
 * DoS): sem sucesso, nenhum cookie de marcador é gravado, e a próxima
 * requisição autenticada tenta de novo.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const dia = diaLocalSaoPaulo(new Date())

    if (
      precisaRegistrarAcesso(
        request.cookies.get(MARCADOR_ACESSO_COOKIE)?.value,
        dia,
        user.id
      )
    ) {
      const registrado = await registrarAcessoDiario(supabase)

      if (registrado) {
        response.cookies.set(MARCADOR_ACESSO_COOKIE, valorMarcadorAcesso(dia, user.id), OPCOES_MARCADOR_ACESSO)
      }
    }
  }

  return response
}
