import assert from 'node:assert/strict';
import test from 'node:test';
import { pauseAdminSession, resolveAdminToken, resumeAdminSession, startAdminSession } from './adminSession.ts';

test('renewing credentials preserves scope and never authorizes anonymous or other sessions', () => {
  const scope=startAdminSession('old');
  assert.notEqual(scope, 'old');
  assert.equal(resolveAdminToken(scope), 'old');
  pauseAdminSession();
  assert.throws(() => resolveAdminToken(scope), /Session expired/);
  assert.equal(resolveAdminToken(undefined), undefined);
  assert.equal(resolveAdminToken('candidate'), 'candidate');
  assert.throws(() => resumeAdminSession('other', 'new'), /Session scope changed/);
  resumeAdminSession(scope, 'new');
  assert.equal(resolveAdminToken(scope), 'new');
  startAdminSession('');
  assert.throws(() => resolveAdminToken(scope), /Session expired/);
});
