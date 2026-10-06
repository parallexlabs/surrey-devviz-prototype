# Surrey Development Visualization: Prototype Status

**Built:** 2026-10-06 (local only, not deployed)  
**Prototype by:** ParalleX Labs Inc. for City of Surrey RFP 1220-030-2026-063

## Pass 6: first impression and the /demos/surrey/ build

The overview no longer paints the amenity layer. Those green dots appear from zoom 13 upward. Below that, showcase projects are circle markers coloured by area, and the three pilot areas are dark blue outlines with one label each: City Centre, Fleetwood Town Centre, and Campbell Heights. The labels are points at the centre of each area, so a name is not repeated across tiles, and they drop off once the map is zoomed in.

`npm run build` reads Vite `base` from `VITE_BASE` (default `/`) and writes `dist/`. `npm run build:site` writes `dist-site/` with base `/demos/surrey/` and adds `<meta name="robots" content="noindex">`. The root build does not have that tag. Data loads and `#view=` / `#project=` links stay on the sub-path. Nothing has been pushed or deployed.

### What the evidence PNGs show

Opened after the recorder passed. Desktop frames are 1600×1000. The phone frame is 390×844. The walkthrough is about 30 seconds and 2.8 MB.

- `01-overview.png`: Surrey from the Fraser in the north to White Rock in the south. Three dark blue boxes are labelled once each: City Centre (north, dense blue markers), Fleetwood Town Centre (small box, two green markers), and Campbell Heights (large southern box, two orange markers). Readable names include Guildford, Newton, Cloverdale, White Rock, Annacis Island, Barnston Island, and Highways 1, 10, 15, 17, 91, and 99. The amenity carpet is gone. The Start here bar and the footer "Public data retrieved 6 October 2026" are on screen.
- `02-city-centre-3d.png`: blue massing around the SkyTrain line, with a few green amenity dots. Readable names include King George Boulevard, University Drive, Old Yale Road, 102 Avenue, 104 Avenue, 132 Street, Surrey Central, and Holland Park. The pilot name is not repeated over the towers.
- `03-project-panel.png`: application 21-0313-00. A yellow tower stands on the map. The panel reads "Estimated from 67 storeys stated in the application", status "Conditional Approval", "Source: City of Surrey Development Applications", and "Nearest SkyTrain: Surrey Central" at 187 m, with the 400 m and 800 m walk note. Readable names include King George Boulevard and 102 Avenue.
- `04-transit-overlay.png`: the same City Centre massing with SkyTrain, FTDA, City Centre Plan, and amenities checked. Green amenity dots sit with the blue blocks. Readable names include King George Boulevard, University Drive, Old Yale Road, 102 Avenue, 104 Avenue, Surrey Central, and Holland Park.
- `05-fleetwood.png`: the Fleetwood outline as a dark blue quadrilateral over the grid, with green massing inside and green amenity dots around it. Readable names include Fraser Highway, 80 Avenue, 82 Avenue, 84 Avenue, 88 Avenue, 152 Street, 156 Street, and 160 Street.
- `06-campbell-heights.png`: one "Campbell Heights" label inside a dark blue outline. Two orange markers sit near 192 Street and Highway 99. Readable names include Highway 10, Highway 99, 32 Avenue, 40 Avenue, Colebrook Road, the Nicomekl, Sullivan, Morgan Creek, and South Surrey.
- `07-mobile.png`: 390 px width. Start here wraps to two columns (Explore projects, Transit and amenities, 3D City Centre, Guided tour, Dismiss). A project panel is open over the map and shows Conditional Approval and "Source: City of Surrey Development Applications". Readable names include King George Boulevard and 112 Avenue.

## Pass 5: evaluator path

Pass 4 checks still run after the camera is idle. This pass adds a first-load path and makes the panel say what is measured and what is drawn.

