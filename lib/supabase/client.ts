import { createBrowserClient } from "@supabase/ssr"

/**
 * Browser Supabase client — used from Client Components only.
 * Env var names match the real .env.local names confirmed in
 * 01-01-SUMMARY.md (legacy JWT-format anon key, not the newer
 * publishable key), matching tests/helpers/supabase-test-clients.ts.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
