import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeProjectHeight } from '../../src/heights.js';
import { methodologyModel } from '../../src/methodology.js';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('pass 10e licensing and data honesty', () => {
  it('credits screenshots and names every shipped map render', () => {
    const readme = read('README.md');
    expect(readme).toContain(
      'Screenshots on this page: basemap © OpenMapTiles, © OpenStreetMap contributors, served by OpenFreeMap. Plan areas and application outlines contain information licensed under the Open Government License – City of Surrey.',
    );
    expect(readme).toContain(
      'the page does not use analytics, cookies, localStorage, or sessionStorage. Third-party requests are limited to OpenFreeMap (style, tiles, fonts).',
    );
    expect(readme).toContain('SECURITY.md');
    expect(readme).not.toContain('Start here dismissal');
    const licence = read('DATA_LICENSE.md');
    expect(licence).toContain('## Screenshots and preview image');
    for (const name of ['docs/01-overview.jpg', 'docs/03-project-panel.jpg', 'docs/07-mobile.jpg', 'public/og.png']) {
      expect(licence).toContain(name);
    }
    const notes = read('public/data/README.md');
    expect(notes).toContain('## Field notes for development_projects.geojson');
    expect(notes).toContain('Heights are not stored in this file.');
    expect(notes).toContain('`assign_lon`, `assign_lat`');
    const security = read('SECURITY.md');
    expect(security).toContain('static site');
    expect(security).toContain('http and https');
    expect(security).toContain('Dependabot');
  });

  it('ships no stored heights and still estimates OBJECTID 207 from the description', () => {
    const fc = JSON.parse(read('public/data/development_projects.geojson'));
    expect(fc.features).toHaveLength(119);
    for (const feature of fc.features) {
      for (const stale of ['height_m', 'height_source', 'storeys', 'height_label']) {
        expect(feature.properties).not.toHaveProperty(stale);
      }
    }
    const feature = fc.features.find((item) => item.properties.OBJECTID === 207);
    expect(feature.properties.DESCRIPTION).toContain('43-storey');
    const height = computeProjectHeight(feature.properties.DESCRIPTION);
    expect(height.storeys).toBe(43);
    expect(height.height_source).toBe('estimated');
    expect(height.height_m).toBe(137.6);
  });

  it('says when a source was kept after a failed refresh', () => {
    const kept = methodologyModel(
      [{ file: 'skytrain.geojson', layer: 'SkyTrain', licence: '© OpenStreetMap contributors (ODbL)', feature_count: 1, retrieved_at: '2026-10-06T05:58:23.972485+00:00', kept_previous: true }],
      'test',
    );
    const line = kept.sections[0].paragraphs[0];
    expect(line).toContain('Retrieved 2026-10-06.');
    expect(line).toContain('Kept from an earlier run after a failed refresh.');
    const fresh = methodologyModel(
      [{ file: 'amenities.geojson', layer: 'Amenities', licence: 'Test', feature_count: 2, retrieved_at: '2026-10-06T11:55:45.366059+00:00' }],
      'test',
    );
    expect(fresh.sections[0].paragraphs[0]).not.toContain('Kept from an earlier run');
  });

  it('records the licence, repository, dependency updates, and the data guard', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.license).toBe('Apache-2.0');
    expect(pkg.repository.url).toBe('https://github.com/parallexlabs/surrey-devviz-prototype.git');
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('actions/setup-python@v5');
    expect(ci).toContain("python-version: '3.12'");
    expect(ci).toContain("shapely>=2.0,<3");
    expect(ci).toContain('npm audit --omit=dev --audit-level=high');
    expect(ci).toContain('! grep -q \'"height_source"\'');
    const dependabot = read('.github/dependabot.yml');
    expect(dependabot).toContain('package-ecosystem: npm');
    expect(dependabot).toContain('package-ecosystem: github-actions');
    expect(dependabot).toContain('interval: weekly');
    expect(read('index.html')).toContain('Content-Security-Policy');
    const probe = read('scripts/measure-load.mjs');
    expect(probe.indexOf('window.__surreyTest = true')).toBeLessThan(probe.indexOf('await page.goto'));
    expect(probe).toContain('true, null, { timeout: 60000 }');
    const readme = read('README.md');
    expect(readme).toContain('## Load profile');
    expect(readme).toContain('Transfer after idle: 7,774,830 bytes');
    expect(readme).toContain('Transfer after idle: 3,386,220 bytes');
    expect(readme).toContain('`building_footprints.geojson` was not requested in the second run.');
  });
});
