#!/usr/bin/env python3
"""Download public data for Surrey development visualization prototype."""

import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    from shapely import set_precision
    from shapely.geometry import Point, Polygon, mapping, shape
    from shapely.ops import unary_union
except ImportError as exc:
    raise SystemExit("shapely is required to union the City plan polygons") from exc

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

SURREY_LICENCE = (
    "Contains information licensed under the Open Government License – City of Surrey. "
    "(https://opendata-surrey.hub.arcgis.com/pages/55089a19491a4fe59a41e059fd8af708)"
)
OSM_LICENCE = "© OpenStreetMap contributors (ODbL)"

SOURCES = []

ARCGIS_BASE = "https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services"

LAYERS = {
    "development_applications": f"{ARCGIS_BASE}/Development%20Applications/FeatureServer/0",
    "building_footprints": f"{ARCGIS_BASE}/Building%20Footprnts/FeatureServer/0",
    "city_centre_plan": f"{ARCGIS_BASE}/City%20Centre%20Plan/FeatureServer/0",
    "town_centre_densities": f"{ARCGIS_BASE}/Town%20Centre%20Densities/FeatureServer/0",
    "campbell_heights_lap": f"{ARCGIS_BASE}/Campbell%20Heights%20Local%20Area%20Plan/FeatureServer/0",
    "south_campbell_heights_lap": f"{ARCGIS_BASE}/South%20Campbell%20Heights%20Local%20Area%20Plan/FeatureServer/0",
    "ftda": f"{ARCGIS_BASE}/Frequent%20Transit%20Development%20Areas/FeatureServer/0",
}

PLAN_FIELDS = "PLAN_AREA,PLAN_TYPE,PLAN_YEAR,PLAN_STATUS,LAND_USE"
AREA_ORDER = ("city_centre", "fleetwood", "campbell_heights")
CAMPBELL_HEIGHTS_IN = (-122.690, 49.054)
CAMPBELL_HEIGHTS_OUT = (-122.776, 49.054)

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


def polygonal(geom):
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    if geom.geom_type == "GeometryCollection":
        parts = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
        if not parts:
            raise RuntimeError("union produced no polygons")
        return unary_union(parts)
    raise RuntimeError(f"unexpected geometry {geom.geom_type}")


def union_features(features):
    geoms = []
    for feature in features:
        geometry = feature.get("geometry")
        if not geometry:
            continue
        geom = shape(geometry)
        if geom.is_empty:
            continue
        if not geom.is_valid:
            geom = geom.buffer(0)
        geoms.append(geom)
    if not geoms:
        raise RuntimeError("no polygons to union")
    merged = polygonal(unary_union(geoms))
    if not merged.is_valid:
        merged = polygonal(merged.buffer(0))
    snapped = polygonal(set_precision(merged, 1e-6))
    if snapped.is_empty:
        return merged
    return snapped


def geometry_json(geom):
    return mapping(geom)


# Closes parcel and road gaps inside a plan. About 20 m east-west at this latitude.
OUTLINE_GAP = 0.00025
# Smaller than a city block. Slivers and road centreline gaps are not holes in the plan.
REAL_HOLE_AREA = 1e-6


def polygon_parts(geom):
    if geom is None or geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type == "MultiPolygon":
        return list(geom.geoms)
    if geom.geom_type == "GeometryCollection":
        parts = []
        for child in geom.geoms:
            parts.extend(polygon_parts(child))
        return parts
    return []


def source_has_real_hole(geom, hole):
    point = hole.representative_point()
    for part in polygon_parts(geom):
        for ring in part.interiors:
            source_hole = Polygon(ring)
            if source_hole.area < REAL_HOLE_AREA:
                continue
            if source_hole.covers(point):
                return True
    return False


def outline_geometry(geom):
    """Outer boundary for drawing. Point-in-polygon keeps the full geometry."""
    parts = [part for part in polygon_parts(geom) if part.area > 1e-12]
    if not parts:
        return geom
    exteriors = unary_union([Polygon(part.exterior) for part in parts])
    exterior_parts = polygon_parts(exteriors)
    if len(exterior_parts) == 1:
        holes = []
        for ring in exterior_parts[0].interiors:
            hole = Polygon(ring)
            if hole.area >= REAL_HOLE_AREA and source_has_real_hole(geom, hole):
                holes.append(ring)
        if not holes:
            return Polygon(exterior_parts[0].exterior)
        return Polygon(exterior_parts[0].exterior, holes)

    closed = exteriors.buffer(OUTLINE_GAP, join_style=2, mitre_limit=2).buffer(
        -OUTLINE_GAP, join_style=2, mitre_limit=2
    )
    shells = []
    for part in polygon_parts(closed):
        if part.area <= 1e-12:
            continue
        holes = []
        for ring in part.interiors:
            hole = Polygon(ring)
            if hole.area < REAL_HOLE_AREA or not source_has_real_hole(geom, hole):
                continue
            holes.append(ring)
        shells.append(Polygon(part.exterior, holes) if holes else Polygon(part.exterior))
    if not shells:
        return geom
    biggest = max(part.area for part in shells)
    shells = [part for part in shells if part.area >= biggest * 0.01]
    merged = polygonal(unary_union(shells))
    if not merged.is_valid:
        merged = polygonal(merged.buffer(0))
    return merged


