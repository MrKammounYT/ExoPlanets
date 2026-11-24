# 03. Checker logic and data

## The question the checker answers
"Is this object a confirmed exoplanet?"

## The three tests
Every object is run through the same four checks (the first three are the scientific tests, the fourth is the archive record):

| # | Check label | Meaning |
|---|---|---|
| 1 | Orbits a star other than the Sun | Exoplanets circle other stars. Solar-system worlds fail; stars fail ("It is the star itself"). |
| 2 | Under the 13 Jupiter-mass limit | Heavier objects can fuse deuterium and count as brown dwarfs. |
| 3 | Signal from a detection method | Found by transit, radial velocity, microlensing, direct imaging or astrometry. |
| 4 | Confirmed in the archive | Listed as confirmed (for example in the NASA Exoplanet Archive). |

Verdict rule: all four pass = **Confirmed exoplanet**. Any fail for a known object = **Not an exoplanet**. Name not found = **Not in the demo catalog** (all checks show "Not checked").

A candidate (signal seen, not yet confirmed) is not in the demo. If added, it needs its own fourth verdict and color (see open questions in `01-project-brief.md`).

## Matching a typed name
1. Normalize: lowercase, then strip everything that is not a letter or digit. "Kepler-186 f", "kepler186f" and "KEPLER 186F" all become `kepler186f`.
2. Compare to each object's normalized `name` and each normalized entry in `aliases`. Match on exact equality only (so "Proxima Centauri" the star and "Proxima Centauri b" the planet stay separate).
3. Empty input = prompt the user to type a name. No match = not-found state, and echo what they typed.

## Data schema (`data/catalog.json`)
```json
{
  "id": "kepler-186-f",
  "name": "Kepler-186 f",
  "aliases": [],
  "kind": "exo | solar | star",
  "verdict": "Confirmed exoplanet | Not an exoplanet",
  "host": "Kepler-186",
  "discovered": "2014",
  "distance": "492 ly",
  "size": "1.17 x Earth radius",
  "orbit_period": "130 days",
  "method": "transit | rv | lensing | none",
  "method_label": "Transit",
  "line": "One-sentence explanation shown in the Verdict card",
  "checks": [{ "test": "...", "result": "pass | fail", "detail": "..." }],
  "source": "Where the figures come from (null if not yet verified)",
  "source_note": "Optional. Why an object is not yet verified",
  "retrieved": "YYYY-MM-DD the source was checked (null if not verified)"
}
```
Display strings use "x" for multiplication in this file; the design shows the "×" character.

## Demo catalog (14 objects)
- Note: the archive lists HD 209458 b's discovery method as radial velocity, so its signal graph is the RV shape.
- Confirmed exoplanets (8): Kepler-186 f, Proxima Centauri b, TRAPPIST-1 e, 51 Pegasi b, HD 209458 b, Kepler-452 b, TOI-700 d, OGLE-2005-BLG-390L b.
- Solar-system worlds (4): Mars, Jupiter, Earth, Pluto (dwarf planet).
- Stars (2): Sirius, Proxima Centauri.

The figures are rounded. Verified on 2026-11-24 except Sirius (see `source_note`). Re-check before launch. Do not add objects without a source.

## Signal graph shapes
Drawn in an SVG with a 260x120 viewBox.
- `transit`: flat baseline with two short box-shaped dips.
- `rv`: sine wave, about two cycles.
- `lensing`: Gaussian bump centered at x=110 with a small narrow bump at x=172.
- `none`: flat line (also used for the not-found state).
These are illustrative shapes, not real light curves. Label them as such if the page ever implies real data.

## Live data plan (not built)
Goal: the checker searches every known planet instead of 14.

Primary source: the **NASA Exoplanet Archive**, which exposes a TAP (SQL-like) web service. The composite planet table is `pscomppars`. Useful columns (verify names against the current documentation before use): `pl_name`, `hostname`, `disc_year`, `discoverymethod`, `sy_dist` (parsecs; multiply by 3.26 for light years), `pl_rade` (Earth radii), `pl_bmasse` (Earth masses), `pl_orbper` (days).

Plan:
1. Add a small server or serverless function that queries the archive and returns the same JSON shape as `catalog.json`. Do not call the archive straight from the browser until you have confirmed CORS behavior.
2. Cache results (names change rarely). Add a nightly or weekly refresh.
3. Type-ahead: search by `pl_name` prefix and by host star name.
4. Non-exoplanets: keep a small curated list for solar-system worlds and famous stars, or resolve stars through a star-name service (for example SIMBAD) and mark them "star".
5. Candidates: NASA also publishes TESS Objects of Interest and Kepler candidate tables. Decide with the owner whether to show a "Candidate" verdict.
6. Always show the source and the retrieval date on the page.

Never present a name as "not an exoplanet" just because it is missing from the archive. Use the not-found state for that.
