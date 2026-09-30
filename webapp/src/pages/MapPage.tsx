import { Bell, BellOff, Filter, Navigation } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import { EmptyState, ErrorState } from '../components/AsyncState';
import { CityMap } from '../components/CityMap';
// import { OfflineCache } from '../components/OfflineCache';
import { PointSheet } from '../components/PointSheet';
import { PointTypeIcon } from '../components/PointTypeIcon';
import { cityConfig } from '../config/city';
import { useProximityNotifications } from '../hooks/useProximityNotifications';
import { useVisitorLocation } from '../hooks/useVisitorLocation';
import { localized, t } from '../i18n/messages';
import type { Author, Lang, Point, PointType } from '../types';
import { authorHref, authorMapHref } from '../authorDiscovery';
import { distanceMeters, proximityCopy } from '../lib/proximity';

interface Props {
  lang: Lang;
  initialAuthorId?: string;
  initialPointId?: string;
  authorQuery?: string;
}

export function MapPage({ lang, initialAuthorId, initialPointId, authorQuery = '' }: Props) {
  const [points, setPoints] = useState<Point[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [pointTypes, setPointTypes] = useState<PointType[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState(initialAuthorId ?? '');
  const [pointType, setPointType] = useState('');
  const authorView = Boolean(initialAuthorId && authorId);
  const [radius, setRadius] = useState(cityConfig.map.defaultRadius);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const initialPointIdRef = useRef(new URLSearchParams(window.location.search).get('point'));
  const { currentLocation, searchLocation, status: locationStatus, retry } = useVisitorLocation();
  const copy = proximityCopy(lang);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getAuthors(), api.getPointTypes()])
      .then(([authorResult, typeResult]) => {
        if (!cancelled) {
          setAuthors(authorResult.data);
          setPointTypes(typeResult.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthors([]);
          setPointTypes([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getPoints({
        lat: authorView ? undefined : searchLocation.lat,
        lng: authorView ? undefined : searchLocation.lng,
        radius: authorView ? undefined : radius,
        lang,
        author_id: authorId,
        type: pointType
      })
      .then((result) => {
        if (cancelled) return;
        setPoints(result.data);
        setSelectedPoint((current) =>
          current && result.data.some((point) => point.id === current.id) ? current : result.data.find(point => point.id === initialPointId) ?? null
        );
        setIsMock(result.isMock);
      })
      .catch(() => {
        if (cancelled) return;
        setPoints([]);
        setSelectedPoint(null);
        setSelectedTextId(null);
        setIsMock(false);
        setError('Não foi possível carregar os pontos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authorId, authorView, initialPointId, lang, pointType, radius, reloadKey, searchLocation.lat, searchLocation.lng]);

  const pointsWithAuthors = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        author: point.authors?.find(author => author.id === authorId) ?? point.author ?? point.authors?.[0] ?? authors.find((author) => author.id === point.author_id),
        distance_m: currentLocation ? distanceMeters(currentLocation, point) : undefined
      })),
    [authorId, authors, currentLocation, points]
  );
  const sortedPoints = useMemo(
    () => [...pointsWithAuthors].sort((left, right) => (left.distance_m ?? Number.POSITIVE_INFINITY) - (right.distance_m ?? Number.POSITIVE_INFINITY)),
    [pointsWithAuthors]
  );
  const neighborhoods = useMemo(
    () => Array.from(new Set(sortedPoints.map((point) => point.neighborhood).filter(Boolean))),
    [sortedPoints]
  );
  const proximity = useProximityNotifications(currentLocation, sortedPoints, lang);

  useEffect(() => {
    const initialPointId = initialPointIdRef.current;
    if (!initialPointId) return;
    const initialPoint = sortedPoints.find((point) => point.id === initialPointId);
    if (!initialPoint) return;
    initialPointIdRef.current = null;
    setSelectedPoint(initialPoint);
    setSelectedTextId(null);
  }, [sortedPoints]);

  useEffect(() => {
    const selectedId = selectedPoint?.id;
    if (!selectedId) return;
    let cancelled = false;
    api
      .getPoint(selectedId, lang)
      .then((result) => {
        if (cancelled) return;
        setSelectedPoint((current) => {
          if (!current || current.id !== selectedId) return current;
          return {
            ...current,
            ...result.data,
            author:
              result.data.author ??
              result.data.authors?.[0] ??
              current.author ??
              current.authors?.[0]
          };
        });
        setSelectedTextId((current) =>
          result.data.texts?.some((text) => text.id === current)
            ? current
            : result.data.texts?.find(text => text.author_id === authorId)?.id ?? result.data.texts?.[0]?.id ?? null
        );
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar o detalhe do ponto.');
      });
    return () => {
      cancelled = true;
    };
  }, [authorId, lang, selectedPoint?.id]);

  function selectPoint(point: Point) {
    setSelectedPoint(point);
    setSelectedTextId(null);
  }

  function selectText(point: Point, textId: string) {
    setSelectedTextId(textId);
  }

  return (
    <main className="map-page">
      <section className="map-sidebar">
        <div className="section-heading">
          <span>{t(lang, authorView ? 'authorPlaces' : 'nearby')}</span>
          <strong>{pointsWithAuthors.length}</strong>
        </div>
        {authorView ? <a className="author-back map-author-back" href={authorHref(authorId, authorQuery)}>{t(lang, 'backToAuthor')}</a> : null}
        {isMock ? <p className="notice">{t(lang, 'mockData')}</p> : null}
        {error ? <ErrorState message={error} onRetry={() => setReloadKey((current) => current + 1)} /> : null}
        <div className="location-controls">
          <div className={`location-status ${locationStatus}`}>
            <Navigation size={16} aria-hidden="true" />
            <span>{copy.location[locationStatus]}</span>
            {locationStatus === 'denied' || locationStatus === 'unavailable' ? (
              <button type="button" onClick={retry}>{copy.retry}</button>
            ) : null}
          </div>
          <button
            type="button"
            className={proximity.enabled ? 'proximity-toggle active' : 'proximity-toggle'}
            onClick={() => void proximity.toggle()}
            disabled={proximity.permission === 'denied'}
          >
            {proximity.enabled ? <Bell size={16} /> : <BellOff size={16} />}
            {proximity.permission === 'denied'
              ? copy.blocked
              : proximity.enabled
                ? copy.enabled
                : copy.enable}
          </button>
        </div>
        <div className="filter-panel">
          <div className="filter-heading">
            <Filter size={15} />
            {t(lang, 'filters')}
          </div>
          <div className="point-type-filters" aria-label="Tipos de ponto">
            <button
              type="button"
              className={pointType === '' ? 'active' : ''}
              aria-pressed={pointType === ''}
              onClick={() => setPointType('')}
            >
              Todos
            </button>
            {pointTypes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={pointType === item.slug ? 'active' : ''}
                aria-pressed={pointType === item.slug}
                onClick={() => setPointType(item.slug)}
              >
                <PointTypeIcon iconKey={item.icon_key} size={15} />
                {item.name_pt}
              </button>
            ))}
          </div>
          <select name="author" aria-label={t(lang, 'authors')} value={authorId} onChange={(event) => {
            if (authorView) location.hash = event.target.value ? authorMapHref(event.target.value, undefined, authorQuery) : '#/map';
            else setAuthorId(event.target.value);
          }}>
            <option value="">{t(lang, 'allAuthors')}</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
          {authorView ? <p className="author-map-scope">{t(lang, 'allAuthorPlaces')}</p> : <div className="range-row">
            <span>{t(lang, 'radius')}</span>
            <input
              name="radius"
              aria-label={t(lang, 'radius')}
              min="500"
              max="5000"
              step="250"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              type="range"
            />
            <strong>{radius} m</strong>
          </div>}
        </div>
        {/* <OfflineCache points={points} lang={lang} /> */}
        <div className="neighborhoods">
          {neighborhoods.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="point-list">
          {!loading && !error && sortedPoints.length === 0 ? <EmptyState message={t(lang, 'empty')} /> : null}
          {loading ? <EmptyState message="A carregar..." /> : null}
          {sortedPoints.map((point) => (
            <button
              key={point.id}
              type="button"
              className={selectedPoint?.id === point.id ? 'point-row active' : 'point-row'}
              onClick={() => selectPoint(point)}
            >
              <span className="point-row-icon" style={{ backgroundColor: point.point_type.color }}>
                <PointTypeIcon iconKey={point.point_type.icon_key} size={16} />
              </span>
              <span>
                <strong>{point.title ?? localized(point, 'title', lang)}</strong>
                <small className="point-type-label">{point.point_type.name_pt}</small>
                <small>
                  {[point.address ?? point.description ?? '—', point.author?.name].filter(Boolean).join(' · ')}
                  {point.distance_m != null ? ` · ${formatPointDistance(point.distance_m)}` : ''}
                </small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="map-stage">
        <CityMap
          fitAll={authorView && !initialPointId}
          points={sortedPoints}
          selected={selectedPoint}
          onSelect={selectPoint}
          selectedTextId={selectedTextId}
          onSelectText={selectText}
          userLocation={currentLocation}
          searchCenter={[searchLocation.lng, searchLocation.lat]}
        />
        {proximity.notice ? (
          <div className="proximity-notice" role="status">
            <Bell size={18} aria-hidden="true" />
            <div>
              <strong>{copy.nearbyTitle}</strong>
              <span>{copy.nearbyBody(localized(proximity.notice.point, 'title', lang))}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                selectPoint(proximity.notice!.point);
                proximity.dismiss();
              }}
            >
              {copy.openPoint}
            </button>
            <button type="button" className="dismiss" onClick={proximity.dismiss} aria-label={copy.dismiss}>×</button>
          </div>
        ) : null}
        <PointSheet
          onUpdated={(updated) => {
            setPoints(current => current.map(point => point.id === updated.id ? { ...point, ...updated } : point));
            setSelectedPoint(updated);
          }}
          point={selectedPoint}
          lang={lang}
          onClose={() => {
            setSelectedPoint(null);
            setSelectedTextId(null);
          }}
          selectedTextId={selectedTextId}
        />
      </section>
    </main>
  );
}

function formatPointDistance(distanceM: number) {
  return distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`;
}
