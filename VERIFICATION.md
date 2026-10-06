# Verification

Checked 6 October 2026 on the pass 10d working tree. Parent commit: `03330567cc76bde06476655c013b846b03eb7320`.

**Live URL:** https://parallexlabs.ca/demos/surrey/

This pass was not deployed. The live URL was not rebuilt from this tree.

## Tests

| Check | Result |
| --- | --- |
| Unit tests (`vitest`) | 74 passed |
| Python data tests | 17 passed |
| End-to-end tests (Playwright) | 42 passed |
| axe | 0 violations across overview, list, panel, tour, methodology, and phone. 8 incomplete checks (2, 2, 2, 0, 0, 2). Report: `evidence/axe-report.json`, scanned 2026-10-06T21:18:20.392Z |
| `npm run build:site` | Succeeded |
| `npm audit --omit=dev` | 0 vulnerabilities |

The site build wrote `dist-site/index.html` (13,789 bytes, gzip 3,425), `assets/index-DvfpRx1A.js` (1,103,296 bytes, gzip 303,310), `assets/index-DJjr6JYy.css` (97,842 bytes, gzip 13,629), and `assets/maplibre-gl-worker-D4J6YbLY.js` (508,956 bytes, gzip 147,981).

## Data retrieval

Dates are the `retrieved_at` values in `public/data/SOURCES.json`. `civic_places.json` records `retrieved` as 2026-10-06.

| File | Retrieved |
| --- | --- |
| `city_centre_plan.geojson` | 2026-10-06T11:52:05.332187+00:00 |
| `fleetwood_town_centre.geojson` | 2026-10-06T11:52:05.685752+00:00 |
| `campbell_heights_lap.geojson` | 2026-10-06T11:52:06.087827+00:00 |
| `south_campbell_heights_lap.geojson` | 2026-10-06T11:52:06.564359+00:00 |
| `development_projects.geojson` | 2026-10-06T11:52:07.660949+00:00 |
| `building_footprints.geojson` | 2026-10-06T11:52:13.061043+00:00 |
| `ftda.geojson` | 2026-10-06T11:52:13.302439+00:00 |
| `skytrain.geojson` | 2026-10-06T05:58:23.972485+00:00 |
| `amenities.geojson` | 2026-10-06T11:55:45.366059+00:00 |

## Evidence

Recorded after the checks above. Desktop frames are 1600×1000. The phone frame is the full page. Walkthrough: `evidence/walkthrough.mp4`, 27 seconds, 3,766,426 bytes.

- `evidence/01-overview.png`
- `evidence/02-city-centre-3d.png`
- `evidence/03-project-panel.png`
- `evidence/04-transit-overlay.png`
- `evidence/05-fleetwood.png`
- `evidence/06-campbell-heights.png`
- `evidence/07-mobile.png`

`01-overview.png` shows the three pilot outlines, civic diamonds on, and `Tallest: 67 storeys` with `21-0313-00` on the same line. `03-project-panel.png` shows application 21-0313-00, the 214.4 m estimate from 67 storeys, and Surrey Central at about 180 m. `07-mobile.png` shows the 19-0234-00 card and the City source link.

## Not done

- No formal acceptance testing.
- No manual screen-reader audit. The axe result is the automated check only.
- Not deployed and not pushed.
