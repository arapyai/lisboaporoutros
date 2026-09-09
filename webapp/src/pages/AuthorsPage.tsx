import { ArrowLeft, ArrowUpRight, ChevronRight, MapPin, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { authorHref, authorMapHref, searchAuthors } from '../authorDiscovery';
import { t } from '../i18n/messages';
import type { Author, Lang } from '../types';
import '../styles/authors.css';

interface Props {
  lang: Lang;
  selectedId?: string;
  query?: string;
  active?: boolean;
  onSearch?: (query: string) => void;
}

function lifespan(author: Author) {
  if (!author.birth_year && !author.death_year) return '';
  return `${author.birth_year ?? '?'}–${author.death_year ?? '?'}`;
}

export function AuthorsPage({ lang, selectedId, query = '', active = true, onSearch }: Props) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const previousSelection = useRef<string | undefined>(undefined);
  const savedScroll = useRef(0);
  const filtered = searchAuthors(authors, query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.getAuthors().then(({ data }) => { if (!cancelled) setAuthors(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (!active) return;
    if (selectedId) {
      previousSelection.current = selectedId;
      window.scrollTo(0, 0);
    } else if (previousSelection.current) {
      const link = list.current?.querySelector<HTMLAnchorElement>(`[data-author-id="${CSS.escape(previousSelection.current)}"]`);
      link?.focus({ preventScroll: true });
      window.scrollTo(0, savedScroll.current);
      previousSelection.current = undefined;
    }
  }, [selectedId, active]);

  return (
    <main className={`author-discovery ${selectedId ? 'has-selection' : ''}`}>
      <header className="author-discovery-heading"><h1>{t(lang, 'authors')}</h1><p>{t(lang, 'authorsIntroduction')}</p></header>
      <div className="author-discovery-layout">
        <section className="author-directory" aria-label={t(lang, 'authors')}>
          <div className="author-search">
            <Search size={19} aria-hidden="true" />
            <input type="search" aria-label={t(lang, 'searchAuthor')} placeholder={t(lang, 'searchAuthor')} value={query} onChange={(event) => onSearch?.(event.target.value)} />
            {query ? <button type="button" aria-label={t(lang, 'clearSearch')} onClick={() => onSearch?.('')}><X size={18} /></button> : null}
          </div>
          <p className="author-result-count" role="status">{loading ? t(lang, 'authorsLoading') : `${filtered.length} ${t(lang, filtered.length === 1 ? 'authorSingular' : 'authors').toLocaleLowerCase()}`}</p>
          <div className="author-directory-list" ref={list}>
            {error ? <div role="alert"><p>{t(lang, 'authorsError')}</p><button className="author-secondary-action" onClick={() => setReloadKey(value => value + 1)}>{t(lang, 'retry')}</button></div> : null}
            {!loading && !error && filtered.length === 0 ? <p className="author-no-results">{query ? t(lang, 'authorsNoResults') : t(lang, 'empty')}</p> : null}
            {filtered.map(author => (
              <a className={`author-directory-row ${selectedId === author.id ? 'selected' : ''}`} href={authorHref(author.id, query)} key={author.id} data-author-id={author.id} aria-label={`${t(lang, 'readBiographyShort')}: ${author.name}`} aria-current={selectedId === author.id ? 'true' : undefined} onClick={() => { savedScroll.current = window.scrollY; }}>
                {author.photo_url ? <img src={author.photo_url} alt="" loading="lazy" /> : null}
                <div className="author-row-copy">
                  <h2>{author.name}</h2>
                  <small>{lifespan(author)}{lifespan(author) ? ' · ' : ''}{author.points_count ?? 0} {t(lang, author.points_count === 1 ? 'place' : 'places')}</small>
                  <p lang={author.bio_pt ? 'pt' : lang}>{author.bio_pt || t(lang, 'biographyMissing')}</p>
                  <span className="author-row-action">{t(lang, 'readBiographyShort')}</span>
                </div>
                <ChevronRight size={18} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
        <section className="author-reading" key={selectedId ?? 'empty'} aria-label={t(lang, 'authorProfile')}>
          {selectedId ? <AuthorProfile key={selectedId} id={selectedId} lang={lang} query={query} active={active} /> : (
            <div className="author-reading-empty"><h2>{t(lang, 'chooseAuthor')}</h2><p>{t(lang, 'chooseAuthorDescription')}</p></div>
          )}
        </section>
      </div>
    </main>
  );
}

function AuthorProfile({ id, lang, query, active }: { id: string; lang: Lang; query: string; active: boolean }) {
  const [author, setAuthor] = useState<Author | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    api.getAuthor(id).then(({ data }) => { if (!cancelled) setAuthor(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [id, retry]);
  useEffect(() => {
    if (active && (author || error)) heading.current?.focus({ preventScroll: true });
  }, [active, author, error]);
  const points = [...(author?.points ?? [])].sort((a,b) => a.title_pt.localeCompare(b.title_pt, 'pt'));
  return (
    <article className="author-profile">
      <a href={authorHref(undefined, query)} className="author-back"><ArrowLeft size={18} />{t(lang, 'allAuthors')}</a>
      <h2 ref={heading} tabIndex={-1}>{author?.name ?? t(lang, 'authorProfile')}</h2>
      {error ? <div role="alert"><p>{t(lang, 'biographyError')}</p><button className="author-secondary-action" onClick={() => setRetry(value => value + 1)}>{t(lang, 'retry')}</button></div> : !author ? <p role="status">{t(lang, 'biographyLoading')}</p> : <>
        {lifespan(author) ? <p className="author-profile-years">{lifespan(author)}</p> : null}
        {author.photo_url ? <img className="author-profile-photo" src={author.photo_url} alt="" /> : null}
        <p className="author-profile-language">{t(lang, 'biographyPortuguese')}</p>
        <p className="author-profile-biography" lang={author.bio_pt ? 'pt' : lang}>{author.bio_pt || t(lang, 'biographyMissing')}</p>
        {points.length > 0 ? <a className="author-map-action" href={authorMapHref(id, undefined, query)}>{t(lang, 'viewAuthorPlaces')}<ArrowUpRight size={18} /></a> : null}
        <section className="author-places">
          <h3>{t(lang, 'placesInLisbon')} <span>{points.length}</span></h3>
          {points.length === 0 ? <p>{t(lang, 'authorNoPlaces')}</p> : <ul>{points.map(point => <li key={point.id}>
            <a href={authorMapHref(id, point.id, query)}><MapPin size={18} aria-hidden="true" /><span>{point.title_pt}</span><ChevronRight size={18} aria-hidden="true" /></a>
          </li>)}</ul>}
        </section>
      </>}
    </article>
  );
}
