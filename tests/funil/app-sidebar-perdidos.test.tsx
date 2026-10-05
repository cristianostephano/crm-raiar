// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Item "Perdidos" no menu principal (Fase 28, Plano 28-04, Tarefa 3 —
 * D-01/D-02/D-03). Desde a Fase 31 (31-06), o caso "ordem" também inclui
 * "/agenda-2" (D-15). Mesmos mocks de tests/agenda/app-sidebar-agenda.test.tsx:
 * next/navigation (usePathname controlável por variável içada para o caso
 * `ativo`) e @/lib/supabase/client (o rodapé cria um cliente de navegador ao
 * sair, mockado defensivamente).
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

describe("AppSidebar - item Perdidos no menu principal (Fase 28)", () => {
  it("vendedor: menu expandido de um Vendedor tem um link Perdidos com href /perdidos", () => {
    renderSidebar("vendedor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Perdidos" })).toHaveAttribute(
      "href",
      "/perdidos"
    )
  })

  it("supervisor: menu expandido de um Supervisor também tem o link", () => {
    renderSidebar("supervisor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Perdidos" })).toHaveAttribute(
      "href",
      "/perdidos"
    )
  })

  it("ordem: entre os links principais, a ordem no documento é /agenda-2, /clientes, /perdidos, /dashboard, sem /agenda (quick 261005-ei4)", () => {
    renderSidebar("vendedor")
    expandSidebar()

    const links = screen.getAllByRole("link")
    const hrefs = links.map((link) => link.getAttribute("href"))
    const principaisNaOrdem = hrefs.filter((href) =>
      ["/agenda", "/agenda-2", "/clientes", "/perdidos", "/dashboard"].includes(
        href ?? ""
      )
    )

    expect(principaisNaOrdem).toEqual([
      "/agenda-2",
      "/clientes",
      "/perdidos",
      "/dashboard",
    ])
  })

  it("sem-contador: com contagem 5 na Agenda e menu expandido, só existe o selo da Agenda; o link Perdidos não tem contador", () => {
    renderSidebar("vendedor", 5)
    expandSidebar()

    expect(screen.getAllByLabelText(/itens pendentes/)).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Perdidos" })).toHaveTextContent(
      "Perdidos"
    )
    expect(document.body.innerHTML).not.toContain("Perdidos (")
  })

  it("recolhido-sem-contador: com contagem 5 na Agenda e menu recolhido, existe exatamente uma bolinha (quick 260928-ilo) e o link /perdidos existe", () => {
    const { container } = renderSidebar("vendedor", 5)

    expect(
      container.querySelectorAll('[data-slot="agenda-pendente-dot"]')
    ).toHaveLength(1)
    expect(
      container.querySelector('a[href="/perdidos"]')
    ).not.toBeNull()
  })

  it("ativo: com a rota atual /perdidos, o link Perdidos tem a classe de item ativo bg-slate-700", () => {
    mockUsePathname.mockReturnValue("/perdidos")
    renderSidebar("vendedor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Perdidos" }).className).toContain(
      "bg-slate-700"
    )

    mockUsePathname.mockReturnValue("/clientes")
  })
})
