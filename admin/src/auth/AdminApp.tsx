import type { AdminLoginResponse } from '@ecosdelisboa/shared';
import { useMutation } from '@tanstack/react-query';
import { FormEvent, lazy, Suspense, useEffect, useState } from 'react';
import { isAuthError } from '../adminApi';
import { TOKEN_KEY, client, queryClient } from '../adminConfig';
import { PasswordRecovery } from './PasswordRecovery';
import { AdminLoadBoundary } from './AdminLoadBoundary';

const Dashboard = lazy(() => import('../Dashboard').then(module => ({ default: module.Dashboard })));

export function AdminApp() {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
  });
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState(() => new URLSearchParams(location.hash.slice(1)).get('reset-password') ?? '');
  useEffect(() => {
    const readRecoveryLink = () => setRecoveryToken(new URLSearchParams(location.hash.slice(1)).get('reset-password') ?? '');
    window.addEventListener('hashchange', readRecoveryLink);
    return () => window.removeEventListener('hashchange', readRecoveryLink);
  }, []);

  function onLogin(nextToken: string) {
    try { localStorage.setItem(TOKEN_KEY, nextToken); } catch { setStorageUnavailable(true); }
    setToken(nextToken);
  }

  function logout() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* Storage may be blocked by browser policy. */ }
    queryClient.clear();
    setToken('');
  }

  if (recoveryToken) return <PasswordRecovery token={recoveryToken} onBack={() => { logout(); setRecoveryToken(''); }} />;
  return token ? (
    <AdminLoadBoundary>
      {storageUnavailable ? <p role="status">Este navegador não permite manter a sessão após recarregar.</p> : null}
      <Suspense fallback={<main className="content-panel" role="status">A carregar o administrativo…</main>}><Dashboard token={token} onLogout={logout} /></Suspense>
    </AdminLoadBoundary>
  ) : (
    <Login onLogin={onLogin} />
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [recovering, setRecovering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      client.post<AdminLoginResponse>('/api/v1/admin/auth/login', {
        email,
        password
      }),
    onSuccess: (data) => onLogin(data.access_token),
    onError: (cause) => setError(isAuthError(cause) ? 'E-mail ou senha incorretos.' : 'Problema ao entrar. Verifique a conexão e tente novamente.')
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
            <h1>Lisboa por Outros</h1>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'A entrar...' : 'Entrar'}
          </button>
          <button type="button" className="secondary-action" onClick={() => setRecovering(true)}>Esqueci a senha</button>
        </form>
      </section>
    </main>
  );
}
