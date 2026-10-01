import assert from 'node:assert/strict';
import test from 'node:test';
import { clearRecordLocalDrafts, clearUserLocalDrafts, DRAFT_MAX_AGE, DRAFT_MAX_LENGTH, draftFingerprint, localDraftKey, readLocalDraft, writeLocalDraft, type DraftStorage } from './localDraftStore.ts';
import { validateResourceDraft } from './resourceDraftSchema.ts';

function memoryStorage(): DraftStorage {
  const data = new Map<string, string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); }, key: index => [...data.keys()][index] ?? null,
    get length() { return data.size; } };
}
const identity = { userId: 'admin', entity: 'authors', id: 'author', language: 'pt' };
const baseline = { name: 'Autor', bio_pt: '', birth_year: '', death_year: '', photo_url: '', elevenlabs_voice_id: '' };
const value = { ...baseline, name: 'Rascunho' };
const validate = (value: unknown) => validateResourceDraft('authors', value);

test('local draft stores only a versioned editable snapshot and compares baselines independent of key order', () => {
  const storage = memoryStorage();
  writeLocalDraft(storage, identity, baseline, value, 1000);
  const entry = readLocalDraft(storage, identity, validate, 1100)!;
  assert.equal(entry.value.name, 'Rascunho');
  assert.equal(entry.version, 1);
  assert.equal(entry.savedAt, 1000);
  assert.equal(draftFingerprint({ b: 2, a: 1 }), draftFingerprint({ a: 1, b: 2 }));
  writeLocalDraft(storage, identity, baseline, baseline);
  assert.equal(storage.length, 0);
});

test('user, entity, record, language and delimiter characters cannot collide', () => {
  const identities = [identity, { ...identity, userId: 'admin:other' }, { ...identity, entity: 'points' },
    { ...identity, id: 'second' }, { ...identity, language: 'en' }, { ...identity, userId: 'admin:other', id: 'second' }];
  assert.equal(new Set(identities.map(localDraftKey)).size, identities.length);
  const storage = memoryStorage();
  for (const item of identities) writeLocalDraft(storage, item, baseline, value, 1000);
  storage.setItem('unrelated-setting', 'keep');
  clearUserLocalDrafts(storage, 'admin');
  assert.equal(storage.length, 3);
  assert.ok(storage.getItem(localDraftKey(identities[1])));
  assert.equal(storage.getItem('unrelated-setting'), 'keep');
});

test('corrupt, legacy, mismatched, expired, future and oversized entries are never restored', () => {
  const valid = { version: 1, identity, savedAt: 1000, baseline, value };
  const invalid = ['{', 'null', JSON.stringify({ ...valid, version: 2 }), JSON.stringify({ ...valid, identity: { ...identity, userId: 'other' } }),
    JSON.stringify({ ...valid, savedAt: 1001 }), JSON.stringify({ ...valid, savedAt: 1000 - DRAFT_MAX_AGE }),
    JSON.stringify({ ...valid, value: { ...value, password: 'do-not-restore' } }),
    JSON.stringify({ ...valid, access_token: 'do-not-restore' }), ' '.repeat(DRAFT_MAX_LENGTH + 1)];
  for (const raw of invalid) {
    const storage = memoryStorage();
    storage.setItem(localDraftKey(identity), raw);
    assert.equal(readLocalDraft(storage, identity, validate, 1000), null);
    assert.equal(storage.length, 0);
  }
});

test('resource schema rejects credentials, user forms, missing fields and unsafe shapes', () => {
  assert.equal(validateResourceDraft('users', { email: 'x', password: 'secret' }), null);
  assert.equal(validateResourceDraft('toString', baseline), null);
  assert.equal(validate({ ...value, access_token: 'secret' }), null);
  assert.equal(validate({ name: 'missing fields' }), null);
  assert.equal(validate({ ...value, bio_pt: { nested: true } }), null);
  assert.equal(validate({ ...value, birth_year: Infinity }), null);
  assert.equal(validateResourceDraft('point-types', { name_pt: '', icon_key: '', color: '', sort_order: 0, is_active: 'yes' }), null);
});

test('quota and blocked storage surface failure without overwriting a previous entry', () => {
  const storage = memoryStorage();
  writeLocalDraft(storage, identity, baseline, value, 1000);
  const previous = storage.getItem(localDraftKey(identity));
  assert.throws(() => writeLocalDraft(storage, identity, baseline, { ...value, bio_pt: 'x'.repeat(DRAFT_MAX_LENGTH) }));
  assert.equal(storage.getItem(localDraftKey(identity)), previous);
  const blocked = { ...storage, getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
  assert.throws(() => readLocalDraft(blocked, identity, validate));
  assert.throws(() => writeLocalDraft(blocked, identity, baseline, value));
});

test('text draft schema allows only base editorial fields, including numeric source year', () => {
  const text = { point_id: 'point', author_id: 'author', content_pt: 'Texto', phonetic_content: '',
    source_work: 'Obra', source_year: 2026, content_type: 'prose' };
  assert.deepEqual(validateResourceDraft('texts', text), text);
  assert.equal(validateResourceDraft('texts', { ...text, translations: [] }), null);
  assert.equal(validateResourceDraft('texts', { ...text, source_year: Infinity }), null);
});

test('record cleanup clears all its languages but never another account, entity or delimiter-containing record', () => {
  const storage = memoryStorage();
  const identities = [identity, { ...identity, language: 'fr' }, { ...identity, id: 'author:second' },
    { ...identity, userId: 'admin:other' }, { ...identity, entity: 'text-versions' }];
  for (const item of identities) writeLocalDraft(storage, item, baseline, value);
  clearRecordLocalDrafts(storage, identity);
  assert.equal(storage.length, 3);
  for (const item of identities.slice(2)) assert.ok(storage.getItem(localDraftKey(item)));
});
