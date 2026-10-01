import assert from 'node:assert/strict';
import test from 'node:test';
import { groupMapPoints, OVERLAP_RADIUS_PX } from './mapPointGroups.ts';
import type { Point } from '../types.ts';

function projected(id: string, x: number, y = 0) {
  return { point: { id, lat: 38.71, lng: -9.14 } as Point, x, y };
}
test('identical coordinates remain one group at all street zooms', () => {
  for (const zoom of [13.5, 15, 18, 22]) {
    assert.deepEqual(groupMapPoints([projected('a', 0), projected('b', 0)], zoom).map(g => g.points.map(p => p.id)), [['a', 'b']]);
  }
});
test('street navigation does not include nearby markers or grow transitive chains', () => {
  const groups = groupMapPoints([projected('a', 0), projected('b', 12), projected('c', 24), projected('d', 45)], 15);
  assert.deepEqual(groups.map(g => g.points.map(p => p.id)), [['a', 'b'], ['c'], ['d']]);
  assert.equal(groupMapPoints([projected('a', 0), projected('b', OVERLAP_RADIUS_PX)], 15).length, 2);
});
test('overview grouping only zooms; zoom separates markers that no longer overlap', () => {
  assert.equal(groupMapPoints([projected('a', 0), projected('b', 30)], 13).length, 1);
  assert.equal(groupMapPoints([projected('a', 0), projected('b', 30)], 13)[0].overview, true);
  assert.equal(groupMapPoints([projected('a', 0), projected('b', 30)], 15).length, 2);
  assert.equal(groupMapPoints([projected('a', 0), projected('b', 30)], 15)[0].overview, false);
});
