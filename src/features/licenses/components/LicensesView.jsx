import { useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, ConfirmDeleteModal, EmptyState, Input, ListItemSkeleton, Modal, RangeSlider, SearchableSelect, Select } from '../../../components/ui';
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
import { getProjectTowerList, getNumericTowerRange, hasNumericRange, towersInRange } from '../../../utils/getProjectTowerList';

function buildLicenseId(formData) {
  const explicit = String(formData?.id || '').trim().toUpperCase();
  if (explicit) return explicit;
  const num = String(formData?.numero || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-');
  if (num) return `LO-${num}`;
  return `LO-${Date.now()}`;
}

function normalizeCoverageRows(rows = [], projectsById = null) {
  return (rows || []).map((row) => {
    const parsed = parseTowerInput(String(row?.torresInput || ''));
    let torres = parsed.map((item) => String(item));

    const projetoId = String(row?.projetoId || '').trim();
    if (projetoId && projectsById?.has(projetoId) && torres.length > 0) {
      const project = projectsById.get(projetoId);
      const allTowers = getProjectTowerList(project);
      if (allTowers.length > 0) {
        // Use the range from parsed input to select all real project towers
        // in that range (including alphanumeric ones like "163A").
        const nums = torres.map(Number).filter(Number.isFinite);
        if (nums.length > 0) {
          const lo = Math.min(...nums);
          const hi = Math.max(...nums);
          torres = towersInRange(allTowers, lo, hi);
        } else {
          // Non-numeric input — keep only towers that exist in the project
          const validSet = new Set(allTowers);
          torres = torres.filter((t) => validSet.has(t));
        }
      }
    }

    return {
      projetoId,
      torres,
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <div className="flex flex-wrap gap-2 mt-3 items-center">
        {MONTH_OPTIONS_PT.map((month) => {
          const selected = selectedMonths.includes(month.value);
          return (
            <button
              key={month.value}
              type="button"
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${selected ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300 hover:border-brand-400 hover:text-brand-600'}`}
              onClick={() => toggleMonth(month.value)}
            >
              {month.label}
            </button>
          );
        })}
        <span className="text-xs text-slate-500 font-medium ml-1">{selectedMonths.length}/{required}</span>
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

      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-sm font-bold text-slate-800 m-0 mb-3">Cobertura por empreendimento/torres</h4>
        {(formData.cobertura || []).map((item, idx) => {
          const selectedProject = item.projetoId ? projects.find((p) => p.id === item.projetoId) : null;
          const towerList = selectedProject ? getProjectTowerList(selectedProject) : [];
          const canSlide = hasNumericRange(towerList);
          const towerRange = canSlide ? getNumericTowerRange(towerList) : { min: 0, max: 0 };
          const showSlider = canSlide && towerRange.max > 0;

          const currentParsed = parseTowerInput(String(item.torresInput || ''));
          const parsedNums = currentParsed.map(Number).filter(Number.isFinite);
          const rawMin = parsedNums.length > 0 ? Math.min(...parsedNums) : towerRange.min;
          const rawMax = parsedNums.length > 0 ? Math.max(...parsedNums) : towerRange.max;
          const currentMin = showSlider ? Math.max(towerRange.min, Math.min(rawMin, towerRange.max)) : rawMin;
          const currentMax = showSlider ? Math.min(towerRange.max, Math.max(rawMax, towerRange.min)) : rawMax;
          const towersSelected = showSlider ? towersInRange(towerList, currentMin, currentMax) : currentParsed;
          const selectedCount = towersSelected.length;

          return (
            <div key={`coverage-${idx}`} className="flex flex-col gap-3 mb-4 pb-4 border-b border-slate-200 last:border-b-0 last:pb-0 last:mb-0">
              <SearchableSelect
                id={`coverage-project-${idx}`}
                label="Empreendimento"
                placeholder="Buscar empreendimento..."
                value={item.projetoId || ''}
                options={projects.map((project) => ({
                  value: project.id,
                  label: `${project.id} - ${project.nome}`,
                }))}
                onChange={(nextProjectId) => {
                  const nextProject = projects.find((p) => p.id === nextProjectId);
                  const nextTowers = nextProject ? getProjectTowerList(nextProject) : [];
                  const nextCanSlide = hasNumericRange(nextTowers);
                  const nextRange = nextCanSlide ? getNumericTowerRange(nextTowers) : { min: 0, max: 0 };
                  const autoInput = nextCanSlide && nextRange.max > 0
                    ? `${nextRange.min}-${nextRange.max}`
                    : nextTowers.join(', ');
                  setFormData((prev) => ({
                    ...prev,
                    cobertura: prev.cobertura.map((row, rowIndex) => (
                      rowIndex === idx ? { ...row, projetoId: nextProjectId, torresInput: autoInput } : row
                    )),
                  }));
                }}
              />

              {showSlider ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-2xs font-bold uppercase tracking-wide text-slate-500">De</label>
                      <input
                        type="number"
                        min={towerRange.min}
                        max={currentMax}
                        value={currentMin}
                        onChange={(e) => {
                          const v = Math.max(towerRange.min, Math.min(Number(e.target.value) || towerRange.min, currentMax));
                          setFormData((prev) => ({
                            ...prev,
                            cobertura: prev.cobertura.map((row, rowIndex) => (
                              rowIndex === idx ? { ...row, torresInput: v === currentMax ? String(v) : `${v}-${currentMax}` } : row
                            )),
                          }));
                        }}
                        className="w-16 border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-800 text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>

                    <div className="flex-1">
                      <RangeSlider
                        min={towerRange.min}
                        max={towerRange.max}
                        value={[currentMin, currentMax]}
                        onChange={([lo, hi]) => {
                          setFormData((prev) => ({
                            ...prev,
                            cobertura: prev.cobertura.map((row, rowIndex) => (
                              rowIndex === idx ? { ...row, torresInput: lo === hi ? String(lo) : `${lo}-${hi}` } : row
                            )),
                          }));
                        }}
                        formatLabel={(n) => `T${n}`}
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-2xs font-bold uppercase tracking-wide text-slate-500">Ate</label>
                      <input
                        type="number"
                        min={currentMin}
                        max={towerRange.max}
                        value={currentMax}
                        onChange={(e) => {
                          const v = Math.min(towerRange.max, Math.max(Number(e.target.value) || towerRange.max, currentMin));
                          setFormData((prev) => ({
                            ...prev,
                            cobertura: prev.cobertura.map((row, rowIndex) => (
                              rowIndex === idx ? { ...row, torresInput: currentMin === v ? String(v) : `${currentMin}-${v}` } : row
                            )),
                          }));
                        }}
                        className="w-16 border border-slate-300 rounded-md px-2 py-1 text-sm text-slate-800 text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData((prev) => ({
                          ...prev,
                          cobertura: prev.cobertura.map((row, rowIndex) => (
                            rowIndex === idx ? { ...row, torresInput: `${towerRange.min}-${towerRange.max}` } : row
                          )),
                        }))}
                      >
                        <AppIcon name="check" />
                        Todas
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData((prev) => ({
                          ...prev,
                          cobertura: prev.cobertura.map((row, rowIndex) => (
                            rowIndex === idx ? { ...row, torresInput: '' } : row
                          )),
                        }))}
                      >
                        <AppIcon name="close" />
                        Limpar
                      </Button>
                    </div>
                    <span className="text-xs text-slate-500 font-medium tabular-nums">
                      {selectedCount} de {towerList.length} torres
                    </span>
                  </div>
                </div>
              ) : item.projetoId ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        id={`coverage-torres-${idx}`}
                        label="Torres"
                        placeholder={towerList.length > 0 ? `Ex.: ${towerList.slice(0, 3).join(', ')}...` : 'Ex.: 1-3, 8, 10'}
                        value={item.torresInput || ''}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          cobertura: prev.cobertura.map((row, rowIndex) => (rowIndex === idx ? { ...row, torresInput: e.target.value } : row)),
                        }))}
                      />
                    </div>
                    {towerList.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setFormData((prev) => ({
                          ...prev,
                          cobertura: prev.cobertura.map((row, rowIndex) => (
                            rowIndex === idx ? { ...row, torresInput: towerList.join(', ') } : row
                          )),
                        }))}
                      >
                        <AppIcon name="check" />
                        Todas
                      </Button>
                    )}
                  </div>
                  {towerList.length === 0 && (
                    <p className="text-xs text-amber-600 m-0">Este empreendimento nao possui torres cadastradas.</p>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  id={`coverage-desc-${idx}`}
                  label="Descricao escopo (opcional)"
                  value={item.descricaoEscopo || ''}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    cobertura: prev.cobertura.map((row, rowIndex) => (rowIndex === idx ? { ...row, descricaoEscopo: e.target.value } : row)),
                  }))}
                />
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData((prev) => ({ ...prev, cobertura: prev.cobertura.filter((_, rowIndex) => rowIndex !== idx) }))}
                  >
                    <AppIcon name="trash" />
                    Remover escopo
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
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

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Condicionante:</strong> exige acompanhamento de processos erosivos.
      </div>

      <textarea
        rows="3"
        placeholder="Observações"
        value={formData.observacoes || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
        className="mt-4 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      />
    </Modal>
  );
}

