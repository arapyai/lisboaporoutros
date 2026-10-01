import {
  ApiError,
  type AdminRoute,
  type AdminRouteSegment,
  type AdminText,
  type RouteReadiness
} from '@ecosdelisboa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { client } from '../adminConfig';
import { putMp3, redirectIfAuthError } from '../adminApi';
import {
  addBridgeSegment,
  addLegWaypoint,
  addTextSegment,
  draftFingerprint,
  emptyRouteDraft,
  filterAvailableTexts,
  normalizePositions,
  removeLegWaypoint,
  reorderSegments,
  routeDraftFromRoute,
  serializeRouteDraft,
  waypointDraftFromLegs,
  type RouteLegWaypointDraft,
  type RouteDraft
} from './routeEditorModel';
import { RouteMap } from './RouteMap';
import { RouteMetadataTranslations } from './RouteMetadataTranslations';
import { confirmAdminNavigation, useUnsavedChanges } from '../unsavedChanges';
import { itemContextFromHash, itemContextHash } from '../adminNavigation';
import { adminFailureMessage } from '../adminErrorMessages';
import { useLocalDraft } from '../useLocalDraft';
import { LocalDraftRecovery } from '../components/LocalDraftRecovery';
import { validateBridgeDraft, type BridgeDraft } from '../bridgeDraft';

const NEW_ROUTE_ID = 'new';
const BRIDGE_UPLOAD_FAILURE = 'Falha no upload do áudio da ponte. O áudio anterior foi preservado. Selecione o ficheiro novamente para tentar.';

