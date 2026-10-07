import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { projectTitle, projectPanelTitle, projectSubtitle } from '../../src/titles.js';

const projects = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/development_projects.geojson'), 'utf8'),
);

const realDescriptions = {
  '23-0232-00':
    'Rezoning from Multiple\u00a0Residential\u00a045\u00a0Zone (RM-45)\u00a0to Comprehensive\u00a0Development\u00a0Zone (CD) (based on Multiple\u00a0Residential\u00a0Commercial\u00a0135\u00a0Zone\u00a0(RM-135); Subdivision from one (1) into two (2) lots; Official Community Plan (OCP) Amendment from Multiple Residential to Downtown and to Figure 16: Downtown Densities to permit a density of 5.5 FAR; Neighbourhood Concept Plan (NCP) Amendment to the City Centre Plan from Low to Mid Rise Residential to High Rise Residential - Type 1; Housing Agreement and Development Permit to allow the development of two high-rise residential towers of 25 and 35 storeys respectively  with 6-storey podiums  comprising 561 dwelling units  including 57 affordable rental units.',
  '23-0013-00':
    'Rezoning from Community Commercial Zone (C-8) to Comprehensive Development Zone (CD) (based on Multiple Residential 70 Zone (RM-70);  Official Community Plan (OCP) Text Amendment to allow for a density of 10.69 Gross FAR; City Centre Plan Amendment to allow for a density of 10.69 Gross FAR within the Central Business District Area 2; Development Permit to permit the development of a 42-storey mixed-use tower with a 6-storey podium consisting 5 695.33 sq. m of commercial and office space and 444 market rental residential dwelling units.',
  '20-0071-00':
    'Rezoning from Community Commercial Zone (C-8) to Comprehensive Development Zone (CD); Subdivision from one (1) lot into two (2) lots; Housing Agreement; Official Community Plan (OCP) Amendment to allow a reduction of non residential floor space in the Central Business District (CBD) designation; Development Permit to permit the development of a mixed-use  high-rise tower consisting 284 market rental residential dwelling units and approximately 3755.33 sq. m. of commercial space located in City Centre.',
  '22-0175-00':
    'Development Permit for an 865.44 sq.m addition to an existing building.',
  '26-0184-00':
    'Development Permit to construct a 30-storey mixed use tower consisting of 321 residential units and 735 sqm of commercial   daycare space  with a total of 24 291.29 sqm. Rezoning from R3 to MR9-C to facilitate the consolidation of 5 lots into 1 lot; OCP Amendment  to High-Rise II.',
  '24-0033-00':
    'Rezoning from RF to CD (Based on RM-135   C-8)  OCP Amendment from  5.5 FAR  to  7.5 FAR   City Centre Plan Amendment for a portion of the site from  Plaza  to  High-Rise Mixed Use  and  High-Rise Mixed Use 15.5 FAR  to  27.5 FAR   Consolidation from two (2) to one (1) lot  and a Development Permit for 298 residential units  and 4 397.00 sq. m. of commercial space. ',
  '23-0297-00':
    'OCP Amendment to Downtown Densities from 3.5 FAR to 5.5 FAR; City Centre Plan Amendment from Mid to High Rise Residential 3.5 FAR to High Rise Residential Type 1 5.5 FAR on the east portion of the site  and High Rise Mixed-Use Type 1 5.5 FAR on the west portion of the site; Rezoning from RF and RM-D to CD; Development Variance Permit to include  Surety Bond  in the definition of  Bond  in the Surrey Subdivision and Development Bylaw  1986  No. 8830  as amended  for Servicing Agreement No. 7823-0297-00; Development Permit to allow for one 38-storey mixed-used building and one 33-storey residential building consisting of 747 square metres of ground floor commercial and 822 residential units.',
  '23-0234-00':
    'OCP Amendment from Multiple Residential to Downtown 3.5 FAR. City Centre Plan Amendment of a portion from Low to Mid Rise Residential to Mid to High Residential and Mid to High Rise Mixed Use. Rezoning from CHI to CD. Development Permits for Form and Character  Sensitive Ecosystems  and Hazard Lands. Development Variance Permit for reduced streamside setbacks to allow for a phased development consisting of one 21-storey mixed-use tower and two residential towers of 24 and 37-storeys  with a total of 967 residential units and 240 sq. m of ground floor commercial space in City Centre.',
  '26-0133-00':
    'Subdivision of one R2-zoned lot into two R3-zoned lots  including a Development Variance Permit to vary the minimum lot width requirement from 15.0 m to 11.93 m for both new lots.\n',
};

