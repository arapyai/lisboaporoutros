import { ApiError } from '@ecosdelisboa/shared';

export function adminFailureMessage(cause: unknown, fallback: string): string {
  return cause instanceof ApiError && cause.status === 403
    ? 'Você não tem permissão para esta ação.' : fallback;
}
