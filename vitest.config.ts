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
    },
  }
})
