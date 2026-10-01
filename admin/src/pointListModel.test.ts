import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminPoint } from '@ecosdelisboa/shared';
import { matchesPointFilters } from './points/pointListModel.ts';

const point = { point_type: { slug: 'historic' }, translations: [{ lang: 'en', status: 'pending' }] } as AdminPoint;
test('point domain filters keep type and editorial status independent of source fields', () => {
  assert.equal(matchesPointFilters(point, '', ''), true);
  assert.equal(matchesPointFilters(point, 'historic', 'pending'), true);
  assert.equal(matchesPointFilters(point, 'park', 'pending'), false);
  assert.equal(matchesPointFilters(point, 'historic', 'approved'), false);
  assert.equal(matchesPointFilters({ translations: [] } as unknown as AdminPoint, '', ''), true);
  assert.equal(matchesPointFilters({ translations: [] } as unknown as AdminPoint, '', 'pending'), false);
});
