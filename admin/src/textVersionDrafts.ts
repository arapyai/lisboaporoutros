import type { AdminTranslation, TranslationStatus } from '@ecosdelisboa/shared';

export type TextVersionDraft = {
  content: string;
  phoneticContent: string;
  status: TranslationStatus;
  dirty: boolean;
};

export type TextVersionSnapshot = Omit<TextVersionDraft, 'dirty'>;
export function textVersionSnapshot(draft: TextVersionDraft): TextVersionSnapshot {
  return { content: draft.content, phoneticContent: draft.phoneticContent, status: draft.status };
}
export function validateTextVersionSnapshot(value: unknown): TextVersionSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 3 || typeof item.content !== 'string' || typeof item.phoneticContent !== 'string'
    || typeof item.status !== 'string' || !['pending', 'approved', 'rejected'].includes(item.status)) return null;
  return { content: item.content, phoneticContent: item.phoneticContent, status: item.status as TranslationStatus };
}

export function translationToDraft(translation?: AdminTranslation): TextVersionDraft {
  return {
    content: translation?.content ?? '',
    phoneticContent: translation?.phonetic_content ?? '',
    status: translation?.status ?? 'pending',
    dirty: false
  };
}

export function mergeTranslationDrafts(
  current: Record<string, TextVersionDraft>,
  translations: AdminTranslation[]
) {
  const next = Object.fromEntries(Object.entries(current).filter(([, draft]) => draft.dirty));
  translations.forEach((translation) => {
    if (next[translation.lang]?.dirty) return;
    next[translation.lang] = translationToDraft(translation);
  });
  return next;
}
