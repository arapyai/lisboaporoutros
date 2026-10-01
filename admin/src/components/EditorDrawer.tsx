import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

/** Full-screen mobile dialogs; desktop keeps the surrounding navigation available. */
export function EditorDrawer({ label, className = '', onClose, children }: {
  label: string; className?: string; onClose: () => void; children: ReactNode;
}) {
  const drawer = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const [modal, setModal] = useState(() => window.matchMedia('(max-width: 820px)').matches);
  useLayoutEffect(() => { close.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    const node = drawer.current!;
    const host = node.parentElement;
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    focusHeading();
    syncMode();
    media.addEventListener('change', syncMode);
    document.addEventListener('keydown', keyboard);
    document.addEventListener('focusin', containFocus);
    return () => {
      media.removeEventListener('change', syncMode);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('focusin', containFocus);
      restoreOutside();
      // Do not steal focus from another screen when its editor is unmounted by navigation.
      if (invoker && invoker !== document.body && invoker.isConnected && !invoker.closest('[inert]') && invoker.getClientRects().length) invoker.focus();
      else if (host?.isConnected) (host.querySelector<HTMLElement>('input[type="search"]')
        ?? host.querySelector<HTMLElement>('button'))?.focus();
    };
  }, []);
  return <aside ref={drawer} tabIndex={-1} className={`text-editor-drawer ${className}`}
    role={modal ? 'dialog' : undefined} aria-modal={modal ? true : undefined} aria-label={label}>
    {children}
  </aside>;
}
