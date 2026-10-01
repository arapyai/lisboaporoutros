import { useEffect, useRef, useState } from 'react';
import { adminDraftNavigationState, getPendingAdminNavigation, requestAdminNavigation } from './unsavedChanges';

/** One accepted address: cancelled history navigation keeps the full editor context. */
export function useAdminLocation() {
  const [hash, setHash] = useState(() => window.location.hash);
  const accepted = useRef(hash);
  const position = useRef<number>(window.history.state?.adminNavigationIndex ?? 0);
  function navigateHash(next: string, options: { guard?: boolean; replace?: boolean } = {}) {
    if (next === accepted.current) return true;
    const commit = () => {
      if (!options.replace) position.current++;
      window.history[options.replace ? 'replaceState' : 'pushState'](
        { ...window.history.state, adminNavigationIndex: position.current }, '', next);
      accepted.current = next;
      setHash(next);
    };
    if (options.guard !== false) return requestAdminNavigation(commit);
    commit();
    return true;
  }
  useEffect(() => {
    window.history.replaceState({ ...window.history.state, adminNavigationIndex: position.current }, '');
    const followHistory = () => {
      const next = window.location.hash;
      if (next === accepted.current) return;
      const targetPosition: unknown = window.history.state?.adminNavigationIndex;
      if (adminDraftNavigationState().dirty || adminDraftNavigationState().blocked || getPendingAdminNavigation()) {
        const delta = typeof targetPosition === 'number' ? targetPosition - position.current : 0;
        // Restore the actual entry, not just its URL: cancelling must not consume Back/Forward.
        if (delta) window.history.go(-delta);
        else window.history.replaceState({ ...window.history.state, adminNavigationIndex: position.current }, '', accepted.current || '#/authors');
        requestAdminNavigation(() => {
          if (delta) {
            position.current = targetPosition as number;
            window.history.go(delta);
          } else window.history.replaceState({ ...window.history.state, adminNavigationIndex: position.current }, '', next);
          accepted.current = next;
          setHash(next);
        });
        return;
      }
      if (typeof targetPosition === 'number') position.current = targetPosition;
      accepted.current = next;
      setHash(next);
    };
    window.addEventListener('hashchange', followHistory);
    // A hash can change while the authenticated shell is downloading/mounting.
    followHistory();
    return () => window.removeEventListener('hashchange', followHistory);
  }, []);
  return { hash, navigateHash };
}
