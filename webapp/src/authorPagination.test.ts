import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPages } from './api/pagination.ts';

for (const count of [0, 26, 100, 126, 200]) {
  test(`loads all ${count} authors across page boundaries`, async () => {
    const source = Array.from({ length: count }, (_, id) => ({ id }));
    const calls: number[] = [];
    const result = await collectPages(async (page, size) => {
      calls.push(page);
      assert.equal(size, 100);
      return source.slice((page - 1) * size, page * size);
    });
    assert.deepEqual(result, source);
    assert.equal(calls.length, Math.floor(count / 100) + 1);
  });
}

test('does not silently return incomplete authors when a later page fails', async () => {
  await assert.rejects(collectPages(async (page) => {
    if (page === 2) throw new Error('offline');
    return Array.from({ length: 100 }, (_, id) => id);
  }), /offline/);
});
