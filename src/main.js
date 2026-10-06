import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import {
  loadGeoJSON,
  loadSources,
  loadPilotAreas,
  getSkyTrainStations,
  enrichProjects,
  pilotAreaLabel,
  pilotAreaLabelPoints,
  pilotAreaOutlines,
  SURREY_LICENCE_TEXT,
  SURREY_LICENCE_URL,
} from './data.js';
import {
  nearestStation,
  formatDistance,
  createProximityRingsGeoJSON,
  featureCentroid,
} from './proximity.js';
import { isShowcaseProject, underReviewLabel } from './showcase.js';
import { HEIGHT_LEGEND } from './heights.js';
import { projectTitle, projectPanelTitle, projectSubtitle } from './titles.js';
import { computeAtAGlance, formatAtAGlance } from './summary.js';
import { buildTourSteps, tourStepCamera } from './tour.js';
import { RINGS_EXPLANATION, STATUS_SOURCE } from './copy.js';
import { buildLocationHash, parseLocationHash } from './hashView.js';
import { methodologyModel } from './methodology.js';

const CAMERA_PRESETS = {
  overview: { center: [-122.8, 49.1], zoom: 11.2, pitch: 0, bearing: 0 },
  city_centre: { center: [-122.85, 49.19], zoom: 15.5, pitch: 30, bearing: -20 },
  fleetwood: { center: [-122.8, 49.16], zoom: 14.5, pitch: 35, bearing: 0 },
  campbell_heights: { center: [-122.694, 49.051], zoom: 13.2, pitch: 18, bearing: 0 },
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
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduce || options.instant || window.__cameraInstant === true;
}

function overviewPadding() {
  const narrow = window.innerWidth <= 768;
  if (narrow) return { top: 36, right: 18, bottom: 28, left: 16 };
  const controls = document.querySelector('.map-controls');
  const right = controls ? Math.ceil(controls.getBoundingClientRect().width) + 28 : 268;
  return { top: 48, right, bottom: 36, left: 28 };
}

function overviewBounds() {
  let west = SURREY_EXTENT.lonMin;
  let south = SURREY_EXTENT.latMin;
  let east = SURREY_EXTENT.lonMax;
  let north = SURREY_EXTENT.latMax;
  for (const area of Object.values(pilotAreasMeta || {})) {
    const bbox = area?.bbox;
    if (!bbox || bbox.length !== 4) continue;
    west = Math.min(west, bbox[0]);
    south = Math.min(south, bbox[1]);
    east = Math.max(east, bbox[2]);
    north = Math.max(north, bbox[3]);
  }
  for (const feature of pilotAreaLabelPoints(pilotAreasMeta).features) {
    const [lon, lat] = feature.geometry.coordinates;
    west = Math.min(west, lon);
    south = Math.min(south, lat);
    east = Math.max(east, lon);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

function campbellHeightsCamera() {
  const area = pilotAreasMeta?.campbell_heights;
  const bbox = area?.bbox;
  if (!map?.cameraForBounds || !bbox || bbox.length !== 4) return CAMERA_PRESETS.campbell_heights;
  const [west, south, east, north] = bbox;
  const fitted = map.cameraForBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding: 48, bearing: 0, pitch: 18 },
  );
  if (!fitted?.center) return CAMERA_PRESETS.campbell_heights;
  return {
    center: [fitted.center.lng, fitted.center.lat],
    zoom: fitted.zoom,
    bearing: 0,
    pitch: 18,
  };
}

function presetCamera(name) {
  if (name === 'overview') return overviewCamera();
  if (name === 'campbell_heights') return campbellHeightsCamera();
  return CAMERA_PRESETS[name];
}

function overviewCamera() {
  if (!map?.cameraForBounds) return CAMERA_PRESETS.overview;
  const fitted = map.cameraForBounds(overviewBounds(), {
    padding: overviewPadding(),
    bearing: 0,
    pitch: 0,
  });
  return fitted ? { ...fitted, bearing: 0, pitch: 0 } : CAMERA_PRESETS.overview;
}

const AMENITY_MIN_ZOOM = 13;
const PROJECT_MARKER_MAX_ZOOM = 13;

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
let applyingHash = false;
let currentView = null;
let detailReturn = null;
let overlaysPromise = null;
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

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

