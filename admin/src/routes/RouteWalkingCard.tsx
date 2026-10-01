import type { AdminRoute, AdminRouteSegment, RouteWaypoint } from '@ecosdelisboa/shared';
import { RouteMap } from './RouteMap';
import type { RouteLegWaypointDraft } from './routeEditorModel';

export function RouteWalkingCard({ selectedRoute, segments, legWaypoints, selectedSegmentId, selectedLegPosition, addingWaypoint, canUseServerTools, busy, dirty, waypointsDirty, recalculating, selectSegment, onAddWaypoint, setSelectedLegPosition, onToggleWaypoint, onRemoveWaypoint, onRecalculate }: {
  selectedRoute?: AdminRoute;
  segments: AdminRouteSegment[];
  legWaypoints: RouteLegWaypointDraft[];
  selectedSegmentId?: string;
  selectedLegPosition: number;
  addingWaypoint: boolean;
  canUseServerTools: boolean;
  busy: boolean;
  dirty: boolean;
  waypointsDirty: boolean;
  recalculating: boolean;
  selectSegment: (id?: string) => void;
  onAddWaypoint: (waypoint: RouteWaypoint) => void;
  setSelectedLegPosition: (position: number) => void;
  onToggleWaypoint: () => void;
  onRemoveWaypoint: (index: number) => void;
  onRecalculate: () => void;
}) {
  const textSegments = segments.filter(segment => segment.kind === 'text');
  const selectedLegWaypoints = legWaypoints.find(leg => leg.position === selectedLegPosition)?.waypoints ?? [];
  return (
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
        segments={segments}
        legs={selectedRoute?.legs ?? []}
        waypointDrafts={legWaypoints}
        selectedSegmentId={selectedSegmentId}
        addingWaypoint={addingWaypoint}
        canAddWaypoint={canUseServerTools && textSegments.length >= 2 && !busy}
        onSelectSegment={selectSegment}
        onAddWaypoint={(waypoint) => {
          if (busy) return;
          onAddWaypoint(waypoint);
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
          onClick={() => onToggleWaypoint()}
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
                onRemoveWaypoint(index)
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
        disabled={!canUseServerTools || textSegments.length < 2 || recalculating}
        onClick={() => { onRecalculate(); }}
      >
        {recalculating ? 'A calcular rota…' : 'Recalcular caminhada'}
      </button>
    </section>

  );
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
