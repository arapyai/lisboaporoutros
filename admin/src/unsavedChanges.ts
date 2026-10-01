import { useEffect, useRef } from 'react';

const editors = new Set<{ current: boolean; blocked: boolean }>();

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
  return allowDirty || !Array.from(editors).some(editor => editor.current)
    || window.confirm('Há alterações não guardadas. Continuar sem guardar?');
}

export function useUnsavedChanges(dirty: boolean, blocked = false) {
  const current = useRef({ current: dirty, blocked });
  current.current.current = dirty || blocked;
  current.current.blocked = blocked;
  useEffect(() => {
    if (editors.size === 0) window.addEventListener('beforeunload', warnBeforeUnload);
    editors.add(current.current);
    return () => {
      editors.delete(current.current);
      if (editors.size === 0) window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, []);
}
