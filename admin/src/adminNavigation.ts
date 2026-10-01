import type { Section } from './adminTypes';
import type { TextListFilters } from './texts/textListModel';

const sections: Section[] = ['authors', 'points', 'texts', 'routes', 'review-map', 'csv', 'point-types', 'pronunciation', 'users'];

export function sectionFromHash(hash: string): Section {
  const section = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return sections.includes(section as Section) ? section as Section : 'authors';
}

export function textContextFromHash(hash: string) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  let id: string | undefined;
  try { id = path.startsWith('texts/') ? decodeURIComponent(path.slice(6)) : undefined; } catch { /* Malformed address. */ }
  const languageCode = (value: string | null) => value && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(value) ? value : '';
  const choice = (key: string, choices: string[]) => choices.includes(params.get(key) ?? '') ? params.get(key)! : '';
  const filters: TextListFilters = {
    language: languageCode(params.get('language')),
    status: choice('status', ['pending', 'approved', 'rejected']),
    origin: choice('origin', ['manual', 'automatic', 'import']),
    audio: choice('audio', ['missing', 'manual', 'automatic']),
    gap: choice('gap', ['missing-source-audio', 'missing-translation', 'pending-review'])
  };
  return { id, language: languageCode(params.get('lang')) || undefined, search: params.get('q') ?? '', filters };
}

export function textContextHash(id?: string, language?: string, list?: { search: string; filters: TextListFilters }) {
  const params = new URLSearchParams();
  if (language) params.set('lang', language);
  if (list?.search) params.set('q', list.search);
  if (list) for (const [key, value] of Object.entries(list.filters)) if (value) params.set(key, value);
  return `#/texts${id ? `/${encodeURIComponent(id)}` : ''}${params.size ? `?${params}` : ''}`;
}

export function sectionHash(section: Section) {
  return `#/${section}`;
}

export function itemContextFromHash(hash: string) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  let id: string | undefined;
  try { id = path.includes('/') ? decodeURIComponent(path.slice(path.indexOf('/') + 1)) : undefined; } catch { /* Invalid link. */ }
  const lang = params.get('lang');
  return {
    id,
    search: params.get('q') ?? '',
    language: lang && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(lang) ? lang : undefined,
    pointType: (params.get('type') ?? '').slice(0, 80),
    status: ['pending', 'approved', 'rejected'].includes(params.get('status') ?? '') ? params.get('status')! : ''
  };
}

export function itemContextHash(section: Section, context: { id?: string; language?: string; search?: string; pointType?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (context.language) params.set('lang', context.language);
  if (context.pointType) params.set('type', context.pointType);
  if (context.status) params.set('status', context.status);
  if (context.search) params.set('q', context.search);
  return `${sectionHash(section)}${context.id ? `/${encodeURIComponent(context.id)}` : ''}${params.size ? `?${params}` : ''}`;
}
