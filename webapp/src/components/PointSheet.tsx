import { MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client';
import { contentLanguageNotice, localized, t } from '../i18n/messages';
import type { Lang, Point } from '../types';
import { AudioPlayer } from './AudioPlayer';
import { AuthorBiography } from './AuthorBiography';
import { pointTextAuthor } from '../pointAuthor';
import { PointTypeIcon } from './PointTypeIcon';

interface Props {
  point: Point | null;
  lang: Lang;
  onClose: () => void;
  selectedTextId?: string | null;
}

export function PointSheet({ point, lang, onClose, selectedTextId }: Props) {
  if (!point) return null;
  return <PointSheetContent key={`${point.id}:${selectedTextId ?? ''}`} point={point} lang={lang} onClose={onClose} selectedTextId={selectedTextId} />;
}

function PointSheetContent({ point, lang, onClose, selectedTextId }: Props & { point: Point }) {
  const [biographyOpen, setBiographyOpen] = useState(false);

  const text = selectedTextId
    ? point.texts?.find((t) => t.id === selectedTextId) || point.texts?.[0]
    : point.texts?.[0];

  const author = pointTextAuthor(point, text);
  const authorName = author ? author.name : text?.author?.name;
  const availableAudios = text?.audios?.filter((item) => item.url) ?? [];
  const audio = availableAudios.find((item) => item.lang === lang);
  const contentStatus = text?.is_fallback
    ? 'fallback'
    : text?.is_translation
      ? 'translated'
      : 'original';

  const title = point.title ?? localized(point, 'title', lang);

  return (
    <aside className="point-sheet" aria-label={title}>
      <button type="button" className="icon-button close" onClick={onClose} aria-label="Close">
        <X size={18} />
      </button>
      <div className="point-type-badge">
        <span className="point-type-badge-icon" style={{ color: point.point_type.color }} aria-hidden="true">
          <PointTypeIcon iconKey={point.point_type.icon_key} size={16} />
        </span>
        {point.point_type.name_pt}
      </div>
      <div className="sheet-kicker">
        <MapPin size={15} />
        {[point.neighborhood, point.address].filter(Boolean).join(' · ')}
      </div>
      <h2>{title}</h2>
      {point.description ? <p className="point-description">{point.description}</p> : null}
      {authorName ? <p className="byline">{authorName}</p> : null}
      {author ? (
        <button type="button" className="author-biography-link" onClick={() => setBiographyOpen(true)} aria-haspopup="dialog">
          {t(lang, 'readBiography')}
        </button>
      ) : null}
      {biographyOpen && author ? (
        <AuthorBiography authorId={author.id} authorName={author.name} lang={lang} onClose={() => setBiographyOpen(false)} />
      ) : null}
      {text ? <AudioPlayer track={audio} label={t(lang, 'listen')} unavailableLabel={t(lang, 'audioUnavailable')} /> : null}
      {text ? (
        <div className="text-block">
          <span>{t(lang, 'transcript')}</span>
          <p className={`content-language-status ${contentStatus}`} role="status">
            {contentLanguageNotice(lang, contentStatus)}
          </p>
          <p>{text.content ?? localized(text, 'content', lang)}</p>
          <small>
            {t(lang, 'source')}: {text.source_work}
            {text.source_year ? `, ${text.source_year}` : ''}
          </small>
        </div>
      ) : null}
      {text ? <div className="sheet-actions">
        <a href={api.getRoutePodcastUrl(point.id, lang)} aria-label="Podcast RSS">
          RSS
        </a>
      </div> : null}
    </aside>
  );
}
