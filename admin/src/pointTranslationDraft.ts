import type { AdminPointTranslation, TranslationStatus } from '@ecosdelisboa/shared';

export type PointTranslationDraft = { title: string; description: string; status: TranslationStatus };
export function pointTranslationDraft(translation?: AdminPointTranslation): PointTranslationDraft {
  return { title: translation?.title ?? '', description: translation?.description ?? '', status: translation?.status ?? 'pending' };
}
export function validatePointTranslationDraft(value: unknown): PointTranslationDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 3 || typeof item.title !== 'string' || typeof item.description !== 'string'
    || typeof item.status !== 'string' || !['pending', 'approved', 'rejected'].includes(item.status)) return null;
  return { title: item.title, description: item.description, status: item.status as TranslationStatus };
}
