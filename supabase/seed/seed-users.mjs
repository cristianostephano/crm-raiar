#!/usr/bin/env node
// Idempotent seed script for the first Supervisor + two Vendedor test
// accounts, run against the real hosted Supabase project via the
// service_role/secret key (server-side only, never shipped to the browser).
//
// Usage: node --env-file=.env.local supabase/seed/seed-users.mjs
//
// Source: .planning/phases/01-autentica-o-e-pap-is/01-02-PLAN.md (Task 3)
// Emails/passwords MUST match tests/auth/rls-roles.test.ts's SEED_ACCOUNTS.

import { createClient } from "@supabase/supabase-js"

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Run with ` +
        `node --env-file=.env.local supabase/seed/seed-users.mjs`
    )
  }
  return value
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Keep in sync with tests/auth/rls-roles.test.ts's SEED_ACCOUNTS.
const SEED_ACCOUNTS = [
  {
    email: "cristiano.stephano@raiarorganicos.com.br",
    password: "TestSupervisor!2026",
    nome: "Cristiano",
    sobrenome: "Stephano",
    celular: "0000000000",
    role: "supervisor",
  },
  {
    email: "vendedor.a+test@raiar.local",
    password: "TestVendedorA!2026",
    nome: "Vendedor",
    sobrenome: "Teste A",
    celular: "0000000001",
    role: "vendedor",
  },
  {
    email: "vendedor.b+test@raiar.local",
    password: "TestVendedorB!2026",
    nome: "Vendedor",
    sobrenome: "Teste B",
    celular: "0000000002",
    role: "vendedor",
  },
]

/** Finds an existing auth user by email (paginated scan — small user base at this phase). */
async function findUserByEmail(email) {
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const match = data.users.find((u) => u.email === email)
    if (match) return match
    if (data.users.length < perPage) return null
    page += 1
  }
}

async function seedAccount(account) {
  const existing = await findUserByEmail(account.email)
  if (existing) {
    console.log(`SKIP (already exists): ${account.email}`)
    return existing
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true, // no invite email — bootstrap/test accounts only
    user_metadata: {
      nome: account.nome,
      sobrenome: account.sobrenome,
      celular: account.celular,
      role: account.role,
    },
  })
  if (error) {
    throw new Error(`createUser(${account.email}) failed: ${error.message}`)
  }
  console.log(`CREATED: ${account.email} (role: ${account.role})`)
  return data.user
}

async function verifyProfileRole(userId, expectedRole, email) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()
  if (error) {
    throw new Error(
      `Verification failed for ${email}: could not read profiles row (${error.message}). ` +
        `Did the on_auth_user_created trigger fire?`
    )
  }
  if (data.role !== expectedRole) {
    throw new Error(
      `Verification failed for ${email}: expected profiles.role="${expectedRole}", got "${data.role}"`
    )
  }
  console.log(`VERIFIED: ${email} -> profiles.role = "${data.role}"`)
}

async function main() {
  for (const account of SEED_ACCOUNTS) {
    const user = await seedAccount(account)
    await verifyProfileRole(user.id, account.role, account.email)
  }
  console.log("Seed complete: 1 supervisor + 2 vendedor accounts ready.")
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
