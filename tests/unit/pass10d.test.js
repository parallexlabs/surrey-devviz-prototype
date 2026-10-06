import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LISTEN_HOST, siteRequestTarget } from '../../scripts/serve-site.mjs';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('pass 10d publication notes', () => {
  it('freezes the plan layer and documents the one-minute review', () => {
    const main = read('src/main.js');
    expect(main).not.toContain('refreshCityCentrePlan(plan);');
    const readme = read('README.md');
    expect(readme).toContain('## Review it in one minute');
    expect(readme).toContain('Start the showcase');
    expect(readme).toContain('Copy a share link');
    expect(readme).toContain('Public data only.');
    expect(readme).toContain('Heights are schematic.');
    expect(readme).toContain('This is not a City service.');
    expect(readme).toContain('No accessibility audit is claimed beyond the automated checks.');
    expect(readme).toContain('Python 3');
    expect(readme).toContain('Shapely');
    expect(readme).toContain('npm run build:site');
    expect(readme).toContain('VERIFICATION.md');
    const licence = read('DATA_LICENSE.md');
    expect(licence).toContain('**Open Government License – City of Surrey**');
    expect(licence).toContain('Coordinates in `civic_places.json`');
    expect(licence).toContain('prototype summaries');
    const civic = JSON.parse(read('public/data/civic_places.json'));
    expect(civic.coordinates_source).toContain('© OpenStreetMap contributors');
    expect(civic.coordinates_source).not.toContain('(c)');
  });
});

describe('development tool guards', () => {
  it('opts the load probe into test hooks and avoids a BSD stat flag', () => {
    expect(read('scripts/measure-load.mjs')).toContain('window.__surreyTest = true');
    const recorder = read('scripts/record-walkthrough.mjs');
    expect(recorder).toContain('statSync');
    expect(recorder).not.toContain('stat -f%z');
  });

  it('serves the preview on localhost and rejects a bad percent escape', () => {
    expect(LISTEN_HOST).toBe('127.0.0.1');
    expect(siteRequestTarget('%').status).toBe(400);
    expect(siteRequestTarget('/demos/surrey/%E0%A4%A').status).toBe(400);
  });
});
