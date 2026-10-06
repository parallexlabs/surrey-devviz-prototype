import { SHOWCASE_EXCLUSION_RULES, SHOWCASE_INCLUSION_RULES } from './showcase.js';
import { publicDataRetrievedLabel } from './data.js';

function sentences(rules) {
  return rules.map((rule) => rule.reason.replace(/\.$/, '')).join('. ');
}

export function methodologyModel(sources) {
  const retrieved = publicDataRetrievedLabel(sources);
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
          'Where the application states a number of storeys, the model multiplies that number by 3.2 metres. The panel says the height was estimated from those stated storeys.',
          'Where the public application does not state a height or a storey count, the model uses an illustrative height based on the building type in the description. That height is not a measurement.',
        ],
      },
      {
        heading: 'Limitations',
        paragraphs: [
          'Campbell Heights is the union of the City of Surrey Campbell Heights Local Area Plan and South Campbell Heights Local Area Plan. A project is placed in a pilot area only when its location is inside that official polygon.',
          'SkyTrain lines and stations come from OpenStreetMap and may omit planned extensions.',
          'The 400 m and 800 m rings are straight-line distances, not walking routes.',
          'Existing building footprints are shown for City Centre only.',
          'This prototype is not affiliated with or endorsed by the City of Surrey and is not a regulatory record.',
        ],
      },
    ],
  };
}
