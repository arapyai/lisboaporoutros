import assert from 'node:assert/strict';
import test from 'node:test';
import { itemContextFromHash, itemContextHash, sectionFromHash, sectionHash, textContextFromHash, textContextHash } from './adminNavigation.ts';

test('section links are stable and reject unknown routes or recovery credentials', () => {
  for (const section of ['authors', 'points', 'texts', 'routes', 'review-map', 'csv', 'users', 'pronunciation', 'point-types'] as const) {
    assert.equal(sectionFromHash(sectionHash(section)), section);
  }
  assert.equal(sectionFromHash('#/unknown'), 'authors');
  assert.equal(sectionFromHash('#reset-password=secret'), 'authors');
  assert.equal(sectionFromHash('#/points/point-id'), 'points');
});

test('point and author context links roundtrip safe item/language/filter context', () => {
  const context={id:'point / 1',language:'fr',pointType:'literary',status:'pending',search:'Lisboa'};
  assert.deepEqual(itemContextFromHash(itemContextHash('points',context)),context);
  assert.equal(sectionFromHash(itemContextHash('authors',{id:'author-1'})),'authors');
  const malformed=itemContextFromHash('#/points/%GG?lang=bad!&status=other&token=private');
  assert.equal(malformed.id,undefined);
  assert.equal(malformed.language,undefined);
  assert.equal(malformed.status,'');
  assert.equal(itemContextHash('points',malformed).includes('private'),false);
});

test('text links roundtrip identity, language and editorial filters without credentials', () => {
  const filters = { language: 'en', status: 'pending', origin: 'manual', audio: 'missing', gap: 'pending-review' };
  const hash = textContextHash('text/with space', 'en', { search: 'Lisboa & poesia', filters });
  assert.equal(sectionFromHash(hash), 'texts');
  assert.deepEqual(textContextFromHash(hash), { id: 'text/with space', language: 'en', search: 'Lisboa & poesia', filters });
  assert.equal(sectionFromHash('#/texts?q=Lisboa'), 'texts');
  const context = textContextFromHash('#/texts/%ZZ?lang=invalid!&status=oops&token=secret');
  assert.equal(context.id, undefined);
  assert.equal(context.language, undefined);
  assert.equal(context.filters.status, '');
  assert.equal(textContextHash(context.id, context.language, context).includes('secret'), false);
});
