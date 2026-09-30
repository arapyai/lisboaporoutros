import assert from 'node:assert/strict';
import test from 'node:test';
import { sectionFromHash, sectionHash } from './adminNavigation.ts';

test('section links are stable and reject unknown routes or recovery credentials', () => {
  for (const section of ['authors', 'points', 'texts', 'routes', 'review-map', 'csv', 'users', 'pronunciation', 'point-types'] as const) {
    assert.equal(sectionFromHash(sectionHash(section)), section);
  }
  assert.equal(sectionFromHash('#/unknown'), 'authors');
  assert.equal(sectionFromHash('#reset-password=secret'), 'authors');
  assert.equal(sectionFromHash('#/points/point-id'), 'points');
});