def rounded_geometry(geom, ndigits=6):
    data = mapping(geom)

    def walk(coords):
        if isinstance(coords[0], (int, float)):
            return [round(float(coords[0]), ndigits), round(float(coords[1]), ndigits)]
        return [walk(item) for item in coords]

    data["coordinates"] = walk(data["coordinates"])
    return data


def bounds_list(geom):
    minx, miny, maxx, maxy = geom.bounds
    return [round(minx, 6), round(miny, 6), round(maxx, 6), round(maxy, 6)]


def label_point(geom):
    minx, miny, maxx, maxy = geom.bounds
    cx = round((minx + maxx) / 2, 6)
    cy = round((miny + maxy) / 2, 6)
    if geom.covers(Point(cx, cy)):
        return [cx, cy]
    center = Point((minx + maxx) / 2, (miny + maxy) / 2)
    for radius in (0.0005, 0.001, 0.002, 0.004, 0.008, 0.016, 0.032):
        hit = geom.intersection(center.buffer(radius))
        if hit.is_empty:
            continue
        point = hit.representative_point()
        return [round(point.x, 6), round(point.y, 6)]
    point = geom.representative_point()
    return [round(point.x, 6), round(point.y, 6)]


def assignment_point(feature):
    geom = shape(feature["geometry"])
    if not geom.is_valid:
        geom = geom.buffer(0)
    point = geom.representative_point()
    return point.x, point.y


def part_count(geom):
    if geom.geom_type == "MultiPolygon":
        return len(geom.geoms)
    return 1 if geom.geom_type == "Polygon" else 0


OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)


