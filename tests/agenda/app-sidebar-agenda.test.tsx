// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Render contract for the menu's Agenda entry (14-04-PLAN.md Task 2):
 *  - ordem: AGD-02's literal "Agenda acima de Clientes" — proven by DOM
 *    position, not just presence. Desde a Fase 31 (31-06), a ordem
 *    verificada aqui inclui "Agenda 2" logo depois de "Agenda" (D-15).
 *  - contagem/zero: AGD-06's expanded badge, present when count > 0,
 *    entirely absent (no badge, no "Agenda (0)" string anywhere) at zero.
 *  - recolhido/limite: quick 260928-ilo replaced the old numeric compact
 *    indicator (which was cut off by the link's rounded corner) with a
 *    plain dot anchored to the icon itself
 *    ([data-slot="agenda-pendente-dot"]) — no number, ever, in compact
 *    mode; the full count still only lives in the expanded badge and the
 *    Tooltip text.
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
        agenda2Count={0}
      />
    </TooltipProvider>
  )
}

function expandSidebar(container: HTMLElement) {
  fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }))
  return container
}

describe("AppSidebar - item Agenda no topo do menu (14-04)", () => {
  it("ordem: Agenda aparece antes de Agenda 2, Clientes e Dashboard no documento (AGD-02/D-15)", () => {
    const { container } = renderSidebar(0)
    expandSidebar(container)

    const links = screen.getAllByRole("link")
    const hrefs = links.map((link) => link.getAttribute("href"))
    const principaisNaOrdem = hrefs.filter((href) =>
      ["/agenda", "/agenda-2", "/clientes", "/dashboard"].includes(href ?? "")
    )

    expect(principaisNaOrdem).toEqual([
      "/agenda",
      "/agenda-2",
      "/clientes",
      "/dashboard",
    ])
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

  it("recolhido com 5 pendentes: existe exatamente uma bolinha sem número, dentro do link /agenda, ancorada no ícone (não no link)", () => {
    const { container } = renderSidebar(5)

    expect(screen.queryByText("Agenda")).not.toBeInTheDocument()

    const link = container.querySelector('a[href="/agenda"]')
    expect(link).not.toBeNull()

    const dots = container.querySelectorAll(
      '[data-slot="agenda-pendente-dot"]'
    )
    expect(dots).toHaveLength(1)

    const dot = dots[0]
    expect(link?.contains(dot)).toBe(true)
    expect(dot).toHaveTextContent("")

    // The dot's immediate wrapper (not the <Link>) must contain the icon's
    // <svg> — anchored to the icon, not the corner of the whole link
    // (quick 260928-ilo: the old link-cornered indicator was clipped by
    // `overflow-hidden rounded-md`).
    expect(dot.parentElement?.querySelector("svg")).not.toBeNull()
  })

  it("recolhido com 23 pendentes (dois dígitos): a bolinha existe, sem número — nunca '9+' nem '23'", () => {
    const { container } = renderSidebar(23)

    const dots = container.querySelectorAll(
      '[data-slot="agenda-pendente-dot"]'
    )
    expect(dots).toHaveLength(1)
    expect(dots[0]).toHaveTextContent("")
    expect(container.innerHTML).not.toContain("9+")
    expect(container.innerHTML).not.toContain(">23<")
  })

  it("recolhido com 0 pendentes: nenhuma bolinha é renderizada", () => {
    const { container } = renderSidebar(0)

    expect(
      container.querySelectorAll('[data-slot="agenda-pendente-dot"]')
    ).toHaveLength(0)
  })

  it("expandido com 5 pendentes: nenhuma bolinha aparece, e o selo com número continua existindo", () => {
    const { container } = renderSidebar(5)
    expandSidebar(container)

    expect(
      container.querySelectorAll('[data-slot="agenda-pendente-dot"]')
    ).toHaveLength(0)
    expect(
      screen.getByLabelText("Agenda, 5 itens pendentes")
    ).toHaveTextContent("5")
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