function startHereDismissed() {
  try {
    return sessionStorage.getItem('surrey-devviz-start-dismissed') === '1';
  } catch {
    return false;
  }
}

function buildApp() {
  const app = document.getElementById('app');
  const startHidden = startHereDismissed() ? ' hidden' : '';
  app.innerHTML = `
    <div class="chrome">
      <header class="app-header" role="banner">
        <div class="brand">
          <h1>Surrey Development Visualization</h1>
          <p class="subtitle">Public-data prototype by ParalleX Labs Inc.</p>
          <p class="what-this-is">A map of public development applications in three Surrey pilot areas.</p>
        </div>
      </header>
      <button type="button" id="open-methodology" class="methodology-open">Data and methodology</button>
      <div id="start-here" class="start-here"${startHidden}>
        <h2 id="start-here-title" class="start-here-title">Start here</h2>
        <div class="start-here-actions">
          <button type="button" id="start-explore">Explore projects</button>
          <button type="button" id="start-transit">Transit and amenities</button>
          <button type="button" id="start-3d">3D City Centre</button>
          <button type="button" id="start-dismiss">Dismiss</button>
        </div>
      </div>
    </div>
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
        <div id="phase-filters" class="phase-filters" hidden>
          <p id="phase-filters-label">Phase</p>
          <div id="phase-filter-group" role="group" aria-labelledby="phase-filters-label"></div>
        </div>
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
        <ul class="project-list" id="project-list" tabindex="-1" aria-label="Development projects"></ul>
      </div>
      <div class="sidebar-panel" id="panel-about" role="tabpanel" aria-labelledby="tab-about" hidden>
        <div class="about-content" id="about-content"></div>
      </div>
    </aside>
    <main class="map-area" id="main-content">
      <div id="map" role="application" aria-label="Interactive 3D map of Surrey development projects"></div>
      <div class="map-controls" aria-label="Map controls">
        <button type="button" id="start-guided" class="tour-start">Guided tour</button>
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
        <p class="rings-legend">${escapeHtml(RINGS_EXPLANATION)}</p>
      </div>
      <div class="tour-panel" id="tour-panel" hidden role="dialog" aria-modal="true" aria-labelledby="tour-title" tabindex="-1">
        <h2 id="tour-title"></h2>
        <p id="tour-caption"></p>
        <div class="tour-nav">
          <button type="button" id="tour-prev">Previous</button>
          <button type="button" id="tour-next">Next</button>
          <button type="button" id="tour-exit">Exit</button>
        </div>
      </div>
      <div id="methodology-drawer" class="methodology-drawer" hidden role="dialog" aria-modal="true" aria-labelledby="methodology-title">
        <div class="methodology-toolbar">
          <h2 id="methodology-title">Data and methodology</h2>
          <button type="button" id="close-methodology">Close</button>
        </div>
        <div id="methodology-content"></div>
      </div>
      <div class="detail-panel" id="detail-panel" hidden role="dialog" aria-labelledby="detail-title">
        <div class="detail-toolbar">
          <h2 id="detail-title"></h2>
          <button class="close-btn" id="close-detail" aria-label="Close project details">Close</button>
        </div>
        <div id="detail-content"></div>
      </div>
    </main>
    <footer class="app-footer" role="contentinfo">
      <p id="data-retrieved" hidden></p>
      <p>${escapeHtml(SURREY_LICENCE_TEXT)} <a href="${escapeAttr(SURREY_LICENCE_URL)}" target="_blank" rel="noopener">City of Surrey Open Data licence</a>. This prototype is not affiliated with or endorsed by the City of Surrey.</p>
    </footer>
  `;

  setupTabs();
  setupFilters();
  setupCameraPresets();
  setupOverlayToggles();
  setupTourControls();
  setupStartHere();
  setupMethodology();
  document.getElementById('close-detail').addEventListener('click', () => {
    selectProject(null, { restoreFocus: true });
  });
  document.getElementById('toggle-all-apps').addEventListener('change', (e) => {
    showAllApplications = e.target.checked;
    if (!showAllApplications) document.getElementById('filter-status').value = '';
    updateMapFilter();
    populateStatusFilter();
    renderPhaseFilters();
    renderProjectList();
    renderAtAGlance();
  });
  window.addEventListener('hashchange', () => {
    if (!applyingHash && map?.getSource('projects')) applyLocationHash();
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
  document.getElementById('filter-status').addEventListener('change', () => {
    updateMapFilter();
    renderProjectList();
    renderPhaseFilters();
  });
}

function setupCameraPresets() {
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => activatePreset(btn.dataset.preset));
  });
}

