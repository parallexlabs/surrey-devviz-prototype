#!/usr/bin/env python3
"""Download public data for Surrey development visualization prototype."""

import json
import math
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

SURREY_LICENCE = (
    "City of Surrey Open Data — Open Government Licence – British Columbia "
    "(https://www2.gov.bc.ca/gov/content/data/open-data/open-government-licence-bc)"
)
OSM_LICENCE = "© OpenStreetMap contributors (ODbL)"

SOURCES = []

ARCGIS_BASE = "https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services"

LAYERS = {
    "development_applications": f"{ARCGIS_BASE}/Development%20Applications/FeatureServer/0",
    "building_footprints": f"{ARCGIS_BASE}/Building%20Footprnts/FeatureServer/0",
    "city_centre_plan": f"{ARCGIS_BASE}/City%20Centre%20Plan/FeatureServer/0",
    "town_centre_densities": f"{ARCGIS_BASE}/Town%20Centre%20Densities/FeatureServer/0",
    "ftda": f"{ARCGIS_BASE}/Frequent%20Transit%20Development%20Areas/FeatureServer/0",
}

ACTIVE_STATUSES = (
    "Conditional Approval",
    "Final Approval",
    "Under Review",
    "Initial Review",
)

ILLUSTRATIVE_HEIGHT_M = 21.0  # ~6 storeys at 3.5 m, labelled illustrative in UI


def http_get(url, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": "surrey-devviz-demo/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def bbox_from_coords(coords):
    xs, ys = [], []
    for c in coords:
        if isinstance(c[0], (int, float)):
            xs.append(c[0])
            ys.append(c[1])
        else:
            sub = bbox_from_coords(c)
            xs.extend([sub[0], sub[2]])
            ys.extend([sub[1], sub[3]])
    return min(xs), min(ys), max(xs), max(ys)


def feature_bbox(feature):
    geom = feature.get("geometry")
    if not geom:
        return None
    return bbox_from_coords(geom["coordinates"])


def merge_bboxes(boxes):
    valid = [b for b in boxes if b]
    if not valid:
        return None
    return (
        min(b[0] for b in valid),
        min(b[1] for b in valid),
        max(b[2] for b in valid),
        max(b[3] for b in valid),
    )


def expand_bbox(bbox, pad=0.005):
    return (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad)


def envelope_json(bbox):
    return json.dumps(
        {
            "xmin": bbox[0],
            "ymin": bbox[1],
            "xmax": bbox[2],
            "ymax": bbox[3],
            "spatialReference": {"wkid": 4326},
        }
    )


def fetch_arcgis_geojson(layer_url, where, out_fields, envelope=None, page_size=1000):
    features = []
    offset = 0
    while True:
        params = {
            "where": where,
            "outFields": out_fields,
            "outSR": "4326",
            "f": "geojson",
            "resultOffset": str(offset),
            "resultRecordCount": str(page_size),
        }
        if envelope:
            params["geometry"] = envelope_json(envelope)
            params["geometryType"] = "esriGeometryEnvelope"
            params["spatialRel"] = "esriSpatialRelIntersects"
            params["inSR"] = "4326"
        url = f"{layer_url}/query?" + urllib.parse.urlencode(params)
        data = http_get(url)
        batch = data.get("features", [])
        if not batch:
            break
        features.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return {"type": "FeatureCollection", "features": features}


def write_geojson(name, fc, source_url, layer, query, licence):
    path = DATA_DIR / f"{name}.geojson"
    with open(path, "w") as f:
        json.dump(fc, f)
    SOURCES.append(
        {
            "file": name + ".geojson",
            "source_url": source_url,
            "layer": layer,
            "query": query,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "feature_count": len(fc.get("features", [])),
            "licence": licence,
        }
    )
    print(f"  wrote {path.name}: {len(fc['features'])} features")
    return path


def centroid_of_feature(feature):
    bbox = feature_bbox(feature)
    if not bbox:
        return None
    return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)


def point_in_bbox(point, bbox):
    return bbox[0] <= point[0] <= bbox[2] and bbox[1] <= point[1] <= bbox[3]


def overpass_query(query):
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "surrey-devviz-demo/0.1"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def osm_to_geojson(osm_data):
    features = []
    for el in osm_data.get("elements", []):
        tags = el.get("tags", {})
        if el["type"] == "node":
            geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
        elif el["type"] == "way" and "geometry" in el:
            coords = [[n["lon"], n["lat"]] for n in el["geometry"]]
            if tags.get("area") == "yes" or tags.get("leisure") == "park":
                geom = {"type": "Polygon", "coordinates": [coords]}
            else:
                geom = {"type": "LineString", "coordinates": coords}
        elif el["type"] == "relation":
            continue
        else:
            continue
        props = dict(tags)
        props["osm_id"] = el.get("id")
        props["osm_type"] = el.get("type")
        features.append({"type": "Feature", "geometry": geom, "properties": props})
    return {"type": "FeatureCollection", "features": features}


