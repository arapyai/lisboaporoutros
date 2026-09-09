import { Filter, LocateFixed } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { EmptyState, ErrorState } from '../components/AsyncState';
import { CityMap } from '../components/CityMap';
// import { OfflineCache } from '../components/OfflineCache';
import { PointSheet } from '../components/PointSheet';
import { cityConfig } from '../config/city';
import { localized, t } from '../i18n/messages';
import type { Author, Lang, Point } from '../types';
import { authorHref, authorMapHref } from '../authorDiscovery';

interface Props {
  lang: Lang;
  initialAuthorId?: string;
  initialPointId?: string;
  authorQuery?: string;
}

export function MapPage({ lang, initialAuthorId, initialPointId, authorQuery = '' }: Props) {
  const [points, setPoints] = useState<Point[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [authorId, setAuthorId] = useState(initialAuthorId ?? '');
  const authorView = Boolean(initialAuthorId && authorId);
  const [radius, setRadius] = useState(cityConfig.map.defaultRadius);
  const [isMock, setIsMock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getAuthors()
      .then((result) => {
        if (!cancelled) setAuthors(result.data);
      })
      .catch(() => {
        if (!cancelled) setAuthors([]);
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
        lat: authorView ? undefined : cityConfig.api.defaultLat,
        lng: authorView ? undefined : cityConfig.api.defaultLng,
        radius: authorView ? undefined : radius,
        lang,
        author_id: authorId
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
  }, [authorId, authorView, initialPointId, lang, radius, reloadKey]);

  const pointsWithAuthors = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        author: point.authors?.find(author => author.id === authorId) ?? point.author ?? point.authors?.[0] ?? authors.find((author) => author.id === point.author_id)
      })),
    [authorId, authors, points]
  );
  const neighborhoods = useMemo(
    () => Array.from(new Set(pointsWithAuthors.map((point) => point.neighborhood).filter(Boolean))),
    [pointsWithAuthors]
  );

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
        <div className="filter-panel">
          <label>
            <Filter size={15} />
            {t(lang, 'filters')}
          </label>
          <select aria-label={t(lang, 'authors')} value={authorId} onChange={(event) => {
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
          {!loading && !error && pointsWithAuthors.length === 0 ? <EmptyState message={t(lang, 'empty')} /> : null}
          {loading ? <EmptyState message="A carregar..." /> : null}
          {pointsWithAuthors.map((point) => (
            <button
              key={point.id}
              type="button"
              className={selectedPoint?.id === point.id ? 'point-row active' : 'point-row'}
              onClick={() => selectPoint(point)}
            >
              <LocateFixed size={16} />
              <span>
                <strong>{localized(point, 'title', lang)}</strong>
                <small>{point.author?.name}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="map-stage">
        <CityMap
          fitAll={authorView && !initialPointId}
          points={pointsWithAuthors}
          selected={selectedPoint}
          onSelect={selectPoint}
          selectedTextId={selectedTextId}
          onSelectText={selectText}
        />
        <PointSheet
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
