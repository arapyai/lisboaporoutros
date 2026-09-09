import { BookOpen, Map, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { authorHref, readAuthorNavigation } from './authorDiscovery';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { cityConfig } from './config/city';
import { t } from './i18n/messages';
import { getStoredLanguage, hasOnboarded, storeLanguage, storeOnboarded } from './lib/storage';
import { AuthorsPage } from './pages/AuthorsPage';
import { MapPage } from './pages/MapPage';
import { Onboarding } from './pages/Onboarding';
import { RoutesPage } from './pages/RoutesPage';
import type { Lang } from './types';

export function App() {
  const [lang, setLang] = useState<Lang>(getStoredLanguage);
  const [onboarded, setOnboarded] = useState(hasOnboarded);
  const [navigation, setNavigation] = useState(() => readAuthorNavigation(location.hash));
  const tab = navigation.tab;
  useEffect(() => {
    const update = () => setNavigation(readAuthorNavigation(location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  function searchAuthors(query: string) {
    const hash = authorHref(undefined, query);
    history.replaceState(null, '', hash);
    setNavigation(readAuthorNavigation(hash));
  }
  useEffect(() => {
    const header = document.querySelector('.topbar');
    if (!header) return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--app-header-height', `${header.getBoundingClientRect().height}px`);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [onboarded]);

  function changeLanguage(next: Lang) {
    setLang(next);
    storeLanguage(next);
    document.documentElement.lang = next;
  }

  function finishOnboarding() {
    storeOnboarded();
    setOnboarded(true);
  }

  if (!onboarded) {
    return <Onboarding lang={lang} onLanguage={changeLanguage} onDone={finishOnboarding} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="wordmark">
          <img src="/branding/literary-map-icon.png" alt="" />
          <div>
            <strong>{cityConfig.appName}</strong>
            <span>{t(lang, 'tagline')}</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main">
          <button type="button" className={tab === 'map' ? 'active' : ''} onClick={() => { location.hash = '/map'; }}>
            <Map size={17} />
            {t(lang, 'map')}
          </button>
          <button type="button" className={tab === 'routes' ? 'active' : ''} onClick={() => { location.hash = '/routes'; }}>
            <BookOpen size={17} />
            {t(lang, 'routes')}
          </button>
          <button type="button" className={tab === 'authors' ? 'active' : ''} onClick={() => { location.hash = '/authors'; }}>
            <Users size={17} />
            {t(lang, 'authors')}
          </button>
        </nav>
        <LanguageSwitcher value={lang} onChange={changeLanguage} compact />
      </header>
      {tab === 'map' ? <MapPage key={`${navigation.authorId ?? ''}:${navigation.pointId ?? ''}`} lang={lang} initialAuthorId={navigation.authorId} initialPointId={navigation.pointId} authorQuery={navigation.query} /> : null}
      {tab === 'routes' ? <RoutesPage lang={lang} /> : null}
      <div hidden={tab !== 'authors'}><AuthorsPage lang={lang} active={tab === 'authors'} selectedId={tab === 'authors' ? navigation.authorId : undefined} query={navigation.query} onSearch={searchAuthors} /></div>
    </div>
  );
}