function setupOverlayToggles() {
  const toggles = {
    'toggle-skytrain': ['skytrain-lines', 'skytrain-stations'],
    'toggle-ftda': ['ftda-fill'],
    'toggle-plan': ['city-centre-plan-fill', 'city-centre-plan-line'],
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
  document.getElementById('start-guided').addEventListener('click', () => startTour());
  document.getElementById('tour-prev').addEventListener('click', () => stepTour(-1));
  document.getElementById('tour-next').addEventListener('click', () => stepTour(1));
  document.getElementById('tour-exit').addEventListener('click', () => endTour(true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.getElementById('methodology-drawer').hidden) {
        closeMethodology();
        return;
      }
      if (!document.getElementById('detail-panel').hidden) {
        e.preventDefault();
        selectProject(null, { restoreFocus: true });
        return;
      }
      if (tourIndex >= 0) endTour(true);
      return;
    }
    if (tourIndex < 0) return;
    if (e.key === 'ArrowRight') stepTour(1);
    if (e.key === 'ArrowLeft') stepTour(-1);
  });
}

function dismissStartHere() {
  document.getElementById('start-here').hidden = true;
  try {
    sessionStorage.setItem('surrey-devviz-start-dismissed', '1');
  } catch {
    /* storage unavailable */
  }
}

function setupStartHere() {
  document.getElementById('start-explore').addEventListener('click', () => {
    document.getElementById('project-list').focus();
  });
  document.getElementById('start-transit').addEventListener('click', () => {
    setOverlayChecked('toggle-skytrain', true);
    setOverlayChecked('toggle-amenities', true);
    activatePreset('city_centre');
  });
  document.getElementById('start-3d').addEventListener('click', () => activatePreset('city_centre'));
  document.getElementById('start-dismiss').addEventListener('click', dismissStartHere);
  document.getElementById('start-here').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dismissStartHere();
    }
  });
}

function setupMethodology() {
  document.getElementById('open-methodology').addEventListener('click', openMethodology);
  document.getElementById('close-methodology').addEventListener('click', closeMethodology);
}

function openMethodology() {
  const drawer = document.getElementById('methodology-drawer');
  drawer.hidden = false;
  document.getElementById('close-methodology').focus();
}

function closeMethodology() {
  document.getElementById('methodology-drawer').hidden = true;
  document.getElementById('open-methodology').focus();
}

function setOverlayChecked(id, checked) {
  const input = document.getElementById(id);
  if (!input) return;
  input.checked = checked;
  input.dispatchEvent(new Event('change'));
}

function activatePreset(name) {
  currentView = name;
  selectProject(null, { skipHash: true });
  flyToPreset(name);
  setLocationHash({ view: name });
}

function setLocationHash(state) {
  if (applyingHash) return;
  const next = buildLocationHash(state);
  const current = location.hash || '';
  if (current === next) return;
  const url = `${location.pathname}${location.search}${next}`;
  history.replaceState(null, '', url);
}

function applyLocationHash() {
  const parsed = parseLocationHash(location.hash);
  if (!parsed.view && !parsed.project) return;
  applyingHash = true;
  try {
    if (parsed.project) {
      const feature = projectsFc.features.find((f) => f.properties.PROJECT_NO === parsed.project);
      if (!feature) return;
      if (!showAllApplications && !isShowcaseProject(feature.properties)) {
        showAllApplications = true;
        document.getElementById('toggle-all-apps').checked = true;
        updateMapFilter();
        populateStatusFilter();
        renderPhaseFilters();
        renderAtAGlance();
      }
      currentView = parsed.view;
      selectProject(projectId(feature.properties), { skipHash: true });
      return;
    }
    if (parsed.view) {
      currentView = parsed.view;
      selectProject(null, { skipHash: true });
      flyToPreset(parsed.view);
    }
  } finally {
    applyingHash = false;
  }
}

