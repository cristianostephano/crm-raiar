import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * SSR Supabase client — used from Server Components, Server Actions, and
 * Route Handlers. `cookies()` is async in Next.js 16 (App Router).
 *
 * `setAll` is wrapped in try/catch because Server Components cannot write
 * cookies — when called from one, the write is a no-op and session refresh
 * is instead handled by `middleware.ts` on the next request.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — middleware refreshes the
            // session instead. Safe to ignore.
          }
        },
      },
    }
  )
}
