import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Lang, Point } from '../types';
import { PointSheet } from './PointSheet';
import { overlapCopy } from '../i18n/overlapCopy';

/** Only receives the clicked collision group, never the map's surrounding locations. */
export function OverlappingPointSheet({ points, lang, authorId, onClose, onUpdated }: {
  points: Point[]; lang: Lang; authorId: string; onClose: () => void; onUpdated: (point: Point) => void;
}) {
  const [details, setDetails] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setDetails([]); setIndex(0);
    Promise.all(points.map(point => api.getPoint(point.id, lang)))
      .then(results => { if (!cancelled) setDetails(results.map(result => result.data)); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [points, lang, reload]);

  const entries = details.flatMap<{ point: Point; textId?: string }>(point => {
    const texts = (point.texts ?? []).filter(text => !authorId || text.author_id === authorId || text.author?.id === authorId);
    if (authorId && !texts.length) return [];
    return texts.length ? texts.map(text => ({ point, textId: text.id })) : [{ point, textId: undefined }];
  });
  const active = entries[Math.min(index, entries.length - 1)];
  const copy = overlapCopy(lang, index, entries.length, entries.every(entry => Boolean(entry.textId)), points.length === 1);
  if (loading || error || !active) return <aside className="point-sheet" aria-label={copy.context}>
    <button className="icon-button close" type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
    {loading ? <p role="status">{copy.loading}</p> : error ? <><p role="alert">{copy.error}</p><button type="button" onClick={() => setReload(value => value + 1)}>{copy.retry}</button></> : <p>{copy.empty}</p>}
  </aside>;
  return <PointSheet point={active.point} lang={lang} selectedTextId={active.textId} onClose={onClose}
    onUpdated={updated => { setDetails(current => current.map(point => point.id === updated.id ? updated : point)); onUpdated(updated); }}
    navigation={entries.length > 1 ? <div className="overlap-navigation">
      <nav aria-label={copy.context}>
        <button type="button" aria-label={copy.previous} aria-disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}><ChevronLeft size={22} /></button>
        <div><strong role="status">{copy.count}</strong><small>{copy.context}</small></div>
        <button type="button" aria-label={copy.next} aria-disabled={index === entries.length - 1} onClick={() => setIndex(value => Math.min(entries.length - 1, value + 1))}><ChevronRight size={22} /></button>
      </nav>
      <details><summary>{copy.all} ({entries.length})</summary><ol>{entries.map((entry, position) => {
        const text = entry.point.texts?.find(item => item.id === entry.textId);
        return <li key={`${entry.point.id}:${entry.textId ?? ''}`}><button type="button" aria-current={position === index ? 'true' : undefined}
          onClick={() => setIndex(position)}>{position + 1}. {text?.author?.name ? `${text.author.name} · ` : ''}{text?.source_work ?? entry.point.title ?? entry.point.title_pt}</button></li>;
      })}</ol></details>
    </div> : null} />;
}
