import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// Loads .env / .env.local into process.env so tests/helpers/supabase-test-clients.ts
// can read the real Supabase project credentials, same as Next.js does at runtime.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  process.env = { ...process.env, ...env }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    test: {
      environment: "node",
      // Component render tests (tests/**/*.test.tsx) need a DOM — every
      // existing *.test.ts suite (RLS/Server Action tests against the real
      // Supabase project) stays on the default "node" environment.
      environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]],
      setupFiles: ["./tests/setup.ts"],
      include: ["tests/**/*.test.{ts,tsx}"],
      exclude: ["tests/e2e/**", "node_modules/**"],
      // Phase 11: tests/dashboard/funil-detalhado.test.ts (11-01-PLAN.md)
      // isolates itself by wiping + recreating the shared vendedorB seed
      // account's own `clientes` rows before every case. That mutates the
      // same live Supabase project other suites read from — in particular
      // tests/dashboard/rls-dashboard.test.ts, which assumes vendedorB's
      // clientele stays static while only vendedorA mutates. Vitest's
      // default file-level parallelism (separate worker per test file)
      // let these two files race against the shared live database and
      // intermittently fail. Disabling it serializes every file, trading
      // some suite runtime for deterministic results against a real
      // external resource — matches this project's stated testing
      // philosophy (real RLS over mocks) and CLAUDE.md's "não marcar uma
      // tarefa como concluída sem os testes passando".
      fileParallelism: false,
    },
  }
})
