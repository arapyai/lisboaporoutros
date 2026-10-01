import {
  ApiError,
  type AdminRoute,
  type AdminRouteSegment,
  type AdminText
} from '@ecosdelisboa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { client } from '../adminConfig';
import { putMp3, redirectIfAuthError } from '../adminApi';
import {
  addLegWaypoint,
  addTextSegment,
  draftFingerprint,
  emptyRouteDraft,
  filterAvailableTexts,
  normalizePositions,
  removeLegWaypoint,
  routeDraftFromRoute,
  serializeRouteSave,
  waypointDraftFromLegs,
  type RouteLegWaypointDraft,
  type RouteDraft
} from './routeEditorModel';
import { RouteWalkingCard } from './RouteWalkingCard';
import { RoutePublicationCard } from './RoutePublicationCard';
import { RouteCatalog } from './RouteCatalog';
import { RouteMetadataFields } from './RouteMetadataFields';
import { RouteSequence } from './RouteSequence';
import { RouteVisitorPreview } from './RouteVisitorPreview';
import { RouteBridgeEditorialCard } from './RouteBridgeEditorialCard';
import { RouteMetadataTranslations } from './RouteMetadataTranslations';
import { confirmAdminNavigation, useUnsavedChanges } from '../unsavedChanges';
import { itemContextFromHash, itemContextHash } from '../adminNavigation';
import { adminFailureMessage } from '../adminErrorMessages';
import { useLocalDraft } from '../useLocalDraft';
import { LocalDraftRecovery } from '../components/LocalDraftRecovery';
import { validateBridgeDraft, type BridgeDraft } from '../bridgeDraft';
import { extractLegacyRouteDraft, legacyRouteDraftKey, restoreRouteNarrative, routeNarrativeDraft, validateRouteNarrativeDraft } from '../routeNarrativeDraft';
import { localDraftKey, writeLocalDraft } from '../localDraftStore';

