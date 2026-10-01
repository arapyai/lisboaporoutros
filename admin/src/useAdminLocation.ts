import { useEffect, useRef, useState } from 'react';
import { confirmAdminNavigation } from './unsavedChanges';

/** One accepted address: cancelled history navigation keeps the full editor context. */
export function useAdminLocation() {
  const [hash, setHash] = useState(() => window.location.hash);
  const accepted = useRef(hash);
  function navigateHash(next: string, options: { guard?: boolean; replace?: boolean } = {}) {
    if (next === accepted.current) return true;
    if (options.guard !== false && !confirmAdminNavigation()) return false;
    window.history[options.replace ? 'replaceState' : 'pushState'](null, '', next);
    accepted.current = next;
    setHash(next);
    return true;
  }
  useEffect(() => {
    const followHistory = () => {
      const next = window.location.hash;
      if (next === accepted.current) return;
      if (!confirmAdminNavigation()) {
        window.history.replaceState(null, '', accepted.current || '#/authors');
        return;
      }
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
