import { isShowcaseProject } from './showcase.js';
import { computeProjectHeight } from './heights.js';
import { projectTitle } from './titles.js';

const DATA_BASE = `${import.meta.env?.BASE_URL || '/'}data`;

export const SURREY_LICENCE_TEXT =
  'Contains information licensed under the Open Government License – City of Surrey.';
export const SURREY_LICENCE_URL =
  'https://opendata-surrey.hub.arcgis.com/pages/55089a19491a4fe59a41e059fd8af708';

export async function loadGeoJSON(name) {
  const res = await fetch(`${DATA_BASE}/${name}.geojson`);
  if (!res.ok) throw new Error(`Failed to load ${name}: ${res.status}`);
  return res.json();
}

export async function loadSources() {
  const res = await fetch(`${DATA_BASE}/SOURCES.json`);
  if (!res.ok) return [];
  return res.json();
}

export async function loadPilotAreas() {
  const res = await fetch(`${DATA_BASE}/pilot_areas.json`);
  if (!res.ok) return null;
  return res.json();
}

export async function loadCivicPlaces() {
  const res = await fetch(`${DATA_BASE}/civic_places.json`);
  if (!res.ok) throw new Error(`Failed to load civic places: ${res.status}`);
  return res.json();
}

export function civicPlacesGeoJSON(civic) {
  const features = (civic?.places || []).map((place) => ({
    type: 'Feature',
    properties: {
      id: place.id,
      name: place.name,
      category: place.category,
    },
    geometry: { type: 'Point', coordinates: [place.lon, place.lat] },
  }));
  return { type: 'FeatureCollection', features };
}

export async function loadCityCentrePlanLive(sourceUrl, timeoutMs = 4000) {
  if (!sourceUrl) return null;
  const endpoint = `${String(sourceUrl).replace(/\/$/, '')}/query?where=1%3D1&outFields=OBJECTID&returnGeometry=true&outSR=4326&f=geojson`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length === 0) {
      return null;
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function getSkyTrainStations(skytrainFc) {
  return skytrainFc.features.filter(
    (f) =>
      f.geometry?.type === 'Point' &&
      (f.properties?.railway === 'station' ||
        f.properties?.public_transport === 'station'),
  );
}

export function getSkyTrainLines(skytrainFc) {
  return skytrainFc.features.filter(
    (f) => f.geometry?.type === 'LineString' && f.properties?.railway,
  );
}

export function enrichProjects(fc) {
  for (const feature of fc.features) {
    const props = feature.properties;
    const height = computeProjectHeight(props.DESCRIPTION);
    Object.assign(props, height);
    props.showcase = isShowcaseProject(props);
    props.display_title = projectTitle(props.DESCRIPTION);
  }
  return fc;
}

export function projectLabel(props) {
  const title = props.display_title || projectTitle(props.DESCRIPTION);
  const no = props.PROJECT_NO || props.project_no || '';
  return no ? `${title} (${no})` : title;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function latestRetrievalDate(sources) {
  let latest = null;
  for (const source of sources || []) {
    const time = Date.parse(source?.retrieved_at || '');
    if (!Number.isFinite(time)) continue;
    if (!latest || time > latest) latest = time;
  }
  if (latest == null) return null;
  const date = new Date(latest);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function publicDataRetrievedLabel(sources) {
  const date = latestRetrievalDate(sources);
  return date ? `Public data retrieved ${date}` : '';
}

export function pilotAreaLabel(area) {
  const labels = {
    city_centre: 'City Centre',
    fleetwood: 'Fleetwood Town Centre',
    campbell_heights: 'Campbell Heights',
  };
  return labels[area] || area;
}

function onSegment(lon, lat, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return false;
  const cross = dx * (lat - a[1]) - dy * (lon - a[0]);
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (lon - a[0]) * dx + (lat - a[1]) * dy;
  if (dot < -1e-9) return false;
  return dot - len2 <= 1e-9;
}

function pointOnRing(lon, lat, ring) {
  if (!ring?.length) return false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (onSegment(lon, lat, ring[j], ring[i])) return true;
  }
  return false;
}

function ringInterior(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if ((yi > lat) === (yj > lat)) continue;
    const xCross = ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (lon < xCross) inside = !inside;
  }
  return inside;
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

export function geometryContains(geometry, lon, lat) {
  return polygonsOf(geometry).some((polygon) => {
    if (!polygon?.length) return false;
    if (polygon.some((ring) => pointOnRing(lon, lat, ring))) return true;
    if (!ringInterior(lon, lat, polygon[0])) return false;
    return !polygon.slice(1).some((hole) => ringInterior(lon, lat, hole));
  });
}

export function pointInPilotArea(pilotAreas, areaId, lon, lat) {
  const geometry = pilotAreas?.[areaId]?.geometry;
  if (!geometry) return false;
  return geometryContains(geometry, lon, lat);
}

export function pilotAreaOutlines(pilotAreas) {
  const features = [];
  for (const [id, area] of Object.entries(pilotAreas || {})) {
    const geometry = area?.outline || area?.geometry;
    if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) continue;
    features.push({
      type: 'Feature',
      properties: { id, name: pilotAreaLabel(id) },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}

function labelCoordinates(id, area) {
  const label = area?.label;
  const bbox = area?.bbox;
  if (!label || label.length < 2) return null;
  if ((id === 'city_centre' || id === 'fleetwood') && bbox?.length === 4) {
    const [west, south, east, north] = bbox;
    const pad = Math.max((north - south) * 0.18, 0.004);
    return [(west + east) / 2, north + pad];
  }
  return [label[0], label[1]];
}

export function pilotAreaLabelPoints(pilotAreas) {
  const features = [];
  for (const [id, area] of Object.entries(pilotAreas || {})) {
    const coordinates = labelCoordinates(id, area);
    if (!coordinates) continue;
    features.push({
      type: 'Feature',
      properties: { id, name: pilotAreaLabel(id) },
      geometry: { type: 'Point', coordinates },
    });
  }
  return { type: 'FeatureCollection', features };
}
