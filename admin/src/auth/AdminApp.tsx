import type { AdminLoginResponse, AdminUser } from '@ecosdelisboa/shared';
import { useMutation } from '@tanstack/react-query';
import { FormEvent, lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { isAuthError } from '../adminApi';
import { TOKEN_KEY, client, queryClient } from '../adminConfig';
import { PasswordRecovery } from './PasswordRecovery';
import { AdminLoadBoundary } from './AdminLoadBoundary';
import { pauseAdminSession, resumeAdminSession, startAdminSession } from '../adminSession';
import { EditingSuspendedContext } from './EditingSuspendedContext';
import { confirmAdminNavigation } from '../unsavedChanges';

const Dashboard = lazy(() => import('../Dashboard').then(module => ({ default: module.Dashboard })));

export function AdminApp() {
  const [token, setToken] = useState(() => {
    let stored = '';
    try { stored = localStorage.getItem(TOKEN_KEY) ?? ''; } catch { /* Use memory-only login. */ }
    return startAdminSession(stored);
  });
  const [suspendedUser, setSuspendedUser] = useState<AdminUser | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('reset-password') ?? '');
  useEffect(() => {
    const readRecoveryLink = () => setRecoveryToken(new URLSearchParams(location.hash.slice(1)).get('reset-password') ?? '');
    window.addEventListener('hashchange', readRecoveryLink);
    return () => window.removeEventListener('hashchange', readRecoveryLink);
  }, []);

  function onLogin(nextToken: string) {
    try { localStorage.setItem(TOKEN_KEY, nextToken); } catch { setStorageUnavailable(true); }
    setToken(startAdminSession(nextToken));
  }

  const logout = useCallback(() => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* Storage may be blocked by browser policy. */ }
    startAdminSession('');
    queryClient.clear();
    setSuspendedUser(null);
    setToken('');
  }, []);
  const expireSession = useCallback(() => {
    const user = queryClient.getQueryData<AdminUser>(['me', token]);
    if (!user) { logout(); return; }
    pauseAdminSession();
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* No storage is required for resuming. */ }
    setSuspendedUser(user);
  }, [token, logout]);
  function resume(nextToken: string) {
    resumeAdminSession(token, nextToken);
    try { localStorage.setItem(TOKEN_KEY, nextToken); } catch { setStorageUnavailable(true); }
    setSuspendedUser(null);
    // Refresh reads only. A failed write must always be retried explicitly by the editor.
    void queryClient.invalidateQueries();
  }

  if (recoveryToken) return <PasswordRecovery token={recoveryToken} onBack={() => { logout(); setRecoveryToken(''); }} />;
  return token ? (
    <AdminLoadBoundary>
      {storageUnavailable ? <p role="status">Este navegador não permite manter a sessão após recarregar.</p> : null}
      <EditingSuspendedContext.Provider value={Boolean(suspendedUser)}>
        <div hidden={Boolean(suspendedUser)} inert={Boolean(suspendedUser)}>
          <Suspense fallback={<main className="content-panel" role="status">A carregar o administrativo…</main>}>
            <Dashboard token={token} onLogout={logout} onAuthExpired={expireSession} />
          </Suspense>
        </div>
      </EditingSuspendedContext.Provider>
      {suspendedUser ? <Login expectedUser={suspendedUser} onLogin={resume}
        onDiscard={() => { if (confirmAdminNavigation()) logout(); }} /> : null}
    </AdminLoadBoundary>
  ) : (
    <Login onLogin={onLogin} />
  );
}

function Login({ onLogin, expectedUser, onDiscard }: {
  onLogin: (token: string) => void; expectedUser?: AdminUser; onDiscard?: () => void;
}) {
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState(expectedUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await client.post<AdminLoginResponse>('/api/v1/admin/auth/login', {
        email,
        password
      });
      if (expectedUser) {
        const identity = await client.get<AdminUser>('/api/v1/admin/auth/me', result.access_token);
        if (identity.id !== expectedUser.id || !identity.is_active) throw new Error('same-account-required');
      }
      return result;
    },
    onSuccess: (data) => onLogin(data.access_token),
    onError: (cause) => setError(cause instanceof Error && cause.message === 'same-account-required'
      ? 'Entre com a mesma conta que iniciou esta edição. O rascunho continua preservado.'
      : isAuthError(cause) ? 'E-mail ou senha incorretos.' : 'Problema ao entrar. Verifique a conexão e tente novamente.')
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    mutation.mutate();
  }

  if (recovering) return <PasswordRecovery onBack={() => setRecovering(false)} />;
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="admin-brand">
          <img src="/branding/literary-map-icon.png" alt="" />
          <div>
            <span>Administração</span>
            <h1>{expectedUser ? 'Sessão expirada' : 'Lisboa por Outros'}</h1>
          </div>
        </div>
        {expectedUser ? <p role="status">A edição está preservada nesta aba. Entre novamente com a mesma conta para continuar. Não recarregue a página.</p> : null}
        <form onSubmit={submit}>
          <label>
            Email
            <input autoFocus={Boolean(expectedUser)} disabled={mutation.isPending} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Senha
            <input disabled={mutation.isPending} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'A entrar...' : 'Entrar'}
          </button>
          <button type="button" disabled={mutation.isPending} className="secondary-action" onClick={() => setRecovering(true)}>Esqueci a senha</button>
          {onDiscard ? <button type="button" disabled={mutation.isPending} className="secondary-action" onClick={onDiscard}>Descartar edição e sair</button> : null}
        </form>
      </section>
    </main>
  );
}
