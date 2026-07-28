import { describe, expect, it } from "vitest"

import { mapRpcErrorToCode } from "@/lib/equipe/erros"

/**
 * Phase 10 (desativação de membro da equipe) — pure unit test for
 * mapRpcErrorToCode. No Supabase, no network: this only proves the mapper's
 * text-matching contract against the FULL exception strings the migration
 * (0008_desativacao_membro_equipe.sql) actually raises, so this test would
 * fail if the migration's wording ever drifted away from the matched
 * fragment.
 */
describe("mapRpcErrorToCode", () => {
  it("maps 'Não é possível desativar a própria conta' to self_deactivation", () => {
    expect(
      mapRpcErrorToCode("Não é possível desativar a própria conta")
    ).toBe("self_deactivation")
  })

  it("maps 'Não é possível desativar o último Supervisor ativo' to last_supervisor", () => {
    expect(
      mapRpcErrorToCode("Não é possível desativar o último Supervisor ativo")
    ).toBe("last_supervisor")
  })

  it("maps 'Vendedor substituto inválido ou inativo' to invalid_substitute", () => {
    expect(
      mapRpcErrorToCode("Vendedor substituto inválido ou inativo")
    ).toBe("invalid_substitute")
  })

  it("maps 'Somente supervisores podem desativar membros da equipe' to forbidden, not rpc_failed", () => {
    expect(
      mapRpcErrorToCode("Somente supervisores podem desativar membros da equipe")
    ).toBe("forbidden")
  })

  it("maps 'Somente supervisores podem reativar membros da equipe' to forbidden", () => {
    expect(
      mapRpcErrorToCode("Somente supervisores podem reativar membros da equipe")
    ).toBe("forbidden")
  })

  it("maps the deliberately-unmapped 'Membro não encontrado' to rpc_failed", () => {
    expect(mapRpcErrorToCode("Membro não encontrado")).toBe("rpc_failed")
  })

  it("maps an unrelated string to rpc_failed", () => {
    expect(mapRpcErrorToCode("connection reset by peer")).toBe("rpc_failed")
  })

  it("maps null to rpc_failed", () => {
    expect(mapRpcErrorToCode(null)).toBe("rpc_failed")
  })

  it("maps undefined to rpc_failed", () => {
    expect(mapRpcErrorToCode(undefined)).toBe("rpc_failed")
  })
})
