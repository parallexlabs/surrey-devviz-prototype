# Surrey Development Visualization (prototype)

A public-data prototype that maps development applications in three City of Surrey pilot areas: **City Centre**, **Fleetwood Town Centre**, and **Campbell Heights**.

Built by [ParalleX Labs Inc.](https://parallexlabs.ca/) This prototype is **not affiliated with or endorsed by the City of Surrey** and is not a regulatory record.

**Live demo:** https://parallexlabs.ca/demos/surrey/

![Overview of the three pilot areas](docs/01-overview.jpg)

## Features

- **2D and 3D map** — pan, zoom, and tilt; switch to a pitched 3D view in City Centre.
- **Building massing from stated storeys** — when an application description states a storey count, height is estimated as storeys × 3.2 m and labelled in the project panel. When no height or storey count is stated, an illustrative height based on building type is used and labelled as such. See *Data and methodology* in the app and `src/heights.js`.
- **Project list and filters** — browse and filter applications without relying on the map; keyboard-accessible list with status and pilot-area filters.
- **Transit and amenity context** — SkyTrain lines and stations, Frequent Transit Development Areas, civic amenities, and optional City Centre Plan overlay.
- **Guided tour** — step-through introduction to the map, overlays, and project panel.
- **Shareable links** — URL hash encodes map position, zoom, pitch, and selected project.
- **Accessibility** — skip link, visible focus, keyboard navigation, ARIA labels, and axe-tested states (see `npm run test:axe` locally).
- **Phone layout** — single-column layout with scrollable content, 16 px body text, and touch targets sized for mobile use.

![Project detail panel](docs/03-project-panel.jpg)

![Phone layout](docs/07-mobile.jpg)

## Data sources and licences

All geographic data ships in `public/data/`. City of Surrey layers come from the City's ArcGIS open-data services. SkyTrain and amenity features come from OpenStreetMap via the Overpass API.

See [DATA_LICENSE.md](DATA_LICENSE.md) for required attribution, source URLs, and basemap credits. A machine-readable source list is in `public/data/SOURCES.json`.

To refresh data from the public APIs (requires Python 3 and `shapely`):

```bash
pip install shapely
npm run fetch-data
```

## Run locally

Requirements: Node.js 20 and npm.

```bash
npm ci
npm run dev
```

Open http://localhost:5173/

## Test

Unit tests (Vitest):

```bash
npm test
```

End-to-end tests (Playwright; needs a GPU-backed Chromium browser — not run in CI):

```bash
npx playwright install chromium
npm run test:e2e
```

Accessibility scan (Playwright + axe):

```bash
npm run test:axe
```

## Build

Production build to `dist/`:

```bash
npm run build
npm run preview
```

Site build for `/demos/surrey/` deployment (writes `dist-site/`):

```bash
npm run build:site
```

## Open by design

- **Public inputs only** — no API keys, no proprietary datasets, and no backend beyond static files and public tile endpoints.
- **Documented method** — showcase inclusion rules, height estimation, and limitations are stated in the in-app *Data and methodology* panel (`src/methodology.js`).
- **Reproducible data** — `scripts/fetch_data.py` downloads the same public sources recorded in `SOURCES.json`.
- **No tracking** — the page does not use analytics, cookies, or third-party scripts beyond map tiles.
- **Open source** — application code is licensed under [Apache-2.0](LICENSE). Data files remain under their respective open licences (see [DATA_LICENSE.md](DATA_LICENSE.md)).

## Licence

Copyright 2026 ParalleX Labs Inc. Code is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
