import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminTranslation } from '@ecosdelisboa/shared';
import { mergeTranslationDrafts, textVersionSnapshot, translationToDraft, validateTextVersionSnapshot } from './textVersionDrafts.ts';

const translation = (content: string): AdminTranslation => ({
  id: 'translation-en',
  text_id: 'text-1',
  lang: 'en',
  content,
  phonetic_content: null,
  status: 'pending',
  origin: 'automatic'
});

test('keeps unsaved draft when switching languages and backend data refreshes', () => {
  const current = {
    en: {
      content: 'Unsaved local edit',
      phoneticContent: '',
      status: 'pending' as const,
      dirty: true
    }
  };

  const next = mergeTranslationDrafts(current, [translation('Backend refresh')]);

  assert.equal(next.en.content, 'Unsaved local edit');
  assert.equal(next.en.dirty, true);
});

test('hydrates clean language draft from backend translation', () => {
  const next = mergeTranslationDrafts({}, [translation('Backend translation')]);

  assert.equal(next.en.content, 'Backend translation');
  assert.equal(next.en.dirty, false);
});

test('remote deletion removes clean versions without replacing dirty versions', () => {
  const clean = translationToDraft(translation('Removed remotely'));
  assert.deepEqual(mergeTranslationDrafts({ en: clean, fr: { ...clean, dirty: true } }, []), { fr: { ...clean, dirty: true } });
});

test('version snapshots whitelist editorial fields, never review identity, credentials or dirty flags', () => {
  const snapshot = textVersionSnapshot({ ...translationToDraft(translation('Texto')), dirty: true });
  assert.deepEqual(validateTextVersionSnapshot(snapshot), { content: 'Texto', phoneticContent: '', status: 'pending' });
  for (const value of [{ ...snapshot, dirty: true }, { ...snapshot, reviewer_id: 'admin' },
    { ...snapshot, access_token: 'secret' }, { ...snapshot, status: 'invalid' }, { content: 'Missing fields' },
    { ...snapshot, status: { toString: () => 'approved' } }]) assert.equal(validateTextVersionSnapshot(value), null);
});
