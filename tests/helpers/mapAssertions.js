import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseStoreys } from '../../src/heights.js';
import { isApprovedStatus } from '../../src/showcase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export const SURREY_EXTENT = {
  lonMin: -122.92,
  lonMax: -122.68,
  latMin: 49.0,
  latMax: 49.2,
};

const FRASER_LAT = 49.22;

export function loadPilotAreas() {
  return JSON.parse(readFileSync(join(ROOT, 'public/data/pilot_areas.json'), 'utf8'));
}

export function loadSurreyCentral() {
  const fc = JSON.parse(readFileSync(join(ROOT, 'public/data/skytrain.geojson'), 'utf8'));
  const station = fc.features.find(
    (f) => f.geometry?.type === 'Point' && f.properties?.name === 'Surrey Central',
  );
  if (!station) throw new Error('Surrey Central is missing from public/data/skytrain.geojson');
  return station.geometry.coordinates;
}

export function centerInBbox(center, bbox) {
  const [w, s, e, n] = bbox;
  return center.lng >= w && center.lng <= e && center.lat >= s && center.lat <= n;
}

export async function getMapCenter(page) {
  return page.evaluate(() => {
    const map = window.__map;
    if (!map) throw new Error('Map not exposed on window.__map');
    const c = map.getCenter();
    return { lng: c.lng, lat: c.lat };
  });
}

export async function waitForCameraSettled(page, timeout = 30000) {
  await page.waitForFunction(() => window.__map?.isStyleLoaded(), { timeout });
  const view = await page.evaluate(
    ({ timeoutMs }) =>
      new Promise((resolve, reject) => {
        const map = window.__map;
        if (!map) {
          reject(new Error('Map not exposed on window.__map'));
          return;
        }
        const timer = setTimeout(() => {
          reject(new Error('Timed out waiting for moveend and idle'));
        }, timeoutMs);

        const finish = () => {
          clearTimeout(timer);
          const rect = map.getContainer().getBoundingClientRect();
          const c = map.getCenter();
          resolve({
            paneHeight: rect.height,
            viewportHeight: window.innerHeight,
            center: { lng: c.lng, lat: c.lat },
            moving: map.isMoving(),
          });
        };

        const waitIdle = () => {
          if (map.isMoving()) {
            map.once('moveend', waitIdle);
            return;
          }
          map.once('idle', finish);
          map.triggerRepaint();
        };

        if (map.isMoving()) map.once('moveend', waitIdle);
        else waitIdle();
      }),
    { timeoutMs: timeout },
  );

  if (view.moving) {
    throw new Error('Map is still moving after idle');
  }
  if (view.paneHeight > view.viewportHeight + 1) {
    throw new Error(
      `Map pane is ${Math.round(view.paneHeight)}px tall, taller than the ${view.viewportHeight}px viewport`,
    );
  }
  return view;
}

async function readMapView(page, station = null) {
  return page.evaluate(
    ({ station, extent, fraserLat }) => {
      const map = window.__map;
      if (!map) throw new Error('Map not exposed on window.__map');
      const rect = map.getContainer().getBoundingClientRect();
      const left = Math.max(rect.left, 0);
      const top = Math.max(rect.top, 0);
      const right = Math.min(rect.right, window.innerWidth);
      const bottom = Math.min(rect.bottom, window.innerHeight);
      const vis = {
        left: left - rect.left,
        top: top - rect.top,
        right: right - rect.left,
        bottom: bottom - rect.top,
      };
      const box = [
        [vis.left, vis.top],
        [vis.right, vis.bottom],
      ];
      const massing = map.getLayer('projects-extrusion')
        ? map.queryRenderedFeatures(box, { layers: ['projects-extrusion'] }).length
        : 0;
      const ringLayers = ['proximity-rings-fill', 'proximity-rings-line'].filter((id) => map.getLayer(id));
      const rings = ringLayers.length ? map.queryRenderedFeatures(box, { layers: ringLayers }).length : 0;
      const c = map.getCenter();
      let stationPoint = null;
      if (station) {
        const p = map.project(station);
        stationPoint = {
          x: p.x,
          y: p.y,
          inside: p.x >= vis.left && p.x <= vis.right && p.y >= vis.top && p.y <= vis.bottom,
        };
      }
      const corners = [
        [extent.lonMin, extent.latMin],
        [extent.lonMax, extent.latMin],
        [extent.lonMin, extent.latMax],
        [extent.lonMax, extent.latMax],
      ].map(([lng, lat]) => {
        const p = map.project([lng, lat]);
        return {
          lng,
          lat,
          x: p.x,
          y: p.y,
          inside: p.x >= vis.left && p.x <= vis.right && p.y >= vis.top && p.y <= vis.bottom,
        };
      });
      let north = 0;
      const n = 5;
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          const x = vis.left + ((vis.right - vis.left) * (i + 0.5)) / n;
          const y = vis.top + ((vis.bottom - vis.top) * (j + 0.5)) / n;
          if (map.unproject([x, y]).lat > fraserLat) north += 1;
        }
      }
      return {
        center: { lng: c.lng, lat: c.lat },
        vis,
        massing,
        rings,
        stationPoint,
        corners,
        northFraction: north / (n * n),
      };
    },
    { station, extent: SURREY_EXTENT, fraserLat: FRASER_LAT },
  );
}

