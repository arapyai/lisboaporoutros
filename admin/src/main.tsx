import {
  type AdminAudioFile,
  type AdminAuthor,
  type AdminLanguage,
  type AdminLoginResponse,
  type AdminPoint,
  type AdminPointType,
  type AdminRoute,
  type AdminText,
  type AdminTranslation,
  type AdminUser,
  type AdminVoice,
} from '@ecosdelisboa/shared';
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import { fallbackUnlessAuth, isAuthError, redirectIfAuthError } from './adminApi';
import {
  ENABLE_MOCKS,
  TOKEN_KEY,
  autoSyncQueryOptions,
  client,
  queryClient
} from './adminConfig';
import { fallbackFor, fallbackLanguages, mockAudioFiles, mockAuthors, mockPoints, mockPointTypes, mockTexts, mockTranslations } from './adminMocks';
import { CsvPanel } from './csv/CsvPanel';
import { BatchJobTray } from './batches/BatchJobTray';
import { PronunciationPanel } from './pronunciation/PronunciationPanel';
import { TextFilters, filterResourceItems } from './texts/TextFilters';
import { TextVersionsEditor } from './texts/TextVersionsEditor';
import { TextsPanel } from './texts/TextsPanel';
import { UsersPanel } from './users/UsersPanel';
import { ResourceFields } from './resources/ResourceFields';
import { PointTranslationsEditor } from './points/PointTranslationsEditor';
import { RouteEditor } from './routes/RouteEditor';
import { ReviewMapPanel } from './reviewMap/ReviewMapPanel';
import { confirmAdminNavigation, useUnsavedChanges } from './unsavedChanges';
import { PasswordRecovery } from './auth/PasswordRecovery';
import { sectionFromHash, sectionHash } from './adminNavigation';
import { useAdminLocation } from './useAdminLocation';
import { columnsFor, draftFromItem, emptyDraft, formatCell, serializeDraft } from './resources/resourceModel';
import type {
  Draft,
  FieldContext,
  Resource,
  ResourceItem,
  Section
} from './adminTypes';

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




function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [recoveryToken, setRecoveryToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('reset-password') ?? '');
  useEffect(() => {
    const readRecoveryLink = () => setRecoveryToken(new URLSearchParams(location.hash.slice(1)).get('reset-password') ?? '');
    window.addEventListener('hashchange', readRecoveryLink);
    return () => window.removeEventListener('hashchange', readRecoveryLink);
  }, []);

  function onLogin(nextToken: string) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    queryClient.clear();
    setToken('');
  }

  if (recoveryToken) return <PasswordRecovery token={recoveryToken} onBack={() => { logout(); setRecoveryToken(''); }} />;
  return token ? (
    <Dashboard token={token} onLogout={logout} />
  ) : (
    <Login onLogin={onLogin} />
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      client.post<AdminLoginResponse>('/api/v1/admin/auth/login', {
        email,
        password
      }),
    onSuccess: (data) => onLogin(data.access_token),
    onError: (cause) => setError(isAuthError(cause) ? 'E-mail ou senha incorretos.' : 'Problema ao entrar. Verifique a conexão e tente novamente.')
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    mutation.mutate();
  }

  if (recovering) return <PasswordRecovery onBack={() => setRecovering(false)} />;
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="admin-brand">
          <img src="/branding/literary-map-icon.png" alt="" />
          <div>
            <span>Administração</span>
            <h1>Lisboa por Outros</h1>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'A entrar...' : 'Entrar'}
          </button>
          <button type="button" className="secondary-action" onClick={() => setRecovering(true)}>Esqueci a senha</button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
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
    if (isAuthError(me.error)) onLogout();
  }, [me.error, onLogout]);

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
          onAuthExpired={onLogout}
          onGenerate={(textIds) => {
            if (!confirmAdminNavigation()) return;
            setImportedTextIds(textIds);
            setSection('texts');
          }}
        />
      ) : null}
      {section === 'pronunciation' ? (
        <PronunciationPanel token={token} onAuthExpired={onLogout} />
      ) : null}
      {section === 'users' && me.data ? (
        <UsersPanel currentUser={me.data} token={token} onAuthExpired={onLogout} />
      ) : null}
      {section === 'texts' ? (
        <TextsPanel
          hash={hash}
          navigateHash={navigateHash}
          token={token}
          onAuthExpired={onLogout}
          importedTextIds={importedTextIds}
          reviewBatchId={reviewBatchId}
          onImportedTextIdsConsumed={() => setImportedTextIds([])}
        />
      ) : null}
      {section === 'routes' && me.data ? (
        <RouteEditor token={token} userId={me.data.id} onAuthExpired={onLogout} />
      ) : null}
      {section === 'review-map' ? (
        <ReviewMapPanel token={token} onAuthExpired={onLogout} />
      ) : null}
      {section !== 'csv' && section !== 'pronunciation' && section !== 'users' && section !== 'texts' && section !== 'routes' && section !== 'review-map' ? (
        <ResourcePanel key={section} token={token} resource={section} onAuthExpired={onLogout} />
      ) : null}
      <BatchJobTray
        token={token}
        onAuthExpired={onLogout}
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

