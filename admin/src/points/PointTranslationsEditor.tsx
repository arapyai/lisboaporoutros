import type {
  AdminLanguage,
  AdminPoint,
  AdminPointTranslation,
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
import { pointTranslationDraft, validatePointTranslationDraft, type PointTranslationDraft } from '../pointTranslationDraft';
import { adminFailureMessage } from '../adminErrorMessages';

export function PointTranslationsEditor({
  userId,
  point,
  initialLanguage,
  onLanguageChange,
  languages,
  token,
  onAuthExpired
}: {
  userId: string;
  point: AdminPoint | null;
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
    queryKey: ['point-translations', point?.id, token],
    queryFn: () => client.get<AdminPointTranslation[]>(`/api/v1/admin/points/${point?.id}/translations`, token),
    enabled: Boolean(point?.id),
    retry: false
  });
  useEffect(() => {
    if (isAuthError(query.error)) onAuthExpired();
  }, [query.error, onAuthExpired]);
  const translation = query.data?.find((item) => item.lang === activeLang);
  const [drafts, setDrafts] = useState<Record<string, PointTranslationDraft>>({});
  const [baselines, setBaselines] = useState<Record<string, PointTranslationDraft>>({});
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const draftKey = `${point?.id}:${activeLang}`;
  const remote = pointTranslationDraft(translation);
  const value = drafts[draftKey] ?? remote;
  const { title, description, status } = value;
  const recovery = useLocalDraft({
    identity: { userId, entity: 'point-translations', id: point?.id ?? 'new', language: activeLang },
    baseline: baselines[draftKey] ?? remote, remoteBaseline: remote, value,
    ready: Boolean(point?.id) && query.data !== undefined && targetLanguages.some(language => language.code === activeLang),
    preferCurrent: Boolean(drafts[draftKey]), validate: validatePointTranslationDraft,
    onRestore: (value, baseline) => {
      setBaselines(current => ({ ...current, [draftKey]: baseline }));
      setDrafts(current => ({ ...current, [draftKey]: value }));
    }
  });
  const recoveryPending = Boolean(recovery.candidate) || recovery.inspecting;
  function finishRecovery(action: () => void) {
    action(); requestAnimationFrame(() => panelRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus());
  }
  function changeDraft(patch: Partial<PointTranslationDraft>) {
    setBaselines(current => current[draftKey] ? current : { ...current, [draftKey]: remote });
    setDrafts(current => ({ ...current, [draftKey]: { title, description, status, ...patch } }));
    setMessage('');
    setMessageError(false);
  }
  function clearDraft() {
    recovery.clear();
    setDrafts(current => { const next = { ...current }; delete next[draftKey]; return next; });
    setBaselines(current => { const next = { ...current }; delete next[draftKey]; return next; });
  }
  function syncTranslation(saved: AdminPointTranslation) {
    queryClient.setQueryData<AdminPointTranslation[]>(['point-translations', point?.id, token], (current = []) =>
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

  useEffect(() => { setDrafts({}); setBaselines({}); setMessage(''); }, [point?.id]);

  function handleError(error: Error) {
    if (isAuthError(error)) { onAuthExpired(); return; }
    setMessage(adminFailureMessage(error, 'Não foi possível atualizar esta tradução.')); setMessageError(true);
  }

  const save = useMutation({
    onMutate: () => { setMessage(''); setMessageError(false); },
    mutationFn: () => client.put<AdminPointTranslation>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}`,
      { title, description: description || null, status },
      token
    ),
    onSuccess: syncTranslation,
    onError: handleError
  });
  const generate = useMutation({
    onMutate: () => { setMessage(''); setMessageError(false); },
    mutationFn: () => client.post<AdminPointTranslation>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}/generate`,
      {},
      token
    ),
    onSuccess: saved => { syncTranslation(saved); setMessage('Tradução gerada como pendente. Reveja antes de aprovar.'); },
    onError: handleError
  });
  const remove = useMutation({
    onMutate: () => { setMessage(''); setMessageError(false); },
    mutationFn: () => client.delete<{ deleted: boolean }>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}`,
      token
    ),
    onSuccess: () => {
      clearDraft();
      queryClient.setQueryData<AdminPointTranslation[]>(['point-translations', point?.id, token], current => (current ?? []).filter(item => item.lang !== activeLang));
      setMessage('Tradução apagada.');
      setMessageError(false);
      queryClient.invalidateQueries({ queryKey: ['point-translations', point?.id, token] });
    },
    onError: handleError
  });
  const busy = save.isPending || generate.isPending || remove.isPending;
  useUnsavedChanges(Object.keys(drafts).some(key => key.startsWith(`${point?.id}:`)) || Boolean(recovery.candidate), busy, recovery.clearAll);

  if (!point) {
    return <p className="editor-hint">Guarde o ponto antes de editar ou gerar traduções.</p>;
  }
  if (!targetLanguages.length) {
    return <p className="editor-hint">Não há idiomas de destino ativos.</p>;
  }

  return (
    <section className="point-translations-editor">
      <LanguageTabs prefix={tabsId} className="translation-tabs" label="Traduções do ponto" active={activeLang} disabled={busy}
        tabs={targetLanguages.map(language => ({ code: language.code, label: language.code.toUpperCase() }))}
        onChange={code => { if (!confirmAdminNavigation({ allowDirty: true })) return false; setActiveLang(code); onLanguageChange?.(code); setMessage(''); }} />
      <LanguageTabPanel prefix={tabsId} codes={targetLanguages.map(language => language.code)} active={activeLang}>
      <div ref={panelRef}>
      <LocalDraftRecovery contextLabel={`Tradução do ponto ${activeLang.toUpperCase()}`} savedAt={recovery.candidate?.savedAt} baseChanged={recovery.baseChanged}
        onRestore={() => finishRecovery(recovery.restore)} onDiscard={() => finishRecovery(recovery.clear)} warning={recovery.warning} notice={recovery.notice} />
      <fieldset className="language-editing-fields" disabled={busy || recoveryPending || !query.data} aria-busy={busy}>
      <p>{drafts[draftKey] ? 'Alterações locais — ainda não guardadas' : translation ? 'Versão guardada no servidor' : 'Versão ainda não guardada'}</p>
      <div className="field-grid">
        <label>Título<input disabled={busy || !query.data} value={title} onChange={(event) => changeDraft({ title: event.target.value })} /></label>
        <label className="textarea-field">Descrição<textarea disabled={busy || !query.data} value={description} onChange={(event) => changeDraft({ description: event.target.value })} /></label>
        <label>Estado proposto<select disabled={busy || !query.data} value={status} onChange={(event) => changeDraft({ status: event.target.value as TranslationStatus })}><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option></select></label>
      </div>
      <div className="form-actions">
        <button type="button" disabled={!query.data || !title.trim() || busy} onClick={() => { if (confirmAdminNavigation({ allowDirty: true })) save.mutate(); }}>{save.isPending ? 'A guardar…' : 'Guardar tradução'}</button>
        <button type="button" className="secondary-action" disabled={!query.data || busy} onClick={() => { if (!confirmAdminNavigation({ allowDirty: true })) return; if (!drafts[draftKey] || window.confirm('Substituir o rascunho deste idioma por uma tradução IA?')) generate.mutate(); }}>{generate.isPending ? 'A gerar…' : 'Gerar tradução IA'}</button>
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
