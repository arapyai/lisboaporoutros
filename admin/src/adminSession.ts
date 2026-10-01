import { ApiError } from '@ecosdelisboa/shared';

// Cache/editor scope stays stable while credentials are renewed for the same identity.
// This state is memory-only. Never persist drafts, passwords or intermediate login tokens here.
let session: { scope: string; accessToken: string; expired: boolean } | undefined;
export function startAdminSession(token: string): string {
  session = token ? { scope: `admin-session:${crypto.randomUUID()}`, accessToken: token, expired: false } : undefined;
  return session?.scope ?? '';
}
export function pauseAdminSession() { if (session) session.expired = true; }
export function resumeAdminSession(scope: string, token: string) {
  if (!session || session.scope !== scope) throw new Error('Session scope changed');
  session.accessToken = token;
  session.expired = false;
}
export function resolveAdminToken(token?: string): string | undefined {
  // Raw candidate credentials are used only to validate the re-login identity.
  if (!token?.startsWith('admin-session:')) return token;
  if (!session || token !== session.scope) throw new ApiError('Session expired', 401, '/api/v1/admin');
  if (session.expired) throw new ApiError('Session expired', 401, '/api/v1/admin');
  return session.accessToken;
}
