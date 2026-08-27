"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FileUp,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

import { LogoutButton } from "@/components/auth/LogoutButton"
import { Badge } from "@/components/ui/badge"
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
  /** AGD-06: contagem de itens pendentes da Agenda, lida uma vez por
   * carregamento de página em app/(app)/layout.tsx a partir da MESMA fonte
   * (`getAgendaPendentesCount()`) que alimenta a tela — nunca uma segunda
   * consulta. Zero quando a leitura falha (tratamento tolerante a falha no
   * layout), nunca undefined/null aqui. */
  agendaCount: number
}

type NavLink = {
  href: string
  label: string
  icon: LucideIcon
  /** Opcional porque só o item Agenda tem conteúdo dinâmico (AGD-06);
   * nenhum outro item de menu recebe selo. */
  badgeCount?: number
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
 *
 * Agenda is the FIRST entry — AGD-02 requires it literally "above Clientes",
 * so this array's order IS the requirement, not a visual preference. This
 * constant stays the single source of truth for ORDER; `badgeCount` is
 * filled in dynamically inside the component (see `sections` below), never
 * set here.
 */
const PRINCIPAL_SECTION: NavSection = {
  label: "Principal",
  links: [
    { href: "/agenda", label: "Agenda", icon: ListChecks },
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ],
}

/** Caps the compact-mode circular indicator's display at "9+" so a
 * double-digit count never overflows the collapsed icon rail (AGD-06). Not
 * used by the expanded badge or the tooltip text, which show the raw
 * number. */
function formatContagemIndicador(count: number): string {
  return count > 9 ? "9+" : String(count)
}

const ADMIN_SECTION: NavSection = {
  label: "Administração",
  links: [
    { href: "/equipe", label: "Gerenciar equipe", icon: UsersRound },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
    {
      href: "/clientes/importar",
      label: "Importar Clientes em Prospecção",
      icon: FileUp,
    },
    // BadgeCheck (selo com marca de conferido) é deliberadamente diferente de
    // FileUp (Importar Clientes em Prospecção) — carrega a ideia de cliente
    // já fechado (ganho), e as duas telas fazem coisas distintas, então
    // repetir símbolo sugeriria que são a mesma coisa.
    {
      href: "/clientes/importar-ativos",
      label: "Importar Clientes Ativos",
      icon: BadgeCheck,
    },
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
  agendaCount,
}: AppSidebarProps) {
  const [pinned, setPinned] = useState(false)
  const [hovering, setHovering] = useState(false)
  const pathname = usePathname()

  const compact = !pinned && !hovering

  // PRINCIPAL_SECTION stays the constant that defines ORDER; the count is
  // dynamic, so the effective section is derived here by mapping the
  // existing list — never duplicating it or turning the constant into a
  // function with a parameter (AGD-06).
  const principalSectionComContagem: NavSection = {
    ...PRINCIPAL_SECTION,
    links: PRINCIPAL_SECTION.links.map((link) =>
      link.href === "/agenda" ? { ...link, badgeCount: agendaCount } : link
    ),
  }

  const sections: NavSection[] =
    role === "supervisor"
      ? [principalSectionComContagem, ADMIN_SECTION]
      : [principalSectionComContagem]

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
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
          onClick={() => setPinned((value) => !value)}
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
              // Only the Agenda entry ever carries badgeCount (AGD-06); a
              // count of exactly 0 renders neither the expanded badge nor
              // the compact indicator — the "{label} (0)" form must never
              // be rendered anywhere.
              const badgeCount = link.badgeCount ?? 0
              const hasBadge = badgeCount > 0

              const linkContent = (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 overflow-hidden rounded-md px-3 py-2.5 text-sm text-slate-300 whitespace-nowrap transition-colors hover:bg-slate-800 hover:text-white",
                    compact && "justify-center",
                    // The justify-between/relative additions only ever apply
                    // to the item that actually has a badge to lay out — the
                    // other links keep exactly today's classes.
                    !compact && hasBadge && "justify-between",
                    compact && hasBadge && "relative",
                    active && "bg-slate-700 font-medium text-white"
                  )}
                >
                  {!compact && hasBadge ? (
                    <span className="flex items-center gap-3 overflow-hidden">
                      <Icon className="size-[18px] flex-shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </span>
                  ) : (
                    <Icon className="size-[18px] flex-shrink-0" />
                  )}
                  {!compact && !hasBadge ? (
                    <span className="truncate">{link.label}</span>
                  ) : null}
                  {!compact && hasBadge ? (
                    <Badge
                      className="h-4 min-w-4 shrink-0 px-1 text-[10px]"
                      aria-label={`${link.label}, ${badgeCount} itens pendentes`}
                    >
                      {badgeCount}
                    </Badge>
                  ) : null}
                  {compact && hasBadge ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] leading-none text-primary-foreground"
                    >
                      {formatContagemIndicador(badgeCount)}
                    </span>
                  ) : null}
                </Link>
              )

              if (!compact) {
                return linkContent
              }

              return (
                <Tooltip key={link.href}>
                  <TooltipTrigger render={linkContent} />
                  <TooltipContent side="right">
                    {hasBadge ? `${link.label} (${badgeCount})` : link.label}
                  </TooltipContent>
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
