import importlib.util
import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
