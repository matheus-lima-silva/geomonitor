// Estado do Relatorio Mensal: carrega por periodo, semeia mes novo (equipe da
// config global + textos-modelo), autosave com debounce e concorrencia
// otimista (409 -> modo conflito, somente leitura ate recarregar).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchByPeriod,
  saveReport,
  VersionConflictError,
} from '../services/monthlyReportService';
import { introTemplate, conclusaoTemplate } from '../utils/templates';
import { genId, ID_PREFIX } from '../utils/ids';

export const AUTOSAVE_DELAY_MS = 1000;
export const SAVED_FLASH_MS = 1300;

function buildSeededEngineers(settings, previousNames) {
  const teamNames = (settings?.team || []).map((m) => (m.name || '').trim()).filter(Boolean);
  const names = teamNames.length > 0 ? teamNames : (previousNames || []);
  const seedNames = names.length > 0 ? names : [''];
  return seedNames.map((name, i) => ({
    id: genId(ID_PREFIX.engineer),
    name,
    sortOrder: i,
    activities: [],
    projects: [],
  }));
}

// Semeia um relatorio recem-criado (sem engenheiros): equipe da config global
// (fallback: nomes do ultimo mes carregado), textos-modelo e estilo herdado.
function seedReport(report, settings, previous) {
  if ((report.engineers || []).length > 0) return { report, seeded: false };

  const engineers = buildSeededEngineers(settings, previous?.names);
  const seeded = {
    ...report,
    engineers,
    quadroStyle: previous?.quadroStyle || report.quadroStyle || 'marcador',
    intro: report.intro || introTemplate({
      refYear: report.refYear,
      refMonth: report.refMonth,
      engineers,
      contrato: settings?.contrato || {},
    }),
    conclusao: report.conclusao || conclusaoTemplate(),
  };
  return { report: seeded, seeded: true };
}

export function useMonthlyReport({ refYear, refMonth, settings }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [conflict, setConflict] = useState(false);

  const reportRef = useRef(null);
  const dirtyRef = useRef(false);
  const conflictRef = useRef(false);
  const timerRef = useRef(null);
  const flashRef = useRef(null);
  const persistingRef = useRef(null);
  const previousPeriodRef = useRef(null); // { names, quadroStyle } do ultimo mes carregado
  const mountedRef = useRef(true);

  reportRef.current = report;
  conflictRef.current = conflict;

  const persist = useCallback(async () => {
    const current = reportRef.current;
    if (!current || !dirtyRef.current || conflictRef.current) return;
    if (persistingRef.current) {
      await persistingRef.current;
      return persist();
    }

    dirtyRef.current = false;
    setSaveStatus('saving');
    const payload = {
      refYear: current.refYear,
      refMonth: current.refMonth,
      authorName: current.authorName || '',
      status: current.status || 'draft',
      version: current.version,
      intro: current.intro || '',
      conclusao: current.conclusao || '',
      quadroStyle: current.quadroStyle || 'marcador',
      holidays: current.holidays || [],
      engineers: current.engineers || [],
    };

    persistingRef.current = (async () => {
      try {
        const saved = await saveReport(current.id, payload);
        if (!mountedRef.current) return;
        // Ids do cliente sao preservados pelo backend; basta avancar a version.
        setReport((prev) => (prev && prev.id === saved.id ? { ...prev, version: saved.version } : prev));
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

  // Mutacao generica: recebe (reportAtual) => reportNovo. Bloqueada em conflito.
  const updateReport = useCallback((mutator) => {
    if (conflictRef.current) return;
    setReport((prev) => {
      if (!prev) return prev;
      const next = mutator(prev);
      if (!next || next === prev) return prev;
      dirtyRef.current = true;
      return next;
    });
    schedule();
  }, [schedule]);

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
      const fetched = await fetchByPeriod(refYear, refMonth);
      if (!mountedRef.current) return;
      const { report: ready, seeded } = seedReport(fetched, settings, previousPeriodRef.current);
      setReport(ready);
      previousPeriodRef.current = {
        names: (ready.engineers || []).map((e) => e.name).filter(Boolean),
        quadroStyle: ready.quadroStyle,
      };
      if (seeded) {
        dirtyRef.current = true;
        schedule();
      }
    } catch (err) {
      if (mountedRef.current) setError(err?.message || 'Erro ao carregar o relatório.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [refYear, refMonth, settings, schedule]);

  // Troca de periodo: descarrega o mes anterior (flush) e carrega o novo.
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      if (reportRef.current && dirtyRef.current && !conflictRef.current) {
        await flush();
      }
      await load();
    })();
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(flashRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refYear, refMonth]);

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
    report,
    loading,
    error,
    saveStatus,
    conflict,
    updateReport,
    flush,
    reload,
  };
}
