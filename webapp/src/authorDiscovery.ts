import type { Author } from './types';

export function searchAuthors(authors: Author[], query: string): Author[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return authors.filter((author) => terms.every((term) => normalize(author.name).includes(term)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}

export interface AuthorNavigation {
  tab: 'map' | 'routes' | 'authors';
  authorId?: string;
  pointId?: string;
  query: string;
}

export function readAuthorNavigation(hash: string): AuthorNavigation {
  const [path, search] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(search);
  if (path?.startsWith('/authors')) {
    let authorId: string | undefined;
    try { authorId = path.split('/')[2] ? decodeURIComponent(path.split('/')[2]) : undefined; } catch { /* Invalid links fall back to the directory. */ }
    return { tab: 'authors', authorId, query: params.get('q') ?? '' };
  }
  return { tab: path === '/routes' ? 'routes' : 'map', authorId: params.get('author') || undefined, pointId: params.get('point') || undefined, query: params.get('q') ?? '' };
}

export function authorHref(id?: string, query = '') {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  return `#/authors${id ? `/${encodeURIComponent(id)}` : ''}${params.size ? `?${params}` : ''}`;
}

export function authorMapHref(id: string, pointId?: string, query = '') {
  const params = new URLSearchParams({ author: id });
  if (pointId) params.set('point', pointId);
  if (query) params.set('q', query);
  return `#/map?${params}`;
}
