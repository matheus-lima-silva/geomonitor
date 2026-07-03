// Estado de uma ficha PAEC: carrega por id, autosave com debounce e
// concorrencia otimista (409 -> modo conflito, somente leitura ate
// recarregar). Mesmo padrao de apps/relat/src/features/monthly-report/hooks/useMonthlyReport.js.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPlant, fetchTemplate, savePlant, VersionConflictError } from '../services/paecService';

export const AUTOSAVE_DELAY_MS = 1000;
export const SAVED_FLASH_MS = 1300;

export function usePaecPlant(plantId) {
  const [plant, setPlant] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [conflict, setConflict] = useState(false);

  const plantRef = useRef(null);
  const dirtyRef = useRef(false);
  const conflictRef = useRef(false);
  const timerRef = useRef(null);
  const flashRef = useRef(null);
  const persistingRef = useRef(null);
  const mountedRef = useRef(true);

  plantRef.current = plant;
  conflictRef.current = conflict;

  const persist = useCallback(async () => {
    const current = plantRef.current;
    if (!current || !dirtyRef.current || conflictRef.current) return;
    if (persistingRef.current) {
      await persistingRef.current;
      return persist();
    }

    dirtyRef.current = false;
    setSaveStatus('saving');
    const payload = {
      name: current.name,
      projectId: current.projectId || null,
      plantType: current.plantType || null,
      installedCapacityMw: current.installedCapacityMw ?? null,
      version: current.version,
      fields: current.fields || {},
      listItems: current.listItems || {},
      sectionFlags: current.sectionFlags || {},
    };

    persistingRef.current = (async () => {
      try {
        const saved = await savePlant(current.id, payload);
        if (!mountedRef.current) return;
        setPlant((prev) => (prev && prev.id === saved.id ? { ...prev, version: saved.version } : prev));
        setSaveStatus('saved');
        clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => {
          if (mountedRef.current) setSaveStatus((s) => (s === 'saved' ? 'idle' : s));
        }, SAVED_FLASH_MS);
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof VersionConflictError) {
          setConflict(true);
          conflictRef.current = true;
        } else {
          dirtyRef.current = true; // tenta de novo no proximo flush/mutacao
        }
        setSaveStatus('error');
      } finally {
        persistingRef.current = null;
      }
    })();
    await persistingRef.current;
  }, []);

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { persist(); }, AUTOSAVE_DELAY_MS);
  }, [persist]);

  // Mutacao generica: recebe (plantAtual) => plantNovo. Bloqueada em conflito.
  const updatePlant = useCallback((mutator) => {
    if (conflictRef.current) return;
    setPlant((prev) => {
      if (!prev) return prev;
      const next = mutator(prev);
      if (!next || next === prev) return prev;
      dirtyRef.current = true;
      return next;
    });
    schedule();
  }, [schedule]);

  // Atalho comum: atualiza o valor de um unico campo do manifest.
  const updateField = useCallback((key, value) => {
    updatePlant((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  }, [updatePlant]);

  // Substitui as linhas de um bloco tabular por inteiro (mesma semantica do
  // save no backend — replace-on-save por listKey, sem merge por linha).
  const updateListItems = useCallback((listKey, rows) => {
    updatePlant((prev) => ({ ...prev, listItems: { ...prev.listItems, [listKey]: rows } }));
  }, [updatePlant]);

  // Substitui o flag de uma secao (enabled/titleOverride). Mesmo padrao de
  // updateField — cada secao e uma chave independente do mapa.
  const updateSectionFlags = useCallback((sectionKey, flag) => {
    updatePlant((prev) => ({ ...prev, sectionFlags: { ...prev.sectionFlags, [sectionKey]: flag } }));
  }, [updatePlant]);

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    await persist();
  }, [persist]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflict(false);
    conflictRef.current = false;
    dirtyRef.current = false;
    try {
      const fetched = await fetchPlant(plantId);
      if (!mountedRef.current) return;
      setPlant(fetched);
      // O manifest (catalogo de campos/blocos/secoes) vive no template, nao
      // na ficha — busca separada por templateId apos carregar a ficha.
      const template = await fetchTemplate(fetched.templateId);
      if (!mountedRef.current) return;
      setManifest(template?.manifest || null);
    } catch (err) {
      if (mountedRef.current) setError(err?.message || 'Erro ao carregar a ficha.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [plantId]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(flashRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId]);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Melhor esforco ao fechar a aba com edicao pendente.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (dirtyRef.current && !conflictRef.current) persist();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [persist]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  return {
    plant,
    manifest,
    loading,
    error,
    saveStatus,
    conflict,
    updatePlant,
    updateField,
    updateListItems,
    updateSectionFlags,
    flush,
    reload,
  };
}
