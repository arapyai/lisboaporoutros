import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LOW_ACCURACY_THRESHOLD_M,
  accuracyRingCoordinates,
  geolocationErrorMessage,
  locationCandidate
} from './points/pointLocationModel.ts';

test('accepts a high-accuracy browser location without extra confirmation', () => {
  assert.deepEqual(locationCandidate({ latitude: 38.7138123, longitude: -9.1391249, accuracy: 14.2 }), {
    lat: 38.713812,
    lng: -9.139125,
    accuracy: 14,
    requiresConfirmation: false
  });
});

test('requires confirmation when browser accuracy is low', () => {
  const candidate = locationCandidate({ latitude: 38.7, longitude: -9.1, accuracy: LOW_ACCURACY_THRESHOLD_M + 1 });
  assert.equal(candidate.requiresConfirmation, true);
});

test('gives recoverable messages for browser geolocation errors', () => {
  assert.match(geolocationErrorMessage(1), /Permissão/);
  assert.match(geolocationErrorMessage(2), /determinar/);
  assert.match(geolocationErrorMessage(3), /demorou/);
});

test('builds a closed accuracy ring around the location', () => {
  const ring = accuracyRingCoordinates(38.7, -9.1, 25, 12);
  assert.equal(ring.length, 13);
  assert.deepEqual(ring[0], ring.at(-1));
  assert.notDeepEqual(ring[0], ring[3]);
});
