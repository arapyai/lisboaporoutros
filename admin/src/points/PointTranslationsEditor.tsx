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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TranslationStatus>('pending');

  useEffect(() => {
    if (targetLanguages.length && !targetLanguages.some((language) => language.code === activeLang)) {
      setActiveLang(targetLanguages[0].code);
    }
  }, [activeLang, targetLanguages]);

  useEffect(() => {
    setTitle(translation?.title ?? '');
    setDescription(translation?.description ?? '');
    setStatus(translation?.status ?? 'pending');
  }, [activeLang, translation]);

  function handleError(error: Error) {
    if (isAuthError(error)) onAuthExpired();
  }

  const save = useMutation({
    mutationFn: () => client.put<AdminPointTranslation>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}`,
      { title, description: description || null, status },
      token
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['point-translations', point?.id, token] }),
    onError: handleError
  });
  const generate = useMutation({
    mutationFn: () => client.post<AdminPointTranslation>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}/generate`,
      {},
      token
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['point-translations', point?.id, token] }),
    onError: handleError
  });
  const remove = useMutation({
    mutationFn: () => client.delete<{ deleted: boolean }>(
      `/api/v1/admin/points/${point?.id}/translations/${activeLang}`,
      token
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['point-translations', point?.id, token] }),
    onError: handleError
  });

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
            onClick={() => setActiveLang(language.code)}
          >
            {language.code.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="field-grid">
        <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="textarea-field">Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label>Publicação<select value={status} onChange={(event) => setStatus(event.target.value as TranslationStatus)}><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option></select></label>
      </div>
      <div className="form-actions">
        <button type="button" disabled={!title.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'A guardar…' : 'Guardar tradução'}</button>
        <button type="button" className="secondary-action" disabled={generate.isPending} onClick={() => generate.mutate()}>{generate.isPending ? 'A gerar…' : 'Gerar tradução IA'}</button>
        {translation ? <button type="button" className="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>Apagar tradução</button> : null}
      </div>
      {query.isError || save.isError || generate.isError || remove.isError ? <p className="form-error">Não foi possível atualizar esta tradução.</p> : null}
    </section>
  );
}
