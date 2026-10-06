# Data licences

This file describes the licences for data files shipped in `public/data/` and for the map basemap tiles loaded at runtime.

## City of Surrey open data

The following files contain information licensed under the **Open Government License – City of Surrey**:

> Contains information licensed under the Open Government License – City of Surrey. (https://opendata-surrey.hub.arcgis.com/pages/55089a19491a4fe59a41e059fd8af708)

| File | Source |
|------|--------|
| `city_centre_plan.geojson` | [City Centre Plan](https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/City%20Centre%20Plan/FeatureServer/0) |
| `fleetwood_town_centre.geojson` | [Town Centre Densities (Fleetwood)](https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Town%20Centre%20Densities/FeatureServer/0) |
| `campbell_heights_lap.geojson` | [Campbell Heights Local Area Plan](https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Campbell%20Heights%20Local%20Area%20Plan/FeatureServer/0) |
| `south_campbell_heights_lap.geojson` | [South Campbell Heights Local Area Plan](https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/South%20Campbell%20Heights%20Local%20Area%20Plan/FeatureServer/0) |
| `development_projects.geojson` | [Development Applications](https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Development%20Applications/FeatureServer/0) |
| `building_footprints.geojson` | [Building Footprints](https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Building%20Footprnts/FeatureServer/0) |
| `ftda.geojson` | [Frequent Transit Development Areas](https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Frequent%20Transit%20Development%20Areas/FeatureServer/0) |

`pilot_areas.json` is derived from the plan polygons above and carries the same licence.

Retrieval dates and feature counts are recorded in `public/data/SOURCES.json`.

## OpenStreetMap

The following files were retrieved from the [Overpass API](https://overpass-api.de/api/interpreter) and are licensed under the [Open Database Licence (ODbL)](https://opendatacommons.org/licenses/odbl/):

| File | Layer |
|------|-------|
| `skytrain.geojson` | SkyTrain lines and stations in Surrey |
| `amenities.geojson` | Civic facilities, libraries, recreation, and parks in Surrey |
| Coordinates in `civic_places.json` | Curated place locations from OpenStreetMap, as recorded in `coordinates_source` |

The civic descriptions are prototype summaries with a source link on each record. The coordinate attribution does not imply that OpenStreetMap supplies or verifies those descriptions.

Attribution: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

The same file names, attribution, and licence link ship beside the data in [public/data/README.md](public/data/README.md).

## Map basemap

The interactive map loads vector tiles and a style from [OpenFreeMap](https://openfreemap.org/) (`https://tiles.openfreemap.org/styles/liberty`). That style uses [OpenMapTiles](https://openmaptiles.org/) data derived from OpenStreetMap.

When the map is displayed, the attribution control lists **MapLibre**, **OpenFreeMap**, **OpenMapTiles**, and **OpenStreetMap**. Reproduce that attribution if you embed or redistribute map views built from this prototype.

OpenMapTiles asks that the credit link to https://openmaptiles.org/ and that static images carry the same credit in nearby text. The in-map credit links to OpenMapTiles and to the OpenStreetMap copyright page.

## Screenshots and preview image

`docs/01-overview.jpg`, `docs/03-project-panel.jpg` and `docs/07-mobile.jpg` (and `public/og.png` where it shows the map) are rendered from this map. They contain basemap tiles (© OpenMapTiles, © OpenStreetMap contributors, served by OpenFreeMap) and City of Surrey open data layers. Keep this notice, or an equivalent caption, next to any copy of them.
