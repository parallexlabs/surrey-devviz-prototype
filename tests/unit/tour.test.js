import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildTourSteps } from '../../src/tour.js';

const projectsFc = {
  features: [
    {
      geometry: { type: 'Point', coordinates: [-122.85, 49.19] },
      properties: {
        STATUS: 'Conditional Approval',
        DESCRIPTION:
          'Development Permit to permit the development of a 67-storey mixed-use building.',
        pilot_area: 'city_centre',
        PROJECT_NO: '21-0313-00',
        OBJECTID: 1,
      },
    },
    {
      geometry: { type: 'Point', coordinates: [-122.8, 49.16] },
      properties: {
        STATUS: 'Conditional Approval',
        DESCRIPTION: 'Development Permit to permit the development of a 6-storey building.',
        pilot_area: 'fleetwood',
        PROJECT_NO: 'FW-1',
        OBJECTID: 2,
      },
    },
  ],
};

const skytrainFc = {
  features: [
    {
      geometry: { type: 'Point', coordinates: [-122.849, 49.1895] },
      properties: { railway: 'station', name: 'Surrey Central' },
    },
  ],
};

const civic = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/civic_places.json'), 'utf8'),
);

describe('buildTourSteps', () => {
  it('follows the five showcase stops in order', () => {
    const steps = buildTourSteps(projectsFc, skytrainFc, civic, {});
    expect(steps.map((step) => step.title)).toEqual([
      'Development and destinations in City Centre',
      'A major project and its transit context',
      'Civic investment: City Centre Arena',
      'Fleetwood Town Centre',
      'Campbell Heights',
    ]);
    expect(steps[0].caption).toMatch(/showcase projects are within 800 m straight-line of a SkyTrain station/);
    expect(steps[0].layers).toEqual({ skytrain: true, civic: true, plan: true });
    expect(steps[1].caption).toMatch(/21-0313-00/);
    expect(steps[1].caption).toMatch(/67 storeys/);
    expect(steps[1].caption).toMatch(/straight-line \(not a walking route\)/);
    expect(steps[1].layers).toEqual({ skytrain: true });
    expect(steps[2].civicId).toBe('city-centre-arena');
    expect(steps[2].caption).toMatch(/City Centre Arena \(planned\)/);
    expect(steps[3].caption).toMatch(/1 selected records in this prototype are in Fleetwood Town Centre/);
    expect(steps[3].layers).toEqual({});
    expect(steps[4].caption).toMatch(/0 selected records in this prototype are in Campbell Heights/);
    expect(steps[0].caption.split('.').filter(Boolean)).toHaveLength(1);
  });
});
