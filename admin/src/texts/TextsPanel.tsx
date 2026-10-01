import type { AdminText } from '@ecosdelisboa/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { postBlob, redirectIfAuthError } from '../adminApi';
import { adminFailureMessage } from '../adminErrorMessages';
import { confirmAdminNavigation, requestAdminNavigation, useUnsavedChanges } from '../unsavedChanges';
import { textContextFromHash, textContextHash } from '../adminNavigation';
import { client } from '../adminConfig';
import { useTextsQueries } from './useTextsQueries';
import { TextResultsTable, AdvancedFilters } from './TextResultsTable';
import { BulkGenerationDrawer } from './BulkGenerationDrawer';
import type { Draft } from '../adminTypes';
import { ResourceFields } from '../resources/ResourceFields';
import { AudioBundleDrawer } from '../audio/AudioBundleDrawer';
import { draftFromItem, emptyDraft, serializeDraft } from '../resources/resourceModel';
import { TextVersionsEditor } from './TextVersionsEditor';
import { EditorDrawer } from '../components/EditorDrawer';
import { LocalDraftRecovery } from '../components/LocalDraftRecovery';
import { useLocalDraft } from '../useLocalDraft';
import { validateResourceDraft } from '../resourceDraftSchema';
import { clearRecordLocalDrafts } from '../localDraftStore';
import {
  matchesAdvancedFilters,
  textMatchesSearch,
  type TextListFilters
} from './textListModel';

type DrawerMode = 'create' | 'edit' | 'bulk' | 'export-audio' | 'import-audio' | null;

const emptyFilters: TextListFilters = { language: '', status: '', origin: '', audio: '', gap: '' };

