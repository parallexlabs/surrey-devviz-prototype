import { normalizeDescription } from './showcase.js';

const TITLE_LIMIT = 72;
const ABBREVIATION = /\b(?:sq|m|no|approx|st|ave)\.$/i;
const DENSITY_ONLY = /^(?:(?:a|the)\s+)?(?:density(?:\s+of)?\s+)?\d+(?:[ .]\d+)*\s+(?:(?:gross|net)\s+)?FAR$/i;

function firstClause(text) {
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === ';') return text.slice(0, index).trim();
    if (text[index] !== '.') continue;
    if (/\d/.test(text[index - 1] || '') && /\d/.test(text[index + 1] || '')) continue;
    if (ABBREVIATION.test(text.slice(0, index + 1))) continue;
    const rest = text.slice(index + 1);
    if (!rest.trim() || /^\s+(?:[A-Z]|[A-Za-z]+(?=\s|$|[.,;:!?()]))/.test(rest)) {
      return text.slice(0, index).trim();
    }
  }
  return text.trim();
}

function clauseAfter(text, phrase) {
  const lower = text.toLowerCase();
  let index = lower.lastIndexOf(phrase.toLowerCase());
  while (index !== -1) {
    const clause = firstClause(text.slice(index + phrase.length).trim());
    if (clause && (phrase !== 'to permit' || !DENSITY_ONLY.test(clause))) return clause;
    index = index === 0 ? -1 : lower.lastIndexOf(phrase.toLowerCase(), index - 1);
  }
  return '';
}

function asSentence(text) {
  const trimmed = text.replace(/[.\s]+$/g, '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function shorten(text) {
  if (text.length <= TITLE_LIMIT) return text;
  let end = text.lastIndexOf(' ', TITLE_LIMIT - 1);
  while (end > 0 && /\d$/.test(text.slice(0, end)) && /^ \d{3}(?!\d)/.test(text.slice(end))) {
    end = text.lastIndexOf(' ', end - 1);
  }
  return `${end > 0 ? text.slice(0, end) : ''}…`;
}

function titleClause(description) {
  const text = normalizeDescription(description);
  if (!text) return '';
  const phrases = [
    'to permit the development of',
    'to allow the development of',
    'to allow for',
    'to construct',
    'to permit',
  ];
  for (const phrase of phrases) {
    const clause = clauseAfter(text, phrase);
    if (clause) return asSentence(clause);
  }
  return asSentence(firstClause(text));
}

/**
 * Full title for the project panel. The list uses the shortened form.
 */
export function projectPanelTitle(description) {
  return titleClause(description) || 'Application';
}

/**
 * Title from the application's own words, preferring the development clause.
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
