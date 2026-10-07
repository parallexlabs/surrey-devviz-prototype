import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { cityRecordUrl, isHttpUrl, projectPanelModel, safeHttpUrl } from '../../src/detail.js';
import { methodologyModel } from '../../src/methodology.js';
import { renderStaticSummary } from '../../src/staticSummary.js';
import { getSkyTrainStations } from '../../src/data.js';
import { computeProjectHeight } from '../../src/heights.js';

const root = process.cwd();
const read = (name) => JSON.parse(readFileSync(join(root, 'public/data', name), 'utf8'));

const RECORD = 'https://citizenportal.surrey.ca/citizenportal/integration/publicProjectForward.html';

describe('city application links', () => {
  it('accepts only http and https weblinks', () => {
    expect(isHttpUrl('https://citizenportal.surrey.ca/app?year=21 seq=0313')).toBe(true);
    expect(cityRecordUrl(`${RECORD}?year=21 seq=0313`)).toBe(`${RECORD}?year=21&seq=0313`);
    expect(safeHttpUrl('HTTPS://Example.com/Path')).toBe('https://example.com/Path');
    expect(safeHttpUrl('http://user:pass@example.com/')).toBeNull();
    expect(safeHttpUrl('java\nscript:alert(1)')).toBeNull();
    expect(isHttpUrl('http://example.com/record')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,hi')).toBe(false);
    expect(isHttpUrl('/relative')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });

  it('turns every City weblink into a record link with year and seq', () => {
    const projects = read('development_projects.geojson');
    expect(projects.features).toHaveLength(119);
    for (const feature of projects.features) {
      const { WEBLINK, PROJECT_NO } = feature.properties;
      const href = cityRecordUrl(WEBLINK);
      expect(href).not.toBeNull();
      expect(href).not.toContain('%20');
      const url = new URL(href);
      const [year, seq] = PROJECT_NO.split('-');
      expect(url.host).toBe('citizenportal.surrey.ca');
      expect(url.pathname.endsWith('/publicProjectForward.html')).toBe(true);
      expect([...url.searchParams.keys()]).toEqual(['year', 'seq']);
      expect(url.searchParams.get('year')).toBe(year);
      expect(url.searchParams.get('seq')).toBe(seq);
      expect(projectPanelModel(feature.properties, null).applicationUrl).toBe(href);
    }
  });

  it('accepts the record query with & or any run of spaces', () => {
    expect(cityRecordUrl(`${RECORD}?year=21&seq=0313`)).toBe(`${RECORD}?year=21&seq=0313`);
    expect(cityRecordUrl(`  ${RECORD}?year=21   seq=0313  `)).toBe(`${RECORD}?year=21&seq=0313`);
  });

  it('leaves every other value to safeHttpUrl unchanged', () => {
    expect(cityRecordUrl('https://citizenportal.surrey.ca/app?year=21 seq=0313')).toBe(
      'https://citizenportal.surrey.ca/app?year=21%20seq=0313',
    );
    expect(cityRecordUrl(`${RECORD.replace('https:', 'http:')}?year=21 seq=0313`)).toBe(
      'http://citizenportal.surrey.ca/citizenportal/integration/publicProjectForward.html?year=21%20seq=0313',
    );
    expect(cityRecordUrl(`${RECORD.replace('https://', 'https://user:pass@')}?year=21 seq=0313`)).toBeNull();
    expect(cityRecordUrl(`${RECORD}?year=21\tseq=0313`)).toBeNull();
    expect(cityRecordUrl(`${RECORD}?year=21 seq=0313\n`)).toBe(`${RECORD}?year=21&seq=0313`);
    expect(cityRecordUrl(`${RECORD}?year=21\u0000seq=0313`)).toBeNull();
    expect(
      cityRecordUrl('https://example.com/citizenportal/integration/publicProjectForward.html?year=21 seq=0313'),
    ).toBe('https://example.com/citizenportal/integration/publicProjectForward.html?year=21%20seq=0313');
    expect(cityRecordUrl('javascript:alert(1)')).toBeNull();

    const unchanged = [
      'https://citizenportal.surrey.ca/app?year=21 seq=0313',
      'https://citizenportal.surrey.ca/record',
      `${RECORD}?year=21 seq=0313&extra=1`,
      `${RECORD}?year=2021 seq=0313`,
      `${RECORD}?year=21 seq=313`,
      `${RECORD}?seq=0313 year=21`,
      `${RECORD}?year=21 seq=0313#top`,
      `${RECORD}?year=21&&seq=0313`,
      `${RECORD}x?year=21 seq=0313`,
      `${RECORD}`,
      `${RECORD.replace('https:', 'http:')}?year=21 seq=0313`,
      `${RECORD.replace('https://', 'https://user:pass@')}?year=21 seq=0313`,
      `${RECORD.replace('https://', 'https://user@')}?year=21 seq=0313`,
      `${RECORD.replace('surrey.ca', 'surrey.ca:8443')}?year=21 seq=0313`,
      `${RECORD}?year=21\tseq=0313`,
      `${RECORD}?year=21\u007Fseq=0313`,
      'https://citizenportal.surrey.ca.example.com/citizenportal/integration/publicProjectForward.html?year=21 seq=0313',
      'https://example.com/citizenportal/integration/publicProjectForward.html?year=21 seq=0313',
      'https://citizenportal.surrey.ca/a b/publicProjectForward.html?year=21 seq=0313',
      'HTTPS://Example.com/Path',
      'http://user:pass@example.com/',
      'java\nscript:alert(1)',
      'javascript:alert(1)',
      'data:text/html,hi',
      '/relative',
      '',
      null,
      undefined,
      42,
    ];
    for (const value of unchanged) {
      expect(cityRecordUrl(value)).toBe(safeHttpUrl(value));
    }
  });

  it('builds the presentation panel from the record', () => {
    const height = computeProjectHeight('Development of a 67-storey building');
    const model = projectPanelModel(
      {
        DESCRIPTION: 'Development Permit to permit the development of a 67-storey building.',
        STATUS: 'Conditional Approval',
        PROJECT_NO: '21-0313-00',
        pilot_area: 'city_centre',
        WEBLINK: 'https://citizenportal.surrey.ca/record',
        APPLICATION_DOCUMENTS_WEBLINK: 'javascript:alert(1)',
        ...height,
      },
      {
        distanceM: 187,
        station: { properties: { name: 'Surrey Central' } },
      },
    );
    expect(model.statusLine).toBe('Application status: Conditional Approval');
    expect(model.heightLine).toMatch(/^Estimated height about 214\.4 m: 67 storeys/);
    expect(model.heightLine).toContain('Not a surveyed or approved height.');
    expect(model.skytrainLine).toBe(
      'Nearest SkyTrain station: Surrey Central, about 190 m straight-line (not a walking route)',
    );
    expect(model.applicationUrl).toBe('https://citizenportal.surrey.ca/record');
    expect(model.applicationLinkLabel).toBe("View the City's application record");
    expect(model.documentsUrl).toBeNull();
    expect(model.contextLine).toBe(
      'Development context only. Property availability and investment terms are not shown.',
    );

    const blocked = projectPanelModel(
      { DESCRIPTION: 'Townhouses.', STATUS: 'Final Approval', WEBLINK: 'javascript:alert(1)', ...computeProjectHeight('townhouses') },
      null,
    );
    expect(blocked.applicationUrl).toBeNull();
    expect(blocked.heightLine).toBe(
      'Illustrative height: no storey count could be read from the application',
    );
    expect(blocked.applicationPlain).toBe('javascript:alert(1)');
  });
});

describe('static summary', () => {
  it('lists the six civic places and the showcase projects', () => {
    const projects = read('development_projects.geojson');
    const skytrain = read('skytrain.geojson');
    const civic = read('civic_places.json');
    const html = renderStaticSummary({ projects, skytrain, civic });
    expect(html).toContain("Explore Surrey's development and destinations");
    expect(html).toContain(
      'Selected development applications alongside civic investments, transit and places to visit in three Surrey pilot areas. Status is shown as the City publishes it; conditional approval is not a building permit.',
    );
    expect(html).toContain('Independent public-data prototype by ParalleX Labs Inc. Not affiliated with or endorsed by the City of Surrey.');
    const places = html.match(/<h2>Civic investments and destinations<\/h2>\s*<ul>([\s\S]*?)<\/ul>/);
    expect(places[1].match(/<li>/g)).toHaveLength(6);
    expect(places[1]).toContain('City Centre Arena (planned)');
    expect(places[1]).toContain('https://www.surrey.ca/news-events/news/demolition-begins-site-of-10000-seat-city-centre-arena');
    const listed = html.match(/<h2>Development projects<\/h2>\s*<ul>([\s\S]*?)<\/ul>/);
    expect(listed[1].match(/<li>/g)).toHaveLength(49);
    expect(listed[1]).toContain('21-0313-00');
    expect(getSkyTrainStations(skytrain).length).toBeGreaterThan(0);
  });
});

describe('methodology delivery section', () => {
  it('states the prototype boundary, the build id, and the retrieval date', () => {
    const model = methodologyModel(
      [{ retrieved_at: '2026-10-06T11:52:07.660949+00:00', file: 'development_projects.geojson', feature_count: 1, licence: 'Test' }],
      'abc123',
    );
    const delivery = model.sections.find((section) => section.heading === 'Prototype and proposed delivery');
    expect(delivery.paragraphs[0]).toContain('public-data snapshot retrieved 6 October 2026');
    expect(delivery.paragraphs[0]).toContain('360-degree drone imagery is not included in this prototype.');
    expect(delivery.paragraphs[1]).toContain('City Centre Future model (2024)');
    expect(delivery.paragraphs[1]).toContain('The default view shows approved and conditionally approved records.');
    expect(delivery.paragraphs[1]).toContain('All applications adds the other active applications');
    expect(delivery.paragraphs[1]).not.toMatch(/records only/);
    expect(delivery.paragraphs[2]).toBe('Build abc123. Data retrieved 6 October 2026.');
    const limits = model.sections.find((section) => section.heading === 'Limitations');
    expect(limits.paragraphs.join(' ')).toContain(
      'uses the bundled snapshot',
    );
    expect(limits.paragraphs).toContain(
      "The City's application-record links separate their two values with a space; the prototype joins them with & so each link opens the matching record.",
    );
  });
});
