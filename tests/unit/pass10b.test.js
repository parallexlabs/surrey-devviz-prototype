import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EXTRUSION_LIMIT, EXTRUSION_NAME, ILLUSTRATIVE_HEIGHT_LABEL } from '../../src/copy.js';
import { methodologyModel } from '../../src/methodology.js';
import { absoluteOgImage } from '../../src/siteMeta.js';
import { renderStaticSummary } from '../../src/staticSummary.js';
import { hooksAllowed } from '../../src/testHooks.js';

const root = process.cwd();

describe('pass 10b labels', () => {
  it('names the extrusion and does not claim a missing metre height', () => {
    expect(EXTRUSION_NAME).toBe('Schematic application-area extrusion');
    expect(EXTRUSION_LIMIT).toBe(
      'Application areas are extruded uniformly for illustration. They are not proposed building footprints or approved architectural massing.',
    );
    expect(ILLUSTRATIVE_HEIGHT_LABEL).toBe(
      'Illustrative height: no storey count could be read from the application',
    );
    const model = methodologyModel([], 'abc');
    const text = model.sections.flatMap((section) => section.paragraphs).join(' ');
    expect(text).toContain(EXTRUSION_NAME);
    expect(text).toContain(EXTRUSION_LIMIT);
    expect(text).toContain('Heights written in metres are not read.');
    expect(text).toContain('including Conditional Approval');
    expect(text).not.toMatch(/height was not stated|no height in public data/i);
  });

  it('reads area-card labels from the civic file', () => {
    const civic = JSON.parse(readFileSync(join(root, 'public/data/civic_places.json'), 'utf8'));
    expect(civic.area_cards['city-centre'].source_label).toBe('City Centre on surrey.ca');
    expect(civic.area_cards.fleetwood.source_label).toBe('Fleetwood Town Centre Plan on surrey.ca');
    expect(civic.area_cards['campbell-heights'].source_label).toBe(
      'Campbell Heights Local Area Plan (City open data)',
    );
  });

  it('records the ODbL url on the OpenStreetMap extracts', () => {
    const sources = JSON.parse(readFileSync(join(root, 'public/data/SOURCES.json'), 'utf8'));
    const notice = readFileSync(join(root, 'public/data/README.md'), 'utf8');
    for (const file of ['skytrain.geojson', 'amenities.geojson']) {
      const entry = sources.find((source) => source.file === file);
      expect(entry.licence_url).toBe('https://opendatacommons.org/licenses/odbl/1-0/');
      expect(notice).toContain(file);
    }
    expect(notice).toContain('https://www.openstreetmap.org/copyright');
    expect(notice).toContain('Open Government License – City of Surrey');
  });
});

describe('static summary links', () => {
  it('prints an unsafe civic source as text', () => {
    const html = renderStaticSummary({
      projects: { features: [] },
      skytrain: { features: [] },
      civic: {
        places: [
          {
            name: 'Example',
            category: 'Place',
            text: 'Note.',
            source_url: 'javascript:alert(1)',
            source_label: 'Bad source',
          },
        ],
      },
    });
    expect(html).not.toContain('<a ');
    expect(html).toContain('javascript:alert(1)');
    expect(html).not.toContain('Bad source');
  });
});

describe('absolute social image', () => {
  it('uses an absolute og:image for the root and the site build', () => {
    expect(absoluteOgImage('/')).toBe('https://parallexlabs.ca/og.png');
    expect(absoluteOgImage('/demos/surrey/')).toBe('https://parallexlabs.ca/demos/surrey/og.png');
  });
});

describe('test hooks', () => {
  it('stays off unless dev mode or the page flag is set', () => {
    expect(hooksAllowed(false, false)).toBe(false);
    expect(hooksAllowed(false, undefined)).toBe(false);
    expect(hooksAllowed(true, false)).toBe(true);
    expect(hooksAllowed(false, true)).toBe(true);
  });
});
