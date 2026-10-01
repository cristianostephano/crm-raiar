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
import type { Agenda2Item } from "@/lib/agenda2/itens"

const ERRO_GENERICO = "Não foi possível salvar. Tente novamente."

/**
 * Confirmação antes de apagar um item da Agenda 2 (AGD2-04) — ação
 * irreversível, mesma estrutura do diálogo "Apagar cliente" de
 * `components/clientes/ClienteDetailSheet.tsx` (título/corpo/erro
 * `role="alert"`/Cancelar ghost/Apagar destructive, "Apagando...").
 *
 * Este componente NÃO chama Server Action — recebe `onConfirmar` de quem
 * compõe (`Agenda2List`, plano 31-08), que decide a chamada real a
 * `apagarAgenda2Item`. Nenhum primitivo novo: reusa `components/ui/dialog`,
 * já instalado (RESEARCH.md Anti-Patterns).
 */
export function Agenda2ApagarDialog({
  open,
  onOpenChange,
  item,
  onConfirmar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Agenda2Item | null
  onConfirmar: () => Promise<boolean>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* O estado interno (apagando/erro) vive neste filho, remontado via
         * `key` toda vez que `open` (ou o item) muda — um erro de uma
         * tentativa anterior nunca sobrevive para a próxima vez que a
         * janela abrir, sem precisar de um efeito (useEffect) só pra isso. */}
        <Agenda2ApagarDialogBody
          key={`${open}-${item?.id ?? "none"}`}
          item={item}
          onOpenChange={onOpenChange}
          onConfirmar={onConfirmar}
        />
      </DialogContent>
    </Dialog>
  )
}

function Agenda2ApagarDialogBody({
  item,
  onOpenChange,
  onConfirmar,
}: {
  item: Agenda2Item | null
  onOpenChange: (open: boolean) => void
  onConfirmar: () => Promise<boolean>
}) {
  const [apagando, setApagando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleConfirmar() {
    setApagando(true)
    setErro(null)

    try {
      const apagou = await onConfirmar()
      if (!apagou) {
        setErro(ERRO_GENERICO)
        setApagando(false)
        return
      }
      setApagando(false)
      onOpenChange(false)
    } catch {
      setErro(ERRO_GENERICO)
      setApagando(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Apagar item</DialogTitle>
      </DialogHeader>
      {item ? (
        <p className="text-sm text-muted-foreground">
          Tem certeza que deseja apagar o item de {item.nomeCliente} em{" "}
          {format(parseISO(item.data), "dd/MM")}? Essa ação não pode ser
          desfeita.
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={apagando}
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={apagando}
          onClick={handleConfirmar}
        >
          {apagando ? "Apagando..." : "Apagar"}
        </Button>
      </DialogFooter>
    </>
  )
}
