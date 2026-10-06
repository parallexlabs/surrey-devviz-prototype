import { describe, it, expect } from 'vitest';
import { projectTitle, projectSubtitle } from '../../src/titles.js';

describe('projectTitle', () => {
  it('uses the first clause from the description', () => {
    const title = projectTitle(
      'Rezoning from RF to CD; Development Permit to permit a 6-storey residential building.',
    );
    expect(title).toBe('Rezoning from RF to CD');
    expect(title).not.toContain('Tower One');
  });

  it('does not invent a project name', () => {
    const title = projectTitle('Development Permit for 115 residential units.');
    expect(title.toLowerCase()).not.toContain('unnamed');
    expect(title).toContain('Development Permit');
  });
});

describe('projectSubtitle', () => {
  it('returns the application number', () => {
    expect(projectSubtitle({ PROJECT_NO: '7920-0340' })).toBe('7920-0340');
  });
});
