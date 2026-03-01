import { MONTH_OPTIONS_PT, normalizeReportMonths, normalizeReportPeriodicity, requiredMonthCount } from '../utils/reportSchedule';
import { TRANSMISSION_VOLTAGE_OPTIONS } from '../models/projectModel';
import AppIcon from '../../../components/AppIcon';

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

  return (
    <div className="modal-backdrop">
      <div className="modal projects-modal projects-modal-kml">
        <div className="projects-modal-head">
          <h3 className="projects-modal-title">{mode === 'create' ? 'Novo empreendimento a partir de KML' : 'Revisar importacao KML'}</h3>
          <button type="button" className="projects-modal-close" aria-label="Fechar" onClick={onCancel}>
            <AppIcon name="close" />
          </button>
        </div>

        <div className="projects-modal-body">
          {importErrors.length > 0 && (
            <div className="projects-kml-errors" role="alert">
              <strong>Observacoes da importacao</strong>
              <ul>
                {importErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {mode === 'create' && (
            <div className="projects-kml-create-block">
              <div className="projects-form-grid is-three">
                <label className="projects-field">
                  <span>ID *</span>
                  <input
                    value={createFromKmlData.id}
                    onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, id: e.target.value.toUpperCase() })}
                  />
                </label>

                <label className="projects-field">
                  <span>Nome *</span>
                  <input
                    value={createFromKmlData.nome}
                    onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, nome: e.target.value })}
                  />
                </label>

                <label className="projects-field">
                  <span>Tipo</span>
                  <select value={createFromKmlData.tipo} onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, tipo: e.target.value })}>
                    <option>Linha de Transmissão</option>
                    <option>Reservatório de Represa</option>
                  </select>
                </label>

                <label className="projects-field">
                  <span>kV</span>
                  <select value={createFromKmlData.tensao || ''} onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, tensao: e.target.value })}>
                    <option value="">Selecione a tensao (kV)</option>
                    {TRANSMISSION_VOLTAGE_OPTIONS.map((kv) => (
                      <option key={kv} value={kv}>{kv} kV</option>
                    ))}
                  </select>
                </label>

                <label className="projects-field">
                  <span>Extensao (km)</span>
                  <input
                    value={createFromKmlData.extensao}
                    onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, extensao: e.target.value })}
                  />
                </label>

                <label className="projects-field">
                  <span>Torres (qtd)</span>
                  <input
                    value={createFromKmlData.torres}
                    onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, torres: e.target.value })}
                  />
                </label>
              </div>

              <div className="projects-kml-periodicity-block">
                <div className="projects-kml-periodicity-label">Periodicidade do relatorio</div>
                <div className="projects-kml-periodicity-row">
                {['Trimestral', 'Semestral', 'Anual', 'Bienal'].map((periodicidade) => (
                  <button
                    key={periodicidade}
                    type="button"
                    className={`projects-periodicity-btn ${periodicidadeCreate === periodicidade ? 'is-selected' : ''}`.trim()}
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

              <div className="projects-month-section">
                <div className="projects-month-head">
                  <span>Meses de entrega</span>
                  <small>{normalizeReportMonths(createFromKmlData.mesesEntregaRelatorio).length}/{requiredMonthCount(periodicidadeCreate)}</small>
                </div>
                <div className="projects-month-grid is-six">
                  {MONTH_OPTIONS_PT.map((m) => {
                    const selected = normalizeReportMonths(createFromKmlData.mesesEntregaRelatorio).includes(m.value);
                    return (
                      <button
                        key={`create-kml-month-${m.value}`}
                        type="button"
                        className={`projects-month-btn ${selected ? 'is-selected' : ''}`.trim()}
                        onClick={() => toggleCreateMonth(m.value)}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {periodicidadeCreate === 'Bienal' && (
                <label className="projects-field projects-kml-year-field">
                  <span>Ano base (bienal)</span>
                  <input
                    type="number"
                    min="2000"
                    value={createFromKmlData.anoBaseBienal || ''}
                    onChange={(e) => setCreateFromKmlData({ ...createFromKmlData, anoBaseBienal: e.target.value })}
                    placeholder="Ex.: 2026"
                  />
                </label>
              )}
            </div>
          )}

          {mode === 'merge' && (
            <div className="projects-kml-merge-meta">
              <div className="projects-kml-merge-title">Comparacao de metadados do KML</div>
              <div>ID atual: <strong>{kmlMergeSnapshot?.id || '-'}</strong> | Sigla KML (sugerida): <strong>{kmlMeta?.sigla || '-'}</strong></div>
              <div>Nome atual: <strong>{kmlMergeSnapshot?.nome || '-'}</strong> | Nome KML (sugerido): <strong>{kmlMeta?.linhaNome || kmlMeta?.nome || '-'}</strong></div>
              <div>Extensao atual: <strong>{kmlMergeSnapshot?.extensao || '-'}</strong> | Extensao KML: <strong>{kmlMeta?.extensao || '-'}</strong></div>
              <div>Torres atual: <strong>{kmlMergeSnapshot?.torres || '-'}</strong> | Torres KML: <strong>{String(kmlMeta?.torres ?? '-')}</strong></div>
              <label className="projects-kml-merge-toggle">
                <input
                  type="checkbox"
                  checked={!!applyKmlMetadataOnMerge}
                  onChange={(e) => setApplyKmlMetadataOnMerge(e.target.checked)}
                />
                Aplicar metadados do KML (nome, extensao e torres)
              </label>
            </div>
          )}

          <div className="projects-kml-table-wrap">
            <table className="projects-kml-table">
              <thead>
                <tr>
                  <th>Torre</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Origem</th>
                  <th>Erro</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {reviewedKml.rows.map((row, index) => (
                  <tr key={row.key || index} className={row.error ? 'is-error' : ''}>
                    <td>
                      <input value={row.numero} onChange={(e) => updateKmlRow(index, { numero: e.target.value })} />
                    </td>
                    <td>
                      <input value={row.latitude} onChange={(e) => updateKmlRow(index, { latitude: e.target.value })} />
                    </td>
                    <td>
                      <input value={row.longitude} onChange={(e) => updateKmlRow(index, { longitude: e.target.value })} />
                    </td>
                    <td>{row.sourceName || '-'}</td>
                    <td className="projects-kml-error-cell">{row.error || '-'}</td>
                    <td>
                      <button type="button" className="projects-kml-remove-btn" aria-label={`Remover linha ${index + 1}`} onClick={() => removeKmlRow(index)}>
                        <AppIcon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
                {reviewedKml.rows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="projects-kml-empty-cell">Nenhum ponto no KML.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="projects-modal-foot projects-kml-foot">
          <div className="projects-kml-summary">
            Validas: <strong>{validCount}</strong> | Com erro: <strong>{invalidCount}</strong>
          </div>
          <div className="projects-kml-foot-actions">
            <button type="button" className="projects-cancel-btn" onClick={onCancel}>Cancelar</button>
            <button type="button" className="projects-save-btn" onClick={onApply}>
              {mode === 'create' ? 'Criar empreendimento' : 'Aplicar importacao'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KmlReviewModal;
