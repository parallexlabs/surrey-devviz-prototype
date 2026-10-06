import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

describe('pass 10c shipped amenities', () => {
  it('does not include contact properties', () => {
    const fc = JSON.parse(readFileSync(join(root, 'public/data/amenities.geojson'), 'utf8'));
    for (const feature of fc.features) {
      expect(feature.properties?.email).toBeUndefined();
      expect(feature.properties?.phone).toBeUndefined();
    }
  });
});
