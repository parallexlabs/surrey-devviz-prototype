import { normalizeDescription } from './showcase.js';

/**
 * Build a short title from the application's own description words.
 * Uses the first clause before a semicolon or sentence break; never invents a name.
 */
export function projectTitle(description) {
  const text = normalizeDescription(description);
  if (!text) return 'Application';
  const clause = text.split(/[;]/)[0].trim();
  const shortened = clause.length > 72 ? `${clause.slice(0, 71).trim()}…` : clause;
  return shortened || 'Application';
}

export function projectSubtitle(properties) {
  return properties?.PROJECT_NO || properties?.project_no || '';
}

export function projectListLabel(properties) {
  const title = projectTitle(properties?.DESCRIPTION);
  const no = projectSubtitle(properties);
  return no ? `${title} (${no})` : title;
}
