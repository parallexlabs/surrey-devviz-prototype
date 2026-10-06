import { pilotAreaLabel } from './data.js';
import { formatDistance } from './proximity.js';
import { projectPanelTitle, projectSubtitle } from './titles.js';
import {
  APPLICATION_LINK_LABEL,
  CONTEXT_LINE,
  STATUS_SOURCE,
  skytrainStationLine,
} from './copy.js';

const CITY_RECORD_HOST = 'citizenportal.surrey.ca';
const CITY_RECORD_PATH = '/publicProjectForward.html';
const CITY_RECORD_QUERY = /^year=(\d{2})(?:\s+|&)seq=(\d{4})$/;

export function safeHttpUrl(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || /[\u0000-\u001F\u007F]/.test(raw)) return null;
  try {
    const url = new URL(raw.replace(/ /g, '%20'));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function cityRecordHref(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || /[\u0000-\u001F\u007F]/.test(raw)) return null;
  const queryAt = raw.indexOf('?');
  if (queryAt < 0) return null;
  const base = raw.slice(0, queryAt);
  const match = CITY_RECORD_QUERY.exec(raw.slice(queryAt + 1));
  if (!match || /\s/.test(base)) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:' || url.host !== CITY_RECORD_HOST) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (!url.pathname.endsWith(CITY_RECORD_PATH)) return null;
    url.search = `?year=${match[1]}&seq=${match[2]}`;
    return url.href;
  } catch {
    return null;
  }
}

export function cityRecordUrl(value) {
  return cityRecordHref(value) ?? safeHttpUrl(value);
}

export function isHttpUrl(value) {
  return safeHttpUrl(value) != null;
}

export function plainDescription(description) {
  return String(description || '')
    .replace(/\r\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function projectPanelModel(properties, nearest) {
  const status = properties?.STATUS || 'Not provided';
  const stationName = nearest?.station?.properties?.name || 'SkyTrain station';
  const applicationUrl = cityRecordUrl(properties?.WEBLINK);
  const documentsUrl = safeHttpUrl(properties?.APPLICATION_DOCUMENTS_WEBLINK);
  return {
    title: projectPanelTitle(properties?.DESCRIPTION),
    description: plainDescription(properties?.DESCRIPTION) || 'Not provided',
    statusLine: `Application status: ${status}`,
    heightLine: properties?.height_label || '',
    skytrainLine: nearest
      ? skytrainStationLine(stationName, formatDistance(nearest.distanceM))
      : 'Nearest SkyTrain station: none in the loaded station data.',
    applicationUrl,
    applicationLinkLabel: APPLICATION_LINK_LABEL,
    applicationPlain: applicationUrl ? '' : String(properties?.WEBLINK ?? '').trim(),
    projectNo: projectSubtitle(properties),
    pilotArea: pilotAreaLabel(properties?.pilot_area),
    documentsUrl,
    documentsPlain: documentsUrl ? '' : String(properties?.APPLICATION_DOCUMENTS_WEBLINK ?? '').trim(),
    statusSource: STATUS_SOURCE,
    contextLine: CONTEXT_LINE,
  };
}
