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
  const lines = [
    `Showcase projects: ${summary.showcaseCount}`,
    ...summary.areaLines,
    `Within ${summary.skytrainRadiusM} m of SkyTrain: ${summary.nearSkyTrain}`,
  ];
  if (summary.tallestStoreys > 0) {
    lines.push(
      `Tallest stated storeys: ${summary.tallestStoreys}${summary.tallestProject ? ` (${summary.tallestProject})` : ''}`,
    );
  } else {
    lines.push('Tallest stated storeys: none stated in showcase descriptions');
  }
  return lines;
}
