export const LOW_ACCURACY_THRESHOLD_M = 60;

export type LocationCandidate = {
  lat: number;
  lng: number;
  accuracy: number;
  requiresConfirmation: boolean;
};

export function locationCandidate(coords: Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'accuracy'>): LocationCandidate {
  return {
    lat: Number(coords.latitude.toFixed(6)),
    lng: Number(coords.longitude.toFixed(6)),
    accuracy: Math.max(0, Math.round(coords.accuracy)),
    requiresConfirmation: coords.accuracy > LOW_ACCURACY_THRESHOLD_M
  };
}

export function geolocationErrorMessage(code: number) {
  if (code === 1) return 'Permissão de localização negada. Autorize o acesso no navegador e tente novamente.';
  if (code === 2) return 'Não foi possível determinar a localização atual.';
  if (code === 3) return 'A localização demorou demais. Vá para uma área aberta e tente novamente.';
  return 'Não foi possível usar a localização atual.';
}

export function accuracyRingCoordinates(lat: number, lng: number, radiusM: number, steps = 48) {
  const earthRadiusM = 6_371_000;
  const latRadians = lat * Math.PI / 180;
  const coordinates: number[][] = [];

  for (let step = 0; step <= steps; step += 1) {
    const angle = step / steps * Math.PI * 2;
    const north = Math.cos(angle) * radiusM;
    const east = Math.sin(angle) * radiusM;
    const nextLat = lat + north / earthRadiusM * 180 / Math.PI;
    const nextLng = lng + east / (earthRadiusM * Math.cos(latRadians)) * 180 / Math.PI;
    coordinates.push([nextLng, nextLat]);
  }

  return coordinates;
}
