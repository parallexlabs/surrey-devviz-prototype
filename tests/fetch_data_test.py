import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("fetch_data", ROOT / "scripts" / "fetch_data.py")
fetch_data = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fetch_data)


def feature(feature_id):
    return {"type": "Feature", "properties": {"id": feature_id}, "geometry": None}


class ArcGISFetchTests(unittest.TestCase):
    def test_error_response_is_rejected(self):
        def get_json(url):
            if "returnCountOnly" in url:
                return {"count": 1}
            return {"error": {"code": 400, "message": "bad query"}}

        with self.assertRaises(fetch_data.ArcGISError):
            fetch_data.fetch_arcgis_geojson(
                "https://example.test/FeatureServer/0",
                "1=1",
                "*",
                get_json=get_json,
            )

    def test_short_page_continues_when_transfer_limit_is_set(self):
        def get_json(url):
            if "returnCountOnly" in url:
                return {"count": 2}
            if "resultOffset=0" in url:
                return {
                    "type": "FeatureCollection",
                    "features": [feature(1)],
                    "exceededTransferLimit": True,
                }
            return {"type": "FeatureCollection", "features": [feature(2)]}

        collection = fetch_data.fetch_arcgis_geojson(
            "https://example.test/FeatureServer/0",
            "1=1",
            "*",
            page_size=1000,
            get_json=get_json,
        )
        self.assertEqual([item["properties"]["id"] for item in collection["features"]], [1, 2])

    def test_count_mismatch_is_rejected(self):
        def get_json(url):
            if "returnCountOnly" in url:
                return {"count": 5}
            return {"type": "FeatureCollection", "features": [feature(1)]}

        with self.assertRaises(fetch_data.ArcGISError):
            fetch_data.fetch_arcgis_geojson(
                "https://example.test/FeatureServer/0",
                "1=1",
                "*",
                get_json=get_json,
            )

    def test_duplicate_feature_id_is_rejected(self):
        def get_json(url):
            if "returnCountOnly" in url:
                return {"count": 2}
            if "resultOffset=0" in url:
                return {
                    "features": [{"properties": {"OBJECTID": 5}}],
                    "exceededTransferLimit": True,
                }
            return {"features": [{"properties": {"OBJECTID": 5}}]}

        with self.assertRaisesRegex(fetch_data.ArcGISError, "duplicate feature ID 5"):
            fetch_data.fetch_arcgis_geojson(
                "https://example.test/FeatureServer/0",
                "1=1",
                "*",
                get_json=get_json,
            )

    def test_page_that_exceeds_the_count_is_rejected(self):
        def get_json(url):
            if "returnCountOnly" in url:
                return {"count": 1}
            return {"features": [{"properties": {"OBJECTID": 1}}, {"properties": {"OBJECTID": 2}}]}

        with self.assertRaisesRegex(fetch_data.ArcGISError, "exceeded returnCountOnly"):
            fetch_data.fetch_arcgis_geojson(
                "https://example.test/FeatureServer/0",
                "1=1",
                "*",
                get_json=get_json,
            )

    def test_empty_page_that_claims_more_is_rejected(self):
        def get_json(url):
            if "returnCountOnly" in url:
                return {"count": 2}
            if "resultOffset=0" in url:
                return {
                    "features": [{"properties": {"OBJECTID": 1}}],
                    "exceededTransferLimit": True,
                }
            return {"features": [], "exceededTransferLimit": True}

        with self.assertRaisesRegex(fetch_data.ArcGISError, "empty page"):
            fetch_data.fetch_arcgis_geojson(
                "https://example.test/FeatureServer/0",
                "1=1",
                "*",
                get_json=get_json,
            )


class AtomicWriteTests(unittest.TestCase):
    def test_writes_the_finished_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "layer.geojson"
            fetch_data.write_json_atomic(path, {"type": "FeatureCollection", "features": []})
            self.assertTrue(path.exists())
            self.assertFalse(path.with_name(f".{path.name}.tmp").exists())
            self.assertIn("FeatureCollection", path.read_text())

    def test_failed_temp_write_leaves_the_previous_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "layer.geojson"
            path.write_text("previous\n", encoding="utf-8")
            original = Path.write_text

            def fail_temp(self, text, encoding=None, errors=None):
                if self.name.startswith(".") and self.name.endswith(".tmp"):
                    raise OSError("disk full")
                return original(self, text, encoding=encoding, errors=errors)

            Path.write_text = fail_temp
            try:
                with self.assertRaises(OSError):
                    fetch_data.write_text_atomic(path, "replacement\n")
            finally:
                Path.write_text = original
            self.assertEqual(path.read_text(encoding="utf-8"), "previous\n")


