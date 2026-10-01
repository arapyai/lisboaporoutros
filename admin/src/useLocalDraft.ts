import { useEffect, useRef, useState } from 'react';
import { clearRecordLocalDrafts, draftFingerprint, localDraftKey, readLocalDraft, writeLocalDraft, type DraftIdentity, type LocalDraft } from './localDraftStore';

/** Domain validation is mandatory; this hook must never receive passwords or auth state. */
export function useLocalDraft<T>({ identity, baseline, remoteBaseline = baseline, value, ready, validate, onRestore, preferCurrent = false }: {
  identity: DraftIdentity; baseline: T; remoteBaseline?: T; value: T; ready: boolean;
  validate: (value: unknown) => T | null; onRestore: (value: T, baseline: T) => void; preferCurrent?: boolean;
}) {
  const key = localDraftKey(identity);
  const [inspection, setInspection] = useState<{ key: string; candidate: LocalDraft<T> | null }>({ key: '', candidate: null });
  const [warning, setWarning] = useState('');
  const [notice, setNotice] = useState('');
  const [stored, setStored] = useState<{ key: string; fingerprint: string } | null>(null);
  const inspectedKey = useRef('');
  const ignoredValue = useRef<{ key: string; fingerprint: string } | null>(null);
  const valueFingerprint = draftFingerprint(value);
  const baselineFingerprint = draftFingerprint(baseline);
  const candidate = inspection.key === key ? inspection.candidate : null;
  const warn = () => setWarning('O navegador não permite guardar o rascunho local. Guarde no servidor antes de sair ou recarregar.');

  useEffect(() => {
    if (!ready || inspectedKey.current === key) return;
    inspectedKey.current = key;
    ignoredValue.current = null;
    setWarning(''); setNotice(''); setStored(null);
    try {
      const storedDraft = readLocalDraft(localStorage, identity, validate);
      setInspection({ key, candidate: preferCurrent ? null : storedDraft });
    }
    catch { warn(); setInspection({ key, candidate: null }); }
  }, [key, ready]);

  useEffect(() => {
    if (!ready || inspection.key !== key || candidate) return;
    if (ignoredValue.current?.key === key && ignoredValue.current.fingerprint === valueFingerprint) return;
    try {
      const safeBaseline = validate(baseline), safeValue = validate(value);
      if (!safeBaseline || !safeValue) throw new Error('Invalid draft schema');
      writeLocalDraft(localStorage, identity, safeBaseline, safeValue);
      setWarning('');
      setStored({ key, fingerprint: valueFingerprint });
    } catch { warn(); }
  }, [key, ready, inspection, valueFingerprint, baselineFingerprint]);

  function clearStored(allLanguages: boolean) {
    ignoredValue.current = { key, fingerprint: valueFingerprint };
    try {
      if (allLanguages) clearRecordLocalDrafts(localStorage, identity);
      else localStorage.removeItem(key);
    } catch { warn(); }
    setInspection({ key, candidate: null });
    setNotice('');
    setStored(null);
  }
  function restore() {
    if (!candidate) return;
    onRestore(candidate.value, candidate.baseline);
    setInspection({ key, candidate: null });
    setNotice('Rascunho local restaurado. Ainda não foi guardado no servidor.');
  }
  const baseChanged = Boolean(candidate && draftFingerprint(candidate.baseline) !== draftFingerprint(remoteBaseline));
  const localNotice = valueFingerprint !== baselineFingerprint && stored?.key === key && stored.fingerprint === valueFingerprint
    ? 'Alterações locais: cópia neste navegador por até sete dias. Ainda não foram guardadas no servidor.' : '';
  return { candidate, baseChanged, warning, notice: notice || localNotice, restore,
    clear: () => clearStored(false), clearAll: () => clearStored(true), inspecting: ready && inspection.key !== key };
}
