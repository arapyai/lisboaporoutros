import type {
  AdminLanguage,
  AdminAuthor,
  AdminAuthorTranslation,
  TranslationStatus
} from '@ecosdelisboa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { isAuthError } from '../adminApi';
import { client } from '../adminConfig';
import { confirmAdminNavigation, useUnsavedChanges } from '../unsavedChanges';
import { LanguageTabs, LanguageTabPanel } from '../components/LanguageTabs';
import { LocalDraftRecovery } from '../components/LocalDraftRecovery';
import { useLocalDraft } from '../useLocalDraft';
import { authorTranslationDraft, validateAuthorTranslationDraft, type AuthorTranslationDraft } from '../authorTranslationDraft';
import { adminFailureMessage } from '../adminErrorMessages';

export function AuthorTranslationsEditor({
  userId,
  author,
  initialLanguage,
  onLanguageChange,
  languages,
  token,
  onAuthExpired
}: {
  userId: string;
  author: AdminAuthor | null;
  initialLanguage?: string;
  onLanguageChange?: (language: string) => void;
  languages: AdminLanguage[];
  token: string;
  onAuthExpired: () => void;
}) {
  const queryClient = useQueryClient();
  const tabsId = useId();
  const targetLanguages = useMemo(
    () => languages.filter((language) => language.is_active && !language.is_source),
    [languages]
  );
  const [activeLang, setActiveLang] = useState(targetLanguages[0]?.code ?? 'en');
  useEffect(() => {
    if (initialLanguage && targetLanguages.some(language => language.code === initialLanguage)) setActiveLang(initialLanguage);
  }, [initialLanguage, targetLanguages]);
  const query = useQuery({
    queryKey: ['author-translations', author?.id, token],
    queryFn: () => client.get<AdminAuthorTranslation[]>(`/api/v1/admin/authors/${author?.id}/translations`, token),
    enabled: Boolean(author?.id),
    retry: false
  });
  useEffect(() => {
    if (isAuthError(query.error)) onAuthExpired();
  }, [query.error, onAuthExpired]);
  const translation = query.data?.find((item) => item.lang === activeLang);
  const [drafts, setDrafts] = useState<Record<string, AuthorTranslationDraft>>({});
  const [baselines, setBaselines] = useState<Record<string, AuthorTranslationDraft>>({});
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const draftKey = `${author?.id}:${activeLang}`;
  const remote = authorTranslationDraft(translation);
  const value = drafts[draftKey] ?? remote;
  const { bio, status } = value;
  const recovery = useLocalDraft({
    identity: { userId, entity: 'author-translations', id: author?.id ?? 'new', language: activeLang },
    baseline: baselines[draftKey] ?? remote, remoteBaseline: remote, value,
    ready: Boolean(author?.id) && query.data !== undefined && targetLanguages.some(language => language.code === activeLang),
    preferCurrent: Boolean(drafts[draftKey]), validate: validateAuthorTranslationDraft,
    onRestore: (value, baseline) => {
      setBaselines(current => ({ ...current, [draftKey]: baseline }));
      setDrafts(current => ({ ...current, [draftKey]: value }));
    }
  });
  const recoveryPending = Boolean(recovery.candidate) || recovery.inspecting;
  function finishRecovery(action: () => void) {
    action(); requestAnimationFrame(() => panelRef.current?.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')?.focus());
  }
  function changeDraft(patch: Partial<AuthorTranslationDraft>) {
    setBaselines(current => current[draftKey] ? current : { ...current, [draftKey]: remote });
    setDrafts(current => ({ ...current, [draftKey]: { bio, status, ...patch } }));
    setMessage('');
    setMessageError(false);
  }
  function clearDraft() {
    recovery.clear();
    setDrafts(current => { const next = { ...current }; delete next[draftKey]; return next; });
    setBaselines(current => { const next = { ...current }; delete next[draftKey]; return next; });
  }
  function syncTranslation(saved: AdminAuthorTranslation) {
    queryClient.setQueryData<AdminAuthorTranslation[]>(['author-translations', author?.id, token], (current = []) =>
      [...current.filter(item => item.lang !== saved.lang), saved]);
    clearDraft();
    setMessage('Tradução guardada no servidor.');
    setMessageError(false);
  }

  useEffect(() => {
    if (targetLanguages.length && !targetLanguages.some((language) => language.code === activeLang)) {
      setActiveLang(targetLanguages[0].code);
    }
  }, [activeLang, targetLanguages]);

  useEffect(() => { setDrafts({}); setBaselines({}); setMessage(''); }, [author?.id]);

  function handleError(error: Error) {
    if (isAuthError(error)) { onAuthExpired(); return; }
    setMessage(adminFailureMessage(error, 'Não foi possível atualizar esta tradução.')); setMessageError(true);
  }

  const save = useMutation({
    onMutate: () => { setMessage(''); setMessageError(false); },
    mutationFn: () => client.put<AdminAuthorTranslation>(
      `/api/v1/admin/authors/${author?.id}/translations/${activeLang}`,
      { bio, status },
      token
    ),
    onSuccess: syncTranslation,
    onError: handleError
  });
  const remove = useMutation({
    onMutate: () => { setMessage(''); setMessageError(false); },
    mutationFn: () => client.delete<{ deleted: boolean }>(
      `/api/v1/admin/authors/${author?.id}/translations/${activeLang}`,
      token
    ),
    onSuccess: () => {
      clearDraft();
      queryClient.setQueryData<AdminAuthorTranslation[]>(['author-translations', author?.id, token], current => (current ?? []).filter(item => item.lang !== activeLang));
      setMessage('Tradução apagada.');
      setMessageError(false);
      queryClient.invalidateQueries({ queryKey: ['author-translations', author?.id, token] });
    },
    onError: handleError
  });
  const busy = save.isPending || remove.isPending;
  useUnsavedChanges(Object.keys(drafts).some(key => key.startsWith(`${author?.id}:`)) || Boolean(recovery.candidate), busy, recovery.clearAll);

  if (!author) {
    return <p className="editor-hint">Guarde o autor antes de editar as traduções da biografia.</p>;
  }
  if (!targetLanguages.length) {
    return <p className="editor-hint">Não há idiomas de destino ativos.</p>;
  }

  return (
    <section className="author-translations-editor">
      <LanguageTabs prefix={tabsId} className="translation-tabs" label="Traduções da biografia" active={activeLang} disabled={busy}
        tabs={targetLanguages.map(language => ({ code: language.code, label: language.code.toUpperCase() }))}
        onChange={code => { if (!confirmAdminNavigation({ allowDirty: true })) return false; setActiveLang(code); onLanguageChange?.(code); setMessage(''); }} />
      <LanguageTabPanel prefix={tabsId} codes={targetLanguages.map(language => language.code)} active={activeLang}>
      <div ref={panelRef}>
      <LocalDraftRecovery contextLabel={`Tradução da biografia ${activeLang.toUpperCase()}`} savedAt={recovery.candidate?.savedAt} baseChanged={recovery.baseChanged}
        onRestore={() => finishRecovery(recovery.restore)} onDiscard={() => finishRecovery(recovery.clear)} warning={recovery.warning} notice={recovery.notice} />
      <fieldset className="language-editing-fields" disabled={busy || recoveryPending || !query.data} aria-busy={busy}>
      <p>{drafts[draftKey] ? 'Alterações locais — ainda não guardadas' : translation ? 'Versão guardada no servidor' : 'Versão ainda não guardada'}</p>
      <div className="field-grid">
        <label className="textarea-field">Biografia {activeLang.toUpperCase()}<textarea value={bio} onChange={(event) => changeDraft({ bio: event.target.value })} /></label>
        <label>Estado proposto<select aria-label="Estado proposto" disabled={busy || !query.data} value={status} onChange={(event) => changeDraft({ status: event.target.value as TranslationStatus })}><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option></select></label>
      </div>
      <div className="form-actions">
        <button type="button" disabled={!query.data || !bio.trim() || busy} onClick={() => { if (confirmAdminNavigation({ allowDirty: true })) save.mutate(); }}>{save.isPending ? 'A guardar…' : 'Guardar tradução'}</button>
        {translation ? <button type="button" className="danger" disabled={busy} onClick={() => { if (!confirmAdminNavigation({ allowDirty: true })) return; if (window.confirm('Apagar esta tradução e o seu rascunho?')) remove.mutate(); }}>Apagar tradução</button> : null}
      </div>
      </fieldset>
      {message ? <p className={messageError ? 'form-error' : undefined} role={messageError ? 'alert' : 'status'}>{message}</p> : null}
      {query.isError ? <p className="form-error" role="alert">Não foi possível carregar as traduções. {query.data ? 'A versão anterior permanece disponível.' : 'Tente novamente antes de editar.'}</p> : null}
      {query.isError ? <button type="button" onClick={() => { void query.refetch(); }}>Tentar novamente</button> : null}
      {query.isLoading ? <p role="status">A carregar traduções…</p> : null}
      </div>
      </LanguageTabPanel>
    </section>
  );
}
