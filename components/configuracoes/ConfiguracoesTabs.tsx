"use client"

import { EditableListTab } from "@/components/configuracoes/EditableListTab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Tab shell for "Configurações" (D-01). This plan wires only the
 * "Categoria" tab with real content — the other 3 tabs (Produtos
 * consumidos / Tipos de tarefa / Motivos de perda) are 03-03's job, so the
 * TabsList only has the one trigger for now (no dead UI for tabs that don't
 * exist yet).
 */
export function ConfiguracoesTabs() {
  return (
    <Tabs defaultValue="categorias">
      <TabsList>
        <TabsTrigger value="categorias">Categoria</TabsTrigger>
      </TabsList>
      <TabsContent value="categorias">
        <EditableListTab
          tabela="categorias"
          inputPlaceholder="Nome da categoria"
          pluralAtivoLabel="categorias ativas"
        />
      </TabsContent>
    </Tabs>
  )
}