export async function assertCityCentreView(page, label = 'City Centre') {
  await waitForCameraSettled(page);
  const view = await readMapView(page, loadSurreyCentral());
  if (!view.stationPoint?.inside) {
    throw new Error(
      `${label}: Surrey Central projects to (${Math.round(view.stationPoint?.x)}, ${Math.round(view.stationPoint?.y)}), outside the visible map`,
    );
  }
  if (view.massing < 10) {
    throw new Error(`${label}: ${view.massing} rendered massing features; expected at least 10`);
  }
  return view;
}

export async function assertPilotMassingView(page, bbox, label) {
  await waitForCameraSettled(page);
  const view = await readMapView(page);
  if (!centerInBbox(view.center, bbox)) {
    throw new Error(
      `${label} center [${view.center.lng}, ${view.center.lat}] is outside bbox [${bbox.join(', ')}]`,
    );
  }
  if (view.massing < 1) {
    throw new Error(`${label}: no rendered massing features`);
  }
  return view;
}

export async function readOverviewDecoration(page) {
  return page.evaluate(() => {
    const map = window.__map;
    if (!map) throw new Error('Map not exposed on window.__map');
    const rect = map.getContainer().getBoundingClientRect();
    const box = [
      [0, 0],
      [rect.width, rect.height],
    ];
    const count = (id) => (map.getLayer(id) ? map.queryRenderedFeatures(box, { layers: [id] }).length : 0);
    const labels = map.getLayer('pilot-areas-label')
      ? map.queryRenderedFeatures(box, { layers: ['pilot-areas-label'] })
      : [];
    return {
      amenities: count('amenities-points'),
      markers: count('projects-markers'),
      names: [...new Set(labels.map((feature) => feature.properties?.name).filter(Boolean))].sort(),
    };
  });
}

export async function assertOverviewFraming(page, label = 'overview') {
  await assertOverviewView(page, label);
  const frame = await page.evaluate(() => {
    const map = window.__map;
    const areas = window.__pilotAreasMeta;
    const rect = map.getContainer().getBoundingClientRect();
    const point = (lng, lat) => {
      const projected = map.project([lng, lat]);
      return { x: projected.x, y: projected.y };
    };
    const corners = (bbox) => {
      const [west, south, east, north] = bbox;
      return [
        point(west, south),
        point(east, south),
        point(west, north),
        point(east, north),
      ];
    };
    const labels = map.getLayer('pilot-areas-label')
      ? map.queryRenderedFeatures(
          [
            [0, 0],
            [rect.width, rect.height],
          ],
          { layers: ['pilot-areas-label'] },
        )
      : [];
    const labelPoints = {};
    for (const feature of labels) {
      const id = feature.properties?.id;
      if (!id || !feature.geometry?.coordinates) continue;
      const [lng, lat] = feature.geometry.coordinates;
      labelPoints[id] = point(lng, lat);
    }
    let markerTop = null;
    if (map.getLayer('projects-markers')) {
      const markers = map.queryRenderedFeatures(
        [
          [0, 0],
          [rect.width, rect.height],
        ],
        { layers: ['projects-markers'] },
      );
      for (const feature of markers) {
        if (feature.properties?.pilot_area !== 'city_centre') continue;
        const [lng, lat] = feature.geometry.coordinates;
        const projected = point(lng, lat);
        if (markerTop == null || projected.y < markerTop) markerTop = projected.y;
      }
    }
    return {
      width: rect.width,
      height: rect.height,
      boxes: {
        city_centre: corners(areas.city_centre.bbox),
        fleetwood: corners(areas.fleetwood.bbox),
        campbell_heights: corners(areas.campbell_heights.bbox),
      },
      labelPoints,
      markerTop,
    };
  });

  const margin = 12;
  for (const [id, corners] of Object.entries(frame.boxes)) {
    for (const corner of corners) {
      if (
        corner.x < margin ||
        corner.y < margin ||
        corner.x > frame.width - margin ||
        corner.y > frame.height - margin
      ) {
        throw new Error(
          `${label} ${id} corner (${Math.round(corner.x)}, ${Math.round(corner.y)}) is outside the ${Math.round(frame.width)}x${Math.round(frame.height)} map with ${margin}px padding`,
        );
      }
    }
  }
  for (const id of ['city_centre', 'fleetwood', 'campbell_heights']) {
    const labelPoint = frame.labelPoints[id];
    if (!labelPoint) throw new Error(`${label} is missing the ${id} label`);
    if (
      labelPoint.x < margin ||
      labelPoint.y < margin ||
      labelPoint.x > frame.width - margin ||
      labelPoint.y > frame.height - margin
    ) {
      throw new Error(
        `${label} ${id} label (${Math.round(labelPoint.x)}, ${Math.round(labelPoint.y)}) is outside the frame`,
      );
    }
  }
  const cityLabel = frame.labelPoints.city_centre;
  if (frame.markerTop != null && cityLabel.y >= frame.markerTop) {
    throw new Error(
      `${label} City Centre label sits on the markers (label y ${Math.round(cityLabel.y)}, marker top ${Math.round(frame.markerTop)})`,
    );
  }
  return frame;
}

