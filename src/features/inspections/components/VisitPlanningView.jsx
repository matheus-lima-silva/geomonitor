import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Modal, Select } from '../../../components/ui';
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

function VisitPlanningView({ projects, inspections, erosions, onApplySelection }) {
  const [projectId, setProjectId] = useState('');
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [showGuidePreview, setShowGuidePreview] = useState(false);

  const selectedProject = projects.find((item) => item.id === projectId) || null;
  const year = new Date().getFullYear();

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
      <div key={`${item.categoria}-${item.torre}`}>
        <label>
          <input
            type="checkbox"
            checked={selectedTowers.includes(item.torre)}
            disabled={!selectable}
            onChange={() => toggleTower(item.torre)}
          />
          {' '}
          <strong>Torre {item.torre}:</strong> {item.motivo}
        </label>
        {item.mapsLink && (
          <div>
            <small>
              <a href={item.mapsLink} target="_blank" rel="noreferrer">Abrir no Maps</a>
            </small>
          </div>
        )}
        {item.comentariosAnteriores?.length > 0 && (
          <div>
            {item.comentariosAnteriores.map((comment, idx) => (
              <div key={`${item.torre}-${idx}`}>
                <small>
                  {comment.data || '-'} {comment.inspectionId ? `(${comment.inspectionId})` : ''}: {comment.obs}
                </small>
              </div>
            ))}
          </div>
        )}
        {item.hotelSugeridoNome ? (
          <div>
            <small>
              Hotel sugerido: <strong>{item.hotelSugeridoNome}</strong>
              {item.hotelSugeridoMunicipio ? ` (${item.hotelSugeridoMunicipio})` : ''}
              {item.hotelSugeridoTorreBase ? ` | Torre base: ${item.hotelSugeridoTorreBase}` : ''}
              {item.hotelSugeridoDistanciaTorreAlvo !== '' ? ` | Distância da torre-alvo: ${formatHotelDistance(item.hotelSugeridoDistanciaTorreAlvo)}` : ''}
            </small>
            <div>
              <small>
                Notas - Logística: {formatHotelNote(item.hotelSugeridoLogisticaNota)}
                {' | '}
                Reserva: {formatHotelNote(item.hotelSugeridoReservaNota)}
                {' | '}
                Estadia: {formatHotelNote(item.hotelSugeridoEstadiaNota)}
              </small>
            </div>
          </div>
        ) : (
          <div><small>Sem histórico de hospedagem para esta torre.</small></div>
        )}
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <h2>Planejamento de Visita</h2>
          <p className="muted">Planejamento anual por amostragem, com torres obrigatórias e guia de campo.</p>
        </div>
      </div>

      <div className="grid-form">
        <Select id="visit-project" label="Empreendimento" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Empreendimento...</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.id} - {project.nome}</option>
          ))}
        </Select>
      </div>

      {selectedProject && (
        <>
          <div className="notice">
            <div><strong>Total torres:</strong> {planning.totalTorres}</div>
            <div><strong>Meta anual:</strong> {planning.metaAmostragem}</div>
            <div><strong>Obrigatórias:</strong> {planning.obrigatorias.length}</div>
            <div><strong>Amostragem selecionada (auto):</strong> {planning.amostragemSelecionada.length}</div>
            <div><strong>Não priorizar:</strong> {planning.naoPriorizar.length}</div>
            <div><strong>Seed:</strong> {planning.seed}</div>
          </div>

          <div className="notice">
            <strong>Seleção atual:</strong> {selectedItems.length} torre(s)
            <div><strong>Torre-alvo (última da sequência):</strong> {targetTower || 'N/D'}</div>
            {priorityHotel ? (
              <div>
                <strong>Hotel prioritário da última torre{targetTower ? ` (T${targetTower})` : ''}:</strong>
                {' '}
                {priorityHotel.hotelSugeridoNome}
                {priorityHotel.hotelSugeridoMunicipio ? ` (${priorityHotel.hotelSugeridoMunicipio})` : ''}
                {priorityHotel.hotelSugeridoTorreBase ? ` | Torre base ${priorityHotel.hotelSugeridoTorreBase}` : ''}
                {priorityHotel.hotelSugeridoDistanciaTorreAlvo !== '' ? ` | Distância ${formatHotelDistance(priorityHotel.hotelSugeridoDistanciaTorreAlvo)}` : ''}
              </div>
            ) : (
              <div>Sem histórico de hotel para priorização da torre-alvo.</div>
            )}
            <div className="row-actions">
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

          <div className="row-actions">
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

          <div className="project-cards">
            <article className="project-card">
              <h3>Obrigatórias</h3>
              <div className="muted">
                {obrigatoriasItems.map((item) => renderTowerItem(item, true))}
                {obrigatoriasItems.length === 0 && <div>Nenhuma torre obrigatória.</div>}
              </div>
            </article>
            <article className="project-card">
              <h3>Selecionadas por amostragem</h3>
              <div className="muted">
                {amostragemItems.map((item) => renderTowerItem(item, true))}
                {amostragemItems.length === 0 && <div>Nenhuma torre em amostragem automática.</div>}
              </div>
            </article>
            <article className="project-card">
              <h3>Não priorizar</h3>
              <div className="muted">
                {naoPriorizarItems.map((item) => renderTowerItem(item, true))}
                {naoPriorizarItems.length === 0 && <div>Nenhuma torre nesta categoria.</div>}
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
        <div className="muted">
          <div><strong>Empreendimento:</strong> {selectedProject?.id} - {selectedProject?.nome || '-'}</div>
          <div><strong>Ano:</strong> {year}</div>
          <div><strong>Total selecionado:</strong> {selectedItems.length}</div>
          <div><strong>Torre-alvo:</strong> {targetTower || 'N/D'}</div>
          {priorityHotel && (
            <div>
              <strong>Hotel prioritário da última torre{targetTower ? ` (T${targetTower})` : ''}:</strong>
              {' '}
              {priorityHotel.hotelSugeridoNome}
              {priorityHotel.hotelSugeridoMunicipio ? ` (${priorityHotel.hotelSugeridoMunicipio})` : ''}
            </div>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Torre</th>
                <th>Categoria</th>
                <th>Motivo</th>
                <th>Hotel sugerido</th>
                <th>Município</th>
                <th>Logística</th>
                <th>Reserva</th>
                <th>Estadia</th>
                <th>Torre base</th>
                <th>Distância alvo</th>
                <th>Link Maps</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map((item) => (
                <tr key={`guide-${item.torre}`}>
                  <td>{item.torre}</td>
                  <td>{item.categoria}</td>
                  <td>{item.motivo}</td>
                  <td>{item.hotelSugeridoNome || '-'}</td>
                  <td>{item.hotelSugeridoMunicipio || '-'}</td>
                  <td>{formatHotelNote(item.hotelSugeridoLogisticaNota)}</td>
                  <td>{formatHotelNote(item.hotelSugeridoReservaNota)}</td>
                  <td>{formatHotelNote(item.hotelSugeridoEstadiaNota)}</td>
                  <td>{item.hotelSugeridoTorreBase || '-'}</td>
                  <td>{item.hotelSugeridoDistanciaTorreAlvo !== '' ? formatHotelDistance(item.hotelSugeridoDistanciaTorreAlvo) : '-'}</td>
                  <td>{item.mapsLink ? <a href={item.mapsLink} target="_blank" rel="noreferrer">Abrir</a> : '-'}</td>
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
