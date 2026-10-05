"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Archive,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FileUp,
  LayoutDashboard,
  ListChecks,
  LogOut,
  NotebookPen,
  PauseCircle,
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
  /** Opcional desde a quick 261005-ei4: o item da Agenda antiga (/agenda)
   * saiu do menu e o layout deixou de ler essa contagem. A prop continua
   * aceita só para a volta (MOSTRAR_AGENDA_ANTIGA_NO_MENU = true) ser
   * simples; com a flag desligada ela é ignorada. */
  agendaCount?: number
  /** AGD2-06/D-12/D-13: contagem de pendentes da Agenda 2 do PRÓPRIO
   * usuário, lida em app/(app)/layout.tsx por `getAgenda2PendentesCount()`
   * (filtro explícito por dono — D-13); zero quando a leitura falha; nunca
   * somada à de `agendaCount`. */
  agenda2Count: number
}

type NavLink = {
  href: string
  label: string
  icon: LucideIcon
  /** Opcional porque só Agenda e Agenda 2 têm conteúdo dinâmico
   * (AGD-06/AGD2-06); nenhum outro item de menu recebe selo. */
  badgeCount?: number
}

type NavSection = {
  label: string
  links: NavLink[]
}

/**
 * Piloto do dono (quick 261005-ei4). `false` tira a Agenda antiga (/agenda)
 * do menu de todos os papéis e deixa a tela nova (/agenda-2) com o rótulo
 * "Agenda". A rota, a página, os componentes e os testes da Agenda antiga
 * continuam no projeto, e a tela abre digitando /agenda. Trocar para `true`
 * devolve o item antigo ao topo e o rótulo antigo ("Agenda 2") ao item novo.
 * Para o número do selo antigo voltar também, o layout precisa voltar a ler
 * essa contagem (ver app/(app)/layout.tsx) — ou basta reverter o commit
 * desta quick. Declarada ACIMA de PRINCIPAL_SECTION de propósito: o objeto
 * abaixo é avaliado na carga do módulo e lê esta flag.
 */
const MOSTRAR_AGENDA_ANTIGA_NO_MENU: boolean = false

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
 *
 * Desde a Fase 28, a ordem inclui "Perdidos" logo depois de "Clientes" —
 * o outro lado do funil de Clientes (D-01: mesmo nível de Agenda/Clientes/
 * Dashboard, nunca uma aba dentro de Clientes). Desde a Fase 31, a ordem é
 * Agenda, Agenda 2, Clientes, Perdidos, Encerrados, Dashboard. Desde a quick
 * 261005-ei4 a ordem VISÍVEL é Agenda (/agenda-2), Clientes, Perdidos,
 * Encerrados, Dashboard — a Agenda antiga (/agenda) fica fora do menu pela
 * flag MOSTRAR_AGENDA_ANTIGA_NO_MENU.
 */
