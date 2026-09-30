import { ApiClient } from '@ecosdelisboa/shared';

export const adminClient = new ApiClient(import.meta.env.VITE_API_BASE_URL ?? '');
export interface AdminSessionUser { id: string; email: string; is_active: boolean }
export interface LocationHistoryEntry {
  id: string; updated_at: string; admin_email: string; source: string;
  previous_lat: number; previous_lng: number; lat: number; lng: number;
  accuracy_m: number | null;
}
