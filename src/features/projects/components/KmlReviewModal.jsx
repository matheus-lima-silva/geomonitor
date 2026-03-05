import { MONTH_OPTIONS_PT, normalizeReportMonths, normalizeReportPeriodicity, requiredMonthCount } from '../utils/reportSchedule';
import { TRANSMISSION_VOLTAGE_OPTIONS } from '../models/projectModel';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select } from '../../../components/ui';

function KmlReviewModal({
  open,
  mode,
  reviewedKml,
  importErrors,
  createFromKmlData,
  setCreateFromKmlData,
  kmlMeta,
  kmlMergeSnapshot,
  applyKmlMetadataOnMerge,
  setApplyKmlMetadataOnMerge,
  setKmlRows,
  onCancel,
  onApply,
}) {
  if (!open) return null;

  function updateKmlRow(index, patch) {
    setKmlRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeKmlRow(index) {
    setKmlRows((prev) => prev.filter((_, idx) => idx !== index));
  }

  function toggleCreateMonth(monthValue) {
    const month = Number(monthValue);
    setCreateFromKmlData((prev) => {
      const current = normalizeReportMonths(prev.mesesEntregaRelatorio);
      const exists = current.includes(month);
      const nextMonths = exists ? current.filter((m) => m !== month) : [...current, month];
      return { ...prev, mesesEntregaRelatorio: normalizeReportMonths(nextMonths) };
    });
  }

  const periodicidadeCreate = normalizeReportPeriodicity(createFromKmlData.periodicidadeRelatorio);
  const validCount = reviewedKml.rows.filter((r) => !r.error).length;
  const invalidCount = reviewedKml.rows.filter((r) => !!r.error).length;

  const footer = (
    <>
      <div className="text-sm text-slate-600">
        Válidas: <strong>{validCount}</strong> | Com erro: <strong>{invalidCount}</strong>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={onApply}>
          {mode === 'create' ? 'Criar empreendimento' : 'Aplicar importação'}
        </Button>
      </div>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={mode === 'create' ? 'Novo empreendimento a partir de KML' : 'Revisar importação KML'}
      size="xl"
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        {importErrors.length > 0 && (
          <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 text-sm" role="alert">
            <strong className="block mb-2">Observacoes da importacao</strong>
            <ul className="list-disc pl-5 m-0 space-y-1">
              {importErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {mode === 'create' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Input
                id="kml-id"
                label="ID *"
                value={createFromKmlData.id}
                onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, id: e.target.value.toUpperCase() })}
              />
              <Input
                id="kml-nome"
                label="Nome *"
                value={createFromKmlData.nome}
                onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, nome: e.target.value })}
              />
              <Select
                id="kml-tipo"
                label="Tipo"
                value={createFromKmlData.tipo}
                onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, tipo: e.target.value })}
              >
                <option>Linha de Transmissão</option>
                <option>Reservatório de Represa</option>
              </Select>
              <Select
                id="kml-tensao"
                label="kV"
                value={createFromKmlData.tensao || ''}
                onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, tensao: e.target.value })}
              >
                <option value="">Selecione a tensão (kV)</option>
                {TRANSMISSION_VOLTAGE_OPTIONS.map((kv) => (
                  <option key={kv} value={kv}>{kv} kV</option>
                ))}
              </Select>
              <Input
                id="kml-extensao"
                label="Extensão (km)"
                value={createFromKmlData.extensao}
                onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, extensao: e.target.value })}
              />
              <Input
                id="kml-torres"
                label="Torres (qtd)"
                value={createFromKmlData.torres}
                onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, torres: e.target.value })}
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-sm font-semibold text-slate-700 mb-3">Periodicidade do relatorio</div>
              <div className="flex flex-wrap gap-2">
                {['Trimestral', 'Semestral', 'Anual', 'Bienal'].map((periodicidade) => (
                  <button
                    key={periodicidade}
                    type="button"
                    className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${periodicidadeCreate === periodicidade
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                      }`}
                    onClick={() => setCreateFromKmlData({
                      ...createFromKmlData,
                      periodicidadeRelatorio: periodicidade,
                      mesesEntregaRelatorio: [],
                      anoBaseBienal: '',
                    })}
                  >
                    {periodicidade}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3 text-sm font-semibold text-slate-700">
                <span>Meses de entrega</span>
                <span className="text-slate-500 font-normal">{normalizeReportMonths(createFromKmlData.mesesEntregaRelatorio).length}/{requiredMonthCount(periodicidadeCreate)}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {MONTH_OPTIONS_PT.map((m) => {
                  const selected = normalizeReportMonths(createFromKmlData.mesesEntregaRelatorio).includes(m.value);
                  return (
                    <button
                      key={`create-kml-month-${m.value}`}
                      type="button"
                      className={`px-3 py-2 text-sm font-medium border rounded-lg transition-colors text-center ${selected
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      onClick={() => toggleCreateMonth(m.value)}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {periodicidadeCreate === 'Bienal' && (
              <div className="w-[200px]">
                <Input
                  id="kml-biennial-base-year"
                  label="Ano base (bienal)"
                  type="number"
                  min="2000"
                  value={createFromKmlData.anoBaseBienal || ''}
                  onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, anoBaseBienal: e.target.value })}
                  placeholder="Ex.: 2026"
                />
              </div>
            )}
          </div>
        )}

        {mode === 'merge' && (
          <div className="bg-brand-50 text-brand-900 border border-brand-100 rounded-xl p-4 text-sm flex flex-col gap-2">
            <div className="font-bold text-base mb-1">Comparacao de metadados do KML</div>
            <div>ID atual: <strong>{kmlMergeSnapshot?.id || '-'}</strong> | Sigla KML (sugerida): <strong>{kmlMeta?.sigla || '-'}</strong></div>
            <div>Nome atual: <strong>{kmlMergeSnapshot?.nome || '-'}</strong> | Nome KML (sugerido): <strong>{kmlMeta?.linhaNome || kmlMeta?.nome || '-'}</strong></div>
            <div>Extensao atual: <strong>{kmlMergeSnapshot?.extensao || '-'}</strong> | Extensao KML: <strong>{kmlMeta?.extensao || '-'}</strong></div>
            <div>Torres atual: <strong>{kmlMergeSnapshot?.torres || '-'}</strong> | Torres KML: <strong>{String(kmlMeta?.torres ?? '-')}</strong></div>
            <label className="flex items-center gap-2 mt-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={!!applyKmlMetadataOnMerge}
                onChange={(e) => setApplyKmlMetadataOnMerge(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              Aplicar metadados do KML (nome, extensao e torres)
            </label>
          </div>
        )}

        <div className="overflow-x-auto w-full border border-slate-200 rounded-xl max-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Torre</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Latitude</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Longitude</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Origem</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Erro</th>
                <th className="px-3 py-3 font-semibold text-slate-600 border-b border-slate-200">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {reviewedKml.rows.map((row, index) => (
                <tr key={row.key || index} className={`hover:bg-slate-50 transition-colors ${row.error ? 'bg-red-50/50' : ''}`}>
                  <td className="px-3 py-2">
                    <input className="w-full min-w-[100px] px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none" value={row.numero} onChange={(e) => updateKmlRow(index, { numero: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-full min-w-[120px] px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none" value={row.latitude} onChange={(e) => updateKmlRow(index, { latitude: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-full min-w-[120px] px-2 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none" value={row.longitude} onChange={(e) => updateKmlRow(index, { longitude: e.target.value })} />
                  </td>
                  <td className="px-3 py-2 text-slate-700">{row.sourceName || '-'}</td>
                  <td className="px-3 py-2 text-red-600 font-medium max-w-[200px] truncate" title={row.error || ''}>{row.error || '-'}</td>
                  <td className="px-3 py-2">
                    <Button variant="danger" size="sm" aria-label={`Remover linha ${index + 1}`} onClick={() => removeKmlRow(index)}>
                      <AppIcon name="trash" />
                    </Button>
                  </td>
                </tr>
              ))}
              {reviewedKml.rows.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center p-6 text-slate-500">Nenhum ponto no KML.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export default KmlReviewModal;


