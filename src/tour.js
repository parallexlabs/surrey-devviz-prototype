import { isShowcaseProject } from './showcase.js';
import { parseStoreys } from './heights.js';
import { nearestStation, formatDistance, featureCentroid } from './proximity.js';
import { geometryContains, getSkyTrainStations, getSkyTrainLines } from './data.js';

function pointInArea(lon, lat, area) {
  if (!area) return false;
  if (area.geometry) return geometryContains(area.geometry, lon, lat);
  const bbox = area.bbox;
  if (!bbox) return false;
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function countShowcaseInArea(projects, area) {
  return projects.filter(
    (f) => f.properties.pilot_area === area && isShowcaseProject(f.properties),
  ).length;
}

function civicAnchorsInArea(amenities, area) {
  return amenities.features.filter((f) => {
    if (f.geometry?.type !== 'Point') return false;
    const [lon, lat] = f.geometry.coordinates;
    return pointInArea(lon, lat, area);
  });
}

function tallestShowcase(projects, area = null) {
  let best = null;
  let bestStoreys = 0;
  for (const feature of projects) {
    if (area && feature.properties.pilot_area !== area) continue;
    if (!isShowcaseProject(feature.properties)) continue;
    const storeys = parseStoreys(feature.properties.DESCRIPTION);
    if (storeys != null && storeys > bestStoreys) {
      bestStoreys = storeys;
      best = feature;
    }
  }
  return best ? { feature: best, storeys: bestStoreys } : null;
}

function stationsInArea(stations, area) {
  return stations.filter((s) => {
    const [lon, lat] = s.geometry.coordinates;
    return pointInArea(lon, lat, area);
  });
}

export function buildTourSteps(projectsFc, skytrainFc, amenitiesFc, pilotAreas) {
  const projects = projectsFc.features;
  const stations = getSkyTrainStations(skytrainFc);
  const lines = getSkyTrainLines(skytrainFc);
  const showcaseTotal = projects.filter((f) => isShowcaseProject(f.properties)).length;
  const total = projects.length;

  const steps = [
    {
      id: 'overview',
      preset: 'overview',
      title: 'Surrey overview',
      caption: `${showcaseTotal} showcase projects from ${total} active applications across ${Object.keys(pilotAreas || {}).length} pilot areas.`,
    },
  ];

  const ccStations = stationsInArea(stations, pilotAreas?.city_centre);
  const ccAnchors = civicAnchorsInArea(amenitiesFc, pilotAreas?.city_centre);
  const anchorNames = ccAnchors
    .map((f) => f.properties.name)
    .filter(Boolean)
    .slice(0, 4);
  steps.push({
    id: 'city_centre',
    preset: 'city_centre',
    title: 'City Centre',
    caption: `${countShowcaseInArea(projects, 'city_centre')} showcase projects. SkyTrain: ${lines.length} line segment${lines.length === 1 ? '' : 's'} and ${ccStations.length} station${ccStations.length === 1 ? '' : 's'} in view${ccStations.length ? ` (${ccStations.map((s) => s.properties.name).filter(Boolean).join(', ')})` : ''}.${anchorNames.length ? ` Civic anchors in data: ${anchorNames.join(', ')}.` : ''}`,
    toggles: { skytrain: true, plan: true },
  });

  const tallest = tallestShowcase(projects, 'city_centre') || tallestShowcase(projects);
  if (tallest) {
    const nearest = nearestStation(tallest.feature, stations);
    steps.push({
      id: 'tallest',
      preset: 'city_centre',
      title: 'Tallest stated storeys',
      caption: `${tallest.feature.properties.PROJECT_NO}: ${tallest.storeys} storeys stated in the application description.${nearest ? ` Nearest SkyTrain (${nearest.station.properties.name || 'station'}): ${formatDistance(nearest.distanceM)} straight-line.` : ''}`,
      focusId: tallest.feature.properties.OBJECTID ?? tallest.feature.properties.PROJECT_NO,
      toggles: { skytrain: true },
    });
  }

  steps.push({
    id: 'fleetwood',
    preset: 'fleetwood',
    title: 'Fleetwood',
    caption: `${countShowcaseInArea(projects, 'fleetwood')} showcase projects in the Fleetwood Town Centre pilot area.${(() => {
      const anchors = civicAnchorsInArea(amenitiesFc, pilotAreas?.fleetwood);
      const names = anchors.map((f) => f.properties.name).filter(Boolean);
      return names.length ? ` Amenities in data: ${names.join(', ')}.` : '';
    })()}`,
  });

  steps.push({
    id: 'campbell_heights',
    preset: 'campbell_heights',
    title: 'Campbell Heights',
    caption: `${countShowcaseInArea(projects, 'campbell_heights')} showcase projects inside the Campbell Heights and South Campbell Heights local area plans.`,
  });

  return steps;
}

export function tourStepCamera(step, pilotAreas, projectsFc) {
  if (step.focusId && projectsFc) {
    const feature = projectsFc.features.find(
      (f) =>
        String(f.properties.OBJECTID ?? f.properties.PROJECT_NO) === String(step.focusId),
    );
    const center = feature ? featureCentroid(feature) : null;
    if (center) return { center, zoom: 16, pitch: 45, bearing: -10 };
  }
  return null;
}
