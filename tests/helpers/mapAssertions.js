import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

export const SURREY_BOUNDS = {
  lonMin: -122.92,
  lonMax: -122.68,
  latMin: 49.0,
  latMax: 49.22,
};

export function loadPilotAreas() {
  return JSON.parse(readFileSync(join(ROOT, 'public/data/pilot_areas.json'), 'utf8'));
}

export function centerInBounds(center, bounds) {
  return (
    center.lng >= bounds.lonMin &&
    center.lng <= bounds.lonMax &&
    center.lat >= bounds.latMin &&
    center.lat <= bounds.latMax
  );
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

export async function waitForMapReady(page, timeout = 30000) {
  await page.waitForFunction(() => window.__map?.isStyleLoaded(), { timeout });
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const map = window.__map;
        if (!map) {
          reject(new Error('Map not exposed on window.__map'));
          return;
        }
        const done = () => {
          if (map.areTilesLoaded()) resolve();
          else map.once('idle', () => resolve());
        };
        if (map.isMoving()) map.once('moveend', done);
        else done();
      }),
    { timeout },
  );
}

export async function assertMapCenterInSurrey(page, label = 'map') {
  await waitForMapReady(page);
  const center = await getMapCenter(page);
  if (!centerInBounds(center, SURREY_BOUNDS)) {
    throw new Error(
      `${label} center [${center.lng}, ${center.lat}] is outside Surrey bounds`,
    );
  }
  return center;
}

export async function assertMapCenterInBbox(page, bbox, label = 'map') {
  await waitForMapReady(page);
  const center = await getMapCenter(page);
  if (!centerInBbox(center, bbox)) {
    throw new Error(
      `${label} center [${center.lng}, ${center.lat}] is outside bbox [${bbox.join(', ')}]`,
    );
  }
  return center;
}

const FORBIDDEN_VIEW_LABELS = [
  'Deep Cove',
  'Belcarra',
  'Indian Arm',
  'Port Coquitlam',
  'Coquitlam',
];

export async function assertMapViewShowsSurrey(page, label = 'map', options = {}) {
  await waitForMapReady(page);
  const center = await assertMapCenterInSurrey(page, label);
  const view = await page.evaluate((forbidden) => {
    const map = window.__map;
    const canvas = map.getCanvas();
    const features = map.queryRenderedFeatures(
      [[0, 0], [canvas.width, canvas.height]],
    );
    const names = new Set(
      features.map((f) => f.properties?.name).filter(Boolean),
    );
    const blocked = forbidden.filter((name) => names.has(name));
    const projects = map.queryRenderedFeatures(
      [[0, 0], [canvas.width, canvas.height]],
      { layers: ['projects-extrusion'] },
    ).length;
    const bounds = map.getBounds();
    return {
      blocked,
      projects,
      northLat: bounds.getNorthEast().lat,
    };
  }, FORBIDDEN_VIEW_LABELS);

  if (view.blocked.length) {
    throw new Error(
      `${label} shows labels outside Surrey: ${view.blocked.join(', ')}`,
    );
  }
  if (options.minProjects != null && view.projects < options.minProjects) {
    throw new Error(
      `${label} shows ${view.projects} project extrusions; expected at least ${options.minProjects}`,
    );
  }
  if (options.requiredLabels?.length) {
    const names = await page.evaluate(() => {
      const map = window.__map;
      const canvas = map.getCanvas();
      return [
        ...new Set(
          map
            .queryRenderedFeatures([[0, 0], [canvas.width, canvas.height]])
            .map((f) => f.properties?.name)
            .filter(Boolean),
        ),
      ];
    });
    const found = options.requiredLabels.some((name) => names.includes(name));
    if (!found) {
      throw new Error(
        `${label} is missing required labels: ${options.requiredLabels.join(', ')}`,
      );
    }
  }
  return { center, ...view };
}
