// Config global do Relatorio Mensal (equipe + contrato) — carrega no mount e
// expoe save (upsert). O editor so monta depois de `loading` terminar, para o
// seed de mes novo ja contar com equipe/contrato.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSettings, saveSettings } from '../services/monthlyReportService';

export function useReportSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const data = await fetchSettings();
        if (mountedRef.current) setSettings(data);
      } catch (err) {
        if (mountedRef.current) {
          setError(err?.message || 'Erro ao carregar as configurações.');
          setSettings({ team: [], contrato: { numero: '', objeto: '', contratante: '', contratada: '' } });
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  const save = useCallback(async (data) => {
    const saved = await saveSettings(data);
    if (mountedRef.current) setSettings(saved);
    return saved;
  }, []);

  return { settings, loading, error, save };
}
