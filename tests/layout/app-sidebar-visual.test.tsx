// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Visual/identity render contract for AppSidebar (quick 260928-ilo), split
 * from tests/agenda/app-sidebar-agenda.test.tsx (which owns the Agenda
 * badge/dot behavior) because these cases are about layout and brand, not
 * the Agenda item specifically.
 *
 * Task 1 owns only the <aside>/<nav> height-related classes below. Task 3
 * (same quick task) adds the logo and lightened-text cases below that.
 *
 * Same mocks/helper pattern as tests/agenda/app-sidebar-agenda.test.tsx:
 * next/navigation (usePathname pinned to /clientes) and
 * @/lib/supabase/client (the footer's LogoutButton creates a browser client
 * on click; mounting must not require a real Supabase env).
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/clientes",
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn() },
  }),
}))

function renderSidebar(agendaCount = 0) {
  return render(
    <TooltipProvider>
      <AppSidebar
        fullName="Ana Souza"
        roleLabel="Vendedor"
        role="vendedor"
        initials="AS"
        agendaCount={agendaCount}
        agenda2Count={0}
      />
    </TooltipProvider>
  )
}

describe("AppSidebar - altura da barra lateral (quick 260928-ilo, Task 1)", () => {
  it("o <aside> tem sticky, top-0 e h-dvh, e não tem mais h-full", () => {
    const { container } = renderSidebar(0)

    const aside = container.querySelector("aside")
    expect(aside).not.toBeNull()
    expect(aside?.className).toContain("sticky")
    expect(aside?.className).toContain("top-0")
    expect(aside?.className).toContain("h-dvh")
    expect(aside?.className).not.toContain("h-full")
  })

  it("o <nav> tem min-h-0 para poder encolher e rolar por dentro da barra", () => {
    const { container } = renderSidebar(0)

    const nav = container.querySelector("nav")
    expect(nav).not.toBeNull()
    expect(nav?.className).toContain("min-h-0")
  })
})

function expandSidebar() {
  fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }))
}

describe("AppSidebar - logo real e textos mais claros (quick 260928-ilo/js0/js1/js2)", () => {
  it("recolhido: a logo (transparente, tinta branca) aparece pequena, num contêiner size-10, sem fundo/moldura, e o quadrado com 'R' saiu", () => {
    renderSidebar(0)

    const imgRecolhido = screen.getByAltText("Logo Raiar Orgânicos")
    expect(imgRecolhido).toHaveAttribute("src", "/raiar-logo-white.png")
    expect(imgRecolhido.parentElement?.className).toContain("size-10")
    expect(imgRecolhido.parentElement?.className).not.toContain("bg-white")
    expect(imgRecolhido.parentElement?.className).not.toContain("rounded-md")
    expect(screen.queryByText("R")).not.toBeInTheDocument()
  })

  it("expandido: a logo aparece grande (h-14), sem o contêiner size-10 nem o texto 'CRM Raiar' (a logo já traz o nome da marca)", () => {
    renderSidebar(0)
    expandSidebar()

    const imgExpandido = screen.getByAltText("Logo Raiar Orgânicos")
    expect(imgExpandido).toHaveAttribute("src", "/raiar-logo-white.png")
    expect(imgExpandido.className).toContain("h-14")
    expect(imgExpandido.parentElement?.className).not.toContain("size-10")
    expect(screen.queryByText("R")).not.toBeInTheDocument()
    expect(screen.queryByText("CRM Raiar")).not.toBeInTheDocument()
  })

  it("expandido: link inativo (Dashboard) usa text-slate-100 (não text-slate-300); o link ativo (Clientes) continua bg-slate-700/text-white", () => {
    renderSidebar(0)
    expandSidebar()

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" })
    expect(dashboardLink.className).toContain("text-slate-100")
    expect(dashboardLink.className).not.toContain("text-slate-300")

    const clientesLink = screen.getByRole("link", { name: "Clientes" })
    expect(clientesLink.className).toContain("bg-slate-700")
    expect(clientesLink.className).toContain("text-white")
  })

  it("expandido: rótulo de seção, cargo e botão de recolher usam text-slate-400 (não text-slate-500)", () => {
    renderSidebar(0)
    expandSidebar()

    const principal = screen.getByText("Principal")
    expect(principal.className).toContain("text-slate-400")
    expect(principal.className).not.toContain("text-slate-500")

    const cargo = screen.getByText("Vendedor")
    expect(cargo.className).toContain("text-slate-400")
    expect(cargo.className).not.toContain("text-slate-500")

    const recolherButton = screen.getByRole("button", { name: "Recolher menu" })
    expect(recolherButton.className).toContain("text-slate-400")
    expect(recolherButton.className).not.toContain("text-slate-500")
  })

  it("expandido: o botão 'Sair' usa text-slate-100", () => {
    renderSidebar(0)
    expandSidebar()

    const sairButton = screen.getByRole("button", { name: "Sair" })
    expect(sairButton.className).toContain("text-slate-100")
  })
})
