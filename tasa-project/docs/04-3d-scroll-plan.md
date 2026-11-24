# 04. 3D planet and scroll animation plan

Goal: replace the flat hero planet image with a **high-resolution 3D planet** that reacts to scrolling.

## Important constraint
`design/Main.dc.html` is a Design Component canvas. It cannot run a live WebGL scene. Build the 3D version as a **standalone web page or project** (suggested stack below) that reproduces the same design and keeps the checker working. Keep `design/` as the visual reference.

## Suggested stack
- Vite + vanilla JavaScript (or Next.js if the owner wants routing or a backend later).
- **Three.js** for the planet, **GSAP + ScrollTrigger** for scroll choreography, optional **Lenis** for smooth scroll.
- Plain CSS for the glass UI (copy the tokens from `02-design-spec.md`).
- Pin exact library versions. If delivering as a single hosted HTML page, load libraries from cdnjs with a pinned version.

## Textures (all equirectangular, 2:1)
| Map | Desktop | Mobile | Format | Used for |
|---|---|---|---|---|
| Color (albedo) | 4096x2048 | 2048x1024 | JPEG or WebP | Surface color |
| Normal or height | 4096x2048 | 2048x1024 | PNG/WebP | Relief under the light |
| Roughness | 2048x1024 | 1024x512 | JPEG (grayscale) | Glossy oceans, matte land |
| Clouds | 4096x2048 | 2048x1024 | JPEG (grayscale) used as alpha | Separate cloud sphere |
| Night lights (optional) | 2048x1024 | 1024x512 | JPEG | Emissive map on the dark side |

Stop at 4K. 8K maps are heavy and rarely visible. Keep the color map under about 2 to 3 MB.

### Source of truth: the Blender scene
The 3D planet is now built in Blender (`assets/3d/tasa-planet.blend`, Blender 5.3, EEVEE, 85 mm camera at 6.5 units). It holds `TASA_Planet`, `TASA_Clouds`, `TASA_Atmosphere`, `TASA_Moon`, `TASA_Moon_Small`, `TASA_Sun` and `TASA_Camera`, with a procedural material and a `_Web` material (image textures) for the planet and clouds.

`assets/3d/tasa-scene.glb` (about 4 MB) is the web export: planet, clouds and both moons, Y-up, planet radius = 1.
- Planet: 4K color (JPEG), 4K normal (JPEG), 2K roughness (green channel).
- Clouds: separate sphere at radius 1.012 with the 2K cloud map and alpha.
- Moons: plain gray spheres (procedural materials do not export). Bake a texture in Blender if craters are wanted.
- Not exported: the atmosphere (Blender shader), the sun and the camera. Their values are in `assets/3d/scene-params.json`: light toward the sun `(-0.622, 0.501, 0.602)`, atmosphere radius 1.07, clouds radius 1.012, camera distance 6.5.

Known issues to fix before launch:
- The normal map is stored as JPEG, which adds artifacts to the relief. The lossless PNG is 9.5 MB, too heavy for the page budget. Convert to WebP or KTX2.
- Load 1K textures first, then swap to the 2K or 4K ones.

Re-export: select the four meshes, swap the planet and clouds to their `_Web` materials, give the moons plain materials, export glTF binary with Y-up, then restore the materials.

### Generating textures with Python (fallback)
`tools/render_assets.py` still builds a lit planet from **3D value noise** sampled on a sphere (`fbm` function). Because it uses 3D noise, sampling it over longitude and latitude gives **seamless** textures.
To extend it:
1. Add a function that loops over an equirectangular grid (lon -pi..pi, lat -pi/2..pi/2), converts to a unit-sphere point, and samples the same `fbm` for elevation, moisture, ice and clouds.
2. Reuse the same color logic (ocean deep `0.025, 0.065, 0.11` to shallow `0.07, 0.17, 0.22`; land green `0.12, 0.22, 0.12` to rocky `0.30, 0.30, 0.22`; ice near poles).
3. Output the color map **without lighting** (Three.js does the lighting).
4. Derive the normal map from the elevation with a Sobel filter, and the roughness map from the land/ocean mask.
5. Write the clouds as a separate grayscale map.
Alternatives: Blender, a texture-generation tool, or real Earth maps (NASA Visible Earth, Solar System Scope) as a base. Check licenses.

