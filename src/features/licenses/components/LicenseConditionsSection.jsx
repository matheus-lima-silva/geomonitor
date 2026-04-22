import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Select, Textarea } from '../../../components/ui';
import { MONTH_OPTIONS_PT } from '../../projects/utils/reportSchedule';
import {
  listConditions,
  bulkReplaceConditions,
} from '../services/licenseConditionService';

// Secao MVP (PR1) de condicionantes. Lista/adiciona/edita/remove condicionantes
// localmente e sincroniza via bulkReplace no momento do save da LO.
// PR3 redesenha isso em abas + primitivo proprio.

const TIPO_OPTIONS = [
  { value: 'processos_erosivos', label: 'Processos erosivos' },
  { value: 'prad', label: 'PRAD' },
  { value: 'supressao', label: 'Supressão' },
  { value: 'fauna', label: 'Fauna' },
  { value: 'emergencia', label: 'Emergência' },
  { value: 'comunicacao', label: 'Comunicação' },
  { value: 'compensacao', label: 'Compensação' },
  { value: 'geral', label: 'Geral' },
  { value: 'outro', label: 'Outro' },
];

const PERIODICITY_OPTIONS = ['', 'Mensal', 'Trimestral', 'Semestral', 'Anual', 'Bienal'];

function emptyCondition() {
  return {
    id: '',
    numero: '',
    titulo: '',
    texto: '',
    tipo: 'geral',
    prazo: '',
    periodicidadeRelatorio: '',
    mesesEntrega: [],
    parecerTecnicoRef: '',
  };
}

function LicenseConditionsSection({ licenseId, onChange, showToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const hasLicenseId = useMemo(() => Boolean(String(licenseId || '').trim()), [licenseId]);

  useEffect(() => {
    let cancelled = false;
    if (!hasLicenseId) {
      setItems([]);
      return undefined;
    }
    setLoading(true);
    listConditions(licenseId)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch((err) => { if (!cancelled) showToast?.(err?.message || 'Erro ao carregar condicionantes.', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [licenseId, hasLicenseId, showToast]);

  useEffect(() => {
    onChange?.(items);
  }, [items, onChange]);

  function updateItem(idx, patch) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function toggleMes(idx, month) {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const set = new Set(it.mesesEntrega || []);
      if (set.has(month)) set.delete(month); else set.add(month);
      return { ...it, mesesEntrega: [...set].sort((a, b) => a - b) };
    }));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyCondition()]);
    setExpanded(items.length);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (expanded === idx) setExpanded(null);
  }

  return (
    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-800 m-0">Condicionantes</h4>
        <Button variant="outline" size="sm" onClick={addItem}>
          <AppIcon name="plus" />
          Adicionar
        </Button>
      </div>

      {loading && <p className="text-xs text-slate-500 m-0">Carregando...</p>}

      {!loading && items.length === 0 && (
        <p className="text-xs text-slate-500 m-0">
          {hasLicenseId ? 'Nenhuma condicionante cadastrada.' : 'Salve a LO primeiro para adicionar condicionantes.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {items.map((cond, idx) => {
          const isOpen = expanded === idx;
          return (
            <li key={cond.id || `new-${idx}`} className="bg-white border border-slate-200 rounded-md">
              <div className="flex items-center justify-between px-3 py-2 gap-2">
                <button
                  type="button"
                  className="flex-1 text-left text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
                  onClick={() => setExpanded(isOpen ? null : idx)}
                >
                  <span className="font-mono text-xs text-slate-500 mr-2">{cond.numero || '—'}</span>
                  {cond.titulo || cond.texto?.slice(0, 80) || '(condicionante sem texto)'}
                </button>
                <span className="text-2xs uppercase tracking-wide font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {TIPO_OPTIONS.find((t) => t.value === cond.tipo)?.label || 'geral'}
                </span>
                <Button variant="outline" size="sm" onClick={() => removeItem(idx)} aria-label="Remover">
                  <AppIcon name="trash" />
                </Button>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Número"
                    placeholder="Ex.: 2.1"
                    value={cond.numero || ''}
                    onChange={(e) => updateItem(idx, { numero: e.target.value })}
                  />
                  <Select
                    label="Tipo"
                    value={cond.tipo}
                    onChange={(e) => updateItem(idx, { tipo: e.target.value })}
                  >
                    {TIPO_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                  <Input
                    label="Título (opcional)"
                    value={cond.titulo || ''}
                    onChange={(e) => updateItem(idx, { titulo: e.target.value })}
                    className="md:col-span-2"
                  />
                  <Textarea
                    label="Texto"
                    rows={4}
                    value={cond.texto || ''}
                    onChange={(e) => updateItem(idx, { texto: e.target.value })}
                    className="md:col-span-2"
                  />
                  <Input
                    label="Prazo"
                    placeholder="Ex.: 180 dias, durante vigência"
                    value={cond.prazo || ''}
                    onChange={(e) => updateItem(idx, { prazo: e.target.value })}
                  />
                  <Select
                    label="Periodicidade do relatório"
                    value={cond.periodicidadeRelatorio || ''}
                    onChange={(e) => updateItem(idx, { periodicidadeRelatorio: e.target.value })}
                  >
                    {PERIODICITY_OPTIONS.map((p) => <option key={p || 'none'} value={p}>{p || '— (não informada)'}</option>)}
                  </Select>
                  <div className="md:col-span-2">
                    <label className="text-2xs font-bold uppercase tracking-wide text-slate-500 mb-1 block">
                      Meses de entrega
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {MONTH_OPTIONS_PT.map((m) => {
                        const selected = (cond.mesesEntrega || []).includes(m.value);
                        return (
                          <button
                            key={m.value}
                            type="button"
                            className={`px-2 py-1 rounded-full text-2xs font-semibold border transition-colors ${selected ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300 hover:border-brand-400 hover:text-brand-600'}`}
                            onClick={() => toggleMes(idx, m.value)}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Input
                    label="Parecer técnico ref. (opcional)"
                    placeholder="Ex.: PT 151015/CEE/SUIMIS/2021"
                    value={cond.parecerTecnicoRef || ''}
                    onChange={(e) => updateItem(idx, { parecerTecnicoRef: e.target.value })}
                    className="md:col-span-2"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Helper que o LicensesView chama apos salvar a LO para persistir as
 * condicionantes via bulkReplace. Ignora itens invalidos (sem numero/texto).
 */
export async function persistConditions(licenseId, items) {
  const valid = (items || []).filter((c) => String(c?.numero || '').trim() && String(c?.texto || '').trim());
  if (!licenseId) return [];
  return bulkReplaceConditions(licenseId, valid);
}

export default LicenseConditionsSection;
