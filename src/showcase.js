/** Approved application statuses from City of Surrey Development Applications. */
export const APPROVED_STATUSES = [
  'Conditional Approval',
  'Final Approval',
  'Approved',
  'Issued',
];

/** Statuses treated as under review in the UI. */
export const UNDER_REVIEW_STATUSES = ['Under Review', 'Initial Review'];

/**
 * Text rules for excluding routine applications from the default showcase view.
 * Each rule documents what it filters and why.
 */
export const SHOWCASE_EXCLUSION_RULES = [
  {
    id: 'temporary_use',
    pattern: /\btemporary use permit\b/i,
    reason: 'Temporary use permits are not permanent development.',
  },
  {
    id: 'variance_only',
    pattern: /\bdevelopment variance permit\b/i,
    reason: 'Variance-only permits do not propose new buildings.',
  },
  {
    id: 'subdivision_only',
    pattern: /\bsubdivision\b/i,
    test: (desc) => /\bsubdivision\b/i.test(desc) && !/\bdevelopment permit\b/i.test(desc),
    reason: 'Subdivision-only applications without a development permit.',
  },
  {
    id: 'signage',
    pattern: /\b(signage|fascia sign|sign on the)\b/i,
    reason: 'Signage applications are not building development.',
  },
  {
    id: 'single_family',
    pattern: /\b(single[- ]family|single family dwelling|detached dwelling)\b/i,
    reason: 'Single-family applications are excluded from the showcase.',
  },
];

/**
 * Text rules for including real development applications in the showcase view.
 * An approved application must match at least one inclusion rule and no exclusion rule.
 */
export const SHOWCASE_INCLUSION_RULES = [
  {
    id: 'rezoning_cd',
    pattern: /\brezoning\b.*\b(comprehensive development|(?<!\w)cd\b)/i,
    reason: 'Rezoning to a comprehensive development zone.',
  },
  {
    id: 'dev_permit_building',
    pattern: /\bdevelopment permit\b.*\b(apartment|residential building|mixed[- ]use|commercial|industrial|institutional|townhouse|tower|\d+[- ]storey|\d+ storey|multi[- ]unit|units)\b/i,
    reason: 'Development permit for multi-unit or non-residential buildings.',
  },
  {
    id: 'building_development',
    pattern: /\b(permit the development of|development of a)\b.*\b(apartment|residential building|mixed[- ]use|commercial|industrial|institutional|townhouse|tower|\d+[- ]storey|\d+ storey|multi[- ]unit)\b/i,
    reason: 'Stated building development in the application description.',
  },
  {
    id: 'ocp_far',
    pattern: /\bocp amendment\b.*\bfar\b/i,
    reason: 'OCP amendment changing density (FAR) for centre development.',
  },
];

export function normalizeDescription(description) {
  return (description || '').replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isApprovedStatus(status) {
  return APPROVED_STATUSES.includes(status);
}

export function isUnderReviewStatus(status) {
  return UNDER_REVIEW_STATUSES.includes(status);
}

export function getShowcaseExclusion(description) {
  const desc = normalizeDescription(description);
  for (const rule of SHOWCASE_EXCLUSION_RULES) {
    const matched = rule.test ? rule.test(desc) : rule.pattern.test(desc);
    if (matched) return rule;
  }
  return null;
}

export function getShowcaseInclusion(description) {
  const desc = normalizeDescription(description);
  for (const rule of SHOWCASE_INCLUSION_RULES) {
    if (rule.pattern.test(desc)) return rule;
  }
  return null;
}

export function isShowcaseProject(properties) {
  const status = properties?.STATUS;
  const description = properties?.DESCRIPTION;
  if (!isApprovedStatus(status)) return false;
  if (getShowcaseExclusion(description)) return false;
  return Boolean(getShowcaseInclusion(description));
}

export function underReviewLabel(status) {
  return isUnderReviewStatus(status) ? 'Under review' : '';
}
