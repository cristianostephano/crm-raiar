import { createClient } from "@/lib/supabase/server"

const ROLE_LABELS: Record<string, string> = {
  supervisor: "Supervisor",
  vendedor: "Vendedor",
}

/**
 * Protected landing page — the smallest real DB-backed page proving the
 * round-trip: it reads the caller's own `profiles` row through the SSR
 * client and greets them by name + role. Authentication is already
 * guaranteed by app/(app)/layout.tsx's redirect.
 */
export default async function AppHomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("nome, role")
        .eq("id", user.id)
        .single()
    : { data: null }

  const roleLabel = profile
    ? (ROLE_LABELS[profile.role] ?? profile.role)
    : null

  return (
    <div className="flex flex-1 flex-col gap-2 px-6 py-8">
      <h1 className="text-2xl font-semibold">
        Bem-vindo(a), {profile?.nome ?? user?.email}
      </h1>
      {roleLabel ? (
        <p className="text-muted-foreground">
          Você está conectado(a) como <strong>{roleLabel}</strong>.
        </p>
      ) : null}
    </div>
  )
}
