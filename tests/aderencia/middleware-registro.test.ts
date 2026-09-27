import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

/**
 * Fase 30, Plano 04 — updateSession() estendida com o registro diário
 * (D-01/D-04/D-10). Dublê de `@supabase/ssr` inteiro (não só do RPC): o
 * `createServerClient` real faz uma chamada de rede de verdade em
 * `auth.getUser()` — aqui ele é substituído por um cliente falso com
 * `auth.getUser` e `rpc` espionados, então nada de rede roda neste teste.
 *
 * Espiões via `vi.hoisted` (içados antes do `vi.mock`, molde de
 * tests/funil/reativar-guard.test.ts), limpos no `beforeEach`. Data do
 * sistema congelada com `vi.useFakeTimers({ toFake: ["Date"] })` — só o
 * relógio é falso, promessas continuam reais.
 */
const { getUserSpy, rpcSpy, createServerClientSpy } = vi.hoisted(() => ({
  getUserSpy: vi.fn(),
  rpcSpy: vi.fn(),
  createServerClientSpy: vi.fn(),
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => {
    createServerClientSpy(...args)
    return {
      auth: { getUser: getUserSpy },
      rpc: rpcSpy,
    }
  },
}))

import { updateSession } from "@/lib/supabase/middleware"
import { MARCADOR_ACESSO_COOKIE } from "@/lib/aderencia/registroDiario"

// 2026-09-28T15:00:00Z é 2026-09-28 no fuso de São Paulo (UTC-3).
const AGORA_CONGELADO = new Date("2026-09-28T15:00:00Z")

function requestComCookie(cookieHeader?: string): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/clientes"), {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
}

beforeEach(() => {
  getUserSpy.mockReset()
  rpcSpy.mockReset()
  createServerClientSpy.mockReset()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA_CONGELADO)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("updateSession — registro diário (Fase 30, D-01/D-04/D-10)", () => {
  it("sem-usuario-nao-registra: sem usuário autenticado, rpc não é chamada e nenhum cookie de marcador é gravado", async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: null } })

    const response = await updateSession(requestComCookie())

    expect(rpcSpy).not.toHaveBeenCalled()
    expect(response.cookies.get(MARCADOR_ACESSO_COOKIE)).toBeUndefined()
    expect(getUserSpy).toHaveBeenCalledTimes(1)
  })

  it("primeiro-acesso-registra: sem cookie, usuário u1, rpc chamada 1 vez e cookie gravado com o dia de hoje", async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: { id: "u1" } } })
    rpcSpy.mockResolvedValueOnce({ error: null })

    const response = await updateSession(requestComCookie())

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith("registrar_acesso_diario")
    const cookie = response.cookies.get(MARCADOR_ACESSO_COOKIE)
    expect(cookie?.value).toBe("2026-09-28.u1")
    expect(cookie?.httpOnly).toBe(true)
  })

  it("mesmo-dia-nao-repete: cookie já tem o dia de hoje para a mesma conta, rpc não é chamada", async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: { id: "u1" } } })

    await updateSession(
      requestComCookie(`${MARCADOR_ACESSO_COOKIE}=2026-09-28.u1`)
    )

    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("dia-novo-registra: cookie de ontem para a mesma conta dispara nova chamada e atualiza o cookie", async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: { id: "u1" } } })
    rpcSpy.mockResolvedValueOnce({ error: null })

    const response = await updateSession(
      requestComCookie(`${MARCADOR_ACESSO_COOKIE}=2026-09-27.u1`)
    )

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(response.cookies.get(MARCADOR_ACESSO_COOKIE)?.value).toBe(
      "2026-09-28.u1"
    )
  })

  it("outra-conta-registra: cookie de hoje mas de outra conta dispara nova chamada", async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: { id: "u1" } } })
    rpcSpy.mockResolvedValueOnce({ error: null })

    const response = await updateSession(
      requestComCookie(`${MARCADOR_ACESSO_COOKIE}=2026-09-28.u2`)
    )

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(response.cookies.get(MARCADOR_ACESSO_COOKIE)?.value).toBe(
      "2026-09-28.u1"
    )
  })

  it("falha-nao-bloqueia: rpc devolve erro, updateSession devolve a resposta normalmente sem gravar o cookie", async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: { id: "u1" } } })
    rpcSpy.mockResolvedValueOnce({ error: { message: "falhou" } })

    const response = await updateSession(requestComCookie())

    expect(response).toBeDefined()
    expect(response.cookies.get(MARCADOR_ACESSO_COOKIE)).toBeUndefined()
  })

  it("excecao-nao-bloqueia: rpc rejeita, updateSession devolve a resposta normalmente sem gravar o cookie", async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: { id: "u1" } } })
    rpcSpy.mockRejectedValueOnce(new Error("rede"))

    const response = await updateSession(requestComCookie())

    expect(response).toBeDefined()
    expect(response.cookies.get(MARCADOR_ACESSO_COOKIE)).toBeUndefined()
  })

  it("getuser-uma-vez: getUser continua sendo chamado exatamente uma vez, mesmo com registro acontecendo", async () => {
    getUserSpy.mockResolvedValueOnce({ data: { user: { id: "u1" } } })
    rpcSpy.mockResolvedValueOnce({ error: null })

    await updateSession(requestComCookie())

    expect(getUserSpy).toHaveBeenCalledTimes(1)
  })
})
