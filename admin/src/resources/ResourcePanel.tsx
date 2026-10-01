import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { fallbackUnlessAuth, redirectIfAuthError } from '../adminApi';
import { adminFailureMessage } from '../adminErrorMessages';
import { ENABLE_MOCKS, autoSyncQueryOptions, client } from '../adminConfig';
import { fallbackFor } from '../adminMocks';
import { normalizeSearch } from '../texts/textListModel';
import { requestAdminNavigation, confirmAdminNavigation, useUnsavedChanges } from '../unsavedChanges';
import { itemContextFromHash, itemContextHash } from '../adminNavigation';
import { columnsFor, draftFromItem, emptyDraft, formatCell, serializeDraft } from './resourceModel';
import type { Draft, Resource, ResourceItem } from '../adminTypes';
import { useLocalDraft } from '../useLocalDraft';
import { validateResourceDraft } from '../resourceDraftSchema';
import { LocalDraftRecovery } from '../components/LocalDraftRecovery';

export const resourceLabels: Record<Resource, string> = {
  authors: 'Autores', 'point-types': 'Tipos de ponto', points: 'Pontos', texts: 'Textos', routes: 'Percursos'
};

export type BaseResource = 'authors' | 'points' | 'point-types';
export type ResourcePanelProps = {
  hash: string;
  navigateHash: (hash: string, options?: { guard?: boolean; replace?: boolean }) => boolean;
  token: string;
  userId: string;
  onAuthExpired: () => void;
};
type RelatedEditorContext = { item: ResourceItem | null; language?: string; onLanguageChange: (language: string) => void };

/** Shared editing lifecycle. Queries, filters and related editors belong to each domain. */
export function ResourcePanel({
  hash,
  navigateHash,
  token,
  userId,
  resource,
  onAuthExpired,
  renderFields,
  renderFilters,
  renderRelated,
  filterItem,
  defaultDraft,
  keepOpenAfterSave = false,
  afterDelete
}: ResourcePanelProps & {
  resource: BaseResource;
  renderFields: (draft: Draft, onDraft: (draft: Draft) => void) => ReactNode;
  renderFilters?: ReactNode;
  renderRelated?: (context: RelatedEditorContext) => ReactNode;
  filterItem?: (item: ResourceItem) => boolean;
  defaultDraft?: Partial<Draft>;
  keepOpenAfterSave?: boolean;
  afterDelete?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLFormElement | null>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [editing, setEditing] = useState<ResourceItem | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(resource));
  const [editorMessage, setEditorMessage] = useState('');
  const [isLocal, setIsLocal] = useState(false);
  const context = itemContextFromHash(hash);
  const contextHash = (id?: string, language?: string) => itemContextHash(resource, { ...context, id, language });

  useEffect(() => {
    setEditing(null);
    setDraft(emptyDraft(resource));
    setEditorMessage('');
    setIsLocal(false);
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

  const baseline = editing ? draftFromItem(resource, editing) : emptyDraft(resource);
  if (!editing) {
    for (const [field, value] of Object.entries(defaultDraft ?? {})) {
      if (value !== undefined && draft[field] === value) baseline[field] = value;
    }
  }

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
    ready: Boolean(query.data) && !awaitingSelectedItem && !missingItem,
    validate: value => validateResourceDraft(resource, value),
    onRestore: value => { setDraft(value); focusEditorFields(); }
  });
  const recoveryPending = Boolean(recovery.candidate || recovery.inspecting);
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
        // Initialization may finish after the person has already focused a field.
        // Never interrupt that input with a delayed heading focus.
        if (!editorRef.current?.isConnected || editorRef.current.contains(document.activeElement)) return;
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        editorHeadingRef.current?.focus({ preventScroll: true });
      });
    } else if (editing) {
      setEditing(null);
      setDraft(emptyDraft(resource));
    }
  }, [hash, query.data, resource]);
  const filteredItems = useMemo(() => {
    const search = normalizeSearch(context.search);
    return items.filter(item =>
      (!search || normalizeSearch(columnsFor(resource).map(column => formatCell(item, column)).join(' ')).includes(search))
      && (!filterItem || filterItem(item))
    );
  }, [items, context.search, resource, filterItem]);
  const metrics = filteredItems.length;

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
      if (keepOpenAfterSave) {
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
      try { afterDelete?.(id); }
      catch {
        setEditorMessage('Registo apagado, mas não foi possível remover todas as cópias locais. Limpe os dados deste navegador em dispositivos partilhados.');
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

  useUnsavedChanges(JSON.stringify(draft) !== JSON.stringify(baseline) || Boolean(recovery.candidate),
    saveMutation.isPending || deleteMutation.isPending, recovery.clear,
    !recoveryPending && Boolean(query.data)
      && !awaitingSelectedItem && !missingItem ? () => saveMutation.mutateAsync() : undefined);

  function leaveEditor() {
    navigateHash(contextHash(), { guard: false });
    setEditing(null); setDraft(emptyDraft(resource)); setEditorMessage('');
  }

  function syncRelationshipOptions(saved: ResourceItem) {
    queryClient.setQueryData<ResourceItem[]>(['admin-options', resource, token], (current) => {
      const list = current ?? (ENABLE_MOCKS ? fallbackFor(resource) : []);
      if (editing) return list.map((item) => (item.id === editing.id ? { ...item, ...saved, id: editing.id } : item));
      return [{ ...saved, id: saved.id ?? `local-${Date.now()}` }, ...list];
    });
  }

  function removeRelationshipOption(id: string) {
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

      <label className="resource-search">Buscar {resourceLabels[resource].toLowerCase()}
        <input type="search" value={context.search} placeholder="Nome, título ou descrição" onChange={event => navigateHash(itemContextHash(resource, { ...context, search: event.target.value }), { guard: false, replace: true })} />
      </label>

      {renderFilters}

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
          {renderFields(draft, setDraft)}
        </fieldset>
        {renderRelated?.({
          item: awaitingSelectedItem || missingItem ? null : editing,
          language: context.language,
          onLanguageChange: language => { navigateHash(contextHash(editing?.id, language), { guard: false }); }
        })}
        <div className="form-actions">
          <button type="submit" disabled={recoveryPending || (!query.data && !ENABLE_MOCKS) || awaitingSelectedItem || missingItem || saveMutation.isPending || deleteMutation.isPending}>
            {saveMutation.isPending ? 'A guardar…' : editing ? 'Guardar' : 'Criar'}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              requestAdminNavigation(leaveEditor);
            }}
          >
            Fechar edição
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
                  <td key={column}>{formatCell(item, column)}</td>
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
