import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import {
  getSkyTrainStations,
  getSkyTrainLines,
  projectLabel,
  geometryContains,
  pilotAreaLabel,
  pilotAreaLabelPoints,
  pilotAreaOutlines,
  pointInPilotArea,
  publicDataRetrievedLabel,
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

describe('publicDataRetrievedLabel', () => {
  it('uses the latest retrieval date in SOURCES.json', () => {
    const sources = JSON.parse(
      readFileSync(join(process.cwd(), 'public/data/SOURCES.json'), 'utf8'),
    );
    expect(publicDataRetrievedLabel(sources)).toBe('Public data retrieved 6 October 2026');
  });
});

describe('pilotAreaLabel', () => {
  it('maps known areas', () => {
    expect(pilotAreaLabel('city_centre')).toBe('City Centre');
    expect(pilotAreaLabel('fleetwood')).toBe('Fleetwood Town Centre');
    expect(pilotAreaLabel('campbell_heights')).toBe('Campbell Heights');
  });
});

describe('pilotAreaOutlines', () => {
  it('draws the official polygon for each pilot area', () => {
    const areas = JSON.parse(readFileSync(join(process.cwd(), 'public/data/pilot_areas.json'), 'utf8'));
    const outlines = pilotAreaOutlines(areas);
    expect(outlines.features.map((feature) => feature.properties.name).sort()).toEqual([
      'Campbell Heights',
      'City Centre',
      'Fleetwood Town Centre',
    ]);
    for (const feature of outlines.features) {
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
      expect(feature.geometry).toEqual(areas[feature.properties.id].geometry);
    }
  });
});

describe('Campbell Heights plan polygon', () => {
  const areas = JSON.parse(readFileSync(join(process.cwd(), 'public/data/pilot_areas.json'), 'utf8'));

  it('contains 192 Street and 32 Avenue', () => {
    expect(pointInPilotArea(areas, 'campbell_heights', -122.69, 49.054)).toBe(true);
  });

  it('does not contain 160 Street and 32 Avenue', () => {
    expect(pointInPilotArea(areas, 'campbell_heights', -122.776, 49.054)).toBe(false);
  });
});

describe('pilotAreaLabelPoints', () => {
  it('places one label inside each official polygon', () => {
    const areas = JSON.parse(readFileSync(join(process.cwd(), 'public/data/pilot_areas.json'), 'utf8'));
    const labels = pilotAreaLabelPoints(areas);
    expect(labels.features).toHaveLength(3);
    expect(labels.features.map((feature) => feature.properties.name).sort()).toEqual([
      'Campbell Heights',
      'City Centre',
      'Fleetwood Town Centre',
    ]);
    for (const feature of labels.features) {
      const area = areas[feature.properties.id];
      expect(feature.geometry.type).toBe('Point');
      expect(feature.geometry.coordinates).toEqual(area.label);
      expect(geometryContains(area.geometry, area.label[0], area.label[1])).toBe(true);
    }
  });
});
