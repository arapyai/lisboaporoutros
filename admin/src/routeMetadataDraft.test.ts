import assert from 'node:assert/strict';
import test from 'node:test';
import { routeMetadataDraft, validateRouteMetadataDraft } from './routeMetadataDraft.ts';

test('route metadata recovery excludes approval, reviewer and credentials', () => {
  const empty = routeMetadataDraft();
  assert.deepEqual(empty, { title: '', description: '' });
  assert.deepEqual(validateRouteMetadataDraft(empty), empty);
  for (const invalid of [{ ...empty, status: 'approved' }, { ...empty, reviewer_id: 'admin' },
    { ...empty, password: 'secret' }, { ...empty, title: [] }, { title: 'Partial' }, []]) {
    assert.equal(validateRouteMetadataDraft(invalid), null);
  }
});
