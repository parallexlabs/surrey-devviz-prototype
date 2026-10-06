import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { projectTitle, projectSubtitle } from '../../src/titles.js';

const projects = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/development_projects.geojson'), 'utf8'),
);

function description(projectNo) {
  const feature = projects.features.find((item) => item.properties.PROJECT_NO === projectNo);
  if (!feature) throw new Error(`Missing ${projectNo}`);
  return feature.properties.DESCRIPTION;
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
    expect(projectTitle(description('14-0324-00'))).toBe('19 townhouse units');
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
});

describe('projectSubtitle', () => {
  it('returns the application number', () => {
    expect(projectSubtitle({ PROJECT_NO: '7920-0340' })).toBe('7920-0340');
  });
});