class OsmPropertyFilterTests(unittest.TestCase):
    def test_amenities_allowlist_drops_contact_fields(self):
        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "properties": {
                "osm_id": 1,
                "osm_type": "node",
                "name": "Library",
                "amenity": "library",
                "phone": "555-0100",
                "email": "info@example.test",
                "website": "https://example.test",
            },
        }
        fetch_data.filter_feature_properties(feature, fetch_data.AMENITIES_PROPERTY_ALLOWLIST)
        self.assertEqual(
            feature["properties"],
            {
                "osm_id": 1,
                "osm_type": "node",
                "name": "Library",
                "amenity": "library",
            },
        )

    def test_skytrain_allowlist_keeps_station_fields(self):
        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [0, 0]},
            "properties": {
                "osm_id": 2,
                "osm_type": "node",
                "name": "Surrey Central",
                "railway": "station",
                "station": "subway",
                "subway": "yes",
                "public_transport": "station",
                "addr:street": "Central Avenue",
                "phone": "555-0100",
            },
        }
        fetch_data.filter_feature_properties(feature, fetch_data.SKYTRAIN_PROPERTY_ALLOWLIST)
        self.assertEqual(
            feature["properties"],
            {
                "osm_id": 2,
                "osm_type": "node",
                "name": "Surrey Central",
                "railway": "station",
                "station": "subway",
                "subway": "yes",
                "public_transport": "station",
            },
        )


class OsmConversionTests(unittest.TestCase):
    def test_node_way_and_park_relation(self):
        osm = {
            "elements": [
                {
                    "type": "node",
                    "id": 1,
                    "lon": -122.8,
                    "lat": 49.1,
                    "tags": {"amenity": "library", "name": "Library"},
                },
                {
                    "type": "way",
                    "id": 2,
                    "tags": {"leisure": "park", "name": "Way Park"},
                    "geometry": [
                        {"lon": 0, "lat": 0},
                        {"lon": 2, "lat": 0},
                        {"lon": 2, "lat": 2},
                        {"lon": 0, "lat": 2},
                        {"lon": 0, "lat": 0},
                    ],
                },
                {
                    "type": "relation",
                    "id": 3,
                    "tags": {"leisure": "park", "name": "Relation Park", "type": "multipolygon"},
                    "members": [
                        {
                            "type": "way",
                            "role": "outer",
                            "geometry": [
                                {"lon": 0, "lat": 0},
                                {"lon": 4, "lat": 0},
                                {"lon": 4, "lat": 4},
                                {"lon": 0, "lat": 4},
                                {"lon": 0, "lat": 0},
                            ],
                        },
                        {
                            "type": "way",
                            "role": "inner",
                            "geometry": [
                                {"lon": 1, "lat": 1},
                                {"lon": 2, "lat": 1},
                                {"lon": 2, "lat": 2},
                                {"lon": 1, "lat": 2},
                                {"lon": 1, "lat": 1},
                            ],
                        },
                    ],
                },
            ]
        }
        collection = fetch_data.osm_to_geojson(osm, area_markers=True)
        kinds = [(feature["geometry"]["type"], feature["properties"].get("osm_id")) for feature in collection["features"]]
        self.assertIn(("Point", 1), kinds)
        self.assertIn(("Polygon", 2), kinds)
        self.assertIn(("Polygon", 3), kinds)
        markers = [
            feature
            for feature in collection["features"]
            if feature["properties"].get("representative_point")
        ]
        self.assertEqual(sorted(feature["properties"]["osm_id"] for feature in markers), [2, 3])
        from shapely.geometry import shape

        for feature in collection["features"]:
            if feature["properties"].get("osm_id") != 3 or feature["geometry"]["type"] == "Point":
                continue
            polygon = shape(feature["geometry"])
            marker = next(item for item in markers if item["properties"]["osm_id"] == 3)
            point = shape(marker["geometry"])
            self.assertTrue(polygon.covers(point))
            self.assertFalse(polygon.interiors and shape({
                "type": "Polygon",
                "coordinates": [list(polygon.interiors[0].coords)],
            }).covers(point))

    def test_relation_ring_merges_member_ways(self):
        element = {
            "members": [
                {
                    "type": "way",
                    "role": "outer",
                    "geometry": [
                        {"lon": 0, "lat": 0},
                        {"lon": 2, "lat": 0},
                        {"lon": 2, "lat": 2},
                    ],
                },
                {
                    "type": "way",
                    "role": "outer",
                    "geometry": [
                        {"lon": 2, "lat": 2},
                        {"lon": 0, "lat": 2},
                        {"lon": 0, "lat": 0},
                    ],
                },
            ]
        }
        geometry = fetch_data.relation_geometry(element)
        self.assertEqual(geometry["type"], "Polygon")
        from shapely.geometry import shape

        polygon = shape(geometry)
        self.assertEqual(polygon.area, 4)
        self.assertEqual(len(geometry["coordinates"]), 1)

    def test_incomplete_relation_way_is_rejected(self):
        element = {
            "members": [
                {"type": "way", "role": "outer", "geometry": [{"lon": 0, "lat": 0}]},
            ]
        }
        with self.assertRaisesRegex(RuntimeError, "incomplete member way"):
            fetch_data.relation_geometry(element)


