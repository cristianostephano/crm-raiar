import { describe, expect, it, vi } from "vitest"

import {
  MARCADOR_ACESSO_COOKIE,
  OPCOES_MARCADOR_ACESSO,
  diaLocalSaoPaulo,
  precisaRegistrarAcesso,
  registrarAcessoDiario,
  valorMarcadorAcesso,
} from "@/lib/aderencia/registroDiario"

/**
 * Fase 30, Plano 04 — lib/aderencia/registroDiario.ts.
 *
 * Módulo puro (sem next/headers, sem server-only): decide se o dia de uso já
 * foi registrado para uma conta (via cookie) e, quando não foi, chama a RPC
 * `registrar_acesso_diario()` (0038, plano 30-01) sem nunca deixar uma falha
 * ou exceção escapar (D-01/D-04/D-10, correção 7 do 30-01).
 */

describe("diaLocalSaoPaulo (D-10 — o dia é sempre calculado, nunca gravado, no fuso de São Paulo)", () => {
  it("dia-sp-antes-da-meia-noite: 02:59:59Z ainda é o dia anterior em São Paulo (UTC-3)", () => {
    expect(diaLocalSaoPaulo(new Date("2026-09-28T02:59:59Z"))).toBe(
      "2026-09-27"
    )
  })

  it("dia-sp-meia-noite: 03:00:00Z já é meia-noite em São Paulo, vira o dia seguinte", () => {
    expect(diaLocalSaoPaulo(new Date("2026-09-28T03:00:00Z"))).toBe(
      "2026-09-28"
    )
  })

  it("dia-sp-zero-a-esquerda: mês e dia de um dígito continuam com zero à esquerda (AAAA-MM-DD)", () => {
    expect(diaLocalSaoPaulo(new Date("2026-01-05T15:00:00Z"))).toBe(
      "2026-01-05"
    )
  })
})

describe("valorMarcadorAcesso / precisaRegistrarAcesso (D-04 — no máximo uma chamada por dia por conta)", () => {
  it("valor-marcador: combina dia e conta com um ponto separador", () => {
    expect(valorMarcadorAcesso("2026-09-28", "u1")).toBe("2026-09-28.u1")
  })

  it("marcador-igual-nao-registra: cookie já bate com o dia e a conta de hoje", () => {
    expect(precisaRegistrarAcesso("2026-09-28.u1", "2026-09-28", "u1")).toBe(
      false
    )
  })

  it("marcador-ausente-registra: sem cookie nenhum, precisa registrar", () => {
    expect(precisaRegistrarAcesso(undefined, "2026-09-28", "u1")).toBe(true)
  })

  it("marcador-dia-anterior-registra: cookie de ontem para a mesma conta", () => {
    expect(precisaRegistrarAcesso("2026-09-27.u1", "2026-09-28", "u1")).toBe(
      true
    )
  })

  it("marcador-outra-conta-registra: cookie de hoje, mas de outra conta (dois vendedores no mesmo aparelho)", () => {
    expect(precisaRegistrarAcesso("2026-09-28.u2", "2026-09-28", "u1")).toBe(
      true
    )
  })
})

describe("OPCOES_MARCADOR_ACESSO (D-10/LGPD — cookie mínimo, sem dado além do dia e da conta)", () => {
  it("opcoes-cookie: httpOnly, sameSite lax, path raiz, e validade de pelo menos um dia inteiro", () => {
    expect(OPCOES_MARCADOR_ACESSO.httpOnly).toBe(true)
    expect(OPCOES_MARCADOR_ACESSO.sameSite).toBe("lax")
    expect(OPCOES_MARCADOR_ACESSO.path).toBe("/")
    expect(OPCOES_MARCADOR_ACESSO.maxAge).toBeGreaterThanOrEqual(86400)
  })
})

describe("MARCADOR_ACESSO_COOKIE (nome fixo do cookie)", () => {
  it("é o nome estável usado por middleware e testes", () => {
    expect(MARCADOR_ACESSO_COOKIE).toBe("aderencia_dia")
  })
})

describe("registrarAcessoDiario (T-30-22 — nunca lança, mesmo em erro ou exceção)", () => {
  it("registrar-sucesso: rpc resolvendo sem erro devolve true, chamada uma vez, sem segundo argumento", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: null })

    const resultado = await registrarAcessoDiario({ rpc })

    expect(resultado).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("registrar_acesso_diario")
  })

  it("registrar-erro: rpc resolvendo com erro devolve false, sem lançar", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ error: { message: "x" } })

    const resultado = await registrarAcessoDiario({ rpc })

    expect(resultado).toBe(false)
  })

  it("registrar-excecao: rpc rejeitando devolve false, sem lançar", async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error("falha de rede"))

    const resultado = await registrarAcessoDiario({ rpc })

    expect(resultado).toBe(false)
  })
})