function ResourcePanel({
  token,
  resource,
  onAuthExpired
}: {
  token: string;
  resource: Resource;
  onAuthExpired: () => void;
}) {
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLFormElement | null>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(resource));
  const [editorMessage, setEditorMessage] = useState('');
  const [isLocal, setIsLocal] = useState(false);
  const [textSearch, setTextSearch] = useState('');
  const [textLanguage, setTextLanguage] = useState('');
  const [textStatus, setTextStatus] = useState('');
  const [textOrigin, setTextOrigin] = useState('');
  const [textAudio, setTextAudio] = useState('');
  const [textGap, setTextGap] = useState('');
  const [pointTypeFilter, setPointTypeFilter] = useState('');
  const [pointTranslationStatus, setPointTranslationStatus] = useState('');

  useEffect(() => {
    setEditing(null);
    setDraft(emptyDraft(resource));
    setEditorMessage('');
    setIsLocal(false);
    setTextSearch('');
    setTextLanguage('');
    setTextStatus('');
    setTextOrigin('');
    setTextAudio('');
    setTextGap('');
    setPointTypeFilter('');
    setPointTranslationStatus('');
  }, [resource]);

  const query = useQuery({
    queryKey: ['admin-resource', resource, token],
    queryFn: async () => {
      try {
        setIsLocal(false);
        return await client.get<ResourceItem[]>(`/api/v1/admin/${resource}`, token);
      } catch (cause) {
        fallbackUnlessAuth(cause, null, onAuthExpired);
        setIsLocal(true);
        return fallbackFor(resource);
      }
    },
    ...autoSyncQueryOptions
  });

  const authorsQuery = useQuery({
    queryKey: ['admin-options', 'authors', token],
    queryFn: async () => {
      try {
        return await client.get<AdminAuthor[]>('/api/v1/admin/authors', token);
      } catch (cause) {
        return fallbackUnlessAuth(cause, mockAuthors, onAuthExpired);
      }
    },
    ...autoSyncQueryOptions
  });

  const pointsQuery = useQuery({
    queryKey: ['admin-options', 'points', token],
    queryFn: async () => {
      try {
        return await client.get<AdminPoint[]>('/api/v1/admin/points', token);
      } catch (cause) {
        return fallbackUnlessAuth(cause, mockPoints, onAuthExpired);
      }
    },
    ...autoSyncQueryOptions
  });

  const pointTypesQuery = useQuery({
    queryKey: ['admin-options', 'point-types', token],
    queryFn: async () => {
      try {
        return await client.get<AdminPointType[]>('/api/v1/admin/point-types', token);
      } catch (cause) {
        return fallbackUnlessAuth(cause, mockPointTypes, onAuthExpired);
      }
    },
    ...autoSyncQueryOptions
  });

  const baseline = editing ? draftFromItem(resource, editing) : emptyDraft(resource);
  if (!editing && resource === 'points' && draft.point_type_id) {
    const defaultType = pointTypesQuery.data?.find(item => item.slug === 'literary')
      ?? pointTypesQuery.data?.find(item => item.is_active);
    if (draft.point_type_id === defaultType?.id) baseline.point_type_id = defaultType.id;
  }
  useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(baseline));

  const languagesQuery = useQuery({
    queryKey: ['admin-languages', token],
    queryFn: async () =>
      client
        .get<AdminLanguage[]>('/api/v1/admin/languages?active=true', token)
        .catch((cause) => fallbackUnlessAuth(cause, fallbackLanguages, onAuthExpired)),
    enabled: resource === 'texts' || resource === 'points',
    ...autoSyncQueryOptions
  });

  const translationsQuery = useQuery({
    queryKey: ['admin-translations', token],
    queryFn: async () =>
      client
        .get<AdminTranslation[]>('/api/v1/admin/translations', token)
        .catch((cause) => fallbackUnlessAuth(cause, mockTranslations, onAuthExpired)),
    enabled: resource === 'texts',
    ...autoSyncQueryOptions
  });

  const voicesQuery = useQuery({
    queryKey: ['admin-voices', token],
    queryFn: async () =>
      client
        .get<AdminVoice[]>('/api/v1/admin/voices', token)
        .catch((cause) => fallbackUnlessAuth(cause, [], onAuthExpired)),
    enabled: resource === 'texts',
    ...autoSyncQueryOptions
  });

  const audioQuery = useQuery({
    queryKey: ['admin-audio', token],
    queryFn: async () =>
      client
        .get<AdminAudioFile[]>('/api/v1/admin/audio', token)
        .catch((cause) => fallbackUnlessAuth(cause, mockAudioFiles, onAuthExpired)),
    enabled: resource === 'texts',
    ...autoSyncQueryOptions
  });

  const items = query.data ?? (ENABLE_MOCKS ? fallbackFor(resource) : []);
  const languages = languagesQuery.data ?? (ENABLE_MOCKS ? fallbackLanguages : []);
  const translations = translationsQuery.data ?? (ENABLE_MOCKS ? mockTranslations : []);
  const voices = voicesQuery.data ?? [];
  const audios = audioQuery.data ?? (ENABLE_MOCKS ? mockAudioFiles : []);
  const sourceLanguage = languages.find((language) => language.is_source)?.code ?? 'pt';
  const filteredItems = useMemo(() => {
    const filtered = filterResourceItems(resource, items, {
        textSearch,
        textLanguage,
        textStatus,
        textOrigin,
        textAudio,
        textGap,
        translations,
        audios,
        sourceLanguage
      });
    if (resource !== 'points') return filtered;
    return filtered.filter((item) => {
      const point = item as AdminPoint;
      if (pointTypeFilter && point.point_type?.slug !== pointTypeFilter) return false;
      if (
        pointTranslationStatus
        && !(point.translations ?? []).some((translation) => translation.status === pointTranslationStatus)
      ) return false;
      return true;
    });
  }, [
    audios,
    items,
    pointTranslationStatus,
    pointTypeFilter,
    resource,
    sourceLanguage,
    textAudio,
    textGap,
    textLanguage,
    textOrigin,
    textSearch,
    textStatus,
    translations
  ]);
  const metrics = useMemo(() => filteredItems.length, [filteredItems.length]);
  const fieldContext = useMemo<FieldContext>(
    () => ({
      authors: authorsQuery.data ?? (ENABLE_MOCKS ? mockAuthors : []),
      authorsReady: Boolean(authorsQuery.data),
      points: pointsQuery.data ?? (ENABLE_MOCKS ? mockPoints : []),
      pointsReady: Boolean(pointsQuery.data),
      pointTypes: pointTypesQuery.data ?? (ENABLE_MOCKS ? mockPointTypes : []),
      pointTypesReady: Boolean(pointTypesQuery.data)
    }),
    [authorsQuery.data, pointTypesQuery.data, pointsQuery.data]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = serializeDraft(resource, draft);
      if (editing) {
        return client.put<ResourceItem>(`/api/v1/admin/${resource}/${editing.id}`, payload, token);
      }
      return client.post<ResourceItem>(`/api/v1/admin/${resource}`, payload, token);
    },
    onSuccess: (saved) => {
      const savedItem = editing ? ({ ...editing, ...saved, id: editing.id } as ResourceItem) : saved;
      queryClient.setQueryData<ResourceItem[]>(['admin-resource', resource, token], (current) => {
        const list = current ?? (ENABLE_MOCKS ? fallbackFor(resource) : []);
        if (editing) return list.map((item) => (item.id === editing.id ? savedItem : item));
        return [savedItem, ...list];
      });
      syncRelationshipOptions(savedItem);
      invalidateRelatedQueries();
      if (resource === 'texts') {
        setEditorMessage('Alterações guardadas com sucesso.');
        setEditing(savedItem);
        setDraft(draftFromItem(resource, savedItem));
        return;
      }
      setEditorMessage(`${editing ? 'Alterações guardadas' : 'Registo criado'} com sucesso.`);
      setEditing(null);
      setDraft(emptyDraft(resource));
    },
    onError: (cause) => {
      redirectIfAuthError(cause, onAuthExpired);
      setEditorMessage('Não foi possível guardar. Reveja os campos e tente novamente.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete<{ deleted: boolean }>(`/api/v1/admin/${resource}/${id}`, token);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<ResourceItem[]>(['admin-resource', resource, token], (current) =>
        (current ?? (ENABLE_MOCKS ? fallbackFor(resource) : [])).filter((item) => item.id !== id)
      );
      removeRelationshipOption(id);
      invalidateRelatedQueries();
    },
    onError: (cause) => {
      redirectIfAuthError(cause, onAuthExpired);
    }
  });

  useUnsavedChanges(false, saveMutation.isPending || deleteMutation.isPending);

  function syncRelationshipOptions(saved: ResourceItem) {
    if (resource !== 'authors' && resource !== 'points' && resource !== 'point-types') return;
    queryClient.setQueryData<ResourceItem[]>(['admin-options', resource, token], (current) => {
      const list = current ?? (ENABLE_MOCKS ? fallbackFor(resource) : []);
      if (editing) return list.map((item) => (item.id === editing.id ? { ...item, ...saved, id: editing.id } : item));
      return [{ ...saved, id: saved.id ?? `local-${Date.now()}` }, ...list];
    });
  }

  function removeRelationshipOption(id: string) {
    if (resource !== 'authors' && resource !== 'points' && resource !== 'point-types') return;
    queryClient.setQueryData<ResourceItem[]>(['admin-options', resource, token], (current) =>
      (current ?? (ENABLE_MOCKS ? fallbackFor(resource) : [])).filter((item) => item.id !== id)
    );
  }

  function invalidateRelatedQueries() {
    queryClient.invalidateQueries({ queryKey: ['admin-resource', resource, token] });
    if (resource === 'authors') {
      queryClient.invalidateQueries({ queryKey: ['admin-options', 'authors', token] });
      queryClient.invalidateQueries({ queryKey: ['admin-resource', 'texts', token] });
    }
    if (resource === 'points') {
      queryClient.invalidateQueries({ queryKey: ['admin-options', 'points', token] });
      queryClient.invalidateQueries({ queryKey: ['admin-resource', 'texts', token] });
      queryClient.invalidateQueries({ queryKey: ['admin-resource', 'routes', token] });
    }
    if (resource === 'point-types') {
      queryClient.invalidateQueries({ queryKey: ['admin-options', 'point-types', token] });
      queryClient.invalidateQueries({ queryKey: ['admin-resource', 'points', token] });
    }
  }

  function edit(item: ResourceItem) {
    if (!confirmAdminNavigation()) return;
    setEditorMessage('');
    setEditing(item);
    setDraft(draftFromItem(resource, item));
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      editorHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    saveMutation.mutate(undefined);
  }

  return (
    <section className="content-panel">
      <div className="panel-heading">
        <div>
          <span>{resourceLabels[resource]}</span>
          <h2>{metrics} registos</h2>
          {isLocal ? <p>Usando mocks locais por flag explícita de desenvolvimento.</p> : null}
        </div>
      </div>

      {query.isError && !isLocal ? (
        <div className="admin-state error-state">
          <p>Não foi possível carregar {resourceLabels[resource].toLowerCase()}.</p>
          <button type="button" onClick={() => query.refetch()}>Tentar novamente</button>
        </div>
      ) : null}

      {resource === 'texts' ? (
        <TextFilters
          languages={languages}
          language={textLanguage}
          audio={textAudio}
          gap={textGap}
          origin={textOrigin}
          search={textSearch}
          status={textStatus}
          onAudio={setTextAudio}
          onGap={setTextGap}
          onLanguage={setTextLanguage}
          onOrigin={setTextOrigin}
          onSearch={setTextSearch}
          onStatus={setTextStatus}
        />
      ) : null}

      {resource === 'points' ? (
        <div className="resource-filters" aria-label="Filtros de pontos">
          <label>
            Tipo
            <select value={pointTypeFilter} onChange={(event) => setPointTypeFilter(event.target.value)}>
              <option value="">Todos</option>
              {(pointTypesQuery.data ?? mockPointTypes).map((pointType) => (
                <option key={pointType.id} value={pointType.slug}>{pointType.name_pt}</option>
              ))}
            </select>
          </label>
          <label>
            Estado de tradução
            <select
              value={pointTranslationStatus}
              onChange={(event) => setPointTranslationStatus(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovada</option>
              <option value="rejected">Rejeitada</option>
            </select>
          </label>
        </div>
      ) : null}

      <form className="editor" onSubmit={submit} ref={editorRef} aria-busy={saveMutation.isPending}>
        <h3 ref={editorHeadingRef} tabIndex={-1}>{editing ? 'Editar' : 'Criar'} {resourceLabels[resource].toLowerCase()}</h3>
        {editorMessage ? (
          <p className={`editor-message ${saveMutation.isError ? 'error' : 'success'}`} role="status" aria-live="polite">
            {editorMessage}
          </p>
        ) : null}
        <fieldset className="resource-editing-fields" disabled={saveMutation.isPending || deleteMutation.isPending}>
          <ResourceFields resource={resource} draft={draft} context={fieldContext} onDraft={setDraft} />
        </fieldset>
        {resource === 'texts' ? (
          <TextVersionsEditor
            baseDraft={draft}
            languages={languages}
            text={editing as AdminText | null}
            token={token}
            translations={translations}
            audios={audios}
            voices={voices}
            audioLoading={audioQuery.isLoading}
            audioError={audioQuery.isError}
            onAuthExpired={onAuthExpired}
            onBaseDraft={setDraft}
            onTranslationsChanged={() => translationsQuery.refetch()}
            onAudiosChanged={() => audioQuery.refetch()}
          />
        ) : null}
        {resource === 'points' ? (
          <PointTranslationsEditor
            point={editing as AdminPoint | null}
            languages={languages}
            token={token}
            onAuthExpired={onAuthExpired}
          />
        ) : null}
        <div className="form-actions">
          <button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'A guardar…' : editing ? 'Guardar' : 'Criar'}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              if (!confirmAdminNavigation()) return;
              setEditing(null);
              setDraft(emptyDraft(resource));
              setEditorMessage('');
            }}
          >
            Limpar
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columnsFor(resource).map((column) => (
                <th key={column}>{column}</th>
              ))}
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                {columnsFor(resource).map((column) => (
                  <td key={column}>{formatCell(item, column, { translations, audios, sourceLanguage })}</td>
                ))}
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => edit(item)}>
                      Editar
                    </button>
                    <button type="button" className="danger" onClick={() => deleteMutation.mutate(item.id)}>
                      Apagar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}





createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AdminApp />
  </QueryClientProvider>
);