- A Start here bar offers Explore projects, Transit and amenities, 3D City Centre, and Guided tour. It is keyboard operable and can be dismissed.
- Project titles use the application's own words, preferring the clause after "to permit the development of" or "to permit". The application number stays as secondary text.
- Height in the panel reads "Estimated from N storeys stated in the application" or "Illustrative height (no height in public data)". The massing legend is unchanged.
- Status shows the City's own status text with "Source: City of Surrey Development Applications".
- The legend and the panel say: "400 m (about a 5-minute walk) and 800 m (about a 10-minute walk), straight-line, not a walking route."
- Data and methodology opens a drawer with sources, licences, the retrieval date, showcase rules, the height method, and limitations.
- The footer says "Public data retrieved 6 October 2026".
- With All applications on, phase buttons filter by the City's status text.
- The address hash restores a project (`#project=` and the application number) or a view preset (`#view=`).
- On a 390 px screen the Start here actions wrap to two columns and the controls are at least 44 px.

### What the evidence PNGs show

Opened after the recorder passed:

- `01-overview.png`: all of Surrey, with the Fraser along the north edge. The Start here bar is across the top. Readable labels include Whalley, Guildford, Newton, Cloverdale, South Surrey, White Rock, Fraser Heights, Annacis Island, Barnston Island, and Highways 1, 10, 15, 17, 91, and 99. Green project dots run from the river south to the border. The footer reads "Public data retrieved 6 October 2026".
- `02-city-centre-3d.png`: blue massing around Surrey Central. Readable names include King George Boulevard, University Drive, Old Yale Road, 102 Avenue, 104 Avenue, 132 Street, and Holland Park.
- `03-project-panel.png`: application 21-0313-00, the tallest approved project by stated storeys (67). The panel shows "Estimated from 67 storeys stated in the application", status "Conditional Approval", "Source: City of Surrey Development Applications", and "Nearest SkyTrain: Surrey Central" at 187 m, with the 400 m and 800 m walk note. A yellow tower stands on the map inside an orange ring. Readable names include King George Boulevard, 102 Avenue, and 137A Street.
- `04-transit-overlay.png`: City Centre with SkyTrain, FTDA, and amenities on. Readable names include King George Boulevard, University Drive, Old Yale Road, 102 Avenue, Surrey Central, and Holland Park.
- `05-fleetwood.png`: Fleetwood grid with green massing. Readable names include Fraser Highway, 82 Avenue, 84 Avenue, 88 Avenue, 152 Street, 156 Street, and 160 Street.
- `06-campbell-heights.png`: south Surrey around the Nicomekl, with green massing. Readable names include Highway 10, Highway 15, 16 Avenue, 32 Avenue, 40 Avenue, Colebrook Road, King George Boulevard, Cloverdale, Sullivan, and Elgin.
- `07-mobile.png`: 390 px width. Start here wraps to two columns (Explore projects, Transit and amenities, 3D City Centre, Guided tour, Dismiss). A project panel for 19 townhouse units sits over the map. Readable names include King George Boulevard and 112 Avenue.

## Pass 4: visible frame, not the camera center

### Root cause

The camera was not still flying. After `moveend` and `idle`, `getCenter()` was already the City Centre preset (`-122.8479, 49.188`, zoom 15.5, pitch 30), and the saved PNG still showed the Fraser at Surrey Public Wharf and 116 Avenue.

`#app` used `min-height: 100vh`, so the grid row grew with the project list. The document was 5756px tall and the map pane was 5686px tall. The window showed only the top of that pane. With pitch, that top slice is the northern horizon. `getCenter()` is the center of the whole pane, which sat below the fold, inside the loose Surrey box, so the location tests passed. Surrey Central projected to about y=2738 on that pane, outside the visible window. The project panel is anchored to the bottom of the pane, so it was also below the fold: `03-project-panel.png` showed Coquitlam with no panel and no rings.

### Fixes

