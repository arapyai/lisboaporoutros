import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@ecosdelisboa/shared';
import { TextSaveValidationError, textSaveValidationError, validateTextSave } from './textSaveValidation.ts';

const valid = { point_id: 'point', author_id: 'new-author', content_pt: 'Um novo trecho.',
  content_type: 'prose', source_year: '' };

test('a new author can save a text with its required relations and an optional year', () => {
  for (const source_year of ['', null, '1920', 1920]) {
    assert.doesNotThrow(() => validateTextSave({ ...valid, source_year }));
  }
});

test('identifies missing point, author and source content before a request is sent', () => {
  for (const field of ['point_id', 'author_id', 'content_pt'] as const) {
    for (const value of ['', null, '  ']) {
      assert.throws(() => validateTextSave({ ...valid, [field]: value }),
        (error: unknown) => error instanceof TextSaveValidationError && error.field === field);
    }
  }
});

test('invalid years and content types have actionable errors', () => {
  for (const source_year of ['1920-1921', 1920.5, 'NaN']) {
    assert.throws(() => validateTextSave({ ...valid, source_year }), { field: 'source_year' });
  }
  assert.throws(() => validateTextSave({ ...valid, content_type: '' }), { field: 'content_type' });
});

test('FastAPI 422 field errors are explained without exposing input or server messages', () => {
  const error = textSaveValidationError(new ApiError('failed', 422, '/api/v1/admin/texts', [
    { loc: ['body', 'point_id'], type: 'uuid_type', input: null, msg: 'private server message' }
  ]));
  assert.equal(error?.field, 'point_id');
  assert.match(error?.message ?? '', /Selecione um ponto/);
  assert.doesNotMatch(error?.message ?? '', /private/);
  assert.equal(textSaveValidationError(new ApiError('failed', 500, '/api/v1/admin/texts')), null);
  assert.equal(textSaveValidationError(new ApiError('failed', 422, '/api/v1/admin/texts', [null, {}, { loc: ['body', 'unknown'] }])), null);
});
