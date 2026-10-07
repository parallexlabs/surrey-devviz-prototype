import { isShowcaseProject } from './showcase.js';
import { parseStoreys } from './heights.js';
import { nearestStation } from './proximity.js';
import { pilotAreaLabel } from './data.js';

const SKYTRAIN_NEAR_M = 800;

export function computeAtAGlance(projects, stations) {
  const showcase = projects.filter((f) => isShowcaseProject(f.properties));
  const perArea = {};
  for (const feature of showcase) {
    const area = feature.properties.pilot_area || 'unknown';
    perArea[area] = (perArea[area] || 0) + 1;
  }

  let nearSkyTrain = 0;
  let tallestStoreys = 0;
  let tallestProject = null;
  for (const feature of showcase) {
    const nearest = nearestStation(feature, stations);
    if (nearest && nearest.distanceM <= SKYTRAIN_NEAR_M) nearSkyTrain += 1;
    const storeys = parseStoreys(feature.properties.DESCRIPTION);
    if (storeys != null && storeys >= tallestStoreys) {
      tallestStoreys = storeys;
      tallestProject = feature.properties.PROJECT_NO;
    }
  }

  const areaLines = Object.entries(perArea)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([area, count]) => `${pilotAreaLabel(area)}: ${count}`);

  return {
    showcaseCount: showcase.length,
    perArea,
    areaLines,
    nearSkyTrain,
    tallestStoreys,
    tallestProject,
    skytrainRadiusM: SKYTRAIN_NEAR_M,
  };
}

export function formatAtAGlance(summary) {
  const items = [
    { kind: 'text', text: `Selected applications, all areas: ${summary.showcaseCount}` },
    ...summary.areaLines.map((text) => ({ kind: 'text', text })),
    { kind: 'text', text: `Within ${summary.skytrainRadiusM} m of SkyTrain: ${summary.nearSkyTrain}` },
  ];
  if (summary.tallestStoreys > 0) {
    items.push({
      kind: 'tallest',
      storeys: summary.tallestStoreys,
      project: summary.tallestProject,
    });
  } else {
    items.push({ kind: 'text', text: 'Tallest: none stated in showcase descriptions' });
  }
  return items;
}

export function atAGlanceItemText(item) {
  if (item.kind === 'tallest') {
    return `Tallest: ${item.storeys} storeys${item.project ? ` (${item.project})` : ''}`;
  }
  return item.text;
}

export function renderAtAGlanceItemHtml(item, escapeHtml) {
  if (item.kind === 'tallest') {
    const project = item.project
      ? ` <span class="summary-project">(${escapeHtml(item.project)})</span>`
      : '';
    return `Tallest: ${escapeHtml(String(item.storeys))} storeys${project}`;
  }
  return escapeHtml(item.text);
}