- Lock the app to the viewport (`height: 100dvh`, `minmax(0, 1fr)`) so the map pane matches the window and the list scrolls inside the sidebar.
- Tests and the recorder set an instant-camera flag. Presets and project selection then use `jumpTo`. Assertions and PNGs wait for `moveend`, then for `idle`.
- Replace the loose Surrey box with checks after idle: Surrey Central on screen and at least 10 rendered massing features for City Centre; at least one rendered massing feature and a center inside the pilot bbox for Fleetwood and Campbell Heights; the Surrey extent on screen for the overview, with no more than a fifth of the frame north of the Fraser.
- The recorder deletes a PNG before the shot and writes it only after the checks pass.
- Overview uses `cameraForBounds` on the Surrey extent. Campbell Heights uses zoom 12.4 and pitch 25 so its massing stays in frame on both the test viewport and the 1600×1000 evidence viewport.

### What the evidence PNGs show

Opened after the recorder passed:

- `01-overview.png`: all of Surrey, with the Fraser as a northern edge rather than the subject. Readable labels include Whalley, Guildford, Fleetwood, Newton, Cloverdale, South Surrey, White Rock, Fraser Heights, Port Kells, Bridgeview, and Highways 1, 10, 15, 17, 91, and 99. Green project dots run from the river south to the border.
- `02-city-centre-3d.png`: blue massing around Surrey Central station. Readable names include King George Boulevard, University Drive, Old Yale Road, City Parkway, 100 Avenue, 102 Avenue, 104 Avenue, 108 Avenue, 132 Street, and 133 Street.
- `03-project-panel.png`: City Centre project panel, wider than 250px, text "Nearest SkyTrain: Scott Road" and a 612 m straight-line distance, with orange and red rings on the map. Readable names include King George Boulevard, 108 Avenue through 115 Avenue, 110 Avenue, 111 Avenue, 128 Street, and 132 Street. A yellow parcel marks the selected project.
- `04-transit-overlay.png`: the same City Centre massing with FTDA and amenities checked. Readable names include King George Boulevard, University Drive, Old Yale Road, 102 Avenue, 104 Avenue, and Surrey Central station.
- `05-fleetwood.png`: Fleetwood grid with green massing dots. Readable names include Fraser Highway, 80 Avenue, 82 Avenue, 84 Avenue, 88 Avenue, 152 Street, 156 Street, 158 Street, and 160 Street.
- `06-campbell-heights.png`: south Surrey around the Nicomekl, with green massing dots. Readable names include 16 Avenue, 24 Avenue, 32 Avenue, 40 Avenue, Highway 10, Highway 15, Colebrook Road, 168 Street, 176 Street, 184 Street, 192 Street, and King George Boulevard.
- `07-mobile.png`: 390×844 layout, project panel open over a yellow parcel. Readable names include 111 Avenue, 114 Avenue, and 128 Street.

## Pass 3: map location fix

### Root cause

Pass 2 introduced three problems that made evidence screenshots look like Coquitlam, Deep Cove, or Port Coquitlam even though `map.getCenter()` stayed inside Surrey:

1. **Recording order.** The walkthrough recorder ran the guided tour first, then captured `01-overview` without clicking the Surrey overview preset. The map was left pitched over City Centre from the tallest-project tour step.
2. **Steep pitch.** City Centre, Fleetwood, and Campbell Heights presets used 50–55° pitch. `getCenter()` remained in Surrey, but the visible horizon extended north across the Fraser into Coquitlam and Indian Arm.
3. **Proximity rings never drew.** `selectProject` only updated rings and flew the camera when `map.loaded()` was true. During movement that guard failed, so `03-project-panel` could open the HTML panel without rings or a reliable project fly-to.

Preset center recompute from `pilot_areas.json` was not wrong; it updated centers only and omitted the overview union center.

### Fixes

- Recompute all preset centers from `pilot_areas.json`, including overview from the union of pilot envelopes.
- Tune preset pitch/zoom so the framed view stays in Surrey (overview 13.5 / pitch 0; City Centre 15.5 / pitch 30; lower pitch on Fleetwood and Campbell Heights).
- Remove the `map.loaded()` guard in `selectProject`; apply rings and camera whenever the proximity source exists.
- Add shared map assertions (`tests/helpers/mapAssertions.js`) used by Playwright and the recorder: Surrey bounds, City Centre bbox, forbidden northern labels, and required Surrey/Fleetwood labels.
- Recording: capture screenshots before the tour; click the correct preset per shot; assert map location before every PNG; require project panel, SkyTrain distance, and proximity rings for `03-project-panel`.
- Expose `window.__map` and `window.__pilotAreasMeta` for automated checks.

