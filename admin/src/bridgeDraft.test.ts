import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBridgeDraft } from './bridgeDraft.ts';

test('bridge recovery allows only content, never approval, audio, reviewer or credentials', () => {
  assert.deepEqual(validateBridgeDraft({ content: 'Local EN' }), { content: 'Local EN' });
  for (const invalid of [{ content: [] }, {}, { content: 'EN', status: 'approved' },
    { content: 'EN', audio_files: [] }, { content: 'EN', reviewer_id: 'admin' }, { content: 'EN', token: 'secret' }]) {
    assert.equal(validateBridgeDraft(invalid), null);
  }
});
