import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPointType, pointTypeOptions } from './resources/pointTypeSelection.ts';

test('inactive literary types are not defaults and current unavailable relations remain explicit', () => {
  const retired = { id: 'old', slug: 'literary', name_pt: 'Literário', is_active: false };
  const active = { id: 'new', slug: 'museum', name_pt: 'Museu', is_active: true };
  assert.equal(defaultPointType([retired]), undefined);
  assert.equal(defaultPointType([retired, active])?.id, 'new');
  assert.deepEqual(pointTypeOptions([retired, active], 'old').map(item => item.label), ['Selecione um tipo', 'Literário (inativo)', 'Museu']);
  assert.ok(!pointTypeOptions([retired, active], '').some(item => item.value === 'old'));
  assert.equal(pointTypeOptions([active], 'missing').at(-1)?.value, 'missing');
});
