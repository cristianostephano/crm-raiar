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

describe("AppSidebar - logo real e textos mais claros (quick 260928-ilo, Task 3)", () => {
  it("recolhido e expandido: a logo (<img>) aparece num contêiner size-7/rounded-md/bg-white, e o quadrado com 'R' saiu", () => {
    renderSidebar(0)

    const imgRecolhido = screen.getByAltText("Logo Raiar Orgânicos")
    expect(imgRecolhido).toHaveAttribute("src", "/raiar-logo.png")
    expect(imgRecolhido.parentElement?.className).toContain("size-7")
    expect(imgRecolhido.parentElement?.className).toContain("rounded-md")
    expect(imgRecolhido.parentElement?.className).toContain("bg-white")
    expect(screen.queryByText("R")).not.toBeInTheDocument()

    expandSidebar()

    const imgExpandido = screen.getByAltText("Logo Raiar Orgânicos")
    expect(imgExpandido).toHaveAttribute("src", "/raiar-logo.png")
    expect(imgExpandido.parentElement?.className).toContain("size-7")
    expect(imgExpandido.parentElement?.className).toContain("rounded-md")
    expect(imgExpandido.parentElement?.className).toContain("bg-white")
    expect(screen.queryByText("R")).not.toBeInTheDocument()
  })

  it("expandido: 'CRM Raiar' aparece com as mesmas classes de hoje; recolhido: não aparece", () => {
    renderSidebar(0)

    expect(screen.queryByText("CRM Raiar")).not.toBeInTheDocument()

    expandSidebar()

    const label = screen.getByText("CRM Raiar")
    expect(label.className).toContain("text-lg")
    expect(label.className).toContain("font-bold")
    expect(label.className).toContain("text-white")
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
