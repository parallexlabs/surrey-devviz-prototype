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

function ringContains(lon, lat, ring) {
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
    if (!polygon?.length || !ringContains(lon, lat, polygon[0])) return false;
    return !polygon.slice(1).some((hole) => ringContains(lon, lat, hole));
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

export function pilotAreaLabelPoints(pilotAreas) {
  const features = [];
  for (const [id, area] of Object.entries(pilotAreas || {})) {
    const coordinates = area?.label;
    if (!coordinates || coordinates.length < 2) continue;
    features.push({
      type: 'Feature',
      properties: { id, name: pilotAreaLabel(id) },
      geometry: { type: 'Point', coordinates: [coordinates[0], coordinates[1]] },
    });
  }
  return { type: 'FeatureCollection', features };
}
