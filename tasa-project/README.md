# TASA: exoplanet checker website

Read this file first. It tells you what the project is, where everything is, and what to do next.

## What this is
TASA is a website where a visitor types the name of an object (a planet or a star) and learns whether it is a confirmed exoplanet. The landing page has a dark space look with a large planet in the hero, glass cards, and one sage-green accent.

The brand name is **TASA**. The owner has not said what it stands for. Do not invent an expansion.

## Status (2026-11-24)
- Done: a hi-fi landing page design with a working demo checker (14 objects). Source is in `design/`.
- Done: procedurally rendered planet, moon and starfield images in `assets/` (2D fallback art).
- Done: a Blender scene of the 3D planet (planet, clouds, atmosphere, two moons, sun, camera) with 4K textures, exported as `assets/3d/tasa-scene.glb`. Source: `assets/3d/tasa-planet.blend`.
- Done: Phase 1 data check (13 of 14 objects verified; Sirius still needs a source) and owner answers (see the brief).
- Done: standalone site scaffold in `site/` (Vite + vanilla JS) with the ported layout and checker.
- Done: 3D planet (`site/src/planet3d.js`) and scroll choreography (`site/src/scroll.js`).
- Next: French version, accessibility pass, fps check on real hardware, texture compression, then live data. See `docs/05-roadmap-tasks.md`.


## Folder map
| Path | What it holds |
|---|---|
| `docs/01-project-brief.md` | Goal, audience, decisions made, open questions |
| `docs/02-design-spec.md` | Colors, fonts, components, layout, copy, accessibility |
| `docs/03-checker-logic-and-data.md` | How a verdict is decided, data schema, live-data plan |
| `docs/04-3d-scroll-plan.md` | 3D planet, textures, Three.js scene, scroll choreography, performance |
| `docs/05-roadmap-tasks.md` | Ordered task list with acceptance criteria |
| `data/catalog.json` | The 14-object demo catalog the checker uses |
| `design/Main.dc.html` | Current landing page source (Design Component format) |
| `design/canvas.json` | Canvas index for that page |
| `assets/` | `tasa-planet.png` (hero planet, transparent), `tasa-moon.png`, `tasa-stars.png` (tileable) |
| `assets/3d/` | `tasa-scene.glb` (planet, clouds, moons), `scene-params.json` (light, moons, radii, camera), `tasa-planet.blend` (source), `textures/` |
| `site/` | Standalone website (Vite, needs Node 20 or newer). In `site/`: `npm install`, then `npm run dev` and open http://localhost:5173/. Also `npm test`, `npm run build` |
| `tools/render_assets.py` | Python (numpy + Pillow) renderer for the three images above. Run `python tools/render_assets.py assets` |
| `reference/inspiration-nova-dashboard.png` | The layout and mood the owner wants to match |

## Ground rules
1. Match the reference mood and the tokens in `docs/02-design-spec.md`. Do not copy the reference's "NOVA" branding or text.
2. Never invent astronomy facts. Every number shown must come from `data/catalog.json` or a real source. Mark demo data as demo.
3. Keep one accent color (sage). Amber is only for "not an exoplanet", never decoration.
4. Keep it accessible: real buttons and links, visible focus, 4.5:1 text contrast, reduced-motion fallback.
5. No emoji as icons. No lorem ipsum. Write specific copy.
6. Keep the tone short and direct. The headline is "Name it. Check it. Know it."

## How to start
Open `docs/05-roadmap-tasks.md` and take the first unchecked task. Re-read `docs/04-3d-scroll-plan.md` before touching the planet.
