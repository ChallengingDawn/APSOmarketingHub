# APSOMAINAPPDESIGN.md — Align Marketing Hub to the APSO Pricing Hub design system

> **Goal:** Make the APSO Marketing Hub look and feel **identical** to the
> **APSO Pricing Hub** so every sister app reads as one product family.
> The Pricing Hub is the canonical "new APSO design" — **square, industrial,
> premium**. This file is the single source of truth for the migration.
>
> **Reference implementation (copy from here):**
> `APSOPricingHub/packages/frontend/src/app/theme.ts` and `globals.css`.
>
> **Files we change in this app:**
> `src/app/theme.ts` · `src/app/globals.css` · `src/app/tailwind.config.ts` ·
> a few component sx values. **No business logic changes — purely visual.**

---

## 0. The one-sentence summary

We are replacing the current *Google-inspired, rounded, pill-button, pastel*
look with the Pricing Hub's *square-cornered (2px radius), hairline-bordered,
brand-only-palette, whisper-soft-shadow* look — plus its animation/utility
library (hover-lift, top accent bar, animated "APSO" wordmark, shimmer).

---

## 1. Before → After at a glance

| Token / decision        | Marketing Hub TODAY (Google-flat) | Pricing Hub TARGET (new APSO)            |
| ----------------------- | --------------------------------- | ---------------------------------------- |
| Design philosophy       | "Google-inspired flat"            | "Square, industrial, premium"            |
| `shape.borderRadius`    | **12**                            | **2** (master square lever)              |
| Button shape            | pill `borderRadius: 999`          | square `borderRadius: 2`, pad `8px 18px` |
| Card radius             | 16                                | 3 (= 6px) + hairline border              |
| Card hover              | faint grey shadow                 | two-layer navy-tinted `SHADOW_SOFT`      |
| Background default      | `#f8f9fa`                         | `#f5f6f8`                                |
| Paper                   | `#ffffff`                         | `#ffffff` (same)                         |
| Text primary            | `#1f1f1f`                         | `#1a1d21`                                |
| Text secondary          | `#5f6368`                         | `#5b6470`                                |
| Divider / border        | `#ececec`                         | `#e6e8ec`                                |
| Success                 | `#34a853` (Google green)          | `#1e7e45` (brand-aligned, AA contrast)   |
| Warning                 | `#fbbc04` (Google yellow)         | `#c77700`                                |
| Info                    | `#4285f4` (Google blue)           | `#2563a8`                                |
| Error                   | `#ea4335`                         | `#c5221f`                                |
| Body/button font-weight | 500                               | **600**                                  |
| h4/h5 letter-spacing    | `-0.025em`                        | `-0.03em` (tighter)                      |
| Inputs                  | radius 8                          | radius 2, focus border 1.5px navy        |

**Unchanged (already correct, keep):**
- Brand primary navy `#274e64`, brand secondary red `#ed1b2f`.
- Fonts: **Inter** (body), **Outfit** (headings), Bricolage Grotesque available.
- Custom scrollbar, base animations (`fadeInUp`, `fadeIn`, etc.).

---

## 2. `src/app/theme.ts` — drop-in replacement

Replace the entire current theme with the Pricing Hub theme. Copy
`APSOPricingHub/packages/frontend/src/app/theme.ts` verbatim. The decisive
parts that MUST land:

```ts
// Two-layer, navy-tinted elevation — the "Apple-level" depth cue.
const SHADOW_SOFT  = "0 1px 2px rgba(26,58,76,0.04), 0 2px 8px rgba(26,58,76,0.05)";
const SHADOW_HOVER = "0 2px 4px rgba(26,58,76,0.06), 0 8px 24px rgba(26,58,76,0.08)";
const BORDER = "#e6e8ec";

palette: {
  primary:   { main: "#274e64", light: "#35637d", dark: "#1a3a4c" },
  secondary: { main: "#ed1b2f", light: "#f04555", dark: "#c41527" },
  success:   { main: "#1e7e45", light: "#34a06a", dark: "#155d33" },
  warning:   { main: "#c77700", light: "#e08c1a", dark: "#9a5d00" },
  info:      { main: "#2563a8", light: "#3b7dc4", dark: "#1b4a80" },
  error:     { main: "#c5221f", light: "#d83a36", dark: "#9e1b18" },
  background:{ default: "#f5f6f8", paper: "#ffffff" },
  text:      { primary: "#1a1d21", secondary: "#5b6470" },
  divider:   BORDER,
},
shape: { borderRadius: 2 },   // ← the master square lever
```

