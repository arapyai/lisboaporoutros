import type { AdminUser } from '@ecosdelisboa/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { isAuthError } from './adminApi';
import { client } from './adminConfig';
import { CsvPanel } from './csv/CsvPanel';
import { BatchJobTray } from './batches/BatchJobTray';
import { PronunciationPanel } from './pronunciation/PronunciationPanel';
import { TextsPanel } from './texts/TextsPanel';
import { UsersPanel } from './users/UsersPanel';
import { ResourcePanel } from './resources/ResourcePanel';
import { RouteEditor } from './routes/RouteEditor';
import { ReviewMapPanel } from './reviewMap/ReviewMapPanel';
import { confirmAdminNavigation } from './unsavedChanges';
import { sectionFromHash, sectionHash } from './adminNavigation';
import { useAdminLocation } from './useAdminLocation';
import type { Resource, Section } from './adminTypes';

const resourceLabels: Record<Resource, string> = {
  authors: 'Autores',
  'point-types': 'Tipos de ponto',
  points: 'Pontos',
  texts: 'Textos',
  routes: 'Percursos'
};

const sectionLabels: Record<Section, string> = {
  csv: 'CSV',
  authors: resourceLabels.authors,
  'point-types': resourceLabels['point-types'],
  points: resourceLabels.points,
  texts: resourceLabels.texts,
  routes: resourceLabels.routes,
  'review-map': 'Mapa de revisão',
  pronunciation: 'Pronúncias',
  users: 'Usuários',
};

const navigationGroups: Array<{ label: string; sections: Section[] }> = [
  { label: 'Conteúdo', sections: ['authors', 'points', 'texts', 'routes', 'review-map'] },
  { label: 'Operação', sections: ['csv'] },
  { label: 'Configuração', sections: ['point-types', 'pronunciation', 'users'] }
];




export function Dashboard({ token, onLogout, onAuthExpired }: {
  token: string; onLogout: () => void; onAuthExpired: () => void;
}) {
  const { hash, navigateHash } = useAdminLocation();
  const section = sectionFromHash(hash);
  const setSection = (next: Section) => navigateHash(sectionHash(next), { guard: false });
  const navigationRef = useRef<HTMLElement | null>(null);
  function navigate(next: Section) {
    if (next === section) return;
    navigateHash(sectionHash(next));
  }
  useEffect(() => {
    const nav = navigationRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const navBounds = nav.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    nav.scrollTo({ left: nav.scrollLeft + activeBounds.left - navBounds.left - nav.clientWidth / 2 + activeBounds.width / 2 });
  }, [section]);
  const [importedTextIds, setImportedTextIds] = useState<string[]>([]);
  const [reviewBatchId, setReviewBatchId] = useState<string>();
  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => client.get<AdminUser>('/api/v1/admin/auth/me', token),
    enabled: Boolean(token),
    retry: false
  });

  useEffect(() => {
    if (isAuthError(me.error)) onAuthExpired();
  }, [me.error, onAuthExpired]);

  if (!me.data) return <section className="content-panel">
    {me.isError ? <><p role="alert">Não foi possível validar o acesso ao administrativo.</p>
      <button type="button" onClick={() => { void me.refetch(); }}>Tentar novamente</button>
      <button type="button" onClick={onLogout}>Voltar ao login</button></>
      : <p role="status">A validar a sessão…</p>}
  </section>;

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="admin-brand">
          <img src="/branding/literary-map-icon.png" alt="" />
          <div>
            <span>Admin</span>
            <h1>Lisboa por Outros</h1>
          </div>
        </div>
        <p>{me.data?.email ?? 'Sessão autenticada'}</p>
        <nav aria-label="Seções" ref={navigationRef}>
          {navigationGroups.map(group => <div className="admin-nav-group" key={group.label}>
            <span className="admin-nav-label">{group.label}</span>
            {group.sections.map(key => (
              <button key={key} aria-current={section === key ? 'page' : undefined} className={section === key ? 'active' : ''} type="button" onClick={() => navigate(key)}>
                {sectionLabels[key]}
              </button>
            ))}
          </div>)}
        </nav>
        <button type="button" className="secondary-action" onClick={() => { if (confirmAdminNavigation()) onLogout(); }}>
          Sair
        </button>
      </aside>
      {section === 'csv' ? (
        <CsvPanel
          token={token}
          onAuthExpired={onAuthExpired}
          onGenerate={(textIds) => {
            if (!confirmAdminNavigation()) return;
            setImportedTextIds(textIds);
            setSection('texts');
          }}
        />
      ) : null}
      {section === 'pronunciation' ? (
        <PronunciationPanel token={token} onAuthExpired={onAuthExpired} />
      ) : null}
      {section === 'users' && me.data ? (
        <UsersPanel currentUser={me.data} token={token} onAuthExpired={onAuthExpired} />
      ) : null}
      {section === 'texts' ? (
        <TextsPanel
          userId={me.data.id}
          hash={hash}
          navigateHash={navigateHash}
          token={token}
          onAuthExpired={onAuthExpired}
          importedTextIds={importedTextIds}
          reviewBatchId={reviewBatchId}
          onImportedTextIdsConsumed={() => setImportedTextIds([])}
        />
      ) : null}
      {section === 'routes' && me.data ? (
        <RouteEditor hash={hash} navigateHash={navigateHash} token={token} userId={me.data.id} onAuthExpired={onAuthExpired} />
      ) : null}
      {section === 'review-map' ? (
        <ReviewMapPanel token={token} onAuthExpired={onAuthExpired} />
      ) : null}
      {section !== 'csv' && section !== 'pronunciation' && section !== 'users' && section !== 'texts' && section !== 'routes' && section !== 'review-map' ? (
        <ResourcePanel key={section} hash={hash} navigateHash={navigateHash} token={token} userId={me.data.id} resource={section} onAuthExpired={onAuthExpired} />
      ) : null}
      <BatchJobTray
        token={token}
        onAuthExpired={onAuthExpired}
        onReview={(batch) => {
          if (!confirmAdminNavigation()) return;
          const isPointBatch = batch.source === 'points' || batch.source === 'point-csv';
          setReviewBatchId(isPointBatch ? undefined : batch.id);
          setSection(isPointBatch ? 'points' : 'texts');
        }}
      />
    </main>
  );
}
