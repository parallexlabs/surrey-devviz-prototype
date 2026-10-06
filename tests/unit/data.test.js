import { describe, it, expect } from 'vitest';
import {
  getSkyTrainStations,
  getSkyTrainLines,
  projectLabel,
  pilotAreaLabel,
} from '../../src/data.js';

describe('getSkyTrainStations', () => {
  it('filters point station features', () => {
    const fc = {
      features: [
        { geometry: { type: 'Point' }, properties: { railway: 'station' } },
        { geometry: { type: 'LineString' }, properties: { railway: 'light_rail' } },
        { geometry: { type: 'Point' }, properties: { name: 'other' } },
      ],
    };
    const stations = getSkyTrainStations(fc);
    expect(stations).toHaveLength(1);
  });
});

describe('getSkyTrainLines', () => {
  it('filters line features', () => {
    const fc = {
      features: [
        { geometry: { type: 'LineString' }, properties: { railway: 'light_rail' } },
        { geometry: { type: 'Point' }, properties: { railway: 'station' } },
      ],
    };
    expect(getSkyTrainLines(fc)).toHaveLength(1);
  });
});

describe('projectLabel', () => {
  it('combines title from description with application number', () => {
    const label = projectLabel({
      PROJECT_NO: '7920-0340',
      DESCRIPTION: 'Mixed use tower; Development Permit for 200 units.',
      display_title: 'Mixed use tower',
    });
    expect(label).toContain('7920-0340');
    expect(label).toContain('Mixed use tower');
  });
});

describe('pilotAreaLabel', () => {
  it('maps known areas', () => {
    expect(pilotAreaLabel('city_centre')).toBe('City Centre');
    expect(pilotAreaLabel('fleetwood')).toBe('Fleetwood Town Centre');
    expect(pilotAreaLabel('campbell_heights')).toBe('Campbell Heights');
  });
});
