export type DraftIdentity = { userId: string; entity: string; id: string; language: string };
export type LocalDraft<T> = { version: 1; identity: DraftIdentity; savedAt: number; baseline: T; value: T };
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
export const DRAFT_PREFIX = 'ecosdelisboa.editor-draft:v1:';
export const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const DRAFT_MAX_LENGTH = 256_000;

export function localDraftKey(identity: DraftIdentity) {
  return DRAFT_PREFIX + [identity.userId, identity.entity, identity.id, identity.language].map(encodeURIComponent).join(':');
}

export function draftFingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export function readLocalDraft<T>(storage: DraftStorage, identity: DraftIdentity, validate: (value: unknown) => T | null, now = Date.now()) {
  const key = localDraftKey(identity);
  const raw = storage.getItem(key);
  if (!raw) return null;
  let entry: LocalDraft<T> | null = null;
  try {
    if (raw.length <= DRAFT_MAX_LENGTH) {
      const parsed = JSON.parse(raw);
      const baseline = validate(parsed.baseline);
      const value = validate(parsed.value);
      if (Object.keys(parsed).length === 5 && parsed.version === 1 && draftFingerprint(parsed.identity) === draftFingerprint(identity)
        && Number.isFinite(parsed.savedAt) && parsed.savedAt <= now && now - parsed.savedAt < DRAFT_MAX_AGE
        && baseline && value && draftFingerprint(baseline) !== draftFingerprint(value)) {
        entry = { version: 1, identity, savedAt: parsed.savedAt, baseline, value };
      }
    }
  } catch { /* Corrupt or unsupported entries must never become editor input. */ }
  if (!entry) storage.removeItem(key);
  return entry;
}

export function writeLocalDraft<T>(storage: DraftStorage, identity: DraftIdentity, baseline: T, value: T, now = Date.now()) {
  const key = localDraftKey(identity);
  if (draftFingerprint(baseline) === draftFingerprint(value)) { storage.removeItem(key); return; }
  const raw = JSON.stringify({ version: 1, identity, savedAt: now, baseline, value } satisfies LocalDraft<T>);
  if (raw.length > DRAFT_MAX_LENGTH) throw new Error('Draft exceeds local storage budget');
  storage.setItem(key, raw);
}

export function clearUserLocalDrafts(storage: DraftStorage, userId: string) {
  const prefix = DRAFT_PREFIX + encodeURIComponent(userId) + ':';
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) if (key?.startsWith(prefix)) storage.removeItem(key);
}

export function clearRecordLocalDrafts(storage: DraftStorage, identity: Omit<DraftIdentity, 'language'>) {
  const prefix = DRAFT_PREFIX + [identity.userId, identity.entity, identity.id].map(encodeURIComponent).join(':') + ':';
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) if (key?.startsWith(prefix)) storage.removeItem(key);
}
