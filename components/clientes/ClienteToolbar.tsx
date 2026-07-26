"use client"

import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FiltersPopover,
  type ClienteFiltros,
} from "@/components/clientes/FiltersPopover"

/** "Ordenar por" options (UI-SPEC copy). "recentes" leaves the board's
 * natural drag-managed order (posicao ascending) untouched — it is the
 * default, not a re-sort. */
export type SortOption = "recentes" | "az" | "parado"

/** "Todos" / "Incompletos" tabs (D-01) — a filtered view of the same list,
 * never a separate screen. */
export type TabOption = "todos" | "incompletos"

/**
 * Toolbar row above the kanban board (D-07/D-08/D-09): search by razão
 * social only, the Filtros popover, the Ordenar por sort menu, and the
 * Todos/Incompletos tabs. Purely a controlled-input shell — all
 * search/filter/sort/tab state and matching logic live in KanbanBoard,
 * which already holds the in-memory card set (Pitfall 7: no re-query here).
 */
export function ClienteToolbar({
  searchQuery,
  onSearchQueryChange,
  sortBy,
  onSortByChange,
  activeTab,
  onActiveTabChange,
  filtros,
  onFiltrosApply,
  onFiltrosClear,
  categoriaOptions,
  produtoOptions,
  vendedorOptions,
  isSupervisor,
}: {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  sortBy: SortOption
  onSortByChange: (value: SortOption) => void
  activeTab: TabOption
  onActiveTabChange: (value: TabOption) => void
  filtros: ClienteFiltros
  onFiltrosApply: (filtros: ClienteFiltros) => void
  onFiltrosClear: () => void
  categoriaOptions: { id: string; nome: string }[]
  produtoOptions: { id: string; nome: string }[]
  vendedorOptions: { id: string; nome: string }[]
  isSupervisor: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-secondary p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Buscar por razão social..."
            className="pl-8"
            aria-label="Buscar por razão social"
          />
        </div>

        <FiltersPopover
          filtros={filtros}
          onApply={onFiltrosApply}
          onClear={onFiltrosClear}
          categoriaOptions={categoriaOptions}
          produtoOptions={produtoOptions}
          vendedorOptions={vendedorOptions}
          isSupervisor={isSupervisor}
        />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="outline">
                Ordenar por
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={sortBy}
              onValueChange={(value) => onSortByChange(value as SortOption)}
            >
              <DropdownMenuRadioItem value="recentes">
                Mais recentes
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="az">
                Razão social (A-Z)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="parado">
                Parado há mais tempo
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => onActiveTabChange(value as TabOption)}
      >
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="incompletos">Incompletos</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
