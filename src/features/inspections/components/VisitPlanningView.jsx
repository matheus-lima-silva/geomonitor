import { useEffect, useMemo, useState } from 'react';
import { buildPlanningGuideRows, exportPlanningGuideCsv } from '../utils/planningGuideExport';
import { computeVisitPlanning, serializeTowersForInput } from '../utils/visitPlanning';

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

  const allSelectable = useMemo(
    () => [...planning.obrigatorias, ...planning.amostragemSelecionada, ...planning.naoPriorizar],
    [planning.obrigatorias, planning.amostragemSelecionada, planning.naoPriorizar],
  );

  const selectedItems = useMemo(
    () => allSelectable.filter((item) => selectedTowers.includes(item.torre)),
    [allSelectable, selectedTowers],
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
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Empreendimento...</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.id} - {project.nome}</option>
          ))}
        </select>
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
            <div className="row-actions">
              <button type="button" className="secondary" onClick={() => setSelectedTowers(allSelectable.map((item) => item.torre))}>
                Marcar todas
              </button>
              <button type="button" className="secondary" onClick={() => setSelectedTowers([...planning.obrigatorias, ...planning.amostragemSelecionada].map((item) => item.torre))}>
                Reset padrão
              </button>
              <button type="button" className="secondary" onClick={() => setSelectedTowers([])}>
                Limpar seleção
              </button>
            </div>
          </div>

          <div className="row-actions">
            <button
              type="button"
              onClick={() => onApplySelection?.({ projectId: selectedProject.id, towers: selectedItems, towerInput: serialized })}
              disabled={!serialized}
            >
              Aplicar seleção na nova vistoria
            </button>
            <button type="button" className="secondary" onClick={() => setShowGuidePreview(true)} disabled={!serialized}>
              Gerar guia (visual)
            </button>
            <button type="button" className="secondary" onClick={exportGuideCsv} disabled={!serialized}>
              Exportar guia CSV
            </button>
          </div>

          <div className="project-cards">
            <article className="project-card">
              <h3>Obrigatórias</h3>
              <div className="muted">
                {planning.obrigatorias.map((item) => renderTowerItem(item, true))}
                {planning.obrigatorias.length === 0 && <div>Nenhuma torre obrigatória.</div>}
              </div>
            </article>
            <article className="project-card">
              <h3>Selecionadas por amostragem</h3>
              <div className="muted">
                {planning.amostragemSelecionada.map((item) => renderTowerItem(item, true))}
                {planning.amostragemSelecionada.length === 0 && <div>Nenhuma torre em amostragem automática.</div>}
              </div>
            </article>
            <article className="project-card">
              <h3>Não priorizar</h3>
              <div className="muted">
                {planning.naoPriorizar.map((item) => renderTowerItem(item, true))}
                {planning.naoPriorizar.length === 0 && <div>Nenhuma torre nesta categoria.</div>}
              </div>
            </article>
          </div>
        </>
      )}

      {showGuidePreview && selectedProject && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <h3>Guia de Campo - {selectedProject.id}</h3>
            <div className="muted">
              <div><strong>Empreendimento:</strong> {selectedProject.id} - {selectedProject.nome || '-'}</div>
              <div><strong>Ano:</strong> {year}</div>
              <div><strong>Total selecionado:</strong> {selectedItems.length}</div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Torre</th>
                    <th>Categoria</th>
                    <th>Motivo</th>
                    <th>Link Maps</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item) => (
                    <tr key={`guide-${item.torre}`}>
                      <td>{item.torre}</td>
                      <td>{item.categoria}</td>
                      <td>{item.motivo}</td>
                      <td>{item.mapsLink ? <a href={item.mapsLink} target="_blank" rel="noreferrer">Abrir</a> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-actions">
              <button type="button" className="secondary" onClick={() => setShowGuidePreview(false)}>Fechar</button>
              <button type="button" onClick={exportGuideCsv}>Exportar CSV</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default VisitPlanningView;
