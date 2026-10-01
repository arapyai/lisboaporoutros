import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { adminDraftNavigationState, discardAdminDrafts, saveAdminDrafts } from '../unsavedChanges';
import { EditingSuspendedContext } from '../auth/EditingSuspendedContext';

/** A save here is an explicit editor write, never an approval, generation or publication. */
export function DraftNavigationDialog({ onCancel, onLeave }: { onCancel: () => void; onLeave: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const suspended = useContext(EditingSuspendedContext);
  const state = adminDraftNavigationState();
  useLayoutEffect(() => {
    if (suspended) { dialog.current?.close(); return; }
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      dialog.current?.close();
      if (invoker?.isConnected && !invoker.closest('[inert]')) invoker.focus();
    };
  }, [suspended]);
  async function saveAndLeave() {
    if (running.current || !adminDraftNavigationState().canSave) return;
    running.current = true; setSaving(true); setError('');
    try { await saveAdminDrafts(); onLeave(); }
    catch { setError('Não foi possível guardar todas as alterações. A edição continua aberta. Confira os avisos do editor; nenhuma gravação será repetida automaticamente.'); }
    finally { running.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} className="draft-navigation-dialog" aria-labelledby="draft-navigation-title"
    tabIndex={-1} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if (!buttons.length) { event.preventDefault(); event.currentTarget.focus(); return; }
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
        event.preventDefault(); first.focus();
      }
    }}
    aria-describedby="draft-navigation-description" onCancel={event => { event.preventDefault(); if (!running.current) onCancel(); }}>
    <h3 id="draft-navigation-title">Alterações não guardadas</h3>
    <p id="draft-navigation-description">O que deseja fazer antes de fechar esta edição?</p>
    {!state.canSave && !saving ? <p>Há alterações que precisam de restauração ou de uma ação editorial própria. Continue a editar para as resolver antes de sair.</p> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    {saving ? <p role="status">A guardar — aguarde a confirmação do servidor.</p> : null}
    <div className="form-actions">
      <button type="button" className="secondary-action" disabled={saving} onClick={onCancel}>Continuar a editar</button>
      {state.canSave || saving ? <button type="button" disabled={saving} onClick={() => void saveAndLeave()}>{saving ? 'A guardar…' : 'Guardar e sair'}</button> : null}
      <button type="button" className="danger" disabled={saving || state.blocked} onClick={() => {
        if (running.current || adminDraftNavigationState().blocked) return;
        discardAdminDrafts(); onLeave();
      }}>Descartar alterações</button>
    </div>
  </dialog>;
}