def overpass_query(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    last_error = None
    for url in OVERPASS_ENDPOINTS:
        req = urllib.request.Request(url, data=data, headers={"User-Agent": "surrey-devviz-demo/0.1"})
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode())
        except Exception as exc:
            last_error = exc
            print(f"  Overpass failed ({url}): {exc}")
    raise last_error


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
    city_centre_geom = union_features(city_centre_fc["features"])
    print(f"  City Centre union: {part_count(city_centre_geom)} part(s)")

    town_centre_fc = fetch_arcgis_geojson(
        LAYERS["town_centre_densities"],
        "AREA_NAME='Fleetwood Town Centre'",
        "LAND_USE,OVERLAY_TYPE,DESCRIPTION,AREA_NAME",
    )
    write_geojson(
        "fleetwood_town_centre",
        town_centre_fc,
        LAYERS["town_centre_densities"],
        "Town Centre Densities (Fleetwood)",
        "AREA_NAME='Fleetwood Town Centre'",
        SURREY_LICENCE,
    )
    fleetwood_geom = union_features(town_centre_fc["features"])
    print(f"  Fleetwood union: {part_count(fleetwood_geom)} part(s)")

    print("Fetching Campbell Heights Local Area Plan…")
    campbell_fc = fetch_arcgis_geojson(
        LAYERS["campbell_heights_lap"],
        "1=1",
        PLAN_FIELDS,
    )
    write_geojson(
        "campbell_heights_lap",
        campbell_fc,
        LAYERS["campbell_heights_lap"],
        "Campbell Heights Local Area Plan",
        "where=1=1",
        SURREY_LICENCE,
    )
    print("Fetching South Campbell Heights Local Area Plan…")
    south_campbell_fc = fetch_arcgis_geojson(
        LAYERS["south_campbell_heights_lap"],
        "1=1",
        PLAN_FIELDS,
    )
    write_geojson(
        "south_campbell_heights_lap",
        south_campbell_fc,
        LAYERS["south_campbell_heights_lap"],
        "South Campbell Heights Local Area Plan",
        "where=1=1",
        SURREY_LICENCE,
    )
    campbell_geom = union_features(campbell_fc["features"] + south_campbell_fc["features"])
    print(f"  Campbell Heights union: {part_count(campbell_geom)} part(s) bounds {bounds_list(campbell_geom)}")
    if not campbell_geom.covers(Point(*CAMPBELL_HEIGHTS_IN)):
        raise SystemExit("192 Street and 32 Avenue is outside the Campbell Heights union")
    if campbell_geom.covers(Point(*CAMPBELL_HEIGHTS_OUT)):
        raise SystemExit("160 Street and 32 Avenue is inside the Campbell Heights union")
    stale = DATA_DIR / "campbell_heights.geojson"
    if stale.exists():
        stale.unlink()

    pilot_geoms = {
        "city_centre": city_centre_geom,
        "fleetwood": fleetwood_geom,
        "campbell_heights": campbell_geom,
    }
    pilot_meta = {
        "city_centre": {
            "bbox": bounds_list(city_centre_geom),
            "label": label_point(city_centre_geom),
            "source": "City Centre Plan",
            "geometry": geometry_json(city_centre_geom),
            "outline": rounded_geometry(outline_geometry(city_centre_geom)),
        },
        "fleetwood": {
            "bbox": bounds_list(fleetwood_geom),
            "label": label_point(fleetwood_geom),
            "source": "Town Centre Densities (Fleetwood) Town Centre",
            "geometry": geometry_json(fleetwood_geom),
            "outline": rounded_geometry(outline_geometry(fleetwood_geom)),
        },
        "campbell_heights": {
            "bbox": bounds_list(campbell_geom),
            "label": label_point(campbell_geom),
            "source": "Union of Campbell Heights Local Area Plan and South Campbell Heights Local Area Plan",
            "geometry": geometry_json(campbell_geom),
            "outline": rounded_geometry(outline_geometry(campbell_geom)),
        },
    }
    with open(DATA_DIR / "pilot_areas.json", "w") as f:
        json.dump(pilot_meta, f)
        f.write("\n")

    print("Fetching development applications in pilot areas…")
    status_list = ",".join(f"'{s}'" for s in ACTIVE_STATUSES)
    fetched = {}
    for area_name in AREA_ORDER:
        env = expand_bbox(tuple(pilot_meta[area_name]["bbox"]), 0.001)
        fc = fetch_arcgis_geojson(
            LAYERS["development_applications"],
            f"STATUS IN ({status_list})",
            "OBJECTID,PROJECT_NO,DESCRIPTION,STATUS,WEBLINK,APPLICATION_DOCUMENTS_WEBLINK",
            envelope=env,
        )
        for feature in fc["features"]:
            fetched[feature["properties"].get("OBJECTID")] = feature
        print(f"  {area_name} envelope: {len(fc['features'])} projects")

    assigned = []
    counts = {name: 0 for name in AREA_ORDER}
    for feature in fetched.values():
        lon, lat = assignment_point(feature)
        area_name = None
        for name in AREA_ORDER:
            if pilot_geoms[name].covers(Point(lon, lat)):
                area_name = name
                break
        if not area_name:
            continue
        rlon, rlat = round(lon, 6), round(lat, 6)
        if not pilot_geoms[area_name].covers(Point(rlon, rlat)):
            rlon, rlat = lon, lat
        feature["properties"]["assign_lon"] = rlon
        feature["properties"]["assign_lat"] = rlat
        feature["properties"]["pilot_area"] = area_name
        counts[area_name] += 1
        assigned.append(feature)
    for name, count in counts.items():
        print(f"  {name} inside polygon: {count} projects")

    projects_fc = add_height_to_projects(
        {"type": "FeatureCollection", "features": assigned}
    )
    write_geojson(
        "development_projects",
        projects_fc,
        LAYERS["development_applications"],
        "Development Applications",
        f"STATUS IN ({status_list}); assigned by point-in-polygon on official pilot polygons",
        SURREY_LICENCE,
    )

    print("Fetching building footprints (City Centre only)…")
    buildings_fc = fetch_arcgis_geojson(
        LAYERS["building_footprints"],
        "1=1",
        "NAME,DESCRIPTION,BUILDING_HEIGHT,STATUS,FACILITY_TYPE",
        envelope=expand_bbox(tuple(bounds_list(city_centre_geom)), 0.001),
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

    previous_sources = []
    sources_path = DATA_DIR / "SOURCES.json"
    if sources_path.exists():
        previous_sources = json.loads(sources_path.read_text())

    def write_sources():
        with open(sources_path, "w") as handle:
            json.dump(SOURCES, handle, indent=2)
            handle.write("\n")

    def keep_previous(filename):
        if any(entry.get("file") == filename for entry in SOURCES):
            return
        for entry in previous_sources:
            if entry.get("file") == filename:
                SOURCES.append(entry)
                print(f"  kept previous {filename}")
                return

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
    try:
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
    except Exception as exc:
        print(f"  SkyTrain download failed: {exc}")
        keep_previous("skytrain.geojson")

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
    try:
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
    except Exception as exc:
        print(f"  Amenities download failed: {exc}")
        keep_previous("amenities.geojson")

    write_sources()

    print(f"\nDone. {len(SOURCES)} datasets written to {DATA_DIR}")
    print(f"  Projects: {len(projects_fc['features'])}")
    print(f"  Buildings: {len(buildings_fc['features'])}")


if __name__ == "__main__":
    main()
