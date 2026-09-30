import { useEffect, useState, type ReactNode } from 'react';
import { adminClient, type AdminSessionUser } from '../api/admin';
import { ADMIN_SESSION_KEY, AdminSessionContext } from '../hooks/adminSession';

function storedToken() {
  try { return sessionStorage.getItem(ADMIN_SESSION_KEY) ?? ''; } catch { return ''; }
}
function rememberToken(token: string) {
  try {
    if (token) sessionStorage.setItem(ADMIN_SESSION_KEY, token);
    else sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch { /* A sessão ainda funciona em memória quando o storage está bloqueado. */ }
}

export function PublicAdminSession({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(storedToken);
  const [admin, setAdmin] = useState<AdminSessionUser | null>(null);
  useEffect(() => {
    if (!token) { setAdmin(null); return; }
    let cancelled = false;
    adminClient.get<AdminSessionUser>('/api/v1/admin/auth/me', token)
      .then(user => { if (!cancelled) setAdmin(user); })
      .catch(() => { if (!cancelled) { rememberToken(''); setToken(''); setAdmin(null); } });
    return () => { cancelled = true; };
  }, [token]);
  async function login(email: string, password: string) {
    const result = await adminClient.post<{ access_token: string }>('/api/v1/admin/auth/login', { email, password });
    const user = await adminClient.get<AdminSessionUser>('/api/v1/admin/auth/me', result.access_token);
    rememberToken(result.access_token);
    setToken(result.access_token);
    setAdmin(user);
  }
  function logout() { rememberToken(''); setToken(''); setAdmin(null); }
  return <AdminSessionContext.Provider value={{ token, admin, login, logout }}>{children}</AdminSessionContext.Provider>;
}
