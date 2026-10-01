import type { AdminLanguage, AdminPoint, AdminPointType } from '@ecosdelisboa/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fallbackUnlessAuth } from '../adminApi';
import { autoSyncQueryOptions, client, ENABLE_MOCKS } from '../adminConfig';
import { fallbackLanguages, mockPointTypes } from '../adminMocks';
import { itemContextFromHash, itemContextHash } from '../adminNavigation';
import type { FieldContext, ResourceItem } from '../adminTypes';
import { clearRecordLocalDrafts } from '../localDraftStore';
import { ResourceFields } from '../resources/ResourceFields';
import { ResourcePanel, type ResourcePanelProps } from '../resources/ResourcePanel';
import { defaultPointType } from '../resources/pointTypeSelection';
import { PointTranslationsEditor } from './PointTranslationsEditor';
import { matchesPointFilters } from './pointListModel';

export function PointsPanel(props: ResourcePanelProps) {
  const { token, onAuthExpired, hash, navigateHash, userId } = props;
  const context = itemContextFromHash(hash);
  const types = useQuery({
    queryKey: ['admin-options', 'point-types', token],
    queryFn: () => client.get<AdminPointType[]>('/api/v1/admin/point-types', token)
      .catch(cause => fallbackUnlessAuth(cause, mockPointTypes, onAuthExpired)),
    ...autoSyncQueryOptions
  });
  const languages = useQuery({
    queryKey: ['admin-languages', token],
    queryFn: () => client.get<AdminLanguage[]>('/api/v1/admin/languages?active=true', token)
      .catch(cause => fallbackUnlessAuth(cause, fallbackLanguages, onAuthExpired)),
    ...autoSyncQueryOptions
  });
  const pointTypes = types.data ?? (ENABLE_MOCKS ? mockPointTypes : []);
  const fieldContext: FieldContext = { authors: [], authorsReady: false, points: [], pointsReady: false,
    pointTypes, pointTypesReady: Boolean(types.data) };
  const defaultType = defaultPointType(pointTypes);
  const filterItem = useCallback((item: ResourceItem) => matchesPointFilters(item as AdminPoint, context.pointType, context.status),
    [context.pointType, context.status]);
  const setFilter = (value: { pointType?: string; status?: string }) =>
    navigateHash(itemContextHash('points', { ...context, ...value }), { guard: false, replace: true });

  return <ResourcePanel {...props} resource="points" keepOpenAfterSave filterItem={filterItem}
    defaultDraft={defaultType ? { point_type_id: defaultType.id } : undefined}
    afterDelete={id => {
      clearRecordLocalDrafts(localStorage, { userId, entity: 'points', id });
      clearRecordLocalDrafts(localStorage, { userId, entity: 'point-translations', id });
    }}
    renderFields={(draft, onDraft) => <ResourceFields resource="points" draft={draft} onDraft={onDraft} context={fieldContext} />}
    renderFilters={<div className="resource-filters" aria-label="Filtros de pontos">
      <label>Tipo<select value={context.pointType} onChange={event => setFilter({ pointType: event.target.value })}>
        <option value="">Todos</option>{pointTypes.map(type => <option key={type.id} value={type.slug}>{type.name_pt}</option>)}
      </select></label>
      <label>Estado de tradução<select value={context.status} onChange={event => setFilter({ status: event.target.value })}>
        <option value="">Todos</option><option value="pending">Pendente</option>
        <option value="approved">Aprovada</option><option value="rejected">Rejeitada</option>
      </select></label>
    </div>}
    renderRelated={({ item, language, onLanguageChange }) => <PointTranslationsEditor key={context.id ?? 'new'}
      userId={userId} initialLanguage={language} onLanguageChange={onLanguageChange}
      point={item as AdminPoint | null} languages={languages.data ?? (ENABLE_MOCKS ? fallbackLanguages : [])}
      token={token} onAuthExpired={onAuthExpired} />}
  />;
}
