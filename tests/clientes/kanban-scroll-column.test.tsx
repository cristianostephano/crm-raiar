// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ScrollColumnShell } from "@/components/clientes/ScrollColumnShell"

describe("ScrollColumnShell", () => {
  it("renders a fixed-height outer container with children inside a scrollable inner div", () => {
    const { container } = render(
      <ScrollColumnShell cardCount={3}>
        <div>card de teste</div>
      </ScrollColumnShell>
    )

    const outer = container.firstElementChild
    expect(outer).not.toBeNull()
    expect(outer?.className).toContain("relative")
    expect(outer?.className).toContain("h-[calc(100vh-300px)]")
    expect(outer?.className).toContain("min-h-[360px]")

    const scrollDiv = container.querySelector(".overflow-y-auto")
    expect(scrollDiv).not.toBeNull()
    expect(scrollDiv?.textContent).toContain("card de teste")
  })

  it("puts min-h-0 and flex-1 on the single overflow-y-auto element", () => {
    const { container } = render(
      <ScrollColumnShell cardCount={3}>
        <div>card de teste</div>
      </ScrollColumnShell>
    )

    const scrollDiv = container.querySelector(".overflow-y-auto")
    expect(scrollDiv).not.toBeNull()
    expect(scrollDiv?.className).toContain("min-h-0")
    expect(scrollDiv?.className).toContain("flex-1")
    expect(scrollDiv?.textContent).toContain("card de teste")
  })

  it("renders a conditional fade sibling outside the scroll div, hidden by default in jsdom", () => {
    const { container } = render(
      <ScrollColumnShell cardCount={3}>
        <div>card de teste</div>
      </ScrollColumnShell>
    )

    const outer = container.firstElementChild
    const scrollDiv = container.querySelector(".overflow-y-auto")
    const fade = container.querySelector('[aria-hidden="true"]')

    expect(fade).not.toBeNull()
    expect(outer?.contains(fade)).toBe(true)
    expect(scrollDiv?.contains(fade)).toBe(false)
    expect(fade?.className).toContain("pointer-events-none")
    expect(fade?.className).toContain("from-background")

    // jsdom reports scrollHeight/clientHeight as 0 (no real layout), so
    // scrollHeight - scrollTop - clientHeight is never > 1 — the fade must
    // stay hidden (opacity-0), never opacity-100.
    expect(fade?.className).toContain("opacity-0")
    expect(fade?.className).not.toContain("opacity-100")
  })
})
