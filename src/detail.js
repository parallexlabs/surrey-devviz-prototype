import { pilotAreaLabel } from './data.js';
import { formatDistance } from './proximity.js';
import { projectPanelTitle, projectSubtitle } from './titles.js';
import {
  APPLICATION_LINK_LABEL,
  CONTEXT_LINE,
  STATUS_SOURCE,
  skytrainStationLine,
} from './copy.js';

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
  const applicationUrl = safeHttpUrl(properties?.WEBLINK);
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