function flyToPreset(name, options = {}) {
  const preset = options.camera || presetCamera(name);
  if (!preset || !map) return;
  if (cameraMovesInstantly(options)) map.jumpTo(preset);
  else map.flyTo({ ...preset, duration: 2000 });
  map.once('moveend', () => map.triggerRepaint());
}

function cameraForHash() {
  const parsed = parseLocationHash(location.hash);
  if (parsed.view && parsed.view !== 'overview' && CAMERA_PRESETS[parsed.view]) {
    return CAMERA_PRESETS[parsed.view];
  }
  return CAMERA_PRESETS.overview;
}

function guardNullComparisons(node) {
  if (Array.isArray(node)) {
    const [op, left, right] = node;
    if (
      (op === '<' || op === '<=' || op === '>' || op === '>=') &&
      Array.isArray(left) &&
      left[0] === 'get' &&
      typeof right === 'number'
    ) {
      return ['case', ['==', ['typeof', ['get', left[1]]], 'number'], node, false];
    }
    return node.map(guardNullComparisons);
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) node[key] = guardNullComparisons(node[key]);
  }
  return node;
}

async function loadBasemapStyle() {
  const response = await fetch('https://tiles.openfreemap.org/styles/liberty');
  if (!response.ok) throw new Error(`Basemap style failed: ${response.status}`);
  const style = await response.json();
  guardNullComparisons(style);
  for (const layer of style.layers || []) {
    const field = layer.layout?.['text-field'];
    if (Array.isArray(field) && field[0] === 'coalesce' && field.at(-1) !== '') field.push('');
  }
  const buildings = style.layers?.find((layer) => layer.id === 'building-3d');
  if (buildings?.paint) {
    buildings.paint['fill-extrusion-height'] = ['coalesce', ['get', 'render_height'], 0];
    buildings.paint['fill-extrusion-base'] = ['coalesce', ['get', 'render_min_height'], 0];
  }
  return style;
}

