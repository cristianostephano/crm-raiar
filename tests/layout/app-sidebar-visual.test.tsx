// @vitest-environment jsdom
import { render } from "@testing-library/react"
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
 * (same quick task) adds the logo and lightened-text cases to this same
 * file — see the header comment update expected there.
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
