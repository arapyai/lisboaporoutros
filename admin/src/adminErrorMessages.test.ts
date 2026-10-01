import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@ecosdelisboa/shared';
import { adminFailureMessage } from './adminErrorMessages.ts';

test('permission errors have clear feedback without replacing other action messages', () => {
  assert.equal(adminFailureMessage(new ApiError('internal', 403, '/private'), 'failure'), 'Você não tem permissão para esta ação.');
  assert.equal(adminFailureMessage(new ApiError('internal', 503, '/private'), 'failure'), 'failure');
});
