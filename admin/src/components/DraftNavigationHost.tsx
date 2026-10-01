import { useEffect, useSyncExternalStore } from 'react';
import { cancelAdminNavigation, finishAdminNavigation, getPendingAdminNavigation, subscribeAdminNavigation } from '../unsavedChanges';
import { DraftNavigationDialog } from './DraftNavigationDialog';

export function DraftNavigationHost() {
  const pending = useSyncExternalStore(subscribeAdminNavigation, getPendingAdminNavigation);
  useEffect(() => cancelAdminNavigation, []);
  return pending ? <DraftNavigationDialog onCancel={cancelAdminNavigation} onLeave={finishAdminNavigation} /> : null;
}
