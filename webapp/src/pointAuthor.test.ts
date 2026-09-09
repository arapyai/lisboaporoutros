import assert from 'node:assert/strict';
import test from 'node:test';
import { pointTextAuthor } from './pointAuthor.ts';
import type { Point, TextEntry } from './types';

const first = { id: 'pessoa', name: 'Fernando Pessoa' };
const second = { id: 'caeiro', name: 'Fernando Pessoa [Alberto Caeiro]' };
const point: Point = { id: 'point', title_pt: 'Chiado', lat: 38.7, lng: -9.1, author: first, authors: [first, second] };
const text: TextEntry = { id: 'text', point_id: point.id, content_pt: 'Trecho', content_type: 'prose', author_id: second.id };

test('opens the selected text author even when the point has a different first author', () => {
  assert.deepEqual(pointTextAuthor(point, text), second);
});
test('uses the embedded author when no explicit author_id is supplied', () => {
  assert.deepEqual(pointTextAuthor(point, { ...text, author_id: undefined, author: second }), second);
});
test('the explicit author_id wins over inconsistent embedded metadata', () => {
  assert.deepEqual(pointTextAuthor(point, { ...text, author: first }), second);
});
test('can fetch a biography by ID even if the name is unavailable', () => {
  assert.deepEqual(pointTextAuthor(point, { ...text, author_id: 'other' }), { id: 'other', name: '' });
});
test('does not guess a biography while point details are loading or attribution is missing', () => {
  assert.equal(pointTextAuthor(point), null);
  assert.equal(pointTextAuthor(point, { ...text, author_id: undefined }), null);
});
