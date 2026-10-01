import type { FieldContext } from '../adminTypes';
import { ResourceFields } from '../resources/ResourceFields';
import { ResourcePanel, type ResourcePanelProps } from '../resources/ResourcePanel';

const fieldContext: FieldContext = { authors: [], authorsReady: false, points: [], pointsReady: false,
  pointTypes: [], pointTypesReady: false };
export function PointTypesPanel(props: ResourcePanelProps) {
  return <ResourcePanel {...props} resource="point-types"
    renderFields={(draft, onDraft) => <ResourceFields resource="point-types" draft={draft} onDraft={onDraft} context={fieldContext} />} />;
}
