import { useState, useMemo } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Modal } from '../../../components/ui';

function KmlLinePickerModal({ open, lines, existingProjectIds, onSelect, onBatchCreate, onCancel, batchCreating }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  const existingSet = useMemo(
    () => new Set((existingProjectIds || []).map((id) => String(id).toUpperCase())),
    [existingProjectIds],
  );

  const safeLines = lines || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return safeLines;
    const term = search.trim().toLowerCase();
    return safeLines.filter(
      (line) =>
        line.sigla.toLowerCase().includes(term) ||
        line.descriptiveName.toLowerCase().includes(term),
    );
  }, [safeLines, search]);

  const newFiltered = useMemo(
    () => filtered.filter((line) => !existingSet.has(line.sigla.toUpperCase())),
    [filtered, existingSet],
  );

  function toggleSelection(sigla) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sigla)) next.delete(sigla);
      else next.add(sigla);
      return next;
    });
  }

  function toggleAllNew() {
    const allNewSiglas = newFiltered.map((l) => l.sigla);
    const allSelected = allNewSiglas.every((s) => selected.has(s));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allNewSiglas.forEach((s) => next.delete(s));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        allNewSiglas.forEach((s) => next.add(s));
        return next;
      });
    }
  }

  if (!open) return null;

  const selectedLines = safeLines.filter((l) => selected.has(l.sigla));
  const canBatch = selectedLines.length > 0 && !batchCreating;

  const footer = (
    <div className="flex items-center justify-between w-full gap-3">
      <div className="text-sm text-slate-600">
        {selected.size > 0 && <span><strong>{selected.size}</strong> selecionada(s)</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onCancel}><AppIcon name="close" />Cancelar</Button>
        {onBatchCreate && (
          <Button
            variant="primary"
            disabled={!canBatch}
            onClick={() => onBatchCreate(selectedLines)}
          >
            <AppIcon name="plus" />
            {batchCreating ? 'Criando...' : `Criar ${selected.size > 0 ? selected.size : ''} em lote`}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Selecionar linha de transmissao"
      size="xl"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por sigla ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
          />
          <span className="text-sm text-slate-500 whitespace-nowrap">
            {filtered.length} de {safeLines.length} linhas
          </span>
        </div>

        <div className="overflow-x-auto w-full border border-slate-200 rounded-xl max-h-[450px]">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr>
                {onBatchCreate && (
                  <th className="px-3 py-3 border-b border-slate-200 w-10">
                    <input
                      type="checkbox"
                      checked={newFiltered.length > 0 && newFiltered.every((l) => selected.has(l.sigla))}
                      onChange={toggleAllNew}
                      className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                      title="Selecionar todas as novas"
                    />
                  </th>
                )}
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Sigla</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Nome</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Circuitos</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Torres</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Extensao (km)</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Status</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((line) => {
                const isRegistered = existingSet.has(line.sigla.toUpperCase());
                const isSelected = selected.has(line.sigla);
                return (
                  <tr key={line.sigla} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-brand-50/40' : ''}`}>
                    {onBatchCreate && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isRegistered}
                          onChange={() => toggleSelection(line.sigla)}
                          className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 disabled:opacity-40"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 font-medium text-slate-800">{line.sigla}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[250px] truncate" title={line.descriptiveName}>
                      {line.descriptiveName || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{line.circuitCount}</td>
                    <td className="px-3 py-2 text-slate-600">{line.towerCount}</td>
                    <td className="px-3 py-2 text-slate-600">{line.lengthKm || '-'}</td>
                    <td className="px-3 py-2">
                      {isRegistered && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Ja cadastrada
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button variant="primary" size="sm" onClick={() => onSelect(line)}>
                        <AppIcon name="check" />
                        Selecionar
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={onBatchCreate ? 8 : 7} className="text-center p-6 text-slate-500">
                    Nenhuma linha encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export default KmlLinePickerModal;