export function RouteEditor({
  hash,
  navigateHash,
  token,
  userId,
  onAuthExpired
}: {
  hash: string;
  navigateHash: (hash: string, options?: { guard?: boolean; replace?: boolean }) => boolean;
  token: string;
  userId: string;
  onAuthExpired: () => void;
}) {
  const queryClient = useQueryClient();
  const context = itemContextFromHash(hash);
  const [selectedId, setSelectedId] = useState<string | undefined>(context.id);
  const [draft, setDraft] = useState<RouteDraft>(emptyRouteDraft);
  const [savedFingerprint, setSavedFingerprint] = useState(draftFingerprint(emptyRouteDraft()));
  const search = context.search;
  const setSearch = (search: string) => navigateHash(itemContextHash('routes', { ...context, id: selectedId, search }), { guard: false, replace: true });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>();
  const [selectedLegPosition, setSelectedLegPosition] = useState(0);
  const [legWaypoints, setLegWaypoints] = useState<RouteLegWaypointDraft[]>([]);
  const [addingWaypoint, setAddingWaypoint] = useState(false);
  const previewLang = context.language === 'en' ? 'en' : 'pt';
  const setPreviewLang = (language: 'pt' | 'en') => navigateHash(itemContextHash('routes', { ...context, id: selectedId, language }), { guard: false });
  const [bridgeEnglish, setBridgeEnglish] = useState('');
  const [bridgeBaseline, setBridgeBaseline] = useState<BridgeDraft>();
  const [bridgeHydratedKey, setBridgeHydratedKey] = useState('');
  const bridgeInput = useRef<HTMLTextAreaElement>(null);
  const hydratedRouteId = useRef<string | undefined>(undefined);
  const hydratedSegmentId = useRef<string | undefined>(undefined);
  const skipPersistence = useRef(false);
  const skipWaypointsSync = useRef(false);
  const [savedWaypoints, setSavedWaypoints] = useState('[]');
  const [metadataDirty, setMetadataDirty] = useState(false);

  const routesQuery = useQuery({
    queryKey: ['narrative-routes', token],
    queryFn: () => client.listAdminRoutes(token)
  });
  const textsQuery = useQuery({
    queryKey: ['route-texts', token],
    queryFn: () => client.get<AdminText[]>('/api/v1/admin/texts', token)
  });
  const routes = routesQuery.data ?? [];
  const selectedRoute = routes.find((route) => route.id === selectedId);
  const dirty = draftFingerprint(draft) !== savedFingerprint;
  const waypointsDirty = waypointFingerprint(legWaypoints) !== savedWaypoints;
  const availableTexts = useMemo(
    () => filterAvailableTexts(textsQuery.data ?? [], search, draft.segments),
    [draft.segments, search, textsQuery.data]
  );
  const textSegments = draft.segments.filter((segment) => segment.kind === 'text');
  const selectedSegment =
    draft.segments.find((segment) => segment.id === selectedSegmentId) ?? draft.segments[0];
  const selectedLegWaypoints =
    legWaypoints.find((leg) => leg.position === selectedLegPosition)?.waypoints ?? [];
  const canUseServerTools = Boolean(selectedRoute && selectedId !== NEW_ROUTE_ID && !dirty);
  const remoteBridge = selectedRoute?.segments?.find(segment => segment.id === selectedSegment?.id && segment.kind === 'bridge');
  const bridgeRemoteContent = remoteBridge?.translations?.find(item => item.lang === 'en')?.content ?? '';
  const bridgeDirty = selectedSegment?.kind === 'bridge' && bridgeBaseline !== undefined && bridgeEnglish !== bridgeBaseline.content;
  const bridgeSelectionKey = JSON.stringify([selectedId, selectedSegment?.id]);
  const bridgeReady = Boolean(remoteBridge && selectedSegment?.id && bridgeHydratedKey === bridgeSelectionKey && hydratedRouteId.current === selectedId);
  const bridgeRecovery = useLocalDraft({ identity: { userId, entity: `route-bridge:${selectedId}`, id: selectedSegment?.id ?? '', language: 'en' },
    baseline: bridgeBaseline ?? { content: bridgeRemoteContent }, remoteBaseline: { content: bridgeRemoteContent },
    value: { content: bridgeEnglish }, ready: bridgeReady, validate: validateBridgeDraft,
    onRestore: (value, baseline) => { setBridgeBaseline(baseline); setBridgeEnglish(value.content); requestAnimationFrame(() => bridgeInput.current?.focus()); }
  });
  const bridgeBlocked = bridgeRecovery.inspecting || Boolean(bridgeRecovery.candidate);
  const bridgeUnsaved = Boolean(bridgeDirty || bridgeRecovery.candidate);
  useUnsavedChanges(dirty || waypointsDirty);
  useUnsavedChanges(bridgeUnsaved, false, bridgeRecovery.clear);
  const ptReadiness = useQuery({
    queryKey: ['route-readiness', selectedId, 'pt', token],
    queryFn: () => client.getRouteReadiness(selectedId!, 'pt', token),
    enabled: canUseServerTools
  });
  const enReadiness = useQuery({
    queryKey: ['route-readiness', selectedId, 'en', token],
    queryFn: () => client.getRouteReadiness(selectedId!, 'en', token),
    enabled: canUseServerTools
  });

  useEffect(() => {
    if (!routesQuery.isSuccess) return;
    const nextId = context.id ?? routes[0]?.id ?? NEW_ROUTE_ID;
    if (!context.id) navigateHash(itemContextHash('routes', { ...context, id: nextId, language: previewLang }), { guard: false, replace: true });
    if (!nextId || nextId === selectedId) return;
    hydratedRouteId.current = undefined;
    hydratedSegmentId.current = undefined;
    setLegWaypoints([]);
    setSavedWaypoints('[]');
    setSelectedId(nextId);
    setMessage('');
  }, [hash, routes]);

  useEffect(() => {
    if (!selectedId) return;
    if (selectedId !== NEW_ROUTE_ID && !selectedRoute) return;
    if (hydratedRouteId.current === selectedId) {
      if (!dirty && selectedRoute) {
        const refreshed = routeDraftFromRoute(selectedRoute);
        setDraft(refreshed);
        setSavedFingerprint(draftFingerprint(refreshed));
      }
      return;
    }
    hydratedRouteId.current = selectedId;
    skipPersistence.current = true;
    const waypointBaseline = waypointDraftFromLegs(selectedRoute?.legs);
    setSavedWaypoints(waypointFingerprint(waypointBaseline));
    const baseline =
      selectedId === NEW_ROUTE_ID || !selectedRoute
        ? emptyRouteDraft()
        : routeDraftFromRoute(selectedRoute);
    const stored = readLocalDraft(selectedId, userId);
    const local = stored && window.confirm('Foi encontrado um rascunho local deste percurso. Restaurar as alterações não guardadas?') ? stored : null;
    const next = local?.narrative ?? baseline;
    setLegWaypoints(local?.waypoints ?? waypointBaseline);
    skipWaypointsSync.current = true;
    setDraft(next);
    setSavedFingerprint(draftFingerprint(baseline));
    if (local) setMessage('Rascunho local restaurado.');
    setSelectedSegmentId(next.segments[0]?.id);
  }, [selectedId, selectedRoute, userId]);

  useEffect(() => {
    if (skipWaypointsSync.current) { skipWaypointsSync.current = false; return; }
    if (waypointsDirty && hydratedRouteId.current === selectedId) return;
    const next = waypointDraftFromLegs(selectedRoute?.legs);
    setLegWaypoints(next);
    setSavedWaypoints(waypointFingerprint(next));
  }, [selectedId, selectedRoute?.legs]);

  useEffect(() => {
    if (hydratedSegmentId.current === selectedSegment?.id) {
      if (!bridgeDirty && !bridgeRecovery.candidate && bridgeReady) { setBridgeBaseline(undefined); setBridgeEnglish(bridgeRemoteContent); }
      return;
    }
    hydratedSegmentId.current = selectedSegment?.id;
    setBridgeHydratedKey(bridgeSelectionKey);
    setBridgeBaseline(undefined);
    setBridgeEnglish(
      selectedSegment?.kind === 'bridge'
        ? selectedSegment.translations?.find((translation) => translation.lang === 'en')?.content ?? ''
        : ''
    );
  }, [selectedSegment, bridgeRemoteContent]);

  useEffect(() => {
    if (!selectedId || hydratedRouteId.current !== selectedId) return;
    if (skipPersistence.current) { skipPersistence.current = false; return; }
    try {
      if (dirty || waypointsDirty) localStorage.setItem(storageKey(selectedId, userId), JSON.stringify({
        version: 2, narrative: draft, waypoints: legWaypoints
      }));
      else localStorage.removeItem(storageKey(selectedId, userId));
    } catch {
      setMessage('O navegador não permite guardar o rascunho local. Guarde no servidor antes de sair.');
    }
  }, [dirty, draft, selectedId, legWaypoints, waypointsDirty, userId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = serializeRouteDraft(draft);
      return selectedId === NEW_ROUTE_ID
        ? client.post<AdminRoute>('/api/v1/admin/routes', payload, token)
        : client.put<AdminRoute>(`/api/v1/admin/routes/${selectedId}`, payload, token);
    },
    onSuccess: (saved) => {
      try { localStorage.removeItem(storageKey(selectedId ?? NEW_ROUTE_ID, userId)); } catch { /* Browser storage may be unavailable. */ }
      queryClient.setQueryData<AdminRoute[]>(['narrative-routes', token], (current = []) => {
        const exists = current.some((route) => route.id === saved.id);
        return exists
          ? current.map((route) => (route.id === saved.id ? saved : route))
          : [saved, ...current];
      });
      const next = routeDraftFromRoute(saved);
      setSelectedId(saved.id);
      navigateHash(itemContextHash('routes', { ...context, id: saved.id, language: previewLang }), { guard: false, replace: true });
      setDraft(next);
      setSavedFingerprint(draftFingerprint(next));
      setMessage('Percurso guardado no servidor.');
    },
    onError: (cause) => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      if (cause instanceof ApiError && cause.status === 409) {
        setMessage('Ainda não pode publicar: consulte as pendências de PT/EN e da rota.');
        return;
      }
      setMessage('Não foi possível guardar o percurso. O rascunho continua neste dispositivo.');
    }
  });

  const recalculateMutation = useMutation({
    mutationFn: () => client.recalculateRoute(selectedId!, legWaypoints, token),
    onSuccess: (result) => {
      queryClient.setQueryData<AdminRoute[]>(['narrative-routes', token], (current = []) =>
        current.map((route) =>
          route.id === result.route_id
            ? {
                ...route,
                routing_status: result.routing_status,
                estimated_distance_m: result.estimated_distance_m,
                estimated_duration_s: result.estimated_duration_s,
                legs: result.legs
              }
            : route
        )
      );
      setLegWaypoints(waypointDraftFromLegs(result.legs));
      setSavedWaypoints(waypointFingerprint(waypointDraftFromLegs(result.legs)));
      queryClient.invalidateQueries({ queryKey: ['route-readiness', selectedId] });
      setMessage('Rota pedonal recalculada e guardada.');
    },
    onError: (cause) => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      setMessage('O provedor de rotas falhou. A última geometria válida foi preservada.');
    }
  });

  const bridgeTranslationMutation = useMutation({
    mutationFn: () =>
      client.put<{ id: string; lang: string; content: string; status: 'approved' }>(
        `/api/v1/admin/routes/${selectedId}/segments/${selectedSegment?.id}/translations/en`,
        { content: bridgeEnglish, status: 'approved' },
        token
      ),
    onSuccess: (translation) => {
      bridgeRecovery.clear(); setBridgeBaseline(undefined);
      setBridgeEnglish(translation.content);
      updateSelectedSegment({
        translations: [
          ...(selectedSegment?.translations ?? []).filter((item) => item.lang !== 'en'),
          translation
        ]
      });
      queryClient.invalidateQueries({ queryKey: ['route-readiness', selectedId] });
      setMessage('Ponte EN revista e guardada.');
    },
    onError: cause => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      setMessage(adminFailureMessage(cause, 'Não foi possível guardar a ponte EN. O rascunho foi preservado.'));
    }
  });

  const bridgeAudioMutation = useMutation({
    mutationFn: (lang: 'pt' | 'en') =>
      client.post<{ status?: string; error?: string | null; audio?: NonNullable<AdminRouteSegment['audio_files']>[number] | null }>(
        `/api/v1/admin/routes/${selectedId}/segments/${selectedSegment?.id}/audio/${lang}/generate`,
        {},
        token
      ),
    onSuccess: (result) => {
      if (result.error || result.status === 'failed') {
        setMessage('Não foi possível gerar o áudio. O áudio anterior foi preservado.');
        return;
      }
      if (result.status !== 'completed') {
        setMessage('A geração de áudio não foi concluída. O áudio anterior foi preservado.');
        return;
      }
      if (result.audio) replaceSelectedBridgeAudio(result.audio);
      queryClient.invalidateQueries({ queryKey: ['route-readiness', selectedId] });
      setMessage(result.audio?.manually_uploaded ? 'Áudio manual protegido. A geração automática não o substituiu.' : result.audio ? 'Áudio da ponte atualizado.' : 'A geração de áudio não foi concluída.');
    },
    onError: cause => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      setMessage('Não foi possível gerar o áudio da ponte. O áudio anterior foi preservado.');
    }
  });
  const bridgeUploadMutation = useMutation({
    mutationFn: ({ routeId, segmentId, lang, file }: { routeId: string; segmentId: string; lang: 'pt' | 'en'; file: File }) =>
      putMp3<NonNullable<AdminRouteSegment['audio_files']>[number]>(
        `/api/v1/admin/routes/${routeId}/segments/${segmentId}/audio/${lang}/upload`, file, token),
    onMutate: ({ lang }) => setMessage(`A enviar MP3 ${lang.toUpperCase()} da ponte selecionada…`),
    onSuccess: (audio, target) => {
      replaceSelectedBridgeAudio(audio, target.segmentId, target.routeId);
      void queryClient.invalidateQueries({ queryKey: ['route-readiness', target.routeId] });
      setMessage(`Áudio manual ${target.lang.toUpperCase()} guardado e protegido.`);
    },
    onError: cause => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      setMessage(adminFailureMessage(cause, BRIDGE_UPLOAD_FAILURE));
    }
  });
  const busy = saveMutation.isPending || recalculateMutation.isPending || bridgeTranslationMutation.isPending || bridgeAudioMutation.isPending || bridgeUploadMutation.isPending;

  useUnsavedChanges(false, busy);

  function selectRoute(routeId: string) {
    navigateHash(itemContextHash('routes', { ...context, id: routeId, language: previewLang }));
  }

  function setSegments(segments: AdminRouteSegment[]) {
    setDraft((current) => ({ ...current, segments: normalizePositions(segments) }));
  }

  function selectSegment(id?: string) {
    if (id === selectedSegment?.id) return;
    if (busy) return;
    if (bridgeUnsaved) {
      if (!window.confirm('Há alterações na ponte EN. Descartar e trocar de etapa?')) return;
      bridgeRecovery.clear();
    }
    setSelectedSegmentId(id);
  }

  function updateSelectedSegment(patch: Partial<AdminRouteSegment>, segmentId = selectedSegment?.id, routeId = selectedId) {
    if (!segmentId || !routeId) return;
    const update = (segments: AdminRouteSegment[] = []) =>
      segments.map((segment) =>
        segment.id === segmentId ? ({ ...segment, ...patch } as AdminRouteSegment) : segment
      );
    if (selectedId === routeId) setDraft((current) => ({ ...current, segments: update(current.segments) }));
    queryClient.setQueryData<AdminRoute[]>(['narrative-routes', token], (current = []) =>
      current.map((route) =>
        route.id === routeId ? { ...route, segments: update(route.segments) } : route
      )
    );
  }

  function replaceSelectedBridgeAudio(
    audio: NonNullable<AdminRouteSegment['audio_files']>[number], segmentId = selectedSegment?.id, routeId = selectedId
  ) {
    const segments = selectedId === routeId ? draft.segments
      : queryClient.getQueryData<AdminRoute[]>(['narrative-routes', token])?.find(route => route.id === routeId)?.segments;
    const segment = segments?.find(item => item.id === segmentId);
    updateSelectedSegment({
      audio_files: [
        ...(segment?.audio_files ?? []).filter((item) => item.lang !== audio.lang),
        audio
      ]
    }, segmentId, routeId);
  }

  function uploadBridgeAudio(lang: 'pt' | 'en', file?: File) {
    if (!file || !selectedId || !selectedSegment?.id) return;
    if (!confirmAdminNavigation({ allowDirty: true })) return;
    if (selectedSegment.audio_files?.some(audio => audio.lang === lang && audio.public_url)
      && !window.confirm(`Substituir o áudio ${lang.toUpperCase()} da ponte selecionada pelo MP3 escolhido?`)) return;
    bridgeUploadMutation.mutate({ routeId: selectedId, segmentId: selectedSegment.id, lang, file });
  }

  if ((routesQuery.isLoading && !routesQuery.data) || (textsQuery.isLoading && !textsQuery.data)) {
    return <section className="route-loading">A preparar o editor narrativo…</section>;
  }

  if ((routesQuery.isError && !routesQuery.data) || (textsQuery.isError && !textsQuery.data)) {
    return (
      <section className="content-panel admin-state error-state">
        <p>Não foi possível carregar percursos e textos.</p>
        <button type="button" onClick={() => { routesQuery.refetch(); textsQuery.refetch(); }}>
          Tentar novamente
        </button>
      </section>
    );
  }

  if (context.id && context.id !== NEW_ROUTE_ID && routesQuery.isSuccess && !routes.some(route => route.id === context.id)) {
    return <section className="route-editor-shell"><p role="alert">O percurso deste link não foi encontrado.</p><button type="button" onClick={() => navigateHash(itemContextHash('routes'))}>Voltar à lista</button></section>;
  }

  return (
    <section className="route-editor-shell">
      {routesQuery.isError || textsQuery.isError ? <p role="alert">A atualização falhou. O editor e as alterações locais foram preservados. <button type="button" onClick={() => { void routesQuery.refetch(); void textsQuery.refetch(); }}>Tentar novamente</button></p> : null}
      <header className="route-editor-header">
        <div>
          <span className="eyebrow">Percursos narrativos</span>
          <h2>{draft.title_pt || 'Novo percurso'}</h2>
          <p>A narrativa ordena textos. O mapa apenas situa essa sequência em Lisboa.</p>
        </div>
        <div className="route-header-actions">
          <label className="route-publish-toggle">
            <input
              type="checkbox"
              checked={draft.is_published}
              disabled={busy || waypointsDirty || bridgeUnsaved || metadataDirty}
              onChange={(event) => setDraft({ ...draft, is_published: event.target.checked })}
            />
            Publicar
          </label>
          <button type="button" className="secondary-action" onClick={() => selectRoute(NEW_ROUTE_ID)}>
            Novo
          </button>
          <button
            type="button"
            disabled={busy || !draft.title_pt.trim() || (draft.is_published && (waypointsDirty || bridgeUnsaved || metadataDirty))}
            onClick={() => { if (confirmAdminNavigation({ allowDirty: true })) saveMutation.mutate(); }}
          >
            {saveMutation.isPending ? 'A guardar…' : 'Guardar percurso'}
          </button>
        </div>
      </header>

      <div className="route-status-line" aria-live="polite">
        <span className={busy || dirty || waypointsDirty || bridgeUnsaved || metadataDirty ? 'unsaved' : 'saved'}>{busy ? 'Operação em andamento — aguarde a confirmação' : waypointsDirty ? 'Waypoints por guardar — recalcule a caminhada' : dirty || bridgeUnsaved || metadataDirty ? 'Alterações por guardar' : 'Guardado'}</span>
        {message ? <span>{message}</span> : null}
      </div>

      <fieldset className="route-editor-grid route-editing-fields" disabled={busy} aria-busy={busy}>
        <aside className="route-catalog">
          <div className="route-catalog-heading">
            <h3>Percursos</h3>
            <span>{routes.length}</span>
          </div>
          <div className="route-list">
            {routes.map((route) => (
              <button
                type="button"
                key={route.id}
                className={selectedId === route.id ? 'active' : ''}
                onClick={() => selectRoute(route.id)}
              >
                <strong>{route.title_pt}</strong>
                <small>{route.segments?.filter((segment) => segment.kind === 'text').length ?? 0} textos</small>
              </button>
            ))}
          </div>

          <div className="available-texts-heading">
            <h3>Textos disponíveis</h3>
            <span>{availableTexts.length}</span>
          </div>
          <input
            type="search"
            value={search}
            placeholder="Autor, obra, excerto ou lugar"
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="available-text-list">
            {availableTexts.map((text) => (
              <button
                type="button"
                key={text.id}
                className="available-text-card"
                onClick={() => setSegments(addTextSegment(draft.segments, text))}
              >
                <strong>{text.author?.name ?? 'Autor por definir'}</strong>
                <span>{text.source_work || excerpt(text.content_pt, 74)}</span>
                <small>⌖ {text.point?.title_pt ?? 'Lugar por definir'}</small>
              </button>
            ))}
            {!availableTexts.length ? <p>Nenhum texto corresponde à busca.</p> : null}
          </div>
        </aside>

        <main className="route-narrative-editor">
          <section className="route-metadata-card">
            <label>
              Título em português
              <input
                value={draft.title_pt}
                onChange={(event) => setDraft({ ...draft, title_pt: event.target.value })}
              />
            </label>
            <label>
              Slug
              <input
                value={draft.slug}
                placeholder="do-tejo-ao-chiado"
                onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              />
            </label>
            <label className="route-wide-field">
              Descrição
              <textarea
                value={draft.description_pt}
                onChange={(event) => setDraft({ ...draft, description_pt: event.target.value })}
              />
            </label>
            <label>
              Dificuldade
              <select
                value={draft.difficulty}
                onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })}
              >
                <option value="easy">Fácil</option>
                <option value="medium">Média</option>
                <option value="hard">Difícil</option>
              </select>
            </label>
            <label>
              Imagem de capa
              <input
                type="url"
                value={draft.cover_image_url}
                onChange={(event) => setDraft({ ...draft, cover_image_url: event.target.value })}
              />
            </label>
          </section>

          {selectedId && selectedId !== NEW_ROUTE_ID ? <RouteMetadataTranslations key={selectedId} routeId={selectedId} userId={userId} token={token} onAuthExpired={onAuthExpired} onDirtyChange={setMetadataDirty} /> : null}

          <div className="route-builder-columns">
          <div className="route-story-column">
          <div className="narrative-heading">
            <div>
              <span className="eyebrow">Sequência narrativa</span>
              <h3>{draft.segments.length} segmentos</h3>
            </div>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setSegments(addBridgeSegment(draft.segments))}
            >
              + Ponte curatorial
            </button>
          </div>

          <div className="narrative-sequence">
            {draft.segments.map((segment, index) => (
              <article
                key={segment.id ?? `${segment.kind}-${index}`}
                className={`narrative-card ${segment.kind}${segment.id === selectedSegmentId ? ' selected' : ''}`}
                draggable
                onClick={() => selectSegment(segment.id)}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) setSegments(reorderSegments(draft.segments, dragIndex, index));
                  setDragIndex(null);
                }}
              >
                <div className="narrative-order">{index + 1}</div>
                {segment.kind === 'text' ? (
                  <div className="narrative-copy">
                    <span className="segment-kind">Texto</span>
                    <h4>{segment.text?.author?.name ?? 'Texto selecionado'}</h4>
                    <p>{segment.text?.source_work || excerpt(segment.text?.content_pt ?? '', 120)}</p>
                    <small>⌖ {segment.text?.point?.title_pt ?? 'Localização herdada do texto'}</small>
                  </div>
                ) : (
                  <label className="narrative-copy bridge-copy">
                    <span className="segment-kind">Ponte curatorial</span>
                    <textarea
                      value={segment.bridge_content_pt ?? ''}
                      placeholder="Introduza a passagem narrativa entre os textos…"
                      onChange={(event) =>
                        setSegments(
                          draft.segments.map((item, currentIndex) =>
                            currentIndex === index
                              ? { ...item, bridge_content_pt: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </label>
                )}
                <div className="narrative-actions">
                  <button
                    type="button"
                    className="text-action"
                    disabled={index === 0}
                    onClick={() => setSegments(reorderSegments(draft.segments, index, index - 1))}
                    aria-label="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-action"
                    disabled={index === draft.segments.length - 1}
                    onClick={() => setSegments(reorderSegments(draft.segments, index, index + 1))}
                    aria-label="Mover para baixo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-action delete-text-action"
                    onClick={() => setSegments(draft.segments.filter((_, current) => current !== index))}
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))}
            {!draft.segments.length ? (
              <div className="empty-narrative">
                <strong>A narrativa começa com um texto.</strong>
                <p>Escolha um texto disponível; a localização virá com ele.</p>
              </div>
            ) : null}
          </div>
          </div>

          <aside className="route-spatial-column">
            <section className="route-map-card">
              <div className="spatial-heading">
                <div>
                  <span className="eyebrow">Caminhada</span>
                  <h3>Mapa e pernas</h3>
                </div>
                <span className={`routing-state ${dirty || waypointsDirty ? 'stale' : selectedRoute?.routing_status ?? 'pending'}`}>
                  {dirty || waypointsDirty ? 'rota desatualizada' : routingLabel(selectedRoute?.routing_status)}
                </span>
              </div>
              <RouteMap
                segments={draft.segments}
                legs={selectedRoute?.legs ?? []}
                waypointDrafts={legWaypoints}
                selectedSegmentId={selectedSegmentId}
                addingWaypoint={addingWaypoint}
                canAddWaypoint={canUseServerTools && textSegments.length >= 2 && !busy}
                onSelectSegment={selectSegment}
                onAddWaypoint={(waypoint) => {
                  if (busy) return;
                  setLegWaypoints(addLegWaypoint(legWaypoints, selectedLegPosition, waypoint));
                  setAddingWaypoint(false);
                  setMessage('Waypoint adicionado à perna. Recalcule para o guardar.');
                }}
              />
              <div className="route-metrics">
                <div><strong>{formatDistance(selectedRoute?.estimated_distance_m)}</strong><span>distância</span></div>
                <div><strong>{formatDuration(selectedRoute?.estimated_duration_s)}</strong><span>caminhada</span></div>
                <div><strong>{textSegments.length}</strong><span>textos</span></div>
              </div>
              <div className="waypoint-editor">
                <label>
                  Perna pedonal
                  <select
                    value={selectedLegPosition}
                    onChange={(event) => setSelectedLegPosition(Number(event.target.value))}
                  >
                    {Array.from({ length: Math.max(0, textSegments.length - 1) }, (_, position) => (
                      <option key={position} value={position}>Perna {position + 1}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!canUseServerTools || textSegments.length < 2}
                  onClick={() => setAddingWaypoint((current) => !current)}
                >
                  {addingWaypoint ? 'Cancelar waypoint' : '+ Waypoint no mapa'}
                </button>
                {selectedLegWaypoints.map((waypoint, index) => (
                  <div className="waypoint-row" key={`${waypoint.lat}-${waypoint.lng}-${index}`}>
                    <span>{waypoint.lat.toFixed(5)}, {waypoint.lng.toFixed(5)}</span>
                    <button
                      type="button"
                      className="text-action delete-text-action"
                      onClick={() =>
                        setLegWaypoints(
                          removeLegWaypoint(legWaypoints, selectedLegPosition, index)
                        )
                      }
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="recalculate-route"
                disabled={!canUseServerTools || textSegments.length < 2 || recalculateMutation.isPending}
                onClick={() => { if (confirmAdminNavigation({ allowDirty: true })) recalculateMutation.mutate(); }}
              >
                {recalculateMutation.isPending ? 'A calcular rota…' : 'Recalcular caminhada'}
              </button>
            </section>

            <section className="route-readiness-card">
              <div className="spatial-heading">
                <div>
                  <span className="eyebrow">Publicação</span>
                  <h3>Prontidão PT/EN</h3>
                </div>
              </div>
              {!canUseServerTools ? <p>Guarde a narrativa antes de verificar as pendências.</p> : null}
              {canUseServerTools ? (
                <>
                  <ReadinessSummary label="PT" readiness={ptReadiness.data} loading={ptReadiness.isLoading} onIssue={selectSegment} />
                  <ReadinessSummary label="EN" readiness={enReadiness.data} loading={enReadiness.isLoading} onIssue={selectSegment} />
                </>
              ) : null}
            </section>

            <section className="route-preview-card">
              <div className="spatial-heading">
                <div>
                  <span className="eyebrow">Preview do visitante</span>
                  <h3>{selectedSegment ? `Etapa ${selectedSegment.position}` : 'Escolha uma etapa'}</h3>
                </div>
                <select value={previewLang} onChange={(event) => setPreviewLang(event.target.value as 'pt' | 'en')}>
                  <option value="pt">PT</option>
                  <option value="en">EN</option>
                </select>
              </div>
              <RouteSegmentPreview segment={selectedSegment} lang={previewLang} />
            </section>
            {selectedSegment?.kind === 'bridge' ? (
              <section className="route-bridge-editorial-card">
                <div className="spatial-heading">
                  <div>
                    <span className="eyebrow">Ponte selecionada</span>
                    <h3>EN e áudio curatorial</h3>
                  </div>
                </div>
                {bridgeUploadMutation.variables && bridgeUploadMutation.variables.segmentId === selectedSegment.id && bridgeUploadMutation.variables.routeId === selectedId ? <>
                  {bridgeUploadMutation.isPending ? <p role="status">A enviar MP3 {bridgeUploadMutation.variables.lang.toUpperCase()}… Aguarde a confirmação antes de sair.</p> : null}
                  {bridgeUploadMutation.isError ? <p role="alert" className="form-error">{adminFailureMessage(bridgeUploadMutation.error, BRIDGE_UPLOAD_FAILURE)}</p> : null}
                  {bridgeUploadMutation.isSuccess ? <p role="status">Áudio manual {bridgeUploadMutation.variables.lang.toUpperCase()} guardado e protegido.</p> : null}
                </> : null}
                <LocalDraftRecovery contextLabel="Ponte EN selecionada" savedAt={bridgeRecovery.candidate?.savedAt}
                  baseChanged={bridgeRecovery.baseChanged} onRestore={bridgeRecovery.restore}
                  onDiscard={() => { bridgeRecovery.clear(); requestAnimationFrame(() => bridgeInput.current?.focus()); }}
                  warning={bridgeRecovery.warning} notice={bridgeRecovery.notice} />
                {!remoteBridge ? <p>Guarde primeiro a narrativa para criar esta etapa no servidor e editar a sua versão EN.</p> : null}
                <label>
                  Texto em inglês
                  <textarea
                    ref={bridgeInput}
                    value={bridgeEnglish}
                    disabled={!bridgeReady || bridgeBlocked || bridgeTranslationMutation.isPending}
                    onChange={(event) => {
                      setBridgeBaseline(current => current ?? { content: bridgeRemoteContent });
                      setBridgeEnglish(event.target.value);
                      setMessage(''); bridgeTranslationMutation.reset();
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!canUseServerTools || !bridgeReady || bridgeBlocked || !selectedSegment.id || !bridgeEnglish.trim() || bridgeTranslationMutation.isPending}
                  onClick={() => { if (confirmAdminNavigation({ allowDirty: true })) bridgeTranslationMutation.mutate(); }}
                >
                  Rever e guardar EN
                </button>
                {bridgeTranslationMutation.isError ? <p role="alert" className="form-error">{adminFailureMessage(bridgeTranslationMutation.error, 'Não foi possível guardar a ponte EN. O rascunho foi preservado.')}</p> : null}
                {(['pt', 'en'] as const).map((lang) => {
                  const audio = selectedSegment.audio_files?.find((item) => item.lang === lang);
                  return (
                    <div className="bridge-audio-row" key={lang}>
                      <div>
                        <strong>{lang.toUpperCase()}</strong>
                        <span>{audio?.public_url ? (audio.manually_uploaded ? 'manual protegido' : 'gerado') : 'em falta'}</span>
                      </div>
                      <button
                        type="button"
                        className="secondary-action"
                        disabled={!canUseServerTools || bridgeAudioMutation.isPending}
                        onClick={() => { if (confirmAdminNavigation({ allowDirty: true })) bridgeAudioMutation.mutate(lang); }}
                      >
                        Gerar
                      </button>
                      <label className="bridge-upload-action">
                        MP3
                        <input
                          type="file"
                          accept="audio/mpeg,.mp3"
                          aria-label={`Enviar MP3 ${lang.toUpperCase()} da ponte selecionada`}
                          disabled={!canUseServerTools || busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            uploadBridgeAudio(lang, file);
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </section>
            ) : null}
          </aside>
          </div>
        </main>
      </fieldset>
    </section>
  );
}

function waypointFingerprint(legs: RouteLegWaypointDraft[]) {
  return JSON.stringify(legs.filter(leg => leg.waypoints.length).map(leg => ({
    position: leg.position, waypoints: leg.waypoints
  })).sort((a, b) => a.position - b.position));
}

function storageKey(routeId: string, userId: string) {
  return `ecosdelisboa.route-draft.v2.${userId}.${routeId}`;
}

function readLocalDraft(routeId: string, userId: string): { narrative: RouteDraft; waypoints: RouteLegWaypointDraft[] } | null {
  try {
    const stored = localStorage.getItem(storageKey(routeId, userId));
    if (!stored) return null;
    const value = JSON.parse(stored);
    if (value.version !== 2 || !value.narrative || typeof value.narrative.title_pt !== 'string'
      || !Array.isArray(value.narrative.segments) || !Array.isArray(value.waypoints)) return null;
    if (!['slug', 'description_pt', 'cover_image_url', 'difficulty'].every(key => typeof value.narrative[key] === 'string')
      || typeof value.narrative.is_published !== 'boolean') return null;
    if (!value.narrative.segments.every((segment: AdminRouteSegment) => segment
      && (segment.kind === 'text' || segment.kind === 'bridge')
      && (segment.bridge_content_pt == null || typeof segment.bridge_content_pt === 'string'))) return null;
    if (!value.waypoints.every((leg: RouteLegWaypointDraft) => Number.isInteger(leg.position)
      && leg.position >= 0 && Array.isArray(leg.waypoints) && leg.waypoints.every(point => point
        && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
        && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180))) return null;
    return value;
  } catch {
    return null;
  }
}

function excerpt(value: string, length: number) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > length ? `${compact.slice(0, length)}…` : compact;
}

function ReadinessSummary({
  label,
  readiness,
  loading,
  onIssue
}: {
  label: string;
  readiness?: RouteReadiness;
  loading: boolean;
  onIssue: (segmentId: string) => void;
}) {
  return (
    <div className={`readiness-language${readiness?.ready ? ' ready' : ''}`}>
      <div>
        <strong>{label}</strong>
        <span>{loading ? 'a verificar…' : readiness?.ready ? 'pronto' : `${readiness?.issues.length ?? 0} pendências`}</span>
      </div>
      {readiness?.issues.slice(0, 5).map((issue) =>
        issue.segment_id ? (
          <button type="button" key={`${issue.code}-${issue.path}`} onClick={() => onIssue(issue.segment_id!)}>
            {readinessIssueLabel(issue.code)}
          </button>
        ) : issue.code.includes('route_translation') ? (
          <a key={`${issue.code}-${issue.path}`} href="#route-metadata-en" onClick={event => {
            event.preventDefault();
            document.getElementById('route-metadata-en')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.querySelector<HTMLInputElement>('#route-metadata-en input')?.focus();
          }}>{readinessIssueLabel(issue.code)}</a>
        ) : (
          <p key={`${issue.code}-${issue.path}`}>{readinessIssueLabel(issue.code)}</p>
        )
      )}
    </div>
  );
}

function RouteSegmentPreview({
  segment,
  lang
}: {
  segment?: AdminRouteSegment;
  lang: 'pt' | 'en';
}) {
  if (!segment) return <p>Selecione um texto ou uma ponte na sequência.</p>;
  if (segment.kind === 'text') {
    const translation = segment.text?.translations?.find(
      (item) => item.lang === lang && item.status === 'approved'
    );
    const content = lang === 'pt' ? segment.text?.content_pt : translation?.content;
    const audio = segment.text?.audio_files?.find((item) => item.lang === lang && item.public_url);
    return (
      <div className="visitor-preview-copy">
        <span>{segment.text?.author?.name ?? 'Autor'}</span>
        <h4>{segment.text?.source_work ?? segment.text?.point?.title_pt ?? 'Texto'}</h4>
        <small>⌖ {segment.text?.point?.title_pt ?? 'Lugar por definir'}</small>
        <p>{content || `Tradução ${lang.toUpperCase()} em falta.`}</p>
        {audio?.public_url ? <audio controls preload="none" src={audio.public_url} /> : <em>Áudio {lang.toUpperCase()} em falta</em>}
      </div>
    );
  }
  const translation = segment.translations?.find(
    (item) => item.lang === lang && item.status === 'approved'
  );
  const content = lang === 'pt' ? segment.bridge_content_pt : translation?.content;
  const audio = segment.audio_files?.find((item) => item.lang === lang && item.public_url);
  return (
    <div className="visitor-preview-copy bridge-preview-copy">
      <span>Ponte curatorial</span>
      <p>{content || `Tradução ${lang.toUpperCase()} em falta.`}</p>
      {audio?.public_url ? <audio controls preload="none" src={audio.public_url} /> : <em>Áudio {lang.toUpperCase()} em falta</em>}
    </div>
  );
}

function readinessIssueLabel(code: string) {
  const labels: Record<string, string> = {
    missing_title: 'Completar título',
    missing_description: 'Completar descrição',
    missing_difficulty: 'Definir dificuldade',
    missing_route_translation: 'Traduzir metadados',
    too_few_texts: 'Adicionar pelo menos dois textos',
    missing_text_translation: 'Rever tradução do texto',
    missing_text_audio: 'Gerar áudio do texto',
    missing_bridge_translation: 'Traduzir ponte',
    missing_bridge_audio: 'Gerar áudio da ponte',
    routing_stale: 'Recalcular caminhada',
    legacy_segment: 'Rever etapa legada'
  };
  return labels[code] ?? code;
}

function routingLabel(status?: string) {
  if (status === 'ready') return 'rota atual';
  if (status === 'failed') return 'falhou';
  if (status === 'stale') return 'desatualizada';
  return 'por calcular';
}

function formatDistance(distance?: number | null) {
  if (!distance) return '—';
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
}

function formatDuration(duration?: number | null) {
  if (!duration) return '—';
  return `${Math.max(1, Math.round(duration / 60))} min`;
}
