import { useEffect, useRef } from 'react';

const editors = new Set<{ current: boolean; blocked: boolean; discard?: () => void }>();

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
  for (const editor of editors) if (editor.current) editor.discard?.();
  return true;
}

export function useUnsavedChanges(dirty: boolean, blocked = false, discard?: () => void) {
  const current = useRef({ current: dirty, blocked, discard });
  current.current.current = dirty || blocked;
  current.current.blocked = blocked;
  current.current.discard = discard;
  useEffect(() => {
    if (editors.size === 0) window.addEventListener('beforeunload', warnBeforeUnload);
    editors.add(current.current);
    return () => {
      editors.delete(current.current);
      if (editors.size === 0) window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, []);
}
