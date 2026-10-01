import type { Draft } from './adminTypes';

// Allow only editable content. Never serialize server objects, credentials or user forms.
const fields = {
  authors: ['name', 'bio_pt', 'birth_year', 'death_year', 'photo_url', 'elevenlabs_voice_id'],
  points: ['point_type_id', 'title_pt', 'description_pt', 'address', 'neighborhood', 'lat', 'lng'],
  'point-types': ['name_pt', 'icon_key', 'color', 'sort_order', 'is_active']
} as const;

export function validateResourceDraft(entity: string, value: unknown): Draft | null {
  if (!Object.hasOwn(fields, entity) || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = fields[entity as keyof typeof fields];
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length) return null;
  const result: Draft = {};
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) return null;
    const item = record[key];
    const numeric = ['birth_year', 'death_year', 'lat', 'lng', 'sort_order'].includes(key);
    if (key === 'is_active' ? typeof item !== 'boolean'
      : numeric ? !(item === null || typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)))
      : !(item === null || typeof item === 'string')) return null;
    result[key] = item as string | number | boolean | null;
  }
  return result;
}
