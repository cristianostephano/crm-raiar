"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogout() {
    setIsLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // Hard navigation, same rationale as LoginForm.tsx: guarantees the
    // (app) layout's server-side auth guard sees the just-cleared session
    // cookie, instead of relying on the client Router Cache.
    window.location.assign("/login")
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={isLoading}>
      Sair
    </Button>
  )
}
