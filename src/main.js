import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import {
  loadGeoJSON,
  loadSources,
  loadPilotAreas,
  loadCivicPlaces,
  loadCityCentrePlanLive,
  civicPlacesGeoJSON,
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
  createProximityRingsGeoJSON,
  featureReferencePoint,
} from './proximity.js';
import { isShowcaseProject, underReviewLabel } from './showcase.js';
import { HEIGHT_LEGEND } from './heights.js';
import { projectTitle, projectSubtitle } from './titles.js';
import {
  computeAtAGlance,
  formatAtAGlance,
  renderAtAGlanceItemHtml,
} from './summary.js';
import { buildTourSteps } from './tour.js';
import { projectPanelModel, safeHttpUrl } from './detail.js';
import { BUILD_ID } from './buildInfo.js';
import {
  ACCESSIBILITY_STATEMENT,
  AREA_COUNT_NOTE,
  EXTRUSION_LIMIT,
  EXTRUSION_NAME,
  NON_AFFILIATION,
  OPENING_LAYERS,
  PAGE_TITLE,
  PURPOSE_LINE,
  RINGS_EXPLANATION,
  SHOWCASE_CLOSING,
  areaCountLine,
} from './copy.js';
import { buildLocationHash, parseLocationHash, resolveHashTarget, sameRecordId } from './hashView.js';
import { methodologyModel } from './methodology.js';
import { testHooksEnabled } from './testHooks.js';

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
  return reduce || options.instant || (testHooksEnabled() && window.__cameraInstant === true);
}

