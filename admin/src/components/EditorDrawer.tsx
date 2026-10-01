import { type ReactNode, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EditingSuspendedContext } from '../auth/EditingSuspendedContext';
import { getPendingAdminNavigation, subscribeAdminNavigation } from '../unsavedChanges';

/** Full-screen mobile dialogs; desktop keeps the surrounding navigation available. */
export function EditorDrawer({ label, className = '', onClose, children }: {
  label: string; className?: string; onClose: () => void; children: ReactNode;
}) {
  const drawer = useRef<HTMLElement>(null);
  const suspended = useContext(EditingSuspendedContext);
  const navigationPending = Boolean(useSyncExternalStore(subscribeAdminNavigation, getPendingAdminNavigation));
  const close = useRef(onClose);
  const returnFocus = useRef<HTMLElement | null>(null);
  const focusCaptured = useRef(false);
  const [modal, setModal] = useState(() => window.matchMedia('(max-width: 820px)').matches);
  useLayoutEffect(() => { close.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    const node = drawer.current!;
    const host = node.parentElement;
    if (!focusCaptured.current) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      focusCaptured.current = true;
    }
    return () => queueMicrotask(() => {
      // StrictMode cleanup is not a real close; wait for removal and inert restoration.
      if (node.isConnected) return;
      const invoker = returnFocus.current;
      if (invoker && invoker !== document.body && invoker.isConnected && !invoker.closest('[inert]') && invoker.getClientRects().length) invoker.focus();
      else if (host?.isConnected) (host.querySelector<HTMLElement>('input[type="search"]')
        ?? host.querySelector<HTMLElement>('button'))?.focus();
    });
  }, []);
  useLayoutEffect(() => {
    if (suspended || navigationPending) return;
    const node = drawer.current!;
    const media = window.matchMedia('(max-width: 820px)');
    const outside = new Map<HTMLElement, boolean>();
    const restoreOutside = () => { outside.forEach((inert, element) => { element.inert = inert; }); outside.clear(); };
    const focusHeading = () => {
      const heading = node.querySelector<HTMLElement>('h3');
      if (heading) { heading.tabIndex = -1; heading.focus(); }
      else node.focus();
    };
    const syncMode = () => {
      restoreOutside();
      setModal(media.matches);
      if (!media.matches) return;
      // Never inert an ancestor containing the dialog: disable only sibling branches.
      for (let branch: Element = node; branch.parentElement; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling !== branch && sibling instanceof HTMLElement) {
            outside.set(sibling, sibling.inert);
            sibling.inert = true;
          }
        }
      }
      if (!node.contains(document.activeElement)) focusHeading();
    };
    const tabbable = () => [...node.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [tabindex]')]
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled')
        && !element.closest('[inert]') && element.getClientRects().length > 0);
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (!media.matches && !node.contains(document.activeElement))) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab' || !media.matches) return;
      const items = tabbable();
      const current = document.activeElement;
      if (!items.length) { event.preventDefault(); focusHeading(); return; }
      if (event.shiftKey && (current === items[0] || !items.includes(current as HTMLElement))) {
        event.preventDefault(); items[items.length - 1].focus();
      } else if (!event.shiftKey && (current === items[items.length - 1] || !items.includes(current as HTMLElement))) {
        event.preventDefault(); items[0].focus();
      }
    };
    const containFocus = () => {
      if (media.matches && !node.contains(document.activeElement)) focusHeading();
    };
    if (!node.contains(document.activeElement)) focusHeading();
    syncMode();
    media.addEventListener('change', syncMode);
    document.addEventListener('keydown', keyboard);
    document.addEventListener('focusin', containFocus);
    return () => {
      media.removeEventListener('change', syncMode);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('focusin', containFocus);
      restoreOutside();
    };
  }, [suspended, navigationPending]);
  return <aside ref={drawer} tabIndex={-1} className={`text-editor-drawer ${className}`}
    role={modal ? 'dialog' : undefined} aria-modal={modal && !suspended && !navigationPending ? true : undefined} aria-label={label}>
    {children}
  </aside>;
}
