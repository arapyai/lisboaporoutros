import type { AdminAuthorTranslation, TranslationStatus } from '@ecosdelisboa/shared';

export type AuthorTranslationDraft = { bio: string; status: TranslationStatus };
export function authorTranslationDraft(translation?: AdminAuthorTranslation): AuthorTranslationDraft {
  return { bio: translation?.bio ?? '', status: translation?.status ?? 'pending' };
}
export function validateAuthorTranslationDraft(value: unknown): AuthorTranslationDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 2 || typeof item.bio !== 'string'
    || typeof item.status !== 'string' || !['pending', 'approved', 'rejected'].includes(item.status)) return null;
  return { bio: item.bio, status: item.status as TranslationStatus };
}
