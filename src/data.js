const DATA_BASE = './data';

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

export function projectLabel(props) {
  const no = props.PROJECT_NO || props.project_no || 'Unknown';
  const desc = props.DESCRIPTION || '';
  const short = desc.length > 60 ? desc.slice(0, 57) + '…' : desc;
  return short ? `${no} — ${short}` : no;
}

export function pilotAreaLabel(area) {
  const labels = {
    city_centre: 'City Centre',
    fleetwood: 'Fleetwood Town Centre',
    campbell_heights: 'Campbell Heights',
  };
  return labels[area] || area;
}
