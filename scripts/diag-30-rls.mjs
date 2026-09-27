import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
config({ path: ".env.local" })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const email = `diag-fixture-${suffix}@raiar.local`
const password = "TestEquipeFixture!2026"

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nome: "Diag", sobrenome: suffix, celular: "11999990000", role: "vendedor" },
})
if (createErr) throw new Error(`create failed: ${createErr.message}`)
const id = created.user.id

try {
  const anon = createClient(url, anonKey)
  const { error: signInErr } = await anon.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`signin failed: ${signInErr.message}`)

  const { data: authData } = await anon.auth.getUser()
  console.log("client auth.uid() matches profile id:", authData.user.id === id)

  // Confirm profile state via service role (bypasses RLS, just for diagnosis)
  const { data: profileRow, error: profErr } = await admin
    .from("profiles")
    .select("role, ativo")
    .eq("id", id)
    .single()
  console.log("profile row (role/ativo only):", profErr ? profErr.message : profileRow)

  // Today's date computed the SAME way as the migration
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const p = (t) => parts.find((x) => x.type === t)?.value ?? ""
  const hoje = `${p("year")}-${p("month")}-${p("day")}`
  console.log("hoje (client-computed, for comparison only):", hoje)

  console.log("\n--- Test A: direct insert (bypass RPC), own id, today's date ---")
  const { error: directErr } = await anon.from("acessos_diarios").insert({ usuario_id: id, dia: hoje })
  console.log("direct insert error:", directErr ? `${directErr.code} ${directErr.message}` : null)

  // cleanup any row that direct insert may have created, before testing RPC
  await admin.from("acessos_diarios").delete().eq("usuario_id", id)

  console.log("\n--- Test B: RPC call ---")
  const { error: rpcErr } = await anon.rpc("registrar_acesso_diario")
  console.log("rpc error:", rpcErr ? `${rpcErr.code} ${rpcErr.message}` : null)
} finally {
  await admin.from("acessos_diarios").delete().eq("usuario_id", id)
  await admin.auth.admin.deleteUser(id)
}
