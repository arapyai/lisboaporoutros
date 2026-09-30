import type { Section } from './adminTypes';

const sections: Section[] = ['authors', 'points', 'texts', 'routes', 'review-map', 'csv', 'point-types', 'pronunciation', 'users'];

export function sectionFromHash(hash: string): Section {
  const section = hash.replace(/^#\/?/, '').split('/')[0];
  return sections.includes(section as Section) ? section as Section : 'authors';
}

export function sectionHash(section: Section) {
  return `#/${section}`;
}
