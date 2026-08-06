"use client"

import { useEffect, useState } from "react"

import { buscarCidadesComClientes } from "@/lib/clientes/cidadesComClientes"
import { UFS } from "@/lib/clientes/ufs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
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
 * categoriaOptions/produtoOptions are the full active lookup-table catalogs
 * (getCategoriasAtivas/getProdutosAtivos — bugfix: previously derived from
 * the already-loaded card set, which meant a categoria/produto not yet
 * assigned to any visible cliente could never be filtered by). vendedor
 * options are still derived from the already-loaded RLS-scoped card set by
 * the caller (KanbanBoard) — there's no separate lookup table for it.
 * Estado is fed by the fixed `UFS` constant (09-04/LOC-01 — no longer
 * derived from loaded clientes, so a UF with zero clientes doesn't vanish
 * from the filter), and Cidade is a searchable Combobox scoped to cities
 * that already have at least one cliente in the chosen Estado, system-wide
 * across every vendedor (D-02, 260806-h8a) — disabled until an Estado is
 * chosen. This is a different source than the cadastro/edição form's
 * cascade (EstadoCidadeFields.tsx), which deliberately keeps offering the
 * full IBGE seed-table list so a brand-new city can still be entered the
 * first time a cliente is registered there (D-01).
 * Filtering itself always runs in-memory over the loaded card set
 * (Pitfall 7): applying/clearing filters never triggers a new getClientes
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
  if (cidadeFiltro && cliente.cidade.toLowerCase() !== cidadeFiltro) {
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
  vendedorOptions,
  isSupervisor,
}: {
  filtros: ClienteFiltros
  onApply: (filtros: ClienteFiltros) => void
  onClear: () => void
  categoriaOptions: { id: string; nome: string }[]
  produtoOptions: { id: string; nome: string }[]
  vendedorOptions: { id: string; nome: string }[]
  isSupervisor: boolean
}) {
  const [open, setOpen] = useState(false)
  // Draft state — Aplicar/Limpar are the only actions that reach the parent
  // board (per UI-SPEC: both footer buttons live "inside the popover only").
  const [draft, setDraft] = useState<ClienteFiltros>(filtros)
  const ativos = contarFiltrosAtivos(filtros)

  // Cidade options are RPC-driven and scoped to the currently-drafted Estado
  // (D-02 cascade) — unlike categoria/produto/estado, there's no static or
  // pre-loaded list to derive this from.
  const [cidades, setCidades] = useState<string[]>([])
  // Tracks whether the Cidade Combobox popup is open, purely to switch the
  // input's placeholder between "Todas as cidades" (closed, sentinel-like
  // empty state) and "Buscar cidade..." (open, actively searching) per
  // UI-SPEC's Copywriting Contract.
  const [cidadeComboboxOpen, setCidadeComboboxOpen] = useState(false)

  useEffect(() => {
    if (!draft.estado) {
      return
    }
    let cancelled = false
    buscarCidadesComClientes(draft.estado).then((nomes) => {
      if (!cancelled) setCidades(nomes)
    })
    return () => {
      cancelled = true
    }
  }, [draft.estado])

  // A lista exibida é derivada do Estado escolhido no rascunho em vez de
  // guardada: zerar o estado do React dentro do corpo do efeito dispara
  // render em cascata (regra react-hooks/set-state-in-effect). Derivar
  // produz exatamente o mesmo resultado renderizado.
  const cidadesVisiveis = draft.estado ? cidades : []

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
            <Label htmlFor="filtro-estado">Estado</Label>
            <Select
              value={draft.estado ?? SEM_FILTRO}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  estado: value === SEM_FILTRO ? null : String(value),
                  // Cascade reset (D-02): switching Estado always clears the
                  // previously-picked Cidade, since it no longer applies.
                  cidade: "",
                }))
              }
            >
              <SelectTrigger id="filtro-estado" className="w-full">
                <SelectValue placeholder="Todos os estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_FILTRO}>Todos os estados</SelectItem>
                {UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-cidade">Cidade</Label>
            <Combobox
              items={cidadesVisiveis}
              disabled={!draft.estado}
              value={draft.cidade || null}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, cidade: (value as string) ?? "" }))
              }
              onOpenChange={setCidadeComboboxOpen}
            >
              <ComboboxInput
                id="filtro-cidade"
                disabled={!draft.estado}
                placeholder={
                  !draft.estado
                    ? "Escolha o Estado primeiro"
                    : cidadeComboboxOpen
                      ? "Buscar cidade..."
                      : "Todas as cidades"
                }
              />
              <ComboboxContent>
                <ComboboxEmpty>Nenhuma cidade encontrada</ComboboxEmpty>
                <ComboboxList>
                  {(cidade: string) => (
                    <ComboboxItem key={cidade} value={cidade}>
                      {cidade}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
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
