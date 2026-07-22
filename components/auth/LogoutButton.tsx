"use client"

import { useState } from "react"
import type { VariantProps } from "class-variance-authority"

import { Button, type buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type LogoutButtonProps = {
  className?: string
  variant?: VariantProps<typeof buttonVariants>["variant"]
  children?: React.ReactNode
}

export function LogoutButton({
  className,
  variant = "outline",
  children = "Sair",
}: LogoutButtonProps) {
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
    <Button
      variant={variant}
      className={className}
      onClick={handleLogout}
      disabled={isLoading}
    >
      {children}
    </Button>
  )
}
