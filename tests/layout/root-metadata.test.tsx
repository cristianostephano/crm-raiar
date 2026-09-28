// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

/**
 * app/layout.tsx's metadata (quick 260928-ilo, Task 1): the browser tab must
 * say "CRM - Raiar" everywhere, including /login — the leftover
 * create-next-app scaffold title/description made the project look
 * unfinished. next/font/google is mocked because it needs the Next.js
 * compiler's font-loading machinery to run outside of `next dev`/`next
 * build`; importing app/layout.tsx directly in Vitest without this mock
 * throws.
 */
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans", className: "geist" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "geist-mono" }),
}))

import { metadata } from "@/app/layout"

describe("app/layout.tsx - metadata da aba (quick 260928-ilo)", () => {
  it("title é exatamente 'CRM - Raiar'", () => {
    expect(metadata.title).toBe("CRM - Raiar")
  })

  it("description não contém (sem diferenciar maiúsculas) o texto padrão do create-next-app", () => {
    const description = String(metadata.description ?? "").toLowerCase()
    expect(description).not.toContain("create next app")
  })
})
