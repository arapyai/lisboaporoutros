import { useEffect, useRef } from 'react';

const editors = new Set<{ current: boolean; blocked: boolean; discard?: () => void; save?: () => Promise<unknown> }>();

export function adminDraftNavigationState() {
  const dirty = [...editors].filter(editor => editor.current);
  return { dirty: dirty.length > 0, blocked: [...editors].some(editor => editor.blocked),
    canSave: dirty.length > 0 && dirty.every(editor => !editor.blocked && editor.save) };
}

export async function saveAdminDrafts() {
  const dirty = [...editors].filter(editor => editor.current);
  if (!dirty.length || !adminDraftNavigationState().canSave) throw new Error('Drafts require an explicit editorial action');
  const saves = dirty.map(editor => editor.save!);
  for (const save of saves) await save();
}

export function discardAdminDrafts() {
  for (const editor of editors) if (editor.current) editor.discard?.();
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!Array.from(editors).some(editor => editor.current)) return;
  event.preventDefault();
  event.returnValue = '';
}

export function confirmAdminNavigation({ allowDirty = false }: { allowDirty?: boolean } = {}) {
  if (Array.from(editors).some(editor => editor.blocked)) {
    window.alert('Aguarde a operação em andamento antes de sair desta edição.');
    return false;
  }
  if (allowDirty || !Array.from(editors).some(editor => editor.current)) return true;
  if (!window.confirm('Há alterações não guardadas. Continuar sem guardar e descartar os rascunhos desta edição?')) return false;
  discardAdminDrafts();
  return true;
}

export function useUnsavedChanges(dirty: boolean, blocked = false, discard?: () => void, save?: () => Promise<unknown>) {
  const current = useRef({ current: dirty, blocked, discard, save });
  current.current.current = dirty || blocked;
  current.current.blocked = blocked;
  current.current.discard = discard;
  current.current.save = save;
  useEffect(() => {
    if (editors.size === 0) window.addEventListener('beforeunload', warnBeforeUnload);
    editors.add(current.current);
    return () => {
      editors.delete(current.current);
      if (editors.size === 0) window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, []);
}
