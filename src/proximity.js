const EARTH_RADIUS_M = 6371008.8;

export function haversineDistanceMeters(lon1, lat1, lon2, lat2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function ringIsClosed(ring) {
  if (!ring || ring.length < 2) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

export function featureCentroid(feature) {
  const geom = feature.geometry;
  if (!geom) return null;
  if (geom.type === 'Point') return geom.coordinates;
  const ring =
    geom.type === 'Polygon'
      ? geom.coordinates[0]
      : geom.type === 'MultiPolygon'
        ? geom.coordinates[0][0]
        : geom.coordinates;
  if (!ring || !ring.length) return null;
  let sx = 0;
  let sy = 0;
  const n = ring.length - (ringIsClosed(ring) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
  }
  return [sx / n, sy / n];
}

function usableCoordinate(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

export function featureReferencePoint(feature) {
  const props = feature?.properties || {};
  const lon = usableCoordinate(props.assign_lon);
  const lat = usableCoordinate(props.assign_lat);
  if (lon != null && lat != null && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
    return [lon, lat];
  }
  return featureCentroid(feature);
}

export function nearestStation(projectFeature, stations) {
  const center = featureReferencePoint(projectFeature);
  if (!center) return null;
  let best = null;
  let bestDist = Infinity;
  for (const station of stations) {
    if (station.geometry?.type !== 'Point') continue;
    const [lon, lat] = station.geometry.coordinates;
    const dist = haversineDistanceMeters(center[0], center[1], lon, lat);
    if (dist < bestDist) {
      bestDist = dist;
      best = { station, distanceM: dist };
    }
  }
  return best;
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function createProximityRingsGeoJSON(center, radiiM = [400, 800]) {
  const [lon, lat] = center;
  const features = radiiM.map((radius) => ({
    type: 'Feature',
    properties: { radius_m: radius },
    geometry: circlePolygon(lon, lat, radius),
  }));
  return { type: 'FeatureCollection', features };
}

function circlePolygon(lon, lat, radiusM, steps = 64) {
  const coords = [];
  const latRad = (lat * Math.PI) / 180;
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const dx = (radiusM / EARTH_RADIUS_M) * Math.cos(bearing);
    const dy = (radiusM / EARTH_RADIUS_M) * Math.sin(bearing);
    const newLat = lat + (dy * 180) / Math.PI;
    const newLon =
      lon + (dx * 180) / Math.PI / Math.cos(latRad);
    coords.push([newLon, newLat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}
