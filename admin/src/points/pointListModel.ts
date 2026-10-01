import type { AdminPoint } from '@ecosdelisboa/shared';

export function matchesPointFilters(point: AdminPoint, type: string, status: string) {
  return (!type || point.point_type?.slug === type)
    && (!status || (point.translations ?? []).some(translation => translation.status === status));
}
