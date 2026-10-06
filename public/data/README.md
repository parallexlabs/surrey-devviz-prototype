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
