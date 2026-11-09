import assert from 'node:assert/strict';
import test from 'node:test';
import { authorTranslationDraft, validateAuthorTranslationDraft } from './authorTranslationDraft.ts';

test('biography recovery accepts only biography and proposed editorial status', () => {
  const empty = authorTranslationDraft();
  assert.deepEqual(empty, { bio: '', status: 'pending' });
  assert.deepEqual(validateAuthorTranslationDraft(empty), empty);
  for (const invalid of [null, [], { ...empty, reviewed_by: 'admin' }, { ...empty, bio: [] },
    { ...empty, status: 'unknown' }, { bio: 'Incomplete' }]) {
    assert.equal(validateAuthorTranslationDraft(invalid), null);
  }
});
