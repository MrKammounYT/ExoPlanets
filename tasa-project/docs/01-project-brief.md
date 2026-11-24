# 01. Project brief

## Product
**TASA** is a website where you can check whether an object is an exoplanet or not.

## The single job of the page
A visitor types a name, runs the check, and gets one of three answers with the evidence behind it:
- **Confirmed exoplanet**
- **Not an exoplanet** (a solar-system world, a dwarf planet, or a star)
- **Not in the catalog** (the tool cannot confirm or rule it out)

## Audience (assumed, confirm with the owner)
Curious general visitors, students and space enthusiasts. They know a few planet names and want a quick, trustworthy answer, not a database.

## Look and feel
- Reference: `reference/inspiration-nova-dashboard.png`. A dark, cinematic "mission control" landing page: huge wide-type headline, a lit planet filling the right side, thin orbit lines, glass cards along the bottom, a small stat rail on the right edge.
- Take the mood and structure. Do not take the NOVA name, its mission copy, or its spaceship.
- One accent: sage green. Everything else is near-black, white and cool gray.

## Decisions made so far
- Brand name: TASA.
- Headline: "Name it. Check it. Know it." (last line in the accent color).
- The hero holds the working checker (input, "Run check" button, quick-pick chips).
- A floating "Target" chip over the planet shows the current object, its distance and its verdict.
- Below the hero, four result cards: Verdict, Facts, Signal, Checks.
- Then three sections: What counts as an exoplanet, Demo catalog, closing call to action.
- The planet in the hero should become a **high-resolution 3D model with scroll animation** (see `04-3d-scroll-plan.md`).
- Demo data only for now (14 objects). A live data source comes later.

## Constraints
- The current design is a Design Component canvas, which cannot run a WebGL scene. The 3D version must be a standalone web page or project.
- Planet art so far is procedurally rendered, not a photo. The exoplanet is fictional imagery, so this is fine.

## Open questions for the owner
1. What does TASA stand for, if anything? Is there a logo? (A placeholder mark exists: a small orbit glyph.)
2. Which language(s) should the site be in? Everything is English now.
3. Where will it be hosted, and is there a domain?
4. Should the checker use live NASA data (needs a small backend or serverless function) or stay a curated demo?
5. Should "candidate" planets (signal seen, not yet confirmed) be a fourth verdict?
6. Does the owner want accounts, saved searches or sharing? None are built.

## Owner answers (2026-11-24)
- Live data: demo catalog now, live NASA data later (Phase 5). Stack: Vite + vanilla JS.
- Hosting: not decided. Keep the build static so any host works.
- Candidate verdict: not yet. Keep three verdicts and revisit with live data.
- Language: English and French. The TASA expansion and a logo are still open; keep the placeholder orbit glyph.
- Still open: accounts, saved searches or sharing (question 6).
