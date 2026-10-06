import { describe, it, expect } from 'vitest';
import {
  isShowcaseProject,
  isApprovedStatus,
  isUnderReviewStatus,
  underReviewLabel,
  getShowcaseExclusion,
  getShowcaseInclusion,
  SHOWCASE_EXCLUSION_RULES,
  SHOWCASE_INCLUSION_RULES,
} from '../../src/showcase.js';

describe('showcase exclusion rules', () => {
  it('excludes temporary use permits', () => {
    const desc = 'Temporary Use Permit to permit automotive service uses for 3 years.';
    expect(getShowcaseExclusion(desc)?.id).toBe('temporary_use');
    expect(isShowcaseProject({ STATUS: 'Conditional Approval', DESCRIPTION: desc })).toBe(false);
  });

  it('excludes variance-only permits', () => {
    const desc = 'Development Variance Permit to vary section J of the C8 zoning bylaw.';
    expect(getShowcaseExclusion(desc)?.id).toBe('variance_only');
  });

  it('excludes subdivision-only applications', () => {
    const desc = 'Subdivision from eleven (11) lots into twenty-two (22) lots.';
    expect(getShowcaseExclusion(desc)?.id).toBe('subdivision_only');
  });

  it('excludes signage applications', () => {
    const desc = 'Development Variance Permit to allow for 3 fascia signs on the building.';
    expect(getShowcaseExclusion(desc)?.id).toBe('variance_only');
  });
});

describe('showcase inclusion rules', () => {
  it('includes rezoning to comprehensive development', () => {
    const desc =
      'Rezoning from RF to CD (based on RM-135); Development Permit to permit the development of a 43-storey residential apartment building.';
    expect(getShowcaseInclusion(desc)?.id).toBe('rezoning_cd');
    expect(isShowcaseProject({ STATUS: 'Conditional Approval', DESCRIPTION: desc })).toBe(true);
  });

  it('includes multi-unit development permits', () => {
    const desc =
      'Development Permit to permit the development of a 6-storey residential building consisting of 115 residential units.';
    expect(getShowcaseInclusion(desc)?.id).toBe('dev_permit_building');
    expect(isShowcaseProject({ STATUS: 'Approved', DESCRIPTION: desc })).toBe(true);
  });

  it('requires approved status', () => {
    const desc =
      'Rezoning from RF to CD; Development Permit to permit the development of a 6-storey residential building.';
    expect(isShowcaseProject({ STATUS: 'Under Review', DESCRIPTION: desc })).toBe(false);
  });
});

describe('status helpers', () => {
  it('recognises approved statuses', () => {
    expect(isApprovedStatus('Conditional Approval')).toBe(true);
    expect(isApprovedStatus('Issued')).toBe(true);
    expect(isApprovedStatus('Under Review')).toBe(false);
  });

  it('labels under review statuses in text', () => {
    expect(underReviewLabel('Under Review')).toBe('Under review');
    expect(underReviewLabel('Initial Review')).toBe('Under review');
    expect(underReviewLabel('Conditional Approval')).toBe('');
  });
});

describe('documented rule sets', () => {
  it('documents exclusion and inclusion rules', () => {
    expect(SHOWCASE_EXCLUSION_RULES.length).toBeGreaterThanOrEqual(4);
    expect(SHOWCASE_INCLUSION_RULES.length).toBeGreaterThanOrEqual(3);
    for (const rule of [...SHOWCASE_EXCLUSION_RULES, ...SHOWCASE_INCLUSION_RULES]) {
      expect(rule.id).toBeTruthy();
      expect(rule.reason).toBeTruthy();
    }
  });
});
