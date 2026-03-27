import AppIcon from '../../../components/AppIcon';
import { Button, Select } from '../../../components/ui';

function ErosionReportPanel({
  reportFilters,
  reportYears = [],
  selectedReportYears = [],
  onSetFilters,
  onExportCsv,
  onExportPdf,
  onPrintBatchFichasPdf = () => { },
  onPrintBatchFichasSimplificadas = () => { },
  collapsed = true,
  onToggleCollapsed = () => { },
}) {
  return (
    <article className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div
        className="flex flex-wrap items-center justify-between gap-4 p-5 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors select-none"
        onClick={onToggleCollapsed}
        role="button"
        tabIndex={0}
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-slate-800 m-0">Exportar relatório de erosões</h3>
          <div className="text-sm text-slate-500 m-0">
            Filtro ativo: empreendimento <strong className="font-semibold text-slate-700">{reportFilters.projetoId || '-'}</strong> | ano(s) <strong className="font-semibold text-slate-700">{selectedReportYears.length > 0 ? selectedReportYears.join(', ') : 'Todos'}</strong>.
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
        >
          <AppIcon name={collapsed ? 'chevron-down' : 'chevron-up'} />
          {collapsed ? 'Expandir' : 'Recolher'}
        </Button>
      </div>

      {!collapsed ? (
        <div className="p-5 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <Select
              id="report-ano-base"
              label="Ano base"
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
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetFilters((prev) => ({ ...prev, mostrarMultiAno: !prev.mostrarMultiAno }))}
            >
              <AppIcon name={reportFilters.mostrarMultiAno ? 'close' : 'details'} />
              {reportFilters.mostrarMultiAno ? 'Ocultar seleção de mais anos' : 'Selecionar mais de um ano'}
            </Button>
          </div>

          {reportFilters.mostrarMultiAno ? (
            <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-sm font-semibold text-slate-700">Anos adicionais (além do ano principal)</div>
              <div className="flex flex-wrap gap-2">
                {reportYears
                  .filter((year) => String(reportFilters.ano || '') === '' || Number(year) !== Number(reportFilters.ano))
                  .map((year) => {
                    const checked = (reportFilters.anosExtras || []).includes(year);
                    return (
                      <label key={year} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors select-none has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
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
                <p className="text-sm text-slate-500 italic m-0">Sem outros anos disponíveis para este empreendimento.</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" size="md" onClick={onExportCsv}>
              <AppIcon name="csv" />
              Exportar CSV
            </Button>
            <Button variant="primary" size="md" onClick={onExportPdf}>
              <AppIcon name="pdf" />
              Exportar PDF
            </Button>
            <Button variant="outline" size="md" onClick={onPrintBatchFichasPdf}>
              <AppIcon name="pdf" />
              Imprimir fichas (lote)
            </Button>
            <Button variant="outline" size="md" onClick={onPrintBatchFichasSimplificadas}>
              <AppIcon name="pdf" />
              Fichas simplificadas (lote)
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default ErosionReportPanel;
