# Verification

Checked 6 October 2026 on the pass 10e working tree. Parent commit: `6aff88b4fe300ce3a8bb752bb5fcf2f8e8fd06c1`.

**Live URL:** https://parallexlabs.ca/demos/surrey/

This pass was not deployed. The live URL was not rebuilt from this tree.

## Tests

| Check | Result |
| --- | --- |
| Unit tests (`vitest`) | 79 passed |
| Python data tests | 20 passed |
| End-to-end tests (Playwright) | 46 passed |
| axe | 0 violations across overview, list, panel, tour, methodology, and phone. 8 incomplete checks (2, 2, 2, 0, 0, 2). Report: `evidence/axe-report.json`, scanned 2026-10-06T21:38:44.262Z |
| `npm run build:site` | Succeeded |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Content Security Policy | 0 violations on the built site while the map, tiles, fonts, sprites, worker, showcase, and methodology drawer were open |

The site build wrote `dist-site/index.html` (14,116 bytes, gzip 3,565), `assets/index-CCVYQALG.js` (1,104,041 bytes, gzip 303,528), `assets/index-DmTqAM18.css` (97,870 bytes, gzip 13,648), and `assets/maplibre-gl-worker-D4J6YbLY.js` (508,956 bytes, gzip 147,981).

## Load profile

`node scripts/measure-load.mjs` on the built site, Fast 4G (165 ms latency, 1,012,500 bytes/s).

| | Before deferring footprints | After |
| --- | --- | --- |
| First contentful paint | 568 ms | 548 ms |
| First meaningful paint | 2,666 ms | 2,578 ms |
| Transfer at meaningful paint | 1,803,261 bytes | 1,797,846 bytes |
| Transfer after idle | 7,774,830 bytes | 3,386,220 bytes |
| Requests | 19 | 18 |

Before, the largest response was `building_footprints.geojson` at 4,383,195 bytes. That file was not requested in the after run. The largest response then was the built script, 1,104,341 bytes.

## Data retrieval

Dates are the `retrieved_at` values in `public/data/SOURCES.json`. `civic_places.json` records `retrieved` as 2026-10-06. Those dates were not edited.

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

Recorded after the checks above. Desktop frames are 1600×1000. The phone frame is the full page, 390×8062. Walkthrough: `evidence/walkthrough.mp4`, 27.36 seconds, 3,702,041 bytes.

- `evidence/01-overview.png`
- `evidence/02-city-centre-3d.png`
- `evidence/03-project-panel.png`
- `evidence/04-transit-overlay.png`
- `evidence/05-fleetwood.png`
- `evidence/06-campbell-heights.png`
- `evidence/07-mobile.png`

`01-overview.png` shows the three pilot outlines, civic diamonds on, `Tallest: 67 storeys` with `21-0313-00` on the same line, and the map credit `MapLibre | OpenFreeMap © OpenMapTiles © OpenStreetMap contributors`. `03-project-panel.png` shows application 21-0313-00, the 214.4 m estimate from 67 storeys, and Surrey Central at about 180 m. `07-mobile.png` shows the 19-0234-00 card, the 137.6 m estimate from 43 storeys, Surrey Central at about 380 m, and the City source link.

## Not done

- No formal acceptance testing.
- No manual screen-reader audit. The axe result is the automated check only.
- Not deployed and not pushed.
