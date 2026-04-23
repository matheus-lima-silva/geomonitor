import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Badge, Button, Card, Modal, Select } from '../../../components/ui';
import { buildFeriadosIndex, getFeriadoForDate } from '../../shared/rulesConfig';
import { buildPlanningGuideRows, exportPlanningGuideCsv } from '../utils/planningGuideExport';
import {
  computeVisitPlanning,
  enrichPlanningItemsWithHotelRecommendation,
  getTargetTowerFromSelection,
  pickPriorityHotelFromItems,
  serializeTowersForInput,
} from '../utils/visitPlanning';

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatHotelNote(value) {
  if (value === '' || value === null || value === undefined) return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return String(num);
}

function formatHotelDistance(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `${num}`;
}

function VisitPlanningView({ projects, inspections, erosions, feriados = [], onApplySelection }) {
  const [projectId, setProjectId] = useState('');
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [showGuidePreview, setShowGuidePreview] = useState(false);
  const [feriadosAlertDismissed, setFeriadosAlertDismissed] = useState(false);

  const selectedProject = projects.find((item) => item.id === projectId) || null;
  const year = new Date().getFullYear();

  const feriadosIndex = useMemo(() => buildFeriadosIndex(feriados), [feriados]);

  const feriadosDoAno = useMemo(() => {
    const prefix = `${year}-`;
    return (Array.isArray(feriados) ? feriados : [])
      .filter((item) => typeof item?.data === 'string' && item.data.startsWith(prefix))
      .slice()
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [feriados, year]);

  useEffect(() => {
    setFeriadosAlertDismissed(false);
  }, [projectId, year]);

  const planning = useMemo(() => {
    if (!selectedProject) {
      return {
        obrigatorias: [],
        amostragemSelecionada: [],
        naoPriorizar: [],
        metaAmostragem: 0,
        totalTorres: 0,
        seed: '',
      };
    }
    return computeVisitPlanning({
      project: selectedProject,
      inspections,
      erosions,
      year,
    });
  }, [selectedProject, inspections, erosions, year]);

  useEffect(() => {
    setSelectedTowers([
      ...planning.obrigatorias.map((item) => item.torre),
      ...planning.amostragemSelecionada.map((item) => item.torre),
    ]);
  }, [projectId, planning.obrigatorias, planning.amostragemSelecionada]);

  const allSelectableBase = useMemo(
    () => [...planning.obrigatorias, ...planning.amostragemSelecionada, ...planning.naoPriorizar],
    [planning.obrigatorias, planning.amostragemSelecionada, planning.naoPriorizar],
  );

  const targetTower = useMemo(() => getTargetTowerFromSelection(selectedTowers), [selectedTowers]);

  const allSelectable = useMemo(
    () => enrichPlanningItemsWithHotelRecommendation(
      allSelectableBase,
      {
        inspections,
        projectId: selectedProject?.id || '',
        targetTower,
      },
    ),
    [allSelectableBase, inspections, selectedProject?.id, targetTower],
  );

  const obrigatoriasItems = useMemo(
    () => allSelectable.filter((item) => item.categoria === 'obrigatoria'),
    [allSelectable],
  );
  const amostragemItems = useMemo(
    () => allSelectable.filter((item) => item.categoria === 'amostragem'),
    [allSelectable],
  );
  const naoPriorizarItems = useMemo(
    () => allSelectable.filter((item) => item.categoria === 'nao_priorizar'),
    [allSelectable],
  );

  const selectedItems = useMemo(
    () => allSelectable.filter((item) => selectedTowers.includes(item.torre)),
    [allSelectable, selectedTowers],
  );

  const priorityHotel = useMemo(
    () => pickPriorityHotelFromItems(selectedItems, targetTower),
    [selectedItems, targetTower],
  );

  const serialized = useMemo(() => serializeTowersForInput(selectedItems), [selectedItems]);
  const guideRows = useMemo(
    () => buildPlanningGuideRows(
      {
        obrigatorias: selectedItems.filter((item) => item.categoria === 'obrigatoria'),
        amostragemSelecionada: selectedItems.filter((item) => item.categoria !== 'obrigatoria'),
        naoPriorizar: [],
      },
      selectedProject,
      year,
    ),
    [selectedItems, selectedProject, year],
  );

  function toggleTower(tower) {
    setSelectedTowers((prev) => (prev.includes(tower) ? prev.filter((item) => item !== tower) : [...prev, tower]));
  }

  function exportGuideCsv() {
    if (!selectedProject || guideRows.length === 0) return;
    const csv = exportPlanningGuideCsv(guideRows);
    downloadTextFile(`guia-campo-${selectedProject.id}-${year}.csv`, csv, 'text/csv;charset=utf-8');
  }

  function renderTowerItem(item, selectable = true) {
    return (
      <div key={`${item.categoria}-${item.torre}`} className="flex flex-col gap-1 py-2.5 px-3 border-b border-slate-100 last:border-b-0">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedTowers.includes(item.torre)}
            disabled={!selectable}
            onChange={() => toggleTower(item.torre)}
            className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700">
            <strong className="text-slate-800">Torre {item.torre}:</strong> {item.motivo}
          </span>
        </label>
        {item.mapsLink && (
          <div className="pl-6">
            <a href={item.mapsLink} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:text-brand-800 hover:underline">
              Abrir no Maps
            </a>
          </div>
        )}
        {item.comentariosAnteriores?.length > 0 && (
          <div className="pl-6 flex flex-col gap-0.5">
            {item.comentariosAnteriores.map((comment, idx) => {
              const feriado = getFeriadoForDate(comment?.data, feriadosIndex);
              return (
                <div key={`${item.torre}-${idx}`} className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <span>{comment.data || '-'} {comment.inspectionId ? `(${comment.inspectionId})` : ''}: {comment.obs}</span>
                  {feriado ? <Badge tone="warning" size="sm">Feriado - {feriado.nome}</Badge> : null}
                </div>
              );
            })}
          </div>
        )}
        {item.hotelSugeridoNome ? (
          <div className="pl-6 text-xs text-slate-600 bg-slate-50 rounded px-2 py-1.5 mt-1">
            <div>
              Hotel sugerido: <strong>{item.hotelSugeridoNome}</strong>
              {item.hotelSugeridoMunicipio ? ` (${item.hotelSugeridoMunicipio})` : ''}
              {item.hotelSugeridoTorreBase ? ` | Torre base: ${item.hotelSugeridoTorreBase}` : ''}
              {item.hotelSugeridoDistanciaTorreAlvo !== '' ? ` | Distância da torre-alvo: ${formatHotelDistance(item.hotelSugeridoDistanciaTorreAlvo)}` : ''}
            </div>
            <div className="text-slate-500 mt-0.5">
              Notas - Logística: {formatHotelNote(item.hotelSugeridoLogisticaNota)}
              {' | '}
              Reserva: {formatHotelNote(item.hotelSugeridoReservaNota)}
              {' | '}
              Estadia: {formatHotelNote(item.hotelSugeridoEstadiaNota)}
            </div>
          </div>
        ) : (
          <div className="pl-6 text-xs text-slate-400 italic">Sem histórico de hospedagem para esta torre.</div>
        )}
      </div>
    );
  }

  return (
    <section className="p-4 md:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-800 m-0">Planejamento de Visita</h2>
        <p className="text-sm text-slate-500">Planejamento anual por amostragem, com torres obrigatórias e guia de campo.</p>
      </div>

      {/* Project Select */}
      <div className="max-w-md">
        <Select id="visit-project" label="Empreendimento" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Empreendimento...</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.id} - {project.nome}</option>
          ))}
        </Select>
      </div>

      {feriadosDoAno.length > 0 && !feriadosAlertDismissed ? (
        <Card
          variant="flat"
          className="bg-amber-50 border border-amber-200 text-amber-800"
          data-testid="visit-planning-feriados-alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm font-bold">
                <AppIcon name="calendar" />
                Feriados em {year} ({feriadosDoAno.length})
              </div>
              <p className="text-sm m-0">
                Evite agendar visitas nestas datas. E possivel marca-las, mas o sistema ira sinalizar no diario da vistoria.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {feriadosDoAno.map((f) => {
                  const [, mm, dd] = f.data.split('-');
                  return (
                    <Badge key={f.data} tone="warning" size="sm">{`${dd}/${mm} ${f.nome}`}</Badge>
                  );
                })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFeriadosAlertDismissed(true)}
              aria-label="Dispensar alerta de feriados"
            >
              <AppIcon name="close" />
            </Button>
          </div>
        </Card>
      ) : null}

      {selectedProject && (
        <>
          {/* Stats Info Box */}
          <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
            <div><strong className="text-slate-700">Total torres:</strong> <span className="text-slate-600">{planning.totalTorres}</span></div>
            <div><strong className="text-slate-700">Meta anual:</strong> <span className="text-slate-600">{planning.metaAmostragem}</span></div>
            <div><strong className="text-slate-700">Obrigatórias:</strong> <span className="text-slate-600">{planning.obrigatorias.length}</span></div>
            <div><strong className="text-slate-700">Amostragem (auto):</strong> <span className="text-slate-600">{planning.amostragemSelecionada.length}</span></div>
            <div><strong className="text-slate-700">Não priorizar:</strong> <span className="text-slate-600">{planning.naoPriorizar.length}</span></div>
            <div><strong className="text-slate-700">Seed:</strong> <span className="text-slate-600">{planning.seed}</span></div>
          </div>

          {/* Selection Summary */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
            <div className="text-sm">
              <strong className="text-slate-700">Seleção atual:</strong> <span className="text-slate-600">{selectedItems.length} torre(s)</span>
            </div>
            <div className="text-sm">
              <strong className="text-slate-700">Torre-alvo (última da sequência):</strong> <span className="text-slate-600">{targetTower || 'N/D'}</span>
            </div>
            {priorityHotel ? (
              <div className="text-sm text-slate-600">
                <strong className="text-slate-700">Hotel prioritário da última torre{targetTower ? ` (T${targetTower})` : ''}:</strong>
                {' '}
                {priorityHotel.hotelSugeridoNome}
                {priorityHotel.hotelSugeridoMunicipio ? ` (${priorityHotel.hotelSugeridoMunicipio})` : ''}
                {priorityHotel.hotelSugeridoTorreBase ? ` | Torre base ${priorityHotel.hotelSugeridoTorreBase}` : ''}
                {priorityHotel.hotelSugeridoDistanciaTorreAlvo !== '' ? ` | Distância ${formatHotelDistance(priorityHotel.hotelSugeridoDistanciaTorreAlvo)}` : ''}
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">Sem histórico de hotel para priorização da torre-alvo.</div>
            )}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedTowers(allSelectable.map((item) => item.torre))}>
                <AppIcon name="check" />
                Marcar todas
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedTowers([...planning.obrigatorias, ...planning.amostragemSelecionada].map((item) => item.torre))}>
                <AppIcon name="reset" />
                Reset padrão
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedTowers([])}>
                <AppIcon name="close" />
                Limpar seleção
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => onApplySelection?.({ projectId: selectedProject.id, towers: selectedItems, towerInput: serialized })}
              disabled={!serialized}
            >
              <AppIcon name="clipboard" />
              Aplicar seleção na nova vistoria
            </Button>
            <Button variant="outline" onClick={() => setShowGuidePreview(true)} disabled={!serialized}>
              <AppIcon name="details" />
              Gerar guia (visual)
            </Button>
            <Button variant="outline" onClick={exportGuideCsv} disabled={!serialized}>
              <AppIcon name="csv" />
              Exportar guia CSV
            </Button>
          </div>

          {/* Tower Cards */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <article className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <h3 className="text-sm font-bold text-slate-800 px-4 py-3 bg-slate-50 border-b border-slate-200 m-0">Obrigatórias</h3>
              <div>
                {obrigatoriasItems.map((item) => renderTowerItem(item, true))}
                {obrigatoriasItems.length === 0 && <div className="px-4 py-6 text-sm text-slate-500 italic text-center">Nenhuma torre obrigatória.</div>}
              </div>
            </article>
            <article className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <h3 className="text-sm font-bold text-slate-800 px-4 py-3 bg-slate-50 border-b border-slate-200 m-0">Selecionadas por amostragem</h3>
              <div>
                {amostragemItems.map((item) => renderTowerItem(item, true))}
                {amostragemItems.length === 0 && <div className="px-4 py-6 text-sm text-slate-500 italic text-center">Nenhuma torre em amostragem automática.</div>}
              </div>
            </article>
            <article className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <h3 className="text-sm font-bold text-slate-800 px-4 py-3 bg-slate-50 border-b border-slate-200 m-0">Não priorizar</h3>
              <div>
                {naoPriorizarItems.map((item) => renderTowerItem(item, true))}
                {naoPriorizarItems.length === 0 && <div className="px-4 py-6 text-sm text-slate-500 italic text-center">Nenhuma torre nesta categoria.</div>}
              </div>
            </article>
          </div>
        </>
      )}

      <Modal
        open={showGuidePreview && !!selectedProject}
        onClose={() => setShowGuidePreview(false)}
        title={`Guia de Campo - ${selectedProject?.id || ''}`}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowGuidePreview(false)}>
              <AppIcon name="close" />
              Fechar
            </Button>
            <Button variant="primary" onClick={exportGuideCsv}>
              <AppIcon name="csv" />
              Exportar CSV
            </Button>
          </>
        }
      >
        <div className="text-sm text-slate-600 flex flex-col gap-1 mb-4">
          <div><strong className="text-slate-700">Empreendimento:</strong> {selectedProject?.id} - {selectedProject?.nome || '-'}</div>
          <div><strong className="text-slate-700">Ano:</strong> {year}</div>
          <div><strong className="text-slate-700">Total selecionado:</strong> {selectedItems.length}</div>
          <div><strong className="text-slate-700">Torre-alvo:</strong> {targetTower || 'N/D'}</div>
          {priorityHotel && (
            <div>
              <strong className="text-slate-700">Hotel prioritário da última torre{targetTower ? ` (T${targetTower})` : ''}:</strong>
              {' '}
              {priorityHotel.hotelSugeridoNome}
              {priorityHotel.hotelSugeridoMunicipio ? ` (${priorityHotel.hotelSugeridoMunicipio})` : ''}
            </div>
          )}
        </div>
        <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">Torre</th>
                <th className="px-3 py-2.5">Categoria</th>
                <th className="px-3 py-2.5">Motivo</th>
                <th className="px-3 py-2.5">Hotel sugerido</th>
                <th className="px-3 py-2.5">Município</th>
                <th className="px-3 py-2.5">Logística</th>
                <th className="px-3 py-2.5">Reserva</th>
                <th className="px-3 py-2.5">Estadia</th>
                <th className="px-3 py-2.5">Torre base</th>
                <th className="px-3 py-2.5">Distância alvo</th>
                <th className="px-3 py-2.5">Link Maps</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {selectedItems.map((item) => (
                <tr key={`guide-${item.torre}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{item.torre}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.categoria}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.motivo}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.hotelSugeridoNome || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.hotelSugeridoMunicipio || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatHotelNote(item.hotelSugeridoLogisticaNota)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatHotelNote(item.hotelSugeridoReservaNota)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatHotelNote(item.hotelSugeridoEstadiaNota)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.hotelSugeridoTorreBase || '-'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{item.hotelSugeridoDistanciaTorreAlvo !== '' ? formatHotelDistance(item.hotelSugeridoDistanciaTorreAlvo) : '-'}</td>
                  <td className="px-3 py-2.5">{item.mapsLink ? <a href={item.mapsLink} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Abrir</a> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </section>
  );
}

export default VisitPlanningView;