async function initMap() {
  const initial = cameraForHash();
  const style = await loadBasemapStyle();
  map = new maplibregl.Map({
    container: 'map',
    style,
    center: initial.center,
    zoom: initial.zoom,
    pitch: initial.pitch,
    bearing: initial.bearing || 0,
    antialias: true,
    preserveDrawingBuffer: window.__cameraInstant === true,
    attributionControl: false,
  });

  map.on('styleimagemissing', (event) => {
    if (map.hasImage(event.id)) return;
    map.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-left');
  map.addControl(
    new maplibregl.AttributionControl({
      compact: false,
      customAttribution: '<a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre</a>',
    }),
    'bottom-right',
  );
  window.__map = map;

  let lastMapSize = '';
  map.on('resize', () => {
    const size = `${map.getContainer().clientWidth}x${map.getContainer().clientHeight}`;
    if (size === lastMapSize) return;
    lastMapSize = size;
    if (!map.isStyleLoaded()) return;
    if (selectedId) return;
    if (currentView && currentView !== 'overview') return;
    flyToPreset('overview', { instant: true });
  });

  map.on('load', () => {
    map.resize();
    addSourcesAndLayers();
    const parsed = parseLocationHash(location.hash);
    if (parsed.view || parsed.project) applyLocationHash();
    else {
      currentView = 'overview';
      flyToPreset('overview', { instant: true });
    }
    map.once('idle', () => beginOverlayLoad());
    map.triggerRepaint();
    const selectFromMap = (e) => {
      if (e.features?.length) {
        selectProject(e.features[0].properties.OBJECTID ?? e.features[0].properties.PROJECT_NO);
      }
    };
    for (const layerId of ['projects-extrusion', 'projects-markers']) {
      map.on('click', layerId, selectFromMap);
      map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
      });
    }
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
  map.addSource('pilot-areas', { type: 'geojson', data: pilotAreaOutlines(pilotAreasMeta) });
  map.addSource('pilot-area-labels', { type: 'geojson', data: pilotAreaLabelPoints(pilotAreasMeta) });
  map.addSource('project-markers', { type: 'geojson', data: projectMarkerPoints(projectsFc) });
  map.addSource('proximity-rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('project-highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

  map.addLayer({
    id: 'city-centre-plan-fill',
    type: 'fill',
    source: 'city-centre-plan',
    paint: {
      'fill-color': '#6b9fd4',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.08, 13.5, 0.04, 14.5, 0],
    },
  });

  map.addLayer({
    id: 'city-centre-plan-line',
    type: 'line',
    source: 'city-centre-plan',
    paint: {
      'line-color': '#1e4d8c',
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 16, 1.25],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.2, 0.55, 16, 0.7],
    },
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
    id: 'pilot-areas-outline',
    type: 'line',
    source: 'pilot-areas',
    maxzoom: 14,
    paint: {
      'line-color': '#163a6b',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 3.5],
    },
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
      'fill-extrusion-height': ['coalesce', ['get', 'height_m'], 0],
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
      'fill-extrusion-height': ['coalesce', ['get', 'height_m'], 0],
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
    id: 'projects-markers',
    type: 'circle',
    source: 'project-markers',
    maxzoom: PROJECT_MARKER_MAX_ZOOM,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 5, 12.8, 8],
      'circle-color': [
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
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'amenities-points',
    type: 'circle',
    source: 'amenities',
    minzoom: AMENITY_MIN_ZOOM,
    paint: {
      'circle-radius': 6,
      'circle-color': '#2a7a4b',
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5,
    },
  });

  map.addLayer({
    id: 'pilot-areas-label',
    type: 'symbol',
    source: 'pilot-area-labels',
    maxzoom: AMENITY_MIN_ZOOM,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 14,
      'text-anchor': [
        'match',
        ['get', 'id'],
        'campbell_heights',
        'center',
        'bottom',
      ],
      'text-offset': [
        'match',
        ['get', 'id'],
        'campbell_heights',
        ['literal', [0, 0]],
        ['literal', [0, -0.35]],
      ],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#163a6b',
      'text-halo-color': '#ffffff',
      'text-halo-width': 3,
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
  const status = document.getElementById('filter-status')?.value || '';
  const clauses = [];
  if (!showAllApplications) clauses.push(['==', ['get', 'showcase'], true]);
  if (status) clauses.push(['==', ['get', 'STATUS'], status]);
  let filter = null;
  if (clauses.length === 1) filter = clauses[0];
  else if (clauses.length > 1) filter = ['all', ...clauses];
  map.setFilter('projects-extrusion', filter);
  if (map.getLayer('projects-markers')) map.setFilter('projects-markers', filter);
}

function projectMarkerPoints(fc) {
  const features = [];
  for (const feature of fc?.features || []) {
    const coordinates = featureCentroid(feature);
    if (!coordinates) continue;
    features.push({
      type: 'Feature',
      properties: feature.properties,
      geometry: { type: 'Point', coordinates },
    });
  }
  return { type: 'FeatureCollection', features };
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

function renderPhaseFilters() {
  const wrap = document.getElementById('phase-filters');
  if (!wrap || !projectsFc) return;
  wrap.hidden = !showAllApplications;
  const group = document.getElementById('phase-filter-group');
  group.innerHTML = '';
  if (!showAllApplications) return;
  const current = document.getElementById('filter-status').value;
  const statuses = [...new Set(projectsFc.features.map((f) => f.properties.STATUS).filter(Boolean))].sort();
  const options = [{ value: '', label: 'All statuses' }, ...statuses.map((status) => ({ value: status, label: status }))];
  for (const option of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'phase-filter';
    btn.textContent = option.label;
    btn.setAttribute('aria-pressed', String(current === option.value));
    btn.addEventListener('click', () => {
      const select = document.getElementById('filter-status');
      if (![...select.options].some((item) => item.value === option.value)) {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        select.appendChild(opt);
      }
      select.value = option.value;
      updateMapFilter();
      renderProjectList();
      renderPhaseFilters();
    });
    group.appendChild(btn);
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

function findProject(id) {
  const key = String(id);
  return projectsFc.features.find(
    (f) => String(projectId(f.properties)) === key || String(f.properties.PROJECT_NO) === key,
  );
}

function rememberDetailReturn(projectKey, opener) {
  const key = String(projectKey);
  const el = opener instanceof HTMLElement && opener !== document.body ? opener : null;
  detailReturn = () => {
    const fresh = document.querySelector(`.project-list button[data-id="${CSS.escape(key)}"]`);
    if (el && document.contains(el) && !el.closest('.project-list') && !el.closest('#detail-panel')) {
      el.focus();
      return;
    }
    if (fresh) fresh.focus();
    else if (el && document.contains(el)) el.focus();
  };
}

function selectProject(id, options = {}) {
  const panel = document.getElementById('detail-panel');
  const opening = id != null && panel.hidden;
  const opener = opening ? document.activeElement : null;
  selectedId = id != null ? String(id) : null;
  renderProjectList();

  if (id === null) {
    panel.hidden = true;
    document.getElementById('app').classList.remove('detail-open');
    map?.getSource('proximity-rings')?.setData({ type: 'FeatureCollection', features: [] });
    setProjectHighlight(null);
    if (!options.skipHash) setLocationHash({ view: currentView });
    if (options.restoreFocus && detailReturn) {
      const restore = detailReturn;
      detailReturn = null;
      restore();
    }
    return;
  }

  if (opening) rememberDetailReturn(id, opener);

  const feature = findProject(selectedId);
  if (!feature) return;

  const p = feature.properties;
  const nearest = nearestStation(feature, stations);
  const center = featureCentroid(feature);
  if (!options.skipHash) setLocationHash({ project: p.PROJECT_NO });

  panel.hidden = false;
  document.getElementById('app').classList.add('detail-open');
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

  const ringsHtml = `<p class="rings-note">${escapeHtml(RINGS_EXPLANATION)}</p>`;
  let proximityHtml = '';
  if (nearest) {
    const name = nearest.station.properties.name || 'SkyTrain station';
    proximityHtml = `
      <div class="proximity">
        <strong>Nearest SkyTrain:</strong> ${escapeHtml(name)}<br>
        <strong>Straight-line distance:</strong> ${formatDistance(nearest.distanceM)}<br>
        ${ringsHtml}
      </div>
    `;
  } else {
    proximityHtml = `<div class="proximity">No SkyTrain station found in data.${ringsHtml}</div>`;
  }

  document.getElementById('detail-title').textContent = plain(projectPanelTitle(p.DESCRIPTION));
  document.getElementById('detail-content').innerHTML = `
    <p class="project-no-detail">${escapeHtml(projectSubtitle(p))}</p>
    <dl>
      <dt>Status</dt><dd>${escapeHtml(p.STATUS || 'Not provided')}<span class="status-source">${escapeHtml(STATUS_SOURCE)}</span></dd>
      <dt>Height</dt><dd class="height-fact">${escapeHtml(p.height_label || '')}</dd>
      <dt>Pilot area</dt><dd>${escapeHtml(pilotAreaLabel(p.pilot_area))}</dd>
    </dl>
    ${proximityHtml}
    <dl>
      <dt>Description</dt><dd>${escapeHtml((p.DESCRIPTION || '').replace(/\r\n/g, ' ').trim() || 'Not provided')}</dd>
      ${p.WEBLINK ? `<dt>Weblink</dt><dd><a href="${escapeAttr(p.WEBLINK)}" target="_blank" rel="noopener">${escapeHtml(p.WEBLINK)}</a></dd>` : ''}
      ${p.APPLICATION_DOCUMENTS_WEBLINK ? `<dt>Documents</dt><dd><a href="${escapeAttr(p.APPLICATION_DOCUMENTS_WEBLINK)}" target="_blank" rel="noopener">View documents</a></dd>` : ''}
    </dl>
  `;
  document.getElementById('close-detail').focus();
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

function renderMethodology() {
  const model = methodologyModel(sourcesMeta);
  const retrieved = document.getElementById('data-retrieved');
  if (model.retrieved) {
    retrieved.hidden = false;
    retrieved.textContent = model.retrieved;
  }
  const parts = [];
  if (model.retrieved) parts.push(`<p>${escapeHtml(model.retrieved)}</p>`);
  for (const section of model.sections) {
    parts.push(`<h3>${escapeHtml(section.heading)}</h3>`);
    for (const paragraph of section.paragraphs) {
      parts.push(`<p>${escapeHtml(paragraph)}</p>`);
    }
  }
  document.getElementById('methodology-content').innerHTML = parts.join('');
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
    <p>This page does not use tracking or cookies. It does not load third-party scripts beyond the map tiles.</p>
    <p>Data: City of Surrey Open Data and OpenStreetMap contributors. Estimated heights use stated storeys × 3.2 m; other massing is illustrative.</p>
    <h3>Data sources (${projectsFc.features.length} applications)</h3>
    ${licenceHtml}
  `;
}

async function startTour() {
  await beginOverlayLoad();
  tourSteps = buildTourSteps(projectsFc, window.__skytrainFc, amenitiesFc, pilotAreasMeta);
  tourIndex = 0;
  showTourStep();
  if (document.getElementById('detail-panel').hidden) {
    document.getElementById('tour-panel').focus();
  }
}

function endTour(restoreFocus = false) {
  tourIndex = -1;
  const panel = document.getElementById('tour-panel');
  panel.hidden = true;
  announce('Tour ended');
  if (restoreFocus) document.getElementById('start-guided').focus();
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
  document.getElementById('tour-title').textContent = plain(step.title);
  document.getElementById('tour-caption').textContent = plain(step.caption);
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
    flyToPreset(null, { camera: customCamera });
  } else if (step.preset) {
    flyToPreset(step.preset);
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

function plain(value) {
  return String(value ?? '').replaceAll('\u2014', '-');
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = plain(s);
  return d.innerHTML;
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function beginOverlayLoad() {
  if (!overlaysPromise) overlaysPromise = loadDeferredOverlays();
  return overlaysPromise;
}

async function loadDeferredOverlays() {
  const [buildings, plan, ftda, amenities] = await Promise.all([
    loadGeoJSON('building_footprints'),
    loadGeoJSON('city_centre_plan'),
    loadGeoJSON('ftda'),
    loadGeoJSON('amenities'),
  ]);
  if (map?.getSource('buildings')) {
    map.getSource('buildings').setData(buildings);
    map.getSource('city-centre-plan').setData(plan);
    map.getSource('ftda').setData(ftda);
    map.getSource('amenities').setData(amenities);
  }
  amenitiesFc = amenities;
  window.__buildingsFc = buildings;
  window.__planFc = plan;
  window.__ftdaFc = ftda;
  window.__amenitiesFc = amenities;
  window.__overlaysReady = true;
}

async function main() {
  buildApp();

  const [projects, skytrain, sources, pilotAreas] = await Promise.all([
    loadGeoJSON('development_projects'),
    loadGeoJSON('skytrain'),
    loadSources(),
    loadPilotAreas(),
  ]);

  projectsFc = enrichProjects(projects);
  amenitiesFc = EMPTY_FC;
  pilotAreasMeta = pilotAreas;
  stations = getSkyTrainStations(skytrain);
  sourcesMeta = sources;

  window.__buildingsFc = EMPTY_FC;
  window.__planFc = EMPTY_FC;
  window.__ftdaFc = EMPTY_FC;
  window.__skytrainFc = skytrain;
  window.__skytrainLinesFc = {
    type: 'FeatureCollection',
    features: skytrain.features.filter((f) => f.geometry?.type === 'LineString'),
  };
  window.__skytrainStationsFc = { type: 'FeatureCollection', features: stations };
  window.__amenitiesFc = EMPTY_FC;
  window.__pilotAreasMeta = pilotAreas;
  window.__overlaysReady = false;
  applyPilotAreaPresets(pilotAreas);

  populateStatusFilter();
  renderPhaseFilters();
  renderProjectList();
  renderAtAGlance();
  renderAbout();
  renderMethodology();
  await initMap();
}

main().catch((err) => {
  console.error(err);
  document.getElementById('app').innerHTML =
    `<p role="alert">Failed to load data: ${err.message}. Run <code>npm run fetch-data</code> first.</p>`;
});