function description(projectNo) {
  const feature = projects.features.find((item) => item.properties.PROJECT_NO === projectNo);
  if (!feature) throw new Error(`Missing ${projectNo}`);
  return feature.properties.DESCRIPTION;
}

function expectNoPartialNumber(title, source) {
  const text = title.replace(/…$/, '').toLowerCase();
  const normalized = source.replace(/\s+/g, ' ').trim().toLowerCase();
  const start = normalized.indexOf(text);
  expect(start).toBeGreaterThanOrEqual(0);
  if (!/\d$/.test(text)) return;
  const rest = normalized.slice(start + text.length);
  expect(rest).not.toMatch(/^(?:\.\d| \d{3}(?!\d))/);
}

describe('projectTitle', () => {
  it('prefers the clause after to permit', () => {
    const title = projectTitle(
      'Rezoning from RF to CD; Development Permit to permit a 6-storey residential building.',
    );
    expect(title).toBe('A 6-storey residential building');
    expect(title).not.toContain('Tower One');
  });

  it('does not invent a project name', () => {
    const title = projectTitle('Development Permit for 115 residential units.');
    expect(title.toLowerCase()).not.toContain('unnamed');
    expect(title).toContain('Development Permit');
  });

  it('uses real application words after to permit the development of', () => {
    expect(projectTitle(description('23-0166-00'))).toBe(
      'Two multi-tenant industrial buildings in Campbell Heights',
    );
    expect(projectTitle(description('19-0234-00'))).toBe(
      'A 43-storey residential apartment building in City Centre',
    );
    expect(projectTitle(description('21-0313-00'))).toMatch(/^A 67-storey mixed-use building/);
  });

  it('uses the clause after to permit when development of is absent', () => {
    expect(projectTitle(description('22-0043-00'))).toBe(
      'Subdivision into two single family small lots',
    );
  });

  it('capitalises a leading article as a sentence', () => {
    expect(
      projectTitle('Development Permit to permit the development of a 45-storey mixed-use tower.'),
    ).toBe('A 45-storey mixed-use tower');
  });

  it.each(Object.entries(realDescriptions))(
    'keeps the list title within 72 characters at a word boundary for %s',
    (projectNo, source) => {
      const panel = projectPanelTitle(source);
      const title = projectTitle(source);
      expect(title.length).toBeLessThanOrEqual(72);
      expect(title).toBe(title.trim());
      expectNoPartialNumber(title, source);
      if (panel.length <= 72) {
        expect(title).toBe(panel);
      } else {
        expect(title.endsWith('…')).toBe(true);
        const prefix = title.slice(0, -1);
        expect(prefix.length).toBeGreaterThan(0);
        expect(panel.startsWith(prefix)).toBe(true);
        expect(prefix).toBe(prefix.trimEnd());
        expect(panel.charAt(prefix.length)).toBe(' ');
      }
    },
  );

  it('backs up before a space-separated number group at the list limit', () => {
    const prefix = `A ${'x'.repeat(66)}`;
    expect(projectTitle(`${prefix} 5 695.33 sq. m of floor space`)).toBe(`${prefix}…`);
  });

  it('backs up across multiple space-separated number groups', () => {
    const prefix = `A ${'x'.repeat(64)}`;
    expect(projectTitle(`${prefix} 1 234 567 sq. m of floor space`)).toBe(`${prefix}…`);
  });

  it('does not cut an oversized single word', () => {
    expect(projectTitle('x'.repeat(80))).toBe('…');
  });
});

