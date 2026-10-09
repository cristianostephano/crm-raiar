// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Item "Ganhos" no menu principal (quick 261008-rxw, D-01/D-08/P-04): entre
 * Clientes e Perdidos, icone de trofeu, sem contador. Mesmos mocks de
 * tests/funil/app-sidebar-encerrados.test.tsx: next/navigation (usePathname
 * controlavel por variavel icada para o caso `ativo`) e
 * @/lib/supabase/client (o rodape cria um cliente de navegador ao sair,
 * mockado defensivamente).
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

function renderSidebar(role: "vendedor" | "supervisor", count = 0) {
  return render(
    <TooltipProvider>
      <AppSidebar
        fullName="Ana Souza"
        roleLabel={role === "supervisor" ? "Supervisor" : "Vendedor"}
        role={role}
        initials="AS"
        agenda2Count={count}
      />
    </TooltipProvider>
  )
}

function expandSidebar() {
  fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }))
}

describe("AppSidebar - item Ganhos no menu principal (quick 261008-rxw)", () => {
  it("vendedor: menu expandido de um Vendedor tem um link Ganhos com href /ganhos", () => {
    renderSidebar("vendedor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Ganhos" })).toHaveAttribute(
      "href",
      "/ganhos"
    )
  })

  it("supervisor: menu expandido de um Supervisor também tem o link", () => {
    renderSidebar("supervisor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Ganhos" })).toHaveAttribute(
      "href",
      "/ganhos"
    )
  })

  it("ordem: Vendedor e Supervisor veem /agenda-2, /clientes, /ganhos, /perdidos, /encerrados, /dashboard nessa ordem, sem /agenda", () => {
    for (const role of ["vendedor", "supervisor"] as const) {
      const { unmount } = renderSidebar(role)
      expandSidebar()

      const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"))
      const principaisNaOrdem = hrefs.filter((href) =>
        [
          "/agenda",
          "/agenda-2",
          "/clientes",
          "/ganhos",
          "/perdidos",
          "/encerrados",
          "/dashboard",
        ].includes(href ?? "")
      )

      expect(principaisNaOrdem).toEqual([
        "/agenda-2",
        "/clientes",
        "/ganhos",
        "/perdidos",
        "/encerrados",
        "/dashboard",
      ])
      unmount()
    }
  })

  it("icone-trofeu: o link Ganhos tem o icone de trofeu (lucide-trophy) e o link Perdidos não", () => {
    renderSidebar("vendedor")
    expandSidebar()

    expect(
      screen.getByRole("link", { name: "Ganhos" }).querySelector("svg.lucide-trophy")
    ).not.toBeNull()
    expect(
      screen.getByRole("link", { name: "Perdidos" }).querySelector("svg.lucide-trophy")
    ).toBeNull()
  })

  it("sem-contador: com contagem 5 na Agenda e menu expandido, só existe o selo da Agenda; o link Ganhos não tem contador", () => {
    renderSidebar("vendedor", 5)
    expandSidebar()

    expect(screen.getAllByLabelText(/itens pendentes/)).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Ganhos" })).toHaveTextContent(
      "Ganhos"
    )
    expect(document.body.innerHTML).not.toContain("Ganhos (")
  })

  it("recolhido-sem-contador: com contagem 5 na Agenda e menu recolhido, existe exatamente uma bolinha (quick 260928-ilo) e o link /ganhos existe", () => {
    const { container } = renderSidebar("vendedor", 5)

    expect(
      container.querySelectorAll('[data-slot="agenda-pendente-dot"]')
    ).toHaveLength(1)
    expect(container.querySelector('a[href="/ganhos"]')).not.toBeNull()
  })

  it("ativo: com a rota atual /ganhos, o link Ganhos tem a classe de item ativo bg-slate-700", () => {
    mockUsePathname.mockReturnValue("/ganhos")
    renderSidebar("vendedor")
    expandSidebar()

    expect(
      screen.getByRole("link", { name: "Ganhos" }).className
    ).toContain("bg-slate-700")

    mockUsePathname.mockReturnValue("/clientes")
  })
})
