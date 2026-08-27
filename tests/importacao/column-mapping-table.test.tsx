// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ColumnMappingTable } from "@/components/importacao/ColumnMappingTable"
import { SYSTEM_FIELDS, type SystemFieldDefinition } from "@/lib/importacao/types"

/**
 * Fase 26 Plano 4 (MENU-02): esta lista NÃO testa nenhum recurso de
 * "frequências" — é infraestrutura genérica de `ColumnMappingTable` provando
 * que o Select respeita a propriedade `fields` recebida em vez da lista
 * padrão. Declarada localmente porque só precisa ser MENOR e DIFERENTE da
 * lista de prospecção — "Frequência de visita" não existe em SYSTEM_FIELDS.
 */
type SystemFieldTeste = "razaoSocial" | "frequenciaVisita"
const CAMPOS_TESTE: SystemFieldDefinition<SystemFieldTeste>[] = [
  { key: "razaoSocial", label: "Razão social", required: true },
  { key: "frequenciaVisita", label: "Frequência de visita", required: true },
]

describe("ColumnMappingTable", () => {
  it("padrao: sem a propriedade fields, o Select oferece os 16 rótulos da lista de clientes mais o item de não importar", () => {
    render(
      <ColumnMappingTable
        columns={["Razão social"]}
        previews={[["Empresa Exemplo"]]}
        mapping={{}}
        onMappingChange={vi.fn()}
      />
    )

    fireEvent.click(
      screen.getByLabelText("Campo do sistema para a coluna Razão social")
    )

    for (const field of SYSTEM_FIELDS) {
      expect(screen.getByRole("option", { name: field.label })).toBeInTheDocument()
    }
    expect(
      screen.getByRole("option", { name: "Não importar esta coluna" })
    ).toBeInTheDocument()
  })

  it("frequencia: com a segunda lista, o Select oferece exatamente os dois rótulos dela mais o item de não importar, e nenhum rótulo da lista de 14 aparece", () => {
    render(
      <ColumnMappingTable
        columns={["Razão social"]}
        previews={[["Empresa Exemplo"]]}
        mapping={{}}
        onMappingChange={vi.fn()}
        fields={CAMPOS_TESTE}
      />
    )

    fireEvent.click(
      screen.getByLabelText("Campo do sistema para a coluna Razão social")
    )

    for (const field of CAMPOS_TESTE) {
      expect(screen.getByRole("option", { name: field.label })).toBeInTheDocument()
    }
    expect(
      screen.getByRole("option", { name: "Não importar esta coluna" })
    ).toBeInTheDocument()

    const rotulosDaListaDeDezesseis = SYSTEM_FIELDS.filter(
      (field) => !CAMPOS_TESTE.some((f) => f.label === field.label)
    )
    for (const field of rotulosDaListaDeDezesseis) {
      expect(screen.queryByRole("option", { name: field.label })).not.toBeInTheDocument()
    }
  })

  it("sentinela: em ambos os casos, o item de não importar é o último da lista de opções", () => {
    const { unmount } = render(
      <ColumnMappingTable
        columns={["Coluna A"]}
        previews={[["valor"]]}
        mapping={{}}
        onMappingChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText("Campo do sistema para a coluna Coluna A"))
    let options = screen.getAllByRole("option")
    expect(options[options.length - 1]).toHaveTextContent("Não importar esta coluna")
    unmount()

    render(
      <ColumnMappingTable
        columns={["Coluna A"]}
        previews={[["valor"]]}
        mapping={{}}
        onMappingChange={vi.fn()}
        fields={CAMPOS_TESTE}
      />
    )
    fireEvent.click(screen.getByLabelText("Campo do sistema para a coluna Coluna A"))
    options = screen.getAllByRole("option")
    expect(options[options.length - 1]).toHaveTextContent("Não importar esta coluna")
  })

  it("mudanca: escolher uma opção dispara onMappingChange com o índice da coluna e o alvo escolhido", () => {
    const onMappingChange = vi.fn()

    render(
      <ColumnMappingTable
        columns={["Razão social"]}
        previews={[["Empresa Exemplo"]]}
        mapping={{}}
        onMappingChange={onMappingChange}
        fields={CAMPOS_TESTE}
      />
    )

    fireEvent.click(
      screen.getByLabelText("Campo do sistema para a coluna Razão social")
    )
    const option = screen.getByRole("option", { name: "Frequência de visita" })
    // Base UI's SelectItem only commits a plain "click" when it was preceded
    // by a pointerdown on the same element (mirrors a real mouse press) —
    // a bare fireEvent.click is treated as an untrusted/virtual click and
    // ignored unless the item is already highlighted.
    fireEvent.pointerDown(option)
    fireEvent.click(option)

    expect(onMappingChange).toHaveBeenCalledWith(0, "frequenciaVisita")
  })
})
