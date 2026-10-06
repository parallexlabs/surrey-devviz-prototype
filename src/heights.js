import { estimatedHeightLabel, ILLUSTRATIVE_HEIGHT_LABEL } from './copy.js';

const STOREY_HEIGHT_M = 3.2;

const WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};

/** Patterns for stated storeys in application descriptions. */
const STOREY_PATTERNS = [
  /\b(\d+)\s*[- ]?\s*storeys?\b/i,
  /\b(\d+)\s*[- ]?\s*stories\b/i,
  /\b(?<![a-z-])(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)\s*[- ]?\s*storeys?\b/i,
  /\b(?<![a-z-])(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)\s*[- ]?\s*stories\b/i,
];

const ILLUSTRATIVE_HEIGHTS = {
  apartment: 45,
  tower: 60,
  mixed: 35,
  commercial: 18,
  industrial: 12,
  institutional: 15,
  townhouse: 12,
  default: 21,
};

export function parseStoreys(description) {
  const text = (description || '').replace(/\r\n/g, ' ');
  for (const pattern of STOREY_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = match[1].toLowerCase();
    const value = WORD_NUMBERS[raw] ?? Number.parseInt(raw, 10);
    if (Number.isFinite(value) && value > 0 && value <= 120) return value;
  }
  return null;
}

export function illustrativeHeightMeters(description) {
  const text = (description || '').toLowerCase();
  if (/\btower\b|\bhigh[- ]rise\b/.test(text)) return ILLUSTRATIVE_HEIGHTS.tower;
  if (/\bapartment\b/.test(text)) return ILLUSTRATIVE_HEIGHTS.apartment;
  if (/\bmixed[- ]use\b/.test(text)) return ILLUSTRATIVE_HEIGHTS.mixed;
  if (/\bcommercial\b|\bretail\b|\boffice\b/.test(text)) return ILLUSTRATIVE_HEIGHTS.commercial;
  if (/\bindustrial\b|\bwarehouse\b/.test(text)) return ILLUSTRATIVE_HEIGHTS.industrial;
  if (/\binstitutional\b|\bchurch\b|\bschool\b/.test(text)) return ILLUSTRATIVE_HEIGHTS.institutional;
  if (/\btownhouse\b|\browhouse\b|\bduplex\b/.test(text)) return ILLUSTRATIVE_HEIGHTS.townhouse;
  return ILLUSTRATIVE_HEIGHTS.default;
}

export function computeProjectHeight(description) {
  const storeys = parseStoreys(description);
  if (storeys != null) {
    return {
      height_m: Math.round(storeys * STOREY_HEIGHT_M * 10) / 10,
      height_source: 'estimated',
      storeys,
      height_label: estimatedHeightLabel(storeys),
    };
  }
  const height_m = illustrativeHeightMeters(description);
  return {
    height_m,
    height_source: 'illustrative',
    storeys: null,
    height_label: ILLUSTRATIVE_HEIGHT_LABEL,
  };
}

export const HEIGHT_LEGEND = {
  estimated: 'Stated storeys × 3.2 m',
  illustrative: 'Illustrative height by building type',
};
