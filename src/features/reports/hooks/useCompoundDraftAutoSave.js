import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 1500;
const STORAGE_PREFIX = 'compound-draft';

export function storageKeyFor(userEmail) {
  const normalized = String(userEmail || 'anon').trim().toLowerCase();
  return `${STORAGE_PREFIX}:${normalized}`;
}

function readStorage(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

function writeStorage(key, payload) {
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (err) {
    return false;
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    // noop
  }
}

// Auto-save de rascunho do CompoundWizard em localStorage. Debounce 1.5s.
// Não cria endpoint backend — protege contra fechar aba, não é colaboração.
export default function useCompoundDraftAutoSave(draft, { userEmail, enabled = true } = {}) {
  const key = storageKeyFor(userEmail);
  const [status, setStatus] = useState('idle'); // idle | saving | saved
  const [savedAt, setSavedAt] = useState(null);
  const timeoutRef = useRef(null);
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined') return undefined;

    if (firstRunRef.current) {
      firstRunRef.current = false;
      return undefined;
    }

    setStatus('saving');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const ok = writeStorage(key, { draft, savedAt: new Date().toISOString() });
      if (ok) {
        setStatus('saved');
        setSavedAt(new Date());
      } else {
        setStatus('idle');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [draft, enabled, key]);

  const loadSaved = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return readStorage(key);
  }, [key]);

  const clearSaved = useCallback(() => {
    if (typeof window === 'undefined') return;
    removeStorage(key);
    setStatus('idle');
    setSavedAt(null);
  }, [key]);

  return {
    status,
    savedAt,
    loadSaved,
    clearSaved,
  };
}

// Leitura reativa do rascunho salvo — usado pelo banner de "Rascunho em
// andamento" na aba Relatorio Final. Atualiza via evento 'storage' (outras
// abas) e via reload() manual apos fechar o wizard.
export function useStoredCompoundDraft(userEmail) {
  const key = storageKeyFor(userEmail);
  const [entry, setEntry] = useState(() => {
    if (typeof window === 'undefined') return null;
    return readStorage(key);
  });

  const reload = useCallback(() => {
    if (typeof window === 'undefined') {
      setEntry(null);
      return;
    }
    setEntry(readStorage(key));
  }, [key]);

  const clear = useCallback(() => {
    if (typeof window !== 'undefined') removeStorage(key);
    setEntry(null);
  }, [key]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    function handleStorage(event) {
      if (event.key !== key) return;
      setEntry(event.newValue ? readStorage(key) : null);
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key]);

  const draft = entry?.draft || null;
  const savedAt = entry?.savedAt || null;
  return { draft, savedAt, reload, clear };
}
