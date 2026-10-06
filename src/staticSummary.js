import { NON_AFFILIATION, PAGE_TITLE, PURPOSE_LINE } from './copy.js';
import { getSkyTrainStations, pilotAreaLabel, SURREY_LICENCE_TEXT, SURREY_LICENCE_URL } from './data.js';
import { safeHttpUrl } from './detail.js';
import { isShowcaseProject } from './showcase.js';
import { computeAtAGlance, formatAtAGlance, atAGlanceItemText } from './summary.js';
import { projectPanelTitle } from './titles.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const AREA_ORDER = { city_centre: 0, fleetwood: 1, campbell_heights: 2 };

export function renderStaticSummary({ projects, skytrain, civic }) {
  const features = projects?.features || [];
  const stations = getSkyTrainStations(skytrain || { features: [] });
  const counts = formatAtAGlance(computeAtAGlance(features, stations));
  const showcase = features
    .filter((feature) => isShowcaseProject(feature.properties))
    .sort((a, b) => {
      const area =
        (AREA_ORDER[a.properties.pilot_area] ?? 9) - (AREA_ORDER[b.properties.pilot_area] ?? 9);
      if (area !== 0) return area;
      return String(a.properties.PROJECT_NO || '').localeCompare(String(b.properties.PROJECT_NO || ''));
    });
  const places = civic?.places || [];

  const countItems = counts.map((item) => `<li>${escapeHtml(atAGlanceItemText(item))}</li>`).join('');
  const placeItems = places
    .map((place) => {
      const label = place.source_label || place.name;
      const href = safeHttpUrl(place.source_url);
      const source = href
        ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
        : escapeHtml(String(place.source_url || label));
      return `<li><strong>${escapeHtml(place.name)}</strong> (${escapeHtml(place.category)}). ${escapeHtml(place.text)} ${source}</li>`;
    })
    .join('');
  const projectItems = showcase
    .map((feature) => {
      const props = feature.properties;
      const title = projectPanelTitle(props.DESCRIPTION);
      return `<li>${escapeHtml(title)}. Application ${escapeHtml(props.PROJECT_NO || '')}. Status ${escapeHtml(props.STATUS || '')}. ${escapeHtml(pilotAreaLabel(props.pilot_area))}.</li>`;
    })
    .join('');

  return `<article class="static-summary" id="main-content" tabindex="-1">
  <h1>${escapeHtml(PAGE_TITLE)}</h1>
  <p>${escapeHtml(PURPOSE_LINE)}</p>
  <h2>Counts</h2>
  <ul>${countItems}</ul>
  <h2>Civic investments and destinations</h2>
  <ul>${placeItems}</ul>
  <h2>Development projects</h2>
  <ul>${projectItems}</ul>
  <p>${escapeHtml(SURREY_LICENCE_TEXT)} <a href="${escapeHtml(SURREY_LICENCE_URL)}">City data licence</a>.</p>
  <p>Transit, amenities and civic coordinates: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>.</p>
  <p>${escapeHtml(NON_AFFILIATION)}</p>
</article>`;
}
