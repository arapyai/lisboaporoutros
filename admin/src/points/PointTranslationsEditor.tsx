import type {
  AdminLanguage,
  AdminPoint,
  AdminPointTranslation,
  TranslationStatus
} from '@ecosdelisboa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { isAuthError } from '../adminApi';
import { client } from '../adminConfig';
import { useUnsavedChanges } from '../unsavedChanges';

export function PointTranslationsEditor({
  point,
  languages,
  token,
  onAuthExpired
}: {
  point: AdminPoint | null;
  languages: AdminLanguage[];
  token: string;
  onAuthExpired: () => void;
}) {
  const queryClient = useQueryClient();
  const targetLanguages = useMemo(
    () => languages.filter((language) => language.is_active && !language.is_source),
    [languages]
  );
  const [activeLang, setActiveLang] = useState(targetLanguages[0]?.code ?? 'en');
  const query = useQuery({
    queryKey: ['point-translations', point?.id, token],
    queryFn: () => client.get<AdminPointTranslation[]>(`/api/v1/admin/points/${point?.id}/translations`, token),
    enabled: Boolean(point?.id),
    retry: false
  });
  const translation = query.data?.find((item) => item.lang === activeLang);
  const [drafts, setDrafts] = useState<Record<string, { title: string; description: string; status: TranslationStatus }>>({});
  const draftKey = `${point?.id}:${activeLang}`;
  const { title, description, status } = drafts[draftKey] ?? {
    title: translation?.title ?? '', description: translation?.description ?? '', status: translation?.status ?? 'pending'
  };
  useUnsavedChanges(Object.keys(drafts).some(key => key.startsWith(`${point?.id}:`)));
  function changeDraft(patch: Partial<{ title: string; description: string; status: TranslationStatus }>) {
    setDrafts(current => ({ ...current, [draftKey]: { title, description, status, ...patch } }));
  }
  function clearDraft() {
    setDrafts(current => { const next = { ...current }; delete next[draftKey]; return next; });
  }
  function syncTranslation(saved: AdminPointTranslation) {
    queryClient.setQueryData<AdminPointTranslation[]>(['point-translations', point?.id, token], (current = []) =>
      [...current.filter(item => item.lang !== saved.lang), saved]);
    clearDraft();
  }

  useEffect(() => {
    if (targetLanguages.length && !targetLanguages.some((language) => language.code === activeLang)) {
      setActiveLang(targetLanguages[0].code);
    }
  }, [activeLang, targetLanguages]);

  useEffect(() => { setDrafts({}); }, [point?.id]);

  function handleError(error: Error) {
    if (isAuthError(error)) onAuthExpired();
  }

  const save = useMutation({
    mutationFn: () => client.put<AdminPointTranslation>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}`,
      { title, description: description || null, status },
      token
    ),
    onSuccess: syncTranslation,
    onError: handleError
  });
  const generate = useMutation({
    mutationFn: () => client.post<AdminPointTranslation>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}/generate`,
      {},
      token
    ),
    onSuccess: syncTranslation,
    onError: handleError
  });
  const remove = useMutation({
    mutationFn: () => client.delete<{ deleted: boolean }>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}`,
      token
    ),
    onSuccess: () => { clearDraft(); queryClient.invalidateQueries({ queryKey: ['point-translations', point?.id, token] }); },
    onError: handleError
  });
  const busy = save.isPending || generate.isPending || remove.isPending;
  useUnsavedChanges(false, busy);

  if (!point) {
    return <p className="editor-hint">Guarde o ponto antes de editar ou gerar traduções.</p>;
  }
  if (!targetLanguages.length) {
    return <p className="editor-hint">Não há idiomas de destino ativos.</p>;
  }

  return (
    <section className="point-translations-editor">
      <div className="translation-tabs" role="tablist" aria-label="Traduções do ponto">
        {targetLanguages.map((language) => (
          <button
            key={language.code}
            type="button"
            role="tab"
            aria-selected={activeLang === language.code}
            className={activeLang === language.code ? 'active' : ''}
            disabled={save.isPending || generate.isPending || remove.isPending}
            onClick={() => setActiveLang(language.code)}
          >
            {language.code.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="field-grid">
        <label>Título<input disabled={busy || !query.data} value={title} onChange={(event) => changeDraft({ title: event.target.value })} /></label>
        <label className="textarea-field">Descrição<textarea disabled={busy || !query.data} value={description} onChange={(event) => changeDraft({ description: event.target.value })} /></label>
        <label>Publicação<select disabled={busy || !query.data} value={status} onChange={(event) => changeDraft({ status: event.target.value as TranslationStatus })}><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option></select></label>
      </div>
      <div className="form-actions">
        <button type="button" disabled={!query.data || !title.trim() || busy} onClick={() => save.mutate()}>{save.isPending ? 'A guardar…' : 'Guardar tradução'}</button>
        <button type="button" className="secondary-action" disabled={!query.data || busy} onClick={() => { if (!drafts[draftKey] || window.confirm('Substituir o rascunho deste idioma por uma tradução IA?')) generate.mutate(); }}>{generate.isPending ? 'A gerar…' : 'Gerar tradução IA'}</button>
        {translation ? <button type="button" className="danger" disabled={busy} onClick={() => { if (window.confirm('Apagar esta tradução e o seu rascunho?')) remove.mutate(); }}>Apagar tradução</button> : null}
      </div>
      {query.isError || save.isError || generate.isError || remove.isError ? <p className="form-error">Não foi possível atualizar esta tradução.</p> : null}
      {query.isError ? <button type="button" onClick={() => { void query.refetch(); }}>Tentar novamente</button> : null}
      {query.isLoading ? <p role="status">A carregar traduções…</p> : null}
    </section>
  );
}
