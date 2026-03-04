import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select } from '../../../components/ui';
import {
  BRAZIL_UF_OPTIONS,
  LICENSE_SPHERE_OPTIONS,
} from '../constants/agencies';
import {
  createEmptyOperatingLicense,
  normalizeOperatingLicensePayload,
  validateOperatingLicensePayload,
} from '../models/licenseModel';
import { getAgencyOptions } from '../utils/agencyOptions';
import {
  MONTH_OPTIONS_PT,
  normalizeReportMonths,
  normalizeReportPeriodicity,
  requiredMonthCount,
} from '../../projects/utils/reportSchedule';
import { parseTowerInput } from '../../../utils/parseTowerInput';
import { deleteOperatingLicense, saveOperatingLicense } from '../../../services/licenseService';

function buildLicenseId(formData) {
  const explicit = String(formData?.id || '').trim().toUpperCase();
  if (explicit) return explicit;
  const num = String(formData?.numero || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  if (num) return `LO-${num}`;
  return `LO-${Date.now()}`;
}

function normalizeCoverageRows(rows = []) {
  return (rows || []).map((row) => {
    const parsed = parseTowerInput(String(row?.torresInput || ''));
    return {
      projetoId: String(row?.projetoId || '').trim(),
      torres: parsed.map((item) => String(item)),
      descricaoEscopo: String(row?.descricaoEscopo || '').trim(),
      torresInput: String(row?.torresInput || '').trim(),
    };
  });
}

function LicenseFormModal({
  open,
  formData,
  setFormData,
  isEditing,
  projects,
  agencyOptions,
  onSave,
  onCancel,
}) {
  if (!open) return null;

  const periodicidade = normalizeReportPeriodicity(formData.periodicidadeRelatorio);
  const required = requiredMonthCount(periodicidade);
  const selectedMonths = normalizeReportMonths(formData.mesesEntregaRelatorio);

  function toggleMonth(value) {
    const month = Number(value);
    setFormData((prev) => {
      const current = normalizeReportMonths(prev.mesesEntregaRelatorio);
      const exists = current.includes(month);
      const next = exists ? current.filter((item) => item !== month) : [...current, month];
      return { ...prev, mesesEntregaRelatorio: normalizeReportMonths(next) };
    });
  }

  const footer = (
    <>
      <Button variant="outline" size="md" onClick={onCancel}>
        <AppIcon name="close" />
        Cancelar
      </Button>
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
      title={`${isEditing ? 'Editar' : 'Nova'} Licença de Operação`}
      size="lg"
      footer={footer}
    >
      <div className="grid-form">
        <Select
          id="license-esfera"
          label="Esfera"
          value={formData.esfera}
          onChange={(e) => setFormData((prev) => ({
            ...prev,
            esfera: e.target.value,
            uf: e.target.value === 'Estadual' ? prev.uf : '',
          }))}
        >
          {LICENSE_SPHERE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>

        {formData.esfera === 'Estadual' ? (
          <Select
            id="license-uf"
            label="UF"
            value={formData.uf || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, uf: e.target.value }))}
          >
            <option value="">UF...</option>
            {BRAZIL_UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </Select>
        ) : <div />}

        <div>
          <Input
            id="license-orgao"
            label="Órgão ambiental"
            list="agency-options"
            value={formData.orgaoAmbiental || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, orgaoAmbiental: e.target.value }))}
            placeholder="Órgão ambiental"
          />
          <datalist id="agency-options">
            {agencyOptions.map((item) => <option key={item.value} value={item.value} />)}
          </datalist>
        </div>

        <Input
          id="license-id"
          label="Código interno (opcional)"
          value={formData.id || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, id: e.target.value.toUpperCase() }))}
          placeholder="Código interno"
        />
        <Input
          id="license-numero"
          label="Número da LO"
          value={formData.numero || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, numero: e.target.value }))}
          placeholder="Número da LO"
        />
        <Input
          id="license-descricao"
          label="Descrição"
          value={formData.descricao || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
          placeholder="Descrição"
        />

        <Input
          id="license-inicio"
          label="Início vigência"
          type="date"
          value={formData.inicioVigencia || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, inicioVigencia: e.target.value }))}
        />
        <Input
          id="license-fim"
          label="Fim vigência"
          type="date"
          value={formData.fimVigencia || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, fimVigencia: e.target.value }))}
        />
        <Select
          id="license-periodicidade"
          label="Periodicidade"
          value={periodicidade}
          onChange={(e) => setFormData((prev) => ({
            ...prev,
            periodicidadeRelatorio: normalizeReportPeriodicity(e.target.value),
            mesesEntregaRelatorio: [],
            anoBaseBienal: '',
          }))}
        >
          <option value="Trimestral">Trimestral</option>
          <option value="Semestral">Semestral</option>
          <option value="Anual">Anual</option>
          <option value="Bienal">Bienal (2 anos)</option>
        </Select>
      </div>

      <div className="chips">
        {MONTH_OPTIONS_PT.map((month) => {
          const selected = selectedMonths.includes(month.value);
          return (
            <button
              key={month.value}
              type="button"
              className={selected ? 'chip-active' : ''}
              onClick={() => toggleMonth(month.value)}
            >
              {month.label}
            </button>
          );
        })}
        <small>{selectedMonths.length}/{required}</small>
      </div>

      {periodicidade === 'Bienal' && (
        <Input
          id="license-ano-bienal"
          label="Ano base (bienal)"
          type="number"
          min="2000"
          value={formData.anoBaseBienal ?? ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, anoBaseBienal: e.target.value }))}
          placeholder="Ex.: 2026"
          className="mt-3"
        />
      )}

      <div className="panel nested mt-3">
        <h4>Cobertura por empreendimento/torres</h4>
        {(formData.cobertura || []).map((item, idx) => (
          <div key={`coverage-${idx}`} className="grid-form">
            <Select
              id={`coverage-project-${idx}`}
              label="Empreendimento"
              value={item.projetoId || ''}
              onChange={(e) => setFormData((prev) => ({
                ...prev,
                cobertura: prev.cobertura.map((row, rowIndex) => (rowIndex === idx ? { ...row, projetoId: e.target.value } : row)),
              }))}
            >
              <option value="">Empreendimento...</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.id} - {project.nome}</option>)}
            </Select>
            <Input
              id={`coverage-torres-${idx}`}
              label="Torres"
              placeholder="Ex.: 1-3, 8, 10"
              value={item.torresInput || ''}
              onChange={(e) => setFormData((prev) => ({
                ...prev,
                cobertura: prev.cobertura.map((row, rowIndex) => (rowIndex === idx ? { ...row, torresInput: e.target.value } : row)),
              }))}
            />
            <Input
              id={`coverage-desc-${idx}`}
              label="Descrição escopo (opcional)"
              value={item.descricaoEscopo || ''}
              onChange={(e) => setFormData((prev) => ({
                ...prev,
                cobertura: prev.cobertura.map((row, rowIndex) => (rowIndex === idx ? { ...row, descricaoEscopo: e.target.value } : row)),
              }))}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormData((prev) => ({ ...prev, cobertura: prev.cobertura.filter((_, rowIndex) => rowIndex !== idx) }))}
            >
              <AppIcon name="trash" />
              Remover escopo
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFormData((prev) => ({
            ...prev,
            cobertura: [...(prev.cobertura || []), { projetoId: '', torresInput: '', descricaoEscopo: '' }],
          }))}
        >
          <AppIcon name="plus" />
          Adicionar escopo
        </Button>
      </div>

      <div className="notice mt-3">
        <strong>Condicionante:</strong> exige acompanhamento de processos erosivos.
      </div>

      <textarea
        rows="3"
        placeholder="Observações"
        value={formData.observacoes || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
        className="mt-3"
        style={{ width: '100%' }}
      />
    </Modal>
  );
}

