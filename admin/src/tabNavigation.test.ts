import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTabCode } from './tabNavigation.ts';

test('horizontal language tabs wrap, support boundaries and do not hijack scrolling', () => {
  const codes = ['pt', 'en', 'fr'];
  assert.equal(nextTabCode(codes, 'pt', 'ArrowLeft'), 'fr');
  assert.equal(nextTabCode(codes, 'fr', 'ArrowRight'), 'pt');
  assert.equal(nextTabCode(codes, 'pt', 'End'), 'fr');
  assert.equal(nextTabCode(codes, 'fr', 'Home'), 'pt');
  assert.equal(nextTabCode(codes, 'pt', 'ArrowDown'), undefined);
  assert.equal(nextTabCode(codes, 'pt', 'Tab'), undefined);
  assert.equal(nextTabCode([], 'pt', 'ArrowRight'), undefined);
  assert.equal(nextTabCode(['pt'], 'pt', 'ArrowRight'), 'pt');
});
