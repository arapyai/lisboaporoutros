import assert from 'node:assert/strict';
import test from 'node:test';
import { relationOptions } from './resources/relationOptions.ts';

test('unavailable current association stays selectable without exposing its identifier or replacing it', () => {
  const options = relationOptions([{ id: 'available', name: 'Disponível' }], 'Selecione', 'missing');
  assert.equal(options.at(-1)?.value, 'missing');
  assert.match(options.at(-1)!.label, /indisponível/);
  assert.equal(relationOptions([{ id: 'available', name: 'Disponível' }], 'Selecione', 'available').length, 2);
});
