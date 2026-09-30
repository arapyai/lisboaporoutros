import { useMutation } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { client } from '../adminConfig';

export function PasswordRecovery({ token, onBack }: { token?: string; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (token) history.replaceState(null, '', location.pathname + location.search);
  }, [token]);
  const mutation = useMutation({
    mutationFn: () => token
      ? client.post<{ message: string }>('/api/v1/admin/auth/reset-password', { token, password })
      : client.post<{ message: string }>('/api/v1/admin/auth/forgot-password', { email }),
    onError: () => setError(token
      ? 'Não foi possível redefinir a senha. O link pode ter expirado ou já ter sido usado. Solicite um novo link ou tente novamente.'
      : 'Problema ao solicitar a recuperação. Tente novamente mais tarde.')
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (token && password !== confirmation) { setError('As senhas não coincidem.'); return; }
    mutation.mutate();
  }
  return <main className="login-screen"><section className="login-panel">
    <h1>{token ? 'Redefinir senha' : 'Recuperar senha'}</h1>
    {mutation.isSuccess ? <p role="status">{mutation.data.message}</p> : <form onSubmit={submit}>
      {token ? <>
        <label>Nova senha<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <p>Use pelo menos 12 caracteres.</p>
        <label>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      </> : <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'A enviar…' : token ? 'Redefinir senha' : 'Enviar link de recuperação'}</button>
    </form>}
    <button type="button" className="secondary-action" disabled={mutation.isPending} onClick={onBack}>Voltar ao login</button>
  </section></main>;
}
