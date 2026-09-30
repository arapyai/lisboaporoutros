import type { AdminRouteTranslation } from '@ecosdelisboa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { client } from '../adminConfig';
import { redirectIfAuthError } from '../adminApi';
import { useUnsavedChanges } from '../unsavedChanges';

export function RouteMetadataTranslations({ routeId, token, onAuthExpired, onDirtyChange }: {
  routeId: string; token: string; onAuthExpired: () => void; onDirtyChange: (dirty: boolean) => void;
}) {
  const cache = useQueryClient();
  const queryKey = ['route-translations', routeId, token];
  const query = useQuery({
    queryKey,
    queryFn: () => client.get<AdminRouteTranslation[]>(`/api/v1/admin/routes/${routeId}/translations`, token),
    retry: false
  });
  const saved = query.data?.find(item => item.lang === 'en');
  const [draft, setDraft] = useState<{ title: string; description: string }>();
  const title = draft?.title ?? saved?.title ?? '';
  const description = draft?.description ?? saved?.description ?? '';
  const mutation = useMutation({
    mutationFn: () => client.put<AdminRouteTranslation>(
      `/api/v1/admin/routes/${routeId}/translations/en`,
      { title, description: description || null, status: 'approved' }, token
    ),
    onSuccess: result => {
      cache.setQueryData<AdminRouteTranslation[]>(queryKey, (current = []) =>
        [...current.filter(item => item.lang !== 'en'), result]);
      setDraft(undefined);
      void cache.invalidateQueries({ queryKey: ['route-readiness', routeId] });
    },
    onError: cause => { redirectIfAuthError(cause, onAuthExpired); }
  });
  useUnsavedChanges(Boolean(draft), mutation.isPending);
  useEffect(() => { onDirtyChange(Boolean(draft)); }, [draft, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  return (
    <section className="route-metadata-card" id="route-metadata-en" aria-label="Metadados em inglês">
      <h3 className="route-wide-field">Título e descrição em inglês</h3>
      <p className="route-wide-field">Revise estes metadados para resolver as pendências de publicação em EN.</p>
      {query.isLoading ? <p role="status">A carregar tradução…</p> : null}
      {query.isError ? <p role="alert">Não foi possível carregar a tradução. <button type="button" onClick={() => { void query.refetch(); }}>Tentar novamente</button></p> : null}
      <label>Título EN<input value={title} disabled={!query.data || mutation.isPending} onChange={event => setDraft({ title: event.target.value, description })} /></label>
      <label className="route-wide-field">Descrição EN<textarea value={description} disabled={!query.data || mutation.isPending} onChange={event => setDraft({ title, description: event.target.value })} /></label>
      <button type="button" disabled={!query.data || !title.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? 'A guardar EN…' : 'Rever e guardar metadados EN'}
      </button>
      {mutation.isSuccess && !draft ? <p role="status">Metadados EN revistos e guardados.</p> : null}
      {mutation.isError ? <p role="alert">Não foi possível guardar EN. O rascunho foi preservado.</p> : null}
    </section>
  );
}
