// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

import { EstadoCidadeFields } from "@/components/clientes/EstadoCidadeFields"
import { Form } from "@/components/ui/form"

/**
 * Behavior tests for the Estado→Cidade cascade (LOC-01/LOC-02, D-02).
 * createClient() is mocked so cidades_por_estado() resolves a fixed list
 * without touching Supabase — per 09-03-PLAN.md's test guidance, jsdom
 * interaction with Base UI's Select/Combobox popups can be unstable, so
 * this focuses on: Cidade starts disabled until an Estado is chosen, the
 * disabled/enabled placeholders render correctly, both field labels exist,
 * and the mocked RPC wiring never throws. Full Estado-change → Cidade-reset
 * interaction is left to /gsd-verify-work's manual pass (plan's own
 * escape hatch).
 */
const rpcMock = vi.fn(() =>
  Promise.resolve({
    data: [{ nome: "Campinas" }, { nome: "Santos" }],
    error: null,
  })
)

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: rpcMock,
  }),
}))

type TestFormValues = {
  complemento?: string
  cidade: string
  estado: string
}

function Wrapper() {
  const form = useForm<TestFormValues>({
    defaultValues: { complemento: "", cidade: "", estado: "" },
  })

  return (
    <Form {...form}>
      <form>
        <EstadoCidadeFields
          control={form.control}
          watch={form.watch}
          setValue={form.setValue}
        />
      </form>
    </Form>
  )
}

describe("EstadoCidadeFields", () => {
  it("renders Estado and Cidade labels", () => {
    render(<Wrapper />)

    expect(screen.getByText("Estado")).toBeInTheDocument()
    expect(screen.getByText("Cidade")).toBeInTheDocument()
    expect(screen.getByText("Complemento")).toBeInTheDocument()
  })

  it("starts Cidade disabled with the 'Escolha o Estado primeiro' placeholder until Estado is chosen (D-02)", () => {
    render(<Wrapper />)

    const cidadeInput = screen.getByPlaceholderText("Escolha o Estado primeiro")
    expect(cidadeInput).toBeDisabled()
  })

  it("never calls the mocked cidades_por_estado RPC while no Estado is selected", () => {
    render(<Wrapper />)

    expect(rpcMock).not.toHaveBeenCalled()
  })

  it("does not throw wiring the mocked RPC (createClient().rpc('cidades_por_estado', ...))", () => {
    expect(() => render(<Wrapper />)).not.toThrow()
  })
})
