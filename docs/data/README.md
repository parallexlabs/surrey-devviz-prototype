# Data files

## OpenStreetMap

These files are extracted from OpenStreetMap:

- `skytrain.geojson`: SkyTrain lines and stations used by the map
- `amenities.geojson`: civic facilities, libraries, recreation, and parks

Only the fields the map uses are kept; contact details are removed.

Attribution: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

Coordinates in `civic_places.json` are also derived from OpenStreetMap, as recorded in that file's `coordinates_source` field, and carry the same attribution and ODbL notice.

Licence: [Open Database Licence 1.0 (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).

## City of Surrey

The City plan, development application, building footprint and FTDA files contain City of Surrey open data. `pilot_areas.json` is derived from the City plan layers. Civic descriptions in `civic_places.json` are prototype summaries with source links, not an ArcGIS dataset. The City's own wording is:

> Contains information licensed under the Open Government License – City of Surrey.

https://opendata-surrey.hub.arcgis.com/pages/55089a19491a4fe59a41e059fd8af708

## Field notes for development_projects.geojson

City fields, copied unchanged from the Development Applications layer: `OBJECTID`, `PROJECT_NO`, `DESCRIPTION`, `STATUS`, `WEBLINK`, `APPLICATION_DOCUMENTS_WEBLINK`.

Fields added by `scripts/fetch_data.py`:

- `pilot_area`: `city_centre`, `fleetwood`, or `campbell_heights`. Set when the representative point of the application polygon falls inside the matching plan geometry in `pilot_areas.json`.
- `assign_lon`, `assign_lat`: that representative point, rounded to six decimals (WGS 84). Used for the nearest-station distance and the map marker.

Heights are not stored in this file. The app computes `height_m`, `height_source`, `storeys`, and `height_label` at load time from `DESCRIPTION` (see `src/heights.js`). Any copy of this file that still carries `height_m` or `height_source` came from an older pipeline and those values should be ignored.

`pilot_areas.json` holds, per area, the union geometry used for assignment, a simplified `outline` for drawing, a `bbox`, and a `label` point; all are derived from the City plan layers listed in `SOURCES.json`.
