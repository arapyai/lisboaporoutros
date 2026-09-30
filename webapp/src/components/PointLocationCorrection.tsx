import { ApiError } from '@ecosdelisboa/shared';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { adminClient, type LocationHistoryEntry } from '../api/admin';
import { usePublicAdmin } from '../hooks/adminSession';
import { distanceMeters } from '../lib/proximity';
import type { Point } from '../types';
import { PointGPSPreview } from './PointGPSPreview';

interface Props { point: Point; onUpdated?: (point: Point) => void }
interface GPSFix { lat: number; lng: number; accuracy: number; measuredAt: string }
function errorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) return 'Sessão expirada ou senha incorreta. Entre novamente.';
    if (cause.status === 409) return 'Outro administrador alterou este ponto. Feche e reabra o ponto antes de confirmar.';
    if (cause.status === 422) return 'GPS antigo ou sem precisão suficiente. Obtenha uma nova posição.';
  }
  return 'Não foi possível concluir. Verifique a conexão e tente novamente.';
}

export function PointLocationCorrection({ point, onUpdated }: Props) {
  const { admin, token, login, logout } = usePublicAdmin();
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<LocationHistoryEntry[] | null>(null);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); setPassword(''); setLoginOpen(false); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function showHistory() {
    setError(''); setBusy(true);
    try { setHistory(await adminClient.get<LocationHistoryEntry[]>(`/api/v1/admin/points/${point.id}/location-history`, token)); }
    catch (cause) { if (cause instanceof ApiError && cause.status === 401) logout(); setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className="point-location-admin" aria-label="Correção administrativa da localização" lang="pt">
    {admin ? <>
      <small>Administrador: {admin.email}</small>
      <button type="button" onClick={() => { setOpen(true); setError(''); }}>Corrigir localização pelo GPS</button>
      <button type="button" disabled={busy} onClick={showHistory}>Histórico da localização</button>
      <button type="button" onClick={() => { logout(); setHistory(null); setOpen(false); }}>Sair do acesso administrativo</button>
      {history ? <ul className="gps-history">{history.length ? history.map(item => <li key={item.id}>
        {new Date(item.updated_at).toLocaleString('pt-PT')} · {item.admin_email} · {item.source === 'admin_gps_pwa' ? 'GPS no site' : 'Editor administrativo'}<br />
        {item.previous_lat.toFixed(6)}, {item.previous_lng.toFixed(6)} → {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
        {item.accuracy_m != null ? ` · precisão ±${Math.round(item.accuracy_m)} m` : ''}
      </li>) : <li>Sem correções registradas. Dados anteriores à auditoria não têm fonte conhecida.</li>}</ul> : null}
    </> : <>
      <button type="button" onClick={() => setLoginOpen(value => !value)}>Acesso administrativo</button>
      {loginOpen ? <form onSubmit={signIn}>
        <p>Entre neste site para corrigir pontos. A sessão do painel não é compartilhada entre domínios.</p>
        <label>E-mail administrativo<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'A entrar…' : 'Entrar como administrador'}</button>
      </form> : null}
    </>}
    {point.location_updated_at ? <small>Última correção: {new Date(point.location_updated_at).toLocaleString('pt-PT')} · {point.location_update_source === 'admin_gps_pwa' ? 'GPS no site' : 'Editor administrativo'}</small> : null}
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {open && admin ? <GPSConfirmation point={point} token={token} onExpired={() => { logout(); setError('Sessão expirada. Entre novamente; nada foi alterado.'); }} onClose={() => setOpen(false)} onSaved={updated => {
      setOpen(false); setHistory(null); setMessage('Localização atualizada e registrada no histórico.'); onUpdated?.(updated);
    }} /> : null}
  </section>;
}

function GPSConfirmation({ point, token, onClose, onSaved, onExpired }: {
  point: Point; token: string; onClose: () => void; onSaved: (point: Point) => void; onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const mounted = useRef(true);
  const [fix, setFix] = useState<GPSFix | null>(null);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [largeMoveApproved, setLargeMoveApproved] = useState(false);
  const distance = fix ? distanceMeters(point, fix) : 0;
  useEffect(() => {
    const element = dialog.current; const trigger = document.activeElement;
    element?.showModal(); mounted.current = true;
    return () => { mounted.current = false; element?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  function acquire() {
    setFix(null); setError(''); setLargeMoveApproved(false);
    if (!navigator.geolocation) { setError('Este navegador não oferece localização.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (!mounted.current) return;
      setLocating(false);
      if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy <= 0 || position.coords.accuracy > 60) {
        setError(`Precisão insuficiente (±${Math.round(position.coords.accuracy)} m). Tente novamente ao ar livre; nada foi alterado.`); return;
      }
      setFix({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy,
        measuredAt: new Date(position.timestamp).toISOString() });
    }, failure => {
      if (!mounted.current) return;
      setLocating(false);
      setError(failure.code === 1 ? 'Localização não autorizada. Permita o acesso nas configurações do navegador.'
        : failure.code === 3 ? 'O GPS demorou a responder. Tente novamente ao ar livre.' : 'GPS indisponível. Tente novamente.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 });
  }
  async function save() {
    if (!fix || (distance > 100 && !largeMoveApproved)) return;
    if (Date.now() - Date.parse(fix.measuredAt) > 120000) { setError('A posição expirou. Obtenha uma nova posição.'); setFix(null); return; }
    setSaving(true); setError('');
    try {
      const updated = await adminClient.put<Point>(`/api/v1/admin/points/${point.id}/location`, {
        lat: fix.lat, lng: fix.lng, accuracy_m: fix.accuracy, measured_at: fix.measuredAt,
        expected_lat: point.lat, expected_lng: point.lng
      }, token);
      onSaved({ ...point, ...updated });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      if (mounted.current) { setError(errorMessage(cause)); setSaving(false); }
    }
  }
  return <dialog ref={dialog} className="gps-confirmation" aria-labelledby={titleId} onCancel={event => { if (saving) event.preventDefault(); else onClose(); }} lang="pt">
    <h2 id={titleId}>Atualizar a localização deste ponto?</h2><p>{point.title_pt}</p>
    <p>Esta ação altera as coordenadas do ponto, não apenas a posição do seu mapa. Só confirme estando no local correto.</p>
    <button type="button" autoFocus disabled={locating || saving} onClick={acquire}>{locating ? 'A obter GPS…' : 'Obter posição atual'}</button>
    {fix ? <>
      <PointGPSPreview oldLat={point.lat} oldLng={point.lng} lat={fix.lat} lng={fix.lng} accuracy={fix.accuracy} />
      <p>Anterior (roxo): {point.lat.toFixed(6)}, {point.lng.toFixed(6)}<br />GPS proposto (verde): {fix.lat.toFixed(6)}, {fix.lng.toFixed(6)}<br />
        Precisão: ±{Math.round(fix.accuracy)} m · deslocamento: {Math.round(distance)} m</p>
      {fix.accuracy > 25 ? <p role="status">A precisão está baixa para pequenas correções. Considere obter uma nova posição.</p> : null}
      {distance > 100 ? <label><input type="checkbox" checked={largeMoveApproved} onChange={e => setLargeMoveApproved(e.target.checked)} />Confirmo que este deslocamento maior que 100 m está correto.</label> : null}
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
    <div className="gps-dialog-actions">
      <button type="button" disabled={saving} onClick={onClose}>Cancelar</button>
      <button type="button" disabled={!fix || saving || (distance > 100 && !largeMoveApproved)} onClick={save}>{saving ? 'A salvar…' : 'Confirmar atualização'}</button>
    </div>
  </dialog>;
}
