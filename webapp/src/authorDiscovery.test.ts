import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAuthors, authorHref, authorMapHref, readAuthorNavigation } from './authorDiscovery.ts';

const authors = [
  { id: 'eca', name: 'Eça de Queirós' },
  { id: 'florbela', name: "Florbela d'Alma da Conceição Espanca" },
  { id: 'alberto', name: "Alberto d'Oliveira" },
  { id: 'caeiro', name: 'Fernando Pessoa [Alberto Caeiro]' }
];
test('search ignores accents, punctuation and intermediate names without searching biography text', () => {
  assert.deepEqual(searchAuthors(authors, 'ECA QUEIROS').map(a => a.id), ['eca']);
  assert.deepEqual(searchAuthors(authors, 'Florbela Espanca').map(a => a.id), ['florbela']);
  assert.deepEqual(searchAuthors(authors, 'alberto d oliveira').map(a => a.id), ['alberto']);
  assert.deepEqual(searchAuthors(authors, 'Caeiro').map(a => a.id), ['caeiro']);
  assert.deepEqual(searchAuthors(authors, 'inexistente'), []);
});
test('author URLs preserve searches and safely round-trip identifiers', () => {
  assert.deepEqual(readAuthorNavigation(authorHref('author/id', 'Eça & Pessoa')), { tab: 'authors', authorId: 'author/id', query: 'Eça & Pessoa' });
  assert.deepEqual(readAuthorNavigation(authorMapHref('eca', 'point', 'Eça')), { tab: 'map', authorId: 'eca', pointId: 'point', query: 'Eça' });
  assert.equal(readAuthorNavigation('#/authors/%invalid').authorId, undefined);
  assert.equal(readAuthorNavigation('').tab, 'map');
});
