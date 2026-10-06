import { pilotAreaLabel } from './data.js';
import { formatDistance } from './proximity.js';
import { projectPanelTitle, projectSubtitle } from './titles.js';
import {
  APPLICATION_LINK_LABEL,
  CONTEXT_LINE,
  STATUS_SOURCE,
  skytrainStationLine,
} from './copy.js';

export function isHttpUrl(value) {
  const url = String(value ?? '').trim();
  return /^https?:\/\//i.test(url);
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
  const applicationUrl = isHttpUrl(properties?.WEBLINK) ? String(properties.WEBLINK).trim() : null;
  const documentsUrl = isHttpUrl(properties?.APPLICATION_DOCUMENTS_WEBLINK)
    ? String(properties.APPLICATION_DOCUMENTS_WEBLINK).trim()
    : null;
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
    projectNo: projectSubtitle(properties),
    pilotArea: pilotAreaLabel(properties?.pilot_area),
    documentsUrl,
    statusSource: STATUS_SOURCE,
    contextLine: CONTEXT_LINE,
  };
}
