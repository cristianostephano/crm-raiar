"use client"

import { EditableListTab } from "@/components/configuracoes/EditableListTab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ListaTabela } from "@/app/actions/listas"

/**
 * Tab shell for "Configurações" (D-01) — the 4 editable-list tabs in the
 * exact domain order from the UI-SPEC's Copywriting Contract (client
 * attributes first, then funnel-related lists): Categoria (03-01/03-02),
 * then Produtos consumidos / Tipos de tarefa / Motivos de perda (03-03).
 * Each tab is pure configuration over the same generic EditableListTab —
 * no per-tab CRUD logic, since all 4 lookup tables share the identical
 * { id, nome, ativo } shape (ListaTabela union in app/actions/listas.ts).
 */
const TABS: {
  tabela: ListaTabela
  label: string
  inputPlaceholder: string
  pluralAtivoLabel: string
}[] = [
  {
    tabela: "categorias",
    label: "Categoria",
    inputPlaceholder: "Nome da categoria",
    pluralAtivoLabel: "categorias ativas",
  },
  {
    tabela: "produtos_consumidos",
    label: "Produtos consumidos",
    inputPlaceholder: "Nome do produto",
    pluralAtivoLabel: "produtos ativos",
  },
  {
    tabela: "tipos_tarefa",
    label: "Tipos de tarefa",
    inputPlaceholder: "Nome da tarefa",
    pluralAtivoLabel: "tarefas ativas",
  },
  {
    tabela: "motivos_perda",
    label: "Motivos de perda",
    inputPlaceholder: "Nome do motivo",
    pluralAtivoLabel: "motivos ativos",
  },
]

export function ConfiguracoesTabs() {
  return (
    <Tabs defaultValue="categorias">
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.tabela} value={tab.tabela}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((tab) => (
        // keepMounted: without it, Base UI's TabsPanel unmounts the inactive
        // panel entirely (TabsPanel.js `shouldRender = keepMounted ||
        // mounted`), so every tab click threw away EditableListTab's fetched
        // state and re-ran getListaValores from scratch — a real ~1-2s
        // "Carregando..." flash on every switch that manual testing read as
        // the tab not switching at all (found during Task 2's checkpoint
        // verification). keepMounted renders all 4 EditableListTab instances
        // once and toggles visibility via the `hidden` attribute instead, so
        // each tab fetches its ~handful of rows once and switching is
        // instant afterwards — negligible cost at this data volume.
        <TabsContent key={tab.tabela} value={tab.tabela} keepMounted>
          <EditableListTab
            tabela={tab.tabela}
            inputPlaceholder={tab.inputPlaceholder}
            pluralAtivoLabel={tab.pluralAtivoLabel}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
