import assert from 'node:assert/strict';
import test from 'node:test';
import { relationOptions } from './resources/relationOptions.ts';

test('uses the Portuguese point type name instead of its UUID', () => {
  const options = relationOptions(
    [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name_pt: 'Ponto literário'
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name_pt: 'Ponto de leitura'
      }
    ],
    'Selecione um tipo'
  );

  assert.deepEqual(options.map((option) => option.label), [
    'Selecione um tipo',
    'Ponto literário',
    'Ponto de leitura'
  ]);
});

test('keeps the existing author and point labels and only falls back to id', () => {
  const options = relationOptions(
    [
      { id: 'author', name: 'José Saramago' },
      { id: 'point', title_pt: 'Bairro Alto' },
      { id: 'fallback' }
    ],
    'Selecione'
  );

  assert.deepEqual(options.map((option) => option.label), [
    'Selecione',
    'José Saramago',
    'Bairro Alto',
    'fallback'
  ]);
});
