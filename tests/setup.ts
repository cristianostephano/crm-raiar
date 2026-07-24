// Global Vitest setup — extends `expect` with jest-dom matchers (toBeInTheDocument,
// etc.) for component render tests. Safe to load for every test file: it only
// registers matchers, it never touches the DOM itself, so the "node"-environment
// RLS/Server Action suites are unaffected.
import "@testing-library/jest-dom/vitest"