const PRINCIPAL_SECTION: NavSection = {
  label: "Principal",
  links: [
    { href: "/agenda", label: "Agenda", icon: ListChecks },
    // AGD2-06/D-15: logo abaixo de Agenda, antes de Clientes. D-12 soma o
    // selo (agenda2Count). Desde a quick 261005-ei4 esta é a "Agenda"
    // visível do menu (a antiga é filtrada pela flag abaixo), então ela vira
    // o primeiro item. NotebookPen = "anotado à mão", distinto dos demais
    // ícones já usados neste menu (UI-SPEC §Menu entry).
    {
      href: "/agenda-2",
      label: MOSTRAR_AGENDA_ANTIGA_NO_MENU ? "Agenda 2" : "Agenda",
      icon: NotebookPen,
    },
    { href: "/clientes", label: "Clientes", icon: Users },
    // D-01 (mesmo nível de Agenda/Clientes/Dashboard, não uma aba de
    // Clientes); D-02 (nunca recebe contador — perdido não é pendência
    // urgente, um número aqui soaria como alarme, decisão explícita do dono
    // do projeto); D-03 (Archive = registros guardados, ícone distinto dos
    // já usados; XCircle foi rejeitado pela conotação de erro).
    { href: "/perdidos", label: "Perdidos", icon: Archive },
    // Mesmo nível de Perdidos (tela irmã, Fase 29, D-07); nunca recebe
    // contador — encerrado não é pendência (UI-SPEC §1, mesmo raciocínio de
    // Perdidos); PauseCircle = "pausado", distinto de Archive (Perdidos) —
    // o encerrado pode ser reativado.
    { href: "/encerrados", label: "Encerrados", icon: PauseCircle },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ],
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
 *
 * quick 260928-ilo: the brand row now shows the real Raiar logo (over a
 * white tile, same 28px slot the old blue "R" square used) instead of an
 * avatar-style initial, and the menu's text/icon colors were lightened one
 * notch (slate-300→slate-100 on links/Sair, slate-500→slate-400 on the
 * section label/role/collapse button) to read closer to the reference
 * panel the project owner showed. The sidebar's own background
 * (bg-slate-900), borders (border-slate-800), hover
 * (hover:bg-slate-800) and active item (bg-slate-700 font-medium
 * text-white) did NOT change — they already matched the reference, and two
 * existing tests (tests/funil/app-sidebar-perdidos.test.tsx,
 * tests/funil/app-sidebar-encerrados.test.tsx) depend on bg-slate-700.
 */
export function AppSidebar({
  fullName,
  roleLabel,
  role,
  initials,
  agendaCount = 0,
  agenda2Count,
}: AppSidebarProps) {
  const [pinned, setPinned] = useState(false)
  const [hovering, setHovering] = useState(false)
  const pathname = usePathname()

  const compact = !pinned && !hovering

  // PRINCIPAL_SECTION stays the constant that defines ORDER; the counts are
  // dynamic, so the effective section is derived here by mapping the
  // existing list — never duplicating it or turning the constant into a
  // function with a parameter (AGD-06/AGD2-06). Agenda and Agenda 2 each
  // carry their own independent count — never merged into one number.
  // quick 261005-ei4: o filter ANTES do map remove o link /agenda quando
  // MOSTRAR_AGENDA_ANTIGA_NO_MENU é false; o ramo do map que entrega
  // agendaCount a /agenda fica parado (é o que torna a volta uma linha).
  const principalSectionComContagem: NavSection = {
    ...PRINCIPAL_SECTION,
    links: PRINCIPAL_SECTION.links
      .filter(
        (link) => MOSTRAR_AGENDA_ANTIGA_NO_MENU || link.href !== "/agenda"
      )
      .map((link) => {
        if (link.href === "/agenda") return { ...link, badgeCount: agendaCount }
        if (link.href === "/agenda-2")
          return { ...link, badgeCount: agenda2Count }
        return link
      }),
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
        // quick 260928-ilo: the old `h-full` only ever grew to the height
        // of the sidebar's OWN content — its parent flex row
        // (app/(app)/layout.tsx) only guarantees a MINIMUM height
        // (min-h-screen), so `h-full` had nothing to measure against.
        // `sticky top-0 h-dvh` makes the sidebar always exactly the height
        // of the viewport and pins it in place while the page scrolls.
        "sticky top-0 flex h-dvh flex-shrink-0 flex-col bg-slate-900 text-slate-300 transition-[width] duration-200",
        compact ? "w-16" : "w-60"
      )}
    >
      <div className="relative flex items-center justify-center overflow-hidden border-b border-slate-800 px-4 py-5">
        {/* quick 260928-js2: dono pediu pra usar a logo transparente (não a
            versão com retângulo navy sólido de fundo, que deixava uma
            costura perceptível contra o slate-900 real da sidebar) com a
            tinta convertida pra branco (public/raiar-logo-white.png,
            gerada a partir do arquivo original enviado pelo dono via
            scripts/ + sharp, mantendo o canal alfa — nunca um retângulo
            de cor sólida por trás). Sem caixa/moldura nenhuma: a
            transparência de verdade é o que garante zero costura contra
            qualquer tom de fundo. next/image com `unoptimized` evita
            tanto o aviso de lint @next/next/no-img-element (quebraria o
            --max-warnings 0 deste projeto) quanto gastar a cota de
            otimização de imagem do free tier da Vercel. */}
        {!compact ? (
          <Image
            src="/raiar-logo-white.png"
            alt="Logo Raiar Orgânicos"
            width={930}
            height={390}
            unoptimized
            className="h-14 w-auto"
          />
        ) : (
          <div className="flex size-10 flex-shrink-0 items-center justify-center overflow-hidden">
            <Image
              src="/raiar-logo-white.png"
              alt="Logo Raiar Orgânicos"
              width={930}
              height={390}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setPinned((value) => !value)}
          aria-label={compact ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "flex flex-shrink-0 items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:text-white",
            compact
              ? "absolute right-1 bottom-1"
              : "absolute right-2 top-1/2 -translate-y-1/2"
          )}
        >
          {compact ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* min-h-0 lets this flex child actually shrink below its content's
          natural height so overflow-y-auto can kick in and scroll INSIDE
          the sidebar on a short screen, instead of pushing the sidebar's
          own height past the viewport (quick 260928-ilo). */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section, index) => (
          <div key={section.label} className={index > 0 ? "mt-3" : undefined}>
            {!compact ? (
              <div className="px-3 py-2 text-xs font-medium tracking-wide whitespace-nowrap text-slate-400 uppercase">
                {section.label}
              </div>
            ) : null}
            {section.links.map((link) => {
              const active = isActive(link.href)
              const Icon = link.icon
              // Only Agenda and Agenda 2 ever carry badgeCount
              // (AGD-06/AGD2-06); a count of exactly 0 renders neither the
              // expanded badge nor the compact indicator — the "{label} (0)"
              // form must never be rendered anywhere.
              const badgeCount = link.badgeCount ?? 0
              const hasBadge = badgeCount > 0

              const linkContent = (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 overflow-hidden rounded-md px-3 py-2.5 text-sm text-slate-100 whitespace-nowrap transition-colors hover:bg-slate-800 hover:text-white",
                    compact && "justify-center",
                    // The justify-between addition only ever applies to the
                    // item that actually has a badge to lay out — the other
                    // links keep exactly today's classes.
                    !compact && hasBadge && "justify-between",
                    active && "bg-slate-700 font-medium text-white"
                  )}
                >
                  {!compact && hasBadge ? (
                    <span className="flex items-center gap-3 overflow-hidden">
                      <Icon className="size-[18px] flex-shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </span>
                  ) : compact && hasBadge ? (
                    // quick 260928-ilo: the dot is anchored to a wrapper
                    // around the ICON (not the corner of the whole <Link>,
                    // where `overflow-hidden rounded-md` used to clip most
                    // of the old circular indicator — that's why it "kept
                    // disappearing"). bg-primary matches the expanded
                    // badge's color so it reads as the same signal; the
                    // ring uses the sidebar's own background color so the
                    // dot keeps contrast even over the active item's
                    // bg-slate-700. No number here by the project owner's
                    // decision (quick 260928-ilo) — the full count still
                    // lives in the expanded badge below and in this item's
                    // compact-mode Tooltip text.
                    <span className="relative inline-flex flex-shrink-0">
                      <Icon className="size-[18px] flex-shrink-0" />
                      <span
                        aria-hidden="true"
                        data-slot="agenda-pendente-dot"
                        className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-slate-900"
                      />
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
                <div className="truncate text-xs text-slate-400">
                  {roleLabel}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <LogoutButton
          variant="ghost"
          className={cn(
            "w-full text-slate-100 hover:bg-slate-800 hover:text-white",
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
