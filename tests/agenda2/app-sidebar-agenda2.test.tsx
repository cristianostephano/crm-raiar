// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Item da tela nova de agenda (rota /agenda-2) no menu principal (Fase 31,
 * Plano 31-06 — AGD2-06, D-12/D-13/D-14/D-15). Desde a quick 261005-ei4, o
 * item aparece no menu com o rótulo "Agenda" no topo, e o link para a
 * Agenda antiga (/agenda) fica fora do menu (interruptor
 * MOSTRAR_AGENDA_ANTIGA_NO_MENU em AppSidebar.tsx). Mesmos mocks de
 * tests/funil/app-sidebar-encerrados.test.tsx: next/navigation
 * (usePathname controlável por variável içada para os casos de rota ativa)
 * e @/lib/supabase/client (o rodapé cria um cliente de navegador ao sair,
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

describe("AppSidebar - item Agenda (tela nova /agenda-2) no menu principal (Fase 31 + quick 261005-ei4)", () => {
  // Quick 261008-rxw: Ganhos entra entre Clientes e Perdidos.
  it("ordem-d15: Vendedor e Supervisor veem Agenda (/agenda-2), Clientes, Ganhos, Perdidos, Encerrados, Dashboard nessa ordem, sem /agenda", () => {
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

  it("link: existe exatamente um link com nome acessível 'Agenda', ele tem href /agenda-2 e o rótulo antigo da tela nova não existe", () => {
    renderSidebar("vendedor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute(
      "href",
      "/agenda-2"
    )
    expect(screen.getAllByRole("link", { name: "Agenda" })).toHaveLength(1)
    expect(
      screen.queryByRole("link", { name: "Agenda 2" })
    ).not.toBeInTheDocument()
  })

  it("contagem (D-12): agenda2Count 3 expandido mostra o selo 'Agenda, 3 itens pendentes' com o texto 3", () => {
    renderSidebar("vendedor", 0, 3)
    expandSidebar()

    expect(
      screen.getByLabelText("Agenda, 3 itens pendentes")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Agenda, 3 itens pendentes")
    ).toHaveTextContent("3")
  })

  it("contagem-antiga-ignorada: agendaCount 5 junto com agenda2Count 3 mostra um único selo, o da contagem nova", () => {
    renderSidebar("vendedor", 5, 3)
    expandSidebar()

    expect(screen.getAllByLabelText(/itens pendentes/)).toHaveLength(1)
    expect(
      screen.getByLabelText("Agenda, 3 itens pendentes")
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Agenda, 5 itens pendentes")
    ).not.toBeInTheDocument()
  })

  it("zero: agenda2Count 0 não renderiza selo nem a forma 'Agenda (0)'", () => {
    renderSidebar("vendedor", 0, 0)
    expandSidebar()

    expect(screen.queryByLabelText(/^Agenda,/)).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain("Agenda (0)")
  })

  it("recolhido-bolinha (D-14): agendaCount 5 e agenda2Count 3 no menu recolhido mostram exatamente uma bolinha dentro de /agenda-2", () => {
    const { container } = renderSidebar("vendedor", 5, 3)

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

  it("ativo-sem-confusao: na rota /agenda-2, o link Agenda fica ativo e não existe link para /agenda", () => {
    mockUsePathname.mockReturnValue("/agenda-2")
    const { container } = renderSidebar("vendedor")
    expandSidebar()

    expect(screen.getByRole("link", { name: "Agenda" }).className).toContain(
      "bg-slate-700"
    )
    expect(container.querySelector('a[href="/agenda"]')).toBeNull()

    mockUsePathname.mockReturnValue("/clientes")
  })

  it("rota-antiga-digitada: com a rota /agenda digitada na barra, nenhum link do menu fica ativo", () => {
    mockUsePathname.mockReturnValue("/agenda")
    renderSidebar("vendedor")
    expandSidebar()

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).not.toContain("bg-slate-700")
    }

    mockUsePathname.mockReturnValue("/clientes")
  })

  it("icone-distinto: o svg de /agenda-2 usa lucide-notebook-pen e não existe link /agenda", () => {
    const { container } = renderSidebar("vendedor")
    expandSidebar()

    const agenda2Svg = container.querySelector('a[href="/agenda-2"] svg')

    expect(agenda2Svg?.getAttribute("class")).toContain("lucide-notebook-pen")
    expect(container.querySelector('a[href="/agenda"]')).toBeNull()
  })
})
