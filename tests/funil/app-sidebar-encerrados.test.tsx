// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Item "Encerrados" no menu principal (Fase 29, Plano 29-07, Tarefa 3 —
 * UI-SPEC §1). Cópia estrutural de tests/funil/app-sidebar-perdidos.test.tsx
 * (Fase 28), nomes trocados. Mesmos mocks de
 * tests/agenda/app-sidebar-agenda.test.tsx: next/navigation (usePathname
 * controlável por variável içada para o caso `ativo`) e
 * @/lib/supabase/client (o rodapé cria um cliente de navegador ao sair,
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

function renderSidebar(role: "vendedor" | "supervisor", agendaCount = 0) {
  return render(
    <TooltipProvider>
      <AppSidebar
        fullName="Ana Souza"
        roleLabel={role === "supervisor" ? "Supervisor" : "Vendedor"}
        role={role}
        initials="AS"
        agendaCount={agendaCount}
      />
    </TooltipProvider>
  )
}

function expandSidebar() {
  fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }))
}

describe("AppSidebar - item Encerrados no menu principal (Fase 29)", () => {
  it("vendedor: menu expandido de um Vendedor tem um link Encerrados com href /encerrados", () => {
    renderSidebar("vendedor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Encerrados" })).toHaveAttribute(
      "href",
      "/encerrados"
    )
  })

  it("supervisor: menu expandido de um Supervisor também tem o link", () => {
    renderSidebar("supervisor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Encerrados" })).toHaveAttribute(
      "href",
      "/encerrados"
    )
  })

  it("ordem: entre os links principais, a ordem no documento é /agenda, /clientes, /perdidos, /encerrados, /dashboard", () => {
    renderSidebar("vendedor")
    expandSidebar()

    const links = screen.getAllByRole("link")
    const hrefs = links.map((link) => link.getAttribute("href"))
    const principaisNaOrdem = hrefs.filter((href) =>
      ["/agenda", "/clientes", "/perdidos", "/encerrados", "/dashboard"].includes(
        href ?? ""
      )
    )

    expect(principaisNaOrdem).toEqual([
      "/agenda",
      "/clientes",
      "/perdidos",
      "/encerrados",
      "/dashboard",
    ])
  })

  it("sem-contador: com agendaCount 5 e menu expandido, só existe o selo da Agenda; o link Encerrados não tem contador", () => {
    renderSidebar("vendedor", 5)
    expandSidebar()

    expect(screen.getAllByLabelText(/itens pendentes/)).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Encerrados" })).toHaveTextContent(
      "Encerrados"
    )
    expect(document.body.innerHTML).not.toContain("Encerrados (")
  })

  it("recolhido-sem-contador: com agendaCount 5 e menu recolhido, existe exatamente um indicador circular e o link /encerrados existe", () => {
    const { container } = renderSidebar("vendedor", 5)

    expect(
      container.querySelectorAll(".absolute.-top-1.-right-1")
    ).toHaveLength(1)
    expect(container.querySelector('a[href="/encerrados"]')).not.toBeNull()
  })

  it("ativo: com a rota atual /encerrados, o link Encerrados tem a classe de item ativo bg-slate-700", () => {
    mockUsePathname.mockReturnValue("/encerrados")
    renderSidebar("vendedor")
    expandSidebar()

    expect(
      screen.getByRole("link", { name: "Encerrados" }).className
    ).toContain("bg-slate-700")

    mockUsePathname.mockReturnValue("/clientes")
  })
})