## Pass 2 changes

1. **Licence:** City of Surrey layers now use the required Open Government License attribution with link. Disclaimer added to About panel and footer.
2. **Branding:** Header reads "Surrey Development Visualization" with subtitle "Public-data prototype by ParalleX Labs Inc."
3. **Overlay bug:** Detail panel no longer leaves a blank rectangle over the map (was caused by `hidden` attribute not hiding the panel; fixed with `display: none`).
4. **Showcase view:** Default list and map show 58 approved showcase projects (from 184 active applications). "All applications" switch reveals everything; under-review items carry an "Under review" text label.
5. **Heights:** 47 showcase projects have height estimated from stated storeys (storeys × 3.2 m); others use illustrative height by building type. Estimated and illustrative massing use distinct colours with a legend.
6. **Readable titles:** Project titles are taken from the description's first clause; application number is secondary.
7. **Guided tour:** "Start tour" with Previous, Next, Exit (keyboard operable, screen-reader announcements, instant under `prefers-reduced-motion`).
8. **At a glance:** Summary shows showcase counts per pilot area, projects within 800 m of SkyTrain, and tallest stated storeys.

## What is real

This is a working static web prototype using **real public data** from City of Surrey Open Data (ArcGIS REST) and OpenStreetMap (Overpass API). No API keys, no tracking, no cookies, no analytics.

| Dataset | Features | Source |
|---------|----------|--------|
| Development projects (active) | 184 | City of Surrey Development Applications |
| Showcase projects (default view) | 58 | Approved applications matching development criteria |
| City Centre showcase | 54 | |
| Fleetwood showcase | 2 | |
| Campbell Heights showcase | 2 | |
| Building footprints (context) | 6,877 | City of Surrey Building Footprints (City Centre only) |
| City Centre Plan areas | 573 | City of Surrey City Centre Plan |
| Fleetwood Town Centre boundary | 2 | City of Surrey Town Centre Densities |
| Frequent Transit Development Areas | 3 | City of Surrey FTDA |
| SkyTrain lines + stations | 225 | OpenStreetMap |
| Amenities (libraries, parks, recreation, civic) | 389 | OpenStreetMap |

**Project statuses in data:** Conditional Approval (111), Under Review (25), Initial Review (48).

**Pilot area definitions:**
- **City Centre:** extent derived from City Centre Plan layer (`public/data/pilot_areas.json`)
- **Fleetwood:** extent derived from Town Centre Densities, Fleetwood Town Centre
- **Campbell Heights:** OSM place boundary not found; envelope derived around Campbell Heights development cluster (documented in `pilot_areas.json`)

**3D massing:** Heights are estimated from stated storeys where present (× 3.2 m), otherwise illustrative by building type. Building footprints use `BUILDING_HEIGHT` where present.

**Basemap:** OpenFreeMap Liberty style (no key required).

## What works

- Interactive MapLibre GL JS map with 3D extruded development projects
- Showcase filter (default) and "All applications" switch
- Camera presets: Surrey overview, City Centre, Fleetwood, Campbell Heights (smooth fly-to; instant with `prefers-reduced-motion`)
- Guided tour with data-driven captions
- At a glance summary panel
- Project panel with title from the application wording, application number, the City's status, height label, and weblinks
- Proximity tool: straight-line distance to nearest SkyTrain station, with 400 m (about a 5-minute walk) and 800 m (about a 10-minute walk) rings
- Start here bar, phase filters when all applications are shown, and shareable `#project=` and `#view=` links
- Data and methodology drawer, and "Public data retrieved 6 October 2026" in the footer
- Overlay toggles: SkyTrain, FTDA, City Centre Plan, amenities, existing buildings
- Massing legend (estimated vs illustrative)
- Searchable, filterable project list (keyboard operable)
- Responsive layout (bottom sheet on mobile)
- About panel with licence attribution from `public/data/SOURCES.json`
- WCAG 2.1 AA: skip link, focus styles, ARIA labels, contrast, `lang="en"`, reduced motion support

