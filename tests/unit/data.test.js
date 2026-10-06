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

function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(sum) / 2;
}

function ringPoint(ring) {
  const closed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const count = closed ? ring.length - 1 : ring.length;
  let lon = 0;
  let lat = 0;
  for (let i = 0; i < count; i += 1) {
    lon += ring[i][0];
    lat += ring[i][1];
  }
  return [lon / count, lat / count];
}

function isRealHole(ring, source) {
  if (ringArea(ring) < 1e-6) return false;
  const [lon, lat] = ringPoint(ring);
  if (geometryContains(source, lon, lat)) return false;
  return polygonsOf(source).some((polygon) =>
    polygon.slice(1).some((sourceRing) => {
      if (ringArea(sourceRing) < 1e-6) return false;
      return geometryContains({ type: 'Polygon', coordinates: [sourceRing] }, lon, lat);
    }),
  );
}

describe('pilotAreaOutlines', () => {
  const areas = JSON.parse(readFileSync(join(process.cwd(), 'public/data/pilot_areas.json'), 'utf8'));

  it('draws one dissolved outer boundary for each pilot area', () => {
    const outlines = pilotAreaOutlines(areas);
    expect(outlines.features.map((feature) => feature.properties.name).sort()).toEqual([
      'Campbell Heights',
      'City Centre',
      'Fleetwood Town Centre',
    ]);
    for (const feature of outlines.features) {
      const area = areas[feature.properties.id];
      expect(feature.geometry).toEqual(area.outline);
      if (polygonsOf(area.geometry).length > 1) {
        expect(feature.geometry).not.toEqual(area.geometry);
      }
    }
  });

  it('is a single polygon or multipolygon with no internal rings except real holes', () => {
    const outlines = pilotAreaOutlines(areas);
    expect(outlines.features).toHaveLength(3);
    for (const feature of outlines.features) {
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
      const source = areas[feature.properties.id].geometry;
      const holes = polygonsOf(feature.geometry).flatMap((polygon) => polygon.slice(1));
      for (const hole of holes) {
        expect(isRealHole(hole, source)).toBe(true);
      }
      if (polygonsOf(source).length > 1) {
        const sourceRings = polygonsOf(source).reduce((count, polygon) => count + polygon.length, 0);
        const outlineRings = polygonsOf(feature.geometry).reduce(
          (count, polygon) => count + polygon.length,
          0,
        );
        expect(outlineRings).toBeLessThan(sourceRings);
      }
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
  it('places one label per pilot, off the dense marker centres', () => {
    const areas = JSON.parse(readFileSync(join(process.cwd(), 'public/data/pilot_areas.json'), 'utf8'));
    const labels = pilotAreaLabelPoints(areas);
    expect(labels.features).toHaveLength(3);
    expect(labels.features.map((feature) => feature.properties.name).sort()).toEqual([
      'Campbell Heights',
      'City Centre',
      'Fleetwood Town Centre',
    ]);
    for (const id of ['city_centre', 'fleetwood']) {
      const feature = labels.features.find((item) => item.properties.id === id);
      const [, , , north] = areas[id].bbox;
      expect(feature.geometry.coordinates[1]).toBeGreaterThan(north);
    }
    const campbell = labels.features.find((item) => item.properties.id === 'campbell_heights');
    expect(campbell.geometry.coordinates).toEqual(areas.campbell_heights.label);
    expect(
      geometryContains(areas.campbell_heights.geometry, campbell.geometry.coordinates[0], campbell.geometry.coordinates[1]),
    ).toBe(true);
  });
});
