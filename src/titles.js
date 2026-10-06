import { normalizeDescription } from './showcase.js';

const TITLE_LIMIT = 72;

function clauseAfter(text, phrase) {
  const index = text.toLowerCase().lastIndexOf(phrase.toLowerCase());
  if (index === -1) return '';
  const rest = text.slice(index + phrase.length).trim();
  return rest.split(/[;.]/)[0].trim();
}

function asSentence(text) {
  const trimmed = text.replace(/[.\s]+$/g, '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function shorten(text) {
  if (text.length <= TITLE_LIMIT) return text;
  return `${text.slice(0, TITLE_LIMIT - 1).trim()}…`;
}

function titleClause(description) {
  const text = normalizeDescription(description);
  if (!text) return '';
  const permitted =
    clauseAfter(text, 'to permit the development of') || clauseAfter(text, 'to permit');
  const clause = permitted || text.split(/[;.]/)[0].trim();
  return asSentence(clause);
}

/**
 * Full title for the project panel. The list uses the shortened form.
 */
export function projectPanelTitle(description) {
  return titleClause(description) || 'Application';
}

/**
 * Title from the application's own words.
 * Prefers the clause after "to permit the development of", then "to permit".
 */
export function projectTitle(description) {
  return shorten(projectPanelTitle(description)) || 'Application';
}

export function projectSubtitle(properties) {
  return properties?.PROJECT_NO || properties?.project_no || '';
}

export function projectListLabel(properties) {
  const title = projectTitle(properties?.DESCRIPTION);
  const no = projectSubtitle(properties);
  return no ? `${title} (${no})` : title;
}