function expose(name, value) {
  if (testHooksEnabled()) window[name] = value;
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

const AREA_BY_PRESET = {
  city_centre: 'city-centre',
  fleetwood: 'fleetwood',
  campbell_heights: 'campbell-heights',
};

const PILOT_BY_AREA = {
  'city-centre': 'city_centre',
  fleetwood: 'fleetwood',
  'campbell-heights': 'campbell_heights',
};

const LAYER_TOGGLES = {
  skytrain: 'toggle-skytrain',
  ftda: 'toggle-ftda',
  plan: 'toggle-plan',
  amenities: 'toggle-amenities',
  buildings: 'toggle-buildings',
  civic: 'toggle-civic',
};

let map;
let projectsFc;
let amenitiesFc;
let civicData;
let pilotAreasMeta;
let stations = [];
let selectedId = null;
let selectedCivicId = null;
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
let buildingsFc = EMPTY_FC;
let planFc = EMPTY_FC;
let ftdaFc = EMPTY_FC;
let skytrainFc = EMPTY_FC;
let skytrainLinesFc = EMPTY_FC;
let skytrainStationsFc = EMPTY_FC;
let planLive = false;
let overlaysReady = false;

function publishOverlays() {
  expose('__buildingsFc', buildingsFc);
  expose('__planFc', planFc);
  expose('__ftdaFc', ftdaFc);
  expose('__skytrainFc', skytrainFc);
  expose('__skytrainLinesFc', skytrainLinesFc);
  expose('__skytrainStationsFc', skytrainStationsFc);
  expose('__amenitiesFc', amenitiesFc);
  expose('__pilotAreasMeta', pilotAreasMeta);
  expose('__overlaysReady', overlaysReady);
  expose('__planLive', planLive);
}

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
    <div id="sr-announcer" class="visually-hidden" aria-live="polite" aria-atomic="true"></div>
    <div class="chrome">
      <header class="app-header" role="banner">
        <div class="brand">
          <h1>${escapeHtml(PAGE_TITLE)}</h1>
          <p class="what-this-is">${escapeHtml(PURPOSE_LINE)}</p>
          <div class="header-actions">
            <button type="button" id="start-showcase" class="btn-primary">Start the showcase</button>
            <button type="button" id="browse-list" class="btn-secondary">Browse without the map</button>
          </div>
        </div>
      </header>
      <button type="button" id="open-methodology" class="methodology-open">Data and methodology</button>
    </div>
    <aside class="sidebar" id="sidebar" aria-label="Project list and information">
      <div class="sidebar-tabs">
        <button type="button" id="tab-projects" aria-pressed="true" aria-controls="panel-projects">Projects</button>
        <button type="button" id="tab-about" aria-pressed="false" aria-controls="panel-about">About</button>
      </div>
      <div class="sidebar-panel" id="panel-projects">
        <section class="at-a-glance" id="at-a-glance" aria-label="At a glance summary"></section>
        <section id="area-card" class="area-card" hidden></section>
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
        <h2 id="civic-heading" class="civic-heading">Civic investments and destinations</h2>
        <ul class="civic-list" id="civic-list" aria-labelledby="civic-heading"></ul>
      </div>
      <div class="sidebar-panel" id="panel-about" hidden>
        <div class="about-content" id="about-content"></div>
      </div>
    </aside>
    <main class="map-area" id="main-content" tabindex="-1">
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
        <label><input type="checkbox" id="toggle-civic" checked> Civic investments and destinations</label>
        <label><input type="checkbox" id="toggle-amenities"> Amenities</label>
        <label><input type="checkbox" id="toggle-buildings"> Existing buildings</label>
        <h2 class="legend-heading">${escapeHtml(EXTRUSION_NAME)}</h2>
        <ul class="height-legend" aria-label="${escapeAttr(EXTRUSION_NAME)}">
          <li><span class="swatch swatch-estimated" aria-hidden="true"></span> ${HEIGHT_LEGEND.estimated}</li>
          <li><span class="swatch swatch-illustrative" aria-hidden="true"></span> ${HEIGHT_LEGEND.illustrative}</li>
        </ul>
        <p class="massing-note">${escapeHtml(EXTRUSION_LIMIT)}</p>
        <p class="rings-legend">${escapeHtml(RINGS_EXPLANATION)}</p>
      </div>
      <div class="tour-panel" id="tour-panel" hidden role="dialog" aria-modal="true" aria-labelledby="tour-title" tabindex="-1">
        <h2 id="tour-title"></h2>
        <p id="tour-caption"></p>
        <p id="tour-closing" hidden></p>
        <div class="tour-nav">
          <button type="button" id="tour-prev">Previous</button>
          <button type="button" id="tour-next">Next</button>
          <button type="button" id="tour-exit">End showcase</button>
        </div>
      </div>
      <div id="methodology-drawer" class="methodology-drawer" hidden role="dialog" aria-modal="true" aria-labelledby="methodology-title" tabindex="-1">
        <div class="methodology-toolbar">
          <h2 id="methodology-title">Data and methodology</h2>
          <button type="button" id="close-methodology">Close</button>
        </div>
        <div id="methodology-content"></div>
      </div>
      <div class="detail-panel" id="detail-panel" hidden role="dialog" aria-labelledby="detail-title">
        <div class="detail-toolbar">
          <h2 id="detail-title"></h2>
          <button class="close-btn" id="close-detail" aria-label="Close details">Close</button>
        </div>
        <div id="detail-content"></div>
      </div>
    </main>
    <footer class="app-footer" role="contentinfo">
      <p id="data-retrieved" hidden></p>
      <p>${escapeHtml(SURREY_LICENCE_TEXT)} ${externalAnchor(SURREY_LICENCE_URL, 'City of Surrey Open Data licence')}.</p>
      <p class="quiet-line">${escapeHtml(NON_AFFILIATION)}</p>
    </footer>
  `;

  setupTabs();
  setupFilters();
  setupCameraPresets();
  setupOverlayToggles();
  setupTourControls();
  setupHeaderActions();
  setupMethodology();
  document.getElementById('close-detail').addEventListener('click', () => {
    selectProject(null, { restoreFocus: true });
  });
  document.getElementById('toggle-all-apps').addEventListener('change', (e) => {
    showAllApplications = e.target.checked;
    const select = document.getElementById('filter-status');
    const previous = showAllApplications ? select.value : '';
    populateStatusFilter();
    if ([...select.options].some((item) => item.value === previous)) select.value = previous;
    else select.value = '';
    updateMapFilter();
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
        t.setAttribute('aria-pressed', String(selected));
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
    'toggle-civic': ['civic-symbols'],
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
  document.getElementById('tour-prev').addEventListener('click', () => stepTour(-1));
  document.getElementById('tour-next').addEventListener('click', () => stepTour(1));
  document.getElementById('tour-exit').addEventListener('click', () => endTour(true));
  document.addEventListener('keydown', (e) => {
    trapDialogTab(e);
    if (e.key === 'Escape') {
      if (!document.getElementById('methodology-drawer').hidden) {
        closeMethodology();
        return;
      }
      if (tourIndex >= 0) {
        e.preventDefault();
        selectProject(null, { skipHash: true });
        endTour(true);
        return;
      }
      if (!document.getElementById('detail-panel').hidden) {
        e.preventDefault();
        selectProject(null, { restoreFocus: true });
      }
      return;
    }
    if (tourIndex < 0) return;
    if (e.key === 'ArrowRight') stepTour(1);
    if (e.key === 'ArrowLeft') stepTour(-1);
  });
}

function setupHeaderActions() {
  document.getElementById('start-showcase').addEventListener('click', () => startTour());
  document.getElementById('browse-list').addEventListener('click', () => {
    document.getElementById('tab-projects').click();
    document.getElementById('project-list').focus();
  });
}

function setupMethodology() {
  document.getElementById('open-methodology').addEventListener('click', openMethodology);
  document.getElementById('close-methodology').addEventListener('click', closeMethodology);
}

const MODAL_INERT = [
  '.skip-link',
  '.chrome',
  '#sidebar',
  '#map',
  '.map-controls',
  '#tour-panel',
  '#methodology-drawer',
  '#detail-panel',
  '.app-footer',
];

function setModalInert(active) {
  for (const selector of MODAL_INERT) {
    const el = document.querySelector(selector);
    if (el) el.inert = el !== active;
  }
}

function clearModalInert() {
  for (const selector of MODAL_INERT) {
    const el = document.querySelector(selector);
    if (el) el.inert = false;
  }
}

function openDialog(dialog, opener) {
  dialog.returnFocus = opener instanceof HTMLElement ? opener : null;
  setModalInert(dialog);
  dialog.hidden = false;
}

function closeDialog(dialog, fallback) {
  dialog.hidden = true;
  clearModalInert();
  const back = dialog.returnFocus;
  dialog.returnFocus = null;
  const target = back && document.contains(back) ? back : fallback;
  target?.focus();
}

function trapDialogTab(event) {
  if (event.key !== 'Tab') return;
  const dialog = [...document.querySelectorAll('#tour-panel, #methodology-drawer')].find(
    (el) => !el.hidden,
  );
  if (!dialog) return;
  const items = [...dialog.querySelectorAll('button, a[href], input, select, textarea')].filter(
    (el) => !el.disabled,
  );
  if (!items.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!dialog.contains(active) || active === dialog) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function openMethodology() {
  const drawer = document.getElementById('methodology-drawer');
  openDialog(drawer, document.activeElement);
  document.getElementById('close-methodology').focus();
}

function closeMethodology() {
  closeDialog(document.getElementById('methodology-drawer'), document.getElementById('open-methodology'));
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
  renderAreaCard(AREA_BY_PRESET[name] || null);
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
  const target = resolveHashTarget(parseLocationHash(location.hash), projectsFc?.features || []);
  if (target.kind === 'none') return;
  applyingHash = true;
  try {
    if (target.kind === 'project') {
      const feature = target.feature;
      if (!showAllApplications && !isShowcaseProject(feature.properties)) {
        showAllApplications = true;
        document.getElementById('toggle-all-apps').checked = true;
        const select = document.getElementById('filter-status');
        const previous = select.value;
        populateStatusFilter();
        if ([...select.options].some((item) => item.value === previous)) select.value = previous;
        updateMapFilter();
        renderPhaseFilters();
        renderAtAGlance();
      }
      currentView = target.view;
      selectProject(projectId(feature.properties), { skipHash: true });
      return;
    }
    currentView = target.view;
    selectProject(null, { skipHash: true });
    renderAreaCard(AREA_BY_PRESET[target.view] || null);
    flyToPreset(target.view);
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
  if (parsed.view === 'overview') return overviewCamera();
  if (parsed.view && CAMERA_PRESETS[parsed.view]) return presetCamera(parsed.view);
  if (!parsed.view && !parsed.project) return presetCamera('city_centre');
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
  for (const source of Object.values(style.sources || {})) {
    if (source && typeof source === 'object') delete source.attribution;
  }
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
  const parsed = parseLocationHash(location.hash);
  if (!parsed.view && !parsed.project) currentView = 'city_centre';
  else if (parsed.view) currentView = parsed.view;
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
    preserveDrawingBuffer: testHooksEnabled() && window.__cameraInstant === true,
    attributionControl: false,
  });

  map.on('styleimagemissing', (event) => {
    if (map.hasImage(event.id)) return;
    map.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });

  map.addControl(new maplibregl.NavigationControl(), 'top-left');
  const mapAttribution =
    '<a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre<span class="visually-hidden"> (opens in a new tab)</span></a> | OpenFreeMap | OpenMapTiles | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors<span class="visually-hidden"> (opens in a new tab)</span></a>';
  map.addControl(
    new maplibregl.AttributionControl({
      compact: false,
      customAttribution: mapAttribution,
    }),
    'bottom-right',
  );
  const lockMapAttribution = () => {
    const inner = document.querySelector('#map .maplibregl-ctrl-attrib-inner');
    if (!inner || inner.innerHTML === mapAttribution) return;
    inner.innerHTML = mapAttribution;
  };
  map.on('styledata', lockMapAttribution);
  map.on('idle', lockMapAttribution);
  expose('__map', map);

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
      currentView = 'city_centre';
      renderAreaCard('city-centre');
      applyRelevantLayers(OPENING_LAYERS);
      flyToPreset('city_centre', { instant: true });
    }
    map.once('idle', () => beginOverlayLoad());
    map.triggerRepaint();
    const selectFromMap = (e) => {
      if (e.features?.length) {
        selectProject(e.features[0].properties.OBJECTID ?? e.features[0].properties.PROJECT_NO);
      }
    };
    map.on('click', 'civic-symbols', (e) => {
      const placeId = e.features?.[0]?.properties?.id;
      if (placeId) selectCivic(placeId);
    });
    map.on('mouseenter', 'civic-symbols', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'civic-symbols', () => {
      map.getCanvas().style.cursor = '';
    });
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
  map.addSource('buildings', { type: 'geojson', data: buildingsFc });
  map.addSource('city-centre-plan', { type: 'geojson', data: planFc });
  map.addSource('ftda', { type: 'geojson', data: ftdaFc });
  map.addSource('skytrain-lines', { type: 'geojson', data: skytrainLinesFc });
  map.addSource('skytrain-stations', { type: 'geojson', data: skytrainStationsFc });
  map.addSource('amenities', { type: 'geojson', data: amenitiesFc });
  map.addSource('pilot-areas', { type: 'geojson', data: pilotAreaOutlines(pilotAreasMeta) });
  map.addSource('pilot-area-labels', { type: 'geojson', data: pilotAreaLabelPoints(pilotAreasMeta) });
  map.addSource('project-markers', { type: 'geojson', data: projectMarkerPoints(projectsFc) });
  map.addSource('proximity-rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('project-highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('civic-places', { type: 'geojson', data: civicPlacesGeoJSON(civicData) });
  addCivicIcon();

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
      'fill-extrusion-opacity': 0.82,
    },
  });

  map.addLayer({
    id: 'projects-illustrative-outline',
    type: 'line',
    source: 'projects',
    filter: ['==', ['get', 'height_source'], 'illustrative'],
    paint: {
      'line-color': '#163a6b',
      'line-width': 2.25,
      'line-dasharray': [1.2, 0.85],
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
    filter: ['==', ['geometry-type'], 'Point'],
    layout: { visibility: 'none' },
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
    id: 'civic-symbols',
    type: 'symbol',
    source: 'civic-places',
    layout: {
      'icon-image': 'civic-diamond',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 15, 0.9],
      'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], '', 14, ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.9],
      'text-max-width': 14,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#3b2468',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
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
  if (map.getLayer('projects-illustrative-outline')) {
    const illustrative = ['==', ['get', 'height_source'], 'illustrative'];
    map.setFilter(
      'projects-illustrative-outline',
      filter ? ['all', filter, illustrative] : illustrative,
    );
  }
}

function addCivicIcon() {
  if (map.hasImage('civic-diamond')) return;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.lineTo(60, 32);
  ctx.lineTo(32, 60);
  ctx.lineTo(4, 32);
  ctx.closePath();
  ctx.fillStyle = '#5b2d8e';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', 32, 34);
  const image = ctx.getImageData(0, 0, size, size);
  map.addImage('civic-diamond', image, { pixelRatio: 2 });
}

function applyRelevantLayers(layers = {}) {
  for (const [key, id] of Object.entries(LAYER_TOGGLES)) {
    setOverlayChecked(id, Boolean(layers[key]));
  }
}

function selectedRecordCount(pilotKey) {
  if (!projectsFc || !pilotKey) return 0;
  return projectsFc.features.filter(
    (feature) => feature.properties.pilot_area === pilotKey && isShowcaseProject(feature.properties),
  ).length;
}

function renderAreaCard(areaId) {
  const el = document.getElementById('area-card');
  if (!el) return;
  const card = areaId ? civicData?.area_cards?.[areaId] : null;
  if (!card) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const count = selectedRecordCount(PILOT_BY_AREA[areaId]);
  el.hidden = false;
  const sourceLabel = card.source_label || card.title;
  el.innerHTML = `
    <h2>${escapeHtml(card.title)}</h2>
    <p>${escapeHtml(card.text)}</p>
    <p>${linkOrPlain(card.source_url, sourceLabel)}</p>
    <p class="area-count">${escapeHtml(areaCountLine(count))}</p>
    <p class="area-note">${escapeHtml(AREA_COUNT_NOTE)}</p>
  `;
}

function projectMarkerPoints(fc) {
  const features = [];
  for (const feature of fc?.features || []) {
    const coordinates = featureReferencePoint(feature);
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

let phaseOptionsKey = '';

function syncPhasePressed() {
  const current = document.getElementById('filter-status')?.value || '';
  for (const btn of document.querySelectorAll('#phase-filter-group button')) {
    btn.setAttribute('aria-pressed', String((btn.dataset.phase || '') === current));
  }
}

function renderPhaseFilters() {
  const wrap = document.getElementById('phase-filters');
  if (!wrap || !projectsFc) return;
  wrap.hidden = !showAllApplications;
  const group = document.getElementById('phase-filter-group');
  if (!showAllApplications) {
    group.replaceChildren();
    phaseOptionsKey = '';
    return;
  }
  const statuses = [...new Set(projectsFc.features.map((f) => f.properties.STATUS).filter(Boolean))].sort();
  const options = [{ value: '', label: 'All statuses' }, ...statuses.map((status) => ({ value: status, label: status }))];
  const key = options.map((option) => option.value).join('\n');
  if (key !== phaseOptionsKey) {
    phaseOptionsKey = key;
    const focusedValue = document.activeElement?.dataset?.phase;
    group.replaceChildren();
    for (const option of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phase-filter';
      btn.dataset.phase = option.value;
      btn.textContent = option.label;
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
        syncPhasePressed();
      });
      group.appendChild(btn);
    }
    if (focusedValue != null) group.querySelector(`[data-phase="${CSS.escape(focusedValue)}"]`)?.focus();
  }
  syncPhasePressed();
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
    btn.setAttribute('aria-current', String(sameRecordId(projectId(p), selectedId)));
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
  renderCivicList();
}

function renderCivicList() {
  const list = document.getElementById('civic-list');
  if (!list) return;
  list.innerHTML = '';
  for (const place of civicData?.places || []) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.civicId = place.id;
    btn.setAttribute('aria-current', String(sameRecordId(place.id, selectedCivicId)));
    btn.innerHTML = `
      <strong>${escapeHtml(place.name)}</strong><br>
      <span class="area-tag">${escapeHtml(place.category)}</span>
    `;
    btn.addEventListener('click', () => selectCivic(place.id));
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
  if (id != null) selectedCivicId = null;
  renderProjectList();

  if (id === null) {
    selectedCivicId = null;
    panel.hidden = true;
    document.getElementById('app').classList.remove('detail-open');
    map?.getSource('proximity-rings')?.setData({ type: 'FeatureCollection', features: [] });
    setProjectHighlight(null);
    renderCivicList();
    if (!options.skipHash) setLocationHash({ view: currentView });
    if (options.restoreFocus && detailReturn && tourIndex < 0) {
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
  const center = featureReferencePoint(feature);
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

  const model = projectPanelModel(p, nearest);
  renderAreaCard(AREA_BY_PRESET[p.pilot_area] || areaIdForPilot(p.pilot_area));
  document.getElementById('detail-title').textContent = plain(model.title);
  const applicationLink = model.applicationUrl
    ? `<p>${externalAnchor(model.applicationUrl, model.applicationLinkLabel)}</p>`
    : model.applicationPlain
      ? `<p>${escapeHtml(model.applicationPlain)}</p>`
      : '';
  const documentsLink = model.documentsUrl
    ? `<dt>Documents</dt><dd>${externalAnchor(model.documentsUrl, 'View documents')}</dd>`
    : model.documentsPlain
      ? `<dt>Documents</dt><dd>${escapeHtml(model.documentsPlain)}</dd>`
      : '';
  document.getElementById('detail-content').innerHTML = `
    <p class="detail-description">${escapeHtml(model.description)}</p>
    <p class="status-line">${escapeHtml(model.statusLine)}</p>
    <p class="context-line">${escapeHtml(model.contextLine)}</p>
    <p class="height-fact">${escapeHtml(model.heightLine)}</p>
    <p class="extrusion-name">${escapeHtml(EXTRUSION_NAME)}</p>
    <p class="skytrain-line">${escapeHtml(model.skytrainLine)}</p>
    ${applicationLink}
    <dl>
      <dt>Application number</dt><dd>${escapeHtml(model.projectNo)}</dd>
      <dt>Pilot area</dt><dd>${escapeHtml(model.pilotArea)}</dd>
      ${documentsLink}
      <dt>Status source</dt><dd>${escapeHtml(model.statusSource)}</dd>
    </dl>
  `;
  if (!options.fromTour) document.getElementById('close-detail').focus();
}

function areaIdForPilot(pilot) {
  return AREA_BY_PRESET[pilot] || Object.entries(PILOT_BY_AREA).find(([, key]) => key === pilot)?.[0] || null;
}

function selectCivic(id, options = {}) {
  const place = (civicData?.places || []).find((item) => item.id === id);
  if (!place) return;
  const panel = document.getElementById('detail-panel');
  const opening = panel.hidden;
  const opener = opening ? document.activeElement : null;
  if (opening) rememberDetailReturn(id, opener);
  selectedId = null;
  selectedCivicId = place.id;
  renderProjectList();
  panel.hidden = false;
  document.getElementById('app').classList.add('detail-open');
  map?.getSource('proximity-rings')?.setData({ type: 'FeatureCollection', features: [] });
  setProjectHighlight(null);
  document.getElementById('detail-title').textContent = plain(place.name);
  document.getElementById('detail-content').innerHTML = `
    <p class="civic-category">${escapeHtml(place.category)}</p>
    <p>${escapeHtml(place.text)}</p>
    <p>${linkOrPlain(place.source_url, place.source_label || place.name)}</p>
  `;
  const civicCamera = {
    center: [place.lon, place.lat],
    zoom: 16.2,
    pitch: 48,
    bearing: -18,
  };
  if (map) {
    if (cameraMovesInstantly()) map.jumpTo(civicCamera);
    else map.flyTo({ ...civicCamera, duration: 1500 });
  }
  if (options.fromTour) setLocationHash({ view: currentView });
  if (!options.fromTour) document.getElementById('close-detail').focus();
}

function renderAtAGlance() {
  atAGlance = computeAtAGlance(
    showAllApplications ? projectsFc.features : projectsFc.features.filter((f) => isShowcaseProject(f.properties)),
    stations,
  );
  const el = document.getElementById('at-a-glance');
  el.innerHTML = `<h2>At a glance</h2><ul>${formatAtAGlance(atAGlance)
    .map((item) => `<li>${renderAtAGlanceItemHtml(item, escapeHtml)}</li>`)
    .join('')}</ul>`;
}

function renderMethodology() {
  const model = methodologyModel(sourcesMeta, BUILD_ID);
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
  const readmeHref = `${import.meta.env.BASE_URL || '/'}data/README.md`;
  const licenceHtml = sourcesMeta
    .map((s) => {
      const count = escapeHtml(s.feature_count ?? 'unknown');
      let licence;
      if (s.licence?.includes('City of Surrey')) {
        licence = `${escapeHtml(SURREY_LICENCE_TEXT)} ${externalAnchor(SURREY_LICENCE_URL, 'Licence details')}`;
      } else if (String(s.licence || '').includes('OpenStreetMap')) {
        const odbl = safeHttpUrl(s.licence_url) || 'https://opendatacommons.org/licenses/odbl/1-0/';
        licence = `${externalAnchor('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors')} (${externalAnchor(odbl, 'ODbL')})`;
      } else {
        licence = escapeHtml(s.licence ?? '');
      }
      return `<div class="licence-item"><strong>${escapeHtml(s.file)}</strong> (${count} features)<br>${licence}</div>`;
    })
    .join('');

  el.innerHTML = `
    <p>Public-data prototype by <strong>ParalleX Labs Inc.</strong> prepared in response to City of Surrey RFP 1220-030-2026-063.</p>
    <p>${escapeHtml(SURREY_LICENCE_TEXT)} ${externalAnchor(SURREY_LICENCE_URL, 'City of Surrey Open Data licence')}.</p>
    <p>This prototype is not affiliated with or endorsed by the City of Surrey.</p>
    <p>This page does not use tracking or cookies. Third-party requests are limited to OpenFreeMap (style, tiles, fonts).</p>
    <p><a href="${escapeAttr(readmeHref)}">OpenStreetMap data files and licence</a></p>
    <p>${escapeHtml(ACCESSIBILITY_STATEMENT)}</p>
    <p>Data: City of Surrey Open Data and ${externalAnchor('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors')}. Estimated heights use stated storeys x 3.2 m. Illustrative heights are used when no storey count could be read. ${escapeHtml(EXTRUSION_NAME)}.</p>
    <h3>Data sources (${escapeHtml(projectsFc.features.length)} applications)</h3>
    ${licenceHtml}
  `;
}

async function startTour() {
  beginOverlayLoad();
  tourSteps = buildTourSteps(projectsFc, skytrainFc, civicData, pilotAreasMeta);
  tourIndex = 0;
  const panel = document.getElementById('tour-panel');
  openDialog(panel, document.activeElement);
  showTourStep();
  panel.focus();
}

function endTour(restoreFocus = false) {
  tourIndex = -1;
  const panel = document.getElementById('tour-panel');
  const closing = document.getElementById('tour-closing');
  if (closing) {
    closing.hidden = true;
    closing.textContent = '';
  }
  announce('Showcase ended');
  if (restoreFocus) closeDialog(panel, document.getElementById('start-showcase'));
  else closeDialog(panel, null);
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
  const closing = document.getElementById('tour-closing');
  const isLast = tourIndex === tourSteps.length - 1;
  closing.hidden = !isLast;
  closing.textContent = isLast ? SHOWCASE_CLOSING : '';
  const prev = document.getElementById('tour-prev');
  const next = document.getElementById('tour-next');
  prev.disabled = tourIndex === 0;
  next.disabled = isLast;
  if (next.disabled && document.activeElement === next) document.getElementById('tour-exit').focus();
  if (prev.disabled && document.activeElement === prev) next.focus();
  announce(`Showcase stop ${tourIndex + 1} of ${tourSteps.length}: ${step.title}. ${step.caption}`);

  applyRelevantLayers(step.layers || {});
  currentView = step.preset || currentView;
  renderAreaCard(step.areaId || null);

  if (step.focusId) {
    selectProject(step.focusId, { fromTour: true });
  } else if (step.civicId) {
    selectCivic(step.civicId, { fromTour: true });
  } else {
    selectProject(null, { skipHash: true });
    renderAreaCard(step.areaId || null);
    if (step.preset) flyToPreset(step.preset);
    setLocationHash({ view: step.preset });
  }
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
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function externalAnchor(href, label) {
  const safe = safeHttpUrl(href);
  if (!safe) return '';
  return `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<span class="visually-hidden"> (opens in a new tab)</span></a>`;
}

function linkOrPlain(href, label) {
  if (safeHttpUrl(href)) return externalAnchor(href, label);
  const text = String(href ?? '').trim();
  return text ? escapeHtml(text) : '';
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
  buildingsFc = buildings;
  planFc = plan;
  ftdaFc = ftda;
  overlaysReady = true;
  planLive = false;
  publishOverlays();
  refreshCityCentrePlan(plan);
}

async function refreshCityCentrePlan(plan) {
  try {
  const planSource = (sourcesMeta || []).find((source) => source.file === 'city_centre_plan.geojson');
  const bundledCount = plan?.features?.length || 0;
  const live = await loadCityCentrePlanLive(planSource?.source_url);
  const liveCount = live?.features?.length || 0;
  const closeEnough = bundledCount > 0 && Math.abs(liveCount - bundledCount) / bundledCount <= 0.25;
  if (live && closeEnough && map?.getSource('city-centre-plan')) {
    map.getSource('city-centre-plan').setData(live);
    planLive = true;
    publishOverlays();
  }
  } catch {
    planLive = false;
    publishOverlays();
  }
}

async function main() {
  buildApp();

  const [projects, skytrain, sources, pilotAreas, civic] = await Promise.all([
    loadGeoJSON('development_projects'),
    loadGeoJSON('skytrain'),
    loadSources(),
    loadPilotAreas(),
    loadCivicPlaces(),
  ]);

  projectsFc = enrichProjects(projects);
  amenitiesFc = EMPTY_FC;
  civicData = civic;
  pilotAreasMeta = pilotAreas;
  stations = getSkyTrainStations(skytrain);
  sourcesMeta = sources;

  buildingsFc = EMPTY_FC;
  planFc = EMPTY_FC;
  ftdaFc = EMPTY_FC;
  skytrainFc = skytrain;
  skytrainLinesFc = {
    type: 'FeatureCollection',
    features: skytrain.features.filter((f) => f.geometry?.type === 'LineString'),
  };
  skytrainStationsFc = { type: 'FeatureCollection', features: stations };
  amenitiesFc = EMPTY_FC;
  overlaysReady = false;
  publishOverlays();
  applyPilotAreaPresets(pilotAreas);

  populateStatusFilter();
  renderPhaseFilters();
  renderProjectList();
  renderAtAGlance();
  renderAbout();
  renderMethodology();
  const openingHash = parseLocationHash(location.hash);
  if (openingHash.view) renderAreaCard(AREA_BY_PRESET[openingHash.view] || null);
  else if (!openingHash.project) renderAreaCard('city-centre');
  await initMap();
}

main().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  const alert = document.createElement('p');
  alert.setAttribute('role', 'alert');
  alert.textContent = 'Unable to load the prototype. Please reload and try again.';
  app.replaceChildren(alert);
});
