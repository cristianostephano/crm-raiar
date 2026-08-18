"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AgendaVisao } from "@/lib/agenda/itens"

/**
 * Barra de ferramentas do calendário da Agenda (AGD-08, D-02) — Variante A
 * do esboço aprovado (`.planning/sketches/003-agenda-calendario/index.html`):
 * seletor de visão, navegação de data, botão "Hoje" e legenda. A Variante B
 * (mini-calendário lateral) foi explicitamente rejeitada pelo dono do
 * projeto (D-09) e não deve ser reintroduzida aqui nem em nenhum plano
 * futuro desta fase.
 *
 * A barra continua montada mesmo na visão de Lista — quando `rotulo` é
 * `null`, ela mostra só o seletor de visão, sem navegação nem legenda —
 * porque é o único caminho de volta ao Calendário depois que o usuário
 * entra na Lista.
 *
 * Componente apresentacional puro: não guarda data, não decide o passo de
 * navegação (dia/semana/mês), só dispara os retornos de chamada recebidos.
 * Quem guarda a data de referência e calcula o passo de navegação é
 * `AgendaCalendario.tsx`.
 */

const OPCOES_DE_VISAO: { valor: AgendaVisao; rotulo: string }[] = [
  { valor: "lista", rotulo: "Lista" },
  { valor: "dia", rotulo: "Dia" },
  { valor: "semana", rotulo: "Semana" },
  { valor: "mes", rotulo: "Mês" },
]

export function AgendaCalendarioToolbar({
  visao,
  onVisaoChange,
  rotulo,
  onAnterior,
  onProximo,
  onHoje,
}: {
  visao: AgendaVisao
  onVisaoChange: (visao: AgendaVisao) => void
  rotulo: string | null
  onAnterior: () => void
  onProximo: () => void
  onHoje: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {rotulo !== null ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Período anterior"
              onClick={onAnterior}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-[190px] text-center text-sm font-semibold">
              {rotulo}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Próximo período"
              onClick={onProximo}
            >
              <ChevronRight />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onHoje}
            >
              Hoje
            </Button>
          </div>
        ) : null}

        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-1">
          {OPCOES_DE_VISAO.map((opcao) => {
            const ativo = opcao.valor === visao
            return (
              <Button
                key={opcao.valor}
                type="button"
                variant={ativo ? "default" : "ghost"}
                size="sm"
                aria-pressed={ativo}
                onClick={() => onVisaoChange(opcao.valor)}
              >
                {opcao.rotulo}
              </Button>
            )
          })}
        </div>
      </div>

      {rotulo !== null ? (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground" />
            Prospecção
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            Visita
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive" />
            Atrasado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-600" />
            Concluído
          </span>
        </div>
      ) : null}
    </div>
  )
}
