// Global Vitest setup — extends `expect` with jest-dom matchers (toBeInTheDocument,
// etc.) for component render tests. Safe to load for every test file: it only
// registers matchers, it never touches the DOM itself, so the "node"-environment
// RLS/Server Action suites are unaffected.
import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// `test.globals` is intentionally off project-wide (describe/it/expect are
// explicit imports everywhere), so @testing-library/react's automatic
// cleanup-detection (which relies on a global `afterEach`) never fires on
// its own — unmount every rendered component after each test explicitly, or
// jsdom render tests leak DOM nodes across tests in the same file.
afterEach(() => {
  cleanup()
})