export async function assertOverviewView(page, label = 'overview') {
  await waitForCameraSettled(page);
  const view = await readMapView(page);
  const missing = view.corners.filter((c) => !c.inside);
  if (missing.length) {
    throw new Error(
      `${label}: Surrey extent is not fully visible (${missing.map((c) => `${c.lng},${c.lat}`).join('; ')})`,
    );
  }
  if (view.northFraction > 0.2) {
    throw new Error(
      `${label}: ${Math.round(view.northFraction * 100)}% of the frame is north of the Fraser`,
    );
  }
  return view;
}

export async function assertProjectPanel(page, label = 'project panel') {
  await waitForCameraSettled(page);
  const panel = await page.evaluate(() => {
    const el = document.getElementById('detail-panel');
    if (!el) return null;
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return { display: style.display, width: box.width, text: el.innerText };
  });
  if (!panel) throw new Error(`${label} is missing`);
  if (panel.display === 'none') throw new Error(`${label} display is none`);
  if (panel.width < 250) {
    throw new Error(`${label} is ${Math.round(panel.width)}px wide; expected at least 250`);
  }
  if (!panel.text.includes('Nearest SkyTrain')) {
    throw new Error(`${label} text does not contain Nearest SkyTrain`);
  }
  const view = await readMapView(page);
  if (view.rings < 1) {
    throw new Error(`${label}: proximity rings are not rendered on screen`);
  }
  return { panel, view };
}

export async function selectCityCentreProject(page) {
  const selected = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.project-list li button')].find((el) =>
      el.innerText.includes('City Centre'),
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!selected) throw new Error('No City Centre showcase project in the list');
  await waitForCameraSettled(page);
}

export function tallestApprovedByStoreys() {
  const fc = JSON.parse(readFileSync(join(ROOT, 'public/data/development_projects.geojson'), 'utf8'));
  let best = null;
  for (const feature of fc.features) {
    if (!isApprovedStatus(feature.properties.STATUS)) continue;
    const storeys = parseStoreys(feature.properties.DESCRIPTION);
    if (storeys == null) continue;
    if (!best || storeys > best.storeys) {
      best = {
        projectNo: feature.properties.PROJECT_NO,
        storeys,
        status: feature.properties.STATUS,
      };
    }
  }
  if (!best) throw new Error('No approved project states a storey count');
  return best;
}

export async function selectTallestApprovedProject(page) {
  const project = tallestApprovedByStoreys();
  const selected = await page.evaluate((projectNo) => {
    const btn = [...document.querySelectorAll('.project-list li button')].find((el) =>
      el.innerText.includes(projectNo),
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, project.projectNo);
  if (!selected) throw new Error(`Tallest approved project ${project.projectNo} is not in the list`);
  await waitForCameraSettled(page);
  return project;
}
