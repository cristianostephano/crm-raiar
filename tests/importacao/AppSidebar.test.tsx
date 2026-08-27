// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/layout/AppSidebar"

/**
 * Proves the "escondido do menu" half of IMP-10 (T-06-01): the "Importar
 * Clientes em Prospecção" link only exists in the DOM when
 * `role === "supervisor"`, since it lives in ADMIN_SECTION, which
 * AppSidebar only mounts for that role. The redirect half (server-side,
 * non-supervisor -> "/") is proven separately by
 * tests/e2e/importar-guard.spec.ts.
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
  it("shows 'Importar Clientes em Prospecção' for a supervisor", () => {
    const { container } = render(
      <AppSidebar
        fullName="Ana Souza"
        roleLabel="Supervisor"
        role="supervisor"
        initials="AS"
        agendaCount={0}
      />
    )
    expandSidebar(container)

    expect(
      screen.getByText("Importar Clientes em Prospecção")
    ).toBeInTheDocument()
    // PROSP-01: a renomeação precisa ser completa — o rótulo antigo não pode
    // continuar sendo renderizado em lugar nenhum do menu.
    expect(screen.queryByText("Importar clientes")).not.toBeInTheDocument()
  })

  it("hides 'Importar Clientes em Prospecção' for a vendedor", () => {
    const { container } = render(
      <AppSidebar
        fullName="João Silva"
        roleLabel="Vendedor"
        role="vendedor"
        initials="JS"
        agendaCount={0}
      />
    )
    expandSidebar(container)

    expect(
      screen.queryByText("Importar Clientes em Prospecção")
    ).not.toBeInTheDocument()
  })

  it("shows no link with the removed labels for a supervisor (menu01menu02)", () => {
    const { container } = render(
      <AppSidebar
        fullName="Ana Souza"
        roleLabel="Supervisor"
        role="supervisor"
        initials="AS"
        agendaCount={0}
      />
    )
    expandSidebar(container)

    // MENU-01/MENU-02: as duas planilhas avulsas saíram do sistema inteiro —
    // nenhum link com esses rótulos pode continuar sendo renderizado, nem
    // para o Supervisor.
    expect(screen.queryByText("Importar frequências")).not.toBeInTheDocument()
    expect(screen.queryByText("Importar CNPJ")).not.toBeInTheDocument()
  })

  it("shows Importar Clientes Ativos for a supervisor with the correct route (ativossupervisor)", () => {
    const { container } = render(
      <AppSidebar
        fullName="Ana Souza"
        roleLabel="Supervisor"
        role="supervisor"
        initials="AS"
        agendaCount={0}
      />
    )
    expandSidebar(container)

    const link = screen.getByText("Importar Clientes Ativos").closest("a")
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/clientes/importar-ativos")
  })

  it("hides Importar Clientes Ativos for a vendedor (ativosvendedor)", () => {
    const { container } = render(
      <AppSidebar
        fullName="João Silva"
        roleLabel="Vendedor"
        role="vendedor"
        initials="JS"
        agendaCount={0}
      />
    )
    expandSidebar(container)

    expect(
      screen.queryByText("Importar Clientes Ativos")
    ).not.toBeInTheDocument()
    // Nenhuma entrada da seção de administração deve aparecer para o
    // Vendedor — a condição de papel gate a seção inteira, não item a item.
    // (Cobertura herdada do caso removido de "Importar frequências" na
    // limpeza de menu MENU-01/MENU-02.)
    expect(screen.queryByText("Gerenciar equipe")).not.toBeInTheDocument()
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument()
  })

  it("renders Importar Clientes Ativos after Importar Clientes em Prospecção in DOM order (ativosordem)", () => {
    const { container } = render(
      <AppSidebar
        fullName="Ana Souza"
        roleLabel="Supervisor"
        role="supervisor"
        initials="AS"
        agendaCount={0}
      />
    )
    expandSidebar(container)

    const links = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    )
    const importarProspeccaoIndex = links.indexOf("/clientes/importar")
    const importarAtivosIndex = links.indexOf("/clientes/importar-ativos")

    expect(importarProspeccaoIndex).toBeGreaterThanOrEqual(0)
    expect(importarAtivosIndex).toBeGreaterThan(importarProspeccaoIndex)
  })
})
