// supabase/functions/invite-user/index.ts
//
// Admin-invoked user creation (AUTH-02 / D-02 / D-05 / D-10). There is no
// public sign-up (D-01): a Supervisor fills the "Gerenciar equipe" invite
// form, which calls this Edge Function because the underlying call
// (`auth.admin.inviteUserByEmail`) needs the service_role/secret key and
// sends an email — the `supabase-conventions` skill's trigger for
// "Edge Function, not RLS/RPC/Server Action".
//
// SECURITY (T-01-10, T-01-11): `verify_jwt` (see supabase/config.toml) only
// proves the caller is AUTHENTICATED, not that they are a Supervisor. The
// real authorization boundary is the caller-role check below, which reads
// the CALLER's own `profiles.role` through their JWT-scoped `anonClient`
// (never the admin client) and returns 403 for anyone who isn't a
// Supervisor — this MUST happen before the service_role admin client is
// ever constructed.
import { createClient } from "jsr:@supabase/supabase-js@2"
import { z } from "npm:zod@^4"

const inviteBodySchema = z.object({
  email: z.string().email(),
  nome: z.string().min(1),
  sobrenome: z.string().min(1),
  celular: z.string().min(1),
  role: z.enum(["supervisor", "vendedor"]),
})

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 })
  }

  // JWT-scoped client — used ONLY to establish who the caller is and read
  // their own profiles.role. Never the source of privileged operations.
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const {
    data: { user },
  } = await anonClient.auth.getUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { data: profile } = await anonClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  // The real authorization boundary (T-01-10): the CALLER's own role, read
  // server-side, independent of anything the client claims in the body.
  if (profile?.role !== "supervisor") {
    return new Response("Forbidden", { status: 403 })
  }

  // Body is only trusted AFTER the 403 gate, and re-validated server-side
  // (ASVS V5) — the `role` field here sets the NEW user's role, chosen by
  // an already-verified Supervisor; it never authorizes the caller (T-01-11).
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return new Response("Invalid JSON body", { status: 400 })
  }

  const parsed = inviteBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  const { email, nome, sobrenome, celular, role } = parsed.data

  // service_role/secret key — read only via Deno.env.get, only inside this
  // server-only Deno runtime, never in a NEXT_PUBLIC_* var (T-01-12).
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      // -> NEW.raw_user_meta_data in the plan-02 handle_new_user trigger,
      // which populates profiles with exactly this role (D-05).
      data: { nome, sobrenome, celular, role },
      redirectTo: `${Deno.env.get("SITE_URL")}/auth/confirm`,
    }
  )

  if (error) {
    return new Response(error.message, { status: 400 })
  }

  return new Response(JSON.stringify({ ok: true, user: data.user }), {
    headers: { "Content-Type": "application/json" },
  })
})
