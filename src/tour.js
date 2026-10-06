import { isShowcaseProject } from './showcase.js';
import { parseStoreys } from './heights.js';
import { nearestStation, formatDistance } from './proximity.js';
import { getSkyTrainStations } from './data.js';

const NEAR_SKYTRAIN_M = 800;
const MAJOR_PROJECT_NO = '21-0313-00';

function countShowcaseInArea(projects, area) {
  return projects.filter(
    (feature) => feature.properties.pilot_area === area && isShowcaseProject(feature.properties),
  ).length;
}

function projectsNearSkyTrain(projects, stations) {
  return projects.filter((feature) => {
    if (!isShowcaseProject(feature.properties)) return false;
    const nearest = nearestStation(feature, stations);
    return nearest && nearest.distanceM <= NEAR_SKYTRAIN_M;
  }).length;
}

export function buildTourSteps(projectsFc, skytrainFc, civic, pilotAreas) {
  const projects = projectsFc?.features || [];
  const stations = getSkyTrainStations(skytrainFc || { features: [] });
  const near = projectsNearSkyTrain(projects, stations);
  const major = projects.find((feature) => feature.properties.PROJECT_NO === MAJOR_PROJECT_NO);
  const arena = (civic?.places || []).find((place) => place.id === 'city-centre-arena');
  const fleetwoodCount = countShowcaseInArea(projects, 'fleetwood');
  const campbellCount = countShowcaseInArea(projects, 'campbell_heights');

  let majorCaption = `Application ${MAJOR_PROJECT_NO} is not in the loaded development applications.`;
  if (major) {
    const nearest = nearestStation(major, stations);
    const storeys = parseStoreys(major.properties.DESCRIPTION);
    const name = nearest?.station?.properties?.name || 'SkyTrain station';
    const distance = nearest ? formatDistance(nearest.distanceM) : null;
    if (nearest && storeys != null) {
      majorCaption = `Application ${MAJOR_PROJECT_NO} states ${storeys} storeys and its nearest SkyTrain station is ${name}, about ${distance} straight-line (not a walking route).`;
    } else if (nearest) {
      majorCaption = `Nearest SkyTrain station for application ${MAJOR_PROJECT_NO}: ${name}, about ${distance} straight-line (not a walking route).`;
    } else if (storeys != null) {
      majorCaption = `Application ${MAJOR_PROJECT_NO} states ${storeys} storeys in the application description.`;
    }
  }

  const arenaCaption = arena
    ? `${arena.name} (${arena.category}) is not included in the development application count.`
    : 'City Centre Arena is not in the loaded civic places.';

  void pilotAreas;

  return [
    {
      id: 'city-centre',
      title: 'Development and destinations in City Centre',
      preset: 'city_centre',
      areaId: 'city-centre',
      caption: `${near} showcase projects are within 800 m straight-line of a SkyTrain station.`,
      layers: { skytrain: true, civic: true, plan: true },
    },
    {
      id: 'major-project',
      title: 'A major project and its transit context',
      preset: 'city_centre',
      areaId: 'city-centre',
      focusId: major ? major.properties.OBJECTID ?? major.properties.PROJECT_NO : MAJOR_PROJECT_NO,
      caption: majorCaption,
      layers: { skytrain: true },
    },
    {
      id: 'arena',
      title: 'Civic investment: City Centre Arena',
      preset: 'city_centre',
      areaId: 'city-centre',
      civicId: 'city-centre-arena',
      caption: arenaCaption,
      layers: { civic: true, skytrain: true },
    },
    {
      id: 'fleetwood',
      title: 'Fleetwood Town Centre',
      preset: 'fleetwood',
      areaId: 'fleetwood',
      caption: `${fleetwoodCount} selected records in this prototype are in Fleetwood Town Centre.`,
      layers: {},
    },
    {
      id: 'campbell-heights',
      title: 'Campbell Heights',
      preset: 'campbell_heights',
      areaId: 'campbell-heights',
      caption: `${campbellCount} selected records in this prototype are in Campbell Heights.`,
      layers: {},
    },
  ];
}

export function tourStepCamera(step, pilotAreas, projectsFc) {
  void pilotAreas;
  void projectsFc;
  void step;
  return null;
}
