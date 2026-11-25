# 02. Design spec

The working implementation is `design/Main.dc.html`. Values below are the tokens it uses. Keep them.

## Colors
| Token | Hex | Use |
|---|---|---|
| Page ground | `#05070b` | Outside the frame |
| Frame ground | `#080b11` | Inside the rounded frame, over the starfield |
| Text | `#eef1f5` | Headings, primary text |
| Soft text | `#aab3bf` | Body copy |
| Muted | `#99a3b1` | Labels, captions (do not go darker: contrast) |
| Faint | `#8d97a5` | Fine print |
| Accent (sage) | `#b9dba9` | Confirmed state, last headline line, focus ring, links |
| Warning (amber) | `#e8b97a` | "Not an exoplanet" state only |
| Glass fill | `linear-gradient(160deg, rgba(255,255,255,.075), rgba(255,255,255,.02))` | Cards, chips, nav |
| Glass border | `rgba(255,255,255,.10)` | 1px, all glass surfaces |
| Primary button | bg `#f1f4f7`, text `#0a0e13` | Hover bg `#ffffff` |

Semantic colors (sage pass, amber fail, gray pending) always come with an icon and a text label. Never rely on color alone.

Atmospheric background: two soft radial glows (teal top right, green left) plus the tiled starfield image.

## Typography
- Display: **Instrument Serif**, regular, normal case. Used for the headline and section titles; the accented (sage) part of a title is italic.
- Body and UI: **IBM Plex Sans**, weights 400 to 700.
- Labels, numbers and the logo wordmark: **IBM Plex Mono**, weights 400 and 500. Small labels are uppercase with light tracking.
- All load from Google Fonts. Fallbacks: Georgia (display), system sans (body), system monospace (mono).
- Changed 2026-11-25 at the owner's request (replaces Lexend Zetta + Manrope).

| Role | Size | Notes |
|---|---|---|
| H1 | `clamp(30px, 4.4vw, 58px)`, line-height 1.1 | Three lines, last in sage |
| H2 | `clamp(24px, 3vw, 38px)`, line-height 1.15 | `text-wrap: balance` |
| Lead paragraph | 17px / 1.6 | Soft text |
| Body | 15 to 16px / 1.6 | |
| Card title | 19 to 20px, 700 | |
| Label | 11px, 600, uppercase, letter-spacing .14em | Muted |

Use `font-variant-numeric: tabular-nums` for distances and facts.

## Shape and spacing
- Outer frame: radius 36px, 1px border `rgba(255,255,255,.12)`, max width 1392px, side padding `clamp(20px, 4vw, 56px)`.
- Cards: radius 28px, padding 22px (28px for the criteria cards), min-height 310px for result cards.
- Buttons: radius 16px, min-height 48px. Chips: pill, min-height 36px. Nav: pill.
- Gaps: 16px in grids, 24px between hero columns, 112px between major sections.
- Touch targets at least 44px (chips are 36px and sit in a spaced row; keep spacing generous).

## Layout map (top to bottom)
1. **Header**: logo (orbit glyph + "TASA" wordmark, wide letter-spacing), glass pill nav (Checker, What counts, Catalog), ghost button "Check an object".
2. **Hero** (three columns that wrap):
   - Left: status badge ("Demo catalog · 14 objects"), H1, lead, checker form, quick-pick chips, demo-data note.
   - Middle: planet image with thin orbit ellipses, two moons, and the floating **Target** chip (name, distance, verdict).
   - Right: glass stat rail (6,000+ confirmed worlds known, 13 MJ mass ceiling, 14 objects in this demo). Becomes a horizontal row under 1100px.
3. **Result cards** (auto-fit grid, 4 cards): Verdict, Facts, Signal, Checks.
4. **What counts as an exoplanet**: three criteria cards, then the five detection methods in a row.
5. **Demo catalog**: grid of 14 buttons (name, status dot, distance). Selecting one runs the check and scrolls to the top.
6. **Closing call to action**: large glass panel, "Name a world. Get a verdict.", button back to the checker, moon image.
7. **Footer**: wordmark and the demo-data note.

## Components
- **Glass surface**: the fill and border above plus `backdrop-filter: blur(18px)`.
- **Search field**: glass, 48px tall, search icon, transparent input. Focus ring (2px sage, 3px offset) is drawn on the wrapper via `:focus-within`.
- **Verdict pill** (Target chip): dot + uppercase label in the state color.
- **Check row**: 26px circle with a 14px icon (check = pass, cross = fail, dash = not checked) + label + detail line. A visually hidden word ("Passed", "Failed", "Not checked") precedes the label for screen readers.
- **Signal graph**: 260x120 SVG, faint dashed grid, 2.2px line in the state color. Three shapes: transit (flat line with two box dips), radial velocity (sine wave), microlensing (bump with a small second bump). No signal = flat line.
- **Orbit diagram**: a squashed circle orbit with a dot that rotates slowly (16s). Hidden for stars. Disabled under `prefers-reduced-motion`.

## Copy rules
- Short, direct, active. Write from the visitor's side.
- No filler, no hype, no em-dash asides, no "not X, but Y" constructions.
- Verdict wording: "Confirmed exoplanet", "Not an exoplanet", "Not in the demo catalog". Keep these exact.
- Always say the data is demo data until live data is connected.

## Accessibility checklist
- Real `<button>`, `<a>`, `<input>` with a `<label>` (the label is visually hidden).
- The Target chip is `role="status"` with `aria-live="polite"`, so a new verdict is announced.
- SVG graphs have `role="img"` and an `aria-label`; decorative SVG is `aria-hidden`.
- Visible focus (`2px #b9dba9`) on every interactive element.
- Body text 4.5:1 or better against the glass over the dark ground.
- Respect `prefers-reduced-motion` (spinning orbit dot, smooth scroll, and all future 3D motion).
- No horizontal page scroll at 400px width.

## Responsive behavior
- Hero columns wrap with `flex-wrap`; planet column keeps a min-height of 540px.
- Result cards and catalog use `repeat(auto-fit, minmax(min(250px, 100%), 1fr))`.
- Stat rail turns into a row under 1100px.
- Headline scales with `clamp()`.

## Assets
- `assets/tasa-planet.png`: 1000x1000 transparent PNG, planet radius 380px, lit from upper left, blue atmosphere halo.
- `assets/tasa-moon.png`: 320x320 transparent PNG.
- `assets/tasa-stars.png`: 1600x1200 transparent, tileable (repeat).
- Regenerate or change them with `tools/render_assets.py` (see `04-3d-scroll-plan.md`).

## Do not
- Add a second accent color, a purple/blue gradient, or emoji icons.
- Center everything. The layout is asymmetric on purpose.
- Add stats or numbers that are not backed by data.
- Copy NOVA's text, logo or spaceship from the reference.
