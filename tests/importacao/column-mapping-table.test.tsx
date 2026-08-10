// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ColumnMappingTable } from "@/components/importacao/ColumnMappingTable"
import { SYSTEM_FIELDS } from "@/lib/importacao/types"
import { SYSTEM_FIELDS_FREQUENCIA } from "@/lib/importacao/typesFrequencia"

describe("ColumnMappingTable", () => {
  it("padrao: sem a propriedade fields, o Select oferece os 14 rótulos da lista de clientes mais o item de não importar", () => {
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
        fields={SYSTEM_FIELDS_FREQUENCIA}
      />
    )

    fireEvent.click(
      screen.getByLabelText("Campo do sistema para a coluna Razão social")
    )

    for (const field of SYSTEM_FIELDS_FREQUENCIA) {
      expect(screen.getByRole("option", { name: field.label })).toBeInTheDocument()
    }
    expect(
      screen.getByRole("option", { name: "Não importar esta coluna" })
    ).toBeInTheDocument()

    const rotulosDaListaDeQuatorze = SYSTEM_FIELDS.filter(
      (field) => !SYSTEM_FIELDS_FREQUENCIA.some((f) => f.label === field.label)
    )
    for (const field of rotulosDaListaDeQuatorze) {
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
        fields={SYSTEM_FIELDS_FREQUENCIA}
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
        fields={SYSTEM_FIELDS_FREQUENCIA}
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
