import maplibregl from 'maplibre-gl';
import './styles.css';
import {
  loadGeoJSON,
  loadSources,
  loadPilotAreas,
  getSkyTrainStations,
  enrichProjects,
  pilotAreaLabel,
  SURREY_LICENCE_TEXT,
  SURREY_LICENCE_URL,
} from './data.js';
import {
  nearestStation,
  formatDistance,
  createProximityRingsGeoJSON,
  featureCentroid,
} from './proximity.js';
import { isShowcaseProject, isUnderReviewStatus, underReviewLabel } from './showcase.js';
import { HEIGHT_LEGEND } from './heights.js';
import { projectTitle, projectSubtitle } from './titles.js';
import { computeAtAGlance, formatAtAGlance } from './summary.js';
import { buildTourSteps, tourStepCamera } from './tour.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CAMERA_PRESETS = {
  overview: { center: [-122.8, 49.1], zoom: 11.2, pitch: 0, bearing: 0 },
  city_centre: { center: [-122.85, 49.19], zoom: 15.5, pitch: 30, bearing: -20 },
  fleetwood: { center: [-122.8, 49.16], zoom: 14.5, pitch: 35, bearing: 0 },
  campbell_heights: { center: [-122.78, 49.085], zoom: 12.4, pitch: 25, bearing: 0 },
};

const SURREY_EXTENT = {
  lonMin: -122.92,
  lonMax: -122.68,
  latMin: 49.0,
  latMax: 49.2,
};

function applyPilotAreaPresets(pilotAreas) {
  if (!pilotAreas) return;
  for (const [key, val] of Object.entries(pilotAreas)) {
    if (!val.bbox || !CAMERA_PRESETS[key] || key === 'overview') continue;
    const [w, s, e, n] = val.bbox;
    CAMERA_PRESETS[key].center = [(w + e) / 2, (s + n) / 2];
  }
}

function cameraMovesInstantly(options = {}) {
  return prefersReducedMotion || options.instant || window.__cameraInstant === true;
}

function overviewCamera() {
  if (!map?.cameraForBounds) return CAMERA_PRESETS.overview;
  const fitted = map.cameraForBounds(
    [
      [SURREY_EXTENT.lonMin, SURREY_EXTENT.latMin],
      [SURREY_EXTENT.lonMax, SURREY_EXTENT.latMax],
    ],
    { padding: 16, bearing: 0, pitch: 0 },
  );
  return fitted ? { ...fitted, bearing: 0, pitch: 0 } : CAMERA_PRESETS.overview;
}

const AREA_COLORS = {
  city_centre: { estimated: '#1e6fd4', illustrative: '#8eb8e8' },
  fleetwood: { estimated: '#2a9a55', illustrative: '#8fd4a8' },
  campbell_heights: { estimated: '#d96a28', illustrative: '#e8b08a' },
  default: { estimated: '#555555', illustrative: '#aaaaaa' },
};

let map;
let projectsFc;
let amenitiesFc;
let pilotAreasMeta;
let stations = [];
let selectedId = null;
let sourcesMeta = [];
let showAllApplications = false;
let tourSteps = [];
let tourIndex = -1;
let atAGlance = null;

const DEFAULT_PAINT = {
  'fill-extrusion-color': [
    'match',
    ['get', 'height_source'],
    'estimated',
    [
      'match',
      ['get', 'pilot_area'],
      'city_centre',
      AREA_COLORS.city_centre.estimated,
      'fleetwood',
      AREA_COLORS.fleetwood.estimated,
      'campbell_heights',
      AREA_COLORS.campbell_heights.estimated,
      AREA_COLORS.default.estimated,
    ],
    [
      'match',
      ['get', 'pilot_area'],
      'city_centre',
      AREA_COLORS.city_centre.illustrative,
      'fleetwood',
      AREA_COLORS.fleetwood.illustrative,
      'campbell_heights',
      AREA_COLORS.campbell_heights.illustrative,
      AREA_COLORS.default.illustrative,
    ],
  ],
};

function buildApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="app-header" role="banner">
      <h1>Surrey Development Visualization</h1>
      <span class="subtitle">Public-data prototype by ParalleX Labs Inc.</span>
    </header>
    <aside class="sidebar" id="sidebar" aria-label="Project list and information">
      <div class="sidebar-tabs" role="tablist">
        <button role="tab" id="tab-projects" aria-selected="true" aria-controls="panel-projects">Projects</button>
        <button role="tab" id="tab-about" aria-selected="false" aria-controls="panel-about">About</button>
      </div>
      <div class="sidebar-panel" id="panel-projects" role="tabpanel" aria-labelledby="tab-projects">
        <section class="at-a-glance" id="at-a-glance" aria-label="At a glance summary"></section>
        <label class="toggle-row">
          <input type="checkbox" id="toggle-all-apps" aria-describedby="all-apps-hint">
          All applications
        </label>
        <p id="all-apps-hint" class="hint">Default view shows approved showcase projects only.</p>
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
        <button type="button" id="start-tour" class="tour-start">Start tour</button>
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
        <h2 class="legend-heading">Massing legend</h2>
        <ul class="height-legend" aria-label="Massing height legend">
          <li><span class="swatch swatch-estimated" aria-hidden="true"></span> ${HEIGHT_LEGEND.estimated}</li>
          <li><span class="swatch swatch-illustrative" aria-hidden="true"></span> ${HEIGHT_LEGEND.illustrative}</li>
        </ul>
      </div>
      <div class="tour-panel" id="tour-panel" hidden role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <h2 id="tour-title"></h2>
        <p id="tour-caption"></p>
        <div class="tour-nav">
          <button type="button" id="tour-prev">Previous</button>
          <button type="button" id="tour-next">Next</button>
          <button type="button" id="tour-exit">Exit</button>
        </div>
      </div>
      <div class="detail-panel" id="detail-panel" hidden aria-live="polite">
        <button class="close-btn" id="close-detail" aria-label="Close project details">×</button>
        <div id="detail-content"></div>
      </div>
    </main>
    <footer class="app-footer" role="contentinfo">
      <p>${escapeHtml(SURREY_LICENCE_TEXT)} <a href="${escapeAttr(SURREY_LICENCE_URL)}" target="_blank" rel="noopener">City of Surrey Open Data licence</a>. This prototype is not affiliated with or endorsed by the City of Surrey.</p>
    </footer>
  `;

  setupTabs();
  setupFilters();
  setupCameraPresets();
  setupOverlayToggles();
  setupTourControls();
  document.getElementById('close-detail').addEventListener('click', () => selectProject(null));
  document.getElementById('toggle-all-apps').addEventListener('change', (e) => {
    showAllApplications = e.target.checked;
    updateMapFilter();
    populateStatusFilter();
    renderProjectList();
    renderAtAGlance();
  });
}

function setupTabs() {
  const tabs = document.querySelectorAll('.sidebar-tabs button');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
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
        if (map?.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', vis);
      }
    });
  }
}

function setupTourControls() {
  document.getElementById('start-tour').addEventListener('click', () => startTour());
  document.getElementById('tour-prev').addEventListener('click', () => stepTour(-1));
  document.getElementById('tour-next').addEventListener('click', () => stepTour(1));
  document.getElementById('tour-exit').addEventListener('click', () => endTour());
  document.addEventListener('keydown', (e) => {
    if (tourIndex < 0) return;
    if (e.key === 'Escape') endTour();
    if (e.key === 'ArrowRight') stepTour(1);
    if (e.key === 'ArrowLeft') stepTour(-1);
  });
}

function flyToPreset(name, options = {}) {
  const preset = options.camera || (name === 'overview' ? overviewCamera() : CAMERA_PRESETS[name]);
  if (!preset || !map) return;
  if (cameraMovesInstantly(options)) map.jumpTo(preset);
  else map.flyTo({ ...preset, duration: 2000 });
  map.once('moveend', () => map.triggerRepaint());
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
    preserveDrawingBuffer: true,
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-left');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  window.__map = map;

  map.on('load', () => {
    map.resize();
    addSourcesAndLayers();
    flyToPreset('overview', { instant: true });
    map.on('click', 'projects-extrusion', (e) => {
      if (e.features?.length) {
        selectProject(e.features[0].properties.OBJECTID ?? e.features[0].properties.PROJECT_NO);
      }
    });
    map.on('mouseenter', 'projects-extrusion', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'projects-extrusion', () => {
      map.getCanvas().style.cursor = '';
    });
    updateMapFilter();
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
  map.addSource('project-highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

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
      ...DEFAULT_PAINT,
      'fill-extrusion-height': ['get', 'height_m'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.8,
    },
  });

  map.addLayer({
    id: 'project-highlight-extrusion',
    type: 'fill-extrusion',
    source: 'project-highlight',
    paint: {
      'fill-extrusion-color': '#ffcc00',
      'fill-extrusion-height': ['get', 'height_m'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.95,
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

function updateMapFilter() {
  if (!map?.getLayer('projects-extrusion')) return;
  map.setFilter(
    'projects-extrusion',
    showAllApplications ? null : ['==', ['get', 'showcase'], true],
  );
}

function populateStatusFilter() {
  const visible = getVisibleProjects();
  const statuses = new Set(visible.map((f) => f.properties.STATUS).filter(Boolean));
  const select = document.getElementById('filter-status');
  select.innerHTML = '<option value="">All statuses</option>';
  for (const s of [...statuses].sort()) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  }
}

function getVisibleProjects() {
  return projectsFc.features.filter((f) => showAllApplications || isShowcaseProject(f.properties));
}

function getFilteredProjects() {
  const q = document.getElementById('search').value.toLowerCase();
  const area = document.getElementById('filter-area').value;
  const status = document.getElementById('filter-status').value;
  return getVisibleProjects().filter((f) => {
    const p = f.properties;
    if (area && p.pilot_area !== area) return false;
    if (status && p.STATUS !== status) return false;
    if (q) {
      const hay = `${p.PROJECT_NO} ${p.DESCRIPTION} ${p.display_title} ${p.STATUS}`.toLowerCase();
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
    const review = underReviewLabel(p.STATUS);
    btn.innerHTML = `
      <strong>${escapeHtml(p.display_title || projectTitle(p.DESCRIPTION))}</strong><br>
      <span class="project-no">${escapeHtml(projectSubtitle(p))}</span><br>
      <span class="area-tag">${escapeHtml(pilotAreaLabel(p.pilot_area))}</span>
      ${review ? `<span class="under-review-label">${escapeHtml(review)}</span>` : `<span class="status">${escapeHtml(p.STATUS || '')}</span>`}
    `;
    btn.addEventListener('click', () => selectProject(projectId(p)));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function projectId(props) {
  return props.OBJECTID ?? props.PROJECT_NO;
}

function setProjectHighlight(feature) {
  if (!map?.getSource('project-highlight')) return;
  map.getSource('project-highlight').setData({
    type: 'FeatureCollection',
    features: feature ? [feature] : [],
  });
}

function selectProject(id) {
  selectedId = id != null ? String(id) : null;
  renderProjectList();

  if (id === null) {
    document.getElementById('detail-panel').hidden = true;
    map?.getSource('proximity-rings')?.setData({ type: 'FeatureCollection', features: [] });
    setProjectHighlight(null);
    return;
  }

  const feature = projectsFc.features.find((f) => String(projectId(f.properties)) === selectedId);
  if (!feature) return;

  const p = feature.properties;
  const nearest = nearestStation(feature, stations);
  const center = featureCentroid(feature);

  document.getElementById('detail-panel').hidden = false;
  setProjectHighlight(feature);

  const applyProjectMapView = () => {
    if (!map?.getSource('proximity-rings') || !center) return;
    map.getSource('proximity-rings').setData(createProximityRingsGeoJSON(center));
    const projectCamera = { center, zoom: 16, pitch: 45, bearing: 0 };
    if (cameraMovesInstantly()) map.jumpTo(projectCamera);
    else map.flyTo({ ...projectCamera, duration: 1500 });
    map.once('moveend', () => map.triggerRepaint());
  };

  if (map?.getSource('proximity-rings')) {
    applyProjectMapView();
  } else if (map) {
    map.once('load', applyProjectMapView);
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

  const review = underReviewLabel(p.STATUS);
  document.getElementById('detail-content').innerHTML = `
    <h2>${escapeHtml(p.display_title || projectTitle(p.DESCRIPTION))}</h2>
    <p class="project-no-detail">${escapeHtml(projectSubtitle(p))}</p>
    <dl>
      <dt>Description</dt><dd>${escapeHtml((p.DESCRIPTION || '').replace(/\r\n/g, ' ').trim() || 'Not provided')}</dd>
      <dt>Status</dt><dd>${review ? `${escapeHtml(review)} (${escapeHtml(p.STATUS || '')})` : escapeHtml(p.STATUS || 'Not provided')}</dd>
      <dt>Pilot area</dt><dd>${escapeHtml(pilotAreaLabel(p.pilot_area))}</dd>
      <dt>Height</dt><dd>${p.height_m} m <span class="height-label">(${escapeHtml(p.height_label)})</span></dd>
      ${p.WEBLINK ? `<dt>Weblink</dt><dd><a href="${escapeAttr(p.WEBLINK)}" target="_blank" rel="noopener">${escapeHtml(p.WEBLINK)}</a></dd>` : ''}
      ${p.APPLICATION_DOCUMENTS_WEBLINK ? `<dt>Documents</dt><dd><a href="${escapeAttr(p.APPLICATION_DOCUMENTS_WEBLINK)}" target="_blank" rel="noopener">View documents</a></dd>` : ''}
    </dl>
    ${proximityHtml}
  `;
}

function renderAtAGlance() {
  atAGlance = computeAtAGlance(
    showAllApplications ? projectsFc.features : projectsFc.features.filter((f) => isShowcaseProject(f.properties)),
    stations,
  );
  const el = document.getElementById('at-a-glance');
  el.innerHTML = `<h2>At a glance</h2><ul>${formatAtAGlance(atAGlance)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('')}</ul>`;
}

function renderAbout() {
  const el = document.getElementById('about-content');
  const licenceHtml = sourcesMeta
    .map((s) => {
      const licence = s.licence?.includes('City of Surrey')
        ? `${SURREY_LICENCE_TEXT} <a href="${escapeAttr(SURREY_LICENCE_URL)}" target="_blank" rel="noopener">Licence details</a>`
        : escapeHtml(s.licence);
      return `<div class="licence-item"><strong>${escapeHtml(s.file)}</strong> (${s.feature_count} features)<br>${licence}</div>`;
    })
    .join('');

  el.innerHTML = `
    <p>Public-data prototype by <strong>ParalleX Labs Inc.</strong> for City of Surrey RFP 1220-030-2026-063.</p>
    <p>${escapeHtml(SURREY_LICENCE_TEXT)} <a href="${escapeAttr(SURREY_LICENCE_URL)}" target="_blank" rel="noopener">City of Surrey Open Data licence</a>.</p>
    <p>This prototype is not affiliated with or endorsed by the City of Surrey.</p>
    <p>Data: City of Surrey Open Data and OpenStreetMap contributors. Estimated heights use stated storeys × 3.2 m; other massing is illustrative.</p>
    <h3>Data sources (${projectsFc.features.length} applications)</h3>
    ${licenceHtml}
  `;
}

function startTour() {
  tourSteps = buildTourSteps(projectsFc, window.__skytrainFc, amenitiesFc, pilotAreasMeta);
  tourIndex = 0;
  showTourStep();
}

function endTour() {
  tourIndex = -1;
  const panel = document.getElementById('tour-panel');
  panel.hidden = true;
  announce('Tour ended');
}

function stepTour(delta) {
  if (tourIndex < 0) return;
  const next = tourIndex + delta;
  if (next < 0 || next >= tourSteps.length) return;
  tourIndex = next;
  showTourStep();
}

function showTourStep() {
  const step = tourSteps[tourIndex];
  const panel = document.getElementById('tour-panel');
  panel.hidden = false;
  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-caption').textContent = step.caption;
  document.getElementById('tour-prev').disabled = tourIndex === 0;
  document.getElementById('tour-next').disabled = tourIndex === tourSteps.length - 1;
  announce(`Tour step ${tourIndex + 1} of ${tourSteps.length}: ${step.title}. ${step.caption}`);

  if (step.toggles) {
    if (step.toggles.skytrain != null) {
      document.getElementById('toggle-skytrain').checked = step.toggles.skytrain;
      document.getElementById('toggle-skytrain').dispatchEvent(new Event('change'));
    }
    if (step.toggles.plan != null) {
      document.getElementById('toggle-plan').checked = step.toggles.plan;
      document.getElementById('toggle-plan').dispatchEvent(new Event('change'));
    }
  }

  const customCamera = tourStepCamera(step, pilotAreasMeta, projectsFc);
  if (customCamera) {
    flyToPreset(null, { camera: customCamera, instant: prefersReducedMotion });
  } else if (step.preset) {
    flyToPreset(step.preset, { instant: prefersReducedMotion });
  }

  if (step.focusId) selectProject(step.focusId);
}

function announce(message) {
  let live = document.getElementById('sr-announcer');
  if (!live) {
    live = document.createElement('div');
    live.id = 'sr-announcer';
    live.className = 'visually-hidden';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    document.body.appendChild(live);
  }
  live.textContent = message;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
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

  projectsFc = enrichProjects(projects);
  amenitiesFc = amenities;
  pilotAreasMeta = pilotAreas;
  stations = getSkyTrainStations(skytrain);
  sourcesMeta = sources;

  window.__buildingsFc = buildings;
  window.__planFc = plan;
  window.__ftdaFc = ftda;
  window.__skytrainFc = skytrain;
  window.__skytrainLinesFc = {
    type: 'FeatureCollection',
    features: skytrain.features.filter((f) => f.geometry?.type === 'LineString'),
  };
  window.__skytrainStationsFc = { type: 'FeatureCollection', features: stations };
  window.__amenitiesFc = amenities;
  window.__pilotAreasMeta = pilotAreas;
  applyPilotAreaPresets(pilotAreas);

  populateStatusFilter();
  renderProjectList();
  renderAtAGlance();
  renderAbout();
  initMap();
}

main().catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML =
    `<p role="alert">Failed to load data: ${err.message}. Run <code>npm run fetch-data</code> first.</p>`;
});
