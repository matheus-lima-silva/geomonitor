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
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-600">
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
        >
          <option value="Trimestral">Trimestral</option>
          <option value="Semestral">Semestral</option>
          <option value="Anual">Anual</option>
          <option value="Bienal">Bienal (2 anos)</option>
        </Select>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 grid gap-2">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wide text-slate-700">Meses de entrega</span>
            <small className="font-medium">{normalizeReportMonths(formData.mesesEntregaRelatorio).length}/{requiredMonthCount(periodicidade)}</small>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {MONTH_OPTIONS_PT.map((m) => {
              const selected = normalizeReportMonths(formData.mesesEntregaRelatorio).includes(m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  className={`min-h-btn-sm px-2.5 rounded-md border text-xs font-semibold transition-colors ${selected
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`.trim()}
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
            fullWidth={false}
            className="w-48"
          />
        )}

        {isLinhaTransmissao && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
      </div>
    </Modal>
  );
}

export default ProjectFormModal;
