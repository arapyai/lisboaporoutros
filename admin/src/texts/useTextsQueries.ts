import type { AdminAudioFile, AdminAuthor, AdminLanguage, AdminPoint, AdminText, AdminTranslation, AdminVoice, ContentGenerationBatch } from '@ecosdelisboa/shared';
import { useQuery } from '@tanstack/react-query';
import { autoSyncQueryOptions, client } from '../adminConfig';

// Keep independent sources parallel and preserve the existing session-scoped cache keys.
export function useTextsQueries(token: string, reviewBatchId?: string) {
  const textsQuery = useQuery({
    queryKey: ['admin-resource', 'texts', token],
    queryFn: () => client.get<AdminText[]>('/api/v1/admin/texts', token),
    ...autoSyncQueryOptions,
    retry: false
  });
  const authorsQuery = useQuery({
    queryKey: ['admin-options', 'authors', token],
    queryFn: () => client.get<AdminAuthor[]>('/api/v1/admin/authors', token),
    ...autoSyncQueryOptions,
    retry: false
  });
  const pointsQuery = useQuery({
    queryKey: ['admin-options', 'points', token],
    queryFn: () => client.get<AdminPoint[]>('/api/v1/admin/points', token),
    ...autoSyncQueryOptions,
    retry: false
  });
  const languagesQuery = useQuery({
    queryKey: ['admin-languages', token],
    queryFn: () => client.get<AdminLanguage[]>('/api/v1/admin/languages?active=true', token),
    ...autoSyncQueryOptions,
    retry: false
  });
  const translationsQuery = useQuery({
    queryKey: ['admin-translations', token],
    queryFn: () => client.get<AdminTranslation[]>('/api/v1/admin/translations', token),
    ...autoSyncQueryOptions,
    retry: false
  });
  const audioQuery = useQuery({
    queryKey: ['admin-audio', token],
    queryFn: () => client.get<AdminAudioFile[]>('/api/v1/admin/audio', token),
    ...autoSyncQueryOptions,
    retry: false
  });
  const voicesQuery = useQuery({
    queryKey: ['admin-voices', token],
    queryFn: () => client.get<AdminVoice[]>('/api/v1/admin/voices', token),
    ...autoSyncQueryOptions,
    retry: false
  });
  const reviewBatchQuery = useQuery({
    queryKey: ['generation-batch', reviewBatchId, token],
    queryFn: () => client.get<ContentGenerationBatch>(`/api/v1/admin/automation/batches/${reviewBatchId}`, token),
    enabled: Boolean(reviewBatchId),
    refetchInterval: 2000
  });

  return { textsQuery, authorsQuery, pointsQuery, languagesQuery, translationsQuery, audioQuery, voicesQuery, reviewBatchQuery };
}
