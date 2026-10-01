import type { AdminPoint, AdminRouteReadiness, AdminText, ContentGenerationBatch, RouteReadinessIssue } from '@ecosdelisboa/shared';
import { itemContextHash, textContextHash } from '../adminNavigation.ts';
import { DRAFT_PREFIX, readLocalDraft, type DraftStorage } from '../localDraftStore.ts';
import { validateResourceDraft } from '../resourceDraftSchema.ts';
import { validateTextVersionSnapshot } from '../textVersionDrafts.ts';
import { validatePointTranslationDraft } from '../pointTranslationDraft.ts';
import { validateRouteMetadataDraft } from '../routeMetadataDraft.ts';
import { extractLegacyRouteDraft, validateRouteNarrativeDraft } from '../routeNarrativeDraft.ts';
import { validateBridgeDraft } from '../bridgeDraft.ts';

export type EditorialTask = { id: string; title: string; detail: string; hash: string };
export const textLabel = (text: AdminText) => [text.author?.name, text.source_work || text.content_pt.slice(0, 70)].filter(Boolean).join(' — ');

export function reviewTasks(texts: AdminText[], points: AdminPoint[]): EditorialTask[] {
  return [
    ...texts.flatMap(text => (text.translations ?? []).filter(version => version.status === 'pending').map(version => ({
      id: `text:${text.id}:${version.lang}`, title: textLabel(text), detail: `Texto · ${version.lang.toUpperCase()} · tradução por rever`,
      hash: textContextHash(text.id, version.lang)
    }))),
    ...points.flatMap(point => (point.translations ?? []).filter(version => version.status === 'pending').map(version => ({
      id: `point:${point.id}:${version.lang}`, title: point.title_pt, detail: `Ponto · ${version.lang.toUpperCase()} · tradução por rever`,
      hash: itemContextHash('points', { id: point.id, language: version.lang })
    })))
  ];
}

const issueLabels: Record<string, string> = {
  missing_title: 'Completar título PT', missing_description: 'Completar descrição PT', missing_difficulty: 'Definir dificuldade',
  missing_route_translation: 'Rever título e descrição traduzidos', too_few_texts: 'Adicionar pelo menos dois textos',
  legacy_segment: 'Rever etapa legada', invalid_coordinates: 'Corrigir coordenadas do ponto',
  missing_text_translation: 'Rever tradução do texto', missing_text_audio: 'Preparar áudio do texto',
  missing_bridge_translation: 'Rever tradução da ponte', missing_bridge_audio: 'Preparar áudio da ponte', routing_stale: 'Recalcular caminhada'
};
function issueDestination(route: AdminRouteReadiness, issue: RouteReadinessIssue, language: string) {
  const segment = route.segments.find(item => item.id === issue.segment_id);
  if (issue.code === 'invalid_coordinates' && segment?.point_id) return itemContextHash('points', { id: segment.point_id });
  if (issue.code.startsWith('missing_text_') && segment?.text_id) return textContextHash(segment.text_id, language);
  return itemContextHash('routes', { id: route.id, language, segment: issue.segment_id ?? undefined });
}
export function routeTasks(routes: AdminRouteReadiness[]): EditorialTask[] {
  return routes.flatMap(route => route.readiness.flatMap(readiness => readiness.issues.map(issue => ({
    id: `${route.id}:${readiness.lang}:${issue.code}:${issue.path}`, title: route.title_pt || 'Percurso sem título',
    detail: `${route.is_published ? 'Publicado' : 'Não publicado'} · ${readiness.lang.toUpperCase()} · ${issueLabels[issue.code] ?? issue.message}`,
    hash: issueDestination(route, issue, readiness.lang)
  }))));
}
export function batchTasks(batches: ContentGenerationBatch[]): EditorialTask[] {
  return batches.flatMap(batch => batch.errors.map((error, index) => ({
    id: `${batch.id}:${index}`, title: `Lote · ${new Date(batch.created_at).toLocaleString('pt-PT')}`,
    detail: `${error.lang.toUpperCase()} · ${error.kind === 'audio' ? 'Áudio' : 'Tradução'} · ${error.message || 'Falha no processamento'}`,
    hash: error.target_kind === 'point' ? itemContextHash('points', { id: error.target_id, language: error.lang })
      : textContextHash(error.target_id, error.lang)
  })));
}