class OverpassValidationTests(unittest.TestCase):
    def test_remark_or_incomplete_response_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "incomplete"):
            fetch_data.validate_overpass({"remark": "runtime error", "elements": []})
        with self.assertRaises(RuntimeError):
            fetch_data.validate_overpass({"elements": None})
        self.assertEqual(fetch_data.validate_overpass({"elements": []})["elements"], [])

    def test_overpass_query_rejects_an_error_payload(self):
        class FakeResp:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return b'{"remark":"runtime error"}'

        with patch("urllib.request.urlopen", return_value=FakeResp()):
            with self.assertRaises(RuntimeError):
                fetch_data.overpass_query("[out:json];out;")


class StagedRefreshTests(unittest.TestCase):
    def test_later_failure_keeps_the_previous_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp)
            sources = data / "SOURCES.json"
            projects = data / "development_projects.geojson"
            sources.write_text("[]\n", encoding="utf-8")
            projects.write_text("old\n", encoding="utf-8")

            def worker(stage):
                (stage / "development_projects.geojson").write_text("new\n", encoding="utf-8")
                (stage / "SOURCES.json").write_text(
                    json.dumps([{"file": "development_projects.geojson"}]) + "\n",
                    encoding="utf-8",
                )
                raise RuntimeError("later failure")

            with self.assertRaisesRegex(RuntimeError, "later failure"):
                fetch_data.run_staged_refresh(data, worker)
            self.assertEqual(projects.read_text(encoding="utf-8"), "old\n")
            self.assertEqual(sources.read_text(encoding="utf-8"), "[]\n")
            self.assertFalse((data / "development_projects.geojson.publishing").exists())

    def test_success_publishes_data_and_sources_together(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp)
            (data / "SOURCES.json").write_text("[]\n", encoding="utf-8")

            def worker(stage):
                (stage / "development_projects.geojson").write_text("new\n", encoding="utf-8")
                (stage / "SOURCES.json").write_text('[{"file":"development_projects.geojson"}]\n', encoding="utf-8")

            fetch_data.run_staged_refresh(data, worker)
            self.assertEqual((data / "development_projects.geojson").read_text(encoding="utf-8"), "new\n")
            self.assertIn("development_projects.geojson", (data / "SOURCES.json").read_text(encoding="utf-8"))


class ProjectFieldTests(unittest.TestCase):
    def test_pipeline_drops_stale_height_fields(self):
        cleaned = fetch_data.development_project_properties(
            {
                "OBJECTID": 207,
                "PROJECT_NO": "19-0234-00",
                "DESCRIPTION": "a 43-storey residential apartment building",
                "STATUS": "Conditional Approval",
                "WEBLINK": "https://example.test/a",
                "APPLICATION_DOCUMENTS_WEBLINK": "https://example.test/b",
                "height_m": 21.0,
                "height_source": "illustrative",
                "storeys": 43,
                "height_label": "stale",
            },
            -122.841,
            49.191,
            "city_centre",
        )
        self.assertEqual(
            set(cleaned),
            set(fetch_data.PROJECT_CITY_FIELDS) | set(fetch_data.PROJECT_DERIVED_FIELDS),
        )
        self.assertFalse(set(cleaned) & set(fetch_data.STALE_PROJECT_FIELDS))
        self.assertEqual(cleaned["assign_lon"], -122.841)
        self.assertEqual(cleaned["pilot_area"], "city_centre")

    def test_shipped_projects_omit_stale_height_fields(self):
        fc = json.loads((fetch_data.DATA_DIR / "development_projects.geojson").read_text(encoding="utf-8"))
        allowed = set(fetch_data.PROJECT_CITY_FIELDS) | set(fetch_data.PROJECT_DERIVED_FIELDS)
        self.assertEqual(len(fc["features"]), 119)
        for feature in fc["features"]:
            self.assertTrue(set(feature["properties"]) <= allowed)

    def test_kept_previous_records_the_failed_refresh_without_changing_the_old_date(self):
        original = {
            "file": "skytrain.geojson",
            "retrieved_at": "2026-10-06T05:58:23.972485+00:00",
        }
        kept = fetch_data.note_kept_previous(original, "2026-10-06T12:00:00+00:00")
        self.assertEqual(original["retrieved_at"], "2026-10-06T05:58:23.972485+00:00")
        self.assertNotIn("kept_previous", original)
        self.assertTrue(kept["kept_previous"])
        self.assertEqual(kept["refresh_attempted_at"], "2026-10-06T12:00:00+00:00")
        self.assertEqual(kept["retrieved_at"], original["retrieved_at"])


if __name__ == "__main__":
    unittest.main()
