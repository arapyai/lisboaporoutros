import assert from 'node:assert/strict';
import test from 'node:test';
import { pointTranslationDraft, validatePointTranslationDraft } from './pointTranslationDraft.ts';

test('point translation snapshots whitelist title, description and proposed status', () => {
  const empty = pointTranslationDraft();
  assert.deepEqual(empty, { title: '', description: '', status: 'pending' });
  assert.deepEqual(validatePointTranslationDraft(empty), empty);
  for (const invalid of [{ ...empty, reviewer_id: 'admin' }, { ...empty, password: 'secret' },
    { ...empty, title: [] }, { ...empty, status: 'unknown' }, { ...empty, status: { toString: () => 'approved' } },
    { title: 'Incomplete' }]) assert.equal(validatePointTranslationDraft(invalid), null);
});
