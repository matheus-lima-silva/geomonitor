import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
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

  return (
    <div className="modal-backdrop">
      <div className="modal xwide">
        <h3>{isEditing ? 'Editar' : 'Nova'} LicenÃ§a de OperaÃ§Ã£o</h3>
        <div className="grid-form">
          <select
            value={formData.esfera}
            onChange={(e) => setFormData((prev) => ({
              ...prev,
              esfera: e.target.value,
              uf: e.target.value === 'Estadual' ? prev.uf : '',
            }))}
          >
            {LICENSE_SPHERE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {formData.esfera === 'Estadual' ? (
            <select value={formData.uf || ''} onChange={(e) => setFormData((prev) => ({ ...prev, uf: e.target.value }))}>
              <option value="">UF...</option>
              {BRAZIL_UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          ) : <div />}
          <div>
            <input
              list="agency-options"
              value={formData.orgaoAmbiental || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, orgaoAmbiental: e.target.value }))}
              placeholder="Ã“rgÃ£o ambiental"
            />
            <datalist id="agency-options">
              {agencyOptions.map((item) => <option key={item.value} value={item.value} />)}
            </datalist>
          </div>

          <input
            placeholder="CÃ³digo interno (opcional)"
            value={formData.id || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, id: e.target.value.toUpperCase() }))}
          />
          <input
            placeholder="NÃºmero da LO"
            value={formData.numero || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, numero: e.target.value }))}
          />
          <input
            placeholder="DescriÃ§Ã£o"
            value={formData.descricao || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
          />

          <input
            type="date"
            value={formData.inicioVigencia || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, inicioVigencia: e.target.value }))}
          />
          <input
            type="date"
            value={formData.fimVigencia || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, fimVigencia: e.target.value }))}
          />
          <select
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
          </select>
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
          <div className="grid-form">
            <input
              type="number"
              min="2000"
              placeholder="Ano base (bienal)"
              value={formData.anoBaseBienal ?? ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, anoBaseBienal: e.target.value }))}
            />
          </div>
        )}

        <div className="panel nested">
          <h4>Cobertura por empreendimento/torres</h4>
          {(formData.cobertura || []).map((item, idx) => (
            <div key={`coverage-${idx}`} className="grid-form">
              <select
                value={item.projetoId || ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  cobertura: prev.cobertura.map((row, rowIndex) => (rowIndex === idx ? { ...row, projetoId: e.target.value } : row)),
                }))}
              >
                <option value="">Empreendimento...</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.id} - {project.nome}</option>)}
              </select>
              <input
                placeholder="Torres (ex.: 1-3, 8, 10)"
                value={item.torresInput || ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  cobertura: prev.cobertura.map((row, rowIndex) => (rowIndex === idx ? { ...row, torresInput: e.target.value } : row)),
                }))}
              />
              <input
                placeholder="DescriÃ§Ã£o escopo (opcional)"
                value={item.descricaoEscopo || ''}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  cobertura: prev.cobertura.map((row, rowIndex) => (rowIndex === idx ? { ...row, descricaoEscopo: e.target.value } : row)),
                }))}
              />
              <button
                type="button"
                className="secondary"
                onClick={() => setFormData((prev) => ({ ...prev, cobertura: prev.cobertura.filter((_, rowIndex) => rowIndex !== idx) }))}
              >
                <AppIcon name="trash" />
                Remover escopo
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => setFormData((prev) => ({
              ...prev,
              cobertura: [...(prev.cobertura || []), { projetoId: '', torresInput: '', descricaoEscopo: '' }],
            }))}
          >
            <AppIcon name="plus" />
            Adicionar escopo
          </button>
        </div>

        <div className="notice">
          <strong>Condicionante:</strong> exige acompanhamento de processos erosivos.
        </div>

        <textarea
          rows="3"
          placeholder="ObservaÃ§Ãµes"
          value={formData.observacoes || ''}
          onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
        />

        <div className="row-actions">
          <button type="button" onClick={onSave}>
            <AppIcon name="save" />
            Salvar
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            <AppIcon name="close" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
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
    showToast?.('LO excluÃ­da.', 'success');
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
          <h2>LicenÃ§as de OperaÃ§Ã£o (LO)</h2>
          <p className="muted">Cadastro centralizado de LO com escopo por empreendimento e torres.</p>
        </div>
        <button type="button" onClick={openNew}>
          <AppIcon name="plus" />
          Nova LO
        </button>
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
                <button type="button" className="secondary" onClick={() => openEdit(item)}>
                  <AppIcon name="edit" />
                  Editar
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(item.id)}>
                  <AppIcon name="trash" />
                  Excluir
                </button>
              </div>
            </header>
            <div className="muted">
              <div><strong>Esfera:</strong> {item.esfera || '-'}</div>
              {item.esfera === 'Estadual' && <div><strong>UF:</strong> {item.uf || '-'}</div>}
              <div><strong>Ã“rgÃ£o:</strong> {item.orgaoAmbiental || '-'}</div>
              <div><strong>VigÃªncia:</strong> {item.inicioVigencia || '-'} atÃ© {item.fimVigencia || 'indeterminada'}</div>
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
