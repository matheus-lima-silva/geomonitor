import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import {
  Button,
  ConfirmDeleteModal,
  EmptyState,
  Input,
  ListItemSkeleton,
  Modal,
  RangeSlider,
  SearchableSelect,
  Select,
  Tabs,
  Textarea,
} from '../../../components/ui';
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
import LicenseConditionsSection, { persistConditions } from './LicenseConditionsSection';
import LicenseFilesSection from './LicenseFilesSection';
import LicenseCard from './LicenseCard';
import LicenseDetailView from './LicenseDetailView';
import LicenseFiltersBar from './LicenseFiltersBar';
import useLicensesFilters from '../hooks/useLicensesFilters';

// =========================================================================
// Helpers de id + coverage (preservados do arquivo antigo)
// =========================================================================

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
        const nums = torres.map(Number).filter(Number.isFinite);
        if (nums.length > 0) {
          const lo = Math.min(...nums);
          const hi = Math.max(...nums);
          torres = towersInRange(allTowers, lo, hi);
        } else {
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

// =========================================================================
// Tab panels do modal (Identificação, Vigência, Cronograma, Cobertura,
// Condicionantes, Documentos, Observações)
// =========================================================================

function IdentificacaoTab({ formData, setFormData, agencyOptions }) {
  return (
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
        id="license-apelido"
        label="Apelido (opcional)"
        value={formData.apelido || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, apelido: e.target.value }))}
        placeholder="Ex.: Lote 1 Furnas"
        hint="Usado no título do card em vez da primeira cobertura."
      />
      <Input
        id="license-descricao"
        label="Descrição"
        value={formData.descricao || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
        placeholder="Descrição"
      />
    </div>
  );
}

function VigenciaTab({ formData, setFormData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        id="license-status"
        label="Status"
        value={formData.status || 'ativa'}
        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
      >
        <option value="ativa">Ativa</option>
        <option value="suspensa">Suspensa</option>
        <option value="vencida">Vencida</option>
        <option value="inativa">Inativa</option>
      </Select>
    </div>
  );
}

function CronogramaTab({ formData, setFormData }) {
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
    <div className="flex flex-col gap-4">
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

      <div>
        <label className="text-2xs font-bold uppercase tracking-wide text-slate-500 mb-1 block">
          Meses de entrega
        </label>
        <div className="flex flex-wrap gap-2 items-center">
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
        />
      )}
    </div>
  );
}

function CoberturaTab({ formData, setFormData, projects }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
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
                  <p className="text-xs text-warning-border m-0">Este empreendimento nao possui torres cadastradas.</p>
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
  );
}

// =========================================================================
// Modal com abas
// =========================================================================

function LicenseFormModal({
  open,
  formData,
  setFormData,
  isEditing,
  projects,
  agencyOptions,
  onSave,
  onCancel,
  onConditionsChange,
  showToast,
}) {
  const [tab, setTab] = useState('identificacao');

  useEffect(() => {
    if (open) setTab('identificacao');
  }, [open]);

  if (!open) return null;

  const cobertura = Array.isArray(formData.cobertura) ? formData.cobertura : [];

  const tabs = [
    { key: 'identificacao', label: 'Identificação' },
    { key: 'vigencia', label: 'Vigência' },
    { key: 'cronograma', label: 'Cronograma' },
    { key: 'cobertura', label: 'Cobertura', badge: cobertura.length || undefined },
    { key: 'condicionantes', label: 'Condicionantes' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'observacoes', label: 'Observações' },
  ];

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
      <Tabs items={tabs} activeKey={tab} onChange={setTab} ariaLabel="Seções do formulário de LO" className="mb-4" />

      {tab === 'identificacao' && <IdentificacaoTab formData={formData} setFormData={setFormData} agencyOptions={agencyOptions} />}
      {tab === 'vigencia' && <VigenciaTab formData={formData} setFormData={setFormData} />}
      {tab === 'cronograma' && <CronogramaTab formData={formData} setFormData={setFormData} />}
      {tab === 'cobertura' && <CoberturaTab formData={formData} setFormData={setFormData} projects={projects} />}
      {tab === 'condicionantes' && (
        <LicenseConditionsSection
          licenseId={isEditing ? formData.id : ''}
          onChange={onConditionsChange}
          showToast={showToast}
        />
      )}
      {tab === 'documentos' && (
        <LicenseFilesSection
          licenseId={isEditing ? formData.id : ''}
          showToast={showToast}
        />
      )}
      {tab === 'observacoes' && (
        <div className="flex flex-col gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <strong>Lembrete:</strong> exige acompanhamento de processos erosivos.
          </div>
          <Textarea
            id="license-observacoes"
            label="Observações"
            rows={5}
            value={formData.observacoes || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
            placeholder="Texto livre sobre a LO, histórico de retificações, etc."
          />
        </div>
      )}
    </Modal>
  );
}

// =========================================================================
// Página principal
// =========================================================================

const LICENSE_URL_PARAM = 'license';

