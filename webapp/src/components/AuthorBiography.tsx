import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { t } from '../i18n/messages';
import type { Author, Lang } from '../types';

interface Props {
  authorId: string;
  authorName: string;
  lang: Lang;
  onClose: () => void;
}

export function AuthorBiography({ authorId, authorName, lang, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [author, setAuthor] = useState<Author | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setAuthor(null);
    api.getAuthor(authorId)
      .then(({ data }) => { if (!cancelled) setAuthor(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [authorId, retry]);

  return (
    <dialog ref={dialog} className="author-biography" aria-labelledby={titleId} onCancel={onClose}>
      <header className="author-biography-header">
        <button type="button" autoFocus onClick={onClose}>
          <ArrowLeft size={18} aria-hidden="true" />{t(lang, 'backToPoint')}
        </button>
      </header>
      <div className="author-biography-content">
        <h2 id={titleId}>{author?.name || authorName || t(lang, 'authorProfile')}</h2>
        {author ? (
          <>
            {(author.birth_year || author.death_year) ? (
              <p className="author-biography-dates">
                {author.birth_year ?? '?'} – {author.death_year ?? '?'}
              </p>
            ) : null}
            {author.photo_url ? <img src={author.photo_url} alt="" /> : null}
            <p className="author-biography-language">{t(lang, 'biographyPortuguese')}</p>
            <p className="author-biography-text" lang={author.bio_pt ? 'pt' : lang}>{author.bio_pt || t(lang, 'biographyMissing')}</p>
          </>
        ) : error ? (
          <div role="alert">
            <p>{t(lang, 'biographyError')}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>{t(lang, 'retry')}</button>
          </div>
        ) : <p role="status">{t(lang, 'biographyLoading')}</p>}
      </div>
    </dialog>
  );
}
