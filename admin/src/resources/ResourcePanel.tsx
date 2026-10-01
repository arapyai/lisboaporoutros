import type { AdminAuthor, AdminPoint, AdminPointType, AdminText, AdminTranslation, AdminAudioFile, AdminVoice, AdminLanguage } from '@ecosdelisboa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { fallbackUnlessAuth, redirectIfAuthError } from '../adminApi';
import { adminFailureMessage } from '../adminErrorMessages';
import { ENABLE_MOCKS, autoSyncQueryOptions, client } from '../adminConfig';
import { fallbackFor, fallbackLanguages, mockAudioFiles, mockAuthors, mockPoints, mockPointTypes, mockTranslations } from '../adminMocks';
import { TextFilters, filterResourceItems } from '../texts/TextFilters';
import { normalizeSearch } from '../texts/textListModel';
import { TextVersionsEditor } from '../texts/TextVersionsEditor';
import { ResourceFields } from './ResourceFields';
import { PointTranslationsEditor } from '../points/PointTranslationsEditor';
import { confirmAdminNavigation, useUnsavedChanges } from '../unsavedChanges';
import { itemContextFromHash, itemContextHash } from '../adminNavigation';
import { columnsFor, draftFromItem, emptyDraft, formatCell, serializeDraft } from './resourceModel';
import type { Draft, FieldContext, Resource, ResourceItem } from '../adminTypes';
import { useLocalDraft } from '../useLocalDraft';
import { validateResourceDraft } from '../resourceDraftSchema';
import { LocalDraftRecovery } from '../components/LocalDraftRecovery';
import { defaultPointType } from './pointTypeSelection';
import { clearRecordLocalDrafts } from '../localDraftStore';

export const resourceLabels: Record<Resource, string> = {
  authors: 'Autores', 'point-types': 'Tipos de ponto', points: 'Pontos', texts: 'Textos', routes: 'Percursos'
};