/** Read-only inventory. Domain validators own recovery; this never restores or deletes a copy. */
export function localDraftTasks(storage: DraftStorage, userId: string, now = Date.now()): EditorialTask[] {
  const tasks: EditorialTask[] = [];
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
  const readOnly = { length: storage.length, key: storage.key.bind(storage), getItem: storage.getItem.bind(storage),
    setItem: () => {}, removeItem: () => {} };
  for (const key of keys) {
    if (!key) continue;
    const prefix = `${DRAFT_PREFIX}${encodeURIComponent(userId)}:`;
    if (key.startsWith(prefix)) {
      let parts: string[];
      try { parts = key.slice(prefix.length).split(':').map(decodeURIComponent); } catch { continue; }
      if (parts.length !== 3) continue;
      const [entity, id, language] = parts;
      const bridgeRoute = entity.startsWith('route-bridge:') ? entity.slice(13) : undefined;
      const validator: (value: unknown) => unknown = entity === 'text-versions' ? validateTextVersionSnapshot
        : entity === 'point-translations' ? validatePointTranslationDraft : entity === 'route-metadata' ? validateRouteMetadataDraft
        : entity === 'route-narrative' ? validateRouteNarrativeDraft : bridgeRoute ? validateBridgeDraft : value => validateResourceDraft(entity, value);
      const entry = readLocalDraft(readOnly, { userId, entity, id, language }, validator, now);
      if (!entry) continue;
      const hash = entity === 'texts' || entity === 'text-versions' ? textContextHash(id === 'new' ? undefined : id, language)
        : entity === 'point-translations' ? itemContextHash('points', { id, language })
        : bridgeRoute ? itemContextHash('routes', { id: bridgeRoute, language, segment: id })
        : entity.startsWith('route-') ? itemContextHash('routes', { id, language })
        : itemContextHash(entity as 'authors' | 'points' | 'point-types', { id: id === 'new' ? undefined : id });
      const value = entry.value as Record<string, unknown>;
      const label = ['name', 'title_pt', 'title', 'source_work', 'content_pt', 'content']
        .map(field => value[field]).find(item => typeof item === 'string' && item.trim()) as string | undefined;
      tasks.push({ id: key, title: `${entityLabels[entity] ?? (bridgeRoute ? 'Ponte' : entity)} · ${label?.slice(0, 90) || (id === 'new' ? 'novo item' : id)} · rascunho local`,
        detail: `${language.toUpperCase()} · ${new Date(entry.savedAt).toLocaleString('pt-PT')} · não guardado no servidor`, hash });
    } else {
      const legacy = `ecosdelisboa.route-draft.v2.${userId}.`;
      if (!key.startsWith(legacy)) continue;
      const id = key.slice(legacy.length);
      if (!id || id.includes('.') || !extractLegacyRouteDraft(storage.getItem(key) ?? '')) continue;
      tasks.push({ id: key, title: 'Percurso · cópia antiga', detail: 'Data desconhecida · restaurar e comparar no editor', hash: itemContextHash('routes', { id }) });
    }
  }
  return tasks;
}
const entityLabels: Record<string, string> = { authors: 'Autor', points: 'Ponto', 'point-types': 'Tipo de ponto', texts: 'Texto',
  'text-versions': 'Versão do texto', 'point-translations': 'Tradução do ponto', 'route-metadata': 'Metadados do percurso', 'route-narrative': 'Narrativa e caminhada' };
