---
sketch: 002
name: stat-numbers
question: "How should Dashboard KPI numbers (Ganhos/Perdidos/Taxa de conversão) look without the traffic-light colored-box treatment?"
winner: "C"
tags: [dashboard, typography, color]
---

# Sketch 002: Stat Numbers

## Design Question
Our current Dashboard KPI tiles (Ganhos = green box, Perdidos = red box, Taxa
de conversão = neutral box) are the exact "infantil" pattern the owner flagged
in the reference screenshot. What's a calmer alternative that keeps the same
at-a-glance meaning (good/bad/neutral) without the full-color background?

## How to View
open .planning/sketches/002-stat-numbers/index.html

A reference block at the bottom of every tab shows today's actual style for
side-by-side comparison.

## Variants
- **A: Ponto colorido** — number stays one neutral color always; a small
  colored dot next to the label carries the meaning.
- **B: Só o texto colorido** — plain white/neutral card, only the number
  itself is tinted green/red/neutral (no background fill at all).
- **C: Barra lateral de destaque** — neutral card and neutral number, with a
  thin colored accent bar on the card's left edge only.

## What to Look For
- Does the meaning (Ganhos = good, Perdidos = bad) still read at a glance
  without the full color fill?
- Which feels most "sober/corporate" vs. which still feels playful?
- Any of these should be easy to build with the existing
  `components/dashboard/GanhosPerdidosCards.tsx` — none require new colors
  outside the already-approved palette (`--color-success`/`--color-danger`
  already exist as CSS variables in the project).
