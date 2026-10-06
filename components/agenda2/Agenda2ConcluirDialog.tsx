"use client"

import { format, parseISO } from "date-fns"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Agenda2Item } from "@/lib/agenda2/itens"
import { AGENDA2_TEXTO_VISITA_MAX } from "@/lib/validations/agenda2"

const ERRO_GENERICO = "Não foi possível salvar. Tente novamente."

/**
 * Janela pequena "Concluir visita" (quick 261006-ncy): ao clicar em
 * "Concluir" (Lista, visão Dia ou diálogo do dia) a pessoa pode anotar, se
 * quiser, "O que foi feito" — ou concluir sem escrever nada. Mesma estrutura de
 * `Agenda2ApagarDialog` (corpo remontado por `key`, erro `role="alert"`,
 * Cancelar ghost, botão principal).
 *
 * Este componente NÃO chama Server Action: quem chama `concluirAgenda2Item` é
 * a `Agenda2List`, que recebe o texto cru da caixa em `onConfirmar` (a ação
 * apara e transforma vazio em NULL). A caixa abre com o "O que foi feito" já
 * salvo, para que nada seja apagado sem a pessoa ver.
 *
 * Por decisão do dono (2026-10-06), nenhuma dica ou aviso sobre números ou
 * dados pessoais nesta janela.
 */
export function Agenda2ConcluirDialog({
  open,
  onOpenChange,
  item,
  onConfirmar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Agenda2Item | null
  onConfirmar: (resultado: string) => Promise<boolean>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* O estado interno (texto/salvando/erro) vive neste filho, remontado
         * via `key` a cada abertura ou troca de item — nada de uma tentativa
         * anterior sobrevive, sem precisar de efeito. */}
        <Agenda2ConcluirDialogBody
          key={`${open}-${item?.id ?? "none"}`}
          item={item}
          onOpenChange={onOpenChange}
          onConfirmar={onConfirmar}
        />
      </DialogContent>
    </Dialog>
  )
}

function Agenda2ConcluirDialogBody({
  item,
  onOpenChange,
  onConfirmar,
}: {
  item: Agenda2Item | null
  onOpenChange: (open: boolean) => void
  onConfirmar: (resultado: string) => Promise<boolean>
}) {
  const [texto, setTexto] = useState(item?.oQueFoiFeito ?? "")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleConfirmar() {
    setSalvando(true)
    setErro(null)

    try {
      const concluiu = await onConfirmar(texto)
      if (!concluiu) {
        setErro(ERRO_GENERICO)
        setSalvando(false)
        return
      }
      setSalvando(false)
      onOpenChange(false)
    } catch {
      setErro(ERRO_GENERICO)
      setSalvando(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Concluir visita</DialogTitle>
      </DialogHeader>
      {item ? (
        <p className="text-sm text-muted-foreground">
          {`Visita de ${item.nomeCliente} em ${format(parseISO(item.data), "dd/MM")}.`}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agenda2-concluir-o-que-foi-feito">O que foi feito</Label>
        <Textarea
          id="agenda2-concluir-o-que-foi-feito"
          rows={3}
          maxLength={AGENDA2_TEXTO_VISITA_MAX}
          autoComplete="off"
          value={texto}
          disabled={salvando}
          onChange={(event) => setTexto(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Opcional. Você pode concluir sem escrever nada.
        </p>
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={salvando}
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button type="button" disabled={salvando} onClick={handleConfirmar}>
          {salvando ? "Concluindo..." : "Concluir"}
        </Button>
      </DialogFooter>
    </>
  )
}