## Scene structure
- **Renderer**: WebGL, `antialias: true`, transparent background so the CSS starfield and glow show through. Cap `devicePixelRatio` at 2. Use sRGB output and ACES filmic tone mapping.
- **Planet**: `SphereGeometry(1, 128, 128)`, `MeshStandardMaterial` with color, normal and roughness maps.
- **Clouds**: a second sphere at radius 1.01 with the cloud map as `alphaMap`, `transparent: true`, `depthWrite: false`. Rotates slightly faster than the planet.
- **Atmosphere**: a third sphere at radius about 1.08 with a custom Fresnel shader (additive blending, back-face), pale blue `#6fa3f5`, brightest on the lit side.
- **Light**: one directional light from the upper left (about `(-0.62, 0.50, 0.60)`) plus a very dim ambient. Same direction as the 2D render so the design matches.
- **Moons**: one or two small spheres on circular orbits, driven by time (not scroll).
- **Starfield**: either the tiled `assets/tasa-stars.png` as a CSS background, or a `Points` cloud behind the planet.
- **Camera**: perspective, fov about 35, planet placed on the right of the viewport to match the hero.

## Scroll choreography
Tie planet and camera state to scroll progress with ScrollTrigger (one timeline, `scrub: true`).

| Section | Planet state | Notes |
|---|---|---|
| Hero | Right side, scale 1, slow idle spin (about 1 revolution per 90 s), clouds drifting | Orbit ellipses and Target chip stay in the DOM above the canvas |
| Hero to result cards | Drifts down and left, scale about 0.8, spin speeds up slightly | Cards rise with a small parallax offset |
| What counts as an exoplanet | Camera pushes in toward the surface, planet moves to the left, relief visible at low sun angle | Criteria cards fade in on the right |
| Demo catalog | Planet shrinks to a small, dim presence at the side | Keep it out of the way of the grid |
| Closing call to action | Camera pulls back, full planet with the moon returning | Matches the closing panel's moon image |
Optional: when the checker returns a verdict, tint the atmosphere (sage for confirmed, amber for not an exoplanet) with a short tween.

Sketch:
```js
gsap.registerPlugin(ScrollTrigger);
const tl = gsap.timeline({
  scrollTrigger: { trigger: '#page', start: 'top top', end: 'bottom bottom', scrub: 1 }
});
tl.to(planet.rotation, { y: '+=3.2', ease: 'none' }, 0)
  .to(planet.position, { x: -1.4, y: -0.4 }, 0.15)
  .to(camera.position, { z: 2.2 }, 0.3);
```
(Values are starting points. Tune by eye.)

## Performance budget
- First render under 2.5 s on a mid-range laptop; total initial transfer under about 6 MB.
- Load a 1K texture first, then swap to 2K or 4K once idle (progressive load).
- Serve mobile textures to small screens and low-memory devices.
- Pause the render loop when the canvas is off-screen (`IntersectionObserver`) or the tab is hidden.
- Reuse geometries and materials. Dispose them on teardown.

## Fallbacks
- No WebGL or `prefers-reduced-motion: reduce`: show `assets/tasa-planet.png` as a static image, no scroll-driven motion.
- Texture load failure: same static image.
- Keep all content readable with the canvas absent.

## Acceptance criteria
- Planet looks sharp at 1440p on a 2x display, with visible relief and a clean terminator.
- Scrolling moves the planet smoothly with no jank (steady 60 fps on a mid-range laptop).
- The checker, cards and all text remain above the canvas and fully usable.
- Text contrast stays at 4.5:1 or better wherever it overlaps the planet.
- Works at 400px width with the lighter textures and reduced motion.
