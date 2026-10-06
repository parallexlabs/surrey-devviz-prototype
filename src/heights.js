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
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const ONES = 'one|two|three|four|five|six|seven|eight|nine';
const TEENS = 'ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const WORD_NUMBER = `(?:(?:${TENS})(?:[-\\s]+(?:${ONES}))?|(?:${TEENS})|(?:${ONES}))`;

function wordToNumber(raw) {
  const parts = String(raw).toLowerCase().split(/[-\s]+/).filter(Boolean);
  if (parts.length === 1) return WORD_NUMBERS[parts[0]] ?? null;
  if (parts.length === 2 && WORD_NUMBERS[parts[0]] >= 20 && WORD_NUMBERS[parts[1]] < 10) {
    return WORD_NUMBERS[parts[0]] + WORD_NUMBERS[parts[1]];
  }
  return null;
}

function collectStoreys(text, pattern, parse) {
  const found = [];
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    if (/\b(?:hundred|thousand)(?:\s+and)?[\s-]+$/i.test(before)) continue;
    if (/^\s+(?:of\s+)?(?:(?:underground|above[- ]ground)\s+)?parking\b/i.test(after)) continue;
    const value = parse(match[1]);
    if (Number.isFinite(value) && value > 0 && value <= 120) found.push(value);
  }
  return found;
}

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
  const digit = collectStoreys(
    text,
    /(?<![\d.])(\d+)\s*[- ]?\s*stor(?:eys?|ies)\b/gi,
    (raw) => Number.parseInt(raw, 10),
  );
  const words = collectStoreys(
    text,
    new RegExp(String.raw`\b(?<![a-z-])(${WORD_NUMBER})\s*[- ]?\s*stor(?:eys?|ies)\b`, 'gi'),
    wordToNumber,
  );
  const found = [...digit, ...words];
  if (!found.length) return null;
  return Math.max(...found);
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
    const height_m = Math.round(storeys * STOREY_HEIGHT_M * 10) / 10;
    return {
      height_m,
      height_source: 'estimated',
      storeys,
      height_label: estimatedHeightLabel(storeys, height_m),
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
  estimated: 'Estimated: stated storeys x 3.2 m',
  illustrative: 'Illustrative: lighter fill and outline',
};
