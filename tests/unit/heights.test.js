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
    expect(parseStoreys('forty-three-storey tower')).toBe(43);
    expect(parseStoreys('a twenty-storey tower')).toBe(20);
    expect(parseStoreys('twenty-five storey tower')).toBe(25);
    expect(parseStoreys('twenty-one storey tower')).toBe(21);
    expect(parseStoreys('twenty one storey tower')).toBe(21);
    expect(parseStoreys('sixty seven storey tower')).toBe(67);
    expect(parseStoreys('sixty-seven storey tower')).toBe(67);
    expect(parseStoreys('ninety-nine storey tower')).toBe(99);
  });

  it('returns null when no storeys stated', () => {
    expect(parseStoreys('Rezoning from RF to CD for townhouse units')).toBeNull();
  });

  it('does not read a trailing digit from a decimal storey', () => {
    expect(parseStoreys('2.5-storey building')).toBeNull();
    expect(parseStoreys('6.5-storey building')).toBeNull();
  });

  it('skips parking storeys and keeps the building count', () => {
    expect(parseStoreys('2 storeys of underground parking below a 6-storey building')).toBe(6);
    expect(parseStoreys('2-storey building with 6-storey parking structure')).toBe(2);
    expect(parseStoreys('6-storey parking structure')).toBeNull();
    expect(parseStoreys('2 storeys of underground parking')).toBeNull();
    expect(parseStoreys('six storeys of underground parking')).toBeNull();
    expect(parseStoreys('six-storey above-ground parking structure')).toBeNull();
    expect(parseStoreys('one hundred and seven storey tower')).toBeNull();
    expect(parseStoreys('3-storey podium and 40-storey tower')).toBe(40);
    expect(parseStoreys('three-storey podium and 40-storey tower')).toBe(40);
    expect(parseStoreys('21-storey tower')).toBe(21);
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
    expect(result.height_label).toBe(
      'Illustrative height: no storey count could be read from the application',
    );
    expect(result.height_label).not.toMatch(/not stated|no height/i);
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
