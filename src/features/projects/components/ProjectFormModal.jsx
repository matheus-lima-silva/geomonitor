import { MONTH_OPTIONS_PT, normalizeReportMonths, normalizeReportPeriodicity, requiredMonthCount } from '../utils/reportSchedule';
import { TRANSMISSION_VOLTAGE_OPTIONS } from '../models/projectModel';
import AppIcon from '../../../components/AppIcon';

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
  const periodicidade = normalizeReportPeriodicity(formData.periodicidadeRelatorio);
  const isLinhaTransmissao = String(formData.tipo || '').toLowerCase().includes('linha de transmiss');

  return (
    <div className="modal-backdrop">
      <div className="modal projects-modal projects-modal-form">
        <div className="projects-modal-head">
          <h3 className="projects-modal-title">{isEditing ? 'Editar' : 'Novo'} Empreendimento</h3>
          <button type="button" className="projects-modal-close" aria-label="Fechar" onClick={onCancel}>
            <AppIcon name="close" />
          </button>
        </div>

        <div className="projects-modal-body">
          <div className="projects-form-grid is-two">
            <label className="projects-field">
              <span>ID (Sigla)</span>
              <input
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                disabled={isEditing}
                placeholder="ID"
              />
            </label>

            <label className="projects-field">
              <span>Tipo</span>
              <select value={formData.tipo} onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}>
                <option>Linha de Transmissão</option>
                <option>Reservatório de Represa</option>
              </select>
            </label>
          </div>

          <label className="projects-field">
            <span>Nome</span>
            <input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome"
            />
          </label>

          <div className="projects-kml-box">
            <div className="projects-kml-box-copy">
              Torres georreferenciadas: <strong>{gpsCount}</strong>
            </div>
            <button type="button" className="projects-kml-btn" onClick={onImportKml}>
              <AppIcon name="upload" />
              Importar KML
            </button>
          </div>

          <label className="projects-field">
            <span>Periodicidade do relatorio</span>
            <select
              value={periodicidade}
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
          </label>

          <div className="projects-month-section">
            <div className="projects-month-head">
              <span>Meses de entrega</span>
              <small>{normalizeReportMonths(formData.mesesEntregaRelatorio).length}/{requiredMonthCount(periodicidade)}</small>
            </div>
            <div className="projects-month-grid">
              {MONTH_OPTIONS_PT.map((m) => {
                const selected = normalizeReportMonths(formData.mesesEntregaRelatorio).includes(m.value);
                return (
                  <button
                    key={m.value}
                    type="button"
                    className={`projects-month-btn ${selected ? 'is-selected' : ''}`.trim()}
                    onClick={() => toggleMonth(m.value)}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {periodicidade === 'Bienal' && (
            <label className="projects-field">
              <span>Ano base (bienal)</span>
              <input
                type="number"
                min="2000"
                value={formData.anoBaseBienal ?? ''}
                onChange={(e) => setFormData({ ...formData, anoBaseBienal: e.target.value })}
                placeholder="Ex.: 2026"
              />
            </label>
          )}

          {isLinhaTransmissao && (
            <div className="projects-form-grid is-three">
              <label className="projects-field">
                <span>kV</span>
                <select value={formData.tensao || ''} onChange={(e) => setFormData({ ...formData, tensao: e.target.value })}>
                  <option value="">Selecione a tensao (kV)</option>
                  {TRANSMISSION_VOLTAGE_OPTIONS.map((kv) => (
                    <option key={kv} value={kv}>{kv} kV</option>
                  ))}
                </select>
              </label>

              <label className="projects-field">
                <span>Extensao (km)</span>
                <input
                  type="number"
                  value={formData.extensao}
                  onChange={(e) => setFormData({ ...formData, extensao: e.target.value })}
                />
              </label>

              <label className="projects-field">
                <span>Torres (qtd)</span>
                <input
                  type="number"
                  value={formData.torres}
                  onChange={(e) => setFormData({ ...formData, torres: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>

        <div className="projects-modal-foot">
          <button type="button" className="projects-save-btn" onClick={onSave}>
            <AppIcon name="save" />
            Salvar
          </button>
          <button type="button" className="projects-cancel-btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectFormModal;