export function TextsPanel({
  userId,
  hash,
  navigateHash,
  token,
  onAuthExpired,
  importedTextIds,
  reviewBatchId,
  onImportedTextIdsConsumed
}: {
  userId: string;
  hash: string;
  navigateHash: (hash: string, options?: { guard?: boolean; replace?: boolean }) => boolean;
  token: string;
  onAuthExpired: () => void;
  importedTextIds?: string[];
  reviewBatchId?: string;
  onImportedTextIdsConsumed?: () => void;
}) {
  const queryClient = useQueryClient();
  const editorForm = useRef<HTMLFormElement>(null);
  function finishRecovery(action: () => void) {
    action();
    requestAnimationFrame(() => editorForm.current?.querySelector<HTMLElement>('textarea:not(:disabled), input:not(:disabled), select:not(:disabled)')?.focus());
  }
  const [mode, setMode] = useState<DrawerMode>(null);
  const [editing, setEditing] = useState<AdminText | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft('texts'));
  const [initialDraft, setInitialDraft] = useState<Draft>(emptyDraft('texts'));
  const [translationDirty, setTranslationDirty] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<string | undefined>();
  const context = useMemo(() => textContextFromHash(hash), [hash]);
  const { search, filters } = context;
  const contextHash = (id?: string, language?: string) => textContextHash(id, language, { search, filters });
  function setSearch(value: string) {
    navigateHash(textContextHash(context.id, context.language, { search: value, filters }), { guard: false, replace: true });
  }
  function setFilters(value: TextListFilters) {
    navigateHash(textContextHash(context.id, context.language, { search, filters: value }), { guard: false, replace: true });
  }
  const deferredSearch = useDeferredValue(search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewQueue, setReviewQueue] = useState<Array<{ text_id: string; lang: string }>>([]);
  const [bulkSource, setBulkSource] = useState<'texts' | 'csv'>('texts');
  const [message, setMessage] = useState('');

  const { textsQuery, authorsQuery, pointsQuery, languagesQuery, translationsQuery, audioQuery, voicesQuery, reviewBatchQuery } = useTextsQueries(token, reviewBatchId);

  const texts = textsQuery.data ?? [];
  const authors = authorsQuery.data ?? [];
  const points = pointsQuery.data ?? [];
  const languages = languagesQuery.data ?? [];
  const translations = translationsQuery.data ?? [];
  const audios = audioQuery.data ?? [];
  const sourceLanguage = languages.find((item) => item.is_source)?.code ?? 'pt';
  const contextMissing = Boolean(context.id && context.id !== 'new' && textsQuery.isSuccess && !texts.some(text => text.id === context.id));
  useEffect(() => {
    if (context.id === 'new') {
      if (mode !== 'create') {
        setEditing(null); setMode('create');
        setDraft(emptyDraft('texts')); setInitialDraft(emptyDraft('texts')); setTranslationDirty(false);
        setActiveLanguage(sourceLanguage);
      }
    } else if (context.id) {
      const text = texts.find(item => item.id === context.id);
      if (!text) {
        if (textsQuery.isSuccess && editing?.id !== context.id) {
          setMode(null); setEditing(null);
          setDraft(emptyDraft('texts')); setInitialDraft(emptyDraft('texts')); setTranslationDirty(false);
        }
        return;
      }
      if (editing?.id !== text.id) {
        const nextDraft = draftFromItem('texts', text);
        setEditing(text);
        setDraft(nextDraft);
        setInitialDraft(nextDraft);
        setTranslationDirty(false);
        setMode('edit');
      }
      setActiveLanguage(context.language ?? sourceLanguage);
    } else if (mode === 'edit' || mode === 'create') {
      setMode(null);
      setEditing(null);
      setDraft(emptyDraft('texts'));
      setInitialDraft(emptyDraft('texts'));
      setTranslationDirty(false);
    }
  }, [hash, textsQuery.isSuccess, texts, sourceLanguage]);
  const authorById = useMemo(() => new Map(authors.map((item) => [item.id, item.name])), [authors]);
  const pointById = useMemo(() => new Map(points.map((item) => [item.id, item.title_pt])), [points]);
  const filteredTexts = useMemo(
    () => texts.filter((text) => {
      const context = {
        authorName: authorById.get(text.author_id) ?? '',
        pointName: pointById.get(text.point_id) ?? ''
      };
      return textMatchesSearch(text, context, deferredSearch)
        && matchesAdvancedFilters(text, filters, translations, audios, sourceLanguage);
    }),
    [audios, authorById, deferredSearch, filters, pointById, sourceLanguage, texts, translations]
  );
  const recovery = useLocalDraft({
    identity: { userId, entity: 'texts', id: context.id ?? 'new', language: sourceLanguage },
    baseline: initialDraft,
    remoteBaseline: editing ? draftFromItem('texts', texts.find(text => text.id === editing.id) ?? editing) : emptyDraft('texts'),
    value: draft,
    ready: textsQuery.isSuccess && languagesQuery.isSuccess && !contextMissing
      && (context.id === 'new' ? mode === 'create' : mode === 'edit' && editing?.id === context.id),
    validate: value => validateResourceDraft('texts', value),
    onRestore: setDraft
  });
  const recoveryPending = Boolean(recovery.candidate) || recovery.inspecting;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft) || translationDirty || Boolean(recovery.candidate);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const selectedVisible = filteredTexts.filter((item) => selected.has(item.id)).length;

  useEffect(() => {
    if (!importedTextIds?.length) return;
    setSelected(new Set(importedTextIds));
    setBulkSource('csv');
    setMode('bulk');
    onImportedTextIdsConsumed?.();
  }, [importedTextIds, onImportedTextIdsConsumed]);

  useEffect(() => {
    const pending = (reviewBatchQuery.data?.pending_reviews ?? []).flatMap((item) => (
      item.target_kind === 'text' && item.text_id
        ? [{ text_id: item.text_id, lang: item.lang }]
        : []
    ));
    if (!pending.length) return;
    setReviewQueue(pending);
    openReview(pending[0]);
  }, [reviewBatchQuery.data?.id]);

  function closeDrawer() {
    if (mode === 'edit' || mode === 'create') {
      navigateHash(contextHash());
      return;
    }
    requestAdminNavigation(() => {
      setMode(null);
      setEditing(null);
      setDraft(emptyDraft('texts'));
      setInitialDraft(emptyDraft('texts'));
      setTranslationDirty(false);
      setActiveLanguage(undefined);
    });
  }

  function openCreate() {
    requestAdminNavigation(() => {
      navigateHash(contextHash('new'), { guard: false, replace: true });
      const nextDraft = emptyDraft('texts');
      setEditing(null);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
      setMode('create');
      setActiveLanguage(sourceLanguage);
    });
  }

  function openBulk() {
    requestAdminNavigation(() => {
      navigateHash(contextHash(), { guard: false, replace: true });
      setBulkSource('texts');
      setMode('bulk');
    });
  }

  function openEdit(text: AdminText, language?: string) {
    if (editing?.id === text.id && !confirmAdminNavigation({ allowDirty: true })) return;
    navigateHash(contextHash(text.id, language ?? sourceLanguage), { guard: editing?.id !== text.id });
  }

  function openReview(review: { text_id: string; lang: string }) {
    const text = texts.find((item) => item.id === review.text_id);
    if (text) openEdit(text, review.lang);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = serializeDraft('texts', draft);
      return editing
        ? client.put<AdminText>(`/api/v1/admin/texts/${editing.id}`, payload, token)
        : client.post<AdminText>('/api/v1/admin/texts', payload, token);
    },
    onSuccess: async (saved) => {
      recovery.clear();
      navigateHash(contextHash(saved.id, activeLanguage), { guard: false, replace: true });
      setEditing(saved);
      const nextDraft = draftFromItem('texts', saved);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
      setMode('edit');
      setMessage('Texto guardado.');
      await queryClient.invalidateQueries({ queryKey: ['admin-resource', 'texts', token] });
    },
    onError: (cause) => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      setMessage(adminFailureMessage(cause, 'Não foi possível guardar o texto.'));
    }
  });

  const editorialExportMutation = useMutation({
    mutationFn: (textIds: string[]) => postBlob(
      '/api/v1/admin/editorial-export',
      { text_ids: textIds },
      token,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lisboa-pacote-editorial-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Planilha editorial exportada.');
    },
    onError: (cause) => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      setMessage('Não foi possível exportar a planilha editorial.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (text: AdminText) => client.delete<{ deleted: boolean }>(`/api/v1/admin/texts/${text.id}`, token),
    onSuccess: async () => {
      recovery.clear();
      try {
        if (editing) clearRecordLocalDrafts(localStorage, { userId, entity: 'text-versions', id: editing.id });
      } catch {
        setMessage('Texto apagado, mas não foi possível remover as cópias locais das traduções. Limpe os dados deste navegador em dispositivos partilhados.');
      }
      navigateHash(contextHash(), { guard: false, replace: true });
      setMode(null);
      setEditing(null);
      setDraft(emptyDraft('texts'));
      setInitialDraft(emptyDraft('texts'));
      setTranslationDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-resource', 'texts', token] });
    },
    onError: (cause) => redirectIfAuthError(cause, onAuthExpired)
  });

  useUnsavedChanges(dirty, saveMutation.isPending || deleteMutation.isPending, recovery.clear,
    !recoveryPending && !translationDirty && textsQuery.isSuccess && languagesQuery.isSuccess
      && !contextMissing && (mode === 'create' || (mode === 'edit' && editing?.id === context.id))
      ? () => saveMutation.mutateAsync() : undefined);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (recoveryPending) return;
    if (!confirmAdminNavigation({ allowDirty: true })) return;
    saveMutation.mutate();
  }

  function toggleSelection(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (selectedVisible === filteredTexts.length) filteredTexts.forEach((item) => next.delete(item.id));
      else filteredTexts.forEach((item) => next.add(item.id));
      return next;
    });
  }

  function reviewed() {
    queryClient.invalidateQueries({ queryKey: ['admin-translations', token] });
    queryClient.invalidateQueries({ queryKey: ['generation-batch', reviewBatchId, token] });
    const next = reviewQueue.slice(1);
    setReviewQueue(next);
    if (next[0]) openReview(next[0]);
  }

  const requiredQueries = [textsQuery, authorsQuery, pointsQuery, languagesQuery, translationsQuery, audioQuery, voicesQuery];
  const failedQueries = requiredQueries.filter(query => query.isError);
  if (failedQueries.some(query => query.data === undefined)) return (
    <section className="content-panel admin-state error-state" role="alert">
      <h2>Não foi possível carregar o painel de textos</h2>
      <p>Os dados não foram apagados. Verifique a conexão e tente novamente.</p>
      <button type="button" onClick={() => { failedQueries.forEach(query => { void query.refetch(); }); }}>Tentar novamente</button>
    </section>
  );
  if (requiredQueries.some(query => query.isLoading && query.data === undefined)) return <section className="content-panel" role="status">A carregar textos e dados editoriais…</section>;

  return (
    <section className={`content-panel text-workspace ${mode ? 'drawer-open' : ''}`}>
      {failedQueries.length ? <p role="alert">A atualização dos dados falhou. Os dados anteriores e o rascunho foram preservados. <button type="button" onClick={() => { failedQueries.forEach(query => { void query.refetch(); }); }}>Tentar novamente</button></p> : null}
      <div className="text-list-pane">
        <header className="texts-heading">
          <div><h2>Textos</h2><p>{filteredTexts.length} de {texts.length} textos</p></div>
          <div className="texts-heading-actions">
            <button
              type="button"
              className="secondary-action"
              disabled={!filteredTexts.length || editorialExportMutation.isPending}
              onClick={() => editorialExportMutation.mutate(filteredTexts.map((text) => text.id))}
            >
              {editorialExportMutation.isPending ? 'A exportar…' : `Exportar planilha (${filteredTexts.length})`}
            </button>
            <button type="button" className="secondary-action" onClick={() => setMode('import-audio')}>Importar pacote</button>
            <button type="button" onClick={openCreate}>＋ Novo texto</button>
          </div>
        </header>

        <div className="text-search-toolbar">
          <label className="text-search-field">
            <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="m15.5 15.5 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              placeholder="Buscar por texto, autor, obra ou ponto…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="button" className="secondary-action more-filters" onClick={() => setFiltersOpen((value) => !value)}>
            Mais filtros {activeFilterCount ? <span>{activeFilterCount}</span> : null}
          </button>
        </div>

        {filtersOpen ? (
          <AdvancedFilters
            filters={filters}
            languages={languages}
            onChange={setFilters}
            onClear={() => setFilters(emptyFilters)}
          />
        ) : null}

        {selected.size ? (
          <div className="bulk-selection-bar">
            <span>{selected.size} texto{selected.size === 1 ? '' : 's'} selecionado{selected.size === 1 ? '' : 's'}</span>
            <button type="button" onClick={openBulk}>Gerar conteúdo</button>
            <button
              type="button"
              className="secondary-action"
              disabled={editorialExportMutation.isPending}
              onClick={() => editorialExportMutation.mutate([...selected])}
            >Exportar planilha</button>
            <button type="button" className="secondary-action" onClick={() => setMode('export-audio')}>Exportar áudios</button>
            <button type="button" className="text-action" onClick={() => setSelected(new Set())}>Limpar seleção</button>
          </div>
        ) : null}

        {message && mode === null ? <p className="drawer-message" role="status">{message}</p> : null}
        {textsQuery.isError ? <p className="users-error">Não foi possível carregar os textos.</p> : null}
        {contextMissing ? <p role="alert">O texto deste link não foi encontrado. <button type="button" onClick={() => navigateHash(contextHash())}>Voltar à lista</button></p> : null}
        <TextResultsTable
          filteredTexts={filteredTexts}
          editingId={editing?.id}
          selected={selected}
          selectedVisible={selectedVisible}
          loading={textsQuery.isLoading}
          authorById={authorById}
          pointById={pointById}
          languages={languages}
          sourceLanguage={sourceLanguage}
          translations={translations}
          audios={audios}
          search={deferredSearch}
          onToggle={toggleSelection}
          onToggleAll={toggleAllVisible}
          onEdit={openEdit}
        />
      </div>

      {mode === 'bulk' ? (
        <BulkGenerationDrawer
          token={token}
          textIds={[...selected]}
          languages={languages}
          voices={voicesQuery.data ?? []}
          batchSource={bulkSource}
          onClose={() => setMode(null)}
          onCreated={() => { setMode(null); setSelected(new Set()); }}
          onAuthExpired={onAuthExpired}
        />
      ) : null}

      {mode === 'export-audio' || mode === 'import-audio' ? (
        <AudioBundleDrawer
          mode={mode === 'export-audio' ? 'export' : 'import'}
          token={token}
          textIds={[...selected]}
          onClose={() => setMode(null)}
          onAuthExpired={onAuthExpired}
        />
      ) : null}

      {mode === 'create' || mode === 'edit' ? (
        <EditorDrawer label={editing ? 'Editar texto' : 'Novo texto'} onClose={closeDrawer}>
          <header className="text-editor-header">
            <div><h3>{editing ? 'Editar texto' : 'Novo texto'}</h3><span className={dirty ? 'unsaved' : 'saved'}>{dirty ? 'Alterações por guardar' : editing ? 'Guardado' : 'Não guardado'}</span></div>
            <button type="button" className="close-editor" aria-label="Fechar" onClick={closeDrawer}>×</button>
          </header>
          <LocalDraftRecovery contextLabel="Texto original e metadados" savedAt={recovery.candidate?.savedAt} baseChanged={recovery.baseChanged}
            onRestore={() => finishRecovery(recovery.restore)} onDiscard={() => finishRecovery(recovery.clear)} warning={recovery.warning} notice={recovery.notice} />
          <form ref={editorForm} onSubmit={submit}>
            <fieldset className="language-editing-fields" disabled={recoveryPending || saveMutation.isPending || deleteMutation.isPending} aria-busy={saveMutation.isPending || deleteMutation.isPending}>
            <TextVersionsEditor
              key={editing?.id ?? 'new'}
              userId={userId}
              translationsReady={translationsQuery.data !== undefined}
              baseDraft={draft}
              languages={languages}
              text={editing}
              token={token}
              translations={translations}
              audios={audios}
              voices={voicesQuery.data ?? []}
              audioLoading={audioQuery.isLoading}
              audioError={audioQuery.isError}
              initialLanguage={activeLanguage}
              onLanguageChange={language => {
                if (editing) navigateHash(contextHash(editing.id, language), { guard: false });
                setActiveLanguage(language);
              }}
              onAuthExpired={onAuthExpired}
              onBaseDraft={setDraft}
              onTranslationsChanged={() => translationsQuery.refetch()}
              onAudiosChanged={() => audioQuery.refetch()}
              onDirtyChange={setTranslationDirty}
              onReviewed={reviewQueue.length ? reviewed : undefined}
              metadataFields={(
                <ResourceFields
                  resource="texts"
                  draft={draft}
                  context={{
                    authors,
                    authorsReady: authorsQuery.isSuccess,
                    points,
                    pointsReady: pointsQuery.isSuccess,
                    pointTypes: [],
                    pointTypesReady: false
                  }}
                  onDraft={setDraft}
                />
              )}
            />
            </fieldset>
            {message ? <p className="drawer-message" role="status">{message}</p> : null}
            <footer className="text-editor-footer">
              {editing ? <button type="button" className="danger-link" disabled={saveMutation.isPending || deleteMutation.isPending} onClick={() => {
                if (!confirmAdminNavigation({ allowDirty: true })) return;
                if (window.confirm('Apagar este texto e suas versões?')) deleteMutation.mutate(editing);
              }}>Apagar texto</button> : <span />}
              <div><button type="button" className="secondary-action" onClick={closeDrawer}>Cancelar</button><button type="submit" disabled={recoveryPending || saveMutation.isPending || deleteMutation.isPending}>{saveMutation.isPending ? 'A guardar…' : 'Guardar alterações'}</button></div>
            </footer>
          </form>
        </EditorDrawer>
      ) : null}
    </section>
  );
}
