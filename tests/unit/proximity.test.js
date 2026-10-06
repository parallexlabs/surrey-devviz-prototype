import { describe, it, expect } from 'vitest';
import {
  haversineDistanceMeters,
  featureCentroid,
  featureReferencePoint,
  nearestStation,
  formatDistance,
  createProximityRingsGeoJSON,
} from '../../src/proximity.js';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceMeters(-122.85, 49.19, -122.85, 49.19)).toBe(0);
  });

  it('computes known distance between Surrey Central and King George', () => {
    const dist = haversineDistanceMeters(-122.848, 49.189, -122.845, 49.183);
    expect(dist).toBeGreaterThan(500);
    expect(dist).toBeLessThan(800);
  });
});

describe('featureCentroid', () => {
  it('returns point coordinates for Point geometry', () => {
    const f = { geometry: { type: 'Point', coordinates: [-122.8, 49.1] } };
    expect(featureCentroid(f)).toEqual([-122.8, 49.1]);
  });

  it('returns centroid for polygon', () => {
    const f = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[-122, 49], [-121, 49], [-121, 50], [-122, 50], [-122, 49]]],
      },
    };
    const c = featureCentroid(f);
    expect(c[0]).toBeCloseTo(-121.5, 1);
    expect(c[1]).toBeCloseTo(49.5, 1);
  });
});

describe('nearestStation', () => {
  const stations = [
    {
      geometry: { type: 'Point', coordinates: [-122.85, 49.19] },
      properties: { name: 'Station A' },
    },
    {
      geometry: { type: 'Point', coordinates: [-122.84, 49.18] },
      properties: { name: 'Station B' },
    },
  ];

  it('finds the closest station', () => {
    const project = {
      geometry: { type: 'Point', coordinates: [-122.849, 49.189] },
      properties: {},
    };
    const result = nearestStation(project, stations);
    expect(result.station.properties.name).toBe('Station A');
    expect(result.distanceM).toBeLessThan(200);
  });
});

describe('featureReferencePoint', () => {
  it('prefers the assignment point over the vertex average', () => {
    const feature = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
      },
      properties: { assign_lon: 10, assign_lat: 20 },
    };
    expect(featureReferencePoint(feature)).toEqual([10, 20]);
    const station = {
      geometry: { type: 'Point', coordinates: [10, 20] },
      properties: { name: 'Assigned' },
    };
    const other = {
      geometry: { type: 'Point', coordinates: [0.5, 0.5] },
      properties: { name: 'Centroid' },
    };
    expect(nearestStation(feature, [other, station]).station.properties.name).toBe('Assigned');
  });

  it('falls back to the vertex average when the assignment point is absent', () => {
    const feature = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
      },
      properties: {},
    };
    expect(featureReferencePoint(feature)).toEqual(featureCentroid(feature));
  });

  it('keeps a vertex when only the longitude repeats', () => {
    const feature = {
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [2, 0], [2, 2], [0, 1]]],
      },
    };
    const centroid = featureCentroid(feature);
    expect(centroid[0]).toBeCloseTo(1, 5);
    expect(centroid[1]).toBeCloseTo(0.75, 5);
  });
});

describe('formatDistance', () => {
  it('rounds metres to 10 m', () => {
    expect(formatDistance(187)).toBe('190 m');
    expect(formatDistance(184)).toBe('180 m');
    expect(formatDistance(450)).toBe('450 m');
  });

  it('formats kilometres', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
  });
});

describe('createProximityRingsGeoJSON', () => {
  it('creates two ring features', () => {
    const rings = createProximityRingsGeoJSON([-122.85, 49.19]);
    expect(rings.features).toHaveLength(2);
    expect(rings.features[0].properties.radius_m).toBe(400);
    expect(rings.features[1].properties.radius_m).toBe(800);
  });
});
