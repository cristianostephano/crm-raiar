// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Render contract for the menu's Agenda entry (14-04-PLAN.md Task 2):
 *  - ordem: AGD-02's literal "Agenda acima de Clientes" — proven by DOM
 *    position, not just presence.
 *  - contagem/zero: AGD-06's expanded badge, present when count > 0,
 *    entirely absent (no badge, no "Agenda (0)" string anywhere) at zero.
 *  - recolhido/limite: the compact-mode circular indicator, capped at "9+".
 *  - intacto: no other menu item (Clientes, Dashboard, Administração) ever
 *    gains a badge — only Agenda has dynamic content.
 *
 * AppSidebar starts collapsed (`pinned`/`hovering` both false) — cases that
 * need the expanded form click the toggle button (`aria-label="Expandir
 * menu"`), same fireEvent.click pattern already used across this project's
 * component tests (no user-event dependency installed, out of scope here).
 *
 * Mocks next/navigation (AppSidebar reads usePathname for the active-item
 * highlight) and @/lib/supabase/client (the footer's LogoutButton creates a
 * browser client on click; mounting must not require a real Supabase env),
 * following the exact pattern tests/clientes/filters-popover.test.tsx
 * already established for this codebase.
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

function expandSidebar(container: HTMLElement) {
  fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }))
  return container
}

describe("AppSidebar - item Agenda no topo do menu (14-04)", () => {
  it("ordem: Agenda aparece antes de Clientes e Dashboard no documento (AGD-02)", () => {
    const { container } = renderSidebar(0)
    expandSidebar(container)

    const links = screen.getAllByRole("link")
    const hrefs = links.map((link) => link.getAttribute("href"))
    const principaisNaOrdem = hrefs.filter((href) =>
      ["/agenda", "/clientes", "/dashboard"].includes(href ?? "")
    )

    expect(principaisNaOrdem).toEqual(["/agenda", "/clientes", "/dashboard"])
  })

  it("contagem: com 5 pendentes e menu expandido, o selo mostra 5 e o rótulo acessível anuncia a contagem (AGD-06)", () => {
    const { container } = renderSidebar(5)
    expandSidebar(container)

    expect(
      screen.getByLabelText("Agenda, 5 itens pendentes")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Agenda, 5 itens pendentes")
    ).toHaveTextContent("5")
  })

  it("zero: com contagem 0, nenhum selo é renderizado e a forma 'Agenda (0)' não existe no documento", () => {
    const { container } = renderSidebar(0)
    expandSidebar(container)

    expect(screen.queryByLabelText(/itens pendentes/)).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain("Agenda (0)")
  })

  it("recolhido: no estado inicial (recolhido) com pendências, existe o indicador circular sobre o ícone e o rótulo textual não é exibido", () => {
    const { container } = renderSidebar(5)

    expect(screen.queryByText("Agenda")).not.toBeInTheDocument()
    expect(
      container.querySelector(".absolute.-top-1.-right-1")
    ).not.toBeNull()
    expect(container.querySelector(".absolute.-top-1.-right-1")).toHaveTextContent(
      "5"
    )
  })

  it("limite: com contagem de dois dígitos e menu recolhido, o indicador exibe '9+' em vez do número cheio", () => {
    const { container } = renderSidebar(23)

    expect(
      container.querySelector(".absolute.-top-1.-right-1")
    ).toHaveTextContent("9+")
    expect(container.innerHTML).not.toContain(">23<")
  })

  it("intacto: nem Clientes nem Dashboard recebem selo — existe só um selo de contagem no menu inteiro", () => {
    const { container } = renderSidebar(5)
    expandSidebar(container)

    // The only accessible-labeled count chip in the whole menu belongs to
    // Agenda; Clientes/Dashboard render with no comparable element.
    const selos = screen.getAllByLabelText(/itens pendentes/)
    expect(selos).toHaveLength(1)
  })
})