Component overrides to carry across (full list in the Pricing Hub file):
`MuiButton` (square, weight 600, `8px 18px`, sizeSmall `5px 12px`),
`MuiCard` (radius 3, hairline border, `SHADOW_SOFT` on hover),
`MuiPaper` (elevation1/2 = `SHADOW_SOFT`, elevation3 = `SHADOW_HOVER`),
`MuiChip` (radius 2, weight 600), `MuiDrawer`, `MuiTableCell`
(uppercase 0.7rem heads), `MuiLinearProgress` (radius 2, h 6),
`MuiAlert`, `MuiOutlinedInput` (radius 2, focus 1.5px navy),
`MuiToggleButton`, `MuiTooltip` (dark `#1a1d21`, radius 2), `MuiTab`.

> ⚠️ **Watch-out:** because `shape.borderRadius` goes from 12 → 2, every place
> in the app that writes `sx={{ borderRadius: 2 }}` will go from 24px to 4px.
> That is intended (square look). If a specific element must stay rounded, set
> an explicit pixel value like `borderRadius: "8px"`, not a multiplier.

---

## 3. `src/app/globals.css` — add the Pricing Hub utility layer

Keep the existing `@import` (fonts are the same) and the base/scrollbar/
animation blocks. **Append** the Pricing Hub additions so components can use
the same class names:

- `.hover-lift` — `translateY(-2px)` + `SHADOW_HOVER` on hover.
- `.accent-top` + `.accent-top::before` — 3px red→navy gradient bar that
  slides in on the top edge of hero cards.
- `.shimmer` — skeleton-loading gradient sweep.
- `.gradient-text-apso` — red→navy clipped text for hero numbers/titles.
- `.brand-display`, `.brand-apso .letter-*` — the animated **APSO** wordmark
  (letters cycle navy↔red, the "O" does a 3D `rotateY`). Use in the sidebar
  header / login screen so branding matches the Pricing Hub exactly.
- `.stagger-children` / `.stagger-slow` — staggered fade-in for card grids.
- `.sidebar-dots` (radial dot pattern, 4% opacity) and optional
  `.sidebar-icon-compass` (slow-rotating background glyph) for the sidebar.
- Scrollbar thumb: switch radius from `4px` → `2px`, color `#cdd2d9` to match.

> Skip `.price-cheaper / .price-expensive / .price-neutral` — those are
> Pricing-Hub-specific comparison-cell colors with no equivalent here.

---

## 4. `tailwind.config.ts` — keep, lightly align

The Tailwind `apso.*` palette already matches the brand. Only change needed:
update `apso.border` from `#e6e8ea` → `#e6e8ec` and `apso.gray` to `#f5f6f8`
so Tailwind utility classes match the MUI background. Fonts stay Arial-free —
add `Inter` first in the `sans` stack to match (`['Inter','system-ui',...]`).

---

## 5. Component-level touch-ups (after the theme swap)

Most components inherit the new look automatically. Hand-check these:

1. **Sidebar** (`src/app/Sidebar.tsx`) — match Pricing Hub: square nav items,
   `.sidebar-dots` background, animated APSO wordmark at top, active item uses
   navy fill + `.nav-icon-active` (scale 1.05, no wobble).
2. **AppShell** (`src/app/AppShell.tsx`) — change page background
   `bgcolor: "#f0f2f5"` → `#f5f6f8` (line ~38) to match theme default.
3. **Hero / KPI cards** — add `className="accent-top hover-lift"`; wrap big
   numbers in `.gradient-text-apso`.
4. **Buttons** — remove any local `borderRadius` overrides that re-round them.
5. **Login / enroll / change-password screens** — these are full-bleed and may
   carry their own styles; align card radius (3), inputs (2), and the APSO
   wordmark so the entrance matches the Pricing Hub.
6. **Card grids** — add `.stagger-children` to the grid container for the same
   entrance choreography.

---

## 6. Acceptance checklist (done = all true)

- [ ] Buttons are square (2px), weight 600 — no pills anywhere.
- [ ] Cards have hairline `#e6e8ec` borders and lift with navy-tinted shadow on hover.
- [ ] No Google pastel green/yellow/blue remains; all accents are the brand-aligned set.
- [ ] Page background is `#f5f6f8`; text primary `#1a1d21`.
- [ ] Sidebar shows the animated **APSO** wordmark + dot pattern, identical to Pricing Hub.
- [ ] Inputs have square corners and a 1.5px navy focus border.
- [ ] Hero cards show the red→navy top accent bar.
- [ ] Side-by-side with the Pricing Hub, a stranger cannot tell they are different apps.

---

## 7. Suggested order of work (lowest risk first)

1. Swap `theme.ts` (instant 80% of the change). Build, click through every page.
2. Fix the AppShell background + any re-rounding sx overrides flagged by eye.
3. Append the `globals.css` utility layer.
4. Port the Sidebar wordmark + dot background.
5. Add `accent-top` / `hover-lift` / `gradient-text` to hero & KPI cards.
6. Run the acceptance checklist against the live Pricing Hub side by side.
