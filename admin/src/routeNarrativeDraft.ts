import type { AdminText } from '@ecosdelisboa/shared';
import type { RouteDraft, RouteLegWaypointDraft } from './routes/routeEditorModel';

type SegmentDraft = { id?: string; kind: 'text'; text_id: string } | { id?: string; kind: 'bridge'; bridge_content_pt: string };
export type RouteNarrativeDraft = {
  title_pt: string; slug: string; description_pt: string; cover_image_url: string; difficulty: string;
  segments: SegmentDraft[]; waypoints: RouteLegWaypointDraft[];
  legacyBaselineUnknown?: true;
};

export function routeNarrativeDraft(draft: RouteDraft, waypoints: RouteLegWaypointDraft[]): RouteNarrativeDraft {
  return { title_pt: draft.title_pt, slug: draft.slug, description_pt: draft.description_pt,
    cover_image_url: draft.cover_image_url, difficulty: draft.difficulty,
    segments: draft.segments.map(segment => ({ ...(segment.id ? { id: segment.id } : {}),
      ...(segment.kind === 'text' ? { kind: 'text' as const, text_id: segment.text_id ?? '' }
        : { kind: 'bridge' as const, bridge_content_pt: segment.bridge_content_pt ?? '' }) })),
    waypoints: waypoints.map(leg => ({ position: leg.position, waypoints: leg.waypoints.map(point => ({ lat: point.lat, lng: point.lng })) })) };
}

export function validateRouteNarrativeDraft(value: unknown): RouteNarrativeDraft | null {
  if (!record(value) || Object.keys(value).length !== (value.legacyBaselineUnknown === true ? 8 : 7)
    || ('legacyBaselineUnknown' in value && value.legacyBaselineUnknown !== true)
    || !['title_pt', 'slug', 'description_pt', 'cover_image_url', 'difficulty'].every(key => typeof value[key] === 'string')
    || !Array.isArray(value.segments) || !Array.isArray(value.waypoints)) return null;
  const ids = new Set<string>();
  for (const segment of value.segments) {
    if (!record(segment) || (segment.id !== undefined && (typeof segment.id !== 'string' || !segment.id || ids.has(segment.id)))) return null;
    if (segment.id) ids.add(segment.id as string);
    const keys = segment.id === undefined ? 2 : 3;
    if (Object.keys(segment).length !== keys || !(segment.kind === 'text' && typeof segment.text_id === 'string' && segment.text_id
      || segment.kind === 'bridge' && typeof segment.bridge_content_pt === 'string')) return null;
  }
  const positions = new Set<number>();
  for (const leg of value.waypoints) {
    if (!record(leg) || Object.keys(leg).length !== 2 || !Number.isInteger(leg.position) || (leg.position as number) < 0
      || positions.has(leg.position as number) || !Array.isArray(leg.waypoints)) return null;
    positions.add(leg.position as number);
    if (!leg.waypoints.every(point => record(point) && Object.keys(point).length === 2
      && typeof point.lat === 'number' && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
      && typeof point.lng === 'number' && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180)) return null;
  }
  return value as RouteNarrativeDraft;
}

export function restoreRouteNarrative(value: RouteNarrativeDraft, remote: RouteDraft, texts: AdminText[]): RouteDraft {
  return { ...remote, title_pt: value.title_pt, slug: value.slug, description_pt: value.description_pt,
    cover_image_url: value.cover_image_url, difficulty: value.difficulty,
    segments: value.segments.map((segment, index) => {
      const saved = remote.segments.find(item => item.id === segment.id && item.kind === segment.kind
        && (segment.kind !== 'text' || item.text_id === segment.text_id));
      return { ...saved, ...segment, position: index + 1, id: segment.id ?? `local-${segment.kind}-${crypto.randomUUID()}`,
        ...(segment.kind === 'text' ? { text: texts.find(text => text.id === segment.text_id) ?? saved?.text } : {}) };
    }) };
}

export function legacyRouteDraftKey(userId: string, routeId: string) {
  return `ecosdelisboa.route-draft.v2.${userId}.${routeId}`;
}

/** Legacy snapshots have no historical baseline. Never import their publication/media state. */
export function extractLegacyRouteDraft(raw: string): RouteNarrativeDraft | null {
  try {
    if (raw.length > 256_000) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 2 || !record(parsed.narrative)
      || !Array.isArray(parsed.narrative.segments) || !Array.isArray(parsed.waypoints)) return null;
    if (!parsed.narrative.segments.every((segment: unknown) => record(segment)
      && (segment.kind === 'text' && typeof segment.text_id === 'string' && segment.text_id
        || segment.kind === 'bridge' && (segment.bridge_content_pt == null || typeof segment.bridge_content_pt === 'string')))) return null;
    return validateRouteNarrativeDraft({ ...routeNarrativeDraft(parsed.narrative as unknown as RouteDraft, parsed.waypoints), legacyBaselineUnknown: true });
  } catch { return null; }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
