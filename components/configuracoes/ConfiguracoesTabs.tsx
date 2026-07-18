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
        <TabsContent key={tab.tabela} value={tab.tabela}>
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
