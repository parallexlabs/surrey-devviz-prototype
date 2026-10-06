import { describe, it, expect } from 'vitest';
import { computeAtAGlance, formatAtAGlance } from '../../src/summary.js';

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
  it('returns readable summary lines', () => {
    const lines = formatAtAGlance(computeAtAGlance(projects, stations));
    expect(lines.some((l) => l.includes('Showcase projects: 2'))).toBe(true);
    expect(lines.some((l) => l.includes('800 m'))).toBe(true);
    expect(lines.some((l) => l.includes('43'))).toBe(true);
  });
});
