import { MONTH_OPTIONS_PT, normalizeReportMonths, normalizeReportPeriodicity, requiredMonthCount } from '../utils/reportSchedule';

function KmlReviewModal({
  open,
  mode,
  kmlRows,
  reviewedKml,
  importErrors,
  createFromKmlData,
  setCreateFromKmlData,
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

  return (
    <div className="modal-backdrop">
      <div className="modal xwide">
        <h3>{mode === 'create' ? 'Novo empreendimento a partir de KML' : 'Revisar importação KML'}</h3>

        {importErrors.length > 0 && <div className="notice">{importErrors.join(' ')}</div>}

        {mode === 'create' && (
          <div className="grid-form">
            <input value={createFromKmlData.id} onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, id: e.target.value.toUpperCase() })} placeholder="ID" />
            <input value={createFromKmlData.nome} onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, nome: e.target.value })} placeholder="Nome" />
            <select value={createFromKmlData.tipo} onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, tipo: e.target.value })}>
              <option>Linha de Transmissão</option>
              <option>Reservatório de Represa</option>
            </select>
            <select
              value={normalizeReportPeriodicity(createFromKmlData.periodicidadeRelatorio)}
              onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, periodicidadeRelatorio: e.target.value, mesesEntregaRelatorio: [], anoBaseBienal: '' })}
            >
              <option value="Trimestral">Trimestral</option>
              <option value="Semestral">Semestral</option>
              <option value="Anual">Anual</option>
              <option value="Bienal">Bienal</option>
            </select>
            <div className="month-row">
              {MONTH_OPTIONS_PT.map((m) => {
                const selected = normalizeReportMonths(createFromKmlData.mesesEntregaRelatorio).includes(m.value);
                return (
                  <button key={m.value} type="button" className={selected ? 'chip-active' : ''} onClick={() => toggleCreateMonth(m.value)}>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <small>
              {normalizeReportMonths(createFromKmlData.mesesEntregaRelatorio).length}/
              {requiredMonthCount(createFromKmlData.periodicidadeRelatorio)}
            </small>
          </div>
        )}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Torre</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Origem</th>
                <th>Erro</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {reviewedKml.rows.map((row, index) => (
                <tr key={row.key || index}>
                  <td><input value={row.numero} onChange={(e) => updateKmlRow(index, { numero: e.target.value })} /></td>
                  <td><input value={row.latitude} onChange={(e) => updateKmlRow(index, { latitude: e.target.value })} /></td>
                  <td><input value={row.longitude} onChange={(e) => updateKmlRow(index, { longitude: e.target.value })} /></td>
                  <td>{row.sourceName || '-'}</td>
                  <td>{row.error || '-'}</td>
                  <td><button type="button" className="danger" onClick={() => removeKmlRow(index)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row-actions">
          <button type="button" onClick={onApply}>{mode === 'create' ? 'Criar empreendimento' : 'Aplicar importação'}</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default KmlReviewModal;
