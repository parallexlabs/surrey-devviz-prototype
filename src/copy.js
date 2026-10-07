export const PAGE_TITLE = 'Explore Surrey\'s development and destinations';

export const PURPOSE_LINE =
  'Selected development applications alongside civic investments, transit and places to visit in three Surrey pilot areas. Status is shown as the City publishes it; conditional approval is not a building permit.';

export const NON_AFFILIATION =
  'Independent public-data prototype by ParalleX Labs Inc. Not affiliated with or endorsed by the City of Surrey.';

export const RINGS_EXPLANATION =
  '400 m and 800 m straight-line radius (not walking routes or times)';

export const STATUS_SOURCE = 'Source: City of Surrey Development Applications';

export const ILLUSTRATIVE_HEIGHT_LABEL =
  'Illustrative height: no storey count could be read from the application';

export const EXTRUSION_NAME = 'Schematic application-area extrusion';

export const EXTRUSION_LIMIT =
  'Application areas are extruded uniformly for illustration. They are not proposed building footprints or approved architectural massing.';

export const MASSING_NOTE = EXTRUSION_LIMIT;

export const CONTEXT_LINE =
  'Development context only. Property availability and investment terms are not shown.';

export const AREA_COUNT_NOTE =
  'A public-data selection, not a complete inventory or the City\'s final showcase list.';

export const SHOWCASE_CLOSING =
  'Explore a project, open its City source, or share this view.';

export const APPLICATION_LINK_LABEL = 'View the City\'s application record';

export const ACCESSIBILITY_STATEMENT =
  'Tested with axe-core: 0 automatically detected violations in the tested states, plus manual keyboard testing. Automated tools cannot confirm full WCAG conformance. The project list gives access to every project and place without the map.';

export const OPENING_LAYERS = { skytrain: true, plan: true, civic: true };

export function estimatedHeightLabel(storeys, heightM) {
  return `Estimated height about ${heightM} m: ${storeys} storeys stated in the application x 3.2 m. Not a surveyed or approved height.`;
}

export function areaCountLine(count) {
  return `${count} selected records in this prototype`;
}

export function skytrainStationLine(name, distanceLabel) {
  return `Nearest SkyTrain station: ${name}, about ${distanceLabel} straight-line (not a walking route)`;
}
