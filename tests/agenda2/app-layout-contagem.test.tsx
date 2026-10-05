// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AppLayout from "@/app/(app)/layout"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Contagem da Agenda no layout, isolada e tolerante a falha (Fase 31, Plano
 * 31-06 — D-12/D-13, T-31-27; quick 261005-ei4). `AppLayout` é um Server
 * Component async: o teste chama `await AppLayout({ children })`
 * diretamente (sem framework de rota), renderiza o JSX devolvido dentro de
 * `TooltipProvider` e expande o menu — mesmo padrão dos testes de
 * AppSidebar, mas exercitando o layout inteiro para provar que existe um
 * único selo da Agenda no menu (o da tela nova) e que uma falha na
 * contagem nunca derruba a área logada.
 */
const { getAgendaPendentesCountMock, getAgenda2PendentesCountMock } =
  vi.hoisted(() => ({
    getAgendaPendentesCountMock: vi.fn(),
    getAgenda2PendentesCountMock: vi.fn(),
  }))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/clientes",
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { nome: "Ana", sobrenome: "Souza", role: "vendedor" },
          }),
        }),
      }),
    }),
  }),
}))

vi.mock("@/lib/supabase/queries/agenda", () => ({
  getAgendaPendentesCount: getAgendaPendentesCountMock,
}))

vi.mock("@/lib/supabase/queries/agenda2", () => ({
  getAgenda2PendentesCount: getAgenda2PendentesCountMock,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn() },
  }),
}))

function expandSidebar() {
  fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }))
}

async function renderLayout() {
  const jsx = await AppLayout({ children: <div>conteúdo da página</div> })
  return render(<TooltipProvider>{jsx}</TooltipProvider>)
}

beforeEach(() => {
  getAgendaPendentesCountMock.mockReset()
  getAgenda2PendentesCountMock.mockReset()
})

describe("AppLayout - um único selo da Agenda no menu (Fase 31 + quick 261005-ei4)", () => {
  it("selo-unico: contagem antiga 2 e nova 3 mostram só o selo 'Agenda, 3 itens pendentes'", async () => {
    getAgendaPendentesCountMock.mockResolvedValue(2)
    getAgenda2PendentesCountMock.mockResolvedValue(3)

    await renderLayout()
    expandSidebar()

    expect(screen.getAllByLabelText(/itens pendentes/)).toHaveLength(1)
    expect(
      screen.getByLabelText("Agenda, 3 itens pendentes")
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Agenda, 2 itens pendentes")
    ).not.toBeInTheDocument()
  })

  it("falha-contagem-nao-derruba: contagem nova falha, o conteúdo filho e o menu continuam, sem selo", async () => {
    getAgendaPendentesCountMock.mockResolvedValue(2)
    getAgenda2PendentesCountMock.mockRejectedValue(new Error("falhou"))

    await renderLayout()
    expandSidebar()

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Clientes" })).toBeInTheDocument()
    expect(screen.queryAllByLabelText(/itens pendentes/)).toHaveLength(0)
  })

  it("contagem-antiga-nao-afeta: contagem antiga falha, a nova continua mostrando o selo 'Agenda, 3 itens pendentes'", async () => {
    getAgendaPendentesCountMock.mockRejectedValue(new Error("falhou"))
    getAgenda2PendentesCountMock.mockResolvedValue(3)

    await renderLayout()
    expandSidebar()

    expect(
      screen.getByLabelText("Agenda, 3 itens pendentes")
    ).toBeInTheDocument()
  })
})
