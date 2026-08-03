// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

// Mandatory, not cosmetic: app/actions/equipe.ts transitively imports
// @/lib/supabase/server, which reads next/headers — there is no Next.js
// request scope inside Vitest, the same constraint already recorded in
// STATE.md for createCliente.
vi.mock("@/app/actions/equipe", () => ({
  desativarMembroEquipe: vi.fn(),
  reativarMembroEquipe: vi.fn(),
}))

import { desativarMembroEquipe } from "@/app/actions/equipe"
import { DesativarMembroDialog } from "@/components/equipe/DesativarMembroDialog"
import { EquipeList } from "@/components/equipe/EquipeList"
import { substitutosDisponiveis, type EquipeMember } from "@/lib/equipe/membros"

const supervisor: EquipeMember = {
  id: "sup-1",
  nome: "Sandra",
  sobrenome: "Silva",
  email: "sandra@raiar.local",
  role: "supervisor",
  ativo: true,
}

const vendedorAtivoA: EquipeMember = {
  id: "vend-a",
  nome: "Ana",
  sobrenome: "Alves",
  email: "ana@raiar.local",
  role: "vendedor",
  ativo: true,
}

const vendedorAtivoB: EquipeMember = {
  id: "vend-b",
  nome: "Bruno",
  sobrenome: "Barros",
  email: "bruno@raiar.local",
  role: "vendedor",
  ativo: true,
}

const vendedorInativo: EquipeMember = {
  id: "vend-c",
  nome: "Carla",
  sobrenome: "Costa",
  email: "carla@raiar.local",
  role: "vendedor",
  ativo: false,
}

const fixtureMembers: EquipeMember[] = [
  supervisor,
  vendedorAtivoA,
  vendedorAtivoB,
  vendedorInativo,
]

describe("EquipeList", () => {
  it("renderiza os dois estados de badge (Ativo e Inativo)", () => {
    render(<EquipeList members={fixtureMembers} currentUserId={supervisor.id} />)

    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Inativo").length).toBeGreaterThan(0)
  })

  it("D-01: esconde Desativar na própria linha do Supervisor logado, mas mostra em outras linhas", () => {
    render(<EquipeList members={fixtureMembers} currentUserId={supervisor.id} />)

    expect(
      screen.queryByLabelText(`Desativar ${supervisor.nome}`)
    ).toBeNull()
    expect(
      screen.getByLabelText(`Desativar ${vendedorAtivoA.nome}`)
    ).toBeInTheDocument()
  })

  it("linha de vendedor inativo oferece Reativar e não oferece Desativar", () => {
    render(<EquipeList members={fixtureMembers} currentUserId={supervisor.id} />)

    expect(
      screen.getByLabelText(`Reativar ${vendedorInativo.nome}`)
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(`Desativar ${vendedorInativo.nome}`)
    ).toBeNull()
  })

  it("ordem das colunas é Nome, Sobrenome, Papel, Status, E-mail, Ações", () => {
    render(<EquipeList members={fixtureMembers} currentUserId={supervisor.id} />)

    const headers = screen
      .getAllByRole("columnheader")
      .map((th) => th.textContent)

    expect(headers).toEqual([
      "Nome",
      "Sobrenome",
      "Papel",
      "Status",
      "E-mail",
      "Ações",
    ])
  })
})

describe("DesativarMembroDialog", () => {
  it("renderiza o título e o parágrafo de consequência com a cópia exata", async () => {
    render(
      <DesativarMembroDialog
        member={vendedorAtivoA}
        members={fixtureMembers}
        onOpenChange={() => {}}
        onSuccess={() => {}}
        onBanFailure={() => {}}
      />
    )

    expect(
      await screen.findByText(
        `Desativar ${vendedorAtivoA.nome} ${vendedorAtivoA.sobrenome}?`
      )
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Você pode reativar o acesso quando quiser\./)
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/continuam no histórico de/)
    ).toBeInTheDocument()
  })

  it("renderiza o label e o placeholder do seletor de substituto", async () => {
    render(
      <DesativarMembroDialog
        member={vendedorAtivoA}
        members={fixtureMembers}
        onOpenChange={() => {}}
        onSuccess={() => {}}
        onBanFailure={() => {}}
      />
    )

    expect(await screen.findByText("Vendedor substituto")).toBeInTheDocument()
    expect(
      await screen.findByText("Selecione o substituto")
    ).toBeInTheDocument()
  })

  it("valida antes de chamar o Server Action quando nada foi selecionado", async () => {
    render(
      <DesativarMembroDialog
        member={vendedorAtivoA}
        members={fixtureMembers}
        onOpenChange={() => {}}
        onSuccess={() => {}}
        onBanFailure={() => {}}
      />
    )

    const confirmButton = await screen.findByRole("button", {
      name: "Desativar",
    })
    fireEvent.click(confirmButton)

    expect(
      await screen.findByText(
        "Selecione um vendedor substituto antes de confirmar."
      )
    ).toBeInTheDocument()
    expect(desativarMembroEquipe).not.toHaveBeenCalled()
  })
})

describe("substitutosDisponiveis", () => {
  it("exclui o alvo, exclui o Supervisor, exclui inativos, e retorna apenas o outro vendedor ativo", () => {
    const result = substitutosDisponiveis(fixtureMembers, vendedorAtivoA.id)

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(vendedorAtivoB.id)
    expect(result.some((m) => m.id === vendedorAtivoA.id)).toBe(false)
    expect(result.some((m) => m.id === supervisor.id)).toBe(false)
    expect(result.some((m) => m.id === vendedorInativo.id)).toBe(false)
  })
})