function readLicenseParam() {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get(LICENSE_URL_PARAM) || '';
  } catch {
    return '';
  }
}

function setLicenseParam(id) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(LICENSE_URL_PARAM, id);
  else url.searchParams.delete(LICENSE_URL_PARAM);
  window.history.replaceState({}, '', url);
}

function LicensesView({ licenses, projects, erosions, userEmail, showToast, searchTerm = '', loading = false }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(createEmptyOperatingLicense());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [conditionsDraft, setConditionsDraft] = useState([]);
  const [detailId, setDetailId] = useState(() => readLicenseParam());

  useEffect(() => {
    function onPop() {
      setDetailId(readLicenseParam());
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const agencyOptions = useMemo(
    () => getAgencyOptions({ licenses, erosions }),
    [licenses, erosions],
  );

  const projectsById = useMemo(
    () => new Map((projects || []).map((project) => [String(project.id || '').trim(), project])),
    [projects],
  );

  const filterBag = useLicensesFilters();

  // Sincroniza a busca global do DashboardView (prop) com o filtro local
  // de busca textual, sem descartar o que o usuario digita localmente:
  // o prop tem precedencia apenas na primeira vez em que muda.
  useEffect(() => {
    if (searchTerm && searchTerm !== filterBag.filters.searchTerm) {
      filterBag.setFilter('searchTerm', searchTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const filteredLicenses = useMemo(
    () => filterBag.apply(licenses, projectsById),
    [filterBag, licenses, projectsById],
  );

  const detailLicense = useMemo(() => {
    if (!detailId) return null;
    return (licenses || []).find((l) => l.id === detailId) || null;
  }, [licenses, detailId]);

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
    // Draft de condicionantes so existe quando a LO foi criada agora (!isEditing).
    // Em edicao o componente e autonomo e ja persistiu cada mudanca.
    if (!isEditing && Array.isArray(conditionsDraft) && conditionsDraft.length > 0) {
      try {
        await persistConditions(id, conditionsDraft);
      } catch (err) {
        showToast?.(err?.message || 'Falha ao salvar condicionantes.', 'error');
      }
    }
    setOpen(false);
    showToast?.('LO salva com sucesso.', 'success');
  }

  function handleDelete(licenseOrId) {
    setDeleteConfirm(typeof licenseOrId === 'string' ? licenseOrId : licenseOrId?.id || null);
  }

  async function handleConfirmDelete() {
    await deleteOperatingLicense(deleteConfirm);
    setDeleteConfirm(null);
    if (detailId === deleteConfirm) openDetail('');
    showToast?.('LO excluída.', 'success');
  }

  function openNew() {
    setFormData(createEmptyOperatingLicense());
    setConditionsDraft([]);
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
    setConditionsDraft([]);
    setIsEditing(true);
    setOpen(true);
  }

  function openDetail(id) {
    setDetailId(id);
    setLicenseParam(id);
  }

  if (detailLicense) {
    return (
      <LicenseDetailView
        license={detailLicense}
        projectsById={projectsById}
        onBack={() => openDetail('')}
        onEdit={(l) => { openDetail(''); openEdit(l); }}
        onDelete={(l) => handleDelete(l)}
        showToast={showToast}
      />
    );
  }

  const noLicenses = (licenses || []).length === 0;
  const noResults = filteredLicenses.length === 0 && !loading;

  return (
    <section className="flex flex-col gap-6 p-4 md:p-8 max-w-screen-2xl w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 m-0">Licenças de Operação (LO)</h2>
          <p className="text-sm text-slate-500 mt-1">
            {licenses?.length || 0} licença(s) — cadastro centralizado com cronograma, condicionantes e documentos.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openNew}>
          <AppIcon name="plus" />
          Nova LO
        </Button>
      </div>

      <LicenseFiltersBar
        licenses={licenses}
        filters={filterBag.filters}
        setFilter={filterBag.setFilter}
        reset={filterBag.reset}
        isEmpty={filterBag.isEmpty}
      />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <ListItemSkeleton key={i} />)
        ) : filteredLicenses.map((item) => (
          <LicenseCard
            key={item.id}
            license={item}
            projectsById={projectsById}
            onOpen={(l) => openDetail(l.id)}
            onEdit={openEdit}
            onDelete={(l) => handleDelete(l.id)}
          />
        ))}
        {noResults && (
          <div className="col-span-full">
            <EmptyState
              icon="file-text"
              title={noLicenses ? 'Nenhuma LO cadastrada.' : 'Nenhuma LO encontrada para os filtros.'}
              description={noLicenses ? 'Clique em "Nova LO" para começar.' : 'Tente limpar os filtros ou ajustar a busca.'}
              action={!filterBag.isEmpty ? (
                <Button variant="outline" size="sm" onClick={filterBag.reset}>
                  <AppIcon name="reset" />
                  Limpar filtros
                </Button>
              ) : null}
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
        onConditionsChange={setConditionsDraft}
        showToast={showToast}
      />
    </section>
  );
}

export default LicensesView;
