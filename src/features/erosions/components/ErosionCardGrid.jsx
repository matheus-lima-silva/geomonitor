import AppIcon from '../../../components/AppIcon';
import { erosionStatusClass, normalizeErosionStatus } from '../../shared/statusUtils';
import { getLocalContextLabel, normalizeErosionTechnicalFields } from '../utils/erosionUtils';

function getImpactClassName(impact) {
  if (impact === 'Muito Alto') return 'erosions-impact-chip is-critical';
  if (impact === 'Alto') return 'erosions-impact-chip is-high';
  if (impact === 'Medio' || impact === 'Médio') return 'erosions-impact-chip is-medium';
  return 'erosions-impact-chip is-low';
}

function ErosionCardGrid({
  erosions = [],
  projects = [],
  onOpenDetails,
  onOpenEdit,
  onRequestDelete,
  onOpenMaps,
  hasCoordinates,
}) {
  const projectsById = new Map((projects || []).map((item) => [String(item?.id || '').trim(), item]));

  return (
    <div className="erosions-card-grid">
      {erosions.map((erosion) => {
        const projectId = String(erosion?.projetoId || '').trim();
        const project = projectsById.get(projectId);
        const normalizedStatus = normalizeErosionStatus(erosion.status);
        const technical = normalizeErosionTechnicalFields(erosion || {});
        const localContexto = technical.localContexto || {};
        const localLabel = getLocalContextLabel(localContexto.localTipo) || '-';
        return (
          <article key={erosion.id} className="erosions-card">
            <div className="erosions-card-head">
              <div className="erosions-card-id-row">
                <h3>{erosion.id || '-'}</h3>
                <span className={erosionStatusClass(erosion.status)}>
                  {normalizedStatus}
                </span>
              </div>
              <div className="erosions-card-chips">
                <span className="status-chip">{projectId || '-'}</span>
                {String(erosion?.torreRef || '').trim() ? (
                  <span className="status-chip">{`Torre ${erosion.torreRef}`}</span>
                ) : null}
                <span className={getImpactClassName(erosion.impacto)}>
                  {erosion.impacto || 'Nao informado'}
                </span>
              </div>
            </div>

            <div className="erosions-card-meta">
              {project?.nome ? (
                <div className="erosions-card-meta-row">
                  <span>Empreendimento</span>
                  <strong>{project.nome}</strong>
                </div>
              ) : null}
              <div className="erosions-card-meta-row">
                <span>Tipo</span>
                <strong>{erosion.tipo || '-'}</strong>
              </div>
              <div className="erosions-card-meta-row">
                <span>Estagio</span>
                <strong>{erosion.estagio || '-'}</strong>
              </div>
              <div className="erosions-card-meta-row">
                <span>Local</span>
                <strong>{localLabel}</strong>
              </div>
              {localContexto.localTipo === 'outros' ? (
                <div className="erosions-card-meta-row">
                  <span>Detalhe local</span>
                  <strong>{localContexto.localDescricao || '-'}</strong>
                </div>
              ) : null}
            </div>

            <div className="erosions-card-actions">
              <button type="button" className="secondary" onClick={() => onOpenDetails(erosion)}>
                <AppIcon name="details" />
                Detalhes
              </button>
              {hasCoordinates(erosion) ? (
                <button type="button" onClick={() => onOpenMaps(erosion)}>
                  <AppIcon name="map" />
                  Navegar
                </button>
              ) : null}
              <button type="button" className="secondary" onClick={() => onOpenEdit(erosion)}>
                <AppIcon name="edit" />
                Editar
              </button>
              <button type="button" className="danger" onClick={() => onRequestDelete(erosion)}>
                <AppIcon name="trash" />
                Excluir
              </button>
            </div>
          </article>
        );
      })}

      {erosions.length === 0 ? (
        <article className="erosions-card erosions-card-empty">
          <p className="muted">Nenhuma erosao encontrada.</p>
        </article>
      ) : null}
    </div>
  );
}

export default ErosionCardGrid;
