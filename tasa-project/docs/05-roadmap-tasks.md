# 05. Roadmap and tasks

Tick tasks off as you finish them. Take the first unchecked one.

## Phase 0: groundwork (done)
- [x] Landing page design with working demo checker (`design/Main.dc.html`)
- [x] Procedural planet, moon and starfield images (`assets/`, `tools/render_assets.py`)
- [x] Demo catalog of 14 objects (`data/catalog.json`)
- [x] Written specs (`docs/`)

## Phase 1: verify content
- [ ] Check every number in `data/catalog.json` against the NASA Exoplanet Archive. Fix errors. Add a `source` and `retrieved` field to each object.
  - 2026-11-24: 13 of 14 objects verified and fixed (exoplanets against `pscomppars`, solar-system worlds against the NASA Planetary Fact Sheet). Fixed: Kepler-186 f distance (579 ly), Kepler-452 b distance (1,800 ly), TOI-700 d distance and radius, TRAPPIST-1 e and HD 209458 b distance, HD 209458 b discovery method (archive lists radial velocity), 51 Peg b mass, Proxima b minimum mass, OGLE-2005-BLG-390L b discovery year (2005) and period (~9 years), Proxima Centauri radius. `design/Main.dc.html` synced.
  - Still open: Sirius has no source (not in the exoplanet archive; SIMBAD was down). Verify its distance and radius, then tick this task.
- [x] Confirm the "6,000+ confirmed worlds" stat against the archive's current count. Update or remove.
  - 2026-11-24: archive lists 6,473 confirmed planets (`select count(*) from pscomppars`). "6,000+" stays accurate.
- [x] Ask the owner the open questions in `01-project-brief.md` (name meaning, logo, language, hosting, live data). Answers are in the brief. New task from the answers: add a French version (see Phase 2).

## Phase 2: standalone site scaffold
- [x] Create the project (Vite + vanilla JS, or Next.js if the owner wants a backend).
- [x] Port the layout and tokens from `design/Main.dc.html` and `docs/02-design-spec.md` into plain HTML and CSS.
- [x] Port the checker logic from `docs/03-checker-logic-and-data.md`, reading from `data/catalog.json`.
  - 2026-11-24: built in `site/` (Vite 8.3.8, vanilla JS). `npm run dev`, `npm test` (6 checker tests), `npm run build`. Headless check at 1440px and 400px: layout matches the design, no horizontal scroll, checker, not-found state and catalog buttons work. A full accessibility pass (contrast, keyboard, screen reader) is still to do before the acceptance box is ticked.
- [ ] Add English and French (language switch, `lang` attribute, all UI strings and catalog text translated).
- [ ] Acceptance: looks and behaves like the current design at 1440px and 400px, passes the accessibility checklist.

## Phase 3: 3D planet
- [x] Equirectangular color, normal, roughness and cloud maps made in Blender (`assets/3d/`), 4K color and normal, 2K roughness and clouds.
- [x] Blender scene with planet, clouds, atmosphere, two moons, sun and camera; exported to `assets/3d/tasa-scene.glb`.
- [ ] Compress the textures for the web: normal map to WebP or KTX2 (no JPEG artifacts), plus 1K and 2K mobile versions.
- [ ] Optional: bake a surface texture for the two moons in Blender and re-export.
- [x] Build the Three.js scene (load `tasa-scene.glb`, add the atmosphere shader, light from `scene-params.json`) following `docs/04-3d-scroll-plan.md`.
- [x] Add the static-image fallback for no WebGL and reduced motion.
  - 2026-11-24: `site/src/planet3d.js` (Three.js 0.187.0, loaded on demand). Planet and clouds from the GLB, Fresnel halo (back faces, radius 1.07) and limb haze, sun direction from `scene-params.json`, ACES tone mapping, DPR capped at 2, render loop paused off-screen or in a hidden tab. Moons orbit on time (orbits pulled in to 1.32 and 1.22 planet radii so they stay in the hero column). Reduced motion, no WebGL or a failed load keeps `assets/tasa-planet.png`.
  - The Target chip got a dark base (`rgba(8,11,17,.62)` under the glass) so its text stays readable over bright clouds. Owner to confirm.
  - Still open for acceptance: measure fps on a real mid-range laptop (headless tests use software WebGL), and progressive 1K to 4K textures (the GLB is 4.4 MB, inside the 6 MB budget).
- [ ] Acceptance: sharp, seamless planet, stable 60 fps, text stays readable over it.

## Phase 4: scroll animation
- [x] Add GSAP ScrollTrigger choreography for each section (table in `04-3d-scroll-plan.md`).
  - 2026-11-24: `site/src/scroll.js` (GSAP 3.15.1). One timeline scrubbed over the page (`scrub: 1`), keyframes placed at each section's scroll position and rebuilt on resize. The 3D canvas is now a fixed full-viewport layer under the content.
  - Changes from the table, tuned by eye and for contrast: in "What counts" the planet sits on the left with a low sun from the right (so the terminator is on screen); the planet is dimmed to 22 to 25% opacity while it sits behind text; at the end it replaces the closing panel's moon image (the panel's backdrop blur is off in 3D mode so the planet stays sharp).
  - Contrast measured on background-only screenshots at 9 scroll stops (1440x900): every text box is 4.6:1 or better.
- [ ] Add optional smooth scroll and card parallax.
  - Card parallax done (result and criteria cards rise 36px, transform only). Smooth scroll (Lenis) not added: native scroll keeps keyboard and assistive-tech behavior intact. Add only if the owner asks.
- [x] Optional: tint the atmosphere when a verdict is returned. Sage for confirmed, amber for not an exoplanet, back to blue for not found. Only after a visitor runs a check, not on page load.
- [ ] Acceptance: smooth scrub in both directions, no layout shift, works with keyboard navigation.

## Phase 5: live data
- [ ] Add a small server or serverless function that queries the NASA Exoplanet Archive and returns the catalog JSON shape.
- [ ] Add caching and a scheduled refresh.
- [ ] Add type-ahead search.
- [ ] Show the data source and retrieval date on the page; keep the not-found state honest.
- [ ] Decide with the owner whether to add a "Candidate" verdict.

## Phase 6: launch
- [ ] Performance pass (Lighthouse), image and texture compression, font loading.
- [ ] Add page title, meta description, social preview image (can use `assets/tasa-planet.png`).
- [ ] Final accessibility and mobile review.
- [ ] Deploy and connect the domain.
