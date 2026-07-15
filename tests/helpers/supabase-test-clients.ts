import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Shared Supabase test client helpers, reused by every phase's RLS/integration
 * tests. Reads the real .env.local variable names confirmed in
 * .planning/phases/01-autentica-o-e-pap-is/01-01-SUMMARY.md:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy JWT-format anon key)
 *   - SUPABASE_SERVICE_ROLE_KEY (server-only secret key)
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Confirm it is set in ` +
        `.env.local (see 01-01-SUMMARY.md for the exact names in use).`
    )
  }
  return value
}

function supabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL")
}

function supabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

function supabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY")
}

/** Unauthenticated client using the public anon key. */
export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseAnonKey())
}

/**
 * Client authenticated with the service_role/secret key. Bypasses RLS
 * entirely — use only for test seeding/teardown, never for asserting RLS
 * behaviour (that would trivially always pass since RLS is bypassed).
 */
export function serviceClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Returns a fresh anon client signed in as the given user. This is the
 * reusable primitive every later RLS test uses to test as Vendedor A vs
 * Vendedor B vs Supervisor.
 */
export async function signInAs(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`signInAs("${email}") failed: ${error.message}`)
  }
  return client
}
