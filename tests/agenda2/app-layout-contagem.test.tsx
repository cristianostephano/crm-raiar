// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AppLayout from "@/app/(app)/layout"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Segunda contagem no layout, isolada e tolerante a falha (Fase 31, Plano
 * 31-06 — D-12/D-13, T-31-27). `AppLayout` é um Server Component async: o
 * teste chama `await AppLayout({ children })` diretamente (sem framework de
 * rota), renderiza o JSX devolvido dentro de `TooltipProvider` e expande o
 * menu — mesmo padrão dos testes de AppSidebar, mas exercitando o layout
 * inteiro para provar que as duas contagens (Agenda/Agenda 2) têm try/catch
 * próprios e nunca se derrubam.
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

describe("AppLayout - contagem independente da Agenda 2 (Fase 31)", () => {
  it("contagens-separadas: Agenda=2 e Agenda 2=3 aparecem com selos próprios", async () => {
    getAgendaPendentesCountMock.mockResolvedValue(2)
    getAgenda2PendentesCountMock.mockResolvedValue(3)

    await renderLayout()
    expandSidebar()

    expect(
      screen.getByLabelText("Agenda, 2 itens pendentes")
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Agenda 2, 3 itens pendentes")
    ).toBeInTheDocument()
  })

  it("falha-agenda2-nao-derruba: contagem da Agenda 2 falha, o conteúdo filho e o menu continuam, sem selo da Agenda 2", async () => {
    getAgendaPendentesCountMock.mockResolvedValue(2)
    getAgenda2PendentesCountMock.mockRejectedValue(new Error("falhou"))

    await renderLayout()
    expandSidebar()

    expect(screen.getByText("conteúdo da página")).toBeInTheDocument()
    expect(
      screen.getByLabelText("Agenda, 2 itens pendentes")
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Agenda 2,/)).not.toBeInTheDocument()
  })

  it("falha-agenda-nao-afeta-agenda2: contagem da Agenda falha, Agenda 2 continua mostrando o selo", async () => {
    getAgendaPendentesCountMock.mockRejectedValue(new Error("falhou"))
    getAgenda2PendentesCountMock.mockResolvedValue(3)

    await renderLayout()
    expandSidebar()

    expect(
      screen.getByLabelText("Agenda 2, 3 itens pendentes")
    ).toBeInTheDocument()
  })
})
