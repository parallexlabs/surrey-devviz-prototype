import { describe, it, expect } from 'vitest';
import { buildLocationHash, parseLocationHash, resolveHashTarget, sameRecordId } from '../../src/hashView.js';

describe('location hash', () => {
  it('round-trips a view preset', () => {
    const hash = buildLocationHash({ view: 'city_centre' });
    expect(hash).toBe('#view=city_centre');
    expect(parseLocationHash(hash)).toEqual({ view: 'city_centre', project: null });
  });

  it('round-trips an application number', () => {
    const hash = buildLocationHash({ project: '21-0313-00' });
    expect(hash).toBe('#project=21-0313-00');
    expect(parseLocationHash(hash)).toEqual({ view: null, project: '21-0313-00' });
  });

  it('keeps a view and a project together', () => {
    const hash = '#view=fleetwood&project=14-0324-00';
    expect(parseLocationHash(hash)).toEqual({ view: 'fleetwood', project: '14-0324-00' });
  });

  it('ignores an unknown view', () => {
    expect(parseLocationHash('#view=coquitlam')).toEqual({ view: null, project: null });
  });

  it('keeps a valid view when the project is missing', () => {
    const parsed = parseLocationHash('#view=fleetwood&project=missing');
    const target = resolveHashTarget(parsed, [{ properties: { PROJECT_NO: '21-0313-00' } }]);
    expect(target.kind).toBe('view');
    expect(target.view).toBe('fleetwood');
    expect(target.missingProject).toBe(true);
  });

  it('compares record ids as strings', () => {
    expect(sameRecordId(46, '46')).toBe(true);
    expect(sameRecordId(46, '47')).toBe(false);
  });
});
