import type { AdminRouteTranslation } from '@ecosdelisboa/shared';

export type RouteMetadataDraft = { title: string; description: string };
export function routeMetadataDraft(saved?: AdminRouteTranslation): RouteMetadataDraft {
  return { title: saved?.title ?? '', description: saved?.description ?? '' };
}
export function validateRouteMetadataDraft(value: unknown): RouteMetadataDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 2 || typeof item.title !== 'string' || typeof item.description !== 'string') return null;
  return { title: item.title, description: item.description };
}
