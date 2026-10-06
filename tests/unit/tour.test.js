import { describe, it, expect } from 'vitest';
import { buildTourSteps } from '../../src/tour.js';

const projectsFc = {
  features: [
    {
      geometry: { type: 'Point', coordinates: [-122.85, 49.19] },
      properties: {
        STATUS: 'Conditional Approval',
        DESCRIPTION:
          'Rezoning from RF to CD; Development Permit to permit the development of a 30-storey residential apartment building.',
        pilot_area: 'city_centre',
        PROJECT_NO: 'CC-1',
        OBJECTID: 1,
      },
    },
  ],
};

const skytrainFc = {
  features: [
    {
      geometry: { type: 'LineString', coordinates: [[-122.86, 49.19], [-122.84, 49.18]] },
      properties: { railway: 'light_rail' },
    },
    {
      geometry: { type: 'Point', coordinates: [-122.85, 49.19] },
      properties: { railway: 'station', name: 'Surrey Central' },
    },
  ],
};

const amenitiesFc = {
  features: [
    {
      geometry: { type: 'Point', coordinates: [-122.851, 49.191] },
      properties: { name: 'Fraser Library', amenity: 'library' },
    },
  ],
};

const pilotAreas = {
  city_centre: { bbox: [-122.9, 49.17, -122.82, 49.22] },
  fleetwood: { bbox: [-122.82, 49.14, -122.78, 49.18] },
  campbell_heights: { bbox: [-122.82, 49.06, -122.74, 49.11] },
};

describe('buildTourSteps', () => {
  it('builds data-driven tour captions', () => {
    const steps = buildTourSteps(projectsFc, skytrainFc, amenitiesFc, pilotAreas);
    expect(steps.length).toBeGreaterThanOrEqual(5);
    expect(steps[0].caption).toMatch(/showcase projects/i);
    const cityCentre = steps.find((s) => s.id === 'city_centre');
    expect(cityCentre.caption).toMatch(/SkyTrain/i);
    expect(cityCentre.caption).toMatch(/Fraser Library/);
    const tallest = steps.find((s) => s.id === 'tallest');
    expect(tallest.caption).toMatch(/30 storeys/);
  });
});
