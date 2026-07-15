import { describe, expect, it } from "vitest"

import { anonClient } from "./supabase-test-clients"

describe("supabase-test-clients", () => {
  it("anonClient() constructs without throwing", () => {
    expect(() => anonClient()).not.toThrow()
  })
})
