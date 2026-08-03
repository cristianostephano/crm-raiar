import { createClient } from "@supabase/supabase-js"

/**
 * Phase 10 (desativação de membro da equipe) — service_role Supabase client
 * for the Next.js server process. This is the first time this codebase
 * reads `SUPABASE_SERVICE_ROLE_KEY` from a Node process instead of the Deno
 * Edge Function runtime (the existing precedent is
 * `supabase/functions/invite-user/index.ts`'s `adminClient` construction —
 * same key-exposure discipline applies here, just in a different runtime).
 *
 * Three rules this file lives under:
 *   (a) this client holds a key that bypasses RLS entirely, so
 *       `createAdminClient()` must be imported ONLY by `app/actions/equipe.ts`
 *       — never by a Client Component, and never by anything that also
 *       parses untrusted request bodies;
 *   (b) the key is read from `SUPABASE_SERVICE_ROLE_KEY`, WITHOUT a
 *       `NEXT_PUBLIC_` prefix, precisely so Next.js never inlines it into
 *       the browser bundle;
 *   (c) the Deno-side precedent for this construction is
 *       `supabase/functions/invite-user/index.ts` — the same discipline
 *       documented there (service_role key confined to one file) applies
 *       here.
 *
 * No cached module-level singleton on purpose: a fresh client per call keeps
 * the blast radius and the lifetime minimal, matching this client's only
 * use — one-shot Auth Admin API calls, never a user session.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
