import { MONTH_OPTIONS_PT, normalizeReportMonths, normalizeReportPeriodicity, requiredMonthCount } from '../utils/reportSchedule';

function ProjectFormModal({ open, isEditing, formData, setFormData, onSave, onCancel, onImportKml }) {
  if (!open) return null;

  function toggleMonth(monthValue) {
    const month = Number(monthValue);
    setFormData((prev) => {
      const current = normalizeReportMonths(prev.mesesEntregaRelatorio);
      const exists = current.includes(month);
      const nextMonths = exists ? current.filter((m) => m !== month) : [...current, month];
      return {
        ...prev,
        mesesEntregaRelatorio: normalizeReportMonths(nextMonths),
      };
    });
  }

  const gpsCount = Array.isArray(formData.torresCoordenadas) ? formData.torresCoordenadas.length : 0;

  return (
    <div className="modal-backdrop">
      <div className="modal xwide">
        <h3>{isEditing ? 'Editar' : 'Novo'} Empreendimento</h3>

        <div className="grid-form">
          <input
            placeholder="ID (Sigla)"
            value={formData.id}
            onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
            disabled={isEditing}
          />
          <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
            <option>Linha de Transmissão</option>
            <option>Reservatório de Represa</option>
          </select>
          <input placeholder="Nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />

          <div className="inline-row">
            <small>Torres georreferenciadas: <strong>{gpsCount}</strong></small>
            <button type="button" onClick={onImportKml}>Importar KML</button>
          </div>

          <select
            value={normalizeReportPeriodicity(formData.periodicidadeRelatorio)}
            onChange={(e) => setFormData({
              ...formData,
              periodicidadeRelatorio: normalizeReportPeriodicity(e.target.value),
              mesesEntregaRelatorio: [],
              anoBaseBienal: '',
            })}
          >
            <option value="Trimestral">Trimestral</option>
            <option value="Semestral">Semestral</option>
            <option value="Anual">Anual</option>
            <option value="Bienal">Bienal (2 anos)</option>
          </select>

          <div className="month-row">
            {MONTH_OPTIONS_PT.map((m) => {
              const selected = normalizeReportMonths(formData.mesesEntregaRelatorio).includes(m.value);
              return (
                <button key={m.value} type="button" className={selected ? 'chip-active' : ''} onClick={() => toggleMonth(m.value)}>
                  {m.label}
                </button>
              );
            })}
          </div>
          <small>
            {normalizeReportMonths(formData.mesesEntregaRelatorio).length}/{requiredMonthCount(formData.periodicidadeRelatorio)}
          </small>

          {normalizeReportPeriodicity(formData.periodicidadeRelatorio) === 'Bienal' && (
            <input
              type="number"
              min="2000"
              placeholder="Ano base (bienal)"
              value={formData.anoBaseBienal ?? ''}
              onChange={(e) => setFormData({ ...formData, anoBaseBienal: e.target.value })}
            />
          )}

          {formData.tipo === 'Linha de Transmissão' && (
            <>
              <input placeholder="kV" value={formData.tensao} onChange={(e) => setFormData({ ...formData, tensao: e.target.value })} />
              <input placeholder="Extensão (km)" value={formData.extensao} onChange={(e) => setFormData({ ...formData, extensao: e.target.value })} />
              <input placeholder="Torres (qtd)" value={formData.torres} onChange={(e) => setFormData({ ...formData, torres: e.target.value })} />
            </>
          )}
        </div>

        <div className="row-actions">
          <button type="button" onClick={onSave}>Salvar</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default ProjectFormModal;
