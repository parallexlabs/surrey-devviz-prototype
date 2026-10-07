# Verification

Checked 6 October 2026. The unit, Python and end-to-end tests, the axe scan, the Content Security Policy check and the dependency audit below were run on the published source at commit `0d25e01`. That commit keeps project titles whole and describes application status as the City publishes it; the commit before it, `aa507ff`, fixed the City application-record links and keeps the area card in step with the area filter. The load profile was measured on commit `9157223`; later commits do not change what loads.

**Live URL:** https://parallexlabs.ca/demos/surrey/

The live URL was rebuilt from this source and redeployed on 6 October 2026.

## Tests

| Check | Result |
| --- | --- |
| Unit tests (`vitest`) | 134 passed |
| Python data tests | 20 passed |
| End-to-end tests (Playwright) | 48 passed. Another local server held the default port 4173, so the suite ran on port 4199; `noscript.spec.js` names port 4173 directly, so it was run again on a copy pointed at port 4199 and passed. |
| axe | 0 violations across overview, list, panel, tour, methodology, and phone. 8 incomplete checks (2, 2, 2, 0, 0, 2). Report: `evidence/axe-report.json` |
| `npm run build:site` | Succeeded |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Content Security Policy | 0 violations on the built site with a project panel open, the area filter used, the showcase started and the methodology drawer open |

The site build wrote `dist-site/index.html` (14,730 bytes, gzip 3,757), `assets/index-DeCPLrM3.js` (1,105,698 bytes, gzip 302,961), `assets/index-DmTqAM18.css` (97,870 bytes, gzip 13,694), and `assets/maplibre-gl-worker-D4J6YbLY.js` (508,956 bytes, gzip 147,318).

## Project titles and status wording

Project titles are written from each application's own description. They now end only at a real sentence boundary, never inside a number such as 5.5 FAR or 5 695.33 sq. m, and list titles are shortened at a word boundary. Tests use nine real City descriptions that had produced cut titles. The page subtitle reads: "Selected development applications alongside civic investments, transit and places to visit in three Surrey pilot areas. Status is shown as the City publishes it; conditional approval is not a building permit." The first at-a-glance line reads "Selected applications, all areas: 49".

## City application-record links

The City's open data stores each record link with a space between its `year` and `seq` values, which the City portal answers with an error page. The panel now rebuilds these links with `year` and `seq` as separate query values. A unit test checks all 119 stored links: each rebuilt link carries the `year` and `seq` of its own project number. Six rebuilt links were opened in a browser on 6 October 2026, and each City page showed its own application number: 21-0313, 19-0234, 23-0013, 20-0076, 23-0232 and 22-0175. The other 113 links were checked by the unit test only, not opened.

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

Recorded on commit `9157223`, before the link fix: the City source link shown in `07-mobile.png` used the earlier link form. The evidence files are kept with the project records rather than in this repository; the README screenshots in `docs/` are taken from the same recording. Desktop frames are 1600×1000. The phone frame is the full page, 390×8062. Walkthrough: `evidence/walkthrough.mp4`, 27.36 seconds, 3,702,041 bytes.

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
- 113 of the 119 rebuilt City record links were checked by structure and project number, not opened.
