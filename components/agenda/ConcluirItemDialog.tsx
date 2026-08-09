"use client"

import { format, parseISO } from "date-fns"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Textarea } from "@/components/ui/textarea"
import { geraProximaVisita, type FrequenciaVisita } from "@/lib/funil/frequencia"
import { RESUMO_MAX, validarResumo } from "@/lib/validations/agenda"

const GENERIC_ERROR = "Não foi possível salvar as alterações. Tente novamente."

const AVISO_SEM_CADENCIA =
  "Este cliente não tem frequência de visita definida — nenhuma próxima visita será agendada."

/**
 * A janela ÚNICA de conclusão de item da Agenda (CONC-01/VIS-03),
 * parametrizada por `origem` — serve tanto a conclusão de tarefa de
 * prospecção quanto a conclusão de visita, nunca dois componentes
 * separados (instrução literal do ROADMAP.md).
 *
 * Molde estrutural: components/clientes/GanhoFrequenciaDialog.tsx /
 * PerdaMotivoDialog.tsx — mesmo par open/onOpenChange controlado de fora,
 * mesmos três estados (validationError/submitError/isSubmitting), mesma
 * limpeza de estado no handleOpenChange (nunca num efeito reagindo à
 * abertura virar falsa) e mesmo fluxo de confirmar.
 *
 * Pitfall 1 (T-15-31/T-15-32): a data sugerida (`proximaDataSugerida`) já
 * vem CALCULADA DO BANCO em `AgendaItem` (Plano 15-02) — este componente
 * nunca soma/subtrai dias, semanas ou meses. A string YYYY-MM-DD só é
 * transformada em objeto de data com `parseISO` (data local, nunca o
 * construtor cru do JavaScript a partir da string, que interpreta em fuso
 * zero e mostra o dia anterior em São Paulo), e a data escolhida só volta
 * como data de calendário pura via `format(..., "yyyy-MM-dd")` — nunca via
 * instante com fuso.
 */
export function ConcluirItemDialog({
  open,
  onOpenChange,
  origem,
  razaoSocial,
  itemTitulo,
  frequenciaVisita,
  proximaDataSugerida,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  origem: "prospeccao" | "visita"
  razaoSocial: string
  itemTitulo: string
  frequenciaVisita: FrequenciaVisita | null
  proximaDataSugerida: string | null
  onConfirm: (
    resumo: string,
    proximaData: string | null
  ) => Promise<{ error?: { message: string } } | undefined>
}) {
  const [resumo, setResumo] = useState("")
  const [proximaData, setProximaData] = useState<Date | undefined>(undefined)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Só a origem "visita" tem seção de próxima data; dentro dela, só quem
  // tem cadência real (geraProximaVisita — autoridade única, nunca
  // comparação de texto solta aqui) mostra o seletor de data em vez do
  // aviso.
  const temCadencia = origem === "visita" && geraProximaVisita(frequenciaVisita)

  // Semeia o seletor com a data sugerida (já pronta do banco) no exato
  // momento em que a janela abre para este item — mesmo posicionamento de
  // efeito que PerdaMotivoDialog já usa para seu "fetch on open", só que
  // aqui a derivação é síncrona a partir do próprio prop em vez de uma
  // chamada assíncrona.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProximaData(
      proximaDataSugerida ? parseISO(proximaDataSugerida) : undefined
    )
  }, [open, proximaDataSugerida])

  /** Resets this dialog's own local state whenever it closes — via the
   * onOpenChange handler (not a synchronous setState-in-effect on `open`
   * flipping to false), matching the react-hooks/set-state-in-effect rule's
   * "adjust state in the event handler that changes it" guidance. Sem isso,
   * o resumo escrito para um cliente reaparece pré-preenchido na conclusão
   * do cliente seguinte (T-15-30). */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setResumo("")
      setProximaData(undefined)
      setValidationError(null)
      setSubmitError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    // O botão já fica `disabled` para a mesma condição (ver abaixo) — esta
    // revalidação é defesa em profundidade contra um Enter perdido dentro
    // do textarea, mesmo raciocínio das janelas irmãs do projeto.
    const validacao = validarResumo(resumo)
    if (!validacao.valido) {
      setValidationError(validacao.message)
      return
    }
    if (temCadencia && !proximaData) {
      return
    }

    setValidationError(null)
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const proximaDataFormatada =
        temCadencia && proximaData ? format(proximaData, "yyyy-MM-dd") : null

      const result = await onConfirm(validacao.resumo, proximaDataFormatada)

      if (result?.error) {
        setSubmitError(result.error.message)
        setIsSubmitting(false)
        return
      }

      setIsSubmitting(false)
      handleOpenChange(false)
    } catch {
      setSubmitError(GENERIC_ERROR)
      setIsSubmitting(false)
    }
  }

  const trimmedLength = resumo.trim().length
  const confirmDisabled =
    isSubmitting || trimmedLength < 10 || (temCadencia && !proximaData)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {origem === "prospeccao"
              ? `Concluir tarefa de ${razaoSocial}?`
              : `Concluir visita de ${razaoSocial}?`}
          </DialogTitle>
          {origem === "prospeccao" ? (
            <DialogDescription>{itemTitulo}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="concluir-item-resumo">Resumo</Label>
          <Textarea
            id="concluir-item-resumo"
            value={resumo}
            maxLength={RESUMO_MAX}
            placeholder="Ex.: Cliente confirmou pedido para a próxima semana."
            onChange={(event) => {
              setResumo(event.target.value)
              setValidationError(null)
            }}
          />
          <p className="text-right text-xs text-muted-foreground">
            {resumo.length}/{RESUMO_MAX} caracteres
          </p>
          {validationError ? (
            <p role="alert" className="text-sm text-destructive">
              {validationError}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Escreva 1-2 frases sobre o que aconteceu.
            </p>
          )}
        </div>

        {origem === "visita" ? (
          temCadencia ? (
            <div className="flex flex-col gap-1.5">
              <Label>Próxima visita sugerida</Label>
              <Popover>
                <PopoverTrigger className="w-fit rounded-lg border border-input px-2.5 py-1.5 text-left text-sm">
                  {proximaData ? format(proximaData, "dd/MM/yyyy") : "Selecionar data"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={proximaData}
                    onSelect={setProximaData}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-sm text-muted-foreground">
                Confirme a data ou escolha outra.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{AVISO_SEM_CADENCIA}</p>
          )
        ) : null}

        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {isSubmitting
              ? "Salvando..."
              : origem === "prospeccao"
                ? "Concluir tarefa"
                : "Concluir visita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
