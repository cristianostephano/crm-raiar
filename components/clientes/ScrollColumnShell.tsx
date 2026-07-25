"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from "react"

/**
 * Phase 8 (KAN-01/KAN-02): fixed-height, viewport-relative droppable
 * boundary with its own internal vertical scroll, shared identically by
 * both KanbanBoard.tsx render branches (dragDisabled static branch and the
 * DndContext-wrapped draggable branch). Purely presentational — no
 * @dnd-kit or server-action imports here, so it stays importable in
 * isolation from jsdom tests without dragging in KanbanBoard's full import
 * graph (same rationale as extracting lib/clientes/completude.ts).
 *
 * `droppableRef` is optional because the dragDisabled branch has no
 * useDroppable(); the draggable branch passes useDroppable()'s setNodeRef
 * here — on the OUTER fixed-height container, never on the inner
 * overflow-y-auto div (research/PITFALLS.md Pitfall 12: the droppable
 * boundary rect must stay separate from the element that actually scrolls).
 */
export function ScrollColumnShell({
  cardCount,
  droppableRef,
  children,
}: {
  cardCount: number
  droppableRef?: Ref<HTMLDivElement>
  children: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showFade, setShowFade] = useState(false)

  const updateFade = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // `> 1`, not `> 0`, avoids flicker from subpixel rounding.
    setShowFade(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
  }, [])

  useEffect(() => {
    updateFade()
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => updateFade())
    ro.observe(el)
    return () => ro.disconnect()
  }, [cardCount, updateFade])

  return (
    <div
      ref={droppableRef}
      className="relative flex h-[calc(100vh-300px)] min-h-[360px] flex-col"
    >
      <div
        ref={scrollRef}
        onScroll={updateFade}
        className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-2"
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={
          "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent transition-opacity duration-150 ease-out " +
          (showFade ? "opacity-100" : "opacity-0")
        }
      />
    </div>
  )
}
