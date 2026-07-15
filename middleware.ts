import { type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

/**
 * Note: Next.js 16 has renamed this root file convention from "middleware"
 * to "proxy" (the "middleware" name still works — confirmed functional in
 * this project's installed 16.2.10 — but prints a deprecation warning at
 * dev-server startup). Kept as middleware.ts/middleware() to match this
 * plan's stated artifact contract; a future plan can rename to proxy.ts
 * when convenient. Session-refresh logic itself lives in
 * lib/supabase/middleware.ts's updateSession(), unchanged either way.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