def add_height_to_projects(fc):
    for f in fc["features"]:
        props = f["properties"]
        props["height_m"] = ILLUSTRATIVE_HEIGHT_M
        props["height_source"] = "illustrative"
        props["pilot_area"] = props.get("pilot_area", "unknown")
    return fc


def main():
    print("Fetching pilot area boundaries…")

    city_centre_fc = fetch_arcgis_geojson(
        LAYERS["city_centre_plan"],
        "1=1",
        "PLAN_AREA,PLAN_TYPE,PLAN_YEAR,PLAN_STATUS,LAND_USE",
    )
    write_geojson(
        "city_centre_plan",
        city_centre_fc,
        LAYERS["city_centre_plan"],
        "City Centre Plan",
        "where=1=1",
        SURREY_LICENCE,
    )
    city_centre_bbox = merge_bboxes([feature_bbox(f) for f in city_centre_fc["features"]])

    town_centre_fc = fetch_arcgis_geojson(
        LAYERS["town_centre_densities"],
        "AREA_NAME='Fleetwood Town Centre'",
        "LAND_USE,OVERLAY_TYPE,DESCRIPTION,AREA_NAME",
    )
    write_geojson(
        "fleetwood_town_centre",
        town_centre_fc,
        LAYERS["town_centre_densities"],
        "Town Centre Densities — Fleetwood",
        "AREA_NAME='Fleetwood Town Centre'",
        SURREY_LICENCE,
    )
    fleetwood_bbox = merge_bboxes([feature_bbox(f) for f in town_centre_fc["features"]])

    # Campbell Heights: derive from OSM place boundary in Surrey
    print("Fetching Campbell Heights boundary from OpenStreetMap…")
    campbell_overpass = """
    [out:json][timeout:90];
    area["name"="Surrey"]["admin_level"="8"]->.surrey;
    (
      relation["name"~"Campbell Heights",i](area.surrey);
      way["name"~"Campbell Heights",i](area.surrey);
    );
    out geom;
    """
    campbell_osm = overpass_query(campbell_overpass)
    campbell_fc = osm_to_geojson(campbell_osm)

    if not campbell_fc["features"]:
        # Fallback: bounding box from known industrial area south of Hwy 1 in Surrey
        # Query OSM for South Campbell Heights industrial land use
        campbell_overpass2 = """
        [out:json][timeout:90];
        (
          way["landuse"="industrial"]["name"~"Campbell",i](49.05,-122.85,49.12,-122.72);
          relation["name"~"South Campbell Heights",i](49.05,-122.85,49.12,-122.72);
        );
        out geom;
        """
        campbell_osm = overpass_query(campbell_overpass2)
        campbell_fc = osm_to_geojson(campbell_osm)

    if not campbell_fc["features"]:
        # Use development applications cluster in Campbell Heights area as proxy
        print("  OSM boundary not found; deriving Campbell Heights from dev apps cluster")
        campbell_bbox_manual = (-122.82, 49.06, -122.74, 49.11)
        campbell_fc = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "name": "Campbell Heights (derived envelope)",
                        "derivation": "Envelope around Campbell Heights / South Campbell Heights development cluster; OSM place boundary not available",
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [campbell_bbox_manual[0], campbell_bbox_manual[1]],
                                [campbell_bbox_manual[2], campbell_bbox_manual[1]],
                                [campbell_bbox_manual[2], campbell_bbox_manual[3]],
                                [campbell_bbox_manual[0], campbell_bbox_manual[3]],
                                [campbell_bbox_manual[0], campbell_bbox_manual[1]],
                            ]
                        ],
                    },
                }
            ],
        }
        campbell_bbox = campbell_bbox_manual
    else:
        campbell_bbox = merge_bboxes([feature_bbox(f) for f in campbell_fc["features"]])
        if campbell_bbox:
            campbell_bbox = expand_bbox(campbell_bbox, 0.003)

    write_geojson(
        "campbell_heights",
        campbell_fc,
        "https://overpass-api.de/api/interpreter",
        "Campbell Heights boundary (OSM or derived)",
        "name~Campbell Heights in Surrey",
        OSM_LICENCE if campbell_fc["features"][0]["properties"].get("osm_id") else "Derived envelope",
    )

    pilot_areas = {
        "city_centre": expand_bbox(city_centre_bbox, 0.002),
        "fleetwood": expand_bbox(fleetwood_bbox, 0.002),
        "campbell_heights": campbell_bbox,
    }

    with open(DATA_DIR / "pilot_areas.json", "w") as f:
        json.dump(
            {
                "city_centre": {
                    "bbox": pilot_areas["city_centre"],
                    "source": "City Centre Plan layer extent",
                },
                "fleetwood": {
                    "bbox": pilot_areas["fleetwood"],
                    "source": "Town Centre Densities — Fleetwood Town Centre",
                },
                "campbell_heights": {
                    "bbox": list(pilot_areas["campbell_heights"]),
                    "source": campbell_fc["features"][0]["properties"].get(
                        "derivation",
                        "OpenStreetMap place/industrial boundary",
                    ),
                },
            },
            f,
            indent=2,
        )

    print("Fetching development applications in pilot areas…")
    status_list = ",".join(f"'{s}'" for s in ACTIVE_STATUSES)
    all_projects = []
    for area_name, bbox in pilot_areas.items():
        env = expand_bbox(bbox, 0.001)
        fc = fetch_arcgis_geojson(
            LAYERS["development_applications"],
            f"STATUS IN ({status_list})",
            "OBJECTID,PROJECT_NO,DESCRIPTION,STATUS,WEBLINK,APPLICATION_DOCUMENTS_WEBLINK",
            envelope=env,
        )
        for f in fc["features"]:
            f["properties"]["pilot_area"] = area_name
        all_projects.extend(fc["features"])
        print(f"  {area_name}: {len(fc['features'])} projects")

    projects_fc = add_height_to_projects(
        {"type": "FeatureCollection", "features": all_projects}
    )
    write_geojson(
        "development_projects",
        projects_fc,
        LAYERS["development_applications"],
        "Development Applications",
        f"STATUS IN ({status_list}) within pilot envelopes",
        SURREY_LICENCE,
    )

    print("Fetching building footprints (City Centre only)…")
    buildings_fc = fetch_arcgis_geojson(
        LAYERS["building_footprints"],
        "1=1",
        "NAME,DESCRIPTION,BUILDING_HEIGHT,STATUS,FACILITY_TYPE",
        envelope=expand_bbox(city_centre_bbox, 0.001),
    )
    write_geojson(
        "building_footprints",
        buildings_fc,
        LAYERS["building_footprints"],
        "Building Footprints",
        "within City Centre envelope",
        SURREY_LICENCE,
    )

    print("Fetching FTDA overlay…")
    ftda_fc = fetch_arcgis_geojson(
        LAYERS["ftda"],
        "1=1",
        "BOUNDARY_TYPE,NAME",
    )
    write_geojson(
        "ftda",
        ftda_fc,
        LAYERS["ftda"],
        "Frequent Transit Development Areas",
        "where=1=1",
        SURREY_LICENCE,
    )

    print("Fetching OpenStreetMap transit and amenities…")
    overpass_transit = """
    [out:json][timeout:120];
    (
      way["railway"="light_rail"](49.0,-123.1,49.25,-122.7);
      way["railway"="subway"](49.0,-123.1,49.25,-122.7);
      node["railway"="station"]["station"~"light_rail|subway"](49.0,-123.1,49.25,-122.7);
      node["public_transport"="station"]["subway"="yes"](49.0,-123.1,49.25,-122.7);
      node["railway"="station"]["name"~"SkyTrain|Expo|Surrey Central|King George|Gateway|Scott Road",i](49.0,-123.1,49.25,-122.7);
    );
    out geom;
    """
    transit_osm = overpass_query(overpass_transit)
    transit_fc = osm_to_geojson(transit_osm)
    write_geojson(
        "skytrain",
        transit_fc,
        "https://overpass-api.de/api/interpreter",
        "SkyTrain lines and stations in Surrey",
        "railway=light_rail, station=light_rail|subway",
        OSM_LICENCE,
    )

    overpass_amenities = """
    [out:json][timeout:120];
    area["name"="Surrey"]["admin_level"="8"]->.surrey;
    (
      node["amenity"="townhall"](area.surrey);
      node["amenity"="library"](area.surrey);
      node["amenity"="university"]["name"~"SFU",i](area.surrey);
      way["amenity"="university"]["name"~"SFU",i](area.surrey);
      node["leisure"="sports_centre"](area.surrey);
      way["leisure"="sports_centre"](area.surrey);
      node["leisure"="recreation_ground"](area.surrey);
      way["leisure"="park"]["name"](area.surrey);
      relation["leisure"="park"]["name"](area.surrey);
    );
    out geom;
    """
    amenities_osm = overpass_query(overpass_amenities)
    amenities_fc = osm_to_geojson(amenities_osm)
    write_geojson(
        "amenities",
        amenities_fc,
        "https://overpass-api.de/api/interpreter",
        "Civic facilities, libraries, recreation, parks in Surrey",
        "townhall, library, university, sports_centre, park",
        OSM_LICENCE,
    )

    with open(DATA_DIR / "SOURCES.json", "w") as f:
        json.dump(SOURCES, f, indent=2)

    print(f"\nDone. {len(SOURCES)} datasets written to {DATA_DIR}")
    print(f"  Projects: {len(projects_fc['features'])}")
    print(f"  Buildings: {len(buildings_fc['features'])}")


if __name__ == "__main__":
    main()
