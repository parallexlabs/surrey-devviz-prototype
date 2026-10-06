# Surrey Development Visualization — Prototype Status

**Built:** 2026-10-06 (local only, not deployed)  
**Prototype by:** ParalleX Labs Inc. for City of Surrey RFP 1220-030-2026-063

## What is real

This is a working static web prototype using **real public data** from City of Surrey Open Data (ArcGIS REST) and OpenStreetMap (Overpass API). No API keys, no tracking, no cookies, no analytics.

| Dataset | Features | Source |
|---------|----------|--------|
| Development projects (active) | 184 | City of Surrey Development Applications |
| — City Centre | 117 | |
| — Fleetwood Town Centre | 7 | |
| — Campbell Heights | 60 | |
| Building footprints (context) | 6,877 | City of Surrey Building Footprints (City Centre only) |
| City Centre Plan areas | 573 | City of Surrey City Centre Plan |
| Fleetwood Town Centre boundary | 2 | City of Surrey Town Centre Densities |
| Frequent Transit Development Areas | 3 | City of Surrey FTDA |
| SkyTrain lines + stations | 225 | OpenStreetMap |
| Amenities (libraries, parks, recreation, civic) | 389 | OpenStreetMap |

**Project statuses included:** Conditional Approval (111), Under Review (25), Initial Review (48). Filtered per RFP intent (approved or active applications).

**Pilot area definitions:**
- **City Centre:** extent derived from City Centre Plan layer (`public/data/pilot_areas.json`)
- **Fleetwood:** extent derived from Town Centre Densities — Fleetwood Town Centre
- **Campbell Heights:** OSM place boundary not found; envelope derived around Campbell Heights / South Campbell Heights development cluster (documented in `pilot_areas.json`)

**3D massing:** Development Applications have no height or storey field. All project extrusions use a labelled illustrative height of 21 m (~6 storeys). Building footprints use `BUILDING_HEIGHT` where present.

**Basemap:** OpenFreeMap Liberty style (no key required).

## What works

- Interactive MapLibre GL JS map with 3D extruded development projects
- Camera presets: Surrey overview, City Centre, Fleetwood, Campbell Heights (smooth fly-to; instant with `prefers-reduced-motion`)
- Project panel with application number, description, status, weblinks
- Proximity tool: straight-line distance to nearest SkyTrain station + 400 m / 800 m rings
- Overlay toggles: SkyTrain, FTDA, City Centre Plan, amenities, existing buildings
- Searchable, filterable project list (keyboard operable)
- Responsive layout (bottom sheet on mobile)
- About panel with licence attribution from `public/data/SOURCES.json`
- WCAG 2.1 AA: skip link, focus styles, ARIA labels, contrast, `lang="en"`, reduced motion support

## Test results

| Test | Result | Path |
|------|--------|------|
| Unit tests (`npm test`) | 13/13 passed | `tests/unit/` |
| E2E tests (`npm run test:e2e`) | 5/5 passed | `tests/e2e/app.spec.js` |
| axe-core scan | 0 serious/critical violations | `evidence/axe-report.json` |
| Production build | Success | `dist/` |

## Evidence

| Asset | Path |
|-------|------|
| Walkthrough video (74 s, 7 MB) | `evidence/walkthrough.mp4` |
| Screenshot 1 — Overview | `evidence/01-overview.png` |
| Screenshot 2 — City Centre 3D | `evidence/02-city-centre-3d.png` |
| Screenshot 3 — Project panel + proximity | `evidence/03-project-panel.png` |
| Screenshot 4 — Transit overlay | `evidence/04-transit-overlay.png` |
| Screenshot 5 — Fleetwood | `evidence/05-fleetwood.png` |
| Screenshot 6 — Campbell Heights | `evidence/06-campbell-heights.png` |

All screenshots are 1600×1000 PNG.

## How to run

```bash
# Install dependencies
npm install

# Fetch / refresh public data (~3 min)
npm run fetch-data

# Development server
npm run dev

# Production build
npm run build
npm run serve:dist   # http://localhost:4173

# Tests
npm test             # unit tests
npm run test:e2e     # Playwright against dist
npm run test:axe     # accessibility scan

# Record walkthrough + screenshots
npm run record
```

## Known gaps

1. **Campbell Heights boundary** is a derived envelope, not an official City boundary polygon. OSM had no matching place relation.
2. **Project massing heights** are illustrative (21 m uniform) — source data has no height field.
3. **SkyTrain coverage** is from OSM: Expo Line stations in Surrey (Gateway, Surrey Central, King George, Scott Road) plus line segments in the region bbox. Surrey–Langley Extension may be incomplete in OSM.
4. **184 projects** exceeds the RFP's 35–50 target because all active-status applications in pilot envelopes are shown truthfully; no arbitrary culling.
5. **Building context** is City Centre only (6,877 footprints) for performance; Fleetwood and Campbell Heights show projects without existing-building context.
6. **No routing** — proximity is straight-line distance only, as specified.
7. **No per-building interactive 3D** for individual buildings — project polygons are extruded; selected buildings from footprints are context layer only.
8. **Video length** is ~74 s (within 60–90 s target).

## Licences

Recorded in `public/data/SOURCES.json`:
- City of Surrey Open Data — Open Government Licence – British Columbia
- © OpenStreetMap contributors (ODbL)