describe('projectPanelTitle', () => {
  it('keeps the full application clause without an ellipsis', () => {
    const title = projectPanelTitle(description('21-0313-00'));
    expect(title.startsWith('A 67-storey mixed-use building consisting of')).toBe(true);
    expect(title).toContain('746 residential dwelling units');
    expect(title).not.toContain('…');
    expect(title.length).toBeGreaterThan(projectTitle(description('21-0313-00')).length);
  });

  it.each(Object.entries(realDescriptions))(
    'does not end inside a number or alter the source for %s',
    (projectNo, source) => {
      const title = projectPanelTitle(source);
      expectNoPartialNumber(title, source);
      expect(title).not.toContain('…');
      expect(realDescriptions[projectNo]).toBe(source);
    },
  );

  it('describes the development rather than the density for 23-0232-00', () => {
    const title = projectPanelTitle(realDescriptions['23-0232-00']);
    expect(title).toMatch(/^Two high-rise residential towers of 25 and 35 storeys/);
    expect(title).toContain('561 dwelling units');
    expect(title).not.toBe('A density of 5');
    expect(title).not.toMatch(/5$/);
  });

  it('preserves the full addition area for 22-0175-00', () => {
    expect(projectPanelTitle(realDescriptions['22-0175-00'])).toBe(
      'Development Permit for an 865.44 sq.m addition to an existing building',
    );
  });

  it('preserves both lot widths for 26-0133-00', () => {
    expect(projectPanelTitle(realDescriptions['26-0133-00'])).toContain(
      '15.0 m to 11.93 m',
    );
  });

  it.each([
    ['23-0013-00', '5 695.33 sq. m'],
    ['20-0071-00', '3755.33 sq. m. of commercial space'],
    ['26-0184-00', '24 291.29 sqm'],
    ['24-0033-00', '4 397.00 sq. m. of commercial space'],
    ['23-0297-00', '822 residential units'],
    ['23-0234-00', '967 residential units'],
  ])('retains the complete development details for %s', (projectNo, expected) => {
    expect(projectPanelTitle(realDescriptions[projectNo])).toContain(expected);
  });

  it.each([
    ['to permit the development of', 'to allow the development of'],
    ['to allow the development of', 'to allow for'],
    ['to allow for', 'to construct'],
    ['to construct', 'to permit'],
  ])('prefers %s over %s', (preferred, fallback) => {
    const source =
      `Development Permit ${preferred} a residential building; ` +
      `Development Permit ${fallback} an office building.`;
    expect(projectPanelTitle(source)).toBe('A residential building');
  });

  it.each(['a density of 5.5 FAR', '5.5 FAR', 'a density of 10.69 Gross FAR'])(
    'does not select a density-only to permit clause: %s',
    (figure) => {
      expect(
        projectPanelTitle(`Rezoning from RF to CD; OCP Amendment to permit ${figure}.`),
      ).toBe('Rezoning from RF to CD');
    },
  );

  it('keeps a development clause that includes a FAR figure', () => {
    expect(
      projectPanelTitle('Development Permit to permit a 5.5 FAR mixed-use building.'),
    ).toBe('A 5.5 FAR mixed-use building');
  });

  it('finds an earlier development clause when the last to permit clause is density-only', () => {
    expect(
      projectPanelTitle(
        'Development Permit to permit a residential building; OCP Amendment to permit a density of 5.5 FAR.',
      ),
    ).toBe('A residential building');
  });

  it.each(['sq.', 'm.', 'No.', 'approx.', 'St.', 'Ave.'])(
    'does not split after the abbreviation %s in either case',
    (abbreviation) => {
      for (const value of [abbreviation, abbreviation.toUpperCase()]) {
        expect(
          projectPanelTitle(
            `Development Permit for 25 ${value} of floor space. Rezoning from RF to CD.`,
          ),
        ).toBe(`Development Permit for 25 ${value} of floor space`);
      }
    },
  );

  it.each(['Another application follows.', 'another application follows.'])(
    'splits at a sentence-ending period before %s',
    (nextSentence) => {
      expect(
        projectPanelTitle(`Development Permit for a building. ${nextSentence}`),
      ).toBe('Development Permit for a building');
    },
  );

  it('does not split before a digit-leading word', () => {
    expect(
      projectPanelTitle('Development Permit for a building. 42 units are proposed.'),
    ).toBe('Development Permit for a building. 42 units are proposed');
  });

  it('uses the first clause when no preferred development phrase is present', () => {
    expect(projectPanelTitle('Rezoning from RF to CD; Subdivision into two lots.')).toBe(
      'Rezoning from RF to CD',
    );
  });

  it('uses Application for an empty description', () => {
    expect(projectPanelTitle('')).toBe('Application');
    expect(projectTitle('')).toBe('Application');
  });
});

describe('projectSubtitle', () => {
  it('returns the application number', () => {
    expect(projectSubtitle({ PROJECT_NO: '7920-0340' })).toBe('7920-0340');
  });
});
