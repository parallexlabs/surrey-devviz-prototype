import { describe, it, expect } from 'vitest';
import { parseStoreys, computeProjectHeight, illustrativeHeightMeters } from '../../src/heights.js';

describe('parseStoreys', () => {
  it('parses numeric storey counts', () => {
    expect(parseStoreys('Development of a 45-storey residential tower')).toBe(45);
    expect(parseStoreys('a 6 storeys residential building')).toBe(6);
    expect(parseStoreys('proposed 12-storey mixed-use building')).toBe(12);
  });

  it('parses word storey counts', () => {
    expect(parseStoreys('a six-storey apartment building')).toBe(6);
    expect(parseStoreys('forty-three-storey tower')).toBeNull();
    expect(parseStoreys('a twenty-storey tower')).toBe(20);
  });

  it('returns null when no storeys stated', () => {
    expect(parseStoreys('Rezoning from RF to CD for townhouse units')).toBeNull();
  });
});

describe('computeProjectHeight', () => {
  it('estimates height from stated storeys', () => {
    const result = computeProjectHeight('Development of a 10-storey building');
    expect(result.height_source).toBe('estimated');
    expect(result.height_m).toBe(32);
    expect(result.height_label).toBe(
      'Estimated height about 32 m: 10 storeys stated in the application x 3.2 m. Not a surveyed or approved height.',
    );
  });

  it('uses illustrative height by building type', () => {
    const result = computeProjectHeight('Development Permit for a mixed-use commercial project');
    expect(result.height_source).toBe('illustrative');
    expect(result.height_label).toBe('Height not stated in the application. Illustrative massing only.');
    expect(result.height_m).toBeGreaterThan(0);
  });
});

describe('illustrativeHeightMeters', () => {
  it('assigns taller illustrative heights to towers', () => {
    expect(illustrativeHeightMeters('high-rise tower')).toBeGreaterThan(
      illustrativeHeightMeters('townhouse row'),
    );
  });
});
