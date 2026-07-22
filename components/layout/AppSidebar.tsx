"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { LogoutButton } from "@/components/auth/LogoutButton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type AppSidebarProps = {
  fullName: string
  roleLabel: string | null
  role: string
  initials: string
}

type NavLink = {
  href: string
  label: string
  icon: LucideIcon
}

type NavSection = {
  label: string
  links: NavLink[]
}

/**
 * Nav model as a typed array so the Administração role gate lives in one
 * place. The `role === "supervisor"` check below MUST stay semantically
 * identical to the previous inline `profile?.role === "supervisor"` checks
 * in app/(app)/layout.tsx — nav visibility is a UX reflection only, RLS
 * remains the real authorization boundary (threat T-nav-01).
 */
const PRINCIPAL_SECTION: NavSection = {
  label: "Principal",
  links: [
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ],
}

const ADMIN_SECTION: NavSection = {
  label: "Administração",
  links: [
    { href: "/equipe", label: "Gerenciar equipe", icon: UsersRound },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
  ],
}

/**
 * Persistent dark, collapsible left sidebar (sketch 001 variant B) that
 * replaces the previous top nav bar. Starts compact (64px icon rail) and
 * expands to 240px labeled via the toggle in the brand row. Uses only
 * Tailwind's neutral slate scale plus the existing `--primary` token — no
 * new CSS variables or brand colors are introduced.
 */
export function AppSidebar({
  fullName,
  roleLabel,
  role,
  initials,
}: AppSidebarProps) {
  const [compact, setCompact] = useState(true)
  const pathname = usePathname()

  const sections: NavSection[] =
    role === "supervisor"
      ? [PRINCIPAL_SECTION, ADMIN_SECTION]
      : [PRINCIPAL_SECTION]

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-shrink-0 flex-col bg-slate-900 text-slate-300 transition-[width] duration-200",
        compact ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center gap-2.5 overflow-hidden border-b border-slate-800 px-4 py-4">
        <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          R
        </div>
        {!compact ? (
          <span className="truncate text-lg font-bold whitespace-nowrap text-white">
            CRM Raiar
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setCompact((value) => !value)}
          aria-label={compact ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "flex flex-shrink-0 items-center justify-center rounded-md p-1 text-slate-500 transition-colors hover:text-white",
            compact ? "mx-auto" : "ml-auto"
          )}
        >
          {compact ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section, index) => (
          <div key={section.label} className={index > 0 ? "mt-3" : undefined}>
            {!compact ? (
              <div className="px-3 py-2 text-xs font-medium tracking-wide whitespace-nowrap text-slate-500 uppercase">
                {section.label}
              </div>
            ) : null}
            {section.links.map((link) => {
              const active = isActive(link.href)
              const Icon = link.icon

              const linkContent = (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 overflow-hidden rounded-md px-3 py-2.5 text-sm text-slate-300 whitespace-nowrap transition-colors hover:bg-slate-800 hover:text-white",
                    compact && "justify-center",
                    active && "bg-slate-700 font-medium text-white"
                  )}
                >
                  <Icon className="size-[18px] flex-shrink-0" />
                  {!compact ? <span className="truncate">{link.label}</span> : null}
                </Link>
              )

              if (!compact) {
                return linkContent
              }

              return (
                <Tooltip key={link.href}>
                  <TooltipTrigger render={linkContent} />
                  <TooltipContent side="right">{link.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-800 px-3 py-3">
        <div
          className={cn(
            "mb-3 flex items-center gap-2.5 overflow-hidden",
            compact && "justify-center"
          )}
        >
          <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials}
          </div>
          {!compact ? (
            <div className="overflow-hidden whitespace-nowrap">
              <div className="truncate text-sm font-semibold text-white">
                {fullName}
              </div>
              {roleLabel ? (
                <div className="truncate text-xs text-slate-500">
                  {roleLabel}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <LogoutButton
          variant="ghost"
          className={cn(
            "w-full text-slate-300 hover:bg-slate-800 hover:text-white",
            compact
              ? "justify-center px-0"
              : "justify-start gap-2 px-2.5"
          )}
        >
          <LogOut className="size-[18px] flex-shrink-0" />
          {!compact ? <span>Sair</span> : null}
        </LogoutButton>
      </div>
    </aside>
  )
}