export function ResourcePanel({
  hash,
  navigateHash,
  token,
  userId,
  resource,
  onAuthExpired
}: {
  hash: string;
  navigateHash: (hash: string, options?: { guard?: boolean; replace?: boolean }) => boolean;
  token: string;
  userId: string;
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
  const context = itemContextFromHash(hash);
  const pointTypeFilter = context.pointType;
  const pointTranslationStatus = context.status;
  const contextHash = (id?: string, language?: string) => itemContextHash(resource, { ...context, id, language });
  const setPointTypeFilter = (pointType: string) => navigateHash(itemContextHash(resource, { ...context, pointType }), { guard: false, replace: true });
  const setPointTranslationStatus = (status: string) => navigateHash(itemContextHash(resource, { ...context, status }), { guard: false, replace: true });

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
    ...autoSyncQueryOptions,
    retry: false
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
    ...autoSyncQueryOptions,
    enabled: resource === 'texts'
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
    ...autoSyncQueryOptions,
    enabled: resource === 'texts'
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
    ...autoSyncQueryOptions,
    enabled: resource === 'points'
  });

  const baseline = editing ? draftFromItem(resource, editing) : emptyDraft(resource);
  if (!editing && resource === 'points' && draft.point_type_id) {
    const defaultType = defaultPointType(pointTypesQuery.data ?? []);
    if (draft.point_type_id === defaultType?.id) baseline.point_type_id = defaultType.id;
  }

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
  const missingItem = Boolean(context.id && query.isSuccess && !items.some(item => item.id === context.id));
  // A query response is not yet an initialized editor. Do not accept input between
  // its render and the effect that installs the selected record's draft.
  const awaitingSelectedItem = Boolean(context.id && editing?.id !== context.id);
  const remoteItem = items.find(item => item.id === context.id);
  function focusEditorFields() {
    window.requestAnimationFrame(() => editorRef.current?.querySelector<HTMLElement>(
      '.resource-editing-fields input:not(:disabled), .resource-editing-fields select:not(:disabled), .resource-editing-fields textarea:not(:disabled)'
    )?.focus({ preventScroll: true }));
  }
  const recovery = useLocalDraft({
    identity: { userId, entity: resource, id: context.id ?? 'new', language: 'pt' },
    baseline, remoteBaseline: remoteItem ? draftFromItem(resource, remoteItem) : baseline, value: draft,
    ready: ['authors', 'points', 'point-types'].includes(resource) && Boolean(query.data) && !awaitingSelectedItem && !missingItem,
    validate: value => validateResourceDraft(resource, value),
    onRestore: value => { setDraft(value); focusEditorFields(); }
  });
  const recoveryPending = Boolean(recovery.candidate || recovery.inspecting);
  useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(baseline) || Boolean(recovery.candidate), false, recovery.clear);
  useEffect(() => {
    if (context.id) {
      const item = items.find(item => item.id === context.id);
      if (!item) {
        if (query.isSuccess && editing?.id !== context.id) {
          setEditing(null); setDraft(emptyDraft(resource));
        }
        return;
      }
      if (editing?.id === item.id) return;
      setEditing(item);
      setDraft(draftFromItem(resource, item));
      setEditorMessage('');
      window.requestAnimationFrame(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        editorHeadingRef.current?.focus({ preventScroll: true });
      });
    } else if (editing) {
      setEditing(null);
      setDraft(emptyDraft(resource));
    }
  }, [hash, query.data, resource]);
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
    const search = normalizeSearch(context.search);
    return filtered.filter((item) => {
      if (search && !normalizeSearch(columnsFor(resource).map(column => formatCell(item, column, { translations, audios, sourceLanguage })).join(' ')).includes(search)) return false;
      if (resource !== 'points') return true;
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
    translations,
    context.search
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
      recovery.clear();
      const savedItem = editing ? ({ ...editing, ...saved, id: editing.id } as ResourceItem) : saved;
      queryClient.setQueryData<ResourceItem[]>(['admin-resource', resource, token], (current) => {
        const list = current ?? (ENABLE_MOCKS ? fallbackFor(resource) : []);
        if (editing) return list.map((item) => (item.id === editing.id ? savedItem : item));
        return [savedItem, ...list];
      });
      syncRelationshipOptions(savedItem);
      invalidateRelatedQueries();
      if (resource === 'texts' || resource === 'points') {
        setEditorMessage('Alterações guardadas com sucesso.');
        setEditing(savedItem);
        setDraft(draftFromItem(resource, savedItem));
        navigateHash(contextHash(savedItem.id, context.language), { guard: false, replace: true });
        return;
      }
      setEditorMessage(`${editing ? 'Alterações guardadas' : 'Registo criado'} com sucesso.`);
      navigateHash(contextHash(), { guard: false, replace: true });
      setEditing(null);
      setDraft(emptyDraft(resource));
    },
    onError: (cause) => {
      redirectIfAuthError(cause, onAuthExpired);
      setEditorMessage(adminFailureMessage(cause, 'Não foi possível guardar. Reveja os campos e tente novamente.'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await client.delete<{ deleted: boolean }>(`/api/v1/admin/${resource}/${id}`, token);
      return id;
    },
    onSuccess: (id) => {
      setEditorMessage('Registo apagado.');
      if (resource === 'points') {
        try {
          clearRecordLocalDrafts(localStorage, { userId, entity: 'points', id });
          clearRecordLocalDrafts(localStorage, { userId, entity: 'point-translations', id });
        } catch {
          setEditorMessage('Registo apagado, mas não foi possível remover todas as cópias locais. Limpe os dados deste navegador em dispositivos partilhados.');
        }
      }
      if (editing?.id === id) {
        recovery.clear();
        navigateHash(contextHash(), { guard: false, replace: true });
        setEditing(null); setDraft(emptyDraft(resource));
      }
      queryClient.setQueryData<ResourceItem[]>(['admin-resource', resource, token], (current) =>
        (current ?? (ENABLE_MOCKS ? fallbackFor(resource) : [])).filter((item) => item.id !== id)
      );
      removeRelationshipOption(id);
      invalidateRelatedQueries();
    },
    onError: (cause) => {
      redirectIfAuthError(cause, onAuthExpired);
      setEditorMessage(adminFailureMessage(cause, 'Não foi possível apagar. O registo foi preservado; tente novamente.'));
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
    navigateHash(contextHash(item.id, context.language));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (recoveryPending) return;
    if (!confirmAdminNavigation({ allowDirty: true })) return;
    saveMutation.mutate(undefined);
  }

  return (
    <section className="content-panel">
      <div className="panel-heading">
        <div>
          <span>{resourceLabels[resource]}</span>
          <h2>{query.isPending ? 'A carregar…' : query.isError && !query.data ? 'Consulta indisponível' : `${metrics} registos`}</h2>
          {isLocal ? <p>Usando mocks locais por flag explícita de desenvolvimento.</p> : null}
        </div>
      </div>

      {query.isError && !isLocal ? (
        <div className="admin-state error-state">
          <p>Não foi possível carregar {resourceLabels[resource].toLowerCase()}.</p>
          <button type="button" onClick={() => query.refetch()}>Tentar novamente</button>
        </div>
      ) : null}

      {missingItem ? <p role="alert">O registo deste link não foi encontrado. <button type="button" onClick={() => navigateHash(contextHash())}>Voltar à lista</button></p> : null}

      {resource !== 'texts' ? <label className="resource-search">Buscar {resourceLabels[resource].toLowerCase()}
        <input type="search" value={context.search} placeholder="Nome, título ou descrição" onChange={event => navigateHash(itemContextHash(resource, { ...context, search: event.target.value }), { guard: false, replace: true })} />
      </label> : null}

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
              {(pointTypesQuery.data ?? (ENABLE_MOCKS ? mockPointTypes : [])).map((pointType) => (
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
        <LocalDraftRecovery savedAt={recovery.candidate?.savedAt} baseChanged={recovery.baseChanged}
          onRestore={recovery.restore} onDiscard={() => { recovery.clear(); focusEditorFields(); }}
          warning={recovery.warning} notice={recovery.notice} />
        {editorMessage ? (
          <p className={`editor-message ${saveMutation.isError || deleteMutation.isError ? 'error' : 'success'}`} role="status" aria-live="polite">
            {editorMessage}
          </p>
        ) : null}
        <fieldset className="resource-editing-fields" disabled={recoveryPending || (!query.data && !ENABLE_MOCKS) || awaitingSelectedItem || missingItem || saveMutation.isPending || deleteMutation.isPending}>
          <ResourceFields resource={resource} draft={draft} context={fieldContext} onDraft={setDraft} />
        </fieldset>
        {resource === 'texts' ? (
          <TextVersionsEditor
            key={editing?.id ?? 'new'}
            userId={userId}
            translationsReady={translationsQuery.data !== undefined}
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
            key={context.id ?? 'new'}
            userId={userId}
            initialLanguage={context.language}
            onLanguageChange={language => { navigateHash(contextHash(editing?.id, language), { guard: false }); }}
            point={awaitingSelectedItem || missingItem ? null : editing as AdminPoint | null}
            languages={languages}
            token={token}
            onAuthExpired={onAuthExpired}
          />
        ) : null}
        <div className="form-actions">
          <button type="submit" disabled={recoveryPending || (!query.data && !ENABLE_MOCKS) || awaitingSelectedItem || missingItem || saveMutation.isPending || deleteMutation.isPending}>
            {saveMutation.isPending ? 'A guardar…' : editing ? 'Guardar' : 'Criar'}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              if (!confirmAdminNavigation()) return;
              navigateHash(contextHash(), { guard: false });
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
                    <button type="button" className="danger" disabled={saveMutation.isPending || deleteMutation.isPending} onClick={() => {
                      if (!confirmAdminNavigation()) return;
                      if (window.confirm(`Apagar este registo de ${resourceLabels[resource].toLowerCase()}? Esta ação é permanente.`)) deleteMutation.mutate(item.id);
                    }}>
                      Apagar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {query.data && !filteredItems.length ? <tr><td colSpan={columnsFor(resource).length + 1}>{items.length ? 'Nenhum registo corresponde à busca ou aos filtros.' : 'Ainda não há registos.'}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
