import AppIcon from '../../../components/AppIcon';

function ErosionReportPanel({
  reportFilters,
  reportYears = [],
  selectedReportYears = [],
  onSetFilters,
  onExportCsv,
  onExportPdf,
  onPrintBatchFichasPdf = () => {},
  collapsed = true,
  onToggleCollapsed = () => {},
}) {
  return (
    <article className="erosions-report-panel">
      <div className="erosions-report-head">
        <div className="erosions-report-head-copy">
          <h3 className="erosions-report-title">Exportar relatorio de erosoes</h3>
          <div className="muted erosions-report-summary">
            Filtro ativo: empreendimento <strong>{reportFilters.projetoId || '-'}</strong> | ano(s) <strong>{selectedReportYears.length > 0 ? selectedReportYears.join(', ') : 'Todos'}</strong>.
          </div>
        </div>
        <button
          type="button"
          className="secondary erosions-report-collapse-btn"
          onClick={onToggleCollapsed}
        >
          <AppIcon name={collapsed ? 'chevron-down' : 'chevron-up'} />
          {collapsed ? 'Expandir' : 'Recolher'}
        </button>
      </div>

      {!collapsed ? (
        <div className="erosions-report-body">
          <div className="erosions-report-grid">
            <label className="erosions-field">
              <span>Ano base</span>
              <select
                value={String(reportFilters.ano)}
                onChange={(e) => onSetFilters((prev) => ({
                  ...prev,
                  ano: e.target.value,
                  anosExtras: (prev.anosExtras || []).filter((year) => Number(year) !== Number(e.target.value)),
                }))}
              >
                <option value="">Todos os anos</option>
                {reportYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="secondary erosions-report-toggle"
              onClick={() => onSetFilters((prev) => ({ ...prev, mostrarMultiAno: !prev.mostrarMultiAno }))}
            >
              <AppIcon name={reportFilters.mostrarMultiAno ? 'close' : 'details'} />
              {reportFilters.mostrarMultiAno ? 'Ocultar selecao de mais anos' : 'Selecionar mais de um ano'}
            </button>
          </div>

          {reportFilters.mostrarMultiAno ? (
            <div className="erosions-report-multi">
              <div className="erosions-report-multi-title">Anos adicionais (alem do ano principal)</div>
              <div className="erosions-report-multi-grid">
                {reportYears
                  .filter((year) => String(reportFilters.ano || '') === '' || Number(year) !== Number(reportFilters.ano))
                  .map((year) => {
                    const checked = (reportFilters.anosExtras || []).includes(year);
                    return (
                      <label key={year} className="erosions-report-year-chip">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            onSetFilters((prev) => {
                              const current = new Set((prev.anosExtras || []).map((item) => Number(item)));
                              if (e.target.checked) current.add(year);
                              else current.delete(year);
                              return {
                                ...prev,
                                anosExtras: [...current].sort((a, b) => a - b),
                              };
                            });
                          }}
                        />
                        <span>{year}</span>
                      </label>
                    );
                  })}
              </div>
              {reportYears.filter((year) => Number(year) !== Number(reportFilters.ano)).length === 0 ? (
                <p className="muted">Sem outros anos disponiveis para este empreendimento.</p>
              ) : null}
            </div>
          ) : null}

          <div className="row-actions erosions-report-actions">
            <button type="button" className="secondary" onClick={onExportCsv}>
              <AppIcon name="csv" />
              Exportar CSV
            </button>
            <button type="button" onClick={onExportPdf}>
              <AppIcon name="pdf" />
              Exportar PDF
            </button>
            <button type="button" className="secondary" onClick={onPrintBatchFichasPdf}>
              <AppIcon name="pdf" />
              Imprimir fichas (lote)
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default ErosionReportPanel;
