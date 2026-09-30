import { createContext, useContext } from 'react';
import type { AdminSessionUser } from '../api/admin';

export const ADMIN_SESSION_KEY = 'lisboa.public-admin-session.v1';
interface PublicAdminSession {
  token: string;
  admin: AdminSessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
export const AdminSessionContext = createContext<PublicAdminSession>({
  token: '', admin: null, login: async () => { throw new Error('Sessão indisponível.'); }, logout: () => {}
});
export const usePublicAdmin = () => useContext(AdminSessionContext);
