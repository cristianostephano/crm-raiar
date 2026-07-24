// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FileDropzone } from "@/components/importacao/FileDropzone"

const WRONG_TYPE_ERROR =
  "Não foi possível ler este arquivo. Envie um arquivo .xlsx ou .csv."

describe("FileDropzone", () => {
  it("renders the prompt and accepted-formats helper copy", () => {
    render(
      <FileDropzone onFileAccepted={vi.fn()} onFileRejected={vi.fn()} />
    )

    expect(
      screen.getByText("Arraste o arquivo aqui ou clique para selecionar")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Aceita arquivos .xlsx ou .csv, até 10 MB")
    ).toBeInTheDocument()
  })

  it("calls onFileRejected with the UI-SPEC type-error copy for an invalid extension, without parsing", () => {
    const onFileAccepted = vi.fn()
    const onFileRejected = vi.fn()

    render(
      <FileDropzone
        onFileAccepted={onFileAccepted}
        onFileRejected={onFileRejected}
      />
    )

    const input = screen.getByLabelText("Selecionar arquivo")
    const invalidFile = new File(["conteudo"], "clientes.pdf", {
      type: "application/pdf",
    })

    fireEvent.change(input, { target: { files: [invalidFile] } })

    expect(onFileRejected).toHaveBeenCalledWith(WRONG_TYPE_ERROR)
    expect(onFileAccepted).not.toHaveBeenCalled()
  })
})
