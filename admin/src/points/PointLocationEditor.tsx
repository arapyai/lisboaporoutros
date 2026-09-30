import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import {
  ADMIN_DEFAULT_LAT,
  ADMIN_DEFAULT_LNG,
  ADMIN_MAP_STYLE_URL,
  MAPTILER_KEY
} from '../adminConfig';
import type { Draft, DraftValue, GeocodingFeature } from '../adminTypes';
import {
  type LocationCandidate,
  accuracyRingCoordinates,
  geolocationErrorMessage,
  locationCandidate
} from './pointLocationModel';

const ACCURACY_SOURCE_ID = 'admin-current-location-accuracy';

export function PointLocationEditor({ draft, onDraft }: { draft: Draft; onDraft: (draft: Draft) => void }) {
  const lat = coordinateNumber(draft.lat);
  const lng = coordinateNumber(draft.lng);
  const hasValidLocation = isValidCoordinate(lat, lng);
  const currentLat = hasValidLocation ? lat : ADMIN_DEFAULT_LAT;
  const currentLng = hasValidLocation ? lng : ADMIN_DEFAULT_LNG;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const draftRef = useRef(draft);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingFeature[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const [coordinateMessage, setCoordinateMessage] = useState('');
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'confirm' | 'applied' | 'error'>('idle');
  const [pendingLocation, setPendingLocation] = useState<LocationCandidate | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
      attributionControl: false,
      center: [currentLng, currentLat],
      container: containerRef.current,
      style: ADMIN_MAP_STYLE_URL,
      zoom: hasValidLocation ? 15 : 12
      });
    } catch {
      containerRef.current?.querySelectorAll('.maplibregl-canvas-container, .maplibregl-control-container').forEach(element => element.remove());
      setMapUnavailable(true);
      return;
    }
    const marker = new maplibregl.Marker({ color: '#c45732', draggable: true })
      .setLngLat([currentLng, currentLat])
      .addTo(map);

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => ensureAccuracyLayer(map));
    marker.on('dragend', () => {
      const nextLocation = marker.getLngLat();
      updateLocation(Number(nextLocation.lat.toFixed(6)), Number(nextLocation.lng.toFixed(6)), true);
    });
    map.on('click', (event) => {
      marker.setLngLat(event.lngLat);
      updateLocation(Number(event.lngLat.lat.toFixed(6)), Number(event.lngLat.lng.toFixed(6)), true);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hasValidLocation) {
      setCoordinateMessage('Coordenadas inválidas. Corrija latitude e longitude ou selecione no mapa.');
      return;
    }
    setCoordinateMessage('');
    markerRef.current?.setLngLat([currentLng, currentLat]);
    mapRef.current?.easeTo({ center: [currentLng, currentLat], duration: 250, zoom: Math.max(mapRef.current.getZoom(), 14) });
  }, [currentLat, currentLng, hasValidLocation]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearchState('idle');
      return;
    }
    if (trimmed.length < 3) {
      setResults([]);
      setSearchState('idle');
      return;
    }
    if (!MAPTILER_KEY) {
      setResults([]);
      setSearchState('error');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchState('loading');
      try {
        const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(trimmed)}.json`);
        url.searchParams.set('key', MAPTILER_KEY);
        url.searchParams.set('limit', '6');
        url.searchParams.set('language', 'pt');
        url.searchParams.set('proximity', `${currentLng},${currentLat}`);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Geocoding failed');
        const payload = (await response.json()) as { features?: GeocodingFeature[] };
        const nextResults = payload.features?.filter((feature) => Array.isArray(feature.center)) ?? [];
        setResults(nextResults);
        setSearchState(nextResults.length > 0 ? 'idle' : 'empty');
      } catch (cause) {
        if ((cause as DOMException).name === 'AbortError') return;
        setResults([]);
        setSearchState('error');
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [currentLat, currentLng, query]);

  function updateLocation(nextLat: number, nextLng: number, keepAddress = false) {
    if (!isValidCoordinate(nextLat, nextLng)) {
      setCoordinateMessage('Coordenadas inválidas. Latitude deve estar entre -90 e 90; longitude entre -180 e 180.');
      return;
    }
    onDraft({ ...draftRef.current, lat: nextLat, lng: nextLng });
    if (keepAddress) setCoordinateMessage('Coordenadas atualizadas pelo mapa.');
  }

  function applyCurrentLocation(candidate: LocationCandidate) {
    updateLocation(candidate.lat, candidate.lng, true);
    setPendingLocation(null);
    setLocationAccuracy(candidate.accuracy);
    setLocationState('applied');
    setCoordinateMessage(`Localização atual aplicada com precisão aproximada de ${candidate.accuracy} m. Confirme o ponto no mapa e guarde o formulário.`);
    const map = mapRef.current;
    if (map) {
      map.flyTo({ center: [candidate.lng, candidate.lat], zoom: 18, duration: 500 });
      updateAccuracyLayer(map, candidate);
    }
  }

  function useCurrentLocation() {
    setPendingLocation(null);
    setLocationAccuracy(null);
    if (!('geolocation' in navigator)) {
      setLocationState('error');
      setCoordinateMessage('Este navegador não disponibiliza localização. Use a busca ou ajuste o marcador manualmente.');
      return;
    }

    setLocationState('loading');
    setCoordinateMessage('A obter localização com alta precisão…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const candidate = locationCandidate(position.coords);
        if (candidate.requiresConfirmation) {
          setPendingLocation(candidate);
          setLocationAccuracy(candidate.accuracy);
          setLocationState('confirm');
          setCoordinateMessage(`A precisão estimada é de ${candidate.accuracy} m. Confirme para usar esta posição ou tente novamente em uma área aberta.`);
          return;
        }
        applyCurrentLocation(candidate);
      },
      (error) => {
        setLocationState('error');
        setCoordinateMessage(geolocationErrorMessage(error.code));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
    );
  }

  function selectResult(feature: GeocodingFeature) {
    if (!feature.center) {
      setCoordinateMessage('Resultado sem coordenadas válidas.');
      return;
    }
    const nextLng = feature.center[0];
    const nextLat = feature.center[1];
    if (!isValidCoordinate(nextLat, nextLng)) {
      setCoordinateMessage('Resultado sem coordenadas válidas.');
      return;
    }
    const nextDraft = {
      ...draftRef.current,
      lat: Number(nextLat.toFixed(6)),
      lng: Number(nextLng.toFixed(6)),
      address: feature.place_name || feature.text || draftRef.current.address || '',
      neighborhood: geocodingNeighborhood(feature) || draftRef.current.neighborhood || ''
    };
    onDraft(nextDraft);
    setQuery(feature.place_name || feature.text || '');
    setResults([]);
    setSearchState('idle');
    setCoordinateMessage('Endereço selecionado e coordenadas atualizadas.');
    mapRef.current?.flyTo({ center: [nextLng, nextLat], zoom: 16, duration: 500 });
  }

  return (
    <section className="point-location-editor">
      <div className="point-location-heading">
        <div>
          <span>Localização visual</span>
          <h4>Mapa do ponto</h4>
        </div>
        <span className={`version-state ${hasValidLocation ? 'manual' : 'missing'}`}>
          {hasValidLocation ? 'Coordenadas válidas' : 'Coordenadas inválidas'}
        </span>
      </div>

      <div className="current-location-actions">
        <button type="button" className="secondary-action" disabled={locationState === 'loading'} onClick={useCurrentLocation}>
          {locationState === 'loading' ? 'A obter localização…' : 'Usar minha localização atual'}
        </button>
        {locationAccuracy !== null ? <small>Precisão estimada: {locationAccuracy} m</small> : null}
      </div>
      {pendingLocation ? (
        <div className="low-accuracy-confirmation" role="group" aria-label="Confirmar localização com baixa precisão">
          <button type="button" onClick={() => applyCurrentLocation(pendingLocation)}>Usar mesmo assim</button>
          <button type="button" className="secondary-action" onClick={useCurrentLocation}>Tentar novamente</button>
        </div>
      ) : null}

      <label className="geocoding-field">
        Buscar endereço
        <input
          aria-describedby="geocoding-feedback"
          autoComplete="off"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setResults([]);
          }}
        />
      </label>
      <div id="geocoding-feedback" className="geocoding-feedback" aria-live="polite">
        {searchState === 'loading' ? 'A buscar endereços...' : null}
        {searchState === 'empty' ? 'Nenhum resultado encontrado.' : null}
        {searchState === 'error'
          ? MAPTILER_KEY
            ? 'Não foi possível buscar endereços agora.'
            : 'Configure VITE_MAPTILER_KEY para ativar a busca por endereço.'
          : null}
      </div>
      {results.length > 0 ? (
        <div className="geocoding-results" role="listbox" aria-label="Resultados de endereço">
          {results.map((feature) => (
            <button key={feature.id} type="button" role="option" onClick={() => selectResult(feature)}>
              <strong>{feature.text || 'Endereço'}</strong>
              <small>{feature.place_name || '-'}</small>
            </button>
          ))}
        </div>
      ) : null}

      <div ref={containerRef} className="coordinate-map embedded-coordinate-map">
        {mapUnavailable ? <p className="map-unavailable" role="status">O mapa não está disponível neste navegador. Pode continuar usando o GPS e os campos de latitude e longitude.</p> : null}
      </div>
      <p className={`coordinate-readout ${coordinateMessage ? 'has-message' : ''}`}>
        Busque um endereço, clique no mapa, arraste o marcador ou use sua localização atual. Lat {Number.isFinite(lat) ? lat.toFixed(6) : '-'} · Lng{' '}
        {Number.isFinite(lng) ? lng.toFixed(6) : '-'}
      </p>
      <p className="coordinate-save-hint">As coordenadas só são publicadas depois de selecionar <strong>Guardar</strong> no formulário.</p>
      {coordinateMessage ? <p className="coordinate-feedback">{coordinateMessage}</p> : null}
    </section>
  );
}

function ensureAccuracyLayer(map: maplibregl.Map) {
  if (!map.getSource(ACCURACY_SOURCE_ID)) {
    map.addSource(ACCURACY_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }
  if (!map.getLayer(`${ACCURACY_SOURCE_ID}-fill`)) {
    map.addLayer({
      id: `${ACCURACY_SOURCE_ID}-fill`,
      type: 'fill',
      source: ACCURACY_SOURCE_ID,
      paint: { 'fill-color': '#2d6ea3', 'fill-opacity': 0.16 }
    });
  }
  if (!map.getLayer(`${ACCURACY_SOURCE_ID}-line`)) {
    map.addLayer({
      id: `${ACCURACY_SOURCE_ID}-line`,
      type: 'line',
      source: ACCURACY_SOURCE_ID,
      paint: { 'line-color': '#2d6ea3', 'line-width': 2 }
    });
  }
}

function updateAccuracyLayer(map: maplibregl.Map, candidate: LocationCandidate) {
  ensureAccuracyLayer(map);
  const source = map.getSource(ACCURACY_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [accuracyRingCoordinates(candidate.lat, candidate.lng, candidate.accuracy)]
    }
  });
}

function coordinateNumber(value: DraftValue | undefined) {
  if (value === '' || value === null || value === undefined) return Number.NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function geocodingNeighborhood(feature: GeocodingFeature) {
  if (feature.place_type?.some((type) => ['neighbourhood', 'neighborhood', 'suburb', 'locality'].includes(type))) {
    return feature.text ?? '';
  }
  const contextMatch = feature.context?.find((item) => {
    const id = item.id ?? '';
    return ['neighbourhood', 'neighborhood', 'suburb', 'locality', 'district'].some((type) => id.includes(type));
  });
  return contextMatch?.text ?? '';
}