function LicensesView({ licenses, projects, erosions, userEmail, showToast, searchTerm, loading = false }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(createEmptyOperatingLicense());
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const agencyOptions = useMemo(
    () => getAgencyOptions({ licenses, erosions }),
    [licenses, erosions],
  );

  const projectsById = useMemo(
    () => new Map((projects || []).map((project) => [String(project.id || '').trim(), project])),
    [projects],
  );

  const filteredLicenses = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    if (!t) return licenses || [];
    return (licenses || []).filter(
      (lo) =>
        String(lo.numero || '').toLowerCase().includes(t) ||
        String(lo.id || '').toLowerCase().includes(t) ||
        String(lo.orgaoAmbiental || '').toLowerCase().includes(t) ||
        (lo.cobertura || []).some((c) => {
          if (String(c.projetoId || '').toLowerCase().includes(t)) return true;
          const proj = projectsById.get(c.projetoId);
          return proj && String(proj.nome || '').toLowerCase().includes(t);
        }),
    );
  }, [licenses, searchTerm, projectsById]);

  async function handleSave() {
    const normalized = normalizeOperatingLicensePayload({
      ...formData,
      cobertura: normalizeCoverageRows(formData.cobertura, projectsById),
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

  function handleDelete(id) {
    setDeleteConfirm(id);
  }

  async function handleConfirmDelete() {
    await deleteOperatingLicense(deleteConfirm);
    setDeleteConfirm(null);
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
    <section className="flex flex-col gap-6 p-4 md:p-8 max-w-screen-2xl w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 m-0">Licenças de Operação (LO)</h2>
          <p className="text-sm text-slate-500 mt-1">Cadastro centralizado de LO com escopo por empreendimento e torres.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openNew}>
          <AppIcon name="plus" />
          Nova LO
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <ListItemSkeleton key={i} />)
        ) : filteredLicenses.map((item) => (
          <article key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="flex items-start justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-800 m-0">{item.numero || item.id}</h3>
                <span className="text-xs text-slate-500">{item.id}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
            <div className="px-4 py-3 text-sm text-slate-600 flex flex-col gap-1">
              <div><strong className="text-slate-700">Esfera:</strong> {item.esfera || '-'}</div>
              {item.esfera === 'Estadual' && <div><strong className="text-slate-700">UF:</strong> {item.uf || '-'}</div>}
              <div><strong className="text-slate-700">Órgão:</strong> {item.orgaoAmbiental || '-'}</div>
              <div><strong className="text-slate-700">Vigência:</strong> {item.inicioVigencia || '-'} até {item.fimVigencia || 'indeterminada'}</div>
              <div>
                <strong className="text-slate-700">Cobertura:</strong> {(item.cobertura || []).length} escopo(s)
                {(item.cobertura || []).length > 0 && (
                  <ul className="mt-1 ml-4 list-disc text-xs text-slate-500">
                    {(item.cobertura || []).map((cob, ci) => {
                      const proj = projectsById.get(cob.projetoId);
                      const nome = proj ? `${proj.id} - ${proj.nome}` : cob.projetoId;
                      const torreCount = (cob.torres || []).length;
                      return <li key={ci}>{nome} ({torreCount} torres)</li>;
                    })}
                  </ul>
                )}
              </div>
              <div><strong className="text-slate-700">Acompanhamento erosivo:</strong> Sim</div>
            </div>
          </article>
        ))}
        {!loading && filteredLicenses.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon="file-text"
              title={(licenses || []).length === 0 ? 'Nenhuma LO cadastrada.' : 'Nenhuma LO encontrada para a busca.'}
            />
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteConfirm)}
        itemName="a LO"
        itemId={deleteConfirm}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

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