function LicensesView({ licenses, projects, erosions, userEmail, showToast }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(createEmptyOperatingLicense());

  const agencyOptions = useMemo(
    () => getAgencyOptions({ licenses, erosions }),
    [licenses, erosions],
  );

  const projectsById = useMemo(
    () => new Map((projects || []).map((project) => [String(project.id || '').trim(), project])),
    [projects],
  );

  async function handleSave() {
    const normalized = normalizeOperatingLicensePayload({
      ...formData,
      cobertura: normalizeCoverageRows(formData.cobertura),
    });
    const validation = validateOperatingLicensePayload(normalized, { projectsById });
    if (!validation.ok) {
      showToast?.(validation.message, 'error');
      return;
    }
    const id = buildLicenseId(normalized);
    await saveOperatingLicense(id, { ...normalized, id }, { merge: true, updatedBy: userEmail });
    setOpen(false);
    showToast?.('LO salva com sucesso.', 'success');
  }

  async function handleDelete(id) {
    if (!window.confirm(`Excluir LO ${id}?`)) return;
    await deleteOperatingLicense(id);
    showToast?.('LO excluída.', 'success');
  }

  function openNew() {
    setFormData(createEmptyOperatingLicense());
    setIsEditing(false);
    setOpen(true);
  }

  function openEdit(item) {
    setFormData({
      ...createEmptyOperatingLicense(),
      ...item,
      cobertura: (item.cobertura || []).map((row) => ({
        ...row,
        torresInput: (Array.isArray(row.torres) ? row.torres : []).join(', '),
      })),
    });
    setIsEditing(true);
    setOpen(true);
  }

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <h2>Licenças de Operação (LO)</h2>
          <p className="muted">Cadastro centralizado de LO com escopo por empreendimento e torres.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openNew}>
          <AppIcon name="plus" />
          Nova LO
        </Button>
      </div>

      <div className="project-cards">
        {(licenses || []).map((item) => (
          <article key={item.id} className="project-card">
            <header className="project-card-header">
              <div>
                <h3>{item.numero || item.id}</h3>
                <small>{item.id}</small>
              </div>
              <div className="inline-row">
                <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                  <AppIcon name="edit" />
                  Editar
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)}>
                  <AppIcon name="trash" />
                  Excluir
                </Button>
              </div>
            </header>
            <div className="muted">
              <div><strong>Esfera:</strong> {item.esfera || '-'}</div>
              {item.esfera === 'Estadual' && <div><strong>UF:</strong> {item.uf || '-'}</div>}
              <div><strong>Órgão:</strong> {item.orgaoAmbiental || '-'}</div>
              <div><strong>Vigência:</strong> {item.inicioVigencia || '-'} até {item.fimVigencia || 'indeterminada'}</div>
              <div><strong>Cobertura:</strong> {(item.cobertura || []).length} escopo(s)</div>
              <div><strong>Acompanhamento erosivo:</strong> Sim</div>
            </div>
          </article>
        ))}
        {(licenses || []).length === 0 && (
          <article className="project-card">
            <p className="muted">Nenhuma LO cadastrada.</p>
          </article>
        )}
      </div>

      <LicenseFormModal
        open={open}
        formData={formData}
        setFormData={setFormData}
        isEditing={isEditing}
        projects={projects}
        agencyOptions={agencyOptions}
        onSave={handleSave}
        onCancel={() => setOpen(false)}
      />
    </section>
  );
}

export default LicensesView;
