"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * D-08/D-09: filter dimensions available on the client list/kanban board —
 * categoria, produto consumido (multi-value), cidade, estado, and (Supervisor
 * only) vendedor/responsável. `null`/empty means "no filter applied" for
 * that dimension.
 *
 * All option lists (categoria/produto/estado/vendedor) are derived from the
 * already-loaded RLS-scoped card set by the caller (KanbanBoard) — no
 * separate lookup query — and filtering itself runs in-memory over that same
 * set (Pitfall 7): applying/clearing filters never triggers a new getClientes
 * call.
 */
export type ClienteFiltros = {
  categoriaId: string | null
  produtoIds: string[]
  cidade: string
  estado: string | null
  vendedorId: string | null
}

export const FILTROS_VAZIOS: ClienteFiltros = {
  categoriaId: null,
  produtoIds: [],
  cidade: "",
  estado: null,
  vendedorId: null,
}

/** Number of active filter dimensions — feeds the "Filtros" button's blue dot. */
export function contarFiltrosAtivos(filtros: ClienteFiltros): number {
  let count = 0
  if (filtros.categoriaId) count += 1
  if (filtros.produtoIds.length > 0) count += 1
  if (filtros.cidade.trim() !== "") count += 1
  if (filtros.estado) count += 1
  if (filtros.vendedorId) count += 1
  return count
}

/** True when `cliente` satisfies every active filter dimension (AND, D-08). */
export function clienteAtendeFiltros(
  cliente: {
    categoria_id: string | null
    produtos: { id: string; nome: string }[]
    cidade: string
    estado: string
    responsavel: string
  },
  filtros: ClienteFiltros
): boolean {
  if (filtros.categoriaId && cliente.categoria_id !== filtros.categoriaId) {
    return false
  }

  if (filtros.produtoIds.length > 0) {
    const idsDoCliente = new Set(cliente.produtos.map((produto) => produto.id))
    if (!filtros.produtoIds.some((id) => idsDoCliente.has(id))) return false
  }

  const cidadeFiltro = filtros.cidade.trim().toLowerCase()
  if (cidadeFiltro && !cliente.cidade.toLowerCase().includes(cidadeFiltro)) {
    return false
  }

  if (filtros.estado && cliente.estado !== filtros.estado) return false

  if (filtros.vendedorId && cliente.responsavel !== filtros.vendedorId) {
    return false
  }

  return true
}

/** Sentinel Select value meaning "no filter" for that dimension — "" can't
 * be used because base-ui's Select reserves "" for the placeholder state. */
const SEM_FILTRO = "__todos__"

export function FiltersPopover({
  filtros,
  onApply,
  onClear,
  categoriaOptions,
  produtoOptions,
  estadoOptions,
  vendedorOptions,
  isSupervisor,
}: {
  filtros: ClienteFiltros
  onApply: (filtros: ClienteFiltros) => void
  onClear: () => void
  categoriaOptions: { id: string; nome: string }[]
  produtoOptions: { id: string; nome: string }[]
  estadoOptions: string[]
  vendedorOptions: { id: string; nome: string }[]
  isSupervisor: boolean
}) {
  const [open, setOpen] = useState(false)
  // Draft state — Aplicar/Limpar are the only actions that reach the parent
  // board (per UI-SPEC: both footer buttons live "inside the popover only").
  const [draft, setDraft] = useState<ClienteFiltros>(filtros)
  const ativos = contarFiltrosAtivos(filtros)

  function handleOpenChange(nextOpen: boolean) {
    // Resync the draft with the currently-applied filters every time the
    // popover opens, so a stale in-progress edit never leaks across opens.
    if (nextOpen) setDraft(filtros)
    setOpen(nextOpen)
  }

  function toggleProduto(id: string, checked: boolean) {
    setDraft((prev) => ({
      ...prev,
      produtoIds: checked
        ? [...prev.produtoIds, id]
        : prev.produtoIds.filter((produtoId) => produtoId !== id),
    }))
  }

  function handleApply() {
    onApply(draft)
    setOpen(false)
  }

  function handleClear() {
    setDraft(FILTROS_VAZIOS)
    onClear()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="relative">
            Filtros
            {ativos > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 size-2 rounded-full bg-primary"
              />
            ) : null}
          </Button>
        }
      />
      <PopoverContent className="w-80">
        <div className="flex flex-col gap-3">
          {isSupervisor ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-vendedor">Vendedor/responsável</Label>
              <Select
                value={draft.vendedorId ?? SEM_FILTRO}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    vendedorId: value === SEM_FILTRO ? null : String(value),
                  }))
                }
              >
                <SelectTrigger id="filtro-vendedor" className="w-full">
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_FILTRO}>
                    Todos os vendedores
                  </SelectItem>
                  {vendedorOptions.map((vendedor) => (
                    <SelectItem key={vendedor.id} value={vendedor.id}>
                      {vendedor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-categoria">Categoria</Label>
            <Select
              value={draft.categoriaId ?? SEM_FILTRO}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  categoriaId: value === SEM_FILTRO ? null : String(value),
                }))
              }
            >
              <SelectTrigger id="filtro-categoria" className="w-full">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_FILTRO}>Todas as categorias</SelectItem>
                {categoriaOptions.map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Produto consumido</Label>
            {produtoOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produto cadastrado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {produtoOptions.map((produto) => {
                  const inputId = `filtro-produto-${produto.id}`
                  return (
                    <div key={produto.id} className="flex items-center gap-2">
                      <Checkbox
                        id={inputId}
                        checked={draft.produtoIds.includes(produto.id)}
                        onCheckedChange={(checked) =>
                          toggleProduto(produto.id, checked)
                        }
                      />
                      <Label htmlFor={inputId} className="font-normal">
                        {produto.nome}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-cidade">Cidade</Label>
            <Input
              id="filtro-cidade"
              placeholder="Filtrar por cidade..."
              value={draft.cidade}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, cidade: event.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-estado">Estado</Label>
            <Select
              value={draft.estado ?? SEM_FILTRO}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  estado: value === SEM_FILTRO ? null : String(value),
                }))
              }
            >
              <SelectTrigger id="filtro-estado" className="w-full">
                <SelectValue placeholder="Todos os estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_FILTRO}>Todos os estados</SelectItem>
                {estadoOptions.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
            >
              Limpar filtros
            </Button>
            <Button type="button" size="sm" onClick={handleApply}>
              Aplicar filtros
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
