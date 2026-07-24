// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"

/**
 * Proves the "escondido do menu" half of IMP-10 (T-06-01): the "Importar
 * clientes" link only exists in the DOM when `role === "supervisor"`,
 * since it lives in ADMIN_SECTION, which AppSidebar only mounts for that
 * role. The redirect half (server-side, non-supervisor -> "/") is proven
 * separately by tests/e2e/importar-guard.spec.ts.
 *
 * AppSidebar starts collapsed ("compact") by default — the full label text
 * only renders once expanded (hover or pinned), same as every other nav
 * link. hover the <aside> (mouseEnter) to match that real interaction
 * before asserting on label text.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}))

function expandSidebar(container: HTMLElement) {
  const aside = container.querySelector("aside")
  if (aside) {
    fireEvent.mouseEnter(aside)
  }
}

describe("AppSidebar - IMP-10 menu visibility", () => {
  it("shows 'Importar clientes' for a supervisor", () => {
    const { container } = render(
      <AppSidebar
        fullName="Ana Souza"
        roleLabel="Supervisor"
        role="supervisor"
        initials="AS"
      />
    )
    expandSidebar(container)

    expect(screen.getByText("Importar clientes")).toBeInTheDocument()
  })

  it("hides 'Importar clientes' for a vendedor", () => {
    const { container } = render(
      <AppSidebar
        fullName="João Silva"
        roleLabel="Vendedor"
        role="vendedor"
        initials="JS"
      />
    )
    expandSidebar(container)

    expect(screen.queryByText("Importar clientes")).not.toBeInTheDocument()
  })
})
