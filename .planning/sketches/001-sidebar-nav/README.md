---
sketch: 001
name: sidebar-nav
question: "Does a dark left sidebar (vs. our current top nav) fit the app, adapted to our real Vendedor/Supervisor nav items?"
winner: "B"
tags: [layout, navigation]
---

# Sketch 001: Sidebar Nav

## Design Question
Should CRM Raiar's app shell move from the current top nav bar to a persistent
dark left sidebar (inspired by the reference screenshot), and if so, wide-fixed
or compact-collapsible?

## How to View
open .planning/sketches/001-sidebar-nav/index.html

## Variants
- **A: Sidebar larga fixa** — always-expanded 240px sidebar, grouped sections
  ("Principal" / "Administração"), full labels, user card + Sair pinned at
  bottom. Closest to the reference screenshot's structure.
- **B: Sidebar compacta (recolhível)** — starts as a 64px icon-only rail
  (tooltips on hover), expands to the full labeled sidebar via the arrow
  toggle at the top. More screen space for content by default.

## What to Look For
- Does the dark sidebar feel right against the rest of the app's light theme?
- Vendedor vs Supervisor: today's mock shows the Supervisor's full item set
  (Clientes, Dashboard, Gerenciar equipe, Configurações) — a Vendedor would
  only see Clientes + Dashboard (no "Administração" section at all).
- Is the compact/collapsible version (B) worth the extra interaction, or is
  the always-expanded version (A) simpler and good enough for a 2-role app
  with only 4 nav items max?