const NEW_ROUTE_ID = 'new';
const BRIDGE_UPLOAD_FAILURE = 'Falha no upload do áudio da ponte. O áudio anterior foi preservado. Selecione o ficheiro novamente para tentar.';
const LEGACY_NARRATIVE_NOTICE = 'Cópia antiga convertida: não tinha data nem base histórica. A data indica a conversão; compare com o servidor antes de guardar. Publicação, revisão e áudio não foram importados.';

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
  const [narrativeHydratedId, setNarrativeHydratedId] = useState<string>();
  const [narrativeBaseline, setNarrativeBaseline] = useState(() => routeNarrativeDraft(emptyRouteDraft(), []));
  const [legacyNotice, setLegacyNotice] = useState('');
  const [legacyWarning, setLegacyWarning] = useState('');
  const titleInput = useRef<HTMLInputElement>(null);
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
  const selectedSegment =
    draft.segments.find((segment) => segment.id === selectedSegmentId) ?? draft.segments[0];
  const narrativeIdentity = { userId, entity: 'route-narrative', id: selectedId ?? '', language: 'pt' };
  const narrativeRecovery = useLocalDraft({ identity: narrativeIdentity, baseline: narrativeBaseline,
    remoteBaseline: routeNarrativeDraft(selectedRoute ? routeDraftFromRoute(selectedRoute) : emptyRouteDraft(), waypointDraftFromLegs(selectedRoute?.legs)),
    value: routeNarrativeDraft(draft, legWaypoints), ready: Boolean(selectedId && narrativeHydratedId === selectedId),
    validate: validateRouteNarrativeDraft,
    onRestore: (value, baseline) => {
      setNarrativeBaseline(baseline);
      setDraft(restoreRouteNarrative(value, selectedRoute ? routeDraftFromRoute(selectedRoute) : emptyRouteDraft(), textsQuery.data ?? []));
      setLegWaypoints(value.waypoints);
      requestAnimationFrame(() => titleInput.current?.focus());
    }
  });
  const narrativeBlocked = narrativeRecovery.inspecting || Boolean(narrativeRecovery.candidate) || narrativeHydratedId !== selectedId;
  const canUseServerTools = Boolean(selectedRoute && selectedId !== NEW_ROUTE_ID && !dirty && !narrativeBlocked);
  function discardNarrativeCopy() {
    narrativeRecovery.clear();
    clearLegacyCopy();
  }
  function clearLegacyCopy() {
    try { localStorage.removeItem(legacyRouteDraftKey(userId, selectedId ?? NEW_ROUTE_ID)); setLegacyNotice(''); }
    catch { setLegacyWarning('Não foi possível limpar a cópia antiga neste navegador.'); }
  }
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
  useUnsavedChanges(bridgeUnsaved, false, bridgeRecovery.clear);
  const ptReadiness = useQuery({
    queryKey: ['route-readiness', selectedId, 'pt', token],
    queryFn: () => client.getRouteReadiness(selectedId!, 'pt', token),
    enabled: canUseServerTools,
    retry: false
  });
  const enReadiness = useQuery({
    queryKey: ['route-readiness', selectedId, 'en', token],
    queryFn: () => client.getRouteReadiness(selectedId!, 'en', token),
    enabled: canUseServerTools,
    retry: false
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
        setNarrativeBaseline(current => ({ ...routeNarrativeDraft(refreshed, current.waypoints) }));
      }
      return;
    }
    hydratedRouteId.current = selectedId;
    const waypointBaseline = waypointDraftFromLegs(selectedRoute?.legs);
    setSavedWaypoints(waypointFingerprint(waypointBaseline));
    const baseline =
      selectedId === NEW_ROUTE_ID || !selectedRoute
        ? emptyRouteDraft()
        : routeDraftFromRoute(selectedRoute);
    const recoveryBaseline = routeNarrativeDraft(baseline, waypointBaseline);
    setLegacyNotice(''); setLegacyWarning('');
    try {
      const oldKey = legacyRouteDraftKey(userId, selectedId);
      const old = localStorage.getItem(oldKey);
      if (old && !localStorage.getItem(localDraftKey(narrativeIdentity))) {
        const sanitized = extractLegacyRouteDraft(old);
        if (sanitized) {
          writeLocalDraft(localStorage, narrativeIdentity, recoveryBaseline, sanitized);
          localStorage.removeItem(oldKey);
          setLegacyNotice(LEGACY_NARRATIVE_NOTICE);
        } else setLegacyWarning('A cópia antiga deste percurso não pôde ser convertida. Não foi apagada; os dados do servidor continuam disponíveis.');
      }
    } catch { setLegacyWarning('Não foi possível converter a cópia antiga neste navegador. Ela não foi descartada intencionalmente; guarde o trabalho no servidor antes de sair.'); }
    setNarrativeBaseline(recoveryBaseline);
    setNarrativeHydratedId(selectedId);
    setLegWaypoints(waypointBaseline);
    skipWaypointsSync.current = true;
    setDraft(baseline);
    setSavedFingerprint(draftFingerprint(baseline));
    setSelectedSegmentId(baseline.segments.some(segment => segment.id === context.segment) ? context.segment : baseline.segments[0]?.id);
  }, [selectedId, selectedRoute, userId]);

  useEffect(() => {
    if (skipWaypointsSync.current) { skipWaypointsSync.current = false; return; }
    if (waypointsDirty && hydratedRouteId.current === selectedId) return;
    const next = waypointDraftFromLegs(selectedRoute?.legs);
    setLegWaypoints(next);
    setSavedWaypoints(waypointFingerprint(next));
    setNarrativeBaseline(current => ({ ...current, waypoints: next }));
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = serializeRouteSave(draft, Boolean(selectedRoute?.is_published));
      return selectedId === NEW_ROUTE_ID
        ? client.post<AdminRoute>('/api/v1/admin/routes', payload, token)
        : client.put<AdminRoute>(`/api/v1/admin/routes/${selectedId}`, payload, token);
    },
    onSuccess: (saved) => {
      clearLegacyCopy();
      queryClient.setQueryData<AdminRoute[]>(['narrative-routes', token], (current = []) => {
        const exists = current.some((route) => route.id === saved.id);
        return exists
          ? current.map((route) => (route.id === saved.id ? saved : route))
          : [saved, ...current];
      });
      const next = routeDraftFromRoute(saved);
      setNarrativeBaseline(current => routeNarrativeDraft(next, current.waypoints));
      if (selectedId === NEW_ROUTE_ID) { discardNarrativeCopy(); setNarrativeHydratedId(undefined); }
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
      setMessage('Não foi possível guardar o percurso. As alterações continuam nesta edição; confira o aviso de recuperação local antes de sair.');
    }
  });

  const publicationMutation = useMutation({
    mutationFn: (published: boolean) => client.put<{ id: string; is_published: boolean }>(
      `/api/v1/admin/routes/${selectedId}/publication`, { is_published: published }, token),
    onSuccess: (result) => {
      queryClient.setQueryData<AdminRoute[]>(['narrative-routes', token], (current = []) =>
        current.map(route => route.id === result.id ? { ...route, is_published: result.is_published } : route));
      const next = { ...draft, is_published: result.is_published };
      setDraft(next); setSavedFingerprint(draftFingerprint(next));
      setMessage(result.is_published ? 'Percurso publicado.' : 'Percurso retirado de publicação.');
      void queryClient.invalidateQueries({ queryKey: ['route-readiness', selectedId] });
    },
    onError: (cause) => {
      if (redirectIfAuthError(cause, onAuthExpired)) return;
      setMessage(cause instanceof ApiError && cause.status === 409
        ? 'Publicação bloqueada pelo servidor: confira as pendências de PT/EN e da caminhada.'
        : adminFailureMessage(cause, 'Não foi possível alterar a publicação. O estado anterior foi preservado.'));
      void queryClient.invalidateQueries({ queryKey: ['route-readiness', selectedId] });
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
      setNarrativeBaseline(current => ({ ...current, waypoints: waypointDraftFromLegs(result.legs) }));
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
  const busy = saveMutation.isPending || publicationMutation.isPending || recalculateMutation.isPending || bridgeTranslationMutation.isPending || bridgeAudioMutation.isPending || bridgeUploadMutation.isPending;

  useUnsavedChanges(false, busy);
  useUnsavedChanges(dirty || waypointsDirty || Boolean(narrativeRecovery.candidate), false, discardNarrativeCopy,
    !narrativeBlocked && !waypointsDirty && Boolean(draft.title_pt.trim()) && routesQuery.isSuccess && textsQuery.isSuccess
      && Boolean(selectedId === NEW_ROUTE_ID || selectedRoute) ? () => saveMutation.mutateAsync() : undefined);

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

  function removeSegment(index: number) {
    if (!confirmAdminNavigation({ allowDirty: true })) return;
    const removingSelected = draft.segments[index]?.id === selectedSegment?.id;
    if (removingSelected && bridgeUnsaved) {
      if (!window.confirm('Há alterações na ponte EN. Descartar o rascunho EN e remover esta etapa da narrativa local?')) return;
      bridgeRecovery.clear();
    }
    const remaining = draft.segments.filter((_, current) => current !== index);
    if (removingSelected) setSelectedSegmentId(remaining[Math.min(index, remaining.length - 1)]?.id);
    setSegments(remaining);
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
          <button type="button" className="secondary-action" onClick={() => selectRoute(NEW_ROUTE_ID)}>
            Novo
          </button>
          <button
            type="button"
            disabled={busy || narrativeBlocked || !draft.title_pt.trim()}
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

      <LocalDraftRecovery contextLabel="Narrativa e waypoints" savedAt={narrativeRecovery.candidate?.savedAt}
        baseChanged={narrativeRecovery.baseChanged} onRestore={narrativeRecovery.restore}
        onDiscard={discardNarrativeCopy} warning={narrativeRecovery.warning || legacyWarning} notice={narrativeRecovery.notice} />
      {legacyNotice || narrativeRecovery.candidate?.value.legacyBaselineUnknown ? <p role="status">{LEGACY_NARRATIVE_NOTICE}</p> : null}
      <fieldset className="route-editor-grid route-editing-fields" disabled={busy || narrativeBlocked} aria-busy={busy}>
        <RouteCatalog routes={routes} selectedId={selectedId} availableTexts={availableTexts}
          search={search} onSearch={setSearch} onSelect={selectRoute}
          onAddText={text => setSegments(addTextSegment(draft.segments, text))} />

        <main className="route-narrative-editor">
          <RouteMetadataFields draft={draft} onDraft={setDraft} titleInput={titleInput} />

          {selectedId && selectedId !== NEW_ROUTE_ID ? <RouteMetadataTranslations key={selectedId} routeId={selectedId} userId={userId} token={token} onAuthExpired={onAuthExpired} onDirtyChange={setMetadataDirty} /> : null}

          <div className="route-builder-columns">
            <div className="route-story-column">
              <RouteSequence segments={draft.segments} selectedSegmentId={selectedSegmentId}
                onSegments={setSegments} onSelect={selectSegment} onRemove={removeSegment} />
            </div>

          <aside className="route-spatial-column">
            <RouteWalkingCard selectedRoute={selectedRoute} segments={draft.segments} legWaypoints={legWaypoints}
              selectedSegmentId={selectedSegmentId} selectedLegPosition={selectedLegPosition}
              addingWaypoint={addingWaypoint} canUseServerTools={canUseServerTools} busy={busy}
              dirty={dirty} waypointsDirty={waypointsDirty} recalculating={recalculateMutation.isPending}
              selectSegment={selectSegment} setSelectedLegPosition={setSelectedLegPosition}
              onToggleWaypoint={() => setAddingWaypoint(current => !current)}
              onRemoveWaypoint={index => setLegWaypoints(removeLegWaypoint(legWaypoints, selectedLegPosition, index))}
              onAddWaypoint={waypoint => {
                if (busy) return;
                setLegWaypoints(addLegWaypoint(legWaypoints, selectedLegPosition, waypoint));
                setAddingWaypoint(false);
                setMessage('Waypoint adicionado à perna. Recalcule para o guardar.');
              }}
              onRecalculate={() => { if (confirmAdminNavigation({ allowDirty: true })) recalculateMutation.mutate(); }} />

            <RoutePublicationCard published={Boolean(selectedRoute?.is_published)} disabled={busy || !canUseServerTools || waypointsDirty || bridgeUnsaved || metadataDirty
                || (!selectedRoute?.is_published && (!ptReadiness.data?.ready || !enReadiness.data?.ready || ptReadiness.isError || enReadiness.isError))}
              publishing={publicationMutation.isPending} hasLocalChanges={dirty || waypointsDirty || bridgeUnsaved || metadataDirty}
              canUseServerTools={canUseServerTools} ptReadiness={ptReadiness} enReadiness={enReadiness}
              selectSegment={selectSegment} onPublication={() => {
                  if (!confirmAdminNavigation({ allowDirty: true })) return;
                  const publish = !selectedRoute?.is_published;
                  if (window.confirm(publish ? 'Publicar este percurso para os visitantes? O servidor verificará a prontidão novamente.'
                    : 'Retirar este percurso de publicação? Os visitantes deixarão de o ver.')) publicationMutation.mutate(publish);}} />

            <RouteVisitorPreview selectedSegment={selectedSegment} previewLang={previewLang} onLanguage={setPreviewLang} />
            {selectedSegment?.kind === 'bridge' ? (
              <RouteBridgeEditorialCard selectedSegment={selectedSegment} selectedId={selectedId}
                remoteBridge={Boolean(remoteBridge)} bridgeReady={bridgeReady} bridgeBlocked={bridgeBlocked}
                bridgeEnglish={bridgeEnglish} bridgeInput={bridgeInput} bridgeRecovery={bridgeRecovery}
                bridgeUploadMutation={bridgeUploadMutation} bridgeTranslationMutation={bridgeTranslationMutation}
                audioPending={bridgeAudioMutation.isPending} canUseServerTools={canUseServerTools} busy={busy}
                onEnglish={value => {
                  setBridgeBaseline(current => current ?? { content: bridgeRemoteContent });
                  setBridgeEnglish(value);
                  setMessage(''); bridgeTranslationMutation.reset();
                }}
                onReview={() => { if (confirmAdminNavigation({ allowDirty: true })) bridgeTranslationMutation.mutate(); }}
                onGenerate={lang => { if (confirmAdminNavigation({ allowDirty: true })) bridgeAudioMutation.mutate(lang); }}
                onUpload={uploadBridgeAudio} />
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
