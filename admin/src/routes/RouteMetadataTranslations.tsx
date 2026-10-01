import type { AdminRouteTranslation } from '@ecosdelisboa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { client } from '../adminConfig';
import { redirectIfAuthError } from '../adminApi';
import { confirmAdminNavigation, useUnsavedChanges } from '../unsavedChanges';
import { adminFailureMessage } from '../adminErrorMessages';
import { draftFingerprint } from '../localDraftStore';
import { useLocalDraft } from '../useLocalDraft';
import { LocalDraftRecovery } from '../components/LocalDraftRecovery';
import { routeMetadataDraft, validateRouteMetadataDraft, type RouteMetadataDraft } from '../routeMetadataDraft';

export function RouteMetadataTranslations({ routeId, userId, token, onAuthExpired, onDirtyChange }: {
  routeId: string; userId: string; token: string; onAuthExpired: () => void; onDirtyChange: (dirty: boolean) => void;
}) {
  const cache = useQueryClient();
  const queryKey = ['route-translations', routeId, token];
  const query = useQuery({
    queryKey,
    queryFn: () => client.get<AdminRouteTranslation[]>(`/api/v1/admin/routes/${routeId}/translations`, token),
    retry: false
  });
  const saved = query.data?.find(item => item.lang === 'en');
  const [draft, setDraft] = useState<RouteMetadataDraft>();
  const [baseline, setBaseline] = useState<RouteMetadataDraft>();
  const input = useRef<HTMLInputElement>(null);
  const remote = routeMetadataDraft(saved);
  const value = draft ?? remote;
  const { title, description } = value;
  const recovery = useLocalDraft({ identity: { userId, entity: 'route-metadata', id: routeId, language: 'en' },
    baseline: baseline ?? remote, remoteBaseline: remote, value, ready: query.data !== undefined,
    validate: validateRouteMetadataDraft,
    onRestore: (value, base) => { setBaseline(base); setDraft(value); requestAnimationFrame(() => input.current?.focus()); }
  });
  const dirty = Boolean(draft && draftFingerprint(value) !== draftFingerprint(baseline ?? remote));
  const blocked = recovery.inspecting || Boolean(recovery.candidate);
  useEffect(() => { if (query.error) redirectIfAuthError(query.error, onAuthExpired); }, [query.error, onAuthExpired]);
  function change(next: RouteMetadataDraft) {
    setBaseline(current => current ?? remote); setDraft(next); mutation.reset();
  }
  const mutation = useMutation({
    mutationFn: () => client.put<AdminRouteTranslation>(
      `/api/v1/admin/routes/${routeId}/translations/en`,
      { title, description: description || null, status: 'approved' }, token
    ),
    onSuccess: result => {
      cache.setQueryData<AdminRouteTranslation[]>(queryKey, (current = []) =>
        [...current.filter(item => item.lang !== 'en'), result]);
      recovery.clear(); setDraft(undefined); setBaseline(undefined);
      void cache.invalidateQueries({ queryKey: ['route-readiness', routeId] });
    },
    onError: cause => { redirectIfAuthError(cause, onAuthExpired); }
  });
  const guardedDirty = dirty || Boolean(recovery.candidate);
  useUnsavedChanges(guardedDirty, mutation.isPending, recovery.clear);
  useEffect(() => { onDirtyChange(guardedDirty); }, [guardedDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  return (
    <section className="route-metadata-card" id="route-metadata-en" aria-label="Metadados em inglês">
      <h3 className="route-wide-field">Título e descrição em inglês</h3>
      <p className="route-wide-field">Revise estes metadados para resolver as pendências de publicação em EN.</p>
      <LocalDraftRecovery contextLabel="Metadados do percurso EN" savedAt={recovery.candidate?.savedAt}
        baseChanged={recovery.baseChanged} onRestore={recovery.restore}
        onDiscard={() => { recovery.clear(); requestAnimationFrame(() => input.current?.focus()); }}
        warning={recovery.warning} notice={recovery.notice} />
      {query.isLoading ? <p role="status">A carregar tradução…</p> : null}
      {query.isError ? <p role="alert">{adminFailureMessage(query.error, query.data ? 'Não foi possível atualizar a tradução. Os dados anteriores continuam visíveis.' : 'Não foi possível carregar a tradução.')} <button type="button" onClick={() => { void query.refetch(); }}>Tentar novamente</button></p> : null}
      <label>Título EN<input ref={input} value={title} disabled={!query.data || blocked || mutation.isPending} onChange={event => change({ title: event.target.value, description })} /></label>
      <label className="route-wide-field">Descrição EN<textarea value={description} disabled={!query.data || blocked || mutation.isPending} onChange={event => change({ title, description: event.target.value })} /></label>
      <button type="button" disabled={!query.data || blocked || !title.trim() || mutation.isPending} onClick={() => { if (confirmAdminNavigation({ allowDirty: true })) mutation.mutate(); }}>
        {mutation.isPending ? 'A guardar EN…' : 'Rever e guardar metadados EN'}
      </button>
      {mutation.isSuccess && !draft ? <p role="status">Metadados EN revistos e guardados.</p> : null}
      {mutation.isError ? <p role="alert" className="form-error">{adminFailureMessage(mutation.error, 'Não foi possível guardar EN. O rascunho foi preservado.')}</p> : null}
    </section>
  );
}