## Test results

| Test | Result | Path |
|------|--------|------|
| Unit tests (`npm test`) | 44/44 passed | `tests/unit/` |
| E2E tests (`npm run test:e2e`) | 19/19 passed against `http://localhost:4173/demos/surrey/` | `tests/e2e/app.spec.js` |
| axe-core scan | 0 violations | `evidence/axe-report.json` |
| Root build | Success, no robots meta | `dist/` |
| Site build | Success, base `/demos/surrey/`, `noindex` | `dist-site/` |
| Recording assertions | All seven screenshots + walkthrough | `npm run record` |

E2E waits for `moveend` and `idle`, then checks the visible map: Surrey Central on screen with at least 10 rendered massing features, Fleetwood and Campbell Heights massing with the center inside each pilot bbox, and the overview framing Surrey without the north side of the Fraser filling the frame. At the overview, rendered amenity features stay under 30 and the three pilot labels are City Centre, Fleetwood Town Centre, and Campbell Heights. The project panel must be on screen, at least 250px wide, and show "Nearest SkyTrain" with proximity rings rendered. Hash restore keeps `#view=fleetwood` and `#project=21-0313-00` on `/demos/surrey/`. The site page has `<meta name="robots" content="noindex">`. Other checks cover the Start here bar, the rings sentence, and 44 px targets on a 390 px screen.

## Evidence

| Asset | Path |
|-------|------|
| Walkthrough video (~30 s, 2.8 MB) | `evidence/walkthrough.mp4` |
| Screenshot 1: Overview | `evidence/01-overview.png` |
| Screenshot 2: City Centre 3D | `evidence/02-city-centre-3d.png` |
| Screenshot 3: Project panel + proximity | `evidence/03-project-panel.png` |
| Screenshot 4: Transit overlay | `evidence/04-transit-overlay.png` |
| Screenshot 5: Fleetwood | `evidence/05-fleetwood.png` |
| Screenshot 6: Campbell Heights | `evidence/06-campbell-heights.png` |
| Screenshot 7: Mobile (390×844) | `evidence/07-mobile.png` |

Desktop screenshots are 1600×1000 PNG. The recorder deletes each PNG first and writes it only after the settled-view checks pass.

## How to run

```bash
# Install dependencies
npm install

# Fetch / refresh public data (~3 min)
npm run fetch-data

# Development server
npm run dev

# Production build (base /, or set VITE_BASE)
npm run build
npm run serve:dist   # http://localhost:4173

# Publish build for https://parallexlabs.ca/demos/surrey/
npm run build:site   # dist-site/, robots noindex
npm run serve:site   # http://localhost:4173/demos/surrey/

# Tests (e2e and axe expect build:site first)
npm test             # unit tests
npm run test:e2e     # Playwright against /demos/surrey/
npm run test:axe     # accessibility scan

# Record walkthrough + screenshots
npm run record
```

## Known gaps

1. **Campbell Heights boundary** is a derived envelope, not an official City boundary polygon. OSM had no matching place relation.
2. **11 showcase projects** lack stated storeys in their descriptions and use illustrative height only.
3. **SkyTrain coverage** is from OSM: Expo Line stations in Surrey (Gateway, Surrey Central, King George, Scott Road) plus line segments in the region bbox. Surrey Langley Extension may be incomplete in OSM.
4. **184 applications** in data exceeds the RFP's 35 to 50 target; the default showcase view shows 58 approved development projects, with all applications available via the switch.
5. **Building context** is City Centre only (6,877 footprints) for performance; Fleetwood and Campbell Heights show projects without existing-building context.
6. **No routing:** proximity is straight-line distance only, as specified.
7. **No per-building interactive 3D** for individual buildings: project polygons are extruded; selected buildings from footprints are context layer only.

## Licences

Recorded in `public/data/SOURCES.json`:
- City of Surrey Open Data: Contains information licensed under the Open Government License – City of Surrey.
- © OpenStreetMap contributors (ODbL)
