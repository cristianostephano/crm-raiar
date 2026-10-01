// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Item "Agenda 2" no menu principal (Fase 31, Plano 31-06 — AGD2-06,
 * D-12/D-13/D-14/D-15). Mesmos mocks de
 * tests/funil/app-sidebar-encerrados.test.tsx: next/navigation
 * (usePathname controlável por variável içada para o caso `ativo-sem-
 * confusao`) e @/lib/supabase/client (o rodapé cria um cliente de
 * navegador ao sair, mockado defensivamente).
 */
const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(() => "/clientes"),
}))

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn() },
  }),
}))

function renderSidebar(
  role: "vendedor" | "supervisor",
  agendaCount = 0,
  agenda2Count = 0
) {
  return render(
    <TooltipProvider>
      <AppSidebar
        fullName="Ana Souza"
        roleLabel={role === "supervisor" ? "Supervisor" : "Vendedor"}
        role={role}
        initials="AS"
        agendaCount={agendaCount}
        agenda2Count={agenda2Count}
      />
    </TooltipProvider>
  )
}

function expandSidebar() {
  fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }))
}

describe("AppSidebar - item Agenda 2 no menu principal (Fase 31)", () => {
  it("ordem-d15: Vendedor e Supervisor veem Agenda, Agenda 2, Clientes, Perdidos, Encerrados, Dashboard nessa ordem", () => {
    for (const role of ["vendedor", "supervisor"] as const) {
      const { unmount } = renderSidebar(role)
      expandSidebar()

      const links = screen.getAllByRole("link")
      const hrefs = links.map((link) => link.getAttribute("href"))
      const principaisNaOrdem = hrefs.filter((href) =>
        [
          "/agenda",
          "/agenda-2",
          "/clientes",
          "/perdidos",
          "/encerrados",
          "/dashboard",
        ].includes(href ?? "")
      )

      expect(principaisNaOrdem).toEqual([
        "/agenda",
        "/agenda-2",
        "/clientes",
        "/perdidos",
        "/encerrados",
        "/dashboard",
      ])

      unmount()
    }
  })

  it("link: o link com nome acessível 'Agenda 2' tem href /agenda-2", () => {
    renderSidebar("vendedor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Agenda 2" })).toHaveAttribute(
      "href",
      "/agenda-2"
    )
  })

  it("contagem (D-12): agenda2Count 3 expandido mostra o selo 'Agenda 2, 3 itens pendentes' com o texto 3", () => {
    renderSidebar("vendedor", 0, 3)
    expandSidebar()

    expect(
      screen.getByLabelText("Agenda 2, 3 itens pendentes")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Agenda 2, 3 itens pendentes")
    ).toHaveTextContent("3")
  })

  it("contagens-independentes: agendaCount 5 e agenda2Count 3 coexistem, exatamente 2 selos no menu", () => {
    renderSidebar("vendedor", 5, 3)
    expandSidebar()

    expect(
      screen.getByLabelText("Agenda, 5 itens pendentes")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Agenda 2, 3 itens pendentes")
    ).toBeInTheDocument()
    expect(screen.getAllByLabelText(/itens pendentes/)).toHaveLength(2)
  })

  it("zero: agenda2Count 0 não renderiza selo nem a forma 'Agenda 2 (0)'", () => {
    renderSidebar("vendedor", 0, 0)
    expandSidebar()

    expect(
      screen.queryByLabelText(/^Agenda 2,/)
    ).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain("Agenda 2 (0)")
  })

  it("recolhido-bolinha (D-14): agendaCount 0 e agenda2Count 3 no menu recolhido mostram exatamente uma bolinha dentro de /agenda-2", () => {
    const { container } = renderSidebar("vendedor", 0, 3)

    const dots = container.querySelectorAll(
      '[data-slot="agenda-pendente-dot"]'
    )
    expect(dots).toHaveLength(1)

    const link = container.querySelector('a[href="/agenda-2"]')
    expect(link).not.toBeNull()
    expect(link?.contains(dots[0])).toBe(true)
    expect(dots[0]).toHaveTextContent("")
    expect(dots[0].parentElement?.querySelector("svg")).not.toBeNull()
  })

  it("ativo-sem-confusao: na rota /agenda-2, o link Agenda 2 fica ativo e o link Agenda não", () => {
    mockUsePathname.mockReturnValue("/agenda-2")
    renderSidebar("vendedor")
    expandSidebar()

    expect(
      screen.getByRole("link", { name: "Agenda 2" }).className
    ).toContain("bg-slate-700")
    expect(
      screen.getByRole("link", { name: "Agenda" }).className
    ).not.toContain("bg-slate-700")

    mockUsePathname.mockReturnValue("/clientes")
  })

  it("icone-distinto: o svg de /agenda-2 usa lucide-notebook-pen e o de /agenda não", () => {
    const { container } = renderSidebar("vendedor")
    expandSidebar()

    const agenda2Svg = container.querySelector('a[href="/agenda-2"] svg')
    const agendaSvg = container.querySelector('a[href="/agenda"] svg')

    expect(agenda2Svg?.getAttribute("class")).toContain("lucide-notebook-pen")
    expect(agendaSvg?.getAttribute("class")).not.toContain(
      "lucide-notebook-pen"
    )
  })
})
