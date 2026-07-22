# Sketch Manifest

## Design Direction

Move CRM Raiar's app shell from a top nav bar to a persistent dark left sidebar,
and tone down the Dashboard's KPI number treatment — currently colorful
traffic-light-style stat boxes that the project owner found "childish"
(infantil). Stay within the already-approved shadcn "nova" design system (blue
`--primary`, 8pt spacing, base-ui components) — this is a layout/tone change,
not a new color system or rebrand.

## Reference Points

- A screenshot of an unrelated internal Raiar Orgânicos tool (ISO 27001/
  compliance dashboard): dark fixed left sidebar with grouped nav sections,
  user info pinned at the bottom, main content as a grid of equal-size white
  cards with small stat counters. Liked the structure; disliked the oversized
  colorful number badges inside each card.
- raiarorganicos.com.br (the company's real public storefront): teal/navy/
  yellow brand identity, script "raiar" logo, playful illustration style.
  Owner explicitly decided NOT to import these brand colors into the CRM —
  keep the current approved blue primary, borrow only the general "more
  polished/corporate" feel.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | sidebar-nav | Does a dark left sidebar (vs. our current top nav) fit the app, adapted to our real Vendedor/Supervisor nav items? | B (compact/collapsible) | layout, navigation |
| 002 | stat-numbers | How should Dashboard KPI numbers (Ganhos/Perdidos/Taxa de conversão) look without the traffic-light colored-box treatment? | C (left accent bar) | dashboard, typography, color |
