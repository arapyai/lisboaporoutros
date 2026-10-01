import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLegacyRouteDraft, restoreRouteNarrative, routeNarrativeDraft, validateRouteNarrativeDraft } from './routeNarrativeDraft.ts';
import { emptyRouteDraft } from './routes/routeEditorModel.ts';

const remote = { ...emptyRouteDraft(), title_pt: 'Remote', is_published: false,
  segments: [{ id: 'bridge', kind: 'bridge' as const, position: 1, bridge_content_pt: 'PT',
    translations: [{ id: 'en', lang: 'en', content: 'Reviewed', status: 'approved' as const }],
    audio_files: [{ id: 'audio', lang: 'pt', public_url: '/manual.mp3', manually_uploaded: true }] }] };
test('narrative snapshot contains only editable fields and sequence, never publication or media', () => {
  const snapshot = routeNarrativeDraft(remote, [{ position: 0, waypoints: [{ lat: 38.7, lng: -9.1 }] }]);
  assert.ok(validateRouteNarrativeDraft(snapshot));
  const raw = JSON.stringify(snapshot);
  for (const excluded of ['is_published', 'translations', 'audio_files', 'approved', 'manual.mp3']) assert.ok(!raw.includes(excluded));
  assert.equal(validateRouteNarrativeDraft({ ...snapshot, token: 'secret' }), null);
  assert.equal(validateRouteNarrativeDraft({ ...snapshot, segments: [{ ...snapshot.segments[0], status: 'approved' }] }), null);
  assert.equal(validateRouteNarrativeDraft({ ...snapshot, segments: [snapshot.segments[0], snapshot.segments[0]] }), null);
  assert.equal(validateRouteNarrativeDraft({ ...snapshot, waypoints: [{ position: 0, waypoints: [{ lat: 91, lng: 0 }] }] }), null);
});
test('restore enriches from current remote without reinstating old publication or media', () => {
  const value = routeNarrativeDraft({ ...remote, title_pt: 'Local', is_published: true }, []);
  const restored = restoreRouteNarrative(value, remote, []);
  assert.equal(restored.title_pt, 'Local');
  assert.equal(restored.is_published, false);
  assert.deepEqual(restored.segments[0].audio_files, remote.segments[0].audio_files);
  assert.deepEqual(restored.segments[0].translations, remote.segments[0].translations);
  assert.equal(restored.segments[0].id, 'bridge');
});
test('legacy extraction sanitizes editorial content and rejects invalid coordinates or shape', () => {
  const raw = JSON.stringify({ version: 2, narrative: { ...remote, is_published: true, token: 'secret' }, waypoints: [] });
  const migrated = extractLegacyRouteDraft(raw)!;
  assert.equal(migrated.title_pt, 'Remote');
  assert.ok(!JSON.stringify(migrated).includes('secret'));
  assert.ok(!JSON.stringify(migrated).includes('is_published'));
  assert.equal(extractLegacyRouteDraft('{'), null);
  assert.equal(extractLegacyRouteDraft(JSON.stringify({ version: 2, narrative: { ...remote, segments: [{}] }, waypoints: [] })), null);
});
