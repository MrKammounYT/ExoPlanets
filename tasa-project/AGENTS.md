# Instructions for AI agents

Start with `README.md` in this folder. It links to every spec.

Quick rules:
- Work from `docs/05-roadmap-tasks.md`; tick tasks off as you finish them.
- Design tokens live in `docs/02-design-spec.md`. Do not change them without the owner's approval.
- Facts about planets live in `data/catalog.json`. Never fabricate values.
- Keep generated images in `assets/` and the script that makes them in `tools/`.
- 3D assets live in `assets/3d/`. `tasa-scene.glb` is exported from `tasa-planet.blend`. Change the Blender file and re-export. Do not hand-edit the GLB.
- The atmosphere glow is not in the GLB. Build it in Three.js (see `docs/04-3d-scroll-plan.md`).
- If a requirement is unclear, check `docs/01-project-brief.md` (open questions) and ask the owner instead of guessing.
