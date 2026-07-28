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

/**
 * Phase 10 (desativação de membro da equipe) — disposable test-member
 * fixtures. Deactivating a team member permanently flips a real `profiles`
 * row (`ativo = false`), so no test in this or any later plan may ever
 * target `SEED_ACCOUNTS.vendedorA`/`vendedorB` or the seeded Supervisor —
 * those identities are shared across every phase's suites. `createTestMember`
 * / `deleteTestMember` create and tear down a throwaway Supervisor or
 * Vendedor instead, so deactivation behaviour can be proven without ever
 * touching a shared seed account.
 */
export type TestMember = {
  id: string
  email: string
  password: string
  nome: string
  sobrenome: string
}

const TEST_MEMBER_PASSWORD = "TestEquipeFixture!2026"

/**
 * Creates a throwaway Supervisor or Vendedor via the Auth Admin API.
 * Auto-confirming the email is mandatory — without it the fixture cannot
 * sign in, which the EQP-03 test in plan 10-03 depends on. `user_metadata` keys
 * are not free-form: the `handle_new_user` trigger
 * (`supabase/migrations/0001_profiles_and_roles.sql`) reads exactly `nome`,
 * `sobrenome`, `celular` and `role` out of `raw_user_meta_data` and inserts
 * them straight into NOT NULL columns, so all four must be present here.
 */
export async function createTestMember(
  role: "supervisor" | "vendedor",
  label?: string
): Promise<TestMember> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `equipe-fixture-${label ?? role}-${suffix}@raiar.local`
  const password = TEST_MEMBER_PASSWORD
  const nome = "Fixture"
  const sobrenome = suffix
  const celular = "11999990000"

  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, sobrenome, celular, role },
  })

  if (error) {
    throw new Error(`createTestMember("${role}") failed: ${error.message}`)
  }

  return { id: data.user.id, email, password, nome, sobrenome }
}

/**
 * Deletes a disposable test member created via `createTestMember`.
 * `clientes.responsavel` references `profiles(id)` with no ON DELETE
 * action (`supabase/migrations/0002_clientes_and_funil.sql`), so every
 * cliente seeded for this member must be deleted BEFORE this call, or the
 * auth-user delete fails with a foreign-key violation. The `profiles` row
 * itself needs no explicit delete — `profiles.id` cascades from
 * `auth.users` (`on delete cascade`).
 */
export async function deleteTestMember(id: string): Promise<void> {
  const { error } = await serviceClient().auth.admin.deleteUser(id)
  if (error) {
    throw new Error(`deleteTestMember("${id}") failed: ${error.message}`)
  }
}
