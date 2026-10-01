import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminRouteSegment, AdminText } from '@ecosdelisboa/shared';
import {
  addTextSegment,
  addLegWaypoint,
  filterAvailableTexts,
  reorderSegments,
  removeLegWaypoint,
  serializeRouteDraft,
  serializeRouteSave,
  waypointDraftFromLegs
} from './routes/routeEditorModel.ts';
import { draftFingerprint, emptyRouteDraft } from './routes/routeEditorModel.ts';

const texts: AdminText[] = [
  {
    id: 'garrett',
    point_id: 'terreiro',
    author_id: 'a1',
    content_pt: 'O Tejo abria a narrativa.',
    content_type: 'prose',
    source_work: 'Viagens',
    author: { id: 'a1', name: 'Almeida Garrett' },
    point: { id: 'terreiro', title_pt: 'Terreiro do Paço', lat: 38.7, lng: -9.13 }
  },
  {
    id: 'pessoa-1',
    point_id: 'douradores',
    author_id: 'a2',
    content_pt: 'A rua estreita parecia infinita.',
    content_type: 'prose',
    author: { id: 'a2', name: 'Bernardo Soares' },
    point: { id: 'douradores', title_pt: 'Rua dos Douradores', lat: 38.71, lng: -9.14 }
  },
  {
    id: 'pessoa-2',
    point_id: 'douradores',
    author_id: 'a2',
    content_pt: 'Outro fragmento na mesma rua.',
    content_type: 'prose',
    author: { id: 'a2', name: 'Fernando Pessoa' },
    point: { id: 'douradores', title_pt: 'Rua dos Douradores', lat: 38.71, lng: -9.14 }
  }
];

test('ordinary route saving cannot publish a local flag or unpublish the server route', () => {
  assert.equal(serializeRouteSave({ ...emptyRouteDraft(), is_published: true }).is_published, false);
  assert.equal(serializeRouteSave({ ...emptyRouteDraft(), is_published: false }, true).is_published, true);
});

test('remote bridge audio and translation do not count as narrative edits', () => {
  const draft = { ...emptyRouteDraft(), segments: [{ id: 'bridge', position: 1, kind: 'bridge' as const, bridge_content_pt: 'Original' }] };
  const updated = { ...draft, segments: [{ ...draft.segments[0], audio_files: [{ id: 'audio', lang: 'pt', public_url: '/audio.mp3' }],
    translations: [{ id: 'en', lang: 'en', content: 'Reviewed', status: 'approved' as const }] }] };
  assert.equal(draftFingerprint(draft), draftFingerprint(updated));
  assert.notEqual(draftFingerprint(draft), draftFingerprint({ ...updated, title_pt: 'Human change' }));
});

test('route writes retain server identity but never send temporary segment ids', () => {
  const draft = { ...emptyRouteDraft(), segments: [
    { id: 'server-bridge', position: 1, kind: 'bridge' as const, bridge_content_pt: 'Original' },
    { id: 'local-bridge-new', position: 2, kind: 'bridge' as const, bridge_content_pt: 'New' }
  ] };
  const payload = serializeRouteDraft(draft);
  assert.equal(payload.segments[0].id, 'server-bridge');
  assert.equal(payload.segments[1].id, undefined);
  assert.equal(draftFingerprint(draft), draftFingerprint({ ...draft, segments: draft.segments.map(item => ({ ...item, id: 'server-returned' })) }));
});

test('searches by author, work, excerpt and place', () => {
  assert.deepEqual(filterAvailableTexts(texts, 'garrett viagens', []).map((text) => text.id), [
    'garrett'
  ]);
  assert.deepEqual(filterAvailableTexts(texts, 'rua estreita', []).map((text) => text.id), [
    'pessoa-1'
  ]);
  assert.equal(filterAvailableTexts(texts, 'douradores', []).length, 2);
});

test('keeps waypoints attached to walking legs rather than narrative segments', () => {
  const draft = waypointDraftFromLegs([
    {
      id: 'leg',
      position: 0,
      from_segment_id: 'one',
      to_segment_id: 'two',
      geometry: { type: 'LineString', coordinates: [] },
      waypoints: [{ lat: 38.71, lng: -9.14 }],
      distance_m: 10,
      duration_s: 8,
      provider: 'stub'
    }
  ]);
  const added = addLegWaypoint(draft, 0, { lat: 38.72, lng: -9.13 });
  assert.deepEqual(added[0].waypoints, [
    { lat: 38.71, lng: -9.14 },
    { lat: 38.72, lng: -9.13 }
  ]);
  assert.deepEqual(removeLegWaypoint(added, 0, 0)[0].waypoints, [
    { lat: 38.72, lng: -9.13 }
  ]);
});

test('keeps multiple texts at one point as independent narrative segments', () => {
  const selected = addTextSegment(addTextSegment([], texts[1]), texts[2]);
  assert.deepEqual(
    selected.map((segment) => [segment.text_id, segment.text?.point?.id]),
    [
      ['pessoa-1', 'douradores'],
      ['pessoa-2', 'douradores']
    ]
  );
});

test('reorders and serializes texts and bridges without point ids', () => {
  const segments: AdminRouteSegment[] = [
    { position: 1, kind: 'text', text_id: 'one' },
    { position: 2, kind: 'bridge', bridge_content_pt: ' Transição ' },
    { position: 3, kind: 'text', text_id: 'two' }
  ];
  const reordered = reorderSegments(segments, 2, 0);
  const payload = serializeRouteDraft({
    title_pt: ' Percurso ',
    slug: ' percurso ',
    description_pt: '',
    cover_image_url: '',
    difficulty: 'easy',
    is_published: false,
    segments: reordered
  });

  assert.deepEqual(payload.segments, [
    { position: 1, kind: 'text', text_id: 'two' },
    { position: 2, kind: 'text', text_id: 'one' },
    { position: 3, kind: 'bridge', bridge_content_pt: 'Transição' }
  ]);
  assert.ok(payload.segments.every((segment) => !('point_id' in segment)));
});
