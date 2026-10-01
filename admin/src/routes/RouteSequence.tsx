import type { AdminRouteSegment } from '@ecosdelisboa/shared';
import { useState } from 'react';
import { addBridgeSegment, reorderSegments } from './routeEditorModel';
import { excerpt } from './routePresentation';

export function RouteSequence({ segments, selectedSegmentId, onSegments, onSelect, onRemove }: {
  segments: AdminRouteSegment[];
  selectedSegmentId?: string;
  onSegments: (segments: AdminRouteSegment[]) => void;
  onSelect: (id?: string) => void;
  onRemove: (index: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  return (
    <>
      <div className="narrative-heading">
        <div>
          <span className="eyebrow">Sequência narrativa</span>
          <h3>{segments.length} segmentos</h3>
        </div>
        <button
          type="button"
          className="secondary-action"
          onClick={() => onSegments(addBridgeSegment(segments))}
        >
          + Ponte curatorial
        </button>
      </div>

      <div className="narrative-sequence">
        {segments.map((segment, index) => (
          <article
            key={segment.id ?? `${segment.kind}-${index}`}
            className={`narrative-card ${segment.kind}${segment.id === selectedSegmentId ? ' selected' : ''}`}
            draggable
            onClick={() => onSelect(segment.id)}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) onSegments(reorderSegments(segments, dragIndex, index));
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
                    onSegments(
                      segments.map((item, currentIndex) =>
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
                onClick={() => onSegments(reorderSegments(segments, index, index - 1))}
                aria-label="Mover para cima"
              >
                ↑
              </button>
              <button
                type="button"
                className="text-action"
                disabled={index === segments.length - 1}
                onClick={() => onSegments(reorderSegments(segments, index, index + 1))}
                aria-label="Mover para baixo"
              >
                ↓
              </button>
              <button
                type="button"
                className="text-action delete-text-action"
                onClick={(event) => { event.stopPropagation(); onRemove(index); }}
              >
                Remover
              </button>
            </div>
          </article>
        ))}
        {!segments.length ? (
          <div className="empty-narrative">
            <strong>A narrativa começa com um texto.</strong>
            <p>Escolha um texto disponível; a localização virá com ele.</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
