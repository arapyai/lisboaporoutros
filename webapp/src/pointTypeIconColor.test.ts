import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pointTypeIconColor } from './components/pointTypeIconMarkup.ts';

test('uses white glyphs on dark point types and black glyphs on light point types', () => {
  assert.equal(pointTypeIconColor('#2F6F68'), '#fff');
  assert.equal(pointTypeIconColor('#76507A'), '#fff');
  assert.equal(pointTypeIconColor('#F5C518'), '#000');
});

test('keeps the original white glyph if a point type color is not a hex value', () => {
  assert.equal(pointTypeIconColor(''), '#fff');
});
