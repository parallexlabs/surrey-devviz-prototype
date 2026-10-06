import { SHOWCASE_EXCLUSION_RULES, SHOWCASE_INCLUSION_RULES } from './showcase.js';
import { latestRetrievalDate, publicDataRetrievedLabel } from './data.js';

function sentences(rules) {
  return rules.map((rule) => rule.reason.replace(/\.$/, '')).join('. ');
}

export function methodologyModel(sources, buildId = 'dev') {
  const retrieved = publicDataRetrievedLabel(sources);
  const retrievedOn = latestRetrievalDate(sources) || 'an unknown date';
  const sourceLines = (sources || []).map((source) => {
    const when = (source.retrieved_at || '').slice(0, 10);
    const name = source.layer || source.file;
    const licence = source.licence || 'Licence not recorded.';
    const count = source.feature_count ?? 0;
    return `${name}: ${count} features. ${licence}${when ? ` Retrieved ${when}.` : ''}`;
  });

  return {
    retrieved,
    sections: [
      {
        heading: 'Sources and licences',
        paragraphs: sourceLines.length ? sourceLines : ['No source list was loaded.'],
      },
      {
        heading: 'Showcase rules',
        paragraphs: [
          'The default view shows approved applications that match a development rule and do not match an exclusion rule.',
          `Included: ${sentences(SHOWCASE_INCLUSION_RULES)}.`,
          `Left out of the showcase: ${sentences(SHOWCASE_EXCLUSION_RULES)}.`,
          'Choose All applications to see every active application in the data, including those still under review.',
        ],
      },
      {
        heading: 'Height method',
        paragraphs: [
          'Where the application states a number of storeys, the model multiplies that number by 3.2 metres. That estimated height is not a surveyed or approved height.',
          'Where the public application does not state a height or a storey count, the model draws illustrative massing. The panel says the height was not stated.',
        ],
      },
      {
        heading: 'Limitations',
        paragraphs: [
          'Campbell Heights is the union of the City of Surrey Campbell Heights Local Area Plan and South Campbell Heights Local Area Plan. A project is placed in a pilot area only when its location is inside that official polygon.',
          'SkyTrain lines and stations come from OpenStreetMap and may omit planned extensions.',
          '400 m and 800 m straight-line radius (not walking routes or times).',
          'The City Centre Plan boundary is read live from the City\'s published ArcGIS layer when available.',
          'Existing building footprints are shown for City Centre only.',
          'This prototype is not affiliated with or endorsed by the City of Surrey and is not a regulatory record.',
        ],
      },
      {
        heading: 'Prototype and proposed delivery',
        paragraphs: [
          `This prototype shows public exploration using MapLibre and a public-data snapshot retrieved ${retrievedOn}. It does not show City staff publishing through ArcGIS Online. In the proposed delivery, City GIS staff publish approved content through the City's ArcGIS Online and the public site presents it. 360-degree drone imagery is not included in this prototype.`,
          'Complements, not replaces, existing City visualizations such as the City Centre Future model (2024) by Invest Surrey and the Downtown Surrey BIA, which shows proposed projects; this prototype shows approved and conditionally approved records only.',
          `Build ${buildId}. Data retrieved ${retrievedOn}.`,
        ],
      },
    ],
  };
}
