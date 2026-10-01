import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cityConfig } from '../config/city';
import type { VisitorLocation } from '../lib/proximity';
import type { Point } from '../types';
import { pointTypeIconMarkup } from './pointTypeIconMarkup';
import { groupMapPoints, OVERVIEW_MAX_ZOOM, type PointGroup } from '../lib/mapPointGroups';

interface Props {
  fitAll?: boolean;
  points: Point[];
  selected?: Point | null;
  onSelect: (point: Point) => void;
  onSelectOverlap?: (points: Point[]) => void;
  preserveZoom?: boolean;
  collisionSelection?: Point[] | null;
  onOverlapSeparated?: () => void;
  userLocation?: VisitorLocation | null;
  searchCenter?: [number, number];
}

export function CityMap({ points, selected, onSelect, onSelectOverlap, preserveZoom, collisionSelection, onOverlapSeparated, fitAll, userLocation, searchCenter }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const initialSearchCenterRef = useRef(searchCenter);
  const lastFocusedPointIdRef = useRef<string | null>(null);
  const lastSearchCenterRef = useRef<string>('');
  const [viewportVersion, setViewportVersion] = useState(0);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const fittedPoints = useRef('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: cityConfig.map.styleUrl,
        center: initialSearchCenterRef.current ?? cityConfig.map.center,
        zoom: cityConfig.map.zoom,
        attributionControl: false
      });
    } catch {
      setMapUnavailable(true);
      return;
    }
    mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const refreshLayout = () => setViewportVersion((version) => version + 1);
    mapRef.current.on('moveend', refreshLayout);
    mapRef.current.on('zoomend', refreshLayout);

    return () => {
      mapRef.current?.off('moveend', refreshLayout);
      mapRef.current?.off('zoomend', refreshLayout);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || selected || !searchCenter) return;
    const centerKey = searchCenter.join(':');
    if (lastSearchCenterRef.current === centerKey) return;
    lastSearchCenterRef.current = centerKey;
    map.easeTo({ center: searchCenter, zoom: Math.max(map.getZoom(), 13), duration: 650 });
  }, [searchCenter, selected]);

  useEffect(() => {
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!mapRef.current || !userLocation) return;

    const element = document.createElement('div');
    element.className = 'user-location-marker';
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', 'Sua localização');
    element.title = 'Sua localização';
    const marker = new maplibregl.Marker({ element })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(mapRef.current);
    userMarkerRef.current = marker;
    return () => {
      marker.remove();
    };
  }, [userLocation]);

  useEffect(() => {
    const key = points.map(point => point.id).join(',');
    const map = mapRef.current;
    if (!fitAll || !map || !points.length || fittedPoints.current === key) return;
    fittedPoints.current = key;
    const bounds = points.reduce((value, point) => value.extend([point.lng, point.lat]), new maplibregl.LngLatBounds());
    map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
  }, [fitAll, points]);

  useEffect(() => {
    const map = mapRef.current;
    const selectedKey = selected ? `${selected.id}:${selected.lat}:${selected.lng}` : '';
    if (!map || !selected || lastFocusedPointIdRef.current === selectedKey) return;

    const container = map.getContainer();
    const isCompactViewport = container.clientWidth <= 700;
    const verticalOffset = isCompactViewport
      ? -Math.min(container.clientHeight * 0.34, 220)
      : 0;

    lastFocusedPointIdRef.current = selectedKey;
    map.flyTo({
      center: [selected.lng, selected.lat],
      zoom: preserveZoom ? map.getZoom() : Math.max(map.getZoom(), 15),
      offset: [0, verticalOffset],
      duration: 650,
      essential: true
    });
  }, [selected, preserveZoom]);

  const openCluster = useCallback((cluster: PointGroup) => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = cluster.points.reduce(
      (nextBounds, point) => nextBounds.extend([point.lng, point.lat]),
      new maplibregl.LngLatBounds()
    );
    const hasCoordinateSpread = cluster.points.some(
      (point) => Math.abs(point.lng - cluster.lng) > 0.00001 || Math.abs(point.lat - cluster.lat) > 0.00001
    );

    if (cluster.overview && hasCoordinateSpread && map.getZoom() < 16) {
      map.fitBounds(bounds, { padding: 88, maxZoom: 16, duration: 450 });
      return;
    }

    if (onSelectOverlap) onSelectOverlap(cluster.points);
    else onSelect(cluster.points[0]);
  }, [onSelect, onSelectOverlap]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((marker) => marker.remove());

    const newMarkers: maplibregl.Marker[] = [];
    const map = mapRef.current;
    const pointClusters = groupMapPoints(points.map(point => ({ point, ...map.project([point.lng, point.lat]) })), map.getZoom());
    if (collisionSelection && collisionSelection.length > 1 && map.getZoom() >= OVERVIEW_MAX_ZOOM
      && !pointClusters.some(group => collisionSelection.every(point => group.points.some(item => item.id === point.id)))) {
      onOverlapSeparated?.();
    }

    pointClusters.forEach((cluster) => {
      if (cluster.points.length > 1) {
        const hasSelectedPoint = cluster.points.some((point) => selected?.id === point.id);
        const container = document.createElement('div');
        container.style.width = '42px';
        container.style.height = '42px';
        container.style.zIndex = hasSelectedPoint ? '20' : '5';

        const element = document.createElement('button');
        element.className = `map-marker cluster-marker${cluster.overview ? '' : ' overlap-marker'}${hasSelectedPoint ? ' selected' : ''}`;
        element.type = 'button';
        const count = cluster.points.reduce((sum, point) => sum + Math.max(point.texts_count ?? 0, 1), 0);
        element.setAttribute('aria-label', cluster.overview ? `${cluster.points.length} pontos próximos` : `${count} conteúdos sobrepostos`);
        element.textContent = String(cluster.overview ? cluster.points.length : count);
        element.addEventListener('click', () => openCluster(cluster));
        container.appendChild(element);

        const marker = new maplibregl.Marker({ element: container })
          .setLngLat([cluster.lng, cluster.lat])
          .addTo(mapRef.current!);
        newMarkers.push(marker);
        return;
      }

      const point = cluster.points[0];
      // Render normal marker (possibly with multiple citations badge)
      const container = document.createElement('div');
      container.style.width = '34px';
      container.style.height = '34px';
      container.style.zIndex = selected?.id === point.id ? '30' : '1';

      const element = document.createElement('button');
      element.className = selected?.id === point.id ? 'map-marker selected' : 'map-marker';
      element.type = 'button';
      element.setAttribute(
        'aria-label',
        `${point.point_type.name_pt}: ${point.title ?? point.title_pt}`
      );
      element.style.backgroundColor = point.point_type.color;
      element.innerHTML = pointTypeIconMarkup(point.point_type.icon_key);

      element.addEventListener('click', () => onSelect(point));
      container.appendChild(element);

      // If the point has multiple texts, show a badge with count
      if (point.texts_count && point.texts_count > 1) {
        const badge = document.createElement('span');
        badge.className = 'map-marker-badge';
        badge.textContent = String(point.texts_count);
        container.appendChild(badge);
      }

      const marker = new maplibregl.Marker({ element: container })
        .setLngLat([point.lng, point.lat])
        .addTo(mapRef.current!);
      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;
  }, [onSelect, openCluster, points, selected?.id, collisionSelection, onOverlapSeparated, viewportVersion]);

  return (
    <div className="map-canvas" ref={containerRef}>
      {mapUnavailable ? (
        <p className="map-unavailable" role="status">
          O mapa não está disponível neste navegador. Use a lista de pontos.
        </p>
      ) : null}
    </div>
  );
}
