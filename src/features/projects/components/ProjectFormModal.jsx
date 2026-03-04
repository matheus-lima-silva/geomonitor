import { MONTH_OPTIONS_PT, normalizeReportMonths, normalizeReportPeriodicity, requiredMonthCount } from '../utils/reportSchedule';
import { TRANSMISSION_VOLTAGE_OPTIONS } from '../models/projectModel';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select } from '../../../components/ui';

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

  const footer = (
    <>
      <Button variant="outline" size="md" onClick={onCancel}>Cancelar</Button>
      <Button variant="primary" size="md" onClick={onSave}>
        <AppIcon name="save" />
        Salvar
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`${isEditing ? 'Editar' : 'Novo'} Empreendimento`}
      size="md"
      footer={footer}
    >
      <div className="projects-form-grid is-two">
        <Input
          id="project-id"
          label="ID (Sigla)"
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
          disabled={isEditing}
          placeholder="ID"
        />

        <Select
          id="project-tipo"
          label="Tipo"
          value={formData.tipo}
          onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
        >
          <option>Linha de Transmissão</option>
          <option>Reservatório de Represa</option>
        </Select>
      </div>

      <Input
        id="project-nome"
        label="Nome"
        value={formData.nome}
        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
        placeholder="Nome"
        className="mt-3"
      />

      <div className="projects-kml-box mt-3">
        <div className="projects-kml-box-copy">
          Torres georreferenciadas: <strong>{gpsCount}</strong>
        </div>
        <Button variant="outline" size="sm" onClick={onImportKml}>
          <AppIcon name="upload" />
          Importar KML
        </Button>
      </div>

      <Select
        id="project-periodicidade"
        label="Periodicidade do relatório"
        value={periodicidade}
        onChange={(e) => setFormData({
          ...formData,
          periodicidadeRelatorio: normalizeReportPeriodicity(e.target.value),
          mesesEntregaRelatorio: [],
          anoBaseBienal: '',
        })}
        className="mt-3"
      >
        <option value="Trimestral">Trimestral</option>
        <option value="Semestral">Semestral</option>
        <option value="Anual">Anual</option>
        <option value="Bienal">Bienal (2 anos)</option>
      </Select>

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
        <Input
          id="project-ano-bienal"
          label="Ano base (bienal)"
          type="number"
          min="2000"
          value={formData.anoBaseBienal ?? ''}
          onChange={(e) => setFormData({ ...formData, anoBaseBienal: e.target.value })}
          placeholder="Ex.: 2026"
          className="mt-3"
        />
      )}

      {isLinhaTransmissao && (
        <div className="projects-form-grid is-three mt-3">
          <Select
            id="project-tensao"
            label="kV"
            value={formData.tensao || ''}
            onChange={(e) => setFormData({ ...formData, tensao: e.target.value })}
          >
            <option value="">Selecione a tensão (kV)</option>
            {TRANSMISSION_VOLTAGE_OPTIONS.map((kv) => (
              <option key={kv} value={kv}>{kv} kV</option>
            ))}
          </Select>

          <Input
            id="project-extensao"
            label="Extensão (km)"
            type="number"
            value={formData.extensao}
            onChange={(e) => setFormData({ ...formData, extensao: e.target.value })}
          />

          <Input
            id="project-torres"
            label="Torres (qtd)"
            type="number"
            value={formData.torres}
            onChange={(e) => setFormData({ ...formData, torres: e.target.value })}
          />
        </div>
      )}
    </Modal>
  );
}

export default ProjectFormModal;
