import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { cityConfig } from '../config/city';

interface Props { oldLat: number; oldLng: number; lat: number; lng: number; accuracy: number }
export function PointGPSPreview({ oldLat, oldLng, lat, lng, accuracy }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    const markers: maplibregl.Marker[] = [];
    setError(false);
    try {
      map = new maplibregl.Map({ container: container.current, style: cityConfig.map.styleUrl,
        center: [lng, lat], zoom: 17, attributionControl: {} });
      map.on('error', () => setError(true));
      for (const item of [{ name: 'Posição anterior', lat: oldLat, lng: oldLng, color: '#76507A' },
        { name: 'GPS proposto', lat, lng, color: '#2F6F68' }]) {
        const element = document.createElement('div');
        element.className = 'gps-preview-marker';
        element.style.background = item.color;
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', item.name);
        element.title = item.name;
        markers.push(new maplibregl.Marker({ element }).setLngLat([item.lng, item.lat]).addTo(map));
      }
      map.on('load', () => {
        const ring = Array.from({ length: 65 }, (_, i) => {
          const angle = 2 * Math.PI * i / 64;
          return [lng + Math.cos(angle) * accuracy / (111320 * Math.max(0.01, Math.cos(lat * Math.PI / 180))),
            lat + Math.sin(angle) * accuracy / 111320];
        });
        map.addSource('gps-accuracy', { type: 'geojson', data: { type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] } } });
        map.addLayer({ id: 'gps-accuracy', type: 'fill', source: 'gps-accuracy',
          paint: { 'fill-color': '#2F6F68', 'fill-opacity': 0.16 } });
        const bounds = new maplibregl.LngLatBounds([oldLng, oldLat], [lng, lat]);
        ring.forEach(coordinate => bounds.extend(coordinate as [number, number]));
        map.fitBounds(bounds, { padding: 45, maxZoom: 18, duration: 0 });
      });
    } catch { setError(true); return; }
    return () => { markers.forEach(marker => marker.remove()); map.remove(); };
  }, [oldLat, oldLng, lat, lng, accuracy]);
  return <><div ref={container} className="gps-preview-map" aria-label="Comparação da localização anterior com o GPS" />
    {error ? <p role="alert">Mapa indisponível neste navegador. Confira as coordenadas antes de confirmar.</p> : null}</>;
}
