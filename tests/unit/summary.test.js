import { describe, it, expect } from 'vitest';
import {
  computeAtAGlance,
  formatAtAGlance,
  atAGlanceItemText,
  renderAtAGlanceItemHtml,
} from '../../src/summary.js';

const stations = [
  {
    geometry: { type: 'Point', coordinates: [-122.85, 49.19] },
    properties: { name: 'Surrey Central' },
  },
];

const projects = [
  {
    geometry: { type: 'Point', coordinates: [-122.849, 49.189] },
    properties: {
      STATUS: 'Conditional Approval',
      DESCRIPTION:
        'Rezoning from RF to CD; Development Permit to permit the development of a 43-storey residential apartment building.',
      pilot_area: 'city_centre',
      PROJECT_NO: 'A-1',
    },
  },
  {
    geometry: { type: 'Point', coordinates: [-122.8, 49.16] },
    properties: {
      STATUS: 'Conditional Approval',
      DESCRIPTION:
        'Development Permit to permit the development of a 6-storey residential building with 20 units.',
      pilot_area: 'fleetwood',
      PROJECT_NO: 'B-1',
    },
  },
  {
    geometry: { type: 'Point', coordinates: [-122.78, 49.09] },
    properties: {
      STATUS: 'Under Review',
      DESCRIPTION: 'Development Variance Permit to vary setback.',
      pilot_area: 'campbell_heights',
      PROJECT_NO: 'C-1',
    },
  },
];

describe('computeAtAGlance', () => {
  it('summarises showcase projects per area and SkyTrain proximity', () => {
    const summary = computeAtAGlance(projects, stations);
    expect(summary.showcaseCount).toBe(2);
    expect(summary.perArea.city_centre).toBe(1);
    expect(summary.perArea.fleetwood).toBe(1);
    expect(summary.nearSkyTrain).toBe(1);
    expect(summary.tallestStoreys).toBe(43);
    expect(summary.tallestProject).toBe('A-1');
  });
});

describe('formatAtAGlance', () => {
  it('returns readable summary lines with the all-area total first', () => {
    const items = formatAtAGlance(computeAtAGlance(projects, stations));
    const lines = items.map(atAGlanceItemText);
    expect(lines[0]).toBe('Selected applications, all areas: 2');
    expect(lines.some((l) => l.includes('800 m'))).toBe(true);
    expect(lines.some((l) => l.includes('Tallest: 43 storeys (A-1)'))).toBe(true);
  });

  it('uses the existing selection count without changing its scope', () => {
    const summary = computeAtAGlance(projects, stations);
    const items = formatAtAGlance(summary);
    expect(items[0]).toEqual({
      kind: 'text',
      text: `Selected applications, all areas: ${summary.showcaseCount}`,
    });
    expect(summary.showcaseCount).toBe(
      Object.values(summary.perArea).reduce((total, count) => total + count, 0),
    );
  });

  it('renders the all-area label for an empty selection', () => {
    const items = formatAtAGlance(computeAtAGlance([], stations));
    expect(atAGlanceItemText(items[0])).toBe('Selected applications, all areas: 0');
  });

  it('wraps the tallest project number in a nowrap span', () => {
    const items = formatAtAGlance(computeAtAGlance(projects, stations));
    const tallest = items.find((item) => item.kind === 'tallest');
    const html = renderAtAGlanceItemHtml(tallest, (value) => String(value));
    expect(html).toContain('Tallest: 43 storeys');
    expect(html).toContain('<span class="summary-project">(A-1)</span>');
    expect(html).not.toContain('innerHTML');
  });
});
