import maplibregl from 'maplibre-gl';
import './styles.css';
import {
  loadGeoJSON,
  loadSources,
  loadPilotAreas,
  getSkyTrainStations,
  projectLabel,
  pilotAreaLabel,
} from './data.js';
import {
  nearestStation,
  formatDistance,
  createProximityRingsGeoJSON,
  featureCentroid,
} from './proximity.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CAMERA_PRESETS = {
  overview: { center: [-122.85, 49.17], zoom: 10.5, pitch: 0, bearing: 0 },
  city_centre: { center: [-122.85, 49.19], zoom: 14.5, pitch: 55, bearing: -20 },
  fleetwood: { center: [-122.8, 49.16], zoom: 14.5, pitch: 50, bearing: 0 },
  campbell_heights: { center: [-122.78, 49.085], zoom: 14, pitch: 50, bearing: 10 },
};

let map;
let projectsFc;
let skytrainFc;
let stations = [];
let selectedId = null;
let sourcesMeta = [];

function buildApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="app-header" role="banner">
      <h1>Surrey Development Visualization</h1>
      <span class="subtitle">Public-data prototype — ParalleX Labs Inc.</span>
    </header>
    <aside class="sidebar" id="sidebar" aria-label="Project list and information">
      <div class="sidebar-tabs" role="tablist">
        <button role="tab" id="tab-projects" aria-selected="true" aria-controls="panel-projects">Projects</button>
        <button role="tab" id="tab-about" aria-selected="false" aria-controls="panel-about">About</button>
      </div>
      <div class="sidebar-panel" id="panel-projects" role="tabpanel" aria-labelledby="tab-projects">
        <label for="search" class="visually-hidden">Search projects</label>
        <input type="search" id="search" class="search-input" placeholder="Search projects…" aria-label="Search projects">
        <div class="filter-row">
          <label for="filter-area" class="visually-hidden">Filter by area</label>
          <select id="filter-area" aria-label="Filter by pilot area">
            <option value="">All areas</option>
            <option value="city_centre">City Centre</option>
            <option value="fleetwood">Fleetwood</option>
            <option value="campbell_heights">Campbell Heights</option>
          </select>
          <label for="filter-status" class="visually-hidden">Filter by status</label>
          <select id="filter-status" aria-label="Filter by status">
            <option value="">All statuses</option>
          </select>
        </div>
        <ul class="project-list" id="project-list" aria-label="Development projects"></ul>
      </div>
      <div class="sidebar-panel" id="panel-about" role="tabpanel" aria-labelledby="tab-about" hidden>
        <div class="about-content" id="about-content"></div>
      </div>
    </aside>
    <main class="map-area" id="main-content">
      <div id="map" role="application" aria-label="Interactive 3D map of Surrey development projects"></div>
      <div class="map-controls" aria-label="Map controls">
        <h2>View</h2>
        <div class="camera-presets" role="group" aria-label="Camera presets">
          <button type="button" data-preset="overview">Surrey</button>
          <button type="button" data-preset="city_centre">City Centre</button>
          <button type="button" data-preset="fleetwood">Fleetwood</button>
          <button type="button" data-preset="campbell_heights">Campbell Heights</button>
        </div>
        <h2>Overlays</h2>
        <label><input type="checkbox" id="toggle-skytrain" checked> SkyTrain</label>
        <label><input type="checkbox" id="toggle-ftda"> FTDA</label>
        <label><input type="checkbox" id="toggle-plan" checked> City Centre Plan</label>
        <label><input type="checkbox" id="toggle-amenities" checked> Amenities</label>
        <label><input type="checkbox" id="toggle-buildings"> Existing buildings</label>
        <p class="overlay-legend">Massing height is illustrative where public data has no height field.</p>
      </div>
      <div class="detail-panel" id="detail-panel" hidden aria-live="polite">
        <button class="close-btn" id="close-detail" aria-label="Close project details">×</button>
        <div id="detail-content"></div>
      </div>
    </main>
  `;

  const style = document.createElement('style');
  style.textContent = '.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}';
  document.head.appendChild(style);

  setupTabs();
  setupFilters();
  setupCameraPresets();
  setupOverlayToggles();
  document.getElementById('close-detail').addEventListener('click', () => selectProject(null));
}

function setupTabs() {
  const tabs = document.querySelectorAll('.sidebar-tabs button');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        panel.hidden = !selected;
      });
    });
  });
}

function setupFilters() {
  document.getElementById('search').addEventListener('input', renderProjectList);
  document.getElementById('filter-area').addEventListener('change', renderProjectList);
  document.getElementById('filter-status').addEventListener('change', renderProjectList);
}

function setupCameraPresets() {
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => flyToPreset(btn.dataset.preset));
  });
}

function setupOverlayToggles() {
  const toggles = {
    'toggle-skytrain': ['skytrain-lines', 'skytrain-stations'],
    'toggle-ftda': ['ftda-fill'],
    'toggle-plan': ['city-centre-plan-fill'],
    'toggle-amenities': ['amenities-points'],
    'toggle-buildings': ['buildings-fill', 'buildings-extrusion'],
  };
  for (const [id, layers] of Object.entries(toggles)) {
    document.getElementById(id).addEventListener('change', (e) => {
      const vis = e.target.checked ? 'visible' : 'none';
      for (const layer of layers) {
        if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', vis);
      }
    });
  }
}

function flyToPreset(name) {
  const preset = CAMERA_PRESETS[name];
  if (!preset || !map) return;
  if (prefersReducedMotion) {
    map.jumpTo(preset);
  } else {
    map.flyTo({ ...preset, duration: 2000 });
  }
}

function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: CAMERA_PRESETS.overview.center,
    zoom: CAMERA_PRESETS.overview.zoom,
    pitch: 0,
    bearing: 0,
    antialias: true,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-left');
  map.addControl(
    new maplibregl.AttributionControl({ compact: true }),
    'bottom-right',
  );

  map.on('load', () => {
    addSourcesAndLayers();
    map.on('click', 'projects-extrusion', (e) => {
      if (e.features?.length) selectProject(e.features[0].properties.OBJECTID ?? e.features[0].properties.PROJECT_NO);
    });
    map.on('mouseenter', 'projects-extrusion', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'projects-extrusion', () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

function addSourcesAndLayers() {
  map.addSource('projects', { type: 'geojson', data: projectsFc });
  map.addSource('buildings', { type: 'geojson', data: window.__buildingsFc });
  map.addSource('city-centre-plan', { type: 'geojson', data: window.__planFc });
  map.addSource('ftda', { type: 'geojson', data: window.__ftdaFc });
  map.addSource('skytrain-lines', { type: 'geojson', data: window.__skytrainLinesFc });
  map.addSource('skytrain-stations', { type: 'geojson', data: window.__skytrainStationsFc });
  map.addSource('amenities', { type: 'geojson', data: window.__amenitiesFc });
  map.addSource('proximity-rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  map.addLayer({
    id: 'city-centre-plan-fill',
    type: 'fill',
    source: 'city-centre-plan',
    paint: { 'fill-color': '#6b9fd4', 'fill-opacity': 0.15 },
  });

  map.addLayer({
    id: 'ftda-fill',
    type: 'fill',
    source: 'ftda',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#9b7ed9', 'fill-opacity': 0.2 },
  });

  map.addLayer({
    id: 'buildings-fill',
    type: 'fill',
    source: 'buildings',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#aaa', 'fill-opacity': 0.15 },
  });

  map.addLayer({
    id: 'buildings-extrusion',
    type: 'fill-extrusion',
    source: 'buildings',
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': '#bbb',
      'fill-extrusion-height': ['coalesce', ['get', 'BUILDING_HEIGHT'], 8],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.35,
    },
  });

  map.addLayer({
    id: 'projects-extrusion',
    type: 'fill-extrusion',
    source: 'projects',
    paint: {
      'fill-extrusion-color': [
        'match',
        ['get', 'pilot_area'],
        'city_centre', '#1e4d8c',
        'fleetwood', '#2a7a4b',
        'campbell_heights', '#c45c26',
        '#555',
      ],
      'fill-extrusion-height': ['get', 'height_m'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.75,
    },
  });

  map.addLayer({
    id: 'skytrain-lines',
    type: 'line',
    source: 'skytrain-lines',
    paint: { 'line-color': '#003da5', 'line-width': 4 },
  });

  map.addLayer({
    id: 'skytrain-stations',
    type: 'circle',
    source: 'skytrain-stations',
    paint: {
      'circle-radius': 7,
      'circle-color': '#003da5',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'amenities-points',
    type: 'circle',
    source: 'amenities',
    paint: {
      'circle-radius': 6,
      'circle-color': '#2a7a4b',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
    },
  });

  map.addLayer({
    id: 'proximity-rings-fill',
    type: 'fill',
    source: 'proximity-rings',
    paint: {
      'fill-color': ['match', ['get', 'radius_m'], 400, '#f59e0b', '#ef4444'],
      'fill-opacity': 0.12,
    },
  });

  map.addLayer({
    id: 'proximity-rings-line',
    type: 'line',
    source: 'proximity-rings',
    paint: {
      'line-color': ['match', ['get', 'radius_m'], 400, '#f59e0b', '#ef4444'],
      'line-width': 2,
      'line-dasharray': [3, 2],
    },
  });
}

function populateStatusFilter() {
  const statuses = new Set(projectsFc.features.map((f) => f.properties.STATUS).filter(Boolean));
  const select = document.getElementById('filter-status');
  for (const s of [...statuses].sort()) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  }
}

function getFilteredProjects() {
  const q = document.getElementById('search').value.toLowerCase();
  const area = document.getElementById('filter-area').value;
  const status = document.getElementById('filter-status').value;
  return projectsFc.features.filter((f) => {
    const p = f.properties;
    if (area && p.pilot_area !== area) return false;
    if (status && p.STATUS !== status) return false;
    if (q) {
      const hay = `${p.PROJECT_NO} ${p.DESCRIPTION} ${p.STATUS}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderProjectList() {
  const list = document.getElementById('project-list');
  list.innerHTML = '';
  const filtered = getFilteredProjects();
  for (const f of filtered) {
    const p = f.properties;
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-current', String(projectId(p) === selectedId));
    btn.dataset.id = projectId(p);
    btn.innerHTML = `
      <strong>${escapeHtml(p.PROJECT_NO || 'N/A')}</strong><br>
      <span>${escapeHtml(truncate(p.DESCRIPTION, 80))}</span><br>
      <span class="area-tag">${escapeHtml(pilotAreaLabel(p.pilot_area))}</span>
      <span class="status">${escapeHtml(p.STATUS || '')}</span>
    `;
    btn.addEventListener('click', () => selectProject(projectId(p)));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function projectId(props) {
  return props.OBJECTID ?? props.PROJECT_NO;
}

function selectProject(id) {
  selectedId = id != null ? String(id) : null;
  renderProjectList();

  if (id === null) {
    document.getElementById('detail-panel').hidden = true;
    map.getSource('proximity-rings').setData({ type: 'FeatureCollection', features: [] });
    if (map.getLayer('projects-extrusion')) {
      map.setPaintProperty('projects-extrusion', 'fill-extrusion-opacity', 0.75);
    }
    return;
  }

  const feature = projectsFc.features.find((f) => String(projectId(f.properties)) === selectedId);
  if (!feature) return;

  const p = feature.properties;
  const nearest = nearestStation(feature, stations);
  const center = featureCentroid(feature);

  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('detail-content');
  panel.hidden = false;

  if (map?.loaded()) {
    if (center && map.getSource('proximity-rings')) {
      const rings = createProximityRingsGeoJSON(center);
      map.getSource('proximity-rings').setData(rings);
      if (prefersReducedMotion) {
        map.jumpTo({ center, zoom: 16, pitch: 50 });
      } else {
        map.flyTo({ center, zoom: 16, pitch: 50, duration: 1500 });
      }
    }

    const highlightId = projectId(p);
    if (map.getLayer('projects-extrusion')) {
      map.setPaintProperty('projects-extrusion', 'fill-extrusion-opacity', [
        'case',
        ['any',
          ['==', ['to-string', ['get', 'OBJECTID']], String(highlightId)],
          ['==', ['get', 'PROJECT_NO'], String(highlightId)],
        ],
        1,
        0.45,
      ]);
    }
  }

  let proximityHtml = '';
  if (nearest) {
    const name = nearest.station.properties.name || 'SkyTrain station';
    proximityHtml = `
      <div class="proximity">
        <strong>Nearest SkyTrain:</strong> ${escapeHtml(name)}<br>
        <strong>Straight-line distance:</strong> ${formatDistance(nearest.distanceM)}<br>
        <span>400 m and 800 m rings shown on map</span>
      </div>
    `;
  } else {
    proximityHtml = '<div class="proximity">No SkyTrain station found in data.</div>';
  }

  const heightNote = p.height_source === 'illustrative'
    ? '<p class="illustrative-note">Massing height is illustrative (no height in source data).</p>'
    : '';

  content.innerHTML = `
    <h2>${escapeHtml(p.PROJECT_NO || 'Project')}</h2>
    <dl>
      <dt>Description</dt><dd>${escapeHtml(p.DESCRIPTION || '—')}</dd>
      <dt>Status</dt><dd>${escapeHtml(p.STATUS || '—')}</dd>
      <dt>Pilot area</dt><dd>${escapeHtml(pilotAreaLabel(p.pilot_area))}</dd>
      <dt>Height</dt><dd>${p.height_m} m${heightNote}</dd>
      ${p.WEBLINK ? `<dt>Weblink</dt><dd><a href="${escapeAttr(p.WEBLINK)}" target="_blank" rel="noopener">${escapeHtml(p.WEBLINK)}</a></dd>` : ''}
      ${p.APPLICATION_DOCUMENTS_WEBLINK ? `<dt>Documents</dt><dd><a href="${escapeAttr(p.APPLICATION_DOCUMENTS_WEBLINK)}" target="_blank" rel="noopener">View documents</a></dd>` : ''}
    </dl>
    ${proximityHtml}
  `;
}

function renderAbout() {
  const el = document.getElementById('about-content');
  let licenceHtml = sourcesMeta
    .map(
      (s) =>
        `<div class="licence-item"><strong>${escapeHtml(s.file)}</strong> (${s.feature_count} features)<br>${escapeHtml(s.licence)}</div>`,
    )
    .join('');

  el.innerHTML = `
    <p>Public-data prototype by <strong>ParalleX Labs Inc.</strong> for City of Surrey RFP 1220-030-2026-063.</p>
    <p>Data: City of Surrey Open Data and OpenStreetMap contributors. Massing is illustrative where public data has no height.</p>
    <p>This is a prototype demonstration. It is not a City product and does not imply City endorsement.</p>
    <h3>Data sources (${projectsFc.features.length} projects)</h3>
    ${licenceHtml}
  `;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

async function main() {
  buildApp();

  const [projects, buildings, plan, ftda, skytrain, amenities, sources, pilotAreas] =
    await Promise.all([
      loadGeoJSON('development_projects'),
      loadGeoJSON('building_footprints'),
      loadGeoJSON('city_centre_plan'),
      loadGeoJSON('ftda'),
      loadGeoJSON('skytrain'),
      loadGeoJSON('amenities'),
      loadSources(),
      loadPilotAreas(),
    ]);

  projectsFc = projects;
  skytrainFc = skytrain;
  stations = getSkyTrainStations(skytrain);
  sourcesMeta = sources;

  window.__buildingsFc = buildings;
  window.__planFc = plan;
  window.__ftdaFc = ftda;
  window.__skytrainLinesFc = {
    type: 'FeatureCollection',
    features: skytrain.features.filter((f) => f.geometry?.type === 'LineString'),
  };
  window.__skytrainStationsFc = {
    type: 'FeatureCollection',
    features: stations,
  };
  window.__amenitiesFc = amenities;

  if (pilotAreas) {
    for (const [key, val] of Object.entries(pilotAreas)) {
      if (val.bbox && CAMERA_PRESETS[key]) {
        const [w, s, e, n] = val.bbox;
        CAMERA_PRESETS[key].center = [(w + e) / 2, (s + n) / 2];
      }
    }
  }

  populateStatusFilter();
  renderProjectList();
  renderAbout();
  initMap();
}

main().catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML =
    `<p role="alert">Failed to load data: ${err.message}. Run <code>npm run fetch-data</code> first.</p>`;
});
